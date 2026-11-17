/* =========================================================
 * 气泡时间戳插件
 * 适用：A1 圆角气泡 / A3 微信气泡（同一消息骨架，插件通用）
 * 规范：ES Module，export default { manifest, setup(ctx) }，apiVersion 1
 * 作者：hy4 & Claude
 * 职责：读取消息 createdAt 并格式化为 H/MM AM|PM，写入气泡板块 CSS 变量；
 *       按会话勾选范围生效，连发仅保留末条，样式全部由注入窗口 CSS 承载。
 * ========================================================= */
export default {
  manifest: {
    id: "a1-bubble-timestamp",
    name: "气泡时间戳",
    apiVersion: 1,
    version: "1.0.0",
    author: "hy4 & Claude",
    description: "为气泡注入真实发送时间戳；支持会话级生效范围、连发聚合、样式与字体自定义。需配合气泡板块 CSS 使用。",
    permissions: ["chat.read", "ui", "storage"],
    settings: [
      { key: "enabled", label: "启用时间戳", type: "boolean", default: true },
      { key: "fontPreset", label: "字体", type: "select", default: "josefin",
        options: [
          { value: "josefin", label: "Josefin Sans（几何复古 · 低腰线优雅体，推荐）" },
          { value: "plexmono", label: "IBM Plex Mono（人文等宽 · 理性清晰）" },
          { value: "courierprime", label: "Courier Prime（打字机衬线 · 复古印刷）" },
          { value: "inconsolata", label: "Inconsolata（极简等宽 · 纤细人文）" },
          { value: "ubuntumono", label: "Ubuntu Mono（人文等宽 · 圆润清晰）" },
          { value: "system", label: "系统默认（不加载外部字体）" }
        ] },
      { key: "fontCustom", label: "自定义字体名（仅限 Google Fonts 谷歌字体；留空用上方预设）", type: "text", default: "" },
      { key: "timeColor", label: "时间颜色（如 #666666）", type: "text", default: "#666666" },
      { key: "timeSize", label: "时间字号(px)", type: "number", default: 12 },
      { key: "gapY", label: "上下：离气泡底边(px)", type: "number", default: 1.25 },
      { key: "offsetX", label: "左右：往屏幕里收(px)", type: "number", default: 5 },
      { key: "quoteShift", label: "带引用框时额外下移(px)", type: "number", default: 20 },
      { key: "checkColor", label: "双勾颜色（如 #666666）", type: "text", default: "#666666" },
      { key: "checkSize", label: "双勾大小(px)", type: "number", default: 13 },
      { key: "checkGap", label: "PM 与双勾间距(px)", type: "number", default: 5 },
      { key: "checkY", label: "双勾上下微调(px，负数上移)", type: "number", default: -1 }
    ]
    /* 说明：文字 / 图片 / 卡片 / 语音 一律都显示时间戳，行为写死，不再提供开关。
       原因：一旦按类型排除消息，「本轮最后一条」的判定序列会缺项，
       时间戳会跑到一轮消息中间的缝隙里。 */
  },

  setup(ctx) {
    const TARGET_KEY = "a1ts_targets";
    const MARK = "data-ts-show";
    const FONT_LINK_ID = "a1ts-font-link";

    /* ── 字体：链接只能由插件插入，CSS 变量里放不了网址 ── */
    const FONTS = {
      josefin:       { name: "Josefin Sans", url: "https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;600&display=swap" },
      plexmono:      { name: "IBM Plex Mono", url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap" },
      courierprime:  { name: "Courier Prime", url: "https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap" },
      inconsolata:   { name: "Inconsolata", url: "https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;600&display=swap" },
      ubuntumono:    { name: "Ubuntu Mono", url: "https://fonts.googleapis.com/css2?family=Ubuntu+Mono:wght@400;700&display=swap" },
      system:        { name: "",             url: "" }
    };

    const num = (key, fallback) => {
      const raw = ctx.system.settings.get(key);
      if (raw === null || raw === undefined || String(raw).trim() === "") return fallback;
      const v = Number(raw);
      return isNaN(v) ? fallback : v;
    };
    const str = (key, fallback) => {
      const v = ctx.system.settings.get(key);
      return (v === null || v === undefined || String(v).trim() === "") ? fallback : String(v).trim();
    };

    const currentFont = () => {
      const custom = str("fontCustom", "");
      if (custom) {
        return { name: custom, url: "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(custom).replace(/%20/g, "+") + "&display=swap" };
      }
      return FONTS[str("fontPreset", "josefin")] || FONTS.josefin;
    };

    const applyFontLink = () => {
      try {
        const old = document.getElementById(FONT_LINK_ID);
        if (old) old.remove();
        const f = currentFont();
        if (!f.url) return;
        const link = document.createElement("link");
        link.id = FONT_LINK_ID;
        link.rel = "stylesheet";
        link.href = f.url;
        document.head.appendChild(link);
      } catch (e) {}
    };

    /* ── 时间：只认消息自己的 createdAt，绝不拿「打开时间」凑数 ── */
    const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
    const formatTime = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "";
      let h = d.getHours();
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12;
      if (h === 0) h = 12;
      return h + "/" + pad2(d.getMinutes()) + " " + ap;
    };

    /* ── 双勾：按颜色重新生成 SVG，写进变量，实现「插件里调色」 ── */
    const svgVar = (hex) => {
      let c = String(hex || "").trim();
      if (!/^#[0-9a-fA-F]{3,8}$/.test(c)) c = "#666666";
      const enc = encodeURIComponent(c);
      return 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'none\' stroke=\'' + enc + '\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'m7 12l5 5L22 7M2 12l5 5m5-5l5-5\'/%3E%3C/svg%3E")';
    };

    /* ── 生效范围：默认一个都不勾，绝不默认全量 ── */
    const getTargets = () => {
      const v = ctx.system.storage.get(TARGET_KEY);
      return Array.isArray(v) ? v : [];
    };
    const isActive = (sessionId) => {
      if (!sessionId) return false;
      return getTargets().some(id => String(id) === String(sessionId));
    };

    const sessionOf = (wrapper) => {
      try {
        const room = wrapper.closest(".chat-room-wrapper");
        if (!room) return null;
        const mm = String(room.className).match(/\bsession-([^\s]+)\b/);
        return mm ? mm[1] : null;
      } catch (e) { return null; }
    };

    const clearAll = () => {
      try {
        document.querySelectorAll("[" + MARK + "]").forEach(n => {
          n.removeAttribute(MARK);
          ["--ts-text", "--ts-font", "--ts-size", "--ts-color", "--ts-gap",
           "--ts-offset-x", "--ts-quote-shift", "--ts-check-size",
           "--ts-check-color", "--ts-check-gap", "--ts-check-y", "--ts-check-svg"]
            .forEach(k => n.style.removeProperty(k));
        });
      } catch (e) {}
    };

    let disposed = false;
    let msgCache = {};
    const loadMap = (sid) => {
      if (msgCache[sid]) return msgCache[sid];
      const m = {};
      try {
        (ctx.data.messages.list(sid) || []).forEach(x => {
          if (x && x.id != null) m[String(x.id)] = x;
        });
      } catch (e) {}
      msgCache[sid] = m;
      return m;
    };

    /* 候选序列必须包含全部消息类型（文字 / 图片 / 卡片 / 语音 …），
       否则「本轮最后一条」会算错，时间戳落到一轮消息中间。 */
    const ALL_SEL = '.chat-msg-wrapper[data-role="user"], .chat-msg-wrapper[data-role="assistant"]';

    function scan() {
      try {
        if (disposed) return;
        if (ctx.system.settings.get("enabled") === false) { clearAll(); return; }

        msgCache = {};
        const list = Array.from(document.querySelectorAll(ALL_SEL));

        const f = currentFont();
        const fontStack = f.name
          ? "'" + f.name + "', system-ui, -apple-system, 'Segoe UI', sans-serif"
          : "system-ui, -apple-system, 'Segoe UI', sans-serif";

        const vars = {
          "--ts-font": fontStack,
          "--ts-size": num("timeSize", 12) + "px",
          "--ts-color": str("timeColor", "#666666"),
          "--ts-gap": num("gapY", 1.25) + "px",
          "--ts-offset-x": num("offsetX", 5) + "px",
          "--ts-quote-shift": num("quoteShift", 20) + "px",
          "--ts-check-size": num("checkSize", 13) + "px",
          "--ts-check-color": str("checkColor", "#666666"),
          "--ts-check-gap": num("checkGap", 5) + "px",
          "--ts-check-y": num("checkY", -1) + "px",
          "--ts-check-svg": svgVar(str("checkColor", "#666666"))
        };

        /* 先按房间过滤，再在同一房间的候选序列里挑「本轮最后一条」 */
        const byRoom = {};
        list.forEach(w => {
          const sid = sessionOf(w);
          if (!sid || !isActive(sid)) return;
          if (!byRoom[sid]) byRoom[sid] = [];
          byRoom[sid].push(w);
        });

        const shouldShow = new Set();
        Object.keys(byRoom).forEach(sid => {
          const arr = byRoom[sid];
          const map = loadMap(sid);
          arr.forEach((w, i) => {
            const next = arr[i + 1];
            const nextIsSameRound = next
              && next.hasAttribute("data-consecutive")
              && next.getAttribute("data-role") === w.getAttribute("data-role");
            if (nextIsSameRound) return;               // 连发中间条：不显示
            const id = String(w.id || "").replace(/^message-/, "");
            const msg = map[id];
            if (!msg || !msg.createdAt) return;        // 查不到真实时间宁可不显示
            const t = formatTime(msg.createdAt);
            if (!t) return;
            shouldShow.add(w);
            w.setAttribute(MARK, "1");
            w.style.setProperty("--ts-text", '"' + t + '"');
            Object.keys(vars).forEach(k => w.style.setProperty(k, vars[k]));
          });
        });

        /* 不该显示的，把记号与内联变量清干净（房间没勾 / 插件禁用也走这里） */
        document.querySelectorAll("[" + MARK + "]").forEach(n => {
          if (!shouldShow.has(n)) {
            n.removeAttribute(MARK);
            Object.keys(vars).forEach(k => n.style.removeProperty(k));
            n.style.removeProperty("--ts-text");
          }
        });
      } catch (e) {}
    }

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; scan(); });
    };

    const obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true });

    const fire = () => {
      scan();
      let i = 0;
      const t = setInterval(() => { scan(); if (++i >= 8) clearInterval(t); }, 250);
    };
    ["app.ready", "session.opened", "message.persisted", "plugins.changed"].forEach(ev => {
      try { ctx.hooks.on(ev, fire); } catch (e) {}
    });

    let offSettings = null;
    try {
      offSettings = ctx.system.settings.onChange(() => { applyFontLink(); fire(); });
    } catch (e) {}

    applyFontLink();
    fire();

    /* ── 设置面板：勾选聊天室（照输入栏插件，带单聊/群聊标签） ── */
    ctx.ui.slot("settings.section", (host) => {
      const render = () => {
        try {
          host.innerHTML = "";
          const selected = getTargets();
          const sessions = ctx.data.sessions.list() || [];

          const box = document.createElement("div");
          box.style.cssText = "margin-top:16px; padding:14px; border-radius:14px; border:1px dashed rgba(128,128,128,.35); background:rgba(128,128,128,.06); display:flex; flex-direction:column; gap:10px; font-family:inherit;";

          const head = document.createElement("div");
          head.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
          head.innerHTML = '<div style="font-size:14px; font-weight:700; opacity:.9;">⏱️ 时间戳生效范围</div>';
          const acts = document.createElement("div");

          const bAll = document.createElement("button");
          bAll.textContent = "全选";
          bAll.style.cssText = "background:none;border:none;font-size:12px;opacity:.6;cursor:pointer;margin-right:8px;color:inherit;";
          bAll.onclick = () => { ctx.system.storage.set(TARGET_KEY, sessions.map(x => x.id)); render(); fire(); };

          const bNone = document.createElement("button");
          bNone.textContent = "清空";
          bNone.style.cssText = "background:none;border:none;font-size:12px;opacity:.6;cursor:pointer;color:inherit;";
          bNone.onclick = () => { ctx.system.storage.set(TARGET_KEY, []); render(); fire(); };

          acts.appendChild(bAll); acts.appendChild(bNone);
          head.appendChild(acts);
          box.appendChild(head);

          const list = document.createElement("div");
          list.style.cssText = "display:flex; flex-direction:column; gap:6px; max-height:230px; overflow-y:auto;";
          if (!sessions.length) {
            list.innerHTML = '<div style="text-align:center; font-size:12px; opacity:.5; padding:16px 0;">暂无会话</div>';
          } else {
            sessions.forEach(sess => {
              let name = sess.alias || "";
              let typeLabel = "单聊";
              if (sess.isGroup) { name = sess.groupName || "群聊"; typeLabel = "群聊"; }
              else {
                let ch = null;
                try { ch = ctx.data.characters.get(sess.contactId); } catch (e) {}
                name = name || (ch && ch.name) || ("联系人 " + String(sess.contactId).slice(-4));
              }
              const on = selected.some(id => String(id) === String(sess.id));
              const item = document.createElement("div");
              item.style.cssText = "display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; border:1px solid rgba(128,128,128,.25); background:rgba(128,128,128,.05); cursor:pointer;";
              item.innerHTML =
                '<div style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(128,128,128,.5);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;' + (on ? 'background:rgba(128,128,128,.45);' : '') + '">' + (on ? '✓' : '') + '</div>' +
                '<span style="flex:1; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></span>' +
                '<span style="font-size:11px;opacity:.55;border:1px solid rgba(128,128,128,.3);border-radius:999px;padding:1px 8px;">' + typeLabel + '</span>';
              item.querySelector("span").textContent = name;
              item.onclick = () => {
                const cur = new Set(getTargets().map(id => String(id)));
                if (cur.has(String(sess.id))) cur.delete(String(sess.id));
                else cur.add(String(sess.id));
                ctx.system.storage.set(TARGET_KEY, Array.from(cur));
                render(); fire();
              };
              list.appendChild(item);
            });
          }
          box.appendChild(list);

          const tip = document.createElement("div");
          tip.style.cssText = "font-size:12px; opacity:.6; line-height:1.7; margin-top:6px;";
          tip.textContent = "默认一个都不勾选：点一下要生效的聊天室即可。新开的聊天室要回来再勾一次。颜色、字号、字体、上下左右在上面的设置项里调。";
          box.appendChild(tip);

          const fontTip = document.createElement("div");
          fontTip.style.cssText = "font-size:12px; opacity:.6; line-height:1.7;";
          fontTip.textContent = "字体来源：仅限 Google Fonts（谷歌开源字体库，fonts.googleapis.com）。自定义填字体家族名即可，空格写 + 或直接留空格，例：Playfair Display、IBM Plex Mono；插件自动拼成 https://fonts.googleapis.com/css2?family=字体名&display=swap。其他平台的链接不支持。";
          box.appendChild(fontTip);
          host.appendChild(box);
        } catch (e) {}
      };
      render();
    });

    return () => {
      disposed = true;
      try { obs.disconnect(); } catch (e) {}
      try { if (raf) cancelAnimationFrame(raf); } catch (e) {}
      try { if (offSettings) offSettings(); } catch (e) {}
      clearAll();
      try {
        const l = document.getElementById(FONT_LINK_ID);
        if (l) l.remove();
      } catch (e) {}
    };
  }
};
