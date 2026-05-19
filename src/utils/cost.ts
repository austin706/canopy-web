// ───────────────────────────────────────────────────────────────────
// cost.ts — service-type-aware cost display for task templates.
//
// 2026-05-18: previously the UI showed "$15-$30" with no context, which read
// like "what I'd pay to request a pro." Reality varies by service_type:
//   - diy           → supplies cost the homeowner buys
//   - canopy_visit  → free for Pro subscribers; supplies cost if DIY between visits
//   - canopy_pro    → Canopy add-on quote (parts + labor)
//   - licensed_pro  → typical licensed-contractor quote
//
// This helper labels the cost accurately and returns a tooltip explaining
// what the range represents. Callers pass the user's Pro status so we can
// say "Included" for Pro subscribers without an awkward dollar amount.
// ───────────────────────────────────────────────────────────────────

export interface CostMeta {
  /** Short label like "Est. supplies cost" — shows above the amount. */
  label: string;
  /** Formatted "$X" or "$X-$Y" or "" when no amount applies. */
  amount: string;
  /** Tooltip text explaining what the cost represents. */
  tooltip: string;
}

export interface CostInput {
  /** Single estimated cost from MaintenanceTask.estimated_cost — typically the low end. */
  estimatedCost?: number | null;
  /** Optional explicit range (TaskTemplate.estimated_cost_low/high). */
  estimatedCostLow?: number | null;
  estimatedCostHigh?: number | null;
  serviceType?: string | null;
  /** Pass true if the current user is on a Pro tier (pro / pro_2). */
  userIsPro?: boolean;
}

function fmtAmount(low?: number | null, high?: number | null): string {
  const l = low ?? null;
  const h = high ?? null;
  if (l == null && h == null) return '';
  if (l != null && h != null) {
    if (l === h) return `$${l}`;
    return `$${l}–$${h}`;
  }
  const v = l ?? h;
  return v != null ? `$${v}` : '';
}

export function getCostMeta(input: CostInput): CostMeta {
  // Prefer the explicit low/high pair when available; fall back to single.
  const low = input.estimatedCostLow ?? input.estimatedCost ?? null;
  const high = input.estimatedCostHigh ?? input.estimatedCost ?? null;
  const noCost = (low == null || low === 0) && (high == null || high === 0);
  const amount = fmtAmount(low, high);
  const serviceType = input.serviceType ?? 'diy';

  if (serviceType === 'canopy_visit') {
    if (input.userIsPro) {
      return {
        label: 'Included in your Pro visit',
        amount: '',
        tooltip: 'This task is included in your bimonthly Pro visit at no extra charge. Your Canopy Pro handles it on their next visit.',
      };
    }
    if (noCost) {
      return {
        label: 'Est. DIY cost',
        amount: 'No supplies needed',
        tooltip: 'No supplies required to do this yourself. Pro subscribers get this task included in their bimonthly visit.',
      };
    }
    return {
      label: 'Est. supplies cost (DIY)',
      amount,
      tooltip: 'Estimated supplies cost if you handle this yourself. Pro subscribers get this task included in their bimonthly visit — no separate charge.',
    };
  }

  if (serviceType === 'canopy_pro') {
    if (noCost) {
      return {
        label: 'Est. Canopy add-on cost',
        amount: 'Quoted per home',
        tooltip: 'Estimated cost for a Canopy add-on visit or recurring add-on service. Final quote depends on your home and the scope of work.',
      };
    }
    return {
      label: 'Est. Canopy add-on cost',
      amount,
      tooltip: 'Typical range for a Canopy add-on visit or recurring service. Your actual quote depends on your home and the scope of work. You can also handle this yourself using the steps above.',
    };
  }

  if (serviceType === 'licensed_pro') {
    if (noCost) {
      return {
        label: 'Est. contractor quote',
        amount: 'Quoted per job',
        tooltip: 'Licensed contractors typically quote this job after seeing your home. We can connect you with vetted local pros.',
      };
    }
    return {
      label: 'Est. contractor quote',
      amount,
      tooltip: 'Typical range for a licensed contractor in most U.S. markets. Your actual quote varies by region, scope, and home specifics. We can connect you with vetted local pros.',
    };
  }

  // diy or unknown
  if (noCost) {
    return {
      label: 'No supplies needed',
      amount: '',
      tooltip: 'This task is a check or inspection — no purchases required.',
    };
  }
  return {
    label: 'Est. supplies cost',
    amount,
    tooltip: 'Estimated supplies cost if you do this yourself. Final cost varies by store, brand, and what specifically applies to your home. Prefer a pro? Use the request link below.',
  };
}
