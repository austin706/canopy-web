// ═══════════════════════════════════════════════════════════════
// Weather Insights Engine — Smart Weather-to-Task Scheduling
// ═══════════════════════════════════════════════════════════════
// Generates actionable insight cards by cross-referencing 7-day
// forecast with upcoming outdoor tasks. Pure function, no API calls.

import type { DayForecast, MaintenanceTask } from '@/types';

export interface WeatherInsight {
  id: string;
  type: 'rain_coming' | 'nice_weather' | 'freeze_warning' | 'heat_advisory' | 'high_wind' | 'snow_ice';
  title: string;
  description: string;
  affectedTasks: { id: string; title: string }[];
  suggestedAction: string;
  urgency: 'low' | 'medium' | 'high';
  forecastDay: string; // ISO date string
  icon: string; // emoji
}

/**
 * Outdoor task categories that are affected by weather
 */
const OUTDOOR_CATEGORIES = ['lawn', 'outdoor', 'deck', 'pool', 'seasonal', 'pest_control'];

/**
 * Outdoor keywords to filter general tasks (e.g., "gutter", "roof", "exterior")
 */
const OUTDOOR_KEYWORDS = ['gutter', 'roof', 'exterior', 'driveway', 'fence', 'siding', 'pressure wash', 'patio', 'deck', 'outdoor', 'lawn', 'pool', 'sprinkler', 'hose', 'walkway', 'concrete', 'asphalt'];

/**
 * Determines if a task is outdoor and affected by weather
 */
function isOutdoorTask(task: MaintenanceTask): boolean {
  const category = task.category as string;

  // Check if category is in outdoor categories
  if (OUTDOOR_CATEGORIES.includes(category)) {
    return true;
  }

  // For 'general' tasks, check title/description for outdoor keywords
  if (category === 'general') {
    const text = `${task.title} ${task.description || ''}`.toLowerCase();
    return OUTDOOR_KEYWORDS.some(keyword => text.includes(keyword));
  }

  return false;
}

/**
 * Filters tasks to outdoor, due/upcoming only
 */
function getRelevantOutdoorTasks(tasks: MaintenanceTask[]): MaintenanceTask[] {
  return tasks.filter(task => {
    // Must be outdoor
    if (!isOutdoorTask(task)) return false;

    // Must be due or upcoming (not completed/skipped)
    if (task.status === 'completed' || task.status === 'skipped') return false;

    return true;
  });
}

/**
 * Gets tasks due within a specific number of days
 */
function getTasksDueWithin(tasks: MaintenanceTask[], days: number): MaintenanceTask[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);

  return tasks.filter(task => {
    const dueDate = new Date(task.due_date);
    return dueDate <= cutoff && dueDate >= today;
  });
}

/**
 * Gets forecast days within a specific number of days
 */
function getForecastDaysWithin(forecast: DayForecast[], days: number): DayForecast[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);

  return forecast.filter(day => {
    const forecastDate = new Date(day.date);
    return forecastDate <= cutoff && forecastDate > today;
  });
}

/**
 * Checks if there's rain in the forecast (codes: 09*, 10*)
 */
function hasRainInForecast(forecast: DayForecast[]): DayForecast | undefined {
  return forecast.find(day => {
    const icon = day.icon;
    // 09d/09n = shower rain, 10d/10n = rain
    return icon.startsWith('09') || icon.startsWith('10');
  });
}

/**
 * Checks for freeze conditions (low ≤ 32°F)
 */
function hasFreezeWarning(forecast: DayForecast[]): DayForecast | undefined {
  return forecast.find(day => day.low <= 32);
}

/**
 * Checks for heat advisory (high ≥ 95°F)
 */
function hasHeatAdvisory(forecast: DayForecast[]): DayForecast | undefined {
  return forecast.find(day => day.high >= 95);
}

/**
 * Checks for high wind (> 25 mph in description)
 * Note: Wind speed not in DayForecast, so check description for wind keywords
 */
function hasHighWind(forecast: DayForecast[]): DayForecast | undefined {
  return forecast.find(day => {
    const desc = day.description.toLowerCase();
    return desc.includes('windy') || desc.includes('strong wind') || desc.includes('high wind');
  });
}

/**
 * Checks for snow/ice (codes: 13*, 50*)
 */
function hasSnowOrIce(forecast: DayForecast[]): DayForecast | undefined {
  return forecast.find(day => {
    const icon = day.icon;
    // 13d/13n = snow, 50d/50n = mist/fog (but also includes sleet/ice)
    return icon.startsWith('13') || (icon.startsWith('50') && day.description.toLowerCase().includes('snow'));
  });
}

/**
 * Checks for 3+ consecutive dry days with 50-85°F
 */
function hasNiceWeatherWindow(forecast: DayForecast[]): { start: DayForecast; count: number } | undefined {
  for (let i = 0; i < forecast.length - 2; i++) {
    const day1 = forecast[i];
    const day2 = forecast[i + 1];
    const day3 = forecast[i + 2];

    const isDry1 = day1.precipitation_chance <= 20 && !day1.icon.startsWith('09') && !day1.icon.startsWith('10');
    const isDry2 = day2.precipitation_chance <= 20 && !day2.icon.startsWith('09') && !day2.icon.startsWith('10');
    const isDry3 = day3.precipitation_chance <= 20 && !day3.icon.startsWith('09') && !day3.icon.startsWith('10');

    const inRange1 = day1.high >= 50 && day1.high <= 85;
    const inRange2 = day2.high >= 50 && day2.high <= 85;
    const inRange3 = day3.high >= 50 && day3.high <= 85;

    if (isDry1 && isDry2 && isDry3 && inRange1 && inRange2 && inRange3) {
      return { start: day1, count: 3 };
    }
  }

  return undefined;
}

/**
 * Main function: generates weather insights from forecast and tasks
 * Pure function — no side effects or external calls
 */
export function generateWeatherInsights(
  forecast: DayForecast[],
  tasks: MaintenanceTask[]
): WeatherInsight[] {
  const insights: WeatherInsight[] = [];
  const relevantTasks = getRelevantOutdoorTasks(tasks);

  if (relevantTasks.length === 0 || forecast.length === 0) {
    return [];
  }

  // Get upcoming tasks (due within 7 days)
  const upcomingTasks = getTasksDueWithin(relevantTasks, 7);
  const next3Days = getForecastDaysWithin(forecast, 3);
  const next7Days = getForecastDaysWithin(forecast, 7);

  // ─── Rain Coming ───
  const rainDay = hasRainInForecast(next3Days);
  if (rainDay && upcomingTasks.length > 0) {
    const affectedTasks = upcomingTasks.filter(task => {
      const taskDate = new Date(task.due_date);
      const rainDate = new Date(rainDay.date);
      return taskDate < rainDate;
    });

    if (affectedTasks.length > 0) {
      const rainDateObj = new Date(rainDay.date);
      const dayName = rainDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      insights.push({
        id: 'rain-coming',
        type: 'rain_coming',
        title: 'Rain Coming',
        description: `Rain expected ${dayName}. Complete outdoor tasks before then.`,
        affectedTasks: affectedTasks.slice(0, 3).map(t => ({ id: t.id, title: t.title })),
        suggestedAction: `Do ${affectedTasks[0].title} and outdoor work before ${dayName}`,
        urgency: 'high',
        forecastDay: rainDay.date,
        icon: '🌧️',
      });
    }
  }

  // ─── Nice Weather Window ───
  const niceWindow = hasNiceWeatherWindow(next7Days);
  if (niceWindow && upcomingTasks.length > 0) {
    const windowStart = new Date(niceWindow.start.date);
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + niceWindow.count - 1);

    const startName = windowStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const endName = windowEnd.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

    insights.push({
      id: 'nice-weather',
      type: 'nice_weather',
      title: 'Great Weather Window',
      description: `${niceWindow.count}+ days of ideal outdoor weather (50-85°F, dry). Perfect for outdoor projects.`,
      affectedTasks: upcomingTasks.slice(0, 3).map(t => ({ id: t.id, title: t.title })),
      suggestedAction: `Schedule outdoor projects for ${startName} – ${endName}`,
      urgency: 'low',
      forecastDay: niceWindow.start.date,
      icon: '☀️',
    });
  }

  // ─── Freeze Warning ───
  const freezeDay = hasFreezeWarning(next7Days);
  if (freezeDay) {
    const freezeDateObj = new Date(freezeDay.date);
    const dayName = freezeDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    insights.push({
      id: 'freeze-warning',
      type: 'freeze_warning',
      title: 'Freeze Expected',
      description: `Low of ${freezeDay.low}°F on ${dayName}. Protect pipes, plants, and winterize outdoor equipment.`,
      affectedTasks: [],
      suggestedAction: 'Disconnect and drain garden hoses, cover hose bibs, bring in potted plants',
      urgency: 'high',
      forecastDay: freezeDay.date,
      icon: '❄️',
    });
  }

  // ─── Heat Advisory ───
  const heatDay = hasHeatAdvisory(next7Days);
  if (heatDay) {
    const heatDateObj = new Date(heatDay.date);
    const dayName = heatDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    insights.push({
      id: 'heat-advisory',
      type: 'heat_advisory',
      title: 'Extreme Heat',
      description: `High of ${heatDay.high}°F on ${dayName}. Check AC, run sprinklers early, avoid strenuous outdoor work.`,
      affectedTasks: [],
      suggestedAction: 'Check AC filter, ensure condenser is clear, water lawn early morning or late evening',
      urgency: 'medium',
      forecastDay: heatDay.date,
      icon: '🌡️',
    });
  }

  // ─── High Wind ───
  const windDay = hasHighWind(next7Days);
  if (windDay) {
    const windDateObj = new Date(windDay.date);
    const dayName = windDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    insights.push({
      id: 'high-wind',
      type: 'high_wind',
      title: 'High Winds',
      description: `Strong winds expected ${dayName}. Secure outdoor items and inspect roof/gutters after.`,
      affectedTasks: [],
      suggestedAction: 'Secure patio furniture, check gutters after wind passes',
      urgency: 'medium',
      forecastDay: windDay.date,
      icon: '💨',
    });
  }

  // ─── Snow/Ice ───
  const snowDay = hasSnowOrIce(next7Days);
  if (snowDay) {
    const snowDateObj = new Date(snowDay.date);
    const dayName = snowDateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    insights.push({
      id: 'snow-ice',
      type: 'snow_ice',
      title: 'Snow Expected',
      description: `Snow or ice predicted for ${dayName}. Check roof integrity and clear walkways.`,
      affectedTasks: [],
      suggestedAction: 'Inspect roof for snow load capacity, clear gutters, have snow removal plan ready',
      urgency: 'high',
      forecastDay: snowDay.date,
      icon: '❄️',
    });
  }

  // ─── Sort and consolidate ───
  // Remove duplicates (e.g., multiple freeze/heat warnings → keep first)
  const seen = new Set<WeatherInsight['type']>();
  const unique = insights.filter(i => {
    if (seen.has(i.type)) return false;
    seen.add(i.type);
    return true;
  });

  // Sort by urgency (high → medium → low) then by date
  unique.sort((a, b) => {
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return new Date(a.forecastDay).getTime() - new Date(b.forecastDay).getTime();
  });

  // Cap at 4 insights
  return unique.slice(0, 4);
}
