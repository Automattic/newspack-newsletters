/**
 * Admin shell app chrome.
 *
 * Wraps each admin screen with the page heading and a main landmark.
 * Screens are mounted as the `Screen` prop and rendered inside the
 * landmark so per-screen content stays scoped.
 */

export default function App( { label, Screen } ) {
	return (
		<div className="newspack-newsletters-admin">
			<header className="newspack-newsletters-admin__header">
				<h1>{ label }</h1>
			</header>
			<main className="newspack-newsletters-admin__main">
				<Screen label={ label } />
			</main>
		</div>
	);
}
