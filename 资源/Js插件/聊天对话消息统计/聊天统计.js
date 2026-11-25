export default {
  manifest: {
    id: "chat-message-counter",
    name: "聊天计数器",
    apiVersion: 1,
    version: "1.2.0",
    author: "散遍温柔",
    description: "统计当前会话的消息条数、对话轮数、总字数，支持历史统计与实时更新",
    permissions: ["chat.read"],
    settings: [
      { key: "includeSystem", label: "统计时包含系统消息", type: "boolean", default: false },
    ],
  },

  setup(ctx) {
    const CSS = `
.cc-bar{display:flex;justify-content:flex-end;align-items:center;padding:2px 4px 0;line-height:1;}
.cc-pill{display:inline-flex;align-items:center;gap:7px;padding:6px 11px;border-radius:999px;border:1px solid rgba(128,128,128,.16);background:rgba(128,128,128,.06);color:inherit;font-family:inherit;font-size:12px;line-height:1.2;cursor:pointer;opacity:.82;-webkit-tap-highlight-color:transparent;user-select:none;transition:opacity .25s ease,transform .25s cubic-bezier(.2,.9,.25,1),background .25s ease,border-color .25s ease,box-shadow .25s ease;box-shadow:0 0 0 rgba(0,0,0,0);}
.cc-pill:hover{opacity:1;transform:translateY(-1px);background:rgba(128,128,128,.1);border-color:rgba(128,128,128,.28);box-shadow:0 5px 18px rgba(0,0,0,.09);}
.cc-pill:active{transform:scale(.96);}
.cc-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.42;flex:0 0 auto;transition:opacity .2s ease;}
.cc-pill:hover .cc-dot{opacity:.72;}
.cc-num{display:inline-block;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.01em;}
.cc-label{opacity:.5;}
.cc-sub{font-size:11px;opacity:.42;font-variant-numeric:tabular-nums;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cc-chev{font-size:13px;opacity:.3;margin-left:-1px;transition:transform .25s ease,opacity .25s ease;}
.cc-pill:hover .cc-chev{transform:translateX(1px);opacity:.6;}
.cc-bump{animation:ccBump .45s cubic-bezier(.2,.9,.25,1);}
@keyframes ccBump{0%{transform:scale(1);}32%{transform:scale(1.16);}100%{transform:scale(1);}}
.cc-ping{animation:ccPing .7s ease-out;}
@keyframes ccPing{0%{box-shadow:0 0 0 0 rgba(128,128,128,.5);}100%{box-shadow:0 0 0 7px rgba(128,128,128,0);}}

.cc-modal{color:inherit;font-family:inherit;}
.cc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;}
.cc-head-text{min-width:0;}
.cc-title{font-size:15px;font-weight:650;letter-spacing:.01em;}
.cc-subtitle{margin-top:4px;font-size:11.5px;opacity:.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;}
.cc-close{flex:0 0 auto;width:26px;height:26px;padding:0;border:none;border-radius:50%;background:rgba(128,128,128,.1);color:inherit;font-size:11px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:.55;transition:opacity .2s ease,background .2s ease,transform .25s ease;}
.cc-close:hover{opacity:1;background:rgba(128,128,128,.18);transform:rotate(90deg);}
.cc-hero{margin-top:20px;text-align:center;}
.cc-hero-num{display:inline-block;font-size:42px;font-weight:700;line-height:1.05;letter-spacing:-.02em;font-variant-numeric:tabular-nums;background:linear-gradient(180deg,currentColor 8%,rgba(128,128,128,.42));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.cc-hero-label{margin-top:6px;font-size:12px;opacity:.5;letter-spacing:.04em;}
.cc-hero-sub{margin-top:3px;font-size:11px;opacity:.36;font-variant-numeric:tabular-nums;}
.cc-track{display:flex;height:6px;margin-top:18px;border-radius:999px;overflow:hidden;background:rgba(128,128,128,.13);}
.cc-seg{height:100%;width:0;background:currentColor;transition:width .6s cubic-bezier(.2,.9,.25,1),opacity .3s ease;}
.cc-seg-u{opacity:.22;}
.cc-seg-t{opacity:.6;}
.cc-legend{display:flex;justify-content:space-between;margin-top:9px;font-size:11px;opacity:.62;font-variant-numeric:tabular-nums;}
.cc-legend span::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:5px;vertical-align:1px;background:currentColor;}
.cc-lg-u::before{opacity:.38;}
.cc-lg-t::before{opacity:1;}
.cc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin-top:14px;}
.cc-stat{display:flex;flex-direction:column;gap:5px;min-width:0;padding:10px 12px;border-radius:12px;background:rgba(128,128,128,.06);border:1px solid rgba(128,128,128,.08);}
.cc-k{font-size:10.5px;letter-spacing:.05em;opacity:.42;white-space:nowrap;}
.cc-v{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cc-v-sm{font-size:13px;font-weight:550;}
@media (prefers-reduced-motion: reduce){.cc-pill,.cc-chev,.cc-seg,.cc-close{transition:none !important;}.cc-bump,.cc-ping{animation:none !important;}}
@supports not ((-webkit-background-clip: text) or (background-clip: text)){.cc-hero-num{background:none;-webkit-text-fill-color:currentColor;}}
`;
    ctx.ui.injectCSS(CSS);

    const MODAL_HTML = `
<div class="cc-modal">
  <div class="cc-head">
    <div class="cc-head-text">
      <div class="cc-title">聊天统计</div>
      <div class="cc-subtitle"></div>
    </div>
    <button class="cc-close" type="button" aria-label="关闭">✕</button>
  </div>
  <div class="cc-hero">
    <div class="cc-hero-num">0</div>
    <div class="cc-hero-label">本会话共聊</div>
    <div class="cc-hero-sub"></div>
  </div>
  <div class="cc-track"><span class="cc-seg cc-seg-u"></span><span class="cc-seg cc-seg-t"></span></div>
  <div class="cc-legend"><span class="cc-lg-u">你 0</span><span class="cc-lg-t">TA 0</span></div>
  <div class="cc-grid">
    <div class="cc-stat"><span class="cc-k">对话轮数</span><span class="cc-v cc-v-rounds">0 轮</span></div>
    <div class="cc-stat"><span class="cc-k">总字数</span><span class="cc-v cc-v-chars">0</span></div>
    <div class="cc-stat"><span class="cc-k">最近消息</span><span class="cc-v cc-v-sm cc-v-last">—</span></div>
  </div>
</div>`;

    const statsCache = new Map();
    const seenIds = new Map();
    const entries = [];
    const entryByEl = new WeakMap();
    const pillByEl = new WeakMap();
    let modal = null;
    let destroyed = false;

    function opts() {
      return {
        includeSystem: ctx.system.settings.get("includeSystem") === true,
      };
    }

    function fmt(n) {
      const v = Number(n);
      if (!isFinite(v)) return "0";
      return v.toLocaleString("zh-CN");
    }

    function pad(n) {
      return n < 10 ? "0" + n : String(n);
    }

    function fmtDate(t) {
      const d = new Date(t);
      if (isNaN(d.getTime())) return "—";
      return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate());
    }

    function fmtRel(t) {
      if (t == null) return "—";
      const diff = Date.now() - t;
      if (!isFinite(diff)) return "—";
      if (diff < 0) return fmtDate(t);
      if (diff < 60000) return "刚刚";
      if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
      if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
      if (diff < 30 * 86400000) return Math.floor(diff / 86400000) + " 天前";
      return fmtDate(t);
    }

    function timeOf(m) {
      if (!m) return null;
      const keys = ["createdAt", "timestamp", "time", "created_at", "ts", "updatedAt"];
      for (const k of keys) {
        const c = m[k];
        if (c == null) continue;
        if (c instanceof Date) return c.getTime();
        if (typeof c === "number" && isFinite(c)) return c < 1e11 ? c * 1000 : c;
        if (typeof c === "string") {
          const n = Number(c);
          if (c.trim() !== "" && isFinite(n) && n > 1e11) return n;
          const t = Date.parse(c);
          if (!isNaN(t)) return t;
        }
      }
      return null;
    }

    function extractText(c) {
      if (c == null) return "";
      if (typeof c === "string") return c;
      if (typeof c === "number" || typeof c === "boolean") return String(c);
      if (Array.isArray(c)) {
        let out = "";
        for (const p of c) {
          if (p == null) continue;
          if (typeof p === "string") out += p;
          else if (typeof p === "object") {
            if (typeof p.text === "string") out += p.text;
            else if (typeof p.content === "string") out += p.content;
            else if (typeof p.value === "string") out += p.value;
          }
        }
        return out;
      }
      if (typeof c === "object") {
        if (typeof c.text === "string") return c.text;
        if (typeof c.content === "string") return c.content;
        if (Array.isArray(c.parts)) return extractText(c.parts);
      }
      return "";
    }

    function textOf(m) {
      if (!m) return "";
      let c = m.content;
      if (c == null) c = m.text;
      return extractText(c);
    }

    function countChars(s) {
      if (!s) return 0;
      return String(s).replace(/\s+/g, "").replace(/[*#`~_>|]/g, "").length;
    }

    function displayTotal(st) {
      if (!st) return 0;
      return st.user + st.assistant + (opts().includeSystem ? st.system : 0);
    }

    function roundsOf(st) {
      if (!st) return 0;
      return Math.min(st.user, st.assistant);
    }

    function safeSession(sessionId) {
      try {
        return ctx.data.sessions.get(sessionId) || null;
      } catch (e) {
        return null;
      }
    }

    function sessionTitle(session) {
      if (!session) return "当前会话";
      return session.title || session.name || (session.contact && session.contact.name) || "当前会话";
    }

    function computeStats(sessionId) {
      const st = { user: 0, assistant: 0, system: 0, chars: 0, first: null, last: null };
      let list = [];
      try {
        list = ctx.data.messages.list(sessionId);
      } catch (e) {
        list = [];
      }
      if (!Array.isArray(list)) list = [];
      const ids = [];
      for (const m of list) {
        if (!m) continue;
        let counted = true;
        if (m.role === "user") st.user++;
        else if (m.role === "assistant") st.assistant++;
        else if (m.role === "system") st.system++;
        else counted = false;

        if (counted) {
          st.chars += countChars(textOf(m));
          const t = timeOf(m);
          if (t != null) {
            if (st.first == null || t < st.first) st.first = t;
            if (st.last == null || t > st.last) st.last = t;
          }
        }
        if (m.id != null) ids.push(m.id);
      }
      if (ids.length) seenIds.set(sessionId, new Set(ids.slice(-400)));
      return st;
    }

    function getStats(sessionId) {
      let st = statsCache.get(sessionId);
      if (!st) {
        st = computeStats(sessionId);
        statsCache.set(sessionId, st);
      }
      return st;
    }

    function noteMessage(message) {
      const sid = message.sessionId;
      if (!sid) return false;
      const role = message.role;
      const isSystem = role === "system";
      const counted = role === "user" || role === "assistant" || (isSystem && opts().includeSystem);
      const t = timeOf(message);
      const nchars = counted ? countChars(textOf(message)) : 0;

      const st = statsCache.get(sid);
      if (st) {
        if (role === "user") st.user++;
        else if (role === "assistant") st.assistant++;
        else if (isSystem) st.system++;

        if (counted) {
          st.chars += nchars;
          if (t != null) {
            if (st.first == null || t < st.first) st.first = t;
            if (st.last == null || t > st.last) st.last = t;
          }
        }
      }
      return counted;
    }

    function pulse(node, cls) {
      if (!node) return;
      node.classList.remove(cls);
      void node.offsetWidth;
      node.classList.add(cls);
    }

    function prune() {
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (!e.el || !e.el.isConnected || entryByEl.get(e.el) !== e) entries.splice(i, 1);
      }
    }

    function animateNumber(node, from, to) {
      if (!node) return;
      let reduce = false;
      try {
        reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch (e) {}
      if (reduce || from === to) {
        node.textContent = fmt(to);
        return;
      }
      const dur = 650;
      const t0 = performance.now();
      const step = (now) => {
        if (!node.isConnected) return;
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        node.textContent = fmt(Math.round(from + (to - from) * e));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    function createPill(sessionId) {
      const root = document.createElement("div");
      root.className = "cc-bar";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cc-pill";
      btn.setAttribute("aria-label", "查看聊天统计");
      btn.title = "查看聊天统计";
      btn.innerHTML =
        '<span class="cc-dot"></span>' +
        '<span class="cc-num">0</span>' +
        '<span class="cc-label">条消息</span>' +
        '<span class="cc-chev">›</span>';

      root.appendChild(btn);

      const numEl = btn.querySelector(".cc-num");
      const dotEl = btn.querySelector(".cc-dot");
      let lastTotal = null;

      function update(animate) {
        if (destroyed) return;
        const st = getStats(sessionId);
        const total = displayTotal(st);
        numEl.textContent = fmt(total);

        if (animate && lastTotal != null && total !== lastTotal) {
          pulse(numEl, "cc-bump");
          pulse(dotEl, "cc-ping");
        }
        lastTotal = total;
        btn.title = "当前会话 " + fmt(total) + " 条消息";
      }

      btn.addEventListener("click", () => openStatsModal(sessionId));

      return { root, update, sessionId };
    }

    function openStatsModal(sessionId) {
      if (destroyed) return;
      const name = sessionTitle(safeSession(sessionId));

      try {
        ctx.ui.openModal((el, api) => {
          el.style.width = "min(380px, 92vw)";
          el.style.maxWidth = "92vw";
          el.style.maxHeight = "86vh";
          el.style.overflow = "auto";
          el.style.boxSizing = "border-box";
          el.style.padding = "18px 18px 16px";
          el.innerHTML = MODAL_HTML;

          const numEl = el.querySelector(".cc-hero-num");
          const subEl = el.querySelector(".cc-subtitle");
          const segU = el.querySelector(".cc-seg-u");
          const segT = el.querySelector(".cc-seg-t");
          const lgU = el.querySelector(".cc-lg-u");
          const lgT = el.querySelector(".cc-lg-t");
          const roundsEl = el.querySelector(".cc-v-rounds");
          const charsEl = el.querySelector(".cc-v-chars");
          const lastEl = el.querySelector(".cc-v-last");
          const closeEl = el.querySelector(".cc-close");

          let lastTotal = null;

          const closeModal = () => {
            if (modal && modal.el === el) modal = null;
            try {
              api.close();
            } catch (e) {}
          };

          closeEl.addEventListener("click", closeModal);

          const onKey = (e) => {
            if (e.key !== "Escape") return;
            if (el.isConnected) closeModal();
            document.removeEventListener("keydown", onKey);
          };
          document.addEventListener("keydown", onKey);

          function render(first) {
            if (!el.isConnected) return;

            const st = getStats(sessionId);
            const user = st.user;
            const asst = st.assistant;
            const total = displayTotal(st);
            const rounds = roundsOf(st);
            const chars = st.chars;
            const last = st.last;

            subEl.textContent = name;

            if (first) {
              animateNumber(numEl, 0, total);
            } else {
              if (lastTotal != null && total !== lastTotal) pulse(numEl, "cc-bump");
              numEl.textContent = fmt(total);
            }
            lastTotal = total;

            const denom = user + asst;
            const uPct = denom > 0 ? (user / denom) * 100 : 50;

            const applyWidths = () => {
              if (!el.isConnected) return;
              segU.style.width = uPct.toFixed(2) + "%";
              segT.style.width = (100 - uPct).toFixed(2) + "%";
            };
            if (first) requestAnimationFrame(applyWidths);
            else applyWidths();

            lgU.textContent = "你 " + fmt(user);
            lgT.textContent = "TA " + fmt(asst);
            roundsEl.textContent = fmt(rounds) + " 轮";
            charsEl.textContent = fmt(chars) + " 字";
            lastEl.textContent = fmtRel(last);
          }

          render(true);
          modal = {
            sessionId,
            el,
            refresh: () => {
              try {
                render(false);
              } catch (e) {}
            },
          };
        });
      } catch (err) {
        try {
          ctx.system.log("聊天计数器：打开统计面板失败", err);
        } catch (e) {}
      }
    }

    ctx.hooks.on("message.persisted", ({ message } = {}) => {
      if (destroyed || !message || !message.sessionId) return;
      const sid = message.sessionId;

      if (message.id != null) {
        let seen = seenIds.get(sid);
        if (!seen) {
          seen = new Set();
          seenIds.set(sid, seen);
        }
        if (seen.has(message.id)) return;
        seen.add(message.id);
        if (seen.size > 500) {
          seen.delete(seen.values().next().value);
        }
      }

      let counted = false;
      try {
        counted = noteMessage(message);
      } catch (e) {}

      prune();
      for (const e of entries) {
        if (e.sessionId === sid && e.el.isConnected) {
          try {
            e.update(counted);
          } catch (err) {}
        }
      }

      if (modal && modal.el && modal.el.isConnected && modal.sessionId === sid) {
        modal.refresh();
      }
    });

    ctx.hooks.on("message.deleted", ({ sessionId } = {}) => {
      if (destroyed || !sessionId) return;
      statsCache.delete(sessionId);
      seenIds.delete(sessionId);

      prune();
      for (const e of entries) {
        if (e.sessionId === sessionId && e.el.isConnected) {
          try {
            e.update(false);
          } catch (err) {}
        }
      }

      if (modal && modal.el && modal.el.isConnected && modal.sessionId === sessionId) {
        modal.refresh();
      }
    });

    ctx.hooks.on("session.opened", ({ sessionId } = {}) => {
      if (destroyed) return;
      if (sessionId != null) statsCache.delete(sessionId);
      prune();
      for (const e of entries) {
        if (e.sessionId === sessionId && e.el.isConnected) {
          try {
            e.update(false);
          } catch (err) {}
        }
      }
      if (modal && modal.el && modal.el.isConnected && modal.sessionId === sessionId) {
        modal.refresh();
      }
    });

    ctx.system.settings.onChange(() => {
      if (destroyed) return;
      statsCache.clear();
      seenIds.clear();
      prune();
      for (const e of entries) {
        if (e.el.isConnected) {
          try {
            e.update(false);
          } catch (err) {}
        }
      }
      if (modal) {
        if (modal.el && modal.el.isConnected) modal.refresh();
        else modal = null;
      }
    });

    ctx.ui.slot("chat.header", (el, props) => {
      try {
        if (!props || props.sessionId == null) {
          el.innerHTML = "";
          return;
        }

        let state = pillByEl.get(el);
        if (!state || state.sessionId !== props.sessionId) {
          el.innerHTML = "";
          state = createPill(props.sessionId);
          pillByEl.set(el, state);
          el.appendChild(state.root);
        }
        state.update(false);

        let entry = entryByEl.get(el);
        if (!entry || entry.sessionId !== props.sessionId) {
          entry = { sessionId: props.sessionId, el, update: state.update };
          entryByEl.set(el, entry);
          entries.push(entry);
        } else {
          entry.update = state.update;
        }

        return () => {
          if (entryByEl.get(el) === entry) entryByEl.delete(el);
          const i = entries.indexOf(entry);
          if (i >= 0) entries.splice(i, 1);
        };
      } catch (err) {
        try {
          ctx.system.log("聊天计数器：标题栏渲染失败", err);
        } catch (e) {}
      }
    });

    return () => {
      destroyed = true;
      modal = null;
    };
  },
};