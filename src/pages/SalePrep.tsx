import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { Colors } from '@/constants/theme';
import { SALE_PREP_CATEGORIES, SALE_PREP_ITEMS, type SalePrepCategory } from '@/constants/salePrep';
import {
  getActiveSalePrep,
  activateSalePrep,
  toggleSalePrepItem,
  updateTargetDate,
  closeSalePrep,
  notifyAgentSalePrep,
  type HomeSalePrep,
} from '@/services/salePrep';

export default function SalePrep() {
  const navigate = useNavigate();
  const { user, home } = useStore();
  const [prep, setPrep] = useState<HomeSalePrep | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [activeCategory, setActiveCategory] = useState<SalePrepCategory>('exterior');
  const [error, setError] = useState('');
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const loadPrep = useCallback(async () => {
    if (!home?.id) return;
    try {
      setLoading(true);
      const data = await getActiveSalePrep(home.id);
      setPrep(data);
      if (data?.target_list_date) setTargetDate(data.target_list_date);
    } catch (err: any) {
      setError(err.message || 'Failed to load sale prep');
    } finally {
      setLoading(false);
    }
  }, [home?.id]);

  useEffect(() => { loadPrep(); }, [loadPrep]);

  const [activationMessage, setActivationMessage] = useState('');

  const handleActivate = async () => {
    if (!home?.id || !user?.id) return;
    setActivating(true);
    try {
      const data = await activateSalePrep(home.id, user.id, targetDate || undefined);
      setPrep(data);

      // Notify linked agent if exists
      if (user.agent_id && home.address) {
        try {
          await notifyAgentSalePrep(user.id, user.agent_id, home.address);
          setActivationMessage('Your agent has been notified that you\'re preparing to sell.');
        } catch {
          setActivationMessage('Sale prep activated, but we couldn\'t notify your agent. You may want to reach out directly.');
        }
      } else if (!user.agent_id) {
        setActivationMessage('Sale prep activated! Link an agent in your profile to keep them in the loop.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to activate sale prep');
    } finally {
      setActivating(false);
    }
  };

  const handleToggleItem = async (itemId: string) => {
    if (!prep) return;
    const isCompleted = prep.completed_items.includes(itemId);
    try {
      const newItems = await toggleSalePrepItem(prep.id, itemId, !isCompleted, prep.completed_items);
      setPrep({ ...prep, completed_items: newItems });
    } catch (err: any) {
      setError(err.message || 'Failed to update item');
    }
  };

  const handleUpdateDate = async () => {
    if (!prep || !targetDate) return;
    try {
      await updateTargetDate(prep.id, targetDate);
      setPrep({ ...prep, target_list_date: targetDate });
    } catch (err: any) {
      setError(err.message || 'Failed to update date');
    }
  };

  const handleClose = async (status: 'completed' | 'cancelled') => {
    if (!prep) return;
    try {
      await closeSalePrep(prep.id, status);
      setPrep(null);
      setShowConfirmCancel(false);
    } catch (err: any) {
      setError(err.message || 'Failed to close sale prep');
    }
  };

  const categoryItems = SALE_PREP_ITEMS.filter(item => item.category === activeCategory);
  const totalItems = SALE_PREP_ITEMS.length;
  const completedCount = prep?.completed_items.length || 0;
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Not yet activated — show intro screen
  if (!prep) {
    return (
      <div className="page" style={{ maxWidth: 600 }}>
        <div className="page-header"><h1>Preparing to Sell?</h1></div>
        <div className="empty-state" style={{ marginBottom: 24 }}>
          <div className="icon" style={{ fontSize: 48, fontWeight: 700, color: Colors.copper }}>🏡</div>
          <h3 style={{ fontSize: 22, color: Colors.charcoal }}>No Active Sale Prep</h3>
          <p style={{ lineHeight: 1.6 }}>When you're ready to sell, activate sale prep to get a 26-item checklist that guides you through preparing your home for market.</p>
        </div>
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, marginBottom: 24, color: Colors.charcoal }}>Get Started</h2>

          {user?.agent_id && (
            <div style={{
              padding: 12, background: Colors.sageMuted, borderRadius: 8, marginBottom: 20,
              borderLeft: `4px solid ${Colors.sage}`, textAlign: 'left',
            }}>
              <p style={{ fontSize: 13, color: Colors.charcoal, margin: 0 }}>
                <strong>Your agent will be notified</strong> when you activate sale prep, so they can start preparing too.
              </p>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 20, textAlign: 'left' }}>
            <label style={{ fontSize: 13 }}>Target listing date (optional)</label>
            <input
              className="form-input"
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleActivate}
            disabled={activating}
            style={{ width: '100%', padding: '12px 24px', fontSize: 16 }}
          >
            {activating ? 'Activating...' : 'Start Sale Prep Checklist'}
          </button>
        </div>
      </div>
    );
  }

  // Active sale prep — show checklist
  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Home Sale Prep</h1>
          {prep.target_list_date && (
            <p style={{ fontSize: 13, color: Colors.medGray, marginTop: 4 }}>
              Target listing: {new Date(prep.target_list_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => setShowConfirmCancel(true)}
          style={{ fontSize: 12, padding: '6px 12px' }}
        >
          End Sale Prep
        </button>
      </div>

      {error && <div style={{ padding: '10px 16px', borderRadius: 8, background: '#E5393520', color: '#C62828', fontSize: 14, marginBottom: 16 }}>{error}</div>}
      {activationMessage && (
        <div style={{ padding: '10px 16px', borderRadius: 8, background: Colors.sageMuted, color: Colors.charcoal, fontSize: 14, marginBottom: 16, borderLeft: `4px solid ${Colors.sage}` }}>
          {activationMessage}
        </div>
      )}

      {/* Progress bar */}
      <div className="card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal }}>
            Overall Progress
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: Colors.sage }}>
            {completedCount} / {totalItems} ({progressPct}%)
          </span>
        </div>
        <div style={{ height: 10, background: Colors.lightGray, borderRadius: 5, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            background: progressPct === 100 ? Colors.success : Colors.sage,
            width: `${progressPct}%`,
            transition: 'width 0.3s ease',
            borderRadius: 5,
          }}></div>
        </div>

        {/* Agent notification badge */}
        {prep.agent_notified_at && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: Colors.sage }}>
            <span>✓</span>
            <span>Agent notified on {new Date(prep.agent_notified_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      {/* Target date editor */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 20 }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label style={{ fontSize: 12 }}>Target Listing Date</label>
          <input
            className="form-input"
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        {targetDate !== (prep.target_list_date || '') && (
          <button className="btn btn-secondary" onClick={handleUpdateDate} style={{ fontSize: 12, padding: '8px 16px' }}>
            Update
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {SALE_PREP_CATEGORIES.map(cat => {
          const catItems = SALE_PREP_ITEMS.filter(i => i.category === cat.id);
          const catDone = catItems.filter(i => prep.completed_items.includes(i.id)).length;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: isActive ? Colors.sage : Colors.cream,
                color: isActive ? 'white' : Colors.charcoal,
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                transition: 'background 0.2s',
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span style={{
                fontSize: 11, padding: '2px 6px', borderRadius: 10,
                background: isActive ? 'rgba(255,255,255,0.2)' : Colors.lightGray,
                color: isActive ? 'white' : Colors.medGray,
              }}>
                {catDone}/{catItems.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Checklist items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {categoryItems.map(item => {
          const done = prep.completed_items.includes(item.id);
          return (
            <div
              key={item.id}
              className="card"
              style={{
                padding: 14,
                borderLeft: `4px solid ${done ? Colors.success : Colors.lightGray}`,
                opacity: done ? 0.75 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              <label style={{ display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => handleToggleItem(item.id)}
                  style={{ width: 20, height: 20, marginTop: 2, cursor: 'pointer', accentColor: Colors.sage }}
                />
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontWeight: 600, fontSize: 14, color: Colors.charcoal, marginBottom: 4,
                    textDecoration: done ? 'line-through' : 'none',
                  }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: 13, color: Colors.medGray, lineHeight: 1.5, marginBottom: item.estimatedCost ? 6 : 0 }}>
                    {item.description}
                  </p>
                  {item.estimatedCost && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                      <span style={{ color: Colors.copper, fontWeight: 500 }}>Est. {item.estimatedCost}</span>
                      <span style={{ color: Colors.medGray }}>{item.diy ? 'DIY possible' : 'Pro recommended'}</span>
                    </div>
                  )}
                </div>
              </label>
            </div>
          );
        })}
      </div>

      {/* Sale Documents — Home Token & Home Report PDF */}
      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: Colors.charcoal }}>Sale Documents</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            className="card card-clickable"
            onClick={() => navigate('/home-report')}
            style={{ cursor: 'pointer', padding: 16, textAlign: 'center' }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>&#128196;</div>
            <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, marginBottom: 4 }}>Home Report PDF</p>
            <p style={{ fontSize: 12, color: Colors.medGray }}>Generate a full home report for buyers and agents</p>
          </div>
          <div
            className="card card-clickable"
            onClick={() => navigate('/transfer')}
            style={{ cursor: 'pointer', padding: 16, textAlign: 'center' }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>&#127968;</div>
            <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, marginBottom: 4 }}>Home Token</p>
            <p style={{ fontSize: 12, color: Colors.medGray }}>Transfer your home's maintenance history to the new owner</p>
          </div>
        </div>
      </div>

      {/* Completion CTA */}
      {progressPct === 100 && (
        <div className="card" style={{ marginTop: 24, padding: 24, textAlign: 'center', background: Colors.sageMuted, border: `1px solid ${Colors.sage}` }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>&#127881;</div>
          <h3 style={{ fontSize: 18, color: Colors.charcoal, marginBottom: 8 }}>All Done!</h3>
          <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 16 }}>
            Your home is ready for the market. Great work!
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => handleClose('completed')} style={{ width: '100%' }}>
              Mark Sale Prep Complete
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate('/transfer')}
              style={{ width: '100%' }}
            >
              I'm Ready — Initiate Home Transfer
            </button>
          </div>
        </div>
      )}

      {/* Ready to transfer — show even before 100% */}
      {progressPct < 100 && progressPct >= 50 && (
        <div className="card" style={{ marginTop: 24, padding: 16, borderLeft: `4px solid ${Colors.copper}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14, color: Colors.charcoal, marginBottom: 2 }}>Ready to transfer early?</p>
              <p style={{ fontSize: 12, color: Colors.medGray }}>You can initiate the home token transfer at any time</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transfer')} style={{ color: Colors.copper, whiteSpace: 'nowrap' }}>
              Transfer &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Confirm cancel modal */}
      {showConfirmCancel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 400, padding: 24 }}>
            <h2 style={{ marginBottom: 8 }}>End Sale Prep?</h2>
            <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 20 }}>
              Your progress will be saved but the checklist will be deactivated.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmCancel(false)} style={{ flex: 1 }}>
                Keep Going
              </button>
              <button className="btn" style={{ flex: 1, background: Colors.error, color: 'white' }} onClick={() => handleClose('cancelled')}>
                End Sale Prep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
