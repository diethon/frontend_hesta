# HESTA UI Design System

This document is the visual source of truth for every new or modified HESTA
interface. Product behavior and API rules remain in
`docs/FRONTEND_UI_FUNCTIONAL_SPEC.md`.

## Product direction

HESTA is a bright, modern, friendly Smart Home product. Interfaces should feel
calm and easy for a household to understand at a glance.

- Use white, pale sky blue, and mint surfaces with soft borders and shadows.
- Prefer clear hierarchy, generous spacing, rounded controls, and concise
  Vietnamese copy.
- Never introduce dark or navy page surfaces, black backgrounds, purple
  accents, neon styling, or dark-mode variants.
- Avoid decorative effects that compete with device status or primary actions.

## Semantic tokens

All color values live in `src/index.css` under `@theme`. Use the semantic
Tailwind utilities generated from these tokens; do not place hexadecimal,
RGB/HSL, or arbitrary color values in React components.

| Purpose | Token utility examples | Value |
| --- | --- | --- |
| Application background | `bg-app` | `#F8FCFF` |
| Card and modal surface | `bg-surface` | `#FFFFFF` |
| Sidebar | `bg-sidebar` | `#EEF7FB` |
| Sidebar hover | `bg-sidebar-hover` | `#DFF1F8` |
| Sidebar active | `bg-sidebar-active` | `#CDEFFA` |
| Border | `border-line` | `#DCEAF2` |
| Primary action | `bg-primary`, `text-primary` | `#5BC0EB` |
| Primary hover | `hover:bg-primary-hover` | `#3DAFD9` |
| Mint accent | `bg-mint`, `text-mint` | `#7BDCB5` |
| Mint hover | `hover:bg-mint-hover` | `#5ECFA2` |
| Primary text | `text-text` | `#3A4A5A` |
| Secondary text | `text-muted` | `#6B7C8F` |
| Default icon | `text-icon` | `#7A93A6` |

State colors must keep their matching soft background:

| State | Foreground | Background |
| --- | --- | --- |
| Success / online | `success` | `success-soft` |
| Disabled / offline | `off` | `off-soft` |
| Warning | `warning` | `warning-soft` |
| Error | `error` | `error-soft` |
| Information | `info` | `info-soft` |

Legacy slate/cyan/blue utilities are mapped to the light palette only for
compatibility with existing components. Do not use them in new UI. New work
must use semantic tokens.

## Shared foundations

Reuse these before adding new layout or surface styles:

- `AppSidebar` for authenticated desktop navigation.
- `AuthShell` for authentication and invitation pages.
- `.app-shell` for page roots.
- `.app-sidebar` for navigation surfaces.
- `.surface-card` for cards and content panels.
- `.auth-surface` for auth and modal-like forms.
- `.soft-grid`, `.gentle-rise`, and `.custom-scrollbar` only where their
  existing purpose matches.

When a pattern appears in two or more features, extract a typed component into
`src/components/ui`. Shared components should offer named variants such as
`primary`, `secondary`, `danger`, or `success`; callers should not be able to
replace the whole visual system with arbitrary class strings.

## Component rules

- Page background: `bg-app`; content surface: `surface-card` or `bg-surface`.
- Cards: `rounded-2xl`/`.surface-card`, `border-line`, and a soft shadow.
- Inputs: white or soft-blue surface, `border-line`, readable `text-text`, and
  a primary focus ring. Every input needs a visible associated label.
- Primary buttons: `bg-primary hover:bg-primary-hover text-white`.
- Secondary buttons: pale blue surface with `text-text` or `text-muted`.
- Destructive actions: error foreground/soft background; require confirmation
  when the action is irreversible.
- Icons: use `text-icon` by default and `text-primary` when active. Decorative
  SVGs must be hidden from assistive technology.
- Use one rounded hierarchy: cards 20–24 px, controls 12–16 px, pills only for
  status, filters, avatars, and compact actions.
- Animate only opacity or transform. Respect the global reduced-motion rule and
  never use `transition-all`.

## Required states and responsive behavior

Every feature that loads or mutates data must deliberately cover:

- loading or skeleton state;
- empty state with a useful next action;
- API error state with `role="alert"` when appropriate;
- success feedback for meaningful mutations;
- disabled and submitting states;
- confirmation for destructive actions.

Start at a 320 px viewport. Avoid fixed content widths that overflow; keep
touch targets at least 44 px where practical. Desktop sidebars must not make
mobile content inaccessible. Dialogs need a labelled dialog role, keyboard
operation, a clear close action, and scroll containment.

## UI change checklist

Before handing off UI work:

1. Confirm the feature still follows `FRONTEND_UI_FUNCTIONAL_SPEC.md` and does
   not change routes, API payloads, session rules, roles, or realtime behavior.
2. Confirm new UI uses semantic tokens and shared foundations, with no raw or
   forbidden colors.
3. Check keyboard access, labels, focus, dialog semantics, responsive overflow,
   and loading/empty/error/success/disabled states.
4. Run `npm run lint`, `npm run build`, and `npm test`.

