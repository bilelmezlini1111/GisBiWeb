const KEY = 'gisbi.web.points.v1';

const map = L.map('map', { zoomControl: true }).setView([36.8065, 10.1815], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
L.control.scale().addTo(map);

let points = load();
let markers = [];
let tempLatLng = null;
let meMarker = null;

const els = {
  modal: document.getElementById('pointModal'),
  drawer: document.getElementById('drawer'),
  name: document.getElementById('name'),
  note: document.getElementById('note'),
  coords: document.getElementById('coords'),
  list: document.getElementById('pointsList'),
  search: document.getElementById('search'),
};

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(points));
}
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function renderMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
  points.forEach(p => {
    const m = L.marker([p.lat, p.lng]).addTo(map);
    m.bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(p.note || '')}<br><small>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</small>`);
    markers.push(m);
  });
}
function filteredPoints() {
  const q = els.search.value.trim().toLowerCase();
  if (!q) return points;
  return points.filter(p => (p.name + ' ' + (p.note || '')).toLowerCase().includes(q));
}
function renderList() {
  const items = filteredPoints();
  if (!items.length) {
    els.list.innerHTML = '<div class="empty">لا توجد نقاط بعد. اضغط على الخريطة لإضافة أول نقطة.</div>';
    return;
  }
  els.list.innerHTML = items.map(p => `
    <div class="item">
      <strong>${esc(p.name)}</strong>
      <div class="meta">${esc(p.note || 'بدون ملاحظة')}</div>
      <small>${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}</small>
      <div>
        <button class="secondary" onclick="focusPoint('${p.id}')">عرض</button>
        <button class="danger secondary" onclick="deletePoint('${p.id}')">حذف</button>
      </div>
    </div>`).join('');
}
function openModal() {
  els.modal.classList.remove('hidden');
  els.modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => els.name.focus(), 80);
}
function closeModal() {
  els.modal.classList.add('hidden');
  els.modal.setAttribute('aria-hidden', 'true');
  els.name.value = '';
  els.note.value = '';
}
function openDrawer() {
  renderList();
  els.drawer.classList.remove('hidden');
  els.drawer.setAttribute('aria-hidden', 'false');
}
function closeDrawer() {
  els.drawer.classList.add('hidden');
  els.drawer.setAttribute('aria-hidden', 'true');
}

map.on('click', e => {
  tempLatLng = e.latlng;
  els.coords.textContent = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
  openModal();
});

document.getElementById('savePoint').onclick = () => {
  if (!tempLatLng) return;
  const name = els.name.value.trim() || 'نقطة جديدة';
  const note = els.note.value.trim();
  points.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    name, note,
    lat: tempLatLng.lat,
    lng: tempLatLng.lng,
    createdAt: new Date().toISOString()
  });
  save();
  renderMarkers();
  renderList();
  closeModal();
};
document.getElementById('cancelPoint').onclick = closeModal;
document.getElementById('listBtn').onclick = openDrawer;
document.getElementById('closeDrawer').onclick = closeDrawer;
els.search.oninput = renderList;
els.drawer.onclick = e => { if (e.target === els.drawer) closeDrawer(); };
els.modal.onclick = e => { if (e.target === els.modal) closeModal(); };

document.getElementById('locateBtn').onclick = () => {
  if (!navigator.geolocation) {
    alert('المتصفح لا يدعم تحديد الموقع');
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude, longitude } = pos.coords;
    map.setView([latitude, longitude], 16);
    if (meMarker) map.removeLayer(meMarker);
    meMarker = L.circleMarker([latitude, longitude], {
      radius: 10,
      color: '#0b7a75',
      fillColor: '#14b8a6',
      fillOpacity: .8
    }).addTo(map).bindPopup('أنت هنا').openPopup();
  }, err => {
    alert('تعذر تحديد الموقع: ' + err.message);
  }, { enableHighAccuracy: true, timeout: 10000 });
};

document.getElementById('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(points, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gisbi-points.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
};

document.getElementById('clearBtn').onclick = () => {
  if (!confirm('هل تريد حذف كل النقاط من هذا الجهاز؟')) return;
  points = [];
  save();
  renderMarkers();
  renderList();
};

window.focusPoint = (id) => {
  const p = points.find(x => String(x.id) === String(id));
  if (!p) return;
  closeDrawer();
  map.setView([p.lat, p.lng], 17);
  markers.forEach(m => {
    const ll = m.getLatLng();
    if (Math.abs(ll.lat - p.lat) < 1e-9 && Math.abs(ll.lng - p.lng) < 1e-9) m.openPopup();
  });
};
window.deletePoint = (id) => {
  if (!confirm('حذف هذه النقطة؟')) return;
  points = points.filter(x => String(x.id) !== String(id));
  save();
  renderMarkers();
  renderList();
};

renderMarkers();
renderList();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('service-worker.js').catch(() => {});
}
