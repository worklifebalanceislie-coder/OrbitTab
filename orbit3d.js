// МОДУЛЬ 3D-ОРБИТАЛЬНОЙ СИСТЕМЫ (orbit3d.js)
let orbit3DAnimationId = null;

function stopOrbit3D() {
  if (orbit3DAnimationId) {
    cancelAnimationFrame(orbit3DAnimationId);
    orbit3DAnimationId = null;
  }
}

function renderOrbit3D(grid, allElements) {
  stopOrbit3D();

  const scene = document.createElement("div");
  scene.className = "orbit3d-scene";

  const space = document.createElement("div");
  space.className = "orbit3d-space";
  scene.appendChild(space);

  let hoveredPlanet = null;
  let draggedPlanet = null;
  let dropTargetPlanet = null;

  // 1. Центральная звезда (первый элемент)
  const centerEl = allElements.at(0);
  centerEl.classList.add("orbit3d-center", "sphere-3d");
  centerEl.style.zIndex = "30";
  space.appendChild(centerEl);

  const planets = allElements.slice(1);
  if (planets.length === 0) {
    grid.appendChild(scene);
    return;
  }

  // Настройки наклонных орбит
  const orbitConfigs = [
    { rx: 64, ry: -14, radius: 205, speed: 0.0040 },
    { rx: 60, ry: 18,  radius: 280, speed: -0.0028 },
    { rx: 68, ry: -10, radius: 355, speed: 0.0021 },
    { rx: 56, ry: 22,  radius: 425, speed: -0.0016 }
  ];

  const activePlanets = [];
  let cursor = 0;
  let orbitIdx = 0;

  while (cursor < planets.length) {
    const config = orbitConfigs.at(orbitIdx % orbitConfigs.length);
    const capacity = (orbitIdx + 1) * 5;
    const ringItems = planets.slice(cursor, cursor + capacity);

    // Визуальное кольцо орбиты
    const plane = document.createElement("div");
    plane.className = "orbit3d-plane";
    plane.style.width = (config.radius * 2) + "px";
    plane.style.height = (config.radius * 2) + "px";
    plane.style.transform = `translate(-50%, -50%) rotateX(${config.rx}deg) rotateY(${config.ry}deg)`;
    plane.style.zIndex = "1";

    const ringVisual = document.createElement("div");
    ringVisual.className = "orbit3d-ring";
    plane.appendChild(ringVisual);
    space.appendChild(plane);

    // Индивидуальное состояние паузы для текущей орбиты
    const orbitState = { isPaused: false };

    const count = ringItems.length;
    const angleStep = (Math.PI * 2) / count;

    const radX = (config.rx * Math.PI) / 180;
    const radY = (config.ry * Math.PI) / 180;
    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);

    ringItems.forEach((el, i) => {
      const sizeSeed = ((orbitIdx * 7 + i * 13) % 26);
      const size = el.classList.contains("add-tile") ? 78 : (70 + sizeSeed);

      el.classList.add("orbit3d-planet", "sphere-3d");
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.left = "50%";
      el.style.top = "50%";

      space.appendChild(el);

      const planetObj = {
        el,
        orbitState,
        radius: config.radius,
        angle: i * angleStep + orbitIdx * 0.7,
        speed: config.speed,
        cosX,
        sinX,
        cosY,
        sinY
      };

      // Останавливаем только орбиту этой планеты при наведении или нажатии
      el.addEventListener("mouseenter", () => {
        orbitState.isPaused = true;
        hoveredPlanet = planetObj;
      });

      el.addEventListener("mousedown", () => {
        orbitState.isPaused = true;
        hoveredPlanet = planetObj;
      });

      el.addEventListener("mouseleave", () => {
        orbitState.isPaused = false;
        hoveredPlanet = null;
      });
      // Перетаскивание планеты в 3D
      if (el.dataset.index !== undefined) {
        el.addEventListener("pointerdown", (e) => {
          if (e.button !== 0 || e.target.closest(".delete-btn")) return;

          const startX = e.clientX;
          const startY = e.clientY;
          let isDragging = false;

          function onMove(ev) {
            if (!isDragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
              isDragging = true;
              draggedPlanet = planetObj;
              orbitState.isPaused = true;
              document.body.classList.add("is-dragging");
            }
            if (isDragging) {
              const rect = space.getBoundingClientRect();
              planetObj.dragX = ev.clientX - (rect.left + rect.width / 2);
              planetObj.dragY = ev.clientY - (rect.top + rect.height / 2);

              dropTargetPlanet = null;
              activePlanets.forEach(other => {
                other.el.style.outline = "";
                if (other === planetObj || other.el.dataset.index === undefined) return;
                const dist = Math.hypot(planetObj.dragX - other.lastX, planetObj.dragY - other.lastY);
                if (dist < 60) {
                  dropTargetPlanet = other;
                  other.el.style.outline = "3px dashed #fff";
                }
              });
            }
          }

          function onUp() {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            document.body.classList.remove("is-dragging");

            if (isDragging) {
              if (dropTargetPlanet) {
                dropTargetPlanet.el.style.outline = "";
                const fromIdx = Number(planetObj.el.dataset.index);
                const toIdx = Number(dropTargetPlanet.el.dataset.index);
                const moved = sites.splice(fromIdx, 1).at(0);
                sites.splice(toIdx, 0, moved);
                draggedPlanet = null;
                dropTargetPlanet = null;
                saveSites();
              }
              draggedPlanet = null;
              dropTargetPlanet = null;
              orbitState.isPaused = false;

              window.addEventListener("click", (ce) => {
                ce.preventDefault();
                ce.stopPropagation();
              }, { capture: true, once: true });
            }
          }

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        });
      }

      activePlanets.push(planetObj);
    });

    cursor += capacity;
    orbitIdx++;
  }

  const maxRadius = orbitConfigs.at(Math.min(orbitIdx - 1, orbitConfigs.length - 1)).radius;
  scene.style.height = Math.max(460, Math.round(maxRadius * 1.15 + 150)) + "px";

  grid.appendChild(scene);

  const perspective = 1100;

  // Анимационный цикл
  function animate() {
    activePlanets.forEach(p => {
        if (draggedPlanet === p) {
        p.el.style.transform = `translate(calc(-50% + ${p.dragX}px), calc(-50% + ${p.dragY}px)) scale(1.2)`;
        p.el.style.zIndex = "100";
        return;
      }

      // Двигаем планету только если её конкретная орбита не на паузе
      if (!p.orbitState.isPaused) {
        p.angle += p.speed;
      }

      const x0 = Math.cos(p.angle) * p.radius;
      const y0 = Math.sin(p.angle) * p.radius;

      const y1 = y0 * p.cosX;
      const z1 = y0 * p.sinX;

      const x2 = x0 * p.cosY + z1 * p.sinY;
      const z2 = -x0 * p.sinY + z1 * p.cosY;

      const perspScale = perspective / (perspective - z2);
      const screenX = x2 * perspScale;
      const screenY = y1 * perspScale;

      p.lastX = screenX;
      p.lastY = screenY;


      const isHovered = (hoveredPlanet === p);
      const scale = isHovered ? 1.22 : perspScale;

      p.el.style.transform =
        `translate(calc(-50% + ${screenX.toFixed(1)}px), calc(-50% + ${screenY.toFixed(1)}px)) ` +
        `scale(${scale.toFixed(3)})`;

      if (isHovered) {
        p.el.style.zIndex = "60";
      } else {
        p.el.style.zIndex = String(Math.round(30 + z2 / 10));
      }
    });

    orbit3DAnimationId = requestAnimationFrame(animate);
  }

  animate();
}
