# newspack-newsletters
Author email newsletters in WordPress

## Use

Copy your Mailchimp API key, which can be found in Mailchimp in `Account->Extras->API Keys`. Navigate to `Settings->Newspack Newsletters`. Input Mailchimp API key. Click Newsletters in the left menu. Create a new one.

## Development

Run `composer update && npm install`.

Run `npm run build`.

#### Environment variables

This feature requires environment variables to be set (e.g. in `wp-config.php`):

```php
define( 'NEWSPACK_MJML_API_KEY', 'abc1' );
define( 'NEWSPACK_MJML_API_SECRET', 'abc1' );
```
