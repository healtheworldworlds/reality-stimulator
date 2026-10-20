import type { LiveFixture } from '../engine/clubs';

export interface FixtureFetchResult {
  status: 'available' | 'fallback';
  fixtures?: LiveFixture[];
  reason?: string;
}

export async function fetchTodaysFixtures(): Promise<FixtureFetchResult> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`/api/fixtures?date=${today}&timezone=UTC`);
    
    // Check if response is actually JSON before parsing
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return { status: 'fallback', reason: 'local-dev-mock' };
    }

    const data = await res.json();
    if (data?.status === 'available' && Array.isArray(data.response) && data.response.length > 0) {
      return { status: 'available', fixtures: data.response };
    }
    return { status: 'fallback', reason: 'no-matches' };
  } catch {
    return { status: 'fallback', reason: 'parse-error' };
  }
}
export type { LiveFixture };
