import { describe, it, expect } from 'vitest';
import {
  formatPrice,
  getEffectiveMonthly,
  getStripeSavings,
  getPlanById,
  PRICING,
  ANNUAL_DISCOUNT_PERCENT,
} from './pricing';

describe('pricing constants', () => {
  it('formats whole-dollar prices with no decimal', () => {
    expect(formatPrice(149)).toBe('$149');
  });

  it('formats cent prices with two decimals', () => {
    expect(formatPrice(6.99)).toBe('$6.99');
  });

  it('applies the annual discount to the effective monthly cost', () => {
    const monthlyCost = PRICING.home.monthly;
    const effective = getEffectiveMonthly('home', 'yearly');
    // Yearly effective monthly should be lower than the plain monthly price
    expect(effective).toBeLessThan(monthlyCost);
    // And the discount should be roughly ANNUAL_DISCOUNT_PERCENT
    const discount = 1 - effective / monthlyCost;
    expect(discount).toBeGreaterThanOrEqual((ANNUAL_DISCOUNT_PERCENT - 1) / 100);
  });

  it('returns 0 savings for the monthly interval', () => {
    expect(getStripeSavings('home', 'monthly')).toBe(0);
  });

  it('returns a positive savings number for the yearly interval', () => {
    expect(getStripeSavings('home', 'yearly')).toBeGreaterThan(0);
  });

  it('resolves a plan by id', () => {
    const home = getPlanById('home');
    expect(home).toBeDefined();
    expect(home?.name?.toLowerCase()).toContain('home');
  });

  it('returns undefined for unknown plan ids', () => {
    expect(getPlanById('nonexistent')).toBeUndefined();
  });
});
