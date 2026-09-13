/**
 * ============================================================
 *  HUXLEY JEWELRY CREATIONS — booking + content backend
 *  Database : Google Sheets (this spreadsheet)
 *  Photos   : Google Drive  (served straight to the website)
 *  API      : Apps Script Web App
 *  Admin    : admin.html on your website
 *  Cost     : ₱0 — no credit card, never auto-pauses.
 * ============================================================
 *
 *  FIRST-TIME SETUP
 *  1. Google Sheet "Huxley Bookings" → Extensions ▸ Apps Script ▸ paste this file.
 *  2. Run ▸ setup()   (approve the permissions prompt)
 *  3. Project Settings ▸ Script properties ▸ add:
 *        ADMIN_USER      <your admin username>
 *        ADMIN_PASSWORD  <your admin password>
 *        OWNER_EMAIL     karenrborlongan@gmail.com
 *        OWNER_PHONE     0976 463 7003
 *        SHOP_MAPS       <your Google Maps link>
 *     IMPORTANT: type the credentials only in Script properties. Never paste
 *     them into Code.gs or admin.html — this repository is public, and anything
 *     in a website file can be read with Ctrl+U. Once you sign in, the password
 *     is stored salted + hashed and the plaintext property is deleted.
 *  4. Deploy ▸ New deployment ▸ Web app ▸ Execute as: Me ▸ Access: Anyone
 *     Copy the /exec URL into index.html (apiUrl) and admin.html (DEFAULT_URL).
 *
 *  CHANGING THE PASSWORD: sign in to admin.html ▸ Settings.
 *  It is stored salted and hashed (SHA-256); your plain password is deleted.
 * ============================================================
 */

/**
 * ────────────────────────────────────────────────────────────
 *  CONFIGURE HERE. Fill in the values below and you are done —
 *  there is no need to touch Project Settings.
 *  Script properties (if you set any) always win over this block,
 *  so you can move a value out of this file later without breaking it.
 * ────────────────────────────────────────────────────────────
 */
var CONFIG = {
  SHEET_ID       : '',                          // the code from your sheet URL: /spreadsheets/d/<THIS>/edit
  SHEET_NAME     : 'Huxley Bookings',           // used only if SHEET_ID is blank
  ADMIN_USER     : 'adminhuxley',
  ADMIN_PASSWORD : '',                          // your admin password
  OWNER_EMAIL    : 'karenrborlongan@gmail.com',   // where new bookings are emailed
  OWNER_PHONE    : '0976 463 7003',             // shown in the client's email
  SHOP_MAPS      : ''                           // sent to the client when you confirm
};

var TZ            = Session.getScriptTimeZone();
var SHEET_APPTS   = 'Appointments';
var SHEET_BLOCK   = 'Blocks';
var SHEET_LOG     = 'Activity log';
var SHEET_PHOTOS  = 'Photos';
var DRIVE_FOLDER  = 'Huxley Website Photos';

var HEADERS = ['ID','Submitted','Date','Time','Client name','Contact number','Email','Person/s',
               'Purpose / notes','Status','Reservation fee','Confirmed at','Notes from shop'];
var BLOCK_HEADERS  = ['Date','Time','Reason','Added'];
var LOG_HEADERS    = ['When','By','Action','Details'];
var PHOTO_HEADERS  = ['Slot','Drive file ID','URL','Updated'];

var SLOTS = ['12:00 NN','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM'];

/* the photo slots the website understands — keep in step with index.html */
var PHOTO_SLOTS = ['hero','rings','college','workshop'];
var MAX_PHOTO_BYTES = 6 * 1024 * 1024;      // 6 MB, after the browser has resized it

var DEFAULT_USER = 'adminhuxley';

/* ============================================================
   SETUP
   ============================================================ */
function setup() {
  var ss = ss_();
  ss.setSpreadsheetTimeZone(TZ);
  var a = tab(ss, SHEET_APPTS, HEADERS);
  var b = tab(ss, SHEET_BLOCK, BLOCK_HEADERS);
  tab(ss, SHEET_LOG, LOG_HEADERS);
  tab(ss, SHEET_PHOTOS, PHOTO_HEADERS);
  ['B','C','D'].forEach(function (c) { a.getRange(c + '2:' + c + '1000').setNumberFormat('@'); });
  ['A','B'].forEach(function (c) { b.getRange(c + '2:' + c + '1000').setNumberFormat('@'); });

  // make the Drive folder for website photos, and remember it
  if (!prop_('PHOTO_FOLDER')) {
    var it = DriveApp.getFoldersByName(DRIVE_FOLDER);
    var f = it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_FOLDER);
    setProp_('PHOTO_FOLDER', f.getId());
  }
  if (!prop_('ADMIN_USER')) setProp_('ADMIN_USER', DEFAULT_USER);

  log_('setup', 'Ready');
  return 'Setup complete on spreadsheet: ' + (ss.getName ? '"' + ss.getName() + '"' : ss.getId()) + '\n\n' +
    'Admin username: ' + (prop_('ADMIN_USER') || DEFAULT_USER) + '\n' +
    'Admin password: ' + (prop_('ADMIN_PASSWORD') ? 'set' :
        'NOT SET — you cannot log in until you add ADMIN_PASSWORD. Use Project Settings ▸ ' +
        'Script properties (takes effect immediately, no redeploy) or the CONFIG block above.') + '\n' +
      'Spreadsheet found: ' + (prop_('SHEET_ID') ? 'by SHEET_ID' : 'by name ("' + (prop_('SHEET_NAME') || 'Huxley Bookings') + '")') + '\n\n' +
    'Now: Deploy ▸ New deployment ▸ Web app.';
}

/**
 * Where the data lives.
 *  • Bound script (opened from Sheet ▸ Extensions ▸ Apps Script): found automatically.
 *  • Standalone script (created at script.google.com): add a Script property
 *    SHEET_ID with the long id from your sheet's URL,
 *    docs.google.com/spreadsheets/d/THIS_PART_HERE/edit
 */
function ss_() {
  // 1. an explicit SHEET_ID (Script properties win over the CONFIG block)
  var id = prop_('SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(String(id).trim()); }
    catch (e) {
      throw new Error('SHEET_ID is set to "' + id + '" but that spreadsheet could not be opened. ' +
        'Copy it again from your sheet address bar: docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit');
    }
  }

  // 2. a script opened from inside the sheet finds it automatically
  var active = SpreadsheetApp.getActive();   // the only direct call — everything else uses ss_()
  if (active) return active;

  // 3. last resort: look in Drive for a spreadsheet with the expected name
  var byName = driveFind_();
  if (byName) return byName;

  throw new Error('This backend cannot find your Google Sheet. Do ONE of these, then try again:\n' +
    'A) Open your sheet ▸ Extensions ▸ Apps Script, paste this file there and use that deployment; or\n' +
    'B) In this project: Project Settings ▸ Script properties ▸ add SHEET_ID with the code from your ' +
    'sheet address bar (docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit); or\n' +
    'C) Name your spreadsheet "' + (prop_('SHEET_NAME') || 'Huxley Bookings') + '" exactly, and make sure ' +
    'this project can reach Drive.');
}

/** Find the booking spreadsheet by name — used only when the other methods fail. */
function driveFind_() {
  var wanted = prop_('SHEET_NAME') || 'Huxley Bookings';
  try {
    var it = DriveApp.getFilesByName(wanted);
    while (it.hasNext()) {
      var f = it.next();
      if (typeof MimeType !== 'undefined' && f.getMimeType && f.getMimeType() !== MimeType.GOOGLE_SHEETS) continue;
      return SpreadsheetApp.openById(f.getId());
    }
  } catch (e) {}
  return null;
}

/**
 * Run this from the editor to see exactly what the backend can see.
 * View ▸ Logs (or the Execution log) shows the result.
 */
function diagnose() {
  var lines = [];
  lines.push('Script timezone: ' + TZ);
  lines.push('SHEET_ID property: ' + (prop_('SHEET_ID') ? 'set' : 'NOT set'));
  lines.push('Bound spreadsheet: ' + (SpreadsheetApp.getActive() ? 'yes' : 'no'));
  lines.push('Found by name ("' + (prop_('SHEET_NAME') || 'Huxley Bookings') + '"): ' + (driveFind_() ? 'yes' : 'no'));
  try {
    var ss = ss_();
    lines.push('Using spreadsheet: ' + ss.getName() + ' (' + ss.getId() + ')');
    var names = [];
    eachSheetName_(ss, function (n) { names.push(n); });
    lines.push('Tabs: ' + names.join(', '));
  } catch (e) {
    lines.push('COULD NOT RESOLVE SPREADSHEET: ' + e.message);
  }
  lines.push('ADMIN_USER: ' + (prop_('ADMIN_USER') || '(not set — default adminhuxley)'));
  lines.push('Admin password: ' + ((prop_('ADMIN_PASSWORD') || prop_('ADMIN_HASH')) ? 'set' : 'NOT SET'));
  lines.push('OWNER_EMAIL: ' + (prop_('OWNER_EMAIL') || '(not set)'));
  lines.push('OWNER_PHONE: ' + (prop_('OWNER_PHONE') || '(not set)'));
  lines.push('SHOP_MAPS: ' + (prop_('SHOP_MAPS') ? 'set' : '(not set)'));
  lines.push('Photo folder: ' + (prop_('PHOTO_FOLDER') || '(not created yet)'));
  var out = lines.join('\n');
  Logger.log(out);
  return out;
}

function eachSheetName_(ss, fn) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) fn(sheets[i].getName());
}

function tab(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#EFE3CB');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ============================================================
   HTTP API
   ============================================================ */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'availability') return json_(availability());
    if (p.action === 'photos')       return json_({ ok: true, photos: photosPublic_() });
    if (p.action === 'ping')         return json_({ ok: true, when: new Date().toISOString() });
    return json_({ ok: true, service: 'Huxley Jewelry Creations backend' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  try {
    if (body.action === 'book')  return json_(book_(body));
    if (body.action === 'admin') return json_(admin_(body));
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   CREDENTIALS — salted SHA-256, stored in Script properties only
   ============================================================ */
function hex_(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] < 0 ? bytes[i] + 256 : bytes[i]).toString(16);
    out += (b.length === 1 ? '0' : '') + b;
  }
  return out;
}

function hash_(salt, user, pass) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    salt + '|' + String(user).toLowerCase() + '|' + pass, Utilities.Charset.UTF_8));
}

function saveCreds_(user, pass) {
  var salt = Utilities.getUuid() + Utilities.getUuid();
  setProp_('ADMIN_SALT', salt);
  setProp_('ADMIN_HASH', hash_(salt, user, pass));
  setProp_('ADMIN_USER', user);
  // the plain password is no longer needed once it is hashed
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('ADMIN_PASSWORD')) props.deleteProperty('ADMIN_PASSWORD');
}

function verify_(user, pass) {
  if (!user || !pass) return false;
  var expectUser = prop_('ADMIN_USER') || DEFAULT_USER;
  if (String(user).trim().toLowerCase() !== String(expectUser).toLowerCase()) return false;

  var salt = prop_('ADMIN_SALT'), stored = prop_('ADMIN_HASH');
  if (salt && stored) return hash_(salt, expectUser, pass) === stored;

  // first run: compare against the plain property, then upgrade to a hash
  var plain = prop_('ADMIN_PASSWORD');
  if (!plain) return false;
  if (pass === plain) { saveCreds_(expectUser, pass); log_('system', 'Password upgraded to hashed storage'); return true; }
  return false;
}

/* ============================================================
   AVAILABILITY  (public)
   ============================================================ */
function availability() {
  var ss = ss_();
  var booked = {}, closed = [];

  each_(ss, SHEET_APPTS, function (r) {
    if (String(r[9] || 'Pending') === 'Cancelled') return;
    var d = ymd_(r[2]), t = slot_(r[3]);
    if (!d || !t) return;
    booked[d] = booked[d] || [];
    if (booked[d].indexOf(t) < 0) booked[d].push(t);
  });

  each_(ss, SHEET_BLOCK, function (r) {
    var d = ymd_(r[0]), t = slot_(r[1]) || 'ALL';
    if (!d) return;
    if (t === 'ALL') { closed.push(d); return; }
    booked[d] = booked[d] || [];
    if (booked[d].indexOf(t) < 0) booked[d].push(t);
  });

  return { ok: true, slots: SLOTS, booked: booked, closed: closed, updated: new Date().toISOString() };
}

/* ============================================================
   BOOKING  (public)
   ============================================================ */
function book_(b) {
  var need = ['date','time','name','phone','email'];
  for (var i = 0; i < need.length; i++) {
    if (!b[need[i]]) return { ok: false, error: 'Missing ' + need[i] };
  }
  if (SLOTS.indexOf(b.time) < 0)          return { ok: false, error: 'Unknown time slot' };
  if (b.agree !== true)                   return { ok: false, error: 'Policy not accepted' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return { ok: false, error: 'Bad date' };

  var pax = Math.min(3, Math.max(1, parseInt(b.pax, 10) || 1));
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return { ok: false, error: 'Busy, please try again' }; }

  try {
    var av = availability();
    if (av.closed.indexOf(b.date) >= 0)                  return { ok: false, error: 'That day is closed' };
    if ((av.booked[b.date] || []).indexOf(b.time) >= 0)  return { ok: false, error: 'Slot just taken', taken: true };

    var id = 'HX-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' +
             Math.random().toString(36).slice(2, 6).toUpperCase();
    var sh = sheet_(SHEET_APPTS);
      var row = sh.getLastRow() + 1;
      var dStr = ymd_(b.date), tStr = slot_(b.time), pStr = phoneText_(b.phone);
      sh.getRange(row, 2, 1, 3).setNumberFormat('@');   // phone, date, time: keep exactly as typed
      sh.getRange(row, 1, 1, 13).setValues(
        [[id, new Date(), dStr, tStr, b.name, pStr, b.email, pax, b.notes || '', 'Pending', 'Unpaid', '', '']]);
    log_('website', 'New booking ' + id);
    notify_(id, b, pax);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function notify_(id, b, pax) {
  var owner = prop_('OWNER_EMAIL') || Session.getEffectiveUser().getEmail();
  var nice = nice_(ymd_(b.date));
    var at = slot_(b.time);
    var tel = phoneText_(b.phone);
  try {
    MailApp.sendEmail(owner, 'New appointment — ' + nice + ', ' + at + ' (' + b.name + ')', [
      'Reference:   ' + id, 'Date:        ' + nice, 'Time:        ' + b.time,
      'Client:      ' + b.name, 'Contact:     ' + tel, 'Email:       ' + b.email,
      'Person/s:    ' + pax + ' (max 3)', '', 'Purpose / notes:', b.notes || '—', '',
      'Policy acknowledged, ₱1,000 reservation fee understood.', '',
      'Manage this appointment in your admin portal.'
    ].join('\n'));
  } catch (e) {}

  try {
    MailApp.sendEmail(b.email, 'We received your appointment request — Huxley Jewelry Creations', [
      'Hi ' + String(b.name).split(' ')[0] + ',', '',
      'Thank you for booking with Huxley Jewelry Creations. We have received your appointment request:', '',
      'Reference:   ' + id, 'Date:        ' + nice, 'Time:        ' + at, 'Person/s:    ' + pax, '',
      'We will reply to confirm your slot. Your Google Maps location will be provided together with your appointment confirmation.', '',
      'Reminder: a ₱1,000 reservation fee secures your appointment and is fully deducted from the total cost of your customized wedding ring should you proceed with the order. The fee is non-refundable for cancellation, rescheduling, non-appearance, or change of mind.', '',
      'Maraming salamat!', 'Huxley Jewelry Creations', prop_('OWNER_PHONE') || '0976 463 7003'
    ].join('\n'));
  } catch (e) {}
}

/* ============================================================
   ADMIN API
   ============================================================ */
function admin_(b) {
  var user = String(b.user || '').trim();

  if (!prop_('ADMIN_PASSWORD') && !prop_('ADMIN_HASH')) {
    return { ok: false, error: 'No admin password is set yet. Add ADMIN_PASSWORD in Project Settings ▸ Script properties ' +
      '(it takes effect straight away, no redeploy) — or type it into the CONFIG block at the top of this file.' };
  }
  if (!verify_(user, String(b.password || ''))) {
    Utilities.sleep(1200);                       // slow down guessing
    log_('security', 'Failed sign-in for "' + user + '"');
    return { ok: false, error: 'Wrong username or password' };
  }

  switch (b.op) {
    case 'list': {
      var appts = list_();
      return { ok: true, appointments: appts, blocks: blocks_(), stats: stats_(appts), photos: photos_(), user: prop_('ADMIN_USER') || DEFAULT_USER };
    }
    case 'status':    return setStatus_(b.id, b.status);
    case 'fee':       return setFee_(b.id, b.fee);
    case 'shopNote':  return setShopNote_(b.id, b.note);
    case 'block':     return block_(b.date, b.time || 'ALL', b.reason || '');
    case 'unblock':   return unblock_(b.date, b.time || 'ALL');
    case 'delete':    return del_(b.id);
    case 'changePass':return changePass_(b);
    case 'savePhoto': return savePhoto_(b);
    case 'setPhotoUrl': return setPhotoUrl_(b);
    case 'resetPhoto':return resetPhoto_(b);
    default:          return { ok: false, error: 'Unknown operation' };
  }
}

/* ---------- change username / password ---------- */
function changePass_(b) {
  var cur = prop_('ADMIN_USER') || DEFAULT_USER;
  var newUser = String(b.newUser || '').trim() || cur;
  var newPass = String(b.newPassword || '');

  if (!/^[A-Za-z0-9_.@-]{4,40}$/.test(newUser)) {
    return { ok: false, error: 'Username must be 4–40 characters: letters, numbers, . _ - @ only.' };
  }
  if (b.newPassword && newPass.length < 6) {
    return { ok: false, error: 'New password must be at least 6 characters.' };
  }
  if (newPass && newPass !== String(b.confirmPassword || '')) {
    return { ok: false, error: 'The two new passwords do not match.' };
  }
  if (newUser === cur && !newPass) {
    return { ok: false, error: 'Nothing to change.' };
  }

  saveCreds_(newUser, newPass || b.password);
  log_('admin', 'Login updated (username "' + newUser + '", password ' + (newPass ? 'changed' : 'unchanged') + ')');
  return { ok: true, user: newUser, message: 'Saved. Use your new details the next time you sign in.' };
}

/* ============================================================
   APPOINTMENTS
   ============================================================ */
function list_() {
  var out = [];
  each_(ss_(), SHEET_APPTS, function (r, i) {
    out.push({
      row: i, id: r[0],
      submitted: r[1] ? Utilities.formatDate(new Date(r[1]), TZ, 'yyyy-MM-dd HH:mm') : '',
      date: ymd_(r[2]), time: slot_(r[3]), name: r[4], phone: phoneText_(r[5]), email: r[6], pax: r[7],
      notes: r[8], status: r[9] || 'Pending', fee: feeState_(r[10]),
      confirmedAt: r[11] ? Utilities.formatDate(new Date(r[11]), TZ, 'yyyy-MM-dd HH:mm') : '',
      shopNote: r[12] || ''
    });
  });
  return out;
}

function blocks_() {
  var out = [];
  each_(ss_(), SHEET_BLOCK, function (r) {
    out.push({ date: ymd_(r[0]), time: slot_(r[1]) || 'ALL', reason: r[2] || '' });
  });
  return out;
}

/* The reservation fee. Only a fee the shop explicitly marked Paid — or
   Deducted, once it has been applied to the ring order — is money collected.
   A booking that still says "Unpaid" must never be counted. Never test the raw
   cell with /Paid/i: that also matches "Unpaid". */
var FEE_AMOUNT = 1000;

function feeState_(fee) {
  var f = String(fee == null ? '' : fee).trim().toLowerCase();
  if (f === 'paid')     return 'Paid';
  if (f === 'deducted') return 'Deducted';
  return 'Unpaid';
}

function feeCollected_(fee) {
  return feeState_(fee) !== 'Unpaid';
}

/* Counts the appointments it is handed, so one dashboard load reads the
   Appointments tab once instead of twice - the second read was pure latency. */
function stats_(appts) {
  var a = appts || list_();
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var s = { total: a.length, pending: 0, confirmed: 0, cancelled: 0, today: 0, upcoming: 0, revenue: 0 };
  a.forEach(function (x) {
    if (x.status === 'Pending')   s.pending++;
    if (x.status === 'Confirmed') s.confirmed++;
    if (x.status === 'Cancelled') s.cancelled++;
    if (x.date === today && x.status !== 'Cancelled') s.today++;
    if (x.date >= today && x.status === 'Confirmed') s.upcoming++;
    if (feeCollected_(x.fee)) s.revenue += FEE_AMOUNT;
  });
  return s;
}

function rowOf_(id) {
  var found = -1;
  each_(ss_(), SHEET_APPTS, function (r, i) { if (r[0] === id) found = i; });
  return found;
}

function setStatus_(id, status) {
  var sh = sheet_(SHEET_APPTS);
  var row = rowOf_(id);
  if (row < 0) return { ok: false, error: 'Not found' };
  sh.getRange(row, 10).setValue(status);
  sh.getRange(row, 12).setValue(new Date());
  if (status === 'Confirmed') {
    var r = sh.getRange(row, 1, 1, 13).getValues()[0];
    try {
      MailApp.sendEmail(r[6], 'Your appointment is confirmed — Huxley Jewelry Creations',
        'Hi ' + String(r[4]).split(' ')[0] + ',\n\n' +
        'Your appointment is confirmed.\n\n' +
        'Reference:  ' + r[0] + '\n' +
        'Date:       ' + nice_(r[2]) + '\n' +
        'Time:       ' + r[3] + '\n' +
        'Person/s:   ' + r[7] + '\n\n' +
        '📍 Google Maps location: ' + (prop_('SHOP_MAPS') || '(add SHOP_MAPS in Script properties)') + '\n\n' +
        'Please arrive on time — your slot is reserved exclusively for you.\n\n' +
        'See you soon,\nHuxley Jewelry Creations');
    } catch (e) {}
  }
  log_('admin', 'Status ' + id + ' → ' + status);
  var appts = list_();
  return { ok: true, appointments: appts, stats: stats_(appts) };
}

function setFee_(id, fee) {
  var row = rowOf_(id);
  if (row < 0) return { ok: false, error: 'Not found' };
  var want  = String(fee == null ? '' : fee).trim();
  var canon = feeState_(want);
  if (want.toLowerCase() !== canon.toLowerCase()) {
    return { ok: false, error: 'Unknown reservation fee: ' + want };
  }
  sheet_(SHEET_APPTS).getRange(row, 11).setValue(canon);
  log_('admin', 'Fee ' + id + ' → ' + canon);
  var appts = list_();
  return { ok: true, appointments: appts, stats: stats_(appts) };
}

function setShopNote_(id, note) {
  var row = rowOf_(id);
  if (row < 0) return { ok: false, error: 'Not found' };
  sheet_(SHEET_APPTS).getRange(row, 13).setValue(note || '');
  return { ok: true, appointments: list_() };
}

function del_(id) {
  var row = rowOf_(id);
  if (row < 0) return { ok: false, error: 'Not found' };
  sheet_(SHEET_APPTS).deleteRow(row);
  log_('admin', 'Deleted ' + id);
  var appts = list_();
  return { ok: true, appointments: appts, stats: stats_(appts) };
}

/* Sheets hands the date column back as a real Date, so never compare the cell
   to the 'yyyy-mm-dd' string the portal sent - normalise both sides first, or
   the block can never be found again (it silently refused to unblock). */
function block_(date, time, reason) {
  var sh = sheet_(SHEET_BLOCK);
  var want = ymd_(date);
  each_(ss_(), SHEET_BLOCK, function (r, i) {
    if (ymd_(r[0]) === want && (slot_(r[1]) || 'ALL') === time) sh.deleteRow(i);
  });
  sh.appendRow([want, time, reason, new Date()]);
  log_('admin', 'Blocked ' + want + ' ' + time);
  var appts = list_();
  return { ok: true, blocks: blocks_(), appointments: appts, stats: stats_(appts) };
}

function unblock_(date, time) {
  var sh = sheet_(SHEET_BLOCK);
  var want = ymd_(date);
  var removed = 0;
  for (var i = sh.getLastRow(); i >= 2; i--) {
    var r = sh.getRange(i, 1, 1, 3).getValues()[0];
    if (ymd_(r[0]) === want && (slot_(r[1]) || 'ALL') === time) { sh.deleteRow(i); removed++; }
  }
  log_('admin', 'Unblocked ' + want + ' ' + time + ' (' + removed + ')');
  var appts = list_();
  return { ok: true, removed: removed, blocks: blocks_(), appointments: appts, stats: stats_(appts) };
}

/* ============================================================
   WEBSITE PHOTOS
   ============================================================ */
function photos_() {
  var out = {};
  each_(ss_(), SHEET_PHOTOS, function (r) {
    if (!r[0]) return;
    out[r[0]] = { id: r[1] || '', url: r[2] || '', updated: r[3] ? String(r[3]) : '' };
  });
  return out;
}

/** only the public URLs — no Drive file ids, nothing private */
function photosPublic_() {
  var all = photos_(), pub = {};
  for (var k in all) {
    if (all[k].url) pub[k] = all[k].url;
  }
  return pub;
}

function folder_() {
  var id = prop_('PHOTO_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(DRIVE_FOLDER);
  var f = it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_FOLDER);
  setProp_('PHOTO_FOLDER', f.getId());
  return f;
}

function savePhoto_(b) {
  var slot = String(b.slot || '');
  if (PHOTO_SLOTS.indexOf(slot) < 0) return { ok: false, error: 'Unknown photo slot: ' + slot };

  var dataUrl = String(b.dataUrl || '');
  var m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!m) return { ok: false, error: 'That file could not be read as an image. Try a JPG or PNG.' };

  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > MAX_PHOTO_BYTES) {
    return { ok: false, error: 'That image is ' + Math.round(bytes.length / 1048576) + ' MB — please use one under 6 MB.' };
  }

  var ext = m[1].indexOf('png') >= 0 ? 'png' : 'jpg';
  var name = 'huxley-' + slot + '-' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmmss') + '.' + ext;

  var file = folder_().createFile(Utilities.newBlob(bytes, m[1], name));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}

  var url = 'https://lh3.googleusercontent.com/d/' + file.getId();
  var previous = photos_()[slot];
  if (previous && previous.id) { try { DriveApp.getFileById(previous.id).setTrashed(true); } catch (e) {} }

  store_(slot, file.getId(), url);
  log_('admin', 'Photo updated: ' + slot);
  return { ok: true, photos: photos_(), slot: slot, url: url, message: 'Photo updated. Refresh the website to see it.' };
}

function setPhotoUrl_(b) {
  var slot = String(b.slot || '');
  if (PHOTO_SLOTS.indexOf(slot) < 0) return { ok: false, error: 'Unknown photo slot: ' + slot };
  var url = String(b.url || '').trim();
  if (url && !/^https:\/\//i.test(url)) return { ok: false, error: 'Please paste a link that starts with https://' };
  var previous = photos_()[slot];
  if (!url && previous && previous.id) { try { DriveApp.getFileById(previous.id).setTrashed(true); } catch (e) {} }
  store_(slot, url ? (previous ? previous.id : '') : '', url);
  log_('admin', 'Photo link set: ' + slot);
  return { ok: true, photos: photos_(), slot: slot, message: url ? 'Photo link saved.' : 'Photo reset to the original.' };
}

function resetPhoto_(b) {
  var slot = String(b.slot || '');
  if (PHOTO_SLOTS.indexOf(slot) < 0) return { ok: false, error: 'Unknown photo slot: ' + slot };
  var previous = photos_()[slot];
  if (previous && previous.id) { try { DriveApp.getFileById(previous.id).setTrashed(true); } catch (e) {} }
  var sh = sheet_(SHEET_PHOTOS);
  for (var i = sh.getLastRow(); i >= 2; i--) {
    if (sh.getRange(i, 1).getValue() === slot) sh.deleteRow(i);
  }
  log_('admin', 'Photo reset: ' + slot);
  return { ok: true, photos: photos_(), slot: slot, message: 'Original photo restored.' };
}

function store_(slot, id, url) {
  var sh = sheet_(SHEET_PHOTOS);
  for (var i = sh.getLastRow(); i >= 2; i--) {
    if (sh.getRange(i, 1).getValue() === slot) sh.deleteRow(i);
  }
  sh.appendRow([slot, id || '', url || '', new Date()]);
}

/* ============================================================
   HELPERS
   ============================================================ */
function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (sh) return sh;
  throw new Error('The spreadsheet "' + ss.getName() + '" has no "' + name + '" tab yet, so the ' +
    'backend has nothing to write to. Fix it in 10 seconds: in this project, choose the function ' +
    'setup in the toolbar dropdown and press Run once. That creates every tab and the photo folder.');
}

/* Google Sheets quietly turns "2026-10-28", "3:00 PM" and "09991234567" into
   dates, times and numbers. Read those back the way the shop typed them, or a
   booked slot stops matching the slot list and gets sold twice. */
function isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]'; }
function ymd_(v) {
  if (isDate_(v)) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}
function slot_(v) {
  var i, s;
  if (isDate_(v)) {
    s = Utilities.formatDate(v, TZ, 'h:mm a');
    for (i = 0; i < SLOTS.length; i++) if (SLOTS[i].toLowerCase() === s.toLowerCase()) return SLOTS[i];
    return s;
  }
  s = String(v == null ? '' : v).trim();
  for (i = 0; i < SLOTS.length; i++) if (SLOTS[i].toLowerCase() === s.toLowerCase()) return SLOTS[i];
  return s;
}
function phoneText_(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (typeof v === 'number') {
    var s = String(Math.round(v));
    return (s.length === 10 && s.charAt(0) === '9') ? '0' + s : s;   // the leading 0 Sheets ate
  }
  return String(v);
}

function prop_(k) {
  var set = PropertiesService.getScriptProperties().getProperty(k);
  if (set) return set;
  var c = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG[k] !== undefined && CONFIG[k] !== '')
    ? String(CONFIG[k]).trim() : '';
  return c || null;
}
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }

function each_(ss, name, fn) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].join('') === '') continue;
    fn(rows[i], i + 2);
  }
}

function log_(who, what) {
  try {
    var sh = sheet_(SHEET_LOG);
    if (sh) sh.appendRow([new Date(), who, what, '']);
  } catch (e) {}
}

function nice_(iso) {
  var p = String(iso).split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return Utilities.formatDate(d, TZ, 'EEEE, d MMMM yyyy');
}

/** Test helper — run once from the editor to check everything is wired up. */
function test() {
  Logger.log('availability: ' + JSON.stringify(availability()).slice(0, 200));
  Logger.log('photos: ' + JSON.stringify(photosPublic_()));
  Logger.log('admin user: ' + (prop_('ADMIN_USER') || DEFAULT_USER));
  Logger.log('password set: ' + !!(prop_('ADMIN_PASSWORD') || prop_('ADMIN_HASH')));
  Logger.log(setup());
}
