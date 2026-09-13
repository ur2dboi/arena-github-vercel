// Functional test of the Huxley appointment booking widget using jsdom.
// The only edit to the page under test is redirecting `window.location.href =`
// (jsdom cannot navigate) into a captured variable, so the URL built by the
// real code path can be inspected.
const fs = require('fs');
const { JSDOM } = require('jsdom');

const raw = fs.readFileSync('/home/user/index.html', 'utf8');
const html = raw.replace(/window\.location\.href = 'mailto:'/g, "window.__mailto = 'mailto:'");

const errors = [];
let capturedBlob = null;

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  beforeParse(win) {
    win.addEventListener('error', e => errors.push('window error: ' + e.message));
    win.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    win.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    win.Element.prototype.scrollIntoView = function () {};
    win.URL.createObjectURL = blob => { capturedBlob = blob; return 'blob:fake/' + Date.now(); };
    win.URL.revokeObjectURL = () => {};
  }
});

const win = dom.window, doc = win.document;
const $ = s => doc.querySelector(s);
const $$ = s => [...doc.querySelectorAll(s)];
const fail = [], ok = [];
const check = (name, cond, extra = '') => (cond ? ok : fail).push(name + (extra ? ' → ' + extra : ''));

const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

setTimeout(async () => {
  // ---------- 0. star sizing ----------
  // A star is an empty <i> that JS fills with a 100%-sized SVG. If the box is
  // left inline, width/height are ignored and the glyph blows up to fill its
  // container. jsdom does no layout, so assert the computed display instead.
  const stars = $$('[data-star]');
  check('stars rendered on the page', stars.length >= 5, stars.length + ' stars');   // count is not the point, the sizing below is
  const inlineStars = stars.filter(el => win.getComputedStyle(el).display === 'inline');
  check('no star is an inline box', inlineStars.length === 0,
    inlineStars.map(el => el.parentElement.tagName + '.' + (el.parentElement.className || '-')).join(', '));
  check('every star has an explicit size',
    stars.every(el => /^\d+px$/.test(win.getComputedStyle(el).width)),
    [...new Set(stars.map(el => win.getComputedStyle(el).width))].sort().join(' '));
  const fStar = $('.f-bottom .star');
  check('the footer star stays small', !!fStar && win.getComputedStyle(fStar).width === '12px',
    fStar ? win.getComputedStyle(fStar).width : 'missing');

  // ---------- 0b. gallery slideshow ----------
  const gbox = doc.querySelector('[data-slideshow]');
  check('the gallery is on the page', !!gbox);
  const gSlides = gbox ? [...gbox.querySelectorAll('.slide')] : [];
  const gThumbs = gbox ? [...gbox.querySelectorAll('.slides-thumb')] : [];
  const gMedia = gSlides.map(s => s.querySelector('.slide-media'));
  check('it holds more than one piece', gSlides.length >= 2, gSlides.length + ' slides');
  check('there is one thumbnail per slide', gThumbs.length === gSlides.length, gThumbs.length + ' thumbs');
  check('every thumbnail has a picture', gThumbs.length > 0 && gThumbs.every(t => t.querySelector('img[src]')));
  check('every slide is described',
    gSlides.every((s, n) => !!(gMedia[n].getAttribute('alt') || gMedia[n].getAttribute('aria-label'))));
  check('every slide states its size (no jumping as they load)',
    gSlides.every((s, n) => gMedia[n].getAttribute('width') && gMedia[n].getAttribute('height')));
  const gVids = gbox ? [...gbox.querySelectorAll('.slide video')] : [];
  check('videos carry a poster and wait to be played',
    gVids.length > 0 && gVids.every(v => v.getAttribute('poster') && v.getAttribute('preload') === 'none'));
  check('videos are labelled for screen readers',
    gVids.every(v => v.getAttribute('aria-label')));
  if (gbox && gSlides.length > 1) {
    const gTrack = gbox.querySelector('.slides-track');
    const gNow = () => gbox.querySelector('[data-slide-now]').textContent;
    const gClick = el => el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    check('the counter starts at the first slide', gNow() === '1', gNow());
    check('the counter knows how many slides there are',
      gbox.querySelector('[data-slide-total]').textContent === String(gSlides.length),
      gbox.querySelector('[data-slide-total]').textContent);
    gClick(gbox.querySelector('.slides-nav.next'));
    check('next moves one slide on', gTrack.style.transform === 'translateX(-100%)' && gNow() === '2',
      gTrack.style.transform + ' / ' + gNow());
    gClick(gbox.querySelector('.slides-nav.prev'));
    check('prev steps back', gTrack.style.transform === 'translateX(0%)' && gNow() === '1',
      gTrack.style.transform + ' / ' + gNow());
    gClick(gbox.querySelector('.slides-nav.prev'));
    check('prev from the first slide wraps round to the last', gNow() === String(gSlides.length), gNow());
    check('the last thumbnail is marked as the current one',
      gThumbs[gSlides.length - 1].getAttribute('aria-current') === 'true');
    const jump = Math.min(30, gSlides.length - 1);
    gClick(gThumbs[jump]);
    check('a thumbnail jumps straight to its slide',
      gTrack.style.transform === 'translateX(-' + jump * 100 + '%)' && gNow() === String(jump + 1),
      gTrack.style.transform + ' / ' + gNow());
    check('a video slide can be spotted from its thumbnail',
      gThumbs[jump].classList.contains('is-video') === gSlides[jump].classList.contains('slide-video'));
  }

  // ---------- 1. calendar ----------
  const cells = $$('#calGrid .cal-day');
  check('calendar rendered', cells.length > 27, cells.length + ' cells');
  check('month title set', /\w+ \d{4}/.test($('#calTitle').textContent), $('#calTitle').textContent);
  check('today highlighted', !!$('#calGrid .cal-day.today'));
  check('past days in this month disabled', $$('#calGrid button[disabled]').length >= 0);

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
  let tBtn = $(`#calGrid button[data-date="${ymd(tomorrow)}"]`);
  check('tomorrow selectable', tBtn && !tBtn.disabled);

  // month navigation
  $('#calNext').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('next month works', $('#calTitle').textContent !== '', $('#calTitle').textContent);
  $('#calPrev').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  let tBtn2 = $(`#calGrid button[data-date="${ymd(tomorrow)}"]`);
  check('back to current month', !!tBtn2 && !tBtn2.disabled);

  // ---------- 2. slots ----------
  check('slots hidden before a date is chosen', $('#slotWrap').hasAttribute('hidden'));
  tBtn2.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('slots revealed after choosing a date', !$('#slotWrap').hasAttribute('hidden'));

  const slots = $$('#slotGrid .slot');
  check('7 time slots offered', slots.length === 7, slots.map(s => s.dataset.slot).join(' / '));
  check('slots are 12NN,1,2,3,4,5,6PM',
    ['12:00 NN','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM'].join() === slots.map(s => s.dataset.slot).join());
  check('summary shows the date', $('#sumDate').textContent.includes(String(tomorrow.getDate())), $('#sumDate').textContent);

  const free = slots.find(s => !s.disabled);
  check('at least one free slot', !!free);
  free.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  const selNow = $('#slotGrid .slot.sel');
  check('slot becomes selected', !!selNow && selNow.dataset.slot === free.dataset.slot,
        selNow ? selNow.dataset.slot : 'none');
  check('summary shows the time', $('#sumTime').textContent === free.dataset.slot, $('#sumTime').textContent);

  // switching date clears the chosen slot
  const other = $$('#calGrid button[data-date]').find(b => !b.disabled && b.dataset.date !== ymd(tomorrow));
  other.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('changing date clears the time', $('#sumTime').textContent === 'Not chosen yet', $('#sumTime').textContent);
  tBtn2 = $(`#calGrid button[data-date="${ymd(tomorrow)}"]`);
  tBtn2.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  let free2 = $$('#slotGrid .slot').find(s => !s.disabled);
  free2.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));

  // ---------- 3. validation ----------
  const form = $('#apptForm');
  const submit = () => form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }));

  submit();
  check('blocks empty name', /full name/i.test($('#apptErr').textContent), $('#apptErr').textContent.slice(0, 50));
  $('#a-name').value = 'Maria Santos';
  submit();
  check('blocks missing phone', /contact number/i.test($('#apptErr').textContent));
  $('#a-phone').value = '09171234567';
  submit();
  check('blocks missing email', /email/i.test($('#apptErr').textContent));
  $('#a-email').value = 'not-an-email';
  submit();
  check('rejects malformed email', /valid email/i.test($('#apptErr').textContent));
  $('#a-email').value = 'maria@example.com';
  submit();
  check('blocks un-agreed policy', /policy/i.test($('#apptErr').textContent));

  // ---------- 4. successful booking ----------
  $('#a-agree').checked = true;
  $('#a-notes').value = 'Custom wedding rings, 2 pairs.';
  $('#a-pax').value = '3';
  submit();

  const url = win.__mailto || '';
  const decoded = decodeURIComponent(url);
  check('builds a mailto to the shop', url.startsWith('mailto:'), url.slice(0, 40));
  check('mailto goes to the shop inbox', decoded.includes('huxleyjewelrycreations@gmail.com'));
  check('mailto includes the date', decoded.includes(String(tomorrow.getFullYear())));
  check('mailto includes the time', decoded.includes(free2.dataset.slot));
  check('mailto includes full name', decoded.includes("Client's full name:  Maria Santos"));
  check('mailto includes contact number', decoded.includes('Contact number:      09171234567'));
  check('mailto includes email', decoded.includes('Email address:       maria@example.com'));
  check('mailto records person limit', /No\. of person\/s:\s+3 \(max 3\)/.test(decoded));
  check('mailto includes purpose/notes', decoded.includes('Custom wedding rings, 2 pairs.'));
  check('mailto records policy agreement', /Appointment Policy:\s+READ AND AGREED/.test(decoded));
  check('mailto records the 1,000 reservation fee', /PHP 1,000/.test(decoded));
  check('mailto requests the Google Maps location', /Google Maps location/.test(decoded));

  check('confirmation panel shown', $('#apptDone').classList.contains('show'));
  check('confirmation lists date + time', /Time/.test($('#apptDone').textContent) && $('#apptDone').textContent.includes(free2.dataset.slot));
  check('confirmation mentions Maps', /Google Maps location/.test($('#apptDone').textContent));
  check('confirmation shows the fee', /1,000/.test($('#apptDone').textContent));
  check('form hidden after booking', $('#apptForm').style.display === 'none');

  // ---------- 5. slot now reserved ----------
  const stored = JSON.parse(win.localStorage.getItem('huxley_bookings') || '{}');
  check('booking persisted locally', (stored[ymd(tomorrow)] || []).includes(free2.dataset.slot), JSON.stringify(stored));
  const after = $$('#slotGrid .slot').find(s => s.dataset.slot === free2.dataset.slot);
  check('booked slot now shown reserved + disabled', !!after && after.disabled && /reserved/i.test(after.textContent));

  // ---------- 6. calendar invite ----------
  $('#icsBtn').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  check('calendar invite generated', !!capturedBlob);
  if (capturedBlob && capturedBlob.text) {
    const ics = await capturedBlob.text();
    check('ics is a calendar', ics.includes('BEGIN:VCALENDAR') && ics.includes('END:VCALENDAR'));
    check('ics has a start time', /DTSTART:\d{8}T\d{6}/.test(ics), (ics.match(/DTSTART:\d{8}T\d{6}/) || [''])[0]);
    check('ics summary names the shop', ics.includes('Huxley Jewelry Creations'));
    check('ics mentions the reservation fee', /1,000/.test(ics));
  }

  // ---------- 7. owner config: BOOKED slots + closed days ----------
  if (typeof runConfigScenario === 'function') await runConfigScenario();
  // ---------- 8. lead-time guard ----------
  if (typeof runLeadTimeScenario === 'function') await runLeadTimeScenario();

  check('no uncaught script errors', errors.length === 0, errors.join(' | '));

  console.log('\nPASS (' + ok.length + ')');
  ok.forEach(t => console.log('  ✓ ' + t));
  if (fail.length) {
    console.log('\nFAIL (' + fail.length + ')');
    fail.forEach(t => console.log('  ✗ ' + t));
  }
  process.exit(fail.length ? 1 : 0);   // jsdom keeps timers alive; end the run explicitly
}, 300);


// ---------- second DOM: a day with owner-booked slots and a closed date ----------
async function runConfigScenario() {
  const { JSDOM: J } = require('jsdom');
  const target = new Date(); target.setDate(target.getDate() + 4); target.setHours(0,0,0,0);
  const closedDay = new Date(); closedDay.setDate(closedDay.getDate() + 6); closedDay.setHours(0,0,0,0);
  const key = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');

  const page = raw.replace("  booked        : {         // confirmed appointments, e.g. {'2026-09-20': ['1:00 PM','4:00 PM']}\n  }",
      "  booked        : { '" + key(target) + "': ['1:00 PM','4:00 PM'] }")
    .replace("  closed        : [],       // whole days off, e.g. ['2026-12-24','2026-12-25']",
      "  closed        : ['" + key(closedDay) + "'],")
    .replace(/window\.location\.href = 'mailto:'/g, "window.__mailto = 'mailto:'");

  const d2 = new J(html.replace(html, page), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
      w.Element.prototype.scrollIntoView = function () {};
      w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    }
  });
  await new Promise(r => setTimeout(r, 250));
  const w2 = d2.window, doc2 = w2.document;
  const q = sel => doc2.querySelector(sel);

  const dayBtn = q('#calGrid button[data-date="' + key(target) + '"]');
  check('[config] day with 2 booked slots is still selectable', !!dayBtn && !dayBtn.disabled);
  check('[config] that day is flagged partially booked', !!dayBtn && dayBtn.classList.contains('partial'));

  dayBtn.dispatchEvent(new w2.MouseEvent('click', { bubbles: true }));
  const slots = [...doc2.querySelectorAll('#slotGrid .slot')];
  const one = slots.find(x => x.dataset.slot === '1:00 PM');
  const four = slots.find(x => x.dataset.slot === '4:00 PM');
  const two = slots.find(x => x.dataset.slot === '2:00 PM');
  check('[config] owner-booked 1:00 PM is disabled', !!one && one.disabled);
  check('[config] owner-booked 4:00 PM is disabled', !!four && four.disabled);
  check('[config] owner-booked slots labelled Reserved', !!one && /reserved/i.test(one.textContent));
  check('[config] 2:00 PM still free', !!two && !two.disabled);

  const closedBtn = q('#calGrid button[data-date="' + key(closedDay) + '"]');
  check('[config] closed day is disabled', !!closedBtn && closedBtn.disabled);
}


// ---------- third DOM: clock frozen at 10:30 AM to test the 3-hour lead rule ----------
async function runLeadTimeScenario() {
  const { JSDOM: J } = require('jsdom');
  const FIXED = new Date(2026, 8, 13, 10, 30, 0).getTime();   // 13 Sep 2026, 10:30 AM
  const page = html.replace('</head>', '</head>');
  const d3 = new J(page, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      const Real = w.Date;
      class FakeDate extends Real {
        constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); }
        static now() { return FIXED; }
      }
      w.Date = FakeDate;
      w.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };
      w.Element.prototype.scrollIntoView = function () {};
      w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
    }
  });
  await new Promise(r => setTimeout(r, 250));
  const w3 = d3.window, doc3 = w3.document;
  const q = s => doc3.querySelector(s);

  const todayBtn = q('#calGrid button[data-date="2026-09-13"]');
  check('[lead] today still bookable when slots remain', !!todayBtn && !todayBtn.disabled);
  todayBtn.dispatchEvent(new w3.MouseEvent('click', { bubbles: true }));

  const slots = [...doc3.querySelectorAll('#slotGrid .slot')];
  const at = t => slots.find(x => x.dataset.slot === t);
  check('[lead] 12:00 NN blocked (1.5h away)', at('12:00 NN').disabled);
  check('[lead] 1:00 PM blocked (2.5h away)', at('1:00 PM').disabled);
  check('[lead] 2:00 PM open (3.5h away)', !at('2:00 PM').disabled);
  check('[lead] 6:00 PM open', !at('6:00 PM').disabled);

  // the day *before* today must not be reachable at all
  const yesterday = q('#calGrid button[data-date="2026-09-12"]');
  check('[lead] yesterday not selectable (or absent)', !yesterday || yesterday.disabled);
}
