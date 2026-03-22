# Canopy Web — Desktop Version Setup

## Quick Start

```bash
cd canopy-web
cp .env.example .env
npm install
npm run dev
```

The app will open at **http://localhost:3000**

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel
```
Set environment variables in Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Netlify
```bash
npm run build
# Upload `dist/` folder to Netlify
```
Add `_redirects` file in `public/`:
```
/*    /index.html   200
```

### Static Hosting
```bash
npm run build
# Serve the `dist/` folder with any static file server
```

## Features (matches mobile app)

| Page | Description |
|------|-------------|
| **Dashboard** | Health score, weather, tasks, quick actions |
| **Calendar** | Interactive calendar with task overlay |
| **Equipment** | CRUD with lifespan tracking |
| **Profile** | Edit profile, gift codes, role portals |
| **Subscription** | Plan comparison, gift code redemption |
| **Pro Services** | Request pro maintenance (Pro+ tier) |
| **Agent** | View connected real estate agent |
| **Maintenance Log** | Track completed work and costs |
| **Home Details** | Full home profile editor |
| **Admin Portal** | Stats, agent management, users, gift codes, pro requests |
| **Agent Portal** | Client list, assigned gift codes |

## Architecture

- **React 18** + **Vite** + **TypeScript**
- **React Router v6** for navigation
- **Zustand** for state management (localStorage persistence)
- **Supabase** for backend (same database as mobile app)
- **CSS** custom design system (Oak & Sage brand: copper, sage, cream)

## Shared Backend

This web app connects to the **same Supabase project** as the mobile app.
All data (users, homes, equipment, tasks, gift codes) is shared.
A user can sign in on both platforms and see the same data.
