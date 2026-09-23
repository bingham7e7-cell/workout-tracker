# Setup guide: Supabase, GitHub, Vercel, iPhone

Plan on about 30–45 minutes. You only do this once. Later stages may ask you to run a new
migration (step 3), and the instructions for that stage will say so.

You'll create two free accounts: **Supabase** (the database and sign-in) and **Vercel**
(hosts the website). Keep a notes app open. You'll copy a few values between sites.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com> and click **Start your project**. Sign up; "Continue with GitHub" is easiest.
2. Click **New project**.
   - **Name:** `workout-tracker`
   - **Database password:** click **Generate a password** and save it in your password manager.
     The app never uses it, but Supabase asks for it.
   - **Region:** pick the one closest to you.
   - Plan: **Free**.
3. Click **Create new project** and wait 1–2 minutes while it sets up.

## 2. Copy the two values the app needs

1. In your project, click the **Connect** button at the top of the page, or go to
   **Project Settings → API Keys**.
2. Copy these two values into your notes:
   - **Project URL**, which looks like `https://abcdefghijkl.supabase.co`
   - **Publishable key**, which starts with `sb_publishable_...`. If you only see "anon public",
     use that one; it works the same way.

> ⚠️ **Never copy the `secret` or `service_role` key anywhere.** This app doesn't need it.
> That key bypasses all security rules.

## 3. Create the database tables (run the migrations)

This creates all the tables, the security rules, and the default exercise library.

1. In Supabase, click **SQL Editor** in the left sidebar, then **New query**.
2. On GitHub, open the repository and go to the `supabase/migrations/` folder. Open the
   **first** file, `20260922000001_initial_schema.sql`, click the **Copy raw file** button
   (two overlapping squares), and paste the text into the Supabase SQL editor.
3. Click **Run**. You should see "Success. No rows returned".
4. Click **New query** again, then repeat with the **second** file,
   `20260922000002_default_exercise_library.sql`.
5. Check it worked: click **Table Editor** in the sidebar. You should see tables such as
   `exercises`, `templates`, `workouts`, and `workout_sets`.

> Always run migration files **in order**, and **each one only once**. If a run fails partway
> through, nothing from that file is saved (Postgres rolls the whole file back). Tell me the
> error message and we'll fix it.
> 
## 3.5. Configure Resend SMTP (Do this before Step 4)

This unlocks the ability to customize your email templates on the Supabase Free Tier.

### A. Add your domain to Resend
1. Log into your **Resend** account.
2. In the left sidebar, click **Domains**, then click **Add Domain**.
3. Type in your parked domain from Namecheap (e.g., `yourdomain.com`) and click **Add**.
4. Resend will display a table containing **TXT** and **MX** records. Keep this tab open.

### B. Update your Namecheap DNS settings
1. Log into your **Namecheap Dashboard** in a new browser tab.
2. Find your chosen domain name in your list and click **Manage**.
3. Click the **Advanced DNS** tab at the top of the domain management page.
4. Locate the **Host Records** section. For each row provided by Resend:
   - Click **Add New Record**.
   - Select the **Type** (TXT or MX) to match Resend's table.
   - Set the **Host** (use `@` if Resend specifies your bare domain, or copy the subdomain prefix like `bounces`).
   - Paste the long text string into the **Value** / **Target** field.
   - Leave the TTL on **Automatic** / **15 min** and click the green checkmark to save.
5. Head back to your Resend dashboard and click **Verify**. (It will switch from "Pending" to a green "Verified" badge once Namecheap updates).

### C. Generate your Resend API Key
1. In the Resend sidebar, click **API Keys**, then click **Create API Key**.
2. Set **Name** to `Supabase Integration` and **Permission** to `Full Access`.
3. Click **Add**. **Copy the generated key immediately** (it starts with `re_...`) and paste it into your temporary notes app.

### D. Connect Resend to Supabase
1. Open your online **Supabase Dashboard**.
2. Go to **Project Settings** (the gear icon at the bottom of the left sidebar) → **Auth**.
3. Scroll down until you find the **SMTP Settings** section.
4. Toggle the switch to **Enable Custom SMTP**.
5. Fill out the fields with these exact credentials:
   - **Sender Email:** `auth@yourdomain.com` *(Replace with your actual Namecheap domain)*
   - **Sender Name:** `Workout Tracker`
   - **SMTP Host:** `://resend.com`
   - **SMTP Port:** `465`
   - **SMTP User:** `resend` *(Type this exactly as literal text)*
   - **SMTP Password:** *(Paste the `re_...` API key you copied from Resend)*
6. Click **Save** at the bottom of the page.

## 4. Set up sign-in emails

The app signs you in with a code sent to your email. We'll change the email so it contains
both a **6-digit code** (for the iPhone Home Screen app) and a link (for Safari).

1. In Supabase, go to **Authentication → Emails**. The **Templates** tab is usually already open.
2. Open the **Magic Link** template. Set **Subject** to `Your Workout Tracker sign-in code`
   and replace the **Body** with:

   ```html
   <h2>Workout Tracker</h2>
   <p>Your sign-in code is:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Or, if you're in Safari, <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">tap here to sign in</a>.</p>
   ```

   Click **Save**.
3. Open the **Confirm signup** template, which is used only the very first time you sign in.
   Paste the **same body** there and click **Save**.

## 5. Put the code on the `main` branch

Right now the code is on a branch called `claude/jolly-cerf-6smmz0`. The repository doesn't
have a `main` branch yet, so we'll create one:

1. On GitHub, open the repository.
2. Click the branch dropdown (it shows the current branch name, near the top left), and type `main`.
3. Click **Create branch main from claude/jolly-cerf-6smmz0**.
4. Go to **Settings → General → Default branch**, click the ⇄ switch icon, choose `main`, and
   click **Update**. Confirm.

For each later stage, I'll prepare the work on a branch, and you merge it into `main` with a
Pull Request ("Merge pull request" button). Vercel redeploys automatically after every merge.

## 6. Deploy on Vercel

1. Go to <https://vercel.com>, click **Sign Up**, then **Continue with GitHub**. Choose the
   **Hobby** (free) plan.
2. Click **Add New… → Project**. Find `workout-tracker` and click **Import**. If you don't see
   it, click **Adjust GitHub App Permissions** and give Vercel access to the repository.
3. Leave the framework (**Next.js**) and build settings as they are.
4. Open **Environment Variables** and add two entries (name on the left, value on the right):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL from step 2 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | your publishable key from step 2 |

5. Click **Deploy** and wait about 1–2 minutes. When it finishes, copy your site address, for
   example `https://workout-tracker-abc123.vercel.app`.

## 7. Tell Supabase your site address

Supabase only sends sign-in links that point to websites you've approved.

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your Vercel address, e.g. `https://workout-tracker-abc123.vercel.app`.
3. Under **Redirect URLs**, click **Add URL** and add the same address followed by `/**`, e.g.
   `https://workout-tracker-abc123.vercel.app/**`.
4. Click **Save**.

## 8. Sign in for the first time

1. On your iPhone, open your Vercel address in **Safari**.
2. Enter your email and tap **Send code**.
3. Open the email, then either type the code into the app or tap the link.
4. You should see the **Workouts** home screen. Tap **Templates** and check that you can add
   exercises from the library.

## 9. This app is multi-user — sign-ups stay on

Your site is public, and that's intentional: other people can sign up and use it too. Each
person only ever sees their own workouts, templates and exercises — the database enforces
this with Row Level Security, not just app code, so there's no admin view and no way for
anyone (including you) to see someone else's data. Leave **"Allow new users to sign up"**
turned on in **Authentication → Sign In / Providers**.

If it ever becomes a problem (spam sign-ups, hitting your free-tier email quota via Resend),
you can turn it off there at any time — existing accounts keep working either way.

## 10. Add to your iPhone Home Screen

1. In Safari, with the app open, tap the **Share** button (a square with an arrow).
2. Scroll down, tap **Add to Home Screen**, then **Add**.
3. Open it from the Home Screen. The first time, you'll need to sign in again: type the
   **code** from the email. The link would open Safari instead of the app.

> Stage 3 adds the proper app icon and the offline features. Until then, the Home Screen app
> needs an internet connection to open, but a workout in progress is already kept on the phone
> if the page refreshes or the signal drops.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No email arrives | Check spam. Supabase's free email sender allows only a few emails per hour; wait and try again. |
| "That code is wrong or has expired" | Codes expire after about an hour and work only once. Request a new one. |
| Tapping the email link shows the login page again | Check step 7: the Site URL and Redirect URL must match your Vercel address exactly. |
| App says "Couldn't load this page" | Free Supabase projects pause after about a week of no use. Open the Supabase dashboard and click **Restore project**. |
| The site shows an error page straight after deploying | The two environment variables are probably missing or misspelled. Check step 6.4, then in Vercel go to **Deployments → ⋯ → Redeploy**. You must redeploy after any change to these variables. |
