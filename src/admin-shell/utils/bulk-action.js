/**
 * Shared scaffolding for parallel per-item mutations behind a single
 * row/bulk action callback. Captures the `failed = []; Promise.all(... catch)`
 * pattern + the success / partial-failure notice dispatch.
 *
 * Callers supply the pre-translated singular/plural strings via
 * `successPlural` and `failurePlural` callbacks so each screen can use
 * the right noun and `_n` form. The helper itself stays i18n-agnostic.
 */

import { notifyError, notifySuccess } from '../notices';

/**
 * Run an async `op( item )` against every item in parallel, swallowing
 * per-item rejections, then dispatch a single aggregated notice.
 *
 * `refresh` runs once all ops have settled (success or failure) so the
 * list reflects whatever state the server actually arrived at. The
 * caller is responsible for pre-filtering `items` against any
 * `isEligible` predicate — non-modal bulk callbacks receive the full
 * DataViews selection.
 *
 * @param {Array<Object>}                        items
 * @param {( item: Object ) => Promise<unknown>} op
 * @param {Object}                               options
 * @param {() => void}                           options.refresh       Invoked after all ops settle.
 * @param {( successCount: number ) => string}   options.successPlural Pre-rendered success notice.
 * @param {( failedCount: number ) => string}    options.failurePlural Pre-rendered failure notice.
 * @return {Promise<{ failed: Array<Object>, succeeded: number }>} Outcome counts.
 */
export async function runBulk( items, op, { refresh, successPlural, failurePlural } ) {
	const failed = [];
	await Promise.all(
		items.map( item =>
			op( item ).catch( () => {
				failed.push( item );
			} )
		)
	);
	if ( typeof refresh === 'function' ) {
		refresh();
	}
	const succeeded = items.length - failed.length;
	if ( failed.length === 0 ) {
		notifySuccess( successPlural( succeeded ) );
	} else {
		notifyError( failurePlural( failed.length ) );
	}
	return { failed, succeeded };
}
