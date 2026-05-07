# newspack-newsletters
Author email newsletters in WordPress

Visit [the documentation](https://help.newspack.com/engagement/newspack-newsletters/) for more guidance.

## Development

Run `composer update && npm install`.

Run `npm run build`.

### Environment variables

```php

// Optionally change the Letterhead API endpoint for development
define('NEWSPACK_NEWSLETTERS_LETTERHEAD_ENDPOINT', 'https://a-different-endpoint.dev');
```

## Extending

This plugin exposes two surfaces for downstream plugins (such as `newspack-plugin`) to extend the local-list management modal in bundled mode:

### Document events

The wizard bridge dispatches and listens for these `CustomEvent`s on `document`. Listeners attach with standard `document.addEventListener`.

| Event | Direction | Detail | Fires |
|---|---|---|---|
| `newspack-newsletters:bridge-mounted` | Bridge → consumer | `{}` | Once, when the bridge has rendered **and its document listeners are installed**, so a consumer reacting to this event may synchronously dispatch `open-local-list-modal` (or any other consumer→bridge event) and be heard. The bridge also sets `window.newspackNewslettersBridgeReady = true` immediately before dispatching — read the flag when your listener may register after boot. |
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
