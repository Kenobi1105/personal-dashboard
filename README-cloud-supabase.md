# Dashboard Cloud Setup

GitHub Pages hosts the dashboard frontend. Supabase hosts the backend pieces that GitHub Pages cannot run.

## 1. Run The SQL

In Supabase:

1. Open your project.
2. Go to **SQL Editor**.
3. Open this local file:

```text
supabase/dashboard_cloud.sql
```

4. Copy the whole file into Supabase SQL Editor.
5. Click **Run**.

This creates:

- `dashboard_state`
- `google_calendar_tokens`

## 2. Add Supabase Secrets

In Supabase, add these Edge Function secrets:

```text
GOOGLE_CALENDAR_CLIENT_ID
GOOGLE_CALENDAR_CLIENT_SECRET
GOOGLE_CALENDAR_REDIRECT_URI
SUPABASE_SERVICE_ROLE_KEY
API_SPORTS_KEY
APP_URL
```

Recommended values:

```text
GOOGLE_CALENDAR_REDIRECT_URI=https://txowrviwvulkuopmugfb.supabase.co/functions/v1/google-calendar/callback
APP_URL=https://kenobi1105.github.io/personal-dashboard/
```

`SUPABASE_SERVICE_ROLE_KEY` is in Supabase under:

```text
Project Settings -> API -> service_role key
```

Keep the service role key private. Never put it in GitHub or the dashboard frontend.

## 3. Deploy Edge Functions

These folders need to be deployed as Supabase Edge Functions:

```text
supabase/functions/news-sources
supabase/functions/news
supabase/functions/rss
supabase/functions/article
supabase/functions/bible-net
supabase/functions/sports
supabase/functions/world-watch
supabase/functions/missions
supabase/functions/languages
supabase/functions/dashboard-sync
supabase/functions/google-calendar
```

Public functions use `verify_jwt = false` in:

```text
supabase/config.toml
```

The account state sync function stays protected.

## 4. Google Cloud Redirects

For the Google Calendar OAuth client, add this authorized redirect URI:

```text
https://txowrviwvulkuopmugfb.supabase.co/functions/v1/google-calendar/callback
```

For Supabase Auth Google sign-in, use this callback:

```text
https://txowrviwvulkuopmugfb.supabase.co/auth/v1/callback
```

## 5. GitHub Pages

After code changes:

```text
deploy.bat
```

The frontend now switches automatically:

- `127.0.0.1` uses local `server.js`.
- `kenobi1105.github.io` uses Supabase Edge Functions.

