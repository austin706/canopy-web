// ═══════════════════════════════════════════════════════════════
// Weather Insights Engine — Smart Weather-to-Task Scheduling
// ═══════════════════════════════════════════════════════════════
// Generates actionable insight cards by cross-referencing 7-day
// forecast with upcoming outdoor tasks. Pure function, no API calls.
//
// 2026-05-19: also accepts NWS alerts. NWS-issued warnings/watches/advisories
// are authoritative and should override our forecast-icon heuristics. A
// freeze warning from NWS beats us inferring 'freeze' from forecast.low<=32.

import type { DayForecast, MaintenanceTask, WeatherAlert } from '@/types';

export interface WeatherInsight {
  id: string;
  type: 'rain_coming' | 'nice_weather' | 'freeze_warning' | 'heat_advisory' | 'high_wind' | 'snow_ice' | 'tornado' | 'flood' | 'fire' | 'storm';
  title: string;
  description: string;
  affectedTasks: { id: string; title: string }[];
  suggestedAction: string;
  urgency: 'low' | 'medium' | 'high';
  forecastDay: string; // ISO date string
  icon: string; // emoji
  /** Set when this insight came from an NWS alert (authoritative). */
  source?: 'nws' | 'forecast';
  /** NWS alert ID, for click-through linkage. Only set when source='nws'. */
  alertId?: string;
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

/** Map NWS alert types onto our insight types for visual consistency. */
function alertTypeToInsight(t: WeatherAlert['type']): WeatherInsight['type'] {
  switch (t) {
    case 'freeze': return 'freeze_warning';
    case 'heat': return 'heat_advisory';
    case 'wind': return 'high_wind';
    case 'hail': return 'storm';
    case 'storm': return 'storm';
    case 'tornado': return 'tornado';
    case 'flood': return 'flood';
    case 'fire': return 'fire';
  }
}

/** Map NWS severity onto our urgency scale. Warnings = high, watches = medium,
 *  advisories = low. */
function severityToUrgency(s: WeatherAlert['severity']): WeatherInsight['urgency'] {
  return s === 'warning' ? 'high' : s === 'watch' ? 'medium' : 'low';
}

const ALERT_ICONS: Record<WeatherAlert['type'], string> = {
  freeze: '❄️',
  wind: '💨',
  hail: '🧊',
  heat: '🌡️',
  storm: '⛈️',
  tornado: '🌪️',
  flood: '🌊',
  fire: '🔥',
};

/** Convert an NWS alert into an insight card. Used when alerts[] is provided
 *  alongside forecast[]. */
function alertToInsight(alert: WeatherAlert): WeatherInsight {
  return {
    id: `nws-${alert.id}`,
    type: alertTypeToInsight(alert.type),
    title: alert.title || `${alert.type[0].toUpperCase()}${alert.type.slice(1)} ${alert.severity}`,
    description:
      alert.description?.slice(0, 240) ||
      `${alert.severity.toUpperCase()}: ${alert.type} alert from ${alert.source}.`,
    affectedTasks: [],
    suggestedAction: alert.action_items?.[0] || 'Check the weather page for full action items.',
    urgency: severityToUrgency(alert.severity),
    forecastDay: alert.start_time || new Date().toISOString(),
    icon: ALERT_ICONS[alert.type] || '⚠️',
    source: 'nws',
    alertId: alert.id,
  };
}

/**
 * Main function: generates weather insights from forecast, alerts, and tasks.
 * Pure function — no side effects or external calls.
 *
 * `alerts` is optional for backward compatibility with callers that only have
 * forecast data. When provided, NWS alerts are merged in first and their
 * types are used to suppress forecast-derived heuristics of the same type
 * (e.g. NWS Freeze Warning → suppress our forecast.low<=32 inference).
 */
export function generateWeatherInsights(
  forecast: DayForecast[],
  tasks: MaintenanceTask[],
  alerts: WeatherAlert[] = []
): WeatherInsight[] {
  const insights: WeatherInsight[] = [];
  const relevantTasks = getRelevantOutdoorTasks(tasks);

  // 2026-05-19: when NWS has authoritative alerts, surface them even if the
  // user has no outdoor tasks — a tornado warning is relevant regardless.
  if (alerts.length > 0) {
    for (const a of alerts) insights.push(alertToInsight(a));
  }

  if (forecast.length === 0) {
    return finalizeInsights(insights);
  }
  if (relevantTasks.length === 0 && alerts.length === 0) {
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

  return finalizeInsights(insights);
}

/** Sort + dedup + cap. NWS-sourced insights always win over forecast-derived
 *  insights of the same type. */
function finalizeInsights(insights: WeatherInsight[]): WeatherInsight[] {
  // Dedup by type, preferring source='nws' (authoritative). If two NWS alerts
  // share a type we keep the more severe one.
  const urgencyOrder = { high: 0, medium: 1, low: 2 } as const;
  const byType = new Map<WeatherInsight['type'], WeatherInsight>();
  for (const i of insights) {
    const existing = byType.get(i.type);
    if (!existing) { byType.set(i.type, i); continue; }
    // Prefer NWS over forecast
    if (i.source === 'nws' && existing.source !== 'nws') { byType.set(i.type, i); continue; }
    if (existing.source === 'nws' && i.source !== 'nws') continue;
    // Same source — prefer higher urgency
    if (urgencyOrder[i.urgency] < urgencyOrder[existing.urgency]) byType.set(i.type, i);
  }

  const unique = Array.from(byType.values());

  // Sort by urgency (high → medium → low) then by date
  unique.sort((a, b) => {
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return new Date(a.forecastDay).getTime() - new Date(b.forecastDay).getTime();
  });

  // Cap at 4 insights
  return unique.slice(0, 4);
}
