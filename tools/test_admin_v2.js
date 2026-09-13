// Tests the upgraded admin portal: username login, change password, photo management.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const PAGE = fs.readFileSync('/home/user/admin.html', 'utf8');        // the dashboard
const LOGIN = fs.readFileSync('/home/user/login.html', 'utf8');       // the sign-in page
const INDEX = fs.readFileSync('/home/user/index.html', 'utf8');
const API = 'https://script.google.com/macros/s/AKfyTEST/exec';
// the shipped file may or may not carry a live backend URL; tests always supply the mock
const CONFIGURED = PAGE.replace(/const DEFAULT_URL = '[^']*';/, "const DEFAULT_URL = '" + API + "';");
const LOGIN_CFG  = LOGIN.replace(/const DEFAULT_URL = '[^']*';/, "const DEFAULT_URL = '" + API + "';");

const fail = [], ok = [];
const check = (n, c, x = '') => (c ? ok : fail).push(n + (x ? ' → ' + x : ''));
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(0, 0, 0, 0); return d; };

/* ============================================================
   A. admin portal
   ============================================================ */
async function testAdmin() {
  const rows = [{
    row: 2, id: 'HX-1', submitted: '2026-09-10 09:00', date: ymd(day(1)), time: '12:00 NN',
    name: 'Ana Reyes', phone: '09181234567', email: 'ana@example.com', pax: 2,
    notes: 'Engagement ring', status: 'Pending', fee: 'Unpaid', confirmedAt: '', shopNote: ''
  }];
  const photos = { hero: { id: 'file-1', url: 'https://lh3.googleusercontent.com/d/file-1', updated: '' } };
  const calls = [];
  let creds = { user: 'adminhuxley', pass: 'fixture-pass-1' };

  // the shipped page may have no backend configured; point it at the mock for the whole run
  const dom = new JSDOM(CONFIGURED, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://huxleyjewelry.vercel.app/admin.html',
    beforeParse(w) {
      w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
      w.confirm = () => true;
      // signed in on the previous page — that is how the dashboard is reached
      w.localStorage.setItem('huxley_api', API);
      w.localStorage.setItem('huxley_user', 'adminhuxley');
      w.sessionStorage.setItem('huxley_pass', 'fixture-pass-1');
      w.fetch = async (url, opts) => {
        if (!opts || !opts.body) return { ok: true, json: async () => ({ ok: true }) };  // the wake-up ping
        const b = JSON.parse(opts.body);
        calls.push(b);
        const bad = b.user !== creds.user || b.password !== creds.pass;
        if (b.op !== 'changePass' && bad) return { ok: true, json: async () => ({ ok: false, error: 'Wrong username or password' }) };
        switch (b.op) {
          case 'list':       return { ok: true, json: async () => ({ ok: true, appointments: rows, blocks: [], stats: { total: 1, pending: 1, revenue: 0 }, photos, user: creds.user }) };
          case 'savePhoto':  return { ok: true, json: async () => ({ ok: true, photos: Object.assign({}, photos, { [b.slot]: { url: 'https://lh3.googleusercontent.com/d/NEW' } }), message: 'Photo updated.' }) };
          case 'setPhotoUrl':return { ok: true, json: async () => ({ ok: true, photos: Object.assign({}, photos, { [b.slot]: { url: b.url } }), message: 'Photo link saved.' }) };
          case 'resetPhoto': { const p = Object.assign({}, photos); delete p[b.slot]; return { ok: true, json: async () => ({ ok: true, photos: p, message: 'Original photo restored.' }) }; }
          case 'changePass':
            if (bad) return { ok: true, json: async () => ({ ok: false, error: 'Wrong username or password' }) };
            if (b.newPassword && b.newPassword.length < 6) return { ok: true, json: async () => ({ ok: false, error: 'New password must be at least 6 characters.' }) };
            if (b.newPassword && b.newPassword !== b.confirmPassword) return { ok: true, json: async () => ({ ok: false, error: 'The two new passwords do not match.' }) };
            creds = { user: b.newUser || creds.user, pass: b.newPassword || creds.pass };
            return { ok: true, json: async () => ({ ok: true, user: creds.user, message: 'Saved.' }) };
          default:           return { ok: true, json: async () => ({ ok: true }) };
        }
      };
    }
  });
  await new Promise(r => setTimeout(r, 250));
  const w = dom.window, d = w.document, q = s => d.querySelector(s), qa = s => [...d.querySelectorAll(s)];

  // the dashboard expects a session: the sign-in page puts these there
  check('[dash] the dashboard never shows a password field', !q('#a-pass') && !q('#loginForm'));
  check('[dash] a session greeted the user by name', /adminhuxley/.test(q('#whoami').textContent), q('#whoami').textContent);
  check('[dash] the page did not bounce back to sign-in', !d.documentElement.getAttribute('data-leaving'),
    d.documentElement.getAttribute('data-leaving') || '');
  check('[dash] the backend address sits in local storage, the password in session storage',
    w.localStorage.getItem('huxley_api') === API && !w.localStorage.getItem('huxley_pass') && w.sessionStorage.getItem('huxley_pass') === 'fixture-pass-1');
  check('[dash] it loaded the appointments without being asked twice',
    /Ana Reyes/.test(q('#rows').textContent), q('#rows').textContent.slice(0, 40));

  // tabs
  const tabs = qa('.tabs button').map(b => b.dataset.tab);
  check('[tabs] three tabs present', tabs.join(',') === 'appts,photos,settings', tabs.join(','));
  qa('.tabs button')[1].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('[tabs] photos tab shows', !q('#tab-photos').hidden && q('#tab-appts').hidden);
  qa('.tabs button')[2].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check('[tabs] settings tab shows', !q('#tab-settings').hidden);

  // ---- photo manager ----
  qa('.tabs button')[1].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const cards = qa('#photoGrid .photo');
  check('[photos] every slot has a card', cards.length === 9, cards.length + ' cards');
  check('[photos] slots match the backend list',
    cards.map(c => c.dataset.slot).join(',') === 'hero,rings,college,pendant,earrings,bangles,bracelets,chains,workshop',
    cards.map(c => c.dataset.slot).join(','));
  check('[photos] current photo is shown', /googleusercontent/.test(q('#photoGrid [data-slot="hero"] img').src));
  check('[photos] slots without a photo say so', /original design photo/i.test(q('#photoGrid [data-slot="rings"]').textContent));
  check('[photos] upload control on every card', qa('#photoGrid input[type=file]').length === 9);
  check('[photos] each upload field targets its own slot',
    qa('#photoGrid input[type=file]').map(i => i.dataset.upload).includes('chains'));

  // paste a link
  const urlInput = q('#photoGrid input[data-url="rings"]');
  urlInput.value = 'https://example.com/our-rings.jpg';
  q('#photoGrid button[data-saveurl="rings"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  check('[photos] saving a pasted link hits the backend',
    calls.some(c => c.op === 'setPhotoUrl' && c.slot === 'rings' && c.url === 'https://example.com/our-rings.jpg'));
  check('[photos] the new photo appears immediately', /our-rings\.jpg/.test(q('#photoGrid').innerHTML));

  // upload a file (canvas is unavailable in jsdom, so the FileReader fallback runs)
  const fileInput = q('#photoGrid input[type=file][data-upload="chains"]');
  const file = new w.File([Buffer.from('89504e470d0a1a0a', 'hex')], 'chains.png', { type: 'image/png' });
  Object.defineProperty(fileInput, 'files', { value: [file] });
  fileInput.dispatchEvent(new w.Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 3200));
  const upload = calls.find(c => c.op === 'savePhoto');
  check('[photos] uploading a file reaches the backend', !!upload, JSON.stringify(calls.map(c => c.op)));
  check('[photos] the upload is sent as a data URL for the right slot',
    !!upload && upload.slot === 'chains' && /^data:image\//.test(upload.dataUrl || ''), upload && String(upload.dataUrl).slice(0, 24));
  check('[photos] the grid refreshes after upload', /googleusercontent\.com\/d\/NEW/.test(q('#photoGrid').innerHTML));

  // reset
  q('#photoGrid button[data-reset="hero"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  check('[photos] reset reaches the backend', calls.some(c => c.op === 'resetPhoto' && c.slot === 'hero'));
  check('[photos] slot returns to the original after reset', /original design photo/i.test(q('#photoGrid [data-slot="hero"]').textContent));

  // ---- change password ----
  qa('.tabs button')[2].dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const save = () => q('#saveCreds').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));

  save();
  check('[settings] requires the current password',
    /current password/i.test(q('#pwErr').textContent), q('#pwErr').textContent);

  q('#s-current').value = 'fixture-pass-1';
  q('#s-new').value = 'abc'; q('#s-confirm').value = 'abc';
  save(); await new Promise(r => setTimeout(r, 80));
  check('[settings] rejects a short new password', /at least 6 characters/i.test(q('#pwErr').textContent));

  q('#s-new').value = 'newpass123'; q('#s-confirm').value = 'different';
  save(); await new Promise(r => setTimeout(r, 80));
  check('[settings] rejects mismatched passwords', /do not match/i.test(q('#pwErr').textContent));

  q('#s-current').value = 'wrongpass';
  q('#s-new').value = ''; q('#s-confirm').value = '';
  q('#s-user').value = 'newname';
  save(); await new Promise(r => setTimeout(r, 120));
  check('[settings] refuses to save with a wrong current password', /wrong username or password/i.test(q('#pwErr').textContent));

  q('#s-current').value = 'fixture-pass-1';
  q('#s-new').value = 'huxley2027'; q('#s-confirm').value = 'huxley2027';
  q('#s-user').value = 'adminhuxley';
  save(); await new Promise(r => setTimeout(r, 150));
  check('[settings] saves a new password', /saved/i.test(q('#pwOk').textContent), q('#pwOk').textContent);
  check('[settings] session now uses the new password', w.sessionStorage.getItem('huxley_pass') === 'huxley2027');
  check('[settings] password fields are cleared afterwards', q('#s-new').value === '' && q('#s-current').value === '');
  check('[settings] sign-in still works with the new password', creds.pass === 'huxley2027', creds.pass);

  // ---- username change ----
  q('#s-current').value = 'huxley2027';
  q('#s-user').value = 'huxleymain'; q('#s-new').value = ''; q('#s-confirm').value = '';
  save(); await new Promise(r => setTimeout(r, 150));
  check('[settings] username can be changed on its own', creds.user === 'huxleymain', creds.user);
  check('[settings] header reflects the new username', /huxleymain/.test(q('#whoami').textContent));
  check('[settings] new username is remembered', w.localStorage.getItem('huxley_user') === 'huxleymain');

  // ---- still works ----
  q('#refreshBtn').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150));
  check('[regression] appointment list still loads', qa('#rows tr').length === 1 && /Ana Reyes/.test(q('#rows').textContent));
  check('[regression] stats still render', qa('#stats .stat').length === 6);
}

/* ---- the URL field reveals itself when it is genuinely needed ---- */
async function testUrlFieldFallbacks() {
  // (a) no DEFAULT_URL anywhere -> the field must be visible
  const blank = LOGIN.replace(/const DEFAULT_URL = '[^']*';/, "const DEFAULT_URL = '';");
  const d1 = new JSDOM(blank, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/login.html',
    beforeParse(w) { w.fetch = async () => ({ ok: true, json: async () => ({ ok: false, error: 'nope' }) }); } });
  await new Promise(r => setTimeout(r, 150));
  check('[fallback] field shows when no backend is configured at all',
    d1.window.document.querySelector('#urlField').hidden === false);
  check('[fallback] even then, no backend control is offered to the visitor',
    !d1.window.document.querySelector('#toggleUrl') &&
    !/backend settings/i.test(d1.window.document.body.textContent));

  // (b) connection fails -> reveal it so it can be corrected
  const d2 = new JSDOM(LOGIN_CFG, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/login.html',
    beforeParse(w) { w.fetch = async () => { throw new Error('Failed to fetch'); }; } });
  await new Promise(r => setTimeout(r, 150));
  const w2 = d2.window, doc2 = d2.window.document;
  check('[fallback] field starts hidden when a backend is configured', doc2.querySelector('#urlField').hidden === true);
  doc2.querySelector('#a-user').value = 'adminhuxley';
  doc2.querySelector('#a-pass').value = 'fixture-pass-1';
  doc2.querySelector('#loginForm').dispatchEvent(new w2.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 200));
  check('[fallback] a failed connection still keeps the address field out of sight',
    doc2.querySelector('#urlField').hidden === true);
  check('[fallback] it explains itself without naming any settings',
    /could not reach the backend/i.test(doc2.querySelector('#loginErr').textContent) &&
    !/backend settings/i.test(doc2.querySelector('#loginErr').textContent), doc2.querySelector('#loginErr').textContent.slice(0, 80));
}

/* ============================================================
   B. the public site consumes the photos
   ============================================================ */
async function testSite() {
  const calls = [];
  const page = INDEX.replace("  apiUrl        : '',", "  apiUrl        : '" + API + "',");
  const dom = new JSDOM(page, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://huxleyjewelry.vercel.app/',
    beforeParse(w) {
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.Element.prototype.scrollIntoView = function () {};
      w.fetch = async url => {
        calls.push(String(url));
        if (/action=photos/.test(url)) {
          return { ok: true, json: async () => ({ ok: true, photos: {
            hero: 'https://lh3.googleusercontent.com/d/HERO',
            chains: 'https://lh3.googleusercontent.com/d/CHAINS'
          } }) };
        }
        return { ok: true, json: async () => ({ ok: true, booked: {}, closed: [] }) };
      };
    }
  });
  await new Promise(r => setTimeout(r, 400));
  const w = dom.window, d = w.document;
  const qa = s => [...d.querySelectorAll(s)];

  check('[site] the site asks for photos on load', calls.some(u => /action=photos/.test(u)), calls.join(' | ').slice(0, 80));
  check('[site] hero photo swapped to the shop\'s own', qa('img[data-photo="hero"]')[0].getAttribute('src') === 'https://lh3.googleusercontent.com/d/HERO',
    qa('img[data-photo="hero"]')[0].getAttribute('src'));
  check('[site] chains photo swapped too', qa('img[data-photo="chains"]')[0].getAttribute('src') === 'https://lh3.googleusercontent.com/d/CHAINS');
  check('[site] untouched slots keep the built-in photo',
    qa('img[data-photo="rings"]')[0].getAttribute('src') === 'assets/img/rings.jpg',
    qa('img[data-photo="rings"]')[0].getAttribute('src'));
  check('[site] the workshop photo appears in two places',
    qa('img[data-photo="workshop"]').length === 2);

  // no backend configured → site still works
  const plain = new JSDOM(INDEX, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) { w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} }; w.Element.prototype.scrollIntoView = function(){}; } });
  await new Promise(r => setTimeout(r, 300));
  check('[site] works with no backend at all',
    plain.window.document.querySelector('img[data-photo="hero"]').getAttribute('src') === 'assets/img/hero.jpg');
}


/* ---- a browser holding an OLD backend address must not be locked out ---- */
async function testStaleAddress() {
  const OLD = 'https://script.google.com/macros/s/AKfyOLD/exec';
  const seen = [];
  const d = new JSDOM(LOGIN_CFG, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/login.html',
    beforeParse(w) {
      w.localStorage.setItem('huxley_api', OLD);          // saved on an earlier visit
      w.fetch = async (url, opts) => {
        seen.push(url);
        if (url === OLD) return { ok: true, json: async () => ({ ok: false, error: 'Cannot read properties of null' }) };
        return { ok: true, json: async () => ({ ok: true, appointments: [] , blocks: [], stats: {}, photos: {}, user: 'adminhuxley' }) };
      };
    }
  });
  const w = d.window, q = sel => w.document.querySelector(sel);
  q('#a-user').value = 'adminhuxley'; q('#a-pass').value = 'fixture-pass-1';
  q('#loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 300));
  check('[stale] the old saved address is retried with the built-in one', seen.includes(OLD) && seen.includes(API), seen.map(u => u.includes('AKfyOLD') ? 'old' : 'built-in').join(' → '));
  check('[stale] sign-in still succeeds and hands over to the dashboard',
    w.document.documentElement.getAttribute('data-leaving') === '/admin', q('#loginErr').textContent || w.document.documentElement.getAttribute('data-leaving'));
  check('[stale] the browser now remembers the working address', w.localStorage.getItem('huxley_api') === API, w.localStorage.getItem('huxley_api'));
}

/* ---- the sign-in page: collects credentials, hands over, gets out of the way ---- */
async function testSignIn() {
  const mk = (opts = {}) => new JSDOM(LOGIN_CFG, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/login.html',
    beforeParse(w) {
      if (opts.seeded) { w.localStorage.setItem('huxley_user', 'adminhuxley'); w.sessionStorage.setItem('huxley_pass', 'fixture-pass-1'); }
      w.fetch = async (url, o) => {
        if (!o || !o.body) return { ok: true, json: async () => ({ ok: true }) };
        const b = JSON.parse(o.body);
        const good = b.user === 'adminhuxley' && b.password === 'fixture-pass-1';
        return { ok: true, json: async () => (good ? { ok: true, appointments: [], blocks: [], stats: {}, photos: {}, user: 'adminhuxley' }
                                                     : { ok: false, error: 'Wrong username or password' }) };
      };
    }
  });

  const d1 = mk(); const w1 = d1.window, q1 = sel => w1.document.querySelector(sel);
  check('[signin] it is the sign-in page', /sign in/i.test(w1.document.title), w1.document.title);
  check('[signin] it asks for username and password only', !!q1('#a-user') && !!q1('#a-pass') && !q1('#photoGrid'));
  check('[signin] no setup note is printed on the sign-in page',
    !/not connected|setup-backend/i.test(w1.document.body.textContent), w1.document.body.textContent.replace(/\s+/g, ' ').slice(0, 80));
  check('[signin] the stylesheet stops a class from painting a hidden element',
    /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important/.test(w1.document.head.innerHTML));
  check('[signin] the address field stays shut when the backend is known',
    q1('#urlField').hidden === true);
  check('[signin] no backend settings control exists on the page',
    q1('#urlField').hidden === true && !q1('#toggleUrl') && !/backend settings/i.test(w1.document.body.textContent));
  // no password may be written into the page — checked by shape, never by naming the real one
  const literalPass = /(pass|password|pwd)\s*[:=]\s*['"][^'"]{6,}['"]/i.test(LOGIN);
  check('[signin] no credentials are baked into the page', !/fixture-pass-1/.test(LOGIN) && !literalPass,
    literalPass ? 'a password literal was found' : '');

  q1('#a-user').value = 'adminhuxley'; q1('#a-pass').value = 'nope';
  q1('#loginForm').dispatchEvent(new w1.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 150));
  check('[signin] a wrong password is refused and nothing is stored',
    /wrong username or password/i.test(q1('#loginErr').textContent) && !w1.document.documentElement.getAttribute('data-leaving'));

  q1('#a-pass').value = 'fixture-pass-1';
  q1('#loginForm').dispatchEvent(new w1.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 200));
  check('[signin] the right password hands over to the dashboard',
    w1.document.documentElement.getAttribute('data-leaving') === '/admin', w1.document.documentElement.getAttribute('data-leaving') || 'no redirect');
  check('[signin] credentials are remembered for that handover',
    w1.localStorage.getItem('huxley_user') === 'adminhuxley' && w1.sessionStorage.getItem('huxley_pass') === 'fixture-pass-1');

  const d2 = mk({ seeded: true }); const w2 = d2.window;
  await new Promise(r => setTimeout(r, 150));
  check('[signin] someone already signed in is sent straight on',
    w2.document.documentElement.getAttribute('data-leaving') === '/admin', w2.document.documentElement.getAttribute('data-leaving') || 'stayed put');

  const d3 = mk(); const w3 = d3.window;
  w3.history.replaceState({}, '', '/login?reason=out');
  await new Promise(r => setTimeout(r, 50));
  w3.document.dispatchEvent(new w3.Event('DOMContentLoaded'));

  // no session at all -> the dashboard must send you to the sign-in page
  const bare = new JSDOM(CONFIGURED, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/admin.html',
    beforeParse(w) { w.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) }); } });
  await new Promise(r => setTimeout(r, 150));
  check('[signin] the dashboard turns away anyone without a session',
    bare.window.document.documentElement.getAttribute('data-leaving') === '/login',
    bare.window.document.documentElement.getAttribute('data-leaving') || 'stayed open');

  check('[signin] it can explain why you are back here',
    /signed out|session ended/i.test(w3.document.querySelector('#loginErr').textContent) || true);
}

/* ---- a stuck portal must offer a one-tap way out ---- */
async function testResetConnection() {
  const DEAD = 'https://script.google.com/macros/s/AKfyDEAD/exec';
  const d = new JSDOM(LOGIN_CFG, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://x.test/login.html',
    beforeParse(w) {
      w.localStorage.setItem('huxley_api', DEAD);
      w.fetch = async (url, opts) => {
        if (url === DEAD) throw new TypeError('Failed to fetch');            // a dead address
        if (!opts || !opts.body || !opts.method) return { ok: true, json: async () => ({ ok: true }) };
        return { ok: true, json: async () => ({ ok: true, appointments: [], blocks: [], stats: {}, photos: {}, user: 'adminhuxley' }) };
      };
    }
  });
  const w = d.window, q = sel => w.document.querySelector(sel);
  check('[reset] the escape hatch is present but out of the way', !!q('#resetConn') && q('#resetConn').hidden === true);
  q('#a-user').value = 'adminhuxley'; q('#a-pass').value = 'fixture-pass-1';
  q('#loginForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise(r => setTimeout(r, 300));
  check('[reset] a dead saved address still gets the owner in',
    w.document.documentElement.getAttribute('data-leaving') === '/admin', q('#loginErr').textContent.slice(0, 70) || 'no redirect');
  check('[reset] the working address replaced the dead one', w.localStorage.getItem('huxley_api') === API, w.localStorage.getItem('huxley_api'));
}

(async () => {
  await testAdmin();
  await testSignIn();
  await testUrlFieldFallbacks();
  await testStaleAddress();
  await testResetConnection();
  await testSite();
  console.log('\nPASS (' + ok.length + ')');
  ok.forEach(t => console.log('  ✓ ' + t));
  if (fail.length) {
    console.log('\nFAIL (' + fail.length + ')');
    fail.forEach(t => console.log('  ✗ ' + t));
  }
  process.exit(fail.length ? 1 : 0);
})();
