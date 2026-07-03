# Exegetical Phrasing Editor Sync Setup

This adds optional Supabase Auth + Postgres sync for the standalone Exegetical Phrasing Editor. It does not replace the editor's existing localStorage save flow, and it does not touch the Bible Module IndexedDB cache.

## Supabase Project Values

Create one shared Supabase project for both the phrasing editor and the future dashboard. After the project exists, copy these from Supabase:

```txt
Supabase project URL: https://YOUR_PROJECT_REF.supabase.co
Supabase anon public key: YOUR_SUPABASE_ANON_PUBLIC_KEY
```

I cannot fill those two values from this workspace because they are created inside your Supabase account. The browser sync module is ready for them via `configurePhrasingSync(...)`.

## Google OAuth

In Google Cloud Console, register this authorized redirect URI:

```txt
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Then in Supabase, enable Authentication > Providers > Google and paste the Google Client ID and Client Secret.

In Supabase Authentication > URL Configuration:

- Set Site URL to the primary standalone editor URL.
- Add every app callback URL to Additional Redirect URLs, for example:
  - `https://YOUR_GITHUB_USERNAME.github.io/YOUR_EDITOR_REPO/`
  - `http://localhost:3000/`
  - `https://YOUR_FUTURE_DASHBOARD_DOMAIN/`

Keep this list append-only as more apps consume the same Supabase Auth instance. The Google redirect URI stays the Supabase callback URL; each app's own return URL is passed as `redirectTo` from the client and must be allow-listed in Supabase.

## Shared Auth With Future Dashboard

The standalone phrasing editor and the future dashboard should point at the same Supabase project URL and anon key. If they do, Google sign-in resolves to the same `auth.users` row for the same Google identity. This implementation does not add app-specific auth metadata, app-specific user tables, or redirect assumptions that would split accounts.

Things that could break shared identity later:

- Creating a separate Supabase project for the dashboard.
- Using a different auth provider or custom auth system outside this Supabase Auth instance.
- Adding app-specific account-linking rules that treat the same email as separate users.

## Database Setup

Run [supabase/phrasing_projects.sql](supabase/phrasing_projects.sql) in the Supabase SQL editor.

The table is `public.phrasing_projects`, not `projects`, so future dashboard tables can use names like `dashboard_tasks` or `dashboard_notes` without confusion.

Each row stores:

- `id`: stable client project id, unique per user.
- `user_id`: Supabase Auth user id.
- `name`: project display name.
- `verse_reference`: optional reference string.
- `language_mode`: `Hebrew`, `Greek`, or `Other`.
- `payload`: full editor session JSON.
- `created_at` and `updated_at`.

Row-level security is enabled. Authenticated users can select, insert, update, and delete only rows where `user_id = auth.uid()`. Anonymous users get no table grants and no public read access.

## Browser Library

Use [sync/phrasing-supabase-sync.js](sync/phrasing-supabase-sync.js) from a static page:

```html
<script type="module">
  import {
    configurePhrasingSync,
    signInWithGoogle,
    signOut,
    getCurrentUser,
    saveProjectToCloud,
    loadAllProjectsFromCloud,
    deleteProjectFromCloud,
    migrateLocalProjectsOnce,
    onAuthStateChange
  } from './sync/phrasing-supabase-sync.js';

  configurePhrasingSync({
    supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
    supabaseAnonKey: 'YOUR_SUPABASE_ANON_PUBLIC_KEY',
    redirectTo: window.location.href
  });
</script>
```

The module has no top-level network dependency. On the first cloud operation, it uses `window.supabase.createClient` if the Supabase UMD bundle is already loaded; otherwise it lazy-loads Supabase JS v2 from jsDelivr. There is no build step.

Optional explicit Supabase bundle load:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

## Function Behavior

`configurePhrasingSync(options)`

Initializes the Supabase client. Required options are `supabaseUrl` and `supabaseAnonKey`. Optional options are `redirectTo`, `tableName`, and `migrationFlagPrefix`. Returns `{ ok: true }` or `{ ok: false, reason }`.

`signInWithGoogle(options?)`

Starts Supabase Google OAuth. On success the browser redirects away. If offline or unconfigured, it returns a skipped result and does not disturb the editor.

`signOut()`

Signs out of Supabase Auth. It does not delete localStorage projects.

`getCurrentUser()`

Returns the current Supabase user object, or `null`.

`saveProjectToCloud(projectId, projectData)`

Upserts one row into `phrasing_projects`. The entire `projectData` object is stored as `payload`; metadata fields are copied from common keys like `name`, `verseReference`, and `languageMode`. Returns `{ ok: true, row }` or a non-throwing failure result.

`loadAllProjectsFromCloud()`

Returns the signed-in user's cloud projects ordered by `updated_at` descending. Returns `[]` when offline, signed out, or on recoverable failure.

`deleteProjectFromCloud(projectId)`

Deletes one cloud row for the signed-in user. It does not delete the localStorage copy.

`migrateLocalProjectsOnce({ listLocalProjects, force? })`

Uploads existing local phrasing projects after first sign-in. The editor supplies `listLocalProjects` because the existing localStorage index/key format lives in the editor, not in this reusable sync library.

Expected return shape from `listLocalProjects`:

```js
[
  { projectId: 'local-id-1', projectData: { /* full editor session */ } },
  { id: 'local-id-2', data: { /* full editor session */ } }
]
```

Migration writes a localStorage flag scoped to the phrasing editor and the Supabase user:

```txt
phrasing_editor_migrated_v1:SUPABASE_USER_ID
```

That prevents duplicate migration on later sign-ins. If the upload partially fails, the flag is not written, and a later retry is safe because cloud saves use upsert with the same project ids.

`onAuthStateChange(callback)`

Optional helper for reacting to `SIGNED_IN` and `SIGNED_OUT`. A common integration is to run `migrateLocalProjectsOnce(...)` after `SIGNED_IN`.

## Failure Modes

All exported async functions catch recoverable errors. Offline, signed-out, and unconfigured states do not throw uncaught errors. The editor should continue saving to localStorage exactly as it does today, then optionally call cloud functions after local save succeeds.

Suggested save order:

1. Save to localStorage using the existing manual/autosave code.
2. Call `saveProjectToCloud(projectId, projectData)`.
3. Ignore skipped or failed cloud results in normal editing UI, or show a small sync status later if desired.

## Conflict Strategy

The first version uses last-write-wins with `updated_at`.

The database updates `updated_at` on every cloud update. If two signed-in devices edit the same project, whichever save reaches Supabase last becomes the newest cloud version. When loading cloud projects into the editor, compare the cloud row's `updated_at` with the local project's saved timestamp if the local app tracks one; otherwise treat the cloud version as the latest signed-in version and let the user choose if needed.

This is intentionally simple for a single-user, low-frequency editing workflow. Revisit it later if collaboration, paragraph-level merging, or detailed revision history becomes important.

## Bible Module Boundary

Do not pass Bible Module IndexedDB data to any sync function. This sync layer only stores editor project session JSON in `phrasing_projects.payload`. The offline Bible text cache remains local-only.
