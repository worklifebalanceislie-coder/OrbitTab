// 1. ЧАСЫ И ДАТА
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');

  if (clockEl) clockEl.textContent = hours + ':' + minutes;
  if (dateEl) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    dateEl.textContent = now.toLocaleDateString('ru-RU', options);
  }
}
setInterval(updateClock, 1000);
updateClock();

// 2. ПОИСК ЧЕРЕЗ ВСТРОЕННЫЕ ПОИСКОВИКИ FIREFOX С ЛОГОТИПАМИ
const engineBtn = document.getElementById("engine-btn");
const currentEngineIcon = document.getElementById("current-engine-icon");
const engineDropdown = document.getElementById("engine-dropdown");
const searchInput = document.getElementById("search-input");

let currentEngineName = "Google";

function getFallbackIcon(name) {
  const lower = (name || "").toLowerCase();
  if (lower.includes("yandex") || lower.includes("яндекс")) return "https://duckduckgo.com";
  if (lower.includes("duck")) return "https://duckduckgo.com";
  if (lower.includes("bing")) return "https://duckduckgo.com";
  if (lower.includes("wiki")) return "https://duckduckgo.com";
  return "https://duckduckgo.com";
}

function selectEngine(engineObj) {
  if (!engineObj) return;
  currentEngineName = engineObj.name;
  currentEngineIcon.src = engineObj.favIconUrl || getFallbackIcon(engineObj.name);
  currentEngineIcon.alt = engineObj.name;
  engineBtn.title = "Поисковик: " + engineObj.name;
  searchInput.placeholder = "Поиск в " + engineObj.name + "...";

  document.querySelectorAll(".engine-item").forEach(item => {
    item.classList.toggle("active", item.dataset.name === engineObj.name);
  });
}

async function initSearchEngines() {
  let engines = [];
  let savedEngineName = null;

  try {
    if (typeof browser !== "undefined" && browser.search && browser.search.get) {
      engines = await browser.search.get();
      const savedData = await browser.storage.local.get("selectedEngine");
      savedEngineName = savedData.selectedEngine;
    }
  } catch (e) {}

  if (!engines || engines.length === 0) {
    engines = [{ name: "Google", isDefault: true, favIconUrl: getFallbackIcon("Google") }];
  }

  engineDropdown.innerHTML = "";
  let activeEngine = engines.at(0);

  engines.forEach(eng => {
    if (savedEngineName && eng.name === savedEngineName) {
      activeEngine = eng;
    } else if (!savedEngineName && eng.isDefault) {
      activeEngine = eng;
    }

    const item = document.createElement("button");
    item.type = "button";
    item.className = "engine-item";
    item.dataset.name = eng.name;

    const img = document.createElement("img");
    img.src = eng.favIconUrl || getFallbackIcon(eng.name);
    img.alt = eng.name;

    const label = document.createElement("span");
    label.textContent = eng.name;

    item.appendChild(img);
    item.appendChild(label);

    item.onclick = async () => {
      selectEngine(eng);
      engineDropdown.classList.add("hidden");
      searchInput.focus();
      try {
        if (typeof browser !== "undefined" && browser.storage) {
          await browser.storage.local.set({ selectedEngine: eng.name });
        }
      } catch (e) {}
    };

    engineDropdown.appendChild(item);
  });

  selectEngine(activeEngine);
}

engineBtn.onclick = (e) => {
  e.stopPropagation();
  engineDropdown.classList.toggle("hidden");
};

document.addEventListener("click", (e) => {
  const selector = document.getElementById("engine-selector");
  if (selector && !selector.contains(e.target)) {
    engineDropdown.classList.add("hidden");
  }
});

document.getElementById("search-form").addEventListener("submit", function(e) {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  if (typeof browser !== "undefined" && browser.search && browser.search.search) {
    browser.search.search({
      query: query,
      engine: currentEngineName
    });
  } else {
    window.location.href = "https://google.com" + query;
  }
});

// 3. АВТОМАТИЧЕСКИЙ ФОН ДЛЯ ПЛИТКИ
function generateTileGradient(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 45) % 360;
  return "linear-gradient(135deg, hsl(" + hue1 + ", 65%, 42%), hsl(" + hue2 + ", 70%, 32%))";
}

// 4. ХРАНИЛИЩЕ, ФОРМЫ И СЕТКИ (КВАДРАТЫ, СОТЫ, ОРБИТЫ)
const defaultSites = [
  { title: "YouTube", url: "https://youtube.com" },
  { title: "Google", url: "https://google.com" },
  { title: "GitHub", url: "https://github.com" },
  { title: "Wikipedia", url: "https://wikipedia.org" }
];

let sites = [];
let currentShape = "square";

async function loadSites() {
  try {
    if (typeof browser !== "undefined" && browser.storage) {
      const data = await browser.storage.local.get("sites");
      if (data.sites) {
        sites = data.sites;
        renderSites();
        return;
      }
    }
  } catch (e) {}

  const saved = localStorage.getItem("custom_sites");
  sites = saved ? JSON.parse(saved) : [...defaultSites];
  renderSites();
}

async function saveSites() {
  renderSites();
  try {
    localStorage.setItem("custom_sites", JSON.stringify(sites));
  } catch (e) {}
  try {
    if (typeof browser !== "undefined" && browser.storage) {
      await browser.storage.local.set({ sites });
    }
  } catch (e) {}
}

function openAddModal() {
  document.getElementById("add-modal").classList.remove("hidden");
  document.getElementById("site-title").focus();
}

function closeAddModal() {
  document.getElementById("add-modal").classList.add("hidden");
  document.getElementById("site-title").value = "";
  document.getElementById("site-url").value = "";
}

let draggedIndex = null;
let isSwapping = false;
const iconCache = {};

// Плавная FLIP-анимация переезда соседних плиток на новые места
function animateGridReorder(mutateSitesCallback) {
  // 1. Запоминаем текущие координаты всех плиток (First)
  const oldRects = new Map();
  document.querySelectorAll("#bookmarks-grid .tile").forEach((el, idx) => {
    const key = el.dataset.url || ("add-" + idx);
    oldRects.set(key, el.getBoundingClientRect());
  });

  // 2. Меняем порядок в массиве и перерисовываем сетку (Last)
  mutateSitesCallback();
  renderSites();

  // 3. Вычисляем разницу и плавно анимируем сдвиг (Invert & Play)
  document.querySelectorAll("#bookmarks-grid .tile").forEach((el, idx) => {
    const key = el.dataset.url || ("add-" + idx);
    const oldRect = oldRects.get(key);
    if (!oldRect) return;

    const newRect = el.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = "transform 0.32s cubic-bezier(0.2, 0.85, 0.25, 1)";
          el.style.transform = "";
        });
      });
    }
  });
}

// Вычисляет, над какой плиткой сейчас находится курсор, и запускает анимированный обмен
function checkLiveSwap(clientX, clientY) {
  if (draggedIndex === null || isSwapping) return;

  const tiles = Array.from(document.querySelectorAll("#bookmarks-grid .tile[data-index]"));
  for (const tileEl of tiles) {
    const targetIdx = Number(tileEl.dataset.index);
    if (targetIdx === draggedIndex) continue;

    const rect = tileEl.getBoundingClientRect();
    const padX = rect.width * 0.18;
    const padY = rect.height * 0.18;

    if (
      clientX >= rect.left + padX &&
      clientX <= rect.right - padX &&
      clientY >= rect.top + padY &&
      clientY <= rect.bottom - padY
    ) {
      isSwapping = true;
      animateGridReorder(() => {
        const movedItem = sites.splice(draggedIndex, 1).at(0);
        sites.splice(targetIdx, 0, movedItem);
        draggedIndex = targetIdx;
      });
      setTimeout(() => {
        isSwapping = false;
      }, 140);
      break;
    }
  }
}

function createSiteTile(site, index) {
  const a = document.createElement("a");
  a.className = "tile";
  a.href = site.url;
  a.dataset.index = String(index);
  a.dataset.url = site.url + "_" + index;
  a.style.background = generateTileGradient(site.url);
  a.draggable = false;

  if (draggedIndex === index && currentShape !== "orbit3d") {
    a.classList.add("live-placeholder");
  }

  // --- РЕЖИМ 1: ЖИВОЕ АНИМИРОВАННОЕ ПЕРЕТАСКИВАНИЕ ДЛЯ 2D ---
  if (currentShape !== "orbit3d") {
    a.draggable = false;

    a.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest(".delete-btn")) return;

      const startX = e.clientX;
      const startY = e.clientY;
      let lastX = startX;
      const rect = a.getBoundingClientRect();
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;

      let isDragging = false;
      let floatingClone = null;

      function onPointerMove(moveEvent) {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        if (!isDragging && Math.hypot(dx, dy) > 6) {
          isDragging = true;
          draggedIndex = index;

          // Запрещаем выделение текста на всей странице на время перетаскивания
          document.body.classList.add("is-dragging");
          if (window.getSelection) {
            window.getSelection().removeAllRanges();
          }

          floatingClone = a.cloneNode(true);
          floatingClone.classList.add("live-dragging", "clone-" + currentShape);
          floatingClone.style.width = rect.width + "px";
          floatingClone.style.height = rect.height + "px";
          floatingClone.style.left = rect.left + "px";
          floatingClone.style.top = rect.top + "px";
          document.body.appendChild(floatingClone);

          renderSites();
        }


        if (isDragging && floatingClone) {
          floatingClone.style.left = (moveEvent.clientX - offsetX) + "px";
          floatingClone.style.top = (moveEvent.clientY - offsetY) + "px";

          // Лёгкий живой наклон в сторону горизонтального движения
          const velocityX = Math.max(-15, Math.min(15, (moveEvent.clientX - lastX) * 0.6));
          lastX = moveEvent.clientX;
          floatingClone.style.transform = `scale(1.08) rotate(${velocityX.toFixed(1)}deg)`;

          checkLiveSwap(moveEvent.clientX, moveEvent.clientY);
        }
      }

      function onPointerUp() {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        document.body.classList.remove("is-dragging");

        if (isDragging) {
          if (floatingClone) {
            floatingClone.remove();
            floatingClone = null;
          }
          draggedIndex = null;
          isSwapping = false;
          saveSites();

          const preventClick = (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
          };
          window.addEventListener("click", preventClick, { capture: true, once: true });
          setTimeout(() => {
            window.removeEventListener("click", preventClick, { capture: true });
          }, 50);
        }
      }


      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    });
  } else {
    // --- РЕЖИМ 2: DRAG-AND-DROP ДЛЯ 3D-ОРБИТЫ ---
    a.draggable = true;

    a.addEventListener("dragstart", (e) => {
      draggedIndex = index;
      a.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));
    });

    a.addEventListener("dragend", () => {
      draggedIndex = null;
      a.classList.remove("dragging");
      document.querySelectorAll(".tile.drag-over").forEach(el => el.classList.remove("drag-over"));
    });

    a.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggedIndex !== null && draggedIndex !== index) {
        a.classList.add("drag-over");
      }
    });

    a.addEventListener("dragleave", () => {
      a.classList.remove("drag-over");
    });

    a.addEventListener("drop", (e) => {
      e.preventDefault();
      a.classList.remove("drag-over");
      if (draggedIndex === null || draggedIndex === index) return;

      const movedItem = sites.splice(draggedIndex, 1).at(0);
      sites.splice(index, 0, movedItem);
      draggedIndex = null;
      saveSites();
    });
  }

  // --- ЗАГРУЗКА ЛОГОТИПА С КЭШИРОВАНИЕМ ---
  let origin = "";
  let domain = "";
  let rootDomain = "";

  try {
    const urlObj = new URL(site.url);
    origin = urlObj.origin;
    domain = urlObj.hostname;
    const parts = domain.split(".");
    rootDomain = parts.length > 2 ? parts.slice(-2).join(".") : domain;
  } catch (e) {
    domain = site.url;
    rootDomain = site.url;
  }

  const iconSources = [
    origin + "/favicon.ico",
    "https://duckduckgo.com" + domain + ".ico",
    "https://duckduckgo.com" + rootDomain + ".ico",
    "https://google.com" + rootDomain + "&sz=64"
  ];

  if (iconCache[site.url] === "LETTER") {
    const letterBox = document.createElement("div");
    letterBox.className = "tile-letter";
    letterBox.textContent = (site.title || domain || "?").charAt(0);
    a.appendChild(letterBox);
  } else {
    let attempt = 0;
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    img.src = iconCache[site.url] || iconSources.at(0);

    img.onload = () => {
      iconCache[site.url] = img.src;
    };

    img.onerror = () => {
      attempt++;
      if (attempt < iconSources.length) {
        img.src = iconSources.at(attempt);
      } else {
        iconCache[site.url] = "LETTER";
        const letterBox = document.createElement("div");
        letterBox.className = "tile-letter";
        letterBox.textContent = (site.title || domain || "?").charAt(0);
        img.replaceWith(letterBox);
      }
    };

    a.appendChild(img);
  }

  const title = document.createElement("div");
  title.className = "tile-title";
  title.textContent = site.title;

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "delete-btn";
  delBtn.textContent = "✕";
  delBtn.title = "Удалить";
  delBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    sites.splice(index, 1);
    saveSites();
  };

  a.appendChild(delBtn);
  a.appendChild(title);
  return a;
}


// Отрисовка ОРБИТАЛЬНОЙ СИСТЕМЫ (для кругов)
function renderOrbitSystem(grid, allElements) {
  const scene = document.createElement("div");
  scene.className = "orbit-scene";

  // Первый элемент — центральная звезда/планета
  const centerEl = allElements.at(0);
  centerEl.classList.add("orbit-center");
  scene.appendChild(centerEl);

  const orbitingElements = allElements.slice(1);
  if (orbitingElements.length === 0) {
    scene.style.width = "160px";
    scene.style.height = "160px";
    grid.appendChild(scene);
    return;
  }

  // Вместимость каждой орбиты: 1-я орбита до 6 планет, 2-я до 12, 3-я до 18
  const baseRadius = 155;
  const radiusStep = 118;

  let cursor = 0;
  let orbitIndex = 0;
  let maxRadiusUsed = baseRadius;

  while (cursor < orbitingElements.length) {
    const capacity = (orbitIndex + 1) * 6;
    const ringItems = orbitingElements.slice(cursor, cursor + capacity);
    const radius = baseRadius + orbitIndex * radiusStep;
    maxRadiusUsed = radius;

    // Рисуем тонкое кольцо орбиты
    const ring = document.createElement("div");
    ring.className = "orbit-ring";
    ring.style.width = (radius * 2) + "px";
    ring.style.height = (radius * 2) + "px";
    scene.appendChild(ring);

    // Расставляем планеты по кругу (начиная сверху: -Math.PI / 2)
    const count = ringItems.length;
    const angleStep = (2 * Math.PI) / count;
    const startAngle = -Math.PI / 2 + (orbitIndex * 0.35);

    ringItems.forEach((el, i) => {
      const angle = startAngle + i * angleStep;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      el.classList.add("orbit-planet");
      el.style.left = "calc(50% + " + Math.round(x) + "px)";
      el.style.top = "calc(50% + " + Math.round(y) + "px)";
      scene.appendChild(el);
    });

    cursor += capacity;
    orbitIndex++;
  }

  const totalSize = maxRadiusUsed * 2 + 115;
  scene.style.width = totalSize + "px";
  scene.style.height = totalSize + "px";
  grid.appendChild(scene);
}

function renderSites() {
    const grid = document.getElementById("bookmarks-grid");
grid.innerHTML = "";
const allElements = sites.map((site, index) => createSiteTile(site, index));
const addTile = document.createElement("button");
addTile.type = "button";
addTile.className = "tile add-tile";
addTile.innerHTML = '+Добавить';
addTile.onclick = openAddModal;
allElements.push(addTile);
  // Останавливаем 3D-анимацию, если переключились на другой режим
  if (typeof stopOrbit3D === "function") {
    stopOrbit3D();
  }

  // Если выбран 3D-космос
  if (currentShape === "orbit3d" && typeof renderOrbit3D === "function") {
    renderOrbit3D(grid, allElements);
    return;
  }

// Если выбраны круги — включаем орбитальную систему
if (currentShape === "circle") {
renderOrbitSystem(grid, allElements);
return;
}
// Для квадратов и шестигранников — ряды
const availableWidth = Math.min(window.innerWidth - 40, 860);
const maxPerRow = Math.max(3, Math.floor(availableWidth / 138));
const isStaggered = (currentShape === "hex");
let cursor = 0;
let rowIndex = 0;
while (cursor < allElements.length) {
const rowLimit = (isStaggered && rowIndex % 2 === 1)
? Math.max(2, maxPerRow - 1)
: maxPerRow;
const rowEl = document.createElement("div");
rowEl.className = "grid-row";
const rowItems = allElements.slice(cursor, cursor + rowLimit);
rowItems.forEach(el => rowEl.appendChild(el));
if (isStaggered && rowItems.length < rowLimit) {
const missingCount = rowLimit - rowItems.length;
for (let i = 0; i < missingCount; i++) {
const ghost = document.createElement("div");
ghost.className = "tile";
ghost.style.visibility = "hidden";
ghost.style.pointerEvents = "none";
rowEl.appendChild(ghost);
}
}
grid.appendChild(rowEl);
cursor += rowLimit;
rowIndex++;
}
}
window.addEventListener("resize", () => {
if (currentShape !== "circle") {
renderSites();
}
});
// События модального окна
document.getElementById("cancel-site").onclick = closeAddModal;
function handleSaveSite() {
const titleInput = document.getElementById("site-title");
const urlInput = document.getElementById("site-url");
let title = titleInput.value.trim();
let url = urlInput.value.trim();
if (!url) return;
if (!url.startsWith("http://") && !url.startsWith("https://")) {
url = "https://" + url;
}
if (!title) {
try {
title = new URL(url).hostname.replace("www.", "");
} catch (e) {
title = url;
}
}
sites.push({ title, url });
saveSites();
closeAddModal();
}
document.getElementById("save-site").onclick = handleSaveSite;
document.getElementById("site-url").addEventListener("keydown", (e) => {
if (e.key === "Enter") handleSaveSite();
});
document.getElementById("site-title").addEventListener("keydown", (e) => {
if (e.key === "Enter") handleSaveSite();
});
// 5. ВЫБОР ФОРМЫ ПЛИТОК
function applyTileShape(shape) {
  currentShape = shape;
  const grid = document.getElementById("bookmarks-grid");
  grid.classList.remove("shape-square", "shape-circle", "shape-hex", "shape-orbit3d");
  grid.classList.add("shape-" + shape);

  document.querySelectorAll(".shape-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.shape === shape);
  });

  renderSites();
}

async function saveTileShape(shape) {
applyTileShape(shape);
try {
localStorage.setItem("tile_shape", shape);
} catch (e) {}
try {
if (typeof browser !== "undefined" && browser.storage) {
await browser.storage.local.set({ tileShape: shape });
}
} catch (e) {}
}
async function loadTileShape() {
let shape = "square";
try {
if (typeof browser !== "undefined" && browser.storage) {
const data = await browser.storage.local.get("tileShape");
if (data.tileShape) shape = data.tileShape;
}
} catch (e) {}
if (shape === "square") {
const saved = localStorage.getItem("tile_shape");
if (saved) shape = saved;
}
applyTileShape(shape);
}
document.querySelectorAll(".shape-btn").forEach(btn => {
btn.onclick = () => saveTileShape(btn.dataset.shape);
});
// 6. НАСТРОЙКА ФОНА СТРАНИЦЫ
async function loadBackground() {
try {
if (typeof browser !== "undefined" && browser.storage) {
const data = await browser.storage.local.get("customBg");
if (data.customBg) {
applyBackground(data.customBg);
return;
}
}
} catch (e) {}
const savedBg = localStorage.getItem("custom_bg");
if (savedBg) applyBackground(savedBg);
}
function applyBackground(bgValue) {
if (bgValue.startsWith("data:image")) {
document.body.style.background = 'url("' + bgValue + '") center / cover no-repeat fixed';
} else {
document.body.style.background = bgValue;
}
}
async function saveBackground(bgValue) {
applyBackground(bgValue);
try {
if (typeof browser !== "undefined" && browser.storage) {
await browser.storage.local.set({ customBg: bgValue });
}
} catch (e) {}
if (!bgValue.startsWith("data:image")) {
try {
localStorage.setItem("custom_bg", bgValue);
} catch (e) {}
}
}
const settingsPanel = document.getElementById("settings-panel");
document.getElementById("settings-btn").onclick = () => {
settingsPanel.classList.toggle("hidden");
};
document.getElementById("close-settings").onclick = () => {
settingsPanel.classList.add("hidden");
};
document.querySelectorAll(".preset").forEach(btn => {
btn.onclick = () => saveBackground(btn.dataset.bg);
});
document.getElementById("bg-color").oninput = (e) => {
saveBackground(e.target.value);
};
document.getElementById("bg-file").onchange = (e) => {
const file = e.target.files.item(0);
if (!file) return;
const reader = new FileReader();
reader.onload = () => {
saveBackground(reader.result);
};
reader.readAsDataURL(file);
};
// Инициализация
initSearchEngines();
loadTileShape();
loadBackground();
loadSites();