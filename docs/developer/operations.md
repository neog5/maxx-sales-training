# Operations

Running jobs that come up after the app is live.

## The first super admin

Sign-up is invite-only, so first invite yourself in the Supabase SQL Editor:

```sql
insert into public.invites (email) values ('you@maxxortho.com');
```

Sign up through the app with that email, then back in the SQL Editor:

```sql
update public.profiles set role = 'super_admin'
where id = (select id from auth.users where email = 'you@maxxortho.com');
```

The SQL Editor can change roles because it runs without a signed-in user. After that, change everyone else's role from their profile page.

## Database changes

- Schema changes go in a new numbered pair: `supabase/migrations/NNN_name.sql` and `NNN_name.undo.sql`.
- Run migrations in number order in the SQL Editor. Run them on dev first, then production, and always **before** deploying code that needs them. Two exceptions, where the old app breaks once the migration has run, so run it and deploy the matching code together: 011 (the old app can't save reading or attempts) and 013 (the old app can't open course PDFs).
- Test a migration before running it with `TEST_MIGRATIONS=supabase/migrations/NNN_name.sql npm run test:db` (see [TESTING.md](../TESTING.md)).
- Back up first (Supabase → Database → Backups, or `pg_dump` with `SUPABASE_DB_URL`).
- `requested-changes.sql` is safe to rerun. `setup.sql` is for empty projects only.
- Add tests for any new permission rule to `supabase/tests/access-rules.mjs` and run `npm run test:db`. The tests create their own users and data inside a transaction and roll it back.
- Add the migration to the list in [setup.md](setup.md).

## Admin email alerts

Every admin and super admin is emailed when someone signs up, and when someone uses their last attempt on a course. The database sends these itself through [Resend](https://resend.com), using triggers and the `pg_net` extension (migration 009). It sends to at most 50 admins. A failure never blocks the sign-up or attempt.

Setup, once per Supabase project:

1. In Resend, verify the sending domain (for example `maxxorthoportal.com`) and create an API key with sending access.
2. In the SQL Editor, store the settings in Vault:

   ```sql
   select vault.create_secret('re_your_api_key', 'resend_api_key');
   select vault.create_secret('Maxx Training <alerts@maxxorthoportal.com>', 'alert_from_email');
   select vault.create_secret('https://training.maxxorthoportal.com', 'portal_url');  -- for the profile link
   select vault.create_secret('[DEV] ', 'alert_subject_prefix');                      -- dev project only
   ```

   Change one later with `vault.update_secret` or Project Settings → Vault.

No emails are sent until `resend_api_key` is set. To check what Resend said about recent emails (kept about 6 hours):

```sql
select status_code, content from net._http_response order by created desc limit 10;
```

## Sign-in emails (SMTP)

Supabase Auth sends the sign-up confirmation and forgot-password emails itself, separately from the admin alerts above. Its built-in sender only delivers to members of the Supabase organisation and only a few emails an hour, so every project that real people use needs its own SMTP server. Use Resend.

Setup, once per Supabase project:

1. **Authentication → Emails → SMTP Settings**: turn on **Custom SMTP** and enter:

   | Field | Value |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | a Resend API key with sending access (the alerts key works, or create a separate one) |
   | Sender email | an address on the verified domain, e.g. `no-reply@maxxorthoportal.com` |
   | Sender name | `Maxx Sales Training` (dev: `[DEV] Maxx Sales Training`) |

2. **Authentication → Rate Limits**: raise *Rate limit for sending emails* if needed; Supabase starts custom SMTP at 30 an hour.
3. **Authentication → URL Configuration**: Site URL is the portal address, and Redirect URLs include `<portal>/reset-password` (dev also `http://localhost:3000/reset-password`). A missing redirect sends people to the home page instead of the reset form.
4. Optional: **Authentication → Emails → Templates → Reset Password**: set a clearer subject such as "Reset your Maxx Sales Training password". Keep the `{{ .ConfirmationURL }}` link.

To test, use **Forgot password?** on the sign-in page and open the emailed link in the same browser. Failed sends show under **Logs → Auth**.

## Changing the certificate template

1. Design the certificate in Canva: one template for every course, with the name, course and date areas left blank.
2. Download → **PDF Print**, and save it as `public/certificates/template.pdf`.
3. Adjust `CERTIFICATE_TEMPLATE` in `lib/certificates.js` until the text sits right. For each field it sets:
   - position as a fraction of the page from the top-left (`y` is the text baseline);
   - maximum width;
   - font size and the minimum it may shrink to;
   - font and colour.
4. Fonts can be any `.ttf` in `public/certificates/fonts/` or a built-in PDF font. The current fonts, free Google Fonts with their licences beside them, are:
   - Archivo Black for the name;
   - Alice for the course;
   - Montserrat SemiBold for the date.
5. Check a few long names and course titles, then run `npm test` (the certificate tests render the template and check fitting and positions).

Existing certificates are drawn fresh from the template each time they're opened, so a new design applies to old certificates too. The text on them (name, course, date, number) never changes.

## Common admin requests

| Request | How |
|---|---|
| Someone is out of attempts | Their profile → *Locked assessments* → **Allow 3 more attempts** (admins) |
| Retire a course | Course Overview → **Archive**. Records are kept; it leaves everyone's requirements. |
| Delete a course created by mistake | Super admin, course Overview → **Delete** (only if nobody has started it) |
| Make a manager | Their profile → role → Manager → **Save role** |
| Someone changed their name | They can't edit it in the app yet; update `profiles.full_name` in the SQL Editor. Existing certificates keep the old name. |
| Remove a person | Not possible in the app. In Supabase it only works if they have no training records. Otherwise leave the account; removing them from groups and assignments takes them out of compliance. |
| See who changed group memberships or roles | `select * from audit_log where entity_type in ('group','group_member','profile') order by created_at desc;` |
| A PDF is too large for AI suggestions | Compress it to under 5 MiB, or set `OPENROUTER_PDF_ENGINE=mistral-ocr` (paid) |
| Find unused files in storage | Migration 010 has a commented-out query for orphaned files |
