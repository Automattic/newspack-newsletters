# NEWS-2152 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make NEWS-2093's local-list create / edit / delete modal reachable in bundled mode (newspack-plugin's Engagement → Newsletters → Settings wizard) by enqueuing a small `wizard-bridge` JS bundle from this repo, while leaving the wizard's surrounding `<SubscriptionLists>` ActionCard chrome untouched.

**Architecture:** Event-driven mount handoff — newspack-plugin's wizard dispatches `CustomEvent`s on `document`; this plugin's bridge bundle listens, mounts `<LocalListModal>` and `<LocalListDeleteModal>` via React portal, and dispatches save/delete events back. A small modal extension registry lets newspack-plugin render in-modal UI (e.g. featured-image picker) and run async post-save side effects. Standalone shell unchanged.

**Tech Stack:** PHP 8.3 / WordPress / WC-EmailEditor-adjacent React app under `src/admin-shell/` and new `src/wizard-bridge/`; `@wordpress/element` + `@wordpress/components` + `apiFetch`; Jest + jsdom; PHPUnit.

**Companion docs:**
- Spec: [`docs/newsletter-modernisation/news-2152-design.md`](./news-2152-design.md)
- Project context: [`docs/newsletter-modernisation/CONTEXT.md`](./CONTEXT.md)

**Repos involved:** Tasks 1-13 in `newspack-newsletters` on branch `news-2152-bundled-mode-parity-share-subscription-lists-settings` (already cut from `epic/admin-ux-modernisation`). Tasks 14-17 in `newspack-plugin` on a fresh branch cut from its `trunk`. Task 18 is manual UAT across both.

**Merge order:** newspack-newsletters first, then newspack-plugin. Fallback timer in the wizard handles the version skew when bundled-mode users are on a build with new newspack-plugin but old newspack-newsletters (no bridge present).

---

## File Structure

### newspack-newsletters

| Path | Action | Responsibility |
|---|---|---|
| `docs/newsletter-modernisation/news-2152-design.md` | Modify | Fix the wizard slug typo (`newspack-newsletters-wizard` → `newspack-newsletters`) — already done; need to commit |
| `src/admin-shell/screens/settings/local-list-delete-modal.js` | Create | Pure UI delete-confirmation modal lifted from `lists-section.js` |
| `src/admin-shell/screens/settings/local-list-delete-modal.test.js` | Create | Jest coverage for the lifted modal |
| `src/admin-shell/screens/settings/lists-section.js` | Modify | Use the lifted modal instead of inline `<Modal>` |
| `src/admin-shell/screens/settings/local-list-modal.js` | Modify | (a) Pass saved list to `onSaved`, (b) read extension registry, (c) await extension `onSave` after success |
| `src/admin-shell/screens/settings/local-list-modal.test.js` | Create | Jest coverage for new behaviours |
| `src/wizard-bridge/events.js` | Create | Event-name constants — single source of truth |
| `src/wizard-bridge/extensions.js` | Create | Modal extension registry + queue draining + window namespace |
| `src/wizard-bridge/extensions.test.js` | Create | Registry semantics |
| `src/wizard-bridge/local-list-modal-host.js` | Create | Host component listening for events, rendering modals |
| `src/wizard-bridge/local-list-modal-host.test.js` | Create | Host event handling |
| `src/wizard-bridge/index.js` | Create | Bundle entry — boot, idempotent mount, BRIDGE_MOUNTED ping |
| `src/wizard-bridge/index.test.js` | Create | Bundle entry semantics |
| `src/wizard-bridge/style.scss` | Create | Audience-picker styles isolated for the bridge bundle |
| `webpack.config.js` | Modify | Add `wizard-bridge` entry pointing at `src/wizard-bridge/index.js` |
| `includes/class-wizard-bridge.php` | Create | PHP enqueue gate detecting bundled-mode wizard screen |
| `tests/test-wizard-bridge.php` | Create | PHPUnit coverage for `should_enqueue` |
| `newspack-newsletters.php` | Modify | `require_once` the new class |
| `README.md` | Modify | Add `## Extending` section with event contract + registry + worked example |
| `docs/newsletter-modernisation/CONTEXT.md` | Modify | Append decisions-log entry |

### newspack-plugin

| Path | Action | Responsibility |
|---|---|---|
| `src/wizards/newsletters/views/settings/index.js` | Modify | Replace ExternalLink with Edit/Delete buttons; switch Add New to onClick; add useEffect for saved/deleted listeners; add fallback timer |
| `src/wizards/newsletters/views/settings/index.test.js` | Create | Jest coverage for dispatch + listener + fallback |

---

## Task 1: Commit pending spec slug correction

**Files:**
- Modify (already done in working tree): `docs/newsletter-modernisation/news-2152-design.md`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Verify the change is in the working tree**

```bash
git diff docs/newsletter-modernisation/news-2152-design.md
```

Expected: shows `-?page=newspack-newsletters-wizard` → `+?page=newspack-newsletters` in two places.

- [ ] **Step 2: Stage and commit**

```bash
git add docs/newsletter-modernisation/news-2152-design.md
git commit -m "docs(modernisation): correct wizard slug in NEWS-2152 spec"
```

Expected: commit succeeds; commitlint accepts subject (sentence-case + scope).

---

## Task 2: Lift `<LocalListDeleteModal>` out of `<ListsSection>`

**Files:**
- Create: `src/admin-shell/screens/settings/local-list-delete-modal.js`
- Create: `src/admin-shell/screens/settings/local-list-delete-modal.test.js`
- Modify: `src/admin-shell/screens/settings/lists-section.js`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Write the failing test**

Create `src/admin-shell/screens/settings/local-list-delete-modal.test.js`:

```javascript
import { fireEvent, render, screen } from '@testing-library/react';
import LocalListDeleteModal from './local-list-delete-modal';

describe( 'LocalListDeleteModal', () => {
	const list = { db_id: 7, title: 'Weekly Roundup' };

	it( 'renders the list title in the confirmation copy', () => {
		render(
			<LocalListDeleteModal list={ list } onConfirm={ jest.fn() } onCancel={ jest.fn() } isBusy={ false } />
		);
		expect( screen.getByText( /Weekly Roundup/ ) ).toBeInTheDocument();
	} );

	it( 'calls onCancel when Cancel is clicked', () => {
		const onCancel = jest.fn();
		render(
			<LocalListDeleteModal list={ list } onConfirm={ jest.fn() } onCancel={ onCancel } isBusy={ false } />
		);
		fireEvent.click( screen.getByRole( 'button', { name: /^Cancel$/ } ) );
		expect( onCancel ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'calls onConfirm when Delete is clicked', () => {
		const onConfirm = jest.fn();
		render(
			<LocalListDeleteModal list={ list } onConfirm={ onConfirm } onCancel={ jest.fn() } isBusy={ false } />
		);
		fireEvent.click( screen.getByRole( 'button', { name: /^Delete list$/ } ) );
		expect( onConfirm ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'disables Cancel + Delete and busies Delete when isBusy is true', () => {
		render(
			<LocalListDeleteModal list={ list } onConfirm={ jest.fn() } onCancel={ jest.fn() } isBusy={ true } />
		);
		expect( screen.getByRole( 'button', { name: /^Cancel$/ } ) ).toBeDisabled();
		expect( screen.getByRole( 'button', { name: /^Delete list$/ } ) ).toBeDisabled();
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

```bash
n test-js -- --testPathPattern local-list-delete-modal.test.js
```

Expected: FAIL — `local-list-delete-modal` module not found.

- [ ] **Step 3: Create the component**

Create `src/admin-shell/screens/settings/local-list-delete-modal.js`:

```javascript
import {
	__experimentalHStack as HStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	__experimentalVStack as VStack, // eslint-disable-line @wordpress/no-unsafe-wp-apis
	Button,
	Modal,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

export default function LocalListDeleteModal( { list, onConfirm, onCancel, isBusy } ) {
	if ( ! list ) {
		return null;
	}
	return (
		<Modal
			title={ __( 'Delete local list', 'newspack-newsletters' ) }
			onRequestClose={ isBusy ? () => {} : onCancel }
			shouldCloseOnEsc={ ! isBusy }
			shouldCloseOnClickOutside={ ! isBusy }
			size="small"
			className="newspack-newsletters-local-list-delete-modal"
		>
			<VStack spacing={ 4 }>
				<p>
					{ sprintf(
						// translators: %s is the title of the local list being deleted.
						__( 'Delete the local list "%s"? This cannot be undone.', 'newspack-newsletters' ),
						list.title
					) }
				</p>
				<HStack justify="flex-end" spacing={ 2 }>
					<Button variant="tertiary" onClick={ onCancel } disabled={ isBusy }>
						{ __( 'Cancel', 'newspack-newsletters' ) }
					</Button>
					<Button variant="primary" isDestructive onClick={ onConfirm } isBusy={ isBusy } disabled={ isBusy }>
						{ __( 'Delete list', 'newspack-newsletters' ) }
					</Button>
				</HStack>
			</VStack>
		</Modal>
	);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
n test-js -- --testPathPattern local-list-delete-modal.test.js
```

Expected: PASS — all four cases.

- [ ] **Step 5: Refactor `lists-section.js` to use the lifted component**

Modify `src/admin-shell/screens/settings/lists-section.js`. Replace the import of `Modal` (no longer needed locally) and the inline `<Modal>...</Modal>` block.

At the top of the file, remove `Modal` from the `@wordpress/components` import list (keep `__experimentalHStack`, `__experimentalVStack`, `Button`, `CheckboxControl`, `Notice`, `TextControl`, `TextareaControl`). Add:

```javascript
import LocalListDeleteModal from './local-list-delete-modal';
```

Remove the unused `sprintf` import from `@wordpress/i18n` if no other call site uses it (the only usage was in the lifted block).

Replace the entire `pendingDelete && ( <Modal ...>...</Modal> )` JSX block (currently around lines 216-249) with:

```javascript
<LocalListDeleteModal
	list={ pendingDelete }
	onConfirm={ confirmDelete }
	onCancel={ cancelDelete }
	isBusy={ deletingId === pendingDelete?.db_id }
/>
```

- [ ] **Step 6: Run lists-section regression tests + lint**

```bash
n test-js -- --testPathPattern 'admin-shell/screens/settings/'
n npm run lint:js
```

Expected: PASS — all tests; no lint errors.

- [ ] **Step 7: Commit**

```bash
git add src/admin-shell/screens/settings/local-list-delete-modal.js \
        src/admin-shell/screens/settings/local-list-delete-modal.test.js \
        src/admin-shell/screens/settings/lists-section.js
git commit -m "refactor(admin): extract LocalListDeleteModal from ListsSection"
```

---

## Task 3: `<LocalListModal>` returns saved list to `onSaved`

**Files:**
- Modify: `src/admin-shell/screens/settings/local-list-modal.js`
- Create: `src/admin-shell/screens/settings/local-list-modal.test.js`

**Working dir:** `repos/newspack-newsletters`

The modal currently calls `onSaved()` with no arguments. The bridge host needs the saved list back so it can emit a meaningful `local-list-saved` event. Existing standalone caller (`<ListsSection>`) passes `onSaved={ onLocalListChanged }` which ignores its argument — backwards-compatible.

- [ ] **Step 1: Write the failing test**

Create `src/admin-shell/screens/settings/local-list-modal.test.js`:

```javascript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import LocalListModal from './local-list-modal';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

describe( 'LocalListModal', () => {
	beforeEach( () => {
		apiFetch.mockReset();
	} );

	it( 'passes the saved list and mode to onSaved on create', async () => {
		const saved = { db_id: 42, title: 'New list', description: '', type: 'local' };
		apiFetch.mockImplementation( opts => {
			if ( opts.path === '/newspack-newsletters/v1/lists/audiences' ) {
				return Promise.resolve( { audiences: [], audience_label: 'List', help_before_save: '' } );
			}
			return Promise.resolve( saved );
		} );
		const onSaved = jest.fn();
		const onClose = jest.fn();
		render( <LocalListModal list={ null } onClose={ onClose } onSaved={ onSaved } /> );
		fireEvent.change( screen.getByLabelText( /List title/ ), { target: { value: 'New list' } } );
		fireEvent.click( screen.getByRole( 'button', { name: /^Add list$/ } ) );
		await waitFor( () => expect( onSaved ).toHaveBeenCalled() );
		expect( onSaved ).toHaveBeenCalledWith( { list: saved, mode: 'add' } );
	} );

	it( 'passes the saved list and mode to onSaved on edit', async () => {
		const list = { db_id: 9, title: 'Existing', description: '', audience: '', type: 'local' };
		const saved = { ...list, title: 'Renamed' };
		apiFetch.mockImplementation( opts => {
			if ( opts.path === '/newspack-newsletters/v1/lists/audiences' ) {
				return Promise.resolve( { audiences: [], audience_label: 'List', help_before_save: '' } );
			}
			return Promise.resolve( saved );
		} );
		const onSaved = jest.fn();
		render( <LocalListModal list={ list } onClose={ jest.fn() } onSaved={ onSaved } /> );
		fireEvent.change( screen.getByLabelText( /List title/ ), { target: { value: 'Renamed' } } );
		fireEvent.click( screen.getByRole( 'button', { name: /^Save changes$/ } ) );
		await waitFor( () => expect( onSaved ).toHaveBeenCalled() );
		expect( onSaved ).toHaveBeenCalledWith( { list: saved, mode: 'edit' } );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

```bash
n test-js -- --testPathPattern local-list-modal.test.js
```

Expected: FAIL — `onSaved` called with no arguments.

- [ ] **Step 3: Update the modal**

In `src/admin-shell/screens/settings/local-list-modal.js`, find the `submit` handler. Replace:

```javascript
		try {
			await apiFetch( { path, method, data } );
			onSaved();
			onClose();
		} catch ( err ) {
```

with:

```javascript
		try {
			const saved = await apiFetch( { path, method, data } );
			onSaved( { list: saved, mode: isEdit ? 'edit' : 'add' } );
			onClose();
		} catch ( err ) {
```

- [ ] **Step 4: Run test to verify it passes**

```bash
n test-js -- --testPathPattern local-list-modal.test.js
```

Expected: PASS.

- [ ] **Step 5: Run full settings-section regression**

```bash
n test-js -- --testPathPattern 'admin-shell/screens/settings/'
```

Expected: PASS — `<ListsSection>`'s `onLocalListChanged` ignores the new arg, so no regression.

- [ ] **Step 6: Commit**

```bash
git add src/admin-shell/screens/settings/local-list-modal.js \
        src/admin-shell/screens/settings/local-list-modal.test.js
git commit -m "refactor(admin): pass saved list to LocalListModal onSaved callback"
```

---

## Task 4: Modal extension registry

**Files:**
- Create: `src/wizard-bridge/extensions.js`
- Create: `src/wizard-bridge/extensions.test.js`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Write the failing test**

Create `src/wizard-bridge/extensions.test.js`:

```javascript
describe( 'extension registry', () => {
	beforeEach( () => {
		// Reset modules so the registry's module-level state is fresh.
		jest.resetModules();
		delete window.newspack;
	} );

	it( 'registers and retrieves an extension', () => {
		const { registerLocalListModalExtension, getLocalListModalExtensions } = require( './extensions' );
		const ext = { render: () => 'a', onSave: jest.fn() };
		registerLocalListModalExtension( 'a', ext );
		expect( getLocalListModalExtensions() ).toEqual( [ ext ] );
	} );

	it( 'preserves registration order across multiple extensions', () => {
		const { registerLocalListModalExtension, getLocalListModalExtensions } = require( './extensions' );
		const a = { render: () => 'a' };
		const b = { render: () => 'b' };
		registerLocalListModalExtension( 'a', a );
		registerLocalListModalExtension( 'b', b );
		expect( getLocalListModalExtensions() ).toEqual( [ a, b ] );
	} );

	it( 'replaces an existing entry with a console.warn', () => {
		const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		const { registerLocalListModalExtension, getLocalListModalExtensions } = require( './extensions' );
		registerLocalListModalExtension( 'a', { render: () => 'first' } );
		registerLocalListModalExtension( 'a', { render: () => 'second' } );
		expect( warn ).toHaveBeenCalledWith( expect.stringContaining( 'a' ) );
		expect( getLocalListModalExtensions() ).toHaveLength( 1 );
		expect( getLocalListModalExtensions()[ 0 ].render() ).toBe( 'second' );
		warn.mockRestore();
	} );

	it( 'drains _pendingExtensions queue on first import', () => {
		window.newspack = { newsletters: { _pendingExtensions: [ [ 'pre', { render: () => 'pre' } ] ] } };
		const { getLocalListModalExtensions } = require( './extensions' );
		expect( getLocalListModalExtensions() ).toHaveLength( 1 );
		expect( window.newspack.newsletters._pendingExtensions ).toHaveLength( 0 );
	} );

	it( 'exposes registerLocalListModalExtension on window.newspack.newsletters for late registrations', () => {
		require( './extensions' );
		expect( typeof window.newspack.newsletters.registerLocalListModalExtension ).toBe( 'function' );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

```bash
n test-js -- --testPathPattern wizard-bridge/extensions.test.js
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the registry**

Create `src/wizard-bridge/extensions.js`:

```javascript
const extensions = new Map();

export function registerLocalListModalExtension( id, definition ) {
	if ( extensions.has( id ) ) {
		// eslint-disable-next-line no-console
		console.warn(
			`[newspack-newsletters] Replacing local-list-modal extension "${ id }".`
		);
	}
	extensions.set( id, definition );
}

export function getLocalListModalExtensions() {
	return Array.from( extensions.values() );
}

const np = ( window.newspack = window.newspack || {} );
np.newsletters = np.newsletters || {};

const pending = np.newsletters._pendingExtensions || [];
pending.forEach( ( [ id, definition ] ) => registerLocalListModalExtension( id, definition ) );
np.newsletters._pendingExtensions = [];

np.newsletters.registerLocalListModalExtension = registerLocalListModalExtension;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
n test-js -- --testPathPattern wizard-bridge/extensions.test.js
```

Expected: PASS — all five cases.

- [ ] **Step 5: Commit**

```bash
git add src/wizard-bridge/extensions.js src/wizard-bridge/extensions.test.js
git commit -m "feat(admin): add local-list-modal extension registry"
```

---

## Task 5: `<LocalListModal>` consumes the registry

**Files:**
- Modify: `src/admin-shell/screens/settings/local-list-modal.js`
- Modify: `src/admin-shell/screens/settings/local-list-modal.test.js`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Extend the test for extension rendering and `onSave`**

Append to `src/admin-shell/screens/settings/local-list-modal.test.js`:

```javascript
import { registerLocalListModalExtension } from '../../../wizard-bridge/extensions';

describe( 'LocalListModal — extensions', () => {
	beforeEach( () => {
		// Test isolation: clear any registered extensions by re-importing the module.
		jest.resetModules();
		apiFetch.mockReset();
		apiFetch.mockImplementation( opts => {
			if ( opts.path === '/newspack-newsletters/v1/lists/audiences' ) {
				return Promise.resolve( { audiences: [], audience_label: 'List', help_before_save: '' } );
			}
			return Promise.resolve( { db_id: 1 } );
		} );
	} );

	it( 'renders extension JSX after the built-in fields, in registration order', async () => {
		const { registerLocalListModalExtension: register } = require( '../../../wizard-bridge/extensions' );
		register( 'a', { render: () => <span data-testid="ext-a">A</span> } );
		register( 'b', { render: () => <span data-testid="ext-b">B</span> } );
		const Component = require( './local-list-modal' ).default;
		render( <Component list={ null } onClose={ jest.fn() } onSaved={ jest.fn() } /> );
		await waitFor( () => expect( screen.getByTestId( 'ext-a' ) ).toBeInTheDocument() );
		expect( screen.getByTestId( 'ext-b' ) ).toBeInTheDocument();
	} );

	it( 'awaits extension onSave callbacks after a successful POST and includes their rejections in error notices', async () => {
		const noticesStore = require( '@wordpress/notices' ).store;
		const { dispatch } = require( '@wordpress/data' );
		const createErrorNotice = jest.fn();
		jest.spyOn( dispatch( noticesStore ), 'createErrorNotice' ).mockImplementation( createErrorNotice );

		const onSaveResolved = jest.fn().mockResolvedValue( undefined );
		const onSaveRejected = jest.fn().mockRejectedValue( new Error( 'image upload failed' ) );

		const { registerLocalListModalExtension: register } = require( '../../../wizard-bridge/extensions' );
		register( 'good', { render: () => null, onSave: onSaveResolved } );
		register( 'bad', { render: () => null, onSave: onSaveRejected } );

		const onSaved = jest.fn();
		const onClose = jest.fn();
		const Component = require( './local-list-modal' ).default;
		render( <Component list={ null } onClose={ onClose } onSaved={ onSaved } /> );
		fireEvent.change( screen.getByLabelText( /List title/ ), { target: { value: 'X' } } );
		fireEvent.click( screen.getByRole( 'button', { name: /^Add list$/ } ) );

		await waitFor( () => expect( onSaved ).toHaveBeenCalled() );
		expect( onSaveResolved ).toHaveBeenCalled();
		expect( onSaveRejected ).toHaveBeenCalled();
		expect( createErrorNotice ).toHaveBeenCalledWith(
			expect.stringContaining( 'image upload failed' ),
			expect.objectContaining( { type: 'snackbar' } )
		);
		// Rejection does not block close.
		expect( onClose ).toHaveBeenCalled();
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

```bash
n test-js -- --testPathPattern local-list-modal.test.js
```

Expected: FAIL — extensions aren't rendered, `onSave` callbacks not invoked.

- [ ] **Step 3: Update the modal to consume the registry**

In `src/admin-shell/screens/settings/local-list-modal.js`:

Add imports near the top (preserving existing imports):

```javascript
import { dispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import { getLocalListModalExtensions } from '../../../wizard-bridge/extensions';
```

Inside `LocalListModal`, after the existing `useState` declarations, add:

```javascript
	const extensions = useMemo( () => getLocalListModalExtensions(), [] );
```

Find the `submit` handler. Replace the `try` block in step 3 of Task 3 with:

```javascript
		try {
			const saved = await apiFetch( { path, method, data } );
			const ctx = { listId: saved?.db_id, list: saved, mode: isEdit ? 'edit' : 'add' };
			const results = await Promise.allSettled(
				extensions.map( ext => ( typeof ext.onSave === 'function' ? ext.onSave( ctx ) : Promise.resolve() ) )
			);
			results.forEach( result => {
				if ( result.status === 'rejected' ) {
					dispatch( noticesStore ).createErrorNotice(
						result.reason?.message || __( 'A modal extension failed after save.', 'newspack-newsletters' ),
						{ type: 'snackbar', explicitDismiss: true }
					);
				}
			} );
			onSaved( { list: saved, mode: isEdit ? 'edit' : 'add' } );
			onClose();
		} catch ( err ) {
```

Inside the JSX `<form>`, after the existing built-in fields and before the `<HStack>` of action buttons, add:

```javascript
				{ extensions.map( ( ext, index ) => (
					<div key={ index } className="newspack-newsletters-local-list-modal__extension">
						{ typeof ext.render === 'function' ? ext.render( { list, mode: isEdit ? 'edit' : 'add', isBusy } ) : null }
					</div>
				) ) }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
n test-js -- --testPathPattern local-list-modal.test.js
```

Expected: PASS — all extension cases plus existing.

- [ ] **Step 5: Commit**

```bash
git add src/admin-shell/screens/settings/local-list-modal.js \
        src/admin-shell/screens/settings/local-list-modal.test.js
git commit -m "feat(admin): consume modal extension registry in LocalListModal"
```

---

## Task 6: Bridge events constants

**Files:**
- Create: `src/wizard-bridge/events.js`

**Working dir:** `repos/newspack-newsletters`

This task is too small to TDD profitably — it's a constants module. Direct creation + lint suffices.

- [ ] **Step 1: Create the constants module**

Create `src/wizard-bridge/events.js`:

```javascript
export const EVENT_NAMESPACE = 'newspack-newsletters';

export const EVENTS = {
	BRIDGE_MOUNTED: `${ EVENT_NAMESPACE }:bridge-mounted`,
	OPEN_MODAL: `${ EVENT_NAMESPACE }:open-local-list-modal`,
	OPEN_CONFIRM_DELETE: `${ EVENT_NAMESPACE }:open-local-list-confirm-delete`,
	LOCAL_LIST_SAVED: `${ EVENT_NAMESPACE }:local-list-saved`,
	LOCAL_LIST_DELETED: `${ EVENT_NAMESPACE }:local-list-deleted`,
};
```

- [ ] **Step 2: Lint**

```bash
n npm run lint:js -- src/wizard-bridge/events.js
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/wizard-bridge/events.js
git commit -m "feat(admin): add wizard-bridge event-name constants"
```

---

## Task 7: `<LocalListModalHost>` component

**Files:**
- Create: `src/wizard-bridge/local-list-modal-host.js`
- Create: `src/wizard-bridge/local-list-modal-host.test.js`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Write the failing test**

Create `src/wizard-bridge/local-list-modal-host.test.js`:

```javascript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';
import LocalListModalHost from './local-list-modal-host';
import { EVENTS } from './events';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

const dispatchEvent = ( name, detail ) => {
	document.dispatchEvent( new CustomEvent( name, { detail } ) );
};

describe( 'LocalListModalHost', () => {
	beforeEach( () => {
		apiFetch.mockReset();
		apiFetch.mockImplementation( opts => {
			if ( opts.path === '/newspack-newsletters/v1/lists/audiences' ) {
				return Promise.resolve( { audiences: [], audience_label: 'List', help_before_save: '' } );
			}
			return Promise.resolve( { db_id: 99, title: 'Created' } );
		} );
	} );

	it( 'mounts LocalListModal in add mode when OPEN_MODAL fires with mode=add', async () => {
		render( <LocalListModalHost /> );
		dispatchEvent( EVENTS.OPEN_MODAL, { mode: 'add' } );
		await waitFor( () => expect( screen.getByText( /Add new local list/ ) ).toBeInTheDocument() );
	} );

	it( 'mounts LocalListModal in edit mode pre-populated when OPEN_MODAL fires with mode=edit + list', async () => {
		render( <LocalListModalHost /> );
		const list = { db_id: 5, title: 'Existing', description: '', audience: '', type: 'local' };
		dispatchEvent( EVENTS.OPEN_MODAL, { mode: 'edit', list } );
		await waitFor( () => expect( screen.getByDisplayValue( 'Existing' ) ).toBeInTheDocument() );
	} );

	it( 'fires LOCAL_LIST_SAVED with detail after a successful save', async () => {
		render( <LocalListModalHost /> );
		const savedListener = jest.fn();
		document.addEventListener( EVENTS.LOCAL_LIST_SAVED, savedListener );
		dispatchEvent( EVENTS.OPEN_MODAL, { mode: 'add' } );
		await waitFor( () => expect( screen.getByLabelText( /List title/ ) ).toBeInTheDocument() );
		fireEvent.change( screen.getByLabelText( /List title/ ), { target: { value: 'Created' } } );
		fireEvent.click( screen.getByRole( 'button', { name: /^Add list$/ } ) );
		await waitFor( () => expect( savedListener ).toHaveBeenCalled() );
		const detail = savedListener.mock.calls[ 0 ][ 0 ].detail;
		expect( detail ).toEqual(
			expect.objectContaining( { listId: 99, mode: 'add', list: expect.objectContaining( { db_id: 99 } ) } )
		);
		document.removeEventListener( EVENTS.LOCAL_LIST_SAVED, savedListener );
	} );

	it( 'mounts LocalListDeleteModal when OPEN_CONFIRM_DELETE fires', async () => {
		render( <LocalListModalHost /> );
		dispatchEvent( EVENTS.OPEN_CONFIRM_DELETE, { list: { db_id: 7, title: 'Doomed' } } );
		await waitFor( () => expect( screen.getByText( /Delete the local list "Doomed"/ ) ).toBeInTheDocument() );
	} );

	it( 'fires LOCAL_LIST_DELETED with detail after a successful DELETE', async () => {
		render( <LocalListModalHost /> );
		const deletedListener = jest.fn();
		document.addEventListener( EVENTS.LOCAL_LIST_DELETED, deletedListener );
		dispatchEvent( EVENTS.OPEN_CONFIRM_DELETE, { list: { db_id: 7, title: 'Doomed' } } );
		await waitFor( () => expect( screen.getByRole( 'button', { name: /^Delete list$/ } ) ).toBeInTheDocument() );
		fireEvent.click( screen.getByRole( 'button', { name: /^Delete list$/ } ) );
		await waitFor( () => expect( deletedListener ).toHaveBeenCalled() );
		expect( deletedListener.mock.calls[ 0 ][ 0 ].detail ).toEqual( { listId: 7 } );
		document.removeEventListener( EVENTS.LOCAL_LIST_DELETED, deletedListener );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

```bash
n test-js -- --testPathPattern wizard-bridge/local-list-modal-host.test.js
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the host component**

Create `src/wizard-bridge/local-list-modal-host.js`:

```javascript
import apiFetch from '@wordpress/api-fetch';
import { dispatch } from '@wordpress/data';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

import LocalListModal from '../admin-shell/screens/settings/local-list-modal';
import LocalListDeleteModal from '../admin-shell/screens/settings/local-list-delete-modal';
import { EVENTS } from './events';

export default function LocalListModalHost() {
	const [ modalState, setModalState ] = useState( null ); // { mode, list }
	const [ deletePending, setDeletePending ] = useState( null );
	const [ deletingId, setDeletingId ] = useState( null );

	const closeModal = useCallback( () => setModalState( null ), [] );
	const closeDelete = useCallback( () => setDeletePending( null ), [] );

	useEffect( () => {
		const handleOpen = event => {
			const { mode, list } = event.detail || {};
			setModalState( { mode: mode || 'add', list: mode === 'edit' ? list : null } );
		};
		const handleConfirmDelete = event => {
			const list = event.detail?.list;
			if ( list ) {
				setDeletePending( list );
			}
		};
		document.addEventListener( EVENTS.OPEN_MODAL, handleOpen );
		document.addEventListener( EVENTS.OPEN_CONFIRM_DELETE, handleConfirmDelete );
		return () => {
			document.removeEventListener( EVENTS.OPEN_MODAL, handleOpen );
			document.removeEventListener( EVENTS.OPEN_CONFIRM_DELETE, handleConfirmDelete );
		};
	}, [] );

	const handleSaved = useCallback( ( saved ) => {
		document.dispatchEvent(
			new CustomEvent( EVENTS.LOCAL_LIST_SAVED, {
				detail: { listId: saved?.list?.db_id, mode: saved?.mode, list: saved?.list },
			} )
		);
	}, [] );

	const confirmDelete = useCallback( async () => {
		if ( ! deletePending ) {
			return;
		}
		const list = deletePending;
		setDeletingId( list.db_id );
		try {
			await apiFetch( {
				path: `/newspack-newsletters/v1/lists/local/${ list.db_id }`,
				method: 'DELETE',
			} );
			document.dispatchEvent(
				new CustomEvent( EVENTS.LOCAL_LIST_DELETED, { detail: { listId: list.db_id } } )
			);
			setDeletePending( null );
		} catch ( err ) {
			dispatch( noticesStore ).createErrorNotice(
				err?.message || __( 'Could not delete the local list.', 'newspack-newsletters' ),
				{ type: 'snackbar', explicitDismiss: true }
			);
		} finally {
			setDeletingId( null );
		}
	}, [ deletePending ] );

	return (
		<>
			{ modalState && (
				<LocalListModal list={ modalState.list } onClose={ closeModal } onSaved={ handleSaved } />
			) }
			{ deletePending && (
				<LocalListDeleteModal
					list={ deletePending }
					onConfirm={ confirmDelete }
					onCancel={ closeDelete }
					isBusy={ deletingId === deletePending.db_id }
				/>
			) }
		</>
	);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
n test-js -- --testPathPattern wizard-bridge/local-list-modal-host.test.js
```

Expected: PASS — all five cases.

- [ ] **Step 5: Commit**

```bash
git add src/wizard-bridge/local-list-modal-host.js \
        src/wizard-bridge/local-list-modal-host.test.js
git commit -m "feat(admin): add LocalListModalHost for the wizard bridge"
```

---

## Task 8: Bridge bundle entry + idempotent boot

**Files:**
- Create: `src/wizard-bridge/index.js`
- Create: `src/wizard-bridge/index.test.js`
- Create: `src/wizard-bridge/style.scss`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Write the failing test**

Create `src/wizard-bridge/index.test.js`:

```javascript
import { boot } from './index';
import { EVENTS } from './events';

describe( 'wizard-bridge boot', () => {
	beforeEach( () => {
		document.body.innerHTML = '';
		delete window.newspack_newsletters_wizard_bridge;
	} );

	it( 'no-ops when the localised global is missing', () => {
		boot();
		expect( document.body.querySelector( '.newspack-newsletters-wizard-bridge-root' ) ).toBeNull();
	} );

	it( 'mounts a single root container when the localised global is present', () => {
		window.newspack_newsletters_wizard_bridge = { debug: false };
		boot();
		const containers = document.body.querySelectorAll( '.newspack-newsletters-wizard-bridge-root' );
		expect( containers ).toHaveLength( 1 );
	} );

	it( 'is idempotent — second boot does not double-mount', () => {
		window.newspack_newsletters_wizard_bridge = { debug: false };
		boot();
		boot();
		expect( document.body.querySelectorAll( '.newspack-newsletters-wizard-bridge-root' ) ).toHaveLength( 1 );
	} );

	it( 'dispatches BRIDGE_MOUNTED on first successful mount', () => {
		window.newspack_newsletters_wizard_bridge = { debug: false };
		const listener = jest.fn();
		document.addEventListener( EVENTS.BRIDGE_MOUNTED, listener );
		boot();
		expect( listener ).toHaveBeenCalled();
		document.removeEventListener( EVENTS.BRIDGE_MOUNTED, listener );
	} );
} );
```

- [ ] **Step 2: Run test to verify it fails**

```bash
n test-js -- --testPathPattern wizard-bridge/index.test.js
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the SCSS file**

The bridge does not introduce any new visual styling — `<LocalListModal>` and `<LocalListDeleteModal>` rely on `@wordpress/components` `<Modal>` styling, which is already loaded on every WP admin page. The SCSS file exists only so webpack produces a `.css` asset alongside the JS bundle that PHP can enqueue.

Create `src/wizard-bridge/style.scss`:

```scss
// Bridge bundle stylesheet. Reserved for future wizard-bridge-specific styles.
//
// LocalListModal + LocalListDeleteModal use @wordpress/components Modal
// styling, which WP admin loads independently. The file exists so webpack
// emits a dist/wizard-bridge.css alongside the JS bundle for PHP to enqueue.

.newspack-newsletters-wizard-bridge-root {
	// Body-level mount container — non-visual.
}
```

- [ ] **Step 4: Create the bundle entry**

Create `src/wizard-bridge/index.js`:

```javascript
import './style.scss';
import './extensions'; // Side-effect: drains queue + exposes window function.

import { render } from '@wordpress/element';

import LocalListModalHost from './local-list-modal-host';
import { EVENTS } from './events';

let mounted = false;

export function boot() {
	if ( mounted ) {
		return;
	}
	if ( ! window.newspack_newsletters_wizard_bridge ) {
		return;
	}
	const container = document.createElement( 'div' );
	container.className = 'newspack-newsletters-wizard-bridge-root';
	document.body.appendChild( container );
	render( <LocalListModalHost />, container );
	mounted = true;
	document.dispatchEvent( new CustomEvent( EVENTS.BRIDGE_MOUNTED, { detail: {} } ) );
}

if ( typeof document !== 'undefined' ) {
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
n test-js -- --testPathPattern wizard-bridge/index.test.js
```

Expected: PASS — all four cases.

Note: tests import `boot` directly. The auto-boot at the bottom of `index.js` runs at module load — that's fine because the global is unset in `beforeEach`.

- [ ] **Step 6: Commit**

```bash
git add src/wizard-bridge/index.js src/wizard-bridge/index.test.js src/wizard-bridge/style.scss
git commit -m "feat(admin): add wizard-bridge bundle entry with idempotent boot"
```

---

## Task 9: Webpack entry for the bridge bundle

**Files:**
- Modify: `webpack.config.js`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Inspect the current entry list**

```bash
grep -n "entries\s*=\|: '\\./src/" webpack.config.js | head -20
```

Identify the existing entries pattern (e.g. `'admin-shell': './src/admin-shell/index.js'`).

- [ ] **Step 2: Add the wizard-bridge entry**

In `webpack.config.js`, locate the entries object/list and add:

```javascript
'wizard-bridge': './src/wizard-bridge/index.js',
```

Match the formatting of surrounding entries.

- [ ] **Step 3: Build to verify**

```bash
n build
```

Expected: build succeeds; `dist/wizard-bridge.js` and `dist/wizard-bridge.css` are produced. List them:

```bash
ls -la dist/wizard-bridge.*
```

- [ ] **Step 4: Commit**

```bash
git add webpack.config.js
git commit -m "build(admin): add wizard-bridge webpack entry"
```

---

## Task 10: PHP `Wizard_Bridge` class

**Files:**
- Create: `includes/class-wizard-bridge.php`
- Create: `tests/test-wizard-bridge.php`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Write the failing test**

Create `tests/test-wizard-bridge.php`:

```php
<?php
/**
 * Tests for Wizard_Bridge.
 *
 * @package Newspack_Newsletters
 */

use Newspack\Newsletters\Wizard_Bridge;

/**
 * Tests for Wizard_Bridge.
 */
class Wizard_Bridge_Test extends WP_UnitTestCase {

	/**
	 * Reset $_GET and the newspack-plugin presence between tests.
	 */
	public function tear_down() {
		unset( $_GET['page'] );
		parent::tear_down();
	}

	public function test_should_enqueue_returns_false_when_not_admin() {
		set_current_screen( 'front' );
		$this->assertFalse( Wizard_Bridge::should_enqueue() );
	}

	public function test_should_enqueue_returns_false_when_newspack_plugin_missing() {
		set_current_screen( 'edit-newspack_nl_cpt' );
		$_GET['page'] = 'newspack-newsletters';
		// `\Newspack\Newspack` is deliberately not loaded in the test bootstrap.
		$this->assertFalse( Wizard_Bridge::should_enqueue() );
	}

	public function test_should_enqueue_returns_false_when_page_query_missing() {
		set_current_screen( 'edit-newspack_nl_cpt' );
		// Stub `\Newspack\Newspack` for this test.
		if ( ! class_exists( '\Newspack\Newspack' ) ) {
			eval( 'namespace Newspack { class Newspack {} }' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged
		}
		$this->assertFalse( Wizard_Bridge::should_enqueue() );
	}

	public function test_should_enqueue_returns_true_on_bundled_wizard_page() {
		set_current_screen( 'edit-newspack_nl_cpt' );
		if ( ! class_exists( '\Newspack\Newspack' ) ) {
			eval( 'namespace Newspack { class Newspack {} }' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged
		}
		$_GET['page'] = 'newspack-newsletters';
		$this->assertTrue( Wizard_Bridge::should_enqueue() );
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
n test-php --filter Wizard_Bridge_Test
```

Expected: FAIL — class does not exist.

- [ ] **Step 3: Create the class**

Create `includes/class-wizard-bridge.php`:

```php
<?php
/**
 * Newspack Newsletters Wizard Bridge.
 *
 * Enqueues the bridge JS bundle on the bundled-mode (newspack-plugin)
 * Newsletters Settings wizard, so its `<SubscriptionLists>` card can dispatch
 * document events that mount this plugin's `<LocalListModal>` /
 * `<LocalListDeleteModal>` flows.
 *
 * @package Newspack_Newsletters
 */

namespace Newspack\Newsletters;

defined( 'ABSPATH' ) || exit;

/**
 * Wizard Bridge.
 */
class Wizard_Bridge {

	const SCRIPT_HANDLE = 'newspack-newsletters-wizard-bridge';
	const WIZARD_PAGE_SLUG = 'newspack-newsletters';

	/**
	 * Hook registration entry point.
	 */
	public static function init() {
		add_action( 'admin_enqueue_scripts', [ __CLASS__, 'maybe_enqueue' ] );
	}

	/**
	 * Decide whether to enqueue on the current admin screen.
	 *
	 * @return bool
	 */
	public static function should_enqueue() {
		if ( ! is_admin() ) {
			return false;
		}
		if ( ! class_exists( '\Newspack\Newspack' ) ) {
			return false;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
		return self::WIZARD_PAGE_SLUG === $page;
	}

	/**
	 * Enqueue the bridge bundle when applicable.
	 */
	public static function maybe_enqueue() {
		if ( ! self::should_enqueue() ) {
			return;
		}

		$asset = include NEWSPACK_NEWSLETTERS_PLUGIN_FILE_DIR . 'dist/wizard-bridge.asset.php';

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			plugins_url( '../dist/wizard-bridge.js', __FILE__ ),
			$asset['dependencies'] ?? [],
			$asset['version'] ?? NEWSPACK_NEWSLETTERS_VERSION,
			true
		);
		wp_enqueue_style(
			self::SCRIPT_HANDLE,
			plugins_url( '../dist/wizard-bridge.css', __FILE__ ),
			[],
			$asset['version'] ?? NEWSPACK_NEWSLETTERS_VERSION
		);

		wp_localize_script(
			self::SCRIPT_HANDLE,
			'newspack_newsletters_wizard_bridge',
			[
				'debug' => defined( 'WP_DEBUG' ) && WP_DEBUG,
			]
		);
	}
}
```

(Note on `NEWSPACK_NEWSLETTERS_PLUGIN_FILE_DIR` and `NEWSPACK_NEWSLETTERS_VERSION`: confirm these constants exist in `newspack-newsletters.php`. If not, substitute the closest equivalent — `plugin_dir_path( NEWSPACK_NEWSLETTERS_PLUGIN_FILE )` and a hard-coded version derived from `Newspack_Newsletters::VERSION` for the version key.)

- [ ] **Step 4: Run test to verify it passes**

```bash
n test-php --filter Wizard_Bridge_Test
```

Expected: PASS — all four cases.

Note: the test `test_should_enqueue_returns_true_on_bundled_wizard_page` `eval`s a stub `\Newspack\Newspack` class. This is acceptable in a test context. If your team prefers a per-suite global stub, hoist the eval into `tests/bootstrap.php` behind a `defined( 'NEWSPACK_NEWSLETTERS_TEST_STUB_NEWSPACK' )` guard.

- [ ] **Step 5: Commit**

```bash
git add includes/class-wizard-bridge.php tests/test-wizard-bridge.php
git commit -m "feat(admin): add Wizard_Bridge PHP enqueue gate for bundled mode"
```

---

## Task 11: Wire `Wizard_Bridge` into the main plugin file

**Files:**
- Modify: `newspack-newsletters.php`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Inspect existing `require_once` order**

```bash
grep -n 'require_once' newspack-newsletters.php | tail -30
```

Identify a logical place to add the new require — towards the bottom of the require block, after other classes in the `Newspack\Newsletters` namespace.

- [ ] **Step 2: Add the require + init call**

Add to `newspack-newsletters.php`, in the require block:

```php
require_once NEWSPACK_NEWSLETTERS_PLUGIN_FILE . 'includes/class-wizard-bridge.php';
```

After the require block (or in the existing init dispatch), add:

```php
\Newspack\Newsletters\Wizard_Bridge::init();
```

- [ ] **Step 3: Run composer dump-autoload (per AGENTS.md)**

```bash
n composer dump-autoload
```

Expected: success.

- [ ] **Step 4: Run the PHP test again to confirm wiring works end-to-end**

```bash
n test-php --filter Wizard_Bridge_Test
```

Expected: PASS.

- [ ] **Step 5: Run lint**

```bash
n npm run lint:php
```

Expected: no errors on the new files.

- [ ] **Step 6: Commit**

```bash
git add newspack-newsletters.php composer.json composer.lock
git commit -m "feat(admin): wire Wizard_Bridge into main plugin file"
```

(Composer files are added in case `dump-autoload` regenerated checksums; if the diff is empty for those, just commit `newspack-newsletters.php`.)

---

## Task 12: README `## Extending` section

**Files:**
- Modify: `README.md`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Append the new section**

Append to `README.md` (after the existing `### Environment variables` block):

````markdown
## Extending

This plugin exposes two surfaces for downstream plugins (such as `newspack-plugin`) to extend the local-list management modal in bundled mode:

### Document events

The wizard bridge dispatches and listens for these `CustomEvent`s on `document`. Listeners attach with standard `document.addEventListener`.

| Event | Direction | Detail | Fires |
|---|---|---|---|
| `newspack-newsletters:bridge-mounted` | Bridge → consumer | `{}` | Once, when the bridge first mounts. |
| `newspack-newsletters:open-local-list-modal` | Consumer → Bridge | `{ mode: 'add' \| 'edit', list: object \| null }` | When a consumer wants to open the modal. |
| `newspack-newsletters:open-local-list-confirm-delete` | Consumer → Bridge | `{ list: object }` | When a consumer wants to open the delete confirmation. |
| `newspack-newsletters:local-list-saved` | Bridge → consumer | `{ listId, mode, list }` | After a successful POST/PATCH to `/lists/local`, after extension `onSave` callbacks settle. |
| `newspack-newsletters:local-list-deleted` | Bridge → consumer | `{ listId }` | After a successful DELETE to `/lists/local/<id>`. |

### Modal extension registry

For extensions that need to render UI inside the modal or run async work after a successful save, register through:

```js
window.newspack.newsletters.registerLocalListModalExtension( id, {
    // Required: JSX to render after the built-in fields, inside the modal's <form>.
    render: ( ctx ) => JSX,

    // Optional: async callback after successful POST/PATCH, before the modal closes.
    // Errors surface as a snackbar; the underlying list save is not rolled back.
    onSave: async ( ctx ) => { /* ... */ },
} );
```

Render `ctx`: `{ list, mode, isBusy }`. `onSave` `ctx`: `{ listId, list, mode }`.

**Load-order independent.** Consumers can register before or after the bridge bundle loads:

```js
const np = ( window.newspack = window.newspack || {} );
np.newsletters = np.newsletters || {};
( np.newsletters._pendingExtensions = np.newsletters._pendingExtensions || [] )
    .push( [ id, definition ] );
```

The bridge drains `_pendingExtensions` on init and then exposes `registerLocalListModalExtension` directly for late registrations.

### Worked example: featured-image picker (newspack-plugin)

```js
import apiFetch from '@wordpress/api-fetch';
import { useState } from '@wordpress/element';
import { MediaUpload } from '@wordpress/block-editor';

const mediaIdRef = { current: null };

const FeaturedImagePicker = ( { listId } ) => {
    const [ mediaId, setMediaId ] = useState( null );
    mediaIdRef.current = mediaId;
    return (
        <MediaUpload
            value={ mediaId }
            onSelect={ media => setMediaId( media.id ) }
            render={ ( { open } ) => <button onClick={ open }>Choose featured image</button> }
        />
    );
};

window.newspack.newsletters.registerLocalListModalExtension( 'newspack-plugin/featured-image', {
    render: ctx => <FeaturedImagePicker listId={ ctx.list?.db_id } />,
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

The picker holds its state in a closure-captured ref. `onSave` reads the ref after the modal's own POST/PATCH succeeds. The owning plugin's REST route is opaque to this plugin.

### When to use which

- **Document events** — pure side-effects after save, or UI that lives outside the modal (e.g. wizard-card elements that should refresh on local-list change).
- **Modal extension registry** — UI that must appear inside the modal, or async work that should complete before the modal closes.

### Stability

Event names + payload shapes and the registry API are committed to backwards compatibility on minor releases. New optional fields on the extension definition are additive.
````

- [ ] **Step 2: Lint Markdown (if a linter is configured)**

```bash
n npm run lint -- README.md 2>/dev/null || true
```

Expected: no errors. Markdown linters may not be wired up; that's fine.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the wizard-bridge extension contract in README"
```

---

## Task 13: CONTEXT.md decisions log entry

**Files:**
- Modify: `docs/newsletter-modernisation/CONTEXT.md`

**Working dir:** `repos/newspack-newsletters`

- [ ] **Step 1: Append the entry**

In `docs/newsletter-modernisation/CONTEXT.md`, find the "Decisions log" section. Newest entries go at the top (per the file's instruction). Insert a new entry as the first item:

```markdown
- **2026-05-07** — **NEWS-2152 — bundled-mode parity for the local-list modal via event-driven mount handoff, not full Subscription Lists consolidation.** The wizard's `<SubscriptionLists>` ActionCard chrome and per-row toggle UI in newspack-plugin stay as-is; only the local-list CRUD affordances unify. newspack-newsletters enqueues a small `wizard-bridge` JS bundle on the bundled-mode wizard page (`?page=newspack-newsletters`) that mounts a `<LocalListModalHost>` at body level. The wizard's Add New / per-row Edit / per-row Delete buttons dispatch documented `CustomEvent`s on `document`; the host renders `<LocalListModal>` or `<LocalListDeleteModal>` via portal and dispatches `local-list-saved` / `local-list-deleted` after REST success, which the wizard listens for to reload its lists. Standalone shell unchanged — `<ListsSection>` keeps mounting `<LocalListModal>` directly via React composition. Two extension surfaces ship: (a) the four document events (`bridge-mounted`, `open-local-list-modal`, `open-local-list-confirm-delete`, `local-list-saved`, `local-list-deleted`), for out-of-modal UX or pure side effects; (b) a modal extension registry (`registerLocalListModalExtension`) for in-modal UI + async post-save callbacks. Cross-bundle registration is order-independent via a `_pendingExtensions` queue drained by the bridge on init. `Subscription_Lists::get_add_new_url()` and the `new_subscription_lists_url` localised global stay untouched — wider consumer set (audience wizard, legacy classic-PHP standalone page) puts retirement out of this ticket's scope. README ships a new `## Extending` section as the canonical extension reference; future ESP and modal recipes accumulate there.
```

- [ ] **Step 2: Commit**

```bash
git add docs/newsletter-modernisation/CONTEXT.md
git commit -m "docs(modernisation): log NEWS-2152 wizard-bridge decisions"
```

---

## Task 14: Cut newspack-plugin per-ticket branch

**Working dir:** `repos/newspack-plugin`

The newspack-plugin work targets that repo's `trunk`, not the newsletters epic branch.

- [ ] **Step 1: Confirm clean state and trunk freshness**

```bash
git status --short
git checkout trunk
git pull --ff-only
```

Expected: clean status; trunk up-to-date.

- [ ] **Step 2: Cut the branch**

```bash
git checkout -b news-2152-bundled-mode-modal-parity
```

Expected: switched to new branch.

---

## Task 15: Modify `<SubscriptionLists>` in the wizard

**Files:**
- Modify: `src/wizards/newsletters/views/settings/index.js`

**Working dir:** `repos/newspack-plugin`

- [ ] **Step 1: Locate the existing component**

Open `src/wizards/newsletters/views/settings/index.js`. Find the `SubscriptionLists` component (currently around lines 251-383).

- [ ] **Step 2: Add helper constants and imports**

At the top of the file, add to the existing `@wordpress/element` import:

```javascript
import { useEffect, useRef, useState, Fragment } from '@wordpress/element';
```

Add the @wordpress/components imports (extend the existing `@wordpress/components` line):

```javascript
import { CheckboxControl, TextareaControl, ExternalLink, Notice, Button, __experimentalHStack as HStack } from '@wordpress/components'; // eslint-disable-line @wordpress/no-unsafe-wp-apis
```

(If `Button` is already imported from `../../../../../packages/components/src`, keep that one and skip the `@wordpress/components` `Button` to avoid a name clash.)

Define event-name constants (mirror the bridge's `events.js` — kept locally so this file is self-contained without a cross-repo import):

```javascript
const NN_EVENT_NAMESPACE = 'newspack-newsletters';
const NN_EVENTS = {
	BRIDGE_MOUNTED: `${ NN_EVENT_NAMESPACE }:bridge-mounted`,
	OPEN_MODAL: `${ NN_EVENT_NAMESPACE }:open-local-list-modal`,
	OPEN_CONFIRM_DELETE: `${ NN_EVENT_NAMESPACE }:open-local-list-confirm-delete`,
	LOCAL_LIST_SAVED: `${ NN_EVENT_NAMESPACE }:local-list-saved`,
	LOCAL_LIST_DELETED: `${ NN_EVENT_NAMESPACE }:local-list-deleted`,
};
const NN_FALLBACK_TIMEOUT_MS = 500;
```

- [ ] **Step 3: Add bridge-mounted detection at module level**

Just below the constants, add:

```javascript
let bridgeMounted = false;
if ( typeof document !== 'undefined' ) {
	document.addEventListener( NN_EVENTS.BRIDGE_MOUNTED, () => {
		bridgeMounted = true;
	} );
}
```

- [ ] **Step 4: Replace the `SubscriptionLists` component**

Locate the existing `export const SubscriptionLists = ( { lockedLists, onUpdate, provider } ) => { ... };` block. Replace its body to:

(a) on Add New click: dispatch the open-modal event with mode add; start fallback timer.
(b) for `type === 'local'` rows: render Edit + Delete buttons that dispatch open-modal (mode edit) and open-confirm-delete events; start fallback timers.
(c) on saved/deleted events: call `fetchLists()` to refresh.

Replace with:

```javascript
export const SubscriptionLists = ( { lockedLists, onUpdate, provider } ) => {
	const [ error, setError ] = useState( false );
	const [ inFlight, setInFlight ] = useState( false );
	const [ lists, setLists ] = useState( [] );
	const fallbackTimerRef = useRef( null );

	const updateConfig = data => {
		setLists( data );
		if ( typeof onUpdate === 'function' ) {
			onUpdate( data );
		}
	};
	const fetchLists = () => {
		setError( false );
		setInFlight( true );
		apiFetch( {
			path: '/newspack-newsletters/v1/lists',
		} )
			.then( updateConfig )
			.catch( setError )
			.finally( () => setInFlight( false ) );
	};
	const saveLists = () => {
		setError( false );
		setInFlight( true );
		apiFetch( {
			path: '/newspack-newsletters/v1/lists',
			method: 'post',
			data: { lists },
		} )
			.then( updateConfig )
			.catch( setError )
			.finally( () => setInFlight( false ) );
	};
	const handleChange = ( index, name ) => value => {
		const newLists = [ ...lists ];
		newLists[ index ][ name ] = value;
		updateConfig( newLists );
	};

	useEffect( () => {
		setError( false );
		if ( provider && ! lockedLists ) {
			setLists( [] );
			fetchLists();
		}
	}, [ provider, lockedLists ] );

	useEffect( () => {
		const reload = () => fetchLists();
		document.addEventListener( NN_EVENTS.LOCAL_LIST_SAVED, reload );
		document.addEventListener( NN_EVENTS.LOCAL_LIST_DELETED, reload );
		return () => {
			document.removeEventListener( NN_EVENTS.LOCAL_LIST_SAVED, reload );
			document.removeEventListener( NN_EVENTS.LOCAL_LIST_DELETED, reload );
		};
	}, [] );

	const startFallbackTimer = ( fallbackUrl ) => {
		if ( bridgeMounted || ! fallbackUrl ) {
			return;
		}
		clearTimeout( fallbackTimerRef.current );
		fallbackTimerRef.current = setTimeout( () => {
			if ( ! bridgeMounted ) {
				window.location.href = fallbackUrl;
			}
		}, NN_FALLBACK_TIMEOUT_MS );
	};

	const dispatchOpenAdd = () => {
		document.dispatchEvent( new CustomEvent( NN_EVENTS.OPEN_MODAL, { detail: { mode: 'add' } } ) );
		startFallbackTimer( newspack_newsletters_wizard.new_subscription_lists_url );
	};
	const dispatchOpenEdit = list => {
		document.dispatchEvent( new CustomEvent( NN_EVENTS.OPEN_MODAL, { detail: { mode: 'edit', list } } ) );
		startFallbackTimer( list?.edit_link );
	};
	const dispatchConfirmDelete = list => {
		document.dispatchEvent( new CustomEvent( NN_EVENTS.OPEN_CONFIRM_DELETE, { detail: { list } } ) );
		startFallbackTimer( list?.edit_link );
	};

	if ( ! inFlight && ! lists?.length && ! error ) {
		return null;
	}
	if ( inFlight && ! lists?.length && ! error ) {
		return (
			<div className="flex justify-around mt4">
				<Waiting />
			</div>
		);
	}

	/* eslint-disable no-nested-ternary */
	const notification = lockedLists
		? __( 'Please save your ESP settings before changing your subscription lists.', 'newspack-plugin' )
		: error
		? error?.message || __( 'Something went wrong.', 'newspack-plugin' )
		: null;

	return (
		<ActionCard
			isMedium
			title={ __( 'Subscription Lists', 'newspack-plugin' ) }
			description={ __( 'Manage the lists available to readers for subscription.', 'newspack-plugin' ) }
			notification={ notification }
			notificationLevel={ error ? 'error' : 'warning' }
			hasGreyHeader
			actionContent={
				<>
					{ newspack_newsletters_wizard.new_subscription_lists_url && (
						<Button
							variant="secondary"
							disabled={ inFlight || lockedLists }
							onClick={ dispatchOpenAdd }
						>
							{ __( 'Add New', 'newspack-plugin' ) }
						</Button>
					) }
					<Button isPrimary onClick={ saveLists } disabled={ inFlight || lockedLists }>
						{ __( 'Save Subscription Lists', 'newspack-plugin' ) }
					</Button>
				</>
			}
			disabled={ inFlight || lockedLists }
		>
			{ ! lockedLists &&
				! error &&
				lists.map( ( list, index ) => {
					const isLocal = 'local' === list?.type;
					return (
						<ActionCard
							key={ index }
							isSmall
							simple
							hasWhiteHeader
							title={ list.name }
							description={ list?.type_label ? list.type_label : null }
							disabled={ inFlight }
							toggleOnChange={ handleChange( index, 'active' ) }
							toggleChecked={ list.active }
							className={
								list?.id && ( list.id.startsWith( 'group' ) || list.id.startsWith( 'tag' ) ) ? 'newspack-newsletters-sub-list-item' : ''
							}
							actionText={
								isLocal ? (
									<HStack spacing={ 2 } justify="flex-end" expanded={ false }>
										<Button variant="link" onClick={ () => dispatchOpenEdit( list ) } disabled={ inFlight }>
											{ __( 'Edit', 'newspack-plugin' ) }
										</Button>
										<Button variant="link" isDestructive onClick={ () => dispatchConfirmDelete( list ) } disabled={ inFlight }>
											{ __( 'Delete', 'newspack-plugin' ) }
										</Button>
									</HStack>
								) : list?.edit_link ? (
									<ExternalLink href={ list.edit_link }>{ __( 'Edit', 'newspack-plugin' ) }</ExternalLink>
								) : null
							}
						>
							{ list.active && ! isLocal && (
								<>
									<TextControl
										label={ __( 'List title', 'newspack-plugin' ) }
										value={ list.title }
										disabled={ inFlight || isLocal }
										onChange={ handleChange( index, 'title' ) }
									/>
									<TextareaControl
										label={ __( 'List description', 'newspack-plugin' ) }
										value={ list.description }
										disabled={ inFlight || isLocal }
										onChange={ handleChange( index, 'description' ) }
									/>
								</>
							) }
						</ActionCard>
					);
				} ) }
		</ActionCard>
	);
};
```

- [ ] **Step 5: Build and verify locally**

```bash
n build
```

Expected: build succeeds. (Run from inside `repos/newspack-plugin/` so `n` targets newspack-plugin.)

- [ ] **Step 6: Lint**

```bash
n npm run lint:js -- src/wizards/newsletters/views/settings/index.js
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/wizards/newsletters/views/settings/index.js
git commit -m "feat(newsletters): wire wizard SubscriptionLists to wizard-bridge events"
```

---

## Task 16: Test the wizard `<SubscriptionLists>` changes

**Files:**
- Create: `src/wizards/newsletters/views/settings/index.test.js`

**Working dir:** `repos/newspack-plugin`

- [ ] **Step 1: Write the test**

Create `src/wizards/newsletters/views/settings/index.test.js`:

```javascript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import apiFetch from '@wordpress/api-fetch';

import { SubscriptionLists } from './index';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

const NN_EVENTS = {
	BRIDGE_MOUNTED: 'newspack-newsletters:bridge-mounted',
	OPEN_MODAL: 'newspack-newsletters:open-local-list-modal',
	OPEN_CONFIRM_DELETE: 'newspack-newsletters:open-local-list-confirm-delete',
	LOCAL_LIST_SAVED: 'newspack-newsletters:local-list-saved',
	LOCAL_LIST_DELETED: 'newspack-newsletters:local-list-deleted',
};

beforeAll( () => {
	global.newspack_newsletters_wizard = {
		new_subscription_lists_url: 'https://example.test/wp-admin/post-new.php?post_type=newspack_nl_list',
	};
} );

beforeEach( () => {
	apiFetch.mockReset();
	apiFetch.mockResolvedValue( [
		{ id: 'tag-1', name: 'Local A', type: 'local', active: false, db_id: 1, edit_link: 'https://example.test/edit-local-a' },
		{ id: 'group-1', name: 'Remote group', type: 'group', active: true },
	] );
	document.dispatchEvent( new CustomEvent( NN_EVENTS.BRIDGE_MOUNTED ) );
} );

describe( 'SubscriptionLists — wizard-bridge wiring', () => {
	it( 'dispatches OPEN_MODAL with mode=add when Add New is clicked', async () => {
		const listener = jest.fn();
		document.addEventListener( NN_EVENTS.OPEN_MODAL, listener );
		render( <SubscriptionLists lockedLists={ false } provider="mailchimp" /> );
		await waitFor( () => expect( screen.getByRole( 'button', { name: /^Add New$/ } ) ).toBeEnabled() );
		fireEvent.click( screen.getByRole( 'button', { name: /^Add New$/ } ) );
		expect( listener ).toHaveBeenCalled();
		expect( listener.mock.calls[ 0 ][ 0 ].detail ).toEqual( { mode: 'add' } );
		document.removeEventListener( NN_EVENTS.OPEN_MODAL, listener );
	} );

	it( 'dispatches OPEN_MODAL with mode=edit + list when Edit is clicked on a local row', async () => {
		const listener = jest.fn();
		document.addEventListener( NN_EVENTS.OPEN_MODAL, listener );
		render( <SubscriptionLists lockedLists={ false } provider="mailchimp" /> );
		await waitFor( () => expect( screen.getByText( 'Local A' ) ).toBeInTheDocument() );
		fireEvent.click( screen.getAllByRole( 'button', { name: /^Edit$/ } )[ 0 ] );
		expect( listener.mock.calls[ 0 ][ 0 ].detail ).toEqual(
			expect.objectContaining( { mode: 'edit', list: expect.objectContaining( { db_id: 1 } ) } )
		);
		document.removeEventListener( NN_EVENTS.OPEN_MODAL, listener );
	} );

	it( 'dispatches OPEN_CONFIRM_DELETE when Delete is clicked on a local row', async () => {
		const listener = jest.fn();
		document.addEventListener( NN_EVENTS.OPEN_CONFIRM_DELETE, listener );
		render( <SubscriptionLists lockedLists={ false } provider="mailchimp" /> );
		await waitFor( () => expect( screen.getByText( 'Local A' ) ).toBeInTheDocument() );
		fireEvent.click( screen.getByRole( 'button', { name: /^Delete$/ } ) );
		expect( listener.mock.calls[ 0 ][ 0 ].detail ).toEqual(
			expect.objectContaining( { list: expect.objectContaining( { db_id: 1 } ) } )
		);
		document.removeEventListener( NN_EVENTS.OPEN_CONFIRM_DELETE, listener );
	} );

	it( 'reloads lists when LOCAL_LIST_SAVED fires', async () => {
		render( <SubscriptionLists lockedLists={ false } provider="mailchimp" /> );
		await waitFor( () => expect( apiFetch ).toHaveBeenCalledTimes( 1 ) );
		document.dispatchEvent( new CustomEvent( NN_EVENTS.LOCAL_LIST_SAVED, { detail: { listId: 1, mode: 'edit' } } ) );
		await waitFor( () => expect( apiFetch ).toHaveBeenCalledTimes( 2 ) );
	} );

	it( 'reloads lists when LOCAL_LIST_DELETED fires', async () => {
		render( <SubscriptionLists lockedLists={ false } provider="mailchimp" /> );
		await waitFor( () => expect( apiFetch ).toHaveBeenCalledTimes( 1 ) );
		document.dispatchEvent( new CustomEvent( NN_EVENTS.LOCAL_LIST_DELETED, { detail: { listId: 1 } } ) );
		await waitFor( () => expect( apiFetch ).toHaveBeenCalledTimes( 2 ) );
	} );
} );
```

- [ ] **Step 2: Run test**

```bash
n test-js -- --testPathPattern 'wizards/newsletters/views/settings/index.test.js'
```

Expected: PASS — all five cases.

- [ ] **Step 3: Commit**

```bash
git add src/wizards/newsletters/views/settings/index.test.js
git commit -m "test(newsletters): cover wizard SubscriptionLists bridge wiring"
```

---

## Task 17: Open both PRs

**Working dir:** alternates between repos.

- [ ] **Step 1: Push and open the newspack-newsletters PR**

```bash
cd repos/newspack-newsletters
git push -u origin news-2152-bundled-mode-parity-share-subscription-lists-settings
```

Use the `newspack:pr-create` skill (Claude Code plugin) to open the PR against `epic/admin-ux-modernisation`. PR title:

```
feat(admin): bundled-mode parity for the local-list modal (NEWS-2152)
```

PR body (include in the create call):

```
Closes NEWS-2152.

## What

Brings NEWS-2093's local-list create / edit / delete modal into bundled mode (newspack-plugin's Engagement → Newsletters → Settings wizard) via an event-driven mount handoff. The wizard's `<SubscriptionLists>` ActionCard chrome and per-row toggle UI in newspack-plugin stay as-is; only the local-list CRUD affordances unify.

## How

- New `src/wizard-bridge/` bundle that mounts `<LocalListModalHost>` at body level on the bundled-mode wizard page.
- Wizard side (paired PR in newspack-plugin): per-row Edit / Delete buttons + Add New onClick dispatch documented `CustomEvent`s; useEffect listener reloads lists on `local-list-saved` / `local-list-deleted`.
- Modal extension registry (`registerLocalListModalExtension`) lets newspack-plugin (and others) render in-modal UI + run async post-save side effects. Designed for the upcoming featured-image picker.
- README ships a new `## Extending` section documenting both event contract + registry.

## Companion PR

newspack-plugin: <link>

## Context updates

- `docs/newsletter-modernisation/CONTEXT.md`: dated entry under Decisions log.

## Test plan

- Standalone shell regression — `<ListsSection>` flows for Add / Edit / Delete still work via direct React state.
- Bundled-mode UAT — Add / Edit / Delete via wizard, audience picker, error surfaces, fallback timer.
- See `docs/newsletter-modernisation/news-2152-design.md` for the full UAT checklist.
```

- [ ] **Step 2: Push and open the newspack-plugin PR**

```bash
cd ../newspack-plugin
git push -u origin news-2152-bundled-mode-modal-parity
```

Use `newspack:pr-create`. PR title:

```
feat(newsletters): bundled-mode parity for local-list modal (NEWS-2152)
```

PR body:

```
Companion to https://github.com/Automattic/newspack-newsletters/pull/<N>.

Wires the Newsletters wizard's `<SubscriptionLists>` per-row Edit / Delete buttons and Add New click to the documented `wizard-bridge` events. Listener reloads the lists on save / delete. 500 ms fallback timer routes to the legacy CPT editor URL when the bridge bundle is missing.

## Test plan

- Run paired newspack-newsletters branch.
- Smoke-test Add / Edit / Delete on a Mailchimp + Constant Contact dev site.
- Disable newspack-newsletters bundle JS to confirm the fallback timer redirects to the legacy URL.
```

- [ ] **Step 3: Verify Copilot review starts on both PRs**

Both should auto-request a Copilot review per the project workflow. Confirm in the PRs' Reviewers panel.

---

## Task 18: Manual UAT

**Working dir:** any.

This task does not produce code or commits — it's a checklist to run in a real environment before requesting human review.

Use a `n env create` isolated environment with both repos as worktrees so the paired PRs can be exercised together.

- [ ] **Step 1: Spin up the environment**

```bash
n env create news2152 --worktree newspack-newsletters:news-2152-bundled-mode-parity-share-subscription-lists-settings --worktree newspack-plugin:news-2152-bundled-mode-modal-parity
n env up news2152 --build
n setup --env news2152 --yes
```

- [ ] **Step 2: Bundled-mode happy path**

In Engagement → Newsletters (with newspack-plugin active):
- Click "Add New" in Subscription Lists → modal opens.
- Fill title + description, pick an audience, submit.
- Assert: row appears in the wizard list immediately, audience wired (visible in legacy CPT editor for spot-check).

- [ ] **Step 3: Edit a local row**

- Click "Edit" on a local list.
- Assert: modal opens pre-populated with title + description + audience.
- Change the title, submit.
- Assert: row re-renders with the new title; ESP tag synced (`update_esp_local_list` ran).

- [ ] **Step 4: Delete a local row**

- Click "Delete" on a local list.
- Confirm in the dialog.
- Assert: row disappears from the wizard list.

- [ ] **Step 5: Fallback timer**

- DevTools → Network → block `**/wizard-bridge.js`.
- Reload Subscription Lists wizard.
- Click "Add New". Assert: ~500 ms later, page navigates to `?post_type=newspack_nl_list` (legacy CPT editor).

- [ ] **Step 6: Standalone-mode regression**

- Disable newspack-plugin (worktree).
- Visit `?page=newspack-newsletters-settings` in the React shell.
- Add / Edit / Delete via `<ListsSection>` — all work as before.
- Network tab: confirm `wizard-bridge.js` is **not** loaded.

- [ ] **Step 7: Cross-mode round-trip**

- In bundled mode: create List X via the modal.
- Disable newspack-plugin.
- In standalone mode: List X is present, editable, deletable.

- [ ] **Step 8: Cleanup**

```bash
n env destroy news2152
```

- [ ] **Step 9: Mark Linear ticket Verified-by-Thomas**

Add a comment to NEWS-2152 noting UAT pass and any follow-up tickets filed.

---

## Self-Review Checklist

After execution, run through these:

- [ ] Spec coverage: every section of `news-2152-design.md` mapped to tasks above (architecture → 7-9, components → 2-10, data flow → 7+15, extension contract → 4+5+12, error handling → 15 fallback timer + 7 host snackbar, testing → 2+3+4+5+7+8+10+16+18).
- [ ] No placeholders ("TBD", "TODO", "implement later") in any task above.
- [ ] Type / API consistency: `EVENTS.OPEN_MODAL` is the same constant in `events.js` (Task 6), `local-list-modal-host.js` (Task 7), `index.js` (Task 8), and the test in Task 7. Wizard-side `NN_EVENTS.OPEN_MODAL` (Task 15) targets the same string. Spec, README (Task 12), and CONTEXT entry (Task 13) all match.
- [ ] Build artefacts named consistently: `dist/wizard-bridge.js` + `dist/wizard-bridge.css` produced by Task 9, enqueued by Task 10's `Wizard_Bridge::maybe_enqueue`.

If a discrepancy surfaces, fix it inline in this plan and the affected files.
