# quotePerpClose counts the account's own resting orders as close liquidity, so it reports a close as fillable when the default self-match setting cancels it

Severity: major
Area: SDK

## Steps to reproduce
1. `npm install` in this repo (pins `@somnia-chain/markets-sdk@0.33.0`, where `quotePerpClose` first shipped).
2. Run `node repro/03-quote-perp-close.mjs`, Case A. It is offline: it calls the SDK's real `quotePerpClose` (`dist/perp/closeQuote.js`) against a mock `PublicClient` that answers the exact reads the function makes.
3. Scenario: the account is long 1 BTC and has its own resting bid of 1 BTC at 64,990 at the top of the bid side. Another trader's bid of 1 BTC sits at 64,500. Mark is 65,000, band 500 bps.

On-chain version (Hideki): open a small long, place a resting limit buy just below the best bid so it becomes the top bid level, then call `client.quotePerpClose({ pool, marginBank, account })` and `exchange.trader.closePerpPosition(...)` with the default `selfMatchingOption`.

## Expected
`quotePerpClose` is documented in PERPS.md ("Closing when the book is thin") as the check a bot runs before sending a close: "tells you how much that is before you send". A close sells into the bids, and the first level it crosses here is the account's own order. With the SDK's default `selfMatchingOption` 0 (`SELF_MATCHING_OPTION.CANCEL_TAKER`: "cancel the remaining taker quantity, leave the maker resting", `src/trade.ts` L860 to L873), the close stops at that level. The quote should either:
- exclude the account's own resting orders on the opposite side (the account variant already knows `account` and `marginBank`), or
- report them, for example `ownOrdersAhead: bigint` / `selfMatchRisk: true`, and say in the docs that the close needs `CANCEL_MAKER` or a cancel first.

## Actual
```
SDK 0.33.0
Case A: long 1 BTC, own resting bid 1 BTC @ 64,990 at top of book, others' bid 1 BTC @ 64,500
  quote.quantity       : 1
  quote.fillableSize   : 1
  quote.averagePrice   : 64989.99999999999  <- the account's own bid price
  quote.bandToFillAll  : 2 bps
```

The quote says the whole position closes within 2 bps at the account's own bid price. In practice the default close fills nothing at that level. `readOppositeSide` reads `getBookLevels`, which aggregates by price and has no owner, and `walk` counts every level (`src/perp/closeQuote.ts` L122 to L167). The response has no field that hints at self-match.

Why major: the setup is common (a long with a "buy the dip" bid, grid bots, market makers quoting both sides), and the moment a bot relies on this quote is usually an emergency exit. A bot that checks `q.fillableSize === q.quantity` and then sends a default close believes it is flat when it is not.

## Evidence
- Repro: `repro/03-quote-perp-close.mjs` (Case A output above), run against the published 0.33.0 package.
- Source: `src/perp/closeQuote.ts` L141 to L167 (`readOppositeSide`), L122 to L139 (`walk`), L174 to L242 (`quotePerpClose`); `src/trade.ts` L860 to L873 (`SELF_MATCHING_OPTION`, default 0 on every placement verb).
- Docs: `docs/PERPS.md` L328 to L346.
- The repro calls the published 0.33.0 `quotePerpClose` itself; only the RPC responses are mocked, using the exact read shapes the function makes, so the result does not depend on market conditions at review time. The on-chain steps above reproduce the same case on Hideki.

## Suggested fix
- In the account variant, read the account's resting orders on the opposite side (the SDK already has them through the account view / `getOpenOrders`) and subtract their quantity from each book level before `walk`.
- Return the gap explicitly, for example `ownOrdersAhead: bigint` and `selfMatchRisk: boolean`, so a caller can cancel or choose `SELF_MATCHING_OPTION.CANCEL_MAKER` first.
- Add one line to PERPS.md "Closing when the book is thin": the quote assumes no own orders on the other side, or a non-default self-match option.

## Environment
- SDK: `@somnia-chain/markets-sdk` 0.33.0
- Network: Somnia Tokyo testnet (Hideki, chain id 50383)
- Wallet address: not needed (offline repro against the published package)
