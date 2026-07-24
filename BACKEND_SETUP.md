# Rosemary Williams Gallery Backend Setup

The code is implemented. These remaining steps create the Cloudflare resources,
connect them to the existing Worker, and restrict the admin area to approved
email addresses.

## What the implementation provides

- `/admin/` — private gallery manager
- `/api/art` — public, read-only artwork metadata
- `/admin/api/*` — authenticated gallery management API
- Cloudflare D1 — artwork metadata and storage accounting
- Cloudflare R2 — optimized display images and thumbnails
- Cloudflare Access — email-based sign-in for Rosemary and the site owner
- Automatic browser-side WebP conversion and resizing
- A 9 GB application safety limit, leaving headroom below R2's 10 GB free tier
- The existing twenty local images seeded into D1

The existing images remain in the website repository. New images uploaded from
the manager are stored in R2.

## 1. Activate R2 and create the image bucket

R2 requires completing Cloudflare's checkout flow even when usage remains
inside the free allowance.

1. Sign in to the Cloudflare dashboard.
2. Go to **Storage & databases → R2**.
3. Activate R2 if prompted.
4. Create a Standard storage bucket named `rosemary-art`.
5. Open the bucket, choose **Settings → Custom Domains → Add**, and connect:

   `media.rosemarywilliams.art`

6. Leave the public `r2.dev` development URL disabled. The custom domain is the
   production URL and allows Cloudflare caching.

CLI alternative:

```powershell
npx wrangler@latest login
npx wrangler@latest r2 bucket create rosemary-art
```

## 2. Create the D1 database

In the Cloudflare dashboard:

1. Go to **Storage & databases → D1 SQL database**.
2. Create a database named `rosemary-gallery`.
3. Copy its database ID.
4. Open `wrangler.jsonc` in this repository.
5. Replace `REPLACE_WITH_D1_DATABASE_ID` with the copied ID.

CLI alternative:

```powershell
npx wrangler@latest d1 create rosemary-gallery
```

The command prints the database ID that belongs in `wrangler.jsonc`. Keep the
binding name as `DB`.

## 3. Apply the schema and seed the existing gallery

After putting the real D1 database ID in `wrangler.jsonc`, run this from the
repository folder:

```powershell
npx wrangler@latest d1 migrations apply rosemary-gallery --remote
```

Confirm the migration when Wrangler asks. The migration creates the tables and
adds metadata for the twenty images already in `images/art/`.

The command is safe to retry: the inserts use `INSERT OR IGNORE`, and Wrangler
tracks applied migrations.

## 4. Create the Cloudflare Access application

The administrative API validates Cloudflare's signed token, so an Access
application is required.

1. In the dashboard, open **Zero Trust**.
2. If this is the first visit, create the free Zero Trust organization and note
   its team domain, such as:

   `your-team-name.cloudflareaccess.com`

3. Go to **Access controls → Applications → Add an application**.
4. Choose **Self-hosted**.
5. Name it `Rosemary Gallery Manager`.
6. Set the public hostname to the website's production hostname.
7. Set its path to `/admin`. This protects `/admin/` and every path below it,
   including `/admin/api/*`.
8. Add an **Allow** policy containing only Rosemary's exact email address and
   your exact email address.
9. Enable either:

   - **One-time PIN**, which emails Rosemary a login code, or
   - **Cloudflare identity provider**, if both administrators will have
     Cloudflare accounts with MFA.

10. Save the application.
11. Copy its **Application Audience (AUD) tag** from the application settings.

Do not create an allow rule for every email address or an entire public email
domain.

## 5. Complete `wrangler.jsonc`

Replace every placeholder in `wrangler.jsonc`:

```jsonc
"database_id": "the-real-d1-database-id"
```

```jsonc
"CF_ACCESS_TEAM_DOMAIN": "your-team-name.cloudflareaccess.com",
"CF_ACCESS_AUD": "the-application-audience-tag"
```

Keep:

```jsonc
"PUBLIC_IMAGE_BASE_URL": "https://media.rosemarywilliams.art",
"MAX_STORAGE_BYTES": "9000000000"
```

`ADMIN_EMAILS` is a second, server-side exact allowlist. To avoid committing
personal email addresses to this repository, add it as an encrypted Worker
secret:

> If the dashboard says variables cannot be added because the Worker only has
> static assets, complete the first deployment in section 6 without this
> secret. The deployment will succeed, and Cloudflare will enable runtime
> secrets after the Worker script is active. Then return here.

1. Open **Workers & Pages → `rosemarywilliams-art` → Settings → Variables and
   Secrets**.
2. Add `ADMIN_EMAILS`.
3. Enter the same addresses as the Access policy, separated by commas:

   `rosemary@example.com,you@example.com`

4. Select **Encrypt**, then save it for Production.

If the existing Worker has a different project name, also replace:

```jsonc
"name": "rosemarywilliams-art"
```

with the exact existing Worker name.

Important: `wrangler.jsonc` is the source of truth for the Worker's bindings,
runtime variables, static assets, and observability settings.

## 6. Deploy to the existing Cloudflare Worker

In **Workers & Pages → `rosemarywilliams-art` → Settings → Build**, use:

- Build command: `npm run build`
- Deploy command: `npm run deploy`
- Root directory: leave blank

The build command compiles the file-based Pages Functions into one Worker
entrypoint. The deploy command uploads that entrypoint and the static website
as one Worker deployment.

Commit and push after completing `wrangler.jsonc`. Cloudflare will install the
pinned Wrangler dependency, compile the backend, and deploy from the configured
production branch.

For a manual deployment from this repository folder:

```powershell
npm install
npm run build
npm run deploy
```

After deployment, make sure the production domain is active under the Worker's
**Settings → Domains & Routes**.

## 7. Confirm the Worker bindings

After the first deployment, open:

**Workers & Pages → `rosemarywilliams-art` → Settings → Bindings**

Confirm that the deployment has:

- D1 binding `DB` → `rosemary-gallery`
- R2 binding `ART_BUCKET` → `rosemary-art`

The names are case-sensitive.

Also confirm these variables appear in the Worker configuration:

- `PUBLIC_IMAGE_BASE_URL`
- `CF_ACCESS_TEAM_DOMAIN`
- `CF_ACCESS_AUD`
- `MAX_STORAGE_BYTES`

Confirm `ADMIN_EMAILS` appears separately as an encrypted secret. Do not add
Cloudflare API tokens, R2 access keys, passwords, or personal email allowlists
to the repository.

## 8. Test the completed flow

Use the production custom domain rather than a preview URL:

1. Visit `https://rosemarywilliams.art/admin/`.
2. Sign in using an approved email address.
3. Confirm all twenty existing works appear.
4. Add one test artwork.
5. Open `https://rosemarywilliams.art/art.html` in a private browser window.
6. Confirm the test artwork appears and its image URL begins with
   `https://media.rosemarywilliams.art/`.
7. Edit the test artwork and choose **Hide from public gallery**.
8. Confirm it remains in the manager but disappears from the public gallery.

The administrative API intentionally rejects requests on unprotected preview
URLs because those requests do not carry the production Access application
token.

## Normal use for Rosemary

1. Go to `/admin/`.
2. Sign in with the code sent to the approved email.
3. Choose an image.
4. Enter the title and image description.
5. Optionally enter medium, year, and dimensions. Frame, wall position, and
   display order are assigned automatically.
6. Select **Add artwork**.

The browser creates:

- A display image no larger than 2,400 pixels on its longest edge.
- A thumbnail no larger than 560 pixels on its longest edge.

The original full-resolution photograph is not retained in R2. Rosemary should
keep archival originals in her normal backed-up photo storage.

## Operational notes

- Uploaded filenames are immutable UUID-based R2 object keys, allowing
  year-long browser caching.
- Replacing an image removes its superseded R2 display and thumbnail objects.
- Removing an artwork permanently deletes its R2 objects.
- Hiding an artwork keeps it and its images while removing it from the public
  gallery.
- The manager stops uploads at 9 GB even though R2 includes 10 GB of free
  Standard storage. This prevents normal manager use from crossing the free
  storage allowance.
- R2 usage outside this application, including dashboard or CLI uploads, is not
  represented in the manager's meter. Use this bucket only for the gallery.
- D1 Free includes seven days of Time Travel recovery. R2 should not be treated
  as the archival home for original artwork photography.

## Troubleshooting

### “Cloudflare Access has not been configured”

Check `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, and `ADMIN_EMAILS` in
`wrangler.jsonc`, then redeploy.

### The sign-in page never appears

Confirm the Access application path is `/admin` on the production hostname and
that the DNS record is proxied through Cloudflare.

### The editor loads but API calls are unauthorized

Confirm the Access application's AUD tag exactly matches `CF_ACCESS_AUD`.
Sign out through `/cdn-cgi/access/logout`, then sign in again.

### Upload succeeds but the image is not visible

Confirm the R2 custom domain is Active and exactly matches
`PUBLIC_IMAGE_BASE_URL`. Do not use an `r2.dev` URL for production.

### “The gallery database has not been initialized”

This is not caused by an empty R2 bucket. It means the configured D1 database
does not contain the gallery tables. Apply the remote migrations from section 3
and redeploy if needed.

### The public gallery is temporarily unavailable

Open `/api/art` directly. A non-200 response usually means the D1 binding is
missing, points to the wrong database, or the migration has not been applied.
