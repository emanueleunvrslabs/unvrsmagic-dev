# AGENTS.md — UNVRS Boss Dashboard

## Project Overview
**Repo:** https://github.com/unvrslabs/unvrs-boss
**Stack:** React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Capacitor (iOS/Android)

## Setup

```bash
npm install        # install deps
npm run dev        # dev server on http://localhost:8080
npm run build      # production build
npm run lint       # ESLint check
```

## Directory Structure

```
src/
  App.tsx           # Root component + routing (React Router)
  main.tsx          # Entry point
  pages/            # One file per route
  components/       # Reusable UI components
    ui/             # shadcn/ui primitives (auto-generated, do not edit)
  hooks/            # Custom React hooks
  lib/              # Utilities, helpers
  integrations/     # Supabase client and types
  types/            # Global TypeScript types
supabase/
  migrations/       # SQL migrations (run in order)
  functions/        # Edge functions (Deno)
  config.toml       # Supabase project config
```

## Key Conventions

### Components
- Functional components only, named exports
- Props interface named `ComponentNameProps` above the component
- shadcn/ui components live in `src/components/ui/` — never edit them directly
- Custom components in `src/components/`, grouped by feature

### TypeScript
- Strict mode — no `any`
- Prefer `type` over `interface` for data shapes
- Supabase types auto-generated in `src/integrations/supabase/types.ts`

### Styling
- Tailwind CSS classes only — no inline styles
- Use shadcn/ui variants for consistency
- Dark mode: class-based (`dark:` prefix)
- Responsive: mobile-first (`sm:`, `md:`, `lg:`)

### Supabase
- Client initialized in `src/integrations/supabase/client.ts`
- All DB operations through the Supabase client — never raw SQL in frontend
- Auth: Supabase Auth (`supabase.auth`)
- New tables: add migration in `supabase/migrations/` with timestamp prefix
- Edge functions: `supabase/functions/<name>/index.ts`

### State Management
- Server state: React Query (`@tanstack/react-query`)
- Local state: `useState` / `useReducer`
- No global state library unless explicitly needed

### Forms
- React Hook Form + Zod validation
- Schema defined with `z.object({...})` above the component
- Always handle loading + error states

## Routing
React Router v6 — routes defined in `src/App.tsx`.
Add new pages in `src/pages/` and register the route in App.tsx.

## Commits

Follow Conventional Commits:
```
feat(scope): description
fix(scope): description
chore(scope): description
```

Always add:
```
Co-Authored-By: Paperclip <noreply@paperclip.ing>
```

## Before Submitting
- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` clean
- [ ] Mobile responsive (test at 375px)
- [ ] Loading and error states handled
- [ ] No `console.log` left in code
- [ ] Supabase types regenerated if schema changed

