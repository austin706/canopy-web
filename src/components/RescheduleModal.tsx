import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { createTask } from '@/services/supabase';
import { format, addDays } from 'date-fns';
import { generateUUID } from '@/services/utils';
import type { MaintenanceTask } from '@/types';

const SUGGESTED_INTERVALS = [
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: '2 years', days: 730 },
  { label: '3 years', days: 1095 },
];

/**
 * Modal shown after completing an as_needed task.
 * Suggests a timeline for the next occurrence and lets the user confirm or decline.
 */
export default function RescheduleModal() {
  const { pendingReschedule, setPendingReschedule, addTask } = useStore();
  const [customDays, setCustomDays] = useState('');
  const [saving, setSaving] = useState(false);

  if (!pendingReschedule) return null;

  const scheduleNext = async (days: number) => {
    setSaving(true);
    try {
      const nextDueDate = addDays(new Date(), days);
      const nextTask: MaintenanceTask = {
        ...pendingReschedule,
        id: generateUUID(),
        status: 'upcoming',
        due_date: format(nextDueDate, 'yyyy-MM-dd'),
        completed_date: undefined,
        completed_by: undefined,
        completion_photo_url: undefined,
        completion_notes: undefined,
        created_at: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
      };

      addTask(nextTask);
      try { await createTask(nextTask); } catch { /* best effort */ }
      setPendingReschedule(null);
    } finally {
      setSaving(false);
    }
  };

  const dismiss = () => setPendingReschedule(null);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
    }} onClick={dismiss}>
      <div
        style={{
          background: '#fff', borderRadius: 16, padding: 28,
          maxWidth: 420, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700 }}>
          Schedule Next?
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#666', lineHeight: 1.5 }}>
          You completed <strong>{pendingReschedule.title}</strong>. When would you like to do this again?
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {SUGGESTED_INTERVALS.map(({ label, days }) => (
            <button
              key={days}
              disabled={saving}
              onClick={() => scheduleNext(days)}
              style={{
                padding: '8px 16px', borderRadius: 8,
                border: '1px solid #ddd', background: '#f8f8f8',
                fontSize: 14, cursor: 'pointer', fontWeight: 500,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <input
            type="number"
            placeholder="Custom days"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              border: '1px solid #ddd', fontSize: 14,
            }}
          />
          <button
            disabled={!customDays || saving}
            onClick={() => scheduleNext(parseInt(customDays))}
            className="btn btn-primary btn-sm"
          >
            Set
          </button>
        </div>

        <button
          onClick={dismiss}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 8,
            border: 'none', background: 'transparent',
            fontSize: 14, color: '#999', cursor: 'pointer',
          }}
        >
          No thanks, I'll decide later
        </button>
      </div>
    </div>
  );
}
