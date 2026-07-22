# GlowEr Service Booking & Management Bot — Bot specification

**Archetype:** booking

**Voice:** professional and warm — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot for beauty studio clients to browse services/portfolio, book fixed hourly appointments, submit reviews, and for staff to manage services, photos, and respond to reviews via a shared admin chat.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- beauty studio clients
- studio staff/admins

## Success criteria

- Clients can complete full booking flow with confirmation
- Staff receive real-time booking and review notifications
- Reviews with photos are publicly visible with admin responses
- Admins can manage services/portfolio via chat interface

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with service carousel
- **Book Service** (button, actor: user, callback: booking:services) — Initiate service selection for booking
  - inputs: service selection, date, time slot, client contact info
  - outputs: booking confirmation, staff notification
- **View Portfolio** (button, actor: user, callback: portfolio:list) — Browse portfolio items by service category
  - inputs: service filter
  - outputs: portfolio photos with captions
- **Leave Review** (button, actor: user, callback: reviews:submit) — Submit post-appointment review with rating and photos
  - inputs: review text, photos, rating
  - outputs: public review display, admin notification

## Flows

### Booking Flow
_Trigger:_ button: Book Service

1. Select service
2. Choose date via calendar
3. Pick fixed hourly slot
4. Enter name/phone
5. Confirm booking

_Data touched:_ Service, Booking

### Review Prompt
_Trigger:_ 1 hour after appointment

1. Send review prompt with buttons
2. Handle review submission
3. Notify admins
4. Display review publicly

_Data touched:_ Review

### Admin Management
_Trigger:_ Admin chat commands/buttons

1. Create/update services
2. Upload portfolio items
3. Respond to reviews

_Data touched:_ Service, PortfolioItem, Review

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **Service** _(retention: persistent)_ — Beauty treatment with pricing and duration
  - fields: name, duration, price_label, description, photos
- **PortfolioItem** _(retention: persistent)_ — Treatment sample with photos
  - fields: photos, caption, service_tag
- **Review** _(retention: persistent)_ — Client feedback with admin response
  - fields: text, photos, rating, admin_response
- **Booking** _(retention: persistent)_ — Confirmed appointment details
  - fields: client_name, phone, service, date, slot, status
- **Admin** _(retention: session)_ — Staff members in shared chat
  - fields: telegram_chat_id

## Integrations

- **Telegram** (required) — Bot API messaging and staff chat notifications
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure staff chat for notifications
- Set service hours (default 09:00-18:00)
- Approve reviews before public display (optional)

## Notifications

- Booking confirmation to client
- Booking alert to staff chat
- Review submission alert to staff
- Admin response notification to client

## Permissions & privacy

- Require user consent for post-appointment review prompts
- Store only booking contact info for 30 days
- Admin chat access restricted to configured group

## Edge cases

- Client misses appointment (no-show handling)
- Review photo upload failures
- Time zone conflicts in notifications
- Concurrent booking slot selections

## Required tests

- End-to-end booking flow with staff notification
- Review submission with photo attachment
- Admin response visibility in client flow
- Date picker UX for mobile users

## Assumptions

- Default 09:00-18:00 business hours
- English as default language
- Phone number capture as plain text
- Single shared admin chat for all notifications
