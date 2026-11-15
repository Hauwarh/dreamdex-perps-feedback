# SDK 0.33.0 exports `somniaTokyo` / `SOMNIA_TOKYO_ADDRESSES` as mainnet chain 50321 with a live MarginBank, while dreamDEX calls the perps testnet "Somnia Tokyo testnet"

Severity: normal
Area: docs

## Steps to reproduce
1. Read the bounty brief and dreamDEX copy: the perps network is called "Somnia Tokyo testnet". The app at app.testnet.dreamdex.io runs on Hideki, chain id 50383.
2. `npm install @somnia-chain/markets-sdk@0.33.0`.
3. Search the exports for "Tokyo":
   ```bash
   grep -n "export const SOMNIA_TOKYO_ADDRESSES" -A14 node_modules/@somnia-chain/markets-sdk/src/addresses.ts
   grep -n "id:\|testnet:\|name:" node_modules/@somnia-chain/markets-sdk/src/chains/definitions/somniaTokyo.ts
   ```

## Expected
A developer who reads "Somnia Tokyo testnet" and picks the SDK export with that name ends up on the testnet. Either the names line up (for example the testnet export is the one carrying the "Tokyo testnet" label everywhere, and PERPS.md / the perps quickstart say plainly "Somnia Tokyo testnet = `hidekiTestnet`, chain 50383; `somniaTokyo` is mainnet"), or `somniaTokyo` is named so it cannot be read as the testnet (for example `somniaTokyoMainnet`).

## Actual
- `somniaTokyo` is chain id **50321**, `testnet: false`, RPC `api.tokyo.infra.mainnet.somnia.network`, gas token SOMI (`src/chains/definitions/somniaTokyo.ts`). It is new in 0.33.0.
- `SOMNIA_TOKYO_ADDRESSES` is documented as "Somnia Tokyo (chainId 50321, env `tokyo-production`)" and includes a production `marginBank` (`0xDE96cbc9b72fB7317F8C4F1005FBB41fe8Df582A`) and `perpPoolFactory` (`0x32b68B768878ACF8Ae3571351dEEdD60F7AEEB63`) (`src/addresses.ts` L87 to L108).
- The bounty testnet is exported as `hidekiTestnet` / `SOMNIA_HIDEKI_TESTNET_ADDRESSES`, whose name does not contain "Tokyo", although its explorer URL is `explorer.testnet.somnia.network/tokyo` and CHAINS.md L37 calls it "the low-latency Tokyo testnet".
- PERPS.md and the perps how-tos never connect the two names.

So `new SomniaMarkets({ chain: somniaTokyo, addresses: SOMNIA_TOKYO_ADDRESSES, ... })`, the natural reading of "Somnia Tokyo testnet", points a perps bot at the mainnet MarginBank. With a fresh testnet key the first write fails for lack of SOMI gas and the error does not mention the network. With a key that holds mainnet funds, the bot trades real money.

## Evidence
- `src/chains/definitions/somniaTokyo.ts` (id 50321, `testnet: false`) vs `src/chains/definitions/hidekiTestnet.ts` (id 50383, explorer `.../tokyo`).
- `src/addresses.ts` L70 to L108 (Hideki and Tokyo presets).
- `docs/CHAINS.md` L23 to L40; `docs/reference/configuration.md` L199.
- Bounty brief: "dreamDEX perps on Somnia Tokyo testnet".

## Suggested fix
- Rename the mainnet export to something that cannot be read as the testnet (`somniaTokyoMainnet` / `SOMNIA_TOKYO_MAINNET_ADDRESSES`), keeping the old names as deprecated aliases for one release.
- Add a `somniaTokyoTestnet` alias for `hidekiTestnet` (and the matching address preset), since "Somnia Tokyo testnet" is the name dreamDEX uses.
- Put a one-line table in PERPS.md and CHAINS.md: "Somnia Tokyo testnet = `hidekiTestnet`, chain 50383. `somniaTokyo` = mainnet, chain 50321."

## Environment
- SDK: `@somnia-chain/markets-sdk` 0.33.0 (the `somniaTokyo` export is not in 0.32.1)
- Network: Somnia Tokyo testnet (Hideki, chain id 50383) vs Somnia Tokyo (50321)
- Wallet address: not needed
