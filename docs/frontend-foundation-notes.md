# HRMS Frontend Foundation Notes

## Current State Analysis
- Project is a clean Next.js (`next@16`) starter with App Router and Tailwind CSS v4.
- No HRMS modules are implemented yet (dashboard, employees, attendance, payroll, leave, etc.).
- No shared design system or UI component architecture exists yet.
- Mobile app layer (iOS/Android) is not initialized yet.

## Dependencies Added

### UI and styling utilities
- `clsx`
- `tailwind-merge`
- `class-variance-authority`
- `lucide-react`
- `framer-motion`
- `sonner`
- `cmdk`

### Forms and validation
- `react-hook-form`
- `zod`
- `@hookform/resolvers`

### Data and state
- `@tanstack/react-query`
- `@tanstack/react-table`
- `zustand`
- `date-fns`

## Why These Were Added
- Standardized, reusable UI primitives and variants for consistent UX.
- Better keyboard-friendly interaction support (command palette, focus-first patterns).
- Type-safe form validation with low re-render overhead.
- Strong server-state management and table support for HRMS-heavy data grids.
- Lightweight local state handling for layout/UI-level interaction state.

## Keyboard-Friendly UX Standards To Apply
- All interactive controls reachable by `Tab` with clear visible focus.
- Shortcut support for frequent actions (search, create employee, quick navigation).
- Command palette for role-based fast access.
- Escape key behavior for modals/drawers and Enter/Space semantics for actions.
- Accessible table navigation and row-level action shortcuts.

## Recommended Next Implementation Order
1. Build design tokens and global theme in Tailwind.
2. Create shared UI primitives (`Button`, `Input`, `Select`, `Dialog`, `Table`, `Badge`).
3. Setup app shell (sidebar, top bar, breadcrumbs, command palette).
4. Add data layer (`react-query`) and API client adapters.
5. Build first HRMS modules (Dashboard, Employees).
6. Add role/permission-aware navigation and guarded UI actions.

## iOS and Android Strategy
- Preferred path after web MVP: create a React Native app (Expo) for true native UX.
- Reuse logic and types from web by moving shared code to a common package structure.
- Alternative fast path: use Capacitor on web build for wrapper-based mobile delivery.
- Decision point should be made after core web modules and workflows stabilize.

## Important Notes
- `npm install` reported 2 moderate vulnerabilities in transitive dependencies.
- Do not use `npm audit fix --force` until compatibility review is completed.
