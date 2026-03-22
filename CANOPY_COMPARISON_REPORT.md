# Canopy Mobile vs Web App — Comprehensive Comparison Report

**Date:** 2026-03-22  
**Comparison Scope:** Feature parity, bugs, and missing functionality

---

## 1. SUPABASE SERVICE FUNCTIONS

### File Locations
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/services/supabase.ts`
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/services/supabase.ts`

### Functions Missing in Web App

| Function | Purpose | Impact |
|----------|---------|--------|
| None identified | Both have complete parity | N/A |

### Functions Missing in Mobile App

| Function | Purpose | Impact |
|----------|---------|--------|
| `resetPassword(email)` | Initiate password reset flow | **HIGH** — Web has password recovery, mobile doesn't support "Forgot Password" flow |
| `updatePassword(newPassword)` | Update user password after reset | **HIGH** — Web supports password changes, mobile doesn't |
| `getAllAgents()` | Fetch all agents (admin) | **MEDIUM** — Web has admin agent management, mobile doesn't expose |
| `createAgentRecord(agent)` | Create new agent (admin) | **MEDIUM** — Web admin can create agents |
| `getAllUsers()` | Fetch all user profiles (admin) | **MEDIUM** — Web has user admin dashboard |
| `getAllGiftCodes()` | Fetch all gift codes (admin) | **MEDIUM** — Web admin feature |
| `createGiftCodes(codes)` | Batch create gift codes (admin) | **MEDIUM** — Web admin feature |

### Function Naming Differences

| Mobile | Web | Issue |
|--------|-----|-------|
| `completeTask()` | `completeTaskApi()` | **BUG** — Web uses renamed function; see bugs section |

**Summary:** Web has 7 additional admin/auth functions that mobile lacks. Mobile lacks password reset functionality entirely.

---

## 2. ZUSTAND STORE (useStore.ts)

### File Locations
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/store/useStore.ts`
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/store/useStore.ts`

### State/Actions Missing in Web

| Item | Type | Purpose | Impact |
|------|------|---------|--------|
| `onboardingStep` | state | Tracks which onboarding step user is on | **MEDIUM** — Mobile has structured onboarding, web doesn't track progress |
| `setOnboardingStep()` | action | Update onboarding progress | **MEDIUM** — Web can't persist onboarding state |
| `snoozeTask()` | action | Postpone task by N days | **HIGH** — Mobile lets users snooze tasks; web has no snooze feature |

### State/Actions Missing in Mobile

| Item | Type | Purpose | Impact |
|------|------|---------|--------|
| `reset()` | action | Clear all store state on logout | **MEDIUM** — Mobile doesn't have explicit reset; web explicitly clears state |

### Persistence Differences

| Aspect | Mobile | Web | Issue |
|--------|--------|-----|-------|
| Storage | AsyncStorage | localStorage | Different backends, but functional parity |
| Partialize | Yes (selective persist) | Yes (selective persist) | Both exclude `isLoading` and `onboardingStep` (mobile) / `weather` (web) |
| **Weather persistence** | **Persisted** | **NOT persisted** | **BUG** — Web doesn't persist weather in store, causing loss on page refresh |

**Summary:** Web is missing snooze and onboarding tracking; mobile is missing explicit reset. Web has a bug where weather data isn't persisted.

---

## 3. TYPE DEFINITIONS

### File Locations
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/types/index.ts`
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/types/index.ts`

### Types Missing in Web

| Type | Fields | Impact |
|------|--------|--------|
| `ProProvider` | Complete business/provider profile (lines 23-43) | **HIGH** — Web doesn't define pro provider type; pro portal won't work correctly |

### Type Differences in Shared Types

| Type | Mobile | Web | Issue |
|------|--------|-----|-------|
| `User.role` | `'user' \| 'agent' \| 'admin' \| 'pro_provider'` | `'user' \| 'agent' \| 'admin'` | **MEDIUM** — Web missing `pro_provider` role; can't type-check pro portal users |

### Types Missing in Mobile

| Type | Fields | Impact |
|------|--------|--------|
| `ProRequest` | Service request object (lines 178-190 in web) | **LOW** — Mobile handles as `any`, but no type safety |
| `GiftCode` | Gift code structure (lines 192-202 in web) | **LOW** — Mobile handles as `any`, but no type safety |

**Summary:** Web missing `ProProvider` type is a significant gap for pro portal functionality. Mobile missing `ProRequest` and `GiftCode` types.

---

## 4. PAGES/SCREENS

### File Locations
- **Mobile screens:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/app/`
- **Web pages:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/pages/`

### Screens in Mobile Only

| Screen | Route | Purpose | Impact |
|--------|-------|---------|--------|
| Onboarding Flow | `/app/onboarding/` | Step-by-step home/equipment setup | **HIGH** — Web has no onboarding flow |
| Onboarding Address | `/app/onboarding/address.tsx` | Collect home address | **HIGH** — Web missing |
| Onboarding Systems | `/app/onboarding/systems.tsx` | Collect home systems info | **HIGH** — Web missing |
| Onboarding Scan | `/app/onboarding/scan.tsx` | Scan equipment labels | **HIGH** — Web missing |
| Documents | `/app/documents/` | Document vault access | **HIGH** — Web doesn't expose documents page |
| Help | `/app/help/` | In-app help/FAQ | **MEDIUM** — Web doesn't have help section |
| Notifications | `/app/notifications/` | Notification center | **HIGH** — Web has no notification UI |
| Equipment Detail | `/app/equipment/[id].tsx` | View/edit single equipment | **MEDIUM** — Web equipment page is list-only |
| Equipment Add | `/app/equipment/add.tsx` | Add new equipment screen | **MEDIUM** — Web has inline modal instead |
| Task Detail | `/app/task/[id].tsx` | View/complete single task | **HIGH** — Web has no task detail view |
| Pro Portal | `/app/pro-portal/` | Service provider dashboard | **HIGH** — Web doesn't implement pro portal |
| Pro Portal Jobs | `/app/pro-portal/jobs.tsx` | View available jobs | **HIGH** — Web missing |
| Pro Portal Job Detail | `/app/pro-portal/job-detail.tsx` | Job details & acceptance | **HIGH** — Web missing |
| Pro Portal Availability | `/app/pro-portal/availability.tsx` | Set availability schedule | **HIGH** — Web missing |
| Pro Portal Profile | `/app/pro-portal/pro-profile.tsx` | Pro provider profile mgmt | **HIGH** — Web missing |
| Pro Portal Login | `/app/pro-portal/login.tsx` | Pro auth gateway | **HIGH** — Web missing |

### Pages in Web Only

| Page | Route | Purpose | Impact |
|------|-------|---------|--------|
| Forgot Password | `/pages/ForgotPassword.tsx` | Password reset initiation | **HIGH** — Mobile has no password reset UI |
| Reset Password | `/pages/ResetPassword.tsx` | Password reset form | **HIGH** — Mobile missing |

### Screens/Pages in Both (Functional Gaps)

| Screen | Mobile | Web | Gap |
|--------|--------|-----|-----|
| Dashboard | Yes (`/(tabs)/index.tsx`) | Yes (`Dashboard.tsx`) | Both exist; see bugs section |
| Calendar | Yes (`/(tabs)/calendar.tsx`) | Yes (`Calendar.tsx`) | Both exist; functional parity |
| Equipment | Yes (`/(tabs)/equipment.tsx`) | Yes (`Equipment.tsx`) | Web missing detail/edit view for single item |
| Profile | Yes (`/(tabs)/profile.tsx`) | Yes (`Profile.tsx`) | Both exist; functional parity |
| Home Details | Yes (`/home-details/`) | Yes (`HomeDetails.tsx`) | Both exist; functional parity |
| Maintenance Logs | Yes (`/maintenance-logs/`) | Yes (`MaintenanceLogs.tsx`) | Both exist; functional parity |
| Agent View | Yes (`/agent/`) | Yes (`AgentView.tsx`) | Both exist |
| Pro Request | Yes (`/pro-request/`) | Yes (`ProRequest.tsx`) | Both exist |
| Subscription | Yes (`/subscription/`) | Yes (`Subscription.tsx`) | Both exist |
| Admin Portal | Yes (`/admin-portal/`) | Yes (`AdminDashboard.tsx` + pages) | Both exist |
| Agent Portal | Yes (`/agent-portal/`) | Yes (`AgentPortal.tsx` + `AgentClientHome.tsx`) | Both exist |

**Summary:** Web is missing 15+ mobile screens, primarily:
- Complete onboarding flow
- Pro provider portal (entire feature)
- Document vault
- Help center
- Notifications UI
- Equipment detail/edit views
- Task detail views

Mobile is missing:
- Password reset UI (has API, no screens)

---

## 5. SERVICE FILES

### File Locations
- **Mobile services:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/services/`
- **Web services:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/services/`

### Services Missing in Web

| Service | File | Purpose | Impact |
|---------|------|---------|--------|
| Task Engine | `taskEngine.ts` | Generate AI tasks, equipment lifecycle alerts | **HIGH** — Web has no AI task generation; mobile generates custom tasks |
| Weather | `weather.ts` | OpenWeatherMap integration | **HIGH** — Web has hardcoded demo weather; no real API |
| AI Scanner | `ai.ts` | Claude Vision for equipment label scanning | **HIGH** — Web has no equipment scanning |
| Notifications | `notifications.ts` | Push notifications | **HIGH** — Web has no notification system |
| Geocoding | `geocoding.ts` | Address validation & geocoding | **MEDIUM** — Web missing address lookup |
| Payments | `payments.ts` | Stripe/payment integration | **MEDIUM** — Web missing payments (gift codes only) |

### Services in Both

| Service | Mobile | Web | Status |
|---------|--------|-----|--------|
| `supabase.ts` | Yes | Yes | Good parity (see section 1) |
| `subscriptionGate.ts` | Yes | Yes | Minor differences (see section 6) |
| `utils.ts` | Yes | Yes | Both have `quickCompleteTask()` |

**Summary:** Web is missing 6 critical services, primarily AI/automation features that mobile has.

---

## 6. SUBSCRIPTION GATE DIFFERENCES

### File Locations
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/services/subscriptionGate.ts`
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/services/subscriptionGate.ts`

### Metadata Structure Differences

| Aspect | Mobile | Web | Issue |
|--------|--------|-----|-------|
| **Tier Metadata** | `SUBSCRIPTION_TIERS` object with detailed structure | `PLANS` array | **REFACTOR** — Different data structures; should unify |
| **Free Equipment Limit** | 5 (via SUBSCRIPTION_TIERS) | 5 (via getEquipmentLimit) | Both same, but different implementation |
| **Free Task Limit** | 3 (via getTaskLimit) | 3 (via getTaskLimit) | Both same, consistent |
| **Service Area Gating** | `isProAvailableInArea()` — checks FL/OK zip prefixes | Missing entirely | **BUG** — Web doesn't gate pro services by location |
| **Mobile-specific** | `getNextTier()` helper | Missing in web | **MEDIUM** — Web missing tier progression hint |

### Missing Service Area Gating in Web

**Issue:** Mobile has `isProAvailableInArea()` (lines 202-214) that restricts Pro tier availability to Florida (320-349) and Oklahoma (730-749). Web has no such gating.

**Impact:** **HIGH** — Web users outside permitted areas could access Pro features, bypassing geographic restrictions.

---

## 7. APP ROUTING

### File Locations
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/app/_layout.tsx` (expo-router Stack)
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/App.tsx` (React Router)

### Routing Structure Differences

| Aspect | Mobile | Web | Issue |
|--------|--------|-----|-------|
| **Public Routes** | `/auth/*` (login, signup, welcome) | Same routes | Parity ✓ |
| **Protected Routes** | `/(tabs)/*` + other screens | `/` with Layout wrapper | Different structure |
| **Admin Routes** | `/admin-portal/*` | `/admin/*` | Prefix differs, functionality same |
| **Agent Routes** | `/agent-portal/*` | `/agent-portal/*` | Parity ✓ |
| **Pro Routes** | `/pro-portal/*` | Missing | **HIGH** — Web missing entire pro portal routing |
| **Fallback** | Stack with no explicit catch-all | `<Route path="*">` to `/` | Different implementations |

### Routing Coverage

| Route | Mobile | Web | Status |
|-------|--------|-----|--------|
| `/` | auth or onboarding or tabs | Dashboard (protected) | Different flows |
| `/auth/*` | login, signup, welcome | login, signup, forgot, reset | Web has extra password flows |
| `/onboarding/*` | 3-step flow | Missing | **GAP** — Web no onboarding |
| `/(tabs)/*` | 5 main screens | Layout wrapper structure | Different org |
| `/equipment/*` | list, add, [id] | Equipment (list only) | Web missing detail views |
| `/task/[id]` | Detail view | Missing | **GAP** — Web no task detail routing |
| `/home-details` | Exists | HomeDetails | Parity ✓ |
| `/admin-portal/*` | agents, users, gift-codes, pro-requests | `/admin/*` | Naming differs |
| `/agent-portal/*` | index, login, clients, client-home, gift-codes | AgentPortal + AgentClientHome | Parity ✓ |
| `/pro-portal/*` | Full portal (index, login, jobs, availability, etc) | **MISSING ENTIRELY** | **CRITICAL GAP** |

**Summary:** Web routing is missing pro portal routes and onboarding flow. Both use different frameworks (expo-router vs React Router), making sync harder.

---

## 8. BUGS FOUND

### BUG #1: Task Complete Function Mismatch (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/services/supabase.ts:94-100`

**Issue:** Function renamed from `completeTask()` to `completeTaskApi()` in web, but store still has `completeTask()` action that only updates local state.

```typescript
// Web supabase.ts — function is completeTaskApi()
export const completeTaskApi = async (taskId: string, notes?: string, photoUrl?: string) => {
  const { data, error } = await supabase.from('maintenance_tasks')
    .update({ status: 'completed', completed_date: new Date().toISOString(), ... })
    .eq('id', taskId).select().single();
  ...
}

// Web store useStore.ts — action is completeTask()
completeTask: (id, notes, photoUrl) => set((s) => ({
  tasks: s.tasks.map((t) => t.id === id ? { ...t, status: 'completed' as const, ... } : t),
})),
```

**Mobile equivalent:** Mobile also has store action + separate API call in `quickCompleteTask()` utility.

**Fix:** Rename web function to `completeTask()` to match mobile, or update all call sites to use `completeTaskApi()` consistently.

---

### BUG #2: Equipment Add Without Supabase Persistence (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/pages/Equipment.tsx:35-52`

**Issue:** Equipment is added to local store, but Supabase persist is wrapped in try-catch that silently fails; UI shows equipment as added even if API fails.

```typescript
const handleSave = async () => {
  if (!form.name || !home) return;
  setSaving(true);
  try {
    const newItem: any = { ... };
    try { await upsertEquipment(newItem); } catch {} // SILENT FAIL
    addEquipment(newItem); // Added to store regardless
    setShowModal(false);
  } finally { setSaving(false); }
};
```

**Impact:** Equipment added without Supabase persistence; data loss on refresh or sync issues.

**Fix:** Either throw the error or check for persistence success before adding to store:
```typescript
const result = await upsertEquipment(newItem);
if (result) addEquipment(newItem);
```

---

### BUG #3: Weather Data Not Persisted in Store (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/store/useStore.ts:65-75`

**Issue:** Weather state is not included in the `partialize()` persist configuration, so weather data is lost on page refresh.

```typescript
partialize: (state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  home: state.home,
  equipment: state.equipment,
  tasks: state.tasks,
  maintenanceLogs: state.maintenanceLogs,
  agent: state.agent,
  // weather is MISSING — won't persist
}),
```

**Mobile equivalent:** Mobile includes weather in partialize:
```typescript
partialize: (state) => ({
  ...
  weather: state.weather,
  ...
}),
```

**Impact:** Weather disappears on every page refresh; Dashboard shows demo weather instead.

**Fix:** Add `weather: state.weather` to partialize array in web store.

---

### BUG #4: Service Area Gating Not Implemented (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/services/subscriptionGate.ts`

**Issue:** Web missing `isProAvailableInArea()` function that mobile has. Pro services are accessible everywhere in web, regardless of zip code.

**Mobile has (lines 202-214):**
```typescript
export function isProAvailableInArea(
  _state?: string | null,
  zip?: string | null,
): boolean {
  if (PRO_SERVICE_AREAS.zipPrefixes.length === 0) return true;
  if (!zip) return true;
  const prefix = zip.trim().substring(0, 3);
  return PRO_SERVICE_AREAS.zipPrefixes.includes(prefix);
}
```

**Impact:** **CRITICAL** — Web doesn't enforce geographic restrictions; users outside FL/OK can access Pro features.

**Fix:** Add service area gating function to web subscriptionGate.ts and use it in ProRequest page.

---

### BUG #5: Missing snoozeTask() Implementation (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/store/useStore.ts`

**Issue:** Web store has no `snoozeTask()` action, while mobile does. Users can't postpone tasks in web.

**Mobile has (store/useStore.ts:101-111):**
```typescript
snoozeTask: (id, days) =>
  set((s) => ({
    tasks: s.tasks.map((t) => {
      if (t.id === id) {
        const newDate = new Date(t.due_date);
        newDate.setDate(newDate.getDate() + days);
        return { ...t, due_date: newDate.toISOString() };
      }
      return t;
    }),
  })),
```

**Impact:** **MEDIUM** — Web users can't snooze tasks; feature gap.

**Fix:** Add snoozeTask() action to web store and implement UI button in Calendar page.

---

### BUG #6: Dashboard Task Completion Uses Store-Only Function (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/pages/Dashboard.tsx:132`

**Issue:** Dashboard uses `quickCompleteTask()` which properly handles Supabase persistence. However, Calendar (line 119-120) uses store-only `skipTask()` without API persistence.

**Calendar bug code:**
```typescript
<button className="btn btn-ghost btn-sm" onClick={() => skipTask(task.id)}>Skip</button>
```

This calls store action only; doesn't persist to Supabase.

**Mobile equivalent:** Mobile also uses store actions, but mobile has taskEngine that generates tasks, whereas web tasks are demo data or synced from Supabase. Skipping in web should persist.

**Impact:** **HIGH** — Skipped tasks don't persist; reappear on refresh.

**Fix:** Create `skipTaskAndPersist()` utility similar to `quickCompleteTask()` that updates Supabase and store.

---

### BUG #7: Pro Portal Routes Missing But Pages Have No Auth (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/App.tsx:72`

**Issue:** Web App.tsx routes both `/agent-portal` and missing `/pro-portal/*` without role-based access control. No check for `user.role === 'pro_provider'`.

**Current code (line 72):**
```typescript
<Route path="/agent-portal" element={<AgentPortal />} />
```

No role check. Any authenticated user can access agent portal.

**Impact:** **CRITICAL** — No pro provider authentication; anyone can access pro-related features.

**Fix:** Add role-based protection:
```typescript
<ProtectedRoute requiredRole="agent">
  <AgentPortal />
</ProtectedRoute>
```

---

### BUG #8: Hardcoded DEMO_TASKS Used on Free Tier (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/pages/Dashboard.tsx:9-13`

**Issue:** Free tier shows hardcoded demo tasks that don't exist in Supabase. When user upgrades, tasks are still demo tasks unless they fetch real ones.

```typescript
const DEMO_TASKS = [
  { id: 'd1', home_id: '1', title: 'Replace HVAC Air Filters', ... },
  { id: 'd2', home_id: '1', title: 'Clean Gutters (Spring)', ... },
  { id: 'd3', home_id: '1', title: 'Test Smoke & CO Detectors', ... },
];

// Later:
const displayTasks = hasAI && tasks.length > 0 ? tasks : DEMO_TASKS;
```

**Problem:** This logic shows demo tasks even if user has real tasks with 0 length. Also, free tier should show exactly 3 demo tasks, but if `tasks.length === 0`, it will show demo tasks even after upgrade.

**Impact:** **MEDIUM** — Free users see demo tasks instead of real tasks after upgrade.

**Fix:** Fetch real tasks on mount and only show demo if user is truly free tier AND has no tasks.

---

### BUG #9: Missing Error Handling in ProRequest Page (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/pages/ProRequest.tsx:22-24`

**Issue:** `getProRequests()` called on mount with no error handling:

```typescript
useEffect(() => {
  if (user) getProRequests(user.id).then(setRequests).catch(() => {}); // Silent fail
}, [user]);
```

If fetch fails, user sees empty list instead of error message.

**Impact:** **LOW** — UX issue; users don't know why requests aren't loading.

**Fix:** Set error state and display message on failure.

---

### BUG #10: Missing Profile Error Handling (Web)

**File:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/pages/Profile.tsx:31-32`

**Issue:** Profile update has generic error handling:

```typescript
catch (e: any) {
  setMessage(e.message || 'Failed to update');
}
```

Should give user more context about what failed.

**Impact:** **LOW** — UX issue.

---

## 9. SUMMARY OF CRITICAL GAPS

### Feature Parity Issues (Priority Order)

| Category | Gap | Severity | Details |
|----------|-----|----------|---------|
| **Pro Portal** | Web missing entire pro provider feature | CRITICAL | 6+ screens, login, job management, availability |
| **Onboarding** | Web missing structured onboarding flow | CRITICAL | No step-by-step home/equipment setup |
| **AI Tasks** | Web has no task generation engine | HIGH | Mobile generates 37+ AI tasks; web has 3 demo tasks |
| **Task Details** | Web has no detail/edit view for single tasks | HIGH | Mobile has `/task/[id]` page |
| **Equipment Detail** | Web has no detail/edit view for equipment | HIGH | Mobile has `/equipment/[id]` page |
| **Equipment Scanning** | Web has no Claude Vision scanner | HIGH | Mobile can scan equipment labels with AI |
| **Weather Service** | Web uses hardcoded demo data | HIGH | Mobile has OpenWeatherMap integration |
| **Notifications** | Web has no notification center UI | HIGH | Mobile has full notification page |
| **Documents Vault** | Web has no document storage access | HIGH | Mobile exposes document vault |
| **Service Area Gating** | Web doesn't restrict Pro by location | CRITICAL | Anyone can access pro services |
| **Password Reset** | Mobile has no reset UI | HIGH | Web has reset flow, mobile lacks |
| **Snooze Tasks** | Web can't postpone tasks | MEDIUM | Mobile has snoozeTask() action |
| **Help Center** | Web has no help/FAQ section | MEDIUM | Mobile has help page |

### Bugs in Current Code

| Bug | Severity | Location | Fix Effort |
|-----|----------|----------|-----------|
| Function rename mismatch (`completeTask` vs `completeTaskApi`) | HIGH | supabase.ts, utils.ts | Low |
| Equipment added without Supabase check | HIGH | Equipment.tsx | Low |
| Weather not persisted in store | HIGH | useStore.ts | Low |
| Skipped tasks don't persist to Supabase | HIGH | Calendar.tsx | Medium |
| No role-based route protection | CRITICAL | App.tsx | Medium |
| Missing service area gating | CRITICAL | subscriptionGate.ts | Medium |
| Missing snoozeTask action | MEDIUM | useStore.ts | Low |
| Demo tasks logic unclear | MEDIUM | Dashboard.tsx | Low |
| Silent failures in error handling | LOW | Multiple pages | Low |

---

## 10. RECOMMENDED ACTIONS

### Immediate (Critical Bugs)

1. **Add service area gating to web** — Implement `isProAvailableInArea()` in web subscriptionGate.ts
2. **Add role-based route protection** — Check `user.role` before rendering admin/agent/pro routes
3. **Fix equipment persistence** — Remove try-catch silent fail; verify Supabase success
4. **Fix skipped tasks** — Add Supabase persistence to skipTask action

### Short Term (High Priority)

5. Rename `completeTaskApi()` to `completeTask()` for consistency
6. Add weather to store persistence
7. Implement snoozeTask() in web store
8. Create task detail view page (`/task/[id]`)
9. Create equipment detail view page (`/equipment/[id]`)

### Medium Term (Feature Parity)

10. Implement pro portal routes and pages (6+ screens)
11. Implement onboarding flow (3 steps)
12. Add weather service integration (OpenWeatherMap)
13. Add AI task generation engine
14. Add equipment scanning service (Claude Vision)
15. Add notification center UI

### Type Safety

16. Add `ProProvider` type to web types
17. Add `ProRequest` and `GiftCode` to mobile types
18. Unify tier metadata structure (SUBSCRIPTION_TIERS vs PLANS)

---

## DETAILED FILE REFERENCES

### Supabase Services
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/services/supabase.ts` (364 lines)
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/services/supabase.ts` (271 lines)

### Store
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/store/useStore.ts` (153 lines)
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/store/useStore.ts` (79 lines)

### Types
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/types/index.ts` (221 lines)
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/types/index.ts` (203 lines)

### Services
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/services/`
  - `supabase.ts`, `subscriptionGate.ts`, `taskEngine.ts`, `weather.ts`, `ai.ts`, `utils.ts`, `notifications.ts`, `geocoding.ts`, `payments.ts`
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/services/`
  - `supabase.ts`, `subscriptionGate.ts`, `utils.ts` (only 3 files)

### Routing
- **Mobile:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy/app/_layout.tsx` (42 lines)
- **Web:** `/sessions/dazzling-hopeful-fermat/mnt/Oak & Sage Claude/canopy-web/src/App.tsx` (82 lines)

### Bug Locations (Web)
- Equipment.tsx (line 47) — Silent fail on upsertEquipment
- supabase.ts (line 94) — Function name mismatch
- Dashboard.tsx (line 9-13) — Hardcoded demo tasks
- Calendar.tsx (line 120) — skipTask without persistence
- useStore.ts (line 67-75) — Weather not persisted
- App.tsx (line 72) — No role-based auth on routes
- subscriptionGate.ts (missing) — No service area gating

