# Huxley Jewelry Creations — website guide

Your site is one file: **`index.html`** (images live in `assets/img/`).
Open `index.html` in any browser to view it. Upload `index.html` + the `assets` folder together to any host (Hostinger, GoDaddy, Netlify, GitHub Pages, etc.).

---

## 1. Edit your business details — one place only

Open `index.html`, scroll to the bottom, and look for the `SITE` block inside `<script>`:

```js
const SITE = {
  phoneDisplay : "0976 463 7003",
  phoneRaw     : "+639764637003",
  email        : "huxleyjewelrycreations@gmail.com",
  facebook     : "https://www.facebook.com/profile.php?id=61555388537341",
  address      : "Bulacan & Quezon City",
  hours        : "By appointment — message us anytime"
};
```

Change a value and **every** phone number, email link, address and hours text on the page updates automatically — header, buttons, contact card, footer.

> ⚠️ **Please confirm the email address.** You only gave me the phone number, so I used
> `huxleyjewelrycreations@gmail.com` as a placeholder. Replace it with your real email (or create that one).

---

## 2. Swap in your real photos

Replace the files in `assets/img/` — keep the same file names and the site picks them up with no code changes:

| File | Used for |
|---|---|
| `hero.jpg` | Big image at the top (best size: 1400 × 768) |
| `rings.jpg` | Wedding & engagement rings feature |
| `college-ring.jpg` | College rings feature |
| `pendant.jpg` `earrings.jpg` `bangles.jpg` `bracelets.jpg` `chains.jpg` | The six collection cards |
| `workshop.jpg` | "Our Craft" photo **and** the Custom & Repairs card |

Wide/landscape photos (about 1400 × 950 or larger) look best. Your real photos of finished pieces will always beat stock imagery — especially for rings.

---

## 3. Change wording

All text is plain HTML in `index.html`. Section order:

1. Header + menu
2. Hero
3. Scrolling gold strip
4. Collections (wedding/engagement + college rings featured, then 6 cards)
5. Our Craft
6. How to Order (4 steps)
7. Good to Know (metals & stones, sizing, engraving)
8. Start an Order (contact card + form)
9. FAQ
10. CTA band + footer

Search for a phrase you want to change, edit the text, save.

---

## 4. The order form

The form has no server — it composes an email with all the customer's answers and opens their mail app addressed to your email. It works offline and needs no setup.

**Want messages to land directly in an inbox or Messenger instead?** Good free options:
- **Formspree** (formspree.io) — paste one line into the `<form>` tag and submissions arrive by email.
- **Google Forms / Tally** — link out to your existing form.
- **Facebook Messenger** — change the submit button to a `m.me/yourpage` link, since most of your customers are already on your page.

Just tell me which one you prefer and I'll wire it up.

---

## 5. Fonts & colours

- Headings: **Cormorant Garamond** (elegant serif). Body/UI: **Jost** (clean geometric sans).
  They load from Google Fonts. Without internet the page falls back to fine system fonts — nothing breaks.
- To change colours, edit the `:root` block at the top of the `<style>` section:
  - `--cream` `#FBF6EA` / `--cream-2` `#F6EEDC` — page backgrounds
  - `--beige` `#EFE3CB` / `--beige-2` `#E7D8BA` — section bands
  - `--gold` `#A9761C`, `--gold-2` `#C79A3C` — text accents and lines
  - `--metal` — the metallic gold gradient used on the logo, headings and buttons

---

## 6. Photos — change them from the admin portal

You do **not** need to edit any file to change the photos. Once the backend is connected:

1. Open **`your-site.com/login`** and sign in — you land on the dashboard at `/admin`
2. Go to the **Website photos** tab
3. Find the slot (Homepage hero, Wedding & engagement rings, Pendants, …)
4. Press **Upload photo** and pick an image — or paste a link and press **Save**
5. Refresh the website — it is live

Photos are stored in Google Drive ("Huxley Website Photos") and the website loads them automatically. **Reset** puts the original design photo back.

If you ever want to change the *built-in* photos instead (the ones shown before any upload), replace the files in `assets/img/` keeping the same names — the site falls back to them whenever the backend is unreachable.

---

## 7. Logo files

Your logo image has been cleaned up into a transparent version, so it sits perfectly on the cream background with no cream box around it:

| File | Use it for |
|---|---|
| `assets/img/logo-lockup-v2.png` | **The website** (header + footer). Gold lockup, transparent background, no halo. |
| `assets/logo/huxley-logo-transparent.png` | High-res transparent lockup — putting the logo on printed bags, boxes, cards, or on a dark background |
| `assets/logo/huxley-logo-original.jpg` | Your original upload, kept untouched |
| `assets/logo/og-image.jpg` | 1200×630 image shown when the site is shared on Facebook or Messenger |
| `assets/logo/favicon-32.png` / `-64` / `-512` | Browser tab icons |
| `assets/logo/apple-touch-icon.png` | Icon when the site is saved to a phone home screen |
| `assets/logo/huxley-star.png` | Just the star mark, transparent — use for watermarks on product photos |

The star from your logo is also used as the accent icon throughout the site (dividers, bullets, the scrolling strip), so everything matches.

To change the logo later, drop a new transparent PNG in at `assets/img/logo-lockup-v2.png`. If the picture itself changes, bump the `-v2` in the name **and** in the pages that point at it — images are cached for a year, so a new filename is what makes browsers pick it up.

---

## 8. The appointment booking system

Clients pick a date on the calendar, pick a time slot, fill in their details, read the Appointment Policy, tick the box, and send. The request arrives in your inbox as an email, and you reply to confirm (sending the Google Maps location with the confirmation).

### Where the settings live

Search `index.html` for **`const APPT = {`** — everything about the booking system is in that one block.
**If `apiUrl` is empty the form emails you each request.** Paste your Apps Script `/exec` URL there (see `SETUP-BACKEND.md`) and the same form saves into your Google Sheet instead, with live availability and the admin portal:

```js
const APPT = {
  fee           : 1000,
  apiUrl        : '',       // ← your Apps Script /exec URL switches on the database
  refreshSec    : 90,       // how often the public calendar re-checks the database
  slots         : ['12:00 NN','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM'],
  startHours    : [12,13,14,15,16,17,18],   // same 7 times, 24-hour, same order
  leadHours     : 3,        // hide slots starting within this many hours
  monthsAhead   : 3,        // how far ahead clients may book
  maxPersons    : 3,
  closed        : [],       // whole days off, e.g. ['2026-12-24','2026-12-25']
  closedWeekdays: [],       // e.g. [0] to close every Sunday
  booked        : {         // appointments you have already confirmed
  }
};
```

### Marking a slot as taken

When someone books by phone, Messenger, or walk-in, block that slot so nobody else can pick it. Add a line inside `booked`:

```js
  booked        : {
    '2026-09-20': ['1:00 PM','4:00 PM'],
    '2026-09-21': ['12:00 NN'],
    '2026-10-04': ['2:00 PM','3:00 PM','6:00 PM']
  }
```

Format: `'YYYY-MM-DD': ['time', 'time']`. Times must match `slots` exactly (`'12:00 NN'`, `'1:00 PM'` … `'6:00 PM'`).
Those slots then show **struck through / Reserved** and can't be picked.

### Closing a day off

- One-off holiday: add the date to `closed` → `closed : ['2026-12-24','2026-12-25']`
- Every week (say you're closed Sundays): `closedWeekdays : [0]` (0 = Sunday, 6 = Saturday)

Closed days appear greyed out and can't be chosen.

### Other settings

| What you want | Change |
|---|---|
| Different reservation fee | `fee` (also edit the two places the ₱1,000 is written in the policy text — search for `1,000`) |
| Only allow booking 1 month ahead | `monthsAhead : 1` |
| Allow same-day bookings up to 2 hours before | `leadHours : 2` |
| Add or remove a time slot | Edit `slots` **and** `startHours` (24-hour values, same order) |
| More than 3 persons | `maxPersons` — then also edit the dropdown options in the form (`<select id="a-pax">`) and the label text |

### Important: how availability works

This is a **request-and-confirm** system that needs no server and no monthly fee:

- Availability shown to a client = your 7 slots **minus** anything in `booked`, minus anything they've already booked on their own device, minus slots less than `leadHours` away, minus closed days.
- When a client sends a request, that slot is marked reserved **on their device** so they can't double-book — but a *different* client could still request the same slot on a different device before you reply. **Your confirmation email settles it**, which is exactly how the reservation-fee policy works anyway.
- **If you want live, true availability across all customers** (slot disappears the moment anyone books), that needs a small server or a booking service — tell me and I'll set it up. Google Calendar's free "Appointment schedule" feature is another option that gives real availability plus automatic confirmations.

### With the database switched on

Once `apiUrl` is set (see **SETUP-BACKEND.md**), everything below still applies, plus:

- appointments are **saved in your Google Sheet** and the slot closes for everyone instantly
- you manage it all from the dashboard at **`/admin`** — confirm, cancel, mark the ₱1,000 fee, block slots, close days, export CSV
- **Confirm** automatically emails the client your Google Maps link (set `SHOP_MAPS` in the script properties)
- if the database is ever unreachable, the form **falls back to emailing you** so a booking is never lost

### What the client receives

After sending, they see a confirmation summary of their appointment, a button to **add it to their calendar** (downloads an .ics file), a reminder about the ₱1,000 reservation fee, and your note that the Google Maps location comes with the confirmation.
