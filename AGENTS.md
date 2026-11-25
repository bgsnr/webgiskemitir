# AGENTS.md — webgiskemitir (Web GIS)

Vite + React + TypeScript + Mapbox web client for a drought-monitoring GIS. It consumes the API from `bekemitir` under `/api/v1`.

Non-monorepo: standalone project. `bekemitir` (backend) and `appgiskemitir` (mobile) are separate projects, not workspace packages.

## Commands

Bun is the package manager (`bun.lock` is present). Use `bun` / `bunx`.

```bash
bun run dev        # Vite dev server
bun run build      # tsc -b && vite build
bun run lint       # eslint .
bun run preview    # preview the production build
bunx tsc -b        # typecheck only
```

Lint and build must both pass before declaring any task done.

Stack: React 19, TypeScript 7, Vite 8, ESLint 10 (flat config in `eslint.config.js`). TS options to respect: `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.

## Layout

```
index.html      # Vite entry
src/            # app code: components, hooks, lib
src/assets/     # assets imported by code
public/         # files served as-is (e.g. favicon)
```

Delete Vite template leftovers (`src/App.tsx` demo, unused logos) instead of building on top of them. Keep map logic in dedicated modules/components.

## Mapbox

- Lazy-load `mapbox-gl` with a dynamic `import()` so it stays out of the main bundle.
- Read the token from `import.meta.env.VITE_MAPBOX_TOKEN`. Restrict the public token by URL in the Mapbox dashboard, and use separate tokens for web vs mobile.
- Render features from the backend's **MVT** endpoints (`/api/v1/tiles/...`), not from large GeoJSON payloads.

## Environment variables

- Only `VITE_`-prefixed variables reach the browser — **treat every one of them as public**. Never put secrets (DB credentials, private tokens, API keys) in `VITE_*`.
- Local overrides go in `.env.local` (gitignored).
- `.gitignore` blocks `.env` and `.env.*`. Keep a tracked `.env.example` documenting required keys; put real values only in the untracked `.env` / `.env.local`.

## Data & performance

- Fetch through a small typed API client. Do not call `fetch` inline in components during render.
- Cache server responses and rely on CDN caching for tiles.
- Do not render thousands of individual features as DOM nodes; use Mapbox layers/sources.
- Keep large map components behind route-level code splitting.

## Conventions

- TypeScript strict, no `any` (prefer `unknown` + narrowing).
- Function components and hooks only.
- No path alias is configured — import with relative paths from `src/`.
