# Personal Dashboard Deployment Checklist

Use this order after cloud-related code changes.

1. Run the Supabase SQL once.

   Open Supabase SQL Editor and run:

   ```text
   supabase/dashboard_cloud.sql
   ```

2. Confirm Edge Function secrets.

   In Supabase Edge Function Secrets, confirm these names exist:

   ```text
   GOOGLE_CALENDAR_CLIENT_ID
   GOOGLE_CALENDAR_CLIENT_SECRET
   GOOGLE_CALENDAR_REDIRECT_URI
   SERVICE_ROLE_KEY
   API_SPORTS_KEY
   APP_URL
   ```

3. Deploy Supabase functions.

   Double-click:

   ```text
   deploy-supabase.bat
   ```

4. Deploy the dashboard frontend to GitHub.

   Double-click:

   ```text
   deploy.bat
   ```

5. Wait for GitHub Pages to finish building.

   Then hard refresh:

   ```text
   https://kenobi1105.github.io/personal-dashboard/
   ```

6. Open Settings in the hosted dashboard.

   Use **Cloud Status -> Check** to verify sign-in, sync, news, sports, RSS/article, and Google Calendar.

7. Test account sync.

   Sign in with the account icon, then open Settings and click:

   ```text
   Cloud Status -> Sync Now
   ```

   Make one small dashboard change, refresh the page, and confirm the change remains.
