require( '@rushstack/eslint-patch/modern-module-resolution' );

module.exports = {
	extends: [ './node_modules/newspack-scripts/config/eslintrc.js' ],
	rules: {
		'react/display-name': 'off',
	},
};
