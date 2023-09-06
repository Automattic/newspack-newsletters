<?php
/**
 * Newspack Chart Block - horizontal bar chart base spec.
 *
 * @package WordPress
 */

// phpcs:disable
?>

<mjml>
	<mj-head>
		<?php if ( isset( $title ) && ! empty( $title ) ) : ?>
			<mj-title><?php echo $title; ?></mj-title>
		<?php endif; ?>
		<mj-style inline="inline">
			<?php echo esc_html( file_get_contents( dirname( __FILE__ ) . '/email-template-mjml.css' ) ); ?>
		</mj-style>
		<?php if ( isset( $custom_css ) && ! empty ( $custom_css ) ) : ?>
			<mj-style inline="inline">
				<?php echo esc_html( $custom_css ); ?>
			</mj-style>
		<?php endif; ?>
		<mj-style inline="inline">
			<?php echo esc_html( Newspack_Newsletters_Editor::get_color_palette_css() ); ?>
		</mj-style>
		<?php if ( isset( $preview_text ) ): ?>
			<mj-preview><?php echo $preview_text; ?></mj-preview>
		<?php endif; ?>
		<?php do_action( 'newspack_newsletters_editor_mjml_head' ); ?>
	</mj-head>
	<mj-body background-color="<?php echo $background_color; ?>">
		<?php echo $body; ?>
	</mj-body>
</mjml>
