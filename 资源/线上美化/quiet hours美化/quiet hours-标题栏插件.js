export default {
  manifest: {
    id: "a2-titlebar-header",
    name: "quiet hours-标题栏",
    apiVersion: 1,
    version: "7.0.0",
    author: "山羊",
    description: "自动抓取双方头像填入标题栏双圆，想自定义再上传左图/右图（上传优先）；回复时冒三点气泡。",
    permissions: ["ui", "storage", "chat.read"],
    settings: [
      { key: "autoAvatar", label: "自动抓取双方头像（抓不到可手动上传）", type: "boolean", default: true },
      { key: "swapSides", label: "左右两张图对调", type: "boolean", default: false },
      { key: "showBubble", label: "对方回复时显示小气泡", type: "boolean", default: true },
    ],
  },
  setup(ctx) {
    const MARK = "data-a2-hdr";
    const FLAG = "--a2-hdr-active";
    const K_LEFT = "img_left:";
    const K_RIGHT = "img_right:";
    const SELF_DB = "AiPhoneKvDB";
    const SELF_STORE = "entries";
    const SELF_KEY = "ai_phone_user_identities_v1";
    const sidOf = (w) => (String(w.className).match(/\bsession-([^\s]+)\b/) || [])[1] || "";
    const wrappers = () => [...document.querySelectorAll(".chat-room-layer .chat-room-wrapper")];
    const headerOf = (w) => w.querySelector(":scope > .page-header");
    const cssOnDom = (header) => {
      try { return getComputedStyle(header).getPropertyValue(FLAG).trim() === "1"; }
      catch (e) { return false; }
    };
    const cssOnSession = (sid) => {
      try {
        const s = ctx.data.sessions.get(sid);
        return !!(s && typeof s.customCSS === "string" && s.customCSS.indexOf(FLAG) !== -1);
      } catch (e) { return false; }
    };
    const isTarget = (w, sid, header) => cssOnDom(header) && cssOnSession(sid);
    const setImg = (w, name, src) => {
      if (src) w.style.setProperty(name, 'url("' + String(src).replace(/"/g, '\\"') + '")');
      else w.style.removeProperty(name);
    };
    const usable = (u) => !!(u && /^(data:|https?:\/\/|blob:)/i.test(String(u)));
    const otherAvatar = (sid) => {
      try {
        const s = ctx.data.sessions.get(sid);
        if (!s || !s.contactId) return "";
        const c = ctx.data.characters.get(s.contactId);
        return c && usable(c.avatar) ? String(c.avatar) : "";
      } catch (e) { return ""; }
    };
    const selfFromDom = (w) => {
      try {
        const img = w.querySelector('img[alt="Me"]');
        const src = img ? (img.getAttribute("src") || "") : "";
        return usable(src) ? src : "";
      } catch (e) { return ""; }
    };
    let selfTried = false;
    let selfVal = "";
    let selfPromise = null;
    const selfFromKv = () => {
      if (selfTried) return Promise.resolve(selfVal);
      if (selfPromise) return selfPromise;
      selfPromise = new Promise((resolve) => {
        let done = false;
        const finish = (v) => {
          if (done) return;
          done = true; selfTried = true; selfVal = v || "";
          clearTimeout(timer); resolve(selfVal);
        };
        const timer = setTimeout(() => finish(""), 1500);
        try {
          if (!("indexedDB" in window)) return finish("");
          const req = indexedDB.open(SELF_DB);
          req.onerror = () => finish("");
          req.onupgradeneeded = () => {  try { req.transaction.abort(); } catch (e) {} finish(""); };
          req.onsuccess = () => {
            try {
              const db = req.result;
              if (!db.objectStoreNames.contains(SELF_STORE)) { db.close(); return finish(""); }
              const tx = db.transaction(SELF_STORE, "readonly");
              const g = tx.objectStore(SELF_STORE).get(SELF_KEY);
              g.onsuccess = () => {
                let out = "";
                try {
                  const row = g.result;
                  const raw = row && typeof row === "object" ? row.value : null;
                  const arr = raw ? JSON.parse(raw) : null;
                  if (Array.isArray(arr)) {
                    const hit = arr.find((x) => x && usable(x.avatarUrl)) || arr[0];
                    if (hit && usable(hit.avatarUrl)) out = String(hit.avatarUrl);
                  }
                } catch (e) {  }
                db.close(); finish(out);
              };
              g.onerror = () => { db.close(); finish(""); };
            } catch (e) { finish(""); }
          };
        } catch (e) { finish(""); }
      });
      return selfPromise;
    };
    const applyImages = (w, sid, selfFromKvVal) => {
      const autoOn = ctx.system.settings.get("autoAvatar") !== false;
      const swap = ctx.system.settings.get("swapSides") === true;
      const manualL = ctx.system.storage.get(K_LEFT + sid) || "";
      const manualR = ctx.system.storage.get(K_RIGHT + sid) || "";
      const other = autoOn ? otherAvatar(sid) : "";
      const self = autoOn ? (selfFromDom(w) || selfFromKvVal) : "";
      const autoL = swap ? other : self;
      const autoR = swap ? self : other;
      setImg(w, "--a2-avatar-url-2", manualL || autoL);
      setImg(w, "--a2-avatar-url", manualR || autoR);
    };
    const ensureBubble = (header, generating) => {
      const show = ctx.system.settings.get("showBubble") !== false;
      let box = header.querySelector(":scope > .a2-hdr-bubble[" + MARK + "]");
      if (generating && show) {
        if (!box) {
          box = document.createElement("div");
          box.className = "a2-hdr-bubble";
          box.setAttribute(MARK, "1");
          const dots = document.createElement("span");
          dots.className = "chat-typing-dots";
          dots.innerHTML = "<i></i><i></i><i></i>";
          box.appendChild(dots);
          header.appendChild(box);
        }
      } else if (box) {
        box.remove();
      }
    };
    const clearNonTarget = (w) => {
      const header = headerOf(w);
      if (header) header.querySelectorAll(":scope > [" + MARK + "]").forEach((n) => n.remove());
      w.style.removeProperty("--a2-avatar-url");
      w.style.removeProperty("--a2-avatar-url-2");
    };
    const ensure = (w, selfFromKvVal) => {
      const sid = sidOf(w);
      const header = headerOf(w);
      if (!sid || !header) return;
      if (!isTarget(w, sid, header)) { clearNonTarget(w); return; }
      applyImages(w, sid, selfFromKvVal);
      const generating = !!header.querySelector(".chat-typing-indicator");
      ensureBubble(header, generating);
    };
    let rafId = 0;
    const run = (v) => { wrappers().forEach((w) => ensure(w, v)); };
    const schedule = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        run(selfTried ? selfVal : "");
        if (!selfTried) selfFromKv().then((v) => { if (v) run(v); });
      });
    };
    const observer = new MutationObserver((records) => {
      const onlyMine = records.every((r) =>
        [...r.addedNodes, ...r.removedNodes].every((n) =>
          n.nodeType !== 1 || (n.hasAttribute && n.hasAttribute(MARK))
        )
      );
      if (onlyMine) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.hooks.on("session.opened", schedule);
    ctx.hooks.on("app.ready", schedule);
    ctx.hooks.on("plugins.changed", schedule);
    ctx.system.settings.onChange(schedule);
    ctx.system.timers.setTimeout(schedule, 500);
    const onCssUpdated = () => schedule();
    window.addEventListener("chat-session-css-updated", onCssUpdated);
    schedule();
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.setAttribute(MARK, "1");
    picker.style.cssText = "display:none;";
    document.body.appendChild(picker);
    const pickFor = (sid, side) => {
      picker.dataset.sessionId = String(sid);
      picker.dataset.side = side;
      picker.value = "";
      picker.click();
    };
    picker.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      const sid = picker.dataset.sessionId;
      const side = picker.dataset.side;
      if (!file || !sid || !side) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        ctx.system.storage.set((side === "left" ? K_LEFT : K_RIGHT) + sid, re.target.result);
        ctx.ui.toast(side === "left" ? "左图已保存" : "右图已保存");
        refreshPanel();
        schedule();
      };
      reader.readAsDataURL(file);
    };
    let refreshPanel = () => {};
    ctx.ui.slot("settings.section", (host) => {
      const render = () => {
        host.innerHTML = "";
        const box = document.createElement("div");
        box.style.cssText = [
          "margin-top:16px", "padding:14px", "border-radius:16px",
          "border:1px solid #d3d6de", "background:#f4f5f8",
          "display:flex", "flex-direction:column", "gap:10px",
          "font-family:inherit", "color:#2C3440",
        ].join(";") + ";";
        const head = document.createElement("div");
        head.textContent = "标题栏 · 双圆头像";
        head.style.cssText = "font-size:14px;font-weight:700;";
        box.appendChild(head);
        const tip = document.createElement("div");
        tip.textContent = "只给贴了《标题栏_第7版.css》的聊天室生效；没贴的显示「未贴 CSS」，不会挂错。自动抓不到再手动选图。";
        tip.style.cssText = "font-size:11px;line-height:1.6;color:#797E85;";
        box.appendChild(tip);
        const list = document.createElement("div");
        list.style.cssText = "display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;";
        const sessions = ctx.data.sessions.list() || [];
        if (!sessions.length) {
          const empty = document.createElement("div");
          empty.textContent = "暂无会话";
          empty.style.cssText = "text-align:center;font-size:12px;opacity:.6;padding:16px 0;";
          list.appendChild(empty);
        } else {
          sessions.forEach((sess) => {
            const sid = String(sess.id);
            let name = sess.alias || "";
            let typeLabel = "单聊";
            if (sess.isGroup) { name = sess.groupName || "群聊"; typeLabel = "群聊"; }
            else {
              let ch = null;
              try { ch = ctx.data.characters.get(sess.contactId); } catch (e) {}
              name = name || (ch && ch.name) || ("联系人 " + sid.slice(-4));
            }
            const active = cssOnSession(sid);
            const item = document.createElement("div");
            item.style.cssText = "display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:12px;border:1px solid #e0e2e8;background:rgba(255,255,255,.8);";
            const nm = document.createElement("span");
            nm.textContent = name;
            nm.style.cssText = "flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
            const tag = document.createElement("span");
            tag.textContent = active ? "已贴 CSS ✓" : "未贴 CSS";
            tag.style.cssText = "font-size:10px;color:" + (active ? "#1a7f4b" : "#9a9da6") +
              ";border:1px solid #e0e2e8;border-radius:999px;padding:1px 7px;flex:none;";
            const mk = (txt, fn, filled) => {
              const b = document.createElement("button");
              b.textContent = txt;
              b.style.cssText = "border:none;border-radius:999px;padding:6px 10px;font-size:11px;white-space:nowrap;cursor:pointer;flex:none;background:" +
                (filled ? "#E4E5EA" : "#eceef3") + ";color:#2C3440;";
              b.onclick = fn;
              return b;
            };
            const hasL = !!ctx.system.storage.get(K_LEFT + sid);
            const hasR = !!ctx.system.storage.get(K_RIGHT + sid);
            const btnL = mk(hasL ? "左图 ✓" : "选左图", () => pickFor(sid, "left"), hasL);
            const btnR = mk(hasR ? "右图 ✓" : "选右图", () => pickFor(sid, "right"), hasR);
            const btnClear = mk("清除", () => {
              ctx.system.storage.remove(K_LEFT + sid);
              ctx.system.storage.remove(K_RIGHT + sid);
              render(); schedule();
            }, false);
            btnClear.title = "清掉这个聊天室的两张手动图，回到自动抓取";
            item.appendChild(nm);
            item.appendChild(tag);
            item.appendChild(btnL);
            item.appendChild(btnR);
            item.appendChild(btnClear);
            list.appendChild(item);
          });
        }
        box.appendChild(list);
        host.appendChild(box);
      };
      refreshPanel = render;
      render();
      return () => { host.innerHTML = ""; };
    });
    return () => {
      observer.disconnect();
      window.removeEventListener("chat-session-css-updated", onCssUpdated);
      if (rafId) cancelAnimationFrame(rafId);
      document.querySelectorAll("[" + MARK + "]").forEach((el) => el.remove());
      wrappers().forEach((w) => {
        w.style.removeProperty("--a2-avatar-url");
        w.style.removeProperty("--a2-avatar-url-2");
      });
      refreshPanel = () => {};
      if (picker.parentNode) picker.parentNode.removeChild(picker);
    };
  },
};
