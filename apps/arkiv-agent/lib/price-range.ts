import type { RangeDays } from "@arkiv-agent/cost";

/** The price chart's ranges. The chosen one lives in the URL as `?range=7` or `?range=90`; the default adds nothing. */
export const RANGE_OPTIONS: readonly RangeDays[] = [7, 30, 90];
export const DEFAULT_RANGE: RangeDays = 30;

export const parseRange = (v: string | undefined): RangeDays => RANGE_OPTIONS.find((d) => String(d) === v) ?? DEFAULT_RANGE;
export const rangeParam = (days: RangeDays): string | null => (days === DEFAULT_RANGE ? null : String(days));
