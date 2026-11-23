export default {
  manifest: {
    id: "input-stash-dial",
    name: "Aether插件",
    author: "山羊",
    apiVersion: 1,
    version: "6.0.0",
    description: "用于输入栏三球、标题栏三球与气泡外中文译文让位；不同会话与设备的实际表现以本机为准。",
    settings: [
      { key: "enabled", label: "启用收纳球与标题栏", type: "boolean", default: true },
      { key: "excludedSessions", label: "额外排除的会话 id（逗号分隔）", type: "text", default: "" },
      { key: "transFit", label: "译文外移后精确让位（长译文/引用条不重叠）", type: "boolean", default: true },
    ],
  },

  setup(ctx) {

    const SIGIL = "qz7c2";
    const ID = "input-stash-dial";
    const TRIGGER = SIGIL + "-trigger";
    const PLACEHOLDER = SIGIL + "-placeholder-ball";
    const READY = "data-" + SIGIL + "-ready";
    const OPEN = "data-" + SIGIL + "-open";
    const TYPING = "data-" + SIGIL + "-typing";
    const HDR = SIGIL + "-header";
    const HDR_BACK = SIGIL + "-hdr-back";
    const HDR_CARD = SIGIL + "-hdr-card";
    const HDR_MORE = SIGIL + "-hdr-more";
    const HDR_AVATAR = SIGIL + "-hdr-avatar";
    const HDR_NAME = SIGIL + "-hdr-name";
    const HDR_LINES = SIGIL + "-hdr-lines";
    const HDR_LINE1 = SIGIL + "-hdr-line1";
    const HDR_LINE2 = SIGIL + "-hdr-line2";
    const HDR_LOC = SIGIL + "-hdr-loc";
    const HDR_DOTS = SIGIL + "-typing-dots";

    const PETRICHOR = "--petrichor-sigil";
    const HMARK = "data-petrichor-h";
    const HVAR = "--trans-h";
    let transRaf = 0;

    let observer = null;
    let disposed = false;
    const unsubs = [];

    const enabled = () => ctx.system.settings.get("enabled") !== false;
    const excluded = () => String(ctx.system.settings.get("excludedSessions") || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const isAssistant = (sid) => !sid || sid === "mascot" || sid.indexOf("mascot") === 0;

    function hasSigil(node) {
      const w = node && node.closest ? node.closest(".chat-room-wrapper") : null;
      if (!w) return false;
      let v = "";
      try { v = getComputedStyle(w).getPropertyValue(PETRICHOR).trim(); } catch (_) {}
      return v !== "" && Number(v) > 0;
    }

    function sessionIdOf(node) {
      const w = node.closest ? node.closest(".chat-room-wrapper") : null;
      if (!w) return null;
      const m = String(w.className || "").match(/session-([\w-]+)/);
      return m ? m[1] : null;
    }

    function isActive(node) {
      const layer = node.closest ? node.closest(".chat-room-layer") : null;
      if (layer && (layer.style.display === "none" || getComputedStyle(layer).display === "none")) return false;
      const app = node.closest ? node.closest(".chat-app") : null;
      if (app && !app.hasAttribute("data-room-active")) return false;
      return true;
    }

    function hasRealInputDOM(bar) {
      const acts = bar.querySelector(".chat-input-actions");
      if (!acts || !bar.querySelector(".chat-input-textarea")) return false;
      return acts.querySelectorAll("button").length >= 3;
    }

    function eligible(bar) {
      const sid = sessionIdOf(bar);
      if (isAssistant(sid)) return false;
      if (excluded().indexOf(sid) !== -1) return false;
      if (!hasSigil(bar)) return false;
      if (!hasRealInputDOM(bar)) return false;
      if (!isActive(bar)) return false;
      return true;
    }

    function ensureTrigger(bar) {
      let t = bar.querySelector("." + TRIGGER);
      if (t) return t;
      t = document.createElement("button");
      t.type = "button";
      t.className = TRIGGER;
      t.setAttribute("aria-label", "展开或收起收纳球");
      t.setAttribute("aria-expanded", "false");
      t.setAttribute("data-chat-plugin", ID);
      t.setAttribute("data-" + SIGIL, "quill-zephyr-7c2");
      const slot = bar.querySelector('.chat-plugin-input-toolbar, [data-chat-plugin-slot="chat.inputToolbar"]');
      (slot || bar).appendChild(t);
      t.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = bar.getAttribute(OPEN) === "1";
        bar.setAttribute(OPEN, open ? "0" : "1");
        t.setAttribute("aria-expanded", String(!open));

        try { ctx.system.storage.set("open:" + (sessionIdOf(bar) || "?"), !open); } catch (_) {}
      });
      return t;
    }

    function ensurePlaceholder(bar) {
      const acts = bar.querySelector(".chat-input-actions");
      if (!acts) return null;

      const offline = !!acts.querySelector('button[aria-label="返回线上模式"]');
      let ph = bar.querySelector("." + PLACEHOLDER);
      if (!offline) { if (ph) ph.remove(); return null; }
      if (ph) return ph;
      ph = document.createElement("div");
      ph.className = PLACEHOLDER;
      ph.setAttribute("aria-hidden", "true");
      ph.setAttribute("data-chat-plugin", ID);
      ph.setAttribute("data-" + SIGIL, "quill-zephyr-7c2");
      bar.appendChild(ph);
      return ph;
    }

    function profileOf(wrapper, sid) {
      let name = "", avatar = "";
      try {
        const s = (ctx.data.sessions.get && ctx.data.sessions.get(sid)) || {};
        const cid = s.contactId || sid;
        const c = (ctx.data.characters.get && ctx.data.characters.get(cid)) || null;
        if (c) {
          name = c.name || "";
          avatar = c.avatar || c.avatarUrl || c.avatarDataUrl || "";
        }
        if (s.alias) name = s.alias;
      } catch (_) {}
      if (!name) {
        const title = wrapper.querySelector(".page-title");
        if (title) {
          let t = "";
          title.childNodes.forEach((n) => { if (n.nodeType === 3) t += n.textContent; });
          name = t.replace(/^线下\s*·\s*/, "").trim();
        }
      }
      if (!avatar) {
        const im = wrapper.querySelector('.chat-msg-wrapper[data-role="assistant"] .chat-msg-avatar img');
        if (im) avatar = im.getAttribute("src") || "";
      }
      return { name: name || "对方", avatar: avatar || "" };
    }

    function buildHeader(el) {
      const root = document.createElement("div");
      root.className = HDR;
      root.setAttribute("data-chat-plugin", ID);
      root.setAttribute("data-" + SIGIL, "quill-zephyr-7c2");

      const back = document.createElement("button");
      back.type = "button";
      back.className = HDR_BACK;
      back.setAttribute("aria-label", "返回");
      back.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const w = root.closest(".chat-room-wrapper");
        const native = w && w.querySelector('.page-header-content > button[aria-label="返回"]');
        if (native) native.click();
      });

      const card = document.createElement("div");
      card.className = HDR_CARD;
      const av = document.createElement("img");
      av.className = HDR_AVATAR;
      av.alt = "";
      av.setAttribute("aria-hidden", "true");

      av.style.setProperty("width", "var(--hdr-avatar, 34px)");
      av.style.setProperty("height", "var(--hdr-avatar, 34px)");
      av.style.setProperty("max-width", "100%");
      av.style.setProperty("object-fit", "cover");
      const lines = document.createElement("div");
      lines.className = HDR_LINES;
      const l1 = document.createElement("div");
      l1.className = HDR_LINE1;
      const nm = document.createElement("span");
      nm.className = HDR_NAME;
      l1.appendChild(nm);
      const l2 = document.createElement("div");
      l2.className = HDR_LINE2;
      const loc = document.createElement("span");
      loc.className = HDR_LOC;
      const dots = document.createElement("span");
      dots.className = HDR_DOTS;
      dots.setAttribute("aria-hidden", "true");
      dots.innerHTML = "<i></i><i></i><i></i>";
      l2.appendChild(loc); l2.appendChild(dots);
      lines.appendChild(l1); lines.appendChild(l2);
      card.appendChild(av); card.appendChild(lines);

      const more = document.createElement("button");
      more.type = "button";
      more.className = HDR_MORE;
      more.setAttribute("aria-label", "更多");
      more.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const w = root.closest(".chat-room-wrapper");
        const native = w && w.querySelector('.page-header-right > button[aria-label="更多"]');
        if (native) native.click();
      });

      root.appendChild(back); root.appendChild(card); root.appendChild(more);
      el.appendChild(root);
      return root;
    }

    function syncHeader(slot) {
      const wrapper = slot.closest(".chat-room-wrapper");
      if (!wrapper) return;
      const sid = sessionIdOf(slot);
      const bar = wrapper.querySelector(".chat-input-bar");
      const ok = sid && !isAssistant(sid) && excluded().indexOf(sid) === -1
        && hasSigil(slot)
        && bar && hasRealInputDOM(bar) && isActive(bar);
      let root = slot.querySelector("." + HDR);
      if (!ok) { if (root) root.remove(); return; }
      if (!root) root = buildHeader(slot);
      const p = profileOf(wrapper, sid);
      const nm = root.querySelector("." + HDR_NAME);
      const av = root.querySelector("." + HDR_AVATAR);
      if (nm && nm.textContent !== p.name) nm.textContent = p.name;
      if (av && av.getAttribute("src") !== p.avatar) {
        if (p.avatar) av.setAttribute("src", p.avatar);
        else av.removeAttribute("src");
      }

      root.setAttribute(TYPING, wrapper.querySelector(".chat-typing-indicator") ? "1" : "0");
    }

    function scanHeaders() {
      document.querySelectorAll(".chat-plugin-header, [data-chat-plugin-slot='chat.header']")
        .forEach((slot) => syncHeader(slot));
    }

    function clearBar(bar) {
      bar.removeAttribute(READY);
      bar.removeAttribute(OPEN);
      const t = bar.querySelector("." + TRIGGER); if (t) t.remove();
      const p = bar.querySelector("." + PLACEHOLDER); if (p) p.remove();
    }

    function scan() {
      if (disposed || !enabled()) { cleanupAll(); return; }
      document.querySelectorAll(".chat-input-bar").forEach((bar) => {
        if (!eligible(bar)) { clearBar(bar); return; }
        if (bar.getAttribute(READY) !== "1") {
          bar.setAttribute(READY, "1");
          bar.setAttribute(OPEN, "0");
        }
        ensureTrigger(bar);
        ensurePlaceholder(bar);
      });
      scanHeaders();
    }

    function cleanupAll() {
      document.querySelectorAll("." + TRIGGER + ", ." + PLACEHOLDER + ", ." + HDR)
        .forEach((el) => el.remove());
      document.querySelectorAll(".chat-input-bar[" + READY + "]")
        .forEach((bar) => { bar.removeAttribute(READY); bar.removeAttribute(OPEN); });
    }

    const transOn = () => ctx.system.settings.get("transFit") !== false;

    function isTransRoom(w) {
      if (!w) return false;
      const sid = sessionIdOf(w);
      if (!sid || isAssistant(sid) || !isActive(w)) return false;
      if (excluded().indexOf(sid) >= 0) return false;
      return hasSigil(w);
    }

    function readNum(w, key, dflt) {
      let v = NaN;
      try { v = parseFloat(getComputedStyle(w).getPropertyValue(key)); } catch (_) {}
      return isFinite(v) && v >= 0 ? v : dflt;
    }

    function transRooms() {
      const out = [];
      document.querySelectorAll(".chat-room-layer").forEach(layer => {
        const w = layer.querySelector(".chat-room-wrapper")
          || layer.closest(".chat-room-wrapper") || layer;
        if (!isTransRoom(w)) return;
        const anchor = w.querySelector(".chat-scroll-anchored");
        if (anchor) out.push([w, anchor]);
      });
      return out;
    }

    function clearTrans() {
      document.querySelectorAll("[" + HMARK + "]").forEach(el => {
        el.style.removeProperty(HVAR);
        el.removeAttribute(HMARK);
      });

      document.querySelectorAll(".chat-scroll-anchored > div").forEach(el => {
        if (el.style && el.style.getPropertyValue(HVAR) !== "") el.style.removeProperty(HVAR);
      });
    }

    function measureTrans(w, anchor) {
      const gap = readNum(w, "--trans-gap", 8);
      const drop = readNum(w, "--trans-drop", 6);
      const maxH = readNum(w, "--trans-h-max", 600);
      const shells = Array.prototype.slice.call(anchor.children).filter(el =>
        el && el.nodeType === 1 && getComputedStyle(el).display !== "none");

      const plans = [];
      shells.forEach((shell, i) => {
        const tr = shell.querySelector(".chat-bilingual-section-translation");
        if (!tr) return;
        const r = tr.getBoundingClientRect();
        if (!r.height && !r.width) return;
        const curPad = parseFloat(getComputedStyle(shell).paddingBottom) || 0;
        const next = shells[i + 1];
        let H;
        if (!next) {

          H = Math.ceil(r.height + drop + gap);
        } else {

          const tops = [];
          const take = (el) => {
            if (!el || el.nodeType !== 1) return;
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") return;
            const b = el.getBoundingClientRect();
            if (b.height > 0 || b.width > 0) tops.push(b.top);
          };
          take(next);
          next.querySelectorAll(
            ".chat-quote-preview, .chat-sys-msg, .chat-bubble-role-user, " +
            ".chat-bubble-role-assistant, .chat-msg-wrapper, .chat-monologue-heart, " +
            ".chat-thought-card, .chat-reasoning-row"
          ).forEach(take);
          const nextTop = tops.length ? Math.min.apply(null, tops) : null;

          H = nextTop === null
            ? Math.ceil(r.height + drop + gap)
            : Math.ceil(curPad - (nextTop - r.bottom));
        }
        H = Math.max(0, Math.min(maxH, H));
        plans.push([shell, H + "px"]);
      });

      const planned = new Set(plans.map(p => p[0]));
      shells.forEach(s => {
        if (!planned.has(s) && s.hasAttribute(HMARK)) {
          s.style.removeProperty(HVAR);
          s.removeAttribute(HMARK);
        }
      });
      plans.forEach(pair => {
        const shell = pair[0], val = pair[1];
        shell.style.setProperty(HVAR, val);
        if (shell.getAttribute(HMARK) !== val) shell.setAttribute(HMARK, val);
      });
    }

    function transScan() {
      if (disposed) return;
      if (!enabled() || !transOn()) { clearTrans(); return; }
      const rooms = transRooms();
      if (!rooms.length) { clearTrans(); return; }

      document.querySelectorAll("[" + HMARK + "]").forEach(el => {
        const w = el.closest(".chat-room-wrapper");
        if (!isTransRoom(w)) {
          el.style.removeProperty(HVAR);
          el.removeAttribute(HMARK);
        }
      });
      rooms.forEach(pair => measureTrans(pair[0], pair[1]));
    }

    function scheduleTrans() {
      if (transRaf) return;
      transRaf = requestAnimationFrame(() => { transRaf = 0; transScan(); });
    }

    unsubs.push(ctx.ui.slot("chat.inputToolbar", () => { scan(); scheduleTrans(); return () => {}; }));
    unsubs.push(ctx.ui.slot("chat.header", (el) => { syncHeader(el); scheduleTrans(); return () => {}; }));
    unsubs.push(ctx.hooks.on("app.ready", () => { scan(); scheduleTrans(); }));
    unsubs.push(ctx.hooks.on("session.opened", () => { scan(); scheduleTrans(); }));
    unsubs.push(ctx.hooks.on("plugins.changed", () => { scan(); scheduleTrans(); }));
    unsubs.push(ctx.system.settings.onChange(() => { scan(); scheduleTrans(); }));

    try {
      observer = new MutationObserver(() => scan());
      observer.observe(document.body, { childList: true, subtree: true, attributes: false });
    } catch (_) {}

    let transObserver = null;
    try {
      transObserver = new MutationObserver(scheduleTrans);
      transObserver.observe(document.body, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["style", "class"]
      });
    } catch (_) {}

    scan();
    scheduleTrans();

    return () => {
      disposed = true;
      if (observer) observer.disconnect();
      if (transObserver) transObserver.disconnect();
      if (transRaf) cancelAnimationFrame(transRaf);
      unsubs.forEach((u) => { try { if (typeof u === "function") u(); } catch (_) {} });
      cleanupAll();
      clearTrans();
    };
  },
};
