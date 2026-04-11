// ═══════════════════════════════════════════════════════════════
// Weather Insight Cards Component
// ═══════════════════════════════════════════════════════════════
// Displays actionable weather insights with dismissal (24hr localStorage)

import { useEffect, useState } from 'react';
import { Colors } from '@/constants/theme';
import type { WeatherInsight } from '@/services/weatherInsights';
import logger from '@/utils/logger';
import './WeatherInsightCards.css';

interface Props {
  insights: WeatherInsight[];
}

const DISMISS_STORAGE_KEY = 'dismissed_weather_insights';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DismissedInsight {
  id: string;
  dismissedAt: number;
}

export function WeatherInsightCards({ insights }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Load dismissed insights on mount
  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (stored) {
      try {
        const items: DismissedInsight[] = JSON.parse(stored);
        const now = Date.now();
        const activeDismissals = items
          .filter(item => now - item.dismissedAt < DISMISS_DURATION_MS)
          .map(item => item.id);

        setDismissed(new Set(activeDismissals));

        // Clean up expired dismissals
        if (activeDismissals.length !== items.length) {
          localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(
            items.filter(item => now - item.dismissedAt < DISMISS_DURATION_MS)
          ));
        }
      } catch (e) {
        logger.warn('Failed to parse dismissed insights:', e);
      }
    }
  }, []);

  const handleDismiss = (id: string) => {
    const updatedDismissed = new Set(dismissed);
    updatedDismissed.add(id);
    setDismissed(updatedDismissed);

    // Persist to localStorage
    const stored = localStorage.getItem(DISMISS_STORAGE_KEY) || '[]';
    try {
      const items: DismissedInsight[] = JSON.parse(stored);
      items.push({ id, dismissedAt: Date.now() });
      localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      logger.warn('Failed to save dismissed insights:', e);
    }
  };

  const visibleInsights = insights.filter(i => !dismissed.has(i.id));

  if (visibleInsights.length === 0) {
    return null;
  }

  const urgencyColor = {
    high: Colors.error,      // soft red
    medium: Colors.warning,  // amber
    low: Colors.sage,        // sage green
  };

  return (
    <div className="weather-insights-container">
      <h3 className="weather-insights-title">Weather Insights</h3>
      <div className="weather-insights-grid">
        {visibleInsights.map(insight => (
          <div
            key={insight.id}
            className="weather-insight-card"
            style={{ borderLeftColor: urgencyColor[insight.urgency] }}
          >
            {/* Header: icon + title + dismiss */}
            <div className="insight-header">
              <div className="insight-icon-title">
                <span className="insight-icon">{insight.icon}</span>
                <h4 className="insight-title">{insight.title}</h4>
              </div>
              <button
                className="insight-dismiss-btn"
                onClick={() => handleDismiss(insight.id)}
                aria-label="Dismiss"
                title="Dismiss for 24 hours"
              >
                ✕
              </button>
            </div>

            {/* Description (one line) */}
            <p className="insight-description">{insight.description}</p>

            {/* Affected tasks (if any) */}
            {insight.affectedTasks.length > 0 && (
              <div className="insight-tasks">
                <p className="insight-tasks-label">Affected tasks:</p>
                <ul className="insight-tasks-list">
                  {insight.affectedTasks.map(task => (
                    <li key={task.id}>{task.title}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested action */}
            <p className="insight-action">
              <strong>Action:</strong> {insight.suggestedAction}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
