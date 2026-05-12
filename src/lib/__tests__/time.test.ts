import { convertDuration, msPerUnit } from '@/lib/time';

describe('msPerUnit constants', () => {
  it('has correct value for nanoseconds', () => {
    expect(msPerUnit.ns).toBeCloseTo(1 / 1_000_000);
  });

  it('has correct value for milliseconds', () => {
    expect(msPerUnit.ms).toBe(1);
  });

  it('has correct value for seconds', () => {
    expect(msPerUnit.s).toBe(1000);
  });

  it('has correct value for minutes', () => {
    expect(msPerUnit.min).toBe(60_000);
  });

  it('has correct value for hours', () => {
    expect(msPerUnit.h).toBe(3_600_000);
  });

  it('has correct value for days', () => {
    expect(msPerUnit.d).toBe(86_400_000);
  });

  it('has correct value for weeks', () => {
    expect(msPerUnit.w).toBe(604_800_000);
  });
});

describe('convertDuration', () => {
  it('converts milliseconds to seconds', () => {
    expect(convertDuration(1000, 'ms', 's')).toBe(1);
  });

  it('converts seconds to milliseconds', () => {
    expect(convertDuration(1, 's', 'ms')).toBe(1000);
  });

  it('converts seconds to minutes', () => {
    expect(convertDuration(60, 's', 'min')).toBe(1);
  });

  it('converts minutes to seconds', () => {
    expect(convertDuration(1, 'min', 's')).toBe(60);
  });

  it('converts minutes to hours', () => {
    expect(convertDuration(60, 'min', 'h')).toBe(1);
  });

  it('converts hours to minutes', () => {
    expect(convertDuration(1, 'h', 'min')).toBe(60);
  });

  it('converts hours to days', () => {
    expect(convertDuration(24, 'h', 'd')).toBe(1);
  });

  it('converts days to hours', () => {
    expect(convertDuration(1, 'd', 'h')).toBe(24);
  });

  it('converts days to weeks', () => {
    expect(convertDuration(7, 'd', 'w')).toBe(1);
  });

  it('converts weeks to days', () => {
    expect(convertDuration(1, 'w', 'd')).toBe(7);
  });

  it('returns the same value for identity conversion', () => {
    expect(convertDuration(42, 'ms', 'ms')).toBe(42);
    expect(convertDuration(5, 's', 's')).toBe(5);
    expect(convertDuration(3, 'h', 'h')).toBe(3);
  });

  it('converts fractional durations correctly', () => {
    expect(convertDuration(0.5, 'min', 's')).toBe(30);
  });

  it('converts large values correctly', () => {
    expect(convertDuration(1, 'w', 'ms')).toBe(604_800_000);
  });
});
