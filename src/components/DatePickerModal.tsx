import { useState } from 'react';
import { Colors } from '@/constants/theme';

interface DatePickerModalProps {
  title: string;
  message: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DatePickerModal({
  title,
  message,
  onConfirm,
  onCancel,
  isLoading = false,
}: DatePickerModalProps) {
  const [dateValue, setDateValue] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!dateValue) {
      setError('Please select a date');
      return;
    }
    // Validate YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateValue)) {
      setError('Invalid date format (use YYYY-MM-DD)');
      return;
    }
    onConfirm(dateValue);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-picker-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 28,
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="date-picker-modal-title"
          style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}
        >
          {title}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: Colors.medGray, lineHeight: 1.6 }}>
          {message}
        </p>

        <input
          type="date"
          value={dateValue}
          onChange={(e) => {
            setDateValue(e.target.value);
            setError('');
          }}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            border: error ? `2px solid ${Colors.error}` : `1px solid ${Colors.lightGray}`,
            fontSize: 14,
            marginBottom: error ? 8 : 20,
            boxSizing: 'border-box',
          }}
        />
        {error && (
          <p style={{ margin: '0 0 16px', fontSize: 12, color: Colors.error }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 8,
              border: `1px solid ${Colors.lightGray}`,
              background: '#f8f8f8',
              fontSize: 14,
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isLoading || !dateValue}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {isLoading ? '...' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
