// ═══════════════════════════════════════════════════════════════
// Weather Service — OpenWeatherMap Integration (Web)
// ═══════════════════════════════════════════════════════════════
import type { WeatherData, WeatherAlert } from '@/types';

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';
const BASE_URL = 'https://api.openweathermap.org/data/3.0';

export const fetchWeather = async (lat: number, lon: number): Promise<WeatherData> => {
  const response = await fetch(
    `${BASE_URL}/onecall?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`
  );
  if (!response.ok) throw new Error('Weather fetch failed');
  const data = await response.json();

  return {
    temperature: Math.round(data.current.temp),
    feels_like: Math.round(data.current.feels_like),
    humidity: data.current.humidity,
    wind_speed: Math.round(data.current.wind_speed),
    wind_gust: data.current.wind_gust ? Math.round(data.current.wind_gust) : undefined,
    description: data.current.weather[0].description,
    icon: data.current.weather[0].icon,
    high: Math.round(data.daily[0].temp.max),
    low: Math.round(data.daily[0].temp.min),
    alerts: (data.alerts || []).map(mapAlert),
    forecast: data.daily.slice(1, 8).map(mapForecast),
  };
};

const mapAlert = (alert: any): WeatherAlert => ({
  id: `${alert.event}-${alert.start}`,
  type: classifyAlertType(alert.event),
  severity: classifySeverity(alert.event),
  title: alert.event,
  description: alert.description,
  action_items: getActionItems(classifyAlertType(alert.event)),
  start_time: new Date(alert.start * 1000).toISOString(),
  end_time: new Date(alert.end * 1000).toISOString(),
  source: alert.sender_name,
});

const mapForecast = (day: any) => ({
  date: new Date(day.dt * 1000).toISOString(),
  high: Math.round(day.temp.max),
  low: Math.round(day.temp.min),
  description: day.weather[0].description,
  icon: day.weather[0].icon,
  precipitation_chance: Math.round((day.pop || 0) * 100),
});

const classifyAlertType = (event: string): WeatherAlert['type'] => {
  const lower = event.toLowerCase();
  if (lower.includes('freeze') || lower.includes('frost') || lower.includes('cold')) return 'freeze';
  if (lower.includes('wind')) return 'wind';
  if (lower.includes('hail')) return 'hail';
  if (lower.includes('heat')) return 'heat';
  if (lower.includes('tornado')) return 'tornado';
  if (lower.includes('flood')) return 'flood';
  return 'storm';
};

const classifySeverity = (event: string): WeatherAlert['severity'] => {
  const lower = event.toLowerCase();
  if (lower.includes('warning')) return 'warning';
  if (lower.includes('watch')) return 'watch';
  return 'advisory';
};

// ─── Action Items by Alert Type ───
// These are the specific "what to do" instructions shown to homeowners
export const getActionItems = (type: WeatherAlert['type']): string[] => {
  const actions: Record<string, string[]> = {
    freeze: [
      'Disconnect and drain all garden hoses',
      'Cover exposed hose bibs with insulated covers',
      'Open cabinet doors under sinks on exterior walls',
      'Let faucets drip slightly to prevent pipe freezing',
      'Set thermostat no lower than 55°F',
      'Check that attic insulation covers pipes',
      'Bring in potted plants and cover sensitive landscaping',
    ],
    wind: [
      'Secure patio furniture, grills, and decorations',
      'Close and latch all windows and exterior doors',
      'Trim any dead branches near your home',
      'Move vehicles into the garage if possible',
      'Check for loose shingles or siding after the storm',
      'Secure trash cans and recycling bins',
    ],
    hail: [
      'Move vehicles under cover or into the garage',
      'Close blinds and curtains to protect from broken glass',
      'Cover exposed outdoor equipment and AC condensers',
      'Stay away from windows and skylights during the storm',
      'Document any damage with photos for insurance',
      'Inspect roof, siding, and gutters after the storm passes',
    ],
    heat: [
      'Check that your AC filter is clean — replace if dirty',
      'Close blinds on sun-facing windows to reduce heat load',
      'Run ceiling fans counterclockwise for a cooling breeze',
      'Check your AC condenser — clear debris from around the unit',
      'Water lawn and plants early morning or late evening only',
      'Ensure attic ventilation is working properly',
    ],
    tornado: [
      'Move to your interior safe room or basement immediately',
      'Stay away from windows, doors, and exterior walls',
      'Cover yourself with blankets or a mattress',
      'After the storm: check for gas leaks and structural damage',
      'Document any damage with photos before cleanup',
      'Do not enter damaged buildings until cleared as safe',
    ],
    storm: [
      'Charge devices and flashlights in case of power outage',
      'Know the location of your breaker panel and main water shutoff',
      'Clear gutters and downspouts for proper drainage',
      'Secure outdoor furniture and loose items',
      'Check sump pump operation if you have a basement',
    ],
    flood: [
      'Move valuables to upper floors',
      'Do not walk or drive through floodwater',
      'Turn off utilities if instructed by authorities',
      'Check sump pump and ensure backup battery is charged',
      'Clear storm drains near your property if safe to do so',
      'Document water levels and damage for insurance',
    ],
  };
  return actions[type] || actions.storm;
};
