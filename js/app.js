/* MedStation Practice Simulator — application logic.
 * Plain JavaScript, no build step. State lives in localStorage on the student's device. */
(() => {
'use strict';

const F = FORMULARY;
const STORE_KEY = 'medsim.v1';
const HOUR = 3600000, MIN = 60000;

/* ---------- utilities ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => String(parseFloat(Number(n).toFixed(3)));
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = n => String(n).padStart(2, '0');
const hhmm = t => { const d = new Date(t); return pad(d.getHours()) + pad(d.getMinutes()); };
const dateStr = t => new Date(t).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const clone = o => JSON.parse(JSON.stringify(o));
const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();

const medLabel = id => { const m = F[id]; return m.name + (m.brand ? ` (${m.brand})` : ''); };
const medDesc = id => { const m = F[id]; return m.desc || `${num(m.strength)} ${m.unit} ${m.form}`; };
const unitWord = (id, q) => { const f = F[id].form; const w = { tab: 'tab', cap: 'cap', vial: 'vial', Carpuject: 'Carpuject', syringe: 'syringe', pen: 'pen', neb: 'nebule', kit: 'kit' }[f] || f; return q === 1 ? w : w + 's'; };
const volOf = (id, amt) => { const m = F[id]; return m.volume ? amt * m.volume / m.strength : null; };
const amtText = (id, amt) => { const v = volOf(id, amt); return `${num(amt)} ${F[id].unit}` + (v != null ? ` (${num(v)} mL)` : ''); };
const PAT = id => PATIENTS.find(p => p.id === id);
const patName = p => `${p.last}, ${p.first} ${p.mi || ''}`.trim();
const age = dob => { const b = new Date(dob), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const fmtDob = dob => { const [y, m, d] = dob.split('-'); return `${m}/${d}/${y}`; };
const orderById = oid => { for (const p of PATIENTS) { const o = p.orders.find(x => x.id === oid); if (o) return o; } return null; };
const doseText = o => o.dose != null ? `${num(o.dose)}` : `${num(o.doseMin)}–${num(o.doseMax)}`;
const sig = o => `${doseText(o)} ${F[o.med].unit} ${F[o.med].route} ${o.freq}${o.prn ? ' PRN ' + o.prn : ''}`;
const freqHours = f => { const m = /^q(\d+)h/.exec(f); return m ? +m[1] : null; };
const userName = id => { const u = db.users[id]; return u ? `${u.last}, ${u.first} ${u.title || ''}`.trim() : id; };
const scenById = id => SCENARIOS.find(s => s.id === id);

/* ---------- persistent state ---------- */
let db;
function freshPractice(base = db) {
  base.base = Date.now();
  base.inventory = {}; base.physical = {};
  for (const [id, m] of Object.entries(F)) { base.inventory[id] = m.count; base.physical[id] = m.count + (m.physicalOffset || 0); }
  base.orders = {}; base.tx = []; base.removals = []; base.discrepancies = []; base.myPatients = {};
  return base;
}
function freshDb() { return freshPractice({ v: 1, users: clone(USERS), settings: { challenge: false }, scen: null }); }
function load() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const d = JSON.parse(raw); if (d && d.v === 1) return d; } } catch {}
  return freshDb();
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch {} }
db = load();
// Keep the simulated shift current if the student comes back another day.
if (Date.now() - db.base > 10 * HOUR) { db.base = Date.now(); db.orders = {}; }

const session = { user: null, screen: 'standby', listTab: 'my', sel: null, mode: 'remove', tab: 'due', cart: [], reportAll: false };

/* ---------- scenario engine ---------- */
function emit(type, data = {}) {
  const e = { type, ...data };
  const sc = db.scen;
  if (!sc || sc.done) return;
  const S = scenById(sc.id);
  const addErr = msg => { if (!sc.errors.includes(msg)) sc.errors.push(msg); };
  if (S.patient && e.type === 'removed' && e.patient !== S.patient) addErr(`Removed ${medLabel(e.med)} for the wrong patient (${patName(PAT(e.patient))}).`);
  if (S.patient && e.type === 'patient_action' && e.patient !== S.patient && PAT(e.patient).nameAlert && PAT(S.patient).nameAlert)
    addErr('Selected the wrong patient with a similar name — verify two identifiers (name + DOB or MRN).');
  (S.errorRules || []).forEach(r => r.match(e) && addErr(r.msg));

  let idx = S.steps.findIndex((s, j) => j >= sc.step && s.match(e));
  while (idx !== -1) {
    for (let k = sc.step; k < idx; k++) sc.missed.push(k);
    sc.step = idx + 1;
    idx = (sc.step < S.steps.length && S.steps[sc.step].match(e)) ? sc.step : -1;
  }
  if (sc.step >= S.steps.length) {
    sc.done = true; sc.end = Date.now();
    setTimeout(() => toast('Scenario complete — see your results in the Practice Coach.', 'good', () => $('#coach').scrollIntoView({ behavior: 'smooth' })), 400);
  }
  save(); renderCoach();
}

function startScenario(id) {
  const S = scenById(id);
  freshPractice();
  if (id === 's1') Object.assign(db.users.student, { password: '123456', mustChange: true, bioid: false, deviceCred: null, bioPrompted: false });
  // Later scenarios assume the student already has My Patients set up.
  if (id !== 's1') db.myPatients.student = ['P1', 'P2', 'P3', 'P4'];
  db.scen = { id, step: 0, missed: [], errors: [], start: Date.now(), done: false };
  save();
  cancelFlows();
  session.user = null; session.sel = null; session.cart = [];
  go('standby');
  toast(`Scenario started: ${S.title}`);
}

/* ---------- DOM refs ---------- */
const screenEl = $('#screen'), topbar = $('#topbar'), titlebar = $('#titlebar'), content = $('#content'), actionbar = $('#actionbar'), overlay = $('#overlay');

/* ---------- pending-input machinery (for step-by-step flows and modals) ---------- */
const pend = [];
function waitIn(root, validate) { return new Promise(resolve => pend.push({ root, resolve, validate })); }
function formData(root) {
  const d = {};
  root.querySelectorAll('input, select, textarea').forEach(el => {
    const k = el.name || el.id; if (!k) return;
    if (el.type === 'radio') { if (el.checked) d[k] = el.value; else if (!(k in d)) d[k] = ''; }
    else if (el.type === 'checkbox') d[k] = el.checked;
    else d[k] = el.value.trim();
  });
  return d;
}
function showErr(root, msg) { const el = root.querySelector('.err'); if (el) { el.textContent = msg; el.hidden = false; } }
function cancelFlows() { pend.length = 0; overlay.hidden = true; overlay.innerHTML = ''; }

function btns(list) {
  return list.map(b => `<button type="button" class="btn ${b.cls || (b.primary ? 'primary' : '')}" data-resolve="${esc(b.value)}"${b.primary ? ' data-primary' : ''}${b.novalidate ? ' data-novalidate' : ''}${b.disabled ? ' disabled' : ''}>${b.label}</button>`).join('');
}
function modal({ title, body, buttons, validate, cls = '' }) {
  overlay.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="mtitle"><h2 id="mtitle">${title}</h2><div class="modal-body">${body}</div><div class="err" role="alert" hidden></div><div class="modal-btns">${btns(buttons)}</div></div>`;
  overlay.hidden = false;
  const first = overlay.querySelector('input:not([type=radio]):not([type=hidden]), select, textarea') || overlay.querySelector('[data-primary]');
  if (first) setTimeout(() => first.focus(), 30);
  return waitIn(overlay, validate).then(r => { overlay.hidden = true; overlay.innerHTML = ''; return r; });
}
function step({ title, body, buttons, validate, after }) {
  screenEl.className = 'screen';
  titlebar.innerHTML = titleHtml(title);
  content.innerHTML = body + '<div class="err" role="alert" hidden></div>';
  content.scrollTop = 0;
  actionbar.innerHTML = btns(buttons);
  topbar.innerHTML = renderTopbar();
  if (after) after();
  const first = content.querySelector('input:not([type=radio]), select');
  if (first) setTimeout(() => first.focus(), 30);
  return waitIn(screenEl, validate);
}
const info = (title, body, label = 'OK', cls = '') => modal({ title, body, cls, buttons: [{ label, value: 'ok', primary: true }] });

function toast(msg, kind = '', onClick) {
  const t = document.createElement('div');
  t.className = 'toast ' + kind; t.textContent = msg; t.setAttribute('role', 'status');
  if (onClick) { t.style.cursor = 'pointer'; t.addEventListener('click', onClick); }
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
  box.appendChild(t);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3600);
}

/* ---------- global event delegation ---------- */
document.addEventListener('click', e => {
  const r = e.target.closest('[data-resolve]');
  if (r && !r.disabled) {
    const p = [...pend].reverse().find(p => p.root.contains(r));
    if (p) {
      const value = r.dataset.resolve, data = formData(p.root);
      if (p.validate && !r.hasAttribute('data-novalidate')) {
        const err = p.validate(value, data);
        if (err) { showErr(p.root === screenEl && !overlay.contains(r) ? content : p.root, err); return; }
      }
      pend.splice(pend.indexOf(p), 1);
      p.resolve({ value, data });
      return;
    }
  }
  const a = e.target.closest('[data-act]');
  if (a && !a.disabled && ACT[a.dataset.act]) { e.preventDefault(); ACT[a.dataset.act](a.dataset, a); }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'BUTTON') return;
  if (e.target.matches('[data-scanner]')) { e.preventDefault(); finishScan(e.target); return; }
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') return;
  const root = overlay.contains(e.target) ? overlay : screenEl;
  const b = root.querySelector('[data-primary]:not([disabled])');
  if (b) { e.preventDefault(); b.click(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.filter != null) {
    const q = t.value.trim().toLowerCase();
    content.querySelectorAll('[data-filterable]').forEach(r => { r.hidden = q && !r.dataset.filterable.toLowerCase().includes(q); });
  }
  if (t.dataset.volfor) {
    const out = t.closest('.modal, .content').querySelector('.vol-out');
    const v = parseFloat(t.value);
    if (out) out.textContent = isNaN(v) ? '' : (volOf(t.dataset.volfor, v) != null ? `= ${num(volOf(t.dataset.volfor, v))} mL` : '');
  }
});

/* ---------- simulated fingerprint scanner ---------- */
const FINGERPRINT_SVG = `<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 46c2-5 3-9 3-14a11 11 0 0 1 22 0c0 6-1 11-3 15"/><path d="M26 50c2-5 3-11 3-18a3 3 0 0 1 6 0c0 8-1 14-4 20"/><path d="M12 38c1-3 1-4 1-7a19 19 0 0 1 38 0c0 4 0 8-1 11"/><path d="M36 54c2-4 3-8 3.5-12"/><path d="M16 17a22 22 0 0 1 32 0"/><path d="M20 12a26 26 0 0 1 24 0"/></g></svg>`;
function scannerHtml(msg) {
  return `<div class="scanner-wrap"><div class="scanner" data-scanner tabindex="0" role="button" aria-label="Fingerprint scanner. Press and hold, or press Enter.">${FINGERPRINT_SVG}<span class="scan-ring"></span></div>
    <p class="scan-msg">${msg}</p><button type="button" hidden data-resolve="scan-ok" data-novalidate></button><button type="button" hidden data-resolve="scan-fail" data-novalidate></button></div>`;
}
let scanTimer = null;
function finishScan(el) { el.classList.remove('pressing'); el.classList.add('ok'); setTimeout(() => el.closest('.scanner-wrap')?.querySelector('[data-resolve="scan-ok"]')?.click(), 350); }
document.addEventListener('pointerdown', e => {
  const s = e.target.closest('[data-scanner]'); if (!s || s.classList.contains('ok')) return;
  e.preventDefault(); s.classList.add('pressing');
  scanTimer = setTimeout(() => { scanTimer = null; finishScan(s); }, 1400);
});
const liftFinger = () => {
  const s = document.querySelector('[data-scanner].pressing'); if (!s || !scanTimer) return;
  clearTimeout(scanTimer); scanTimer = null; s.classList.remove('pressing');
  s.closest('.scanner-wrap')?.querySelector('[data-resolve="scan-fail"]')?.click();
};
document.addEventListener('pointerup', liftFinger);
document.addEventListener('pointercancel', liftFinger);
document.addEventListener('contextmenu', e => { if (e.target.closest('[data-scanner]')) e.preventDefault(); });

/* ---------- device biometrics (WebAuthn platform authenticator) ---------- */
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const DeviceBio = {
  async available() {
    try { return !!(window.PublicKeyCredential && window.isSecureContext && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
  },
  async register(u) {
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: rand(32), rp: { name: 'MedStation Practice Simulator' },
      user: { id: new TextEncoder().encode(u.id), name: u.id, displayName: `${u.first} ${u.last}` },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none' } });
    return b64(cred.rawId);
  },
  async verify(credId) {
    await navigator.credentials.get({ publicKey: { challenge: rand(32), allowCredentials: [{ type: 'public-key', id: unb64(credId), transports: ['internal', 'hybrid'] }], userVerification: 'required', timeout: 60000 } });
    return true;
  },
};
let deviceBioOk = false;
DeviceBio.available().then(v => { deviceBioOk = v; });

/* ---------- screen chrome ---------- */
function titleHtml(t) { return t ? `<h1>${t}</h1>` : ''; }
function undocFor(userId) { return db.removals.filter(r => r.undocumented && r.user === userId); }
function renderTopbar() {
  const now = Date.now();
  const u = session.user;
  const undoc = u ? undocFor(u).length : 0;
  const disc = db.discrepancies.filter(d => !d.resolved).length;
  return `<div class="tb-device"><b>4W-MAIN</b><span>4 West Medical-Surgical</span></div>
    <div class="tb-clock"><span class="clock">${hhmm(now)}</span><span class="tb-date">${dateStr(now)}</span></div>
    <div class="tb-user">
      ${disc ? `<button class="ind ind-disc" data-act="go" data-to="disc" title="Unresolved discrepancy" aria-label="Unresolved discrepancies: ${disc}">Δ ${disc}</button>` : ''}
      ${undoc ? `<button class="ind ind-waste" data-act="go" data-to="undoc" title="You have undocumented waste" aria-label="Undocumented waste: ${undoc}">W ${undoc}</button>` : ''}
      ${u ? `<span class="tb-name">${esc(userName(u))}</span><button class="btn small ghost" data-act="home">Home</button><button class="btn small signout" data-act="signout">Sign Out</button>` : ''}
    </div>`;
}
setInterval(() => { const c = topbar.querySelector('.clock'); if (c) c.textContent = hhmm(Date.now()); }, 15000);

function go(screen, extra = {}) { Object.assign(session, extra); session.screen = screen; render(); }
function render() {
  cancelFlows();
  const out = (SCREENS[session.screen] || SCREENS.standby)();
  screenEl.className = 'screen ' + (out.cls || '');
  topbar.innerHTML = renderTopbar();
  titlebar.innerHTML = titleHtml(out.title);
  content.innerHTML = out.body;
  actionbar.innerHTML = out.footer || '';
  content.scrollTop = 0;
  save();
  renderCoach();
}

/* ---------- order status ---------- */
function orderStatus(o) {
  const st = db.orders[o.id] || {};
  if (o.prn) return { kind: 'prn', last: st.lastRemoved, by: st.by };
  const due = db.base + o.dueIn * MIN;
  if (st.given) return { kind: 'given', due, at: st.given, by: st.by };
  const diff = (due - Date.now()) / MIN;
  if (diff < -30) return { kind: 'pastdue', due };
  if (diff <= 60) return { kind: 'due', due };
  return { kind: 'future', due };
}
function patientCounts(p) {
  let due = 0, past = false, prn = 0;
  p.orders.forEach(o => { const s = orderStatus(o); if (s.kind === 'due' || s.kind === 'pastdue') due++; if (s.kind === 'pastdue') past = true; if (s.kind === 'prn') prn++; });
  return { due, past, prn, all: p.orders.length };
}
const allergyText = p => p.allergies.length ? p.allergies.map(a => `${a.agent} (${a.reaction})`).join(', ') : 'NKDA';

function patientBanner(p) {
  return `<div class="pt-banner">
    <div class="pt-id"><b>${esc(patName(p))}</b>${p.nameAlert ? '<span class="chip alert">NAME ALERT</span>' : ''}
      <span class="muted">MRN <span class="mono">${p.mrn}</span> · DOB <span class="mono">${fmtDob(p.dob)}</span> (${age(p.dob)} y, ${p.sex}) · Rm <span class="mono">${p.room}</span></span></div>
    <div class="pt-allergy ${p.allergies.length ? 'has' : ''}"><b>Allergies:</b> ${esc(allergyText(p))}</div>
    <div class="pt-dx muted">${esc(p.dx)} · ${esc(p.provider)}</div>
  </div>`;
}

/* ---------- drawer / cabinet graphics ---------- */
const POCKETS = {
  MiniDrawer: ['1', '2', '3', '4', '5', '6', '7', '8'],
  Matrix: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  CUBIE: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'],
  Fridge: ['1', '2', '3', '4', '5', '6'],
};
function locText(id) {
  const L = F[id].loc;
  return L.type === 'Fridge' ? `Refrigerator · Secure Bin ${L.pocket}` : `Main · Drawer ${L.drawer} · ${L.type} · Pocket ${L.pocket}`;
}
function unitIcon(id) {
  const f = F[id].form;
  const cls = { tab: 'pill', cap: 'cap', Carpuject: 'syr', syringe: 'syr', vial: 'vial', pen: 'pen', neb: 'neb', kit: 'kit' }[f] || 'pill';
  return `<i class="u u-${cls}"></i>`;
}
function drawerView(id, { contents = 'label', note = '' } = {}) {
  const L = F[id].loc;
  const cab = `<div class="cabinet" aria-hidden="true">
      <div class="cab-col"><div class="cab-top">Main</div>${[1, 2, 3, 4, 5, 6].map(n => `<div class="cab-drawer ${L.drawer === n ? 'lit' : ''}">${n}</div>`).join('')}</div>
      <div class="cab-col side"><div class="cab-fridge ${L.drawer === 'F' ? 'lit' : ''}">Fridge</div><div class="cab-return">Return<br>Bin</div></div>
    </div>`;
  const grid = `<div class="pocket-grid t-${L.type}" aria-hidden="true">${POCKETS[L.type].map(pk => `<div class="pocket ${String(L.pocket) === pk ? 'open' : ''}">${pk}</div>`).join('')}</div>`;
  const n = Math.max(0, db.physical[id]);
  let inner = '';
  if (contents === 'items') inner = `<div class="pocket-zoom" role="img" aria-label="Open pocket containing ${n} ${unitWord(id, n)}">${n ? Array.from({ length: Math.min(n, 60) }, () => unitIcon(id)).join('') : '<span class="muted">Empty</span>'}</div>`;
  else inner = `<div class="pocket-zoom label"><b>${esc(medLabel(id))}</b><span>${esc(medDesc(id))}</span></div>`;
  return `<div class="drawer-view">
      <div class="dv-loc"><span class="light"></span><div><b>${locText(id)}</b><span class="muted">${L.type === 'Fridge' ? 'The secure bin light is on.' : 'The drawer is open and the pocket light is on.'}</span></div></div>
      <div class="dv-art">${cab}<div class="dv-drawer"><div class="dv-drawer-label">${L.type === 'Fridge' ? 'Refrigerator bins' : 'Drawer ' + L.drawer + ' · ' + L.type}</div>${grid}</div><div class="dv-pocket"><div class="dv-drawer-label">Pocket ${L.pocket}</div>${inner}</div></div>
      ${note}
    </div>`;
}

/* ---------- screens ---------- */
const SCREENS = {
  standby() {
    return { cls: 'standby', body: `<button class="standby-btn" data-act="signin">
        <span class="sb-kicker">4W-MAIN · 4 West Medical-Surgical</span>
        <span class="sb-title">MedStation</span>
        <span class="sb-sub">Touch the screen to sign in</span>
        <span class="sb-time mono">${hhmm(Date.now())}</span>
      </button>` };
  },

  home() {
    const u = session.user;
    const my = (db.myPatients[u] || []).length;
    const undoc = undocFor(u).length;
    const disc = db.discrepancies.filter(d => !d.resolved).length;
    const tile = (act, to, label, sub, extra = '', badge = '') => `<button class="tile ${extra}" data-act="${act}" data-to="${to}"><span class="t-label">${label}</span><span class="t-sub">${sub}</span>${badge}</button>`;
    return { title: 'Home', body: `
      ${undoc ? `<button class="banner blue" data-act="go" data-to="undoc"><b>You have undocumented waste.</b> Select to document it now (${undoc}).</button>` : ''}
      ${disc ? `<button class="banner red" data-act="go" data-to="disc"><b>Unresolved discrepancy on this device.</b> Resolve before the end of your shift.</button>` : ''}
      <div class="tiles">
        ${tile('list', 'my', 'My Patients', my ? `${my} patient${my > 1 ? 's' : ''} on your list` : 'Build your assignment list')}
        ${tile('list', 'all', 'All Available Patients', `${PATIENTS.length} patients on 4 West`)}
        ${tile('go', 'undoc', 'Undocumented Waste', undoc ? `${undoc} to document` : 'Nothing pending', undoc ? 'warn' : '', undoc ? `<span class="badge">${undoc}</span>` : '')}
        ${tile('go', 'disc', 'Discrepancies', disc ? `${disc} unresolved` : 'None open', disc ? 'danger' : '', disc ? `<span class="badge red">${disc}</span>` : '')}
        ${tile('go', 'find', 'Global Find', 'Locate any medication')}
        ${tile('go', 'reports', 'Reports', 'Activity by user or patient')}
        ${tile('go', 'prefs', 'User Preferences', 'Password & BioID')}
      </div>` };
  },

  patients() {
    const u = session.user;
    const my = session.listTab === 'my';
    const ids = my ? (db.myPatients[u] || []) : PATIENTS.map(p => p.id);
    const list = ids.map(PAT).filter(Boolean).sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first));
    const sel = list.find(p => p.id === session.sel) ? session.sel : null;
    const rows = list.map(p => {
      const c = patientCounts(p);
      const undoc = db.removals.some(r => r.undocumented && r.patient === p.id);
      return `<div class="prow ${sel === p.id ? 'sel' : ''} ${c.past ? 'pastdue' : ''}" data-filterable="${esc(p.last + ' ' + p.first + ' ' + p.room + ' ' + p.mrn)}">
        <button class="prow-main" data-act="selPatient" data-id="${p.id}" aria-pressed="${sel === p.id}">
          <span class="pr-name"><span class="pr-title"><b>${esc(patName(p))}</b>${p.nameAlert ? ' <span class="chip alert">NAME ALERT</span>' : ''}${p.allergies.length ? ' <span class="chip allergy">ALLERGY</span>' : ''}${undoc ? ' <span class="chip waste">UNDOC WASTE</span>' : ''}</span>
            <span class="muted small"><span class="rm-inline">Rm <span class="mono">${p.room}</span> · </span>MRN <span class="mono">${p.mrn}</span> · DOB <span class="mono">${fmtDob(p.dob)}</span></span></span>
          <span class="pr-room mono">${p.room}</span>
        </button>
        <span class="pr-col">${c.due ? `<button class="dot ${c.past ? 'past' : ''}" data-act="dot" data-id="${p.id}" data-tab="due" aria-label="${c.due} due now">${c.due}</button>` : '<span class="nodot">–</span>'}</span>
        <span class="pr-col">${c.prn ? `<button class="dot prn" data-act="dot" data-id="${p.id}" data-tab="prn" aria-label="${c.prn} PRN orders">${c.prn}</button>` : '<span class="nodot">–</span>'}</span>
        <span class="pr-col"><button class="dot all" data-act="dot" data-id="${p.id}" data-tab="all" aria-label="${c.all} orders">${c.all}</button></span>
      </div>`;
    }).join('');
    const dis = sel ? '' : ' disabled';
    return { title: my ? 'My Patients' : 'All Available Patients', body: `
      <div class="seg" role="tablist"><button class="${my ? 'on' : ''}" data-act="list" data-to="my" role="tab" aria-selected="${my}">My Patients</button><button class="${!my ? 'on' : ''}" data-act="list" data-to="all" role="tab" aria-selected="${!my}">All Available Patients</button></div>
      <div class="list-tools"><input id="ptsearch" type="search" placeholder="Search last name, room or MRN" data-filter aria-label="Search patients">
        ${my ? '<button class="btn" data-act="go" data-to="editMy">Edit Patient List</button>' : ''}</div>
      ${list.length ? `<div class="ptable"><div class="phead"><span>Patient</span><span>Room</span><span class="pr-col">Due Now</span><span class="pr-col">PRN</span><span class="pr-col">All Orders</span></div>${rows}</div>
        <p class="legend"><span class="dot mini"></span> due now · <span class="dot mini past"></span> past due (orange bar) · tap a dot to open that tab</p>`
      : `<div class="empty"><b>Your My Patients list is empty.</b><p>Select <b>Edit Patient List</b> and add the patients you are assigned to today.</p><button class="btn primary" data-act="go" data-to="editMy">Edit Patient List</button></div>`}`,
      footer: `<button class="btn" data-act="pa" data-a="remove"${dis}>Remove</button><button class="btn" data-act="pa" data-a="return"${dis}>Return</button><button class="btn" data-act="pa" data-a="waste"${dis}>Waste</button><button class="btn override" data-act="pa" data-a="override"${dis}>Override</button><button class="btn" data-act="pa" data-a="past"${dis}>Past Removed</button>` };
  },

  editMy() {
    const u = session.user;
    if (!session.editList) session.editList = [...(db.myPatients[u] || [])];
    const mine = session.editList;
    return { title: 'Edit My Patients', body: `<p class="muted">Tap a patient on the left to add them to your list. Tap × to remove.</p>
      <div class="two-col">
        <div><h3>All Available Patients</h3>${PATIENTS.map(p => `<button class="pick ${mine.includes(p.id) ? 'added' : ''}" data-act="addMy" data-id="${p.id}"${mine.includes(p.id) ? ' disabled' : ''}><b>${esc(patName(p))}</b> <span class="mono muted">${p.room}</span>${p.nameAlert ? ' <span class="chip alert">NAME ALERT</span>' : ''}</button>`).join('')}</div>
        <div><h3>My Patients (${mine.length})</h3>${mine.length ? mine.map(id => { const p = PAT(id); return `<div class="pick in"><span><b>${esc(patName(p))}</b> <span class="mono muted">${p.room}</span></span><button class="x" data-act="delMy" data-id="${id}" aria-label="Remove ${esc(patName(p))}">×</button></div>`; }).join('') : '<p class="muted">No patients yet.</p>'}</div>
      </div>`,
      footer: `<button class="btn" data-act="cancelMy">Cancel</button><button class="btn primary" data-act="saveMy">Accept</button>` };
  },

  profile() {
    const p = PAT(session.sel);
    const ov = session.mode === 'override';
    const cart = session.cart;
    let listHtml;
    if (!ov) {
      const orders = p.orders.filter(o => { const s = orderStatus(o); return session.tab === 'all' || (session.tab === 'prn' ? s.kind === 'prn' : (s.kind === 'due' || s.kind === 'pastdue')); });
      listHtml = orders.length ? orders.map(o => {
        const s = orderStatus(o), m = F[o.med];
        let when = '';
        if (s.kind === 'due') when = `<span class="due now">Due ${hhmm(s.due)}</span>`;
        else if (s.kind === 'pastdue') when = `<span class="due past">PAST DUE ${hhmm(s.due)}</span>`;
        else if (s.kind === 'future') when = `<span class="due future">Next ${hhmm(s.due)}</span>`;
        else if (s.kind === 'given') when = `<span class="due given">Removed ${hhmm(s.at)}</span>`;
        else when = `<span class="due prn">PRN${s.last ? ' · last ' + hhmm(s.last) : ''}</span>`;
        const inCart = cart.some(c => c.orderId === o.id);
        return `<button class="mrow ${inCart ? 'incart' : ''} ${s.kind}" data-act="pickOrder" data-id="${o.id}" data-filterable="${esc(m.name + ' ' + m.brand)}">
          <span class="m-name"><b>${esc(medLabel(o.med))}</b> <span class="muted">${esc(medDesc(o.med))}</span>
            <span class="m-sig">${esc(sig(o))}</span>
            <span class="chips">${m.controlled ? `<span class="chip cs">${m.controlled}</span>` : ''}${o.dose == null ? '<span class="chip">RANGE DOSE</span>' : ''}${m.loc.type === 'Fridge' ? '<span class="chip fridge">REFRIGERATED</span>' : ''}${m.cdc ? '<span class="chip">CDC</span>' : ''}</span></span>
          <span class="m-when">${when}</span></button>`;
      }).join('') : `<p class="empty-line">No ${session.tab === 'due' ? 'medications due now' : session.tab === 'prn' ? 'PRN orders' : 'orders'} for this patient. Try <b>All Orders</b>.</p>`;
    } else {
      const meds = Object.keys(F).filter(id => F[id].override).sort((a, b) => F[a].name.localeCompare(F[b].name));
      listHtml = meds.map(id => { const m = F[id]; return `<button class="mrow override-row ${cart.some(c => c.med === id && c.override) ? 'incart' : ''}" data-act="pickOverride" data-id="${id}" data-filterable="${esc(m.name + ' ' + m.brand)}">
        <span class="stripes" aria-hidden="true"></span>
        <span class="m-name"><b>${esc(medLabel(id))}</b> <span class="muted">${esc(medDesc(id))}</span><span class="chips">${m.controlled ? `<span class="chip cs">${m.controlled}</span>` : ''}<span class="chip ov">OVERRIDE</span></span></span>
        <span class="m-when"><span class="due">${m.route}</span></span></button>`; }).join('');
    }
    const cartHtml = cart.length ? cart.map((c, i) => `<div class="cart-item ${c.override ? 'ov' : ''}"><div><b>${esc(medLabel(c.med))}</b><span class="muted">${esc(medDesc(c.med))}</span>
        <span>Dose <b>${num(c.dose)} ${F[c.med].unit}</b> · Remove <b>${c.qty} ${unitWord(c.med, c.qty)}</b>${c.override ? ' · <span class="ovtxt">Override</span>' : ''}</span></div>
        <button class="x" data-act="unpick" data-i="${i}" aria-label="Remove ${esc(medLabel(c.med))} from selected meds">×</button></div>`).join('') : '<p class="muted">Select medications on the left. They will appear here.</p>';
    return { title: ov ? 'Override — remove without pharmacist review' : 'Remove Medications', cls: ov ? 'mode-override' : '', body: `${patientBanner(p)}
      ${ov ? '<p class="warnline">Override bypasses pharmacist order review. Use it only for emergencies or when the order cannot be verified in time. Striped items are override medications.</p>' : ''}
      <div class="profile">
        <section class="plist">
          ${!ov ? `<div class="seg small" role="tablist">${[['due', 'Due Now'], ['prn', 'PRN'], ['all', 'All Orders']].map(([k, l]) => `<button class="${session.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}" role="tab" aria-selected="${session.tab === k}">${l}</button>`).join('')}</div>` : ''}
          <input type="search" id="medsearch" placeholder="Type the first 3 letters of the medication" data-filter aria-label="Search medications">
          <div class="mlist">${listHtml}</div>
        </section>
        <aside class="cart"><h3>Selected Meds <span class="muted">(${cart.length})</span></h3>${cartHtml}</aside>
      </div>`,
      footer: `<button class="btn" data-act="backList">Back</button>${ov ? '<button class="btn" data-act="mode" data-m="remove">Patient Profile</button>' : '<button class="btn override" data-act="mode" data-m="override">Override</button>'}<button class="btn primary" data-act="removeMeds"${cart.length ? '' : ' disabled'}>Remove Med</button>` };
  },

  returns() {
    const p = PAT(session.sel);
    const recent = db.removals.filter(r => r.patient === p.id && Date.now() - r.t < 24 * HOUR).sort((a, b) => b.t - a.t);
    const rows = recent.map(r => {
      const left = r.qty - r.returnedQty;
      const why = left <= 0 ? 'Already returned' : r.wasted > 0 ? 'Opened/partially used — waste documented. Cannot return.' : '';
      return `<button class="mrow ${why ? 'dim' : ''}" data-act="${why ? 'why' : 'doReturn'}" data-id="${r.id}" data-why="${esc(why)}">
        <span class="m-name"><b>${esc(medLabel(r.med))}</b> <span class="muted">${esc(medDesc(r.med))}</span><span class="m-sig">Removed ${r.qty} ${unitWord(r.med, r.qty)} at ${hhmm(r.t)} by ${esc(userName(r.user))}</span>${why ? `<span class="muted small">${why}</span>` : ''}</span>
        <span class="m-when">${F[r.med].controlled ? `<span class="chip cs">${F[r.med].controlled}</span>` : ''}</span></button>`;
    }).join('');
    return { title: 'Return Medication', body: `${patientBanner(p)}<p class="muted">Return an item only if its sealed packaging has not been opened. Removals from the past 24 hours are listed. Dimmed items cannot be returned — select one to see why.</p><div class="mlist">${rows || '<p class="empty-line">No removals for this patient in the last 24 hours.</p>'}</div>`,
      footer: `<button class="btn" data-act="backList">Back</button>` };
  },

  waste() {
    const p = PAT(session.sel);
    const recent = db.removals.filter(r => r.patient === p.id && F[r.med].controlled && Date.now() - r.t < 32 * HOUR).sort((a, b) => b.t - a.t);
    const rows = recent.map(r => {
      const left = Math.max(0, r.expectedWaste - r.wasted);
      return `<button class="mrow" data-act="doWaste" data-id="${r.id}">
        <span class="m-name"><b>${esc(medLabel(r.med))}</b> <span class="muted">${esc(medDesc(r.med))}</span><span class="m-sig">Removed ${r.qty} ${unitWord(r.med, r.qty)} at ${hhmm(r.t)} · dose ${num(r.dose)} ${F[r.med].unit} · by ${esc(userName(r.user))}</span>
          ${r.undocumented ? `<span class="chip waste">UNDOCUMENTED WASTE ${db.settings.challenge ? '' : amtText(r.med, left)}</span>` : r.wasted ? `<span class="muted small">Wasted ${amtText(r.med, r.wasted)}</span>` : ''}</span>
        <span class="m-when"><span class="chip cs">${F[r.med].controlled}</span></span></button>`;
    }).join('');
    return { title: 'Waste Medication', body: `${patientBanner(p)}<p class="muted">Controlled-substance removals from the past 32 hours. Select the medication to waste. A witness must watch the waste.</p><div class="mlist">${rows || '<p class="empty-line">No controlled-substance removals for this patient.</p>'}</div>`,
      footer: `<button class="btn" data-act="backList">Back</button><button class="btn" data-act="searchAllWaste">Search All Meds</button>` };
  },

  past() {
    const p = PAT(session.sel);
    const list = db.tx.filter(t => t.patient === p.id).sort((a, b) => b.t - a.t);
    return { title: 'Past Removed', body: `${patientBanner(p)}${txTable(list)}`, footer: `<button class="btn" data-act="backList">Back</button>` };
  },

  undoc() {
    const list = undocFor(session.user);
    return { title: 'Undocumented Waste', body: `<p class="muted">These controlled-substance removals left an unused portion that you have not documented. Select one and waste it with a witness.</p>
      <div class="mlist">${list.map(r => { const p = PAT(r.patient); const left = r.expectedWaste - r.wasted; return `<button class="mrow" data-act="doWaste" data-id="${r.id}">
        <span class="m-name"><b>${esc(patName(p))}</b> <span class="mono muted">${p.room}</span><span class="m-sig">${esc(medLabel(r.med))} ${esc(medDesc(r.med))} · removed ${hhmm(r.t)} · dose ${num(r.dose)} ${F[r.med].unit}</span></span>
        <span class="m-when"><span class="chip waste">${db.settings.challenge ? 'WASTE DUE' : amtText(r.med, left)}</span></span></button>`; }).join('') || '<p class="empty-line">No undocumented waste. Nice work.</p>'}</div>`,
      footer: `<button class="btn" data-act="home">Home</button>` };
  },

  disc() {
    const open = db.discrepancies.filter(d => !d.resolved), done = db.discrepancies.filter(d => d.resolved);
    const row = d => `<button class="mrow ${d.resolved ? 'dim' : ''}" data-act="${d.resolved ? 'noop' : 'resolveDisc'}" data-id="${d.id}">
      <span class="m-name"><b>${esc(medLabel(d.med))}</b> <span class="muted">${esc(medDesc(d.med))}</span><span class="m-sig">${locText(d.med)} · expected ${d.expected}, counted ${d.counted} · ${hhmm(d.t)} by ${esc(userName(d.user))}</span>${d.resolved ? `<span class="muted small">Resolved: ${esc(d.reason)} · witness ${esc(userName(d.witness))}</span>` : ''}</span>
      <span class="m-when">${d.resolved ? '<span class="chip">RESOLVED</span>' : '<span class="chip alert">OPEN</span>'}</span></button>`;
    return { title: 'Discrepancies', body: `<p class="muted">A discrepancy is created when a blind count does not match the expected inventory. The nurse who discovers it starts the resolution. Resolve open discrepancies before the end of your shift.</p>
      <div class="mlist">${open.map(row).join('') || '<p class="empty-line">No open discrepancies.</p>'}</div>${done.length ? `<h3>Resolved</h3><div class="mlist">${done.map(row).join('')}</div>` : ''}`,
      footer: `<button class="btn" data-act="home">Home</button>` };
  },

  find() {
    const ids = Object.keys(F).sort((a, b) => F[a].name.localeCompare(F[b].name));
    return { title: 'Global Find', body: `<input type="search" id="gfsearch" placeholder="Search medication (generic or brand)" data-filter aria-label="Search medications">
      <div class="mlist">${ids.map(id => { const m = F[id]; return `<div class="mrow static" data-filterable="${esc(m.name + ' ' + m.brand)}"><span class="m-name"><b>${esc(medLabel(id))}</b> <span class="muted">${esc(medDesc(id))}</span><span class="m-sig">4W-MAIN · ${locText(id)}</span><span class="chips">${m.controlled ? `<span class="chip cs">${m.controlled}</span>` : ''}${m.override ? '<span class="chip ov">OVERRIDE LIST</span>' : ''}</span></span><span class="m-when mono">On hand ${db.inventory[id]}</span></div>`; }).join('')}</div>`,
      footer: `<button class="btn" data-act="home">Home</button>` };
  },

  reports() {
    const list = db.tx.filter(t => session.reportAll || t.user === session.user).sort((a, b) => b.t - a.t);
    return { title: 'Reports', body: `<div class="seg small"><button class="${!session.reportAll ? 'on' : ''}" data-act="report" data-all="0">Activity by Current User</button><button class="${session.reportAll ? 'on' : ''}" data-act="report" data-all="1">All Activity (device)</button></div>
      ${txTable(list, true)}`,
      footer: `<button class="btn" data-act="home">Home</button><button class="btn" data-act="copyReport">Copy Report</button>${inFrame ? '' : '<button class="btn" data-act="print">Print</button>'}` };
  },

  prefs() {
    const u = db.users[session.user];
    return { title: 'User Preferences', body: `<div class="prefs">
      <div class="pref"><div><b>Password</b><span class="muted">Passwords are 6–8 letters or numbers. Change it every 3 months.</span></div><button class="btn" data-act="changePw">Change Password</button></div>
      <div class="pref"><div><b>BioID fingerprint</b><span class="muted">${u.bioid ? 'Registered.' : 'Not registered.'} Re-register if you injure the finger you enrolled.</span></div><button class="btn" data-act="regBio">${u.bioid ? 'Change BioID' : 'Register BioID'}</button></div>
      <div class="pref"><div><b>This device's fingerprint / Face ID</b><span class="muted">${u.deviceCred ? 'Linked on this device.' : deviceBioOk ? 'Available on this device.' : 'Not available in this browser. Use the simulated BioID scanner.'}</span></div>
        ${u.deviceCred ? '<button class="btn" data-act="unlinkDevice">Unlink</button>' : `<button class="btn" data-act="linkDevice"${deviceBioOk ? '' : ' disabled'}>Link Device</button>`}</div>
    </div>`, footer: `<button class="btn" data-act="home">Home</button>` };
  },
};

function txTable(list, showPatient = true) {
  if (!list.length) return '<p class="empty-line">No transactions yet.</p>';
  return `<div class="table-wrap"><table class="tx"><thead><tr><th>Time</th><th>Type</th>${showPatient ? '<th>Patient</th>' : ''}<th>Medication</th><th>Amount</th><th>User</th><th>Witness</th><th>Note</th></tr></thead><tbody>
    ${list.map(t => `<tr class="t-${t.type.toLowerCase()}"><td class="mono">${hhmm(t.t)}</td><td><span class="chip">${t.type.toUpperCase()}</span></td>${showPatient ? `<td>${t.patient ? esc(patName(PAT(t.patient))) : '—'}</td>` : ''}<td>${esc(medLabel(t.med))}<br><span class="muted small">${esc(medDesc(t.med))}</span></td><td class="mono">${esc(t.amount)}</td><td>${esc(userName(t.user))}</td><td>${t.witness ? esc(userName(t.witness)) : ''}</td><td class="small">${esc(t.note || '')}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function addTx(t) { db.tx.push({ id: uid(), t: Date.now(), user: session.user, ...t }); save(); }

/* ---------- actions ---------- */
const ACT = {
  signin: () => signInFlow(),
  home: () => { session.editList = null; go('home'); },
  signout: () => signOut(),
  go: ds => go(ds.to),
  noop: () => {},
  list: ds => go('patients', { listTab: ds.to }),
  selPatient: ds => { session.sel = ds.id; render(); },
  dot: ds => { session.sel = ds.id; patientAction('remove', ds.tab); },
  pa: ds => patientAction(ds.a),
  backList: () => go('patients', { cart: [] }),
  tab: ds => { session.tab = ds.tab; render(); },
  mode: ds => { session.mode = ds.m; if (ds.m === 'remove' && !session.tab) session.tab = 'due'; if (ds.m === 'override') emit('patient_action', { patient: session.sel, action: 'override' }); render(); },
  addMy: ds => { if (!session.editList.includes(ds.id)) session.editList.push(ds.id); render(); },
  delMy: ds => { session.editList = session.editList.filter(x => x !== ds.id); render(); },
  cancelMy: () => { session.editList = null; go('patients', { listTab: 'my' }); },
  saveMy: () => { db.myPatients[session.user] = session.editList; emit('mypatients_saved', { ids: [...session.editList] }); session.editList = null; go('patients', { listTab: 'my' }); },
  pickOrder: ds => selectOrder(ds.id),
  pickOverride: ds => selectOverride(ds.id),
  unpick: ds => { session.cart.splice(+ds.i, 1); render(); },
  removeMeds: () => runRemoval(),
  doReturn: ds => returnFlow(db.removals.find(r => r.id === ds.id)),
  why: ds => info('Cannot Return', `<p>${esc(ds.why)}</p>`),
  doWaste: ds => { const r = db.removals.find(x => x.id === ds.id); wasteFlow(r).then(() => render()); },
  searchAllWaste: () => searchAllWaste(),
  resolveDisc: ds => resolveDiscrepancy(db.discrepancies.find(d => d.id === ds.id)),
  report: ds => { session.reportAll = ds.all === '1'; render(); },
  print: () => window.print(),
  copyReport: () => copyText(reportText()),
  changePw: () => changePasswordFlow(db.users[session.user], false).then(ok => { if (ok) toast('Password changed.', 'good'); go('prefs'); }),
  regBio: () => registerBioFlow(db.users[session.user]).then(() => go('prefs')),
  linkDevice: async () => { await linkDevice(db.users[session.user]); go('prefs'); },
  unlinkDevice: () => { db.users[session.user].deviceCred = null; save(); toast('Device biometrics unlinked.'); go('prefs'); },
};

function signOut() {
  if (!session.user) return;
  emit('signout', {});
  cancelFlows();
  session.user = null; session.sel = null; session.cart = []; session.editList = null; session.alerted = null;
  go('standby');
}

async function patientAction(action, tab) {
  const p = PAT(session.sel); if (!p) return;
  if (p.nameAlert && session.alerted !== p.id) {
    await info('<span class="alert-title">Name Alert</span>', `<p>Another patient on this unit has a similar name.</p><p><b>${esc(patName(p))}</b><br>MRN <span class="mono">${p.mrn}</span> · DOB <span class="mono">${fmtDob(p.dob)}</span> · Room <span class="mono">${p.room}</span></p><p>Verify two patient identifiers before you continue.</p>`, 'I verified the patient', 'alert');
    session.alerted = p.id;
  }
  emit('patient_action', { patient: p.id, action });
  if (action === 'remove' || action === 'override') {
    session.mode = action; session.cart = [];
    if (tab) session.tab = tab;
    else { const c = patientCounts(p); session.tab = c.due ? 'due' : 'all'; }
    go('profile');
  } else go({ return: 'returns', waste: 'waste', past: 'past' }[action]);
}

/* ---------- sign in ---------- */
function credHint() {
  const s = db.users.student;
  return `<details class="cred-hint"><summary>Practice sign-in help</summary><ul>
    <li>Student: <code>student</code> / ${s.mustChange ? '<code>123456</code> (temporary — you will set a new one)' : 'the password you created'}</li>
    <li>Witnesses: <code>kjones</code> / <code>pyxis1</code> · <code>mlee</code> / <code>pyxis2</code></li>
    <li>Your own ID: first initial + last name (e.g., <code>jsmith</code>) via <b>Create Practice User</b></li></ul></details>`;
}

async function signInFlow() {
  let user;
  for (;;) {
    const r = await step({ title: 'Sign In', body: `<div class="signin">
        <label for="uid">User ID</label><input id="uid" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g., student">
        <p class="muted">Enter your User ID, then sign in with BioID (fingerprint) or your password.</p>${credHint()}</div>`,
      buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Create Practice User', value: 'create', novalidate: true }, { label: 'Next', value: 'next', primary: true }],
      validate: (v, d) => !d.uid ? 'Enter your User ID.' : !db.users[d.uid.toLowerCase()] ? `User ID "${d.uid}" was not found. Check the spelling or create a practice user.` : null });
    if (r.value === 'cancel') return go('standby');
    if (r.value === 'create') { await createUserFlow(); continue; }
    user = db.users[r.data.uid.toLowerCase()];
    break;
  }
  let method = null;
  if (user.bioid || user.deviceCred) method = await bioLogin(user);
  if (method === 'cancel') return go('standby');
  if (!method || method === 'password') {
    const ok = await passwordLogin(user);
    if (!ok) return go('standby');
    method = 'password';
  }
  session.user = user.id;
  if (user.mustChange) { const ok = await changePasswordFlow(user, true); if (!ok) { session.user = null; return go('standby'); } }
  if (!user.bioid && !user.bioPrompted) {
    user.bioPrompted = true; save();
    const r = await modal({ title: 'Register BioID?', body: '<p>Your BioID is not on record. Registering your fingerprint lets you sign in faster and is harder to compromise than a password.</p><p class="muted">You can do this later from User Preferences.</p>', buttons: [{ label: 'Not Now', value: 'no' }, { label: 'Register', value: 'yes', primary: true }] });
    if (r.value === 'yes') await registerBioFlow(user);
  }
  emit('signin', { user: user.id, method });
  go('home');
  toast(`Signed in as ${userName(user.id)}`);
}

async function passwordLogin(user) {
  let tries = 0;
  const r = await step({ title: 'Sign In', body: `<div class="signin"><p>User ID <b class="mono">${esc(user.id)}</b></p>
      <label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password">${credHint()}</div>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Sign In', value: 'ok', primary: true }],
    validate: (v, d) => { if (d.pw !== user.password) { tries++; return tries >= 3 ? 'Incorrect password again. In a real facility, repeated failures lock your account — contact pharmacy for a reset.' : 'Incorrect password. Passwords are case-sensitive.'; } return null; } });
  return r.value === 'ok';
}

async function bioLogin(user) {
  let fails = 0, msg = 'Place your enrolled finger squarely on the scanner and press firmly. <b>Press and hold</b> until the scan completes.';
  for (;;) {
    const r = await step({ title: 'BioID Sign In', body: `<div class="signin center"><p>User ID <b class="mono">${esc(user.id)}</b></p>${user.bioid ? scannerHtml(msg) : '<p>Use this device\'s biometrics to sign in.</p>'}</div>`,
      buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Use Password', value: 'password' }, ...(user.deviceCred ? [{ label: 'Use Device Fingerprint / Face ID', value: 'device', primary: !user.bioid }] : [])] });
    if (r.value === 'cancel' || r.value === 'password') return r.value;
    if (r.value === 'scan-ok') return 'bioid';
    if (r.value === 'device') {
      try { await DeviceBio.verify(user.deviceCred); return 'device'; }
      catch { msg = '<span class="bad">Device biometrics could not verify you.</span> Try again, use the scanner, or use your password.'; continue; }
    }
    if (r.value === 'scan-fail') {
      fails++;
      if (fails >= 3) {
        await info('BioID Failed', '<p>The scanner could not verify your fingerprint after 3 attempts.</p><p>Sign in with your password. A witness may be required at some facilities. Common causes: finger not covering the lens, moving during the scan, cold or dry finger, lotion, gloves or a bandage.</p>');
        return 'password';
      }
      msg = `<span class="bad">Unable to verify your fingerprint (attempt ${fails} of 3).</span> Lift your finger, then cover the lens completely and hold still until the scan finishes.`;
    }
  }
}

async function changePasswordFlow(user, forced) {
  const r = await step({ title: forced ? 'Create a New Password' : 'Change Password', body: `<div class="signin">
      ${forced ? '<p>This is your first sign-in. Replace the temporary password from pharmacy with your own.</p>' : ''}
      <label for="cur">Current password</label><input id="cur" type="password" autocomplete="current-password">
      <label for="np">New password</label><input id="np" type="password" autocomplete="new-password" maxlength="8">
      <label for="np2">Confirm new password</label><input id="np2" type="password" autocomplete="new-password" maxlength="8">
      <p class="muted">6–8 letters or numbers. Never share your password or sign in for someone else.</p></div>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Accept', value: 'ok', primary: true }],
    validate: (v, d) => d.cur !== user.password ? 'Current password is incorrect.' : !/^[A-Za-z0-9]{6,8}$/.test(d.np) ? 'New password must be 6–8 letters or numbers.' : d.np === user.password ? 'Choose a password different from the current one.' : d.np !== d.np2 ? 'The new passwords do not match.' : null });
  if (r.value !== 'ok') return false;
  user.password = r.data.np; user.mustChange = false; save();
  return true;
}

async function createUserFlow() {
  const r = await modal({ title: 'Create Practice User', body: `<p class="muted">Your User ID will be your first initial plus the first 9 letters of your last name.</p>
      <label for="fn">First name</label><input id="fn" autocomplete="given-name"><label for="ln">Last name</label><input id="ln" autocomplete="family-name">`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Create', value: 'ok', primary: true }],
    validate: (v, d) => (!/[a-z]/i.test(d.fn) || !/[a-z]/i.test(d.ln)) ? 'Enter your first and last name.' : null });
  if (r.value !== 'ok') return;
  const base = (r.data.fn.replace(/[^a-z]/gi, '')[0] + r.data.ln.replace(/[^a-z]/gi, '').slice(0, 9)).toLowerCase();
  let id = base, n = 2; while (db.users[id]) id = base + n++;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  db.users[id] = { id, first: cap(r.data.fn), last: cap(r.data.ln), title: 'SN', password: '123456', mustChange: true };
  save();
  await info('Practice User Created', `<p>User ID: <b class="mono big">${id}</b></p><p>Temporary password: <b class="mono">123456</b></p><p class="muted">You will create your own password the first time you sign in.</p>`);
}

async function registerBioFlow(user) {
  const choose = await modal({ title: 'Register BioID', body: `<p>Choose how to enroll your fingerprint.</p>
      <label class="radio"><input type="radio" name="how" value="sim" checked> <span><b>MedStation BioID scanner (simulated)</b><br><span class="muted">Press and hold the on-screen scanner three times, like the real enrollment.</span></span></label>
      <label class="radio"><input type="radio" name="how" value="device"${deviceBioOk ? '' : ' disabled'}> <span><b>This phone or laptop's fingerprint / Face ID</b><br><span class="muted">${deviceBioOk ? 'Uses your device\'s built-in biometrics. Nothing leaves your device.' : 'Not available in this browser.'}</span></span></label>`,
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Continue', value: 'ok', primary: true }] });
  if (choose.value !== 'ok') return false;
  if (choose.data.how === 'device') return linkDevice(user);
  let i = 1, msg = '';
  while (i <= 3) {
    const r = await modal({ title: `Scanning fingerprint ${i} of 3`, body: scannerHtml(msg || 'Choose one finger (middle finger works well). Center it on the lens, press firmly and hold. Lift between scans.'), buttons: [{ label: 'Cancel', value: 'cancel' }] });
    if (r.value === 'cancel') return false;
    if (r.value === 'scan-fail') { msg = '<span class="bad">■ Scan not captured.</span> Redo scan: cover the entire lens and hold until it completes.'; continue; }
    msg = ''; i++;
  }
  user.bioid = true; save();
  await info('BioID Registered', '<p>Your fingerprint is registered. You can sign in with BioID at any MedStation where you have access.</p>');
  return true;
}

async function linkDevice(user) {
  try {
    user.deviceCred = await DeviceBio.register(user); user.bioid = true; save();
    await info('Device Linked', '<p>You can now sign in with this device\'s fingerprint or Face ID. This practice link stays on this device only.</p>');
    return true;
  } catch (e) {
    await info('Device Biometrics Unavailable', `<p>Your browser did not complete biometric enrollment${e && e.name ? ` (${esc(e.name)})` : ''}. Use the simulated BioID scanner instead.</p>`);
    return false;
  }
}

async function witnessFlow(purpose) {
  let r;
  for (;;) {
    r = await modal({ title: 'Witness Required', body: `<p>${purpose}</p><p class="muted">The witness signs in with their own credentials and must watch the entire waste or return. Practice witnesses: <code>kjones</code>/<code>pyxis1</code>, <code>mlee</code>/<code>pyxis2</code>.</p>
        <label for="wid">Witness User ID</label><input id="wid" autocapitalize="none" spellcheck="false" autocomplete="off">
        <label for="wpw">Witness password</label><input id="wpw" type="password" autocomplete="off">`,
      buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Witness BioID', value: 'bio' }, { label: 'Accept', value: 'ok', primary: true }],
      validate: (v, d) => {
        const id = (d.wid || '').toLowerCase();
        if (!id) return 'Enter the witness User ID.';
        if (!db.users[id]) return 'Witness User ID not found.';
        if (id === session.user) return 'You cannot witness your own transaction. A second licensed nurse must sign.';
        if (v === 'bio') return db.users[id].bioid ? null : 'This witness has no BioID on record. Use the password.';
        return d.wpw === db.users[id].password ? null : 'Incorrect witness password.';
      } });
    if (r.value === 'cancel') return null;
    const id = r.data.wid.toLowerCase();
    if (r.value === 'ok') return id;
    let fails = 0, msg = `${esc(userName(id))}: press and hold the scanner.`;
    for (;;) {
      const s = await modal({ title: 'Witness BioID', body: scannerHtml(msg), buttons: [{ label: 'Back', value: 'back' }] });
      if (s.value === 'scan-ok') return id;
      if (s.value === 'back') break;
      if (++fails >= 3) { await info('Witness BioID Failed', '<p>The witness must sign with their password.</p>'); break; }
      msg = `<span class="bad">Unable to verify (attempt ${fails} of 3).</span> Cover the lens and hold still.`;
    }
  }
}

/* ---------- medication selection ---------- */
async function askCdc(medId, patientId) {
  const m = F[medId]; if (!m.cdc) return { ok: true };
  emit('cdc_shown', { med: medId, patient: patientId });
  const r = await modal({ title: 'Clinical Data', body: `<p><b>${esc(medLabel(medId))}</b> requires assessment data before removal.</p>
      ${m.cdc.fields.map(f => `<label for="cdc_${f.key}">${f.label}</label><input id="cdc_${f.key}" name="${f.key}" type="number" inputmode="numeric" min="${f.min}" max="${f.max}">`).join('')}`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Accept', value: 'ok', primary: true }],
    validate: (v, d) => { for (const f of m.cdc.fields) { const x = parseFloat(d[f.key]); if (isNaN(x) || x < f.min || x > f.max) return `Enter a valid value for: ${f.label.split('(')[0].trim()}.`; } return null; } });
  if (r.value !== 'ok') return { ok: false };
  const vals = {}; m.cdc.fields.forEach(f => vals[f.key] = parseFloat(r.data[f.key]));
  const note = m.cdc.fields.map(f => `${f.key.toUpperCase()} ${vals[f.key]}`).join(', ');
  const hold = m.cdc.hold ? m.cdc.hold(vals) : null;
  emit('cdc', { med: medId, patient: patientId, held: !!hold, vals });
  if (hold) {
    const h = await modal({ title: '<span class="alert-title">Hold Parameter</span>', cls: 'alert', body: `<p><b>${esc(hold)}</b></p><p class="muted">Document the held dose and the reason on the MAR.</p>`,
      buttons: [{ label: 'Continue Anyway', value: 'go' }, { label: 'Hold Dose — Cancel Removal', value: 'hold', primary: true }] });
    if (h.value === 'hold') { emit('hold_cancel', { med: medId, patient: patientId }); toast('Dose held. Notify the provider and document on the MAR.'); return { ok: false }; }
  }
  return { ok: true, note };
}

async function askDose(medId, { min, max, override }) {
  const m = F[medId];
  const r = await modal({ title: override ? 'Enter Amount to Administer' : 'Range Dose', body: `
      <p><b>${esc(medLabel(medId))}</b> · ${esc(medDesc(medId))}</p>
      ${override ? '<p class="muted">An override is not attached to a pharmacist-verified order, so the MedStation cannot calculate the dose. Enter the amount you will ADMINISTER.</p>'
        : `<p>Ordered range: <b>${num(min)}–${num(max)} ${m.unit}</b>. Enter the amount you will <b>ADMINISTER</b>. It must fall within the ordered range.</p>`}
      <label for="dose">Amount to administer (${m.unit})</label><div class="inline"><input id="dose" type="number" inputmode="decimal" step="any" ${override ? `value="${num(m.strength)}"` : ''}><span>${m.unit}</span></div>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'OK', value: 'ok', primary: true }],
    validate: (v, d) => { const x = parseFloat(d.dose); if (isNaN(x) || x <= 0) return 'Enter an amount greater than zero.'; if (!override && (x < min - 1e-9 || x > max + 1e-9)) return `The amount must be between ${num(min)} and ${num(max)} ${m.unit}.`; if (override && x > m.strength * 10) return 'That amount is unusually large. Check the dose.'; return null; } });
  if (r.value !== 'ok') return null;
  const dose = parseFloat(r.data.dose);
  emit('dose_entered', { med: medId, dose, patient: session.sel });
  return dose;
}

function cartItem(medId, dose, extra) {
  const m = F[medId];
  const qty = m.noSplit ? 1 : Math.max(1, Math.ceil(dose / m.strength - 1e-9));
  return { med: medId, dose, qty, ...extra };
}

async function selectOrder(oid) {
  const o = orderById(oid), p = PAT(session.sel), m = F[o.med];
  if (session.cart.some(c => c.orderId === oid)) return toast('Already in Selected Meds.');
  const s = orderStatus(o);
  const cont = async (title, body) => (await modal({ title, cls: 'alert', body, buttons: [{ label: 'Continue', value: 'go' }, { label: 'Cancel', value: 'no', primary: true }] })).value === 'go';
  if (s.kind === 'given' && !await cont('<span class="alert-title">Dose Already Removed</span>', `<p>This scheduled dose was removed at <b>${hhmm(s.at)}</b> by ${esc(userName(s.by))}. Removing it again could cause a <b>double dose</b>.</p><p class="muted">Check the MAR before continuing.</p>`)) return;
  if (s.kind === 'future' && !await cont('Early Removal', `<p>This dose is not due until <b>${hhmm(s.due)}</b>. Removing more than 60 minutes early is outside the administration window.</p>`)) return;
  if (s.kind === 'prn' && s.last) {
    const h = freqHours(o.freq);
    if (h && Date.now() - s.last < h * HOUR && !await cont('<span class="alert-title">Too Soon</span>', `<p>${esc(medLabel(o.med))} was last removed at <b>${hhmm(s.last)}</b>. The order is <b>${o.freq} PRN</b>; the next dose is available at <b>${hhmm(s.last + h * HOUR)}</b>.</p>`)) return;
  }
  const c = await askCdc(o.med, p.id); if (!c.ok) return;
  let dose = o.dose;
  if (dose == null) { dose = await askDose(o.med, { min: o.doseMin, max: o.doseMax }); if (dose == null) return; }
  session.cart.push(cartItem(o.med, dose, { orderId: oid, override: false, note: c.note }));
  render();
}

async function selectOverride(medId) {
  const p = PAT(session.sel);
  if (session.cart.some(c => c.med === medId && c.override)) return toast('Already in Selected Meds.');
  const allergy = p.allergies.find(a => (ALLERGY_CLASSES[a.key] || []).includes(medId));
  if (allergy) {
    const r = await modal({ title: '<span class="alert-title">Allergy Alert</span>', cls: 'alert', body: `<p><b>${esc(patName(p))}</b> has a documented allergy to <b>${esc(allergy.agent)}</b> (${esc(allergy.reaction)}).</p><p>You selected <b>${esc(medLabel(medId))}</b>.</p><p class="muted">Stop and clarify with the prescriber before giving any medication the patient is allergic to.</p>`,
      buttons: [{ label: 'Override Allergy', value: 'proceed', cls: 'danger' }, { label: 'Cancel Removal', value: 'cancel', primary: true }] });
    emit('allergy_alert', { patient: p.id, med: medId, action: r.value });
    if (r.value !== 'proceed') return toast('Removal cancelled. Clarify the order with the prescriber.');
  }
  const existing = p.orders.find(o => o.med === medId || F[o.med].name === F[medId].name);
  if (existing) {
    const r = await modal({ title: 'Order Exists', body: `<p>This patient already has an active, pharmacist-verified order:</p><p><b>${esc(medLabel(existing.med))}</b> ${esc(sig(existing))}</p><p class="muted">Remove from the patient's profile whenever possible so the pharmacist-reviewed order is used.</p>`,
      buttons: [{ label: 'Continue Override', value: 'ov' }, { label: 'Go to Profile', value: 'profile', primary: true }] });
    emit('order_exists', { med: medId, action: r.value });
    if (r.value === 'profile') { session.mode = 'remove'; session.tab = existing.prn ? 'prn' : 'all'; return render(); }
  }
  const c = await askCdc(medId, p.id); if (!c.ok) return;
  const dose = await askDose(medId, { override: true }); if (dose == null) return;
  session.cart.push(cartItem(medId, dose, { orderId: null, override: true, note: c.note }));
  render();
}

/* ---------- removal ---------- */
async function runRemoval() {
  const p = PAT(session.sel);
  const items = [...session.cart];
  if (!items.length) return;
  let reason = null;
  if (items.some(i => i.override)) {
    const r = await modal({ title: 'Override Warning', cls: 'alert', body: `<p>You are removing medication <b>without pharmacist review</b> of the order. Select the reason for the override.</p>
        ${OVERRIDE_REASONS.map((x, i) => `<label class="radio"><input type="radio" name="reason" value="${esc(x)}"${i ? '' : ''}> <span>${esc(x)}</span></label>`).join('')}`,
      buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Remove Meds', value: 'ok', primary: true }],
      validate: (v, d) => d.reason ? null : 'Select an override reason.' });
    if (r.value !== 'ok') return;
    reason = r.data.reason;
    emit('override_reason', { reason });
  }
  const done = [];
  for (const it of items) {
    const res = await removeItem(p, it, reason);
    if (res) done.push(res);
  }
  session.cart = [];
  const lines = done.map(d => `<li><b>${esc(medLabel(d.med))}</b> — removed ${d.qty} ${unitWord(d.med, d.qty)} for a dose of ${num(d.dose)} ${F[d.med].unit}${d.wasteNote ? `<br><span class="muted">${d.wasteNote}</span>` : ''}</li>`).join('');
  await step({ title: 'Transaction Complete', body: `${patientBanner(p)}
      ${done.length ? `<ul class="summary">${lines}</ul>` : '<p>No medications were removed.</p>'}
      <div class="teach"><b>At the bedside:</b> verify the rights of medication administration, scan the patient's ID band and each medication barcode, then document on the eMAR. Label any syringe that leaves your hands.</div>`,
    buttons: [{ label: 'Done', value: 'ok', primary: true }] });
  go('patients');
}

async function removeItem(p, it, reason) {
  const m = F[it.med];
  if (db.physical[it.med] < it.qty) { await info('Insufficient Stock', `<p>There are not enough ${esc(medLabel(it.med))} in this pocket. Use <b>Global Find</b> to locate another device and notify pharmacy.</p>`); return null; }
  let countNote = '';
  if (m.controlled) {
    let attempts = 0;
    for (;;) {
      const r = await step({ title: `Blind Count · ${esc(medLabel(it.med))}`, body: `${drawerView(it.med, { contents: 'items' })}
          <div class="count-box"><label for="count">Count every ${unitWord(it.med, 1)} in the open pocket <b>before</b> you remove anything.</label>
          <div class="inline"><input id="count" type="number" inputmode="numeric" min="0"><span>${unitWord(it.med, 2)} counted</span></div></div>`,
        buttons: [{ label: 'Cancel Med', value: 'cancel', novalidate: true }, { label: 'Accept', value: 'ok', primary: true }],
        validate: (v, d) => d.count === '' || isNaN(parseInt(d.count, 10)) ? 'Enter the number you counted.' : null });
      if (r.value === 'cancel') return null;
      const n = parseInt(r.data.count, 10), sys = db.inventory[it.med], phys = db.physical[it.med];
      if (n === sys) { emit('count', { med: it.med, correct: n === phys }); break; }
      if (++attempts === 1) { await info('Recount', '<p>Your count does not match the expected count. Count the pocket again, carefully, one item at a time.</p>', 'Recount'); continue; }
      const d = { id: uid(), t: Date.now(), med: it.med, user: session.user, patient: p.id, expected: sys, counted: n, resolved: false };
      db.discrepancies.push(d);
      addTx({ type: 'Discrepancy', patient: p.id, med: it.med, amount: `exp ${sys} / cnt ${n}`, note: 'Blind count mismatch' });
      db.inventory[it.med] = n;
      emit('count', { med: it.med, correct: n === phys });
      emit('discrepancy_created', { med: it.med });
      countNote = 'Discrepancy created — resolve it before the end of your shift.';
      await info('<span class="alert-title">Discrepancy Created</span>', `<p>Your second count (<b>${n}</b>) does not match the expected count. A discrepancy has been recorded and the inventory now reflects your count.</p><p>You may continue this removal. The discrepancy must be resolved with a witness before the end of your shift.</p>`, 'Continue', 'alert');
      break;
    }
  }
  const r = await step({ title: `Remove · ${esc(medLabel(it.med))}`, body: `${drawerView(it.med, { contents: m.controlled ? 'items' : 'label' })}
      <div class="take"><div class="take-n">${it.qty}</div><div><b>Remove ${it.qty} ${unitWord(it.med, it.qty)}</b> of ${esc(medLabel(it.med))} ${esc(medDesc(it.med))}<br>
      <span class="muted">Dose to administer: ${num(it.dose)} ${m.unit}${it.override ? ' · OVERRIDE' : ''}</span></div></div>
      <p class="muted">Take the medication, check the label against the order, then close the ${m.loc.type === 'Fridge' ? 'refrigerator bin' : 'drawer'}.</p>`,
    buttons: [{ label: 'Cancel Med', value: 'cancel' }, { label: 'Remove & Close Drawer', value: 'ok', primary: true }] });
  if (r.value !== 'ok') return null;

  db.inventory[it.med] -= it.qty; db.physical[it.med] -= it.qty;
  const removedAmt = it.qty * m.strength;
  const expectedWaste = m.noSplit ? 0 : Math.max(0, +(removedAmt - it.dose).toFixed(4));
  const rem = { id: uid(), t: Date.now(), user: session.user, patient: p.id, med: it.med, orderId: it.orderId, qty: it.qty, dose: it.dose, override: it.override, expectedWaste: m.controlled ? expectedWaste : 0, wasted: 0, returnedQty: 0, undocumented: false };
  db.removals.push(rem);
  if (it.orderId) { const o = orderById(it.orderId); db.orders[it.orderId] = { ...(db.orders[it.orderId] || {}), lastRemoved: rem.t, by: session.user, ...(o.prn ? {} : { given: rem.t }) }; }
  addTx({ type: it.override ? 'Override' : 'Remove', patient: p.id, med: it.med, amount: `${it.qty} ${unitWord(it.med, it.qty)} / dose ${num(it.dose)} ${m.unit}`, note: [reason, it.note].filter(Boolean).join(' · ') });
  emit('removed', { patient: p.id, med: it.med, override: it.override, dose: it.dose, qty: it.qty });

  let wasteNote = countNote;
  if (m.controlled && expectedWaste > 0) {
    const w = await modal({ title: 'Waste Required', body: `<p>You removed <b>${amtText(it.med, removedAmt)}</b> and will administer <b>${amtText(it.med, it.dose)}</b>.</p>
        ${db.settings.challenge ? '<p>Calculate the amount you must waste.</p>' : `<p>Amount to waste: <b>${amtText(it.med, expectedWaste)}</b></p>`}
        <p class="muted">By law, the unused portion of a controlled substance must be wasted and documented with a witness.</p>`,
      buttons: [{ label: 'Waste Later', value: 'later' }, { label: 'Waste Now', value: 'now', primary: true }] });
    if (w.value === 'now') {
      const ok = await wasteFlow(rem);
      if (!ok) { rem.undocumented = true; wasteNote = 'Waste not documented — listed under Undocumented Waste.'; }
      else wasteNote = `Wasted ${amtText(it.med, rem.wasted)} with ${esc(userName(rem.witness))}.`;
    } else {
      rem.undocumented = true; emit('waste_later', { med: it.med, patient: p.id });
      wasteNote = 'Waste Later selected — document it from Undocumented Waste as soon as possible.';
    }
  } else if (!m.controlled && !m.noSplit && expectedWaste > 0) {
    wasteNote = `Discard the unused ${amtText(it.med, expectedWaste)} per facility policy (non-controlled, no witness needed).`;
  }
  save();
  return { med: it.med, qty: it.qty, dose: it.dose, wasteNote };
}

/* ---------- waste ---------- */
async function wasteFlow(rem, synthetic = false) {
  const m = F[rem.med], id = rem.med;
  const removedAmt = (rem.qty - (rem.returnedQty || 0)) * m.strength;
  const expected = Math.max(0, +(rem.expectedWaste - rem.wasted).toFixed(4));
  const max = Math.max(0, +(removedAmt - rem.wasted).toFixed(4));
  if (max <= 0) { await info('Nothing to Waste', '<p>All of this removal has been accounted for.</p>'); return false; }
  const liquid = !!m.volume;
  const ch = db.settings.challenge;
  const r = await modal({ title: `Waste · ${esc(medLabel(id))}`, body: `
      <dl class="facts"><dt>Medication</dt><dd>${esc(medDesc(id))}</dd><dt>Removed</dt><dd>${rem.qty} ${unitWord(id, rem.qty)} = ${amtText(id, removedAmt)}${synthetic ? '' : ` at ${hhmm(rem.t)}`}</dd>
      <dt>Administered</dt><dd>${amtText(id, rem.dose)}</dd>${rem.wasted ? `<dt>Already wasted</dt><dd>${amtText(id, rem.wasted)}</dd>` : ''}
      ${ch ? '' : `<dt>Expected waste</dt><dd><b>${amtText(id, expected)}</b></dd>`}</dl>
      <label for="wamt">Amount to waste (${m.unit})</label><div class="inline"><input id="wamt" type="number" inputmode="decimal" step="any" ${ch ? '' : `value="${num(expected)}" data-volfor="${id}"`}><span>${m.unit}</span> <span class="vol-out mono">${!ch && liquid ? `= ${num(volOf(id, expected))} mL` : ''}</span></div>
      ${ch && liquid ? `<label for="wvol">Volume to waste (mL) — concentration ${num(m.strength / m.volume)} ${m.unit}/mL</label><div class="inline"><input id="wvol" type="number" inputmode="decimal" step="any"><span>mL</span></div>` : ''}
      <label for="wreason">Reason (required if the amount differs from the expected waste)</label>
      <select id="wreason"><option value="">— none —</option>${WASTE_SHORT_REASONS.map(x => `<option>${esc(x)}</option>`).join('')}</select>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Continue', value: 'ok', primary: true }],
    validate: (v, d) => {
      const a = parseFloat(d.wamt);
      if (isNaN(a) || a < 0) return 'Enter the amount to waste.';
      if (a > max + 1e-9) return `You cannot waste more than the ${amtText(id, max)} remaining from this removal.`;
      if (ch && liquid) { const vol = parseFloat(d.wvol); if (isNaN(vol) || Math.abs(vol - volOf(id, a)) > 0.011) return `The volume does not match ${num(a)} ${m.unit} at ${num(m.strength / m.volume)} ${m.unit}/mL. Recalculate: amount ÷ concentration.`; }
      if (Math.abs(a - expected) > 1e-6 && !d.wreason) return ch ? 'That amount does not match what the system expects. Recheck your calculation (removed − administered), or select a reason if the difference is intentional.' : 'The amount differs from the expected waste. Select a reason.';
      return null;
    } });
  if (r.value !== 'ok') return false;
  const amt = parseFloat(r.data.wamt);
  const p = PAT(rem.patient);
  const w = await witnessFlow(`Witness the waste of <b>${amtText(id, amt)}</b> of ${esc(medLabel(id))} for ${esc(patName(p))}.`);
  if (!w) return false;
  await info('Waste the Medication', `<p>With <b>${esc(userName(w))}</b> watching, expel <b>${amtText(id, amt)}</b> into the controlled-substance waste container (e.g., pharmaceutical waste bin or drug-destruction pouch) per facility policy.</p><p class="muted">Both of you must see the entire waste.</p>`, 'Waste Complete');
  rem.wasted = +(rem.wasted + amt).toFixed(4);
  rem.witness = w;
  if (rem.wasted >= rem.expectedWaste - 1e-6) rem.undocumented = false;
  addTx({ type: 'Waste', patient: rem.patient, med: id, amount: amtText(id, amt), witness: w, note: r.data.wreason || (synthetic ? 'Search All Meds' : '') });
  emit('waste', { med: id, amount: amt, patient: rem.patient, witness: w });
  toast(`Waste documented: ${amtText(id, amt)}`, 'good');
  return true;
}

async function searchAllWaste() {
  const p = PAT(session.sel);
  const ids = Object.keys(F).filter(id => F[id].controlled);
  const r = await modal({ title: 'Search All Meds — Waste', body: `<p class="muted">Use this when the removal is not listed (for example, it happened at another device or more than 32 hours ago).</p>
      <label for="sam">Medication</label><select id="sam">${ids.map(id => `<option value="${id}">${esc(medLabel(id))} — ${esc(medDesc(id))}</option>`).join('')}</select>
      <label for="samq">Quantity originally removed</label><input id="samq" type="number" inputmode="numeric" value="1" min="1">
      <label for="samd">Amount administered</label><input id="samd" type="number" inputmode="decimal" step="any">`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Waste Now', value: 'ok', primary: true }],
    validate: (v, d) => { const q = parseInt(d.samq, 10), a = parseFloat(d.samd); if (!(q >= 1)) return 'Enter the quantity removed.'; if (isNaN(a) || a < 0) return 'Enter the amount administered (0 if none).'; if (a > q * F[d.sam].strength) return 'The amount administered cannot exceed the amount removed.'; return null; } });
  if (r.value !== 'ok') return;
  const med = r.data.sam, qty = parseInt(r.data.samq, 10), dose = parseFloat(r.data.samd);
  const rem = { id: uid(), t: Date.now(), user: session.user, patient: p.id, med, qty, dose, expectedWaste: +(qty * F[med].strength - dose).toFixed(4), wasted: 0, returnedQty: 0 };
  await wasteFlow(rem, true);
  render();
}

/* ---------- return ---------- */
async function returnFlow(rem) {
  const m = F[rem.med], left = rem.qty - rem.returnedQty;
  const r = await modal({ title: `Return · ${esc(medLabel(rem.med))}`, body: `<p>${esc(medDesc(rem.med))} — removed ${rem.qty} ${unitWord(rem.med, rem.qty)} at ${hhmm(rem.t)}.</p>
      <p class="muted">Return only unopened, intact packages.</p>
      <label for="rq">Quantity to return</label><input id="rq" type="number" inputmode="numeric" min="1" max="${left}" value="${left}">
      <label class="check"><input type="checkbox" id="sealed"> The packaging is sealed and unopened</label>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Return', value: 'ok', primary: true }],
    validate: (v, d) => { const q = parseInt(d.rq, 10); if (!(q >= 1 && q <= left)) return `Enter a quantity from 1 to ${left}.`; if (!d.sealed) return 'Opened medications cannot be returned. Waste an opened controlled substance instead.'; return null; } });
  if (r.value !== 'ok') return;
  const q = parseInt(r.data.rq, 10);
  let witness = null;
  if (m.controlled) { witness = await witnessFlow(`Witness the return of <b>${q} ${unitWord(rem.med, q)}</b> of ${esc(medLabel(rem.med))}.`); if (!witness) return; }
  await step({ title: 'Return to Return Bin', body: `<div class="drawer-view"><div class="dv-loc"><span class="light"></span><div><b>Main · External Return Bin</b><span class="muted">The return bin is unlocked. Items in the return bin are checked by pharmacy and are not reissued from here.</span></div></div>
      <div class="return-art" aria-hidden="true"><div class="return-slot">${Array.from({ length: q }, () => unitIcon(rem.med)).join('')}</div><span>RETURN BIN</span></div></div>
      <p>Place <b>${q} ${unitWord(rem.med, q)}</b> of ${esc(medLabel(rem.med))} in the return bin${witness ? ` while ${esc(userName(witness))} watches` : ''}, then select Accept.</p>`,
    buttons: [{ label: 'Accept', value: 'ok', primary: true }] });
  rem.returnedQty += q;
  if (rem.returnedQty >= rem.qty) { rem.expectedWaste = 0; rem.undocumented = false; if (rem.orderId && db.orders[rem.orderId]) { delete db.orders[rem.orderId].given; } }
  addTx({ type: 'Return', patient: rem.patient, med: rem.med, amount: `${q} ${unitWord(rem.med, q)}`, witness, note: 'Return bin' });
  emit('returned', { med: rem.med, patient: rem.patient, qty: q });
  toast('Return recorded.', 'good');
  go('returns');
}

/* ---------- discrepancy resolution ---------- */
async function resolveDiscrepancy(d) {
  const recent = db.tx.filter(t => t.med === d.med).sort((a, b) => b.t - a.t).slice(0, 8);
  const r1 = await step({ title: `Resolve Discrepancy · ${esc(medLabel(d.med))}`, body: `
      <dl class="facts"><dt>Location</dt><dd>${locText(d.med)}</dd><dt>Expected count</dt><dd>${d.expected}</dd><dt>Count entered</dt><dd>${d.counted}</dd><dt>Created</dt><dd>${hhmm(d.t)} by ${esc(userName(d.user))}</dd></dl>
      <h3>Investigate: recent transactions for this medication</h3>${txTable(recent)}
      <p class="muted">Review the transactions and the MAR. Did someone miscount, remove more or less than ordered, or return to the wrong place?</p>`,
    buttons: [{ label: 'Cancel', value: 'cancel' }, { label: 'Count Now', value: 'ok', primary: true }] });
  if (r1.value !== 'ok') return go('disc');
  const r2 = await step({ title: 'Inventory Count', body: `${drawerView(d.med, { contents: 'items' })}<div class="count-box"><label for="rc">Count every item in the pocket.</label><div class="inline"><input id="rc" type="number" inputmode="numeric" min="0"><span>counted</span></div></div>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Accept', value: 'ok', primary: true }],
    validate: (v, x) => { const n = parseInt(x.rc, 10); if (isNaN(n)) return 'Enter the number you counted.'; if (n !== db.physical[d.med]) return 'That count does not match what is in the pocket. Count again, one item at a time.'; return null; } });
  if (r2.value !== 'ok') return go('disc');
  db.inventory[d.med] = parseInt(r2.data.rc, 10);
  const r3 = await modal({ title: 'Discrepancy Reason', body: `${DISCREPANCY_REASONS.map(x => `<label class="radio"><input type="radio" name="dr" value="${esc(x)}"> <span>${esc(x)}</span></label>`).join('')}
      <label for="dc">Comment (what you found)</label><textarea id="dc" rows="3" placeholder="e.g., Physical count 9 confirmed with witness; previous count entered as 10."></textarea>`,
    buttons: [{ label: 'Cancel', value: 'cancel', novalidate: true }, { label: 'Continue', value: 'ok', primary: true }],
    validate: (v, x) => !x.dr ? 'Select a reason.' : (x.dc || '').length < 10 ? 'Add a short comment describing your investigation.' : null });
  if (r3.value !== 'ok') return go('disc');
  const w = await witnessFlow(`Witness the count and resolution of the ${esc(medLabel(d.med))} discrepancy.`);
  if (!w) return go('disc');
  Object.assign(d, { resolved: true, reason: r3.data.dr, comment: r3.data.dc, witness: w, resolvedBy: session.user, resolvedAt: Date.now() });
  addTx({ type: 'Resolve', med: d.med, amount: `count ${db.inventory[d.med]}`, witness: w, note: `${r3.data.dr} — ${r3.data.dc}` });
  emit('discrepancy_resolved', { med: d.med });
  toast('Discrepancy resolved.', 'good');
  go('disc');
}

/* ---------- reports / clipboard ---------- */
function reportText() {
  const list = db.tx.filter(t => session.reportAll || t.user === session.user).sort((a, b) => a.t - b.t);
  return `MedStation Practice — Activity report (${session.reportAll ? 'all users' : userName(session.user)}) — ${dateStr(Date.now())}\n` +
    list.map(t => `${hhmm(t.t)}  ${t.type.padEnd(11)} ${t.patient ? patName(PAT(t.patient)) : '—'} | ${medLabel(t.med)} ${medDesc(t.med)} | ${t.amount} | user ${userName(t.user)}${t.witness ? ' | witness ' + userName(t.witness) : ''}${t.note ? ' | ' + t.note : ''}`).join('\n');
}
function copyText(txt) {
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied.'); } catch { toast('Select and copy the text manually.'); } ta.remove(); };
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Copied to clipboard.', 'good'), fallback); else fallback();
}

/* ---------- practice coach ---------- */
const coach = $('#coach');
function renderCoach() {
  const sc = db.scen, S = sc && scenById(sc.id);
  let html = `<div class="coach-head"><h2>Practice Coach</h2><button class="btn small ghost only-narrow" data-cact="toDevice">Back to MedStation ↑</button></div>`;
  if (S) {
    const stepsHtml = S.steps.map((s, i) => {
      const state = sc.missed.includes(i) ? 'missed' : i < sc.step ? 'done' : i === sc.step && !sc.done ? 'current' : 'todo';
      return `<li class="st ${state}"><span class="st-mark" aria-hidden="true">${state === 'done' ? '✓' : state === 'missed' ? '✕' : i + 1}</span><div><span>${s.text}</span>${state === 'current' && s.hint ? `<details class="hint"><summary>Hint</summary><p>${s.hint}</p></details>` : ''}${state === 'missed' ? '<span class="small bad">Missed or out of order</span>' : ''}</div></li>`;
    }).join('');
    html += `<div class="scen"><div class="scen-top"><span class="lvl">${S.level}</span><h3>${S.title}</h3></div><div class="brief">${S.brief}</div>
      <ol class="steps">${stepsHtml}</ol>
      ${sc.errors.length ? `<div class="errs"><b>Safety concerns</b><ul>${sc.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
      ${sc.done ? resultHtml(sc, S) : ''}
      <div class="coach-btns"><button class="btn small" data-cact="restart">Restart</button><button class="btn small ghost" data-cact="exit">Exit scenario</button></div></div>`;
  } else {
    html += `<p class="coach-intro">You are in <b>free practice</b>. Explore the MedStation, or choose a guided scenario for step-by-step coaching and feedback.</p>`;
  }
  html += `<details class="coach-sec" ${S && !sc.done ? '' : 'open'}><summary>Guided scenarios</summary><ul class="scen-list">${SCENARIOS.map(s => `<li><button class="scen-btn ${sc && sc.id === s.id ? 'on' : ''}" data-cact="start" data-id="${s.id}"><span class="lvl">${s.level}</span><span>${s.title}</span></button></li>`).join('')}</ul><p class="small muted">Starting a scenario resets patients, inventory and transactions (practice accounts are kept).</p></details>
    <details class="coach-sec"><summary>Practice accounts</summary><ul class="small">
      <li><b>Student:</b> <code>student</code> — first sign-in password <code>123456</code></li>
      <li><b>Witness RNs:</b> <code>kjones</code> / <code>pyxis1</code> · <code>mlee</code> / <code>pyxis2</code> (both have BioID)</li>
      <li><b>BioID:</b> press and hold the on-screen scanner about 1.5 s. Lift early to practice a failed scan. On a phone or laptop with a fingerprint reader or Face ID you can also link the device's biometrics.</li></ul></details>
    <details class="coach-sec"><summary>Settings</summary>
      <label class="check"><input type="checkbox" data-cact="challenge" ${db.settings.challenge ? 'checked' : ''}> <span><b>Dosage-calculation challenge</b><br><span class="muted small">Hide the calculated waste. Students calculate the waste amount and volume themselves.</span></span></label>
      <div class="coach-btns"><button class="btn small" data-cact="resetPractice">Reset practice data</button><button class="btn small danger" data-cact="resetAll">Reset everything</button></div></details>
    <details class="coach-sec"><summary>Key symbols</summary><ul class="small keys">
      <li><span class="dot mini"></span> Blue dot — medication due now</li><li><span class="dot mini past"></span> Orange — past due</li>
      <li><span class="stripes mini"></span> Striped — override medication</li><li><span class="ind ind-waste">W</span> Undocumented waste</li><li><span class="ind ind-disc">Δ</span> Discrepancy on the device</li></ul></details>`;
  coach.innerHTML = html;
}
const nextScen = S => SCENARIOS[SCENARIOS.indexOf(S) + 1];
function resultHtml(sc, S) {
  const secs = Math.round((sc.end - sc.start) / 1000);
  const ok = S.steps.length - sc.missed.length;
  const pass = !sc.missed.length && !sc.errors.length;
  return `<div class="result ${pass ? 'pass' : 'review'}"><b>${pass ? 'Scenario complete — no errors' : 'Scenario complete — review needed'}</b>
    <p>${ok}/${S.steps.length} steps · ${sc.errors.length} safety concern${sc.errors.length === 1 ? '' : 's'} · ${Math.floor(secs / 60)} min ${secs % 60} s</p>
    <div class="coach-btns"><button class="btn small" data-cact="copyResult">Copy result for instructor</button>${nextScen(S) ? `<button class="btn small" data-cact="start" data-id="${nextScen(S).id}">Next: ${nextScen(S).title}</button>` : ''}</div></div>`;
}
coach.addEventListener('click', e => {
  const b = e.target.closest('[data-cact]'); if (!b) return;
  const a = b.dataset.cact;
  if (a === 'start') startScenario(b.dataset.id);
  else if (a === 'restart') startScenario(db.scen.id);
  else if (a === 'exit') { db.scen = null; save(); renderCoach(); }
  else if (a === 'toDevice') $('#device').scrollIntoView({ behavior: 'smooth' });
  else if (a === 'resetPractice') { freshPractice(); db.scen = null; save(); signOutQuiet(); toast('Practice data reset.'); }
  else if (a === 'resetAll') { db = freshDb(); save(); signOutQuiet(); toast('Everything reset, including practice accounts.'); }
  else if (a === 'copyResult') {
    const sc = db.scen, S = scenById(sc.id); const secs = Math.round((sc.end - sc.start) / 1000);
    copyText(`MedStation Practice Simulator — scenario result\nScenario: ${S.title} (${S.level})\nCompleted: ${new Date(sc.end).toLocaleString()}\nSteps: ${S.steps.length - sc.missed.length}/${S.steps.length}\nMissed: ${sc.missed.map(i => S.steps[i].text.replace(/<[^>]+>/g, '')).join('; ') || 'none'}\nSafety concerns: ${sc.errors.join('; ') || 'none'}\nTime: ${Math.floor(secs / 60)} min ${secs % 60} s`);
  }
});
coach.addEventListener('change', e => { if (e.target.dataset.cact === 'challenge') { db.settings.challenge = e.target.checked; save(); toast(e.target.checked ? 'Challenge mode on: calculate waste yourself.' : 'Challenge mode off.'); } });
function signOutQuiet() { cancelFlows(); session.user = null; session.sel = null; session.cart = []; go('standby'); }

$('#coachJump').addEventListener('click', () => $('#coach').scrollIntoView({ behavior: 'smooth' }));

render();
})();
