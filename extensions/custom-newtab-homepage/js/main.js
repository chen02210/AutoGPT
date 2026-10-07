let state = { categories: [] };

const board = document.getElementById("board");

// Chrome's local favicon cache (needs the "favicon" permission); no network request.
function faviconFor(url) {
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", url);
  u.searchParams.set("size", "64");
  return u.toString();
}

function initials(name) {
  return (name || "?").trim().slice(0, 1).toUpperCase();
}

async function persist() {
  await Storage.save(state);
}

function findCategory(catId) {
  return state.categories.find((c) => c.id === catId);
}

function findItem(catId, itemId) {
  const cat = findCategory(catId);
  if (!cat) return null;
  return cat.items.find((i) => i.id === itemId);
}

// ---------- Rendering ----------

function render() {
  board.innerHTML = "";
  state.categories.forEach((cat) => board.appendChild(renderCategory(cat)));
  const addCat = document.createElement("div");
  addCat.className = "add-category-tile";
  addCat.textContent = "+ 新增分类";
  addCat.addEventListener("click", () => openCategoryModal());
  board.appendChild(addCat);
}

function renderCategory(cat) {
  const el = document.createElement("section");
  el.className = "category";
  el.dataset.categoryId = cat.id;
  el.addEventListener("dragover", onCategoryDragOver);
  el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
  el.addEventListener("drop", onCategoryDrop);

  const header = document.createElement("div");
  header.className = "category-header";
  header.draggable = true;
  header.addEventListener("dragstart", (e) => onCategoryHeaderDragStart(e, cat.id));
  header.addEventListener("dragend", onDragEnd);

  const title = document.createElement("div");
  title.className = "category-title";
  title.textContent = cat.name;

  const actions = document.createElement("div");
  actions.className = "category-actions";
  const editBtn = document.createElement("button");
  editBtn.className = "icon-btn";
  editBtn.textContent = "✎";
  editBtn.title = "编辑分类";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openCategoryModal(cat);
  });
  actions.appendChild(editBtn);

  header.appendChild(title);
  header.appendChild(actions);
  el.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "items-grid";
  grid.dataset.categoryId = cat.id;
  grid.addEventListener("dragover", onItemsGridDragOver);
  grid.addEventListener("drop", onItemsGridDrop);

  cat.items.forEach((item) => grid.appendChild(renderSiteTile(cat.id, item)));

  const addTile = document.createElement("div");
  addTile.className = "add-tile";
  addTile.textContent = "+";
  addTile.title = "添加网址";
  addTile.addEventListener("click", () => openSiteModal(cat.id));
  grid.appendChild(addTile);

  el.appendChild(grid);
  return el;
}

function renderSiteTile(catId, item) {
  const tile = document.createElement("a");
  tile.className = "site-tile";
  tile.href = item.url;
  tile.title = item.url;
  tile.draggable = true;
  tile.dataset.categoryId = catId;
  tile.dataset.itemId = item.id;

  tile.addEventListener("dragstart", (e) => onSiteDragStart(e, catId, item.id));
  tile.addEventListener("dragend", onDragEnd);
  tile.addEventListener("dragover", onSiteDragOver);

  const editBtn = document.createElement("button");
  editBtn.className = "tile-edit";
  editBtn.textContent = "✎";
  editBtn.title = "编辑";
  editBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSiteModal(catId, item);
  });
  tile.appendChild(editBtn);

  const fav = document.createElement("div");
  fav.className = "favicon";
  fav.textContent = initials(item.name);
  const img = document.createElement("img");
  img.alt = "";
  img.onload = () => {
    fav.textContent = "";
    fav.appendChild(img);
  };
  img.src = faviconFor(item.url);

  const name = document.createElement("div");
  name.className = "site-name";
  name.textContent = item.name;

  tile.appendChild(fav);
  tile.appendChild(name);

  tile.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openSiteModal(catId, item);
  });

  return tile;
}

// ---------- Drag & drop: sites ----------

let dragPayload = null; // { type: 'site'|'category', ... }

function onSiteDragStart(e, catId, itemId) {
  e.stopPropagation();
  dragPayload = { type: "site", catId, itemId };
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", itemId);
}

// Re-render only here: removing the drag source in `drop` would detach it before
// `dragend` fires, and a cancelled drop must also discard the DOM preview.
function onDragEnd() {
  dragPayload = null;
  render();
}

function onSiteDragOver(e) {
  if (!dragPayload || dragPayload.type !== "site") return;
  e.preventDefault();
  const target = e.currentTarget;
  const dragging = document.querySelector(".site-tile.dragging");
  if (!dragging || dragging === target) return;
  const rect = target.getBoundingClientRect();
  const before = e.clientX < rect.left + rect.width / 2;
  target.parentElement.insertBefore(dragging, before ? target : target.nextSibling);
}

function onItemsGridDragOver(e) {
  if (!dragPayload || dragPayload.type !== "site") return;
  e.preventDefault();
  const grid = e.currentTarget;
  const dragging = document.querySelector(".site-tile.dragging");
  if (dragging && dragging.parentElement !== grid && e.target === grid) {
    grid.insertBefore(dragging, grid.querySelector(".add-tile"));
  }
}

function onItemsGridDrop(e) {
  if (!dragPayload || dragPayload.type !== "site") return;
  e.preventDefault();
  const grid = e.currentTarget;
  const targetCatId = grid.dataset.categoryId;

  const sourceCat = findCategory(dragPayload.catId);
  const item = sourceCat.items.find((i) => i.id === dragPayload.itemId);
  sourceCat.items = sourceCat.items.filter((i) => i.id !== dragPayload.itemId);

  const targetCat = findCategory(targetCatId);
  const tileIds = [...grid.querySelectorAll(".site-tile")].map((t) => t.dataset.itemId);
  const insertIndex = tileIds.indexOf(dragPayload.itemId) === -1
    ? tileIds.length
    : tileIds.indexOf(dragPayload.itemId);
  targetCat.items.splice(insertIndex, 0, item);
  persist();
}

// ---------- Drag & drop: categories ----------

function onCategoryHeaderDragStart(e, catId) {
  dragPayload = { type: "category", catId };
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function onCategoryDragOver(e) {
  if (!dragPayload || dragPayload.type !== "category") return;
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}

function onCategoryDrop(e) {
  if (!dragPayload || dragPayload.type !== "category") return;
  e.preventDefault();
  const targetEl = e.currentTarget;
  targetEl.classList.remove("drag-over");
  const targetCatId = targetEl.dataset.categoryId;
  if (targetCatId === dragPayload.catId) return;

  const fromIndex = state.categories.findIndex((c) => c.id === dragPayload.catId);
  const toIndex = state.categories.findIndex((c) => c.id === targetCatId);
  const [moved] = state.categories.splice(fromIndex, 1);
  state.categories.splice(toIndex, 0, moved);
  persist();
}

// ---------- Site modal ----------

const siteModal = document.getElementById("site-modal");
const siteNameInput = document.getElementById("site-name-input");
const siteUrlInput = document.getElementById("site-url-input");
const siteIdInput = document.getElementById("site-id-input");
const siteCategoryInput = document.getElementById("site-category-input");
const siteDeleteBtn = document.getElementById("site-delete-btn");

function openSiteModal(catId, item = null) {
  document.getElementById("site-modal-title").textContent = item ? "编辑网址" : "添加网址";
  siteNameInput.value = item ? item.name : "";
  siteUrlInput.value = item ? item.url : "";
  siteIdInput.value = item ? item.id : "";
  siteCategoryInput.value = catId;
  siteDeleteBtn.classList.toggle("hidden", !item);
  siteModal.classList.remove("hidden");
  siteNameInput.focus();
}

function closeSiteModal() {
  siteModal.classList.add("hidden");
}

function normalizeUrl(url) {
  url = url.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
    url = "https://" + url;
  }
  return url;
}

document.getElementById("site-cancel-btn").addEventListener("click", closeSiteModal);
document.getElementById("site-save-btn").addEventListener("click", async () => {
  const name = siteNameInput.value.trim();
  const url = siteUrlInput.value.trim();
  if (!name || !url) return;
  const catId = siteCategoryInput.value;
  const id = siteIdInput.value;
  const cat = findCategory(catId);

  if (id) {
    const item = findItem(catId, id);
    item.name = name;
    item.url = normalizeUrl(url);
  } else {
    cat.items.push({ id: uid("site"), name, url: normalizeUrl(url) });
  }
  await persist();
  closeSiteModal();
  render();
});
siteDeleteBtn.addEventListener("click", async () => {
  const catId = siteCategoryInput.value;
  const id = siteIdInput.value;
  const cat = findCategory(catId);
  cat.items = cat.items.filter((i) => i.id !== id);
  await persist();
  closeSiteModal();
  render();
});

// ---------- Category modal ----------

const categoryModal = document.getElementById("category-modal");
const categoryNameInput = document.getElementById("category-name-input");
const categoryIdInput = document.getElementById("category-id-input");
const categoryDeleteBtn = document.getElementById("category-delete-btn");

function openCategoryModal(cat = null) {
  categoryNameInput.value = cat ? cat.name : "";
  categoryIdInput.value = cat ? cat.id : "";
  categoryDeleteBtn.classList.toggle("hidden", !cat);
  categoryModal.classList.remove("hidden");
  categoryNameInput.focus();
}

function closeCategoryModal() {
  categoryModal.classList.add("hidden");
}

document.getElementById("add-category-btn").addEventListener("click", () => openCategoryModal());
document.getElementById("category-cancel-btn").addEventListener("click", closeCategoryModal);
document.getElementById("category-save-btn").addEventListener("click", async () => {
  const name = categoryNameInput.value.trim();
  if (!name) return;
  const id = categoryIdInput.value;
  if (id) {
    findCategory(id).name = name;
  } else {
    state.categories.push({ id: uid("cat"), name, items: [] });
  }
  await persist();
  closeCategoryModal();
  render();
});
categoryDeleteBtn.addEventListener("click", async () => {
  const id = categoryIdInput.value;
  const cat = findCategory(id);
  if (!confirm(`确定删除分类「${cat.name}」及其中 ${cat.items.length} 个网址吗？`)) return;
  state.categories = state.categories.filter((c) => c.id !== id);
  await persist();
  closeCategoryModal();
  render();
});

// Close modals on backdrop click
[siteModal, categoryModal].forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") modal.classList.add("hidden");
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      modal.querySelector(".btn-primary").click();
    }
  });
});

// ---------- Search bar ----------

const SEARCH_ENGINES = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  baidu: "https://www.baidu.com/s?wd=",
};
const engineSelect = document.getElementById("engine-select");
engineSelect.addEventListener("change", () => {
  state.engine = engineSelect.value;
  persist();
  document.getElementById("search-input").focus();
});

document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const value = e.currentTarget.value.trim();
  if (!value) return;
  const looksLikeUrl = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)|(^[\w-]+\.[a-z]{2,}(\/.*)?$)/i.test(value);
  window.location.href = looksLikeUrl
    ? normalizeUrl(value)
    : (SEARCH_ENGINES[state.engine] || SEARCH_ENGINES.google) + encodeURIComponent(value);
});

// ---------- Import / export ----------

document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "homepage-backup.json";
  a.click();
  URL.revokeObjectURL(url);
});

const importFileInput = document.getElementById("import-file");
document.getElementById("import-btn").addEventListener("click", () => importFileInput.click());
importFileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    const valid = Array.isArray(data.categories) && data.categories.every(
      (c) => c.id && typeof c.name === "string" && Array.isArray(c.items)
    );
    if (!valid) throw new Error("invalid");
    state = data;
    await persist();
    render();
  } catch {
    alert("导入失败：文件格式不正确");
  } finally {
    importFileInput.value = "";
  }
});

// ---------- Boot ----------

(async function init() {
  state = await Storage.load();
  if (SEARCH_ENGINES[state.engine]) engineSelect.value = state.engine;
  render();
})();
