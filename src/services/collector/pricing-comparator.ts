import type { StructuredPricingValue } from '../../types/intelligence.ts';

export interface PricingComparisonResult {
  isComparable: boolean;
  mismatchReason?: string;
  previousPrice: number;
  newPrice: number;
  absoluteChange: number;
  percentageChange: number; // negative for reduction, positive for hike
  isReduction: boolean;
  isHike: boolean;
  planName: string;
  currency: string;
  billingPeriod: string;
  unit: string;
  formattedChangeDescription: string;
}

export function comparePricingPlans(
  before: StructuredPricingValue,
  after: StructuredPricingValue
): PricingComparisonResult {
  // Check conditions match
  if (before.currency !== after.currency) {
    return {
      isComparable: false,
      mismatchReason: `Currency mismatch: Cannot compare ${before.currency} with ${after.currency}`,
      previousPrice: before.price,
      newPrice: after.price,
      absoluteChange: after.price - before.price,
      percentageChange: 0,
      isReduction: false,
      isHike: false,
      planName: after.planName,
      currency: after.currency,
      billingPeriod: after.billingPeriod,
      unit: after.unit,
      formattedChangeDescription: 'Non-comparable pricing (currencies differ)',
    };
  }

  if (before.billingPeriod !== after.billingPeriod) {
    return {
      isComparable: false,
      mismatchReason: `Billing period mismatch: Cannot compare ${before.billingPeriod} with ${after.billingPeriod}`,
      previousPrice: before.price,
      newPrice: after.price,
      absoluteChange: after.price - before.price,
      percentageChange: 0,
      isReduction: false,
      isHike: false,
      planName: after.planName,
      currency: after.currency,
      billingPeriod: after.billingPeriod,
      unit: after.unit,
      formattedChangeDescription: 'Non-comparable pricing (billing periods differ)',
    };
  }

  if (before.unit !== after.unit) {
    return {
      isComparable: false,
      mismatchReason: `Pricing unit mismatch: Cannot compare ${before.unit} with ${after.unit}`,
      previousPrice: before.price,
      newPrice: after.price,
      absoluteChange: after.price - before.price,
      percentageChange: 0,
      isReduction: false,
      isHike: false,
      planName: after.planName,
      currency: after.currency,
      billingPeriod: after.billingPeriod,
      unit: after.unit,
      formattedChangeDescription: 'Non-comparable pricing (units differ)',
    };
  }

  // Exact numeric calculation
  const diff = after.price - before.price;
  const pct = before.price > 0 ? (diff / before.price) * 100 : 0;
  const roundedPct = Math.round(pct * 10) / 10; // e.g. -30.0%

  const isReduction = diff < 0;
  const isHike = diff > 0;
  const absPct = Math.abs(roundedPct);

  let formatted = `${before.currency}${before.price.toLocaleString()} → ${after.currency}${after.price.toLocaleString()}`;
  if (isReduction) {
    formatted += ` (${absPct}% reduction)`;
  } else if (isHike) {
    formatted += ` (+${absPct}% price hike)`;
  } else {
    formatted += ` (no price change)`;
  }

  return {
    isComparable: true,
    previousPrice: before.price,
    newPrice: after.price,
    absoluteChange: diff,
    percentageChange: roundedPct,
    isReduction,
    isHike,
    planName: after.planName,
    currency: after.currency,
    billingPeriod: after.billingPeriod,
    unit: after.unit,
    formattedChangeDescription: formatted,
  };
}

export function parsePricingText(text: string): StructuredPricingValue[] {
  const plans: StructuredPricingValue[] = [];

  // Patterns for ₹50,000 / $500 / month / year / per seat
  const regex = /(Enterprise|Pro|Business|Starter|Growth|Standard|Scale|Custom)[\s\w]*?(?:plan|tier)?[\s:]*(?:₹|\$|USD|INR|EUR|€)\s*([\d,]+)(?:\s*(?:\/|per)\s*(month|mo|year|yr|user|seat))?/gi;

  let match;
  while ((match = regex.exec(text)) !== null) {
    const planName = match[1];
    const rawNum = match[2].replace(/,/g, '');
    const price = parseInt(rawNum, 10);
    const unitPart = (match[3] || 'month').toLowerCase();

    let currency = '₹';
    if (match[0].includes('$') || match[0].includes('USD')) currency = '$';
    else if (match[0].includes('€') || match[0].includes('EUR')) currency = '€';

    let billingPeriod: 'monthly' | 'annual' | 'quarterly' = 'monthly';
    if (unitPart.includes('yr') || unitPart.includes('year')) billingPeriod = 'annual';

    let unit: 'per_seat' | 'flat_rate' | 'usage' = 'flat_rate';
    if (unitPart.includes('user') || unitPart.includes('seat')) unit = 'per_seat';

    plans.push({
      planName,
      currency,
      price,
      billingPeriod,
      unit,
    });
  }

  return plans;
}
