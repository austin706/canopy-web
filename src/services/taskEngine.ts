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
 * P2 #34 (2026-04-23): Normalize task titles for deduplication.
 * Strips parentheticals, unifies unicode dashes, collapses non-alphanumerics.
 * Ensures "Clean Gutters (Spring)" and "Clean Gutters – Spring" dedup as equal.
 */
export function normalizeDedupTitle(t: string): string {
  return (t || '')
    .toLowerCase()
    .replace(/[([][^)\]]*[)\]]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

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
  // 2026-05-18 (migration 086): per-home disabled template ids.
  disabledTemplateIds: string[] = [],
): MaintenanceTask[] {
  // Guard against concurrent task generation that could cause race conditions
  // or duplicate task creation
  if (taskGenerationInProgress) {
    return [];
  }

  taskGenerationInProgress = true;
  try {
    return generateTasksForHomeImpl(home, equipment, existingTasks, consumables, userPreferences, customTemplates, disabledTemplateIds);
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
    // 2026-05-18 (migration 082): legacy `db.instructions` text column dropped;
    // instructions_json is the single source of truth.
    instructions: db.instructions_json || [],
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
    add_on_category: (db.add_on_category as any) ?? hardcoded?.add_on_category ?? undefined,
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
  disabledTemplateIds: string[] = [],
): MaintenanceTask[] {
  const disabledTemplateSet = new Set(disabledTemplateIds);
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

  // P2 #34 (2026-04-23): dedup key now prefers template_id + month + year.
  // Title variations ("Clean Gutters (Spring)" vs "Clean Gutters – Spring")
  // used to dedup incorrectly. Mobile parity at Canopy-App/services/taskEngine.ts.
  const existingTaskKeys = new Set<string>();
  existingTasks.forEach((task) => {
    const d = new Date(task.due_date);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    if (task.template_id) {
      existingTaskKeys.add(`tmpl:${task.template_id}|${m}|${y}`);
    }
    existingTaskKeys.add(`title:${normalizeDedupTitle(task.title)}|${m}|${y}`);
  });

  // Use DB templates as the source of truth (migration 061 seeds all built-in
  // templates as source='built_in' rows with stable TEXT ids). A hardcoded
  // template is only used as a fallback when no DB row with the same id AND no
  // DB row with the same title|category exists · which should only happen in
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
  // CRITICAL FILTER: Skip DB-only "stub" templates (cast as `any` in TASK_TEMPLATES)
  // that only provide metadata overrides (is_cleaning, service_type, etc.) and
  // rely on the DB for the full template body. If their matching DB row is missing
  // (e.g., because migration 061 hasn't been seeded with that specific id), the
  // stub would fall through here WITHOUT applicable_months/title/category · and
  // the forEach below would crash on `template.applicable_months.includes(...)`.
  // See: refrigerator-coils-clean, garbage-disposal-clean, vent-hood-degrease,
  // dishwasher-clean, washing-machine-clean, garbage-bins-clean,
  // deep-clean-outdoor-furniture, holiday-light-install, holiday-light-remove.
  const fallbackBuiltIn = TASK_TEMPLATES.filter(
    (t) =>
      !dbIdSet.has(t.id) &&
      !dbTitleKeySet.has(`${t.title}|${t.category}`) &&
      // Defensive guards: a complete template MUST have these fields.
      !!t.title &&
      !!t.category &&
      Array.isArray(t.applicable_months) &&
      t.applicable_months.length > 0
  );
  const allTemplates: TaskTemplate[] = [...convertedDB, ...fallbackBuiltIn];

  // Process each template
  allTemplates.forEach((template) => {
    // 2026-05-18 (migration 086): respect per-home disabled-template overrides.
    if (disabledTemplateSet.has(template.id)) {
      return;
    }

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
          description: `${template.description} (You have ${fpCount} fireplaces · repeat for each.)`,
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
        return; // Skip normal flow · consumable-specific tasks were generated
      }
      // Fallback: no consumables scanned yet · generate generic task via normal flow
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
      // P2 #34: normalized title used for the weekly dedup key so title tweaks
      // ("Yard Waste" vs "Yard waste pickup") still dedup correctly.
      const dedupKey = `title:${normalizeDedupTitle(title)}|${taskMonth}|${taskYear}|${date.getDate()}`;

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
 * Generate DYNAMIC tasks · creates MULTIPLE future occurrences across the next 18 months.
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
    // P2 #34: template_id + normalized-title double-key
    const tmplKey = `tmpl:${template.id}|${taskMonth}|${taskYear}`;
    const titleKey = `title:${normalizeDedupTitle(template.title)}|${taskMonth}|${taskYear}`;

    if (!existingTaskKeys.has(tmplKey) && !existingTaskKeys.has(titleKey)) {
      const task = createTaskFromTemplate(template, home, equipment, nextDue);
      newTasks.push(task);
    }

    nextDue = addDays(nextDue, intervalDays);
  }
}

/**
 * Generate SEASONAL tasks · for each applicable month in the next 12 months.
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

    // P2 #34: template_id + normalized-title double-key
    const tmplKey = `tmpl:${template.id}|${pickedMonth}|${targetYear}`;
    const titleKey = `title:${normalizeDedupTitle(template.title)}|${pickedMonth}|${targetYear}`;
    if (!existingTaskKeys.has(tmplKey) && !existingTaskKeys.has(titleKey)) {
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

    // P2 #34: template_id + normalized-title double-key
    const tmplKey = `tmpl:${template.id}|${targetMonth}|${targetYear}`;
    const titleKey = `title:${normalizeDedupTitle(template.title)}|${targetMonth}|${targetYear}`;
    if (generatedMonths.has(tmplKey) || generatedMonths.has(titleKey)) continue;
    generatedMonths.add(tmplKey);
    generatedMonths.add(titleKey);

    // Skip if this month/year combo already has this task
    if (existingTaskKeys.has(tmplKey) || existingTaskKeys.has(titleKey)) {
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
 * One unique task per (template.id, consumable.id) · the consumable.name
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
    ? ` · ${consumable.name} (${consumable.spec})`
    : ` · ${consumable.name}`;
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
    // P2 #34: consumable-scoped title normalized for dedup
    const dedupKey = `title:${normalizeDedupTitle(scopedTitle)}|${taskMonth}|${taskYear}`;

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
    // tasks later. Absent for hardcoded TASK_TEMPLATES · only DB templates carry a version.
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
/**
 * 2026-05-18: Per-category lifecycle content. Mirrors Canopy-App/services/
 * taskEngine.ts — see that file's header comment for the rationale. Web-only
 * note: this codebase currently emits *only* the 'inspect' phase as a
 * calendar task (the 'replace' phase is rendered as an Equipment-page banner,
 * not a task). The 'replace' content is still defined here for parity so
 * either codebase can flip the policy in one place later.
 */
type LifecyclePhase = 'inspect' | 'replace';
interface LifecycleContent {
  title: (equipmentName: string) => string;
  description: (equipmentName: string) => string;
  instructions: string[];
  estimated_minutes: number;
  estimated_cost_low: number;
  estimated_cost_high: number;
  pro_recommended: boolean;
  items_to_have_on_hand?: string[];
  service_purpose?: string;
}

// 2026-05-18: Per-category lifecycle thresholds. See header comment in
// Canopy-App/services/taskEngine.ts for the per-category rationale.
interface LifecycleThresholds {
  inspect: number;
  replace: number;
}

const DEFAULT_LIFECYCLE_THRESHOLDS: LifecycleThresholds = {
  inspect: 0.80,
  replace: 0.95,
};

const LIFECYCLE_THRESHOLDS: Partial<Record<string, LifecycleThresholds>> = {
  hvac:         { inspect: 0.75, replace: 0.90 },
  water_heater: { inspect: 0.67, replace: 0.83 },
  plumbing:     { inspect: 0.75, replace: 0.90 },
  electrical:   { inspect: 0.85, replace: 0.95 },
};

/**
 * 2026-05-18: thresholds resolution order:
 *   1. Per-instance overrides on the Equipment row (migration 085).
 *   2. Category default from LIFECYCLE_THRESHOLDS.
 *   3. DEFAULT_LIFECYCLE_THRESHOLDS (0.80 / 0.95).
 */
export function getLifecycleThresholds(
  category: string,
  equipment?: Pick<Equipment, 'lifecycle_inspect_threshold_pct' | 'lifecycle_replace_threshold_pct'>
): LifecycleThresholds {
  const base = LIFECYCLE_THRESHOLDS[category] ?? DEFAULT_LIFECYCLE_THRESHOLDS;
  if (!equipment) return base;
  return {
    inspect: equipment.lifecycle_inspect_threshold_pct ?? base.inspect,
    replace: equipment.lifecycle_replace_threshold_pct ?? base.replace,
  };
}

const GENERIC_LIFECYCLE_CONTENT: Record<LifecyclePhase, LifecycleContent> = {
  inspect: {
    title: (n) => `End-of-life inspection: ${n}`,
    description: (n) =>
      `${n} is at ~80% of its expected lifespan. Getting eyes on it now catches preventable failures and gives you time to plan replacement instead of reacting to a breakdown.`,
    instructions: [
      'Look for visible wear, corrosion, leaks, unusual noises, or efficiency drops since last year.',
      'Photograph any concerns and attach to the equipment record.',
      'If anything looks off — or you\'re not sure — schedule a professional inspection before the next heavy-use season.',
    ],
    estimated_minutes: 20,
    estimated_cost_low: 0,
    estimated_cost_high: 150,
    pro_recommended: false,
    service_purpose:
      'Identify issues before they become emergencies, and start budgeting for replacement on your timeline rather than during a failure.',
  },
  replace: {
    title: (n) => `Plan replacement: ${n}`,
    description: (n) =>
      `${n} is at ~95% of its expected lifespan. Older equipment fails at a sharply rising rate past this point, often at the worst possible moment. Start gathering quotes now so you can replace on a planned schedule.`,
    instructions: [
      'Get 2–3 quotes from licensed contractors with at least one local reference.',
      'Ask about energy-efficiency rebates, tax credits, and financing options.',
      'Capture warranty length, expected lifespan, and labor terms in writing.',
      'Schedule replacement during shoulder season (Spring/Fall) when contractor pricing is best.',
    ],
    estimated_minutes: 60,
    estimated_cost_low: 0,
    estimated_cost_high: 0,
    pro_recommended: true,
    service_purpose:
      'Avoid emergency replacement pricing and downtime by planning ahead. Mid-failure replacements typically cost 20–40% more than scheduled ones.',
  },
};

const LIFECYCLE_CONTENT: Partial<Record<string, Record<LifecyclePhase, LifecycleContent>>> = {
  hvac: {
    inspect: {
      title: (n) => `End-of-life HVAC inspection: ${n}`,
      description: (n) =>
        `${n} is at ~80% of its expected lifespan. Aging HVAC systems typically lose 1–2% efficiency per year past this point. A pro inspection now catches refrigerant leaks, coil corrosion, and heat-exchanger wear before they cause a mid-season failure.`,
      instructions: [
        'Schedule an HVAC pro for an end-of-life condition assessment (not a basic tune-up).',
        'Ask them to evaluate: refrigerant levels, coil condition, blower motor wear, heat exchanger integrity, and overall efficiency vs nameplate spec.',
        'Get a written report with photos so you can compare quotes when replacement time comes.',
        'Confirm whether parts are still being manufactured for your model — discontinued parts are a strong replacement signal.',
      ],
      estimated_minutes: 90,
      estimated_cost_low: 90,
      estimated_cost_high: 250,
      pro_recommended: true,
      items_to_have_on_hand: ['Maintenance history (if available)', 'Original install paperwork or model number'],
      service_purpose:
        'Catch failures before they happen and decide whether to keep paying repair-by-repair or invest in a high-efficiency replacement that pays back through energy savings.',
    },
    replace: {
      title: (n) => `Plan HVAC replacement: ${n}`,
      description: (n) =>
        `${n} is at ~95% of its expected lifespan. HVAC failures typically happen during temperature extremes when contractor availability is lowest and pricing is highest. Planning now lets you replace on your terms.`,
      instructions: [
        'Get 3 quotes from licensed HVAC contractors. Confirm each includes a Manual J load calculation, not just a same-size swap.',
        'Compare SEER2 and HSPF2 ratings. A 15+ SEER2 unit can save 20–40% vs an old 8–10 SEER unit.',
        'Ask about federal Inflation Reduction Act rebates (up to $2,000 for heat pumps), utility rebates, and 0% financing.',
        'Schedule replacement during Spring or Fall shoulder season — pricing is 10–20% lower than peak summer/winter.',
        'Confirm warranty: 10 years on parts is standard; 12+ on compressor is a premium signal.',
      ],
      estimated_minutes: 120,
      estimated_cost_low: 5000,
      estimated_cost_high: 14000,
      pro_recommended: true,
      service_purpose:
        'A planned HVAC replacement costs 20–40% less than an emergency one, qualifies for rebates, and gives you the chance to upgrade efficiency.',
    },
  },
  water_heater: {
    inspect: {
      title: (n) => `End-of-life water heater inspection: ${n}`,
      description: (n) =>
        `${n} is at ~80% of its expected lifespan. Water heater tanks corrode from the inside out — visible rust at fittings, popping noises, or rust-tinged hot water mean the inside is much worse than the outside looks.`,
      instructions: [
        'Inspect the tank exterior for rust streaks, moisture at the base, or bulging.',
        'Listen during a heating cycle for popping, rumbling, or knocking — sediment buildup signals the tank is near end of life.',
        'Test the T&P (temperature & pressure) relief valve by lifting the lever briefly — water should discharge, then stop cleanly.',
        'If you can pull the anode rod (gas heaters), check for >50% consumption — replacement extends life 3–5 years.',
        'Photograph any rust or corrosion and consider an immediate plumber visit if you see standing water.',
      ],
      estimated_minutes: 20,
      estimated_cost_low: 0,
      estimated_cost_high: 200,
      pro_recommended: false,
      items_to_have_on_hand: ['Flashlight', 'Bucket', 'Garden hose (for T&P test)'],
      service_purpose:
        'Tank failure dumps 40–80 gallons of water into your home, often causing $1,000s in damage. Catching wear early lets you replace before the leak.',
    },
    replace: {
      title: (n) => `Plan water heater replacement: ${n}`,
      description: (n) =>
        `${n} is at ~95% of its expected lifespan. Tank water heaters typically fail by leaking, not by stopping — meaning the failure mode is water damage, not just no hot water. Replace before it happens.`,
      instructions: [
        'Decide tank vs tankless: tankless costs ~2× upfront but lasts ~20 years vs 12, and saves ~20% on energy.',
        'Get 2–3 plumber quotes; confirm haul-away of the old unit and expansion-tank replacement are included.',
        'For gas heaters, check whether your venting (atmospheric vs power-vent) is up to current code — a new unit may require venting changes.',
        'Heat pump water heaters qualify for federal rebates up to $2,000 and ~$300–600 utility rebates in many areas.',
        'Schedule mid-week, mid-month for best plumber availability and pricing.',
      ],
      estimated_minutes: 60,
      estimated_cost_low: 1200,
      estimated_cost_high: 4500,
      pro_recommended: true,
      service_purpose:
        'A planned replacement costs $1,200–$4,500 installed; a failed tank that floods a finished basement can easily exceed $10,000 in repairs.',
    },
  },
  roof: {
    inspect: {
      title: (n) => `End-of-life roof inspection: ${n}`,
      description: (n) =>
        `${n} is at ~80% of its expected lifespan. The visible wear (granule loss, curling shingles, exposed nails) is usually well behind the underlying damage (flashing fatigue, deck moisture, ventilation issues). A pro inspection at this stage prevents leaks before they show on the ceiling.`,
      instructions: [
        'Schedule a licensed roofer for an end-of-life inspection — many offer this free with a future quote.',
        'Ask them to evaluate: shingle granule loss, flashing at chimneys/valleys, attic ventilation, soffit/fascia condition, and any active leaks.',
        'Get a written report with photos from the roof and the attic.',
        'If they recommend immediate repair vs full replacement, get a second opinion before committing.',
      ],
      estimated_minutes: 60,
      estimated_cost_low: 0,
      estimated_cost_high: 300,
      pro_recommended: true,
      items_to_have_on_hand: ['Original roof install date or paperwork (if available)', 'Insurance policy details'],
      service_purpose:
        'A small repaired leak costs hundreds. A leak that\'s been hidden in your attic for 18 months costs tens of thousands in mold, structure, and ceiling repair.',
    },
    replace: {
      title: (n) => `Plan roof replacement: ${n}`,
      description: (n) =>
        `${n} is at or past its expected lifespan. Roof failures are unpredictable — a single heavy storm can move you from "due soon" to "active leak" overnight. Plan replacement during the next available dry-weather window.`,
      instructions: [
        'Get 3 quotes from licensed, insured, locally-reviewed roofers. Avoid storm-chaser pop-up companies.',
        'Confirm each quote includes: full tear-off (not overlay), new underlayment, flashing replacement, and ice/water shield in valleys.',
        'Ask about warranty: 25-year on architectural shingles is standard; check labor warranty separately.',
        'If you\'re in hail country, ask about Class 4 impact-resistant shingles — they cost 10–20% more but typically earn a 5–25% homeowners-insurance discount.',
        'Check whether your insurance has a roof-age limit (some refuse coverage after 20 years). Replacement may be required for coverage continuity.',
        'Schedule during Spring or Fall for best contractor availability and cooler installation temps.',
      ],
      estimated_minutes: 120,
      estimated_cost_low: 8000,
      estimated_cost_high: 25000,
      pro_recommended: true,
      service_purpose:
        'Replacing on a schedule lets you compare quotes, pick high-impact materials, and time the work around weather. Replacing under a leak emergency costs 30–50% more and locks you into whoever can start fastest.',
    },
  },
  appliance: {
    inspect: {
      title: (n) => `End-of-life appliance check: ${n}`,
      description: (n) =>
        `${n} is at ~80% of its expected lifespan. Major appliances often fail in cascades — one $400 part fix can buy two more years, OR can be money thrown at a unit that's about to fail again. Use the inspection to decide which.`,
      instructions: [
        'Look up the cost of the most likely failing part for your model online.',
        'Compare that part cost (+ ~$150 labor) against the cost of a new comparable appliance.',
        'Rule of thumb: if repair cost is >50% of replacement, replace.',
        'Check whether the manufacturer still produces replacement parts for your model — discontinued parts are a strong replacement signal.',
      ],
      estimated_minutes: 30,
      estimated_cost_low: 0,
      estimated_cost_high: 0,
      pro_recommended: false,
      service_purpose:
        'Decide whether to repair, replace, or run until failure based on real numbers, not gut feel.',
    },
    replace: {
      title: (n) => `Plan appliance replacement: ${n}`,
      description: (n) =>
        `${n} is at ~95% of its expected lifespan. Plan the replacement so you can shop sales (Black Friday, Memorial Day, Labor Day) and pick the model you want, not whatever's in stock when yours dies.`,
      instructions: [
        'Identify the model you want and watch for it across multiple retailers — Energy Star versions typically rebate $50–$300.',
        'Verify exact dimensions vs the current cutout — modern appliances are often slightly different sizes.',
        'For dishwashers / washers / dryers, confirm the existing water/drain/vent setup matches what the new unit needs.',
        'Schedule installation at delivery — DIY swap saves $100–$200 but adds risk on water/gas hookups.',
      ],
      estimated_minutes: 90,
      estimated_cost_low: 600,
      estimated_cost_high: 3500,
      pro_recommended: false,
      service_purpose:
        'Planned replacements let you shop sales, pick exactly what you want, and avoid the emergency-purchase tax.',
    },
  },
  electrical: {
    inspect: {
      title: (n) => `End-of-life electrical inspection: ${n}`,
      description: (n) =>
        `${n} is at ~80% of its expected lifespan. Electrical components don't visibly degrade — failures often present as breakers tripping, dimming lights, or warm outlets. A licensed electrician can test for the early signs before a fire risk emerges.`,
      instructions: [
        'Schedule a licensed electrician for an end-of-life condition check.',
        'Ask them to test breaker function, panel temperature under load, and any aluminum-wiring connection points if applicable.',
        'Get a written assessment with photos.',
      ],
      estimated_minutes: 60,
      estimated_cost_low: 150,
      estimated_cost_high: 350,
      pro_recommended: true,
      service_purpose:
        'Electrical failures can be silent and dangerous. Catching a deteriorating panel or breaker prevents fire risk.',
    },
    replace: {
      title: (n) => `Plan electrical replacement: ${n}`,
      description: (n) =>
        `${n} is at ~95% of its expected lifespan. Electrical replacements are permit work — plan ahead to avoid an emergency unlicensed fix.`,
      instructions: [
        'Get 2–3 quotes from licensed electricians; confirm permit and inspection are included.',
        'Ask about panel upgrades (100A → 200A) if you have any EV / heat-pump / solar plans within the next 5 years.',
        'Confirm whether AFCI/GFCI breakers are required by current code in your area for the replacement scope.',
      ],
      estimated_minutes: 90,
      estimated_cost_low: 500,
      estimated_cost_high: 4500,
      pro_recommended: true,
      service_purpose:
        'Planned electrical work is permitted, inspected, and code-compliant. Emergency electrical work often skips those steps and creates insurance + resale problems later.',
    },
  },
  plumbing: {
    inspect: {
      title: (n) => `End-of-life plumbing inspection: ${n}`,
      description: (n) =>
        `${n} is at ~80% of its expected lifespan. Plumbing failures cause more home insurance claims than any other category. An end-of-life inspection catches corrosion, scale, and pressure issues before they cause water damage.`,
      instructions: [
        'Schedule a licensed plumber for an end-of-life pipe/fitting condition check.',
        'Ask for a sediment + corrosion assessment, including under sinks and behind/around toilets.',
        'For galvanized or polybutylene piping, ask about full or partial repipe options — both are insurance-exclusion materials.',
      ],
      estimated_minutes: 60,
      estimated_cost_low: 150,
      estimated_cost_high: 400,
      pro_recommended: true,
      service_purpose:
        'A small slow leak detected during an inspection costs hundreds. The same leak found by drywall stains costs tens of thousands.',
    },
    replace: {
      title: (n) => `Plan plumbing replacement: ${n}`,
      description: (n) =>
        `${n} is at or past its expected lifespan. Schedule replacement before failure to avoid water damage.`,
      instructions: [
        'Get 2–3 quotes from licensed plumbers.',
        'Confirm permit + final inspection are included.',
        'If a partial repipe, confirm the new piping material connects safely to existing (avoid mixing copper + galvanized without dielectric unions).',
      ],
      estimated_minutes: 90,
      estimated_cost_low: 400,
      estimated_cost_high: 8000,
      pro_recommended: true,
      service_purpose:
        'Planned plumbing work prevents water damage. Reactive work pairs the repair with water-damage restoration.',
    },
  },
};

function getLifecycleContent(category: string, phase: LifecyclePhase): LifecycleContent {
  return LIFECYCLE_CONTENT[category]?.[phase] ?? GENERIC_LIFECYCLE_CONTENT[phase];
}

export function generateEquipmentLifecycleAlerts(
  equipment: Equipment[],
  home: Home
): MaintenanceTask[] {
  const alerts: MaintenanceTask[] = [];
  const today = new Date();

  equipment.forEach((item) => {
    const thresholds = getLifecycleThresholds(item.category, item);

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
      if (percentageThrough >= thresholds.inspect && percentageThrough < thresholds.replace) {
        alerts.push(createLifecycleTask('high', 'inspect', item, home));
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
    if (percentageThrough >= thresholds.inspect && percentageThrough < thresholds.replace) {
      alerts.push(createLifecycleTask('high', 'inspect', item, home));
    }
  });

  return alerts;
}

/**
 * Helper: creates a lifecycle alert task. 2026-05-18: now reads per-category
 * content from LIFECYCLE_CONTENT (with a generic fallback), and sets a
 * synthetic template_id so the engine's dedup key works.
 */
function createLifecycleTask(
  priority: TaskPriority,
  phase: LifecyclePhase,
  equipment: Equipment,
  home: Home
): MaintenanceTask {
  const content = getLifecycleContent(equipment.category, phase);
  return {
    id: generateUUID(),
    home_id: home.id,
    equipment_id: equipment.id,
    template_id: `lifecycle-${phase}-${equipment.category}`,
    title: content.title(equipment.name),
    description: content.description(equipment.name),
    instructions: content.instructions,
    category: equipment.category,
    priority,
    status: 'upcoming',
    frequency: 'as_needed',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    estimated_minutes: content.estimated_minutes,
    estimated_cost: content.estimated_cost_low,
    items_to_have_on_hand: content.items_to_have_on_hand,
    service_purpose: content.service_purpose,
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
      // Skip DB-only stub templates that lack applicable_months/title/category.
      Array.isArray(t.applicable_months) &&
      t.applicable_months.length > 0 &&
      !!t.title &&
      !!t.category &&
      (
        t.applicable_months.includes(month) ||
        t.applicable_months.includes(month === 12 ? 1 : month + 1) ||
        t.applicable_months.includes(month >= 11 ? month - 10 : month + 2)
      )
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
