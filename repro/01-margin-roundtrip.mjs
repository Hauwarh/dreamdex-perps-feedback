// Repro for feedback/01: the unified API's depositMargin / withdrawMargin take a JS number,
// so an 18-decimal balance cannot round-trip through it.
//
// Part A (offline, no wallet): shows the conversion the unified layer does.
//   SomniaMarkets.withdrawMargin(ref, amount) -> Structs.toRaw(amount, 18) -> Units.fromHuman
//   Balances reach the caller as numbers via Structs.toHumanNum(raw, 18).
//
// Part B (optional, needs PRIVATE_KEY with a perps margin balance on Hideki):
//   reads the real withdrawable amount, computes what the unified call would send,
//   and SIMULATES the withdrawal with eth_call. Nothing is sent, no funds move.
//
// Run: node repro/01-margin-roundtrip.mjs
import { fromHuman, SomniaMarkets, SOMNIA_HIDEKI_TESTNET_ADDRESSES } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { createPublicClient, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Same as Structs.toHumanNum in src/unified/structs.ts
const toHumanNum = (raw, d) => Number(formatUnits(raw, d));
// Same as Structs.toRaw -> Units.fromHuman
const toRaw = (x, d) => fromHuman(x, d);

// ---------- Part A: offline ----------
let over = 0, under = 0, exact = 0, firstOver, firstUnder;
let seed = 12345n;
const rnd = () => (seed = (seed * 6364136223846793005n + 1442695040888963407n) & ((1n << 64n) - 1n));
const N = 10_000;
for (let i = 0; i < N; i++) {
  const raw = rnd() % 10n ** 24n; // balances up to 1,000,000 USDso at 18 dp
  const sent = toRaw(toHumanNum(raw, 18), 18);
  if (sent > raw) { over++; firstOver ??= { raw, sent }; }
  else if (sent < raw) { under++; firstUnder ??= { raw, sent }; }
  else exact++;
}
console.log(`Part A: ${N} random 18-dp balances passed back through the unified number API`);
console.log(`  sent MORE than balance (would revert): ${over}`);
console.log(`  sent LESS than balance (leaves dust) : ${under}`);
console.log(`  exact                                : ${exact}`);
if (firstOver)
  console.log(`  e.g. balance ${firstOver.raw} wei -> shown as ${toHumanNum(firstOver.raw, 18)} -> sent ${firstOver.sent} wei (+${firstOver.sent - firstOver.raw})`);
if (firstUnder)
  console.log(`  e.g. balance ${firstUnder.raw} wei -> sent ${firstUnder.sent} wei (dust ${firstUnder.raw - firstUnder.sent})`);

// ---------- Part B: on-chain simulation (optional) ----------
const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.log("\nPart B skipped: set PRIVATE_KEY (testnet key with perps margin) to simulate on Hideki.");
  process.exit(0);
}
const account = privateKeyToAccount(pk);
const exchange = new SomniaMarkets({
  chain: hidekiTestnet,
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql",
  privateKey: pk,
});
await exchange.loadMarkets();
const perp = Object.values(exchange.markets).find((m) => m.type === "swap");
if (!perp) throw new Error("no perp market loaded");
const marginBank = exchange.market(perp.symbol).market.marginBank;
const acct = await exchange.client.getMarginAccount(marginBank, account.address);
const withdrawable = acct.withdrawable;
const human = toHumanNum(withdrawable, 18); // what a unified caller sees
const sent = toRaw(human, 18); // what exchange.withdrawMargin(ref, human) sends
console.log(`\nPart B: account ${account.address}, MarginBank ${marginBank}, block ${acct.asOfBlock}`);
console.log(`  withdrawable (raw) : ${withdrawable}`);
console.log(`  as unified number  : ${human}`);
console.log(`  unified would send : ${sent} (${sent > withdrawable ? "OVER by " + (sent - withdrawable) : sent < withdrawable ? "UNDER by " + (withdrawable - sent) : "exact"})`);

const call = await exchange.trader.buildWithdrawMargin({ marginBank, amount: sent });
const pub = createPublicClient({ chain: hidekiTestnet, transport: http() });
try {
  await pub.call({ account: account.address, to: call.to, data: call.data, value: call.value });
  console.log("  simulation: SUCCESS");
} catch (e) {
  console.log(`  simulation: REVERTED -> ${e.shortMessage ?? e.message}`);
}
process.exit(0);
