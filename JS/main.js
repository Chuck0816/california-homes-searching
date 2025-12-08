// js/main.js
import { fetchHouses } from "./api.js";
import { renderHouses, showLoading } from "./ui.js";

(() => {
  console.log("[main] main.js loaded");

  const el = {
    searchForm: document.getElementById("searchForm"),
    q: document.getElementById("q"),

    advWrap: document.getElementById("advWrap"),
    toggleAdvBtn: document.getElementById("toggleAdvBtn"),

    stats: document.getElementById("stats"),

    mainGrid: document.getElementById("mainGrid"),
    toggleMapBtn: document.getElementById("toggleMapBtn"),
    mapPanel: document.getElementById("mapPanel"),

    // 高级筛选
    zip: document.getElementById("zip"),
    beds: document.getElementById("beds"),
    baths: document.getElementById("baths"),
    sqftMin: document.getElementById("sqftMin"),
    priceMin: document.getElementById("priceMin"),
    priceMax: document.getElementById("priceMax"),
    sort: document.getElementById("sort"),
    applyBtn: document.getElementById("applyBtn"),
    resetBtn: document.getElementById("resetBtn"),
  };

  let currentRows = [];
  let map = null;
  let markers = [];
  let googleMapsPromise = null;

  // === Google Maps 相关 ===
  function loadGoogleMaps() {
    if (googleMapsPromise) return googleMapsPromise;

    googleMapsPromise = new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
        return;
      }

      const start = Date.now();
      const timer = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(timer);
          resolve(window.google.maps);
        } else if (Date.now() - start > 15000) {
          clearInterval(timer);
          reject(new Error("Google Maps failed to load"));
        }
      }, 100);
    });

    return googleMapsPromise;
  }

  async function ensureMap() {
    if (map) return map;

    try {
      await loadGoogleMaps();
    } catch (e) {
      console.error("[map] load error:", e);
      return null;
    }

    const mapEl = document.getElementById("map");
    if (!mapEl) return null;

    map = new google.maps.Map(mapEl, {
      center: { lat: 36.7783, lng: -119.4179 }, // California
      zoom: 6,
    });

    return map;
  }

  async function refreshMap() {
    // 只有在 map 打开时才需要渲染 marker
    if (!el.mainGrid?.classList.contains("map-open")) return;
    if (!Array.isArray(currentRows) || currentRows.length === 0) return;

    const m = await ensureMap();
    if (!m) return;

    // 清除旧 marker
    markers.forEach((mk) => mk.setMap(null));
    markers = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;

    currentRows.forEach((row) => {
      const lat = Number(row.lat ?? row.LMD_MP_Latitude);
      const lng = Number(row.lng ?? row.LMD_MP_Longitude);
      if (!isFinite(lat) || !isFinite(lng)) return;

      const pos = { lat, lng };
      const marker = new google.maps.Marker({
        position: pos,
        map: m,
      });
      markers.push(marker);
      bounds.extend(pos);
      hasPoint = true;
    });

    if (hasPoint) {
      m.fitBounds(bounds);
      console.log("[map] markers:", markers.length);
    } else {
      console.log("[map] no valid lat/lng in rows");
    }
  }

  // === 构造查询参数 ===
  function buildParams() {
    const params = {};

    const q = el.q?.value.trim();
    if (q) params.q = q;

    const zip = el.zip?.value.trim();
    if (zip) params.zip = zip;

    const beds = Number(el.beds?.value || 0);
    if (beds > 0) params.beds = beds;

    const baths = Number(el.baths?.value || 0);
    if (baths > 0) params.baths = baths;

    const sqftMin = Number(el.sqftMin?.value || 0);
    if (sqftMin > 0) params.sqftMin = sqftMin;

    const priceMin = Number(el.priceMin?.value || 0);
    if (priceMin > 0) params.priceMin = priceMin;

    const priceMaxRaw = el.priceMax?.value.trim();
    if (priceMaxRaw) params.priceMax = Number(priceMaxRaw);

    params.sort = el.sort?.value || "price_asc";

    return params;
  }

  async function loadHouses() {
    try {
      showLoading();
      const rows = await fetchHouses(buildParams());
      currentRows = Array.isArray(rows) ? rows : [];
      window.__rows = currentRows; // 方便你在 console 里调试

      renderHouses(currentRows);

      await refreshMap();
    } catch (e) {
      console.error("[homes] loadHouses error:", e);
      const grid = document.getElementById("resultList");
      if (grid) {
        grid.innerHTML = `<div class="empty">Error: ${e.message || e}</div>`;
      }
      if (el.stats) el.stats.textContent = "Failed to load";
    }
  }

  function toggleAdv() {
    if (!el.advWrap) return;
    el.advWrap.classList.toggle("hidden");
  }

  function resetAdv() {
    ["zip", "beds", "baths", "sqftMin", "priceMin", "priceMax"].forEach(
      (id) => {
        const x = document.getElementById(id);
        if (!x) return;
        x.value = "";
      }
    );
    if (el.sort) el.sort.value = "price_asc";
  }

  function toggleMap() {
    if (!el.mainGrid) return;
    const isOpen = el.mainGrid.classList.toggle("map-open");
    console.log("[map] toggle, open =", isOpen);

    if (isOpen) {
      // 打开 map 的时候尝试渲染一次 marker
      refreshMap();

      if (el.mapPanel) {
        el.mapPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  // === 事件绑定 ===
  el.searchForm?.addEventListener("submit", (ev) => {
    ev.preventDefault();
    loadHouses();
  });

  el.applyBtn?.addEventListener("click", loadHouses);
  el.resetBtn?.addEventListener("click", () => {
    resetAdv();
    loadHouses();
  });
  el.toggleAdvBtn?.addEventListener("click", toggleAdv);
  el.toggleMapBtn?.addEventListener("click", toggleMap);

  // 初始加载一波房源
  loadHouses();
})();
