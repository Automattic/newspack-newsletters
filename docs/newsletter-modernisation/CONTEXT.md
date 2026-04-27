# Newsletter Modernisation — Context

This document captures the *why* behind decisions for the newsletter modernisation work — rationale, alternatives considered, constraints that shape the work.

## How to use this doc

- Read at the start of any session on this project.
- Every PR into `epic/newsletters-modernisation` should consider whether it introduces a decision, gotcha, learning, or shift in scope worth capturing here. If yes, update the relevant section in the same PR. If purely additive (a new gotcha, a closed open question), append to the **Decisions log** with a date prefix.
- Tone: terse but explanatory. Future readers won't have the conversation that produced each decision — they need the reasoning, not just the conclusion.

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

**Hard constraint:** existing in-flight newsletters must keep rendering through MJML during migration. Drafts cannot be broken. Migration runs behind a feature flag with a dual-pipeline period.

**Parallel decision (not solved by replacing the PHP path):** the JS-side `mjml-browser` editor preview in `src/editor/mjml/index.js` also needs to be replaced — either with `@woocommerce/email-editor` JS, a server round-trip, or a hybrid.

## Workstreams

Three workstreams running in parallel:

1. **Editor refactor (MJML → WC email-editor)** — the headline.
2. **Layouts UX rework** — design-led; making layout management feel like a first-class part of authoring a newsletter.
3. **beehiiv ESP support** — exploring beehiiv as an additional Email Service Provider alongside the existing ones (Mailchimp, ActiveCampaign, Constant Contact).

## Decisions log

A running list of decisions made as the project progresses. Newest entries at the top.

- **2026-04-27** — Project kick-off. WC email-editor confirmed as the replacement for MJML, with the downstream override pattern for impedance mismatches.
- **2026-04-27** — Overrode `.github/CODEOWNERS` on this branch (emptied to a comment-only file) to skip auto-review requests from `@Automattic/newspack-product` during long-running iteration on the epic. **When merging epic → trunk, restore the original rule (`* @Automattic/newspack-product`)** — the `.github/CODEOWNERS` file on this branch carries an inline reminder for whoever performs the merge.

## Open questions

- API stability and roadmap for the WC email-editor package; channels for upstream contribution.
- Best approach for the JS-side editor preview replacement (adopt `@woocommerce/email-editor` JS, server round-trip, or hybrid).
- How to translate per-newsletter theme settings stored in post-meta to the `theme.json` shape WC's renderer expects.
