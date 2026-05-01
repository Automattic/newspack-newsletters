/**
 * Reusable empty-state for admin-shell list screens (NEWS-1952 fold-in).
 *
 * Mirrors the visual shape of newspack-plugin's content-gates onboarding
 * (`src/wizards/audience/views/content-gates/content-gates-onboarding.tsx`):
 * a centred column with a `SectionHeader` (`pageHeader`) followed by a
 * single chevron `Card` linking to the create flow.
 *
 * Strict-empty only — render this when the unfiltered list has zero
 * items. The filter-empty / search-empty case keeps the DataView's
 * built-in "no results" treatment.
 */

import { Card, Grid, SectionHeader } from 'newspack-components';
import { Icon, chevronRight } from '@wordpress/icons';

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
	const cardProps = ctaOnClick
		? {
				onClick: ctaOnClick,
				role: 'button',
				tabIndex: 0,
				onKeyDown: event => {
					if ( event.key === 'Enter' || event.key === ' ' ) {
						event.preventDefault();
						ctaOnClick( event );
					}
				},
		  }
		: { href: ctaHref };

	return (
		<Grid columns={ 4 } gutter={ 16 } className="newspack-newsletters-empty-state">
			<div style={ { gridColumn: '2 / span 2' } }>
				<SectionHeader pageHeader centered icon={ icon } title={ title } description={ description } noMargin />
				<Card { ...cardProps } className="newspack-newsletters-empty-state__cta">
					<div className="newspack-newsletters-empty-state__cta-body">
						{ ctaIcon && (
							<div className="newspack-newsletters-empty-state__cta-icon">
								<Icon icon={ ctaIcon } size={ 32 } />
							</div>
						) }
						<div className="newspack-newsletters-empty-state__cta-text">
							<h3 className="newspack-newsletters-empty-state__cta-title">{ ctaTitle }</h3>
							{ ctaDescription && <p>{ ctaDescription }</p> }
						</div>
						<div className="newspack-newsletters-empty-state__cta-chevron">
							<Icon icon={ chevronRight } size={ 24 } />
						</div>
					</div>
				</Card>
			</div>
		</Grid>
	);
}
