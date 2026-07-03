# Personal Dashboard Deployment

This project can be pushed to GitHub Pages, but the private backend pieces must stay outside GitHub.

## Private Files

Do not commit these files or folders:

- `.secret/`
- `.secrets/`
- `.dashboard-private.json`
- `.google-calendar-token.json`
- `.env`

The `deploy.bat` script checks for those paths before committing.

## Deploy

Run:

```bat
deploy.bat
```

On the first run, the script initializes Git in this folder and connects it to:

```text
https://github.com/Kenobi1105/personal-dashboard.git
```

Then it stages safe files, commits them with a timestamped message, and pushes to `main`.

## Cloud Notes

GitHub Pages can host the dashboard frontend, but it cannot run `server.js`. Anything that needs private keys or server-side fetching should move to Supabase Edge Functions.

Keep these values in Supabase, not in the dashboard frontend:

- Google Calendar OAuth client secret
- Google Calendar refresh tokens
- API-Sports key
- Any future private API keys

The dashboard frontend may safely use:

- Supabase project URL
- Supabase publishable key
