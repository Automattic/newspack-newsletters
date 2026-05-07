# NEWS-2152 — Bundled-mode parity for the local-list modal

Design spec for the cross-repo work that brings NEWS-2093's local-list create / edit / delete modal into bundled mode (newspack-plugin's Engagement → Newsletters → Settings wizard).

Companion to:

- Linear: [NEWS-2152](https://linear.app/a8c/issue/NEWS-2152)
- Project context: [`CONTEXT.md`](./CONTEXT.md)
- NEWS-1931 settings discovery (architectural prior): [`news-1931-settings-discovery.md`](./news-1931-settings-discovery.md)

## Goal

Make the local-list CRUD modal shipped in NEWS-2093 reachable in bundled mode without consolidating the whole Subscription Lists card. Keep the wizard's `<SubscriptionLists>` ActionCard chrome and per-row toggle UI in newspack-plugin unchanged. Share only the modal and the delete-confirmation dialogue across modes. Establish a documented extension surface so newspack-plugin can render in-modal UI (e.g. a future featured-image picker) and run async post-save side effects.

## Non-goals

- Consolidating the surrounding `<SubscriptionLists>` chrome or per-row toggle UX. Cosmetic and structural divergence between modes is accepted (NEWS-1931 posture).
- Retiring `Subscription_Lists::get_add_new_url()`. Helper has consumers outside this ticket's scope (legacy classic-PHP standalone settings page in this repo, audience wizard in newspack-plugin). Removal is a separate cleanup once those surfaces also migrate.
- Multi-provider settings access from the modal. The legacy CPT editor stays the canonical home for that, reachable via direct URL — same posture as NEWS-2093 in standalone mode.
- Quick Edit / Bulk Edit parity for the lists section.

## Architecture

Two independent React trees (the wizard's, this plugin's) communicate through `document`-level custom events. No npm coupling, no shared webpack alias, no slot-fill timing dependency. The bridge JS is enqueued only on the bundled-mode wizard page; the standalone shell continues to mount `<LocalListModal>` directly via React composition with no event plumbing.

Three moving parts:

1. **newspack-plugin wizard** — small, surgical change in `<SubscriptionLists>` (`src/wizards/newsletters/views/settings/index.js`). For `type === 'local'` rows, replace the legacy `<ExternalLink edit_link>` with link-styled Edit + Delete buttons; switch the Add New `<Button href>` to `<Button onClick>`. Each click dispatches a documented `CustomEvent` on `document`. A `useEffect` listener reloads the wizard's lists on `local-list-saved` / `local-list-deleted`.
2. **newspack-newsletters bridge bundle** — new build entry `src/wizard-bridge/`. On boot, mounts a `<LocalListModalHost>` at body level. The host listens for the `open-local-list-modal` and `open-local-list-confirm-delete` events, renders `<LocalListModal>` (existing) or the lifted `<LocalListDeleteModal>` via React portal, and dispatches `local-list-saved` / `local-list-deleted` after REST success.
3. **PHP enqueue gate** — new class `Newspack\Newsletters\Wizard_Bridge`. Detects the bundled-mode wizard screen (`?page=newspack-newsletters-wizard`, screen ID match) on the `current_screen` action. Enqueues the bridge JS + CSS and localises auth bits. No-ops when newspack-plugin isn't active.

Why event-driven over slot-fill: slot-fill needs the wizard to render slots that this plugin's bundle later fills — registration timing is fragile and the slot names become a public API. Document events are dumber, asynchronous, and let either bundle load in any order. Cross-bundle React-tree composition isn't required for any of the visual work in scope.

## Components

### Files added — newspack-newsletters JS

| File | Purpose | Approx lines |
|---|---|---|
| `src/wizard-bridge/index.js` | Bundle entry. On mount, registers the host at body level. Detects the screen via `newspack_newsletters_wizard_bridge` localised global; no-ops if missing. Idempotent. | 30 |
| `src/wizard-bridge/local-list-modal-host.js` | Host component. Listens for the `open-` events. Renders `<LocalListModal>` or `<LocalListDeleteModal>` via portal. Dispatches `local-list-saved` / `local-list-deleted` on REST success. | 90 |
| `src/wizard-bridge/events.js` | Single source of truth for event names + `detail` shapes. Imported by host and (for symmetry) by any consumer importing the shim. | 25 |
| `src/wizard-bridge/extensions.js` | Modal extension registry. Exposes `registerLocalListModalExtension(id, definition)` + `getLocalListModalExtensions()`. Drains a pre-bridge queue on init so cross-bundle registration is order-independent. | 50 |
| `src/wizard-bridge/style.scss` | Audience-picker SCSS isolated for the bridge bundle (the modal needs it; standalone shell already inlines it). | 20 |
| `src/wizard-bridge/local-list-modal-host.test.js` | Jest — open events mount the right modal; saved/deleted events fire after REST success; close on success. | 150 |
| `src/wizard-bridge/extensions.test.js` | Registry: register, retrieve, queue-drain semantics, duplicate-id replacement with warning. | 80 |
| `src/wizard-bridge/index.test.js` | Idempotent boot; early return when localised global missing. | 40 |

### Files refactored — newspack-newsletters JS

| File | Change |
|---|---|
| `src/admin-shell/screens/settings/lists-section.js` | Lift the inline delete-confirmation `<Modal>` out into `local-list-delete-modal.js` so both the standalone shell and the new mount host can render it without duplicating JSX. Pure extraction, no behavioural change. |
| `src/admin-shell/screens/settings/local-list-delete-modal.js` (new file from extraction) | The lifted component. Same UX as today — title, copy, Cancel, Delete (busy state, error notice). |
| `src/admin-shell/screens/settings/local-list-modal.js` | Read extensions from the registry on mount; render extensions' `render(ctx)` after the built-in fields. After successful POST/PATCH and before close, await `Promise.allSettled(extensions.map(ext => ext.onSave?.(ctx)))`; report any rejections via a snackbar. |

### Files added — newspack-newsletters PHP

| File | Purpose |
|---|---|
| `includes/class-wizard-bridge.php` | Class `Newspack\Newsletters\Wizard_Bridge`. Hooks `current_screen`. Detects bundled-mode wizard via `class_exists( '\Newspack\Newspack' )` + screen ID match against `Newsletters_Wizard`'s registered slug. Enqueues bridge JS + CSS. Localises `newspack_newsletters_wizard_bridge` with `{ debug }` (presence marker only). |

### Files refactored — newspack-plugin

| File | Change |
|---|---|
| `src/wizards/newsletters/views/settings/index.js` | In `<SubscriptionLists>`: for `type === 'local'` rows, replace `actionText={ <ExternalLink href={ list.edit_link } /> }` with an `<HStack>` of Edit + Delete buttons. Add New becomes `<Button onClick>` (preserves the `lockedLists` / `inFlight` disabled state). Click handlers dispatch the documented events. New `useEffect` listens for `local-list-saved` and `local-list-deleted` on `document` and calls `fetchLists()`. |
| `src/wizards/newsletters/views/settings/index.test.js` (new) | Covers the dispatch-on-click + listener-reload behaviour. |

### Files unchanged

`Subscription_Lists::get_add_new_url()` and the `new_subscription_lists_url` field in `Newsletters_Wizard::wizards_data()` are deliberately untouched. The wizard JS simply stops reading the URL once the new code ships in newspack-plugin; the field becomes vestigial. Other consumers (audience wizard, legacy PHP page) keep working.

## Data flow

### Initial enqueue (bundled-mode wizard page)

1. `Newspack\Newsletters\Wizard_Bridge::on_current_screen` runs on `current_screen`. Returns early unless `class_exists( '\Newspack\Newspack' )` and the current screen ID matches the wizard registration.
2. Enqueues `wizard-bridge.js` + `wizard-bridge.css` (built via newspack-scripts).
3. Localises `newspack_newsletters_wizard_bridge` with `{ debug }` only — a presence marker so the bundle entry can early-return when missing. WP admin pages already configure `wp.apiFetch` with the right nonce + root, so the bridge does not need to re-localise auth. Audience and lists data continue to load lazily through `<LocalListModal>`'s existing `apiFetch` calls.
4. The bridge JS boots, mounts `<LocalListModalHost>` into a body-level `<div>` via `wp.element.render`. Re-mount no-ops.

### Add new (bundled wizard)

```
[user clicks Add New]
  → wizard's <SubscriptionLists> dispatches CustomEvent
    'newspack-newsletters:open-local-list-modal' detail: { mode: 'add' }
  → host listens, renders <LocalListModal list={null} … />
  → modal apiFetches /lists/audiences (existing behaviour)
  → user submits; modal POSTs /newspack-newsletters/v1/lists/local
  → on success: host awaits any registered extension onSave callbacks
  → host dispatches 'newspack-newsletters:local-list-saved'
    detail: { listId, mode: 'add', list }
  → host closes modal
  → wizard's useEffect listener fires fetchLists() and re-renders
```

### Edit existing (bundled wizard)

```
[user clicks Edit on a local row]
  → wizard dispatches 'open-local-list-modal'
    detail: { mode: 'edit', list: <list object from wizard state> }
  → host renders <LocalListModal list={list} … />
  → user edits, submits; modal PATCHes /lists/local/<id>
  → on success: extension onSave callbacks await
  → host dispatches 'local-list-saved' detail: { listId, mode: 'edit', list }
  → wizard reloads
```

### Delete (bundled wizard)

```
[user clicks Delete on a local row]
  → wizard dispatches 'newspack-newsletters:open-local-list-confirm-delete'
    detail: { list }
  → host renders <LocalListDeleteModal list={list} … />
  → user confirms; host DELETEs /lists/local/<id>
  → on success: host dispatches 'local-list-deleted' detail: { listId }
  → wizard reloads
```

### Standalone shell (untouched)

```
[user clicks Add New / Edit / Delete in <ListsSection>]
  → setModalState(...) — pure React state, no events
  → renders <LocalListModal> or inline delete <Modal>
  → on success: parent's reloadLists()
```

The bridge JS is **only loaded on the wizard page**. The standalone shell keeps `<LocalListModal>` mounted via direct React composition. No event plumbing. No regression risk for the surface NEWS-2093 just shipped.

### Concurrency posture

- Two clicks in flight: `<LocalListModal>`'s existing `isBusy` state blocks repeated submits.
- Two browser tabs: REST endpoints are last-write-wins, same as today.
- Click on Edit while a Save is in flight: the wizard's `<SubscriptionLists>` already disables row actions when `inFlight`. The host's modal also has its own busy-state. Both layers cooperate.

## Extension contract

Two complementary surfaces, both shipped in this PR:

### (A) Document events

For extensions that don't need in-modal UI. Bubbling on `document`. `events.js` exports the canonical names.

| Event name | Direction | Payload | Fires when |
|---|---|---|---|
| `newspack-newsletters:bridge-mounted` | Bridge → Wizard | `{}` | Host mounts for the first time. Wizard caches the ping so subsequent click handlers can skip the load-fallback timer. |
| `newspack-newsletters:open-local-list-modal` | Wizard → Bridge | `{ mode: 'add' \| 'edit', list: object \| null }` | User clicks Add New or per-row Edit |
| `newspack-newsletters:open-local-list-confirm-delete` | Wizard → Bridge | `{ list: object }` | User clicks per-row Delete |
| `newspack-newsletters:local-list-saved` | Bridge → Wizard + extensions | `{ listId, mode, list }` | After successful POST/PATCH and after extension `onSave` callbacks settle, before modal closes |
| `newspack-newsletters:local-list-deleted` | Bridge → Wizard + extensions | `{ listId }` | After successful DELETE |

### (B) Modal extension registry

For extensions that need in-modal UI and / or a post-save async side effect. Module: `src/wizard-bridge/extensions.js`.

```js
window.newspack.newsletters.registerLocalListModalExtension( id, {
  // Required: JSX rendered after the built-in fields, inside the modal's <form>.
  render: ( ctx ) => JSX,

  // Optional: async callback invoked after a successful POST/PATCH and before
  // the modal closes. Errors surface as a snackbar; the underlying list save
  // is not rolled back.
  onSave: async ( ctx ) => { /* ... */ },
} );
```

`render` `ctx`: `{ list, mode, isBusy }`. `onSave` `ctx`: `{ listId, list, mode }`.

### Load-order independence

The bridge bundle owns the registry. Consumers can register before *or* after the bridge loads via a queue:

```js
const np = ( window.newspack = window.newspack || {} );
np.newsletters = np.newsletters || {};
( np.newsletters._pendingExtensions = np.newsletters._pendingExtensions || [] )
  .push( [ id, definition ] );
```

The bridge drains `_pendingExtensions` on init and then exposes the live `registerLocalListModalExtension` function for late registrations.

A small importable shim — `import { registerLocalListModalExtension } from '@newspack/newsletters/extensions'` — wraps this so consumers don't touch `window.*` directly. newspack-plugin already aliases sibling-repo packages this way; we lean on the existing webpack alias setup.

### Worked example — featured image (newspack-plugin)

```js
// newspack-plugin/src/wizards/newsletters/extensions/featured-image.js
import { registerLocalListModalExtension } from '@newspack/newsletters/extensions';
import apiFetch from '@wordpress/api-fetch';
import { useState } from '@wordpress/element';
import { MediaUpload } from '@wordpress/block-editor';

const FeaturedImagePicker = ( { listId, mediaIdRef } ) => {
  const [ mediaId, setMediaId ] = useState( null /* fetched from list-side meta */ );
  mediaIdRef.current = mediaId;
  return <MediaUpload value={ mediaId } onSelect={ media => setMediaId( media.id ) } /* ... */ />;
};

const mediaIdRef = { current: null };

registerLocalListModalExtension( 'newspack-plugin/featured-image', {
  render: ctx => <FeaturedImagePicker listId={ ctx.list?.db_id } mediaIdRef={ mediaIdRef } />,
  onSave: async ( { listId } ) => {
    if ( ! mediaIdRef.current ) {
      return;
    }
    await apiFetch( {
      path: `/newspack/v1/wizard/newspack-newsletters/lists/${ listId }/featured-image`,
      method: 'POST',
      data: { media_id: mediaIdRef.current },
    } );
  },
} );
```

The picker holds its state in a closure-captured ref. `onSave` reads the ref after the modal's own POST/PATCH succeeds. newspack-plugin owns the `/featured-image` REST route entirely. The modal stays opaque to the feature.

### Constraints + commitments

- One extension per `id`. Duplicate `id` registrations log a console warning; the later wins.
- Extensions render in registration order — predictable layout.
- `onSave` callbacks run in parallel via `Promise.allSettled`. A rejected callback logs an error notice but does not block modal close or invalidate the list save.
- The four document events are still fired regardless of registry use; consumers can subscribe to events in lieu of registering a modal extension.
- Stability: registry API + event contract are committed to backwards compatibility on minor releases. New optional fields on the extension definition are additive.

### Documentation deliverable

A new top-level `## Extending` section in `README.md` ships with this PR. It contains:

- Event contract table (the four events).
- Registry API reference + load-order semantics.
- The worked featured-image example.
- "When to use which": events for out-of-modal UX or pure side effects, registry for in-modal UI or save-coupled work.

CONTEXT.md decisions log entry references the README section.

### PHP-side hooks (unchanged)

The relevant PHP hooks already exist: `newspack_newsletters_local_list_created`, `newspack_newsletters_local_list_updated`, `newspack_newsletters_local_list_deleted` fire from `Subscription_Lists::create_local_list` / `update_local_list` / `delete_local_list`. Server-side extensions hook there. No new PHP hooks.

## Error handling

### Bridge JS fails to load (CSP, 404, parse error)

The wizard's Add New / Edit / Delete clicks dispatch events that nobody listens for. Without mitigation, the UX silently no-ops.

Mitigation: each wizard-side button uses a short timeout-based fallback. The button records the dispatch time on `document` (e.g. `data-newspack-pending-modal="open-local-list-modal:<timestamp>"`) and starts a 500 ms timer. If no `local-list-saved` / `local-list-deleted` / modal-mounted acknowledgement event has fired by then, the wizard navigates to `newspack_newsletters_wizard.new_subscription_lists_url` (still localised, still pointing at the legacy CPT editor). Belt-and-braces: if the bridge is broken, the legacy path remains.

The host emits a `bridge-mounted` ping event on first mount; the wizard caches that ping so a fresh click after the first successful load doesn't even start the fallback timer.

### Bridge mounts but REST fails

`<LocalListModal>` displays the error inline (existing behaviour, unchanged). Host fires no event. Wizard state is untouched. User can retry from the same modal instance.

### Extension `onSave` rejects

Logged via a `core/notices` snackbar. The list save is **not** rolled back — the rejection is informational. The modal still closes; the wizard still receives `local-list-saved`. Consumers are expected to handle their own retry semantics if needed (their REST route, their idempotency).

### `local-list-saved` fires but wizard's listener is unmounted

Common case: user navigated tabs mid-save. No-op. Next mount of `<SubscriptionLists>` fetches fresh.

### Concurrency: classic editor open in another tab

Last-write-wins on the underlying REST. Same exposure as two classic editor tabs today. Not made worse.

## Testing strategy

### JS unit / Jest (newspack-newsletters)

| Test file | What it covers |
|---|---|
| `src/wizard-bridge/local-list-modal-host.test.js` | Mount host. Dispatch `open-local-list-modal` with `mode: 'add'`; assert `<LocalListModal>` renders with `list={null}`. Dispatch with `mode: 'edit'` + a list object; assert pre-populated. Dispatch `open-local-list-confirm-delete`; assert `<LocalListDeleteModal>` renders. Mock `apiFetch`; on POST/PATCH/DELETE success assert the right `local-list-saved` / `local-list-deleted` event fires with expected `detail`. Assert close-on-success. |
| `src/wizard-bridge/extensions.test.js` | Register an extension; assert `getLocalListModalExtensions()` returns it. Push onto `_pendingExtensions` *before* bridge init; assert drained on registry creation. Duplicate `id` logs warning and replaces. |
| `src/wizard-bridge/index.test.js` | Idempotent mount: two boots don't double-mount. Returns early when localised global missing. |
| `src/admin-shell/screens/settings/lists-section.test.js` (extend existing surface) | Regression after lifting `<LocalListDeleteModal>`: standalone shell still renders + commits delete via the lifted component. |

### Extension-render path

- Mount host with one registered extension whose `render` returns a probe element. Open `add` modal. Assert probe is in DOM after the built-in fields.
- Same with two extensions; assert order matches registration.
- `onSave`: register two extensions, one resolves, one rejects. Submit. Assert resolved one ran, rejected one logged a notice, modal still closed, `local-list-saved` still fired.

### PHP / PHPUnit (newspack-newsletters)

| Test file | What it covers |
|---|---|
| `tests/test-wizard-bridge.php` | `Wizard_Bridge::should_enqueue()` returns false when `\Newspack\Newspack` is missing, false on unrelated screens, true on the bundled-mode wizard. Localised global key + fields match expectations. |

No new REST tests — modal hits endpoints already covered by NEWS-2093's tests.

### JS (newspack-plugin)

| Test file | What it covers |
|---|---|
| `src/wizards/newsletters/views/settings/index.test.js` (new) | `<SubscriptionLists>` renders Edit + Delete for `type === 'local'` rows; Add New is now a button (not anchor); clicks dispatch documented events with correct `detail`. Listener for `local-list-saved` triggers `fetchLists()`. |

### Manual UAT — bundled mode

- ESP configured + provider supports local lists.
- Add New → modal opens, audience picker visible, submit creates a row.
- Per-row Edit on a local list → modal opens pre-populated, edits persist, audience change re-creates tag.
- Per-row Delete → confirm dialogue, list removed.
- Concurrent: open Edit, edit same list in classic CPT editor in another tab, save in classic, refresh modal — last write wins (no breakage).
- Bridge JS blocked (DevTools throttle / artificial 500): clicks no-op silently for ~500 ms, then fall back to `new_subscription_lists_url`.
- ESP that doesn't support local lists: wizard hides Add New (existing `lists_can_add_local` gate).
- Extension registry: a fixture extension registers with `render` + `onSave`; both fire as documented.

### Manual UAT — standalone mode (regression)

- Settings shell renders unchanged. `<ListsSection>` flows for Add / Edit / Delete still go through direct React state path (no events).
- Bridge JS is *not* enqueued; verify in Network tab.

### Cross-mode UAT

- Create a list via the bundled-mode modal; switch to a build with newspack-plugin disabled; the same list appears in the standalone shell with identical title / description / audience wiring.
- Create a list via the legacy CPT editor (`get_add_new_url()` route); verify it appears in both modal-edit dialogues correctly populated.

### Accessibility quick pass

- Modal focus trapping unchanged from NEWS-2093.
- Edit / Delete buttons in the wizard rows: keyboard accessible, button text + aria labels present, destructive-variant styling for Delete.

## Open questions

None blocking. All design decisions confirmed during brainstorming on 2026-05-07.

## Decisions log additions for CONTEXT.md

To be appended to `docs/newsletter-modernisation/CONTEXT.md` alongside the implementation PR:

- **2026-05-07** — **NEWS-2152 — bundled-mode parity for the local-list modal via event-driven mount handoff, not full Subscription Lists consolidation.** The wizard's `<SubscriptionLists>` ActionCard chrome and per-row toggle UI in newspack-plugin stay as-is; only the local-list CRUD affordances unify. newspack-newsletters enqueues a small `wizard-bridge` JS bundle on the bundled-mode wizard page that mounts a `<LocalListModalHost>` at body level. The wizard's Add New / per-row Edit / per-row Delete buttons dispatch documented `CustomEvent`s on `document`; the host renders `<LocalListModal>` or `<LocalListDeleteModal>` via portal and dispatches `local-list-saved` / `local-list-deleted` after REST success, which the wizard listens for to reload its lists. Standalone shell unchanged — `<ListsSection>` keeps mounting `<LocalListModal>` directly via React composition. Two extension surfaces ship: (a) the four document events, for out-of-modal UX or pure side effects; (b) a modal extension registry (`registerLocalListModalExtension`) for in-modal UI + async post-save callbacks. Cross-bundle registration is order-independent via a `_pendingExtensions` queue drained by the bridge on init. `Subscription_Lists::get_add_new_url()` and the `new_subscription_lists_url` localised global stay untouched — wider consumer set (audience wizard, legacy classic-PHP standalone page) puts retirement out of this ticket's scope. README ships a new `## Extending` section as the canonical extension reference; future ESP and modal recipes accumulate there.
