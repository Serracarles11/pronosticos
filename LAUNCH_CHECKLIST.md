# TodosGanamos launch checklist

## Required before public launch

- Run Supabase SQL migrations in order through `supabase/14_pronostico_copy_categories.sql`.
- Enable Google in Supabase Auth and allow `/auth/callback` for local and production domains.
- Set production environment variables from `.env.example`.
- Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS domain.
- Create and verify the `capturas-pronosticos` storage bucket.
- Promote at least one account to admin:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE username = 'TU_USUARIO';
```

- Complete real legal owner data in:
  - `/terminos`
  - `/privacidad`
  - `/cookies`
  - `/juego-seguro`
- Test with at least three real accounts:
  - public account
  - private account
  - admin account

## Critical flows to test

- Signup and login.
- Create a public pronostico.
- Create a followers-only pronostico.
- Save and unsave a pronostico.
- Follow a public account.
- Request access to a private account.
- Accept and reject follow requests.
- Like and comment.
- Report a pronostico.
- Send beta feedback.
- Review reports and feedback in `/admin`.
- Configure safe social links and verify public visibility in `/u/[username]`.
- Share a public profile and a pronostico.
- Report and block another user.
- Review social reports in `/admin`.
- Open the notification center and mark notifications as read.
- Close a pronostico with proof image after the allowed time.

## Deploy checks

Run locally before deploying:

```bash
npm run check
```

After deploy, check:

- `/api/health` returns `200`.
- `/robots.txt` is available.
- `/sitemap.xml` is available.
- Protected pages redirect when logged out.
- Admin pages reject non-admin users.

## Production notes

- TodosGanamos is positioned as a community without real-money betting. Do not add deposits, payments, bookmaker affiliate redirects, or reward mechanics without legal review.
- Keep RLS enabled on all Supabase tables.
- Review report and feedback queues daily during beta.
