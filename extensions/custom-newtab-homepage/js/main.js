let state = { categories: [] };

const board = document.getElementById("board");

function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${host}`;
  } catch {
    return "";
  }
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
  header.addEventListener("dragend", (e) => e.currentTarget.classList.remove("dragging"));

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
  const tile = document.createElement("div");
  tile.className = "site-tile";
  tile.draggable = true;
  tile.dataset.categoryId = catId;
  tile.dataset.itemId = item.id;

  tile.addEventListener("dragstart", (e) => onSiteDragStart(e, catId, item.id));
  tile.addEventListener("dragend", (e) => e.currentTarget.classList.remove("dragging"));
  tile.addEventListener("dragover", onSiteDragOver);

  const fav = document.createElement("div");
  fav.className = "favicon";
  const img = document.createElement("img");
  img.src = faviconFor(item.url);
  img.alt = "";
  img.onerror = () => {
    fav.innerHTML = "";
    fav.textContent = initials(item.name);
  };
  fav.appendChild(img);

  const name = document.createElement("div");
  name.className = "site-name";
  name.textContent = item.name;

  tile.appendChild(fav);
  tile.appendChild(name);

  tile.addEventListener("click", () => {
    window.location.href = item.url;
  });
  tile.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openSiteModal(catId, item);
  });

  return tile;
}

// ---------- Drag & drop: sites ----------

let dragPayload = null; // { type: 'site'|'category', ... }

function onSiteDragStart(e, catId, itemId) {
  dragPayload = { type: "site", catId, itemId };
  e.currentTarget.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function onSiteDragOver(e) {
  if (!dragPayload || dragPayload.type !== "site") return;
  e.preventDefault();
  const target = e.currentTarget;
  const grid = target.parentElement;
  const dragging = grid.querySelector(".site-tile.dragging");
  if (!dragging || dragging === target) return;
  const rect = target.getBoundingClientRect();
  const before = e.clientX < rect.left + rect.width / 2;
  grid.insertBefore(dragging, before ? target : target.nextSibling);
}

function onItemsGridDragOver(e) {
  if (!dragPayload || dragPayload.type !== "site") return;
  e.preventDefault();
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

  dragPayload = null;
  persist();
  render();
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
  if (targetCatId === dragPayload.catId) {
    dragPayload = null;
    return;
  }

  const fromIndex = state.categories.findIndex((c) => c.id === dragPayload.catId);
  const toIndex = state.categories.findIndex((c) => c.id === targetCatId);
  const [moved] = state.categories.splice(fromIndex, 1);
  state.categories.splice(toIndex, 0, moved);

  dragPayload = null;
  persist();
  render();
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
});

// ---------- Search bar ----------

document.getElementById("search-input").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const value = e.currentTarget.value.trim();
  if (!value) return;
  const looksLikeUrl = /^([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)|(^[\w-]+\.[a-z]{2,}(\/.*)?$)/i.test(value);
  window.location.href = looksLikeUrl
    ? normalizeUrl(value)
    : `https://www.google.com/search?q=${encodeURIComponent(value)}`;
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
    if (!Array.isArray(data.categories)) throw new Error("invalid");
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
  render();
})();
