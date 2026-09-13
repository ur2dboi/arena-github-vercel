# Huxley Jewelry Creations — website

Handcrafted silver & gold jewelry · Bulacan & Quezon City, Philippines

A one-page marketing website with an appointment booking system, a Google Sheets
database and a private admin portal. No build step, no framework, no server to
maintain — plain HTML, CSS and JavaScript.

**Live:** https://huxleyjewelry.vercel.app

---

## What's in here

| Path | What it is |
|---|---|
| `index.html` | The public website — everything is in this one file (structure, styles, scripts). |
| `login.html` | The staff **sign-in page** (`/login`). Password protected, `noindex`. |
| `admin.html` | The private **dashboard** (`/admin`) — appointments, website photos, settings. `noindex`, and it turns away anyone who is not signed in. |
| `backend/Code.gs` | The backend: Google Apps Script + Google Sheets. Stores bookings, serves availability, sends emails. |
| `assets/img/` | Photos used on the site. Replace these with real product photos, keeping the filenames. |
| `assets/logo/` | Logo files: transparent lockup (web + print), star mark, favicons, social share image. |
| `vercel.json` | Vercel config: clean `/admin` URL, noindex header, long-term asset caching. |
| `_headers`, `_redirects` | The same thing for Cloudflare Pages and Netlify. |
| `tools/` | Scripts used to build the logo, icons and social image, plus the automated tests. |
| `SETUP-BACKEND.md` | Step-by-step: database, admin password, deployment. **Start here.** |
| `HOW-TO-EDIT.md` | How to change text, photos, prices, time slots, availability. |
| `DEPLOY-FREE.md` | Hosting options and what each free plan allows. |

---

## Features

**Website**
- Warm cream + metallic-gold design, custom logo treatment, mobile-first
- Collections: wedding & engagement rings, pendants, college rings, earrings, bangles, bracelets, chains
- Appointment booking: month calendar → time slots (12 NN – 6 PM) → client details → policy agreement
- Real availability — booked and blocked slots are crossed out for every visitor
- Confirmation panel with an "Add to my calendar" (.ics) download
- Facebook, phone and email contact throughout; "Ships nationwide & worldwide" messaging in the hero, the scrolling strip, the delivery answer, the search listing and the structured data

**Admin** — a sign-in page (`/login`) and the dashboard (`/admin`), username + password verified server-side
- Stats: today, upcoming, pending, confirmed, total, fees collected
- Search and filter every appointment; one-tap Confirm · Done · Cancel
- Track the ₱1,000 reservation fee: Unpaid → Paid → Deducted. **Fees collected** only counts the fees you actually marked paid — unpaid bookings stay at ₱0
- Block a slot or close a whole day — the public calendar updates instantly
- Export to CSV; auto-refreshes; works on a phone ("Add to Home Screen")
- **Website photos**: upload or link a new photo for any of the four slots (hero, wedding & engagement rings, college rings, Our Craft), or reset it
- **Settings**: change the admin username and password (stored salted + hashed)

---

## Pushing this to GitHub

If this folder is not yet connected to a remote:

```bash
git remote add origin https://github.com/YOUR-USERNAME/arena-github-vercel.git
git push -u origin main
```

If the repository already has commits (a README created by GitHub, for example),
pull first, then push:

```bash
git pull --rebase origin main
git push -u origin main
```

After that, every future change is just:

```bash
git add -A
git commit -m "describe what changed"
git push
```

### Vercel

```bash
npm i -g vercel
vercel --prod
```

Framework preset **Other**; leave build command and output directory empty — Vercel
serves the folder as-is.

Or connect the repository once and every `git push` deploys automatically:
**vercel.com → Add New → Project → Import Git Repository → `arena-github-vercel`**,
then set Framework Preset to **Other** and leave the build settings empty.

> **Licensing note:** Vercel's free **Hobby** plan is restricted to personal,
> non-commercial projects. A business site is expected to be on **Pro ($20/mo)**.
> If you want free hosting that permits commercial use, use Cloudflare Pages or
> Netlify — the same files work unchanged.

### Cloudflare Pages (recommended, free, commercial use allowed)

Dashboard → **Workers & Pages → Create → Pages → Upload assets** → upload the
contents of this repo → Deploy. `_headers` and `_redirects` are read automatically.

---

## The database

Appointments live in a Google Sheet, reached through a Google Apps Script Web App.

1. New Google Sheet → **Extensions → Apps Script** → paste `backend/Code.gs`.
2. Run `setup()` once and allow permissions.
3. **Project Settings → Script properties**: add `ADMIN_PASSWORD` (required),
   `OWNER_EMAIL`, `OWNER_PHONE`, `SHOP_MAPS`.
4. **Deploy → New deployment → Web app** · Execute as **Me** · Access **Anyone**.
5. Paste the `/exec` URL into `apiUrl` in `index.html` and `DEFAULT_URL` in **both** `login.html` and `admin.html`.

Full instructions with screenshots-in-words: **`SETUP-BACKEND.md`**.

Without the backend the site still works — the booking form emails each request instead.

---

## Tests

The booking flow and admin portal have automated tests (jsdom, no browser needed):

```bash
npm install jsdom
node tools/test_gas.js        # the Apps Script backend, run against mocked Google services
node tools/test_booking.js    # calendar, slots, validation, .ics
node tools/test_backend.js    # database flow, double-booking
node tools/test_admin_v2.js   # admin login, change password, photo management
```

---

## Notes

- Keep the Google Sheet private — anyone with edit access can change bookings.
- Back it up occasionally: Sheet → **File → Make a copy**.
- The admin password lives only in Apps Script script properties, never in this repo.
