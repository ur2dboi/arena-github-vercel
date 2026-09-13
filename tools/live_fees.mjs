// Checks the dashboard's "Fees collected" figure against the LIVE sheet.
//   HUXLEY_PASS=... node tools/live_fees.mjs
//
// Only a fee the shop explicitly marked Paid (or Deducted) is money collected.
// The old Code.gs tested the fee cell with /Paid/i, which also matches the word
// "Unpaid", so every booking nobody had paid for was counted as ₱1,000.
//
// So this script FAILS on a deployment still running that old code — that is
// the signal to republish: Apps Script ▸ Deploy ▸ Manage deployments ▸ pencil ▸
// Version: New version ▸ Deploy. It prints the rows behind the number either way.
import fs from 'fs';

const url = fs.readFileSync('/home/user/index.html', 'utf8')
  .match(/apiUrl\s*:\s*'([^']+)'/)[1];
const USER = process.env.HUXLEY_USER || 'adminhuxley';
const PASS = process.env.HUXLEY_PASS || '';

const state = f => {
  const k = String(f == null ? '' : f).trim().toLowerCase();
  return k === 'paid' ? 'Paid' : k === 'deducted' ? 'Deducted' : 'Unpaid';
};

const post = async body => {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request: no CORS preflight
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { ok: false, error: 'non-JSON: ' + t.slice(0, 120) }; }
};

console.log('backend:', url, '\n');
const out = await post({ action: 'admin', op: 'list', user: USER, password: PASS });
if (!out.ok) {
  console.log('  ✗ could not read the sheet →', out.error || JSON.stringify(out).slice(0, 120));
  process.exit(1);
}

const rows = out.appointments || [];
const tally = {};
rows.forEach(r => { const s = state(r.fee); tally[s] = (tally[s] || 0) + 1; });
const truth = ((tally.Paid || 0) + (tally.Deducted || 0)) * 1000;
const server = Number(out.stats && out.stats.revenue || 0);

for (const r of rows) console.log('  · ' + r.id + '  ' + state(r.fee).padEnd(8) + '  ' + r.name + '  (' + r.status + ')');
console.log('\n  bookings: ' + rows.length + '   fee cells: ' + (JSON.stringify(tally) || '{}'));
console.log('  backend says Fees collected: ₱' + server.toLocaleString());
console.log('  truth (Paid + Deducted only): ₱' + truth.toLocaleString());

const pass = server === truth;
console.log(pass
  ? '\nPASS — the live backend counts only fees that were actually collected.'
  : '\nFAIL — the live backend still counts bookings nobody paid for.\n       Republish Code.gs: Deploy ▸ Manage deployments ▸ pencil ▸ Version: New version ▸ Deploy.');
process.exit(pass ? 0 : 1);
