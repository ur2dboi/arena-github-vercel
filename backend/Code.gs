/**
 * ============================================================
 *  HUXLEY JEWELRY CREATIONS — Booking backend
 *  Database  : Google Sheets (this spreadsheet)
 *  API       : Apps Script Web App
 *  Admin     : admin.html on your website
 *  Cost      : ₱0 — consumer Apps Script quota is 90 min/day of
 *              script runtime and 20,000 UrlFetch calls/day.
 *  No credit card. Never auto-pauses.
 * ============================================================
 *
 *  FIRST-TIME SETUP
 *  1. Create a Google Sheet named "Huxley Bookings".
 *  2. Extensions ▸ Apps Script ▸ paste this whole file into Code.gs
 *  3. Run ▸ setup()  (approve the permissions prompt) — creates the tabs.
 *  4. Set your admin password (one time, in the editor):
 *        File ▸ Project Settings ▸ Script properties ▸ Add property
 *        Property: ADMIN_PASSWORD     Value: (your password)
 *        Optional: OWNER_EMAIL  ->  huxleyjewelrycreations@gmail.com
 *  5. Deploy ▸ New deployment ▸ type "Web app"
 *        Execute as: Me
 *        Who has access: Anyone
 *     Copy the /exec URL and paste it into index.html and admin.html.
 * ============================================================
 */

var TZ          = Session.getScriptTimeZone();
var SHEET_APPTS = 'Appointments';
var SHEET_BLOCK = 'Blocks';
var SHEET_LOG   = 'Activity log';

var HEADERS = ['ID','Submitted','Date','Time','Client name','Contact number','Email','Person/s',
               'Purpose / notes','Status','Reservation fee','Confirmed at','Notes from shop'];
var BLOCK_HEADERS = ['Date','Time','Reason','Added'];
var LOG_HEADERS   = ['When','By','Action','Details'];

var SLOTS = ['12:00 NN','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM'];

/* ============================================================
   SETUP
   ============================================================ */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var a = tab(ss, SHEET_APPTS, HEADERS);
  var b = tab(ss, SHEET_BLOCK, BLOCK_HEADERS);
  var l = tab(ss, SHEET_LOG, LOG_HEADERS);
  // keep the date/time columns as plain text so Sheets never reformats them
  ['C','D'].forEach(function (c) { a.getRange(c + '2:' + c + '1000').setNumberFormat('@'); });
  ['A','B'].forEach(function (c) { b.getRange(c + '2:' + c + '1000').setNumberFormat('@'); });
  log_('setup', 'Sheets ready');
  return 'Setup complete. Now set ADMIN_PASSWORD in Project Settings ▸ Script properties, then Deploy as a Web app.';
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
    if (p.action === 'ping')         return json_({ ok: true, when: new Date().toISOString() });
    return json_({ ok: true, service: 'Huxley Jewelry Creations booking API' });
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
   AVAILABILITY  (public — no personal data is ever exposed)
   ============================================================ */
function availability() {
  var ss = SpreadsheetApp.getActive();
  var booked = {};
  var closed = [];

  // confirmed / pending appointments occupy their slot
  each_(ss, SHEET_APPTS, function (r) {
    var status = String(r[9] || 'Pending');
    if (status === 'Cancelled') return;
    var d = r[2], t = r[3];
    if (!d || !t) return;
    booked[d] = booked[d] || [];
    if (booked[d].indexOf(t) < 0) booked[d].push(t);
  });

  // manual blocks: Time = 'ALL' closes the whole day
  each_(ss, SHEET_BLOCK, function (r) {
    var d = r[0], t = r[1] || 'ALL';
    if (!d) return;
    if (t === 'ALL') { closed.push(d); return; }
    booked[d] = booked[d] || [];
    if (booked[d].indexOf(t) < 0) booked[d].push(t);
  });

  return { ok: true, slots: SLOTS, booked: booked, closed: closed, updated: new Date().toISOString() };
}

/* ============================================================
   BOOKING  (public — called by the website form)
   ============================================================ */
function book_(b) {
  var need = ['date','time','name','phone','email'];
  for (var i = 0; i < need.length; i++) {
    if (!b[need[i]]) return { ok: false, error: 'Missing ' + need[i] };
  }
  if (SLOTS.indexOf(b.time) < 0)        return { ok: false, error: 'Unknown time slot' };
  if (b.agree !== true)                 return { ok: false, error: 'Policy not accepted' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date)) return { ok: false, error: 'Bad date' };

  var pax = Math.min(3, Math.max(1, parseInt(b.pax, 10) || 1));
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return { ok: false, error: 'Busy, please try again' }; }

  try {
    // re-check under the lock so two people cannot take the same slot
    var av = availability();
    if (av.closed.indexOf(b.date) >= 0)            return { ok: false, error: 'That day is closed' };
    if ((av.booked[b.date] || []).indexOf(b.time) >= 0) return { ok: false, error: 'Slot just taken', taken: true };

    var id = 'HX-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' +
             Math.random().toString(36).slice(2, 6).toUpperCase();
    var row = [id, new Date(), b.date, b.time, b.name, b.phone, b.email, pax,
               b.notes || '', 'Pending', 'Unpaid', '', ''];
    SpreadsheetApp.getActive().getSheetByName(SHEET_APPTS).appendRow(row);
    log_('website', 'New booking ' + id);

    notify_(id, b, pax);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function notify_(id, b, pax) {
  var owner = prop_('OWNER_EMAIL') || Session.getEffectiveUser().getEmail();
  var niceDate = nice_(b.date);
  var lines = [
    'Reference:   ' + id,
    'Date:        ' + niceDate,
    'Time:        ' + b.time,
    'Client:      ' + b.name,
    'Contact:     ' + b.phone,
    'Email:       ' + b.email,
    'Person/s:    ' + pax + ' (max 3)',
    '',
    'Purpose / notes:',
    b.notes || '—',
    '',
    'Policy acknowledged, ₱1,000 reservation fee understood.',
    '',
    'Manage this appointment in your admin portal.'
  ].join('\n');

  try { MailApp.sendEmail(owner, 'New appointment — ' + niceDate + ', ' + b.time + ' (' + b.name + ')', lines); } catch (e) {}

  var guest = [
    'Hi ' + String(b.name).split(' ')[0] + ',',
    '',
    'Thank you for booking with Huxley Jewelry Creations. We have received your appointment request:',
    '',
    'Reference:   ' + id,
    'Date:        ' + niceDate,
    'Time:        ' + b.time,
    'Person/s:    ' + pax,
    '',
    'We will reply to confirm your slot. Your Google Maps location will be provided together with your appointment confirmation.',
    '',
    'Reminder: a ₱1,000 reservation fee secures your appointment and is fully deducted from the total cost of your customized wedding ring should you proceed with the order. The fee is non-refundable for cancellation, rescheduling, non-appearance, or change of mind.',
    '',
    'Maraming salamat!',
    'Huxley Jewelry Creations',
    prop_('OWNER_PHONE') || '0976 463 7003'
  ].join('\n');

  try { MailApp.sendEmail(b.email, 'We received your appointment request — Huxley Jewelry Creations', guest); } catch (e) {}
}

/* ============================================================
   ADMIN API  (password protected, sent from admin.html)
   ============================================================ */
function admin_(b) {
  var pass = prop_('ADMIN_PASSWORD');
  if (!pass)                    return { ok: false, error: 'ADMIN_PASSWORD is not set in Script properties yet.' };
  if (String(b.password || '') !== pass) return { ok: false, error: 'Wrong password' };

  switch (b.op) {
    case 'list':      return { ok: true, appointments: list_(), blocks: blocks_(), stats: stats_() };
    case 'status':    return setStatus_(b.id, b.status);
    case 'fee':       return setFee_(b.id, b.fee);
    case 'shopNote':  return setShopNote_(b.id, b.note);
    case 'block':     return block_(b.date, b.time || 'ALL', b.reason || '');
    case 'unblock':   return unblock_(b.date, b.time || 'ALL');
    case 'delete':    return del_(b.id);
    case 'closeDay':  return block_(b.date, 'ALL', b.reason || 'Day off');
    default:          return { ok: false, error: 'Unknown operation' };
  }
}

function list_() {
  var out = [];
  each_(SpreadsheetApp.getActive(), SHEET_APPTS, function (r, i) {
    out.push({
      row: i, id: r[0], submitted: r[1] ? Utilities.formatDate(new Date(r[1]), TZ, 'yyyy-MM-dd HH:mm') : '',
      date: r[2], time: r[3], name: r[4], phone: r[5], email: r[6], pax: r[7],
      notes: r[8], status: r[9] || 'Pending', fee: r[10] || 'Unpaid',
      confirmedAt: r[11] ? Utilities.formatDate(new Date(r[11]), TZ, 'yyyy-MM-dd HH:mm') : '',
      shopNote: r[12] || ''
    });
  });
  return out;
}

function blocks_() {
  var out = [];
  each_(SpreadsheetApp.getActive(), SHEET_BLOCK, function (r) {
    out.push({ date: r[0], time: r[1] || 'ALL', reason: r[2] || '' });
  });
  return out;
}

function stats_() {
  var a = list_();
  var today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var s = { total: a.length, pending: 0, confirmed: 0, cancelled: 0, today: 0, upcoming: 0, revenue: 0 };
  a.forEach(function (x) {
    if (x.status === 'Pending')   s.pending++;
    if (x.status === 'Confirmed') s.confirmed++;
    if (x.status === 'Cancelled') s.cancelled++;
    if (x.date === today && x.status !== 'Cancelled') s.today++;
    if (x.date >= today && x.status === 'Confirmed') s.upcoming++;
    if (/Paid/i.test(x.fee)) s.revenue += 1000;
  });
  return s;
}

function rowOf_(id) {
  var found = -1;
  each_(SpreadsheetApp.getActive(), SHEET_APPTS, function (r, i) { if (r[0] === id) found = i; });
  return found;
}

function setStatus_(id, status) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_APPTS);
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
        '📍 Google Maps location: ' + (prop_('SHOP_MAPS') || '(paste your Google Maps link in Script properties as SHOP_MAPS)') + '\n\n' +
        'Please arrive on time — your slot is reserved exclusively for you.\n\n' +
        'See you soon,\nHuxley Jewelry Creations');
    } catch (e) {}
  }
  log_('admin', 'Status ' + id + ' → ' + status);
  return { ok: true, appointments: list_(), stats: stats_() };
}

function setFee_(id, fee) {
  var row = rowOf_(id);
  if (row < 0) return { ok: false, error: 'Not found' };
  SpreadsheetApp.getActive().getSheetByName(SHEET_APPTS).getRange(row, 11).setValue(fee);
  log_('admin', 'Fee ' + id + ' → ' + fee);
  return { ok: true, appointments: list_(), stats: stats_() };
}

function setShopNote_(id, note) {
  var row = rowOf_(id);
  if (row < 0) return { ok: false, error: 'Not found' };
  SpreadsheetApp.getActive().getSheetByName(SHEET_APPTS).getRange(row, 13).setValue(note || '');
  return { ok: true, appointments: list_() };
}

function del_(id) {
  var row = rowOf_(id);
  if (row < 0) return { ok: false, error: 'Not found' };
  SpreadsheetApp.getActive().getSheetByName(SHEET_APPTS).deleteRow(row);
  log_('admin', 'Deleted ' + id);
  return { ok: true, appointments: list_(), stats: stats_() };
}

function block_(date, time, reason) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BLOCK);
  each_(SpreadsheetApp.getActive(), SHEET_BLOCK, function (r, i) {
    if (r[0] === date && (r[1] || 'ALL') === time) sh.deleteRow(i);
  });
  sh.appendRow([date, time, reason, new Date()]);
  log_('admin', 'Blocked ' + date + ' ' + time);
  return { ok: true, blocks: blocks_(), appointments: list_(), stats: stats_() };
}

function unblock_(date, time) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_BLOCK);
  var removed = 0;
  // walk backwards so deleting rows does not shift the ones still to check
  var last = sh.getLastRow();
  for (var i = last; i >= 2; i--) {
    var r = sh.getRange(i, 1, 1, 3).getValues()[0];
    if (r[0] === date && (r[1] || 'ALL') === time) { sh.deleteRow(i); removed++; }
  }
  log_('admin', 'Unblocked ' + date + ' ' + time + ' (' + removed + ')');
  return { ok: true, blocks: blocks_(), appointments: list_(), stats: stats_() };
}

/* ============================================================
   HELPERS
   ============================================================ */
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }

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
    var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
    if (sh) sh.appendRow([new Date(), who, what, '']);
  } catch (e) {}
}

function nice_(iso) {
  var p = String(iso).split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return Utilities.formatDate(d, TZ, 'EEEE, d MMMM yyyy');
}

/** Run this once to test that everything is wired up. */
function test() {
  Logger.log(JSON.stringify(availability(), null, 2));
  Logger.log(setup());
}
