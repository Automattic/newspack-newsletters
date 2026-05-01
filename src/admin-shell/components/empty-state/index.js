/**
 * Reusable empty-state for admin-shell list screens (NEWS-1952 fold-in).
 *
 * Mirrors newspack-plugin's content-gates onboarding
 * (`src/wizards/audience/views/content-gates/content-gates-onboarding.tsx`):
 * `Grid` + `VStack` centred column, a `SectionHeader pageHeader`, then a
 * single `Card` (core variant) with `actionType="chevron"`, an icon, a
 * heading, and a short description. Same shape, different copy per
 * surface.
 *
 * Strict-empty only — render this when the unfiltered list has zero
 * items. The filter-empty / search-empty case keeps the DataView's
 * built-in "no results" treatment.
 */

import { __experimentalVStack as VStack } from '@wordpress/components'; // eslint-disable-line @wordpress/no-unsafe-wp-apis
import { Card, Grid, SectionHeader } from 'newspack-components';

/**
 * @typedef {Object} EmptyStateProps
 * @property {*}        icon           Icon component (from `@wordpress/icons` or similar) for the page header.
 * @property {string}   title          Page-header title (e.g. "Get started with advertisers").
 * @property {string}   description    Short, value-prop description below the title.
 * @property {*}        ctaIcon        Icon component for the action card.
 * @property {string}   ctaTitle       Action-card heading (e.g. "Add new advertiser").
 * @property {string}   ctaDescription Action-card body copy.
 * @property {string}   [ctaHref]      Action-card link target. Mutually exclusive with `ctaOnClick`.
 * @property {Function} [ctaOnClick]   Click handler. Used when the create flow is in-page (e.g. opens a modal)
 *                                     rather than a navigation. Mutually exclusive with `ctaHref`.
 */

/**
 * @param {EmptyStateProps} props
 * @return {JSX.Element} The rendered empty state.
 */
export default function EmptyState( { icon, title, description, ctaIcon, ctaTitle, ctaDescription, ctaHref, ctaOnClick } ) {
	// `as: 'a'` enables the core card's link styling (chevron-on-hover,
	// large hit area). When the create flow is in-page (no href), we
	// still render an anchor for consistent styling but wire `onClick`
	// + `role`/`tabIndex` so the card behaves like a button. Returning
	// `false` from the handler doesn't matter — the card has no default
	// navigation when `href` is omitted.
	const coreProps = {
		as: 'a',
		header: (
			<>
				<h3>{ ctaTitle }</h3>
				{ ctaDescription && <p>{ ctaDescription }</p> }
			</>
		),
		icon: ctaIcon,
		iconBackgroundColor: true,
	};

	if ( ctaHref ) {
		coreProps.href = ctaHref;
	} else if ( ctaOnClick ) {
		coreProps.role = 'button';
		coreProps.tabIndex = 0;
		coreProps.onClick = event => {
			event.preventDefault();
			ctaOnClick( event );
		};
		coreProps.onKeyDown = event => {
			if ( event.key === 'Enter' || event.key === ' ' ) {
				event.preventDefault();
				ctaOnClick( event );
			}
		};
	}

	return (
		<Grid columns={ 4 } noMargin>
			<VStack start={ 2 } end={ 4 } spacing={ 8 }>
				<SectionHeader icon={ icon } title={ title } description={ description } pageHeader noMargin />
				<Card actionType="chevron" isSmall __experimentalCoreCard __experimentalCoreProps={ coreProps } />
			</VStack>
		</Grid>
	);
}
