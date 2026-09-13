// Runs backend/Code.gs for real inside a mocked Apps Script environment:
// SpreadsheetApp, DriveApp, PropertiesService, Utilities, MailApp, LockService.
// Catches logic and permission bugs without touching a live Google account.
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');

const CODE = fs.readFileSync('/home/user/backend/Code.gs', 'utf8');

/* ---------------- fakes ---------------- */
const files = {}, folders = {};
const DRIVE_FILES = [];                   // spreadsheets visible by name search
let mailSent = [];

function makeDriveFile(id, blob) {
  return {
    _id: id, _shared: false, trashed: false,
    getId: () => id,
    setSharing(access, perm) { this._shared = true; return this; },
    setTrashed(v) { this.trashed = v; return this; },
    getName: () => blob.name
  };
}

function makeSheet(name) {
  return {
    name, rows: [],
    getLastRow() { return this.rows.length; },
    getLastColumn() { return this.rows.reduce((m, r) => Math.max(m, r.length), 0); },
    appendRow(r) { this.rows.push(r.slice()); },
    setFrozenRows() {}, setSpreadsheetTimeZone() {},
    deleteRow(i) { this.rows.splice(i - 1, 1); },      // 1-based, matches Apps Script
    getRange(row, col, nr, nc) {
      const self = this;
      const nR = nr === undefined ? 1 : nr, nC = nc === undefined ? 1 : nc;
      return {
        getValues() {
          const out = [];
          for (let r = 0; r < nR; r++) {
            const line = self.rows[row - 1 + r] || [];
            out.push(Array.from({ length: nC }, (_, c) => line[col - 1 + c] === undefined ? '' : line[col - 1 + c]));
          }
          return out;
        },
        getValue() { const l = self.rows[row - 1] || []; return l[col - 1] === undefined ? '' : l[col - 1]; },
        setValue(v) {
          while (self.rows.length < row) self.rows.push([]);
          while (self.rows[row - 1].length < col) self.rows[row - 1].push('');
          self.rows[row - 1][col - 1] = v;
          return this;
        },
        setValues(vals) {
          vals.forEach((line, r) => line.forEach((v, c) => {
            const rr = row - 1 + r, cc = col - 1 + c;
            while (self.rows.length <= rr) self.rows.push([]);
            while (self.rows[rr].length <= cc) self.rows[rr].push('');
            self.rows[rr][cc] = v;
          }));
          return this;
        },
        setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; }
      };
    }
  };
}

const SHEETS = {};
function sheet(name) {
  if (!SHEETS[name]) SHEETS[name] = makeSheet(name);
  return SHEETS[name];
}

// flipping this simulates a standalone script with no spreadsheet attached
const ENV = { bound: true, byId: {} };
const BOOK = {
  getName: () => 'Huxley Bookings',
  getId: () => 'SHEET_ID_TEST',
  getSheetByName: n => SHEETS[n] || null,
  insertSheet: n => (SHEETS[n] = makeSheet(n)),
  setSpreadsheetTimeZone() {}
};

const scriptProps = {};
const sandbox = {
  console,
  SpreadsheetApp: {
    getActive() { return ENV.bound ? BOOK : null; },
    openById(id) { if (id === 'SHEET_ID_TEST') return BOOK; throw new Error('not found'); }
  },
  DriveApp: {
    getFoldersByName(n) {
      const arr = Object.values(folders).filter(f => f.name === n);
      return { hasNext: () => arr.length > 0, next: () => arr[0] };
    },
    createFolder(n) {
      const id = 'folder-' + n.replace(/\W/g, '');
      folders[id] = {
        id, name: n,
        getId: () => id, getName: () => n,
        createFile(blob) {
          const fid = 'file-' + Object.keys(files).length;
          files[fid] = makeDriveFile(fid, blob);
          return files[fid];
        }
      };
      return folders[id];
    },
    getFolderById(id) { if (!folders[id]) throw new Error('no folder'); return folders[id]; },
    getFilesByName(name) {
      const hits = DRIVE_FILES.filter(f => f.name === name);
      let i = 0;
      return { hasNext: () => i < hits.length, next: () => hits[i++] };
    },
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
    Permission: { VIEW: 'VIEW' },
    getFileById(id) { if (!files[id]) throw new Error('no file ' + id); return files[id]; }
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: k => (k in scriptProps ? scriptProps[k] : null),
      setProperty: (k, v) => { scriptProps[k] = String(v); },
      deleteProperty: k => { delete scriptProps[k]; }
    })
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' },
    computeDigest(_algo, s) {
      const h = crypto.createHash('sha256').update(String(s), 'utf8').digest();
      return Array.from(h).map(b => (b > 127 ? b - 256 : b));   // signed bytes, like Apps Script
    },
    getUuid: () => crypto.randomUUID(),
    formatDate(d, tz, fmt) {
      const p = n => String(n).padStart(2, '0');
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      const h12 = d.getHours() % 12 || 12, ap = d.getHours() < 12 ? 'AM' : 'PM';
      return fmt
        .replace('h:mm a', h12 + ':' + p(d.getMinutes()) + ' ' + ap)
        .replace('EEEE, d MMMM yyyy', days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear())
        .replace('yyyy', d.getFullYear()).replace('yy', String(d.getFullYear()).slice(2))
        .replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()))
        .replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds()))
        .replace('EEEE', days[d.getDay()]);
    },
    base64Decode(s) { return Array.from(Buffer.from(s, 'base64')); },
    newBlob(bytes, mime, name) { return { bytes, mime, name }; },
    sleep() {}
  },
  // Apps Script accepts sendEmail(to, subject, body) and sendEmail({ to, subject, body, replyTo, name })
  MailApp: {
    sendEmail(a, subj, body) {
      const m = (a && typeof a === 'object')
        ? { to: a.to, subj: a.subject, body: a.body, replyTo: a.replyTo, name: a.name }
        : { to: a, subj, body };
      mailSent.push(m);
    }
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput(t) { return { getContent: () => t, setMimeType() { return this; } }; }
  },
  Session: { getScriptTimeZone: () => 'Asia/Manila', getEffectiveUser: () => ({ getEmail: () => 'shop@example.com' }) },
  Logger: { log() {} }
};

vm.createContext(sandbox);
vm.runInContext(CODE, sandbox, { filename: 'Code.gs' });

/* ---------------- assertions ---------------- */
const fail = [], ok = [];
const check = (n, c, x = '') => (c ? ok : fail).push(n + (x ? ' → ' + x : ''));
const run = (fn, ...a) => sandbox[fn](...a);
const json = out => JSON.parse(out.getContent());

/* ================= 1. setup ================= */
run('setup');
check('setup creates all four tabs',
  ['Appointments', 'Blocks', 'Activity log', 'Photos'].every(n => !!SHEETS[n]),
  Object.keys(SHEETS).join(', '));
check('setup creates the Drive photo folder', Object.values(folders).some(f => f.name === 'Huxley Website Photos'));
check('default admin username is available', run('prop_', 'ADMIN_USER') === 'adminhuxley', run('prop_', 'ADMIN_USER'));
check('settings can come from the CONFIG block, not just the UI',
  run('prop_', 'SHEET_NAME') === 'Huxley Bookings' && scriptProps.SHEET_NAME === undefined,
  'CONFIG fallback works');
check('a Script property still overrides the CONFIG block',
  (function () { scriptProps.SHEET_NAME = 'From the UI'; const v = run('prop_', 'SHEET_NAME'); delete scriptProps.SHEET_NAME; return v === 'From the UI'; })());
check('no password is hard-coded into Code.gs', !/fixture-pass-1/.test(CODE), 'password must never ship in the repo');

/* ================= 2. credentials ================= */
scriptProps.ADMIN_PASSWORD = 'fixture-pass-1';
let r = run('doPost', { postData: { contents: JSON.stringify({ action: 'admin', op: 'list', user: 'adminhuxley', password: 'fixture-pass-1' }) } });
let out = json(r);
check('sign in with the right username + password works', out.ok === true, out.error || 'ok');
check('login returns the username', out.user === 'adminhuxley', out.user);

r = json(run('doPost', { postData: { contents: JSON.stringify({ action: 'admin', op: 'list', user: 'adminhuxley', password: 'wrong' }) } }));
check('wrong password is refused', r.ok === false && /username or password/i.test(r.error), r.error);

r = json(run('doPost', { postData: { contents: JSON.stringify({ action: 'admin', op: 'list', user: 'someoneelse', password: 'fixture-pass-1' }) } }));
check('wrong username is refused', r.ok === false, r.error);

r = json(run('doPost', { postData: { contents: JSON.stringify({ action: 'admin', op: 'list', password: 'fixture-pass-1' }) } }));
check('missing username is refused', r.ok === false, r.error);

check('password upgraded from plaintext to a hash after first login',
  !!scriptProps.ADMIN_HASH && !!scriptProps.ADMIN_SALT && !scriptProps.ADMIN_PASSWORD,
  'hash=' + String(scriptProps.ADMIN_HASH).slice(0, 12) + '…');
check('the plain password is no longer stored anywhere', scriptProps.ADMIN_PASSWORD === undefined);

r = json(run('doPost', { postData: { contents: JSON.stringify({ action: 'admin', op: 'list', user: 'adminhuxley', password: 'fixture-pass-1' }) } }));
check('sign in still works from the hash', r.ok === true, r.error);

/* ================= 3. change password ================= */
const post = body => json(run('doPost', { postData: { contents: JSON.stringify(body) } }));
const auth = extra => Object.assign({ action: 'admin', user: 'adminhuxley', password: 'fixture-pass-1' }, extra);

r = post(auth({ op: 'changePass', newPassword: 'short' }));
check('rejects a password under 6 characters', r.ok === false && /6 characters/.test(r.error), r.error);

r = post(auth({ op: 'changePass', newPassword: 'newpass123', confirmPassword: 'different' }));
check('rejects mismatched confirmation', r.ok === false && /do not match/i.test(r.error), r.error);

r = post(auth({ op: 'changePass', newPassword: 'newpass123', confirmPassword: 'newpass123' }));
check('changes the password', r.ok === true, r.error);
check('old password no longer works',
  post({ action: 'admin', op: 'list', user: 'adminhuxley', password: 'fixture-pass-1' }).ok === false);
check('new password works',
  post({ action: 'admin', op: 'list', user: 'adminhuxley', password: 'newpass123' }).ok === true);
check('hash changed after the password change', scriptProps.ADMIN_HASH && scriptProps.ADMIN_HASH.length === 64);

r = post({ action: 'admin', op: 'changePass', user: 'adminhuxley', password: 'newpass123', newUser: 'bad user!' });
check('rejects an invalid username', r.ok === false && /Username must be/.test(r.error), r.error);

r = post({ action: 'admin', op: 'changePass', user: 'adminhuxley', password: 'newpass123', newUser: 'huxleyadmin' });
check('changes the username on its own', r.ok === true && r.user === 'huxleyadmin', r.error || r.user);
check('sign in works with the new username',
  post({ action: 'admin', op: 'list', user: 'huxleyadmin', password: 'newpass123' }).ok === true);
check('old username is now refused',
  post({ action: 'admin', op: 'list', user: 'adminhuxley', password: 'newpass123' }).ok === false);

// put it back for the remaining tests
post({ action: 'admin', op: 'changePass', user: 'huxleyadmin', password: 'newpass123', newUser: 'adminhuxley', newPassword: 'fixture-pass-1', confirmPassword: 'fixture-pass-1' });
check('credentials restored for the rest of the run',
  post({ action: 'admin', op: 'list', user: 'adminhuxley', password: 'fixture-pass-1' }).ok === true);

/* ================= 4. booking still works ================= */
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); const p = i => String(i).padStart(2, '0'); return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()); };
mailSent = [];
r = post({ action: 'book', date: d(3), time: '2:00 PM', name: 'Ana Reyes', phone: '09181234567', email: 'ana@example.com', pax: 2, notes: 'Wedding rings', agree: true });
check('a booking is accepted', r.ok === true && /^HX-/.test(r.id), r.error || r.id);
check('a booking is emailed to the shop and the client', mailSent.length === 2, mailSent.length + ' emails');
check('the shop email has the details', /Ana Reyes/.test(mailSent[0].body) && /2:00 PM/.test(mailSent[0].body));
check('the shop alert is sent to the address in OWNER_EMAIL',
  mailSent[0].to === 'karenrborlongan@gmail.com', String(mailSent[0].to));
check('replying to the shop alert answers the client',
  mailSent[0].replyTo === 'ana@example.com', String(mailSent[0].replyTo));
check('the shop alert is named after the website',
  /Huxley Jewelry Creations/.test(mailSent[0].name || ''), String(mailSent[0].name));

/* a booking can alert more than one inbox at once */
(function () {
  const saved = scriptProps.OWNER_EMAIL;
  scriptProps.OWNER_EMAIL = 'karenrborlongan@gmail.com, shop@example.com';
  mailSent = [];
  const r2 = post({ action: 'book', date: d(5), time: '4:00 PM', name: 'Two Inbox', phone: '09171234568', email: 'two@example.com', pax: 1, agree: true });
  check('a booking still succeeds with two owner addresses', r2.ok === true, r2.error || r2.id);
  check('both addresses receive the alert',
    mailSent[0] && mailSent[0].to === 'karenrborlongan@gmail.com,shop@example.com', String(mailSent[0] && mailSent[0].to));
  check('the client is still acknowledged', mailSent[1] && mailSent[1].to === 'two@example.com', String(mailSent[1] && mailSent[1].to));
  if (r2.ok) post(auth({ op: 'delete', id: r2.id }));
  if (saved === undefined) delete scriptProps.OWNER_EMAIL; else scriptProps.OWNER_EMAIL = saved;
})();

r = post({ action: 'book', date: d(3), time: '2:00 PM', name: 'Ben Cruz', phone: '0917', email: 'b@e.com', pax: 1, agree: true });
check('the same slot cannot be booked twice', r.ok === false && r.taken === true, r.error);

r = post({ action: 'book', date: d(3), time: '2:00 PM', name: 'No Agree', phone: '0917', email: 'b@e.com', pax: 1 });
check('a booking without policy agreement is refused', r.ok === false && /Policy/.test(r.error), r.error);

r = json(run('doGet', { parameter: { action: 'availability' } }));
check('availability exposes the booked slot', (r.booked[d(3)] || []).indexOf('2:00 PM') >= 0, JSON.stringify(r.booked));
check('availability never exposes client details', !/Ana Reyes|09181234567/.test(JSON.stringify(r)));

/* ================= 5. admin actions ================= */
const list = post(auth({ op: 'list' }));
check('list returns the appointment', list.appointments.length === 1 && list.appointments[0].name === 'Ana Reyes');
check('stats computed', list.stats.total === 1 && list.stats.pending === 1, JSON.stringify(list.stats));

/* the dashboard should read the sheet once per load, not once per figure */
(function () {
  const apt = SHEETS['Appointments'], original = apt.getRange;
  let reads = 0;
  apt.getRange = function () {
    const r = original.apply(this, arguments);
    const gv = r.getValues;
    r.getValues = function () { reads++; return gv.apply(this, arguments); };
    return r;
  };
  post(auth({ op: 'list' }));
  apt.getRange = original;
  check('one dashboard load reads the appointments tab once', reads === 1, reads + ' read(s)');
})();
const id = list.appointments[0].id;

r = post(auth({ op: 'status', id: id, status: 'Confirmed' }));
check('confirming an appointment works', r.ok === true && r.appointments[0].status === 'Confirmed');
check('confirmation emails the client the Google Maps location',
  mailSent.some(m => m.to === 'ana@example.com' && /confirmed/i.test(m.subj)), mailSent.map(m => m.subj).join(' | '));

r = post(auth({ op: 'fee', id: id, fee: 'Paid' }));
check('reservation fee can be marked paid', r.ok === true && r.appointments[0].fee === 'Paid');
check('paid fees roll into the stats', r.stats.revenue === 1000, String(r.stats.revenue));

/* /Paid/i also matches "Unpaid", which made every untouched booking look paid */
r = post(auth({ op: 'fee', id: id, fee: 'Unpaid' }));
check('an unpaid fee is not money collected', r.ok === true && r.stats.revenue === 0, String(r.stats.revenue));
r = post(auth({ op: 'fee', id: id, fee: 'Deducted' }));
check('a deducted fee still counts as collected', r.stats.revenue === 1000, String(r.stats.revenue));
r = post(auth({ op: 'fee', id: id, fee: 'paid' }));
check('a lowercase fee value is stored canonically', r.appointments[0].fee === 'Paid' && r.stats.revenue === 1000, String(r.appointments[0].fee));
r = post(auth({ op: 'fee', id: id, fee: 'Done' }));
check('an unknown fee value is refused', r.ok === false && /Unknown reservation fee/.test(r.error), r.error);

/* several bookings, one paid: the count must not grow with unpaid rows */
(function () {
  const sh = SHEETS['Appointments'], saved = sh.rows.slice();
  sh.rows.push(['HX-UNPAID-1', '2026-09-13 11:00', '2026-12-30', '12:00 NN', 'Cara Lim', '0917 000 0001', 'cara@example.com', 1, '', 'Pending', 'Unpaid', '', '']);
  sh.rows.push(['HX-UNPAID-2', '2026-09-13 11:30', '2026-12-30', '1:00 PM', 'Dan Sy', '0917 000 0002', 'dan@example.com', 1, '', 'Pending', 'Unpaid', '', '']);
  const out = post(auth({ op: 'list' }));
  check('unpaid bookings never inflate Fees collected', out.stats.revenue === 1000,
    out.stats.revenue + ' across ' + out.appointments.length + ' bookings, only 1 paid');
  sh.rows = saved;
})();

r = post(auth({ op: 'block', date: d(7), time: 'ALL', reason: 'Holiday' }));
check('a whole day can be closed', r.ok === true && r.blocks.length === 1);
r = json(run('doGet', { parameter: { action: 'availability' } }));
check('closed day appears in availability', r.closed.indexOf(d(7)) >= 0);
r = post(auth({ op: 'unblock', date: d(7), time: 'ALL' }));
check('the block can be removed', r.ok === true && r.blocks.length === 0);

/* Sheets stores that date cell as a real Date - the block must still come off */
const asDate = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
r = post(auth({ op: 'block', date: d(9), time: 'ALL', reason: 'Sheets-typed date' }));
SHEETS['Blocks'].rows[SHEETS['Blocks'].rows.length - 1][0] = asDate(d(9));
r = post(auth({ op: 'unblock', date: d(9), time: 'ALL' }));
check('a day stored as a Date still unblocks', r.ok === true && r.blocks.length === 0 && r.removed === 1,
  r.removed + ' removed · ' + JSON.stringify(r.blocks));

r = post(auth({ op: 'block', date: d(11), time: 'ALL', reason: 'first' }));
SHEETS['Blocks'].rows[SHEETS['Blocks'].rows.length - 1][0] = asDate(d(11));
r = post(auth({ op: 'block', date: d(11), time: 'ALL', reason: 'second' }));
check('re-closing the same day does not stack up',
  (r.blocks || []).filter(b => b.date === d(11)).length === 1, JSON.stringify(r.blocks));
post(auth({ op: 'unblock', date: d(11), time: 'ALL' }));

/* ================= 6. photos ================= */
r = json(run('doGet', { parameter: { action: 'photos' } }));
check('photos endpoint responds when empty', r.ok === true && Object.keys(r.photos).length === 0);

const png = Buffer.from('89504e470d0a1a0a' + '00'.repeat(40), 'hex').toString('base64');
r = post(auth({ op: 'savePhoto', slot: 'hero', dataUrl: 'data:image/png;base64,' + png }));
check('a photo uploads and is stored', r.ok === true, r.error);
check('the stored photo gets a public URL', /^https:\/\/lh3\.googleusercontent\.com\/d\//.test(r.url || ''), r.url);
check('the Drive file is shared for the website', Object.values(files).some(f => f._shared === true));

const firstId = Object.keys(files)[0];
r = post(auth({ op: 'savePhoto', slot: 'hero', dataUrl: 'data:image/jpeg;base64,' + png }));
check('replacing a photo trashes the previous file', files[firstId] && files[firstId].trashed === true);
check('only one row per slot is kept', SHEETS['Photos'].rows.length === 2, SHEETS['Photos'].rows.length + ' rows (header + 1)');

r = json(run('doGet', { parameter: { action: 'photos' } }));
check('the photo is published to the website', /^https:/.test(r.photos.hero || ''), r.photos.hero);
check('public photos endpoint leaks no file ids', !/folder-|id/.test(JSON.stringify(r.photos).replace(/lh3.googleusercontent.com\/d\//g, '')));

r = post(auth({ op: 'savePhoto', slot: 'not-a-slot', dataUrl: 'data:image/png;base64,' + png }));
check('an unknown photo slot is rejected', r.ok === false && /Unknown photo slot/.test(r.error), r.error);

/* the collection cards were dropped from the page, so their slots went with them */
r = post(auth({ op: 'savePhoto', slot: 'chains', dataUrl: 'data:image/png;base64,' + png }));
check('a slot that is no longer on the page is refused', r.ok === false && /Unknown photo slot: chains/.test(r.error), r.error);
r = post(auth({ op: 'savePhoto', slot: 'workshop', dataUrl: 'data:image/png;base64,' + png }));
check('the four remaining slots still work', r.ok === true && /^https:\/\/lh3\.googleusercontent\.com\/d\//.test(r.url || ''), r.error || r.url);
r = post(auth({ op: 'resetPhoto', slot: 'workshop' }));

r = post(auth({ op: 'savePhoto', slot: 'hero', dataUrl: 'data:text/plain;base64,aGk=' }));
check('a non-image upload is rejected', r.ok === false && /could not be read as an image/.test(r.error), r.error);

r = post(auth({ op: 'setPhotoUrl', slot: 'rings', url: 'https://example.com/my-rings.jpg' }));
check('a photo can be set from a pasted link', r.ok === true && r.photos.rings.url === 'https://example.com/my-rings.jpg', r.error);
r = post(auth({ op: 'setPhotoUrl', slot: 'rings', url: 'http://insecure.example.com/x.jpg' }));
check('an insecure (http) link is refused', r.ok === false && /https/.test(r.error), r.error);

r = post(auth({ op: 'resetPhoto', slot: 'hero' }));
check('a photo can be reset to the original', r.ok === true && !r.photos.hero, JSON.stringify(r.photos));
r = post(auth({ op: 'resetPhoto', slot: 'rings' }));
check('the pasted link can be cleared too', r.ok === true && !r.photos.rings);
check('resetting removes the row', SHEETS['Photos'].rows.length === 1, SHEETS['Photos'].rows.length + ' rows');

/* ================= 7. authorisation boundary ================= */
check('every admin operation refuses a bad password',
  ['list','status','fee','block','unblock','delete','changePass','savePhoto','setPhotoUrl','resetPhoto']
    .every(op => post({ action: 'admin', op: op, user: 'adminhuxley', password: 'nope' }).ok === false));
check('unknown operations are rejected', post(auth({ op: 'dropDatabase' })).ok === false);
check('public endpoints cannot reach admin data',
  !/appointments|Ana Reyes/.test(run('doGet', { parameter: {} }).getContent()));

/* ================= 8. spreadsheet resolution ================= */
// (a) standalone script, no SHEET_ID -> a clear, actionable error
ENV.bound = false;
delete scriptProps.SHEET_ID;
r = json(run('doGet', { parameter: { action: 'availability' } }));
check('unbound script returns a helpful error',
  r.ok === false && /cannot find your Google Sheet/.test(r.error) && /SHEET_ID/.test(r.error) && /Extensions/.test(r.error),
  String(r.error).slice(0, 80));

// (b) standalone script + SHEET_ID -> works
ENV.bound = false;
scriptProps.SHEET_ID = 'SHEET_ID_TEST';
r = json(run('doGet', { parameter: { action: 'availability' } }));
check('standalone script works once SHEET_ID is set', r.ok === true, r.error);
check('data still comes from the right sheet', (r.booked[d(3)] || []).indexOf('2:00 PM') >= 0, JSON.stringify(r.booked));

// (c) a wrong SHEET_ID is reported clearly
scriptProps.SHEET_ID = 'nonsense';
r = json(run('doGet', { parameter: { action: 'availability' } }));
check('a wrong SHEET_ID is reported clearly',
  r.ok === false && /could not be opened/.test(r.error), String(r.error).slice(0, 80));

// (c2) no SHEET_ID and no binding, but the sheet is found by name
ENV.bound = false;
delete scriptProps.SHEET_ID;
DRIVE_FILES.length = 0;
DRIVE_FILES.push({ name: 'Huxley Bookings', getId: () => 'SHEET_ID_TEST', getMimeType: () => 'application/vnd.google-apps.spreadsheet' });
r = json(run('doGet', { parameter: { action: 'availability' } }));
check('found automatically when the spreadsheet is named "Huxley Bookings"', r.ok === true, r.error);
check('diagnose() reports what it can see',
  /Using spreadsheet: Huxley Bookings/.test(run('diagnose')) && /Admin password/.test(run('diagnose')));
DRIVE_FILES.length = 0;

// (d) back to a bound script, with SHEET_ID cleared
delete scriptProps.SHEET_ID;
ENV.bound = true;
r = json(run('doGet', { parameter: { action: 'availability' } }));
check('bound script still works', r.ok === true, r.error);

/* a missing tab must explain itself instead of throwing a raw TypeError */
(function () {
  const saved = SHEETS['Appointments'];
  delete SHEETS['Appointments'];                 // as if setup() had never been run
  try {
    run('sheet_', 'Appointments');
    check('a missing tab is reported clearly', false, 'no error thrown');
  } catch (e) {
    const msg = String(e.message || e);
    check('a missing tab says to run setup()', /setup/.test(msg) && /press Run|Run once|dropdown/i.test(msg), msg.slice(0, 60) + '…');
    check('a missing tab names the tab', /Appointments/.test(msg));
  }
  SHEETS['Appointments'] = saved;
  check('normal operation resumes after the guard', run('sheet_', 'Appointments') === saved);
})();


/* Sheets hands back real Dates and numbers. If the backend reads them raw, a
   booked slot stops matching the slot list and the same slot can be sold twice. */
(function () {
  const sh = SHEETS['Appointments'];
  const saved = sh.rows.slice();
  sh.rows.push(['HX-DATETEST', '2026-09-13 10:00',
    new Date(2026, 9, 28, 0, 0),        // date, stored by Sheets as a Date
    new Date(1899, 11, 30, 15, 0),      // 3:00 PM, stored as a Date
    'Ana Reyes', 9990000001, 'ana@example.com', 2, '', 'Pending', 'Unpaid', '', '']);
  const av = json(run('doGet', { parameter: { action: 'availability' } }));
  check('a Date-typed date is read back as yyyy-mm-dd', !!av.booked['2026-10-28'], JSON.stringify(Object.keys(av.booked)));
  check('a Date-typed time is read back as the slot label', (av.booked['2026-10-28'] || []).join() === '3:00 PM', (av.booked['2026-10-28'] || []).join());
  const rows = run('list_');
  const last = rows[rows.length - 1];
  check('the portal shows the plain date', last.date === '2026-10-28', last.date);
  check('the portal shows the plain time', last.time === '3:00 PM', last.time);
  check('a phone number keeps its leading zero', last.phone === '09990000001', String(last.phone));
  sh.rows = saved;
})();

/* ================= report ================= */
console.log('\nPASS (' + ok.length + ')');
ok.forEach(t => console.log('  ✓ ' + t));
if (fail.length) {
  console.log('\nFAIL (' + fail.length + ')');
  fail.forEach(t => 

console.log('  ✗ ' + t));
}
process.exit(fail.length ? 1 : 0);
