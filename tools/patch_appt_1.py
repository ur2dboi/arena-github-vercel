#!/usr/bin/env python3
"""Add the appointment booking system (calendar + slots + policy) to index.html."""
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
# 1. CSS
# ============================================================
sub("""/* ---------- reveal ---------- */""",
"""/* ---------- appointment booking ---------- */
.appt-grid{display:grid;grid-template-columns:1.02fr .98fr;gap:26px;align-items:start}
.panel{background:var(--white);border:1px solid var(--gold-line-2);border-radius:var(--radius);padding:clamp(20px,2.6vw,30px);box-shadow:var(--shadow)}
.step-label{display:flex;align-items:center;gap:10px;font-size:.62rem;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);margin-bottom:16px}
.step-label i{width:22px;height:22px;border:1px solid var(--gold-line);border-radius:50%;display:grid;place-items:center;font-style:normal;font-family:var(--serif);font-size:.78rem;letter-spacing:0;flex:none}
.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.cal-title{font-family:var(--serif);font-size:1.32rem;letter-spacing:.02em}
.cal-nav{display:flex;gap:8px}
.cal-nav button{width:38px;height:38px;border-radius:50%;border:1px solid var(--gold-line);background:transparent;color:var(--gold);display:grid;place-items:center;transition:.25s}
.cal-nav button:hover:not(:disabled){background:var(--cream-2);border-color:var(--gold)}
.cal-nav button:disabled{opacity:.3;cursor:not-allowed}
.cal-nav svg{width:13px;height:13px}
.cal-dow,.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.cal-dow div{text-align:center;font-size:.58rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);padding-bottom:8px;font-weight:400}
.cal-day{position:relative;aspect-ratio:1/1;min-height:38px;border:1px solid transparent;background:transparent;border-radius:10px;font-family:var(--sans);font-size:.92rem;font-weight:300;color:var(--ink);display:grid;place-items:center;transition:background .25s,border-color .25s,color .25s,transform .25s}
.cal-day.open:hover,.cal-day.partial:hover{border-color:var(--gold-line);background:var(--cream);transform:translateY(-1px)}
.cal-day:disabled{color:#C6BCA6;cursor:not-allowed}
.cal-day.empty{pointer-events:none}
.cal-day.full{color:#BEA98F;text-decoration:line-through;text-decoration-thickness:1px}
.cal-day.today::after{content:"";position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--gold-soft)}
.cal-day.partial::before{content:"";position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--gold-2)}
.cal-day.sel{background:var(--metal);color:#3A2A08;font-weight:500;box-shadow:0 8px 18px -10px rgba(150,105,25,.8)}
.cal-day.sel::before,.cal-day.sel::after{background:#3A2A08}
.cal-legend{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:16px;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.cal-legend span{display:inline-flex;align-items:center;gap:7px}
.cal-legend b{width:6px;height:6px;border-radius:50%;background:var(--gold-2);display:inline-block}
.cal-legend b.grey{background:#C6BCA6}
.slots{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.slot{padding:13px 6px;border:1px solid var(--gold-line-2);border-radius:10px;background:var(--cream);font-family:var(--sans);font-size:.82rem;font-weight:300;color:var(--ink);transition:.25s;line-height:1.2}
.slot:hover:not(:disabled){border-color:var(--gold);background:var(--white);transform:translateY(-1px)}
.slot.sel{background:var(--metal);color:#3A2A08;border-color:transparent;font-weight:500}
.slot:disabled{color:#B9AF9A;cursor:not-allowed;background:transparent;text-decoration:line-through}
.slot small{display:block;margin-top:4px;font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--muted)}
.slot.sel small{color:#5A4410}
.chosen{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}
.chosen div{flex:1 1 140px;border:1px dashed var(--gold-line);border-radius:12px;padding:12px 14px;background:var(--cream)}
.chosen .k{font-size:.56rem;letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
.chosen .v{font-family:var(--serif);font-size:1.06rem;color:var(--ink);margin-top:3px}
.chosen .v.blank{color:#BEA98F;font-family:var(--sans);font-size:.86rem}
.policy{background:linear-gradient(180deg,#FFFDF6,#FBF3DF);border:1px solid var(--gold-line);border-radius:14px;padding:clamp(18px,2.4vw,26px);margin-top:6px}
.policy h4{font-family:var(--serif);font-size:1.24rem;margin-bottom:8px}
.policy p{font-size:.9rem;color:var(--ink-2)}
.policy ul{list-style:none;margin:12px 0 14px;padding:0}
.policy li{position:relative;padding-left:19px;font-size:.88rem;color:var(--ink-2);margin-bottom:7px;line-height:1.6}
.policy li::before{content:"";position:absolute;left:2px;top:.62em;width:5px;height:5px;background:var(--gold-2);transform:rotate(45deg)}
.policy .fee{font-family:var(--serif);font-size:1.5rem;color:var(--gold);line-height:1}
.policy .fine{font-size:.78rem;color:var(--muted);border-top:1px solid var(--gold-line-2);padding-top:12px;margin-bottom:0}
.maps-note{display:flex;gap:11px;align-items:flex-start;background:var(--cream-2);border:1px solid var(--gold-line-2);border-radius:12px;padding:14px 16px;margin-top:14px;font-size:.86rem;color:var(--ink-2)}
.maps-note .ic{width:20px;height:20px;color:var(--gold-2);flex:none;margin-top:2px}
.maps-note .ic svg{width:100%;height:100%}
.agree{display:flex;gap:11px;align-items:flex-start;margin:18px 0 0;font-size:.86rem;color:var(--ink-2);cursor:pointer;line-height:1.55}
.agree input{appearance:none;-webkit-appearance:none;width:20px;height:20px;flex:none;border:1px solid var(--gold-line);border-radius:6px;background:var(--cream);margin:2px 0 0;position:relative;cursor:pointer;transition:.2s}
.agree input:checked{background:var(--metal);border-color:transparent}
.agree input:checked::after{content:"";position:absolute;left:6px;top:2px;width:6px;height:11px;border:solid #3A2A08;border-width:0 2px 2px 0;transform:rotate(45deg)}
.agree.err input{border-color:#C0503A;box-shadow:0 0 0 3px rgba(192,80,58,.12)}
.form-err{display:none;background:#FDF1EC;border:1px solid rgba(192,80,58,.35);color:#8E3A26;border-radius:10px;padding:12px 14px;font-size:.86rem;margin-top:14px}
.form-err.show{display:block}
.done{display:none;margin-top:20px;border:1px solid var(--gold-line);background:linear-gradient(180deg,#FFFDF6,#FBF3DF);border-radius:14px;padding:clamp(18px,2.4vw,26px)}
.done.show{display:block;animation:fade .45s ease}
.done h4{font-family:var(--serif);font-size:1.36rem;margin-bottom:6px}
.done .summary{margin:16px 0;border:1px solid var(--gold-line-2);border-radius:12px;background:var(--white);overflow:hidden}
.done .summary div{display:flex;justify-content:space-between;gap:14px;padding:11px 15px;border-bottom:1px solid var(--gold-line-2);font-size:.9rem}
.done .summary div:last-child{border-bottom:0}
.done .summary .k{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);align-self:center}
.done .summary .v{font-family:var(--serif);font-size:1.04rem;text-align:right}
.done .acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}

/* ---------- reveal ---------- */""")

# responsive tweaks
sub(""".f-grid{grid-template-columns:1fr 1fr;gap:28px}
}""",
""".f-grid{grid-template-columns:1fr 1fr;gap:28px}
}""")
sub("""@media (max-width:900px){
  .menu,.nav-cta .btn{display:none}""",
"""@media (max-width:900px){
  .appt-grid{grid-template-columns:1fr}
  .menu,.nav-cta .btn{display:none}""")
sub("""  .f-row{grid-template-columns:1fr}
  .f-grid{grid-template-columns:1fr}""",
"""  .f-row{grid-template-columns:1fr}
  .f-grid{grid-template-columns:1fr}
  .slots{grid-template-columns:repeat(2,1fr)}
  .cal-day{font-size:.86rem}""")

# ============================================================
# 2. navigation
# ============================================================
sub("""        <li><a href="#process">How to Order</a></li>""",
"""        <li><a href="#appointment">Book Appointment</a></li>""")
sub("""    <a href="#process">How to Order</a>""",
"""    <a href="#process">How to Order</a>
    <a href="#appointment">Book an Appointment</a>""")

# hero + band CTAs
sub("""        <a class="btn btn-ghost" href="#contact">Request a custom piece</a>""",
"""        <a class="btn btn-ghost" href="#appointment">Book an appointment</a>""")
sub("""      <a class="btn btn-gold" href="tel:+639764637003" data-site-href="tel">Call or text <span data-site="phone">0976 463 7003</span></a>
      <a class="btn btn-ghost" href="https://www.facebook.com/profile.php?id=61555388537341\"""",
"""      <a class="btn btn-gold" href="#appointment">Book an appointment</a>
      <a class="btn btn-ghost" href="tel:+639764637003" data-site-href="tel">Call or text <span data-site="phone">0976 463 7003</span></a>
      <a class="btn btn-ghost" href="https://www.facebook.com/profile.php?id=61555388537341\"""")

open(p, 'w').write(s)
print('part 1 (css + nav) applied —', len(s), 'bytes')
