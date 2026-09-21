---
name: hesta-ui-system
description: Create, modify, or review HESTA frontend interfaces using the repository's mandatory light Smart Home design system. Use for any React component, page, modal, form, Tailwind class, visual state, or responsive UI change in hesta_frontend; do not use for backend-only or non-visual infrastructure work.
---

# HESTA UI System

Keep every HESTA interface visually compatible with the existing light Smart
Home product while preserving its functional contracts.

## Before editing

Read `docs/UI_DESIGN_SYSTEM.md` completely. For behavior, routes, roles, API
contracts, session handling, and required states, use
`docs/FRONTEND_UI_FUNCTIONAL_SPEC.md` as the authority.

Inspect `src/index.css` and `src/components/ui` before creating tokens,
foundations, or shared components. Reuse an existing pattern when it already
serves the same purpose.

## Non-negotiable visual invariants

- Use semantic Tailwind tokens from `src/index.css`; never add raw colors to a
  React component.
- Keep page and navigation surfaces bright. Do not introduce dark/navy or black
  backgrounds, purple accents, neon styling, or dark-mode variants.
- Use `bg-app`, `bg-surface`, `bg-sidebar`, `border-line`, `text-text`,
  `text-muted`, `bg-primary`, `bg-mint`, and semantic state tokens.
- Treat existing slate/cyan/blue utility mappings as migration compatibility,
  not as the API for new UI.
- Reuse `AppSidebar`, `AuthShell`, and the shared shell/surface classes where
  applicable. Extract a typed component when a visual pattern is repeated.
- Preserve the established rounded hierarchy and soft-shadow treatment. Pills
  are for statuses and compact controls, not every container.

## Implementation requirements

Preserve Vietnamese copy and all existing routes, API shapes, auth/session,
role, invitation, and realtime behavior unless the task explicitly changes
them. Include relevant loading, empty, error, success, disabled, and confirm
states.

Build from 320 px upward. Give controls accessible names and labels, maintain
visible focus, support keyboard interaction, use correct dialog semantics, and
respect reduced motion. Animate opacity and transform only; never add
`transition-all`.

If a requested visual conflicts with this system, follow the user's explicit
request for that task and update the design-system source of truth only when
the user intends a lasting product-wide change.

## Verification

Review the checklist in `docs/UI_DESIGN_SYSTEM.md`, then run:

```text
npm run lint
npm run build
npm test
```

Report any verification that could not be completed. Do not silently weaken
linting, typing, accessibility, or product behavior to make a visual change
pass.
