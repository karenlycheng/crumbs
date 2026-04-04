// ── Supabase setup ──────────────────────────────────────────────
const SUPABASE_URL = window.ENV_SUPABASE_URL || '';
const SUPABASE_KEY = window.ENV_SUPABASE_KEY || '';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PASSWORD = window.ENV_ADMIN_PASSWORD || '2026';

// ── App state ────────────────────────────────────────────────────
let allCities = [];
let allCuisines = [];

// ── Init ─────────────────────────────────────────────────────────
async function init() {
  await loadCityFilter();
  await loadRestaurants();
}

// ── Views ────────────────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Password ─────────────────────────────────────────────────────
function checkPw() {
  const val = document.getElementById('pwInput').value;
  const err = document.getElementById('pwError');
  if (val === ADMIN_PASSWORD) {
    document.getElementById('pwInput').value = '';
    err.classList.remove('show');
    showView('adminView');
    loadAdminCityDropdown();
  } else {
    err.classList.add('show');
  }
}

// ── City filter (public) ─────────────────────────────────────────
async function loadCityFilter() {
  const { data, error } = await db.from('cities').select('*').order('name');
  if (error) { console.error(error); return; }
  allCities = data;
  const sel = document.getElementById('cityFilter');
  sel.innerHTML = data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  // default Perth
  const perth = data.find(c => c.name === 'Perth');
  if (perth) sel.value = perth.id;
}

// ── Restaurants (public) ─────────────────────────────────────────
async function loadRestaurants() {
  const cityId = document.getElementById('cityFilter').value;
  const list = document.getElementById('restaurantList');
  list.innerHTML = '<div class="loading">Loading...</div>';
  const { data, error } = await db
    .from('restaurants')
    .select('*')
    .eq('city', getCityNameById(cityId))
    .order('name');
  if (error) { list.innerHTML = '<div class="empty-state">Something went wrong.</div>'; return; }
  if (!data.length) { list.innerHTML = '<div class="empty-state">No restaurants added for this city yet.</div>'; return; }
  list.innerHTML = data.map(r => {
    const vibeClass = r.vibe === 'Casual' ? 'vibe-casual' : r.vibe === 'Good Vibes' ? 'vibe-mid' : 'vibe-fancy';
    return `<div class="restaurant-card">
      <div class="card-top">
        <span class="card-name">${r.name}</span>
        <span class="vibe-badge ${vibeClass}">${r.vibe}</span>
      </div>
      <div class="card-meta">
        <span>${r.cuisine || '—'}</span>
        <span class="meta-dot">·</span>
        <span>${r.address || '—'}</span>
      </div>
      ${r.notes ? `<div class="card-notes">${r.notes}</div>` : ''}
    </div>`;
  }).join('');
}

function getCityNameById(id) {
  const city = allCities.find(c => c.id === id);
  return city ? city.name : '';
}

// ── Admin tabs ───────────────────────────────────────────────────
function switchTab(btn, tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
}

// ── Add restaurant ───────────────────────────────────────────────
async function loadAdminCityDropdown() {
  const { data } = await db.from('cities').select('*').order('name');
  allCities = data || [];
  const sel = document.getElementById('entryCity');
  sel.innerHTML = data.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  const perth = data.find(c => c.name === 'Perth');
  if (perth) sel.value = perth.name;
  const { data: cuisineData } = await db.from('cuisines').select('*').order('name');
  const cuisineSel = document.getElementById('entryCuisine');
  cuisineSel.innerHTML = cuisineData.map(c => `<option>${c.name}</option>`).join('');
}

function findPlace() {
  // Placeholder until Google Places API is connected
  const name = document.getElementById('entryName').value.trim();
  const result = document.getElementById('placeResult');
  if (!name) return;
  result.innerHTML = `Google Places will find <strong>${name}</strong> and fill in the address automatically once the API is connected.`;
  result.classList.add('show');
}

async function saveRestaurant() {
  const name = document.getElementById('entryName').value.trim();
  if (!name) { showToast('Please enter a restaurant name'); return; }
  const restaurant = {
    name,
    city: document.getElementById('entryCity').value,
    address: document.getElementById('entryAddress').value.trim(),
    cuisine: document.getElementById('entryCuisine').value.trim(),
    vibe: document.getElementById('entryVibe').value,
    notes: document.getElementById('entryNotes').value.trim()
  };
  const { error } = await db.from('restaurants').insert([restaurant]);
  if (error) { showToast('Error saving — check console'); console.error(error); return; }
  document.getElementById('entryName').value = '';
  document.getElementById('entryAddress').value = '';
  document.getElementById('entryCuisine').value = '';
  document.getElementById('entryNotes').value = '';
  document.getElementById('placeResult').classList.remove('show');
  showToast('Restaurant saved!');
}

// ── Admin — Restaurants ───────────────────────────────────────────
async function loadAdminRestaurants() {
  const { data, error } = await db.from('restaurants').select('*').order('name');
  const list = document.getElementById('adminRestaurantList');
  if (error || !data.length) {
    list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:#7a7570;">No restaurants yet.</div>';
    return;
  }
  list.innerHTML = data.map(r => `
    <div class="manage-item" id="ri_${r.id}">
      <div class="manage-item-content">
        <div class="manage-item-name">${r.name}</div>
        <div class="manage-item-sub">${r.city} · ${r.cuisine || '—'} · ${r.vibe}</div>
        <div class="edit-panel" id="rp_${r.id}">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" id="rn_${r.id}" value="${r.name || ''}" />
          </div>
          <div class="edit-row">
            <div class="form-group">
              <label class="form-label">City</label>
              <select class="form-input" id="rc_${r.id}">${allCities.map(c=>`<option${c.name===r.city?' selected':''}>${c.name}</option>`).join('')}</select>
            </div>
            <div class="form-group">
              <label class="form-label">Vibe</label>
              <select class="form-input" id="rv_${r.id}">${['Casual','Mid-range','V Fancy'].map(v=>`<option${v===r.vibe?' selected':''}>${v}</option>`).join('')}</select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Address</label>
            <input class="form-input" id="ra_${r.id}" value="${r.address || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Cuisine</label>
            <input class="form-input" id="rcu_${r.id}" value="${r.cuisine || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-input" id="rno_${r.id}" rows="3">${r.notes || ''}</textarea>
          </div>
          <div class="edit-actions">
            <button class="btn-dark" onclick="saveRestaurantEdit('${r.id}')">Save changes</button>
            <button class="btn-outline" onclick="closeEditPanel('rp_${r.id}','rb_${r.id}')">Cancel</button>
          </div>
        </div>
      </div>
      <button class="edit-btn" id="rb_${r.id}" onclick="toggleEditPanel('rp_${r.id}','rb_${r.id}')">Edit</button>
      <button class="del-btn" onclick="deleteRestaurant('${r.id}')">Delete</button>
    </div>`).join('');
}

function toggleEditPanel(panelId, btnId) {
  const panel = document.getElementById(panelId);
  const btn = document.getElementById(btnId);
  const isOpen = panel.classList.contains('show');
  document.querySelectorAll('.edit-panel').forEach(p => p.classList.remove('show'));
  document.querySelectorAll('.edit-btn').forEach(b => b.textContent = 'Edit');
  if (!isOpen) { panel.classList.add('show'); btn.textContent = 'Close'; }
}

function closeEditPanel(panelId, btnId) {
  document.getElementById(panelId).classList.remove('show');
  document.getElementById(btnId).textContent = 'Edit';
}

async function saveRestaurantEdit(id) {
  const updates = {
    name: document.getElementById('rn_' + id).value,
    city: document.getElementById('rc_' + id).value,
    vibe: document.getElementById('rv_' + id).value,
    address: document.getElementById('ra_' + id).value,
    cuisine: document.getElementById('rcu_' + id).value,
    notes: document.getElementById('rno_' + id).value
  };
  const { error } = await db.from('restaurants').update(updates).eq('id', id);
  if (error) { showToast('Error saving'); console.error(error); return; }
  showToast('Restaurant updated!');
  loadAdminRestaurants();
}

async function deleteRestaurant(id) {
  if (!confirm('Delete this restaurant?')) return;
  const { error } = await db.from('restaurants').delete().eq('id', id);
  if (error) { showToast('Error deleting'); return; }
  showToast('Deleted');
  loadAdminRestaurants();
}

// ── Admin — Cuisines ─────────────────────────────────────────────
async function loadCuisines() {
  const { data } = await db.from('cuisines').select('*').order('name');
  allCuisines = data || [];
  const list = document.getElementById('cuisineList');
  if (!data.length) { list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:#7a7570;">No cuisines yet.</div>'; return; }
  list.innerHTML = data.map(c => `
    <div class="manage-item">
      <div class="manage-item-content">
        <div class="manage-item-name" id="cuisineName_${c.id}">${c.name}</div>
      </div>
      <button class="edit-btn" id="cuisineBtn_${c.id}" onclick="editCuisine('${c.id}','${c.name}')">Edit</button>
      <button class="del-btn" onclick="deleteCuisine('${c.id}')">Delete</button>
    </div>`).join('');
}

function editCuisine(id, current) {
  const el = document.getElementById('cuisineName_' + id);
  const btn = document.getElementById('cuisineBtn_' + id);
  el.innerHTML = `<input class="form-input" style="padding:5px 8px;font-size:13px;" value="${current}" id="cuisineInput_${id}" />`;
  btn.textContent = 'Save';
  btn.onclick = () => saveCuisineEdit(id);
}

async function saveCuisineEdit(id) {
  const val = document.getElementById('cuisineInput_' + id).value.trim();
  if (!val) return;
  const { error } = await db.from('cuisines').update({ name: val }).eq('id', id);
  if (error) { showToast('Error saving'); return; }
  showToast('Cuisine updated');
  loadCuisines();
}

async function deleteCuisine(id) {
  if (!confirm('Delete this cuisine?')) return;
  const { error } = await db.from('cuisines').delete().eq('id', id);
  if (error) { showToast('Error deleting'); return; }
  showToast('Deleted');
  loadCuisines();
}

async function addCuisine() {
  const val = document.getElementById('newCuisineInput').value.trim();
  if (!val) return;
  const { error } = await db.from('cuisines').insert([{ name: val }]);
  if (error) { showToast('Error adding'); return; }
  document.getElementById('newCuisineInput').value = '';
  showToast('Cuisine added!');
  loadCuisines();
}

// ── Admin — Cities ───────────────────────────────────────────────
async function loadCities() {
  const { data } = await db.from('cities').select('*').order('name');
  allCities = data || [];
  const list = document.getElementById('cityList');
  if (!data.length) { list.innerHTML = '<div style="padding:20px;text-align:center;font-size:13px;color:#7a7570;">No cities yet.</div>'; return; }
  list.innerHTML = data.map(c => `
    <div class="manage-item">
      <div class="manage-item-content">
        <div class="manage-item-name" id="cityName_${c.id}">${c.name}</div>
      </div>
      <button class="edit-btn" id="cityBtn_${c.id}" onclick="editCity('${c.id}','${c.name}')">Edit</button>
      <button class="del-btn" onclick="deleteCity('${c.id}')">Delete</button>
    </div>`).join('');
}

function editCity(id, current) {
  const el = document.getElementById('cityName_' + id);
  const btn = document.getElementById('cityBtn_' + id);
  el.innerHTML = `<input class="form-input" style="padding:5px 8px;font-size:13px;" value="${current}" id="cityInput_${id}" />`;
  btn.textContent = 'Save';
  btn.onclick = () => saveCityEdit(id);
}

async function saveCityEdit(id) {
  const val = document.getElementById('cityInput_' + id).value.trim();
  if (!val) return;
  const { error } = await db.from('cities').update({ name: val }).eq('id', id);
  if (error) { showToast('Error saving'); return; }
  showToast('City updated');
  loadCities();
  loadCityFilter();
}

async function deleteCity(id) {
  if (!confirm('Delete this city?')) return;
  const { error } = await db.from('cities').delete().eq('id', id);
  if (error) { showToast('Error deleting'); return; }
  showToast('Deleted');
  loadCities();
  loadCityFilter();
}

async function addCity() {
  const val = document.getElementById('newCityInput').value.trim();
  if (!val) return;
  const { error } = await db.from('cities').insert([{ name: val }]);
  if (error) { showToast('Error adding'); return; }
  document.getElementById('newCityInput').value = '';
  showToast('City added!');
  loadCities();
  loadCityFilter();
}

// ── Toast ────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Start ────────────────────────────────────────────────────────
init();
