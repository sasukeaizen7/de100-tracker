import { describe, expect, it } from 'vitest';
import { DAYS, TOTAL_DAYS, currentDay } from './plan.js';

describe('plan', () => {
  it('has exactly one entry for each of the 100 days, in order', () => {
    expect(DAYS).toHaveLength(TOTAL_DAYS);
    DAYS.forEach((d, i) => expect(d?.day).toBe(i + 1));
  });

  it('puts a Build & Share day every 7th day, plus the LinkedIn day 99', () => {
    const shareDays = DAYS.filter((d) => d.type === 'share').map((d) => d.day);
    expect(shareDays).toEqual([7, 14, 21, 28, 35, 42, 49, 56, 63, 70, 77, 84, 91, 98, 99]);
  });

  it('computes the current day from the start date', () => {
    expect(currentDay('2026-09-26', new Date(2026, 8, 25))).toBe(0);
    expect(currentDay('2026-09-26', new Date(2026, 8, 26, 22))).toBe(1);
    expect(currentDay('2026-09-26', new Date(2026, 8, 27))).toBe(2);
    expect(currentDay('2026-09-26', new Date(2027, 0, 3))).toBe(100);
    expect(currentDay('2026-09-26', new Date(2027, 0, 4))).toBe(101); // finished
  });
});

describe('plan posts', () => {
  it('has 14 LinkedIn posts, numbered in order', () => {
    const posts = DAYS.filter((d) => d.post).map((d) => Number(/Post (\d+)/.exec(d.post)[1]));
    expect(posts).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });
});
