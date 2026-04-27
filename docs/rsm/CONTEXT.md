# Newsletter Modernisation — Shared Context

This document is the shared context for the RSM newsletter modernisation project (April–May 2026 and beyond). It captures the *why* behind decisions that aren't obvious from code — rationale, alternatives considered, constraints that shape the work.

It complements the [Linear project](https://linear.app/a8c/project/modernising-newspack-newsletters-f5816b49a457), which captures the *what* and the *who*.

## How to use this doc

- **Reading**: skim at the start of any session on this project. Five minutes here saves context bleed across sessions and across the Thomas/Raz handoff.
- **Writing**: every PR into `epic/newsletters-modernisation` should consider whether it introduces a decision, gotcha, learning, or shift in scope worth capturing here. If yes, update the relevant section in the same PR. If purely additive (a new gotcha, a closed open question), append to the **Decisions log** with a date prefix.
- **Tone**: terse but explanatory. Future readers won't have the conversation that produced each decision — they need the reasoning, not just the conclusion.

## Strategy

Replace the MJML rendering pipeline with [`woocommerce/email-editor`](https://packagist.org/packages/woocommerce/email-editor) — an Automattic-maintained PHP package; the same engine MailPoet uses.

**Why:** MJML is a structural problem, not a fixable bug. Every block edit drifts further from email output. WC email-editor produces email-safe HTML from a real Gutenberg post, so the editor and the email finally share a single source of truth. Validated via sandbox spike (see Artefacts): posts-inserter, share, and ad blocks all render correctly via ~60 lines of override code.

**Alternatives ruled out:**

- **react-email** — Node/React, doesn't fit Newspack's PHP runtime; doesn't solve the block→email mapping problem.
- **Own renderer** — too complex; would duplicate work that's already done in WC email-editor.
- **Patching MJML** — every previous attempt has hit "this is structural, not a bug". This RSM is the chance to fix it properly.

**Override pattern for impedance mismatches.** WC email-editor renderers don't always handle Newspack's block attributes correctly (the column percentage-width pixel bug is the first known example). Fixes live downstream, not upstream:

```php
namespace Newspack\Newsletters\Email_Renderers;

use Automattic\WooCommerce\EmailEditor\Integrations\Core\Renderer\Blocks\Column as WC_Column;

class Column extends WC_Column {
    // Override render_content to fix percentage-width handling.
}
```

**Hard constraint:** existing in-flight newsletters must keep rendering through MJML during migration. Drafts cannot be broken. Migration runs behind a feature flag with a dual-pipeline period.

**Parallel decision (not solved by replacing the PHP path):** the JS-side `mjml-browser` editor preview in `src/editor/mjml/index.js` also needs to be replaced — either with `@woocommerce/email-editor` JS, a server round-trip, or a hybrid.

## Workstreams and team

Three workstreams running in parallel:

1. **Editor refactor (MJML → WC email-editor)** — the headline. Shared between Thomas and Raz.
2. **Layouts UX rework** — design-led. Owned by Thomas.
3. **beehiiv ESP support** — stretch but in scope. Owned by Raz. The Texas Tribune has custom beehiiv integration code worth reviewing before building from scratch.

**Team and time constraints:**

- **Thomas Guillot** is Newspack's sole designer and can't fully step away from design support for a month. Active on the project throughout RSM, but time is split with ongoing time-sensitive grant-related design work.
- **Raz (`@chickenn00dle`)** is on publisher support in month 1; joins full-time in month 2.

**Practical implications:** front-load design and de-risking work in month 1 while there's at least some bandwidth. Pair on implementation in month 2 as Raz ramps up. Don't schedule Raz-required work in month 1.

## Artefacts

- **Linear project**: <https://linear.app/a8c/project/modernising-newspack-newsletters-f5816b49a457> (issues NEWS-1900 → NEWS-1917; milestones: De-risk / Editor refactor / Layouts UX / beehiiv / Validate)
- **Working branch**: `epic/newsletters-modernisation` off trunk on `Automattic/newspack-newsletters` (protected; no required reviews; feature branches PR into it for Copilot review and clean history; one final squash/merge into trunk at the end).
- **Slack channel**: `#rsm-newspack-newsletters`
- **P2 kick-off post**: <https://radicalupdates.wordpress.com/?p=9749>
- **Sandbox spike**: `.tmp-email-editor-test/` in this repo (untracked) — proof-of-concept renderers and end-to-end smoke test. Has its own `composer.json` with `woocommerce/email-editor: ^2.11`.
- **RSM initiative on Linear**: <https://linear.app/a8c/initiative/radical-speed-month-76b73fe95035> (target 2026-05-22)

## Decisions log

A running list of decisions made as the project progresses. Newest entries at the top.

- **2026-04-27** — Project kick-off. Strategy and team split established. WC email-editor confirmed as the replacement for MJML. Layouts UX rework + beehiiv ESP support added as parallel workstreams. 18 issues seeded across five milestones in Linear.

## Open questions

- Have we connected with the WC email-editor team about API stability, roadmap, and upstream PR policy? (NEWS-1902)
- What's the right approach for the JS-side editor preview replacement? (NEWS-1907)
- How much of Texas Tribune's custom beehiiv integration is reusable? (NEWS-1913)
