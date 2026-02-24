# Newspack Newsletters: Agent Instructions

This file covers what is specific to `newspack-newsletters`. Shared conventions (Docker commands, `n` script, coding standards, git rules, etc.) are in the root `newspack-workspace/AGENTS.md`.

## Overview

Newsletter authoring plugin for the Gutenberg block editor. Supports multiple Email Service Providers (Mailchimp, ActiveCampaign, Constant Contact). Uses MJML for responsive email rendering. Features subscription lists, newsletter ads, tracking, and reusable layouts.

Key insight: the **Newsletters wizard UI** (Engagement > Newsletters in the Newspack dashboard) lives in `newspack-plugin`, not in this repo. This plugin provides the ESP APIs, editor experience, blocks, and rendering logic.

## Linting Commands

```bash
npm run lint             # JS + SCSS only (see gotchas)
npm run lint:js          # JavaScript linting
npm run lint:scss        # SCSS linting
npm run lint:php         # PHP linting (PHPCS)
npm run fix:js           # Auto-fix JS issues
npm run fix:php          # Auto-fix PHP issues (PHPCBF)
```

## Common Gotchas

- `npm run lint` runs JS + SCSS only. PHP linting requires a separate `npm run lint:php`.
- Mixed autoloading: Composer `classmap` on `includes/` plus manual `require_once` in `newspack-newsletters.php`. Some files are manually included before the autoloader runs. After adding a new class, run `composer dump-autoload`.
- The Newsletters wizard UI (Engagement > Newsletters in the Newspack dashboard) lives in `newspack-plugin`, not here. This repo provides the REST API, editor, and rendering that the wizard consumes.
- Campaign Monitor support is **deprecated** (zero usage among clients). Code still exists but do not extend it. The active ESPs are Mailchimp, ActiveCampaign, and Constant Contact.
- MJML rendering: email HTML is regenerated every time the editor saves, stored in `newspack_email_html` post meta. Changes to the renderer affect all newsletters on their next edit/save.
- The `newspack_nl_cpt` post type uses standard WordPress post statuses, but publishing or making a post "private" triggers an ESP campaign send. Be careful with post status transitions.
- ESP sync happens across multiple plugins (Newsletters, newspack-plugin, newspack-network). The goal is to consolidate all ESP API calls into this plugin, which provides filters for other plugins to add data.
- All ESP integration checks are defensive -- use `class_exists`/`function_exists`. The plugin must work standalone.

## PHP Backend

### Bootstrap & Autoloading

- `newspack-newsletters.php`: main plugin file, defines `NEWSPACK_NEWSLETTERS_PLUGIN_FILE` and `NEWSPACK_NEWSLETTERS_LETTERHEAD_ENDPOINT` constants, requires Composer autoloader, then manually includes ~30 files in order (ESP interfaces, service providers, all ESP implementations, feature classes).
- Composer uses `classmap` strategy on `includes/` -- run `composer dump-autoload` after adding a new file.
- Initialization at bottom of main file: `Subscription_Lists::init()` and `Send_Lists::init()`.

### Class Initialization Patterns

Four patterns coexist:

1. **Singleton** via `instance()`: `Newspack_Newsletters`, `Newspack_Newsletters_Editor`.
2. **Service Provider singleton**: `Newspack_Newsletters_Service_Provider::instance()` -- manages a static `$instances` array, supports multiple provider instances.
3. **Static `init()`**: newer classes like `Subscription_Lists`, `Send_Lists`, `Newspack_Newsletters_Blocks`, `Newspack_Newsletters_Subscription_Attempts`.
4. **Constructor-based hook registration**: older classes that hook into `init`, `rest_api_init`, `admin_menu` in `__construct()`.

### Namespace Map

| Namespace | Directory |
|-----------|-----------|
| *(none -- legacy)* | `includes/` (`Newspack_Newsletters_*` classes) |
| `Newspack\Newsletters` | `includes/` (newer models: `Subscription_List`, `Send_List`, `Send_Lists`, `Subscription_Lists`) |
| `Newspack_Newsletters` | `includes/ads/` (`Ads`, `Ads_Placements`) |
| `Newspack_Newsletters\Tracking` | `includes/tracking/` |
| `Newspack_Newsletters\Blocks\Subscribe` | `src/blocks/subscribe/index.php` |
| `Newspack_Newsletters\Plugins` | `includes/plugins/woocommerce-memberships/` |
| `Newspack_Newsletters\CLI` | `includes/plugins/woocommerce-memberships/` (CLI sync command) |

Note: legacy classes use no namespace (just the `Newspack_Newsletters_*` prefix). Newer classes use proper PHP namespaces.

### ESP Service Provider Architecture

This is the core abstraction of the plugin.

**Interface**: `Newspack_Newsletters_ESP_API_Interface` (`includes/service-providers/interface-newspack-newsletters-esp-service.php`) -- defines all methods an ESP must implement: campaign creation, sending, list management, contact management, subscriber sync.

**Abstract base class**: `Newspack_Newsletters_Service_Provider` (`includes/service-providers/class-newspack-newsletters-service-provider.php`):
- Implements both `Newspack_Newsletters_ESP_API_Interface` and `Newspack_Newsletters_WP_Hookable_Interface`
- Manages REST controller registration
- Handles post status transitions (publish/private triggers ESP send)
- Hooks: `pre_post_update`, `save_post`, `transition_post_status`, `updated_post_meta`, `wp_insert_post`, `wp_insert_post_data`
- Singleton via `instance()` with static `$instances` array

**Controller base**: `Newspack_Newsletters_Service_Provider_Controller` (`includes/service-providers/class-newspack-newsletters-service-provider-controller.php`) -- extends `WP_REST_Controller`, each ESP extends this for custom REST endpoints.

**Implementations:**

| ESP | Directory | Key Classes | Notes |
|-----|-----------|-------------|-------|
| Mailchimp | `service-providers/mailchimp/` | Main class, API client, Controller, Cached Data, Groups trait, Notes, Default Footer, Subscription List Trait, Usage Reports | Most complex. Has caching layer and groups/tags handling. |
| ActiveCampaign | `service-providers/active_campaign/` | Main class, Controller, Usage Reports | V3 API. Segments support. |
| Constant Contact | `service-providers/constant_contact/` | Main class, Controller, SDK wrapper, Usage Reports | OAuth callback handling. |
| Campaign Monitor | `service-providers/campaign_monitor/` | Main class, Controller, Usage Reports | **DEPRECATED.** Do not extend. |
| Letterhead | `service-providers/letterhead/` | Main class, DTOs, Models | Not a full ESP -- ad promotions only. |

Registration: providers are registered via the `newspack_newsletters_registered_providers` filter.

### Core Entities

**Subscription Lists** (`Newspack\Newsletters\Subscription_Lists`):
- CPT: `newspack_nl_list`
- Local lists synced as tags/groups in the connected ESP
- Created in WP admin, mapped to ESP tags (Mailchimp tags/groups, ActiveCampaign tags, Constant Contact lists)
- Used in the Newsletter Subscription Form block and My Account management

**Send Lists** (`Newspack\Newsletters\Send_Lists`):
- Standardized ESP list selection for the newsletter editor
- Autocomplete-based UI (replaced dropdown to handle scale)
- Groups ESP data by type (Audiences, Segments, Tags, Groups)

**Newsletter Ads** (`Newspack_Newsletters\Ads`):
- CPT: `newspack_nl_ads_cpt`
- Taxonomy: `newspack_nl_advertiser`
- Ad campaigns with start/expiry dates
- Automatic injection into newsletters or manual placement via Newsletter Ad block
- Impressions tracked via tracking pixel

**Layouts** (managed by `Newspack_Newsletters_Layouts`):
- CPT: `newspack_nl_layo_cpt`
- Reusable email templates
- 9 built-in example layouts (JSON files in `includes/layouts/`)
- Custom layouts can be saved from the editor

### Custom Post Types

| CPT Slug | Purpose |
|----------|---------|
| `newspack_nl_cpt` | Newsletter posts |
| `newspack_nl_list` | Subscription Lists |
| `newspack_nl_ads_cpt` | Newsletter Ads |
| `np_nl_sub_intent` | Subscription attempts (private, async processing) |
| `newspack_nl_layo_cpt` | Newsletter layouts/templates |

### MJML Email Rendering

- Uses `mjml-browser` (client-side) and `includes/email-template.mjml.php` (server-side template)
- `Newspack_Newsletters_Renderer` converts Gutenberg blocks to MJML components
- HTML regenerated on every editor save, stored in `newspack_email_html` post meta
- Supports: inline styles, font customization, color palette, link processing
- Inline tag allowlist: `b`, `strong`, `i`, `em`, `span`, `a`, etc.
- Extensible via `newspack_newsletters_mjml_component_attributes` filter

### Tracking System

| Class | File | Purpose |
|-------|------|---------|
| `Tracking\Pixel` | `includes/tracking/class-pixel.php` | Open tracking via 1x1 pixel |
| `Tracking\Click` | `includes/tracking/class-click.php` | Click tracking for links |
| `Tracking\Utils` | `includes/tracking/class-utils.php` | Shared tracking utilities |
| `Tracking\Admin` | `includes/tracking/class-admin.php` | Tracking settings UI |

- Query var for pixel: `np_newsletters_pixel`
- Rewrite rule: `np-newsletters.gif` (backwards compatibility)
- UTM parameters auto-added to links: `utm_campaign`, `utm_source`, `utm_medium=email`
- Batch processing via ActionScheduler

### REST API

Namespace: `newspack-newsletters/v1`.

Key endpoint groups:
- **Subscription Lists**: `GET/PUT /lists`, `GET /lists_config` (public)
- **Send Lists**: ESP list fetching for editor autocomplete
- **Settings**: plugin configuration
- **ESP-specific**: each provider controller registers custom routes via `register_routes()`
- **Ads**: ad configuration endpoints

Permission levels:
- `api_administration_permissions_check()` for admin endpoints
- `api_authoring_permissions_check()` for editor endpoints
- `__return_true` for public endpoints (lists config)

### Integrations

| Integration | File | Purpose |
|-------------|------|---------|
| WooCommerce Memberships | `includes/plugins/woocommerce-memberships/` | Premium newsletters: auto-subscribe/unsubscribe based on membership status. Includes a CLI sync command. |
| Letterhead | `includes/service-providers/letterhead/` | External ad promotion fetching |
| newspack-plugin (RAS) | Via hooks | Reader data sync, ESP connection, subscription list management in Engagement wizard |
| newspack-popups | Via hooks | Subscription-based campaign segmentation |
| newspack-network | Via hooks | Cross-site ESP sync |

## Frontend (JS/React)

### Webpack Entry Points

| Entry | Source Path | Purpose |
|-------|------------|---------|
| `editor` | `src/editor/` | General editor enhancements and blocks-validation |
| `admin` | `src/admin/` | Admin page scripts |
| `adsEditor` | `src/ads/editor/` | Ads editor in the ad CPT editor |
| `newsletterAdsEditor` | `src/ads/newsletter-editor/` | Ads controls in the newsletter editor |
| `branding` | `src/branding/` | Branding/customization scripts |
| `quickEdit` | `src/quick-edit/` | Quick edit column enhancements |
| `editorBlocks` | `src/editor/blocks/` | Newsletter-specific editor blocks |
| `newsletterEditor` | `src/newsletter-editor/` | Main newsletter editor sidebar and controls |
| `blocks` | `src/blocks/` | Reader-facing blocks (subscribe form) |
| `subscribeBlock` | `src/blocks/subscribe/view.js` | Subscribe block frontend script |
| `subscriptions` | `src/subscriptions/` | Subscription management UI |

### Newsletter Editor

The newsletter editor (`src/newsletter-editor/`) extends the Gutenberg editor with:
- Custom sidebar panels: sender, send-to (autocomplete), layout selection, styling, testing
- State management via `src/newsletter-editor/store.js`
- MJML preview rendering in browser (`src/editor/mjml/`)
- Init modal for first-time setup (API key + layout selection) in `src/components/init-modal/`
- Debug/test send functionality (`src/newsletter-editor/debug-send/`, `src/newsletter-editor/testing/`)
- Campaign link generation (`src/newsletter-editor/campaign-link/`)
- Public archive toggle (`src/newsletter-editor/public/`)

### Service-Provider-Specific UI

`src/service-providers/` contains ESP-specific React components loaded based on the active provider:

| Provider | Directory | Description |
|----------|-----------|-------------|
| Mailchimp | `src/service-providers/mailchimp/` | Provider sidebar with audience/segment selection |
| ActiveCampaign | `src/service-providers/active_campaign/` | Provider-specific UI |
| Constant Contact | `src/service-providers/constant_contact/` | Provider-specific UI |
| Campaign Monitor | `src/service-providers/campaign_monitor/` | Deprecated provider UI |
| Manual | `src/service-providers/manual/` | Manual/no-ESP mode |
| Example | `src/service-providers/example/` | Template for new providers |

### Shared Components

`src/components/` provides reusable React components:
- `init-modal` -- First-time setup modal (API keys + layout picker)
- `newsletter-preview` -- MJML email preview
- `send-button` -- Send/schedule newsletter button
- `copy-html` -- Copy rendered HTML to clipboard
- `ad-placements` -- Ad placement configuration
- `with-api-handler` -- HOC for API request handling
- `select-control-with-optgroup` -- Grouped select control

### Blocks

- **Subscribe block** (`src/blocks/subscribe/`): reader-facing newsletter signup form with list selection, reCAPTCHA support. Has separate `view.js` frontend entry.
- **Editor blocks** (in `src/editor/blocks/`): Ad, Conditional Content, Posts Inserter, Share, Embed, Mailchimp Merge Tags, Visibility Attribute.
- Block restrictions: the newsletter editor limits which blocks are allowed via `newspack_newsletters_allowed_block_types` filter.
- Supported blocks in newsletters: Paragraphs, Headings, Lists, Quotes, Images, Buttons, Columns, Groups, Separators, Spacers, Social Icons, Embeds.

## Testing

```bash
n test-php                    # Run all PHPUnit tests (from within repo directory)
n test-php --filter test_name # Run specific test
npm run lint                  # Run JS + SCSS linters
npm run lint:php              # Run PHP linter
```

- Config: `phpunit.xml.dist` with single `main` suite
- Bootstrap: `tests/bootstrap.php`
- Abstract base: `abstract-esp-tests.php` for shared ESP test patterns
- Traits: `trait-lists-setup.php`, `trait-send-lists-setup.php`, `trait-wc-memberships-setup.php`
- Mocks: `class-mailchimp-mock.php`, `class-blockbindings.php`, `wp-cli.php`, `wc-memberships.php`
- Provider-specific tests: Mailchimp (cached data, contacts, API requests, usage reports), ActiveCampaign, Constant Contact
- Feature tests: subscription-attempts, tracking, renderer, subscription-lists, send-lists, newsletter-ads, labels, controlled-statuses, usage-reports
- WooCommerce Memberships tests: `tests/plugins/test-woocommerce-memberships.php`, CLI sync test
- No PHPUnit groups currently defined
- No JavaScript tests (`npm run test` is a no-op)

## Hooks & Extension Points

Find all hooks with:
```bash
grep -rn "newspack_newsletters_" includes/ --include="*.php" | grep -E "do_action|apply_filters"
```

### Key Filters

- `newspack_newsletters_registered_providers` -- register new ESP providers
- `newspack_newsletters_newsletter_content` -- filter newsletter content before sending
- `newspack_newsletters_process_link` -- process links (for tracking)
- `newspack_newsletters_contact_data` -- filter contact data before ESP sync
- `newspack_newsletters_contact_lists` -- filter contact list subscriptions
- `newspack_newsletters_email_editor_cpts` -- post types with newsletter editor
- `newspack_newsletters_allowed_block_types` -- block restrictions in newsletter editor
- `newspack_newsletters_mjml_component_attributes` -- MJML component customization
- `newspack_newsletters_should_render_ads` -- conditionally render newsletter ads
- `newspack_newsletters_is_email_verified` -- email verification check

### Key Actions

- `newspack_newsletters_contact_subscribed` -- after a contact subscribes
- `newspack_newsletters_pre_add_contact` -- before adding a contact to ESP
- `newspack_newsletters_upsert` -- contact upsert event
- `newspack_newsletters_update_contact_lists` -- contact list update event
- `newspack_newsletters_tracking_pixel_seen` -- open tracking pixel fired
- `newspack_newsletters_tracking_click` -- link click tracked
- `newspack_newsletters_editor_mjml_head` / `_body` -- inject into MJML template

## Directory Structure

```
newspack-newsletters/
├── newspack-newsletters.php        # Main plugin file, bootstrap and manual includes
├── includes/
│   ├── class-newspack-newsletters.php           # Core class (singleton, CPT, REST API)
│   ├── class-newspack-newsletters-renderer.php  # Gutenberg-to-MJML rendering
│   ├── class-newspack-newsletters-editor.php    # Editor customization and assets
│   ├── class-newspack-newsletters-subscription.php # ESP-agnostic subscription logic
│   ├── class-newspack-newsletters-settings.php  # Plugin settings
│   ├── class-newspack-newsletters-layouts.php   # Reusable email layouts
│   ├── class-newspack-newsletters-blocks.php    # Block registration
│   ├── class-newspack-newsletters-contacts.php  # Contact management API
│   ├── class-newspack-newsletters-logger.php    # Logging utility
│   ├── class-newspack-newsletters-bulk-actions.php  # Bulk actions for newsletter list
│   ├── class-newspack-newsletters-quick-edit.php    # Quick edit columns
│   ├── class-newspack-newsletters-embed.php         # Embed handling
│   ├── class-newspack-newsletters-subscription-attempts.php # Subscription backup table
│   ├── class-subscription-list.php              # Single subscription list model
│   ├── class-subscription-lists.php             # Subscription lists manager
│   ├── class-send-list.php                      # Single send list model
│   ├── class-send-lists.php                     # Send lists manager + REST
│   ├── email-template.mjml.php                  # Server-side MJML template
│   ├── email-template-mjml.css                  # Base email CSS
│   ├── ads/
│   │   ├── class-ads.php                        # Newsletter ads CPT and logic
│   │   └── class-ads-placements.php             # Ad placement positions
│   ├── service-providers/
│   │   ├── interface-newspack-newsletters-esp-service.php
│   │   ├── interface-newspack-newsletters-wp-hookable.php
│   │   ├── class-newspack-newsletters-service-provider.php
│   │   ├── class-newspack-newsletters-service-provider-controller.php
│   │   ├── class-newspack-newsletters-service-provider-usage-report.php
│   │   ├── mailchimp/                           # Mailchimp ESP (most complex)
│   │   ├── active_campaign/                     # ActiveCampaign ESP
│   │   ├── constant_contact/                    # Constant Contact ESP
│   │   ├── campaign_monitor/                    # Campaign Monitor (DEPRECATED)
│   │   └── letterhead/                          # Letterhead (ad promotions only)
│   ├── tracking/
│   │   ├── class-pixel.php                      # Open tracking pixel
│   │   ├── class-click.php                      # Click tracking
│   │   ├── class-utils.php                      # Tracking utilities
│   │   └── class-admin.php                      # Tracking admin UI
│   ├── layouts/                                 # Built-in layout JSON files (1-9)
│   └── plugins/
│       └── woocommerce-memberships/             # WC Memberships integration + CLI
├── src/
│   ├── editor/                                  # Editor enhancements
│   │   ├── blocks/                              # Newsletter-specific blocks
│   │   ├── blocks-validation/                   # Block nesting/filter validation
│   │   └── mjml/                                # Client-side MJML rendering
│   ├── newsletter-editor/                       # Newsletter editor sidebar/panels
│   │   ├── store.js                             # Editor state management
│   │   ├── sidebar/                             # Sender, send-to, autocomplete
│   │   ├── layout/                              # Layout selection
│   │   ├── styling/                             # Email styling controls
│   │   ├── testing/                             # Test send UI
│   │   ├── debug-send/                          # Debug send panel
│   │   ├── campaign-link/                       # Campaign link generation
│   │   ├── editor/                              # Editor init and overrides
│   │   └── public/                              # Public archive toggle
│   ├── admin/                                   # Admin page scripts
│   ├── ads/                                     # Ads editor + newsletter-editor UI
│   ├── blocks/                                  # Reader-facing blocks
│   │   └── subscribe/                           # Newsletter subscription form block
│   ├── branding/                                # Branding scripts
│   ├── components/                              # Shared React components
│   ├── service-providers/                       # ESP-specific React UI
│   ├── subscriptions/                           # Subscription management
│   ├── utils/                                   # Shared JS utilities and hooks
│   └── quick-edit/                              # Quick edit scripts
├── tests/
│   ├── bootstrap.php
│   ├── abstract-esp-tests.php
│   ├── trait-*.php                              # Shared test traits
│   ├── mocks/                                   # Test mocks
│   ├── plugins/                                 # Plugin integration tests
│   └── test-*.php                               # Test files
├── dist/                                        # Compiled assets (gitignored)
├── vendor/                                      # Composer dependencies
└── languages/                                   # Translation files
```

## Recipes

### Add a new ESP provider

1. Create directory `includes/service-providers/<name>/`.
2. Create main class extending `Newspack_Newsletters_Service_Provider`, implement `Newspack_Newsletters_ESP_API_Interface`.
3. Create controller extending `Newspack_Newsletters_Service_Provider_Controller`.
4. Add `require_once` lines in `newspack-newsletters.php` (order matters -- interfaces and base classes must come first).
5. Register via `newspack_newsletters_registered_providers` filter.
6. Add provider-specific UI in `src/service-providers/<name>/`.
7. Run `composer dump-autoload`.
8. See Constant Contact or ActiveCampaign for simpler examples (Mailchimp is the most complex).

### Add a subscription list

1. Use `Subscription_Lists` API or create via WP admin.
2. Lists are synced to ESP as tags/groups.
3. They appear in the Newsletter Subscription Form block and My Account.

### Modify email rendering

1. Edit `Newspack_Newsletters_Renderer` for block-to-MJML conversion changes.
2. Edit `includes/email-template.mjml.php` for template structure changes.
3. Use `newspack_newsletters_mjml_component_attributes` filter for attribute customization.
4. Use `newspack_newsletters_editor_mjml_head` / `_body` actions to inject content.

### Extend tracking

1. Hook into `newspack_newsletters_tracking_pixel_seen` for open tracking.
2. Hook into `newspack_newsletters_tracking_click` for click tracking.
3. Use `newspack_newsletters_process_link` filter to modify link processing.
