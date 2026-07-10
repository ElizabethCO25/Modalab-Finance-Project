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
let allEntries = []; // Variable global para almacenar todos los registros
let selectedEntries = new Set(); // IDs de registros seleccionados

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
    const snapshot = await entriesRef.get();
    const entries = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Eliminar CUALQUIER campo 'id' interno del documento y usar SIEMPRE doc.id
      // Esto asegura consistencia incluso si hay documentos antiguos con campo 'id' interno
      const { id: internalId, ...restData } = data;
      const entry = { id: doc.id, ...restData };
      console.log('apiLoadEntries: cargando doc.id=', doc.id, '| internalId=', internalId, '| entry.id=', entry.id);
      entries.push(entry);
    });
    allEntries = entries;
    console.log('apiLoadEntries: total cargados:', entries.length, '| IDs:', entries.map(e => e.id));
    return entries;
  } catch (e) {
    console.warn('Firestore no disponible, usando localStorage', e.message || e);
    const entries = loadEntriesLocal();
    allEntries = entries;
    return entries;
  }
}

async function apiSaveEntry(entry){
  try {
    console.log('apiSaveEntry: creando nuevo registro con datos:', entry);
    // Nuevo registro: crear documento y asignar su id real
    // Crear una copia SIN el campo id para evitar que Firestore tenga un campo 'id' redundante
    const { id: _, ...entryData } = entry;
    const doc = await entriesRef.add(entryData);
    const newEntry = { id: doc.id, ...entryData };
    console.log('apiSaveEntry: nuevo ID asignado:', doc.id);
    allEntries.unshift(newEntry);
    updateSummaryDisplay();
    return newEntry;
  } catch (e) {
    console.warn('Error guardando en Firestore, usando localStorage', e.message || e);
    const entries = loadEntriesLocal();
    const { id: _, ...entryData } = entry;
    const newEntry = { id: uid(), ...entryData };
    entries.unshift(newEntry);
    saveEntriesLocal(entries);
    allEntries = entries;
    updateSummaryDisplay();
    return newEntry;
  }
}

async function apiDeleteEntry(id){
  try {
    console.log('apiDeleteEntry: eliminando doc con ID:', id);
    await entriesRef.doc(id).delete();
    // Filtrar usando el ID correcto (doc.id)
    allEntries = allEntries.filter(e => e.id !== id);
    console.log('apiDeleteEntry: entradas restantes:', allEntries.map(e => e.id));
    updateSummaryDisplay();
  } catch (e) {
    console.warn('Error borrando en Firestore, usando localStorage', e.message || e);
    const entries = loadEntriesLocal();
    const updated = entries.filter(e => e.id !== id);
    saveEntriesLocal(updated);
    allEntries = updated;
    updateSummaryDisplay();
  }
}

async function apiUpdateEntry(entry, docId){
  try {
    // Usar SIEMPRE el docId pasado como parámetro (es el doc.id real de Firestore)
    if(!docId){
      console.error('apiUpdateEntry: docId es requerido');
      return;
    }
    console.log('apiUpdateEntry: actualizando doc con ID:', docId);
    
    // Crear una copia del entry sin el campo id para evitar inconsistencias
    const { id, ...entryData } = entry;
    
    // Actualizar el documento en Firestore - USAR set SIN merge para reemplazar completamente
    // y eliminar cualquier campo 'id' interno viejo que pueda existir
    await entriesRef.doc(docId).set(entryData);
    
    // Actualizar array local: buscar por docId y reemplazar
    const existingIdx = allEntries.findIndex(e => e.id === docId);
    const updatedEntry = { ...entryData, id: docId };
    
    if(existingIdx >= 0){
      // Reemplazar el registro existente
      allEntries[existingIdx] = updatedEntry;
      console.log('apiUpdateEntry: registro actualizado en índice', existingIdx);
    } else {
      // Si no existe, agregarlo (caso raro, pero posible)
      allEntries.unshift(updatedEntry);
      console.log('apiUpdateEntry: registro agregado (no existía previamente)');
    }
    updateSummaryDisplay();
  } catch (e) {
    console.warn('Error actualizando en Firestore, usando localStorage', e.message || e);
    if(!docId){
      console.error('apiUpdateEntry: docId es requerido incluso en fallback');
      return;
    }
    const entries = loadEntriesLocal();
    const { id, ...entryData } = entry;
    const updatedEntry = { ...entryData, id: docId };
    const existingIdx = entries.findIndex(e => e.id === docId);
    if(existingIdx >= 0){
      entries[existingIdx] = updatedEntry;
    } else {
      entries.unshift(updatedEntry);
    }
    saveEntriesLocal(entries);
    allEntries = entries;
    updateSummaryDisplay();
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
  // Solo llenar el select del formulario, no el de filtro
  categories.forEach(cat => {
    if(cat !== 'Otros'){
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    }
  });
  
  const optionOther = document.createElement('option');
  optionOther.value = 'Otra';
  optionOther.textContent = 'Otra...';
  categorySelect.appendChild(optionOther);
}

// Nueva función para actualizar el filtro de categorías según el tipo seleccionado
function updateFilterCategoriesByType(type){
  const filterType = document.getElementById('filterType');
  const filterCategory = document.getElementById('filterCategory');
  const selectedType = type || filterType.value;
  const normalizedType = getNormalizedType(selectedType);
  const categories = userSettings.categories[normalizedType] || [];
  
  filterCategory.innerHTML = '<option value="">Filtrar por categoría</option>';
  
  categories.forEach(cat => {
    if(cat !== 'Otros'){
      const optionFilter = document.createElement('option');
      optionFilter.value = cat;
      optionFilter.textContent = cat;
      filterCategory.appendChild(optionFilter);
    }
  });
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
  // Actualizar también el resumen mensual cuando cambia el mes
  if(window.latestEntries) {
    updateSummary(window.latestEntries);
  }
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

  // Si estamos editando, actualizar en lugar de crear
  if(window.editingEntryId){
    console.log('Entrando en modo edición, ID:', window.editingEntryId);
    const entry = {
      date: date,
      type: type,
      category: category,
      amount: Math.abs(amount),
      description: description
    };
    
    await apiUpdateEntry(entry, window.editingEntryId);
    
    window.editingEntryId = null;
    await refreshEntries();
    document.getElementById('entryForm').reset();
    document.getElementById('categoryCustom').style.display = 'none';
    
    // Restaurar botón guardar
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.textContent = 'Guardar';
    saveBtn.classList.remove('btn-warning');
    saveBtn.classList.add('btn-primary');
    
    // Mostrar mensaje de confirmación
    alert('Registro actualizado exitosamente');
    
    // Volver a la vista de listado/historial con un pequeño delay para asegurar que el alert se cierre
    setTimeout(() => {
      const historyTab = document.querySelector('[data-bs-target="#history-tab"], #history-tab, a[href="#history-tab"]');
      if(historyTab) {
        historyTab.click();
      } else {
        // Fallback: intentar activar la pestaña directamente por ID
        const historyPane = document.getElementById('history-tab');
        if(historyPane) historyPane.classList.add('active');
        const recordTab = document.querySelector('a.nav-link[href="#record"], button[data-section="record"]');
        if(recordTab) recordTab.click();
      }
    }, 100);
    
    return;
  }

  // Crear entry SIN campo id - apiSaveEntry asignará el doc.id real
  const entry = {
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
  console.log('Eliminando entrada con ID:', id);
  console.log('Entradas antes de eliminar:', allEntries.map(e => e.id));
  await apiDeleteEntry(id);
  selectedEntries.delete(id);
  await refreshEntries();
}

async function duplicateEntry(id){
  // Buscar la entrada por el ID recibido (que es el doc.id de Firestore)
  const entry = allEntries.find(e => e.id === id);
  if(!entry) {
    console.error('No se encontró entrada con ID:', id);
    return;
  }
  
  // Crear copia sin el campo id, apiSaveEntry asignará el nuevo doc.id
  const { id: _, ...entryData } = entry;
  const newEntry = {
    ...entryData,
    date: new Date().toISOString().split('T')[0]
  };
  
  console.log('Duplicando entrada:', entry.id, '-> nueva entrada:', newEntry);
  await apiSaveEntry(newEntry);
  await refreshEntries();
  alert('Registro duplicado exitosamente');
}

async function editEntry(id){
  const entry = allEntries.find(e => e.id === id);
  if(!entry) return;
  
  // Cargar los datos en el formulario
  document.getElementById('date').value = entry.date;
  document.getElementById('type').value = entry.type;
  document.getElementById('amount').value = entry.amount;
  document.getElementById('description').value = entry.description || '';
  
  // Manejar categoría
  const categorySelect = document.getElementById('category');
  const categoryCustom = document.getElementById('categoryCustom');
  
  const existingOptions = Array.from(categorySelect.options).map(opt => opt.value);
  if(existingOptions.includes(entry.category)){
    categorySelect.value = entry.category;
    categoryCustom.style.display = 'none';
  } else {
    categorySelect.value = 'Otra';
    categoryCustom.value = entry.category;
    categoryCustom.style.display = 'block';
  }
  
  // Cambiar a la pestaña de registro
  const mainTab = document.querySelector('#main-tab');
  if(mainTab) mainTab.click();
  
  // Guardar el ID para actualizar en lugar de crear nuevo
  // IMPORTANTE: Usar el parámetro 'id' que es el doc.id real de Firestore,
  // no entry.id que puede ser un uid() antiguo inconsistente
  window.editingEntryId = id;
  
  // Cambiar texto del botón guardar
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.textContent = 'Actualizar';
  saveBtn.classList.remove('btn-primary');
  saveBtn.classList.add('btn-warning');
  
  console.log('Editando entrada - ID recibido (doc.id):', id, '| entry.id interno:', entry.id, '| editingEntryId:', window.editingEntryId);
}

function renderEntries(entries){
  const tbody = document.querySelector('#entriesTable tbody');
  if (!tbody) return; // Si no existe el tbody, salir
  tbody.innerHTML = '';
  const sorted = entries.slice().sort(compareDatesDesc);
  
  for (const e of sorted) {
    const tr = document.createElement('tr');
    const isSelected = selectedEntries.has(e.id);
    tr.innerHTML = `
      <td><input type="checkbox" class="entry-checkbox" data-id="${e.id}" ${isSelected ? 'checked' : ''}></td>
      <td>${e.date}</td>
      <td>${e.type}</td>
      <td>${e.category}</td>
      <td>${e.type === 'egreso' ? '-' : ''}${Number(e.amount).toFixed(2)}</td>
      <td>${e.description || ''}</td>
      <td class="no-print">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary edit-btn" data-id="${e.id}" id="edit-${e.id}" title="Editar">✏️</button>
          <button class="btn btn-outline-success duplicate-btn" data-id="${e.id}" id="dup-${e.id}" title="Duplicar">📋</button>
          <button class="btn btn-outline-danger delete-btn" data-id="${e.id}" id="del-${e.id}" title="Eliminar">🗑️</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  }
  
  // Event listeners para checkboxes
  tbody.querySelectorAll('.entry-checkbox').forEach(cb => {
    cb.addEventListener('change', (ev) => {
      const id = ev.currentTarget.dataset.id;
      if(ev.currentTarget.checked){
        selectedEntries.add(id);
      } else {
        selectedEntries.delete(id);
      }
      updateActionBar();
    });
  });
}

// Delegación de eventos para botones de acción (se configura una sola vez)
document.addEventListener('DOMContentLoaded', () => {
  const tbody = document.querySelector('#entriesTable tbody');
  if(tbody){
    tbody.addEventListener('click', (ev) => {
      console.log('Click en tbody:', ev.target, ev.target.tagName);
      
      // Buscar el botón más cercano (puede ser el emoji o el botón mismo)
      const editBtn = ev.target.closest('.edit-btn');
      const duplicateBtn = ev.target.closest('.duplicate-btn');
      const deleteBtn = ev.target.closest('.delete-btn');
      
      if(editBtn){
        ev.preventDefault();
        ev.stopPropagation();
        const id = editBtn.dataset.id;
        console.log('Editar ID:', id);
        if(id) editEntry(id);
      } else if(duplicateBtn){
        ev.preventDefault();
        ev.stopPropagation();
        const id = duplicateBtn.dataset.id;
        console.log('Duplicar ID:', id);
        if(id) duplicateEntry(id);
      } else if(deleteBtn){
        ev.preventDefault();
        ev.stopPropagation();
        const id = deleteBtn.dataset.id;
        console.log('Eliminar ID:', id);
        if(id) deleteEntry(id);
      }
    });
  }
});

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
  const summaryEl = document.getElementById('summary');
  const chartCenterSelect = document.getElementById('chartCenterMonth');
  
  // Usar siempre el mes seleccionado en chartCenterMonth para el resumen mensual
  const selectedMonth = chartCenterSelect.value || '';
  const data = map[selectedMonth] || { ingresos: 0, egresos: 0 };
  const balance = data.ingresos - data.egresos;
  summaryEl.innerHTML = `<div class="row"><div class="col"><strong>Total ingresos:</strong> S/ ${data.ingresos.toFixed(2)}</div><div class="col"><strong>Total egresos:</strong> S/ ${data.egresos.toFixed(2)}</div><div class="col"><strong>Balance:</strong> S/ ${balance.toFixed(2)}</div></div>`;

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

function clearFilters(){
  document.getElementById('filterMonth').value = '';
  document.getElementById('filterStart').value = '';
  document.getElementById('filterEnd').value = '';
  document.getElementById('filterType').value = '';
  document.getElementById('filterCategory').value = '';
  // Restaurar categorías a ingresos por defecto
  updateFilterCategoriesByType('ingreso');
  // Recargar todos los registros
  const rows = window.latestEntries || [];
  renderEntries(rows);
  drawCharts(rows);
  updateSummaryDisplay();
}

function applyFilter(){
  const filterMonth = document.getElementById('filterMonth').value;
  const start = document.getElementById('filterStart').value;
  const end = document.getElementById('filterEnd').value;
  const filterType = document.getElementById('filterType').value;
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
  if (filterType) {
    rows = rows.filter(e => e.type === filterType);
  }
  if (category) {
    rows = rows.filter(e => e.category === category);
  }

  renderEntries(rows);
  drawCharts(rows);
  const totalIn = rows.reduce((sum, e) => sum + (e.type === 'ingreso' ? Number(e.amount) : 0), 0);
  const totalOut = rows.reduce((sum, e) => sum + (e.type === 'egreso' ? Number(e.amount) : 0), 0);
  document.getElementById('summary').innerHTML = `<div class="row"><div class="col"><strong>Ingresos:</strong> S/ ${totalIn.toFixed(2)}</div><div class="col"><strong>Egresos:</strong> S/ ${totalOut.toFixed(2)}</div><div class="col"><strong>Balance:</strong> S/ ${(totalIn - totalOut).toFixed(2)}</div></div>`;
}

function exportXlsx() {
  // Verificar si hay datos en la fuente principal
  if (!allEntries || allEntries.length === 0) {
    return alert('No hay registros para exportar');
  }

  // Verificar si la librería XLSX está cargada
  if (typeof XLSX === 'undefined') {
    return alert('Error: La librería de Excel no se ha cargado. Verifica tu conexión a internet.');
  }

  // Preparar datos directamente desde el array allEntries
  // Esto evita errores de lectura del HTML visual
  const data = [['Fecha', 'Tipo', 'Categoría', 'Monto', 'Descripción']];

  allEntries.forEach(entry => {
    // Validar y limpiar el monto para evitar NaN
    let montoLimpio = entry.amount;
    
    // Si el monto es string, limpiarlo
    if (typeof montoLimpio === 'string') {
      montoLimpio = parseFloat(montoLimpio.replace(/[^0-9.-]+/g, ''));
    }
    
    // Si sigue siendo inválido, ponerlo en 0 o dejarlo vacío, pero no NaN
    if (isNaN(montoLimpio)) {
      montoLimpio = 0; 
    }

    data.push([
      entry.date || '',           // Columna 1: Fecha
      entry.type || '',            // Columna 2: Tipo
      entry.category || '',       // Columna 3: Categoría
      montoLimpio,                 // Columna 4: Monto (número puro)
      entry.description || ''      // Columna 5: Descripción
    ]);
  });

  // Crear libro y hoja de cálculo
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Ajustar ancho de columnas para mejor visualización -
  const colWidths = [
    { wch: 12 }, // Fecha
    { wch: 10 }, // Tipo
    { wch: 15 }, // Categoría
    { wch: 12 }, // Monto
    { wch: 30 }  // Descripción
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Finanzas');
  
  // Generar nombre de archivo con fecha actual
  const dateStr = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `finanzas_export_${dateStr}.xlsx`);
}

function printReport(){
  // Imprimir solo la tabla de registros, sin filtros ni cabeceras
  window.print();
}

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
  // Limpiar selección y estado de edición al limpiar formulario
  document.getElementById('clearBtn').addEventListener('click', () => {
    document.getElementById('entryForm').reset();
    window.editingEntryId = null;
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.textContent = 'Guardar';
    saveBtn.classList.remove('btn-warning');
    saveBtn.classList.add('btn-primary');
  });
  document.getElementById('applyFilter').addEventListener('click', applyFilter);
  document.getElementById('clearFilters').addEventListener('click', clearFilters);
  // Evento para actualizar categorías cuando cambia el tipo en el filtro
  document.getElementById('filterType').addEventListener('change', function() {
    updateFilterCategoriesByType();
  });
  document.getElementById('exportXlsx').addEventListener('click', exportXlsx);
  document.getElementById('printReport').addEventListener('click', printReport);
  attachAdminEvents();
  attachUIManagementEvents();
  await loadSettings();
  populateCategorySelects('ingreso');
  // Inicializar el filtro de categorías con las categorías de ingresos por defecto
  updateFilterCategoriesByType('ingreso');
  renderAdminOptions();
  await refreshEntries();
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
    await refreshEntries();
  }
}) //aqui

// Función para calcular el resumen filtrado por mes
//Añade o modifica esta función para que acepte un año y mes específicos:
function calculateMonthlySummary(year, month) {
    // Obtener todos los registros (asegúrate de tener 'allEntries' cargado o pásalo como argumento)
    const entries = allEntries || []; 
    
    let ingresos = 0;
    let egresos = 0;

    entries.forEach(entry => {
        const [eYear, eMonth] = entry.date.split('-').map(Number);
        
        // Filtrar solo si coincide el año y el mes
        if (eYear === year && eMonth === month) {
            if (entry.type === 'ingreso') {
                ingresos += parseFloat(entry.amount) || 0;
            } else if (entry.type === 'egreso') {
                egresos += parseFloat(entry.amount) || 0;
            }
        }
    });

    const balance = ingresos - egresos;

    return { ingresos, egresos, balance };
}

//Función para actualizar la vista del resumen
//Esta función leerá el selector y llamará al cálculo:
function updateSummaryDisplay() {
    const selector = document.getElementById('chartCenterMonth');
    if (!selector) return;

    const selectedValue = selector.value; // Formato "YYYY-MM"
    if (!selectedValue) return;

    const [year, month] = selectedValue.split('-').map(Number);
    const summaryData = calculateMonthlySummary(year, month);

    const summaryDiv = document.getElementById('summary');
    if (summaryDiv) {
        // Formatear nombres de meses para el título
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthName = monthNames[month - 1];

        summaryDiv.innerHTML = `
            <div class="row text-center">
                <div class="col-4">
                    <h6 class="text-success">Ingresos</h6>
                    <h4>S/ ${summaryData.ingresos.toLocaleString('es-ES', {minimumFractionDigits: 2})}</h4>
                </div>
                <div class="col-4">
                    <h6 class="text-danger">Egresos</h6>
                    <h4>S/ ${summaryData.egresos.toLocaleString('es-ES', {minimumFractionDigits: 2})}</h4>
                </div>
                <div class="col-4">
                    <h6 class="${summaryData.balance >= 0 ? 'text-primary' : 'text-danger'}">Balance</h6>
                    <h4>S/ ${summaryData.balance.toLocaleString('es-ES', {minimumFractionDigits: 2})}</h4>
                </div>
            </div>
            <div class="text-center mt-2 text-muted small">
                Resumen de ${monthName} ${year}
            </div>
        `;
    }
}


// Conectar el evento al selector
// Dentro de tu función de inicialización...
const monthSelector = document.getElementById('chartCenterMonth');
if (monthSelector) {
    // Escuchar cambios en el selector
    monthSelector.addEventListener('change', () => {
        updateSummaryDisplay();
        renderMonthChart(); // Si también quieres que el gráfico cambie
    });
    
    // Llamar una vez al inicio para cargar el mes actual
    updateSummaryDisplay();
};

// Funciones para la barra de acciones global (estilo Gmail)
function updateActionBar(){
  const actionBar = document.getElementById('actionBar');
  const selectedCount = document.getElementById('selectedCount');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  
  if(selectedEntries.size > 0){
    actionBar.style.display = 'block';
  } else {
    actionBar.style.display = 'none';
  }
  
  selectedCount.textContent = selectedEntries.size;
  
  // Actualizar estado del checkbox "Seleccionar todos"
  if(selectAllCheckbox){
    const visibleCheckboxes = document.querySelectorAll('.entry-checkbox');
    const allChecked = visibleCheckboxes.length > 0 && Array.from(visibleCheckboxes).every(cb => cb.checked);
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = !allChecked && selectedEntries.size > 0;
  }
}

async function bulkDelete(){
  if(selectedEntries.size === 0) return;
  
  if(!confirm(`¿Eliminar ${selectedEntries.size} registro(s) seleccionado(s)?`)) return;
  
  for(const id of selectedEntries){
    await apiDeleteEntry(id);
  }
  
  selectedEntries.clear();
  updateActionBar();
  await refreshEntries();
}

async function bulkDuplicate(){
  if(selectedEntries.size === 0) return;
  
  for(const id of selectedEntries){
    const entry = allEntries.find(e => e.id === id);
    if(entry){
      const newEntry = {
        ...entry,
        id: uid(),
        date: new Date().toISOString().split('T')[0]
      };
      await apiSaveEntry(newEntry);
    }
  }
  
  selectedEntries.clear();
  updateActionBar();
  await refreshEntries();
  alert(`${selectedEntries.size} registro(s) duplicado(s) exitosamente`);
}

function selectAllEntries(){
  const checkboxes = document.querySelectorAll('.entry-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = true;
    selectedEntries.add(cb.dataset.id);
  });
  updateActionBar();
}

function clearSelection(){
  const checkboxes = document.querySelectorAll('.entry-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = false;
  });
  selectedEntries.clear();
  updateActionBar();
}

// Event listeners para la barra de acciones globales
document.addEventListener('DOMContentLoaded', () => {
  const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
  const bulkEditBtn = document.getElementById('bulkEditBtn');
  const bulkDuplicateBtn = document.getElementById('bulkDuplicateBtn');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const clearSelectionBtn = document.getElementById('clearSelectionBtn');
  const selectAllCheckbox = document.getElementById('selectAllCheckbox');
  
  if(bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', bulkDelete);
  if(bulkDuplicateBtn) bulkDuplicateBtn.addEventListener('click', bulkDuplicate);
  if(selectAllBtn) selectAllBtn.addEventListener('click', selectAllEntries);
  if(clearSelectionBtn) clearSelectionBtn.addEventListener('click', clearSelection);
  
  if(selectAllCheckbox){
    selectAllCheckbox.addEventListener('change', (e) => {
      if(e.target.checked){
        selectAllEntries();
      } else {
        clearSelection();
      }
    });
  }
  
  // Manejar botón de editar (redirige al formulario para el primer elemento seleccionado)
  if(bulkEditBtn){
    bulkEditBtn.addEventListener('click', () => {
      if(selectedEntries.size > 0){
        const firstId = Array.from(selectedEntries)[0];
        editEntry(firstId);
      }
    });
  }
});
