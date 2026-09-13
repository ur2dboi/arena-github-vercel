# Going live free — and adding a database + admin portal

You can put this website online today, for ₱0, forever. Adding a **database and admin portal** is also free, but it works differently — read Part 2 before choosing.

---

## PART 1 — Put the site online today (free, ~10 minutes)

Your site is plain HTML/CSS/JS with no server, so any static host will run it. **I recommend Cloudflare Pages**, because static files are served with **unlimited bandwidth and unlimited requests for free** ([source](https://vpsranking.com/serverless/cloudflare-pages/)) — unlike Netlify, whose free plan now runs on 300 credits/month and **pauses your site** if you exceed it ([source](https://netli.fyi/blog/netlify-free-plan-limits-2026)).

### Option A — Cloudflare Pages (recommended)

1. Go to **dash.cloudflare.com** and create a free account (email + password, no credit card).
2. In the sidebar choose **Workers & Pages → Create → Pages → Upload assets**.
3. Project name: `huxley-jewelry`. Upload the **contents** of `huxley-website.zip` (unzip it first — `index.html` and the `assets` folder must be at the top level, not inside another folder).
4. Click **Deploy**. You get a live link in about a minute:
   **`https://huxley-jewelry.pages.dev`** — free HTTPS, works worldwide, no expiry.
5. To update later: **Create new deployment** and upload the files again.

> Cloudflare also has **cloudflare.com/drop** — drag a folder in and get a live URL with no account at all. But it expires after 60 minutes unless you claim it ([source](https://pinggy.io/blog/cloudflare_drop_static_site_hosting/)), so for the permanent site use the dashboard above.

### Option B — Netlify
Easiest of all: go to **app.netlify.com/drop**, drag the unzipped folder in. It works instantly with no login, but **you must claim it within 1 hour by creating a free account** or it is deleted ([source](https://vercel.com/kb/guide/vercel-drop-vs-netlify-drop)). Watch the credit limit mentioned above.

### Option C — GitHub Pages
Free forever, better if you want a version history. Slightly more technical: create a repository, upload the files, then Settings → Pages → Deploy from branch → `main`.

### Your own domain name

| | Cost | Notes |
|---|---|---|
| `huxley-jewelry.pages.dev` | **₱0** | Fine to start with. Put it on your Facebook page today. |
| `huxleyjewelrycreations.com` | ~₱600–900 / year | Buy at Cogonet, Namecheap, or Cloudflare Registrar. **Hosting stays free** — you only pay the domain. |

Once you own a domain, add it in Pages → Custom domains and Cloudflare issues the SSL certificate automatically.

**After going live, two 2-minute jobs:** update the `og:image` line in `index.html` to the full web address (there's a comment marking it), and add the link to your Facebook page and Google Business Profile.

---

> **Heads up:** the database and admin portal are now built. See **`SETUP-BACKEND.md`** for the full setup — this file only covers hosting.

## PART 2 — Adding a database + admin portal

Right now the booking form **emails you the appointment**. There's no database, so the admin side is "your inbox". Adding a real database means three things change:

- Appointments are **saved in a database** instead of only emailed.
- **Slots disappear for everyone instantly** — no more double-requests on different devices.
- You get an **admin portal** (a private page on your own site) to manage everything.

Three free ways to do it. All are genuinely ₱0/month — they differ in effort and risk.

| | **A. Google Sheets + Apps Script** | **B. Supabase (Postgres)** | **C. Cloudflare Workers + D1** |
|---|---|---|---|
| What the database is | A Google Sheet you own | A real SQL database | A real SQL database (SQLite) |
| Free limits | 90 min/day script runtime, 20,000 UrlFetch calls/day, 6 min per run ([source](https://medium.com/@stackarchitect123/google-apps-script-quotas-2026-official-limits-6-minute-rule-consumer-vs-workspace-d18245035715)) | 500 MB, 50k users, 5 GB egress, 2 projects ([source](https://www.itpathsolutions.com/supabase-free-tier-limits)) | 100k requests/day, 5 GB database, no card |
| Risk of going offline | **None** | ⚠️ **Pauses after 7 days with no database activity** — bookings would fail until you log in and unpause ([source](https://designrevision.com/blog/supabase-pricing)) | None |
| Credit card needed | No | No | No |
| Your admin portal is | A custom page + the Sheet itself (great on your phone) | A custom page with real logins | A custom page with a password |
| Effort to set up | Low — paste one script, click Deploy | Medium — create project, run SQL, set security rules | Medium-high — needs the command line |
| Best for | A shop taking a handful of bookings a week | A shop with steady daily traffic | Someone technical |

### My recommendation for Huxley: **A. Google Sheets + Apps Script**

Not because it's the biggest, but because it's the one that will still be working in two years without you thinking about it: it never pauses, needs no credit card, the "database" is a spreadsheet you already know how to use and can open on your phone, it can email you **and** the customer automatically, and it's free without any usage cliff for a shop your size.

Supabase is the better *technology* and I'm happy to build it — but the 7-day auto-pause is a real trap for a small shop: a quiet week, then a customer tries to book and nothing happens. It can be worked around with a free uptime pinger, but that's a band-aid.

### What the admin portal will do (same in all three)

- **Login** — password-protected, nobody else can reach it.
- **Appointment list** — newest first, filter by *Pending / Confirmed / Completed / Cancelled*.
- **Today & upcoming view** — what's on your bench today, at a glance.
- **One-tap actions** — Confirm (sends the customer their confirmation + Google Maps location), Cancel, Mark the ₱1,000 reservation fee as **Paid / Deducted**.
- **Search** by name, phone, or email — for "sino 'yung tumawag kahapon?"
- **Live availability** — you can **block a slot** or **close a whole day** right from the portal, and the public calendar updates instantly. No more editing code.
- **Export to CSV/Excel** — for your records or bookkeeping.
- **Email notifications** — new booking alerts to you, confirmation to the customer.

---

## PART 3 — Which one do you want?

Tell me and I'll build it. Realistically:

- **Choose A** if you want it done fast, free, and hands-off. I'll give you a step-by-step with the exact script to paste and screenshots-in-words.
- **Choose B** if you want a proper database and expect frequent bookings. I'll write the SQL, the security rules, and the portal.
- **Choose C** if you're comfortable with a terminal, or want the most "professional" setup.

You can also start with **A now** and migrate to B or C later — the booking form and the admin interface stay the same.
