# Google Calendar Sync

This dashboard now has a standalone Google Calendar backend in `server.js`. It uses Google OAuth on the server, stores refresh tokens locally in an encrypted private file, and exposes small dashboard API endpoints.

## Google Cloud Setup

Create an OAuth client in Google Cloud Console:

- Application type: Web application
- Authorized redirect URI for local dashboard:

```txt
http://127.0.0.1:5177/api/google-calendar/oauth/callback
```

If you run the dashboard on a different `PORT`, use that port instead. If you deploy the dashboard later, append the deployed callback URL too:

```txt
https://YOUR_DASHBOARD_DOMAIN/api/google-calendar/oauth/callback
```

The backend requests these scopes:

```txt
openid
email
profile
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/calendar.events
```

## Credentials

The OAuth client ID and secret are backend-only. Dashboard users should only see the Connect Google Calendar button.

You can provide the OAuth client ID and secret with either backend option:

- Environment variables:
  - `GOOGLE_CALENDAR_CLIENT_ID`
  - `GOOGLE_CALENDAR_CLIENT_SECRET`
  - optional `GOOGLE_CALENDAR_REDIRECT_URI`

- Local secret file:
  - Download the OAuth JSON from Google Cloud.
  - Save it as one of these ignored local files:

```txt
.secrets/google-oauth-client.json
.secret/google-oauth-client.json
```

The dashboard also keeps an old `.dashboard-private.json` fallback for local development, but the UI no longer asks for Google credentials.

## Token Storage

After connecting Google Calendar, the refresh token is stored in:

```txt
.google-calendar-token.json
```

That file is encrypted with AES-256-GCM. The encryption secret is generated in `.dashboard-private.json`. Both files are local-only and ignored by Git.

## API Endpoints

`GET /api/google-calendar/status`

Returns whether OAuth credentials are configured, whether an account is connected, the redirect URI, scopes, and basic connected account profile.

`GET /api/google-calendar/connect`

Starts Google OAuth and redirects the browser to Google.

`GET /api/google-calendar/oauth/callback`

Receives the OAuth code from Google, stores encrypted tokens, then redirects back to the dashboard.

`POST /api/google-calendar/disconnect`

Deletes the encrypted local token file.

`GET /api/google-calendar/events?timeMin=...&timeMax=...`

Loads events from the signed-in user's primary Google Calendar and normalizes them into the dashboard event shape with `source: "google"`.

`POST /api/google-calendar/events`

Creates a new Google Calendar event, or patches an existing one when the payload includes `googleEventId`.

`DELETE /api/google-calendar/events/:googleEventId`

Deletes one Google Calendar event.

## Current UI Behavior

The calendar header has one Google button:

- If credentials are missing, it shows a local setup message.
- If credentials are configured but not connected, it starts OAuth.
- If connected, it shows the connected state and syncs automatically.

Google events are loaded into local dashboard state as `source: "google"`. The sync replaces only existing Google-sourced events, leaving dashboard-created events alone.
