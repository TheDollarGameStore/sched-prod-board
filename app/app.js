import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');

const REFRESH_MS = 2000; // R4
const acked = new Set();
let incidents = [];

// R5: the viewer's own locale and time zone; en-GB, de, fr, … put the day before the month.
const localTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function render() {
  loader?.remove(); // R3
  empty.hidden = incidents.length > 0;
  // R1: the API answers newest first; keep that order.
  list.innerHTML = incidents
    .map(
      (i) => `<li data-testid="incident-row" data-id="${esc(i.id)}" class="row ${esc(i.severity)}">
        <span class="id">${esc(i.id)}</span>
        <span class="sev">${esc(i.severity)}</span>
        <span class="what">${esc(i.service)} · ${esc(i.region)} · ${esc(i.summary)}</span>
        <time datetime="${esc(i.openedAt)}" title="${esc(i.openedAt)}">${localTime.format(new Date(i.openedAt))}</time>
        ${
          acked.has(i.id)
            ? '<span data-testid="acked" class="acked">acked</span>'
            : '<button type="button" data-testid="ack" class="ack">Ack</button>'
        }
      </li>`,
    )
    .join('');
}

// R2: Ack the incident whose row was clicked.
list.addEventListener('click', async (e) => {
  const button = e.target.closest('[data-testid="ack"]');
  if (!button) return;
  const { id } = button.closest('[data-testid="incident-row"]').dataset;
  button.disabled = true;
  try {
    await ack(id);
    acked.add(id);
    render();
  } catch (err) {
    console.error(err);
    button.disabled = false;
  }
});

// R4: refresh every 2 s while open; the next refresh waits for this one, so calls never overlap.
async function refresh() {
  try {
    incidents = (await fetchIncidents()).incidents;
    render();
  } catch (err) {
    console.error(err);
  }
  setTimeout(refresh, REFRESH_MS);
}

refresh();
