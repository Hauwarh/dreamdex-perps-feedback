# Unified exchange has no setLeverage / fetchLeverage, and `exchange.has` omits the key instead of reporting false

Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` in this repo.
2. Run:
   ```bash
   grep -nE "\b(setLeverage|fetchLeverage|fetchLeverages|setMarginMode)\b" node_modules/@somnia-chain/markets-sdk/dist/unified/exchange.d.ts || echo "none found"
   ```
3. Check `exchange.has` (`dist/unified/exchange.d.ts` L394 to L442).

## Expected
Leverage is central to perps. The unified (ccxt-style) API should offer `setLeverage(leverage, symbol)` and `fetchLeverage(symbol)`, mapping to the raw-tier `trader.setPerpLeverage` and `client.getPerpLeverage`, which already exist. Per the ccxt `has` convention, unsupported verbs should be listed as `false` so capability probes (`if (exchange.has.setLeverage)`) behave predictably.

## Actual
- No `setLeverage`, `fetchLeverage`, `fetchLeverages` or `setMarginMode` on `SomniaMarkets`. A unified bot must construct a raw `PerpPositionRef` (MarginBank, account, pool addresses) and call `exchange.trader.setPerpLeverage(...)` / `exchange.client.getPerpLeverage(...)` with bigint units.
- `exchange.has` lists only implemented verbs (all `true`), so `exchange.has.setLeverage` is `undefined` rather than `false`.
- The account cap and voucher cap rules in `PerpLeverage` (`src/perp/margin.ts` L660 to L721) are the hard part to get right, which is the main reason a unified wrapper would help.

## Evidence
- `dist/unified/exchange.d.ts` L394 to L442 (`has` map, no leverage keys).
- Raw tier exists: `dist/trade.d.ts` (`setPerpLeverage`), `dist/somniaMarketsClient.d.ts` (`getPerpLeverage`).

## Suggested fix
- Add `setLeverage(leverage: number, symbol: string)` and `fetchLeverage(symbol: string)` to `SomniaMarkets`, resolving the `PerpPositionRef` from the symbol and the configured account, and calling the existing `trader.setPerpLeverage` / `client.getPerpLeverage`.
- Return the account and voucher caps from `PerpLeverage` in `fetchLeverage`'s `info`, and throw a clear error when the requested leverage exceeds them.
- List unsupported ccxt verbs in `has` as `false` (`setMarginMode: false`, and so on).

## Environment
- SDK: `@somnia-chain/markets-sdk` 0.33.0 (also 0.32.1)
- Network: Somnia Tokyo testnet (Hideki, chain id 50383)
- Wallet address: not needed
