// js/main.js
import { fetchHouses } from "./api.js";
import { renderHouses, showLoading } from "./ui.js";

(() => {
  console.log("[main] main.js loaded");

  document.body.classList.remove("dim", "blur", "modal-open");

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

  console.log("[main] toggleMapBtn =", el.toggleMapBtn);

  // 当前房源数据（给地图打点用）
  let currentRows = [];

  // === 地图打点：依赖全局 window.__map / window.__markers ===
  function syncMapMarkers() {
    const map = window.__map || null;
    if (!map) {
      console.log("[map] map not ready yet");
      return;
    }

    if (!Array.isArray(window.__markers)) {
      window.__markers = [];
    }

    // 清除旧 marker
    window.__markers.forEach((m) => m.setMap(null));
    window.__markers = [];

    const bounds = new google.maps.LatLngBounds();
    let hasPoint = false;

    currentRows.forEach((row, idx) => {
      const latRaw = row.lat ?? row.LMD_MP_Latitude;
      const lngRaw = row.lng ?? row.LMD_MP_Longitude;

      const lat = parseFloat(latRaw);
      const lng = parseFloat(lngRaw);
      if (!isFinite(lat) || !isFinite(lng)) {
        return;
      }

      const pos = { lat, lng };
      const marker = new google.maps.Marker({
        position: pos,
        map,
      });
      window.__markers.push(marker);
      bounds.extend(pos);
      hasPoint = true;
    });

    if (hasPoint) {
      map.fitBounds(bounds);
      console.log("[map] markers count =", window.__markers.length);
    } else {
      console.log("[map] rows have no valid lat/lng");
    }
  }

  // 地图脚本加载完、initMap 被调用后，会触发这个回调
  window.__onMapReady = function () {
    console.log("[map] __onMapReady called");
    syncMapMarkers();
  };

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

      // 暴露给 console 调试
      window.__rows = currentRows;

      renderHouses(currentRows);

      if (el.stats) {
        el.stats.textContent = `${currentRows.length} results (showing top ${Math.min(
          currentRows.length,
          100
        )})`;
      }

      // 每次加载完列表，尝试刷新地图打点
      syncMapMarkers();
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

  // Map 按钮现在只负责把视图滚到地图（手机上好用）
  function scrollToMap() {
    console.log("[map] scrollToMap clicked");
    if (el.mapPanel) {
      el.mapPanel.scrollIntoView({ behavior: "smooth", block: "start" });
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
  el.toggleMapBtn?.addEventListener("click", scrollToMap);

  // 初始加载一波房源
  loadHouses();
})();
