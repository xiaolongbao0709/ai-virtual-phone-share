// 多任务切换（App Switcher）· 小手机扩展插件
// 在小手机屏幕底部加一条 Home 横条：
//   · 上滑并停顿 / 慢慢上滑 → 打开多任务后台，左右滑动卡片挑应用
//   · 快速上滑 → 回到桌面
//   · 左右滑动横条 → 直接切回上一个应用
//   · 在后台里把卡片往上甩 → 从后台列表移除
// 安装：聊天 → 我 → 扩展插件 → 导入插件，选择本文件。

const SKIP_IDS = new Set(["vnplay", "vnchapters", "worldbuilder"]);

const BUILTIN = {
  chat: ["聊天", "--c-icon-green"],
  diary: ["手记", "--c-icon-violet"],
  music: ["音乐", "--c-icon-coral"],
  reading: ["阅读", "--c-icon-amber"],
  cocreate: ["共创", "--c-icon-cocreate"],
  story: ["剧情", "--c-icon-story"],
  game: ["游戏", "--c-icon-blue"],
  appmarket: ["应用市场", "--c-icon-teal"],
  xiaohongshu: ["小红书", "--c-icon-rose"],
  checkphone: ["查手机", "--c-icon-slate"],
  dwelling: ["栖所", "--c-icon-rose"],
  shopping: ["购物", "--c-icon-amber"],
  calendar: ["日历", "--c-icon-rose"],
  interview_magazine: ["在场", "--c-icon-lilac"],
  vnmode: ["漫卷", "--c-icon-rose"],
  mapmode: ["冒险", "--c-icon-amber"],
  moments: ["朋友圈", "--c-icon-lilac"],
  group_chat: ["群聊", "--c-icon-teal"],
  realitybridge: ["iOS现实桥", "--c-icon-teal"],
  settings: ["设置", "--c-icon-slate"],
  theme: ["主题", "--c-icon-violet"],
  resources: ["资源库", "--c-icon-teal"],
  resource_hub: ["资源集市", "--c-icon-amber"],
  characters: ["角色", "--c-icon-lilac"],
  qa: ["工坊", "--c-icon-qa"],
  mixology: ["独家特调", "--c-icon-violet"],
};

const CSS = `
.asw-bar{position:absolute;left:50%;transform:translateX(-50%);width:150px;height:26px;bottom:calc(var(--asw-lift,16px) + env(safe-area-inset-bottom,0px));z-index:9990;display:flex;justify-content:center;align-items:center;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;}
.asw-bar[hidden],.asw-ball[hidden]{display:none;}
.asw-pill{width:120px;height:5px;border-radius:99px;background:rgba(20,20,24,.42);box-shadow:0 0 0 1px rgba(255,255,255,.35);transition:transform .15s,background .15s,height .15s;}
.asw-bar.asw-light .asw-pill{background:rgba(255,255,255,.75);box-shadow:0 0 0 1px rgba(0,0,0,.12);}
.asw-bar.asw-armed .asw-pill{height:7px;transform:scaleX(1.15);background:rgba(10,132,255,.85);}
.asw-ball{position:absolute;z-index:9990;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;background:rgba(30,30,36,.62);color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.22),inset 0 0 0 1px rgba(255,255,255,.25);transition:opacity .35s,left .25s cubic-bezier(.2,.8,.2,1),transform .3s cubic-bezier(.2,.8,.2,1);cursor:pointer;}
.asw-ball.asw-light{background:rgba(255,255,255,.82);color:#333;box-shadow:0 4px 14px rgba(0,0,0,.15),inset 0 0 0 1px rgba(0,0,0,.08);}
.asw-ball.asw-tucked{opacity:.55;}
.asw-ball.asw-tucked[data-side="right"]{transform:translateX(30px);}
.asw-ball.asw-tucked[data-side="left"]{transform:translateX(-30px);}
.asw-ball.asw-tucked svg{opacity:0;}
.asw-ball svg{transition:opacity .25s;}
.asw-ball.asw-press{transform:scale(.9);}
.asw-ball.asw-moving{transition:opacity .35s,transform .15s;}
.asw-ball svg{width:22px;height:22px;}
.asw-dragging-ws{transition:none!important;will-change:transform;border-radius:28px;overflow:hidden;}
.asw-settle-ws{transition:transform .28s cubic-bezier(.2,.8,.2,1),border-radius .28s!important;}

.asw-overlay{position:absolute;inset:0;z-index:9995;display:flex;flex-direction:column;justify-content:center;background:rgba(16,16,20,.66);opacity:0;transition:opacity .22s;touch-action:pan-x;-webkit-user-select:none;user-select:none;}
.asw-overlay.asw-show{opacity:1;}
.asw-overlay.asw-solo{background:rgba(16,16,20,.5);transition:opacity .22s,background .2s;}
.asw-strip{display:flex;gap:16px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;padding:0 19%;scrollbar-width:none;-webkit-overflow-scrolling:touch;align-items:center;}
.asw-strip::-webkit-scrollbar{display:none;}
.asw-card{contain:layout style;flex:0 0 62%;scroll-snap-align:center;display:flex;flex-direction:column;gap:8px;transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .25s;touch-action:pan-x;}
/* 只在拖动/补位动画的那一刻才单独提成图层，平时不占显存 */
.asw-card.asw-drag{transition:none;will-change:transform,opacity;}
.asw-card.asw-slide{will-change:transform;}
.asw-head{display:flex;align-items:center;gap:8px;color:#fff;font-size:13px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.35);padding-left:2px;}
.asw-ico{width:26px;height:26px;border-radius:8px;flex:0 0 auto;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700;}
.asw-ico .icon-glyph-box{width:100%!important;height:100%!important;min-width:0!important;margin:0!important;border-radius:inherit!important;}
.asw-ico .desktop-icon-badge{display:none!important;}
.asw-ico svg{width:62%;height:62%;}
.asw-shot{position:relative;width:100%;border-radius:20px;overflow:hidden;contain:layout paint style;background:var(--c-bg, #f4f4f6);box-shadow:0 6px 18px rgba(0,0,0,.26);}
.asw-shot-inner{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none;}
.asw-shot-inner.asw-fade{opacity:0;transition:opacity .18s;}
.asw-shot-inner.asw-fade.asw-in{opacity:1;}
.asw-shot-inner *{animation:none!important;transition:none!important;}
.asw-shot-inner .phone-workspace{margin-top:0!important;height:100%!important;}
.asw-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--c-text, #666);font-size:12px;opacity:.85;}
.asw-empty .asw-ico{width:64px;height:64px;border-radius:18px;font-size:26px;}
.asw-ph{display:flex;align-items:center;justify-content:center;background:rgba(127,127,127,.12);color:rgba(127,127,127,.8);font-size:11px;}
.asw-tip{text-align:center;color:rgba(255,255,255,.85);font-size:13px;margin-top:18px;text-shadow:0 1px 3px rgba(0,0,0,.3);}
.asw-none{text-align:center;color:#fff;font-size:14px;opacity:.9;}
.asw-foot{display:flex;justify-content:center;gap:10px;margin-top:14px;}
.asw-clear{border:0;border-radius:99px;padding:7px 16px;font-size:12px;color:#fff;background:rgba(255,255,255,.18);cursor:pointer;}
`;

export default {
  manifest: {
    id: "app-switcher",
    name: "多任务切换",
    apiVersion: 1,
    version: "1.7.0",
    author: "Claude & fish",
    description: "多任务后台：点悬浮按钮（或按住横条再上滑）打开，左右滑卡片切换应用，上甩卡片关闭。不会与手机系统的回主屏手势冲突。",
    settings: [
      { key: "mode", label: "唤起方式", type: "select", default: "ball",
        options: [
          { value: "ball", label: "悬浮按钮（点一下才打开，不会误触）" },
          { value: "bar", label: "底部横条（需按住约半秒再上滑）" },
          { value: "off", label: "关闭" },
        ] },
      { key: "barOnDesktop", label: "桌面上也显示", type: "boolean", default: true },
      { key: "hideInChat", label: "在聊天应用里隐藏", type: "boolean", default: false },
      { key: "barTone", label: "颜色", type: "select", default: "dark",
        options: [{ value: "dark", label: "深色" }, { value: "light", label: "浅色" }] },
      { key: "lift", label: "横条离屏幕底部的距离（px，避开系统横条）", type: "number", default: 16 },
      { key: "snapshots", label: "后台卡片显示页面预览", type: "boolean", default: true },
      { key: "maxApps", label: "后台最多保留几个应用", type: "number", default: 10 },
    ],
  },

  setup(ctx) {
    // 宿主的 settings.get 每次都会解析整个插件列表，开销很大：一次读出缓存，设置变化时刷新
    let conf = {};
    try { conf = (ctx.system.settings.all && ctx.system.settings.all()) || {}; } catch (_) {}
    const S = (k, d) => { const v = conf[k]; return v === undefined || v === null || v === "" ? d : v; };
    ctx.ui.injectCSS(CSS);

    // ── 状态 ────────────────────────────────────────────
    let recents = [];              // [{ id, t }] 最近使用在前
    const meta = {};               // id → { label }（自定义应用名称持久化）
    const glyphs = new Map();      // id → 从桌面克隆来的图标节点
    const shots = new Map();       // id → { node, w, h, scrolls }
    let shell = null, bar = null, overlay = null, attrObs = null;
    let current = "";
    let destroyed = false;

    try {
      const saved = ctx.system.storage.get("state");
      const obj = typeof saved === "string" ? JSON.parse(saved) : saved;
      if (obj && Array.isArray(obj.recents)) recents = obj.recents.filter(r => r && typeof r.id === "string");
      if (obj && obj.meta) Object.assign(meta, obj.meta);
    } catch (_) {}
    let pendingHome = false, saveTimer = null, hiddenWs = null;
    const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 600); };
    const save = () => { try { ctx.system.storage.set("state", JSON.stringify({ recents, meta })); } catch (_) {} };

    const valid = (id) => !!id && !SKIP_IDS.has(id) && !id.startsWith("folder:") && (id in BUILTIN || id.startsWith("custom_app:"));
    const labelOf = (id) => BUILTIN[id]?.[0] || meta[id]?.label || (id.startsWith("custom_app:") ? "自定义应用" : id);

    // ── 应用切换动作 ─────────────────────────────────────
    const openApp = (id) => window.dispatchEvent(new CustomEvent("open-app", { detail: { appId: id } }));
    const goHome = () => window.dispatchEvent(new CustomEvent("mascot-navigate", { detail: { app: "desktop" } }));

    // ── 记录最近使用 ─────────────────────────────────────
    function touch(id) {
      if (!valid(id)) return;
      recents = [{ id, t: Date.now() }, ...recents.filter(r => r.id !== id)].slice(0, Math.max(2, Number(S("maxApps", 10)) || 10));
      for (const k of [...shots.keys()]) if (!recents.some(r => r.id === k)) shots.delete(k);
      save();
    }

    // 在桌面上收集图标外观与自定义应用名称
    function harvestIcons() {
      if (!shell) return;
      let changed = false;
      shell.querySelectorAll('[data-flip-id^="icon:"]').forEach((btn) => {
        const id = btn.getAttribute("data-flip-id").slice(5);
        if (!valid(id)) return;
        const box = btn.querySelector(".icon-glyph-box");
        if (box) glyphs.set(id, box.cloneNode(true));
        const lbl = btn.querySelector(".icon-label")?.textContent?.trim();
        if (lbl && id.startsWith("custom_app:") && meta[id]?.label !== lbl) { meta[id] = { label: lbl }; changed = true; }
      });
      if (changed) save();
    }

    function iconEl(id) {
      const wrap = document.createElement("div");
      wrap.className = "asw-ico";
      const g = glyphs.get(id);
      if (g) { wrap.appendChild(g.cloneNode(true)); return wrap; }
      const tone = BUILTIN[id]?.[1];
      wrap.style.background = tone ? `var(${tone}, #8a8f99)` : "#8a8f99";
      wrap.textContent = labelOf(id).slice(0, 1);
      return wrap;
    }

    // 记录真正滚动过的元素，快照时只恢复它们的滚动位置（不再遍历全部元素读 scrollTop，避免卡顿）
    const scrolled = new Set();
    const onScroll = (e) => {
      const t = e.target;
      if (!t || t.nodeType !== 1 || scrolled.has(t) || !shell || !shell.contains(t)) return;
      if (scrolled.size > 60) pruneScrolled();
      scrolled.add(t);
    };
    // 清掉已经不在页面上的元素，避免一直攥着旧页面导致内存上涨
    const pruneScrolled = () => { for (const el of scrolled) if (!el.isConnected) scrolled.delete(el); };
    document.addEventListener("scroll", onScroll, true);

    const MAX_PREVIEW_NODES = 1200;  // 预览最多复制多少个元素，超过就只显示图标
    const MAX_SHOTS = 4;

    // ── 页面快照（克隆 DOM，不含 iframe / 视频等会重复运行的东西）─────
    const SKIP_TAGS = new Set(["IFRAME", "VIDEO", "AUDIO", "OBJECT", "EMBED", "SCRIPT", "CANVAS", "NOSCRIPT", "TEMPLATE"]);
    /** 二分查找：有序纵向排列的子元素里，第一个/最后一个落在 [lo, hi] 区间的下标 */
    function visibleRange(kids, lo, hi) {
      const n = kids.length;
      let l = 0, r = n - 1, first = n;
      while (l <= r) { const m = (l + r) >> 1; if (kids[m].getBoundingClientRect().bottom >= lo) { first = m; r = m - 1; } else l = m + 1; }
      l = first; r = n - 1; let last = first - 1;
      while (l <= r) { const m = (l + r) >> 1; if (kids[m].getBoundingClientRect().top <= hi) { last = m; l = m + 1; } else r = m - 1; }
      return first <= last ? [first, last] : null;
    }

    function snapshot() {
      if (!S("snapshots", true) || !shell || !valid(current)) return;
      const ws = shell.querySelector(".phone-workspace");
      if (!ws || !ws.offsetWidth) return;
      try {
        // 1) 找出滚动过的容器；长列表只保留屏幕附近那一段（二分查找，只读几次位置）
        const wr = ws.getBoundingClientRect();
        const lo = wr.top - wr.height * 0.5, hi = wr.bottom + wr.height * 0.5;
        const scrollOf = new Map();   // 原节点 → [scrollTop, scrollLeft]
        const keep = new Map();       // 长列表容器 → { first, last, topGap, botGap }
        for (const el of scrolled) {
          if (!el.isConnected) { scrolled.delete(el); continue; }
          if (!ws.contains(el) || (!el.scrollTop && !el.scrollLeft)) continue;
          scrollOf.set(el, [el.scrollTop, el.scrollLeft]);
          const kids = el.children;
          if (kids.length < 30) continue;
          const range = visibleRange(kids, lo, hi);
          if (!range) continue;
          const [first, last] = range;
          keep.set(el, {
            first, last,
            topGap: kids[first].getBoundingClientRect().top - kids[0].getBoundingClientRect().top,
            botGap: kids[kids.length - 1].getBoundingClientRect().bottom - kids[last].getBoundingClientRect().bottom,
          });
        }
        // 2) 自己走一遍 DOM 树复制，跳过视野外的列表项和 iframe/视频/画布，不动原页面
        let count = 0;
        const scrolls = [];
        const spacer = (h) => { const d = document.createElement("div"); d.style.cssText = `height:${Math.max(0, h)}px;flex:none;`; return d; };
        const copy = (node) => {
          if (node.nodeType === 3) return node.cloneNode(false);
          if (node.nodeType !== 1) return null;
          if (++count > MAX_PREVIEW_NODES) throw new Error("too-big");
          if (SKIP_TAGS.has(node.tagName)) {
            const ph = document.createElement("div");
            ph.className = "asw-ph " + (typeof node.className === "string" ? node.className : "");
            ph.style.cssText = node.style ? node.style.cssText : "";
            if (node.tagName === "IFRAME") { ph.style.width = ph.style.width || "100%"; ph.style.height = ph.style.height || "100%"; ph.textContent = labelOf(current); }
            return ph;
          }
          const c = node.cloneNode(false);
          if (c.removeAttribute) { c.removeAttribute("id"); c.removeAttribute("autofocus"); }
          if (c.tagName === "IMG") {
            // 预览里只保留小图（头像、表情），大图/动图/内嵌 base64 图换成占位块：
            // 否则每张预览都会让手机再解码一遍整张照片，是内存暴涨闪退的主要来源
            const src = node.currentSrc || node.src || "";
            const w = node.offsetWidth, h = node.offsetHeight;
            if (w * h > 80 * 80 || (src.startsWith("data:") && src.length > 8192)) {
              const ph = document.createElement("div");
              ph.className = typeof node.className === "string" ? node.className : "";
              ph.style.cssText = node.style.cssText;
              ph.style.width = w + "px"; ph.style.height = h + "px";
              ph.style.background = "rgba(127,127,127,.18)"; ph.style.borderRadius = ph.style.borderRadius || "8px";
              return ph;
            }
            c.removeAttribute("srcset"); c.decoding = "async";
          } else if (c.style && c.style.backgroundImage && c.style.backgroundImage.length > 8192) {
            c.style.backgroundImage = "none";
          }
          const kids = node.childNodes;
          const k = keep.get(node);
          if (k) {
            c.appendChild(spacer(k.topGap));
            const els = node.children;
            for (let i = k.first; i <= k.last; i++) { const x = copy(els[i]); if (x) c.appendChild(x); }
            c.appendChild(spacer(k.botGap));
          } else {
            for (let i = 0; i < kids.length; i++) { const x = copy(kids[i]); if (x) c.appendChild(x); }
          }
          const sc = scrollOf.get(node);
          if (sc) scrolls.push([c, sc[0], sc[1]]);
          return c;
        };
        let clone;
        try { clone = copy(ws); } catch (err) {
          // 裁剪后仍然太复杂（如 3D 场景、超大表格）→ 不做预览，卡片显示图标
          if (String(err && err.message) === "too-big") { shots.delete(current); return; }
          throw err;
        }
        clone.classList.remove("asw-dragging-ws", "asw-settle-ws");
        clone.style.transform = ""; clone.style.borderRadius = "";
        shots.delete(current);
        shots.set(current, { node: clone, w: ws.offsetWidth, h: ws.offsetHeight, scrolls, t: Date.now() });
        while (shots.size > MAX_SHOTS) shots.delete(shots.keys().next().value);
      } catch (e) { ctx.system.log("snapshot failed", String(e)); }
    }
    let snapTimer = null;
    const scheduleSnap = () => {
      if (snapTimer || !S("snapshots", true)) return;
      // 同一个应用 8 秒内已经截过就不重复截，减少后台工作
      const last = shots.get(current);
      if (last && Date.now() - last.t < 8000) return;
      snapTimer = ctx.system.timers.setTimeout(() => {
        snapTimer = null;
        const run = () => { if (!overlay && !dragging) snapshot(); };
        (window.requestIdleCallback || ((f) => setTimeout(f, 0)))(run);
      }, 2500);
    };

    // ── 多任务后台界面 ───────────────────────────────────
    function openSwitcher() {
      if (!shell || overlay) return;
      // 当前页面的预览放到打开之后再截（后台界面盖在上面，底下页面不变），打开本身不卡
      const needSnap = S("snapshots", true) && valid(current);
      if (!glyphs.size) harvestIcons();
      overlay = document.createElement("div");
      overlay.className = "asw-overlay";
      const list = recents.filter(r => valid(r.id));
      if (!list.length) {
        overlay.innerHTML = '<div class="asw-none">后台还没有应用<br><span style="font-size:12px;opacity:.7">打开几个应用后再来</span></div>';
      } else {
        const strip = document.createElement("div");
        strip.className = "asw-strip";
        const cardH = shell.clientHeight * 0.6;
        list.forEach((r) => strip.appendChild(buildCard(r.id, cardH)));
        overlay.appendChild(strip);
        const foot = document.createElement("div");
        foot.className = "asw-foot";
        const clr = document.createElement("button");
        clr.className = "asw-clear";
        clr.textContent = "全部清除";
        clr.onclick = (e) => { e.stopPropagation(); recents = recents.filter(r => r.id === current); shots.clear(); save(); closeSwitcher(); if (current) goHome(); };
        const home = document.createElement("button");
        home.className = "asw-clear";
        home.textContent = "回到桌面";
        home.onclick = (e) => { e.stopPropagation(); closeSwitcher(); if (current) { snapshot(); goHome(); } };
        foot.appendChild(home);
        foot.appendChild(clr);
        overlay.appendChild(foot);
        const tip = document.createElement("div");
        tip.className = "asw-tip";
        tip.textContent = "点卡片切换 · 上甩卡片关闭 · 点空白返回";
        overlay.appendChild(tip);
      }
      overlay.addEventListener("click", (e) => { if (e.target === overlay || e.target.classList.contains("asw-strip")) closeSwitcher(); });
      shell.appendChild(overlay);
      requestAnimationFrame(() => {
        if (!overlay) return;
        overlay.classList.add("asw-show");
        // 动画结束后，每帧只填一张预览，从最靠前的卡片开始
        const o = overlay;
        setTimeout(() => {
          if (overlay !== o) return;
          if (needSnap) snapshot();
          // 后台界面打开期间，把底下的应用页面设为不绘制（布局保留），
          // 手机就不用一边渲染后台卡片一边重绘底下的聊天等页面，滑动更跟手
          const ws = shell && shell.querySelector(".phone-workspace");
          if (ws && overlay === o) { ws.style.visibility = "hidden"; hiddenWs = ws; o.classList.add("asw-solo"); }
          const queue = [...o.querySelectorAll(".asw-shot")];
          const step = () => {
            if (overlay !== o) return;
            const el = queue.shift();
            if (!el) return;
            if (el._fill) el._fill();
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }, 260);
      });
      if (bar) bar.hidden = true;
    }

    function applyShotScroll(shotEl) {
      const s = shotEl._shot;
      if (!s) return;
      for (const [el, t, l] of s.scrolls) { try { el.scrollTop = t; el.scrollLeft = l; } catch (_) {} }
    }

    function buildCard(id, cardH) {
      const card = document.createElement("div");
      card.className = "asw-card";
      const head = document.createElement("div");
      head.className = "asw-head";
      head.appendChild(iconEl(id));
      const name = document.createElement("span");
      name.textContent = labelOf(id);
      head.appendChild(name);
      card.appendChild(head);

      const shotEl = document.createElement("div");
      shotEl.className = "asw-shot";
      const ratio = shell.clientHeight / Math.max(1, shell.clientWidth);
      shotEl.style.height = Math.round(cardH) + "px";
      shotEl.style.aspectRatio = (1 / ratio).toFixed(4);
      shotEl.style.height = "auto";
      // 先放图标占位，预览稍后由 _fill 填进去
      const empty = document.createElement("div");
      empty.className = "asw-empty";
      empty.appendChild(iconEl(id));
      const t = document.createElement("div");
      t.textContent = labelOf(id);
      empty.appendChild(t);
      shotEl.appendChild(empty);
      shotEl._fill = () => {
        const s = shots.get(id);
        if (!s || !shotEl.isConnected) return;
        const inner = document.createElement("div");
        inner.className = "asw-shot-inner asw-fade";
        inner.inert = true; inner.setAttribute("inert", ""); inner.setAttribute("aria-hidden", "true");
        inner.style.width = s.w + "px";
        inner.style.height = s.h + "px";
        const scale = shotEl.clientWidth / s.w;
        inner.style.transform = `scale(${scale})`;
        inner.style.top = Math.max(0, shotEl.clientHeight - s.h * scale) + "px";
        inner.appendChild(s.node);
        shotEl.appendChild(inner);
        for (const [el, t2, l] of s.scrolls) { try { el.scrollTop = t2; el.scrollLeft = l; } catch (_) {} }
        requestAnimationFrame(() => { inner.classList.add("asw-in"); setTimeout(() => empty.remove(), 200); });
      };
      card.appendChild(shotEl);

      // 点击切换 / 上甩关闭（拖动时每帧只更新一次，且只动 transform/opacity，交给 GPU 合成）
      let sy = 0, sx = 0, dy = 0, pid = null, vertical = null, t0 = 0, frame = 0;
      const paint = () => { frame = 0; card.style.transform = `translate3d(0,${dy}px,0)`; card.style.opacity = String(Math.max(0.2, 1 + dy / 420)); };
      shotEl.addEventListener("pointerdown", (e) => { pid = e.pointerId; sy = e.clientY; sx = e.clientX; dy = 0; vertical = null; t0 = Date.now(); });
      shotEl.addEventListener("pointermove", (e) => {
        if (e.pointerId !== pid) return;
        const ddx = e.clientX - sx, ddy = e.clientY - sy;
        if (vertical === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
          vertical = Math.abs(ddy) > Math.abs(ddx) && ddy < 0;
          if (vertical) { try { shotEl.setPointerCapture(pid); } catch (_) {} card.classList.add("asw-drag"); }
        }
        if (vertical) {
          dy = Math.min(0, ddy);
          if (!frame) frame = requestAnimationFrame(paint);
          e.preventDefault();
        }
      });
      const end = (e) => {
        if (e.pointerId !== pid) return;
        pid = null;
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        card.classList.remove("asw-drag");
        if (vertical) {
          const fast = dy / Math.max(1, Date.now() - t0) < -0.5;
          if (dy < -110 || (fast && dy < -40)) {
            card.style.transform = "translate3d(0,-120%,0)"; card.style.opacity = "0";
            setTimeout(() => removeCard(card, id), 200);
          } else { card.style.transform = ""; card.style.opacity = ""; }
        } else if (vertical === null && e.type === "pointerup") {
          pendingHome = false;
          closeSwitcher();
          if (id !== current) { if (!shots.has(current)) snapshot(); openApp(id); }
        }
      };
      shotEl.addEventListener("pointerup", end);
      shotEl.addEventListener("pointercancel", end);
      return card;
    }

    function removeCard(card, id) {
      // 其余卡片直接按「卡宽 + 间距」平移补位，不读取布局、不改宽度
      const strip = card.parentNode;
      const shift = card.offsetWidth + 16;
      const after = [];
      for (let n = card.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
      card.style.visibility = "hidden";
      requestAnimationFrame(() => {
        card.remove();
        for (const c of after) { c.classList.add("asw-drag"); c.style.transform = `translate3d(${shift}px,0,0)`; }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          for (const c of after) { c.classList.remove("asw-drag"); c.classList.add("asw-slide"); c.style.transform = ""; setTimeout(() => c.classList.remove("asw-slide"), 300); }
        }));
      });
      recents = recents.filter(r => r.id !== id);
      shots.delete(id);
      saveSoon();
      // 删掉的是当前应用：先不回桌面（否则后台界面下面要整页重绘），等关闭后台时再回
      if (id === current) pendingHome = true;
      if (!recents.length) setTimeout(closeSwitcher, 200);
    }

    function closeSwitcher() {
      if (!overlay) return;
      const o = overlay;
      overlay = null;
      if (hiddenWs) { hiddenWs.style.visibility = ""; hiddenWs = null; }
      o.classList.remove("asw-show");
      setTimeout(() => o.remove(), 220);
      if (pendingHome) { pendingHome = false; if (current) goHome(); }
      updateBar();
      if (control && control._wake) control._wake();
    }

    // ── 唤起控件 ───────────────────────────────────
    // 两种方式都刻意避开「从屏幕最底边上滑」——那是手机系统自己的回主屏手势，会一起触发。
    //   · 悬浮按钮：只有「点一下」才打开后台；拖动只会挪位置，永远不会切应用。
    //   · 底部横条：抬高到系统横条上方，而且必须先按住约半秒（横条变蓝）再上滑才生效，
    //     手指只是划过去不会触发。
    let dragging = false;
    let control = null, controlMode = "";
    const HOLD_MS = 450;

    function makeBar() {
      const el = document.createElement("div");
      el.className = "asw-bar";
      el.innerHTML = '<div class="asw-pill"></div>';
      let sx = 0, sy = 0, pid = null, armed = false, holdTimer = null, ws = null;
      const disarm = () => { clearTimeout(holdTimer); holdTimer = null; armed = false; el.classList.remove("asw-armed"); };
      el.addEventListener("pointerdown", (e) => {
        pid = e.pointerId; sx = e.clientX; sy = e.clientY; armed = false;
        try { el.setPointerCapture(pid); } catch (_) {}
        holdTimer = setTimeout(() => {
          armed = true; dragging = true;
          el.classList.add("asw-armed");
          try { navigator.vibrate && navigator.vibrate(10); } catch (_) {}
          ws = current ? shell.querySelector(".phone-workspace") : null;
        }, HOLD_MS);
        e.preventDefault();
      });
      el.addEventListener("pointermove", (e) => {
        if (e.pointerId !== pid) return;
        const dx = e.clientX - sx, dy = sy - e.clientY;
        // 还没按够时间就动了 → 当作划过，直接作废，什么都不做
        if (!armed) { if (Math.abs(dx) > 10 || Math.abs(dy) > 10) { disarm(); pid = null; } return; }
        if (ws && dy > 0) {
          const p = Math.min(1, dy / (shell.clientHeight * 0.6));
          ws.classList.add("asw-dragging-ws");
          ws.style.transform = `translateY(${-dy * 0.5}px) scale(${1 - p * 0.3})`;
        }
      });
      const end = (e) => {
        if (e.pointerId !== pid) { return; }
        const wasArmed = armed;
        const dy = sy - e.clientY;
        pid = null; dragging = false;
        disarm();
        if (ws) {
          const w = ws; ws = null;
          w.classList.remove("asw-dragging-ws"); w.classList.add("asw-settle-ws"); w.style.transform = "";
          setTimeout(() => w.classList.remove("asw-settle-ws"), 300);
        }
        if (!wasArmed || e.type === "pointercancel") return;
        if (dy > 40) openSwitcher();
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      return el;
    }

    function makeBall() {
      const el = document.createElement("div");
      el.className = "asw-ball";
      el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="6" width="11" height="14" rx="2.5"/><path d="M8 3.5h8.5A3 3 0 0 1 19.5 6.5V16"/></svg>';
      let pos = null;
      try { const p = ctx.system.storage.get("ballPos"); pos = typeof p === "string" ? JSON.parse(p) : p; } catch (_) {}
      if (!pos || typeof pos.y !== "number") pos = { side: "right", y: 0.62 };
      // 不用的时候 2.5 秒后自动缩到屏幕边上，只露出一小截
      let idleTimer = null;
      const tuck = () => { if (!overlay && !el.classList.contains("asw-moving")) el.classList.add("asw-tucked"); };
      const wake = () => { el.classList.remove("asw-tucked"); clearTimeout(idleTimer); idleTimer = setTimeout(tuck, 2500); };
      el._wake = wake;
      const place = () => {
        if (!shell) return;
        const W = shell.clientWidth, H = shell.clientHeight, size = 46, m = 6;
        const top = Math.min(H - size - 70, Math.max(60, pos.y * H - size / 2));
        el.style.top = top + "px";
        el.style.left = (pos.side === "left" ? m : W - size - m) + "px";
        el.setAttribute("data-side", pos.side);
      };
      el._place = place;
      let sx = 0, sy = 0, ox = 0, oy = 0, pid = null, moved = false, t0 = 0, wasTucked = false;
      el.addEventListener("pointerdown", (e) => {
        pid = e.pointerId; sx = e.clientX; sy = e.clientY; moved = false; t0 = Date.now();
        wasTucked = el.classList.contains("asw-tucked");
        ox = el.offsetLeft; oy = el.offsetTop;
        try { el.setPointerCapture(pid); } catch (_) {}
        el.classList.add("asw-press"); wake();
        e.preventDefault(); e.stopPropagation();
      });
      el.addEventListener("pointermove", (e) => {
        if (e.pointerId !== pid) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!moved && Math.hypot(dx, dy) > 8) { moved = true; el.classList.add("asw-moving"); el.classList.remove("asw-press"); }
        if (moved) {
          const W = shell.clientWidth, H = shell.clientHeight;
          el.style.left = Math.max(0, Math.min(W - 46, ox + dx)) + "px";
          el.style.top = Math.max(40, Math.min(H - 110, oy + dy)) + "px";
        }
        e.stopPropagation();
      });
      const end = (e) => {
        if (e.pointerId !== pid) return;
        pid = null;
        el.classList.remove("asw-press", "asw-moving");
        e.stopPropagation();
        if (e.type === "pointercancel") { place(); return; }
        if (moved) {
          // 松手吸附到最近的左右边缘，并记住位置
          const W = shell.clientWidth, H = shell.clientHeight;
          pos = { side: el.offsetLeft + 23 < W / 2 ? "left" : "right", y: (el.offsetTop + 23) / H };
          try { ctx.system.storage.set("ballPos", JSON.stringify(pos)); } catch (_) {}
          place();
          return;
        }
        // 缩在边上时点一下只是把它叫出来；弹出来之后再点才打开后台
        if (wasTucked) return;
        // 只有干脆的一下点击才算：没移动、按下时间不超过 0.6 秒
        if (Date.now() - t0 < 600) { overlay ? closeSwitcher() : openSwitcher(); }
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("click", (e) => e.stopPropagation());
      wake();
      return el;
    }

    function updateBar() {
      if (!shell) return;
      const mode = S("mode", "ball");
      if (mode !== controlMode) {
        control && control.remove();
      if (hiddenWs) { hiddenWs.style.visibility = ""; hiddenWs = null; }
        control = mode === "bar" ? makeBar() : mode === "ball" ? makeBall() : null;
        controlMode = mode;
      }
      bar = control;
      if (!control) return;
      if (control.parentNode !== shell) shell.appendChild(control);
      control.classList.toggle("asw-light", S("barTone", "dark") === "light");
      if (mode === "bar") control.style.setProperty("--asw-lift", Math.max(0, Number(S("lift", 16)) || 0) + "px");
      const inChat = current === "chat" || current === "group_chat";
      control.hidden = !!overlay || (!current && !S("barOnDesktop", true)) || (inChat && S("hideInChat", false));
      if (control._place && !control.hidden) control._place();
      if (control._wake && !control.hidden && !control._woke) { control._woke = true; control._wake(); }
    }

    // ── 绑定到小手机屏幕 ─────────────────────────────────
    function onActiveChange() {
      const next = shell.getAttribute("data-active-app") || "";
      if (next === current) return;
      if (overlay) closeSwitcher();
      current = next;
      pruneScrolled();
      if (valid(current)) touch(current);
      if (!current) setTimeout(harvestIcons, 400);
      updateBar();
    }

    function attach() {
      if (destroyed) return;
      const el = document.querySelector('[data-ui="phone-screen"]');
      if (!el) return;
      if (el === shell) { if (!control || control.parentNode !== shell) updateBar(); return; }
      attrObs && attrObs.disconnect();
      shell = el;
      current = "";
      attrObs = new MutationObserver(onActiveChange);
      attrObs.observe(shell, { attributes: true, attributeFilter: ["data-active-app"] });
      onActiveChange();
      harvestIcons();
      updateBar();
    }

    // 1.7 起不再在你点屏幕时偷偷截预览（聊天、发卡片时会跟着卡一下）。
    // 预览只在打开后台、或通过后台切换应用的那一刻截取，平时零开销。
    const onInteract = () => {};
    ctx.system.timers.setInterval(attach, 1000);
    attach();
    ctx.system.settings.onChange && ctx.system.settings.onChange((all) => { if (all && typeof all === "object") conf = { ...all }; updateBar(); });

    return () => {
      destroyed = true;
      document.removeEventListener("scroll", onScroll, true);
      attrObs && attrObs.disconnect();
      control && control.remove();
      if (hiddenWs) { hiddenWs.style.visibility = ""; hiddenWs = null; }
      overlay && overlay.remove();
      shell && shell.querySelectorAll(".asw-dragging-ws,.asw-settle-ws").forEach(w => { w.classList.remove("asw-dragging-ws", "asw-settle-ws"); w.style.transform = ""; });
    };
  },
};
