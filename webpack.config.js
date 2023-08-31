/**
 **** WARNING: No ES6 modules here. Not transpiled! ****
 */
/* eslint-disable import/no-nodejs-modules */
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * External dependencies
 */
const getBaseWebpackConfig = require( 'newspack-scripts/config/getWebpackConfig' );
const path = require( 'path' );

/**
 * Internal variables
 */
const editor = path.join( __dirname, 'src', 'editor' );
const admin = path.join( __dirname, 'src', 'admin' );
const adsEditor = path.join( __dirname, 'src', 'ads', 'editor' );
const newsletterAdsEditor = path.join( __dirname, 'src', 'ads', 'newsletter-editor' );
const branding = path.join( __dirname, 'src', 'branding' );
const quickEdit = path.join( __dirname, 'src', 'quick-edit' );
const editorBlocks = path.join( __dirname, 'src', 'editor', 'blocks' );
const newsletterEditor = path.join( __dirname, 'src', 'newsletter-editor' );
const blocks = path.join( __dirname, 'src', 'blocks' );
const subscribeBlock = path.join( __dirname, 'src', 'blocks', 'subscribe', 'view.js' );
const subscriptions = path.join( __dirname, 'src', 'subscriptions' );

const webpackConfig = getBaseWebpackConfig(
	{ WP: true },
	{
		entry: {
			editor,
			admin,
			adsEditor,
			newsletterAdsEditor,
			branding,
			quickEdit,
			editorBlocks,
			newsletterEditor,
			blocks,
			subscribeBlock,
			subscriptions,
		},
		'output-path': path.join( __dirname, 'dist' ),
	}
);

module.exports = webpackConfig;
