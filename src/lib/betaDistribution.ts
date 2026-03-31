import type { DistributionCurve, ResourceAllocation, DailyBucket } from '../types';
import { startOfDay } from 'date-fns';

const CURVE_PARAMS: Record<DistributionCurve, [number, number]> = {
  'B-2': [2, 5],
  'B-1': [3, 4],
  'B0':  [5, 5],
  'B+1': [4, 3],
  'B+2': [5, 2],
  'flat': [1, 1],
};

function betaPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;
  return Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1);
}

export function distribute(periods: number, totalHours: number, alpha: number, beta: number): number[] {
  if (periods <= 0) return [];
  if (periods === 1) return [totalHours];

  const weights: number[] = [];
  for (let i = 0; i < periods; i++) {
    const x = (i + 0.5) / periods;
    weights.push(betaPDF(x, alpha, beta));
  }

  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return new Array(periods).fill(totalHours / periods);

  return weights.map(w => (w / sum) * totalHours);
}

const DAY_MS = 86_400_000;

/**
 * Allocate resource hours into daily buckets.
 * Computes relevant days directly from resource.startDate/endDate —
 * no calendarDays array needed, so it's O(resource duration) not O(entire view range).
 */
export function allocateToBuckets(resource: ResourceAllocation): DailyBucket[] {
  const [alpha, beta] = CURVE_PARAMS[resource.distribution];

  const startMs = startOfDay(resource.startDate).getTime();
  const endMs   = startOfDay(resource.endDate).getTime();
  const periods = Math.max(1, Math.round((endMs - startMs) / DAY_MS) + 1);
  const distribution = distribute(periods, resource.hours, alpha, beta);

  const result: DailyBucket[] = [];
  for (let i = 0; i < periods; i++) {
    const date = new Date(startMs + i * DAY_MS);
    const h = distribution[i] ?? 0;
    result.push({
      date,
      byResource: { [resource.resourceName]: h },
      total: h,
    });
  }
  return result;
}

export function aggregateBuckets(allBuckets: DailyBucket[][]): DailyBucket[] {
  const map = new Map<string, DailyBucket>();

  for (const buckets of allBuckets) {
    for (const bucket of buckets) {
      const key = bucket.date.toISOString().slice(0, 10);
      if (!map.has(key)) {
        map.set(key, { date: bucket.date, byResource: {}, total: 0 });
      }
      const existing = map.get(key)!;
      for (const [res, hours] of Object.entries(bucket.byResource)) {
        existing.byResource[res] = (existing.byResource[res] ?? 0) + hours;
      }
      existing.total += bucket.total;
    }
  }

  return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
}
