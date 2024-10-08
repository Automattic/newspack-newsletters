<?php // phpcs:ignore WordPress.Files.FileName
/**
 * Newspack Newsletters Contacts Methods Sniff
 *
 * @package newspack-newsletters
 */

// phpcs:disable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase

/**
 * Sniff for catching classes not marked as abstract or final
 */
class NewspackNewslettersContactsMethodsSniff implements PHP_CodeSniffer_Sniff {

	/**
	 * The error code.
	 */
	const ERROR_CODE = 'ForbiddenContactsMethods';

	/**
	 * The error message.
	 */
	const ERROR_MESSAGE = 'Method %s is reserved for internal use and should not be called from this scope. Use methods in Newspack_Newsletters_Contacts class instead.';

	/**
	 * Returns the token types that this sniff is interested in.
	 *
	 * @return array(int)
	 */
	public function register() {
		return array( T_CLASS, T_STRING );
	}

	/**
	 * The methods we are looking for.
	 *
	 * These methods can only be called from the allowed classes or the service provider directory.
	 *
	 * @var array
	 */
	private $methods = [
		'add_contact',
		'add_esp_local_list_to_contact',
		'remove_esp_local_list_from_contact',
		'add_tag_to_contact',
		'remove_tag_from_contact',
		'update_contact_lists_handling_local',
		'add_contact_with_groups_and_tags',
		'add_contact_to_provider',
		'delete_user_subscription',
		'update_contact_lists',
		'upsert_contact',
	];

	/**
	 * The allowed classes.
	 *
	 * These are the classes from where the methods are allowed to be called.
	 *
	 * @var array
	 */
	private $allowed_classes = [
		'Newspack_Newsletters_Subscription',
		'Newspack_Newsletters_Contacts',
	];

	/**
	 * The current class name.
	 *
	 * @var string
	 */
	private $current_class = '';

	/**
	 * Processes the tokens that this sniff is interested in.
	 *
	 * Will look for calls of the methods defined in $this->methods and check if they are called from the allowed classes.
	 * They are also allowed to be called from within the service-providers directory.
	 *
	 * @param PHP_CodeSniffer_File $phpcs_file The file where the token was found.
	 * @param int                  $stack_ptr The position in the stack where the token was found.
	 */
	public function process( PHP_CodeSniffer_File $phpcs_file, $stack_ptr ) {

		$path_parts = explode( DIRECTORY_SEPARATOR, $phpcs_file->path );

		$possible_provider_dirs = [
			$path_parts[ count( $path_parts ) - 2 ],
			$path_parts[ count( $path_parts ) - 3 ],
		];

		if ( in_array( 'service-providers', $possible_provider_dirs, true ) ) {
			return;
		}

		$tokens = $phpcs_file->getTokens();
		$token = $tokens[ $stack_ptr ];

		if ( $token['code'] === T_CLASS ) {
			$this->current_class = $tokens[ $stack_ptr + 2 ]['content'];
			return;
		}

		if ( in_array( $token['content'], $this->methods, true ) ) {
			$operator = $tokens[ $stack_ptr - 1 ];
			if ( $operator['type'] === 'T_DOUBLE_COLON' || $operator['type'] === 'T_OBJECT_OPERATOR' ) {

				if ( ! in_array( $this->current_class, $this->allowed_classes, true ) ) {

					$method_name = $tokens[ $stack_ptr - 2 ]['content'] . $tokens[ $stack_ptr - 1 ]['content'] . $token['content'] . '()';

					$phpcs_file->addError(
						sprintf( self::ERROR_MESSAGE, $method_name ),
						$stack_ptr,
						self::ERROR_CODE
					);
				}
			}
		}
	}
}
