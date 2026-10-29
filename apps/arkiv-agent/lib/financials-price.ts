import { latestHistoryPrice } from "./glm-history";
import { glmPrice, type PriceState } from "./glm-price";

/**
 * The GLM price for /financials: the live spot price when one is cached, else the chart history's
 * newest stored close, so the USD figures and the chart never disagree. The status stays as the live
 * lookup reports it ("loading"), so the page keeps refreshing until the live price replaces the close.
 */
export function financialsPrice(live: () => PriceState = glmPrice, history: () => ReturnType<typeof latestHistoryPrice> = latestHistoryPrice): PriceState {
  const state = live();
  if (state.price || state.status === "off") return state;
  const close = history();
  return close ? { ...state, price: close } : state;
}
