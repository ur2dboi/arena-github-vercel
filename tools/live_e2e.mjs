// End-to-end check against the LIVE Apps Script backend the site uses.
//   node tools/live_e2e.mjs
// Reads the URL straight out of index.html so it always tests what is shipped.
// Pass the admin password in the environment so it never lives in this file:
//   HUXLEY_PASS=... HUXLEY_USER=... node tools/live_e2e.mjs
import fs from 'fs';

const url = fs.readFileSync('/home/user/index.html', 'utf8')
  .match(/apiUrl\s*:\s*'([^']+)'/)[1];
const USER = process.env.HUXLEY_USER || 'adminhuxley';
const PASS = process.env.HUXLEY_PASS || '';

const results = [];
const ok = (name, cond, extra = '') => results.push([cond ? 'PASS' : 'FAIL', name, extra]);

async function post(body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request: no CORS preflight
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: 'non-JSON: ' + text.slice(0, 120) }; }
}

const get = async q => (await fetch(url + q, { redirect: 'follow' })).json();

console.log('backend:', url, '\n');

// 1. public endpoints
const avail = await get('?action=availability');
ok('availability returns ok', avail.ok === true, JSON.stringify(avail).slice(0, 90));
ok('all 7 slots offered', (avail.slots || []).length === 7, (avail.slots || []).join(' | '));
ok('slot list is 12noon to 6pm', (avail.slots || []).join(',') === '12:00 NN,1:00 PM,2:00 PM,3:00 PM,4:00 PM,5:00 PM,6:00 PM');
const photos = await get('?action=photos');
ok('photos endpoint answers', photos.ok === true, Object.keys(photos.photos || {}).length + ' custom photo(s)');

// 2. admin login
if (!PASS) {
  console.log('(no HUXLEY_PASS given, skipping the admin and booking checks)');
} else {
  const bad = await post({ action: 'admin', op: 'list', user: USER, password: 'definitely-not-it' });
  ok('a wrong password is refused', bad.ok === false, bad.error || '');

  const login = await post({ action: 'admin', op: 'list', user: USER, password: PASS });
  ok('the real login works', login.ok === true, login.error || JSON.stringify(login).slice(0, 120));
  ok('the username is recognised', !login.user || login.user === USER, login.user || '');

  const list = await post({ action: 'admin', op: 'list', user: USER, password: PASS });
  ok('the portal can read the sheet', list.ok === true, (list.appointments || []).length + ' appointment(s) on file');
  ok('a booking sheet exists with headers', Array.isArray(list.appointments), typeof list.appointments);

  // 3. a real booking, exactly as the website sends it
  const d = new Date(); d.setDate(d.getDate() + 45);
  const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const book = await post({
    action: 'book', date, time: '3:00 PM', name: 'ZZ Test Booking (delete me)',
    phone: '09990000000', email: 'test@example.com', pax: 2,
    notes: 'automated end-to-end check', agree: true,
  });
  ok('a booking is accepted', book.ok === true, JSON.stringify(book).slice(0, 120));
  ok('the booking gets an id like HX-yymmdd-xxxx', /^HX-\d{6}-/.test(book.id || ''), book.id || '');

  // the slot must now show as taken
  const after = await get('?action=availability&date=' + date);
  const taken = JSON.stringify(after.booked || {}).includes('3:00 PM') || after.closed?.includes(date);
  ok('the booked slot is no longer offered', taken, JSON.stringify(after.booked || {}).slice(0, 90));

  // 4. double booking is refused
  const again = await post({ action: 'book', date, time: '3:00 PM', name: 'ZZ Test Duplicate', phone: '09990000001', email: 'test2@example.com', pax: 1, agree: true });
  ok('the same slot cannot be booked twice', again.ok === false, again.error || '');

  // 5. the rest of the portal's daily tools
  const iso = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const closedDay = iso(60);
  const blk = await post({ action: 'admin', op: 'block', user: USER, password: PASS, date: closedDay, time: 'ALL', reason: 'automated check' });
  ok('a day can be closed from the portal', blk.ok === true, blk.error || closedDay);
  const av2 = await get('?action=availability');
  ok('the closed day stops being offered', (av2.closed || []).includes(closedDay), JSON.stringify(av2.closed || []).slice(0, 90));
  const unb = await post({ action: 'admin', op: 'unblock', user: USER, password: PASS, date: closedDay, time: 'ALL' });
  ok('the block can be lifted again', unb.ok === true && !(unb.blocks || []).some(b => b.date === closedDay), unb.error || '');

  const rst = await post({ action: 'admin', op: 'resetPhoto', user: USER, password: PASS, slot: 'workshop' });
  ok('the photo manager answers the portal', rst.ok === true && !!rst.photos, rst.error || Object.keys(rst.photos || {}).length + ' custom photo(s) in use');

  if (book.ok && book.id) {
    const paid = await post({ action: 'admin', op: 'fee', user: USER, password: PASS, id: book.id, fee: 'Paid' });
    const rowP = (paid.appointments || []).find(a => a.id === book.id) || {};
    ok('a reservation fee can be marked paid', paid.ok === true && rowP.fee === 'Paid', rowP.fee || paid.error || '');
    const back = await post({ action: 'admin', op: 'fee', user: USER, password: PASS, id: book.id, fee: 'Unpaid' });
    const rowU = (back.appointments || []).find(a => a.id === book.id) || {};
    ok('and marked unpaid again', back.ok === true && rowU.fee === 'Unpaid', rowU.fee || back.error || '');
  }

  // 6. clean up
  if (book.ok && book.id) {
    const del = await post({ action: 'admin', op: 'delete', user: USER, password: PASS, id: book.id });
    ok('the test booking is removed again', del.ok === true, del.error || book.id + ' deleted');
  }
}

const failed = results.filter(r => r[0] === 'FAIL');
for (const [s, n, x] of results) console.log(`  ${s === 'PASS' ? '✓' : '✗'} ${n}${x ? '  → ' + x : ''}`);
console.log(`\n${failed.length ? 'FAIL' : 'PASS'} (${results.filter(r => r[0] === 'PASS').length})`);
if (failed.length) console.log('failed: ' + failed.map(f => f[1]).join(' | '));
process.exit(failed.length ? 1 : 0);
