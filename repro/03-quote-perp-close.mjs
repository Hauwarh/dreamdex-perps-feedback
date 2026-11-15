// Repro for feedback/03 and feedback/04: SomniaMarketsClient.quotePerpClose (new in 0.33.0).
//
// Calls the SDK's REAL quotePerpClose (dist/perp/closeQuote.js) against a mock PublicClient
// that answers the exact reads it makes (tryGetMarkPrice, getCircuitBreakerParameters,
// getOrderBookParameters, MarginBank.getPosition, getBookLevels). No network, no wallet.
//
// Case A (feedback/03): the account is long 1 BTC and also has its own resting bid of 1 BTC
//   at the top of the bid side. The quote counts that bid as liquidity for the close.
// Case B (feedback/04): a 0.00005 BTC dust position on a pool with minQuantity 0.0001.
//   The quote aligns to lotSize and never checks minQuantity.
//
// Run: node repro/03-quote-perp-close.mjs
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
// package.json is not in the SDK's exports map, so locate the package from its main entry.
const sdkRoot = join(dirname(require.resolve("@somnia-chain/markets-sdk")), "..");
const { quotePerpClose } = await import(pathToFileURL(join(sdkRoot, "dist/perp/closeQuote.js")).href);
const { version } = JSON.parse(readFileSync(join(sdkRoot, "package.json"), "utf8"));

const E18 = 10n ** 18n;
const POOL = "0x00000000000000000000000000000000000000a1";
const BANK = "0x00000000000000000000000000000000000000b1";
const ME = "0x00000000000000000000000000000000000000c1";

function mockClient({ positionSize, bids, asks, lotSize, minQuantity, tickSize = E18 / 100n }) {
  return {
    async getBlockNumber() {
      return 1_000_000n;
    },
    async readContract({ functionName, args }) {
      switch (functionName) {
        case "tryGetMarkPrice":
          return [true, 65_000n * E18];
        case "getLastGoodMarkPrice":
          return 65_000n * E18;
        case "getCircuitBreakerParameters":
          return { maxPriceMovementBps: 500n };
        case "getOrderBookParameters":
          return { tickSize, minQuantity, lotSize };
        case "getPosition":
          return { size: positionSize };
        case "getBookLevels": {
          const [isBidSide, depth] = args;
          return (isBidSide ? bids : asks).slice(0, Number(depth));
        }
        default:
          throw new Error("unexpected read " + functionName);
      }
    },
  };
}
const fmt = (x) => (x == null ? String(x) : (Number(x) / 1e18).toString());

// ---------- Case A ----------
// Bids, best first. The top level is the account's OWN resting bid (1 BTC @ 64,990).
// getBookLevels aggregates by price and does not say who owns a level.
const ownBid = { price: 64_990n * E18, quantity: 1n * E18 };
const othersBid = { price: 64_500n * E18, quantity: 1n * E18 };
const a = await quotePerpClose(
  { pool: POOL, marginBank: BANK, account: ME },
  mockClient({ positionSize: 1n * E18, bids: [ownBid, othersBid], asks: [], lotSize: E18 / 10_000n, minQuantity: E18 / 10_000n }),
);
console.log(`SDK ${version}`);
console.log("Case A: long 1 BTC, own resting bid 1 BTC @ 64,990 at top of book, others' bid 1 BTC @ 64,500");
console.log("  quote.quantity       :", fmt(a.quantity));
console.log("  quote.fillableSize   :", fmt(a.fillableSize));
console.log("  quote.averagePrice   :", fmt(a.averagePrice), " <- the account's own bid price");
console.log("  quote.bandToFillAll  :", a.bandToFillAll?.toString(), "bps");
console.log("  The close sells into the bids; the first level it crosses is the account's own order.");
console.log("  Default selfMatchingOption is 0 (CANCEL_TAKER): the rest of the close is cancelled there,");
console.log("  so the real fill is 0, not", fmt(a.fillableSize), ". Nothing in the quote warns about it.");

// ---------- Case B ----------
const b = await quotePerpClose(
  { pool: POOL, marginBank: BANK, account: ME },
  mockClient({
    positionSize: 5n * 10n ** 13n, // 0.00005 BTC long
    bids: [{ price: 64_990n * E18, quantity: 10n * E18 }],
    asks: [],
    lotSize: 10n ** 13n, // 0.00001
    minQuantity: 10n ** 14n, // 0.0001
  }),
);
console.log("\nCase B: long 0.00005 BTC, pool lotSize 0.00001, minQuantity 0.0001, deep bids");
console.log("  quote.quantity       :", fmt(b.quantity));
console.log("  quote.fillableSize   :", fmt(b.fillableSize));
console.log("  quote.bandToFillAll  :", b.bandToFillAll?.toString(), "bps  <- reads as 'fills all, no slippage'");
console.log("  quote has a placeable/minQuantity field:", "placeable" in b || "minQuantity" in b);
console.log("  A close order of 0.00005 is below minQuantity 0.0001 and is rejected by the pool.");
