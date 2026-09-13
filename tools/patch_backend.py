#!/usr/bin/env python3
"""Connect the website's booking form to the Apps Script database (live availability).

Rebuilds the whole submit / confirmation / live-sync region of the appointment
widget in one clean pass, so no partial edits can leave the block unbalanced.
"""
import sys

p = 'index.html'
s = open(p).read()

def sub(old, new, expect=1):
    global s
    c = s.count(old)
    if c != expect:
        print(f'!! expected {expect}, found {c} for: {old[:90]!r}')
        sys.exit(1)
    s = s.replace(old, new)

# ---------- 1. config ----------
sub("""  closed        : [],       // whole days off, e.g. ['2026-12-24','2026-12-25']""",
"""  apiUrl        : '',       // <- paste your Apps Script Web App /exec URL here to switch on the database
  refreshSec    : 90,       // how often the public calendar re-checks the database
  closed        : [],       // whole days off, e.g. ['2026-12-24','2026-12-25']""")

# ---------- 2. live state ----------
sub("""  const isClosed   = d => APPT.closed.includes(ymd(d)) || APPT.closedWeekdays.includes(d.getDay());
  const takenSlots = d => (APPT.booked[ymd(d)] || []).concat(readLocal()[ymd(d)] || []);
  const inRange    = d => d >= today && d <= horizon;""",
"""  // availability pulled from the Google Sheet through the Apps Script backend
  let live = { booked: {}, closed: [], at: null };
  const apiUrl = () => String(APPT.apiUrl || '').trim();

  const isClosed   = d => live.closed.indexOf(ymd(d)) >= 0 ||
                          APPT.closed.includes(ymd(d)) || APPT.closedWeekdays.includes(d.getDay());
  const takenSlots = d => (live.booked[ymd(d)] || [])
                            .concat(APPT.booked[ymd(d)] || [])
                            .concat(readLocal()[ymd(d)] || []);
  const inRange    = d => today <= d && d <= horizon;""")

# ---------- 3. replace everything from the submit handler to the end of the IIFE ----------
start = s.index("  form.addEventListener('submit'")
end   = s.index("})();", start) + len("})();")
old_region = s[start:end]
print('replacing', len(old_region), 'chars of booking logic')

NEW = r"""  /* ---------- save the booking ---------- */
  let ref = '';

  function markLocal() {
    const local = readLocal();
    const key = ymd(selDate);
    local[key] = (local[key] || []).concat([selSlot]);
    writeLocal(local);
    renderCal(); renderSlots();
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
      'DESCRIPTION:Appointment request for Huxley Jewelry Creations.' + '\\n' + 'We will confirm this slot by email or text. The Google Maps location will be provided with your confirmation.' + '\\n' + 'Reminder: a PHP 1,000 reservation fee secures the slot and is deductible from your customized ring order.',
      'LOCATION:To be provided with your appointment confirmation',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    return new Blob([body], { type: 'text/calendar;charset=utf-8' });
  }

  /* ---------- live availability from the database ---------- */
  const liveNote = document.getElementById('liveNote');

  async function fetchLive(quiet) {
    if (!apiUrl()) { if (liveNote) liveNote.textContent = ''; return; }
    try {
      const sep = apiUrl().indexOf('?') < 0 ? '?' : '&';
      const res = await fetch(apiUrl() + sep + 'action=availability', { method: 'GET', redirect: 'follow' });
      const out = await res.json();
      if (!out || out.ok !== true) throw new Error('bad response');
      live = { booked: out.booked || {}, closed: out.closed || [], at: new Date() };
      if (liveNote) {
        liveNote.innerHTML = '<i class="star" aria-hidden="true"></i> Live availability — checked ' +
          live.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        liveNote.querySelectorAll('[data-star]').forEach(el => el.innerHTML = STAR);
      }
      renderCal(); renderSlots();
    } catch (err) {
      if (liveNote && !quiet) {
        liveNote.textContent = 'Showing our last known availability. To book right away, call or text ' + SITE.phoneDisplay + '.';
      }
    }
  }

  /* ---------- confirmation panel ---------- */
  function showDone(emailed) {
    const d = Object.fromEntries(new FormData(form).entries());
    const safe = v => String(v == null ? '' : v).replace(/[<>]/g, '');
    const dateLong = DAYS[selDate.getDay()] + ', ' + selDate.getDate() + ' ' + MONTHS[selDate.getMonth()] + ' ' + selDate.getFullYear();

    done.innerHTML =
      '<h4>Thank you, ' + safe(d.name).split(' ')[0] + '!</h4>' +
      '<p style="font-size:.92rem;color:var(--ink-2);margin:0">' +
        (emailed
          ? 'Your appointment request has been prepared and sent. We will reply to confirm your slot.'
          : 'Your appointment is booked and your slot is now closed to other clients. We will confirm with you by email or text.') +
      '</p>' +
      '<div class="summary">' +
        (ref ? '<div><span class="k">Reference</span><span class="v">' + safe(ref) + '</span></div>' : '') +
        '<div><span class="k">Date</span><span class="v">' + dateLong + '</span></div>' +
        '<div><span class="k">Time</span><span class="v">' + safe(selSlot) + '</span></div>' +
        '<div><span class="k">Client</span><span class="v">' + safe(d.name) + '</span></div>' +
        '<div><span class="k">Person/s</span><span class="v">' + safe(d.pax) + '</span></div>' +
        '<div><span class="k">Contact</span><span class="v">' + safe(d.phone) + '</span></div>' +
        '<div><span class="k">Reservation fee</span><span class="v">&#8369;1,000</span></div>' +
      '</div>' +
      '<div class="maps-note"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg></span>' +
      '<span>Your <strong>Google Maps location will be provided together with your appointment confirmation</strong>. Need to change something? Message us at <a href="tel:' + SITE.phoneRaw + '" style="color:var(--gold)">' + SITE.phoneDisplay + '</a> or on <a href="' + SITE.facebook + '" target="_blank" rel="noopener" style="color:var(--gold)">Facebook</a>.</span></div>' +
      '<div class="acts"><button type="button" class="btn btn-ghost" id="icsBtn">Add to my calendar</button>' +
      '<a class="btn btn-ghost" href="' + SITE.facebook + '" target="_blank" rel="noopener">Message us on Facebook</a></div>' +
      '<p class="note" style="text-align:left">Reminder: the &#8369;1,000 reservation fee secures your slot and is fully deducted from the total cost of your customized wedding ring should you proceed with the order.</p>';

    done.classList.add('show');
    form.style.display = 'none';
    softScroll(done, 'center');

    document.getElementById('icsBtn').addEventListener('click', () => {
      const url = URL.createObjectURL(icsFile());
      const a = document.createElement('a');
      a.href = url;
      a.download = 'huxley-appointment-' + ymd(selDate) + '.ics';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
  }

  /* ---------- submit ---------- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());

    if (!selDate || !selSlot) return fail('Please choose your appointment <strong>date</strong> and <strong>time slot</strong> first — the calendar is on the left.');
    if (!d.name || !d.name.trim()) return fail('Please enter the client\'s full name.', '#a-name');
    if (!d.phone || d.phone.trim().length < 7) return fail('Please enter a valid contact number.', '#a-phone');
    if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return fail('Please enter a valid email address — your confirmation and the Google Maps location are sent there.', '#a-email');
    if (!d.agree) return fail('Please read and tick the Appointment Policy box to continue.');

    const dateLong = DAYS[selDate.getDay()] + ', ' + selDate.getDate() + ' ' + MONTHS[selDate.getMonth()] + ' ' + selDate.getFullYear();
    const payload = {
      action: 'book', date: ymd(selDate), time: selSlot, name: d.name, phone: d.phone,
      email: d.email, pax: d.pax, notes: d.notes || '', agree: true
    };
    const emailBody = [
      'APPOINTMENT REQUEST — Huxley Jewelry Creations website',
      '',
      'Date:                ' + dateLong,
      'Time:                ' + selSlot,
      'Client\'s full name:  ' + d.name,
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
    ].join('\n');

    const sendByEmail = () => {
      window.location.href = 'mailto:' + SITE.email +
        '?subject=' + encodeURIComponent('Appointment request — ' + dateLong + ', ' + selSlot + ' (' + d.name + ')') +
        '&body=' + encodeURIComponent(emailBody);
    };

    // 1) preferred: save it in the database so the slot closes for every visitor
    if (apiUrl()) {
      const btn = form.querySelector('button[type=submit]');
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        const res = await fetch(apiUrl(), { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
        const out = await res.json();
        btn.disabled = false; btn.textContent = label;
        if (out && out.ok) {
          ref = out.id || '';
          markLocal();
          await fetchLive(true);
          showDone(false);
          return;
        }
        if (out && out.taken) {
          await fetchLive(true);
          return fail('Sorry — that slot was just taken. Please choose another time or date.');
        }
        return fail('We could not save your appointment (' + ((out && out.error) || 'unknown error') +
          '). Please call or text <a href="tel:' + SITE.phoneRaw + '" style="color:var(--gold)">' + SITE.phoneDisplay + '</a>.');
      } catch (err) {
        // 2) database unreachable — fall back to email so the booking is not lost
        btn.disabled = false; btn.textContent = label;
        sendByEmail();
        markLocal();
        showDone(true);
        return;
      }
    }

    // 3) no database configured yet — email the request
    sendByEmail();
    markLocal();
    showDone(true);
  });

  renderCal();
  fetchLive(true);
  setInterval(() => { if (!document.hidden) fetchLive(true); }, (APPT.refreshSec || 90) * 1000);
})();"""

s = s[:start] + NEW + s[end:]

# ---------- 4. a place to show the sync state ----------
sub("""        <div class="cal-legend">
          <span><b></b> Slots free</span>
          <span><b class="grey"></b> Fully booked / closed</span>
        </div>""",
"""        <div class="cal-legend">
          <span><b></b> Slots free</span>
          <span><b class="grey"></b> Fully booked / closed</span>
        </div>
        <p class="note" id="liveNote" style="text-align:left;margin-top:10px"></p>""")

open(p, 'w').write(s)
print('backend wired —', len(s), 'bytes')
