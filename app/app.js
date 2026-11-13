import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const newBar = document.querySelector('[data-testid="new-bar"]');

const REFRESH_MS = 2000; // R4
const shown = new Set(); // ids on screen; rows on screen never move or get replaced (R1)
let pending = []; // newer incidents waiting behind the "N new" bar, newest first

// R5: the viewer's own locale and time zone; en-GB, de, fr, … put the day before the month.
const localTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const rowHtml = (i) => `<li data-testid="incident-row" data-id="${esc(i.id)}" class="row ${esc(i.severity)}">
    <span class="id">${esc(i.id)}</span>
    <span class="sev">${esc(i.severity)}</span>
    <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
    <time datetime="${esc(i.openedAt)}" title="${esc(i.openedAt)}">${localTime.format(new Date(i.openedAt))}</time>
    <button type="button" data-testid="ack" class="ack">Ack</button>
  </li>`;

// Adds incidents above the rows already on screen, newest first; existing rows stay as they are.
function showIncidents(incidents) {
  list.insertAdjacentHTML('afterbegin', incidents.map(rowHtml).join(''));
  for (const i of incidents) shown.add(i.id);
  empty.hidden = shown.size > 0;
}

// R1 (product, after step 1): the "N new" bar holds its space, so showing it never moves a row.
function updateBar() {
  const n = pending.length;
  newBar.textContent = `${n} new incident${n === 1 ? '' : 's'} · show`;
  newBar.classList.toggle('on', n > 0);
}

newBar.addEventListener('click', () => {
  showIncidents(pending);
  pending = [];
  updateBar();
});

// R2: Ack the incident whose row was clicked; only that row changes.
list.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-testid="ack"]');
  if (!button) return;
  const { id } = button.closest('[data-testid="incident-row"]').dataset;
  button.disabled = true;
  try {
    await ack(id);
    button.outerHTML = '<span data-testid="acked" class="acked">acked</span>';
  } catch (err) {
    console.error(err);
    button.disabled = false;
  }
});

// R4: refresh every 2 s while open; the next refresh waits for this one, so calls never overlap.
async function refresh() {
  try {
    const { incidents } = await fetchIncidents();
    const fresh = incidents.filter((i) => !shown.has(i.id));
    if (loader?.isConnected) {
      loader.remove(); // R3
      showIncidents(fresh); // first load: nothing on screen to hold yet
    } else {
      pending = fresh;
      updateBar();
    }
  } catch (err) {
    console.error(err);
  }
  setTimeout(refresh, REFRESH_MS);
}

refresh();
