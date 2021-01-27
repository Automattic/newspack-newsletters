# newspack-newsletters
Author email newsletters in WordPress

## Setup

Copy your Mailchimp API key, which can be found in Mailchimp in `Account->Extras->API Keys`.
Request [MJML API access](https://mjml.io/api).

Navigate to `Settings->Newspack Newsletters`. Input Mailchimp API key and MJML API key and secret.


## Use

Click Newsletters in the left menu. Create a new one.

## Development

Run `composer update && npm install`.

Run `npm run build`.

### Environment variables

```php

// Optionally change the Letterhead API endpoint for development
define('NEWSPACK_NEWSLETTERS_LETTERHEAD_ENDPOINT', 'https://a-different-endpoint.dev');
```
