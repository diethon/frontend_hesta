# HESTA Frontend

## Stack and scope
- This is a React 19 + TypeScript Vite SPA using Tailwind CSS v4.
- Existing dependency versions, backend API contracts, and repository
  conventions are authoritative except for the architecture changes below.
- Use npm and preserve existing dependency versions.
- React Router, Redux Toolkit, and React Redux are approved additions.
- Do not introduce Next.js patterns or unrelated libraries or upgrades.
- The target architecture below supersedes current manual routing and
  duplicated authentication state; it is not yet implemented.

## Target architecture
- Use React Router for application routing.
- App.tsx must not manage routes through page state or conditional page switching.
- Use router navigation and location APIs consistently.
- Preserve invitation query parameters, direct links, refresh behavior,
  and browser Back/Forward navigation.
- Use Redux Toolkit and React Redux for application-wide authentication,
  current user, and shared session state.
- Redux is the single application-wide source of truth for authenticated
  user/session state. Profile updates must synchronize through it.
- Use Redux for genuinely shared client state.
- Keep form values, validation messages, modal visibility, dropdown state,
  and other component-specific UI state local.
- Keep server-fetched feature data local unless multiple unrelated parts
  of the application require the same shared state.
- Do not move all fetched data or form state into Redux.
- Redux Toolkit adoption does not imply adopting RTK Query.

## Structure and conventions
- Feature components currently live in src/components/{auth,home,admin,profile}.
- API calls belong in src/services; shared request/response types in src/types.
- Keep router configuration and route guards together in src/routes.
- Keep store configuration, authentication slice, selectors, and typed
  Redux hooks together in src/store.
- Follow nearby export, props, import, and formatting conventions.
- Use typed props, responses, selectors, and dispatch; avoid adding any
  or weakening checks.
- Preserve Vietnamese UI copy and existing behavior unless the task changes it.

## Authentication and API behavior
- Preserve backend endpoints, methods, payloads, and response contracts.
- Do not introduce new hardcoded environment-specific URLs, origins,
  API base URLs, or client IDs. Use Vite environment variables through
  import.meta.env when configuration is environment-dependent.
- Preserve email/password login, Google sign-in, registration, password
  recovery, logout, and authenticated/unauthenticated invitation flows.
- Preserve the meanings of token and inviteToken query parameters across
  navigation and authentication.
- Platform roles remain ADMIN and USER. Home roles remain OWNER and MEMBER;
  do not conflate platform and home roles.
- Route guards must account for session initialization before redirecting.
- Client-side authentication and role checks control routing/UI only;
  backend authorization remains authoritative.
- Current persistence uses accessToken, refreshToken, and userInfo in
  localStorage. Centralize restoration, persistence, and logout handling
  while preserving compatibility unless a change is explicitly requested.
- Centralize authentication failure handling where practical. Do not let
  individual service modules independently clear unrelated localStorage
  data or implement conflicting logout behavior.
- Keep Redux reducers pure; perform API and storage effects outside reducers.
- Do not invent refresh-token endpoints or change session contracts.
- Use native fetch and ordinary Error handling; do not assume Axios errors.
- Never log credentials or tokens.

## Styling and accessibility
- Tailwind v4 runs through @tailwindcss/vite; CSS starts in src/index.css.
- The HESTA light Smart Home design system is mandatory for every new or
  modified interface. Read `docs/UI_DESIGN_SYSTEM.md` before UI work and apply
  `.agents/skills/hesta-ui-system/SKILL.md` for implementation and review.
- `src/index.css` is the source of truth for semantic design tokens. Use
  utilities such as `bg-app`, `bg-surface`, `bg-sidebar`, `border-line`,
  `text-text`, `text-muted`, `bg-primary`, and `bg-mint`; do not introduce raw
  color values or a separate page-level palette.
- Keep the product bright, airy, rounded, and friendly. Do not add dark/navy
  page surfaces, black backgrounds, purple accents, or dark-mode variants.
- Reuse components from `src/components/ui` and the shared `app-shell`,
  `surface-card`, `auth-surface`, and `app-sidebar` classes before creating a
  parallel visual pattern.
- New shared UI components must expose intentional variants instead of an
  unrestricted styling API that allows each call site to invent a new theme.
- Do not assume animation utilities or plugins are available.
- Use associated labels, accessible control names, keyboard support, and
  appropriate focus handling for dialogs.

## Skills and verification
- Apply only repository-compatible instructions from .agents/skills.
- Exclude Next.js/server rules and unrelated automatic library adoption.
- Skill-package README commands are not application commands.
- For code changes, run npm run lint and npm run build when permitted.
- Report existing failures separately; do not disable rules to hide them.
- Run `npm test` for the automated routing, realtime, and API contract suite;
  do not claim tests were run unless they were actually executed.
- Verify direct route entry, refresh, Back/Forward, session restoration,
  logout, role-based routing, profile synchronization, and invitation flows
  when changing routing or authentication.
- Verify affected responsive behavior and state what could not be checked.
- Keep changes scoped and preserve unrelated user edits.
- For read-only or proposal-only tasks, do not modify files or run
  artifact-producing commands.
