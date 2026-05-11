// <ShellNotices> in app.js only renders `type: 'snackbar'` entries — plain
// dispatches are silently dropped. Errors default to explicitDismiss so the
// aria-live announcement isn't auto-dismissed before it can be read.
import { dispatch } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

export function notifySuccess( message, options = {} ) {
	dispatch( noticesStore ).createSuccessNotice( message, { type: 'snackbar', ...options } );
}

export function notifyError( message, options = {} ) {
	dispatch( noticesStore ).createErrorNotice( message, { type: 'snackbar', explicitDismiss: true, ...options } );
}
