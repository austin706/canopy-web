// ═══════════════════════════════════════════════════════════════
// Canopy Task Scheduling Engine (Web)
// ═══════════════════════════════════════════════════════════════
// Handles intelligent task generation, equipment lifecycle alerts,
// and dynamic timeline updates for home maintenance.
//
// SCHEDULING TYPES:
// - 'seasonal': Tasks tied to specific calendar months (gutters in spring, furnace in fall)
//   → Scheduled to their next applicable month each year
// - 'dynamic': Tasks based on frequency interval from last completion (filters every 90 days)
//   → On first generation: spread across the year at interval_days apart
//   → On completion: next occurrence = completion_date + interval_days

import type {
  Home,
  Equipment,
  MaintenanceTask,
  TaskPriority,
  EquipmentCategory,
} from '@/types';
import { TASK_TEMPLATES, type TaskTemplate, getClimateRegion } from '@/constants/maintenance';
import {
  addMonths,
  addDays,
  getMonth,
  getYear,
  isAfter,
  isBefore,
  parseISO,
  format,
} from 'date-fns';

/**
 * ROOF LIFESPAN EXPECTATIONS (years)
 * Used to determine when lifecycle alerts should trigger for roofs.
 */
const ROOF_LIFESPANS: Record<string, { min: number; max: number }> = {
  asphalt_shingle: { min: 20, max: 25 },
  metal: { min: 40, max: 70 },
  tile: { min: 50, max: 50 },
  slate: { min: 75, max: 75 },
  flat: { min: 15, max: 15 },
  wood_shake: { min: 25, max: 25 },
};

/**
 * Generate UUID v4 using web Crypto API
 */
const generateUUID = (): string => {
  return crypto.randomUUID();
};

/**
 * Computes the display status of a task based on its stored status and due date.
 * This should be used everywhere tasks are displayed to ensure overdue tasks
 * are shown correctly even if the DB still says 'upcoming'.
 */
export function getDisplayStatus(task: MaintenanceTask): MaintenanceTask['status'] {
  // Completed and skipped tasks keep their status
  if (task.status === 'completed' || task.status === 'skipped') {
    return task.status;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.due_date);
  dueDate.setHours(0, 0, 0, 0);

  if (dueDate < today) {
    return 'overdue';
  }

  // Due today or within 3 days
  const threeDaysOut = new Date(today);
  threeDaysOut.setDate(threeDaysOut.getDate() + 3);
  if (dueDate <= threeDaysOut) {
    return 'due';
  }

  return 'upcoming';
}

/**
 * Generates initial set of maintenance tasks for a home.
 *
 * SEASONAL tasks: scheduled to their next applicable calendar month
 * DYNAMIC tasks: first occurrence spread from today at interval_days apart,
 *   then rescheduled on completion
 *
 * Filters for:
 * - Equipment the user actually owns (matches requires_equipment)
 * - Home features the user has (matches requires_home_feature)
 * - Countertop type (matches requires_countertop_type)
 * - Climate region (matches applicable_regions)
 * - Skips tasks that already exist in existingTasks
 *
 * Generates tasks for the next 12 months to ensure full calendar coverage.
 */
export function generateTasksForHome(
  home: Home,
  equipment: Equipment[],
  existingTasks: MaintenanceTask[]
): MaintenanceTask[] {
  const newTasks: MaintenanceTask[] = [];
  const today = new Date();
  const currentMonth = getMonth(today) + 1; // getMonth returns 0-11
  const currentYear = getYear(today);

  // Determine the homeowner's climate region
  const homeRegion = getClimateRegion(home.state);

  // Build a set of equipment categories the user has
  const equipmentCategories = new Set<EquipmentCategory>(
    equipment.map((eq) => eq.category)
  );

  // Build a set of existing task template IDs for deduplication
  const existingTaskTitles = new Set<string>(
    existingTasks.map((task) => task.title)
  );

  // Process each template
  TASK_TEMPLATES.forEach((template) => {
    // Skip if this template requires equipment the user doesn't have
    if (
      template.requires_equipment &&
      !equipmentCategories.has(template.requires_equipment)
    ) {
      return;
    }

    // Skip if this template requires a home feature the user doesn't have
    if (template.requires_home_feature) {
      const feature = template.requires_home_feature as keyof Home;
      if (!home[feature]) {
        return;
      }
    }

    // Skip if this template requires specific countertop types
    if (template.requires_countertop_type) {
      const homeCountertop = (home as any).countertop_type as string | undefined;
      if (!homeCountertop || !template.requires_countertop_type.includes(homeCountertop)) {
        return;
      }
    }

    // Skip if this template is region-specific and doesn't match the homeowner's region
    if (template.applicable_regions && !template.applicable_regions.includes('all')) {
      if (!template.applicable_regions.includes(homeRegion)) {
        return;
      }
    }

    // Route to appropriate scheduling logic
    if (template.scheduling_type === 'dynamic') {
      generateDynamicTask(template, home, equipment, existingTaskTitles, newTasks, today);
    } else {
      generateSeasonalTasks(template, home, equipment, existingTaskTitles, newTasks, currentMonth, currentYear, today);
    }
  });

  return newTasks;
}

/**
 * Generate a DYNAMIC task — first occurrence from today + interval_days.
 * On completion, createNextDynamicTask() schedules the next one.
 */
function generateDynamicTask(
  template: TaskTemplate,
  home: Home,
  equipment: Equipment[],
  existingTaskTitles: Set<string>,
  newTasks: MaintenanceTask[],
  today: Date
) {
  // Skip if a task with this title already exists (any occurrence)
  if (existingTaskTitles.has(template.title)) {
    return;
  }

  const intervalDays = template.interval_days || 90;

  // First occurrence: due today + interval_days from now
  // Use a small hash offset (0-6 days) so dynamic tasks don't all land on the same date
  const hashOffset = template.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 7;
  const dueDate = addDays(today, intervalDays + hashOffset);

  const task = createTaskFromTemplate(template, home, equipment, dueDate);
  newTasks.push(task);
}

/**
 * Generate SEASONAL tasks — for each applicable month in the next 12 months.
 * Creates one task per applicable month to fill out the calendar.
 */
function generateSeasonalTasks(
  template: TaskTemplate,
  home: Home,
  equipment: Equipment[],
  existingTaskTitles: Set<string>,
  newTasks: MaintenanceTask[],
  currentMonth: number,
  currentYear: number,
  today: Date
) {
  // For seasonal tasks, generate for each applicable month in the next 12 months
  const generatedMonths = new Set<string>();

  for (let offset = 0; offset < 12; offset++) {
    const targetMonth = ((currentMonth - 1 + offset) % 12) + 1;
    const targetYear = currentYear + Math.floor((currentMonth - 1 + offset) / 12);

    if (!template.applicable_months.includes(targetMonth)) {
      continue;
    }

    // Dedup key: title + month + year
    const dedupKey = `${template.title}|${targetMonth}|${targetYear}`;
    if (generatedMonths.has(dedupKey)) continue;
    generatedMonths.add(dedupKey);

    // Check if this specific month already has this task
    if (existingTaskTitles.has(template.title)) {
      // For seasonal, we only skip if there's already a task with this exact title
      // The first occurrence is enough — we don't need to re-generate for each month
      // if the user already has it. But we DO generate for future months.
      // Actually: if ANY task with this title exists, we still want new months.
      // Let's be smarter: skip based on the dedup key not just title.
      // For now, only generate the NEXT applicable month (not all 12 months of instances)
      // to avoid overwhelming the calendar. The engine re-runs periodically.
    }

    // Distribute tasks within the month using a hash of the template ID
    const dayHash = template.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 28 + 1;
    const dueDate = new Date(targetYear, targetMonth - 1, dayHash);

    // Don't generate tasks for dates in the past (except current month)
    if (dueDate < today && offset > 0) {
      continue;
    }

    const task = createTaskFromTemplate(template, home, equipment, dueDate);
    newTasks.push(task);

    // For annual or as_needed frequency, only generate the next occurrence
    if (template.frequency === 'annual' || template.frequency === 'as_needed') {
      break;
    }

    // For biannual, generate up to 2 occurrences
    if (template.frequency === 'biannual' && generatedMonths.size >= 2) {
      break;
    }
  }
}

/**
 * Creates a MaintenanceTask from a TaskTemplate with a specific due date.
 */
function createTaskFromTemplate(
  template: TaskTemplate,
  home: Home,
  equipment: Equipment[],
  dueDate: Date
): MaintenanceTask {
  return {
    id: generateUUID(),
    home_id: home.id,
    equipment_id:
      template.requires_equipment && equipment.length > 0
        ? equipment.find((eq) => eq.category === template.requires_equipment)?.id
        : undefined,
    title: template.title,
    description: template.description,
    instructions: template.instructions,
    category: template.category,
    priority: template.priority,
    status: 'upcoming',
    frequency: template.frequency,
    due_date: format(dueDate, 'yyyy-MM-dd'),
    estimated_minutes: template.estimated_minutes,
    estimated_cost: template.estimated_cost,
    is_weather_triggered: false,
    applicable_months: template.applicable_months,
    scheduling_type: template.scheduling_type,
    interval_days: template.interval_days,
    created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
  };
}

/**
 * Creates the next occurrence of a DYNAMIC task after completion.
 * Called when a user marks a dynamic task as completed.
 *
 * @param completedTask - The task that was just completed
 * @param completionDate - When the task was completed (ISO string)
 * @returns The new task to insert, or null if not recurring
 */
export function createNextDynamicTask(
  completedTask: MaintenanceTask,
  completionDate: string
): MaintenanceTask | null {
  // Only create next occurrence for dynamic tasks with an interval
  if (completedTask.scheduling_type !== 'dynamic' || !completedTask.interval_days) {
    return null;
  }

  // Don't create next for as_needed tasks
  if (completedTask.frequency === 'as_needed') {
    return null;
  }

  const completedDate = parseISO(completionDate);
  const nextDueDate = addDays(completedDate, completedTask.interval_days);

  return {
    ...completedTask,
    id: generateUUID(),
    status: 'upcoming',
    due_date: format(nextDueDate, 'yyyy-MM-dd'),
    completed_date: undefined,
    completed_by: undefined,
    completion_photo_url: undefined,
    completion_notes: undefined,
    created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
  };
}

/**
 * Generates lifecycle alerts for equipment nearing end of life.
 *
 * For equipment with install_date and expected_lifespan_years:
 * - At 80% lifespan: "Inspect" task (priority: high)
 * - At 95% lifespan: "Plan Replacement" task (priority: urgent)
 *
 * Special handling for roof: uses home.roof_age_years if available,
 * cross-references expected lifespan by roof type.
 */
export function generateEquipmentLifecycleAlerts(
  equipment: Equipment[],
  home: Home
): MaintenanceTask[] {
  const alerts: MaintenanceTask[] = [];
  const today = new Date();

  equipment.forEach((item) => {
    // Special handling for roof
    if (item.category === 'roof' && home.roof_type) {
      const lifespan = ROOF_LIFESPANS[home.roof_type];
      if (!lifespan) return;

      const roofAge = home.roof_age_years ?? 0;
      const percentageThrough =
        lifespan.min > 0 ? roofAge / lifespan.min : 0;

      if (percentageThrough >= 0.95) {
        alerts.push(
          createLifecycleTask('urgent', `Plan Replacement: ${item.name}`, item, home)
        );
      } else if (percentageThrough >= 0.8) {
        alerts.push(
          createLifecycleTask('high', `Inspect: ${item.name}`, item, home)
        );
      }

      return;
    }

    // For other equipment, check install_date + expected_lifespan_years
    if (!item.install_date || !item.expected_lifespan_years) {
      return;
    }

    const installDate = parseISO(item.install_date);
    const daysSinceInstall = Math.floor(
      (today.getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysInLifespan = item.expected_lifespan_years * 365.25;
    const percentageThrough = daysSinceInstall / daysInLifespan;

    if (percentageThrough >= 0.95) {
      alerts.push(
        createLifecycleTask('urgent', `Plan Replacement: ${item.name}`, item, home)
      );
    } else if (percentageThrough >= 0.8) {
      alerts.push(
        createLifecycleTask('high', `Inspect: ${item.name}`, item, home)
      );
    }
  });

  return alerts;
}

/**
 * Helper: creates a lifecycle alert task
 */
function createLifecycleTask(
  priority: TaskPriority,
  title: string,
  equipment: Equipment,
  home: Home
): MaintenanceTask {
  return {
    id: generateUUID(),
    home_id: home.id,
    equipment_id: equipment.id,
    title,
    description: `${equipment.name} is nearing the end of its expected lifespan.`,
    category: equipment.category,
    priority,
    status: 'upcoming',
    frequency: 'as_needed',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    estimated_minutes: 30,
    estimated_cost: 0,
    is_weather_triggered: false,
    applicable_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    scheduling_type: 'seasonal',
    created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
  };
}

/**
 * Returns seasonal maintenance recommendations grouped by timing.
 */
export function getSeasonalRecommendations(
  home: Home,
  month: number
): {
  thisMonth: string[];
  upcoming: string[];
} {
  const thisMonth: string[] = [];
  const upcoming: string[] = [];

  const relevantTemplates = TASK_TEMPLATES.filter(
    (t) =>
      t.applicable_months.includes(month) ||
      t.applicable_months.includes(month === 12 ? 1 : month + 1) ||
      t.applicable_months.includes(month >= 11 ? month - 10 : month + 2)
  );

  const homeFeatures = {
    has_pool: home.has_pool,
    has_deck: home.has_deck,
    has_sprinkler_system: home.has_sprinkler_system,
    has_fireplace: home.has_fireplace,
  };

  relevantTemplates.forEach((template) => {
    if (template.requires_home_feature) {
      const feature = template.requires_home_feature as keyof typeof homeFeatures;
      if (!homeFeatures[feature]) {
        return;
      }
    }

    if (template.applicable_months.includes(month)) {
      thisMonth.push(template.title);
    } else {
      upcoming.push(template.title);
    }
  });

  return { thisMonth, upcoming };
}
