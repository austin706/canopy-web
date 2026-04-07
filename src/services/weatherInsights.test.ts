// Smoke tests for the weather → task insight engine.
// Pure function tests — no network, no Supabase.

import { describe, it, expect } from 'vitest';
import { generateWeatherInsights } from './weatherInsights';
import type { DayForecast, MaintenanceTask } from '@/types';

// Use dynamic dates relative to today so the tests stay valid over time.
// The engine filters forecast/tasks to "within next N days from now".
const fromToday = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const day = (overrides: Partial<DayForecast> = {}): DayForecast => ({
  date: fromToday(1),
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
  due_date: fromToday(3),
  estimated_duration: 60,
  is_ai_generated: false,
  created_at: fromToday(-6),
  updated_at: fromToday(-6),
  ...overrides,
} as MaintenanceTask);

describe('generateWeatherInsights', () => {
  it('returns an empty array when there are no outdoor tasks', () => {
    expect(generateWeatherInsights([day()], [])).toEqual([]);
  });

  it('surfaces a rain insight when rain is in the forecast and an outdoor task exists', () => {
    // Task is due tomorrow, rain comes day after — engine should flag it.
    const forecast = [
      day({ date: fromToday(1) }),
      day({ date: fromToday(2), icon: '10d', description: 'light rain', precipitation_chance: 80 }),
    ];
    const tasks = [
      task({
        title: 'Clean gutters',
        category: 'general' as any,
        due_date: fromToday(1),
      }),
    ];
    const insights = generateWeatherInsights(forecast, tasks);
    expect(insights.length).toBeGreaterThan(0);
    expect(insights.some((i) => i.type === 'rain_coming')).toBe(true);
  });

  it('caps insights at 4 results across many triggers', () => {
    const forecast = Array.from({ length: 7 }).map((_, i) =>
      day({
        date: fromToday(i + 1),
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
