'use strict';

// -----------------------------------------------------------
// Global variables
// -----------------------------------------------------------
let lastRows = [];
let map, markers = [];
let mapsLoaded = false;

// Helper
const $ = (id) => document.getElementById(id);

// -----------------------------------------------------------
// Parse Photos (string → array)
// -----------------------------------------------------------
function parsePhotos(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'string') {
    try {
      const cleaned = raw
        .replace(/\\\\/g, '\\')
        .replace(/\\"/g, '"')
        .replace(/\n/g, '');

      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("Photo parse error:", raw);
      return [];
    }
  }

  return [];
}

// -----------------------------------------------------------
// Render home list (Top 10)
// -----------------------------------------------------------
function renderList(rows) {
  const list = $('list');
  const empty = $('empty');

  // Cut to top-10
  const displayRows = rows.slice(0, 10);

  $('stats').textContent = displayRows.length
    ? `${rows.length} results (showing top 10)`
    : '0 result';

  empty.style.display = displayRows.length ? 'none' : 'block';

  list.innerHTML = displayRows
    .map(r => {
      const photos = parsePhotos(r.Photos);
      const url = photos.find(u => typeof u === 'string' && u.startsWith('http'));

      const imgHTML = url
        ? `<img class="home-photo" src="${url}" alt="Photo"/>`
        : `<div class="home-photo placeholder">No Photo</div>`;

      const price = r.ListPrice ? `$${Number(r.ListPrice).toLocaleString()}` : '';

      const meta = [r.City, r.PostalCode].filter(Boolean).join(' · ');
      const bb = [
        r.BedroomsTotal ? `${r.BedroomsTotal} bd` : null,
        r.BathroomsTotalInteger ? `${r.BathroomsTotalInteger} ba` : null,
        r.LivingArea ? `${r.LivingArea} sqft` : null
      ].filter(Boolean).join(' · ');

      return `
      <article class="home" onclick="openDetails('${r.ListingID}')">
        ${imgHTML}
        <div class="addr">${r.Address || '—'}</div>
        <div class="meta">${meta}</div>
        <div class="meta">${bb}</div>
        <div style="margin-top:6px;font-weight:700">${price}</div>
      </article>`;
    })
    .join('');
}

async function openDetails(id) {
  const modal = document.getElementById("detailsModal");
  const modalImg = document.getElementById("modalImg");
  const modalAddr = document.getElementById("modalAddr");
  const modalMeta = document.getElementById("modalMeta");
  const modalPrice = document.getElementById("modalPrice");

  modal.removeAttribute("hidden");

  const res = await fetch(`/api/getDetails.php?id=${id}`);
  const data = await res.json();

  const photos = parsePhotos(data.L_Photos);
  const photoUrl = photos.find(u => u.startsWith('http'));

  modalImg.src = photoUrl || '';
  modalAddr.textContent = `${data.L_Address}, ${data.L_City}`;
  
  modalMeta.textContent =
    `${data.BedroomsTotal} bd · ${data.BathroomsTotalInteger} ba · ${data.LivingArea} sqft · ${data.L_Zip}`;

  modalPrice.textContent = data.ListPrice
    ? "$" + Number(data.ListPrice).toLocaleString()
    : "";

  // Google Maps
  initModalMap(Number(data.LMD_MP_Latitude), Number(data.LMD_MP_Longitude));
}


function closeModal() {
  document.getElementById("detailsModal").setAttribute("hidden", "");
}



// -----------------------------------------------------------
// Map Logic
// -----------------------------------------------------------
function toggleMap() {
  const panel = $('mapPanel');
  const btn = $('toggleMapBtn');
  const wrap = document.querySelector('.wrap.grid');

  const willOpen = panel.hasAttribute('hidden');

  if (willOpen) {
    // 打开地图
    panel.removeAttribute('hidden');
    wrap.classList.add('map-open');
    btn.textContent = 'Close map';

    ensureMaps().then(() => {
        
      if (map) {
        map.setCenter({ lat: 36.7783, lng: -119.4179 });
        map.setZoom(8);   // 你可以调成 6~8 的任意值
      }
      
      renderMarkers(lastRows);

      // **关键：地图必须在显示后重绘**
      setTimeout(() => {
        google.maps.event.trigger(map, "resize");
      }, 300);
    });

  } else {
    // 关闭地图
    panel.setAttribute('hidden', '');
    wrap.classList.remove('map-open');
    btn.textContent = 'Open map';
  }
}


function ensureMaps() {
  if (mapsLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyDnrZ0oyc2WO4c9UtxsScxgypyUIzWY30k&callback=__initMap';
    s.async = true;
    s.defer = true;

    window.__initMap = () => {
      mapsLoaded = true;
      initMap();
      resolve();
    };

    s.onerror = () => reject(new Error("Google Maps failed"));
    document.body.appendChild(s);
  });
}

function initMap() {
  const defaultCenter = {
    lat: 36.7783,   // California center
    lng: -119.4179
  };

  map = new google.maps.Map($('map'), {
    center: defaultCenter,
    zoom: 6,
    gestureHandling: "cooperative",
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false
  });
}

function clearMarkers() {
  markers.forEach(m => m.setMap(null));
  markers = [];
}

// Show all results on map, even if list only shows top 10
function renderMarkers(rows) {
  if (!map) return;

  clearMarkers();
  const bounds = new google.maps.LatLngBounds();
  let validCount = 0;

  rows.forEach(r => {
    if (r.lat && r.lng && Number(r.lat) !== 0) {
      const m = new google.maps.Marker({
        position: { lat: Number(r.lat), lng: Number(r.lng) },
        map,
        title: r.Address || ""
      });
      m.addListener('click', () => openDetails(r.ListingID));

      markers.push(m);
      bounds.extend(m.getPosition());
      validCount++;
    }
  });


    // fallback to California
    map.setCenter({ lat: 36.7783, lng: -119.4179 });
    map.setZoom(6);
 
}

let modalMap;
function initModalMap(lat, lng) {
  if (!lat || !lng) {
    document.getElementById('modalMap').innerHTML = "No map";
    return;
  }
  modalMap = new google.maps.Map(document.getElementById("modalMap"), {
    center: { lat, lng },
    zoom: 14,
    mapTypeControl: false,
  });

  new google.maps.Marker({
    position: { lat, lng },
    map: modalMap
  });
}


// -----------------------------------------------------------
// Searching
// -----------------------------------------------------------
async function performSearch(ev) {
  if (ev) ev.preventDefault();
  const q = $('q').value.trim();

  if (!q) {
    $('stats').textContent = '开始搜索：输入 Destination 即可';
    $('hero').style.display = 'block';
    $('list').innerHTML = '';
    return;
  }

  $('hero').style.display = 'none';

  const params = new URLSearchParams({
    q,
    zip: $('zip')?.value.trim(),
    beds: $('beds')?.value || 0,
    baths: $('baths')?.value || 0,
    sqftMin: $('sqftMin')?.value || 0,
    priceMin: $('priceMin')?.value || 0,
    priceMax: $('priceMax')?.value || '',
    sort: $('sort')?.value || 'price_asc'
  });

  try {
    $('list').innerHTML = '<div class="loading">Loading…</div>';

    const res = await fetch(`/api/gethouse.php?${params}`);
    const txt = await res.text();

    let data;
    try {
      data = JSON.parse(txt);
    } catch {
      throw new Error("Invalid JSON: " + txt.slice(0, 200));
    }

    lastRows = data;

    renderList(data);

    if (mapsLoaded) renderMarkers(data);

  } catch (err) {
    $('list').innerHTML = '';
    $('empty').style.display = 'block';
    $('empty').textContent = '连接失败：' + err.message;
    $('stats').textContent = 'Fail to connect';
  }
}

// -----------------------------------------------------------
// Init
// -----------------------------------------------------------
(function init() {
  $('searchForm').addEventListener('submit', performSearch);
  $('toggleMapBtn').addEventListener('click', toggleMap);

  // More filters
  $('applyBtn').addEventListener('click', performSearch);
  $('resetBtn').addEventListener('click', () => {
    ['zip','beds','baths','sqftMin','priceMin','priceMax']
      .forEach(id => $(id).value = '');
    $('sort').value = 'price_asc';
  });

  // Price quick chips
  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      $('priceMin').value = c.dataset.min;
      $('priceMax').value = c.dataset.max === "Infinity" ? "" : c.dataset.max;
      performSearch();
    });
  });
})();
