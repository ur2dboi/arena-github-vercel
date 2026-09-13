# GO-LIVE CHECKLIST — make the live backend match this workspace

Takes ~10 minutes. You only touch **one** Google Apps Script project:
the one whose Web-app URL starts with **`AKfycbyp4…`** — that is the URL your
website calls. (The `AKfycbzURcb…` URL is a stray second deployment; ignore it
for now, delete it at the end.)

---

## Step 0 — Open the RIGHT project
1. Go to **script.google.com**
2. Open a project → **Deploy ▸ Manage deployments**
3. Read the Web app URL:
   - starts with `AKfycbyp4…` → ✅ this is the project, stay here
   - starts with `AKfycbzURcb…` → ❌ wrong project, close it, try the next
   - both URLs listed → ✅ this is the project (one project, two doors)

## Step 1 — Paste the new code
1. In that project's code editor: **Ctrl+A → Delete**
2. Paste the **entire contents of `huxley-setup.gs`** (the file presented in
   chat; also at `backend/huxley-setup.gs` in the workspace) → **Ctrl+S**

   This one file already contains:
   - your **Google Maps link** (`SHOP_MAPS`)
   - the **BPI / GCash downpayment accounts** (`PAYMENT`)
   - the **correct sheet ID** `1Yav_oBTOBX0dEgS0e2PrxIljmDMz7JoPCNyiBOOFeCM`
     → your old bookings and blocked days come back on their own
   - today's bug fixes (fee counted only when actually Paid, double-booking
     guards, date/phone corruption fixes)

## Step 2 — PUBLISH (the step everyone misses)
1. **Deploy ▸ Manage deployments**
2. Click the **✏️ pencil** on the deployment whose URL starts `AKfycbyp4…`
3. Under **Version**, pick **`New version`**
4. **Deploy** → wait for "Completed"

> ⚠️ Ctrl+S alone publishes NOTHING — the deployment keeps running the old
> version until you do this. And do NOT click "New deployment" (that only
> creates yet another URL).

## Step 3 — Tidy script properties (optional but recommended)
**Project Settings (gear) ▸ Script properties:**
- **Delete** `ADMIN_PASSWORD` (login already uses `ADMIN_HASH` + `ADMIN_SALT`;
  the plaintext copy is only a risk)
- If a `SHEET_ID` property exists and points at some other sheet, **delete it**
  (the file's CONFIG now carries the right one). If you prefer keeping a
  property, set it to `1Yav_oBTOBX0dEgS0e2PrxIljmDMz7JoPCNyiBOOFeCM`
- Save. Property changes take effect immediately — no redeploy needed.

## Step 4 — Verify
1. Open your dashboard **/admin**: the Sep 14 / Sep 15 bookings and the blocked
   days (Sep 27–28, Nov 12) should be back, and **Fees collected** must read
   ₱0 while the only fee is Unpaid/Cancelled.
2. Make a dummy booking on a far-ahead date. The client email must now contain:
   *"To secure your slot, please send the ₱1,000 reservation fee (downpayment)…"*
   with **BPI — Arnold Borlongan — 0759303628** and **GCash — Karen Borlongan —
   09764637003**, plus the 📍 Google Maps link.
3. Cancel or delete the dummy row in /admin.
4. Tell the agent — they will probe the backend from the sandbox and confirm.

---

## If bookings still don't reappear after Step 2
1. In the editor, run **`status()`** once (Run ▸ status ▸ approve permissions).
   It prints the spreadsheet name + ID the script is actually using.
2. If it names the wrong (empty) sheet: **Project Settings ▸ Script properties
   ▸ add `SHEET_ID` = `1Yav_oBTOBX0dEgS0e2PrxIljmDMz7JoPCNyiBOOFeCM`** ▸ Save.
   Properties beat the file, and the change is instant — no redeploy needed.

## After everything works (cleanup, 2 minutes)
- **Deploy ▸ Manage deployments ▸  delete** the stray `AKfycbzURcb…`
  deployment, so only one door remains.
- In Drive, rename or delete the empty duplicate "Huxley Bookings" sheet so the
  name can never confuse the script again.
