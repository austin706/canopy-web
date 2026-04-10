import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { fetchWeather } from '@/services/weather';
import { canAccess } from '@/services/subscriptionGate';
import { Colors, StatusColors } from '@/constants/theme';
import type { WeatherData, DayForecast, WeatherAlert } from '@/types';
import { getErrorMessage } from '@/utils/errors';

const DEMO_WEATHER: WeatherData = {
  temperature: 72,
  feels_like: 74,
  humidity: 55,
  wind_speed: 8,
  description: 'partly cloudy',
  icon: '02d',
  high: 78,
  low: 58,
  alerts: [],
  forecast: [
    { date: new Date().toISOString(), high: 78, low: 58, description: 'partly cloudy', icon: '02d', precipitation_chance: 10 },
    { date: new Date(Date.now() + 86400000).toISOString(), high: 75, low: 56, description: 'cloudy', icon: '04d', precipitation_chance: 20 },
    { date: new Date(Date.now() + 2*86400000).toISOString(), high: 70, low: 54, description: 'rainy', icon: '10d', precipitation_chance: 60 },
  ],
};

export default function Weather() {
  const navigate = useNavigate();
  const { user, home, weather } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [displayWeather, setDisplayWeather] = useState<WeatherData>(weather || DEMO_WEATHER);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const tier = user?.subscription_tier || 'free';
  const hasWeather = canAccess(tier, 'weather_alerts');

  useEffect(() => {
    if (!hasWeather || !home?.latitude || !home?.longitude) return;

    const loadWeather = async () => {
      setLoading(true);
      try {
        const data = await fetchWeather(home.latitude!, home.longitude!);
        setDisplayWeather(data);
      } catch (e: any) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };

    loadWeather();
  }, [hasWeather, home]);

  if (!hasWeather) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Weather Alerts</h1></div>
        <div className="card" style={{ background: 'var(--color-copper-muted, #FFF3E0)', borderLeft: `4px solid var(--color-copper, #C4844E)` }}>
          <div className="flex items-center gap-md">
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--color-card-background, #FFFFFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--color-sage, #8B9E7E)' }}>WX</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600 }}>Weather Alerts Locked</p>
              <p className="text-sm text-gray">Upgrade to Home to get actionable weather alerts with maintenance tips</p>
            </div>
          </div>
          <button className="btn btn-primary mt-md" onClick={() => navigate('/subscription')}>Upgrade to Home</button>
        </div>
      </div>
    );
  }

  const visibleAlerts = displayWeather.alerts.filter(a => !dismissedAlerts.has(a.id));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Weather Alerts</h1>
          <p className="text-sm text-gray mt-sm">{home?.city ? `${home.city}${home.state ? `, ${home.state}` : ''}` : home?.state || home?.zip_code || 'Your location'}</p>
        </div>
      </div>

      {error && <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--color-error, #E5393520)', color: 'var(--color-error, #E53935)', fontSize: 14, marginBottom: 16 }}>Error: {error}</div>}

      <div className="flex-col gap-lg">
        {/* Current Weather Card */}
        <div className="card" style={{ background: `linear-gradient(135deg, var(--color-sage, #8B9E7E)20, var(--color-cream, #F5F0E8))` }}>
          <div className="flex items-center justify-between mb-md">
            <div>
              <p className="text-sm fw-600 text-gray">Current Conditions</p>
              <p style={{ fontSize: 42, fontWeight: 700 }}>{displayWeather.temperature}&#176;F</p>
              <p className="text-sm text-gray" style={{ textTransform: 'capitalize', marginTop: 4 }}>{displayWeather.description}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-sage, #8B9E7E)' }}>WX</p>
              <p className="text-sm text-gray mt-md">H: {displayWeather.high}&#176; L: {displayWeather.low}&#176;</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border, #E8E2D8)' }}>
            <div style={{ textAlign: 'center' }}>
              <p className="text-xs text-gray fw-600">Feels Like</p>
              <p style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{displayWeather.feels_like}&#176;</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p className="text-xs text-gray fw-600">Humidity</p>
              <p style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{displayWeather.humidity}%</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p className="text-xs text-gray fw-600">Wind</p>
              <p style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{displayWeather.wind_speed} mph</p>
            </div>
          </div>

          {displayWeather.wind_gust && (
            <p className="text-sm text-gray mt-sm" style={{ textAlign: 'center' }}>Gust: {displayWeather.wind_gust} mph</p>
          )}
        </div>

        {/* Alerts Section */}
        {visibleAlerts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-md">
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Active Alerts</h2>
              <span className="badge" style={{ background: 'var(--color-error, #E53935)20', color: 'var(--color-error, #E53935)', fontWeight: 600 }}>{visibleAlerts.length}</span>
            </div>
            <div className="flex-col gap-md">
              {visibleAlerts.map(alert => (
                <div key={alert.id} className="card" style={{ borderLeft: `4px solid var(--color-error, #E53935)`, padding: '16px 20px' }}>
                  <div className="flex items-start justify-between mb-md">
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{alert.title}</p>
                      <p className="text-xs text-gray mt-sm">{alert.type.toUpperCase()} • {alert.severity.toUpperCase()}</p>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.id]))}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm text-gray mb-md">{alert.description}</p>

                  {alert.action_items.length > 0 && (
                    <div style={{ background: 'var(--color-cream, #F5F0E8)', borderRadius: 8, padding: 12, marginTop: 12 }}>
                      <p className="text-xs fw-600 text-copper mb-sm">What To Do</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {alert.action_items.slice(0, 4).map((item) => (
                          <li key={item} className="flex gap-sm items-start" style={{ marginBottom: 6, fontSize: 13 }}>
                            <span style={{ color: 'var(--color-sage, #8B9E7E)', fontWeight: 600, flexShrink: 0 }}>✓</span>
                            <span className="text-gray">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {visibleAlerts.length === 0 && (
          <div className="empty-state" style={{ padding: 48 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--color-success, #4CAF50)', marginBottom: 12 }}>&#10003;</div>
            <h3 style={{ marginBottom: 6 }}>All Clear</h3>
            <p className="text-gray">No active weather alerts for your area.</p>
          </div>
        )}

        {/* 7-Day Forecast */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>7-Day Forecast</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            {displayWeather.forecast.map((day) => (
              <div key={day.date} className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
                <p className="text-xs text-gray fw-600">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p style={{ fontSize: 28, margin: '4px 0' }} title={day.description}>{
                  { '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️', '03d': '☁️', '03n': '☁️',
                    '04d': '☁️', '04n': '☁️', '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌧️',
                    '11d': '⛈️', '11n': '⛈️', '13d': '❄️', '13n': '❄️', '50d': '🌫️', '50n': '🌫️'
                  }[day.icon] || '🌤️'
                }</p>
                <p style={{ fontSize: 14, fontWeight: 600 }}>{day.high}&#176;</p>
                <p className="text-xs text-gray">{day.low}&#176;</p>
                {day.precipitation_chance > 0 && (
                  <p className="text-xs text-gray mt-sm">{day.precipitation_chance}% precip</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance Tips */}
        <div className="card" style={{ background: 'var(--color-copper-muted, #FFF3E0)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-copper, #C4844E)', marginBottom: 12 }}>Weather-Based Maintenance</h3>
          <p className="text-sm text-gray">
            Current weather conditions may affect your scheduled maintenance. Check the action items in any active alerts for specific tasks to protect your home.
          </p>
          <button className="btn btn-primary btn-sm mt-md" onClick={() => navigate('/calendar')}>View Maintenance Calendar</button>
        </div>
      </div>
    </div>
  );
}
