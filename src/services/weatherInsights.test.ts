// Smoke tests for the weather → task insight engine.
// Pure function tests — no network, no Supabase.

import { describe, it, expect } from 'vitest';
import { generateWeatherInsights } from './weatherInsights';
import type { DayForecast, MaintenanceTask } from '@/types';

const day = (overrides: Partial<DayForecast> = {}): DayForecast => ({
  date: '2026-04-07',
  high: 72,
  low: 55,
  description: 'clear sky',
  icon: '01d',
  precipitation_chance: 5,
  ...overrides,
});

const task = (overrides: Partial<MaintenanceTask> = {}): MaintenanceTask => ({
  id: 't1',
  home_id: 'h1',
  title: 'Clean gutters',
  description: '',
  category: 'exterior' as any,
  priority: 'medium' as any,
  status: 'pending' as any,
  scheduled_date: '2026-04-10',
  estimated_duration: 60,
  is_ai_generated: false,
  created_at: '2026-04-01',
  updated_at: '2026-04-01',
  ...overrides,
} as MaintenanceTask);

describe('generateWeatherInsights', () => {
  it('returns an empty array when there are no outdoor tasks', () => {
    expect(generateWeatherInsights([day()], [])).toEqual([]);
  });

  it('surfaces a rain insight when rain is in the forecast and an outdoor task exists', () => {
    const forecast = [
      day({ date: '2026-04-07', icon: '10d', description: 'light rain', precipitation_chance: 80 }),
      day({ date: '2026-04-08' }),
    ];
    const tasks = [task({ title: 'Clean gutters', category: 'general' as any })];
    const insights = generateWeatherInsights(forecast, tasks);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((i) => i.type === 'rain_coming')).toBe(true);
  });

  it('caps insights at 4 results across many triggers', () => {
    const forecast = Array.from({ length: 7 }).map((_, i) =>
      day({
        date: `2026-04-${String(7 + i).padStart(2, '0')}`,
        icon: ['10d', '13d', '01d', '50d', '10d', '01d', '01d'][i],
        description: ['rain', 'snow', 'clear', 'fog', 'rain', 'clear', 'clear'][i],
        high: i === 2 ? 99 : 70,
        low: i === 3 ? 28 : 50,
      }),
    );
    const tasks = Array.from({ length: 6 }).map((_, i) =>
      task({ id: `t${i}`, title: `Outdoor task ${i}`, category: 'lawn' as any }),
    );
    const insights = generateWeatherInsights(forecast, tasks);
    expect(insights.length).toBeLessThanOrEqual(4);
  });
});
