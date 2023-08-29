/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';
import { useState, useEffect, Fragment } from '@wordpress/element';
import { SelectControl, PanelBody, Spinner, SVG } from '@wordpress/components';
import { useBlockProps, InspectorControls } from '@wordpress/block-editor';

import { NEWSLETTER_AD_CPT_SLUG } from '../../../utils/consts';

import './editor.scss';

export default function SubscribeEdit( { setAttributes, attributes: { adId } } ) {
	const { date } = useSelect( select => {
		const { getEditedPostAttribute } = select( 'core/editor' );
		return { date: getEditedPostAttribute( 'date' ) };
	} );
	const blockProps = useBlockProps();
	const [ adsConfig, setAdsConfig ] = useState( {
		count: 0,
		label: __( 'ads', 'newspack-newsletters' ),
		ads: [],
	} );
	const [ inFlight, setInFlight ] = useState( false );
	useEffect( () => {
		setInFlight( true );
		apiFetch( {
			path: `/wp/v2/${ NEWSLETTER_AD_CPT_SLUG }/config/?date=${ date }`,
		} )
			.then( response => {
				setAdsConfig( response );
			} )
			.catch( e => {
				console.warn( e ); // eslint-disable-line no-console
			} )
			.finally( () => {
				setInFlight( false );
			} );
	}, [ date ] );
	const containerHeight = 200;
	function getAdTitle() {
		if ( ! adId ) {
			return __( 'Automatic selection', 'newspack-newsletters' );
		}
		const ad = adsConfig.ads.find( _ad => _ad.id.toString() === adId );
		return ad ? ad.title : '';
	}
	return (
		<div { ...blockProps }>
			<InspectorControls>
				<PanelBody title={ __( 'Ad Settings' ) }>
					<SelectControl
						label={ __( 'Ad' ) }
						value={ adId }
						disabled={ inFlight }
						options={ [
							{
								label: __( 'Automatic selection', 'newspack-newsletters' ),
								value: '',
							},
						].concat(
							adsConfig.ads.map( ad => ( {
								label: ad.title,
								value: ad.id,
							} ) )
						) }
						onChange={ val => setAttributes( { adId: val } ) }
					/>
					{ ! adId && (
						<p>
							{ __(
								'By not selecting an ad, the system automatically chooses which ad should be rendered in this position.',
								'newspack-newsletters'
							) }
						</p>
					) }
				</PanelBody>
			</InspectorControls>
			<div
				className="newspack-newsletters-ad-block-placeholder"
				style={ { width: 600, height: containerHeight } }
			>
				<Fragment>
					<SVG
						className="newspack-newsletters-ad-block-mock"
						viewBox={ '0 0 600 ' + containerHeight }
					>
						<rect width="600" height={ containerHeight } strokeDasharray="2" />
						<line x1="0" y1="0" x2="100%" y2="100%" strokeDasharray="2" />
					</SVG>
					{ ! inFlight && (
						<span className="newspack-newsletters-ad-block-ad-label">{ getAdTitle() }</span>
					) }
				</Fragment>
				{ inFlight && <Spinner /> }
			</div>
		</div>
	);
}
