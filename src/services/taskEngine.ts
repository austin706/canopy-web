// ═══════════════════════════════════════════════════════════════
// Canopy Task Scheduling Engine (Web)
// ═══════════════════════════════════════════════════════════════
// Handles intelligent task generation, equipment lifecycle alerts,
// and dynamic timeline updates for home maintenance.

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
  getMonth,
  getYear,
  parse,
  isAfter,
  isBefore,
  parseISO,
  format,
  startOfMonth,
  endOfMonth,
  addDays,
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
 * Generates initial set of maintenance tasks for a home.
 *
 * Creates MaintenanceTask objects from TASK_TEMPLATES, filtering for:
 * - Equipment the user actually owns (matches requires_equipment)
 * - Home features the user has (matches requires_home_feature)
 * - Skips tasks that already exist in existingTasks
 * - Sets due dates to the next applicable month
 *
 * @param home - The home profile with features (has_pool, has_deck, etc.)
 * @param equipment - Array of Equipment items the user owns
 * @param existingTasks - Array of already-created tasks to avoid duplicates
 * @returns Array of newly generated MaintenanceTask objects
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

  // Build a map of existing task titles + due month for deduplication
  const existingTaskMap = new Set<string>();
  existingTasks.forEach((task) => {
    const dueMonth = getMonth(parseISO(task.due_date)) + 1;
    const key = `${task.title}|${dueMonth}`;
    existingTaskMap.add(key);
  });

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

    // Skip if this template is region-specific and doesn't match the homeowner's region
    if (template.applicable_regions && !template.applicable_regions.includes('all')) {
      if (!template.applicable_regions.includes(homeRegion)) {
        return;
      }
    }

    // Find the next applicable month for this task
    const nextMonth = findNextApplicableMonth(
      currentMonth,
      currentYear,
      template.applicable_months
    );

    // Create a deduplication key
    const dedupKey = `${template.title}|${nextMonth.month}`;

    // Skip if a task with the same title and month already exists
    if (existingTaskMap.has(dedupKey)) {
      return;
    }

    // Create the new task
    // Distribute tasks across the month using a hash of the template ID
    const dayHash = template.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 28 + 1;
    const dueDate = new Date(nextMonth.year, nextMonth.month - 1, dayHash);
    const task: MaintenanceTask = {
      id: generateUUID(),
      home_id: home.id,
      equipment_id:
        template.requires_equipment && equipment.length > 0
          ? equipment.find((eq) => eq.category === template.requires_equipment)
              ?.id
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
      created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
    };

    newTasks.push(task);
  });

  return newTasks;
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
 *
 * @param equipment - Array of Equipment items
 * @param home - Home profile (needed for roof-specific logic)
 * @returns Array of alert tasks to display
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
          createLifecycleTask(
            'urgent',
            `Plan Replacement: ${item.name}`,
            item,
            home
          )
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
    const endOfLifeDate = addMonths(
      installDate,
      item.expected_lifespan_years * 12
    );

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
    created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
  };
}

/**
 * Updates task timelines when a task is completed early/late
 * or when equipment changes.
 *
 * Change types:
 * - 'task_completed_early': If completed >7 days before due date,
 *   shift next occurrence to maintain original interval
 * - 'task_completed_late': If completed >7 days after due date,
 *   schedule next occurrence from completion date
 * - 'equipment_changed': Regenerate all tasks for that equipment category
 *
 * @param tasks - Current array of tasks
 * @param changeType - Type of change that triggered the update
 * @param changeData - Data about the change (task, equipment, etc.)
 * @returns Updated tasks array
 */
export function updateTaskTimelinesOnChange(
  tasks: MaintenanceTask[],
  changeType: 'task_completed_early' | 'task_completed_late' | 'equipment_changed',
  changeData: {
    task?: MaintenanceTask;
    completedDate?: string;
    equipment?: Equipment;
  }
): MaintenanceTask[] {
  const updated = [...tasks];

  if (changeType === 'task_completed_early' && changeData.task && changeData.completedDate) {
    return handleTaskCompletedEarly(
      updated,
      changeData.task,
      changeData.completedDate
    );
  }

  if (changeType === 'task_completed_late' && changeData.task && changeData.completedDate) {
    return handleTaskCompletedLate(
      updated,
      changeData.task,
      changeData.completedDate
    );
  }

  if (changeType === 'equipment_changed' && changeData.equipment) {
    return handleEquipmentChanged(updated, changeData.equipment);
  }

  return updated;
}

/**
 * Helper: Handle task completed significantly early (>7 days before due)
 * Shifts the next occurrence's due date to maintain the original interval
 * from the actual completion date.
 */
function handleTaskCompletedEarly(
  tasks: MaintenanceTask[],
  completedTask: MaintenanceTask,
  completedDate: string
): MaintenanceTask[] {
  const dueDate = parseISO(completedTask.due_date);
  const actualCompletionDate = parseISO(completedDate);
  const daysDiff = Math.floor(
    (dueDate.getTime() - actualCompletionDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Only adjust if more than 7 days early
  if (daysDiff <= 7) {
    return tasks;
  }

  // Find or create the next occurrence
  const nextOccurrence = findOrCreateNextOccurrence(
    tasks,
    completedTask,
    actualCompletionDate
  );

  if (nextOccurrence) {
    // Shift next due date based on frequency
    const newDueDate = calculateNextDueDate(
      actualCompletionDate,
      completedTask.frequency
    );
    nextOccurrence.due_date = format(newDueDate, 'yyyy-MM-dd');

    const taskIndex = tasks.findIndex((t) => t.id === nextOccurrence.id);
    if (taskIndex >= 0) {
      tasks[taskIndex] = nextOccurrence;
    } else {
      tasks.push(nextOccurrence);
    }
  }

  return tasks;
}

/**
 * Helper: Handle task completed significantly late (>7 days after due)
 * Schedules the next occurrence from the completion date, not the original due date.
 */
function handleTaskCompletedLate(
  tasks: MaintenanceTask[],
  completedTask: MaintenanceTask,
  completedDate: string
): MaintenanceTask[] {
  const dueDate = parseISO(completedTask.due_date);
  const actualCompletionDate = parseISO(completedDate);
  const daysDiff = Math.floor(
    (actualCompletionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Only adjust if more than 7 days late
  if (daysDiff <= 7) {
    return tasks;
  }

  // Find or create the next occurrence
  const nextOccurrence = findOrCreateNextOccurrence(
    tasks,
    completedTask,
    actualCompletionDate
  );

  if (nextOccurrence) {
    // Schedule next occurrence from completion date
    const newDueDate = calculateNextDueDate(
      actualCompletionDate,
      completedTask.frequency
    );
    nextOccurrence.due_date = format(newDueDate, 'yyyy-MM-dd');

    const taskIndex = tasks.findIndex((t) => t.id === nextOccurrence.id);
    if (taskIndex >= 0) {
      tasks[taskIndex] = nextOccurrence;
    } else {
      tasks.push(nextOccurrence);
    }
  }

  return tasks;
}

/**
 * Helper: Handle equipment category change
 * Regenerates all tasks for that equipment category.
 */
function handleEquipmentChanged(
  tasks: MaintenanceTask[],
  equipment: Equipment
): MaintenanceTask[] {
  // Remove existing tasks for this equipment
  const filtered = tasks.filter(
    (t) =>
      t.equipment_id !== equipment.id &&
      t.category !== equipment.category
  );

  // In a real implementation, you'd regenerate tasks here
  // For now, return the filtered list
  return filtered;
}

/**
 * Helper: Find or create the next occurrence of a recurring task
 */
function findOrCreateNextOccurrence(
  tasks: MaintenanceTask[],
  baseTask: MaintenanceTask,
  fromDate: Date
): MaintenanceTask | null {
  // Look for an existing future occurrence with the same title
  const futureOccurrence = tasks.find(
    (t) =>
      t.title === baseTask.title &&
      t.id !== baseTask.id &&
      isAfter(parseISO(t.due_date), fromDate)
  );

  if (futureOccurrence) {
    return futureOccurrence;
  }

  // For recurring tasks, create a new one
  if (baseTask.frequency !== 'as_needed') {
    const nextDueDate = calculateNextDueDate(fromDate, baseTask.frequency);
    return {
      ...baseTask,
      id: generateUUID(),
      due_date: format(nextDueDate, 'yyyy-MM-dd'),
      status: 'upcoming',
      created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
    };
  }

  return null;
}

/**
 * Helper: Calculate next due date based on frequency
 */
function calculateNextDueDate(baseDate: Date, frequency: string): Date {
  switch (frequency) {
    case 'monthly':
      return addMonths(baseDate, 1);
    case 'quarterly':
      return addMonths(baseDate, 3);
    case 'biannual':
      return addMonths(baseDate, 6);
    case 'annual':
      return addMonths(baseDate, 12);
    default:
      return addMonths(baseDate, 1);
  }
}

/**
 * Returns seasonal maintenance recommendations grouped by timing.
 *
 * Considers home's location/climate zone and current month.
 * Groups recommendations into "This Month" and "Upcoming" (next 2 months).
 *
 * @param home - Home profile with climate_zone
 * @param month - Current month (1-12)
 * @returns Object with 'thisMonth' and 'upcoming' recommendation arrays
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

  // Filter templates for this month and next two months
  const relevantTemplates = TASK_TEMPLATES.filter(
    (t) =>
      t.applicable_months.includes(month) ||
      t.applicable_months.includes(month === 12 ? 1 : month + 1) ||
      t.applicable_months.includes(month >= 11 ? month - 10 : month + 2)
  );

  // Check home features
  const homeFeatures = {
    has_pool: home.has_pool,
    has_deck: home.has_deck,
    has_sprinkler_system: home.has_sprinkler_system,
    has_fireplace: home.has_fireplace,
  };

  relevantTemplates.forEach((template) => {
    // Skip if requires home feature the user doesn't have
    if (template.requires_home_feature) {
      const feature = template.requires_home_feature as keyof typeof homeFeatures;
      if (!homeFeatures[feature]) {
        return;
      }
    }

    // Categorize by timing
    if (template.applicable_months.includes(month)) {
      thisMonth.push(template.title);
    } else {
      upcoming.push(template.title);
    }
  });

  return { thisMonth, upcoming };
}

/**
 * Helper: Find the next applicable month for a task
 * starting from the current month.
 */
function findNextApplicableMonth(
  currentMonth: number,
  currentYear: number,
  applicableMonths: number[]
): { month: number; year: number } {
  // Check remaining months in current year
  for (let m = currentMonth; m <= 12; m++) {
    if (applicableMonths.includes(m)) {
      return { month: m, year: currentYear };
    }
  }

  // Check months in next year
  for (const m of applicableMonths) {
    if (m < currentMonth) {
      return { month: m, year: currentYear + 1 };
    }
  }

  // Fallback: first applicable month in next year
  return { month: applicableMonths[0] ?? 1, year: currentYear + 1 };
}
