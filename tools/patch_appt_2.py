#!/usr/bin/env python3
"""Insert the appointment section markup + booking logic."""
import sys

p = 'index.html'
s = open(p).read()

def sub(old, new, expect=1):
    global s
    c = s.count(old)
    if c != expect:
        print(f'!! expected {expect}, found {c} for: {old[:80]!r}')
        sys.exit(1)
    s = s.replace(old, new)

# ============================================================
# 3. section markup
# ============================================================
SECTION = """<!-- ============ APPOINTMENT BOOKING ============ -->
<section class="sec" id="appointment">
  <div class="wrap">
    <div class="head rv">
      <p class="eyebrow center">Book an Appointment</p>
      <h2>Reserve your slot at the bench</h2>
      <div class="divider"><span></span><i class="star" data-star></i><span></span></div>
      <p>Choose a date and time that suits you, and we will have the bench, the design references and the metals ready for your visit. Slots run from 12 noon to 6 PM, one client at a time.</p>
    </div>

    <div class="appt-grid">
      <!-- ---------- calendar + slots ---------- -->
      <div class="panel rv">
        <p class="step-label"><i>1</i> Choose your date &amp; time</p>

        <div class="cal-head">
          <div class="cal-title" id="calTitle">—</div>
          <div class="cal-nav">
            <button id="calPrev" type="button" aria-label="Previous month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
            </button>
            <button id="calNext" type="button" aria-label="Next month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>

        <div class="cal-dow" aria-hidden="true">
          <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
        </div>
        <div class="cal-grid" id="calGrid" role="group" aria-label="Choose an appointment date"></div>

        <div class="cal-legend">
          <span><b></b> Slots free</span>
          <span><b class="grey"></b> Fully booked / closed</span>
        </div>

        <div id="slotWrap" hidden style="margin-top:24px">
          <p class="step-label" style="margin-bottom:12px"><i>&#9733;</i> Available time slots <span id="slotDay" style="text-transform:none;letter-spacing:.06em;color:var(--muted)"></span></p>
          <div class="slots" id="slotGrid"></div>
          <p class="note" style="text-align:left;margin-top:14px">Times shown struck through are already reserved. Please pick another slot or date — we hold one client per time slot so your visit gets our full attention.</p>
        </div>
      </div>

      <!-- ---------- client details + policy ---------- -->
      <div class="panel rv" style="transition-delay:.1s">
        <p class="step-label"><i>2</i> Your details</p>

        <div class="chosen">
          <div><div class="k">Date</div><div class="v blank" id="sumDate">Not chosen yet</div></div>
          <div><div class="k">Time</div><div class="v blank" id="sumTime">Not chosen yet</div></div>
        </div>

        <form id="apptForm" novalidate>
          <div class="field">
            <label for="a-name">Client's full name</label>
            <input id="a-name" name="name" type="text" autocomplete="name" placeholder="Juan Dela Cruz" required>
          </div>
          <div class="f-row">
            <div class="field">
              <label for="a-phone">Contact number</label>
              <input id="a-phone" name="phone" type="tel" autocomplete="tel" placeholder="09xx xxx xxxx" required>
            </div>
            <div class="field">
              <label for="a-email">Email address</label>
              <input id="a-email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required>
            </div>
          </div>
          <div class="field">
            <label for="a-pax">No. of person/s <span style="text-transform:none;letter-spacing:.06em;color:var(--muted)">(maximum of 3 persons)</span></label>
            <select id="a-pax" name="pax">
              <option value="1">1 person</option>
              <option value="2">2 persons</option>
              <option value="3">3 persons</option>
            </select>
          </div>
          <div class="field">
            <label for="a-notes">Purpose / notes</label>
            <textarea id="a-notes" name="notes" placeholder="e.g. Custom wedding rings — we'd like to discuss design, gold karat and ring sizes."></textarea>
          </div>

          <!-- policy -->
          <div class="policy">
            <h4>Appointment Policy</h4>
            <p>To ensure dedicated time, personalized service, and proper preparation for each client, we kindly ask for your understanding of the following:</p>
            <ul>
              <li>A <span class="fee">&#8369;1,000</span> reservation fee is required to secure an appointment.</li>
              <li>The reservation fee is <strong>non-refundable</strong> in cases of cancellation for any reason, rescheduling of appointment, non-appearance / no show, or change of mind or decision not to proceed / to order a jewelry.</li>
              <li>The reservation fee will be <strong>fully deducted</strong> from the total cost of your customized wedding ring should you proceed with the order.</li>
              <li>Reserved appointment slots are prepared exclusively for each client; therefore, last-minute changes affect our schedule and other clients.</li>
            </ul>
            <p class="fine">Thank you for respecting our time, craftsmanship, and commitment to creating meaningful, custom made pieces.</p>
          </div>

          <label class="agree" for="a-agree">
            <input type="checkbox" id="a-agree" name="agree">
            <span>I have read and understand the Appointment Policy, including the &#8369;1,000 reservation fee and its non-refundable terms, and I agree to them.</span>
          </label>

          <button class="btn btn-gold" type="submit" style="width:100%;margin-top:20px">Request this appointment</button>
          <p class="note">We will reply to confirm your slot, and your <strong>Google Maps location will be provided together with your appointment confirmation</strong>. Thank you!</p>
          <div class="form-err" id="apptErr" role="alert"></div>
        </form>

        <!-- confirmation -->
        <div class="done" id="apptDone" role="status"></div>
      </div>
    </div>
  </div>
</section>

"""
sub("""<!-- ============ DETAILS ============ -->""", SECTION + """<!-- ============ DETAILS ============ -->""")

# ============================================================
# 4. booking logic
# ============================================================
JS = """/* ============================================================
   APPOINTMENT BOOKING
   ------------------------------------------------------------
   Availability shown to clients = the SLOTS list below, minus:
     • slots you have already confirmed  ->  add them to BOOKED
     • slots booked from this same device (saved in the browser)
     • slots less than LEAD_HOURS away (so nobody books a slot
       that is about to start)
     • CLOSED dates and CLOSED_WEEKDAYS
   The client's request arrives in your inbox as an email; you
   reply to confirm the slot and send the Google Maps location.
   ============================================================ */
const APPT = {
  fee           : 1000,
  slots         : ['12:00 NN','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM'],
  startHours    : [12,13,14,15,16,17,18],   // 24h equivalents, same order as slots
  leadHours     : 3,        // hide slots starting within this many hours
  monthsAhead   : 3,        // how far ahead clients may book
  maxPersons    : 3,
  closed        : [],       // whole days off, e.g. ['2026-12-24','2026-12-25']
  closedWeekdays: [],       // e.g. [0] to close every Sunday
  booked        : {         // confirmed appointments, e.g. {'2026-09-20': ['1:00 PM','4:00 PM']}
  }
};

(function () {
  const $   = (sel, root) => (root || document).querySelector(sel);
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const LS = 'huxley_bookings';

  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch (e) { return {}; } };
  const writeLocal = o => { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today.getFullYear(), today.getMonth() + APPT.monthsAhead, 0);

  let view     = new Date(today.getFullYear(), today.getMonth(), 1);
  let selDate  = null;
  let selSlot  = null;

  const isClosed   = d => APPT.closed.includes(ymd(d)) || APPT.closedWeekdays.includes(d.getDay());
  const takenSlots = d => (APPT.booked[ymd(d)] || []).concat(readLocal()[ymd(d)] || []);
  const inRange    = d => d >= today && d <= horizon;

  function slotTaken(d, i) {
    if (takenSlots(d).includes(APPT.slots[i])) return true;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), APPT.startHours[i], 0, 0, 0);
    return start.getTime() - Date.now() < APPT.leadHours * 3600e3;
  }
  const freeCount  = d => APPT.slots.reduce((n, _, i) => n + (slotTaken(d, i) ? 0 : 1), 0);
  const selectable = d => inRange(d) && !isClosed(d) && freeCount(d) > 0;

  const calGrid = $('#calGrid'), calTitle = $('#calTitle');
  const calPrev = $('#calPrev'), calNext = $('#calNext');
  const slotWrap = $('#slotWrap'), slotGrid = $('#slotGrid'), slotDay = $('#slotDay');
  const sumDate = $('#sumDate'), sumTime = $('#sumTime');
  const form = $('#apptForm'), err = $('#apptErr'), done = $('#apptDone');

  function renderCal() {
    calTitle.textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();
    const firstDow = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
    const daysIn   = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<span class="cal-day empty"></span>';
    for (let day = 1; day <= daysIn; day++) {
      const d = new Date(view.getFullYear(), view.getMonth(), day);
      const ok = selectable(d), free = freeCount(d);
      const cls = ['cal-day'];
      if (ymd(d) === ymd(new Date())) cls.push('today');
      if (selDate && ymd(d) === ymd(selDate)) cls.push('sel');
      if (ok) cls.push(free < APPT.slots.length ? 'partial' : 'open');
      else if (inRange(d) && !isClosed(d) && free === 0) cls.push('full');
      html += '<button type="button" class="' + cls.join(' ') + '" data-date="' + ymd(d) + '"' +
              (ok ? '' : ' disabled') + ' aria-pressed="' + (selDate && ymd(d) === ymd(selDate)) + '">' + day + '</button>';
    }
    calGrid.innerHTML = html;
    calPrev.disabled = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();
    calNext.disabled = view.getFullYear() === horizon.getFullYear() && view.getMonth() === horizon.getMonth();
  }

  function renderSlots() {
    if (!selDate) { slotWrap.hidden = true; return; }
    slotWrap.hidden = false;
    slotDay.textContent = '— ' + DAYS[selDate.getDay()] + ', ' + selDate.getDate() + ' ' + MONTHS[selDate.getMonth()];
    slotGrid.innerHTML = APPT.slots.map((label, i) => {
      const taken = slotTaken(selDate, i);
      const sel = selSlot === label;
      return '<button type="button" class="slot' + (sel ? ' sel' : '') + '" data-slot="' + label + '"' +
             (taken ? ' disabled' : '') + ' aria-pressed="' + sel + '">' + label +
             (taken ? '<small>Reserved</small>' : '') + '</button>';
    }).join('');
  }

  function renderSummary() {
    if (selDate) {
      sumDate.textContent = DAYS[selDate.getDay()] + ', ' + selDate.getDate() + ' ' + MONTHS[selDate.getMonth()] + ' ' + selDate.getFullYear();
      sumDate.classList.remove('blank');
    } else { sumDate.textContent = 'Not chosen yet'; sumDate.classList.add('blank'); }
    if (selSlot) { sumTime.textContent = selSlot; sumTime.classList.remove('blank'); }
    else { sumTime.textContent = 'Not chosen yet'; sumTime.classList.add('blank'); }
  }

  calGrid.addEventListener('click', e => {
    const btn = e.target.closest('button[data-date]');
    if (!btn || btn.disabled) return;
    const [y, m, dd] = btn.dataset.date.split('-').map(Number);
    selDate = new Date(y, m - 1, dd);
    selSlot = null;
    err.classList.remove('show');
    renderCal(); renderSlots(); renderSummary();
  });

  slotGrid.addEventListener('click', e => {
    const btn = e.target.closest('button[data-slot]');
    if (!btn || btn.disabled) return;
    selSlot = btn.dataset.slot;
    err.classList.remove('show');
    renderSlots(); renderSummary();
  });

  calPrev.addEventListener('click', () => { view.setMonth(view.getMonth() - 1); renderCal(); });
  calNext.addEventListener('click', () => { view.setMonth(view.getMonth() + 1); renderCal(); });

  function fail(msg, focus) {
    err.innerHTML = msg; err.classList.add('show');
    err.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (focus) $(focus).focus();
    return false;
  }

  function icsFile() {
    const i = APPT.slots.indexOf(selSlot);
    const start = new Date(selDate.getFullYear(), selDate.getMonth(), selDate.getDate(), APPT.startHours[i], 0, 0);
    const end = new Date(start.getTime() + 3600e3);
    const stamp = x => x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00';
    const utc = x => x.getUTCFullYear() + pad(x.getUTCMonth() + 1) + pad(x.getUTCDate()) + 'T' + pad(x.getUTCHours()) + pad(x.getUTCMinutes()) + pad(x.getUTCSeconds()) + 'Z';
    const body = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Huxley Jewelry Creations//Appointment//EN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + Date.now() + '@huxleyjewelrycreations',
      'DTSTAMP:' + utc(new Date()),
      'DTSTART:' + stamp(start),
      'DTEND:' + stamp(end),
      'SUMMARY:Huxley Jewelry Creations — Appointment (' + selSlot + ')',
      'DESCRIPTION:Appointment request for Huxley Jewelry Creations.' + '\\\\n' + 'We will confirm this slot by email or text. The Google Maps location will be provided with your confirmation.' + '\\\\n' + 'Reminder: a PHP 1,000 reservation fee secures the slot and is deductible from your customized ring order.',
      'LOCATION:To be provided with your appointment confirmation',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\\r\\n');
    return new Blob([body], { type: 'text/calendar;charset=utf-8' });
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());

    if (!selDate || !selSlot) return fail('Please choose your appointment <strong>date</strong> and <strong>time slot</strong> first — the calendar is on the left.');
    if (!d.name || !d.name.trim()) return fail('Please enter the client\\'s full name.', '#a-name');
    if (!d.phone || d.phone.trim().length < 7) return fail('Please enter a valid contact number.', '#a-phone');
    if (!d.email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(d.email)) return fail('Please enter a valid email address — your confirmation and the Google Maps location are sent there.', '#a-email');
    if (!d.agree) return fail('Please read and tick the Appointment Policy box to continue.');

    const dateLong = DAYS[selDate.getDay()] + ', ' + selDate.getDate() + ' ' + MONTHS[selDate.getMonth()] + ' ' + selDate.getFullYear();
    const body = [
      'APPOINTMENT REQUEST — Huxley Jewelry Creations website',
      '',
      'Date:                ' + dateLong,
      'Time:                ' + selSlot,
      'Client\\'s full name:  ' + d.name,
      'Contact number:      ' + d.phone,
      'Email address:       ' + d.email,
      'No. of person/s:     ' + d.pax + ' (max 3)',
      '',
      'Purpose / notes:',
      (d.notes || '—'),
      '',
      'Appointment Policy:  READ AND AGREED',
      'Reservation fee:     PHP 1,000 (acknowledged — deductible from the customized ring order)',
      '',
      'Please confirm this slot and send the Google Maps location with the confirmation.',
      '— sent from the Huxley Jewelry Creations website'
    ].join('\\n');

    window.location.href = 'mailto:' + SITE.email +
      '?subject=' + encodeURIComponent('Appointment request — ' + dateLong + ', ' + selSlot + ' (' + d.name + ')') +
      '&body=' + encodeURIComponent(body);

    // mark the slot reserved on this device so it cannot be booked twice here
    const local = readLocal();
    const key = ymd(selDate);
    local[key] = (local[key] || []).concat([selSlot]);
    writeLocal(local);

    renderCal(); renderSlots();

    done.innerHTML =
      '<h4>Thank you, ' + d.name.split(' ')[0].replace(/[<>]/g, '') + '!</h4>' +
      '<p style="font-size:.92rem;color:var(--ink-2);margin:0">Your appointment request has been prepared and sent. We will reply to confirm your slot.</p>' +
      '<div class="summary">' +
        '<div><span class="k">Date</span><span class="v">' + dateLong + '</span></div>' +
        '<div><span class="k">Time</span><span class="v">' + selSlot + '</span></div>' +
        '<div><span class="k">Client</span><span class="v">' + d.name.replace(/[<>]/g, '') + '</span></div>' +
        '<div><span class="k">Person/s</span><span class="v">' + d.pax + '</span></div>' +
        '<div><span class="k">Contact</span><span class="v">' + d.phone.replace(/[<>]/g, '') + '</span></div>' +
        '<div><span class="k">Reservation fee</span><span class="v">&#8369;1,000</span></div>' +
      '</div>' +
      '<div class="maps-note"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg></span>' +
      '<span>Your <strong>Google Maps location will be provided together with your appointment confirmation</strong>. If your email app did not open, message us at <a href="tel:' + SITE.phoneRaw + '" style="color:var(--gold)">' + SITE.phoneDisplay + '</a> or on <a href="' + SITE.facebook + '" target="_blank" rel="noopener" style="color:var(--gold)">Facebook</a> and we will book it for you.</span></div>' +
      '<div class="acts"><button type="button" class="btn btn-ghost" id="icsBtn">Add to my calendar</button>' +
      '<a class="btn btn-ghost" href="' + SITE.facebook + '" target="_blank" rel="noopener">Message us on Facebook</a></div>' +
      '<p class="note" style="text-align:left">Reminder: the &#8369;1,000 reservation fee secures your slot and is fully deducted from the total cost of your customized wedding ring should you proceed with the order.</p>';

    done.classList.add('show');
    form.style.display = 'none';
    done.scrollIntoView({ behavior: 'smooth', block: 'center' });

    $('#icsBtn').addEventListener('click', () => {
      const url = URL.createObjectURL(icsFile());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'huxley-appointment-' + ymd(selDate) + '.ics';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
  });

  renderCal();
})();

"""
sub("""/* ---------- footer year ---------- */""", JS + """/* ---------- footer year ---------- */""")

open(p, 'w').write(s)
print('part 2 (section + logic) applied —', len(s), 'bytes')
