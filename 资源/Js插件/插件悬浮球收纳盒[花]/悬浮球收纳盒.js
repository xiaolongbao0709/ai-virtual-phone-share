// 悬浮球收纳盒 (Floating Ball Dock) · v4.0.0
// 更新内容：
// 1. 性能优化：修复 MutationObserver 监听子树导致的严重卡顿，改为节流按需扫描。
// 2. 还原豁免：支持单独将被收纳的悬浮球还原，被还原的球会被加入豁免名单，直到点击"刷新"才重新收纳。

const DOCK_ID = "__plugin_float_dock_master__";
const PANEL_ID = "__plugin_float_dock_panel__";
const ATTR_CAPTURED = "data-dock-captured";

const KNOWN_BALL_NAMES = [
  { match: (el) => el.classList.contains("asw-ball"), name: "多任务切换" },
  { match: (el) => el.classList.contains("mmv-tab") || el.closest("#mmv-root"), name: "语音导出缓存" },
];

const CSS = `
#${DOCK_ID} {
  position: fixed;
  z-index: 2147483646;
  right: 0;
  top: 42%;
  width: var(--dock-w, 10px);
  height: var(--dock-h, 48px);
  border-radius: 8px 0 0 8px;
  background: rgba(30, 32, 38, var(--dock-alpha, 0.42));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-right: none;
  box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  transition: width 0.2s cubic-bezier(.2,.8,.2,1), background 0.2s, opacity 0.2s, border-radius 0.2s;
}
#${DOCK_ID}:hover,
#${DOCK_ID}.dock-active {
  width: 16px;
  background: rgba(30, 32, 38, 0.82);
}
#${DOCK_ID}[data-side="left"] {
  left: 0;
  right: auto;
  border-radius: 0 8px 8px 0;
  border-right: 1px solid rgba(255, 255, 255, 0.28);
  border-left: none;
  box-shadow: 2px 2px 8px rgba(0, 0, 0, 0.12);
}
#${DOCK_ID} .dock-grip {
  width: 2px;
  height: 16px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.65);
  pointer-events: none;
}
#${DOCK_ID} .dock-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 4px #38bdf8;
  pointer-events: none;
  display: none;
}
#${DOCK_ID}.has-items .dock-dot {
  display: block;
}

#${PANEL_ID} {
  position: fixed;
  z-index: 2147483645;
  width: 226px;
  max-height: 340px;
  overflow-y: auto;
  border-radius: 16px;
  background: rgba(26, 28, 34, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.38);
  padding: 10px;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  display: none;
  flex-direction: column;
  gap: 6px;
}
#${PANEL_ID}.dock-open {
  display: flex;
  animation: dockFadeIn 0.16s ease-out;
}
@keyframes dockFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.dock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  font-weight: 600;
}
.dock-rescan-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}
.dock-rescan-btn:active {
  background: rgba(255, 255, 255, 0.22);
}
.dock-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.07);
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.dock-item:hover {
  background: rgba(255, 255, 255, 0.14);
}
.dock-item:active {
  transform: scale(0.98);
}
.dock-item-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
  color: #fff;
}
.dock-item-icon svg { width: 16px; height: 16px; }
.dock-item-title {
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.dock-item-action {
  background: rgba(255, 69, 58, 0.15);
  color: #ff453a;
  border: none;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, background 0.15s;
}
.dock-item:hover .dock-item-action {
  opacity: 1;
}
.dock-item-action:active {
  background: rgba(255, 69, 58, 0.25);
}
.dock-empty {
  padding: 16px 8px;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

/* 仅隐藏触发按钮本身，不影响插件自己的弹出面板 */
[${ATTR_CAPTURED}="hidden"] {
  opacity: 0 !important;
  pointer-events: none !important;
  width: 0px !important;
  min-width: 0px !important;
  padding-left: 0px !important;
  padding-right: 0px !important;
  border-width: 0px !important;
  overflow: hidden !important;
}
`;

export default {
  manifest: {
    id: "floating-ball-dock",
    name: "悬浮球收纳盒",
    apiVersion: 1,
    version: "4.0.0",
    author: "可丽饼＆Gemini",
    description: "将页面上各个扩展插件自带的悬浮球统一收纳。v4优化了性能解决卡顿，并支持悬浮球单独脱离收纳盒还原显示。",
    settings: [
      { key: "maxBallSize", label: "最大识别尺寸 (px)", type: "number", default: 100 },
      { key: "barWidth", label: "贴边条宽度 (px)", type: "number", default: 10 },
      { key: "barHeight", label: "贴边条高度 (px)", type: "number", default: 48 },
      { key: "barOpacity", label: "平时不透明度 (0.1~1)", type: "number", default: 0.42 },
    ],
  },

  setup(ctx) {
    ctx.ui.injectCSS(CSS);

    const captured = new Map();
    // 豁免名单：记录用户手动还原（不收纳）的节点
    const excluded = new Set();
    
    let isOpen = false;
    let side = "right";
    let topRatio = 0.42;
    let observer = null;
    let phoneObserver = null;

    try {
      const saved = ctx.system.storage.get("dockPos");
      const pos = typeof saved === "string" ? JSON.parse(saved) : saved;
      if (pos && (pos.side === "left" || pos.side === "right")) side = pos.side;
      if (pos && typeof pos.topRatio === "number") topRatio = pos.topRatio;
    } catch (_) {}

    const getSetting = (key, fallback) => {
      try {
        const val = ctx.system.settings.get(key);
        return val === undefined || val === null || val === "" ? fallback : val;
      } catch (_) {
        return fallback;
      }
    };

    const dock = document.createElement("div");
    dock.id = DOCK_ID;
    dock.innerHTML = `<div class="dock-dot"></div><div class="dock-grip"></div>`;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;

    document.body.appendChild(dock);
    document.body.appendChild(panel);

    function applyAppearance() {
      const w = Math.max(6, Math.min(32, Number(getSetting("barWidth", 10)) || 10));
      const h = Math.max(28, Math.min(140, Number(getSetting("barHeight", 48)) || 48));
      const alpha = Math.max(0.1, Math.min(1, Number(getSetting("barOpacity", 0.42)) || 0.42));
      dock.style.setProperty("--dock-w", `${w}px`);
      dock.style.setProperty("--dock-h", `${h}px`);
      dock.style.setProperty("--dock-alpha", String(alpha));
    }

    function placeDock() {
      const H = window.innerHeight;
      const barH = dock.offsetHeight || 48;
      const y = Math.min(H - barH - 24, Math.max(24, topRatio * H));
      dock.style.top = `${Math.round(y)}px`;
      dock.setAttribute("data-side", side);
      if (isOpen) placePanel();
    }

    function placePanel() {
      const rect = dock.getBoundingClientRect();
      const pW = 226;
      const pH = panel.offsetHeight || 180;
      let left = side === "right" ? rect.left - pW - 10 : rect.right + 10;
      left = Math.max(10, Math.min(window.innerWidth - pW - 10, left));
      let top = rect.top + rect.height / 2 - pH / 2;
      top = Math.max(16, Math.min(window.innerHeight - pH - 16, top));
      panel.style.left = `${Math.round(left)}px`;
      panel.style.top = `${Math.round(top)}px`;
    }

    function isExcludedNode(el) {
      if (!el || el.nodeType !== 1) return true;
      if (el.id === DOCK_ID || el.id === PANEL_ID) return true;
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "META") return true;
      if (el.getAttribute("data-ui") === "phone-screen") return true;
      if (el.id === "__next" || el.id === "root") return true;
      if (el.classList.contains("asw-bar") || el.classList.contains("asw-overlay")) return true;
      return false;
    }

    function isSizeLikeTrigger(rect, maxSize) {
      return (rect.width >= 8 && rect.height >= 14 && rect.width <= maxSize && rect.height <= maxSize);
    }

    function findTriggerElement(rootEl, allowAbsolute = false) {
      if (isExcludedNode(rootEl)) return null;
      if (rootEl.getAttribute(ATTR_CAPTURED) === "hidden") return rootEl;

      const cs = window.getComputedStyle(rootEl);
      if (cs.display === "none" || cs.visibility === "hidden") return null;

      const pos = cs.position;
      const isFixed = pos === "fixed";
      const isHighZAbsolute = allowAbsolute && pos === "absolute" && (parseInt(cs.zIndex, 10) || 0) >= 100;

      if (!isFixed && !isHighZAbsolute) return null;

      const maxSize = Number(getSetting("maxBallSize", 100)) || 100;
      const rect = rootEl.getBoundingClientRect();

      if (isSizeLikeTrigger(rect, maxSize)) {
        return rootEl;
      }

      // 处理0x0复合容器
      if (rect.width <= maxSize && rect.height <= maxSize) {
        const children = rootEl.querySelectorAll("*");
        for (const child of children) {
          if (child.getAttribute(ATTR_CAPTURED) === "hidden") return child;
          const ccs = window.getComputedStyle(child);
          if (ccs.display === "none" || ccs.visibility === "hidden") continue;
          if (ccs.position === "fixed" || ccs.position === "absolute") {
            const cRect = child.getBoundingClientRect();
            if (isSizeLikeTrigger(cRect, maxSize)) {
              return child;
            }
          }
        }
      }
      return null;
    }

    function extractMeta(el, index) {
      let knownName = "";
      for (const item of KNOWN_BALL_NAMES) {
        try { if (item.match(el)) { knownName = item.name; break; } } catch (_) {}
      }

      const rawText = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      const title = knownName || el.getAttribute("title") || el.getAttribute("aria-label") || el.getAttribute("data-label") || 
        (rawText.length > 0 && rawText.length <= 12 ? rawText : "") || (el.id ? `插件 (${el.id})` : `悬浮功能 #${index}`);

      let iconHTML = "";
      const svg = el.querySelector("svg");
      const img = el.querySelector("img");
      if (svg) iconHTML = svg.outerHTML;
      else if (img && img.src) iconHTML = `<img src="${img.src}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" />`;
      else if (rawText) iconHTML = rawText.slice(0, 2);
      else iconHTML = title.slice(0, 1) || "⚡";

      return { label: title, iconHTML };
    }

    function triggerPluginAction(targetEl) {
      targetEl.removeAttribute(ATTR_CAPTURED);
      if (targetEl.classList.contains("asw-tucked")) targetEl.classList.remove("asw-tucked");

      const rect = targetEl.getBoundingClientRect();
      const cx = rect.left + (rect.width || 20) / 2;
      const cy = rect.top + (rect.height || 20) / 2;

      const sharedInit = { bubbles: true, cancelable: true, composed: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: 1 };
      try {
        if (typeof PointerEvent !== "undefined") {
          targetEl.dispatchEvent(new PointerEvent("pointerdown", { ...sharedInit, pointerId: 1, pointerType: "touch", isPrimary: true }));
        }
        targetEl.dispatchEvent(new MouseEvent("mousedown", sharedInit));

        if (typeof PointerEvent !== "undefined") {
          targetEl.dispatchEvent(new PointerEvent("pointerup", { ...sharedInit, buttons: 0, pointerId: 1, pointerType: "touch", isPrimary: true }));
        }
        targetEl.dispatchEvent(new MouseEvent("mouseup", { ...sharedInit, buttons: 0 }));
        targetEl.click();
      } catch (_) {
        try { targetEl.click(); } catch (_e) {}
      }

      setTimeout(() => {
        if (captured.has(targetEl) && !excluded.has(targetEl)) {
          targetEl.setAttribute(ATTR_CAPTURED, "hidden");
        }
      }, 80);
    }

    function scanBalls() {
      for (const [el] of captured.entries()) {
        if (!el.isConnected) captured.delete(el);
      }

      // 扫描 document.body 下直接元素
      for (const node of Array.from(document.body.children)) {
        const triggerEl = findTriggerElement(node, false);
        if (triggerEl && !captured.has(triggerEl) && !excluded.has(triggerEl)) {
          const meta = extractMeta(triggerEl, captured.size + 1);
          captured.set(triggerEl, { el: triggerEl, ...meta });
          triggerEl.setAttribute(ATTR_CAPTURED, "hidden");
        }
      }

      // 扫描 phone-screen 下直接元素
      const phoneScreen = document.querySelector('[data-ui="phone-screen"]');
      if (phoneScreen) {
        // 如果挂载了小手机且未监听它，启动监听（不使用子树以防卡顿）
        if (!phoneObserver) {
            phoneObserver = new MutationObserver(debouncedScan);
            phoneObserver.observe(phoneScreen, { childList: true, subtree: false });
        }
        for (const node of Array.from(phoneScreen.children)) {
          const triggerEl = findTriggerElement(node, true);
          if (triggerEl && !captured.has(triggerEl) && !excluded.has(triggerEl)) {
            const meta = extractMeta(triggerEl, captured.size + 1);
            captured.set(triggerEl, { el: triggerEl, ...meta });
            triggerEl.setAttribute(ATTR_CAPTURED, "hidden");
          }
        }
      }

      updateBadge();
      if (isOpen) renderPanel();
    }

    // 节流处理扫描，避免密集操作导致卡顿
    let scanTimer = null;
    const debouncedScan = () => {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = setTimeout(() => scanBalls(), 300);
    };

    function updateBadge() {
      dock.classList.toggle("has-items", captured.size > 0);
    }

    function renderPanel() {
      panel.innerHTML = "";

      const header = document.createElement("div");
      header.className = "dock-header";
      header.innerHTML = `<span>已收纳 (${captured.size})</span>`;

      const rescanBtn = document.createElement("button");
      rescanBtn.className = "dock-rescan-btn";
      rescanBtn.textContent = "刷新重置";
      rescanBtn.title = "清空豁免名单并重新扫描页面";
      rescanBtn.onclick = (e) => {
        e.stopPropagation();
        excluded.clear(); // 清空被还原的球名单
        scanBalls();
      };
      header.appendChild(rescanBtn);
      panel.appendChild(header);

      if (captured.size === 0) {
        const empty = document.createElement("div");
        empty.className = "dock-empty";
        empty.textContent = "暂未发现其他插件悬浮球";
        panel.appendChild(empty);
      } else {
        for (const [el, item] of captured.entries()) {
          const row = document.createElement("div");
          row.className = "dock-item";

          const ico = document.createElement("div");
          ico.className = "dock-item-icon";
          ico.innerHTML = item.iconHTML;

          const txt = document.createElement("div");
          txt.className = "dock-item-title";
          txt.textContent = item.label;
          
          const actionBtn = document.createElement("button");
          actionBtn.className = "dock-item-action";
          actionBtn.textContent = "还原";
          actionBtn.title = "从收纳盒中移出并放回原处";
          actionBtn.onclick = (e) => {
              e.stopPropagation();
              el.removeAttribute(ATTR_CAPTURED);
              excluded.add(el);
              captured.delete(el);
              updateBadge();
              renderPanel();
          };

          row.appendChild(ico);
          row.appendChild(txt);
          row.appendChild(actionBtn);

          row.addEventListener("click", (e) => {
            if(e.target === actionBtn) return;
            e.stopPropagation();
            togglePanel(false);
            triggerPluginAction(item.el);
          });

          panel.appendChild(row);
        }
      }
      placePanel();
    }

    function togglePanel(force) {
      isOpen = typeof force === "boolean" ? force : !isOpen;
      dock.classList.toggle("dock-active", isOpen);
      if (isOpen) {
        scanBalls();
        renderPanel();
        panel.classList.add("dock-open");
        placePanel();
      } else {
        panel.classList.remove("dock-open");
      }
    }

    let pid = null, startX = 0, startY = 0, origTop = 0, moved = false;

    dock.addEventListener("pointerdown", (e) => {
      pid = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      origTop = dock.offsetTop;
      moved = false;
      try { dock.setPointerCapture(pid); } catch (_) {}
      e.preventDefault(); e.stopPropagation();
    });

    dock.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 6) { moved = true; if (isOpen) togglePanel(false); }
      if (moved) {
        const H = window.innerHeight;
        const barH = dock.offsetHeight || 48;
        const nextTop = Math.max(24, Math.min(H - barH - 24, origTop + dy));
        dock.style.top = `${nextTop}px`;
        side = e.clientX < window.innerWidth / 2 ? "left" : "right";
        dock.setAttribute("data-side", side);
      }
    });

    const onPointerEnd = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (moved) {
        topRatio = dock.offsetTop / Math.max(1, window.innerHeight);
        try { ctx.system.storage.set("dockPos", JSON.stringify({ side, topRatio })); } catch (_) {}
        placeDock();
      } else if (e.type === "pointerup") {
        togglePanel();
      }
    };

    dock.addEventListener("pointerup", onPointerEnd);
    dock.addEventListener("pointercancel", onPointerEnd);

    const onDocDown = (e) => {
      if (isOpen && !panel.contains(e.target) && !dock.contains(e.target)) togglePanel(false);
    };
    document.addEventListener("pointerdown", onDocDown, true);
    const onResize = () => placeDock();
    window.addEventListener("resize", onResize);

    applyAppearance();
    placeDock();
    scanBalls();

    // 仅监听直接子元素的变化，抛弃 subtree: true，大幅提升性能
    observer = new MutationObserver(debouncedScan);
    observer.observe(document.body, { childList: true, subtree: false });

    const timer = ctx.system.timers.setInterval(scanBalls, 1800);

    if (ctx.system.settings.onChange) {
      ctx.system.settings.onChange(() => { applyAppearance(); placeDock(); scanBalls(); });
    }

    return () => {
      if (observer) observer.disconnect();
      if (phoneObserver) phoneObserver.disconnect();
      if (scanTimer) clearTimeout(scanTimer);
      clearInterval(timer);
      document.removeEventListener("pointerdown", onDocDown, true);
      window.removeEventListener("resize", onResize);
      for (const [el] of captured.entries()) { el.removeAttribute(ATTR_CAPTURED); }
      for (const el of excluded) { el.removeAttribute(ATTR_CAPTURED); }
      captured.clear();
      excluded.clear();
      dock.remove();
      panel.remove();
    };
  },
};