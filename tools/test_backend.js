// Tests the database-backed booking flow (index.html) and the admin portal (admin.html)
// with a mocked Apps Script backend, using jsdom.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const INDEX = fs.readFileSync('/home/user/index.html', 'utf8');
const ADMIN = fs.readFileSync('/home/user/admin.html', 'utf8');
const API = 'https://script.google.com/macros/s/AKfyTEST/exec';

const fail = [], ok = [];
const check = (n, c, x = '') => (c ? ok : fail).push(n + (x ? ' → ' + x : ''));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0); return d; };

/* ------------------------------------------------------------------
   A. index.html with a live backend
   ------------------------------------------------------------------ */
async function testSite() {
  const TARGET = day(3), CLOSED = day(5);
  const TAKEN = ['1:00 PM', '4:00 PM'];
  const calls = [];
  let posted = null;

  const page = INDEX.replace("  apiUrl        : '',", "  apiUrl        : '" + API + "',")
                    .replace(/window\.location\.href = 'mailto:'/g, "window.__mailto = 'mailto:'");

  const dom = new JSDOM(page, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.Element.prototype.scrollIntoView = function () {};
      w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
      w.fetch = async (url, opts) => {
        const body = opts && opts.body ? JSON.parse(opts.body) : null;
        calls.push({ url: String(url), body });
        if (!body) {   // availability GET
          const booked = {}; booked[ymd(TARGET)] = TAKEN.slice();
          return { ok: true, status: 200, json: async () => ({ ok: true, slots: [], booked, closed: [ymd(CLOSED)], updated: 'now' }) };
        }
        posted = body;
        return { ok: true, status: 200, json: async () => ({ ok: true, id: 'HX-260913-8QT4' }) };
      };
    }
  });
  await new Promise(r => setTimeout(r, 400));
  const w = dom.window, doc = w.document, q = s => doc.querySelector(s), qa = s => [...doc.querySelectorAll(s)];

  check('[db] availability fetched on load', calls.some(c => /action=availability/.test(c.url)), calls.length + ' call(s)');
  check('[db] sync note shown', /Live availability/i.test(q('#liveNote').textContent), q('#liveNote').textContent.slice(0, 40));

  const t = q('#calGrid button[data-date="' + ymd(TARGET) + '"]');
  check('[db] day with 2 taken slots is selectable', !!t && !t.disabled);
  check('[db] that day flags as partly booked', !!t && t.classList.contains('partial'));
  const c = q('#calGrid button[data-date="' + ymd(CLOSED) + '"]');
  check('[db] day closed in the database is disabled', !!c && c.disabled);

  t.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const slots = qa('#slotGrid .slot');
  const at = s => slots.find(x => x.dataset.slot === s);
  check('[db] database-booked 1:00 PM is disabled', at('1:00 PM').disabled);
  check('[db] database-booked 4:00 PM is disabled', at('4:00 PM').disabled);
  check('[db] free slot 2:00 PM still open', !at('2:00 PM').disabled);

  at('2:00 PM').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  q('#a-name').value = 'Ana Reyes';
  q('#a-phone').value = '09181234567';
  q('#a-email').value = 'ana@example.com';
  q('#a-pax').value = '2';
  q('#a-notes').value = 'Engagement ring, moissanite.';
  q('#a-agree').checked = true;
  q('#apptForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 250));

  check('[db] booking POSTed to the backend', !!posted && posted.action === 'book');
  check('[db] payload date', posted && posted.date === ymd(TARGET), posted && posted.date);
  check('[db] payload time', posted && posted.time === '2:00 PM', posted && posted.time);
  check('[db] payload name', posted && posted.name === 'Ana Reyes');
  check('[db] payload contact + email', posted && posted.phone === '09181234567' && posted.email === 'ana@example.com');
  check('[db] payload person count', posted && String(posted.pax) === '2', posted && String(posted.pax));
  check('[db] payload notes', posted && /moissanite/.test(posted.notes || ''));
  check('[db] payload records policy agreement', posted && posted.agree === true);
  check('[db] no email fallback was used', !w.__mailto);

  check('[db] confirmation shown', q('#apptDone').classList.contains('show'));
  check('[db] confirmation shows the reference', /HX-260913-8QT4/.test(q('#apptDone').textContent));
  check('[db] confirmation says the slot is closed to others', /closed to other clients/i.test(q('#apptDone').textContent));
  check('[db] confirmation still promises the Maps location', /Google Maps location/.test(q('#apptDone').textContent));
  const after = qa('#slotGrid .slot').find(x => x.dataset.slot === '2:00 PM');
  check('[db] booked slot now reserved on the calendar', !!after && after.disabled && /reserved/i.test(after.textContent));

  // --- server says the slot was taken by someone else ---
  const dom2 = new JSDOM(page, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win) {
      win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      win.Element.prototype.scrollIntoView = function () {};
      win.fetch = async (url, opts) => {
        if (opts && opts.body) return { ok: true, status: 200, json: async () => ({ ok: false, error: 'Slot just taken', taken: true }) };
        return { ok: true, status: 200, json: async () => ({ ok: true, booked: {}, closed: [] }) };
      };
    }
  });
  await new Promise(r => setTimeout(r, 300));
  const w2 = dom2.window, d2 = dom2.window.document;
  d2.querySelector('#calGrid button[data-date="' + ymd(day(2)) + '"]').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  d2.querySelector('#slotGrid .slot:not([disabled])').dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  d2.querySelector('#a-name').value = 'Ben Cruz';
  d2.querySelector('#a-phone').value = '09171112222';
  d2.querySelector('#a-email').value = 'ben@example.com';
  d2.querySelector('#a-agree').checked = true;
  d2.querySelector('#apptForm').dispatchEvent(new w2.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 250));
  check('[db] double-booking is refused with a clear message',
        /just taken/i.test(d2.querySelector('#apptErr').textContent), d2.querySelector('#apptErr').textContent.slice(0, 60));
  check('[db] no confirmation shown when refused', !d2.querySelector('#apptDone').classList.contains('show'));

  // --- backend unreachable → email fallback ---
  const dom3 = new JSDOM(page, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win) {
      win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      win.Element.prototype.scrollIntoView = function () {};
      win.fetch = async () => { throw new Error('offline'); };
    }
  });
  await new Promise(r => setTimeout(r, 300));
  const w3 = dom3.window, d3 = w3.document;
  d3.querySelector('#calGrid button[data-date="' + ymd(day(2)) + '"]').dispatchEvent(new w3.MouseEvent('click', { bubbles: true }));
  d3.querySelector('#slotGrid .slot:not([disabled])').dispatchEvent(new w3.MouseEvent('click', { bubbles: true }));
  d3.querySelector('#a-name').value = 'Cara Lim';
  d3.querySelector('#a-phone').value = '09173334444';
  d3.querySelector('#a-email').value = 'cara@example.com';
  d3.querySelector('#a-agree').checked = true;
  d3.querySelector('#apptForm').dispatchEvent(new w3.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 250));
  check('[db] falls back to email when the database is unreachable', !!w3.__mailto, (w3.__mailto || '').slice(0, 30));
  check('[db] fallback confirmation mentions sending', /prepared and sent/i.test(d3.querySelector('#apptDone').textContent));
}

/* ------------------------------------------------------------------
   B. admin.html
   ------------------------------------------------------------------ */
async function testAdmin() {
  const rows = [
    { row: 2, id: 'HX-1', submitted: '2026-09-10 09:00', date: ymd(day(1)), time: '12:00 NN', name: 'Ana Reyes', phone: '09181234567', email: 'ana@example.com', pax: 2, notes: 'Engagement ring', status: 'Pending', fee: 'Unpaid', confirmedAt: '', shopNote: '' },
    { row: 3, id: 'HX-2', submitted: '2026-09-09 10:00', date: ymd(day(-5)), time: '3:00 PM', name: 'Ben Cruz', phone: '09171112222', email: 'ben@example.com', pax: 1, notes: 'Resize a ring', status: 'Completed', fee: 'Paid', confirmedAt: '2026-09-09 11:00', shopNote: '' }
  ];
  const stats = { total: 2, pending: 1, confirmed: 0, cancelled: 0, today: 0, upcoming: 0, revenue: 1000 };
  let blobMade = null, lastOp = null, failNext = false;

  const dom = new JSDOM(ADMIN, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/admin.html',
    beforeParse(w) {
      w.URL.createObjectURL = b => { blobMade = b; return 'blob:csv'; };
      w.URL.revokeObjectURL = () => {};
      w.fetch = async (url, opts) => {
        const body = JSON.parse(opts.body);
        lastOp = body.op;
        if (failNext) { failNext = false; return { ok: true, status: 200, json: async () => ({ ok: false, error: 'Wrong password' }) }; }
        if (body.password !== 'secret123' || body.user !== 'adminhuxley') return { ok: true, status: 200, json: async () => ({ ok: false, error: 'Wrong username or password' }) };
        if (body.op === 'list') return { ok: true, status: 200, json: async () => ({ ok: true, appointments: rows, blocks: [{ date: ymd(day(9)), time: 'ALL', reason: 'Holiday' }], stats, photos: {}, user: body.user }) };
        if (body.op === 'status') { rows[0].status = body.status; return { ok: true, status: 200, json: async () => ({ ok: true, appointments: rows, stats }) }; }
        if (body.op === 'fee') { rows[0].fee = body.fee; return { ok: true, status: 200, json: async () => ({ ok: true, appointments: rows, stats }) }; }
        if (body.op === 'block') return { ok: true, status: 200, json: async () => ({ ok: true, appointments: rows, blocks: [{ date: body.date, time: body.time, reason: body.reason }], stats }) };
        if (body.op === 'unblock') return { ok: true, status: 200, json: async () => ({ ok: true, appointments: rows, blocks: [], stats }) };
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      };
    }
  });
  await new Promise(r => setTimeout(r, 200));
  const w = dom.window, d = w.document, q = s => d.querySelector(s), qa = s => [...d.querySelectorAll(s)];

  check('[admin] login screen shows first', !q('#loginView').hidden && q('#appView').hidden);

  // bad URL
  q('#a-url').value = 'https://example.com/foo';
  q('#a-user').value = 'adminhuxley';
  q('#a-pass').value = 'secret123';
  q('#loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 60));
  check('[admin] rejects a non-Apps-Script URL', /does not look like a Web App URL/i.test(q('#loginErr').textContent));

  // wrong password
  q('#a-url').value = API;
  q('#a-pass').value = 'nope';
  q('#loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 120));
  check('[admin] rejects a wrong password', /wrong username or password/i.test(q('#loginErr').textContent), q('#loginErr').textContent);

  // good login
  q('#a-url').value = API;
  q('#a-pass').value = 'secret123';
  q('#loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 200));

  check('[admin] portal opens after sign in', q('#loginView').hidden && !q('#appView').hidden);
  check('[admin] stats rendered', qa('#stats .stat').length === 6, qa('#stats .stat').length + ' cards');
  check('[admin] default view is today & upcoming', qa('#rows tr').length === 1, qa('#rows tr').length + ' row(s)');
  check('[admin] past appointments hidden by default', !/Ben Cruz/.test(q('#rows').textContent));

  q('#whenFilter').value = 'all';
  q('#whenFilter').dispatchEvent(new w.Event('change', { bubbles: true }));
  check('[admin] "Everything" shows all appointments', qa('#rows tr').length === 2, qa('#rows tr').length + ' rows');
  check('[admin] client name shown', /Ana Reyes/.test(q('#rows').textContent));
  check('[admin] notes shown', /Engagement ring/.test(q('#rows').textContent));
  check('[admin] existing block chip rendered', /Holiday/.test(q('#blocks').textContent));
  check('[admin] fee state shown', /Paid/.test(q('#rows').textContent));
  check('[admin] slot options include whole-day block', /Whole day/.test(q('#b-time').innerHTML));

  // confirm an appointment
  const confirmBtn = qa('#rows button[data-val="Confirmed"]')[0];
  confirmBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  check('[admin] confirm sends the right operation', lastOp === 'status');
  check('[admin] list re-renders after confirming', qa('#rows tr').length === 2, qa('#rows tr').length + ' rows');
  check('[admin] confirmed state reflected in the table', /Confirmed/.test(q('#rows').textContent));

  // mark the fee paid
  const feeBtn = qa('#rows button[data-act="fee"]')[0];
  feeBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  check('[admin] fee action reaches the backend', lastOp === 'fee');

  // search
  q('#search').value = 'ben';
  q('#search').dispatchEvent(new w.Event('input', { bubbles: true }));
  check('[admin] search filters the list', qa('#rows tr').length === 1 && /Ben Cruz/.test(q('#rows').textContent));
  q('#search').value = '';
  q('#search').dispatchEvent(new w.Event('input', { bubbles: true }));

  // status filter
  q('#statusFilter').value = 'Completed';
  q('#statusFilter').dispatchEvent(new w.Event('change', { bubbles: true }));
  check('[admin] status filter works', qa('#rows tr').length === 1);
  q('#statusFilter').value = '';
  q('#statusFilter').dispatchEvent(new w.Event('change', { bubbles: true }));

  // block + unblock
  q('#b-date').value = ymd(day(7));
  q('#b-time').value = '6:00 PM';
  q('#b-reason').value = 'Personal time';
  q('#blockBtn').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  check('[admin] block reaches the backend', lastOp === 'block');
  check('[admin] new block chip shown', /Personal time/.test(q('#blocks').textContent), q('#blocks').textContent.slice(0, 60));

  const un = q('#blocks button[data-unblock]');
  un.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  check('[admin] unblock reaches the backend', lastOp === 'unblock');
  check('[admin] block list cleared', /No blocks/.test(q('#blocks').textContent));

  // CSV
  q('#csvBtn').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('[admin] CSV export built', !!blobMade);
  if (blobMade && blobMade.text) {
    const csv = await blobMade.text();
    check('[admin] CSV has a header row', /Reference,Date,Time/.test(csv));
    check('[admin] CSV includes the appointment', /Ana Reyes/.test(csv));
    check('[admin] CSV quotes fields safely', /"Ana Reyes"/.test(csv));
  }
}

(async () => {
  await testSite();
  await testAdmin();
  console.log('\nPASS (' + ok.length + ')');
  ok.forEach(t => console.log('  ✓ ' + t));
  if (fail.length) {
    console.log('\nFAIL (' + fail.length + ')');
    fail.forEach(t => console.log('  ✗ ' + t));
  }
  process.exit(fail.length ? 1 : 0);   // jsdom keeps timers alive; end the run explicitly
})();
