# Unified depositMargin / withdrawMargin take a JS number, so a full-balance withdraw overshoots about half the time

Severity: normal
Area: SDK

## Steps to reproduce
1. `npm install` in this repo (pins `@somnia-chain/markets-sdk@0.33.0`; same code in 0.32.1).
2. Run `node repro/01-margin-roundtrip.mjs` (Part A is offline, no wallet needed).
3. Optional on-chain check: set `PRIVATE_KEY` to a Hideki testnet key with perps margin and **no open positions or resting orders**, and run it again (this keeps the on-chain `withdrawable` value simple, so the only difference measured is the SDK's conversion). Part B reads `withdrawable`, computes what `exchange.withdrawMargin(ref, amount)` would send, and simulates the call with `eth_call`. No funds move.

The unified path, from `src/unified/exchange.ts` @ 0.33.0:
- `withdrawMargin(ref, amount: number)` (L6026) sends `Structs.toRaw(amount, m.quoteDecimals)` (L6039).
- `depositMargin(ref, amount: number)` (L5989) does the same (L6002).
- Balances reach a unified caller as numbers through `Structs.toHumanNum(raw, 18)`.

USDso is 18 decimals. A JS number holds about 15 to 17 significant digits, so a balance like `2.021368500568277588` cannot survive `raw -> number -> raw`.

## Expected
A unified caller can withdraw (or deposit) exactly the balance the SDK reports, for example with an `amount: "max"` option, a `bigint`/string amount overload, or by clamping the converted amount to the on-chain `withdrawable` before sending.

## Actual
Part A output on 10,000 random balances up to 1,000,000 USDso:

```
sent MORE than balance (would revert): 4995
sent LESS than balance (leaves dust) : 4976
exact                                : 29
e.g. balance 2021368500568277588 wei -> shown as 2.0213685005682778 -> sent 2021368500568277800 wei (+212)
e.g. balance 16336879138292273062 wei -> sent 16336879138292270000 wei (dust 3062)
```

So "withdraw everything" through the unified API asks for more than the account has in roughly 50% of cases (a few hundred wei over), and leaves dust in the rest. The same applies to depositing a full wallet balance. The only exact path is dropping to `exchange.trader.withdrawMargin({ marginBank, amount: bigint })`, which the unified docs do not point to.

`Structs.floorToRaw` already exists for quantities (`createOrder` uses it to avoid this exact overshoot, see L5184 to L5188), but the margin methods use rounding `toRaw`.

## Evidence
- Repro script: `repro/01-margin-roundtrip.mjs` (Part A output above).
- Source (0.33.0): `src/unified/exchange.ts` L5989 to L6045 (`depositMargin`, `withdrawMargin`); `src/unified/structs.ts` L685 (`toRaw`), L736 (`floorToRaw`), L843 (`toHumanNum`).
- Part B of the script simulates the same withdrawal on Hideki with `eth_call` for any reviewer key (no funds move); Part A alone is sufficient, because the overshoot is a property of the SDK's conversion, not of chain state.

## Suggested fix
- Accept exact amounts: `withdrawMargin(ref, amount: number | bigint | "max")` and the same for `depositMargin`. A `bigint` is sent as raw units unchanged; `"max"` reads `withdrawable` (or the wallet balance for deposits) at send time.
- For `number` input, convert with `Structs.floorToRaw` (as `createOrder` already does) and clamp to the on-chain `withdrawable`, so a value the SDK itself reported can never overshoot.
- Document in EXCHANGE.md that unified amounts are JS numbers and point to the raw-tier `trader.withdrawMargin` for exact amounts.

## Environment
- SDK: `@somnia-chain/markets-sdk` 0.33.0 (also 0.32.1)
- Network: Somnia Tokyo testnet (Hideki, chain id 50383)
- Wallet address: not needed for Part A (offline); Part B uses the reviewer's own testnet key
