# Exegetical Phrasing Editor Sync Setup

This package adds optional Supabase Auth and cloud sync to the standalone Exegetical Phrasing Editor. It keeps the editor offline-first: localStorage remains the source of normal editing behavior, and cloud calls quietly skip or fail without breaking local saves.

The package never reads, writes, uploads, or otherwise references the Bible Module IndexedDB cache.

## Files to Give the Editor Integration

Copy these paths into the phrasing editor repository, preserving their relative locations:

- [sync/phrasing-supabase-sync.js](sync/phrasing-supabase-sync.js): framework-free ES module for Auth, profiles, and phrasing project sync.
- [sync/phrasing-auth-pages](sync/phrasing-auth-pages): static account-confirmation and password-reset pages plus their CSS.
- [supabase/phrasing_projects.sql](supabase/phrasing_projects.sql): database schema and RLS policies to run once in the shared Supabase SQL Editor.

The sync module is DOM-free. Claude can build the editor's account modal or menu in the editor's existing visual style and call the exported functions below.

## Shared Supabase Project

Use the same Supabase project URL and publishable/anon key in the standalone editor and future dashboard:

```txt
Supabase project URL: https://YOUR_PROJECT_REF.supabase.co
Supabase anon/public key: YOUR_SUPABASE_ANON_PUBLIC_KEY
```

This keeps Google and email/password identities in one `auth.users` account. The new `public.user_profiles` table is deliberately shared and private; it can later be reused by the dashboard without granting dashboard tables access to phrasing projects.

Do not create a separate Supabase project for the dashboard if the intent is that the same person has the same account in both apps.

## Supabase Dashboard Configuration

### 1. Run the SQL

Run [supabase/phrasing_projects.sql](supabase/phrasing_projects.sql) in the shared Supabase project's SQL Editor.

It creates:

- `public.user_profiles`: one private profile per Auth user, with a required unique username.
- `public.phrasing_projects`: the app-scoped phrasing session table.

`user_profiles.username` rules:

- 3-24 characters.
- Lowercase letters, numbers, and underscores only.
- Begins and ends with a lowercase letter or number.
- Case-insensitively unique.

RLS exposes a profile only to its owner. There is no public or signed-in username search/list endpoint. Phrasing-project RLS remains per-owner and does not grant public reads.

Because usernames must be globally unique, an authenticated user who tries to claim an exact handle can learn only that it is unavailable. No profile data, owner identity, or general lookup/list is exposed; that minimal availability signal is necessary to let someone choose another username.

### 2. Enable Auth Methods

In **Authentication > Providers**:

- Enable **Google** and provide the Google OAuth client ID and secret.
- Keep **Email** enabled.
- Enable **Confirm email**. Unconfirmed email/password accounts do not get cloud-project access.

In Google Cloud Console, register this Google redirect URI:

```txt
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

### 3. Configure Redirect URLs

Set **Site URL** to the primary editor URL. Then add exact paths to **Additional Redirect URLs** for every editor deployment and callback page, for example:

```txt
https://YOUR_GITHUB_USERNAME.github.io/YOUR_EDITOR_REPO/
https://YOUR_GITHUB_USERNAME.github.io/YOUR_EDITOR_REPO/sync/phrasing-auth-pages/account-confirmation.html
https://YOUR_GITHUB_USERNAME.github.io/YOUR_EDITOR_REPO/sync/phrasing-auth-pages/reset-password.html
http://localhost:3000/
http://localhost:3000/sync/phrasing-auth-pages/account-confirmation.html
http://localhost:3000/sync/phrasing-auth-pages/reset-password.html
```

Append future dashboard URLs to this list rather than replacing the editor URLs. The Google redirect remains the Supabase callback above; the app return URL comes from each `redirectTo` or `emailRedirectTo` call.

If you customize Supabase confirmation or recovery email templates, preserve the per-request redirect destination by using `{{ .RedirectTo }}` where the template supplies a return URL. Test both email links after any template change. [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls)

### 4. Configure Production Email

Before inviting friends, configure custom SMTP in **Authentication > Emails > SMTP Settings** and test deliverability. The built-in sender is demonstration-oriented and has a very low combined Auth-email rate limit. [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits)

Keep password-strength and Auth rate-limit settings enabled. Do not put the Supabase service-role key, Google client secret, or SMTP credentials in the editor repository.

## Static Callback Pages

[sync/phrasing-auth-pages/account-confirmation.html](sync/phrasing-auth-pages/account-confirmation.html) handles a verified session returning from confirmation or first Google sign-in. It asks for the required private username if the profile does not exist.

[sync/phrasing-auth-pages/reset-password.html](sync/phrasing-auth-pages/reset-password.html) accepts a new password only from a valid Supabase password-recovery callback that creates a session.

Before publishing, replace these placeholders in both files:

```txt
https://YOUR_PROJECT_REF.supabase.co
YOUR_SUPABASE_ANON_PUBLIC_KEY
https://YOUR_GITHUB_USERNAME.github.io/YOUR_EDITOR_REPO/
```

If Claude moves the pages to another path, update both their import path to `phrasing-supabase-sync.js` and the exact allow-listed redirect URLs.

## Editor Integration

Import the module from the editor's main `index.html` module script or JavaScript module:

```js
import {
  configurePhrasingSync,
  signInWithGoogle,
  signUpWithEmailPassword,
  signInWithEmailPassword,
  requestPasswordReset,
  setPassword,
  signOut,
  getCurrentUser,
  getCurrentProfile,
  setUsername,
  updateUsername,
  saveProjectToCloud,
  loadAllProjectsFromCloud,
  deleteProjectFromCloud,
  migrateLocalProjectsOnce,
  onAuthStateChange
} from './sync/phrasing-supabase-sync.js';

const EDITOR_URL = window.location.origin + window.location.pathname;
const ACCOUNT_CONFIRMATION_URL = new URL('./sync/phrasing-auth-pages/account-confirmation.html', EDITOR_URL).href;
const RESET_PASSWORD_URL = new URL('./sync/phrasing-auth-pages/reset-password.html', EDITOR_URL).href;

configurePhrasingSync({
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_PUBLIC_KEY',
  redirectTo: EDITOR_URL
});
```

`window.supabase.createClient` is used when the Supabase UMD bundle is already present. Otherwise the module loads Supabase JS from jsDelivr on the first cloud operation. No build step is required.

### Account UI Flow

The editor should offer Google plus email/password options in its account UI:

```js
// Google sign-in returns through the configured redirect URL.
await signInWithGoogle({ redirectTo: ACCOUNT_CONFIRMATION_URL });

// Email sign-up sends a confirmation email. Always show a neutral check-email message.
await signUpWithEmailPassword({
  email,
  password,
  emailRedirectTo: ACCOUNT_CONFIRMATION_URL
});

// Email/password sign-in uses email, never username.
await signInWithEmailPassword({ email, password });

// Always show a neutral message such as "Check your email for reset instructions."
await requestPasswordReset({ email, redirectTo: RESET_PASSWORD_URL });

// A signed-in Google user may add password access from Account settings.
await setPassword({ password: newPassword });
```

After every `SIGNED_IN`, call `getCurrentProfile()`.

- If it returns `null`, show a required username form and call `setUsername(username)`.
- If `setUsername` returns `username_unavailable`, ask for another name.
- If it returns `invalid_username`, enforce the documented username rules in the UI.
- After the profile exists, call `migrateLocalProjectsOnce(...)` once and load cloud projects.

```js
onAuthStateChange(async function (event, session) {
  if (event !== 'SIGNED_IN' || !session) return;

  const profile = await getCurrentProfile();
  if (!profile) {
    // Open the editor's required username form. Do not migrate yet.
    return;
  }

  await migrateLocalProjectsOnce({ listLocalProjects });
  const cloudProjects = await loadAllProjectsFromCloud();
  // Merge or display cloudProjects in the editor UI.
});
```

After `setUsername(...)` succeeds, run that same migration/load sequence immediately. The existing account-confirmation page only establishes the profile; it intentionally does not know the editor's localStorage key format.

## Exported Function Reference

`configurePhrasingSync(options)`

Sets the Supabase URL, public key, return URL, table names, optional migration key prefix, and optional Supabase JS module URL. Returns `{ ok: true }` or `{ ok: false, reason: 'missing_supabase_config' }`.

`signInWithGoogle({ redirectTo? })`

Starts Google OAuth. The browser redirects on success. Returns a quiet skipped/error result when offline or unconfigured.

`signUpWithEmailPassword({ email, password, emailRedirectTo })`

Creates an email/password account. With email confirmation enabled it returns `{ ok: true, requiresEmailConfirmation: true }`; the caller should say only to check email. A username is selected after confirmation, not before.

`signInWithEmailPassword({ email, password })`

Signs in with email and password. Credential failures return `{ ok: false, reason: 'invalid_credentials' }` without revealing whether the email exists.

`requestPasswordReset({ email, redirectTo })`

Requests a recovery email and intentionally returns a neutral `{ ok: true, sent: true }` for server-side recovery outcomes. The caller should always show the same inbox message.

`setPassword({ password })`

Adds or changes the current signed-in account password. It is appropriate for Google users who want password access, and for the dedicated password-reset page after recovery.

`getCurrentUser()` and `getCurrentProfile()`

Return the current Supabase user or private profile, respectively; each returns `null` on signed-out, offline, or recoverable failure. Profiles are never looked up by another user.

`setUsername(username)` and `updateUsername(username)`

Create or change the current user's private profile. `updateUsername` is an alias intended for account settings. Results can use `username_unavailable`, `invalid_username`, `signed_out`, or a quiet recoverable failure.

`saveProjectToCloud(projectId, projectData)`, `loadAllProjectsFromCloud()`, and `deleteProjectFromCloud(projectId)`

Retain their original behavior, but require a verified account and completed username profile. Project save/delete return `{ ok: false, skipped: true, reason: 'email_unconfirmed' }` or `profile_incomplete` until setup is complete. Project loading returns `[]` in those states so normal local behavior continues.

`migrateLocalProjectsOnce({ listLocalProjects, force? })`

Runs only for a verified, profile-complete account. It stores the existing app-scoped migration flag:

```txt
phrasing_editor_migrated_v1:SUPABASE_USER_ID
```

Partial upload failures leave the flag unset. Retrying is safe because each project upserts with the same `(user_id, id)` key.

`onAuthStateChange(callback)`

Subscribes to Supabase Auth events and returns an unsubscribe function. The static callback pages explicitly load the Supabase UMD bundle first so this listener can subscribe immediately.

## Save Order, Conflicts, and Offline Behavior

Keep the existing editor save order:

1. Save the project to localStorage through the editor's existing manual or debounced autosave.
2. Optionally call `saveProjectToCloud(projectId, projectData)` after that local save succeeds.
3. Ignore skipped/failed cloud results during normal editing, or surface a small status indicator later.

The conflict policy remains last-write-wins using database `updated_at`. If two devices update one project, the last cloud save received by Supabase becomes the current cloud version. This is deliberately simple for private, low-frequency projects and can be replaced later with revision history or explicit merge UX.

Offline, signed-out, unconfirmed-email, and profile-incomplete states never throw uncaught errors from the module. The Bible cache remains entirely local, and localStorage projects continue working exactly as before.

## Acceptance Checklist

- Register, confirm email, choose a username, sign in, sign out, reset a password, and change a password.
- Sign in with Google, choose a username, add a password, then sign in by email/password using the same account.
- Verify duplicate usernames receive `username_unavailable` and can be changed later.
- Verify a signed-in account without a profile receives `profile_incomplete` from cloud save/delete and `[]` from cloud load, while local editor saving still works.
- Verify first migration runs only after username setup and never includes Bible Module IndexedDB data.
- Verify two test accounts cannot select, insert, update, or delete each other's `user_profiles` or `phrasing_projects` rows, and that no profile lookup/list endpoint exists. A duplicate-username claim may disclose only that exact handle is unavailable.
