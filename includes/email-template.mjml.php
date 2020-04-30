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
		<mj-title><?php echo $title; ?></mj-title>
		<mj-style>
			/* Paragraph */
			p {
				margin-top: 0 !important;
				margin-bottom: 0 !important;
			}

			/* Link */
			a {
				color: inherit;
				text-decoration: underline;
			}
			a:active, a:focus, a:hover {
				text-decoration: none;
			}
			a:focus {
				outline: thin dotted #000;
			}

			/* Button */
			.is-style-outline a {
				background: none !important;
				border: 2px solid !important;
			}

			/* Heading */
			h1 { font-size: 2.44em; line-height: 1.4; }
			h2 { font-size: 1.95em; line-height: 1.4; }
			h3 { font-size: 1.56em; line-height: 1.4; }
			h4 { font-size: 1.25em; line-height: 1.5; }
			h5 { font-size: 1em; line-height: 1.8; }
			h6 { font-size: 0.8em; line-height: 1.8; }
			h1, h2, h3, h4, h5, h6 { margin-top: 0; margin-bottom: 0; }

			/* List */
			ul, ol {
				margin-bottom: 0;
				margin-top: 0;
				padding-left: 1.3em;
			}

			/* Quote */
			.wp-block-quote {
				margin: 0 0 28px;
				padding-left: 1em;
			}
			.wp-block-quote cite {
				color: #6c7781;
				font-size: 13px;
			}
			.wp-block-quote.is-style-default {
				border-left: 4px solid #000;
			}
			.wp-block-quote.is-style-large p {
				font-size: 24px;
				font-style: italic;
				line-height: 1.6;
			}

			/* Social links */
			.social-element img {
				border-radius: 0 !important;
			}

			/* Has Background */
			.mj-column-has-width .has-background,
			.mj-column-per-50 .has-background {
				padding: 16px;
			}
		</mj-style>
	</mj-head>
	<mj-body>
		<?php echo $body; ?>
	</mj-body>
</mjml>
