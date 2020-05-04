/**
 * Internal dependencies
 */
import { LAYOUT_CPT_SLUG } from '../../consts';

export const templatesSelector = select => {
	const { getEntityRecords } = select( 'core' );

	const layoutTemplatesPosts =
		getEntityRecords( 'postType', LAYOUT_CPT_SLUG, {
			per_page: -1,
		} ) || [];

	return layoutTemplatesPosts.map( ( { content, title, id } ) => ( {
		content: content.raw,
		title: title.raw,
		id,
	} ) );
};
