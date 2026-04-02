/**
 * External dependencies
 */
import { isEmpty } from 'lodash';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useInstanceId } from '@wordpress/compose';
import { BaseControl, SelectControl } from '@wordpress/components';

/**
 * SelectControl with optgroup support
 */
export default function SelectControlWithOptGroup( {
	help,
	label,
	onChange,
	optgroups = [],
	className,
	hideLabelFromVision,
	deselectedOptionLabel = '',
	deselectedOptionValue = '',
	...props
} ) {
	const instanceId = useInstanceId( SelectControlWithOptGroup );
	const id = `inspector-select-control-${ instanceId }`;

	// Disable reason: A select with an onchange throws a warning

	if ( isEmpty( optgroups ) ) {
		return null;
	}

	/* eslint-disable jsx-a11y/no-onchange */
	return (
		<BaseControl label={ label } hideLabelFromVision={ hideLabelFromVision } id={ id } help={ help } className={ className }>
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				id={ id }
				className="components-select-control__input"
				onChange={ onChange }
				aria-describedby={ !! help ? `${ id }__help` : undefined }
				{ ...props }
			>
				{ ( deselectedOptionLabel || deselectedOptionValue ) && (
					<option value={ deselectedOptionValue }>{ deselectedOptionLabel || __( '-- Select --', 'newspack-newsletters' ) }</option>
				) }
				{ optgroups.map( ( { label: optgroupLabel, options }, optgroupIndex ) => (
					<optgroup label={ optgroupLabel } key={ optgroupIndex }>
						{ options.map( ( option, optionIndex ) => (
							<option
								key={ `${ option.label }-${ option.value }-${ optionIndex }` }
								value={ option.value }
								disabled={ option.disabled }
							>
								{ option.label }
							</option>
						) ) }
					</optgroup>
				) ) }
			</SelectControl>
		</BaseControl>
	);
	/* eslint-enable jsx-a11y/no-onchange */
}
