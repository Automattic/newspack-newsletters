# NEWS-1931 — Settings (standalone mode): discovery

Discovery output for the Settings React surface, per the ticket's stated acceptance line ("which knobs live where, and what's shareable") and the project-level open question ("Boundary for shared settings components between standalone and bundled modes").

This doc decides the boundary *before* code lands. The conclusion drives the implementation in the same PR.

## Premise

When `newspack-newsletters` runs alongside `newspack-plugin` (the typical Newspack stack), `newspack-plugin`'s *Engagement → Newsletters* page is the canonical settings UI. When this plugin runs *standalone* (no `newspack-plugin`), it needs its own React-mounted settings surface. The boundary question: how much should be shared between the two surfaces, and at which layer?

## Current state — what's already in place

The Admin UX milestone has progressed far enough that most of the chassis NEWS-1931 originally proposed already exists:

- **PHP page registration** — `includes/admin/pages/class-settings-page.php` extends `Admin_Page` (the chassis from NEWS-1927) with `slug = 'newspack-newsletters-settings'` and `capability = 'manage_options'`. Registered only in standalone mode by `Admin_Shell::get_pages()`, which gates on `! Admin_Shell::is_bundled_mode()` (i.e. `! class_exists( '\\Newspack\\Newspack' )`).
- **Asset enqueue + mount node** — handled by the shared `Admin_Page::render()` (prints `<div id="newspack-newsletters-settings-root">`) and the admin-shell webpack entry that boots screens by slug.
- **React screen registry entry** — `src/admin-shell/screens/index.js` already maps the slug to a `Placeholder` component (line 35–38), with a comment flagging it as temporary "until its React surface lands".
- **Bundled-mode opt-out** — when bundled, `Admin_Shell::get_pages()` doesn't register `Settings_Page` at all; the menu entry is absent and the URL non-routable. No deferral message, no fallback link — just gone.

So what's actually missing is the **screen component** that replaces the placeholder, plus any new REST plumbing that screen needs.

## Settings inventory

Both surfaces edit the same option keys via the same PHP class (`Newspack_Newsletters_Settings`). The bundled wizard in `newspack-plugin` is a thin proxy: it calls `get_settings_list()` and `update_settings()` on this plugin's class, exposed via `GET/POST /newspack/v1/wizard/newspack-newsletters/settings` (the wizard's own route) which forwards to `GET/POST /newspack-newsletters/v1/settings` semantics. Subscription-list management uses this plugin's `/newspack-newsletters/v1/lists` route directly from the wizard's React.

### Cross-cutting global settings

| Label | Option key | Type | Notes |
|---|---|---|---|
| Service Provider | `newspack_newsletters_service_provider` | select | Drives which credential block is shown |
| Public Newsletter Posts Slug | `newspack_newsletters_public_posts_slug` | text | Affects permalink structure |
| Allow comments on public Newsletters | `newspack_newsletters_support_comments` | bool | |
| Disable Related Posts on public newsletters | `newspack_newsletters_disable_related_posts` | bool | Conditional on Jetpack active |
| Letterhead API Key | `newspack_newsletters_letterhead_api_key` | text | Promotions service, ESP-agnostic |

### ESP-specific credentials

| ESP | Option keys |
|---|---|
| Mailchimp | `newspack_mailchimp_api_key`, `newspack_mailchimp_auto_append_footer` |
| Constant Contact | `newspack_newsletters_constant_contact_api_key`, `newspack_newsletters_constant_contact_api_secret` (OAuth-flowed) |
| ActiveCampaign | `newspack_newsletters_active_campaign_url`, `newspack_newsletters_active_campaign_key` |
| Campaign Monitor | (deprecated, hidden behind supported-providers filter — do not surface) |
| Manual | (no credentials) |

Constant Contact requires the OAuth verify-token round-trip the bundled wizard already implements via `GET /newspack-newsletters/v1/constant_contact/verify_token`.

### Tracking

| Label | Option key | Type | REST |
|---|---|---|---|
| Click Tracking Enabled | `newspack_newsletters_use_click_tracking` | bool | Bundled wizard uses its own `/wizard/newspack-newsletters/settings/tracking`; raw option keys are owned here |
| Tracking Pixel Enabled | `newspack_newsletters_use_tracking_pixel` | bool | same |

The bundled wizard splits tracking onto its own tab. Standalone could either follow the same split or fold tracking into a single Settings page section — a UI decision, not a data one.

### Subscription Lists

Managed via `GET/POST /newspack-newsletters/v1/lists` on this plugin (already exists). Each list row carries `id`, `name`, `type_label`, `active`, `title`, `description`, `edit_link`, `remote_name`. The bundled wizard renders these as `ActionCard`s with toggle + title + description editing.

### Storage notes

All values are stored via `update_option`. **No encryption** — API keys live in plain `wp_options`. That's the existing posture; not changing it under NEWS-1931.

## What "shareable" means here — and doesn't

The opening assumption was that the bundled and standalone surfaces might differ on *which knobs* they expose, with newspack-plugin owning some keys and this plugin owning others. The audit shows that's not the case: **`newspack-newsletters` already owns every option key in both surfaces.** The bundled wizard proxies. There is no data-ownership split to defend.

That collapses the boundary question to a UI question: *should the React UI itself be shared, and if so, at which layer?*

Three honest options:

### (a) Self-contained React shell here, shared primitives via npm

Build the standalone settings screen in `src/admin-shell/screens/settings/` using the existing `newspack-components` npm package (`Button`, `TextControl`, `SelectControl`, `Card`, `ActionCard` are all there) plus core `@wordpress/components`. Newspack-plugin's bundled wizard keeps its existing UI; it stays the canonical surface in bundled mode and we accept short-term duplication of UI code.

- **Pro:** zero cross-repo coupling. Ships in this PR. Standalone parity is achievable with components publishers already see elsewhere in the Newspack stack.
- **Pro:** `newspack-newsletters` continues to be installable / shippable on its own without leaning on `newspack-plugin`'s internal `packages/components`.
- **Con:** the bundled wizard's settings UI and the standalone shell will drift unless we set norms about which is the "source of truth" UI.

### (b) Consolidate UI in newspack-newsletters, have newspack-plugin consume it

Move the bundled wizard's settings React into this plugin and have newspack-plugin's wizard render the bundled tab by mounting a component exported from `newspack-newsletters`'s build (or pulling it in via a shared package).

- **Pro:** single source of UI truth; no drift risk by construction.
- **Con:** large blast radius — touches newspack-plugin's wizard infrastructure, asset loading, and component-import boundaries. Well outside what NEWS-1931 was scoped to deliver.
- **Con:** introduces a new cross-repo build dependency (one direction or the other).

### (c) Extract composite UI to a shared component package

Move newsletter-specific composites (`SortableNewsletterListControl` is the obvious candidate) out of newspack-plugin's internal `packages/components` and into the public `newspack-components` npm package, then consume from both sides.

- **Pro:** middle ground. Real deduplication without merging admin chrome.
- **Con:** requires coordinated `newspack-components` releases and version pinning across both repos for every change. Today's composites aren't generic enough to land cleanly in a shared library without more refactoring.

## Recommendation — (a), with a follow-up

Ship the standalone shell as a self-contained React surface in this plugin, using `newspack-components` for primitives. Defer the consolidation question to a follow-up ticket.

Reasoning:

- The data layer is already unified — `newspack-newsletters` owns every option key on both sides. There is no integrity risk from "two UIs editing different things"; both UIs go through the same PHP entry points.
- The bundled wizard's settings UI is stable and ships today against a different audience (Newspack-managed sites). Touching it for parity reasons trades a working surface against a hypothetical drift problem.
- A consolidation pass (option b) is an admin-modernisation milestone follow-up, not a blocker for shipping standalone parity. The right time to consider it is once the bundled wizard's surrounding wizard chrome (currently provided by newspack-plugin) is itself due for renovation.
- Drift mitigation under (a) is procedural, not architectural: reviewers on either repo flag "UI added one side, missing the other" at PR time, and the inventory above stays in this doc as the parity reference.

## Implementation outline

For the same PR:

1. **Replace the screen registry placeholder.** New screen at `src/admin-shell/screens/settings/index.js`, swapped in at `src/admin-shell/screens/index.js:36`.
2. **REST surface.** New aggregated `GET/POST /newspack-newsletters/v1/admin-shell/settings` handles the provider + cross-cutting options + tracking in one round-trip (returns provider state + supported providers + OAuth state + options whitelist + JSON-safe schema; accepts partial provider/credentials/options writes with sanitisation, slug validation, and rollback on failure). Subscription lists keep the existing `GET/POST /newspack-newsletters/v1/lists` endpoint.
3. **Sections.** Four cards in this order:
   1. *Service provider* — provider select; per-ESP credential fields; OAuth banner with popup-flow when the provider exposes one.
   2. *Newsletter options* — slug, comments toggle, related-posts toggle (Jetpack-gated), provider-scoped extras (e.g. Mailchimp footer toggle), tracking pixel + click-tracking toggles. Render order: cross-cutting → provider-scoped → tracking.
   3. *Letterhead* — Letterhead API key in its own card.
   4. *Subscription lists* — list rows with active toggle + inline title/description (remote lists) or read-only meta (local lists). `Add new local list` CTA when the active ESP supports them.
4. **Letterhead key dependency.** The legacy classic settings page renders `Letterhead API Key` only when the Letterhead service-provider class is loaded. Replicate the gate.
5. **Capability check.** Page-level gate is already `manage_options`; REST routes use the existing `manage_options` permission callback. No new capability work.
6. **Visual baseline.** Match the layout idiom of the other admin-shell screens (NEWS-1928, 1930, 1951) — `<App label={…}>` wrapper, sectioned cards, save button per section or one global save bar. Pick whichever the Layouts and Newsletters lists set as the precedent. The choice does not constrain the boundary above; it's a stylistic call within (a).

## What lands in CONTEXT.md at PR time

A dated entry under *Decisions log*, summarising:

- Standalone settings shell ships as a self-contained surface here, using `newspack-components` primitives. No consolidation with the bundled wizard in this ticket.
- Both surfaces continue to edit the same option keys via the same PHP class — no data-ownership split.
- Drift between the two settings UIs is a known accepted state, mitigated by review discipline. Consolidation tracked as a follow-up.
