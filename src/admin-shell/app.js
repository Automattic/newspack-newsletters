/**
 * Admin shell app chrome.
 *
 * Wraps each admin screen with the page header (subscribed to the
 * `useHeaderActions` context) and a main landmark. Screens render
 * inside the landmark so per-screen content stays scoped.
 */

import { HeaderActionsProvider } from './header-actions-context';
import PageHeader from './page-header';

export default function App( { label, Screen } ) {
	return (
		<HeaderActionsProvider>
			<div className="newspack-newsletters-admin">
				<PageHeader />
				<main className="newspack-newsletters-admin__main">
					<Screen label={ label } />
				</main>
			</div>
		</HeaderActionsProvider>
	);
}
