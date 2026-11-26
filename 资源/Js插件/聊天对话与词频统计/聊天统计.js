export default {
  manifest: {
    id: "chat-message-counter",
    name: "聊天计数器",
    apiVersion: 1,
    version: "1.4.9",
    author: "散遍温柔",
    description:
      "统计当前会话的消息条数、对话轮数、总字数，支持字词句频次查询、实时更新及可拖动悬浮统计入口",
    permissions: ["chat.read"],
    settings: [
      {
        key: "showFloatingStats",
        label: "是否显示悬浮统计条",
        type: "boolean",
        default: true,
      },
      {
        key: "showToolbarEntry",
        label: "是否显示功能面板入口",
        type: "boolean",
        default: true,
      },
      {
        key: "includeSystem",
        label: "统计时包含系统消息",
        type: "boolean",
        default: false,
      },
    ],
  },

  setup(ctx) {
    const CSS = `
.cc-bar{
  display:flex;
  justify-content:flex-end;
  align-items:center;
  padding:2px 4px 0;
  line-height:1;
}
.cc-floating{
  position:fixed;
  z-index:2147483000;
  inset:auto;
  display:inline-flex;
  width:max-content;
  max-width:calc(100vw - 16px);
  padding:0;
  margin:0;
  border:none;
  background:transparent;
  color:inherit;
  overflow:visible;
  pointer-events:auto;
}
.cc-pill{
  display:inline-flex;
  align-items:center;
  gap:7px;
  padding:6px 11px;
  border-radius:999px;
  border:1px solid rgba(128,128,128,.16);
  background:rgba(128,128,128,.06);
  color:inherit;
  font-family:inherit;
  font-size:12px;
  line-height:1.2;
  white-space:nowrap;
  cursor:grab;
  opacity:.82;
  -webkit-tap-highlight-color:transparent;
  -webkit-user-select:none;
  user-select:none;
  touch-action:none;
  transition:
    opacity .25s ease,
    transform .25s cubic-bezier(.2,.9,.25,1),
    background .25s ease,
    border-color .25s ease,
    box-shadow .25s ease;
  box-shadow:0 0 0 rgba(0,0,0,0);
}
.cc-pill:hover{
  opacity:1;
  transform:translateY(-1px);
  background:rgba(128,128,128,.1);
  border-color:rgba(128,128,128,.28);
  box-shadow:0 5px 18px rgba(0,0,0,.09);
}
.cc-pill:active{
  transform:scale(.96);
}
.cc-pill.cc-dragging{
  cursor:grabbing;
  transform:none;
  opacity:1;
}
.cc-pill:focus-visible,
.cc-menu-button:focus-visible,
.cc-close:focus-visible,
.cc-word-btn:focus-visible,
.cc-word-tag .w-del:focus-visible{
  outline:2px solid currentColor;
  outline-offset:3px;
}
.cc-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:currentColor;
  opacity:.42;
  flex:0 0 auto;
  transition:opacity .2s ease;
}
.cc-pill:hover .cc-dot{
  opacity:.72;
}
.cc-num{
  display:inline-block;
  font-weight:600;
  font-variant-numeric:tabular-nums;
  letter-spacing:.01em;
}
.cc-label{
  opacity:.5;
}
.cc-chev{
  font-size:13px;
  opacity:.3;
  margin-left:-1px;
  transition:transform .25s ease,opacity .25s ease;
}
.cc-pill:hover .cc-chev{
  transform:translateX(1px);
  opacity:.6;
}
.cc-bump{
  animation:ccBump .45s cubic-bezier(.2,.9,.25,1);
}
@keyframes ccBump{
  0%{transform:scale(1);}
  32%{transform:scale(1.16);}
  100%{transform:scale(1);}
}
.cc-ping{
  animation:ccPing .7s ease-out;
}
@keyframes ccPing{
  0%{box-shadow:0 0 0 0 rgba(128,128,128,.5);}
  100%{box-shadow:0 0 0 7px rgba(128,128,128,0);}
}

.cc-modal{
  color:inherit;
  font-family:inherit;
}
.cc-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}
.cc-head-text{
  min-width:0;
}
.cc-title{
  font-size:15px;
  font-weight:650;
  letter-spacing:.01em;
}
.cc-subtitle{
  margin-top:4px;
  font-size:11.5px;
  opacity:.5;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  max-width:260px;
}
.cc-close{
  flex:0 0 auto;
  width:26px;
  height:26px;
  padding:0;
  border:none;
  border-radius:50%;
  background:rgba(128,128,128,.1);
  color:inherit;
  font-size:11px;
  line-height:1;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
  opacity:.55;
  transition:
    opacity .2s ease,
    background .2s ease,
    transform .25s ease;
}
.cc-close:hover{
  opacity:1;
  background:rgba(128,128,128,.18);
  transform:rotate(90deg);
}
.cc-hero{
  margin-top:20px;
  text-align:center;
}
.cc-hero-num{
  display:inline-block;
  font-size:42px;
  font-weight:700;
  line-height:1.05;
  letter-spacing:-.02em;
  font-variant-numeric:tabular-nums;
  background:linear-gradient(180deg,currentColor 8%,rgba(128,128,128,.42));
  -webkit-background-clip:text;
  background-clip:text;
  -webkit-text-fill-color:transparent;
}
.cc-hero-label{
  margin-top:6px;
  font-size:12px;
  opacity:.5;
  letter-spacing:.04em;
}
.cc-hero-sub{
  margin-top:3px;
  font-size:11px;
  opacity:.36;
  font-variant-numeric:tabular-nums;
}
.cc-track{
  display:flex;
  height:6px;
  margin-top:18px;
  border-radius:999px;
  overflow:hidden;
  background:rgba(128,128,128,.13);
}
.cc-seg{
  height:100%;
  width:0;
  background:currentColor;
  transition:width .6s cubic-bezier(.2,.9,.25,1),opacity .3s ease;
}
.cc-seg-u{
  opacity:.22;
}
.cc-seg-t{
  opacity:.6;
}
.cc-legend{
  display:flex;
  justify-content:space-between;
  margin-top:9px;
  font-size:11px;
  opacity:.62;
  font-variant-numeric:tabular-nums;
}
.cc-legend span::before{
  content:"";
  display:inline-block;
  width:6px;
  height:6px;
  border-radius:50%;
  margin-right:5px;
  vertical-align:1px;
  background:currentColor;
}
.cc-lg-u::before{
  opacity:.38;
}
.cc-lg-t::before{
  opacity:1;
}
.cc-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(96px,1fr));
  gap:8px;
  margin-top:14px;
}
.cc-stat{
  display:flex;
  flex-direction:column;
  gap:5px;
  min-width:0;
  padding:10px 12px;
  border-radius:12px;
  background:rgba(128,128,128,.06);
  border:1px solid rgba(128,128,128,.08);
}
.cc-k{
  font-size:10.5px;
  letter-spacing:.05em;
  opacity:.42;
  white-space:nowrap;
}
.cc-v{
  font-size:14px;
  font-weight:600;
  font-variant-numeric:tabular-nums;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cc-v-sm{
  font-size:13px;
  font-weight:550;
}
.cc-word-section{
  margin-top:16px;
  padding-top:14px;
  border-top:1px solid rgba(128,128,128,.12);
}
.cc-word-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:8px;
}
.cc-word-title{
  font-size:10.5px;
  letter-spacing:.08em;
  opacity:.38;
}
.cc-word-form{
  display:flex;
  gap:6px;
}
.cc-word-input{
  flex:1;
  min-width:0;
  padding:5px 10px;
  border-radius:8px;
  border:1px solid rgba(128,128,128,.2);
  background:rgba(128,128,128,.04);
  color:inherit;
  font-family:inherit;
  font-size:12px;
  outline:none;
  transition:border-color .2s ease;
}
.cc-word-input:focus{
  border-color:currentColor;
}
.cc-word-btn{
  padding:5px 10px;
  border-radius:8px;
  border:none;
  background:rgba(128,128,128,.15);
  color:inherit;
  font-family:inherit;
  font-size:12px;
  font-weight:550;
  cursor:pointer;
  opacity:.7;
  transition:opacity .2s ease,background .2s ease;
}
.cc-word-btn:hover{
  opacity:1;
  background:rgba(128,128,128,.25);
}
.cc-word-tags{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  margin-top:8px;
}
.cc-word-tag{
  display:inline-flex;
  align-items:center;
  gap:6px;
  max-width:100%;
  padding:4px 10px;
  border-radius:999px;
  background:rgba(128,128,128,.07);
  border:1px solid rgba(128,128,128,.12);
  font-size:11.5px;
  font-variant-numeric:tabular-nums;
}
.cc-word-tag .w-name{
  opacity:.8;
  overflow-wrap:anywhere;
  min-width:0;
}
.cc-word-tag .w-count{
  font-weight:600;
  opacity:.9;
}
.cc-word-tag .w-del{
  border:none;
  background:none;
  color:inherit;
  font-size:11px;
  cursor:pointer;
  opacity:.3;
  padding:0;
  line-height:1;
  transition:opacity .2s ease;
  flex-shrink:0;
}
.cc-word-tag .w-del:hover{
  opacity:1;
}
.cc-menu-wrap{
  box-sizing:border-box;
  display:flex;
  flex-direction:column;
  gap:6px;
  width:100%;
  padding:4px 0 8px;
  grid-column:1 / -1;
  flex:0 0 100%;
}
.cc-menu-button{
  box-sizing:border-box;
  display:flex;
  align-items:center;
  gap:9px;
  width:100%;
  min-height:42px;
  padding:10px 12px;
  border:1px solid rgba(128,128,128,.14);
  border-radius:12px;
  background:rgba(128,128,128,.06);
  color:inherit;
  font:inherit;
  text-align:left;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
  transition:background .2s ease,transform .2s ease;
}
.cc-menu-button:hover{
  background:rgba(128,128,128,.12);
}
.cc-menu-button:active{
  transform:scale(.98);
}
.cc-menu-icon{
  display:inline-flex;
  width:24px;
  height:24px;
  align-items:center;
  justify-content:center;
  border-radius:8px;
  background:rgba(128,128,128,.12);
  font-size:15px;
  line-height:1;
  flex-shrink:0;
}
.cc-menu-label{
  font-size:13px;
  font-weight:550;
}
.cc-menu-note{
  margin-left:auto;
  font-size:11px;
  opacity:.45;
}

@media (prefers-reduced-motion:reduce){
  .cc-pill,.cc-chev,.cc-seg,.cc-close,.cc-menu-button{
    transition:none !important;
  }
  .cc-bump,.cc-ping{
    animation:none !important;
  }
}
@supports not ((-webkit-background-clip:text) or (background-clip:text)){
  .cc-hero-num{
    background:none;
    -webkit-text-fill-color:currentColor;
  }
}
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

  <div class="cc-track">
    <span class="cc-seg cc-seg-u"></span>
    <span class="cc-seg cc-seg-t"></span>
  </div>

  <div class="cc-legend">
    <span class="cc-lg-u">你 0</span>
    <span class="cc-lg-t">TA 0</span>
  </div>

  <div class="cc-grid">
    <div class="cc-stat">
      <span class="cc-k">对话轮数</span>
      <span class="cc-v cc-v-rounds">0 轮</span>
    </div>
    <div class="cc-stat">
      <span class="cc-k">总字数</span>
      <span class="cc-v cc-v-chars">0</span>
    </div>
    <div class="cc-stat">
      <span class="cc-k">最近消息</span>
      <span class="cc-v cc-v-sm cc-v-last">—</span>
    </div>
  </div>

  <div class="cc-word-section">
    <div class="cc-word-header">
      <span class="cc-word-title">字词句出现频次查询</span>
    </div>
    <form class="cc-word-form" autocomplete="off">
      <input
        class="cc-word-input"
        type="text"
        aria-label="要查询的字词句"
        placeholder="输入要查询的字、词或句子..."
        maxlength="30"
      />
      <button class="cc-word-btn" type="submit">查询</button>
    </form>
    <div class="cc-word-tags"></div>
  </div>
</div>`;

    const POSITION_KEY = "floatingStatsPosition.v2";
    const DEFAULT_DOWN_OFFSET = 36;
    const EDGE_GAP = 8;
    const DRAG_THRESHOLD = 6;
    const PANEL_ANCHOR_TEXTS = [
      "照片墙",
      "文字图片",
      "系统指令",
      "番外指令模式",
      "番外指令",
    ];

    const statsCache = new Map();
    const textCache = new Map();
    const seenIds = new Map();
    const headerEntries = new Set();
    const toolbarEntries = new Set();

    let currentSessionId = null;
    let destroyed = false;
    let modal = null;
    let trackedWords = ["爱", "喜欢", "哈哈", "抱抱", "想你"];

    function logError(label, error) {
      try {
        ctx.system.log("聊天计数器：" + label, error);
      } catch (_) {}
    }

    function includeSystem() {
      return ctx.system.settings.get("includeSystem") === true;
    }

    function showFloatingStats() {
      return ctx.system.settings.get("showFloatingStats") !== false;
    }

    function showToolbarEntry() {
      return ctx.system.settings.get("showToolbarEntry") !== false;
    }

    function fmt(n) {
      const value = Number(n);
      return Number.isFinite(value)
        ? value.toLocaleString("zh-CN")
        : "0";
    }

    function pad(n) {
      return n < 10 ? "0" + n : String(n);
    }

    function fmtDate(t) {
      if (t == null) return "—";

      const date = new Date(t);
      if (Number.isNaN(date.getTime())) return "—";

      return (
        date.getFullYear() +
        "/" +
        pad(date.getMonth() + 1) +
        "/" +
        pad(date.getDate())
      );
    }

    function fmtRel(t) {
      if (t == null) return "—";

      const diff = Date.now() - t;
      if (!Number.isFinite(diff)) return "—";
      if (diff < 0) return fmtDate(t);
      if (diff < 60000) return "刚刚";
      if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
      if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";

      if (diff < 30 * 86400000) {
        return Math.floor(diff / 86400000) + " 天前";
      }

      return fmtDate(t);
    }

    function timeOf(message) {
      if (!message) return null;

      const keys = [
        "createdAt",
        "timestamp",
        "time",
        "created_at",
        "ts",
        "updatedAt",
      ];

      for (const key of keys) {
        const value = message[key];

        if (value == null) continue;

        if (value instanceof Date) {
          const t = value.getTime();
          if (Number.isFinite(t)) return t;
          continue;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
          return value < 1e11 ? value * 1000 : value;
        }

        if (typeof value === "string" && value.trim() !== "") {
          const number = Number(value);

          if (Number.isFinite(number)) {
            return number < 1e11 ? number * 1000 : number;
          }

          const t = Date.parse(value);
          if (!Number.isNaN(t)) return t;
        }
      }

      return null;
    }

    function extractText(content) {
      if (content == null) return "";
      if (typeof content === "string") return content;

      if (
        typeof content === "number" ||
        typeof content === "boolean"
      ) {
        return String(content);
      }

      if (Array.isArray(content)) {
        let text = "";

        for (const part of content) {
          if (part == null) continue;

          if (typeof part === "string") {
            text += part;
          } else if (typeof part === "object") {
            if (typeof part.text === "string") {
              text += part.text;
            } else if (typeof part.content === "string") {
              text += part.content;
            } else if (typeof part.value === "string") {
              text += part.value;
            }
          }
        }

        return text;
      }

      if (typeof content === "object") {
        if (typeof content.text === "string") return content.text;
        if (typeof content.content === "string") return content.content;
        if (Array.isArray(content.parts)) return extractText(content.parts);
      }

      return "";
    }

    function textOf(message) {
      if (!message) return "";

      return extractText(
        message.content == null ? message.text : message.content
      );
    }

    function countChars(text) {
      if (!text) return 0;

      return String(text)
        .replace(/\s+/g, "")
        .replace(/[*#`~_>|]/g, "")
        .length;
    }

    function displayTotal(stats) {
      if (!stats) return 0;

      return (
        stats.user +
        stats.assistant +
        (includeSystem() ? stats.system : 0)
      );
    }

    function roundsOf(stats) {
      return stats ? Math.min(stats.user, stats.assistant) : 0;
    }

    function safeSession(sessionId) {
      try {
        return ctx.data.sessions.get(sessionId) || null;
      } catch (_) {
        return null;
      }
    }

function sessionTitle(session) {
      if (!session) return "当前会话";
      return session.title || session.name || (session.contact && session.contact.name) || "当前会话";
    }

    function charNameOf(session) {
      if (!session) return "当前会话";
      const id = session.characterId != null ? session.characterId : session.contactId;
      if (id != null) {
        try {
          const c = ctx.data.characters.get(id);
          if (c && (c.name || c.nickname || c.title)) {
            return c.name || c.nickname || c.title;
          }
        } catch (e) {}
      }
      return sessionTitle(session);
    }

    function countWordOccurrences(text, word) {
      if (!text || !word) return 0;

      let count = 0;
      let position = 0;

      while (true) {
        position = text.indexOf(word, position);
        if (position === -1) break;

        count++;
        position += word.length;
      }

      return count;
    }

    function shouldCountText(role) {
      return (
        role === "user" ||
        role === "assistant" ||
        (role === "system" && includeSystem())
      );
    }

    function addToStats(stats, message) {
      const role = message.role;

      if (role === "user") stats.user++;
      else if (role === "assistant") stats.assistant++;
      else if (role === "system") stats.system++;

      if (!shouldCountText(role)) return "";

      const text = textOf(message);
      stats.chars += countChars(text);

      const t = timeOf(message);

      if (t != null) {
        if (stats.first == null || t < stats.first) stats.first = t;
        if (stats.last == null || t > stats.last) stats.last = t;
      }

      return text + "\n";
    }

    function computeStats(sessionId) {
      const stats = {
        user: 0,
        assistant: 0,
        system: 0,
        chars: 0,
        first: null,
        last: null,
      };

      let messages = ctx.data.messages.list(sessionId);
      if (!Array.isArray(messages)) messages = [];

      const ids = new Set();
      const texts = [];

      for (const message of messages) {
        if (!message) continue;

        if (message.id != null) ids.add(message.id);
        texts.push(addToStats(stats, message));
      }

      statsCache.set(sessionId, stats);
      textCache.set(sessionId, texts.join(""));
      seenIds.set(sessionId, ids);

      return stats;
    }

    function getStats(sessionId) {
      return statsCache.get(sessionId) || computeStats(sessionId);
    }

    function getFullText(sessionId) {
      if (!textCache.has(sessionId)) computeStats(sessionId);
      return textCache.get(sessionId) || "";
    }

    function invalidate(sessionId) {
      statsCache.delete(sessionId);
      textCache.delete(sessionId);
      seenIds.delete(sessionId);
    }

    function clearCaches() {
      statsCache.clear();
      textCache.clear();
      seenIds.clear();
    }

    function pulse(node, className) {
      if (!node) return;

      node.classList.remove(className);
      void node.offsetWidth;
      node.classList.add(className);
    }

    function clamp(value, min, max) {
      return Math.max(min, Math.min(value, Math.max(min, max)));
    }

    function viewportBounds() {
      const viewport = window.visualViewport;

      const left = viewport ? viewport.offsetLeft : 0;
      const top = viewport ? viewport.offsetTop : 0;
      const width = viewport
        ? viewport.width
        : document.documentElement.clientWidth || window.innerWidth;
      const height = viewport
        ? viewport.height
        : window.innerHeight;

      return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
      };
    }

    function readPosition() {
      try {
        const position = ctx.system.storage.get(POSITION_KEY);

        if (
          position &&
          Number.isFinite(position.x) &&
          Number.isFinite(position.y)
        ) {
          return {
            x: clamp(position.x, 0, 1),
            y: clamp(position.y, 0, 1),
          };
        }
      } catch (error) {
        logError("读取悬浮位置失败", error);
      }

      return null;
    }

    function writePosition(root) {
      const rect = root.getBoundingClientRect();
      const bounds = viewportBounds();

      const availableWidth = Math.max(
        0,
        bounds.width - EDGE_GAP * 2 - rect.width
      );

      const availableHeight = Math.max(
        0,
        bounds.height - EDGE_GAP * 2 - rect.height
      );

      const position = {
        x:
          availableWidth > 0
            ? clamp(
                (rect.left - bounds.left - EDGE_GAP) / availableWidth,
                0,
                1
              )
            : 0,
        y:
          availableHeight > 0
            ? clamp(
                (rect.top - bounds.top - EDGE_GAP) / availableHeight,
                0,
                1
              )
            : 0,
      };

      try {
        ctx.system.storage.set(POSITION_KEY, position);
      } catch (error) {
        logError("保存悬浮位置失败", error);
      }
    }

    function createFloatingPill(host, sessionId) {
      const root = document.createElement("div");
      root.className = "cc-bar";
      root.style.visibility = "hidden";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "cc-pill";
      button.title = "点击查看聊天统计，按住可拖动";
      button.setAttribute(
        "aria-label",
        "查看聊天统计；按住可以拖动位置"
      );

      button.innerHTML =
        '<span class="cc-dot" aria-hidden="true"></span>' +
        '<span class="cc-num">0</span>' +
        '<span class="cc-label">条消息</span>' +
        '<span class="cc-chev" aria-hidden="true">›</span>';

      root.appendChild(button);
      host.replaceChildren(root);

      const number = button.querySelector(".cc-num");
      const dot = button.querySelector(".cc-dot");
      const originalDisplay = host.style.display;
      const supportsPopover = typeof root.showPopover === "function";

      let disposed = false;
      let initialized = false;
      let initFrame = null;
      let lastTotal = null;
      let localX = 0;
      let localY = 0;
      let pointer = null;
      let suppressClick = false;
      let modalHidden = false;

      function syncTopLayer(show) {
        if (!supportsPopover || !initialized || !root.isConnected) return;
        try {
          if (show) {
            if (!root.matches(":popover-open")) root.showPopover();
          } else {
            if (root.matches(":popover-open")) root.hidePopover();
          }
        } catch (_) {}
      }

      // 用实际尺寸推算比例，兼容宿主外层存在缩放的情况。
      function scaleOfRoot() {
        const rect = root.getBoundingClientRect();

        return {
          x: root.offsetWidth > 0 ? rect.width / root.offsetWidth : 1,
          y: root.offsetHeight > 0 ? rect.height / root.offsetHeight : 1,
        };
      }

      function moveToClient(left, top) {
        const rect = root.getBoundingClientRect();
        const scale = scaleOfRoot();

        localX += (left - rect.left) / (scale.x || 1);
        localY += (top - rect.top) / (scale.y || 1);

        root.style.left = localX + "px";
        root.style.top = localY + "px";
      }

      function keepInViewport() {
        if (!initialized || disposed || !root.isConnected) return;

        const rect = root.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const bounds = viewportBounds();

        const left = clamp(
          rect.left,
          bounds.left + EDGE_GAP,
          bounds.right - EDGE_GAP - rect.width
        );

        const top = clamp(
          rect.top,
          bounds.top + EDGE_GAP,
          bounds.bottom - EDGE_GAP - rect.height
        );

        moveToClient(left, top);
      }

      function restoreSavedPosition(position) {
        const bounds = viewportBounds();
        const rect = root.getBoundingClientRect();

        const width = Math.max(
          0,
          bounds.width - EDGE_GAP * 2 - rect.width
        );

        const height = Math.max(
          0,
          bounds.height - EDGE_GAP * 2 - rect.height
        );

        moveToClient(
          bounds.left + EDGE_GAP + width * position.x,
          bounds.top + EDGE_GAP + height * position.y
        );
      }

      function initializePosition() {
        initFrame = null;

        if (
          disposed ||
          destroyed ||
          !showFloatingStats() ||
          !root.isConnected
        ) {
          return;
        }

        if (!initialized) {
          // 先测量原来的顶部栏圆条位置。
          root.className = "cc-bar";
          root.style.left = "";
          root.style.top = "";

          const originalRect = button.getBoundingClientRect();

          if (originalRect.width === 0 || originalRect.height === 0) {
            return;
          }

          root.className = "cc-bar cc-floating";
          if (supportsPopover) {
            root.setAttribute("popover", "manual");
          }
          root.style.left = "0px";
          root.style.top = "0px";

          localX = 0;
          localY = 0;
          initialized = true;

          syncTopLayer(!modalHidden);

          const saved = readPosition();

          if (saved) {
            restoreSavedPosition(saved);
          } else {
            // 首次在原位置基础上，正下方移动 36 像素。
            moveToClient(
              originalRect.left,
              originalRect.top + DEFAULT_DOWN_OFFSET
            );
          }
        } else {
          syncTopLayer(!modalHidden);
        }

        keepInViewport();
        root.style.visibility = modalHidden ? "hidden" : "visible";
      }

      function schedulePosition() {
        if (initFrame != null || disposed) return;
        initFrame = requestAnimationFrame(initializePosition);
      }

      function finishPointer(save) {
        if (!pointer) return;

        const previous = pointer;
        pointer = null;

        button.classList.remove("cc-dragging");

        try {
          if (button.hasPointerCapture(previous.id)) {
            button.releasePointerCapture(previous.id);
          }
        } catch (_) {}

        if (previous.moved && save && initialized) {
          keepInViewport();
          writePosition(root);
        }
      }

      function onPointerDown(event) {
        if (
          disposed ||
          destroyed ||
          !initialized ||
          pointer ||
          event.isPrimary === false ||
          (event.pointerType === "mouse" && event.button !== 0)
        ) {
          return;
        }

        suppressClick = false;

        const rect = root.getBoundingClientRect();

        pointer = {
          id: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          left: rect.left,
          top: rect.top,
          moved: false,
        };

        try {
          button.setPointerCapture(event.pointerId);
        } catch (_) {}
      }

      function onPointerMove(event) {
        if (!pointer || event.pointerId !== pointer.id) return;

        const dx = event.clientX - pointer.startX;
        const dy = event.clientY - pointer.startY;

        if (
          !pointer.moved &&
          Math.hypot(dx, dy) < DRAG_THRESHOLD
        ) {
          return;
        }

        pointer.moved = true;
        suppressClick = true;
        button.classList.add("cc-dragging");

        if (event.cancelable) event.preventDefault();

        moveToClient(pointer.left + dx, pointer.top + dy);
        keepInViewport();
      }

      function onPointerUp(event) {
        if (!pointer || event.pointerId !== pointer.id) return;
        finishPointer(true);
      }

      function onPointerCancel(event) {
        if (!pointer || event.pointerId !== pointer.id) return;

        suppressClick = true;
        finishPointer(true);
      }

      function onLostPointerCapture(event) {
        if (!pointer || event.pointerId !== pointer.id) return;
        finishPointer(true);
      }

      function onClick(event) {
        if (destroyed || disposed) return;

        // 键盘触发的点击 detail 为 0，应继续允许打开。
        if (suppressClick && event.detail !== 0) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick = false;
          return;
        }

        openStatsModal(sessionId);
      }

      function onResize() {
        if (disposed || !showFloatingStats()) return;
        schedulePosition();
      }

      function setHidden(hidden) {
        modalHidden = Boolean(hidden);
        if (modalHidden) {
          syncTopLayer(false);
          root.style.visibility = "hidden";
        } else if (showFloatingStats() && initialized) {
          syncTopLayer(true);
          root.style.visibility = "visible";
        }
      }

      function update(animate) {
        if (disposed || destroyed) return;

        const visible = showFloatingStats();
        host.style.display = visible ? originalDisplay : "none";

        if (!visible) {
          finishPointer(true);
          syncTopLayer(false);
          return;
        }

        const total = displayTotal(getStats(sessionId));
        number.textContent = fmt(total);

        if (
          animate &&
          lastTotal != null &&
          lastTotal !== total
        ) {
          pulse(number, "cc-bump");
          pulse(dot, "cc-ping");
        }

        lastTotal = total;

        button.title =
          "当前会话 " +
          fmt(total) +
          " 条消息；点击查看，按住拖动";

        schedulePosition();
      }

      button.addEventListener("pointerdown", onPointerDown);
      button.addEventListener("pointermove", onPointerMove);
      button.addEventListener("pointerup", onPointerUp);
      button.addEventListener("pointercancel", onPointerCancel);
      button.addEventListener(
        "lostpointercapture",
        onLostPointerCapture
      );
      button.addEventListener("click", onClick);

      window.addEventListener("resize", onResize);

      const visualViewport = window.visualViewport;

      if (visualViewport) {
        visualViewport.addEventListener("resize", onResize);
        visualViewport.addEventListener("scroll", onResize);
      }

      let resizeObserver = null;

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(root);
      }

      function dispose() {
        if (disposed) return;

        finishPointer(false);
        syncTopLayer(false);
        disposed = true;

        if (initFrame != null) {
          cancelAnimationFrame(initFrame);
          initFrame = null;
        }

        button.removeEventListener("pointerdown", onPointerDown);
        button.removeEventListener("pointermove", onPointerMove);
        button.removeEventListener("pointerup", onPointerUp);
        button.removeEventListener("pointercancel", onPointerCancel);
        button.removeEventListener(
          "lostpointercapture",
          onLostPointerCapture
        );
        button.removeEventListener("click", onClick);

        window.removeEventListener("resize", onResize);

        if (visualViewport) {
          visualViewport.removeEventListener("resize", onResize);
          visualViewport.removeEventListener("scroll", onResize);
        }

        if (resizeObserver) resizeObserver.disconnect();

        root.remove();
        host.style.display = originalDisplay;
      }

      return { root, update, setHidden, dispose };
    }

    function refreshHeaders(sessionId, animate) {
      for (const entry of headerEntries) {
        if (!entry.el.isConnected) continue;

        if (
          sessionId != null &&
          entry.sessionId !== sessionId
        ) {
          continue;
        }

        try {
          entry.update(animate);
        } catch (error) {
          logError("悬浮统计更新失败", error);
        }
      }
    }

    function refreshToolbars() {
      for (const entry of toolbarEntries) {
        try {
          entry.update();
        } catch (error) {
          logError("功能面板入口更新失败", error);
        }
      }
    }

    function refreshModal(sessionId) {
      if (!modal) return;

      if (!modal.el.isConnected) {
        modal.dispose();
        return;
      }

      if (
        sessionId == null ||
        modal.sessionId === sessionId
      ) {
        modal.refresh();
      }
    }

    function setFloatingHidden(hidden) {
      for (const entry of headerEntries) {
        entry.setHidden(hidden);
      }
    }

    function openStatsModal(sessionId) {
      if (destroyed || sessionId == null) return;

      try {
        computeStats(sessionId);
      } catch (error) {
        logError("读取聊天记录失败", error);
        ctx.ui.toast("读取聊天记录失败，请稍后重试。");
        return;
      }

      if (modal) modal.close();

      try {
        ctx.ui.openModal((el, api) => {
          el.style.width = "min(390px, 92vw)";
          el.style.maxWidth = "92vw";
          el.style.maxHeight = "86vh";
          el.style.overflow = "auto";
          el.style.boxSizing = "border-box";
          el.style.padding = "18px 18px 16px";
          el.innerHTML = MODAL_HTML;

          const number = el.querySelector(".cc-hero-num");
          const subtitle = el.querySelector(".cc-subtitle");
          const segmentUser = el.querySelector(".cc-seg-u");
          const segmentAssistant = el.querySelector(".cc-seg-t");
          const legendUser = el.querySelector(".cc-lg-u");
          const legendAssistant = el.querySelector(".cc-lg-t");
          const rounds = el.querySelector(".cc-v-rounds");
          const chars = el.querySelector(".cc-v-chars");
          const last = el.querySelector(".cc-v-last");
          const closeButton = el.querySelector(".cc-close");
          const form = el.querySelector(".cc-word-form");
          const input = el.querySelector(".cc-word-input");
          const tags = el.querySelector(".cc-word-tags");

          let disposed = false;
          let lastTotal = null;
          let animationId = null;
          let observer = null;

          function stopAnimation() {
            if (animationId != null) {
              cancelAnimationFrame(animationId);
              animationId = null;
            }
          }

          function dispose() {
            if (disposed) return;
            disposed = true;

            stopAnimation();
            document.removeEventListener("keydown", onKey);

            if (observer) observer.disconnect();

            if (modal && modal.el === el) {
              modal = null;
              setFloatingHidden(false);
            }
          }

          function close() {
            dispose();

            try {
              api.close();
            } catch (_) {}
          }

          function onKey(event) {
            if (event.key === "Escape" && el.isConnected) {
              close();
            }
          }

          function animateTotal(total) {
            stopAnimation();

            let reduceMotion = false;

            try {
              reduceMotion = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
              ).matches;
            } catch (_) {}

            if (reduceMotion || total === 0) {
              number.textContent = fmt(total);
              return;
            }

            const start = performance.now();

            function step(now) {
              animationId = null;

              if (disposed || !el.isConnected) return;

              const progress = Math.min(1, (now - start) / 650);
              const eased = 1 - Math.pow(1 - progress, 3);

              number.textContent = fmt(
                Math.round(total * eased)
              );

              if (progress < 1) {
                animationId = requestAnimationFrame(step);
              }
            }

            animationId = requestAnimationFrame(step);
          }

          function renderWords() {
            tags.replaceChildren();

            const fullText = getFullText(sessionId);

            for (const word of trackedWords) {
              const tag = document.createElement("span");
              tag.className = "cc-word-tag";

              const name = document.createElement("span");
              name.className = "w-name";
              name.textContent = word;

              const count = document.createElement("span");
              count.className = "w-count";
              count.textContent = fmt(
                countWordOccurrences(fullText, word)
              );

              const remove = document.createElement("button");
              remove.type = "button";
              remove.className = "w-del";
              remove.textContent = "✕";
              remove.title = "删除";
              remove.setAttribute(
                "aria-label",
                "删除查询词：" + word
              );

              remove.addEventListener("click", () => {
                trackedWords = trackedWords.filter(
                  (item) => item !== word
                );
                renderWords();
              });

              tag.append(name, count, remove);
              tags.appendChild(tag);
            }
          }

          function render(first) {
            if (disposed) return;

            const stats = getStats(sessionId);
            const total = displayTotal(stats);

            subtitle.textContent = charNameOf(
              safeSession(sessionId)
            );

            if (first) {
              animateTotal(total);
            } else {
              stopAnimation();
              number.textContent = fmt(total);

              if (
                lastTotal != null &&
                total !== lastTotal
              ) {
                pulse(number, "cc-bump");
              }
            }

            lastTotal = total;

            const denominator = stats.user + stats.assistant;

            const userPercent =
              denominator > 0
                ? (stats.user / denominator) * 100
                : 50;

            segmentUser.style.width = "0%";
            segmentAssistant.style.width = "0%";
            
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (disposed) return;
                segmentUser.style.width = userPercent.toFixed(2) + "%";
                segmentAssistant.style.width = (100 - userPercent).toFixed(2) + "%";
              });
            });

            legendUser.textContent = "你 " + fmt(stats.user);
            legendAssistant.textContent =
              "TA " + fmt(stats.assistant);

            rounds.textContent =
              fmt(roundsOf(stats)) + " 轮";

            chars.textContent = fmt(stats.chars) + " 字";
            last.textContent = fmtRel(stats.last);

            renderWords();
          }

          closeButton.addEventListener("click", close);
          document.addEventListener("keydown", onKey);

          form.addEventListener("submit", (event) => {
            event.preventDefault();

            const word = input.value.trim();
            if (!word) return;

            if (!trackedWords.includes(word)) {
              trackedWords.push(word);
            }

            input.value = "";
            renderWords();
          });

          // 监听浮层移除，以便遮罩关闭时清理键盘事件。
          observer = new MutationObserver(() => {
            if (!el.isConnected) dispose();
          });

          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
          });

          modal = {
            sessionId,
            el,
            close,
            dispose,
            refresh() {
              try {
                render(false);
              } catch (error) {
                logError("统计面板更新失败", error);
              }
            },
          };

          setFloatingHidden(true);
          render(true);
        });
      } catch (error) {
        if (modal && modal.sessionId === sessionId) {
          modal.close();
        }

        logError("打开统计面板失败", error);
        ctx.ui.toast("打开统计面板失败，请稍后重试。");
      }
    }

    function isVisibleElement(node) {
      if (!node || !node.isConnected) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function lowestCommonAncestor(nodes) {
      if (!nodes.length) return null;
      let ancestor = nodes[0].parentElement;
      while (
        ancestor &&
        ancestor !== document.body &&
        ancestor !== document.documentElement
      ) {
        if (nodes.every((n) => ancestor.contains(n))) return ancestor;
        ancestor = ancestor.parentElement;
      }
      return null;
    }

    function findAnchorNodes(ownRoot) {
      const matched = [];
      const seen = new Set();
      const all = document.querySelectorAll(
        "button, [role='button'], div, span, p, label"
      );

      for (const el of all) {
        if (!el || el === ownRoot || ownRoot.contains(el)) continue;
        if (el.closest(".cc-modal, .cc-floating, .cc-menu-wrap")) continue;

        const text = (el.textContent || "").trim();
        if (!text || text.length > 12) continue;

        const hit = PANEL_ANCHOR_TEXTS.find(
          (kw) => text === kw || text.includes(kw)
        );
        if (!hit) continue;

        // 优先取包含该文字的最内层节点，再向上定位到按钮/条目本身
        const hasMatchingChild = Array.from(el.children).some((child) => {
          const ct = (child.textContent || "").trim();
          return ct && PANEL_ANCHOR_TEXTS.some((kw) => ct === kw || ct.includes(kw));
        });
        if (hasMatchingChild) continue;

        const item = el.closest("button, [role='button']") || el;
        if (seen.has(item) || !isVisibleElement(item)) continue;
        seen.add(item);
        matched.push(item);
      }

      return matched;
    }

    function findPanelContainer(ownRoot) {
      const anchors = findAnchorNodes(ownRoot);
      if (anchors.length >= 2) {
        const lca = lowestCommonAncestor(anchors);
        if (
          lca &&
          lca !== document.body &&
          lca !== document.documentElement
        ) {
          return lca;
        }
      }

      if (anchors.length === 1) {
        const parent = anchors[0].parentElement;
        if (
          parent &&
          parent !== document.body &&
          parent !== document.documentElement
        ) {
          return parent;
        }
      }

      return null;
    }

    ctx.hooks.on("message.persisted", ({ message } = {}) => {
      if (
        destroyed ||
        !message ||
        message.sessionId == null
      ) {
        return;
      }

      const sessionId = message.sessionId;
      const stats = statsCache.get(sessionId);
      const ids = seenIds.get(sessionId);

      if (stats && ids) {
        if (message.id == null) {
          invalidate(sessionId);
        } else {
          if (ids.has(message.id)) return;

          ids.add(message.id);

          const text = addToStats(stats, message);

          textCache.set(
            sessionId,
            (textCache.get(sessionId) || "") + text
          );
        }
      }

      refreshHeaders(sessionId, true);
      refreshModal(sessionId);
    });

    ctx.hooks.on("message.deleted", ({ sessionId } = {}) => {
      if (destroyed || sessionId == null) return;

      invalidate(sessionId);
      refreshHeaders(sessionId, false);
      refreshModal(sessionId);
    });

    ctx.hooks.on("message.updated", () => {
      if (destroyed) return;

      clearCaches();
      refreshHeaders(null, false);
      refreshModal(null);
    });

    ctx.hooks.on("session.opened", ({ sessionId } = {}) => {
      if (destroyed) return;

      currentSessionId =
        sessionId == null ? null : sessionId;

      if (sessionId == null) return;

      invalidate(sessionId);
      refreshHeaders(sessionId, false);
      refreshModal(sessionId);
    });

    ctx.system.settings.onChange(() => {
      if (destroyed) return;

      clearCaches();
      refreshHeaders(null, false);
      refreshToolbars();
      refreshModal(null);
    });

    ctx.ui.slot("chat.header", (el, props) => {
      if (destroyed) return;

      if (!props || props.sessionId == null) {
        el.replaceChildren();
        return;
      }

      const sessionId = props.sessionId;

      // 无论开关是否开启，都记录当前会话。
      currentSessionId = sessionId;

      let floating = null;

      try {
        floating = createFloatingPill(el, sessionId);
      } catch (error) {
        logError("创建悬浮统计失败", error);
        return;
      }

      const entry = {
        el,
        sessionId,
        root: floating.root,
        update(animate) {
          floating.update(animate);
        },
        setHidden(hidden) {
          floating.setHidden(hidden);
        },
        dispose() {
          floating.dispose();
        },
      };

      headerEntries.add(entry);

      try {
        entry.update(false);
      } catch (error) {
        logError("悬浮统计渲染失败", error);
      }

      return () => {
        headerEntries.delete(entry);
        entry.dispose();
      };
    });

    ctx.ui.slot("chat.inputToolbar", (el) => {
      if (destroyed) return;

      const root = document.createElement("div");
      root.className = "cc-menu-wrap";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "cc-menu-button";
      button.setAttribute("aria-label", "打开聊天统计");

      button.innerHTML =
        '<span class="cc-menu-icon" aria-hidden="true">▤</span>' +
        '<span class="cc-menu-label">聊天统计</span>' +
        '<span class="cc-menu-note">查看本会话数据</span>';

      button.addEventListener("click", () => {
        if (destroyed) return;

        if (currentSessionId == null) {
          ctx.ui.toast(
            "尚未获取当前会话，请退出聊天后重新进入。"
          );
          return;
        }

        openStatsModal(currentSessionId);
      });

      root.appendChild(button);

      let disposed = false;
      let panelObserver = null;
      let observedPanel = null;
      let mountFrame = null;
      const timers = [];

      function attachToPanelTop() {
        mountFrame = null;
        if (disposed || destroyed) return;

        if (!showToolbarEntry()) {
          if (panelObserver) {
            panelObserver.disconnect();
            panelObserver = null;
          }
          observedPanel = null;
          root.remove();
          return;
        }

        const panel = findPanelContainer(root);

        if (panel) {
          if (root.parentNode !== panel || panel.firstElementChild !== root) {
            panel.prepend(root);
          }

          if (observedPanel !== panel) {
            if (panelObserver) panelObserver.disconnect();
            observedPanel = panel;
            panelObserver = new MutationObserver(() => {
              if (disposed || destroyed || !showToolbarEntry()) return;
              if (root.parentNode !== panel || panel.firstElementChild !== root) {
                panel.prepend(root);
              }
            });
            panelObserver.observe(panel, { childList: true });
          }
        } else if (root.parentNode !== el) {
          el.replaceChildren(root);
        }
      }

      const entry = {
        update() {
          attachToPanelTop();
        },
      };
      toolbarEntries.add(entry);

      attachToPanelTop();
      mountFrame = requestAnimationFrame(attachToPanelTop);
      timers.push(ctx.system.timers.setTimeout(attachToPanelTop, 120));
      timers.push(ctx.system.timers.setTimeout(attachToPanelTop, 350));

      return () => {
        disposed = true;
        toolbarEntries.delete(entry);
        if (mountFrame != null) {
          cancelAnimationFrame(mountFrame);
          mountFrame = null;
        }
        for (const cancel of timers) {
          try {
            if (typeof cancel === "function") cancel();
          } catch (_) {}
        }
        if (panelObserver) {
          panelObserver.disconnect();
          panelObserver = null;
        }
        observedPanel = null;
        root.remove();
      };
    });

    return () => {
      destroyed = true;
      currentSessionId = null;

      if (modal) modal.close();

      for (const entry of headerEntries) {
        entry.dispose();
      }

      headerEntries.clear();
      toolbarEntries.clear();
      clearCaches();
    };
  },
};