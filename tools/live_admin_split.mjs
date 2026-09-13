/* Live check of the split admin, against the deployed site and the real backend:
     HUXLEY_USER=adminhuxley HUXLEY_PASS='…' node tools/live_admin_split.mjs
   Signs in on /login, follows the hand-over to /admin, and proves a stranger is
   turned away. Run it from a folder that has jsdom installed. */
import { JSDOM } from 'jsdom';

const SITE = 'https://huxleyjewelry.vercel.app';
const USER = process.env.HUXLEY_USER || process.argv[2];
const PASS = process.env.HUXLEY_PASS || process.argv[3];
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? '  → ' + extra : ''}`); };

// ---------- 1. the live sign-in page, with the real backend ----------
const loginHtml = await (await fetch(SITE + '/login', { redirect: 'follow' })).text();
const d1 = new JSDOM(loginHtml, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: SITE + '/login',
  beforeParse(w) { w.fetch = (...a) => fetch(...a); w.alert = () => {}; }
});
const w1 = d1.window, q1 = s => w1.document.querySelector(s);
check('the live sign-in page served HTML', loginHtml.length > 2000 && !!q1('#loginForm'), loginHtml.length + ' bytes');
check('it is a sign-in page only (no dashboard on it)', !q1('#rows') && !q1('#photoGrid') && !!q1('#a-pass'));

q1('#a-user').value = USER;
q1('#a-pass').value = PASS;
const t0 = Date.now();
q1('#loginForm').dispatchEvent(new w1.Event('submit', { bubbles: true, cancelable: true }));
for (let i = 0; i < 45; i++) {
  await new Promise(r => setTimeout(r, 1000));
  if (w1.document.documentElement.getAttribute('data-leaving') === '/admin') break;
  const err = q1('#loginErr').textContent;
  if (err && !q1('#loginForm button[type=submit]').disabled) { console.log('   error:', err); break; }
}
console.log(`   sign-in took ${((Date.now() - t0) / 1000).toFixed(1)}s`);
check('the live sign-in page hands over to /admin', w1.document.documentElement.getAttribute('data-leaving') === '/admin',
  w1.document.documentElement.getAttribute('data-leaving') || q1('#loginErr').textContent);
const api = w1.localStorage.getItem('huxley_api'), user = w1.localStorage.getItem('huxley_user'), session = w1.sessionStorage.getItem('huxley_pass');
check('the session it passes on is complete', !!api && user === USER && session === PASS, `${api ? api.slice(0, 42) + '…' : 'no api'} / ${user}`);

// the saved password must be refused on the sign-in page
const d1b = new JSDOM(loginHtml, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: SITE + '/login',
  beforeParse(w) { w.fetch = (...a) => fetch(...a); w.alert = () => {}; }
});
const w1b = d1b.window, q1b = s => w1b.document.querySelector(s);
q1b('#a-user').value = USER; q1b('#a-pass').value = 'definitely-not-the-password';
q1b('#loginForm').dispatchEvent(new w1b.Event('submit', { bubbles: true, cancelable: true }));
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 1000));
  if (/wrong username or password/i.test(q1b('#loginErr').textContent)) break;
}
check('a wrong password is still refused', /wrong username or password/i.test(q1b('#loginErr').textContent), q1b('#loginErr').textContent.slice(0, 60));

// ---------- 2. the live dashboard, opened with that session ----------
const dashHtml = await (await fetch(SITE + '/admin', { redirect: 'follow' })).text();
const d2 = new JSDOM(dashHtml, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: SITE + '/admin',
  beforeParse(w) {
    w.fetch = (...a) => fetch(...a); w.alert = () => {};
    w.localStorage.setItem('huxley_api', api); w.localStorage.setItem('huxley_user', user);
    w.sessionStorage.setItem('huxley_pass', session);
  }
});
const w2 = d2.window, q2 = s => w2.document.querySelector(s);
check('the live dashboard carries no sign-in form', !q2('#loginForm') && !q2('#a-pass') && !q2('#loginView'));
check('it did not bounce a signed-in owner away', !w2.document.documentElement.getAttribute('data-leaving'));
// wait for the real list to come back from the sheet
let bits = {};
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 1000));
  bits = { rows: q2('#rows') ? q2('#rows').innerHTML.trim() : '', photos: q2('#photoGrid') ? q2('#photoGrid').innerHTML.trim() : '',
           toast: q2('#toast') ? q2('#toast').textContent : '', stats: q2('#stats') ? q2('#stats').textContent.trim() : '' };
  if (bits.rows && bits.photos && /Signed in as/.test(q2('#whoami').textContent)) break;
}
console.log('   stats:', bits.stats.replace(/\s+/g, ' ').slice(0, 70), '| toast:', bits.toast.slice(0, 60));
check('it greets the owner by name', new RegExp(USER).test(q2('#whoami').textContent), q2('#whoami').textContent);
const rowCount = w2.document.querySelectorAll('#rows tr').length;
const emptyShown = q2('#empty') && !q2('#empty').hidden;
check('the appointments list came back from the sheet', rowCount > 0 || emptyShown,
  rowCount + ' row(s)' + (emptyShown ? ', empty-state shown ("' + q2('#empty').textContent.trim() + '")' : ' — ' + bits.rows.replace(/\s+/g, ' ').slice(0, 50)));
check('the nine photo slots rendered', w2.document.querySelectorAll('#photoGrid input[type=file]').length >= 9 ||
  /photo/i.test(bits.photos), w2.document.querySelectorAll('#photoGrid input[type=file]').length + ' upload boxes');

// ---------- 3. a visitor with no session ----------
const d3 = new JSDOM(dashHtml, {
  runScripts: 'dangerously', pretendToBeVisual: true, url: SITE + '/admin',
  beforeParse(w) { w.fetch = (...a) => fetch(...a); w.alert = () => {}; }
});
await new Promise(r => setTimeout(r, 1200));
check('a stranger is sent to the sign-in page', d3.window.document.documentElement.getAttribute('data-leaving') === '/login',
  d3.window.document.documentElement.getAttribute('data-leaving') || 'stayed open');

console.log(`\n  ${fail ? 'FAIL' : 'PASS'} (${pass})` + (fail ? `\n  ${fail} failed` : ''));
process.exit(fail ? 1 : 0);
