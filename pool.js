/* ============================================================
   2026 SPREAD POOL — shared helpers (pool.js)
   ONE thing to configure: paste your Apps Script /exec URL below.
   Every page (index, entry, summary) reads it from here.
   ============================================================ */

const POOL_API = "https://script.google.com/macros/s/AKfycbxrbNvihUcOd-LxXvH89CTOcovW8Eon2LWDovoBIlmey_wQIjtCsUYXFXvWQStG0uFwLA/exec";
const POOL_YEAR = 2026;

/* ---------------- API ---------------- */

async function apiGet(params) {
  const url = POOL_API + "?" + new URLSearchParams(params).toString();
  const res = await fetch(url);
  if (!res.ok) throw new Error("API HTTP " + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API error");
  return data;
}

/* Content-Type text/plain avoids the CORS preflight Apps Script can't answer */
async function apiPost(payload) {
  const res = await fetch(POOL_API, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("API HTTP " + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "API error");
  return data;
}

/* ---------------- week resolution ---------------- */

function qsParam(name) { return new URLSearchParams(location.search).get(name); }

function parseBeginMs(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let y = parseInt(m[3], 10); if (y < 100) y += 2000;
    return new Date(y, parseInt(m[1], 10) - 1, parseInt(m[2], 10)).getTime();
  }
  const ms = Date.parse(s);
  return isNaN(ms) ? null : ms;
}

function normConfigRows(rows) {
  return (rows || [])
    .map(r => ({
      week: parseInt(r.week ?? r.Week, 10),
      beginMs: parseBeginMs(r.begindate ?? r.BeginDate ?? r["Begin Date"]),
      status: String(r.status ?? r.Status ?? "").trim().toLowerCase(),
      deadlineISO: String(r.picksdeadlineiso ?? r.PicksDeadlineISO ?? "").trim(),
      revealISO: String(r.revealiso ?? r.RevealISO ?? "").trim()
    }))
    .filter(r => !isNaN(r.week))
    .sort((a, b) => a.week - b.week);
}

/* ?week=N wins; else the highest week marked Open; else the latest week
   whose BeginDate has arrived; else week 1. Returns {week, row, next}. */
function resolveWeek(configRows) {
  const rows = normConfigRows(configRows);
  if (!rows.length) return null;
  const param = parseInt(qsParam("week"), 10);
  let row = null;
  if (!isNaN(param)) row = rows.find(r => r.week === param) || { week: param };
  if (!row) {
    const open = rows.filter(r => r.status === "open");
    if (open.length) row = open[open.length - 1];
  }
  if (!row) {
    const now = Date.now();
    const begun = rows.filter(r => r.beginMs != null && r.beginMs <= now);
    row = begun.length ? begun[begun.length - 1] : rows[0];
  }
  const i = rows.findIndex(r => r.week === row.week);
  return { week: row.week, row: row, next: i >= 0 ? rows[i + 1] || null : null };
}

function weekIsOpenClient(row) {
  if (!row || row.status !== "open") return false;
  if (row.deadlineISO) {
    const dl = Date.parse(row.deadlineISO);
    if (!isNaN(dl) && Date.now() >= dl) return false;
  }
  return true;
}

/* ---------------- Eastern-time formatting ---------------- */

const ET = "America/New_York";
function etParts(iso, opts) {
  const ms = Date.parse(iso);
  if (isNaN(ms)) return "";
  return new Intl.DateTimeFormat("en-US", Object.assign({ timeZone: ET }, opts)).format(new Date(ms));
}
function etDayKey(iso)  { return etParts(iso, { year: "numeric", month: "2-digit", day: "2-digit" }); }
function etDayLabel(iso){ return etParts(iso, { weekday: "long", month: "short", day: "numeric" }); }
function etTime(iso)    { return etParts(iso, { hour: "numeric", minute: "2-digit" }) + " ET"; }
function etDateTime(iso){ return etParts(iso, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET"; }

/* ---------------- misc ---------------- */

function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function countdownText(targetISO) {
  const ms = Date.parse(targetISO) - Date.now();
  if (isNaN(ms)) return "";
  if (ms <= 0) return "0:00";
  const d = Math.floor(ms / 86400000),
        h = Math.floor(ms / 3600000) % 24,
        m = Math.floor(ms / 60000) % 60,
        s = Math.floor(ms / 1000) % 60;
  if (d > 0) return d + "d " + h + "h " + m + "m";
  if (h > 0) return h + "h " + m + "m";
  return m + ":" + String(s).padStart(2, "0");
}

/* Normalized name key for matching roster <-> picks */
function nameKey(s) { return String(s || "").trim().toLowerCase(); }