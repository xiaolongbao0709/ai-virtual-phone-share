/* ══════════════════════════════════════════════════════════════
   Soft Blank · 聊天室气泡板块插件   〔最终版〕
   真实时间戳 ＋ 译文间距自适应 · 只认贴了本套样式的聊天室
   ══════════════════════════════════════════════════════════════ */

export default {
  manifest: {
    id: "softblank-bubble-suite",
    name: "Soft Blank · 聊天室气泡板块",
    author: "山羊",
    apiVersion: 1,
    version: "1.6.0",
    description: "把气泡右下角的假时间换成真实时间；按译文到下一条消息的真实距离自动留位。只认贴了本套气泡样式的聊天室。",
    permissions: ["ui", "storage"],
    settings: [
      { key: "enabled", label: "显示真实时间 / 译文自适应间距", type: "boolean", default: true }
    ]
  },

  setup(ctx) {
    const PASSPORT = ["--bubble-ts-self", "--trans-gap", "--quote-ai-bg"];
    const LEGACY   = ["data-a2-ts", "data-a2-trans-h", "data-a2-trans-pull"];
    const MARK  = "data-softblank-bubble-ts";
    const TS    = "data-ts";
    const HMARK = "data-softblank-trans-h";
    const HVAR  = "--trans-h";
    const PMARK = "data-softblank-trans-pull";
    const PVAR  = "--trans-pull";

    let rafId = 0;
    let refreshPanel = () => {};

    const roomId = (el) => {
      const m = String(el.className || "").match(/\bsession-([^\s]+)\b/);
      return m ? m[1] : null;
    };

    const isOurRoom = (el) => {
      let cs;
      try { cs = getComputedStyle(el); } catch (e) { return false; }
      for (const k of PASSPORT) {
        if (!cs.getPropertyValue(k).trim()) return false;
      }
      return true;
    };

    const fmt = (v) => {
      const d = new Date(v);
      if (isNaN(d.getTime())) return "";
      const p = (n) => String(n).padStart(2, "0");
      return p(d.getHours()) + ":" + p(d.getMinutes());
    };

    const clearAll = () => {
      document.querySelectorAll("[" + MARK + "]").forEach(el => {
        el.removeAttribute(TS);
        el.removeAttribute(MARK);
      });
      document.querySelectorAll("[" + HMARK + "]").forEach(el => {
        el.style.removeProperty(HVAR);
        el.removeAttribute(HMARK);
      });
      document.querySelectorAll("[" + PMARK + "]").forEach(el => {
        el.style.removeProperty(PVAR);
        el.removeAttribute(PMARK);
      });
      LEGACY.forEach(a => {
        document.querySelectorAll("[" + a + "]").forEach(el => el.removeAttribute(a));
      });
    };

    function measureTrans() {
      document.querySelectorAll(".chat-room-layer").forEach(layer => {
        const wrapper = layer.querySelector(".chat-room-wrapper")
                     || layer.closest(".chat-room-wrapper") || layer;
        if (!roomId(wrapper) || !isOurRoom(wrapper)) return;

        let maxPull = 32;
        try { maxPull = parseFloat(getComputedStyle(wrapper).getPropertyValue("--trans-pull-max")); } catch (e) {}
        if (!isFinite(maxPull) || maxPull < 0) maxPull = 0;

        let targetGap = 6;
        try { targetGap = parseFloat(getComputedStyle(wrapper).getPropertyValue("--trans-gap")); } catch (e) {}
        if (!isFinite(targetGap) || targetGap < 0) targetGap = 0;

        const shells = Array.from(layer.querySelectorAll(".chat-scroll-anchored > div"));
        const curQ = shells.map(s => {
          const v = parseFloat(s.style.getPropertyValue(PVAR));
          return isFinite(v) ? v : 0;
        });
        const planH = new Map();
        const planQ = new Map();

        shells.forEach((shell, i) => {
          const tr = shell.querySelector(".chat-bilingual-section-translation");
          if (!tr) { planH.set(shell, null); return; }
          const transBottom = tr.getBoundingClientRect().bottom;
          if (!transBottom) return;

          let P = 0;
          try { P = parseFloat(getComputedStyle(shell).paddingBottom) || 0; } catch (e) {}

          const next = shells[i + 1];
          let nextTopEl = null;
          if (next) {
            for (const c of next.children) {
              let disp = "";
              try { disp = getComputedStyle(c).display; } catch (e) {}
              if (disp !== "none") { nextTopEl = c; break; }
            }
          }
          if (!nextTopEl) {
            const bubble = shell.querySelector(".chat-bubble-role-user, .chat-bubble-role-assistant");
            let drop = 2;
            try { drop = parseFloat(getComputedStyle(bubble || shell).getPropertyValue("--trans-drop")) || 2; } catch (e) {}
            planH.set(shell, String(Math.max(0, Math.ceil(tr.getBoundingClientRect().height + drop + 6))));
            return;
          }

          const curGap = nextTopEl.getBoundingClientRect().top - transBottom;
          const d = targetGap - curGap;
          const H2 = Math.max(0, Math.ceil(P + d - targetGap));
          planH.set(shell, String(H2));
          planQ.set(next, null);
        });

        planH.forEach((val, shell) => {
          if (val === null) {
            if (shell.hasAttribute(HMARK)) {
              shell.style.removeProperty(HVAR);
              shell.removeAttribute(HMARK);
            }
          } else if (shell.getAttribute(HMARK) !== val) {
            shell.style.setProperty(HVAR, val + "px");
            shell.setAttribute(HMARK, val);
          }
        });
        shells.forEach(shell => {
          const want = planQ.get(shell) || null;
          if (want && shell.getAttribute(PMARK) !== want) {
            shell.style.setProperty(PVAR, want + "px");
            shell.setAttribute(PMARK, want);
          } else if (!want && shell.hasAttribute(PMARK)) {
            shell.style.removeProperty(PVAR);
            shell.removeAttribute(PMARK);
          }
        });
      });
    }

    function scanAndRender() {
      const on = ctx.system.settings.get("enabled") !== false;
      if (!on) { clearAll(); return; }
      measureTrans();

      let listFn = null;
      try { listFn = ctx.data && ctx.data.messages && ctx.data.messages.list; } catch (e) {}
      if (typeof listFn !== "function") return;

      document.querySelectorAll(".chat-room-layer").forEach(layer => {
        const wrapper = layer.querySelector(".chat-room-wrapper")
                     || layer.closest(".chat-room-wrapper") || layer;
        const sid = roomId(wrapper);
        if (!sid || !isOurRoom(wrapper)) return;

        let msgs = [];
        try { msgs = listFn(sid) || []; } catch (e) { msgs = []; }
        if (!Array.isArray(msgs) || !msgs.length) return;

        const byId = new Map();
        msgs.forEach(m => {
          if (m && m.id != null && m.createdAt != null) byId.set(String(m.id), m.createdAt);
        });
        if (!byId.size) return;

        const bubbles = layer.querySelectorAll(
          ".chat-bubble-role-user[data-msg-id], .chat-bubble-role-assistant[data-msg-id]"
        );
        bubbles.forEach(b => {
          const raw = byId.get(String(b.getAttribute("data-msg-id")));
          if (raw == null) return;
          const txt = fmt(raw);
          if (!txt) return;
          if (b.getAttribute(MARK) === txt) return;
          b.setAttribute(TS, txt);
          b.setAttribute(MARK, txt);
        });
      });
    }

    function schedule() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => { rafId = 0; scanAndRender(); refreshPanel(); });
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    if (ctx.system.settings.onChange) {
      ctx.system.settings.onChange(schedule);
    }
    ctx.hooks.on("session.opened", schedule);
    ctx.hooks.on("app.ready", schedule);
    ctx.hooks.on("plugins.changed", schedule);
    ctx.system.timers.setTimeout(schedule, 500);
    schedule();

    const PINK = {
      card: "#f5e4f5", line: "#ecd9ee", ink: "#6b5566", soft: "#9b7d94",
      row: "rgba(255,255,255,.72)", rowLine: "rgba(196,150,190,.38)"
    };

    ctx.ui.slot("settings.section", (host) => {
      const render = () => {
        host.innerHTML = "";
        const box = document.createElement("div");
        box.style.cssText = [
          "margin-top:16px", "padding:14px", "border-radius:16px",
          "border:1px solid " + PINK.line, "background:" + PINK.card,
          "display:flex", "flex-direction:column", "gap:8px",
          "font-family:inherit", "color:" + PINK.ink
        ].join(";") + ";";

        const title = document.createElement("div");
        title.textContent = "🌸 气泡 · 真实时间戳";
        title.style.cssText = "font-size:14px;font-weight:700;";
        box.appendChild(title);

        const stat = document.createElement("div");
        stat.style.cssText = [
          "padding:9px 11px", "border-radius:12px",
          "border:1px solid " + PINK.rowLine, "background:" + PINK.row,
          "font-size:12px"
        ].join(";") + ";";
        stat.textContent = "已挂上 ✓（真时间 ＋ 译文间距自适应）";
        box.appendChild(stat);

        const tip = document.createElement("div");
        tip.style.cssText = "font-size:11px;color:" + PINK.soft + ";line-height:1.7;";
        tip.textContent = "只负责两件小事：把 19:02 / 19:05 换成真实时间、量一下译文到下一条消息（隔一会儿时就是时间小胶囊）还差多少。间距松紧改气泡 CSS 里的 --trans-gap，时间位置大小颜色双勾也全在气泡 CSS 里调。自动只认贴了这套气泡样式的聊天室，不用勾选、不用填房间号。关掉开关或卸载插件，自动回到假时间和 CSS 兜底间距。";
        box.appendChild(tip);

        host.appendChild(box);
      };
      refreshPanel = render;
      render();
    });

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      clearAll();
      refreshPanel = () => {};
    };
  }
};
