# Newsletter Modernisation — Context

This document captures the *why* behind decisions for the newsletter modernisation work — rationale, alternatives considered, constraints that shape the work.

## How to use this doc

This is the contract for anyone — human or AI agent — working on this project:

1. **Before starting a session** on any branch in this project (the project epic, a milestone integration branch, or a per-ticket branch off either): read this doc in full. It tells you what's been decided and why, and which open questions still bind.
2. **Before opening a PR**: identify the right base branch (see *Branch structure* below — per-ticket PRs target their milestone branch, not the project epic). Per-ticket rationale belongs in the PR description (and Linear ticket), not here. Only update this doc if your work changes strategy, branch structure, or surfaces a cross-cutting gotcha future agents would lose hours rediscovering. Otherwise say "No context change." in the PR description.
3. **Tone:** terse. Gotcha entries should be one short paragraph with a PR link; the PR holds the full rationale.

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

Reasoning: long-running integration branches (the project epic and milestone branches alike) intentionally accumulate per-ticket PRs without per-PR human approval. The integration-test gate is the *promotion* PR (milestone → epic, then epic → trunk), not the individual tickets.

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

## Gotchas

Cross-cutting traps an agent would lose hours rediscovering from code alone. Per-ticket rationale lives in Linear and the merged PR — browse [merged PRs targeting `epic/admin-ux-modernisation`](https://github.com/Automattic/newspack-newsletters/pulls?q=is%3Apr+base%3Aepic%2Fadmin-ux-modernisation+is%3Amerged) for that history.

- **`transition_post_status` to `publish` / `private` dispatches the ESP campaign (irreversible)**. The service-provider base class hooks the transition; bulk publishing or any path that flips status from draft is a send. Lists expose only Trash / Restore / Delete / Make public / Make non-public. ([NEWS-1928 / #2095](https://github.com/Automattic/newspack-newsletters/pull/2095))
- **Emotion CSS-in-JS doesn't reach Gutenberg's canvas iframe.** `@emotion/sheet:46` uses the global `document.createElement`, so portaling `@wordpress/components` (`TextControl`, `RadioControl`, etc.) into the iframe silently breaks their styles. `CacheProvider` with `container: iframeDoc.head` is broken in emotion 11.14. ([NEWS-2221 / #2132](https://github.com/Automattic/newspack-newsletters/pull/2132))
- **Hidden React pages must register under two hooknames.** `add_submenu_page(parent, …)` registers under WP's computed hookname but `admin.php`'s URL-derived lookup falls back to `admin_page_<slug>`; mirror hidden pages under both or the page 500s with "Cannot load X". ([NEWS-1928 / #2095](https://github.com/Automattic/newspack-newsletters/pull/2095))
- **Admin-shell pages don't enqueue `wp-block-editor`.** BlockPreview-using surfaces must inline the rules they need; enqueuing the full sheet (~250KB) was rejected. ([NEWS-2198 / #2125](https://github.com/Automattic/newspack-newsletters/pull/2125))
- **Use `rest_request_before_callbacks` to block term updates, not `rest_pre_insert_<taxonomy>`.** `WP_REST_Terms_Controller::update_item` doesn't `is_wp_error()` the prepared value and silently demotes the term to top-level (returns 200). ([NEWS-1951 / #2097](https://github.com/Automattic/newspack-newsletters/pull/2097))
- **DataViews lists' meta-based sorts must use a LEFT-JOIN `posts_clauses` filter, not WP's `meta_key + orderby=meta_value*`.** The pass-through INNER-joins postmeta and silently drops rows missing the key (fresh ads / ads with no tracking activity disappear on column-header click). ([NEWS-2196 / #2119](https://github.com/Automattic/newspack-newsletters/pull/2119))
- **Filter-dropdown population uses a single consolidated `/filter-options` endpoint gated by `edit_posts`**, not three standard WP REST collections. `/wp/v2/users` is `list_users`-gated (admin-only, would leave editors with empty Author dropdown) and capped at `per_page=100`. ([NEWS-2197 / #2121](https://github.com/Automattic/newspack-newsletters/pull/2121))
- **DataViews CSS imports via SCSS `@import "@wordpress/dataviews/build-style/style.css"`, not a JS import.** The package declares `sideEffects: false`, so a JS import is silently tree-shaken; sass-loader resolves through webpack and inlines the CSS, bypassing the flag. ([NEWS-2088 / #2104](https://github.com/Automattic/newspack-newsletters/pull/2104))
- **`newspack-components`' wizard barrel import re-registers `newspack/wizards` on every load.** Worked around with a `NormalModuleReplacementPlugin` stub matching an internal `dist/esm/wizard/index.js` path — fragile to any major `dist/` reorganisation. ([NEWS-2200 / #2122](https://github.com/Automattic/newspack-newsletters/pull/2122))
- **`@wordpress/dataviews/wp`, not `@wordpress/dataviews`.** `/wp` is pre-bundled for WordPress admin (themed dropdowns, action menus via `@wordpress/components`, unlock-helper for experimental APIs).

## Process rules

- **Milestone integration branches need their own branch-protection waiver.** Configure with a glob like `epic/*` so all integration branches inherit; without it, PRs into a new milestone branch are `BLOCKED` by the org-default review-required rule even though Copilot review passes. See *Branch structure* above and the pre-merge checklist in `AGENTS.md`.
- **Epic-only `AGENTS.md` addendum + `.github/CODEOWNERS` stub.** Scaffolding for long-running iteration; pre-merge checklist in `AGENTS.md` covers removing both when merging epic → trunk.
- **When you hit build / tooling friction in this repo, grep `newspack-plugin` for the same symptom first** — both share `newspack-scripts`, so solutions transfer 1:1.

## Known gaps / follow-ups

Capabilities the React surfaces don't yet match against WP's classic admin views, captured here so future iterations can decide whether to close them. Not blockers for the current epic.

- **NEWS-1932 — Quick Edit / Bulk Edit parity (newsletters).** Classic CPT list lets users bulk-edit categories / tags / author / status; the React DataView only exposes Trash / Restore / Delete / Make public / Make non-public. Status changes stay off the table — `transition_post_status` to `publish` / `private` dispatches the ESP campaign.
- **NEWS-1933 — Bulk Edit parity (ads).** Same posture as NEWS-1932. Author / status are intentionally out of scope.
- **NEWS-1952 — Empty-state retrofit.** NEWS-1951 introduced the `EmptyState` chassis component; Newsletters and Ads list retrofits remain on NEWS-1952. Ad Placement is **not** a candidate (`show_ui` / `show_in_menu` false).
- **NEWS-1928 — Send-list column shows raw IDs.** Friendly-name resolution needs a per-provider lookup; deferred pending a batched / cached approach.
- **NEWS-1928 — Public-page filter has no inline counts** (classic WP shows "Trash (3)" segmented links).
- **NEWS-2037 cosmetic gaps** — author column blank when `post_author = 0`; ads list Categories column lacks a filter; advertisers `PATCH` with `parent=<descendant_id>` returns 200 but `wp_update_term_parent` silently demotes (UI prevents it, but a third-party REST caller would see a misleading 200).

## Open questions

- API stability and roadmap for the WC email-editor package; channels for upstream contribution.
- Best approach for the JS-side editor preview replacement (adopt `@woocommerce/email-editor` JS, server round-trip, or hybrid).
- How to translate per-newsletter theme settings stored in post-meta to the `theme.json` shape WC's renderer expects.
- Boundary for shared settings components between standalone (`newspack-newsletters` alone) and bundled (alongside `newspack-plugin`) modes — what's shareable, what stays repo-local, and where the canonical surface lives in each mode.
