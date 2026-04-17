// ===============================================================
// Barrel Re-export — All consumers continue to import from '@/services/supabase'
// ===============================================================
// This file re-exports all services for backward compatibility.
// No imports need to be changed in consuming code.

// Core client and rate limiting
export { supabase, SUPABASE_URL, SUPABASE_ANON_KEY, checkAuthRateLimit } from './supabaseClient';

// Domain modules
export * from './auth';
export * from './home';
export * from './equipment';
export * from './warranties';
export * from './tasks';
export * from './maintenanceLogs';
export * from './documents';
export * from './notifications';
export * from './calendar';
export * from './profiles';
export * from './photos';
export * from './agents';
export * from './pro';
export * from './admin';
export * from './pro_advanced';
export * from './equipment_guides';
export * from './agents_qr';
export * from './tech_docs';
export * from './builders';
export * from './verification';
export * from './recalls';
export * from './referrals';
