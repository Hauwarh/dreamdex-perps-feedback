# quotePerpClose ignores the pool's minQuantity, so it quotes a dust position as closable at 0 slippage when the close cannot be placed at all

Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` in this repo (`@somnia-chain/markets-sdk@0.33.0`).
2. Run `node repro/03-quote-perp-close.mjs`, Case B (offline, real SDK function, mock RPC).
3. Scenario: the account is long 0.00005 BTC. The pool's `lotSize` is 0.00001 and `minQuantity` is 0.0001. The bid side is deep.

## Expected
The SDK's own close preview treats this case as unplaceable. `previewPerpClosePnl` returns `placeable` and `minQuantity`, documented as: "`false` means the close cannot be placed at all, not that it is small. A dust position below the minimum can only leave via liquidation or ADL." (`src/perp/margin.ts` L3603 to L3611). `quotePerpClose` should do the same: return `placeable: false` (and `minQuantity`) when the aligned `quantity` is below the pool minimum, and not report `bandToFillAll` as if the close fills.

## Actual
```
Case B: long 0.00005 BTC, pool lotSize 0.00001, minQuantity 0.0001, deep bids
  quote.quantity       : 0.00005
  quote.fillableSize   : 0.00005
  quote.bandToFillAll  : 2 bps  <- reads as 'fills all, no slippage'
  quote has a placeable/minQuantity field: false
```

`quotePerpClose` reads `getOrderBookParameters()` (which includes `minQuantity`), uses only `lotSize` and `tickSize` from it, and never compares the quantity with `minQuantity` (`src/perp/closeQuote.ts` L182 to L212). The doc example in PERPS.md (`if (q.priceable && q.fillableSize < q.quantity)`) passes this case as fine, so a bot sends a close that the pool rejects.

A related edge: when the position is smaller than one lot, `quantity` aligns to `0n`, and the quote returns `fillableSize: 0n` with `bandToFillAll: 0n` (the "fills everything" value), with nothing saying the position cannot be closed by order.

## Evidence
- Repro: `repro/03-quote-perp-close.mjs` (Case B output above).
- Source: `src/perp/closeQuote.ts` L182 to L224; compare `src/perp/margin.ts` L3603 to L3611 and L3742 (`placeable: closedQuantity >= book.minQuantity && closedQuantity > 0n`) and L2729 ("a size below the pool's `minQuantity` is not a small order, it is a revert").
- Docs: `docs/PERPS.md` L328 to L346.

## Suggested fix
- Return `minQuantity` and `placeable: quantity > 0n && quantity >= minQuantity` from `quotePerpClose`, with the same meaning as `previewPerpClosePnl.placeable`.
- When `placeable` is false, return `bandToFillAll: null` (not `0n`), so "cannot close by order" is never read as "fills with no slippage".
- Update the PERPS.md example to check `q.placeable` before sending the close.

## Environment
- SDK: `@somnia-chain/markets-sdk` 0.33.0
- Network: Somnia Tokyo testnet (Hideki, chain id 50383)
- Wallet address: not needed (offline repro)
