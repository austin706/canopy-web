# Canopy Web — Context for Claude Agents

## IMPORTANT: DUAL-APP ARCHITECTURE

Canopy has **two separate codebases** sharing one Supabase backend:

1. **canopy-web** (THIS REPO) — Vite + React web app, deployed to Vercel via `austin706/canopy-web`
2. **canopy** (SIBLING FOLDER) — React Native + Expo mobile app, repo `austin706/canopy`

**⚠️ ANY bug fix, feature, or API change MUST be applied to BOTH codebases.**

The master context file with full schema, migration status, credentials, and architecture details lives at:
`../canopy/CLAUDE_CONTEXT.md`

## Web-Specific Details

- **Framework:** React 18 + Vite + TypeScript
- **Routing:** React Router v6 (react-router-dom)
- **State:** Zustand with localStorage persistence
- **Styling:** Custom CSS design system (Oak & Sage brand)
- **Deployment:** Vercel (auto-deploys on push to `main` branch of `austin706/canopy-web`)
- **GitHub:** https://github.com/austin706/canopy-web

## Key Differences from Mobile

| Concern | Mobile (canopy) | Web (canopy-web) |
|---------|----------------|------------------|
| Routing | Expo Router (file-based) | React Router v6 |
| Storage | AsyncStorage | localStorage |
| Navigation | Stack.Screen entries in `_layout.tsx` | Routes in `App.tsx` |
| Services | `services/supabase.ts` | `src/services/supabase.ts` |
| Store | `store/useStore.ts` | `src/store/useStore.ts` |
| Types | `types/index.ts` | `src/types/index.ts` |

## Recent Fixes (March 22, 2026)

- Task completion now persists to Supabase + creates maintenance log (was store-only)
- Added `quickCompleteTask()` shared helper in `src/services/utils.ts`
- Added `insertProInterest()` to supabase service for pro waitlist
