import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors } from '@/constants/theme';
import { useStore } from '@/store/useStore';
import { createTask } from '@/services/supabase';
import { canAccess, getTaskLimit } from '@/services/subscriptionGate';
import type { MaintenanceTask, EquipmentCategory, TaskPriority, TaskFrequency } from '@/types';
import { getErrorMessage } from '@/utils/errors';

type Category = EquipmentCategory | 'general' | 'lawn' | 'pool' | 'deck' | 'seasonal' | 'pest_control' | 'fireplace';

const CATEGORIES: Category[] = [
  'hvac', 'water_heater', 'plumbing', 'electrical', 'appliance',
  'outdoor', 'safety', 'garage', 'filter', 'general', 'lawn', 'pool', 'deck', 'seasonal', 'pest_control', 'fireplace'
];

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
const FREQUENCIES: TaskFrequency[] = ['weekly', 'monthly', 'quarterly', 'semi_annual', 'biannual', 'seasonal', 'annual', 'as_needed'];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: Colors.error,
  high: Colors.copper,
  medium: Colors.sage,
  low: Colors.silver,
};

export default function CreateTask() {
  const navigate = useNavigate();
  const { user, home, tasks: existingTasks, setTasks, equipment } = useStore();
  const tier = user?.subscription_tier || 'free';
  const taskLimit = getTaskLimit(tier);

  // Gate: custom tasks require Home tier or higher
  if (!canAccess(tier, 'custom_tasks')) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Create Custom Task</h1></div>
        <div className="card text-center" style={{ padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: Colors.copperMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700, fontSize: 20, color: Colors.copper }}>+</div>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Custom Tasks Locked</h2>
          <p className="text-gray mb-lg">Upgrade to the Home Plan to create custom maintenance tasks tailored to your home.</p>
          <button className="btn btn-primary" onClick={() => navigate('/subscription')}>View Plans</button>
        </div>
      </div>
    );
  }

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('general');
  // P1-8: equipment_id ties custom tasks back to specific equipment so logs/recurrences/contractor bundling resolve to e.g. "Trane furnace" instead of orphaning at the home level.
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('medium');
  const [selectedFrequency, setSelectedFrequency] = useState<TaskFrequency>('annual');
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [itemsToHave, setItemsToHave] = useState<string[]>(['']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!home) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <p>Please set up your home first.</p>
      </div>
    );
  }

  const handleAddInstruction = () => setInstructions([...instructions, '']);
  const handleRemoveInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };
  const handleUpdateInstruction = (index: number, value: string) => {
    const updated = [...instructions];
    updated[index] = value;
    setInstructions(updated);
  };

  const handleAddItem = () => setItemsToHave([...itemsToHave, '']);
  const handleRemoveItem = (index: number) => {
    setItemsToHave(itemsToHave.filter((_, i) => i !== index));
  };
  const handleUpdateItem = (index: number, value: string) => {
    const updated = [...itemsToHave];
    updated[index] = value;
    setItemsToHave(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const newTask: Partial<MaintenanceTask> = {
        id: crypto.randomUUID(),
        home_id: home.id,
        title: title.trim(),
        description: description.trim(),
        category: selectedCategory,
        priority: selectedPriority,
        frequency: selectedFrequency,
        status: 'upcoming',
        due_date: dueDate || new Date().toISOString().split('T')[0],
        is_weather_triggered: false,
        applicable_months: [],
        is_custom: true,
        created_by_user: true,
        instructions: instructions.filter(s => s.trim()),
        items_to_have_on_hand: itemsToHave.filter(s => s.trim()),
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined,
        estimated_cost: estimatedCost ? parseFloat(estimatedCost) : undefined,
        // P1-8: link to equipment when user selected one
        equipment_id: selectedEquipmentId || undefined,
      };

      const created = await createTask(newTask);

      // Update store
      if (setTasks) {
        const currentTasks = useStore.getState().tasks || [];
        setTasks([...currentTasks, created]);
      }

      navigate('/');
    } catch (err) {
      setError(getErrorMessage(err) || 'Failed to create task');
    } finally {
      setIsLoading(false);
    }
  };

  const backLinkStyle: React.CSSProperties = {
    color: Colors.sage,
    textDecoration: 'none',
    fontSize: '14px',
    marginBottom: '24px',
    cursor: 'pointer',
    display: 'inline-block',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '600',
    color: Colors.charcoal,
    marginTop: '24px',
    marginBottom: '12px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: `1px solid ${Colors.lightGray}`,
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    backgroundColor: Colors.inputBackground,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: Colors.charcoal,
  };

  const chipContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px',
  };

  const chipStyle = (selected: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid transparent',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    backgroundColor: selected ? Colors.sageStrong : Colors.inputBackground,
    color: selected ? Colors.white : Colors.charcoal,
    transition: 'all 0.2s',
  });

  const priorityChipStyle = (priority: TaskPriority, selected: boolean): React.CSSProperties => ({
    ...chipStyle(selected),
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  });

  const dotStyle = (color: string): React.CSSProperties => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: color,
  });

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: Colors.sage,
    color: Colors.white,
    fontSize: '14px',
    fontWeight: '600',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
    marginTop: '24px',
  };

  const errorStyle: React.CSSProperties = {
    color: Colors.error,
    fontSize: '14px',
    marginTop: '12px',
    padding: '10px',
    backgroundColor: Colors.error + '10',
    borderRadius: '6px',
  };

  const listItemStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'flex-start',
  };

  const removeButtonStyle: React.CSSProperties = {
    padding: '4px 8px',
    backgroundColor: Colors.error,
    color: Colors.white,
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  };

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      <div className="card" style={{ padding: 32 }}>
        <a onClick={() => navigate('/')} style={backLinkStyle}>&larr; Back to Dashboard</a>

        <h1 style={{ fontSize: '24px', fontWeight: '600', color: Colors.charcoal, margin: '16px 0 24px 0' }}>
          Create Custom Task
        </h1>

        {/* Task limit warning for free tier */}
        {taskLimit && existingTasks && existingTasks.length >= 2 && (
          <div style={{
            padding: '12px 14px',
            backgroundColor: 'var(--color-background)',
            borderLeft: `3px solid ${Colors.sage}`,
            borderRadius: 4,
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 13, color: Colors.medGray, margin: 0, marginBottom: 8 }}>
              {existingTasks.length === taskLimit ? (
                <span style={{ color: Colors.error, fontWeight: 600 }}>You've reached your task limit on Free.</span>
              ) : (
                <span><strong>{taskLimit - existingTasks.length} task slot</strong> remaining on Free. Home plan gives you unlimited tasks.</span>
              )}
            </p>
            {existingTasks.length === taskLimit && (
              <button
                onClick={() => navigate('/subscription')}
                style={{
                  padding: '6px 10px',
                  fontSize: 12,
                  color: Colors.sage,
                  background: 'transparent',
                  border: `1px solid ${Colors.sage}`,
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                View Plans
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Clean gutters"
              style={inputStyle}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details about this task..."
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' } as React.CSSProperties}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Category</label>
            <div style={chipContainerStyle}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    // P1-8: clear equipment selection if it no longer matches the new category
                    if (selectedEquipmentId) {
                      const stillValid = equipment.some(
                        (e) => e.id === selectedEquipmentId && (e.category as string) === cat,
                      );
                      if (!stillValid) setSelectedEquipmentId(null);
                    }
                  }}
                  style={chipStyle(selectedCategory === cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* P1-8: Equipment — optional tie-back so this task lives on the right Trane furnace, not the home root */}
          {equipment.filter((e) => (e.category as string) === selectedCategory).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Linked Equipment (optional)</label>
              <div style={chipContainerStyle}>
                <button
                  type="button"
                  onClick={() => setSelectedEquipmentId(null)}
                  style={chipStyle(selectedEquipmentId === null)}
                >
                  None
                </button>
                {equipment
                  .filter((e) => (e.category as string) === selectedCategory)
                  .map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelectedEquipmentId(e.id)}
                      style={chipStyle(selectedEquipmentId === e.id)}
                      title={[e.make, e.model].filter(Boolean).join(' ') || e.name}
                    >
                      {e.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Priority */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Priority</label>
            <div style={chipContainerStyle}>
              {PRIORITIES.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => setSelectedPriority(priority)}
                  style={priorityChipStyle(priority, selectedPriority === priority)}
                >
                  <span style={dotStyle(PRIORITY_COLORS[priority])} />
                  {priority}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Frequency</label>
            <div style={chipContainerStyle}>
              {FREQUENCIES.map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setSelectedFrequency(freq)}
                  style={chipStyle(selectedFrequency === freq)}
                >
                  {freq}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Estimated Time & Cost */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Estimated Time (minutes)</label>
              <input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                min="0"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Estimated Cost ($)</label>
              <input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                min="0"
                step="0.01"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Instructions */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Instructions</label>
            {instructions.map((instruction, index) => (
              <div key={`instruction-${index}`} style={listItemStyle}>
                <input
                  type="text"
                  value={instruction}
                  onChange={(e) => handleUpdateInstruction(index, e.target.value)}
                  placeholder={`Step ${index + 1}`}
                  style={{ ...inputStyle, flex: 1 } as React.CSSProperties}
                />
                {instructions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveInstruction(index)}
                    style={removeButtonStyle}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddInstruction}
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                backgroundColor: Colors.sage,
                color: Colors.white,
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              + Add Step
            </button>
          </div>

          {/* Items to Have */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Items to Have on Hand</label>
            {itemsToHave.map((item, index) => (
              <div key={`item-${index}`} style={listItemStyle}>
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleUpdateItem(index, e.target.value)}
                  placeholder={`Item ${index + 1}`}
                  style={{ ...inputStyle, flex: 1 } as React.CSSProperties}
                />
                {itemsToHave.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    style={removeButtonStyle}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddItem}
              style={{
                marginTop: '8px',
                padding: '8px 12px',
                backgroundColor: Colors.sage,
                color: Colors.white,
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              + Add Item
            </button>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <button type="submit" style={buttonStyle} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Task'}
          </button>
        </form>
      </div>
    </div>
  );
}
