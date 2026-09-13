# Going live free — with a database and admin portal

**Short answer:** the website goes live free on Cloudflare Pages (or Netlify). The database and admin portal are also free — I built them on **Google Sheets + Apps Script**, which costs ₱0, needs no credit card, and never switches itself off.

I deliberately did **not** use Supabase: its free tier pauses your project after **7 days with no bookings**, and appointments would silently fail until you log in and unpause it. Apps Script has no such trap.

---

## PART 1 — Put the site online

Your site is plain HTML/CSS/JS. Unzip `huxley-website.zip` and upload the **contents** (`index.html` must sit at the top level).

| Host | Free plan | Commercial use? | Notes |
|---|---|---|---|
| **Cloudflare Pages** ← recommended | unlimited bandwidth + requests | ✅ allowed | No credit card, never pauses. Static assets are free and unmetered. |
| **Netlify** | 300 credits/month | ✅ allowed | Easiest drag-and-drop, but ~15 GB bandwidth or ~20 deploys/month, then **your site pauses**. |
| **GitHub Pages** | unlimited | ✅ allowed | Free forever, version history, slightly more technical. |
| **Vercel** | 100 GB bandwidth, 1M requests | ❌ **not allowed on the free Hobby plan** | Vercel's Fair Use Guidelines restrict Hobby to personal, non-commercial use. A jewelry business site needs **Pro, $20/month**. |

### ⚠️ About Vercel

Technically your site deploys on Vercel perfectly — it's static files, and the database lives in Google Apps Script, so nothing about the setup conflicts with Vercel. I've already added the `vercel.json` it needs.

**But Vercel's free Hobby plan is licensed for personal, non-commercial use only.** Their fair-use rules define commercial as any deployment tied to financial gain, and require Pro or Enterprise for commercial sites. A business selling jewelry qualifies, so a free Vercel deploy would be against their terms and could be suspended. Two honest options:

- **Host free on Cloudflare Pages** and keep everything else as built. This is what I recommend.
- **Use Vercel Pro ($20/month ≈ ₱1,150)** if you specifically want Vercel — still a totally valid choice, just not the free one.

### Deploying to Vercel (if you choose Pro, or for testing)

1. **Dashboard:** sign in at **vercel.com** → **Add New → Project**. If your files are on GitHub, import the repo; otherwise install the CLI.
2. **CLI:**
   ```bash
   npm i -g vercel
   cd huxley-website
   vercel          # preview URL
   vercel --prod   # live production
   ```
3. When asked, set **Framework preset: Other**, leave **Build command** empty, and leave **Output directory** empty — Vercel serves the folder as-is. The included `vercel.json` then gives you:
   - `/admin` and `/login` as clean URLs instead of `/admin.html` and `/login.html`
   - noindex headers on the admin page
   - one-year caching on `/assets/*` so the site loads fast
4. **Custom domain:** Project → Settings → Domains → add your domain and follow the DNS records. SSL is automatic and free.

### Deploying to Cloudflare Pages (recommended)

1. **dash.cloudflare.com** → free account (no credit card).
2. **Workers & Pages → Create → Pages → Upload assets**.
3. Project name `huxley-jewelry`; upload the contents of the unzipped folder.
4. **Deploy** → `https://huxley-jewelry.pages.dev`, free HTTPS, forever.
5. Updating later: **Create new deployment** and upload again.

The included `_headers` and `_redirects` files are read automatically by Cloudflare Pages (and Netlify): they add the admin noindex headers, long caching for images, and the tidy **`/admin`** and **`/login`** URLs.

| | Cost |
|---|---|
| `huxley-jewelry.pages.dev` | **₱0** |
| `huxleyjewelrycreations.com` | ~₱600–900 / year (hosting stays ₱0) |

## PART 2 — The database + admin portal (built, ready to switch on)

### What you now have

| File | What it is |
|---|---|
| `backend/Code.gs` | The backend. Paste into Google Apps Script. Stores everything in a Google Sheet, emails you and the customer, and answers the website. |
| `login.html` | **The sign-in page** (`/login`) — asks for your username and password, then hands over to the dashboard. |
| `admin.html` | **Your dashboard** (`/admin`) — a private page on your own website. |
| `index.html` | The website. The booking form now saves to the database when you switch it on. |

Upload `login.html` and `admin.html` along with `index.html` when you deploy. It is `noindex, nofollow` — search engines won't list it, and it can't be opened without your password.

### Setup, step by step

**1. Create the sheet**
- Go to **sheets.new**, name it **Huxley Bookings**.
- Then **either** open the script from inside the sheet: **Extensions → Apps Script** (recommended — everything is found automatically)
  **or**, if you made the script separately at script.google.com, copy the long id out of your sheet's address bar and save it as a Script property called `SHEET_ID`:
  `docs.google.com/spreadsheets/d/`**`THIS_LONG_PART`**`/edit`
- Delete the sample code, paste everything from `backend/Code.gs`, and press **Save**.

**2. Run setup once**
- In the Apps Script editor choose the function **`setup`** and press **Run**.
- Google asks for permission — click **Review permissions → your account → Advanced → Go to (unsafe) → Allow**. ("Unsafe" is just Google's wording for a script you wrote yourself.)
- Open your Sheet: you now have **Appointments**, **Blocks** and **Activity log** tabs.

**3. Let the backend find your sheet** — pick whichever is easiest:

| Situation | What to do |
|---|---|
| You opened the script from inside your sheet (**Extensions → Apps Script**) | Nothing — it is found automatically. |
| You made the script at script.google.com | Add a Script property **`SHEET_ID`** with the code from your sheet's address bar: `docs.google.com/spreadsheets/d/`**`YOUR_SHEET_ID`**`/edit` |
| You would rather not look up the id | Name the spreadsheet exactly **Huxley Bookings** and the backend will find it in your Drive. |

**Troubleshooting:** run the function **`diagnose`** in the Apps Script editor and open **Execution log** — it prints which spreadsheet it found, which tabs exist, and which settings are missing.

**4. Set your password and details**
- In Apps Script: **⚙ Project Settings → Script properties → Add script property**:

| Property | Value | Purpose |
|---|---|---|
| `ADMIN_USER` | `adminhuxley` | Your admin portal username. |
| `ADMIN_PASSWORD` | your own password | Your admin portal password. **Required.** Choose something only you know — this file is public, so never write the real one here. You can change it later from the portal's Settings tab. |
| `OWNER_EMAIL` | `huxleyjewelrycreations@gmail.com` | Where new bookings are emailed |
| `OWNER_PHONE` | `0976 463 7003` | Shown in the customer's email |
| `SHOP_MAPS` | your Google Maps link | Sent automatically when you confirm an appointment |
| `SHEET_ID` | *(only if the script is not attached to the sheet)* | The id from your sheet's URL |

> Your deployed Web App URL is already wired into `index.html`, `login.html` and `admin.html`:
> `…/AKfycbxYavQPq4nWIqgHaGTKi99ZCqkGOn6OeYmu_Vccbm8rq9DS-astSch5yb_ZmQ5PmOJIRA/exec`
> When you edit `Code.gs`, remember to publish it: **Deploy → Manage deployments → pencil → Version: New version → Deploy**.

**5. Deploy the API**
- **Deploy → New deployment → Web app**
- Description: `booking api`
- **Execute as: Me**
- **Who has access: Anyone**
- **Deploy** → copy the URL that ends in **`/exec`**.

> "Anyone" sounds alarming but only exposes the two endpoints in the script: reading which slots are taken (no personal data at all) and submitting a booking. Everything in the admin portal needs your password.

**6. Switch the website on** — already done for you
- `index.html` has `apiUrl` set and `login.html` **and** `admin.html` have `DEFAULT_URL` set, all pointing at your deployment. If you ever redeploy and get a **new** URL, update those three lines in one go with `python3 tools/set_backend_url.py '<new-url>'` — nothing on the sign-in screen exposes the address, on purpose.
- Re-upload the files. Done.

If you'd rather not edit the file, skip the `index.html` step: the form will email you instead — but the admin portal only works with the URL in place, since it needs the database.

**7. Sign in to your portal**
- Open **`your-site.com/login`** — or `huxleyjewelry.vercel.app/login`. You land on the dashboard at `/admin`.
- Just enter your **username** and **password** — the backend address is built into the page and is never shown on screen. If a connection ever goes wrong, tap **Reset connection** and the page goes back to the built-in address by itself.
- The first successful sign-in converts your password to a salted SHA-256 hash and deletes the plain one.

> 🔐 **Why the password is not in the website files.** Anything inside `login.html`, `admin.html` or `index.html` can be read by anyone who presses Ctrl+U. So the credentials live only in Google's Script properties, and every sign-in is checked on Google's side. Never paste a password into the code — of any website.

**8. Change your login (recommended)**
In the portal go to **Settings** → change the username and/or password → **Save**. Your new details take effect immediately.

### What happens now, end to end

1. A client picks a date and sees **real availability** — slots already booked by anyone, plus any day you've closed, are crossed out.
2. They fill in the form and send. The booking is **saved as a row in your Google Sheet**, the slot closes for everyone instantly, and the server re-checks the slot under a lock so two people can never take the same time.
3. **You get an email** with all the details; **they get an email** acknowledging the request and the ₱1,000 policy.
4. You open the portal on your phone and press **Confirm** — they instantly receive a confirmation email with your **Google Maps location** (from `SHOP_MAPS`).
5. Use **Done** when the appointment is finished, **Cancel** if it falls through, and **Fee paid → Deducted** to track the ₱1,000 against the ring order. **Fees collected** adds ₱1,000 per booking only once you press **Fee paid** (a fee marked **Deducted** still counts — that money was received).

### Admin portal features

**Appointments tab**
- **Stats**: today, upcoming, pending, confirmed, total, fees collected — counted from the fee column, so unpaid bookings read ₱0
- **List** with search (name / phone / email / reference) and filters (status, today / upcoming / past / everything)
- **One-tap** Confirm · Done · Cancel · Fee paid · Deducted
- **Block a slot or close a whole day** — the public calendar obeys instantly, no code editing
- **Export CSV** for your records or your accountant
- Auto-refreshes every 2 minutes while open; works on a phone

**Website photos tab**
- Four photo slots, one per part of the site — homepage hero, wedding & engagement rings, college rings, and Our Craft
  (a slot added after your backend went live needs one more publish: **Deploy → Manage deployments → pencil → New version → Deploy**)
- **Upload** from your phone or computer: the image is resized to 1800px and compressed in the browser before it is sent, so camera-sized files are fine
- **Or paste a link** if the photo is already online
- **Reset** returns a slot to the original design photo
- Photos are stored in a **Google Drive folder called "Huxley Website Photos"** and appear on the website within seconds

**Settings tab**
- Change your **username** and/or **password** (current password required; minimum 6 characters)

### If you go over the free limits

Consumer Apps Script allows **90 minutes of script runtime per day**, **6 minutes per execution**, and **20,000 URL fetches per day**; a consumer Gmail account can send **100 emails/day**. A shop taking a handful of bookings a day uses a fraction of that. If you ever outgrow it, the migration is to Supabase — the website and portal keep working, only the backend changes.

### Things to know

- **Keep the sheet private.** Anyone with edit access can change bookings. Don't share it publicly. The Drive folder only needs "Anyone with the link → Viewer", which the script sets for you.
- **Back it up occasionally.** Sheet → **File → Make a copy** once a month is enough. Free tiers don't include automated backups.
- **Never put the password in the website files.** Change it any time from Settings.
- **If you forget it**, clear `ADMIN_HASH` and `ADMIN_SALT` in Script properties and set `ADMIN_PASSWORD` again — the portal will pick it up and re-hash on the next sign-in.

---

## Third option: no database at all

If you'd rather keep things dead simple for now, don't switch on the backend — the form emails you each request (it already does), and you reply manually. Nothing breaks; you just lose live availability and the portal. You can turn the database on any time by pasting the URL.
