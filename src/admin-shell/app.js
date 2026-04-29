/**
 * Admin shell app chrome.
 *
 * Wraps each admin screen with the page header (subscribed to the
 * `useHeaderActions` context) and a main landmark. Screens render
 * inside the landmark so per-screen content stays scoped.
 *
 * The `<h1>` is rendered visually-hidden (`.screen-reader-text`):
 * in bundled mode the Newspack admin-header chrome already shows the
 * breadcrumb, but assistive technology still needs a programmatic
 * heading on every shell page — and standalone-mode users get no
 * chrome at all, so the heading would be missing entirely otherwise.
 */

import { HeaderActionsProvider } from './header-actions-context';
import PageHeader from './page-header';

export default function App( { label, Screen } ) {
	return (
		<HeaderActionsProvider>
			<div className="newspack-newsletters-admin">
				<h1 className="screen-reader-text">{ label }</h1>
				<PageHeader />
				<main className="newspack-newsletters-admin__main">
					<Screen label={ label } />
				</main>
			</div>
		</HeaderActionsProvider>
	);
}
