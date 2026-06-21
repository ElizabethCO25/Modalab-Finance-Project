// Lógica para la app de finanzas con Firebase Firestore
// Usa Firestore en la nube y hace fallback a localStorage si Firestore no está disponible.

const STORAGE_KEY = 'finances_entries_v1';
const SETTINGS_KEY = 'finances_settings_v1';
const USERS_KEY = 'finances_users_v1';
const UI_SETTINGS_KEY = 'finances_ui_settings_v1';
const entriesRef = db.collection('entries');
const settingsRef = db.collection('settings').doc('config');
const usersRef = db.collection('users');
const uiSettingsRef = db.collection('uiSettings').doc('config');
const defaultCategories = { 
  ingresos: ['Sueldo', 'Ventas', 'Freelance', 'Otros'], 
  egresos: ['Comida', 'Transporte', 'Servicios', 'Otros'] 
};
const CHART_WINDOW_SIZE = 3;
let userSettings = { categories: { ingresos: [...defaultCategories.ingresos], egresos: [...defaultCategories.egresos] }, showFutureMonths: true };
let uiSettings = { appTitle: 'Registro de Ingresos y Egresos', logoUrl: '', primaryColor: '#0d6efd', bgColor: '#f8f9fa', bgImageUrl: '' };
let chartCenter = null;
let monthChart = null;
let currentUser = null;

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function monthKey(dateStr){
  const [y, m] = dateStr.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}`;
}

function formatMonthLabel(year, month){
  return `${String(month).padStart(2,'0')}/${year}`;
}

function parseYearMonth(dateStr){
  const [y, m] = dateStr.split('-').map(Number);
  return { year: y, month: m };
}

function monthOffset(base, offset){
  let year = base.year;
  let month = base.month + offset;
  while(month < 1){ month += 12; year -= 1; }
  while(month > 12){ month -= 12; year += 1; }
  return { year, month };
}

function getCurrentCenter(){
  if(chartCenter) return chartCenter;
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function compareDatesDesc(a, b){
  return b.date.localeCompare(a.date);
}

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

function loadEntriesLocal(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch (e) { return []; }
}

function saveEntriesLocal(entries){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadSettingsLocal(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); }
  catch (e) { return null; }
}

function saveSettingsLocal(settings){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// Funciones para gestión de usuarios
async function apiLoadUsers(){
  try {
    const snapshot = await usersRef.get();
    const users = {};
    snapshot.forEach(doc => users[doc.id] = doc.data());
    return users;
  } catch (e) {
    console.warn('Firestore no disponible para usuarios, usando localStorage', e.message || e);
    return loadUsersLocal();
  }
}

async function apiSaveUser(username, userData){
  try {
    await usersRef.doc(username).set(userData);
    return true;
  } catch (e) {
    console.warn('Error guardando usuario en Firestore', e.message || e);
    const users = loadUsersLocal();
    users[username] = userData;
    saveUsersLocal(users);
    return false;
  }
}

async function apiDeleteUser(username){
  try {
    await usersRef.doc(username).delete();
    return true;
  } catch (e) {
    console.warn('Error borrando usuario en Firestore', e.message || e);
    const users = loadUsersLocal();
    delete users[username];
    saveUsersLocal(users);
    return false;
  }
}

function loadUsersLocal(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
  catch (e) { return {}; }
}

function saveUsersLocal(users){
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

async function initDefaultUsers(){
  const users = await apiLoadUsers();
  if (!users['admin']) {
    await apiSaveUser('admin', { username: 'admin', password: 'admin', role: 'admin' });
  }
  if (!users['modalab']) {
    await apiSaveUser('modalab', { username: 'modalab', password: 'modalab', role: 'user' });
  }
}

// Funciones para configuración UI
async function loadUISettings(){
  const defaults = { appTitle: 'Registro de Ingresos y Egresos', logoUrl: '', primaryColor: '#0d6efd', bgColor: '#f8f9fa', bgImageUrl: '' };
  try {
    const doc = await uiSettingsRef.get();
    if(doc.exists){
      uiSettings = { ...defaults, ...doc.data() };
      return;
    }
  } catch (e) {
    console.warn('No se pudo cargar configuración UI desde Firestore', e.message || e);
  }
  const local = localStorage.getItem(UI_SETTINGS_KEY);
  if(local){
    try { uiSettings = { ...defaults, ...JSON.parse(local) }; }
    catch (e) { uiSettings = { ...defaults }; }
  } else {
    uiSettings = { ...defaults };
  }
}

async function saveUISettings(){
  try {
    await uiSettingsRef.set(uiSettings, { merge: true });
  } catch (e) {
    console.warn('No se pudo guardar configuración UI en Firestore', e.message || e);
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(uiSettings));
  }
}

function applyUISettings(){
  document.getElementById('appTitle').textContent = uiSettings.appTitle || 'Registro de Ingresos y Egresos';
  document.getElementById('loginTitle').textContent = uiSettings.appTitle || 'Iniciar Sesión';
  
  const navLogo = document.getElementById('navLogo');
  const loginLogo = document.getElementById('loginLogo');
  if (uiSettings.logoUrl) {
    navLogo.src = uiSettings.logoUrl;
    navLogo.style.display = 'block';
    loginLogo.src = uiSettings.logoUrl;
    loginLogo.style.display = 'block';
  } else {
    navLogo.style.display = 'none';
    loginLogo.style.display = 'none';
  }
  
  const customStyles = document.getElementById('customStyles');
  let css = '';
  if (uiSettings.primaryColor) {
    css += `.bg-primary { background-color: ${uiSettings.primaryColor} !important; } `;
    css += `.btn-primary { background-color: ${uiSettings.primaryColor}; border-color: ${uiSettings.primaryColor}; } `;
    css += `.navbar-dark .navbar-nav .nav-link.active { color: ${uiSettings.primaryColor}; } `;
  }
  if (uiSettings.bgColor && !uiSettings.bgImageUrl) {
    css += `body { background-color: ${uiSettings.bgColor} !important; } `;
  }
  if (uiSettings.bgImageUrl) {
    css += `body { background-image: url('${uiSettings.bgImageUrl}'); background-size: cover; background-attachment: fixed; background-position: center; } `;
  }
  customStyles.textContent = css;
}

async function loadSettings(){
  const defaults = { categories: { ingresos: [...defaultCategories.ingresos], egresos: [...defaultCategories.egresos] }, showFutureMonths: true };
  try {
    const doc = await settingsRef.get();
    if(doc.exists){
      const data = doc.data();
      userSettings = { ...defaults, ...data };
      // Migrar formato antiguo (array) al nuevo (object con ingresos/egresos)
      if(Array.isArray(userSettings.categories)){
        userSettings.categories = { ingresos: [...userSettings.categories], egresos: [...defaultCategories.egresos] };
      }
      if(!userSettings.categories.ingresos || userSettings.categories.ingresos.length === 0){
        userSettings.categories.ingresos = [...defaultCategories.ingresos];
      }
      if(!userSettings.categories.egresos || userSettings.categories.egresos.length === 0){
        userSettings.categories.egresos = [...defaultCategories.egresos];
      }
      return;
    }
  } catch (e) {
    console.warn('No se pudo cargar configuración desde Firestore', e.message || e);
  }
  const local = loadSettingsLocal();
  if(local){
    userSettings = { ...defaults, ...local };
    // Migrar formato antiguo si es necesario
    if(Array.isArray(userSettings.categories)){
      userSettings.categories = { ingresos: [...userSettings.categories], egresos: [...defaultCategories.egresos] };
    }
  } else {
    userSettings = { ...defaults };
  }
}

async function saveSettings(){
  try {
    await settingsRef.set(userSettings, { merge: true });
  } catch (e) {
    console.warn('No se pudo guardar configuración en Firestore', e.message || e);
    saveSettingsLocal(userSettings);
  }
}

function getNormalizedType(typeValue){
  // Convierte "ingreso"/"egreso" a "ingresos"/"egresos"
  return typeValue === 'egreso' ? 'egresos' : 'ingresos';
}

function populateCategorySelects(type = 'ingreso'){
  const normalizedType = getNormalizedType(type);
  const categorySelect = document.getElementById('category');
  const filterCategory = document.getElementById('filterCategory');
  const categories = userSettings.categories[normalizedType] || [];
  
  categorySelect.innerHTML = '';
  filterCategory.innerHTML = '<option value="">Todas las categorías</option>';
  
  categories.forEach(cat => {
    if(cat !== 'Otros'){
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
      const optionFilter = document.createElement('option');
      optionFilter.value = cat;
      optionFilter.textContent = cat;
      filterCategory.appendChild(optionFilter);
    }
  });
  
  const optionOther = document.createElement('option');
  optionOther.value = 'Otra';
  optionOther.textContent = 'Otra...';
  categorySelect.appendChild(optionOther);
}

function renderCategoryList(){
  const list = document.getElementById('categoryList');
  list.innerHTML = '';
  const categoryType = document.getElementById('adminCategoryType').value;
  const categories = userSettings.categories[categoryType] || [];
  
  const typeLabel = document.createElement('div');
  typeLabel.className = 'mb-2 fw-bold text-muted small';
  typeLabel.textContent = categoryType === 'ingresos' ? 'Categorías de Ingresos' : 'Categorías de Egresos';
  list.appendChild(typeLabel);
  
  categories.forEach(cat => {
    const item = document.createElement('li');
    item.className = 'list-group-item d-flex justify-content-between align-items-center';
    item.innerHTML = `<span>${cat}</span><button class="btn btn-sm btn-outline-danger remove-category" data-cat="${cat}" data-type="${categoryType}">Eliminar</button>`;
    list.appendChild(item);
  });
}

function getChartWindow(center){
  const half = Math.floor(CHART_WINDOW_SIZE / 2);
  const months = [];
  for(let offset = -half; offset <= half; offset++){
    months.push(monthOffset(center, offset));
  }
  return months;
}

function buildMonthOptions(){
  const select = document.getElementById('chartCenterMonth');
  select.innerHTML = '';
  const now = new Date();
  const current = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const selected = chartCenter || current;
  const rangeStart = monthOffset(current, -6);
  const rangeEnd = userSettings.showFutureMonths ? monthOffset(current, 6) : current;
  const months = [];
  let pointer = rangeStart;

  while(pointer.year < rangeEnd.year || (pointer.year === rangeEnd.year && pointer.month <= rangeEnd.month)){
    months.push({ year: pointer.year, month: pointer.month });
    if(pointer.month === 12){ pointer = { year: pointer.year + 1, month: 1 }; }
    else { pointer = { year: pointer.year, month: pointer.month + 1 }; }
  }

  const selectedKey = `${selected.year}-${String(selected.month).padStart(2,'0')}`;
  if(!months.some(m => `${m.year}-${String(m.month).padStart(2,'0')}` === selectedKey)){
    months.push(selected);
  }

  months.sort((a, b) => a.year === b.year ? a.month - b.month : a.year - b.year);
  months.forEach(m => {
    const option = document.createElement('option');
    option.value = `${m.year}-${String(m.month).padStart(2,'0')}`;
    option.textContent = formatMonthLabel(m.year, m.month);
    select.appendChild(option);
  });
}

function updateChartCenterSelect(){
  const select = document.getElementById('chartCenterMonth');
  const center = getCurrentCenter();
  const value = `${center.year}-${String(center.month).padStart(2,'0')}`;
  if(!Array.from(select.options).some(opt => opt.value === value)){
    const option = document.createElement('option');
    option.value = value;
    option.textContent = formatMonthLabel(center.year, center.month);
    select.appendChild(option);
  }
  select.value = value;
}

function setChartCenter(year, month){
  chartCenter = { year, month };
  updateChartCenterSelect();
  refreshChart();
}

function refreshChart(){
  const entries = window.latestEntries || [];
  drawCharts(entries);
}

async function refreshEntries(){
  const entries = await apiLoadEntries();
  window.latestEntries = entries;
  renderEntries(entries);
  await updateSummary(entries);
}

function safeDateCompare(date, boundary){
  return date.localeCompare(boundary);
}

async function addEntry(e){
  e.preventDefault();
  const date = document.getElementById('date').value;
  const type = document.getElementById('type').value;
  let category = document.getElementById('category').value;
  const custom = document.getElementById('categoryCustom').value.trim();
  if(category === 'Otra' && custom) category = custom;
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
  const sorted = entries.slice().sort(compareDatesDesc);
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

function computeMonthlyTotals(entries){
  const map = {};
  entries.forEach(e => {
    const key = monthKey(e.date);
    if(!map[key]) map[key] = { ingresos: 0, egresos: 0 };
    if(e.type === 'ingreso') map[key].ingresos += Number(e.amount);
    else map[key].egresos += Number(e.amount);
  });
  return map;
}

async function updateSummary(entries){
  if (!entries) entries = await apiLoadEntries();
  window.latestEntries = entries;
  const map = computeMonthlyTotals(entries);
  const filterMonth = document.getElementById('filterMonth').value;
  const summaryEl = document.getElementById('summary');

  if (filterMonth) {
    const data = map[filterMonth] || { ingresos: 0, egresos: 0 };
    const balance = data.ingresos - data.egresos;
    summaryEl.innerHTML = `<div class="row"><div class="col"><strong>Ingresos:</strong> ${data.ingresos.toFixed(2)}</div><div class="col"><strong>Egresos:</strong> ${data.egresos.toFixed(2)}</div><div class="col"><strong>Balance:</strong> ${balance.toFixed(2)}</div></div>`;
  } else {
    const totalIn = entries.reduce((sum, e) => sum + (e.type === 'ingreso' ? Number(e.amount) : 0), 0);
    const totalOut = entries.reduce((sum, e) => sum + (e.type === 'egreso' ? Number(e.amount) : 0), 0);
    summaryEl.innerHTML = `<div class="row"><div class="col"><strong>Total ingresos:</strong> ${totalIn.toFixed(2)}</div><div class="col"><strong>Total egresos:</strong> ${totalOut.toFixed(2)}</div><div class="col"><strong>Balance:</strong> ${(totalIn - totalOut).toFixed(2)}</div></div>`;
  }

  refreshChart();
}

function drawCharts(entries){
  const map = computeMonthlyTotals(entries);
  const center = getCurrentCenter();
  const windowMonths = getChartWindow(center);
  const labels = windowMonths.map(m => formatMonthLabel(m.year, m.month));
  const incomes = windowMonths.map(m => {
    const key = `${m.year}-${String(m.month).padStart(2,'0')}`;
    return (map[key] && map[key].ingresos) || 0;
  });
  const expenses = windowMonths.map(m => {
    const key = `${m.year}-${String(m.month).padStart(2,'0')}`;
    return (map[key] && map[key].egresos) || 0;
  });

  const ctx = document.getElementById('monthChart').getContext('2d');
  if(monthChart) monthChart.destroy();
  monthChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Ingresos', data: incomes, backgroundColor: 'rgba(40,167,69,0.8)' },
        { label: 'Egresos', data: expenses, backgroundColor: 'rgba(220,53,69,0.8)' }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' } },
      scales: {
        y: { beginAtZero: true },
        x: { grid: { display: false } }
      }
    }
  });
}

function applyFilter(){
  const filterMonth = document.getElementById('filterMonth').value;
  const start = document.getElementById('filterStart').value;
  const end = document.getElementById('filterEnd').value;
  const category = document.getElementById('filterCategory').value;
  let rows = window.latestEntries || [];

  if (filterMonth) {
    rows = rows.filter(e => monthKey(e.date) === filterMonth);
    setChartCenter(parseYearMonth(filterMonth).year, parseYearMonth(filterMonth).month);
  }
  if (start) {
    rows = rows.filter(e => safeDateCompare(e.date, start) >= 0);
  }
  if (end) {
    rows = rows.filter(e => safeDateCompare(e.date, end) <= 0);
  }
  if (category) {
    rows = rows.filter(e => e.category === category);
  }

  renderEntries(rows);
  drawCharts(rows);
  const totalIn = rows.reduce((sum, e) => sum + (e.type === 'ingreso' ? Number(e.amount) : 0), 0);
  const totalOut = rows.reduce((sum, e) => sum + (e.type === 'egreso' ? Number(e.amount) : 0), 0);
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

function renderAdminOptions(){
  renderCategoryList();
  document.getElementById('enableFutureMonths').checked = !!userSettings.showFutureMonths;
  buildMonthOptions();
  setChartCenter(getCurrentCenter().year, getCurrentCenter().month);
  populateCategorySelects('ingreso');
}

async function addCategory(){
  const input = document.getElementById('newCategoryInput');
  const value = input.value.trim();
  const categoryType = document.getElementById('adminCategoryType').value;
  
  if (!value) return;
  if (userSettings.categories[categoryType].includes(value)){
    return alert('La categoría ya existe');
  }
  
  userSettings.categories[categoryType].push(value);
  await saveSettings();
  populateCategorySelects(categoryType);
  renderCategoryList();
  input.value = '';
}

async function removeCategory(category, type){
  userSettings.categories[type] = userSettings.categories[type].filter(c => c !== category);
  await saveSettings();
  populateCategorySelects(type);
  renderCategoryList();
}

function attachAdminEvents(){
  document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
  document.getElementById('adminCategoryType').addEventListener('change', ev => {
    renderCategoryList();
  });
  document.getElementById('categoryList').addEventListener('click', async ev => {
    if(ev.target.classList.contains('remove-category')){
      const category = ev.target.dataset.cat;
      const type = ev.target.dataset.type;
      await removeCategory(category, type);
    }
  });
  document.getElementById('enableFutureMonths').addEventListener('change', async ev => {
    userSettings.showFutureMonths = ev.target.checked;
    await saveSettings();
    renderAdminOptions();
  });
  document.getElementById('chartCenterMonth').addEventListener('change', ev => {
    const [year, month] = ev.target.value.split('-').map(Number);
    setChartCenter(year, month);
  });
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    const current = getCurrentCenter();
    const prev = monthOffset(current, -1);
    setChartCenter(prev.year, prev.month);
  });
  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    const current = getCurrentCenter();
    const next = monthOffset(current, 1);
    setChartCenter(next.year, next.month);
  });
}

// Funciones para gestión de usuarios en UI
async function renderUserList(){
  const userList = document.getElementById('userList');
  if (!userList) return;
  userList.innerHTML = '';
  const users = await apiLoadUsers();
  Object.keys(users).forEach(username => {
    const user = users[username];
    const item = document.createElement('li');
    item.className = 'list-group-item d-flex justify-content-between align-items-center';
    const roleBadge = user.role === 'admin' ? '<span class="badge bg-danger">Admin</span>' : '<span class="badge bg-secondary">Usuario</span>';
    item.innerHTML = `<div><strong>${username}</strong> ${roleBadge}</div><button class="btn btn-sm btn-outline-danger delete-user" data-username="${username}">Eliminar</button>`;
    userList.appendChild(item);
  });
  
  userList.querySelectorAll('.delete-user').forEach(btn => {
    btn.addEventListener('click', async ev => {
      const username = ev.target.dataset.username;
      if (username === currentUser.username) {
        alert('No puedes eliminar tu propio usuario');
        return;
      }
      if (confirm(`¿Eliminar usuario ${username}?`)) {
        await apiDeleteUser(username);
        renderUserList();
      }
    });
  });
}

async function createUser(){
  const usernameInput = document.getElementById('newUsername');
  const passInput = document.getElementById('newUserpass');
  const roleSelect = document.getElementById('newUserRole');
  
  const username = usernameInput.value.trim();
  const password = passInput.value.trim();
  const role = roleSelect.value;
  
  if (!username || !password) {
    alert('Usuario y contraseña son requeridos');
    return;
  }
  
  const users = await apiLoadUsers();
  if (users[username]) {
    alert('El usuario ya existe');
    return;
  }
  
  await apiSaveUser(username, { username, password, role });
  usernameInput.value = '';
  passInput.value = '';
  renderUserList();
  alert('Usuario creado exitosamente');
}

async function loadUISettingsForm(){
  document.getElementById('uiAppTitle').value = uiSettings.appTitle || '';
  document.getElementById('uiLogoUrl').value = uiSettings.logoUrl || '';
  document.getElementById('uiPrimaryColor').value = uiSettings.primaryColor || '#0d6efd';
  document.getElementById('uiBgColor').value = uiSettings.bgColor || '#f8f9fa';
  document.getElementById('uiBgImageUrl').value = uiSettings.bgImageUrl || '';
}

async function saveUISettingsForm(){
  uiSettings.appTitle = document.getElementById('uiAppTitle').value.trim() || 'Registro de Ingresos y Egresos';
  uiSettings.logoUrl = document.getElementById('uiLogoUrl').value.trim();
  uiSettings.primaryColor = document.getElementById('uiPrimaryColor').value;
  uiSettings.bgColor = document.getElementById('uiBgColor').value;
  uiSettings.bgImageUrl = document.getElementById('uiBgImageUrl').value.trim();
  
  await saveUISettings();
  applyUISettings();
  alert('Configuración guardada exitosamente');
}

function resetUISettingsForm(){
  uiSettings = { appTitle: 'Registro de Ingresos y Egresos', logoUrl: '', primaryColor: '#0d6efd', bgColor: '#f8f9fa', bgImageUrl: '' };
  loadUISettingsForm();
  saveUISettings();
  applyUISettings();
}

function attachUIManagementEvents(){
  const createBtn = document.getElementById('createUserBtn');
  if (createBtn) {
    createBtn.addEventListener('click', createUser);
  }
  
  const saveUiBtn = document.getElementById('saveUiSettings');
  if (saveUiBtn) {
    saveUiBtn.addEventListener('click', saveUISettingsForm);
  }
  
  const resetUiBtn = document.getElementById('resetUiSettings');
  if (resetUiBtn) {
    resetUiBtn.addEventListener('click', resetUISettingsForm);
  }
}

function showAdminPanel(isAdmin){
  const adminOnlyElements = document.querySelectorAll('.admin-only');
  adminOnlyElements.forEach(el => {
    el.style.display = isAdmin ? 'block' : 'none';
  });
}

async function init(){
  // Cargar configuración UI primero
  await loadUISettings();
  applyUISettings();
  
  // Inicializar usuarios por defecto
  await initDefaultUsers();
  
  const typeSelect = document.getElementById('type');
  
  typeSelect.addEventListener('change', ev => {
    populateCategorySelects(ev.target.value);
  });
  
  document.getElementById('category').addEventListener('change', ev => {
    const show = ev.target.value === 'Otra';
    document.getElementById('categoryCustom').style.display = show ? 'block' : 'none';
  });
  
  document.getElementById('entryForm').addEventListener('submit', addEntry);
  document.getElementById('clearBtn').addEventListener('click', () => document.getElementById('entryForm').reset());
  document.getElementById('applyFilter').addEventListener('click', applyFilter);
  document.getElementById('exportCsv').addEventListener('click', exportCsv);
  document.getElementById('printReport').addEventListener('click', printReport);
  attachAdminEvents();
  attachUIManagementEvents();
  await loadSettings();
  populateCategorySelects('ingreso');
  renderAdminOptions();
  await refreshEntries();
  document.getElementById('filterMonth').addEventListener('change', applyFilter);
}

// Sistema de autenticación
async function handleLogin(e){
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value.trim();
  const errorDiv = document.getElementById('loginError');
  
  if (!username || !password) {
    errorDiv.textContent = 'Usuario y contraseña son requeridos';
    errorDiv.classList.remove('d-none');
    return;
  }
  
  const users = await apiLoadUsers();
  const user = users[username];
  
  if (!user || user.password !== password) {
    errorDiv.textContent = 'Usuario o contraseña incorrectos';
    errorDiv.classList.remove('d-none');
    return;
  }
  
  currentUser = { username: user.username, role: user.role };
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appContainer').style.display = 'block';
  
  document.getElementById('userInfo').textContent = `${user.username} (${user.role === 'admin' ? 'Admin' : 'Usuario'})`;
  
  showAdminPanel(user.role === 'admin');
  
  if (user.role === 'admin') {
    renderUserList();
    loadUISettingsForm();
  }
  
  init();
}

function handleLogout(){
  currentUser = null;
  localStorage.removeItem('currentUser');
  document.getElementById('appContainer').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'block';
  document.getElementById('loginForm').reset();
  document.getElementById('loginError').classList.add('d-none');
}

async function checkSession(){
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      const users = await apiLoadUsers();
      if (users[currentUser.username]) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        
        const user = users[currentUser.username];
        document.getElementById('userInfo').textContent = `${currentUser.username} (${currentUser.role === 'admin' ? 'Admin' : 'Usuario'})`;
        
        showAdminPanel(currentUser.role === 'admin');
        
        if (currentUser.role === 'admin') {
          renderUserList();
          loadUISettingsForm();
        }
        
        return true;
      }
    } catch (e) {
      console.warn('Error al validar sesión', e);
    }
  }
  return false;
}

document.addEventListener('DOMContentLoaded', async () => {
  const hasSession = await checkSession();
  
  if (!hasSession) {
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
    
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  } else {
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  }
});
