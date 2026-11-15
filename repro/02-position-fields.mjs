// Repro for feedback/02: with a stale mark feed, fetchPositions() and fetchFundingRate()
// report different `markPrice` values for the same pool state, and fetchPositions labels
// the INDEX price as `markPrice`.
//
// Offline. It feeds one stale pool state (the shape getPerpState returns) through the
// exact field mappings both unified methods use (src/unified/exchange.ts @ 0.32.1):
//   fetchFundingRate  L5641: markPriceOk && markPrice > 0 ? toHumanNum(markPrice) : undefined
//   fetchPositions    L5847: perpMarkForPnl(state) -> markPrice = mark.price (index on fallback)
//
// Run: node repro/02-position-fields.mjs
import { perpMarkForPnl } from "@somnia-chain/markets-sdk";
import { formatUnits } from "viem";

const toHumanNum = (raw, d) => Number(formatUnits(raw, d));
const D = 18;

// A stale mark feed: tryGetMarkPrice returned (false, 0). Index still live.
const state = { markPriceOk: false, markPrice: 0n, indexPrice: 65_000n * 10n ** 18n };
const position = { size: 10n ** 17n /* 0.1 long */, avgEntryPrice: 70_000n * 10n ** 18n };

// fetchFundingRate mapping
const fundingMark = state.markPriceOk && state.markPrice > 0n ? toHumanNum(state.markPrice, D) : undefined;

// fetchPositions mapping
const mark = perpMarkForPnl(state);
const posMark = toHumanNum(mark.price, D);
const entry = toHumanNum(position.avgEntryPrice, D);
const size = toHumanNum(position.size, D);
const upnl = (posMark - entry) * size;

console.log("Same pool, same block, stale mark feed:");
console.log("  fetchFundingRate().markPrice :", fundingMark);
console.log("  fetchPositions()[0].markPrice:", posMark, " <- actually the index price");
console.log("  fetchPositions()[0].unrealizedPnl:", upnl, " <- priced off the index");
console.log("  only hint: info.markFromIndex =", mark.fromIndex, "(info is typed `unknown`)");
console.log("  perpState reported by fetchPositions: \"ok\"");
