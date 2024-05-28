<?php // phpcs:ignoreFile
class WC_Memberships_Membership_Plan {
	private $id;
	private $name;
	private $rules;

	public function __construct( $id ) {
		$this->id   = $id;
		$this->name = 'Test Membership';
	}

	public function get_content_restriction_rules() {
		return $this->rules;
	}

	public function set_content_restriction_rules( $rules ) {
		$this->rules = $rules;
	}
}

class WC_Memberships_Membership_Plan_Rule {
	private $id;
	private $content_type_name;
	private $object_id_rules;

	public function __construct( $data ) {
		foreach ( $data as $key => $value ) {
			$this->$key = $value;
		}
	}

	public function get_content_type_name() {
		return $this->content_type_name;
	}

	public function get_object_ids() {
		return $this->object_id_rules;
	}
}
