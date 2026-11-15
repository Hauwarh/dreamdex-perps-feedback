# dreamDEX Perps Feedback

Reproducible feedback for the dreamDEX Perps Builder Bounty (Feedback track) on Somnia Tokyo testnet (Hideki, chain id 50383).

Focus: the perps surface of `@somnia-chain/markets-sdk` 0.33.0, including `quotePerpClose` and the `somniaTokyo` chain export, both new in 0.33.0, and the unified (ccxt-style) layer most bot and agent builders start from. Items 08 to 11 cover the new explorer, tested on a phone.

## Findings

| # | File | Title | Severity | Area |
|---|------|-------|----------|------|
| 01 | [01-sdk-unified-margin-amount-cannot-round-trip.md](feedback/01-sdk-unified-margin-amount-cannot-round-trip.md) | Unified depositMargin / withdrawMargin take a JS number; a full-balance withdraw overshoots about half the time | normal | SDK |
| 02 | [02-sdk-fetchpositions-labels-index-as-mark.md](feedback/02-sdk-fetchpositions-labels-index-as-mark.md) | fetchPositions reports the index as `markPrice` with `perpState: "ok"` on a stale feed; fetchFundingRate reports `undefined` | normal | SDK |
| 03 | [03-sdk-quoteperpclose-counts-own-resting-orders.md](feedback/03-sdk-quoteperpclose-counts-own-resting-orders.md) | quotePerpClose counts the account's own resting orders as close liquidity; default self-match cancels the close | major | SDK |
| 04 | [04-sdk-quoteperpclose-ignores-min-quantity.md](feedback/04-sdk-quoteperpclose-ignores-min-quantity.md) | quotePerpClose ignores minQuantity and quotes an unplaceable dust close as fillable | normal | SDK |
| 05 | [05-sdk-unified-no-leverage-methods.md](feedback/05-sdk-unified-no-leverage-methods.md) | No unified setLeverage / fetchLeverage; `has` omits the key instead of `false` | normal | SDK |
| 06 | [06-sdk-unified-no-watchpositions.md](feedback/06-sdk-unified-no-watchpositions.md) | No unified watchPositions, although the raw tier streams positions | normal | SDK |
| 07 | [07-sdk-docs-somniatokyo-name-points-at-mainnet.md](feedback/07-sdk-docs-somniatokyo-name-points-at-mainnet.md) | `somniaTokyo` / `SOMNIA_TOKYO_ADDRESSES` are mainnet (50321, live MarginBank) while the perps testnet is called "Somnia Tokyo testnet" | normal | docs |
| 08 | [08-app-explorer-venues-shows-raw-json-metadata.md](feedback/08-app-explorer-venues-shows-raw-json-metadata.md) | Explorer /venues shows venue-kit metadata as raw JSON strings | normal | app |
| 09 | [09-app-explorer-venues-operators-table-unreadable-on-phone.md](feedback/09-app-explorer-venues-operators-table-unreadable-on-phone.md) | Explorer tables on a phone (/venues Operators, /tokens): values clipped, no scroll cue, identifying column scrolls away | normal | app |
| 10 | [10-app-explorer-venues-retired-status-only-in-free-text.md](feedback/10-app-explorer-venues-retired-status-only-in-free-text.md) | Explorer /venues: retired status lives only in description text; "superseded by venue 3" cannot be resolved | normal | app |
| 11 | [11-app-explorer-blocks-and-txs-pages-have-no-history.md](feedback/11-app-explorer-blocks-and-txs-pages-have-no-history.md) | Explorer /blocks and /txs start empty on every visit, list only what the browser saw since load, no paging or pause | normal | app |

Screenshots for items 08 to 11 are in `evidence/explorer-venues/`, `evidence/explorer-tokens/` and `evidence/explorer-feeds/`.

## Run the repros

```bash
npm install
npm run repro:01   # offline; set PRIVATE_KEY (testnet only) to also simulate on Hideki
npm run repro:02   # offline
npm run repro:03   # offline; calls the SDK's real quotePerpClose against a mock RPC (items 03 and 04)
```

`repro:01` Part B only simulates the withdrawal with `eth_call`. It never sends a transaction.

## Environment
- SDK: `@somnia-chain/markets-sdk` 0.33.0 (items 01, 02, 05, 06 also reproduce on 0.32.1)
- Network: Somnia Tokyo testnet / Hideki, chain id 50383
- Node 18+

## Security
Any security issue goes privately to security@dreamdex.io, not into this repo.
