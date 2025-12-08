// js/api.js

// 负责所有 API 请求
const BASE = "/api";

function toQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === "") return;
    usp.set(k, String(v));
  });
  return usp.toString();
}

export async function fetchHouses(params = {}) {
  const qs = toQuery(params);
  const url = `${BASE}/gethouse.php${qs ? "?" + qs : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`gethouse HTTP ${res.status}`);
  return res.json();
}

export async function fetchDetails(id) {
  const url = `${BASE}/getDetails.php?id=${encodeURIComponent(id)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    let msg = `details HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}
