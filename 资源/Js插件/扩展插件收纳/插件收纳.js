/* ============================================================
 * 插件收纳 · plugin-tray v4.1（apiVersion 1）
 * 「扩展插件」页 → 图标网格（已开启紫 / 未开启灰）+ 长按拖动排序
 *
 * 详情面板位于「被展开图标所在行的正下方」，同行图标不动、其后图标整体下移一行。
 * v4 优化（均对照宿主源码核实）：
 *  1) 只在 .page-menu 命中时工作，去掉 document.body 兜底
 *  2) 早退路径统一全量还原，杜绝"插件列表整页消失"
 *  3) 卡片识别为「开关 + 更新/卸载按钮」多特征，失败写运行日志
 *  4) 父容器混入非插件卡就不接管，退化为宿主原始列表
 *  5) readCfg 缓存 + settings.onChange 失效（settings.get 每次全量解析插件表）
 *  6) pointerId 隔离 + 抓取偏移 + 实时 rect
 *  7) 虚影按 fixed 包含块校准；边缘自动滚动；点空白/Esc 折叠
 *  8) 详情卡位置按视觉索引算行，不再依赖 cards 下标
 *  9) 新增总开关；清理时恢复宿主容器原始内联样式
 * ============================================================ */

const ATTR_HIDDEN = "data-pt-hidden";
const HOST_CLASS = "pt-host";

const CSS = [
  "[data-pt-hidden]{display:none !important;}",
  ".pt-host{display:grid !important;gap:16px 4px !important;align-items:start !important;}",
  ".pt-tilebox{display:contents;}",
  ".pt-tile{display:block;width:100%;min-width:0;box-sizing:border-box;padding:2px 2px 0;background:none;border:0;cursor:pointer;font:inherit;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}",
  ".pt-tile-inner{display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;transition:transform .16s cubic-bezier(.2,.8,.2,1);}",
  ".pt-tile.pt-press .pt-tile-inner{transform:scale(.9);}",
  ".pt-tile.pt-place .pt-tile-inner{opacity:.5;}",
  ".pt-tile.pt-place .pt-ico{background:transparent !important;border:1.5px dashed color-mix(in srgb,var(--pt-c,#94a3b8) 60%,transparent);}",
  ".pt-ico{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:14px;line-height:1;color:var(--pt-c,#94a3b8);background:color-mix(in srgb,var(--pt-c,#94a3b8) 14%,transparent);transition:background .15s ease,color .15s ease,box-shadow .15s ease;}",
  ".pt-ico svg{width:21px;height:21px;display:block;}",
  ".pt-ico img{width:21px;height:21px;object-fit:contain;border-radius:5px;display:block;}",
  ".pt-fallback{font-size:calc(15px*var(--app-text-scale,1));font-weight:600;line-height:1;}",
  ".pt-name{width:100%;font-size:calc(11px*var(--app-text-scale,1));line-height:1.3;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.68;}",
  ".pt-tile.is-on .pt-ico{background:color-mix(in srgb,var(--pt-c,#94a3b8) 26%,transparent);}",
  ".pt-tile.is-on .pt-name{opacity:1;font-weight:600;}",
  ".pt-tile.is-expanded .pt-ico{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--pt-c,#8b5cf6) 62%,transparent);}",
  ".pt-tile:focus-visible .pt-ico{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--pt-c,#8b5cf6) 78%,transparent);}",
  ".pt-ghost{position:fixed;left:0;top:0;pointer-events:none;z-index:2147483000;will-change:transform;transform-origin:0 0;}",
  ".pt-ghost-inner{transition:transform .16s cubic-bezier(.2,.8,.2,1),opacity .18s ease;}",
  ".pt-ghost-inner.pt-raised{transform:scale(1.1);}",
  ".pt-ghost .pt-tile{cursor:grabbing;}",
  ".pt-ghost .pt-ico{box-shadow:0 10px 22px color-mix(in srgb,var(--pt-c,#8b5cf6) 45%,transparent);}",
  ".pt-ghost .pt-name{opacity:1;font-weight:600;}",
].join("\n");

function toInt(v, d) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : d;
}

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

function hexOr(v, d) {
  const s = String(v == null ? "" : v).trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(s) ? s : d;
}

function compact(node) {
  return String(node && node.textContent || "").replace(/\s+/g, "");
}

/** 卡片标题：.menu-label 内首个文本节点是插件名，其后是版本/作者 span */
function labelOf(group) {
  const label = group.querySelector(".menu-item .menu-label");
  if (!label) return "";
  const first = label.firstChild;
  let name = "";
  if (first && first.nodeType === 3) name = String(first.nodeValue || "");
  if (!name.trim()) name = String(label.textContent || "");
  return name.replace(/\s+/g, " ").trim().slice(0, 28);
}

/**
 * 识别一张插件卡：必须有 role=switch 开关，且有「更新」或「卸载」按钮。
 * 安全模式组、导入插件、运行日志、开发文档等菜单组没有开关，天然被排除。
 */
function cardOf(group) {
  if (!group || !group.classList || !group.classList.contains("menu-group")) return null;
  const sw = group.querySelector('button[role="switch"]');
  if (!sw) return null;

  let hasUpdate = false;
  let hasRemove = false;
  const btns = group.querySelectorAll("button");
  for (let i = 0; i < btns.length; i++) {
    const t = compact(btns[i]);
    if (!hasUpdate && t.indexOf("更新") === 0) hasUpdate = true;
    if (!hasRemove && t.indexOf("卸载") >= 0) hasRemove = true;
    if (hasUpdate && hasRemove) break;
  }
  if (!hasUpdate && !hasRemove) return null;

  const aria = sw.getAttribute("aria-checked");
  const enabled = aria === null ? sw.hasAttribute("data-checked") : aria === "true";
  const icon = group.querySelector(".menu-icon svg") || group.querySelector(".menu-icon img");
  return { enabled, icon, name: labelOf(group) };
}

/** 探针：量出 fixed 元素在视口的真实原点与缩放，祖先带 transform 时虚影也不偏 */
function fixedMetrics() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;top:0;width:100px;height:100px;visibility:hidden;pointer-events:none;opacity:0;";
  document.body.appendChild(probe);
  let r = null;
  try { r = probe.getBoundingClientRect(); } catch (e) { r = null; }
  probe.remove();
  const width = r && r.width > 1 ? r.width : 100;
  const scale = width / 100;
  return { offX: r ? (r.left || 0) : 0, offY: r ? (r.top || 0) : 0, scale: scale > 0 ? scale : 1 };
}

export default {
  manifest: {
    id: "plugin-tray",
    name: "插件收纳",
    apiVersion: 1,
    version: "4.1.0",
    author: "小坊",
    description: "「扩展插件」页收成图标网格：已开启紫色、未开启灰色，长按可拖动排序",
    permissions: ["ui", "storage"],
    settings: [
      { key: "enabled", label: "启用收纳视图", type: "boolean", default: true, description: "关闭后恢复宿主原始插件列表" },
      { key: "columns", label: "每行列数", type: "number", default: 4, description: "可用 2~6，超出按边界取值" },
      { key: "showName", label: "图标下方显示插件名", type: "boolean", default: true },
      { key: "minItems", label: "插件数达到才收纳", type: "number", default: 2, description: "少于该数量时保持原始列表" },
      { key: "dragEnabled", label: "长按拖动排序", type: "boolean", default: true },
      { key: "longPressMs", label: "长按判定时长（毫秒）", type: "number", default: 400, description: "可用 150~2000" },
      { key: "haptics", label: "拖动时轻微震动", type: "boolean", default: true },
      { key: "onColor", label: "已开启图标颜色", type: "text", default: "#8b5cf6", description: "十六进制色值，如 #8b5cf6" },
      { key: "offColor", label: "未开启图标颜色", type: "text", default: "#94a3b8", description: "十六进制色值，如 #94a3b8" },
    ],
  },

  setup(ctx) {
    const settings = ctx.system.settings;
    ctx.ui.injectCSS(CSS);

    const notes = new Set();
    let cfgCache = null;
    let scheduleApply = () => {};

    function note(key, msg) {
      if (notes.has(key)) return;
      notes.add(key);
      try { ctx.system.log("plugin-tray：" + msg); } catch (e) { /* ignore */ }
    }

    /* settings.get 每次都会全量 JSON.parse 插件表，读一次就缓存，变更时失效 */
    function readCfg() {
      if (cfgCache) return cfgCache;
      const rawOn = settings.get("onColor");
      const rawOff = settings.get("offColor");
      if (rawOn != null && String(rawOn).trim() && hexOr(rawOn, "") === "") {
        note("onColor", "已开启颜色「" + rawOn + "」不是十六进制色值，已回退默认 #8b5cf6");
      }
      if (rawOff != null && String(rawOff).trim() && hexOr(rawOff, "") === "") {
        note("offColor", "未开启颜色「" + rawOff + "」不是十六进制色值，已回退默认 #94a3b8");
      }
      cfgCache = {
        enabled: settings.get("enabled") !== false,
        columns: clamp(toInt(settings.get("columns"), 4), 2, 6),
        showName: settings.get("showName") !== false,
        minItems: clamp(toInt(settings.get("minItems"), 2), 1, 99),
        dragEnabled: settings.get("dragEnabled") !== false,
        longPressMs: clamp(toInt(settings.get("longPressMs"), 400), 150, 2000),
        haptics: settings.get("haptics") !== false,
        onColor: hexOr(rawOn, "#8b5cf6"),
        offColor: hexOr(rawOff, "#94a3b8"),
      };
      return cfgCache;
    }

    const requestApply = () => { try { scheduleApply(); } catch (e) { /* ignore */ } };
    const offSettings = settings.onChange(() => { cfgCache = null; requestApply(); });
    const offPlugins = ctx.hooks.on("plugins.changed", () => { cfgCache = null; requestApply(); });

    ctx.ui.slot("settings.section", (el) => {
      if (!el) return;

      let dead = false;
      let debounce = 0;
      let watchdog = null;
      let mo = null;
      let drag = null;
      let rafId = 0;
      let scrollBlocker = null;
      let suppressUntil = 0;

      let builtSig = "";
      let expanded = null;
      let expandedEl = null;
      let hostEl = null;
      let hostBackup = null;

      let orderArr = [];
      try {
        const saved = ctx.system.storage.get("order");
        if (Array.isArray(saved)) orderArr = saved.filter(k => typeof k === "string");
      } catch (e) { orderArr = []; }

      const tileByKey = new Map();
      const tileBox = document.createElement("div");
      tileBox.className = "pt-tilebox";

      /* ── 基础 ── */

      function rootOf() {
        const pageRoot = el.closest(".page-menu");
        return pageRoot && pageRoot.isConnected ? pageRoot : null;
      }

      function buzz(cfg, ms) {
        if (!cfg.haptics) return;
        try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
      }

      function persistOrder() {
        try { ctx.system.storage.set("order", orderArr.slice()); } catch (e) { /* ignore */ }
      }

      /* ── 采集 / 还原 ── */

      function collect(root) {
        const groups = root.querySelectorAll(".menu-group");
        const out = [];
        const seen = new Set();
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          if (!g.isConnected) continue;
          const info = cardOf(g);
          if (!info) continue;
          let key = info.name || "未命名插件";
          if (seen.has(key)) {
            let n = 2;
            while (seen.has(key + " (" + n + ")")) n++;
            key = key + " (" + n + ")";
          }
          seen.add(key);
          out.push({ el: g, key, label: info.name || "未命名插件", icon: info.icon, enabled: info.enabled });
        }
        return out;
      }

      /** 全量还原宿主卡片：任何早退路径都必须走这里 */
      function restoreAll(root) {
        expandedEl = null;
        if (!root) return;
        const hidden = root.querySelectorAll("[" + ATTR_HIDDEN + "]");
        for (let i = 0; i < hidden.length; i++) hidden[i].removeAttribute(ATTR_HIDDEN);
        const groups = root.querySelectorAll(".menu-group");
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          if (g.style.order) g.style.removeProperty("order");
          if (g.style.gridColumn) g.style.removeProperty("grid-column");
        }
      }

      function releaseHost() {
        const host = hostEl;
        hostEl = null;
        if (host) {
          try { host.classList.remove(HOST_CLASS); } catch (e) { /* ignore */ }
          try {
            if (hostBackup) {
              host.style.display = hostBackup.display;
              host.style.gap = hostBackup.gap;
              host.style.gridTemplateColumns = hostBackup.gtc;
            }
          } catch (e) { /* ignore */ }
        }
        hostBackup = null;
        try { if (tileBox.parentElement) tileBox.remove(); } catch (e) { /* ignore */ }
        tileByKey.clear();
      }

      /** 父容器必须是「纯插件卡容器」，混入标题/说明就不接管 */
      function hostCandidate(cards, root) {
        const parent = cards[0].el.parentElement;
        if (!parent || !root.contains(parent)) return null;
        const set = new Set(cards.map(it => it.el));
        const children = parent.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child === tileBox) continue;
          if (!set.has(child)) return null;
        }
        return parent;
      }

      /* ── 渲染 ── */

      function buildTiles(cards, cfg) {
        const frag = document.createDocumentFragment();
        tileByKey.clear();
        cards.forEach((it, i) => {
          const color = it.enabled ? cfg.onColor : cfg.offColor;
          const tile = document.createElement("div");
          tile.className = "pt-tile" + (it.enabled ? " is-on" : "");
          tile.style.order = String(i * 10);
          tile.style.setProperty("--pt-c", color);
          tile.setAttribute("role", "button");
          tile.setAttribute("tabindex", "0");
          tile.setAttribute("aria-label", it.label);
          tile.setAttribute("aria-pressed", expanded === it.key ? "true" : "false");
          tile.setAttribute("data-pt-key", it.key);
          tile.title = it.label;

          const inner = document.createElement("div");
          inner.className = "pt-tile-inner";

          const ico = document.createElement("div");
          ico.className = "pt-ico";
          if (it.icon && it.icon.tagName === "IMG") {
            const img = document.createElement("img");
            img.alt = "";
            img.src = it.icon.getAttribute("src") || "";
            ico.appendChild(img);
          } else if (it.icon) {
            try { ico.appendChild(it.icon.cloneNode(true)); } catch (e) { /* ignore */ }
          }
          if (!ico.firstChild) {
            const fb = document.createElement("span");
            fb.className = "pt-fallback";
            fb.textContent = it.label.slice(0, 1);
            ico.appendChild(fb);
          }
          inner.appendChild(ico);

          if (cfg.showName) {
            const nm = document.createElement("div");
            nm.className = "pt-name";
            nm.textContent = it.label;
            inner.appendChild(nm);
          }

          tile.appendChild(inner);
          bindTile(tile, it);
          frag.appendChild(tile);
          tileByKey.set(it.key, tile);
        });
        tileBox.replaceChildren(frag);
      }

      function applyOrder(cards) {
        cards.forEach((it, i) => {
          const tile = tileByKey.get(it.key);
          if (!tile) return;
          const v = String(i * 10);
          if (tile.style.order !== v) tile.style.order = v;
        });
      }

      /**
       * 详情面板放在「被展开图标所在行的正下方」。
       * order 取「该行最后一格之后」的插值：(row*cols + cols - 1) * 10 + 5。
       * 以 4 列、点第 1 行为例：图标 0/10/20/30，面板 35 —— 落在第一行之后、
       * 第二行之前，同行图标不动，仅其后图标整体下移一行。
       * 行号用视觉索引 orderArr.indexOf 算，不能用 cards 下标（顺序未必同步）。
       */
      function applyExpanded(cards, cols) {
        expandedEl = null;
        const vis = expanded ? orderArr.indexOf(expanded) : -1;
        const row = vis >= 0 ? Math.floor(vis / cols) : -1;
        const ord = row >= 0 ? String((row * cols + cols - 1) * 10 + 5) : "";

        cards.forEach((it) => {
          const tile = tileByKey.get(it.key);
          if (tile) {
            tile.classList.toggle("is-expanded", it.key === expanded);
            const pressed = expanded === it.key ? "true" : "false";
            if (tile.getAttribute("aria-pressed") !== pressed) tile.setAttribute("aria-pressed", pressed);
          }
          const node = it.el;
          if (row >= 0 && it.key === expanded) {
            expandedEl = node;
            if (node.hasAttribute(ATTR_HIDDEN)) node.removeAttribute(ATTR_HIDDEN);
            if (node.style.order !== ord) node.style.order = ord;
            if (node.style.gridColumn !== "1 / -1") node.style.gridColumn = "1 / -1";
          } else {
            if (!node.hasAttribute(ATTR_HIDDEN)) node.setAttribute(ATTR_HIDDEN, "1");
            if (node.style.order) node.style.removeProperty("order");
            if (node.style.gridColumn) node.style.removeProperty("grid-column");
          }
        });
      }

      function render() {
        const root = rootOf();
        if (!root) return;
        const cfg = readCfg();

        const bail = () => { restoreAll(root); releaseHost(); builtSig = ""; };

        if (!cfg.enabled) { bail(); return; }

        const cards = collect(root);
        if (cards.length < cfg.minItems) { bail(); return; }

        const parent = hostCandidate(cards, root);
        if (!parent) {
          bail();
          note("host", "未识别到纯插件卡容器，已保持宿主原始列表（宿主结构可能已变化）");
          return;
        }

        const keys = cards.map(it => it.key);
        const kept = orderArr.filter(k => keys.indexOf(k) !== -1);
        const added = keys.filter(k => orderArr.indexOf(k) === -1);
        if (kept.length !== orderArr.length || added.length) {
          orderArr = kept.concat(added);
          persistOrder();
        }
        const pos = new Map();
        orderArr.forEach((k, i) => pos.set(k, i));
        cards.sort((a, b) => (pos.has(a.key) ? pos.get(a.key) : 1e9) - (pos.has(b.key) ? pos.get(b.key) : 1e9));

        if (expanded && keys.indexOf(expanded) === -1) expanded = null;

        if (hostEl !== parent) {
          releaseHost();
          hostEl = parent;
          hostBackup = { display: parent.style.display, gap: parent.style.gap, gtc: parent.style.gridTemplateColumns };
          parent.classList.add(HOST_CLASS);
          parent.appendChild(tileBox);
          builtSig = "";
        } else if (tileBox.parentElement !== hostEl) {
          hostEl.appendChild(tileBox);
          builtSig = "";
        }

        const colsCss = "repeat(" + cfg.columns + ", minmax(0, 1fr))";
        if (hostEl.style.gridTemplateColumns !== colsCss) hostEl.style.gridTemplateColumns = colsCss;

        const sig = cards.map(it => it.key + (it.enabled ? "#1" : "#0")).join("~")
          + "|" + cfg.columns + "|" + (cfg.showName ? 1 : 0) + "|" + cfg.onColor + "|" + cfg.offColor;
        if (sig !== builtSig) {
          builtSig = sig;
          buildTiles(cards, cfg);
        }

        applyOrder(cards);
        applyExpanded(cards, cfg.columns);
      }

      /* ── 观察器 ── */

      function onMutations(records) {
        if (dead || drag) return;
        for (let i = 0; i < records.length; i++) {
          const t = records[i].target;
          if (t && t.nodeType === 1 && tileBox.contains(t)) continue;
          schedule();
          return;
        }
      }

      function bindObserver() {
        if (dead || mo) return;
        const root = rootOf();
        if (!root) return;
        try {
          const obs = new MutationObserver(onMutations);
          obs.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["aria-checked", "data-checked", "class"],
          });
          mo = obs;
        } catch (e) {
          mo = null;
        }
      }

      function unbindObserver() {
        if (!mo) return;
        try { mo.disconnect(); } catch (e) { /* ignore */ }
        mo = null;
      }

      function apply() {
        if (dead || drag) return;
        unbindObserver();
        try {
          render();
        } catch (e) {
          try { ctx.system.log("收纳渲染失败：" + (e && e.message ? e.message : e)); } catch (e2) { /* ignore */ }
        } finally {
          bindObserver();
        }
      }

      function schedule() {
        if (dead || debounce) return;
        debounce = window.setTimeout(() => { debounce = 0; apply(); }, 80);
      }
      scheduleApply = schedule;

      /* ── 滚动 ── */

      function findScroller(node) {
        let n = node.parentElement;
        while (n && n !== document.body && n !== document.documentElement) {
          try {
            const s = window.getComputedStyle(n);
            if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 4) return n;
          } catch (e) { /* ignore */ }
          n = n.parentElement;
        }
        const se = document.scrollingElement;
        return se && se.scrollHeight > se.clientHeight + 4 ? se : null;
      }

      function blockScroll(on) {
        if (on) {
          if (scrollBlocker) return;
          scrollBlocker = (ev) => { if (drag && drag.active && ev.cancelable) ev.preventDefault(); };
          document.addEventListener("touchmove", scrollBlocker, { passive: false });
        } else if (scrollBlocker) {
          document.removeEventListener("touchmove", scrollBlocker);
          scrollBlocker = null;
        }
      }

      /* ── 拖动 ── */

      function dropGhost(st) {
        if (st && st.ghost && st.ghost.parentElement) st.ghost.remove();
      }

      function makeGhost(tile, rect, metrics) {
        const s = metrics.scale || 1;
        const ghost = document.createElement("div");
        ghost.className = "pt-ghost";
        ghost.style.left = ((rect.left - metrics.offX) / s) + "px";
        ghost.style.top = ((rect.top - metrics.offY) / s) + "px";
        ghost.style.width = (rect.width / s) + "px";

        const shell = document.createElement("div");
        shell.className = "pt-ghost-inner";
        shell.style.width = "100%";

        const clone = tile.cloneNode(true);
        clone.classList.remove("pt-place", "pt-press", "is-expanded");
        clone.removeAttribute("data-pt-key");
        clone.removeAttribute("tabindex");
        shell.appendChild(clone);
        ghost.appendChild(shell);
        document.body.appendChild(ghost);

        if (s !== 1) ghost.style.transform = "scale(" + (1 / s) + ")";
        requestAnimationFrame(() => { if (shell.isConnected) shell.classList.add("pt-raised"); });
        return { ghost, shell };
      }

      /** 按「视觉顺序」遍历（orderArr 才是屏幕上的顺序） */
      function insertIndexFor(cx, cy, dragKey) {
        const rest = orderArr.filter(k => k !== dragKey);
        for (let i = 0; i < rest.length; i++) {
          const node = tileByKey.get(rest[i]);
          if (!node || !node.isConnected) continue;
          const r = node.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          const tol = r.height * 0.35;
          const my = r.top + r.height / 2;
          const mx = r.left + r.width / 2;
          if (cy < my - tol) return i;
          if (Math.abs(cy - my) <= tol && cx < mx) return i;
        }
        return rest.length;
      }

      function measure() {
        const m = new Map();
        tileByKey.forEach((node, key) => {
          if (node && node.isConnected) m.set(key, node.getBoundingClientRect());
        });
        return m;
      }

      function flip(before) {
        tileByKey.forEach((node, key) => {
          if (!node || !node.isConnected) return;
          const inner = node.firstElementChild;
          const b = before.get(key);
          if (!inner || !b) return;
          const a = node.getBoundingClientRect();
          const dx = b.left - a.left;
          const dy = b.top - a.top;
          if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
          try {
            inner.animate(
              [{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "translate(0px,0px)" }],
              { duration: 190, easing: "cubic-bezier(.2,.8,.2,1)" }
            );
          } catch (e) { /* ignore */ }
        });
      }

      function applyOrderNow() {
        orderArr.forEach((k, i) => {
          const node = tileByKey.get(k);
          if (!node) return;
          const v = String(i * 10);
          if (node.style.order !== v) node.style.order = v;
        });
      }

      function tryReorder(px, py) {
        const st = drag;
        if (!st || !st.active) return;
        const cx = (px - st.grabX) + st.w / 2;
        const cy = (py - st.grabY) + st.h / 2;
        const insert = insertIndexFor(cx, cy, st.key);
        const rest = orderArr.filter(k => k !== st.key);
        const next = rest.slice();
        next.splice(Math.max(0, Math.min(rest.length, insert)), 0, st.key);
        if (next.join("\u0001") === orderArr.join("\u0001")) return;

        const before = measure();
        orderArr = next;
        applyOrderNow();
        flip(before);
        if (st.lastIndex !== insert) {
          st.lastIndex = insert;
          buzz(st.cfg, 8);
        }
      }

      function startAutoScroll(st) {
        if (rafId || !st || !st.scroller || dead) return;
        const loop = () => {
          rafId = 0;
          const cur = drag;
          if (dead || !cur || !cur.active || cur !== st) return;
          const sc = st.scroller;
          let top = 0;
          let bottom = window.innerHeight;
          if (sc !== document.scrollingElement) {
            const r = sc.getBoundingClientRect();
            top = r.top;
            bottom = r.bottom;
          }
          const edge = Math.min(96, Math.max(48, (bottom - top) * 0.18));
          let step = 0;
          if (st.lastY < top + edge) step = -Math.ceil(((top + edge) - st.lastY) / 3);
          else if (st.lastY > bottom - edge) step = Math.ceil((st.lastY - (bottom - edge)) / 3);
          if (step) {
            const prev = sc.scrollTop;
            sc.scrollTop = prev + step;
            if (sc.scrollTop !== prev) {
              /* 页面滚过后缓存的按下坐标失效，按实时 rect 重新对位 */
              const r = st.tile.getBoundingClientRect();
              if (r.width) {
                st.rect = r;
                st.w = r.width;
                st.h = r.height;
                st.grabX = Math.max(0, Math.min(r.width, st.lastX - r.left));
                st.grabY = Math.max(0, Math.min(r.height, st.lastY - r.top));
              }
              tryReorder(st.lastX, st.lastY);
            }
          }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      }

      function stopAutoScroll() {
        if (rafId) {
          try { cancelAnimationFrame(rafId); } catch (e) { /* ignore */ }
          rafId = 0;
        }
      }

      function cancelPending() {
        const st = drag;
        if (!st) return;
        drag = null;
        if (st.timer) { clearTimeout(st.timer); st.timer = 0; }
        if (st.tile) st.tile.classList.remove("pt-press");
        dropGhost(st);
      }

      function endDrag() {
        const st = drag;
        if (!st) return;
        drag = null;
        if (st.timer) { clearTimeout(st.timer); st.timer = 0; }
        stopAutoScroll();
        blockScroll(false);
        if (st.tile) st.tile.classList.remove("pt-press", "pt-place");

        if (!st.active) { dropGhost(st); return; }

        suppressUntil = Date.now() + 450;
        persistOrder();
        buzz(st.cfg, 12);

        const target = tileByKey.get(st.key);
        if (st.ghost && target && target.isConnected) {
          const r = target.getBoundingClientRect();
          const s = st.metrics.scale || 1;
          if (st.shell) st.shell.classList.remove("pt-raised");
          const ghost = st.ghost;
          const base = s !== 1 ? "scale(" + (1 / s) + ") " : "";
          ghost.style.transition = "transform .18s cubic-bezier(.2,.8,.2,1),opacity .18s ease";
          ghost.style.transform = base
            + "translate3d(" + ((r.left - st.rect.left) / s) + "px," + ((r.top - st.rect.top) / s) + "px,0)";
          window.setTimeout(() => { if (ghost.isConnected) ghost.style.opacity = "0"; }, 150);
          window.setTimeout(() => { if (ghost.parentElement) ghost.remove(); }, 420);
        } else {
          dropGhost(st);
        }
        apply();
      }

      function onTileDown(e, it) {
        if (dead) return;
        if (e.isPrimary === false) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        if (Date.now() < suppressUntil) return;
        if (drag) endDrag();

        const tile = e.currentTarget;
        if (!tile) return;
        const cfg = readCfg();
        if (!cfg.enabled || !cfg.dragEnabled) return;

        const rect = tile.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const metrics = fixedMetrics();

        const st = {
          key: it.key,
          tile,
          cfg,
          metrics,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          lastX: e.clientX,
          lastY: e.clientY,
          grabX: e.clientX - rect.left,
          grabY: e.clientY - rect.top,
          w: rect.width,
          h: rect.height,
          rect,
          scroller: findScroller(tile),
          active: false,
          lastIndex: -1,
          timer: 0,
          ghost: null,
          shell: null,
        };

        st.timer = window.setTimeout(() => {
          st.timer = 0;
          if (drag !== st || dead) return;
          st.active = true;
          tile.classList.remove("pt-press");
          tile.classList.add("pt-place");
          const made = makeGhost(tile, rect, metrics);
          st.ghost = made.ghost;
          st.shell = made.shell;
          st.lastIndex = orderArr.indexOf(st.key);
          blockScroll(true);
          startAutoScroll(st);
          buzz(cfg, 14);
        }, cfg.longPressMs);

        drag = st;
        tile.classList.add("pt-press");
      }

      function revealExpanded() {
        if (!expandedEl || !expandedEl.isConnected) return;
        try {
          expandedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
        } catch (e) {
          try { expandedEl.scrollIntoView(); } catch (e2) { /* ignore */ }
        }
      }

      function onTileClick(e, it) {
        e.preventDefault();
        e.stopPropagation();
        if (Date.now() < suppressUntil) return;
        expanded = expanded === it.key ? null : it.key;
        apply();
        if (expanded) revealExpanded();
      }

      function onTileKey(e, it) {
        if (e.key !== "Enter" && e.key !== " " && e.key !== "Spacebar") return;
        e.preventDefault();
        e.stopPropagation();
        if (Date.now() < suppressUntil) return;
        expanded = expanded === it.key ? null : it.key;
        apply();
        if (expanded) revealExpanded();
      }

      function bindTile(tile, it) {
        tile.addEventListener("pointerdown", (e) => onTileDown(e, it));
        tile.addEventListener("click", (e) => onTileClick(e, it));
        tile.addEventListener("keydown", (e) => onTileKey(e, it));
      }

      function onPointerMove(e) {
        const st = drag;
        if (!st) return;
        if (e.pointerId !== st.pointerId) return;
        st.lastX = e.clientX;
        st.lastY = e.clientY;

        if (!st.active) {
          const dx = e.clientX - st.startX;
          const dy = e.clientY - st.startY;
          if (dx * dx + dy * dy > 100) cancelPending();
          return;
        }
        if (e.cancelable) e.preventDefault();
        if (st.ghost) {
          const s = st.metrics.scale || 1;
          const base = s !== 1 ? "scale(" + (1 / s) + ") " : "";
          st.ghost.style.transform = base
            + "translate3d(" + ((e.clientX - st.startX) / s) + "px," + ((e.clientY - st.startY) / s) + "px,0)";
        }
        tryReorder(e.clientX, e.clientY);
      }

      function onPointerUp(e) {
        const st = drag;
        if (!st) return;
        if (e.pointerId !== st.pointerId) return;
        if (st.active) endDrag();
        else cancelPending();
      }

      function onContextMenu(e) {
        if (drag && drag.active) e.preventDefault();
      }

      /** 点空白 / Esc 折叠；tile 与展开卡片内部不折叠 */
      function onDocPointerDown(e) {
        if (dead || !expanded) return;
        const t = e.target;
        if (!t || t.nodeType !== 1) return;
        if (tileBox.contains(t)) return;
        if (expandedEl && expandedEl.contains(t)) return;
        expanded = null;
        apply();
      }

      function onKeyDown(e) {
        if (e.key === "Escape" && expanded) {
          expanded = null;
          apply();
        }
      }

      document.addEventListener("pointermove", onPointerMove, { passive: false });
      document.addEventListener("pointerup", onPointerUp, true);
      document.addEventListener("pointercancel", onPointerUp, true);
      document.addEventListener("pointerdown", onDocPointerDown, true);
      document.addEventListener("keydown", onKeyDown);
      tileBox.addEventListener("contextmenu", onContextMenu);

      /* ── 启动 ── */

      apply();
      [60, 240, 700, 1500].forEach((ms) => {
        ctx.system.timers.setTimeout(() => { if (!dead && !drag) apply(); }, ms);
      });
      watchdog = ctx.system.timers.setInterval(() => {
        if (dead || drag) return;
        if (!el.isConnected) return;
        apply();
      }, 1000);

      return () => {
        dead = true;
        scheduleApply = () => {};
        if (debounce) { clearTimeout(debounce); debounce = 0; }
        cancelPending();
        stopAutoScroll();
        blockScroll(false);
        if (watchdog) { try { watchdog(); } catch (e) { /* ignore */ } watchdog = null; }
        unbindObserver();
        document.removeEventListener("pointermove", onPointerMove, { passive: false });
        document.removeEventListener("pointerup", onPointerUp, true);
        document.removeEventListener("pointercancel", onPointerUp, true);
        document.removeEventListener("pointerdown", onDocPointerDown, true);
        document.removeEventListener("keydown", onKeyDown);
        tileBox.removeEventListener("contextmenu", onContextMenu);
        try { document.querySelectorAll(".pt-ghost").forEach(n => n.remove()); } catch (e) { /* ignore */ }
        restoreAll(rootOf());
        releaseHost();
        el.replaceChildren();
      };
    });

    return () => {
      try { offSettings(); } catch (e) { /* ignore */ }
      try { offPlugins(); } catch (e) { /* ignore */ }
    };
  },
};
