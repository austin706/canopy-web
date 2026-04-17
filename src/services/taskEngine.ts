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
  UserPreferences,
  EquipmentConsumable,
} from '@/types';
import { TASK_TEMPLATES, type TaskTemplate, getClimateRegion } from '@/constants/maintenance';
import { DEFAULT_USER_PREFERENCES, isTaskVisible } from '@/types';
import type { TaskTemplateDB } from '@/services/supabase';
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
export const ROOF_LIFESPANS: Record<string, { min: number; max: number }> = {
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
 * Concurrency control: prevents multiple simultaneous task generation calls
 * that could result in duplicate or conflicting task creation.
 */
let taskGenerationInProgress = false;

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
 * - User preferences (maintenance_depth, cleaning tasks, pro tasks, category overrides)
 * - Skips tasks that already exist in existingTasks
 *
 * Generates tasks for the next 12 months to ensure full calendar coverage.
 *
 * @param userPreferences - User maintenance preferences (defaults to DEFAULT_USER_PREFERENCES)
 * @param customTemplates - AI-generated or user-created templates from the database
 */
export function generateTasksForHome(
  home: Home,
  equipment: Equipment[],
  existingTasks: MaintenanceTask[],
  consumables: EquipmentConsumable[] = [],
  userPreferences: UserPreferences = DEFAULT_USER_PREFERENCES,
  customTemplates: TaskTemplateDB[] = [],
): MaintenanceTask[] {
  // Guard against concurrent task generation that could cause race conditions
  // or duplicate task creation
  if (taskGenerationInProgress) {
    return [];
  }

  taskGenerationInProgress = true;
  try {
    return generateTasksForHomeImpl(home, equipment, existingTasks, consumables, userPreferences, customTemplates);
  } finally {
    taskGenerationInProgress = false;
  }
}

/**
 * Internal implementation of generateTasksForHome (called with lock held).
 */
/**
 * Convert a TaskTemplateDB (from Supabase) to the internal TaskTemplate format.
 */
/**
 * Build a lookup map from hardcoded templates so DB overrides can inherit
 * guard fields that the DB table doesn't have columns for (e.g.,
 * requires_water_source, requires_sewer_type, requires_pool_type, etc.).
 */
const hardcodedByTitleCategory = new Map<string, TaskTemplate>(
  TASK_TEMPLATES.map(t => [`${t.title}|${t.category}`, t])
);

function dbTemplateToInternal(db: TaskTemplateDB): TaskTemplate {
  // Find the matching hardcoded template to inherit guard fields
  const hardcoded = hardcodedByTitleCategory.get(`${db.title}|${db.category}`);

  return {
    id: db.id,
    title: db.title,
    description: db.description || '',
    instructions: db.instructions_json || (db.instructions ? [db.instructions] : []),
    category: db.category as TaskTemplate['category'],
    priority: (db.priority || 'medium') as TaskPriority,
    frequency: (db.frequency || 'annual') as any,
    scheduling_type: (db.scheduling_type || 'seasonal') as any,
    interval_days: db.interval_days ?? undefined,
    applicable_months: db.applicable_months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    estimated_minutes: db.estimated_minutes || 30,
    estimated_cost: db.estimated_cost_low || 0,
    estimated_pro_cost: db.estimated_cost_high ?? undefined,
    requires_equipment: db.requires_equipment as EquipmentCategory | undefined,
    requires_equipment_subtype: db.requires_equipment_subtype ?? undefined,
    excludes_equipment_subtype: db.excludes_equipment_subtype ?? undefined,
    equipment_keyed: db.equipment_keyed || false,
    consumable_spec: db.consumable_spec as TaskTemplate['consumable_spec'],
    consumable_replacement_months: db.consumable_replacement_months ?? undefined,
    service_purpose: db.service_purpose ?? undefined,
    items_to_have_on_hand: db.items_to_have_on_hand ?? undefined,
    applicable_regions: db.regions as any,
    requires_home_feature: db.requires_feature ?? hardcoded?.requires_home_feature ?? undefined,
    pro_responsible: db.pro_recommended || false,
    task_level: db.task_level || 'standard',
    is_cleaning: db.is_cleaning || false,
    safety_warnings: (db.safety_warnings && db.safety_warnings.length > 0)
      ? db.safety_warnings
      : undefined,
    add_on_category: db.add_on_category ?? hardcoded?.add_on_category ?? undefined,
    // Prefer DB values (migration 061 adds these columns); fall back to the
    // hardcoded template only for legacy rows that predate the migration.
    requires_water_source: (db.requires_water_source as any) ?? hardcoded?.requires_water_source,
    requires_sewer_type: (db.requires_sewer_type as any) ?? hardcoded?.requires_sewer_type,
    requires_pool_type: (db.requires_pool_type as any) ?? hardcoded?.requires_pool_type,
    requires_home_type: (db.requires_home_type as any) ?? hardcoded?.requires_home_type,
    requires_countertop_type: (db.requires_countertop_type as any) ?? hardcoded?.requires_countertop_type,
    requires_flooring_type: (db.requires_flooring_type as any) ?? hardcoded?.requires_flooring_type,
    requires_construction_type: (db.requires_construction_type as any) ?? hardcoded?.requires_construction_type,
    requires_foundation_type: (db.requires_foundation_type as any) ?? hardcoded?.requires_foundation_type,
    requires_septic_type: (db.requires_septic_type as any) ?? hardcoded?.requires_septic_type,
    // C-11 (migration 066): snapshot the current template version so generated tasks
    // remember which revision they were created from.
    template_version: db.template_version,
  };
}

function generateTasksForHomeImpl(
  home: Home,
  equipment: Equipment[],
  existingTasks: MaintenanceTask[],
  consumables: EquipmentConsumable[] = [],
  userPreferences: UserPreferences = DEFAULT_USER_PREFERENCES,
  customTemplates: TaskTemplateDB[] = [],
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

  // Build a composite key set for deduplication: title|month|year
  // This allows recurring tasks to be regenerated in different months/years
  const existingTaskKeys = new Set<string>(
    existingTasks.map((task) => {
      const d = new Date(task.due_date);
      return `${task.title}|${d.getMonth()+1}|${d.getFullYear()}`;
    })
  );

  // Use DB templates as the source of truth (migration 061 seeds all built-in
  // templates as source='built_in' rows with stable TEXT ids). A hardcoded
  // template is only used as a fallback when no DB row with the same id AND no
  // DB row with the same title|category exists — which should only happen in
  // fresh-dev environments that haven't run migration 061.
  const convertedDB = customTemplates
    .filter((db) => db.active)
    .map(dbTemplateToInternal);
  // Dedup by stable id (primary) AND by title|category (legacy fallback, since
  // AI-generated rows may still have UUID ids while matching a hardcoded slug).
  const dbIdSet = new Set(customTemplates.map((db) => db.id));
  const dbTitleKeySet = new Set(
    customTemplates.map((db) => `${db.title}|${db.category}`)
  );
  const fallbackBuiltIn = TASK_TEMPLATES.filter(
    (t) =>
      !dbIdSet.has(t.id) &&
      !dbTitleKeySet.has(`${t.title}|${t.category}`)
  );
  const allTemplates: TaskTemplate[] = [...convertedDB, ...fallbackBuiltIn];

  // Process each template
  allTemplates.forEach((template) => {
    // Skip if this template requires equipment the user doesn't have
    if (
      template.requires_equipment &&
      !equipmentCategories.has(template.requires_equipment)
    ) {
      return;
    }

    // Skip if this template requires/excludes a specific equipment subtype
    if (template.requires_equipment_subtype || template.excludes_equipment_subtype) {
      const matchingEquip = equipment.filter(
        (eq) => eq.category === template.requires_equipment
      );
      if (matchingEquip.length === 0) return;
      const subtypes = matchingEquip
        .map((eq) => (eq.equipment_subtype || '').toLowerCase())
        .filter(Boolean);

      if (template.requires_equipment_subtype) {
        // At least one piece of matching equipment must have a matching subtype
        const hasMatch = subtypes.some((st) =>
          template.requires_equipment_subtype!.some((req) => st.includes(req.toLowerCase()))
        );
        if (!hasMatch) return;
      }
      if (template.excludes_equipment_subtype) {
        // If ALL matching equipment have an excluded subtype, skip this template
        const allExcluded = subtypes.length > 0 && subtypes.every((st) =>
          template.excludes_equipment_subtype!.some((exc) => st.includes(exc.toLowerCase()))
        );
        if (allExcluded) return;
      }
    }

    // Skip if this template requires a home feature the user doesn't have
    if (template.requires_home_feature) {
      const feature = template.requires_home_feature as keyof Home;
      if (!home[feature]) {
        return;
      }
    }

    // Skip if this template requires a specific flooring type the home doesn't have
    if (template.requires_flooring_type && template.requires_flooring_type.length > 0) {
      const homeFlooring = home.primary_flooring as string | undefined;
      if (!homeFlooring || !template.requires_flooring_type.includes(homeFlooring)) {
        return;
      }
    }

    // Skip if this template requires specific construction/foundation type (OR logic)
    if (template.requires_construction_type || template.requires_foundation_type) {
      const matchesConstruction = template.requires_construction_type?.length
        ? template.requires_construction_type.includes(home.construction_type as string)
        : false;
      const matchesFoundation = template.requires_foundation_type?.length
        ? template.requires_foundation_type.includes(home.foundation_type as string)
        : false;
      if (!matchesConstruction && !matchesFoundation) {
        return;
      }
    }

    // Skip if this template requires specific countertop types
    if (template.requires_countertop_type) {
      const homeCountertop = home.countertop_type as string | undefined;
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

    // Skip if this template is pool_type-restricted and doesn't match
    if (template.requires_pool_type && template.requires_pool_type.length > 0) {
      const homePoolType = (home.pool_type ?? (home.has_pool ? 'chlorine' : 'none')) as
        | 'chlorine' | 'salt' | 'mineral' | 'none';
      if (!template.requires_pool_type.includes(homePoolType)) {
        return;
      }
    }

    // Skip if this template requires specific water source and doesn't match
    if (template.requires_water_source && template.requires_water_source.length > 0) {
      const homeWaterSource = home.water_source || 'municipal';
      if (!template.requires_water_source.includes(homeWaterSource)) {
        return;
      }
    }

    // Skip if this template requires specific sewer type and doesn't match
    if (template.requires_sewer_type && template.requires_sewer_type.length > 0) {
      const homeSewType = home.sewer_type || 'municipal';
      if (!template.requires_sewer_type.includes(homeSewType)) {
        return;
      }
    }

    // Skip if this template requires specific septic system type and doesn't match
    if (template.requires_septic_type && template.requires_septic_type.length > 0) {
      const homeSepticType = (home as any).septic_type as string | undefined;
      if (!homeSepticType || !template.requires_septic_type.includes(homeSepticType as any)) {
        return;
      }
    }

    // Skip if this template requires specific home type and doesn't match
    if (template.requires_home_type && template.requires_home_type.length > 0) {
      // Get home type from stories_type or home characteristics
      let homeType = home.stories_type || 'single_family';
      if (!template.requires_home_type.includes(homeType)) {
        return;
      }
    }

    // Check user preferences before generating task
    const isProTask = template.pro_responsible ?? false;
    if (!isTaskVisible(template.id, template.category, userPreferences, isProTask, template.task_level, template.is_cleaning)) {
      return;
    }

    // Fireplace tasks: mention count in description when home has multiple fireplaces
    let effectiveTemplate = template;
    if (template.requires_home_feature === 'has_fireplace' && template.category === 'fireplace') {
      const fpCount = (home as any).fireplace_count ?? 1;
      if (fpCount > 1) {
        effectiveTemplate = {
          ...template,
          description: `${template.description} (You have ${fpCount} fireplaces — repeat for each.)`,
        };
      }
    }

    // Equipment-keyed templates fan out: one task per matching consumable
    if (template.equipment_keyed && template.consumable_spec) {
      const matchingConsumables = consumables.filter((c) => {
        if (c.consumable_type !== template.consumable_spec) return false;
        // If the template also requires_equipment, filter by parent category
        if (template.requires_equipment) {
          const parent = equipment.find((eq) => eq.id === c.equipment_id);
          if (!parent || parent.category !== template.requires_equipment) return false;
        }
        return true;
      });

      if (matchingConsumables.length > 0) {
        matchingConsumables.forEach((consumable) => {
          generateConsumableTask(
            template,
            home,
            equipment,
            consumable,
            existingTaskKeys,
            newTasks,
            today,
            userPreferences,
          );
        });
        return; // Skip normal flow — consumable-specific tasks were generated
      }
      // Fallback: no consumables scanned yet — generate generic task via normal flow
    }

    // Route to appropriate scheduling logic
    if (effectiveTemplate.scheduling_type === 'dynamic') {
      generateDynamicTask(effectiveTemplate, home, equipment, existingTaskKeys, newTasks, today, userPreferences);
    } else {
      generateSeasonalTasks(effectiveTemplate, home, equipment, existingTaskKeys, newTasks, currentMonth, currentYear, today, userPreferences);
    }
  });

  // ─── TRASH / RECYCLING / YARD WASTE recurring tasks ───
  // These are pinned weekly tasks (like pro visits) that don't get
  // rescheduled by the task engine. Reminder = night before.
  const DAY_MAP: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

  const generateWeeklyPickupTasks = (
    dayName: string | undefined | null,
    title: string,
    description: string,
    category: string,
    frequency: 'weekly' | 'biweekly',
    seasonal: boolean,
  ) => {
    if (!dayName || !DAY_MAP.hasOwnProperty(dayName)) return;
    const targetDay = DAY_MAP[dayName];
    const endDate = addDays(today, 90); // generate 3 months out
    let date = new Date(today);
    // Advance to the next occurrence of the target day
    while (date.getDay() !== targetDay) date = addDays(date, 1);
    let weekCount = 0;

    while (date <= endDate) {
      const taskMonth = getMonth(date) + 1;
      const taskYear = getYear(date);
      const dedupKey = `${title}|${taskMonth}|${taskYear}|${date.getDate()}`;

      // Skip yard waste in winter months if seasonal
      const isWinter = taskMonth === 12 || taskMonth === 1 || taskMonth === 2;
      if (seasonal && isWinter) {
        date = addDays(date, 7);
        weekCount++;
        continue;
      }

      // Biweekly: skip every other week
      if (frequency === 'biweekly' && weekCount % 2 === 1) {
        date = addDays(date, 7);
        weekCount++;
        continue;
      }

      if (!existingTaskKeys.has(dedupKey)) {
        newTasks.push({
          id: generateUUID(),
          home_id: home.id,
          title,
          description,
          category: category as any,
          priority: 'medium' as TaskPriority,
          status: 'upcoming',
          frequency: frequency === 'weekly' ? 'weekly' : 'biweekly' as any,
          due_date: format(date, "yyyy-MM-dd'T'06:00:00"),
          is_weather_triggered: false,
          applicable_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          estimated_minutes: 5,
          reminder_days_before: 1,
          created_at: new Date().toISOString(),
        });
      }

      date = addDays(date, 7);
      weekCount++;
    }
  };

  if (home.trash_day) {
    generateWeeklyPickupTasks(
      home.trash_day, 'Take Out Trash',
      `Move trash bins to the curb for pickup${home.trash_provider ? ` (${home.trash_provider})` : ''}.`,
      'general', 'weekly', false,
    );
  }
  if (home.recycling_day) {
    generateWeeklyPickupTasks(
      home.recycling_day, 'Put Out Recycling',
      'Move recycling bins to the curb for pickup.',
      'general', home.recycling_frequency || 'weekly', false,
    );
  }
  if (home.yard_waste_day) {
    generateWeeklyPickupTasks(
      home.yard_waste_day, 'Yard Waste Pickup',
      'Set out yard waste bags or bins for pickup.',
      'general', 'weekly', home.yard_waste_seasonal ?? true,
    );
  }

  return newTasks;
}

/**
 * Generate DYNAMIC tasks — creates MULTIPLE future occurrences across the next 18 months.
 * This ensures the calendar has tasks in every month, not just the next occurrence.
 * On completion, createNextDynamicTask() will handle rescheduling from the completion date.
 */
function generateDynamicTask(
  template: TaskTemplate,
  home: Home,
  equipment: Equipment[],
  existingTaskKeys: Set<string>,
  newTasks: MaintenanceTask[],
  today: Date,
  userPreferences: UserPreferences = DEFAULT_USER_PREFERENCES
) {
  // Note: We don't pre-check for existing tasks here because dynamic tasks
  // should be generated for each month/year combo and deduped individually

  const intervalDays = template.interval_days || 90;

  // Use a small hash offset (0-13 days) so dynamic tasks don't all land on the same date
  const hashOffset = template.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 14;

  // Generate multiple occurrences to fill the next 18 months
  const eighteenMonthsOut = addDays(today, 548);
  let nextDue = addDays(today, intervalDays + hashOffset);

  while (nextDue <= eighteenMonthsOut) {
    // Check composite key to avoid duplication within same month/year
    const taskMonth = getMonth(nextDue) + 1;
    const taskYear = getYear(nextDue);
    const dedupKey = `${template.title}|${taskMonth}|${taskYear}`;

    if (!existingTaskKeys.has(dedupKey)) {
      const task = createTaskFromTemplate(template, home, equipment, nextDue);
      newTasks.push(task);
    }

    nextDue = addDays(nextDue, intervalDays);
  }
}

/**
 * Generate SEASONAL tasks — for each applicable month in the next 12 months.
 * Creates one task per applicable month to fill out the calendar.
 */
function generateSeasonalTasks(
  template: TaskTemplate,
  home: Home,
  equipment: Equipment[],
  existingTaskKeys: Set<string>,
  newTasks: MaintenanceTask[],
  currentMonth: number,
  currentYear: number,
  today: Date,
  userPreferences: UserPreferences = DEFAULT_USER_PREFERENCES
) {
  // For seasonal tasks, generate for each applicable month in the next 18 months.
  // Annual tasks use a stable hash to pick ONE month from their applicable_months,
  // spreading them across the year instead of clustering in the current month.
  const generatedMonths = new Set<string>();
  const idHash = template.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // For annual/as_needed tasks, pick a stable month from applicable_months using hash
  if ((template.frequency === 'annual' || template.frequency === 'as_needed') && template.applicable_months.length > 1) {
    const sortedMonths = [...template.applicable_months].sort((a, b) => a - b);
    const pickedMonth = sortedMonths[idHash % sortedMonths.length];

    // Find the next occurrence of this month (this year or next)
    let targetYear = currentYear;
    if (pickedMonth < currentMonth || (pickedMonth === currentMonth && today.getDate() > 25)) {
      targetYear = currentYear + 1;
    }

    const dedupKey = `${template.title}|${pickedMonth}|${targetYear}`;
    if (!existingTaskKeys.has(dedupKey)) {
      const dayHash = idHash % 28 + 1;
      const dueDate = new Date(targetYear, pickedMonth - 1, dayHash);
      const task = createTaskFromTemplate(template, home, equipment, dueDate);
      newTasks.push(task);
    }
    return;
  }

  for (let offset = 0; offset < 18; offset++) {
    const targetMonth = ((currentMonth - 1 + offset) % 12) + 1;
    const targetYear = currentYear + Math.floor((currentMonth - 1 + offset) / 12);

    if (!template.applicable_months.includes(targetMonth)) {
      continue;
    }

    // Dedup key: title + month + year
    const dedupKey = `${template.title}|${targetMonth}|${targetYear}`;
    if (generatedMonths.has(dedupKey)) continue;
    generatedMonths.add(dedupKey);

    // Skip if this month/year combo already has this task
    if (existingTaskKeys.has(dedupKey)) {
      continue;
    }

    // Distribute tasks within the month using a hash of the template ID
    const dayHash = idHash % 28 + 1;
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
 * Generate one task per matching equipment consumable. Interval pulled
 * from the consumable row when present, else template default, else 90 days.
 * One unique task per (template.id, consumable.id) — the consumable.name
 * is suffixed to the title so the dashboard shows distinct entries.
 */
function generateConsumableTask(
  template: TaskTemplate,
  home: Home,
  equipment: Equipment[],
  consumable: EquipmentConsumable,
  existingTaskKeys: Set<string>,
  newTasks: MaintenanceTask[],
  today: Date,
  userPreferences: UserPreferences = DEFAULT_USER_PREFERENCES
) {
  // Make each consumable's task title unique so dedup works correctly
  const suffix = consumable.spec
    ? ` — ${consumable.name} (${consumable.spec})`
    : ` — ${consumable.name}`;
  const scopedTitle = `${template.title}${suffix}`;

  // Interval priority: consumable row → template default → 90 days
  const intervalMonths =
    consumable.replacement_interval_months ??
    template.consumable_replacement_months ??
    3;
  const intervalDays = Math.max(7, Math.round(intervalMonths * 30));

  // First due date: from consumable.next_due_date if set,
  // else consumable.last_replaced_date + interval,
  // else today + interval
  let firstDue: Date;
  if (consumable.next_due_date) {
    firstDue = new Date(consumable.next_due_date);
  } else if (consumable.last_replaced_date) {
    firstDue = addDays(new Date(consumable.last_replaced_date), intervalDays);
  } else {
    firstDue = addDays(today, intervalDays);
  }

  // Generate up to 18 months of future occurrences
  const eighteenMonthsOut = addDays(today, 548);
  let nextDue = firstDue;
  while (nextDue <= eighteenMonthsOut) {
    const taskMonth = getMonth(nextDue) + 1;
    const taskYear = getYear(nextDue);
    const dedupKey = `${scopedTitle}|${taskMonth}|${taskYear}`;

    if (!existingTaskKeys.has(dedupKey)) {
      const task = createTaskFromTemplate(template, home, equipment, nextDue);
      task.title = scopedTitle;
      task.equipment_id = consumable.equipment_id;
      task.purchase_url = consumable.purchase_url;
      task.consumable_id = consumable.id;
      task.scheduling_type = 'dynamic';
      task.interval_days = intervalDays;
      newTasks.push(task);
      existingTaskKeys.add(dedupKey);
    }

    nextDue = addDays(nextDue, intervalDays);
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
    template_id: template.id,
    // C-11 (migration 066): snapshot the template version so we can detect stale
    // tasks later. Absent for hardcoded TASK_TEMPLATES — only DB templates carry a version.
    template_version: template.template_version,
    items_to_have_on_hand: template.items_to_have_on_hand,
    service_purpose: template.service_purpose,
    safety_warnings: template.safety_warnings,
    is_cleaning: template.is_cleaning || false,
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
 * Returns template IDs that require a specific equipment category.
 * Used for cleaning up orphaned tasks when equipment is deleted and no
 * other equipment of that category remains.
 */
export function getTemplateIdsForEquipmentCategory(
  category: EquipmentCategory
): string[] {
  return TASK_TEMPLATES
    .filter((t) => t.requires_equipment === category)
    .map((t) => t.id);
}

/**
 * Generates lifecycle alerts for equipment nearing end of life.
 *
 * For equipment with install_date and expected_lifespan_years:
 * - At 80% lifespan: "Inspect" task (priority: high)
 * - At 95% lifespan: "Plan Replacement" task (priority: urgent)
 *
 * Special handling for roof: uses home.roof_install_year to calculate age,
 * falls back to roof_age_years for backward compatibility,
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
      // Validate that roof_type key exists in ROOF_LIFESPANS before accessing
      const lifespan = ROOF_LIFESPANS[home.roof_type as string];
      if (!lifespan) return;

      const roofAge = home.roof_install_year
        ? new Date().getFullYear() - home.roof_install_year
        : home.roof_age_years ?? 0;
      const percentageThrough =
        lifespan.min > 0 ? roofAge / lifespan.min : 0;

      // "Plan Replacement" alerts now show on the Equipment page, not as calendar tasks.
      // Only "Inspect" alerts generate calendar tasks.
      if (percentageThrough >= 0.8 && percentageThrough < 0.95) {
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

    // "Plan Replacement" alerts now show on the Equipment page, not as calendar tasks.
    if (percentageThrough >= 0.8 && percentageThrough < 0.95) {
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
    has_gutters: home.has_gutters,
    has_fire_extinguisher: home.has_fire_extinguisher,
    has_water_softener: home.has_water_softener,
    has_sump_pump: home.has_sump_pump,
    has_storm_shelter: home.has_storm_shelter,
  };

  relevantTemplates.forEach((template) => {
    if (template.requires_home_feature) {
      const feature = template.requires_home_feature as keyof typeof homeFeatures;
      if (!homeFeatures[feature]) {
        return;
      }
    }

    // Skip if this template requires a specific flooring type the home doesn't have
    if (template.requires_flooring_type && template.requires_flooring_type.length > 0) {
      const homeFlooring = home.primary_flooring as string | undefined;
      if (!homeFlooring || !template.requires_flooring_type.includes(homeFlooring)) {
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
