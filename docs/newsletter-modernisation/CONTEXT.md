# Newsletter Modernisation — Context

This document captures the *why* behind decisions for the newsletter modernisation work — rationale, alternatives considered, constraints that shape the work.

## How to use this doc

This is the contract for anyone — human or AI agent — working on this project:

1. **Before starting a session** on any branch in this project (the project epic, a milestone integration branch, or a per-ticket branch off either): read this doc in full. It tells you what's been decided and why, and which open questions still bind.
2. **Before opening a PR**: identify the right base branch (see *Branch structure* below — per-ticket PRs target their milestone branch, not the project epic). Decide whether your work introduces a decision, gotcha, learning, or shift in scope. If yes, update the relevant section and append a dated entry to the **Decisions log** in the same PR. If no context change applies, say so explicitly in the PR description (e.g. "No context change.").
3. **Tone:** terse but explanatory. Future readers won't have the conversation that produced each decision — they need the reasoning, not just the conclusion.

## Branch structure

Three tiers:

- **`epic/newsletters-modernisation`** — the project epic. Receives only milestone-integration merges. Ultimately merges to `trunk`.
- **`epic/<milestone>`** — one integration branch per Linear milestone (e.g. `epic/admin-ux-modernisation`, `epic/editor-refactor`, `epic/beehiiv`, `epic/de-risk`, `epic/validate`). Receives per-ticket PRs and is QA'd as a coherent unit before promoting to the project epic. Naming: kebab-case version of the Linear milestone name.
- **`news-<id>-<slug>`** — per-ticket branch cut from its milestone integration branch. PRs target the milestone branch.

**Why three tiers.** Newsletters are critical and the modernisation is wide-ranging. We want each milestone to land on the project epic only after it's been tested as a unit (cross-ticket integration, regression sweep, manual UAT). Per-ticket review still happens via individual PRs into the milestone branch — Copilot review, lint, tests — so nothing skips the per-ticket gate.

**Promoting a milestone:** once a milestone branch is fully QA'd, open a single PR `epic/<milestone>` → `epic/newsletters-modernisation`. Treat that PR as the integration-test gate.

**Promoting the project:** once the project epic is ready, open a final PR `epic/newsletters-modernisation` → `trunk`. The pre-merge checklist for that step lives in `AGENTS.md`.

**Creating a new milestone integration branch.** When you cut a fresh `epic/<milestone>` from the project epic, also configure repo settings so PRs into it follow the same convention as the project epic:

- **Branch protection:** waive the review-required rule for `epic/<milestone>` (or use a glob pattern like `epic/*` so all integration branches inherit the waiver). Without this, PRs into the new milestone branch are `BLOCKED` by the org-default review-required rule even though Copilot review passes — the per-ticket gate is the Copilot pass at PR time, not a CODEOWNERS approval.
- **CODEOWNERS:** the empty stub on the project epic is inherited automatically when you branch, so no separate action is needed.

Reasoning: long-running integration branches (the project epic and milestone branches alike) intentionally accumulate per-ticket PRs without per-PR human approval. The integration-test gate is the *promotion* PR (milestone → epic, then epic → trunk), not the individual tickets. See the `2026-04-27` Decisions log entry for the original rationale on the project epic.

## Strategy

Replace the MJML rendering pipeline with [`woocommerce/email-editor`](https://packagist.org/packages/woocommerce/email-editor) — an actively maintained PHP package; the same engine MailPoet uses.

**Why:** MJML is a structural problem, not a fixable bug. Every block edit drifts further from email output. WC email-editor produces email-safe HTML from a real Gutenberg post, so the editor and the email finally share a single source of truth. Validated via sandbox spike: posts-inserter, share, and ad blocks all render correctly via ~60 lines of override code.

**Alternatives ruled out:**

- **react-email** — Node/React, doesn't fit the PHP runtime; doesn't solve the block→email mapping problem.
- **Own renderer** — too complex; would duplicate work that's already done in WC email-editor.
- **Patching MJML** — every previous attempt has hit "this is structural, not a bug".

**Override pattern for impedance mismatches.** WC email-editor renderers don't always handle Newspack's block attributes correctly (column percentage-width pixel handling is the first known example). Fixes live downstream:

```php
namespace Newspack\Newsletters\Email_Renderers;

use Automattic\WooCommerce\EmailEditor\Integrations\Core\Renderer\Blocks\Column as WC_Column;

class Column extends WC_Column {
    // Override render_content to fix percentage-width handling.
}
```

**Rollout: dual pipelines behind a feature flag, not a big-bang switch.** Newsletters are brittle and critical — a phased rollout is the safe path. Both pipelines coexist for a soak period:

- New newsletters created with the flag enabled opt into the WC pipeline.
- Existing in-flight newsletters and drafts continue rendering through MJML and must not break.
- A documented migration path lets publishers switch deliberately when ready.
- The flag stays in place until block-by-block QA and email-client testing pass; only then is MJML removed.

**Parallel decision (not solved by replacing the PHP path):** the JS-side `mjml-browser` editor preview in `src/editor/mjml/index.js` also needs to be replaced — either with `@woocommerce/email-editor` JS, a server round-trip, or a hybrid.

## Workstreams

Three workstreams running in parallel:

1. **Editor refactor (MJML → WC email-editor)** — the headline.
2. **Admin UX modernisation** — convert the entire Newsletters admin to React, mirroring `newspack-plugin`'s pattern: DataViews for list surfaces (newsletters CPT, layouts, newsletter ads), React shells elsewhere (settings, layouts authoring), shared scaffolding via `newspack-components`. Layouts becomes a first-class section with its own admin menu and a DataView for management — distinct from the layout-picker / authoring UX nested inside it. Works in both modes: bundled (alongside `newspack-plugin`) and standalone. When `newspack-plugin` is active, its existing Engagement > Newsletters settings page remains canonical; standalone mode is owned by the React settings shell here. Shared components prevent drift between the two settings surfaces.
3. **beehiiv ESP support** — exploring beehiiv as an additional Email Service Provider alongside the existing ones (Mailchimp, ActiveCampaign, Constant Contact).

## Decisions log

A running list of decisions made as the project progresses. Newest entries at the top.

- **2026-04-29** — **NEWS-1928 — newsletters list replaces the CPT list at the menu-registration level, not via WP_List_Table override.** The auto-generated `edit.php?post_type=newspack_nl_cpt` "All Newsletters" submenu is **kept** as the visible click target; the chassis registers `Newsletters_List_Page` as a **hidden submenu** (`parent=null`) and 302s the legacy URL to the React page via `current_screen`. Why keep the auto submenu rather than replace it: when newspack-plugin's `Newsletters_Wizard` is active, it only recognises URLs that start with `?post_type=newspack_nl_cpt` (its `admin_screens` map). Removing the auto submenu sent WP's first-submenu URL fallback to `admin.php?page=…`, which dropped the Newspack admin-header chrome on top-level menu clicks. `parent_file`/`submenu_file` filters keep the sidebar highlighted on our hidden React page. The list page registers in **both** modes (bundled and standalone) — only Settings remains mode-gated.
- **2026-04-29** — **Status logic lives server-side via a single REST field, not re-derived in JS.** `Newsletters_List_REST::get_status_for_post` returns `{ kind: 'sent' | 'scheduled' | 'draft' | 'trash', sent_at, scheduled_at }` consolidating `post_status`, `Newspack_Newsletters::is_newsletter_sent()`, the WP-scheduled `post_status=future` case, and the `sending_scheduled` meta flag set during ESP dispatch. The DataView's Status column reads `kind` directly. The status **filter**, however, maps to native `post_status` (`publish,private` for "Sent", `future` for "Scheduled", etc.) so server-side filtering stays cheap; the rendering/filter-target mismatch is intentional and visually acceptable.
- **2026-04-29** — **No bulk publish / status-change actions on the list.** The base service-provider class hooks `transition_post_status` to dispatch ESP campaigns — bulk publishing or making private would be irreversible. The DataView exposes only `Edit`, `View public page`, `Make newsletter pages public` / `non-public`, `Trash`, `Restore`, and `Delete permanently`. **Restore** PATCHes `status: 'draft'` for every row; `Newspack_Newsletters_Service_Provider::insert_post_data` then leaves never-sent rows as drafts and forces already-sent rows back to their controlled status (`publish`/`private` per `is_public`). The two `is_public` toggle actions are not purely meta-only: on a `publish`/`private` newsletter they go through `Newspack_Newsletters_Service_Provider::updated_post_meta`, which calls `wp_update_post` and fires `transition_post_status` between `publish` and `private`. They are still safe because the provider's send guard short-circuits when `is_newsletter_sent()` is truthy on already-published rows — so the transition doesn't dispatch a fresh campaign. Status changes that *would* trigger sends (anything reaching `publish`/`private` from a non-sent state) happen exclusively in the post editor where the existing pre-send confirmation guards apply.
- **2026-04-29** — **`@wordpress/dataviews/wp` over `@wordpress/dataviews`.** `/wp` is a self-contained pre-bundled artefact pre-wired for WordPress admin (themed dropdowns, action menus using `@wordpress/components`, unlock-helper for experimental APIs). React is the only peer; no `@wordpress/components`/`@wordpress/i18n` peer alignment to manage. Newspack-story-budget uses the same path.
- **2026-04-29** — **Chassis gains `<PageHeader>` + `useHeaderActions(actions)` hook backed by React context, not a Redux store.** Action shape mirrors `newspack-plugin`'s wizard `setHeaderData({ sectionName, actions })` exactly (`{ type: 'primary' | 'secondary', label, icon?, href?, onClick? }`) so a future consolidation against `newspack-components` is mechanical. Local context keeps the chassis thin — no `@wordpress/data` store registration, no slot fills.
- **2026-04-29** — **Send-list column shows raw IDs in v1.** Resolving `send_list_id` / `send_sublist_id` to friendly names requires a per-provider lookup (`Send_Lists::api_get_send_lists`) that hits the ESP API; a list-fetch round-trip per page render is too expensive without batched/cached resolution. Captured as follow-up work — the list still renders the meta IDs as `<code>` so the column is informative, just not pretty.
- **2026-04-29** — **Milestone integration branches need their own branch-protection waiver.** Discovered when trying to merge PR #2091 into the freshly-created `epic/admin-ux-modernisation`: the merge was `BLOCKED` by the org-default review-required rule because the project epic's review waiver doesn't propagate to new branches. CODEOWNERS does inherit (the empty stub is a file on the branch) but branch-protection rules are repo-config, set per branch or via a glob pattern. Documented the configuration step in *Branch structure* and mirrored the reminder in `AGENTS.md` so future milestone branches are set up at creation time. Recommendation: configure the rule once with a glob like `epic/*` so all integration branches inherit the waiver automatically.
- **2026-04-29** — **Adopted three-tier branching as a project-wide convention.** Each Linear milestone gets its own `epic/<milestone>` integration branch (kebab-case) cut from `epic/newsletters-modernisation`; per-ticket branches target the milestone branch; a single promotion PR moves a fully-QA'd milestone up to the project epic. First instance: `epic/admin-ux-modernisation`. Reasoning: per-ticket gates (Copilot review, lint, tests) still happen at PR time, but the project epic only sees integration-tested units, which is what we need given how brittle the newsletter pipeline is. See *Branch structure* above for the full mechanics.
- **2026-04-29** — **NEWS-1927 chassis: do not displace the existing menu structure.** Initial pass replaced the Newsletters CPT-as-menu with its own top-level menu plus four placeholder submenus, which dropped the auto-generated *All Newsletters* and *Add Newsletter* entries and changed the menu's vertical position. Corrected to keep the CPT's default top-level menu intact (so *All Newsletters*, *Add New*, taxonomies, and the existing Ads submenu all return) and have the chassis register its own pages as **submenus of the CPT menu**. Only the Settings placeholder ships in NEWS-1927 (last in the submenu list, standalone-only); NEWS-1928 to NEWS-1931 each register their own page when they have a real surface to ship. The classic Settings page (`Newspack_Newsletters_Settings::add_plugin_page`) is registered with `parent_slug = 'edit.php?post_type=newspack_nl_cpt'` and immediately hidden via `remove_submenu_page` so its URL keeps resolving while the React Settings placeholder owns the visible submenu slot — the placeholder links through to the classic URL so ESP credential editing remains reachable until NEWS-1931. The NEWS-1928 list page took a different approach (`parent=null` + parent_file/submenu_file filters); see the newer entry for that rationale.
- **2026-04-29** — **NEWS-1927: admin shell shipped as a thin chassis**, not a port of `newspack-plugin`'s `Wizard` scaffold. Closer to `newspack-popups`' settings pattern: a single React mount per `?page=` slug with no `HashRouter` at the chassis level — each screen introduces its own internal routing if it needs to. Chassis owns: page base class, shared bundle enqueue, single localised global, and standalone-vs-bundled detection. Bundled-mode detection is filterable: `newspack_newsletters_admin_bundled_mode` (default: `class_exists( '\Newspack\Newspack' )`), so sites can override either way for testing.
- **2026-04-29** — Expanded the UX workstream from "Layouts UX rework" to **Admin UX modernisation**. Scope is now the entire Newsletters admin in React (DataViews + React shells), aligned with `newspack-plugin`'s pattern. Layouts becomes a first-class section nested inside the broader migration with its own admin menu and DataView. Standalone-vs-bundled parity is called out explicitly so design accounts for both deployment modes from the start.
- **2026-04-28** — Confirmed phased rollout via dual pipelines + feature flag, not a big-bang cutover. New newsletters created with the flag enabled opt into the WC pipeline; existing drafts continue rendering through MJML; the flag stays until block-by-block QA and email-client testing pass. The rollout work is captured as a dedicated work item in the Editor refactor backlog.
- **2026-04-28** — Added an epic-only addendum to `AGENTS.md` pointing agents at this doc as the authoritative contract for sessions on `epic/newsletters-modernisation`. **When merging epic → trunk, remove the addendum** — see the inline marker in `AGENTS.md` ("Epic branch addendum").
- **2026-04-27** — Project kick-off. WC email-editor confirmed as the replacement for MJML, with the downstream override pattern for impedance mismatches.
- **2026-04-27** — Overrode `.github/CODEOWNERS` on this branch (emptied to a comment-only file) to skip auto-review requests from `@Automattic/newspack-product` during long-running iteration on the epic. **When merging epic → trunk, restore the original rule (`* @Automattic/newspack-product`)** — the `.github/CODEOWNERS` file on this branch carries an inline reminder for whoever performs the merge.

## Known gaps / follow-ups

Capabilities the React surfaces don't yet match against WP's classic admin views, captured here so future iterations can decide whether to close them. Not blockers for the current epic, but worth weighing if publisher feedback flags any.

- **Quick Edit / Bulk Edit parity (NEWS-1932).** The classic CPT list lets users update categories, tags, author, status, and other fields inline (per-row Quick Edit, multi-row Bulk Edit). The React DataView ships with bulk *Trash / Restore / Delete permanently / Make public / Make non-public* but no taxonomy/author bulk editing. Real-world usage is unclear — worth measuring before investing in a Bulk Edit modal. If we add it, the obvious shape is a DataView bulk action that opens a modal with a small subset of editable fields, then PATCHes each selected post via REST. Status changes stay off the table for the same reason they're not a per-row action: `transition_post_status` to `publish`/`private` dispatches the ESP campaign.
- **NEWS-1928 list — Send-list column shows raw IDs.** Friendly-name resolution needs a per-provider lookup that hits the ESP API; deferred pending a batched / cached approach (covered in the Decisions log entry for v1).
- **NEWS-1928 list — Public-page filter has no inline counts.** Classic WP shows "Trash (3)" segmented links; the DataView dropdown elides counts. Polish if/when publishers ask.

## Open questions

- API stability and roadmap for the WC email-editor package; channels for upstream contribution.
- Best approach for the JS-side editor preview replacement (adopt `@woocommerce/email-editor` JS, server round-trip, or hybrid).
- How to translate per-newsletter theme settings stored in post-meta to the `theme.json` shape WC's renderer expects.
- Boundary for shared settings components between standalone (`newspack-newsletters` alone) and bundled (alongside `newspack-plugin`) modes — what's shareable, what stays repo-local, and where the canonical surface lives in each mode.
