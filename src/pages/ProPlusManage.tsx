// ═══════════════════════════════════════════════════════════════
// /pro-plus/manage → /add-ons (deprecated, redirects)
// ═══════════════════════════════════════════════════════════════
// 2026-04-29: Pro+ tier killed. The "Pro+ services" name now refers to
// the curated add-on bundle. This page is kept as a back-compat redirect
// only — homeowners with deep-linked /pro-plus/manage URLs land on
// /add-ons instead, where the same à la carte services live.
// ═══════════════════════════════════════════════════════════════

import { Navigate } from 'react-router-dom';

export default function ProPlusManageRedirect() {
  return <Navigate to="/add-ons" replace />;
}
