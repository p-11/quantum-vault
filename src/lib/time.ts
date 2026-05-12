export type DurationUnit = 'ns' | 'ms' | 's' | 'min' | 'h' | 'd' | 'w';

export type Milliseconds = number;
export type Seconds = number;
export type Minutes = number;

const nsInMs = 1_000_000;

export const msPerUnit: Record<DurationUnit, number> = {
  ns: 1 / nsInMs,
  ms: 1,
  s: 1000,
  min: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000
};

export const convertDuration = (
  value: number,
  from: DurationUnit,
  to: DurationUnit
): number => value * (msPerUnit[from] / msPerUnit[to]);
