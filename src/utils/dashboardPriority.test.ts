import { describe, it, expect } from 'vitest';
import {
  computeDashboardPriority,
  pickHeroAction,
  DASHBOARD_PRIORITY_WEIGHTS,
  type PriorityTaskInput,
  type PrioritySetupInput,
  type PriorityAddonInput,
} from './dashboardPriority';

/** Fixed "now" used across every test — midnight UTC on 2026-04-17. */
const NOW = new Date('2026-04-17T12:00:00Z');

function makeTask(overrides: Partial<PriorityTaskInput>): PriorityTaskInput {
  return {
    id: overrides.id ?? 't1',
    title: overrides.title ?? 'Test task',
    category: overrides.category ?? 'hvac',
    priority: overrides.priority ?? 'medium',
    status: overrides.status ?? 'upcoming',
    due_date: overrides.due_date ?? '2026-04-20',
    is_weather_triggered: overrides.is_weather_triggered ?? false,
    weather_trigger_type: overrides.weather_trigger_type ?? null,
  };
}

describe('computeDashboardPriority', () => {
  it('weights overdue above due-soon above weather above setup above add-on', () => {
    const tasks: PriorityTaskInput[] = [
      makeTask({ id: 'soon', title: 'Due soon', due_date: '2026-04-19' }),
      makeTask({
        id: 'overdue',
        title: 'Overdue',
        due_date: '2026-04-10',
        status: 'overdue',
      }),
      makeTask({
        id: 'weather',
        title: 'Weather',
        due_date: '2026-04-30',
        is_weather_triggered: true,
        weather_trigger_type: 'freeze',
      }),
    ];
    const setup: PrioritySetupInput[] = [
      { id: 'hvac', label: 'Add HVAC', complete: false },
    ];
    const addons: PriorityAddonInput[] = [
      { id: 'gutter', label: 'Gutter cleaning', gated: false },
    ];

    const result = computeDashboardPriority({ tasks, setup, addons, now: NOW });

    expect(result.map((r) => r.reason)).toEqual([
      'overdue',
      'due_soon',
      'weather',
      'setup',
      'addon',
    ]);
  });

  it('uses exact weight for each reason plus priority bump', () => {
    const tasks: PriorityTaskInput[] = [
      makeTask({ id: 'o1', priority: 'urgent', status: 'overdue', due_date: '2026-04-01' }),
      makeTask({ id: 'o2', priority: 'low', status: 'overdue', due_date: '2026-04-01' }),
    ];
    const result = computeDashboardPriority({ tasks, now: NOW });
    // Urgent overdue: 100 + 4 = 104 · Low overdue: 100 + 1 = 101
    expect(result[0].score).toBe(DASHBOARD_PRIORITY_WEIGHTS.overdue + 4);
    expect(result[1].score).toBe(DASHBOARD_PRIORITY_WEIGHTS.overdue + 1);
    expect(result[0].id).toBe('task:o1');
  });

  it('hides completed and skipped tasks', () => {
    const tasks: PriorityTaskInput[] = [
      makeTask({ id: 'done', status: 'completed', due_date: '2026-04-01' }),
      makeTask({ id: 'skip', status: 'skipped', due_date: '2026-04-01' }),
      makeTask({ id: 'keep', status: 'overdue', due_date: '2026-04-01' }),
    ];
    const result = computeDashboardPriority({ tasks, now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('task:keep');
  });

  it('ignores setup items that are already complete', () => {
    const setup: PrioritySetupInput[] = [
      { id: 'a', label: 'Step A', complete: true },
      { id: 'b', label: 'Step B', complete: false },
    ];
    const result = computeDashboardPriority({ tasks: [], setup, now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('setup:b');
  });

  it('applies stable tiebreakers — earlier due date first', () => {
    const tasks: PriorityTaskInput[] = [
      makeTask({ id: 'b', priority: 'medium', due_date: '2026-04-22' }),
      makeTask({ id: 'a', priority: 'medium', due_date: '2026-04-18' }),
    ];
    const result = computeDashboardPriority({ tasks, now: NOW });
    expect(result.map((r) => r.id)).toEqual(['task:a', 'task:b']);
  });

  it('respects limit (default 8, configurable)', () => {
    const tasks: PriorityTaskInput[] = Array.from({ length: 20 }).map((_, i) =>
      makeTask({ id: `t${i}`, status: 'overdue', due_date: '2026-04-01' }),
    );
    const result = computeDashboardPriority({ tasks, now: NOW, limit: 3 });
    expect(result).toHaveLength(3);
  });

  it('labels overdue tasks with a human-readable badge', () => {
    const tasks: PriorityTaskInput[] = [
      makeTask({
        id: 'o',
        title: 'Clean gutters',
        status: 'overdue',
        due_date: '2026-04-10',
      }),
    ];
    const result = computeDashboardPriority({ tasks, now: NOW });
    expect(result[0].badge).toBe('Overdue');
  });

  it('labels weather triggers with trigger type', () => {
    const tasks: PriorityTaskInput[] = [
      makeTask({
        id: 'w',
        title: 'Wrap pipes',
        due_date: '2026-04-25',
        is_weather_triggered: true,
        weather_trigger_type: 'freeze',
      }),
    ];
    const result = computeDashboardPriority({ tasks, now: NOW });
    expect(result[0].reason).toBe('weather');
    expect(result[0].badge).toBe('Freeze alert');
  });

  it('is deterministic (same input → same output)', () => {
    const tasks: PriorityTaskInput[] = [
      makeTask({ id: 't3', status: 'overdue', due_date: '2026-04-10' }),
      makeTask({ id: 't1', status: 'overdue', due_date: '2026-04-10' }),
      makeTask({ id: 't2', status: 'overdue', due_date: '2026-04-10' }),
    ];
    const a = computeDashboardPriority({ tasks, now: NOW });
    const b = computeDashboardPriority({ tasks, now: NOW });
    expect(a).toEqual(b);
    expect(a.map((r) => r.id)).toEqual(['task:t1', 'task:t2', 'task:t3']);
  });

  it('drops tasks due more than 7 days out when not weather/overdue', () => {
    const tasks: PriorityTaskInput[] = [
      makeTask({ id: 'far', due_date: '2026-06-01' }),
    ];
    const result = computeDashboardPriority({ tasks, now: NOW });
    expect(result).toHaveLength(0);
  });
});

describe('pickHeroAction', () => {
  it('returns the single highest-scored item or null', () => {
    const tasks: PriorityTaskInput[] = [
      makeTask({ id: 'o', status: 'overdue', due_date: '2026-04-10' }),
      makeTask({ id: 'soon', due_date: '2026-04-19' }),
    ];
    const hero = pickHeroAction({ tasks, now: NOW });
    expect(hero?.id).toBe('task:o');
  });

  it('returns null when there are no items', () => {
    expect(pickHeroAction({ tasks: [], now: NOW })).toBeNull();
  });
});
