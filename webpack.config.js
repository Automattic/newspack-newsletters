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
const blocks = path.join( __dirname, 'src', 'blocks' );
const editor = path.join( __dirname, 'src', 'editor' );
const admin = path.join( __dirname, 'src', 'admin' );
const adsEditor = path.join( __dirname, 'src', 'ads-admin', 'editor' );
const branding = path.join( __dirname, 'src', 'branding' );
const quickEdit = path.join( __dirname, 'src', 'quick-edit' );
const editorBlocks = path.join( __dirname, 'src', 'editor', 'blocks' );
const newsletterEditor = path.join( __dirname, 'src', 'newsletter-editor' );

const webpackConfig = getBaseWebpackConfig(
	{ WP: true },
	{
		entry: {
			blocks,
			editor,
			admin,
			adsEditor,
			branding,
			quickEdit,
			editorBlocks,
			newsletterEditor,
		},
		'output-path': path.join( __dirname, 'dist' ),
	}
);

module.exports = webpackConfig;
