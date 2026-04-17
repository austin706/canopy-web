/**
 * Task ordering — health-score-aware.
 *
 * Core rule: when the Home Health Score drops below 85, push the tasks that
 * are moving the score to the top of the list so the homeowner can clear them.
 *
 * Weight breakdown (higher = earlier in list):
 *   - Overdue (by days overdue): 10 * daysOverdue, capped at 1000
 *   - High priority: +300
 *   - Medium priority: +100
 *   - Weather-triggered: +800 (these are always urgent)
 *   - Safety-warning template: +250
 *   - Due this week: +50
 *
 * When the score is healthy (>= 85) we still apply the same sort but the
 * overdue multiplier is reduced to 3 so completed homes don't get a
 * dramatic reshuffle from a single stale task.
 */
import type { MaintenanceTask } from '@/types';

export interface TaskOrderingOptions {
  healthScore?: number;
  now?: Date;
}

export function sortTasksByHealthUrgency(
  tasks: MaintenanceTask[],
  opts: TaskOrderingOptions = {},
): MaintenanceTask[] {
  const now = opts.now ?? new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const lowHealth = (opts.healthScore ?? 100) < 85;
  const overdueMultiplier = lowHealth ? 10 : 3;

  const score = (t: MaintenanceTask): number => {
    let s = 0;
    const due = new Date(t.due_date);
    due.setHours(0, 0, 0, 0);
    const msPerDay = 86400000;
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / msPerDay);

    if (t.status === 'completed' || t.status === 'skipped') return -1;

    if (daysOverdue > 0) {
      s += Math.min(daysOverdue * overdueMultiplier, 1000);
    } else if (due.getTime() <= weekEnd.getTime()) {
      s += 50;
    }

    if (t.priority === 'high') s += 300;
    else if (t.priority === 'medium') s += 100;

    if (t.is_weather_triggered) s += 800;
    if ((t.safety_warnings?.length ?? 0) > 0) s += 250;

    return s;
  };

  const withScore = tasks.map(t => ({ t, s: score(t) }));
  withScore.sort((a, b) => {
    // Completed/skipped always fall to the end.
    if (a.s < 0 && b.s < 0) return 0;
    if (a.s < 0) return 1;
    if (b.s < 0) return -1;
    if (b.s !== a.s) return b.s - a.s;
    // Tie-break by due date ascending.
    return new Date(a.t.due_date).getTime() - new Date(b.t.due_date).getTime();
  });
  return withScore.map(x => x.t);
}
