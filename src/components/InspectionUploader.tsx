import { useState, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { parseHomeInspection, type InspectionTask } from '@/services/ai';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#C62828',
  high: '#E65100',
  medium: Colors.copper,
  low: Colors.sage,
};

const TIMEFRAME_LABELS: Record<string, string> = {
  immediately: 'Immediately',
  within_30_days: 'Within 30 days',
  within_3_months: 'Within 3 months',
  within_6_months: 'Within 6 months',
  within_1_year: 'Within 1 year',
  annual_maintenance: 'Annual maintenance',
};

function getDueDateFromTimeframe(timeframe: string): string {
  const now = new Date();
  switch (timeframe) {
    case 'immediately':
      return now.toISOString().split('T')[0];
    case 'within_30_days':
      now.setDate(now.getDate() + 30);
      return now.toISOString().split('T')[0];
    case 'within_3_months':
      now.setMonth(now.getMonth() + 3);
      return now.toISOString().split('T')[0];
    case 'within_6_months':
      now.setMonth(now.getMonth() + 6);
      return now.toISOString().split('T')[0];
    case 'within_1_year':
      now.setFullYear(now.getFullYear() + 1);
      return now.toISOString().split('T')[0];
    case 'annual_maintenance':
      now.setMonth(now.getMonth() + 6);
      return now.toISOString().split('T')[0];
    default:
      now.setMonth(now.getMonth() + 3);
      return now.toISOString().split('T')[0];
  }
}

interface Props {
  onTasksCreated?: (count: number) => void;
}

export default function InspectionUploader({ onTasksCreated }: Props) {
  const { home, setTasks } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [tasks, setLocalTasks] = useState<InspectionTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    setParsing(true);

    try {
      let documentText = '';
      let imageBase64: string | undefined;

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // For PDFs, we'll convert to text using FileReader
        // The edge function handles PDF parsing server-side
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        // Send as base64 image (the edge function can handle PDF base64)
        imageBase64 = base64;
        documentText = `[PDF document: ${file.name}]`;
      } else if (file.type.startsWith('image/')) {
        // Image file
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || result);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        imageBase64 = base64;
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        documentText = await file.text();
      } else {
        // Try reading as text
        try {
          documentText = await file.text();
        } catch {
          throw new Error('Unsupported file format. Please upload a PDF, image, or text file.');
        }
      }

      const result = await parseHomeInspection(documentText, imageBase64);

      setLocalTasks(result);
      // Select all by default
      setSelectedTasks(new Set(result.map((_, i) => i)));
      setStep('review');
    } catch (err: any) {
      console.error('Error parsing inspection:', err);
      setError(err.message || 'Failed to parse inspection document');
    } finally {
      setParsing(false);
    }
  };

  const toggleTask = (index: number) => {
    const next = new Set(selectedTasks);
    next.has(index) ? next.delete(index) : next.add(index);
    setSelectedTasks(next);
  };

  const selectAll = () => setSelectedTasks(new Set(tasks.map((_, i) => i)));
  const selectNone = () => setSelectedTasks(new Set());

  const handleCreateTasks = async () => {
    if (!home || selectedTasks.size === 0) return;

    setSaving(true);
    try {
      const tasksToInsert = Array.from(selectedTasks).map(index => {
        const task = tasks[index];
        return {
          home_id: home.id,
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          status: 'upcoming' as const,
          due_date: getDueDateFromTimeframe(task.recommended_timeframe),
          estimated_cost: task.estimated_cost,
          notes: `From home inspection: ${task.inspection_section}`,
          frequency: 'once' as const,
        };
      });

      const { data: created, error: insertError } = await supabase
        .from('maintenance_tasks')
        .insert(tasksToInsert)
        .select();

      if (insertError) throw insertError;

      if (created) {
        // Update store with new tasks
        const { tasks: existingTasks } = useStore.getState();
        setTasks([...existingTasks, ...created]);
      }

      setStep('done');
      onTasksCreated?.(selectedTasks.size);
    } catch (err: any) {
      console.error('Error creating tasks:', err);
      setError(err.message || 'Failed to create tasks');
    } finally {
      setSaving(false);
    }
  };

  // Group tasks by section for display
  const groupedTasks = tasks.reduce((acc, task, index) => {
    const section = task.inspection_section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push({ task, index });
    return acc;
  }, {} as Record<string, { task: InspectionTask; index: number }[]>);

  // Upload step
  if (step === 'upload') {
    return (
      <div>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${Colors.copperLight}`,
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            cursor: 'pointer',
            background: parsing ? '#f5f5f5' : Colors.copperMuted,
            transition: 'all 0.2s ease',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {parsing ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#128270;</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: Colors.charcoal }}>
                Analyzing inspection report...
              </p>
              <p style={{ fontSize: 13, color: Colors.medGray, marginTop: 4 }}>
                {fileName}
              </p>
              <p style={{ fontSize: 13, color: Colors.medGray }}>
                AI is reading and extracting maintenance items. This may take a moment.
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#128196;</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: Colors.copper }}>
                Upload Home Inspection Report
              </p>
              <p style={{ fontSize: 13, color: Colors.medGray, marginTop: 4 }}>
                PDF, images, or text files accepted
              </p>
              <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12 }}>
                Our AI will read the inspection and create maintenance tasks based on the recommendations.
              </p>
            </>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#E5393520',
            color: '#C62828',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Review step
  if (step === 'review') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {tasks.length} item{tasks.length !== 1 ? 's' : ''} found
            </h3>
            <p style={{ fontSize: 13, color: Colors.medGray, margin: '4px 0 0 0' }}>
              {selectedTasks.size} selected for scheduling
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={selectAll}>Select All</button>
            <button className="btn btn-ghost btn-sm" onClick={selectNone}>Select None</button>
          </div>
        </div>

        {Object.entries(groupedTasks).map(([section, items]) => (
          <div key={section} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: Colors.medGray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {section}
            </p>
            {items.map(({ task, index }) => (
              <div
                key={index}
                onClick={() => toggleTask(index)}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 4,
                  cursor: 'pointer',
                  background: selectedTasks.has(index) ? '#fff' : '#f9f9f7',
                  border: `1px solid ${selectedTasks.has(index) ? Colors.copper : Colors.lightGray}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTasks.has(index)}
                  onChange={() => toggleTask(index)}
                  style={{ marginTop: 2, accentColor: Colors.copper }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{task.title}</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: `${PRIORITY_COLORS[task.priority]}15`,
                      color: PRIORITY_COLORS[task.priority],
                    }}>
                      {task.priority}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 4px 0', lineHeight: 1.4 }}>
                    {task.description}
                  </p>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: Colors.medGray }}>
                    <span>{TIMEFRAME_LABELS[task.recommended_timeframe] || task.recommended_timeframe}</span>
                    {task.estimated_cost > 0 && <span>~${task.estimated_cost}</span>}
                    <span>{task.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: '#E5393520',
            color: '#C62828',
            fontSize: 13,
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={() => { setStep('upload'); setLocalTasks([]); }}>
            Upload Different File
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreateTasks}
            disabled={saving || selectedTasks.size === 0}
          >
            {saving ? 'Creating tasks...' : `Schedule ${selectedTasks.size} Task${selectedTasks.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    );
  }

  // Done step
  return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        background: `${Colors.sage}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        fontSize: 28,
      }}>
        &#10003;
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Tasks Scheduled!</h3>
      <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 24 }}>
        {selectedTasks.size} maintenance task{selectedTasks.size !== 1 ? 's' : ''} from your home inspection
        {selectedTasks.size !== 1 ? ' have' : ' has'} been added to your calendar.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn btn-ghost" onClick={() => { setStep('upload'); setLocalTasks([]); setSelectedTasks(new Set()); }}>
          Upload Another
        </button>
      </div>
    </div>
  );
}
