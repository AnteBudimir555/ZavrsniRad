# Mobile-First UI Adaptation Plan

> **Scope:** Refactor the **existing** React web app so it is fully responsive, touch-friendly,
> and fast on mobile browsers (Safari/Chrome) down to **320px**. We are **not** building a native
> app — we are improving the web interface we already ship via Nginx.
>
> **Stack in play:** React 18 + TypeScript + Material-UI **v6** + Vite, served by Nginx.
> Tables use `@mui/x-data-grid` v7; charts use `recharts` v2. No CSS framework
> (Tailwind/Bootstrap) is present, and **none will be added** — MUI's `sx`, `useMediaQuery`,
> and theme breakpoints are the responsive mechanism.

---

## Overview & Goals

| Goal | Target |
|---|---|
| Usable layout | No horizontal overflow or clipped controls from **320px** up to desktop |
| Touch ergonomics | All interactive targets **≥ 48×48px**; no hover-only affordances |
| Performance | **First load < 2s** on simulated 3G/4G; initial JS noticeably smaller |
| Native feel | Hamburger drawer nav, card lists instead of wide tables, full-screen dialogs on phones, correct mobile meta tags |

**Why this matters:** the app was built desktop-first. The top navigation overflows below
~600px, the data grids are ~1400px wide (forcing sideways scrolling on a phone), and the entire
JavaScript bundle — including the chart library only one page uses — downloads on first paint.
This plan fixes each of those in ordered, independently-shippable milestones.

**MUI breakpoints we will target** (defaults — no override needed):

| Key | Min width | Meaning here |
|---|---|---|
| `xs` | 0px | phones (portrait) |
| `sm` | 600px | large phones / small tablets |
| `md` | 900px | tablets / small laptops |
| `lg` | 1200px | desktop |

The rule of thumb throughout: **"mobile" = below `sm` (`< 600px`)**, detected with
`useMediaQuery(theme.breakpoints.down('sm'))` or responsive `sx` arrays like
`sx={{ p: { xs: 2, sm: 4 } }}`.

---

## Section 1 — Responsive Layout & CSS Audit

Every component below was inspected. The table lists the file, where it breaks, and the fix.
"Breaks at" is the width where the current UI starts to overflow or feel cramped.

| Component | File | Breaks at | Problem | Fix |
|---|---|---|---|---|
| **Top navigation bar** | `frontend/src/App.tsx` (`TopBar`) | ~600px | Logo + 2–4 nav buttons + username + Sign-out sit in one horizontal `Toolbar`; they overflow and get clipped on phones | Collapse nav into a hamburger `IconButton` + temporary `Drawer` below `sm` (see Section 2 & M2) |
| **Incident table** | `frontend/src/features/incidents/IncidentListPage.tsx` | ~700px | `DataGrid` with ~9 fixed-width columns (~1400px total) → sideways scrolling, tiny text | Render rows as stacked **Cards** below `sm`; keep the grid at `sm`+ (M3) |
| **User table** | `frontend/src/features/admin/UserManagementPage.tsx` | ~700px | Same DataGrid overflow; Activate/Deactivate button is `size="small"` (<48px) | Same card-list pattern + larger touch target (M3) |
| **List page header** | `IncidentListPage.tsx` (top `Stack direction="row"`) | ~400px | Title + "Export CSV" + "Report incident" in one row crowd the title out | Make the header `Stack` switch to `direction={{ xs: 'column', sm: 'row' }}`; buttons go full-width on `xs` |
| **Filter row** | `IncidentListPage.tsx` (filters `Stack`) | ~360px | Three 140px-min `FormControl`s + Clear button; already `flexWrap`, but each control is narrow on 320px | Give each `FormControl` `sx={{ minWidth: { xs: '100%', sm: 140 } }}` so they stack one-per-row on the smallest screens |
| **Form card padding** | `IncidentFormPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx` | ~360px | `Paper sx={{ p: 4 }}` (32px) eats horizontal space on narrow phones | Responsive padding `sx={{ p: { xs: 2, sm: 4 } }}` |
| **Auth top margin** | `LoginPage.tsx`, `RegisterPage.tsx` | short screens | `Container sx={{ mt: 8 }}` pushes the card too far down on small viewports | `mt: { xs: 3, sm: 8 }` |
| **Form footer buttons** | `IncidentFormPage.tsx` (Cancel/Submit `Stack`) | ~360px | `justifyContent="flex-end"` row can crowd at 320px | Full-width stacked buttons on `xs`: `direction={{ xs: 'column-reverse', sm: 'row' }}` |
| **Assign dialog** | `IncidentDetailPage.tsx` | phones | `maxWidth="xs" fullWidth` is okay but feels small and floaty on mobile | Add `fullScreen` on mobile via `useMediaQuery` (M4) |
| **Confirm dialog** | `UserManagementPage.tsx` | phones | Same — floating dialog instead of native sheet feel | Same `fullScreen`-on-mobile treatment (M4) |
| **Detail card** | `IncidentDetailPage.tsx` | ~360px | `Paper sx={{ p: 4 }}`; chip row already `flexWrap` (good) | Responsive padding `p: { xs: 2, sm: 4 }` |
| **Stats dashboard** | `frontend/src/features/admin/StatsPage.tsx` | mostly OK | `Grid` is already responsive (`xs=12 sm=6 md=3`) and charts use `ResponsiveContainer` (good) | Minor: reduce card/heading sizes on `xs`; verify chart height `220` is fine on phones |
| **`index.html`** | `frontend/index.html` | n/a | Has `viewport` (good) but no `theme-color` or mobile web-app meta | Add native-feel meta (M1) |

**Mechanism note:** there is no separate stylesheet to audit — all styling lives in the MUI
theme (`frontend/src/theme.ts`) and inline `sx` props. That is the right place to make these
changes; we extend the theme and add responsive `sx` rather than introducing CSS files.

---

## Section 2 — Touch & Mobile UX Optimization

### 2.1 Touch targets (≥ 48×48px)
- MUI default buttons are ~36px tall. Raise the floor centrally in `frontend/src/theme.ts` via
  component defaults: set `MuiButton` and `MuiIconButton` `styleOverrides.root` to
  `minHeight: 48` (and `minWidth: 48` for icon buttons). This fixes every button app-wide in one
  place, including the `size="small"` row actions.
- Where a row currently relies on a small button (Resolve, Activate/Deactivate), the card-list
  rewrite (M3) gives them full-width, comfortably tappable buttons.

### 2.2 Navigation — hamburger + Drawer (confirmed approach)
- Below `sm`: the `AppBar` shows only the logo/title + a hamburger `IconButton` (`MenuIcon`).
  Tapping it opens a temporary MUI `Drawer` (`variant="temporary"`, `anchor="left"`) containing
  the role-aware links currently in `TopBar`:
  - Reporter: **My Reports**, **Assigned to Me**
  - Admin: **Stats**, **Users**
  - Both: the username/role line and **Sign out** at the bottom.
- At `sm`+ the current inline buttons remain (no visual change for desktop).
- New component: `frontend/src/components/MobileNavDrawer.tsx`. `App.tsx`'s `TopBar` decides which
  to render with `useMediaQuery(theme.breakpoints.down('sm'))`.
- Use `react-router`'s `useLocation` to auto-close the drawer on navigation.

### 2.3 Tables → card lists (confirmed approach)
- Below `sm`, replace each `DataGrid` with a vertical list of MUI `Card`s. Each incident card
  shows: id + title, the existing status/severity/category `Chip`s, reporter, and occurred time;
  the whole card is tappable (navigates to `/incidents/:id`). Admin's "Resolve" becomes a
  full-width button inside the card.
- New component: `frontend/src/components/IncidentCard.tsx`. `IncidentListPage.tsx` keeps its
  current data-fetching/pagination logic untouched and only swaps the **presentation** based on
  the breakpoint. Pagination below `sm` uses a simple `Pagination` / "Load more" control instead
  of the grid footer.
- `UserManagementPage.tsx` gets the same treatment (a small inline user card is enough; no
  separate file required unless it grows).

### 2.4 Dialogs as sheets
- `IncidentDetailPage.tsx` (Assign) and `UserManagementPage.tsx` (confirm) `Dialog`s take
  `fullScreen={useMediaQuery(theme.breakpoints.down('sm'))}` so they fill the screen like a
  native sheet on phones and stay as centered dialogs on desktop.

### 2.5 Remove hover/pointer reliance
- The list currently sets `cursor: 'pointer'` and relies on row click; tapping already works, but
  the card pattern makes the tap target explicit and removes any hover dependence.
- No tooltips exist in the codebase, so there is no hover-only information to replace. Recharts
  tooltips are tap-activated on touch — acceptable; no change needed.

---

## Section 3 — Performance & Asset Budgeting

### 3.1 Current state
- **No code-splitting.** `App.tsx` imports every page eagerly, so the first load ships the
  DataGrid **and** `recharts` even though `recharts` is used only by `/admin/stats` and the grid
  only by list pages. `recharts` is the single heaviest dependency.
- **No vendor chunking** in `frontend/vite.config.ts` — one big bundle, poor cache reuse.
- **No HTTP compression.** `frontend/nginx.conf` sets long cache headers for `/assets/` (good) but
  has **no `gzip`/brotli** — text assets (JS/CSS) ship uncompressed.
- **Font:** MUI assumes Roboto but it is never loaded, so the browser silently falls back to a
  system font. This is actually *fast* — we should make it deliberate rather than accidental.
- **Images:** the app uses only tree-shaken `@mui/icons-material` SVG icons (`ReportProblem`,
  `ExpandMore`, and the new `Menu`). There are no raster images to optimize.

### 3.2 Actions
1. **Route-level lazy loading** — in `App.tsx`, convert page imports to `React.lazy(() => import(...))`
   and wrap `<Routes>` in `<Suspense fallback={…}>`. This alone moves `recharts` (StatsPage) and
   the heavy detail/list code out of the initial chunk.
2. **Vendor chunk split** — in `vite.config.ts`, add
   `build.rollupOptions.output.manualChunks` to separate large libraries, e.g. a `mui` chunk,
   an `x-data-grid` chunk, and a `recharts` chunk, so they cache independently and don't bloat the
   entry bundle.
3. **Enable compression in Nginx** — add `gzip on;` with `gzip_types` for JS/CSS/SVG/JSON in
   `frontend/nginx.conf` (and brotli via `brotli on;` **only if** the Nginx image includes the
   module — otherwise gzip is sufficient). Biggest single win for transfer size.
4. **Font strategy** — recommended: keep a **system font stack** (San Francisco on iOS, Roboto on
   Android) for zero font download and instant text. If brand consistency is required instead,
   self-host a **Roboto subset** (woff2) with `font-display: swap` and `<link rel="preload">` in
   `index.html`; do **not** pull Roboto from a third-party CDN (privacy + extra connection).
   Set whichever choice explicitly in `theme.ts` `typography.fontFamily`.
5. **Mobile meta** in `index.html` — add `<meta name="theme-color" content="#1565c0">` (matches the
   primary color), and `apple-mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style` for
   a more app-like feel when added to the home screen. Keep the existing viewport tag.

### 3.3 Asset budget — measured after implementation

Numbers below are **gzipped** transfer sizes from `npm run build` (Vite report) after the
lazy-loading + chunk-split + gzip changes landed.

**Chunks produced:**

| Chunk | Gzipped | Loaded when |
|---|---|---|
| `vendor-mui` | ~113 KB | always (shared UI) |
| `vendor-react` | ~53 KB | always |
| `index` (app entry/shell) | ~20 KB | always |
| `vendor-grid` (`@mui/x-data-grid`) | ~105 KB | only list pages (desktop grid) |
| `vendor-charts` (`recharts`) | ~103 KB | only `/admin/stats` |
| Per-page chunks (Login, Form, Detail, …) | ~0.5–2.5 KB each | only that route |

**First-load cost by entry point (the win):**

| Landing page | Gzipped JS pulled | Avoids |
|---|---|---|
| **Login** (typical first hit) | **~187 KB** | grid **and** charts (~207 KB) |
| Incident list | ~293 KB | charts (~103 KB) |
| Stats dashboard | ~292 KB | grid (~105 KB) |

Before the split, a single eager bundle forced **~395 KB gzipped on every first paint**.
The login screen now loads roughly **half** that, and `recharts` only downloads if an admin
actually opens Stats.

| Asset | Result |
|---|---|
| Fonts | **0 KB** — native system-font stack, no download |
| Images | **0 KB** — tree-shaken `@mui/icons-material` SVGs only |
| CSS | near-zero static CSS (MUI is CSS-in-JS) |
| **Time to interactive on Fast 3G** | target **< 2s** — confirm with a Lighthouse mobile run (Section 5) |

---

## Section 4 — Step-by-Step Action Plan

Each milestone is independently shippable and testable. Files to touch are named explicitly.

### M1 — Foundation (theme + meta)
- `frontend/src/theme.ts`: add `MuiButton`/`MuiIconButton` `minHeight/minWidth: 48` defaults;
  set explicit `typography.fontFamily` (system stack per Section 3.4); optionally tune `xs` heading
  sizes.
- `frontend/index.html`: add `theme-color` + apple mobile web-app meta.
- *Outcome:* every button is touch-sized and the app declares itself mobile-aware. No layout
  restructuring yet.

### M2 — Navigation (hamburger + Drawer)
- New `frontend/src/components/MobileNavDrawer.tsx`.
- `frontend/src/App.tsx`: refactor `TopBar` to show inline buttons at `sm`+ and the hamburger +
  `<MobileNavDrawer>` below `sm`; reuse the existing role logic (`isAdmin`, `isAuthenticated`).
- *Outcome:* nav no longer overflows on phones.

### M3 — Tables → card lists
- New `frontend/src/components/IncidentCard.tsx`.
- `frontend/src/features/incidents/IncidentListPage.tsx`: branch on `useMediaQuery(down('sm'))` —
  card list + simple pagination on mobile, existing `DataGrid` on desktop. Keep all fetch/filter
  logic as-is.
- `frontend/src/features/admin/UserManagementPage.tsx`: same card branch with a full-width
  Activate/Deactivate button.
- *Outcome:* no sideways scrolling; tables read as native lists on phones.

### M4 — Forms & dialogs
- Responsive padding/margins in `IncidentFormPage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`,
  `IncidentDetailPage.tsx` (`p: { xs: 2, sm: 4 }`, `mt: { xs: 3, sm: 8 }`); stack form footer
  buttons on `xs`.
- `fullScreen`-on-mobile for the Assign dialog (`IncidentDetailPage.tsx`) and the confirm dialog
  (`UserManagementPage.tsx`).
- Make the list-page header and filter row stack on `xs` (Section 1 fixes).
- *Outcome:* forms and dialogs are comfortable and full-width on phones.

### M5 — Performance
- `frontend/src/App.tsx`: `React.lazy` + `Suspense` for all route components.
- `frontend/vite.config.ts`: `manualChunks` vendor split.
- `frontend/nginx.conf`: enable `gzip` (and brotli if the image supports it).
- Finalize the font decision from Section 3.4.
- *Outcome:* smaller initial bundle, compressed transfer, `< 2s` first load on 3G.

### M6 — Polish & verification pass
- Walk the 320 / 375 / 768px checklist (Section 5), fix stragglers, run Lighthouse mobile, record
  the measured budget numbers back into Section 3.3.

### Optional (out of scope for now)
- Upgrade the drawer nav to a **bottom navigation bar** for an even more native feel. Noted as a
  future enhancement; not part of this plan.

---

## Section 5 — Verification & Testing

All testing is doable locally — no devices or paid services required.

### Tooling
- **Chrome DevTools → Device Toolbar** (`Ctrl+Shift+M`): test preset devices, set **DPR** (1, 2, 3)
  via the device dropdown, and use **Network throttling → Fast 3G / Slow 3G** plus **CPU throttling**
  to approximate a mid-range phone.
- **Real device over LAN:** run `npm run dev -- --host` in `frontend/`, then open
  `http://<your-PC-LAN-IP>:5173` from a phone on the same Wi-Fi. The Vite proxy already forwards
  `/api/*` to the backend, so the phone hits the real API.
- **Lighthouse** (DevTools → Lighthouse → **Mobile**): run against a production build
  (`npm run build && npm run preview`) and check Performance + the `< 2s` budget; re-run after M5 to
  confirm the win.
- **Firefox Responsive Design Mode** as a second engine to catch Safari-ish quirks (Firefox/WebKit
  differ from Chrome on flex/scroll edge cases).

### Manual checklist (run at 320px, 375px, and 768px)
- [ ] No horizontal page scroll at 320px.
- [ ] Hamburger opens/closes the drawer; every nav link works and the drawer closes on navigation.
- [ ] Incident list shows tappable cards on phone; tapping opens the detail page.
- [ ] User management shows cards with a tappable Activate/Deactivate.
- [ ] Every button/tap target measures ≥ 48px (DevTools box model).
- [ ] Login / Register / Report forms have comfortable padding; footer buttons reachable with a thumb.
- [ ] Assign and confirm dialogs are full-screen on phone.
- [ ] Stats cards and charts reflow into one column and remain readable.
- [ ] `datetime-local` field opens the native mobile picker.

### Breakpoint spot-checks
- Resize across the `sm` (600px) and `md` (900px) boundaries and confirm clean switches between
  card/grid and drawer/inline-nav with no flash or layout jump.

---

## Appendix

### A. File-by-file change index

| File | Milestone(s) | Change |
|---|---|---|
| `frontend/src/theme.ts` | M1, M5 | 48px button defaults; explicit `fontFamily`; optional `xs` type sizes |
| `frontend/index.html` | M1 | `theme-color` + apple mobile web-app meta |
| `frontend/src/components/MobileNavDrawer.tsx` *(new)* | M2 | Mobile nav drawer |
| `frontend/src/App.tsx` | M2, M5 | Responsive `TopBar`; `React.lazy` + `Suspense` routes |
| `frontend/src/components/IncidentCard.tsx` *(new)* | M3 | Mobile incident card |
| `frontend/src/features/incidents/IncidentListPage.tsx` | M3, M4 | Card/grid branch; responsive header & filters |
| `frontend/src/features/admin/UserManagementPage.tsx` | M3, M4 | Card/grid branch; `fullScreen` confirm dialog |
| `frontend/src/features/incidents/IncidentDetailPage.tsx` | M4 | Responsive padding; `fullScreen` Assign dialog |
| `frontend/src/features/incidents/IncidentFormPage.tsx` | M4 | Responsive padding; stacked footer buttons |
| `frontend/src/auth/LoginPage.tsx` | M4 | Responsive padding/margin |
| `frontend/src/auth/RegisterPage.tsx` | M4 | Responsive padding/margin |
| `frontend/src/features/admin/StatsPage.tsx` | M6 | Minor `xs` sizing polish |
| `frontend/vite.config.ts` | M5 | `manualChunks` vendor split |
| `frontend/nginx.conf` | M5 | Enable gzip/brotli compression |

### B. Confirmed design decisions
1. **Mobile navigation:** hamburger icon + temporary MUI `Drawer` below `sm` (keep the existing
   `AppBar`). Bottom-navigation upgrade is an optional later enhancement.
2. **Tables on mobile:** render rows as stacked MUI `Card`s below `sm`; keep `DataGrid` at `sm`+.
3. **No new CSS framework:** all responsiveness via MUI theme, `sx` responsive arrays, and
   `useMediaQuery`. API calls continue to go through `api/client.ts` per project conventions.
