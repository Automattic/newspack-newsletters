/**
 * WordPress dependencies
 */
import { isInTheFuture } from '@wordpress/date';

export const isAdActive = ad =>
	ad.status === 'publish' && ad.meta.expiry_date && isInTheFuture( ad.meta.expiry_date );
