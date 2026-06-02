// Lógica para la app de finanzas con Firebase Firestore
// Usa Firestore en la nube y hace fallback a localStorage si Firestore no está disponible.

const STORAGE_KEY = 'finances_entries_v1';
const entriesRef = db.collection('entries');

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

/* ---------- Acceso a datos: Firestore con fallback ---------- */
async function apiLoadEntries(){
  try {
    const snapshot = await entriesRef.orderBy('date', 'desc').get();
    const entries = [];
    snapshot.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
    return entries;
  } catch (e) {
    console.warn('Firestore no disponible, usando localStorage', e.message || e);
    return loadEntriesLocal();
  }
}

async function apiSaveEntry(entry){
  try {
    await entriesRef.doc(entry.id).set(entry);
    return true;
  } catch (e) {
    console.warn('Error guardando en Firestore, guardando en localStorage', e.message || e);
    const entries = loadEntriesLocal();
    entries.push(entry);
    saveEntriesLocal(entries);
    return false;
  }
}

async function apiDeleteEntry(id){
  try {
    await entriesRef.doc(id).delete();
    return true;
  } catch (e) {
    console.warn('Error borrando en Firestore, borrando en localStorage', e.message || e);
    const entries = loadEntriesLocal().filter(x => x.id !== id);
    saveEntriesLocal(entries);
    return false;
  }
}

/* ---------- localStorage helpers (fallback) ---------- */
function loadEntriesLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch (e) { return []; }
}

function saveEntriesLocal(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/* ---------- CRUD de la UI ---------- */
async function addEntry(e){
  e.preventDefault();
  const date = document.getElementById('date').value;
  const type = document.getElementById('type').value;
  let category = document.getElementById('category').value;
  const custom = document.getElementById('categoryCustom').value.trim();
  if (category === 'Otra' && custom) category = custom;
  const amount = parseFloat(document.getElementById('amount').value) || 0;
  const description = document.getElementById('description').value.trim();

  if (!date || !amount) {
    return alert('Fecha y monto son obligatorios');
  }

  const entry = {
    id: uid(),
    date,
    type,
    category,
    amount: Math.abs(amount),
    description
  };

  await apiSaveEntry(entry);
  await refreshEntries();
  document.getElementById('entryForm').reset();
  document.getElementById('categoryCustom').style.display = 'none';
}

async function deleteEntry(id){
  if (!confirm('¿Eliminar este registro?')) return;
  await apiDeleteEntry(id);
  await refreshEntries();
}

function renderEntries(entries){
  const tbody = document.querySelector('#entriesTable tbody');
  tbody.innerHTML = '';
  const sorted = entries.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  for (const e of sorted) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.type}</td>
      <td>${e.category}</td>
      <td>${e.type === 'egreso' ? '-' : ''}${Number(e.amount).toFixed(2)}</td>
      <td>${e.description || ''}</td>
      <td><button class="btn btn-sm btn-outline-danger" data-id="${e.id}">Eliminar</button></td>`;
    tbody.appendChild(tr);
  }
  tbody.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', ev => deleteEntry(ev.currentTarget.dataset.id)));
}

function monthKey(dateStr){
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}`;
}

function computeMonthlyTotals(entries){
  const map = {};
  for (const e of entries) {
    const k = monthKey(e.date);
    if (!map[k]) map[k] = { ingresos: 0, egresos: 0 };
    if (e.type === 'ingreso') map[k].ingresos += Number(e.amount);
    else map[k].egresos += Number(e.amount);
  }
  return map;
}

let monthChart = null;

async function refreshEntries(){
  const entries = await apiLoadEntries();
  renderEntries(entries);
  await updateSummary(entries);
}

async function updateSummary(entries){
  if (!entries) entries = await apiLoadEntries();
  const map = computeMonthlyTotals(entries);
  const filterMonth = document.getElementById('filterMonth').value;
  const summaryEl = document.getElementById('summary');

  if (filterMonth) {
    const key = filterMonth;
    const data = map[key] || { ingresos: 0, egresos: 0 };
    const balance = (data.ingresos || 0) - (data.egresos || 0);
    summaryEl.innerHTML = `<div class="row"><div class="col"><strong>Ingresos:</strong> ${ (data.ingresos || 0).toFixed(2) }</div><div class="col"><strong>Egresos:</strong> ${(data.egresos || 0).toFixed(2)}</div><div class="col"><strong>Balance:</strong> ${balance.toFixed(2)}</div></div>`;
  } else {
    const totalIn = entries.reduce((s, e) => s + (e.type === 'ingreso' ? Number(e.amount) : 0), 0);
    const totalOut = entries.reduce((s, e) => s + (e.type === 'egreso' ? Number(e.amount) : 0), 0);
    summaryEl.innerHTML = `<div class="row"><div class="col"><strong>Total ingresos:</strong> ${totalIn.toFixed(2)}</div><div class="col"><strong>Total egresos:</strong> ${totalOut.toFixed(2)}</div><div class="col"><strong>Balance:</strong> ${(totalIn - totalOut).toFixed(2)}</div></div>`;
  }

  drawCharts(entries);
}

function drawCharts(entries){
  const filterMonth = document.getElementById('filterMonth').value;
  const labels = [];
  const incomes = [];
  const expenses = [];
  const map = computeMonthlyTotals(entries);

  if (filterMonth) {
    const [y, m] = filterMonth.split('-').map(Number);
    const key = `${y}-${String(m).padStart(2, '0')}`;
    labels.push(`${String(m).padStart(2, '0')}/${y}`);
    const d = map[key] || { ingresos: 0, egresos: 0 };
    incomes.push(d.ingresos);
    expenses.push(d.egresos);
  } else {
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      labels.push(`${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`);
      const d = map[key] || { ingresos: 0, egresos: 0 };
      incomes.push(d.ingresos);
      expenses.push(d.egresos);
    }
  }

  const ctx = document.getElementById('monthChart').getContext('2d');
  if (monthChart) monthChart.destroy();
  monthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Ingresos', data: incomes, backgroundColor: 'rgba(40,167,69,0.75)' },
        { label: 'Egresos', data: expenses, backgroundColor: 'rgba(220,53,69,0.75)' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

async function applyFilter(){
  const filterMonth = document.getElementById('filterMonth').value;
  const start = document.getElementById('filterStart').value;
  const end = document.getElementById('filterEnd').value;
  const category = document.getElementById('filterCategory').value;
  let rows = await apiLoadEntries();

  if (filterMonth) {
    const [y, m] = filterMonth.split('-').map(Number);
    rows = rows.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === y && (d.getMonth() + 1) === m;
    });
  }
  if (start) {
    const s = new Date(start);
    rows = rows.filter(e => new Date(e.date) >= s);
  }
  if (end) {
    const ed = new Date(end);
    rows = rows.filter(e => new Date(e.date) <= ed);
  }
  if (category) {
    rows = rows.filter(e => e.category === category);
  }

  renderEntries(rows);
  drawCharts(rows);
  const totalIn = rows.reduce((s, e) => s + (e.type === 'ingreso' ? Number(e.amount) : 0), 0);
  const totalOut = rows.reduce((s, e) => s + (e.type === 'egreso' ? Number(e.amount) : 0), 0);
  document.getElementById('summary').innerHTML = `<div class="row"><div class="col"><strong>Ingresos:</strong> ${totalIn.toFixed(2)}</div><div class="col"><strong>Egresos:</strong> ${totalOut.toFixed(2)}</div><div class="col"><strong>Balance:</strong> ${(totalIn - totalOut).toFixed(2)}</div></div>`;
}

function exportCsv(){
  const rows = document.querySelectorAll('#entriesTable tbody tr');
  if (rows.length === 0) return alert('No hay registros para exportar');
  let csv = 'Fecha,Tipo,Categoría,Monto,Descripción\n';
  rows.forEach(r => {
    const cells = r.querySelectorAll('td');
    csv += `${cells[0].innerText},${cells[1].innerText},"${cells[2].innerText}",${cells[3].innerText.replace(',','')},"${cells[4].innerText}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finances_export.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport(){ window.print(); }

async function init(){
  document.getElementById('category').addEventListener('change', ev => {
    const show = ev.target.value === 'Otra';
    document.getElementById('categoryCustom').style.display = show ? 'block' : 'none';
  });

  document.getElementById('entryForm').addEventListener('submit', addEntry);
  document.getElementById('clearBtn').addEventListener('click', () => document.getElementById('entryForm').reset());
  document.getElementById('applyFilter').addEventListener('click', applyFilter);
  document.getElementById('exportCsv').addEventListener('click', exportCsv);
  document.getElementById('printReport').addEventListener('click', printReport);

  await refreshEntries();
}

document.addEventListener('DOMContentLoaded', init);
