// js/ui.js
import { fetchDetails } from "./api.js";

const resultList  = document.getElementById("resultGrid");
const statsEl     = document.getElementById("stats");
const modal       = document.getElementById("detailsModal");
const detailsBody = document.getElementById("detailsBody");
const closeModalBtn = document.getElementById("closeModalBtn");

function getFirst(obj, keys, fallback = null) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") {
      return obj[k];
    }
  }
  return fallback;
}

function formatMoney(x) {
  const n = Number(x);
  if (!isFinite(n) || n <= 0) return "N/A";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
}

function parsePhotos(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);

  let s = String(raw).trim();

  // 先尝试按 JSON 数组解析
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) return arr.filter(Boolean);
  } catch {}

  // 兜底：按逗号切
  s = s.replace(/^\[|\]$/g, "");
  return s
    .split(",")
    .map((t) =>
      t
        .trim()
        .replace(/^"+|"+$/g, "")
        .replace(/\\\//g, "/")
    )
    .filter((u) => u.startsWith("http"));
}

function cardTemplate(item) {
  const id     = getFirst(item, ["ListingID", "L_ListingID", "MLS", "id", "listing_id"]);
  const addr   = getFirst(item, ["Address", "L_Address", "address"], "Unknown address");
  const city   = getFirst(item, ["City", "L_City", "city"], "");
  const zip    = getFirst(item, ["PostalCode", "L_Zip", "zip"], "");
  const beds   = getFirst(item, ["BedroomsTotal", "Bedrooms", "L_Keyword2", "beds"], "—");
  const baths  = getFirst(item, ["BathroomsTotalInteger", "Bathrooms", "LM_Dec_3", "baths"], "—");
  const sqft   = getFirst(item, ["LivingArea", "LM_Int2_3", "sqft"], "—");
  const price  = getFirst(item, ["ListPrice", "L_SystemPrice", "price"], null);
  const photos = parsePhotos(getFirst(item, ["Photos", "L_Photos", "photos"], null));
  const cover  = photos[0] || "";

  const photoPart = cover
    ? `<img class="home-photo" src="${cover}" alt="home photo" loading="lazy" />`
    : `<div class="home-photo placeholder">No photo</div>`;

  return `
    <article class="home" data-id="${id}">
      ${photoPart}
      <div class="addr">${addr}</div>
      <div class="meta">${city}${zip ? ", " + zip : ""}</div>
      <div class="meta">${beds} bd · ${baths} ba · ${sqft} sqft</div>
      <div class="meta">${formatMoney(price)}</div>
    </article>
  `;
}

export function renderHouses(rows) {
  if (!resultList || !statsEl) return;
  if (!Array.isArray(rows)) rows = [];

  const count = rows.length;
  statsEl.textContent = `${count} results (showing top ${Math.min(count, 100)})`;

  if (count === 0) {
    resultList.innerHTML = `<div class="empty">No results</div>`;
    return;
  }

  resultList.innerHTML = rows.map(cardTemplate).join("");

  // 绑点击 -> 打开详情
  resultList.querySelectorAll(".home").forEach((card) => {
    const id = card.dataset.id;
    if (!id) return;
    card.addEventListener("click", () => openDetails(id));
  });
}

export function showLoading() {
  if (!resultList || !statsEl) return;
  statsEl.textContent = "";
  resultList.innerHTML = `<div class="loading">Loading...</div>`;
}

export function openModal() {
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

export function closeModal() {
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  if (detailsBody) detailsBody.innerHTML = "";
}

// 详情渲染
function detailsTemplate(d) {
  const address = getFirst(d, ["Address", "L_Address"], "Unknown address");
  const city    = getFirst(d, ["City", "L_City"], "");
  const state   = getFirst(d, ["State", "L_State"], "");
  const zip     = getFirst(d, ["PostalCode", "L_Zip"], "");
  const price   = getFirst(d, ["ListPrice", "L_SystemPrice"], null);
  const beds    = getFirst(d, ["Bedrooms", "BedroomsTotal", "L_Keyword2"], "—");
  const baths   = getFirst(d, ["Bathrooms", "BathroomsTotalInteger", "LM_Dec_3"], "—");
  const sqft    = getFirst(d, ["LivingArea", "LM_Int2_3"], "—");
  const remarks = getFirst(d, ["remarks", "Remarks", "L_Remarks"], "");

  const lat = getFirst(d, ["lat", "LMD_MP_Latitude"], null);
  const lng = getFirst(d, ["lng", "LMD_MP_Longitude"], null);

  const renterEmail = getFirst(d, ["renteremail", "RenterEmail", "ListAgentEmail"], "N/A");
  const agentEmail  = getFirst(d, ["ListAgentEmail", "agentEmail"], "");
  const officeEmail = getFirst(d, ["officeEmail", "ListOfficeEmail"], "");

  const photos = parsePhotos(getFirst(d, ["Photos", "L_Photos"], null));
  const photoGrid = photos.length
    ? `<div class="photo-grid">
         ${photos.map((u) => `<img src="${u}" alt="photo" loading="lazy" />`).join("")}
       </div>`
    : `<div class="muted">No photos</div>`;

  const mapsLink = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;

  return `
    <h2 class="details-title">${address}</h2>
    <div class="details-sub">${city}${state ? ", " + state : ""} ${zip}</div>

    <div class="modal-price">${formatMoney(price)}</div>
    <div class="modal-meta">
      <b>${beds}</b> beds ·
      <b>${baths}</b> baths ·
      <b>${sqft}</b> sqft
    </div>

    <h3>Photos</h3>
    ${photoGrid}

    ${remarks ? `<h3>Remarks</h3><p class="details-remarks">${remarks}</p>` : ""}

    <h3>Contact</h3>
    <div class="details-contact">
      <div>Renter Email: <a href="mailto:${renterEmail}">${renterEmail}</a></div>
      ${agentEmail ? `<div>Agent Email: <a href="mailto:${agentEmail}">${agentEmail}</a></div>` : ""}
      ${officeEmail ? `<div>Office Email: <a href="mailto:${officeEmail}">${officeEmail}</a></div>` : ""}
      ${mapsLink ? `<div><a target="_blank" rel="noopener" href="${mapsLink}">Open in Google Maps</a></div>` : ""}
    </div>
  `;
}

export async function openDetails(id) {
  if (!detailsBody) return;
  openModal();
  detailsBody.innerHTML = `<div class="muted">Loading details...</div>`;

  try {
    const d = await fetchDetails(id);
    detailsBody.innerHTML = detailsTemplate(d);
  } catch (e) {
    detailsBody.innerHTML = `
      <div class="muted">
        Failed to load details<br/>
        ${String(e.message || e)}
      </div>
    `;
  }
}

// Modal 关闭事件
closeModalBtn?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => {
  // 点击灰色背景关闭
  if (e.target === modal) closeModal();
});
