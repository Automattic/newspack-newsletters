<?php // phpcs:ignoreFile

function wc_memberships_get_membership_plans() {
	return [
		new WC_Memberships_Membership_Plan( 1 ),
	];
}

class WC_Memberships_Membership_Plan {
	private $id;
	private $name;

	public function __construct( $id ) {
		$this->id   = $id;
		$this->name = 'Test Membership';
	}

	public function get_content_restriction_rules() {
		return [
			new WC_Memberships_Membership_Plan_Rule( [
				'id'                => $this->id,
				'content_type_name' => 'newspack_nl_list',
			] ),
		];
	}
}

class WC_Memberships_Membership_Plan_Rule {
	private $id;
	private $content_type_name;

	public function __construct( $data ) {
		foreach ( $data as $key => $value ) {
			$this->$key = $value;
		}
	}

	public function get_content_type_name() {
		return $this->content_type_name;
	}

	public function get_object_ids() {
		return [ 1, 2, 3 ];
	}
}
