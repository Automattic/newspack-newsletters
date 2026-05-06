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

const entry = {
	editor: path.join( __dirname, 'src', 'editor' ),
	admin: path.join( __dirname, 'src', 'admin' ),
	'admin-shell': path.join( __dirname, 'src', 'admin-shell' ),
	adsEditor: path.join( __dirname, 'src', 'ads', 'editor' ),
	newsletterAdsEditor: path.join( __dirname, 'src', 'ads', 'newsletter-editor' ),
	branding: path.join( __dirname, 'src', 'branding' ),
	quickEdit: path.join( __dirname, 'src', 'quick-edit' ),
	editorBlocks: path.join( __dirname, 'src', 'editor', 'blocks' ),
	newsletterEditor: path.join( __dirname, 'src', 'newsletter-editor' ),
	blocks: path.join( __dirname, 'src', 'blocks' ),
	subscribeBlock: path.join( __dirname, 'src', 'blocks', 'subscribe', 'view.js' ),
	subscriptions: path.join( __dirname, 'src', 'subscriptions' ),
};

const webpackConfig = getBaseWebpackConfig( {
	entry,
} );

// `newspack-icons` ships raw JSX in `node_modules/newspack-icons/src/`. The
// default babel-loader rule from `@wordpress/scripts` excludes node_modules,
// so the package fails to parse. Carve out an exception.
webpackConfig.module.rules = webpackConfig.module.rules.map( rule => {
	if ( rule.test && rule.test.toString() === /\.m?(j|t)sx?$/.toString() && rule.exclude ) {
		return { ...rule, exclude: /node_modules\/(?!newspack-icons)/ };
	}
	return rule;
} );

module.exports = webpackConfig;
