export default {
  manifest: {
    id: "imessage-reaction",
    name: "消息表情回应",
    apiVersion: 1,
    version: "3.7.7",
    author: "小坊",
    description: "长按消息，用 emoji 回应对方的消息",
    permissions: ["chat.read"],
    settings: [
      { key: "injectPrompt", label: "在提示词中注入用户的回应状态与触发指令", type: "boolean", default: true },
      { key: "preventOverflowClip", label: "允许Emoji超出气泡边界显示", type: "boolean", default: false },
    ],
  },

  setup(ctx) {
    /* ============================================================ */
    /* 状态                                                          */
    /* ============================================================ */
    const rerenderMap = new Map();
    const messageMap = new Map();
    const emojiCache = new Map();
    const recoveryAttempted = new Set();
    let settingsUnsubscribe = null;
    let userCssEl = null;
    // FIX(#7): 缓存 CSS 变量的 px 读取，避免每次长按都触发 style recalc
    const cssVarCache = new Map();

    let activePicker = null;
    let activeMenu = null;
    let pendingBubble = null;

    let menuWatchEnabled = false;
    let menuWatchTimer = null;
    let menuObserver = null;
    let menuObserverArmed = false;

    // FIX(#3): 所有对 reaction 相关 storage 的读-改-写都走这条队列，
    // 把 llm.response / 用户点击 emoji / 撤回 三类写入串行化，避免并发覆盖。
    let reactionOpChain = Promise.resolve();
    const runReactionOp = (fn) => {
      const next = reactionOpChain.then(fn, fn);
      reactionOpChain = next.catch(() => {});
      return next;
    };

    /* ============================================================ */
    /* 常量                                                          */
    /* ============================================================ */
    const DEFAULT_QUICK_EMOJIS = ["❤️", "👍", "👎", "😂", "‼️", "❓", "🔥", "🥺", "🥰", "😭", "✨", "🎉", "👏"];
    const MAX_PROMPT_REACTIONS = 5;
    const MAX_CHAR_REACTION_HISTORY = 100;
    const MAX_PRESET_EMOJIS = 30;
    const MAX_USER_HISTORY = 200;
    const MENU_WATCH_MS = 1500;
    const MAX_USER_CSS_LEN = 64 * 1024;

    const MAX_CSS_PRESETS = 20;
    const MAX_PRESET_NAME_LEN = 24;
    const CSS_PRESETS_KEY = "css_presets";

    const MAX_IMPORT_FILE_BYTES = 256 * 1024;
    const DEFAULT_EXPORT_NAME = "reaction-style";

    // FIX(#11): 给内部 Map 加软上限，防止宿主未卸载旧气泡时内存无上限增长
    const MAX_MESSAGE_MAP = 2000;
    const MAX_EMOJI_CACHE = 2000;

    const EMOJI_FONT_STACK = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", "EmojiOne Color", "Android Emoji", sans-serif`;

    /* ============================================================ */
    /* 工具函数                                                      */
    /* ============================================================ */
    const escapeHtml = (str) => String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const contentToString = (content) => {
      if (content == null) return "";
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        const parts = [];
        for (const p of content) {
          if (p == null) continue;
          if (typeof p === "string") { parts.push(p); continue; }
          if (typeof p === "object") {
            if (typeof p.text === "string") parts.push(p.text);
            else if (typeof p.content === "string") parts.push(p.content);
          }
        }
        return parts.join("");
      }
      if (typeof content === "object" && typeof content.text === "string") return content.text;
      return String(content);
    };

    const EMOJI_SEGMENTER = (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function")
      ? new Intl.Segmenter("en", { granularity: "grapheme" })
      : null;
    const EMOJI_CLUSTER_RE = /[\p{Extended_Pictographic}\u200D\uFE0F\uFE0E\u20E3\u{1F3FB}-\u{1F3FF}]/u;

    const sanitizeEmoji = (raw) => {
      if (!raw) return "";
      const str = String(raw).replace(/<[^>]*>/g, "");
      const out = [];
      if (EMOJI_SEGMENTER) {
        for (const seg of EMOJI_SEGMENTER.segment(str)) {
          if (EMOJI_CLUSTER_RE.test(seg.segment)) out.push(seg.segment.trim());
          if (out.length >= 8) break;
        }
      } else {
        for (const ch of Array.from(str)) {
          if (EMOJI_CLUSTER_RE.test(ch)) out.push(ch);
          if (out.length >= 8) break;
        }
      }
      return out.join("");
    };

    const sanitizeMsgText = (text) => contentToString(text)
      .replace(/[\r\n\[\]`"'{}<>]/g, "")
      .slice(0, 30);

    const sanitizeForMatch = (text) => {
      const r = contentToString(text).replace(/[\s\p{P}]/gu, "").slice(0, 30);
      return r || null;
    };
    const safeTextEq = (a, b) => {
      const ka = sanitizeForMatch(a), kb = sanitizeForMatch(b);
      return ka !== null && kb !== null && ka === kb;
    };

    // FIX(#11): Map 软裁剪工具
    const trimMapTo = (map, max) => {
      if (map.size <= max) return;
      const toDelete = map.size - max;
      let i = 0;
      for (const k of map.keys()) {
        if (i++ >= toDelete) break;
        map.delete(k);
      }
    };

    /* ------------------------------------------------------------ */
    /* 消息归属解析                                                  */
    /* ------------------------------------------------------------ */
    const resolveTargetRole = (record, sessionId, responderKind) => {
      if (record && (record.role === "user" || record.role === "assistant")) {
        return record.role;
      }
      if (record && record.msgId != null && sessionId) {
        try {
          const list = ctx.data.messages.list ? ctx.data.messages.list(sessionId) : [];
          const hit = Array.isArray(list)
            ? list.find((m) => m && String(m.id) === String(record.msgId))
            : null;
          if (hit && (hit.role === "user" || hit.role === "assistant")) return hit.role;
        } catch (e) { /* 静默 */ }
      }
      return responderKind === "user" ? "assistant" : "user";
    };

    /* ------------------------------------------------------------ */
    /* 消息被删除时清掉相关记录                                      */
    /* ------------------------------------------------------------ */
    const removeReactionForMessage = (msgId, sessionId) => {
      const key = String(msgId);

      try {
        ctx.system.storage.remove(`user_reaction_${key}`);
        ctx.system.storage.remove(`char_reaction_${key}`);
      } catch (e) {
        ctx.system.log("清除单条反应失败:", e && e.message ? e.message : String(e));
      }

      const pruneHistory = (historyKey) => {
        let list;
        try { list = ctx.system.storage.get(historyKey); } catch (e) { return; }
        if (!Array.isArray(list) || list.length === 0) return;
        // 保留无 msgId 的条目（无法判断归属），剔除命中项
        const next = list.filter((item) => !item || item.msgId == null || String(item.msgId) !== key);
        if (next.length !== list.length) {
          try { ctx.system.storage.set(historyKey, next); }
          catch (e) { ctx.system.log("裁剪 history 失败:", e && e.message ? e.message : String(e)); }
        }
      };

      const sessionSet = new Set();
      if (sessionId) {
        sessionSet.add(String(sessionId));
      } else {
        try {
          const allKeys = (typeof ctx.system.storage.keys === "function")
            ? ctx.system.storage.keys()
            : [];
          const re = /^(?:user_reaction_history_|char_reaction_history_|session_reactions_)(.+)$/;
          if (Array.isArray(allKeys)) {
            for (const k of allKeys) {
              if (typeof k !== "string") continue;
              const m = re.exec(k);
              if (m && m[1]) sessionSet.add(m[1]);
            }
          }
        } catch (e) {
          ctx.system.log("枚举 storage keys 失败:", e && e.message ? e.message : String(e));
        }
      }

      for (const sid of sessionSet) {
        pruneHistory(`user_reaction_history_${sid}`);
        pruneHistory(`char_reaction_history_${sid}`);
        pruneHistory(`session_reactions_${sid}`);
      }
    };

    /* ------------------------------------------------------------ */
    /* CSS 消毒                                                      */
    /* ------------------------------------------------------------ */
    // FIX(#4): CSS 允许反斜杠转义（\69 mport），先反转义再匹配，堵住绕过路径。
    const cssUnescape = (s) => {
      if (typeof s !== "string" || s.indexOf("\\") === -1) return s;
      return s.replace(/\\([0-9a-fA-F]{1,6}[ \t\n\r\f]?|.)/g, (m, g) => {
        if (!g) return "";
        if (/^[0-9a-fA-F]/.test(g)) {
          const code = parseInt(g.trim(), 16);
          if (Number.isFinite(code) && code >= 0 && code <= 0x10FFFF) {
            try { return String.fromCodePoint(code); } catch (e) { return ""; }
          }
          return "";
        }
        return g;
      });
    };

    const sanitizeUserCss = (css) => {
      if (!css) return "";
      // 先反义，再过滤。合法 CSS 很少依赖转义，这样能保证过滤不可被绕过。
      let s = cssUnescape(String(css)).slice(0, MAX_USER_CSS_LEN);
      return s
        .replace(/@import[^;{]*[;{]?/gi, "")
        .replace(/@(?:namespace|charset)[^;{]*[;{]?/gi, "")
        .replace(/expression\s*\(/gi, "(")
        .replace(/-moz-binding\s*:/gi, "")
        .replace(/javascript\s*:/gi, "")
        .replace(/\0/g, "")
        .replace(/<\/?style[^>]*>/gi, "")
        .replace(/url\s*\(([^)]*)\)/gi, (m, inner) => {
          const t = String(inner || "").trim().replace(/^['"]|['"]$/g, "");
          // FIX(#5): 移除 svg+xml，避免 SVG 内嵌外链追踪 / 潜在脚本面
          if (/^data:image\/(?:png|jpe?g|gif|webp)[;,]/i.test(t)) return m;
          return "url()";
        });
    };

    // FIX(#7): 带 TTL 的缓存（500ms），避免每次长按都触发 getComputedStyle
    const CSS_VAR_TTL_MS = 500;
    const getCssPxVar = (name, fallback) => {
      const now = Date.now();
      const cached = cssVarCache.get(name);
      if (cached && now - cached.time < CSS_VAR_TTL_MS) return cached.value;

      let v = fallback;
      try {
        const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        if (raw) {
          const m = raw.match(/^(-?\d*\.?\d+)px$/i);
          if (m) v = parseFloat(m[1]);
          else {
            const n = Number(raw);
            if (Number.isFinite(n)) v = n;
          }
        }
      } catch (e) { v = fallback; }

      cssVarCache.set(name, { value: v, time: now });
      return v;
    };

    const getCacheEntry = (msgId) => {
      const key = String(msgId);
      let entry = emojiCache.get(key);
      if (!entry) {
        entry = { user: undefined, char: undefined };
        emojiCache.set(key, entry);
        trimMapTo(emojiCache, MAX_EMOJI_CACHE);
      }
      return entry;
    };

    const sanitizeFileName = (name) => {
      const raw = String(name == null ? "" : name).trim();
      const cleaned = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "").slice(0, 64);
      return cleaned || DEFAULT_EXPORT_NAME;
    };

    /* ============================================================ */
    /* 自定义 CSS 注入                                               */
    /* ============================================================ */
    const applyUserCss = () => {
      const css = sanitizeUserCss(ctx.system.storage.get("user_css") || "");
      if (!userCssEl) {
        userCssEl = document.createElement("style");
        userCssEl.setAttribute("data-imsg-rx", "user-css");
      }
      userCssEl.textContent = css;
      if (document.head) {
        if (userCssEl.parentElement) userCssEl.parentElement.removeChild(userCssEl);
        document.head.appendChild(userCssEl);
      }
    };

    /* ============================================================ */
    /* CSS 美化预设存取                                              */
    /* ============================================================ */
    const getCssPresets = () => {
      const raw = ctx.system.storage.get(CSS_PRESETS_KEY);
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((p) => p && typeof p === "object"
          && typeof p.id === "string" && p.id
          && typeof p.name === "string" && p.name
          && typeof p.css === "string")
        .slice(0, MAX_CSS_PRESETS);
    };

    const writeCssPresets = (list) => ctx.system.storage.set(
      CSS_PRESETS_KEY,
      (Array.isArray(list) ? list : []).slice(0, MAX_CSS_PRESETS)
    );

    const makePresetId = () =>
      "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);

    const DEFAULT_USER_CSS = `/* ==========================================
 * 消息表情回应 — 默认样式与可调参数
 * 所有可配置项都在下面 :root 里，改完点「保存并应用」
 * 想覆盖具体元素的默认样式，请加 !important
 * ========================================== */

:root {
  /* 气泡直径 */
  --imsg-rx-size: 32px;
  /* emoji 字号 */
  --imsg-rx-font-size: 16px;
  /* 气泡层级 */
  --imsg-rx-z-index: 1;

  /* 角色 emoji 气泡底色 */
  --imsg-rx-assistant-bg: #ffffff;
  /* 用户 emoji 气泡底色 */
  --imsg-rx-user-bg: #ffffff;

  /* 快捷反应条底色 */
  --imsg-rx-picker-bg: #fafafa;
  /* 快捷反应条宽度 */
  --imsg-rx-picker-width: 300px;
  /* 快捷反应条与消息菜单之间的垂直距离（仅支持 px） */
  --imsg-rx-picker-gap: 4px;

  /* 角色消息 reaction 的偏移 */
  --imsg-rx-asst-offset-top: -18px;
  --imsg-rx-asst-offset-right: -12px;
  /* 用户消息 reaction 的偏移 */
  --imsg-rx-user-offset-top: -18px;
  --imsg-rx-user-offset-left: -12px;
}

.imsg-rx-assistant-wrapper,
.imsg-rx-user-wrapper {
  position: absolute;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: var(--imsg-rx-z-index);
}

.imsg-rx-assistant-wrapper {
  top: var(--imsg-rx-asst-offset-top);
  right: var(--imsg-rx-asst-offset-right);
  left: auto;
  bottom: auto;
}

.imsg-rx-user-wrapper {
  top: var(--imsg-rx-user-offset-top);
  left: var(--imsg-rx-user-offset-left);
  right: auto;
  bottom: auto;
}

.imsg-rx-badge-group {
  position: relative;
  display: inline-block;
  user-select: none;
  width: var(--imsg-rx-size);
  height: var(--imsg-rx-size);
  animation: imsg-badge-pop 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes imsg-badge-pop {
  from { transform: scale(0.4); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.imsg-rx-main-circle {
  box-sizing: border-box;
  border-radius: 50%;
  display: grid;
  place-items: center;
  position: relative;
  z-index: 3;
  padding: 0;
  margin: 0;
  width: var(--imsg-rx-size);
  height: var(--imsg-rx-size);
}

.imsg-rx-assistant-wrapper .imsg-rx-main-circle {
  background-color: var(--imsg-rx-assistant-bg);
}

.imsg-rx-user-wrapper .imsg-rx-main-circle {
  background-color: var(--imsg-rx-user-bg);
}

.imsg-rx-badge-icon {
  line-height: 1;
  display: block;
  text-align: center;
  transform: translateY(0.5px);
  font-size: var(--imsg-rx-font-size);
  font-family: ${EMOJI_FONT_STACK};
}

.imsg-rx-tail-dot-asst-1 {
  position: absolute;
  border-radius: 50%;
  bottom: -2px;
  right: -1px;
  z-index: 2;
  width: max(6px, calc(var(--imsg-rx-size) * 0.35));
  height: max(6px, calc(var(--imsg-rx-size) * 0.35));
  background-color: var(--imsg-rx-assistant-bg);
}

.imsg-rx-tail-dot-asst-2 {
  position: absolute;
  border-radius: 50%;
  bottom: -7px;
  right: -6px;
  z-index: 1;
  width: max(3.5px, calc(var(--imsg-rx-size) * 0.2));
  height: max(3.5px, calc(var(--imsg-rx-size) * 0.2));
  background-color: var(--imsg-rx-assistant-bg);
}

.imsg-rx-tail-dot-user-1 {
  position: absolute;
  border-radius: 50%;
  bottom: -2px;
  left: -1px;
  z-index: 2;
  width: max(6px, calc(var(--imsg-rx-size) * 0.35));
  height: max(6px, calc(var(--imsg-rx-size) * 0.35));
  background-color: var(--imsg-rx-user-bg);
}

.imsg-rx-tail-dot-user-2 {
  position: absolute;
  border-radius: 50%;
  bottom: -7px;
  left: -6px;
  z-index: 1;
  width: max(3.5px, calc(var(--imsg-rx-size) * 0.2));
  height: max(3.5px, calc(var(--imsg-rx-size) * 0.2));
  background-color: var(--imsg-rx-user-bg);
}

.imsg-rx-quick-picker {
  position: fixed;
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 6px;
  border-radius: 18px;
  background: var(--imsg-rx-picker-bg);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  white-space: nowrap;
  width: var(--imsg-rx-picker-width);
  max-width: calc(100vw - 16px);
  box-sizing: border-box;
  z-index: 2147483000;
  animation: imsg-picker-in 0.14s ease-out;
}

@keyframes imsg-picker-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.imsg-rx-quick-picker-list {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 0 4px;
  height: 36px;
}

.imsg-rx-quick-picker-list::-webkit-scrollbar { display: none; }

.imsg-rx-quick-picker-emoji {
  font-size: 20px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0 2px;
  line-height: 1;
  user-select: none;
  transition: transform 0.12s ease;
  font-family: ${EMOJI_FONT_STACK};
}

.imsg-rx-quick-picker-emoji:hover { transform: scale(1.25); }

.imsg-rx-quick-picker-arrow-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e0e0e0;
  color: #252525;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  margin-right: 6px;
}

.imsg-rx-quick-picker-arrow-btn svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: #252525;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.imsg-rx-quick-picker-remove-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #e74c3c;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
  margin-left: 6px;
}
`;

    /* ============================================================ */
    /* 默认样式注入                                                  */
    /* ============================================================ */
    ctx.ui.injectCSS(`
      :root {
        --imsg-rx-size: 32px;
        --imsg-rx-font-size: 16px;
        --imsg-rx-z-index: 1;
        --imsg-rx-assistant-bg: #ffffff;
        --imsg-rx-user-bg: #ffffff;
        --imsg-rx-picker-bg: #fafafa;
        --imsg-rx-picker-width: 300px;
        --imsg-rx-picker-gap: 4px;
        --imsg-rx-asst-offset-top: -18px;
        --imsg-rx-asst-offset-right: -12px;
        --imsg-rx-user-offset-top: -18px;
        --imsg-rx-user-offset-left: -12px;
      }

      .imsg-rx-assistant-wrapper,
      .imsg-rx-user-wrapper {
        position: absolute;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 4px;
        z-index: var(--imsg-rx-z-index);
      }
      .imsg-rx-assistant-wrapper {
        top: var(--imsg-rx-asst-offset-top);
        right: var(--imsg-rx-asst-offset-right);
        left: auto;
        bottom: auto;
      }
      .imsg-rx-user-wrapper {
        top: var(--imsg-rx-user-offset-top);
        left: var(--imsg-rx-user-offset-left);
        right: auto;
        bottom: auto;
      }
      .imsg-rx-badge-group {
        position: relative;
        display: inline-block;
        user-select: none;
        width: var(--imsg-rx-size);
        height: var(--imsg-rx-size);
        animation: imsg-badge-pop 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      @keyframes imsg-badge-pop {
        from { transform: scale(0.4); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .imsg-rx-main-circle {
        box-sizing: border-box;
        border-radius: 50%;
        display: grid;
        place-items: center;
        position: relative;
        z-index: 3;
        padding: 0;
        margin: 0;
        width: var(--imsg-rx-size);
        height: var(--imsg-rx-size);
      }
      .imsg-rx-assistant-wrapper .imsg-rx-main-circle {
        background-color: var(--imsg-rx-assistant-bg);
      }
      .imsg-rx-user-wrapper .imsg-rx-main-circle {
        background-color: var(--imsg-rx-user-bg);
      }
      .imsg-rx-badge-icon {
        line-height: 1;
        display: block;
        text-align: center;
        transform: translateY(0.5px);
        font-size: var(--imsg-rx-font-size);
        font-family: ${EMOJI_FONT_STACK};
      }
      .imsg-rx-tail-dot-asst-1 {
        position: absolute; border-radius: 50%; bottom: -2px; right: -1px; z-index: 2;
        width: max(6px, calc(var(--imsg-rx-size) * 0.35));
        height: max(6px, calc(var(--imsg-rx-size) * 0.35));
        background-color: var(--imsg-rx-assistant-bg);
      }
      .imsg-rx-tail-dot-asst-2 {
        position: absolute; border-radius: 50%; bottom: -7px; right: -6px; z-index: 1;
        width: max(3.5px, calc(var(--imsg-rx-size) * 0.2));
        height: max(3.5px, calc(var(--imsg-rx-size) * 0.2));
        background-color: var(--imsg-rx-assistant-bg);
      }
      .imsg-rx-tail-dot-user-1 {
        position: absolute; border-radius: 50%; bottom: -2px; left: -1px; z-index: 2;
        width: max(6px, calc(var(--imsg-rx-size) * 0.35));
        height: max(6px, calc(var(--imsg-rx-size) * 0.35));
        background-color: var(--imsg-rx-user-bg);
      }
      .imsg-rx-tail-dot-user-2 {
        position: absolute; border-radius: 50%; bottom: -7px; left: -6px; z-index: 1;
        width: max(3.5px, calc(var(--imsg-rx-size) * 0.2));
        height: max(3.5px, calc(var(--imsg-rx-size) * 0.2));
        background-color: var(--imsg-rx-user-bg);
      }
      .imsg-rx-quick-picker {
        position: fixed;
        display: flex;
        align-items: center;
        height: 36px;
        padding: 0 6px;
        border-radius: 18px;
        background: var(--imsg-rx-picker-bg);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
        white-space: nowrap;
        width: var(--imsg-rx-picker-width);
        max-width: calc(100vw - 16px);
        box-sizing: border-box;
        z-index: 2147483000;
        animation: imsg-picker-in 0.14s ease-out;
      }
      @keyframes imsg-picker-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .imsg-rx-quick-picker-list {
        flex: 1; min-width: 0;
        display: flex; align-items: center;
        overflow-x: auto;
        scrollbar-width: none; -ms-overflow-style: none;
        padding: 0 4px; height: 36px;
      }
      .imsg-rx-quick-picker-list::-webkit-scrollbar { display: none; }
      .imsg-rx-quick-picker-arrow-btn {
        width: 24px; height: 24px; border-radius: 50%;
        background: #e0e0e0; color: #252525;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; user-select: none; flex-shrink: 0; margin-right: 6px;
      }
      .imsg-rx-quick-picker-arrow-btn svg {
        width: 14px; height: 14px;
        fill: none; stroke: #252525; stroke-width: 2;
        stroke-linecap: round; stroke-linejoin: round;
      }
      .imsg-rx-quick-picker-emoji {
        font-size: 20px; cursor: pointer; flex-shrink: 0;
        padding: 0 2px; line-height: 1; user-select: none;
        transition: transform 0.12s ease;
        font-family: ${EMOJI_FONT_STACK};
      }
      .imsg-rx-quick-picker-emoji:hover { transform: scale(1.25); }
      .imsg-rx-quick-picker-remove-btn {
        width: 24px; height: 24px; border-radius: 50%;
        background: #e74c3c; color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; line-height: 1;
        cursor: pointer; user-select: none; flex-shrink: 0; margin-left: 6px;
      }
    `);

    applyUserCss();

    /* ============================================================ */
    /* 预设 Emoji                                                    */
    /* ============================================================ */
    const getQuickEmojis = () => {
      const stored = ctx.system.storage.get("quick_emojis");
      if (Array.isArray(stored) && stored.length > 0) {
        const cleaned = stored.map(sanitizeEmoji).filter(Boolean).slice(0, MAX_PRESET_EMOJIS);
        if (cleaned.length > 0) return cleaned;
      }
      return DEFAULT_QUICK_EMOJIS.slice();
    };

    const parseQuickEmojis = (text) => String(text || "")
      .split(/\s+/).map(sanitizeEmoji).filter(Boolean).slice(0, MAX_PRESET_EMOJIS);

    /* ============================================================ */
    /* Emoji 气泡                                                    */
    /* ============================================================ */
    const createBadgeGroup = (emoji, type = "assistant") => {
      const group = document.createElement("div");
      group.className = "imsg-rx-badge-group";
      const mainCircle = document.createElement("div");
      mainCircle.className = "imsg-rx-main-circle";
      const icon = document.createElement("span");
      icon.className = "imsg-rx-badge-icon";
      icon.textContent = emoji;
      mainCircle.appendChild(icon);
      group.appendChild(mainCircle);
      const dot1 = document.createElement("div");
      const dot2 = document.createElement("div");
      if (type === "assistant") {
        dot1.className = "imsg-rx-tail-dot-asst-1";
        dot2.className = "imsg-rx-tail-dot-asst-2";
      } else {
        dot1.className = "imsg-rx-tail-dot-user-1";
        dot2.className = "imsg-rx-tail-dot-user-2";
      }
      group.appendChild(dot1);
      group.appendChild(dot2);
      return group;
    };

    const rerenderAll = () => rerenderMap.forEach((fn) => fn());

    /* ============================================================ */
    /* 存储操作                                                      */
    /* ============================================================ */
    // FIX(#3): 包进 runReactionOp，与 llm.response 里的写操作串行化
    // FIX(#2): 去重按 msgId，避免同文本消息串味
    const saveUserReaction = (message, sessionId, emoji) => runReactionOp(async () => {
      const cleanEmoji = sanitizeEmoji(emoji);
      if (!cleanEmoji) { ctx.ui.toast("请输入有效的 Emoji 表情"); return; }

      const reactionKey = `user_reaction_${message.id}`;
      const storageKey = `session_reactions_${sessionId}`;
      const historyKey = `user_reaction_history_${sessionId}`;
      const msgTextSanitized = sanitizeMsgText(message.content);
      const msgIdKey = String(message.id);

      const curRaw = ctx.system.storage.get(storageKey);
      const histRaw = ctx.system.storage.get(historyKey);

      let currentRoundList = Array.isArray(curRaw) ? curRaw : [];
      currentRoundList = currentRoundList.filter((item) => String(item.msgId) !== msgIdKey);
      currentRoundList.push({
        msgId: message.id, msgText: msgTextSanitized,
        emoji: cleanEmoji, removed: false, time: Date.now(),
        role: message.role,
      });

      let historyList = Array.isArray(histRaw) ? histRaw : [];
      historyList = historyList.filter((item) => String(item.msgId) !== msgIdKey);
      historyList.push({
        msgId: message.id, msgText: msgTextSanitized,
        emoji: cleanEmoji, removed: false, time: Date.now(),
        role: message.role,
      });
      if (historyList.length > MAX_USER_HISTORY) historyList = historyList.slice(-MAX_USER_HISTORY);

      await Promise.all([
        ctx.system.storage.set(reactionKey, cleanEmoji),
        ctx.system.storage.set(storageKey, currentRoundList),
        ctx.system.storage.set(historyKey, historyList),
      ]);

      getCacheEntry(message.id).user = cleanEmoji;

      const rerender = rerenderMap.get(msgIdKey);
      if (rerender) rerender();
    });

    // FIX(#3): 同样包进 runReactionOp
    // FIX(#2): 去重按 msgId
    const removeUserReaction = (message, sessionId) => runReactionOp(async () => {
      const reactionKey = `user_reaction_${message.id}`;
      const storageKey = `session_reactions_${sessionId}`;
      const historyKey = `user_reaction_history_${sessionId}`;
      const msgIdKey = String(message.id);

      const existingEmoji = ctx.system.storage.get(reactionKey);
      const curRaw = ctx.system.storage.get(storageKey);
      const histRaw = ctx.system.storage.get(historyKey);

      let currentRoundList = Array.isArray(curRaw) ? curRaw : [];
      currentRoundList = currentRoundList.filter((item) => String(item.msgId) !== msgIdKey);
      if (existingEmoji) {
        currentRoundList.push({
          msgId: message.id, msgText: sanitizeMsgText(message.content),
          emoji: existingEmoji, removed: true, time: Date.now(),
          role: message.role,
        });
      }

      let historyList = Array.isArray(histRaw) ? histRaw : [];
      historyList = historyList.filter((item) => String(item.msgId) !== msgIdKey);
      if (existingEmoji) {
        historyList.push({
          msgId: message.id, msgText: sanitizeMsgText(message.content),
          emoji: existingEmoji, removed: true, time: Date.now(),
          role: message.role,
        });
        if (historyList.length > MAX_USER_HISTORY) historyList = historyList.slice(-MAX_USER_HISTORY);
      }

      await Promise.all([
        ctx.system.storage.remove(reactionKey),
        ctx.system.storage.set(storageKey, currentRoundList),
        ctx.system.storage.set(historyKey, historyList),
      ]);

      getCacheEntry(message.id).user = null;

      const rerender = rerenderMap.get(msgIdKey);
      if (rerender) rerender();
    });

    /* ============================================================ */
    /* 设置弹窗                                                      */
    /* ============================================================ */
    const openReactionModal = (message, sessionId) => {
      ctx.ui.openModal((modalEl, { close }) => {
        const storedCss = ctx.system.storage.get("user_css") || "";
        const presetText = escapeHtml(getQuickEmojis().join(" "));

        modalEl.style.maxWidth = "380px";
        modalEl.style.maxHeight = "88vh";
        modalEl.style.overflowY = "auto";
        modalEl.style.padding = "20px";
        modalEl.style.borderRadius = "8px";
        modalEl.style.background = "#ffffff";
        modalEl.style.boxShadow = "0 16px 42px rgba(0,0,0,0.22)";
        modalEl.style.boxSizing = "border-box";
        modalEl.style.fontFamily = "'Times New Roman', SimSun, 'Songti SC', 'STSong', serif";

        modalEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-family: 'Times New Roman', Times, serif; font-size: 24px; font-weight: bold; letter-spacing: 1.5px; color: #111111;">REACTION</span>
            <span id="imsg-modal-close-btn" style="font-family: Arial, sans-serif; font-size: 22px; line-height: 1; color: #8e8e93; cursor: pointer; user-select: none; padding: 0 8px; border-radius: 8px;">×</span>
          </div>
          <div style="height: 1px; background: #e5e5ea; margin-bottom: 14px;"></div>

          <div style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
              <span style="font-family: SimSun, 'Songti SC', serif; font-size: 14px; color: #222222;">预设 Emoji</span>
              <span style="font-family: SimSun, 'Songti SC', serif; font-size: 11px; color: #8e8e93;">空格或换行分隔，最多 ${MAX_PRESET_EMOJIS} 个</span>
            </div>
            <textarea id="imsg-preset-editor" spellcheck="false" placeholder="例如：❤️ 👍 😂" style="width: 100%; height: 64px; padding: 8px 10px; border: 1px solid #d1d1d6; border-radius: 8px; outline: none; font-family: 'Apple Color Emoji', 'Times New Roman', SimSun, serif; font-size: 16px; line-height: 1.5; box-sizing: border-box; background: #fafafa; color: #111; resize: vertical;">${presetText}</textarea>
            <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
              <span id="imsg-preset-restore" style="font-family: SimSun, 'Songti SC', serif; font-size: 12px; color: #8e8e93; cursor: pointer; user-select: none; padding: 2px 8px; border-radius: 8px;">恢复默认</span>
            </div>
          </div>

          <div style="height: 1px; background: #e5e5ea; margin-bottom: 12px;"></div>

          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <span style="font-family: SimSun, 'Songti SC', serif; font-size: 14px; color: #222222;">自定义样式（CSS）</span>
            <div style="display: flex; gap: 2px; align-items: baseline;">
              <span id="imsg-css-import-btn" style="font-family: SimSun, 'Songti SC', serif; font-size: 12px; color: #8e8e93; cursor: pointer; user-select: none; padding: 2px 8px; border-radius: 8px;">导入</span>
              <span id="imsg-css-export-btn" style="font-family: SimSun, 'Songti SC', serif; font-size: 12px; color: #8e8e93; cursor: pointer; user-select: none; padding: 2px 8px; border-radius: 8px;">导出</span>
            </div>
          </div>

          <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 6px;">
            <select id="imsg-css-preset-select" style="flex: 1; min-width: 0; height: 32px; padding: 0 8px; border: 1px solid #d1d1d6; border-radius: 8px; background: #fafafa; color: #111; font-family: SimSun, 'Songti SC', serif; font-size: 13px; outline: none; box-sizing: border-box;">
              <option value="">— 选择预设 —</option>
            </select>
            <button id="imsg-css-preset-save" style="height: 32px; padding: 0 10px; border: 1px solid #d1d1d6; border-radius: 8px; background: #ffffff; color: #222; font-family: SimSun, 'Songti SC', serif; font-size: 13px; cursor: pointer; white-space: nowrap;">存为预设</button>
            <button id="imsg-css-preset-delete" disabled style="height: 32px; padding: 0 10px; border: 1px solid #d1d1d6; border-radius: 8px; background: #ffffff; color: #222; font-family: SimSun, 'Songti SC', serif; font-size: 13px; cursor: not-allowed; opacity: 0.5; white-space: nowrap;">删除</button>
          </div>

          <div id="imsg-css-preset-name-row" style="display: none; gap: 6px; align-items: center; margin-bottom: 6px;">
            <input id="imsg-css-preset-name-input" type="text" spellcheck="false" maxlength="${MAX_PRESET_NAME_LEN}" placeholder="预设名称（最多 ${MAX_PRESET_NAME_LEN} 字）" style="flex: 1; min-width: 0; height: 32px; padding: 0 10px; border: 1px solid #d1d1d6; border-radius: 8px; background: #fafafa; color: #111; font-family: SimSun, 'Songti SC', serif; font-size: 13px; outline: none; box-sizing: border-box;">
            <button id="imsg-css-preset-name-ok" style="height: 32px; padding: 0 12px; border: none; border-radius: 8px; background: #000; color: #fff; font-family: SimSun, 'Songti SC', serif; font-size: 13px; cursor: pointer; white-space: nowrap;">确定</button>
            <button id="imsg-css-preset-name-cancel" style="height: 32px; padding: 0 10px; border: 1px solid #d1d1d6; border-radius: 8px; background: #fff; color: #222; font-family: SimSun, 'Songti SC', serif; font-size: 13px; cursor: pointer; white-space: nowrap;">取消</button>
          </div>

          <textarea id="imsg-css-editor" spellcheck="false" placeholder="留空则使用默认样式。想覆盖默认样式请加 !important" style="width: 100%; height: 190px; padding: 10px; border: 1px solid #d1d1d6; border-radius: 8px; outline: none; font-family: Menlo, Consolas, 'Courier New', monospace; font-size: 12px; line-height: 1.55; box-sizing: border-box; background: #fafafa; color: #111; resize: vertical; tab-size: 2;"></textarea>

          <div style="font-size: 11px; color: #8e8e93; margin-top: 6px; line-height: 1.55;">
            提示：留空即使用默认样式。所有可调参数（气泡直径、emoji 字号、气泡底色、偏移等）都写成 CSS 变量放在 <code style="background:#f2f2f7; padding:0 4px; border-radius:8px;">:root</code> 中，点「填入示例」可查看完整变量与样式参考。注意：为保证安全，<code style="background:#f2f2f7; padding:0 4px; border-radius:8px;">url()</code> 仅允许 data:image/* 内联资源。
          </div>

          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button id="imsg-css-example-btn" style="flex: 1; height: 34px; padding: 0 10px; border: 1px solid #d1d1d6; border-radius: 8px; background: #ffffff; color: #222222; font-family: SimSun, 'Songti SC', serif; font-size: 14px; cursor: pointer; white-space: nowrap;">填入示例</button>
            <button id="imsg-css-clear-btn" style="flex: 1; height: 34px; padding: 0 10px; border: 1px solid #d1d1d6; border-radius: 8px; background: #ffffff; color: #222222; font-family: SimSun, 'Songti SC', serif; font-size: 14px; cursor: pointer; white-space: nowrap;">清空</button>
            <button id="imsg-save-all-btn" style="flex: 1.2; height: 34px; padding: 0 10px; border: none; border-radius: 8px; background: #000000; color: #ffffff; font-family: SimSun, 'Songti SC', serif; font-size: 14px; cursor: pointer; font-weight: 500; white-space: nowrap;">保存并应用</button>
          </div>
        `;

        const closeBtn = modalEl.querySelector("#imsg-modal-close-btn");
        const presetEditor = modalEl.querySelector("#imsg-preset-editor");
        const presetRestoreBtn = modalEl.querySelector("#imsg-preset-restore");
        const editor = modalEl.querySelector("#imsg-css-editor");
        const exampleBtn = modalEl.querySelector("#imsg-css-example-btn");
        const clearBtn = modalEl.querySelector("#imsg-css-clear-btn");
        const saveAllBtn = modalEl.querySelector("#imsg-save-all-btn");

        const cssPresetSelect = modalEl.querySelector("#imsg-css-preset-select");
        const cssPresetSaveBtn = modalEl.querySelector("#imsg-css-preset-save");
        const cssPresetDeleteBtn = modalEl.querySelector("#imsg-css-preset-delete");
        const cssPresetNameRow = modalEl.querySelector("#imsg-css-preset-name-row");
        const cssPresetNameInput = modalEl.querySelector("#imsg-css-preset-name-input");
        const cssPresetNameOk = modalEl.querySelector("#imsg-css-preset-name-ok");
        const cssPresetNameCancel = modalEl.querySelector("#imsg-css-preset-name-cancel");

        const cssImportBtn = modalEl.querySelector("#imsg-css-import-btn");
        const cssExportBtn = modalEl.querySelector("#imsg-css-export-btn");

        if (!closeBtn || !presetEditor || !editor || !saveAllBtn) {
          ctx.system.log("设置弹窗结构缺失，无法初始化");
          return;
        }

        editor.value = storedCss;

        /* ------------------------------------------------------------ */
        /* 移动端键盘处理                                                */
        /* ------------------------------------------------------------ */
        let baseTransform = "";
        let currentOffset = 0;
        let focusedInput = null;
        let rafPending = false;
        let cleaned = false;

        const captureBaseTransform = () => {
          const prev = modalEl.style.transform;
          modalEl.style.transform = "";
          const computed = window.getComputedStyle(modalEl).transform;
          modalEl.style.transform = prev;
          baseTransform = (computed && computed !== "none") ? computed : "";
        };

        const applyOffset = (offset) => {
          currentOffset = Math.max(0, offset);
          if (currentOffset === 0) {
            modalEl.style.transform = baseTransform;
          } else {
            modalEl.style.transform = `${baseTransform} translateY(-${currentOffset}px)`.trim();
          }
        };

        const updateForKeyboard = () => {
          if (!modalEl.isConnected) { cleanupKeyboardListeners(); return; }
          const vv = window.visualViewport;
          if (!focusedInput || !vv) { applyOffset(0); return; }

          const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
          if (keyboardHeight < 100) { applyOffset(0); return; }

          modalEl.style.transform = baseTransform;
          const rect = focusedInput.getBoundingClientRect();

          const visibleTop = vv.offsetTop;
          const visibleBottom = vv.offsetTop + vv.height;
          const pad = 24;

          let shift = 0;
          if (rect.bottom > visibleBottom - pad) {
            shift = rect.bottom - (visibleBottom - pad);
          }
          if (rect.top - shift < visibleTop + pad) {
            shift = Math.max(0, rect.top - (visibleTop + pad));
          }
          applyOffset(shift);
        };

        const scheduleUpdate = () => {
          if (rafPending) return;
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            updateForKeyboard();
          });
        };

        const onFocusIn = (e) => {
          const t = e.target;
          if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) {
            focusedInput = t;
            setTimeout(scheduleUpdate, 60);
            setTimeout(scheduleUpdate, 180);
            setTimeout(scheduleUpdate, 360);
          }
        };

        const onFocusOut = (e) => {
          if (e.target === focusedInput) {
            focusedInput = null;
            applyOffset(0);
          }
        };

        const cleanupKeyboardListeners = () => {
          if (cleaned) return;
          cleaned = true;
          try { modalEl.removeEventListener("focusin", onFocusIn); } catch (e) {}
          try { modalEl.removeEventListener("focusout", onFocusOut); } catch (e) {}
          if (window.visualViewport) {
            try { window.visualViewport.removeEventListener("resize", scheduleUpdate); } catch (e) {}
            try { window.visualViewport.removeEventListener("scroll", scheduleUpdate); } catch (e) {}
          }
        };

        // FIX(#13): 用 body 的 subtree 观察，避免 modal 在 RAF 之前被移除时漏清理
        const modalDetachObserver = new MutationObserver(() => {
          if (!modalEl.isConnected) {
            cleanupKeyboardListeners();
            modalDetachObserver.disconnect();
          }
        });
        try {
          if (document.body) {
            modalDetachObserver.observe(document.body, { childList: true, subtree: true });
          }
        } catch (e) { /* ignore */ }

        requestAnimationFrame(() => { captureBaseTransform(); });

        modalEl.addEventListener("focusin", onFocusIn);
        modalEl.addEventListener("focusout", onFocusOut);
        if (window.visualViewport) {
          window.visualViewport.addEventListener("resize", scheduleUpdate);
          window.visualViewport.addEventListener("scroll", scheduleUpdate);
        }

        // FIX(#12): 统一的关闭入口，确保所有路径都清理监听
        const wrappedClose = () => {
          cleanupKeyboardListeners();
          try { modalDetachObserver.disconnect(); } catch (e) {}
          try { close(); } catch (e) {}
        };

        /* ------------------------------------------------------------ */
        /* CSS 美化预设逻辑                                               */
        /* ------------------------------------------------------------ */
        const updatePresetDeleteState = (enabled) => {
          cssPresetDeleteBtn.disabled = !enabled;
          cssPresetDeleteBtn.style.opacity = enabled ? "1" : "0.5";
          cssPresetDeleteBtn.style.cursor = enabled ? "pointer" : "not-allowed";
        };

        const refreshPresetSelect = (selectedId) => {
          const presets = getCssPresets();
          cssPresetSelect.innerHTML = `<option value="">— 选择预设 —</option>`;
          presets.forEach((p) => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.name;
            cssPresetSelect.appendChild(opt);
          });
          cssPresetSelect.value = selectedId || "";
          updatePresetDeleteState(!!cssPresetSelect.value);
        };

        const hidePresetNameRow = () => {
          cssPresetNameRow.style.display = "none";
          cssPresetNameInput.value = "";
        };

        const showPresetNameRow = () => {
          cssPresetNameRow.style.display = "flex";
          const curId = cssPresetSelect.value;
          const cur = curId ? getCssPresets().find((p) => p.id === curId) : null;
          cssPresetNameInput.value = cur ? cur.name : "";
          cssPresetNameInput.focus();
          cssPresetNameInput.select();
        };

        const handlePresetSelectChange = () => {
          const id = cssPresetSelect.value;
          updatePresetDeleteState(!!id);
          if (!id) return;
          const preset = getCssPresets().find((p) => p.id === id);
          if (!preset) return;
          editor.value = preset.css;
          editor.focus();
        };

        const handleSavePreset = async () => {
          const name = String(cssPresetNameInput.value || "").trim().slice(0, MAX_PRESET_NAME_LEN);
          if (!name) {
            ctx.ui.toast("请输入预设名称");
            cssPresetNameInput.focus();
            return;
          }
          const cssToSave = sanitizeUserCss(editor.value || "").trim();
          if (!cssToSave) {
            ctx.ui.toast("CSS 内容为空，无法保存预设");
            return;
          }

          try {
            const presets = getCssPresets();
            const existing = presets.find((p) => p.name === name);
            let targetId;

            let nextList;
            if (existing) {
              targetId = existing.id;
              nextList = presets.map((p) => p.id === existing.id
                ? { ...p, css: cssToSave, time: Date.now() }
                : p);
            } else {
              if (presets.length >= MAX_CSS_PRESETS) {
                ctx.ui.toast(`预设数量已达上限（${MAX_CSS_PRESETS} 个）`);
                return;
              }
              targetId = makePresetId();
              nextList = presets.concat([{
                id: targetId, name, css: cssToSave, time: Date.now(),
              }]);
            }

            await writeCssPresets(nextList);
            hidePresetNameRow();
            refreshPresetSelect(targetId);
            ctx.ui.toast(existing ? `已覆盖预设「${name}」` : `已保存预设「${name}」`);
          } catch (e) {
            ctx.system.log("保存预设失败:", e && e.message ? e.message : String(e));
            ctx.ui.toast("保存预设失败，请重试");
          }
        };

        const handleDeletePreset = async () => {
          const id = cssPresetSelect.value;
          if (!id) return;
          const presets = getCssPresets();
          const preset = presets.find((p) => p.id === id);
          if (!preset) { refreshPresetSelect(""); return; }

          let ok = false;
          try { ok = window.confirm(`确定删除预设「${preset.name}」？`); }
          catch (e) { ok = false; }
          if (!ok) return;

          try {
            await writeCssPresets(presets.filter((p) => p.id !== id));
            refreshPresetSelect("");
            ctx.ui.toast(`已删除预设「${preset.name}」`);
          } catch (e) {
            ctx.system.log("删除预设失败:", e && e.message ? e.message : String(e));
            ctx.ui.toast("删除预设失败，请重试");
          }
        };

        cssPresetSelect.onchange = handlePresetSelectChange;
        cssPresetSaveBtn.onclick = () => {
          if (cssPresetNameRow.style.display === "flex") hidePresetNameRow();
          else showPresetNameRow();
        };
        cssPresetDeleteBtn.onclick = handleDeletePreset;
        cssPresetNameOk.onclick = handleSavePreset;
        cssPresetNameCancel.onclick = hidePresetNameRow;
        cssPresetNameInput.onkeydown = (e) => {
          if (e.key === "Enter") { e.preventDefault(); handleSavePreset(); }
          else if (e.key === "Escape") { e.preventDefault(); hidePresetNameRow(); }
        };

        refreshPresetSelect("");

        /* ------------------------------------------------------------ */
        /* CSS 导入 / 导出                                               */
        /* ------------------------------------------------------------ */
        const cssFileInput = document.createElement("input");
        cssFileInput.type = "file";
        cssFileInput.accept = ".txt,.css,text/plain,text/css";
        cssFileInput.style.display = "none";
        modalEl.appendChild(cssFileInput);

        const handleImportCss = () => {
          cssFileInput.value = "";
          cssFileInput.click();
        };

        cssFileInput.onchange = () => {
          const file = cssFileInput.files && cssFileInput.files[0];
          if (!file) return;

          const rawName = String(file.name || "");
          const lowerName = rawName.toLowerCase();
          const isTxt = lowerName.endsWith(".txt");
          const isCss = lowerName.endsWith(".css");
          if (!isTxt && !isCss) {
            ctx.ui.toast("仅支持 .txt 或 .css 文件");
            cssFileInput.value = "";
            return;
          }
          if (file.size > MAX_IMPORT_FILE_BYTES) {
            ctx.ui.toast(`文件过大（上限 ${Math.round(MAX_IMPORT_FILE_BYTES / 1024)}KB）`);
            cssFileInput.value = "";
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            const text = String(reader.result || "");
            if (!text.trim()) {
              ctx.ui.toast("文件内容为空");
              return;
            }
            editor.value = sanitizeUserCss(text);
            editor.focus();
            const baseName = rawName.replace(/\.(txt|css)$/i, "").trim().slice(0, MAX_PRESET_NAME_LEN);
            if (baseName) cssPresetNameInput.value = baseName;
            ctx.ui.toast(`已导入 ${rawName}`);
          };
          reader.onerror = () => {
            ctx.system.log("读取导入文件失败:", reader.error && reader.error.message ? reader.error.message : String(reader.error || ""));
            ctx.ui.toast("读取文件失败");
          };
          reader.readAsText(file, "utf-8");
        };

        const handleExportCss = () => {
          const css = sanitizeUserCss(editor.value || "").trim();
          if (!css) {
            ctx.ui.toast("没有可导出的 CSS 内容");
            return;
          }

          const curId = cssPresetSelect.value;
          const cur = curId ? getCssPresets().find((p) => p.id === curId) : null;
          let baseName = cur ? cur.name : "";

          if (!baseName) {
            try {
              const input = window.prompt("请输入导出文件名（无需扩展名）", DEFAULT_EXPORT_NAME);
              if (input === null) return;
              baseName = String(input).trim();
            } catch (e) {
              baseName = DEFAULT_EXPORT_NAME;
            }
          }
          const safeName = sanitizeFileName(baseName || DEFAULT_EXPORT_NAME);

          try {
            const blob = new Blob([css], { type: "text/css;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${safeName}.css`;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => {
              try { URL.revokeObjectURL(url); } catch (e) {}
            }, 1000);
            ctx.ui.toast(`已导出为 ${safeName}.css`);
          } catch (e) {
            ctx.system.log("导出 CSS 失败:", e && e.message ? e.message : String(e));
            ctx.ui.toast("导出失败");
          }
        };

        cssImportBtn.onclick = handleImportCss;
        cssExportBtn.onclick = handleExportCss;

        /* ------------------------------------------------------------ */
        /* 业务事件                                                      */
        /* ------------------------------------------------------------ */
        // FIX(#12): 使用 wrappedClose 统一清理路径
        const handleSaveAll = () => {
          const parsed = parseQuickEmojis(presetEditor.value);
          if (parsed.length === 0) {
            ctx.ui.toast("至少保留一个有效的 Emoji");
            return;
          }

          const cssRaw = editor.value || "";
          const cssToSave = (cssRaw.trim() === "" || cssRaw.trim() === DEFAULT_USER_CSS.trim())
            ? ""
            : sanitizeUserCss(cssRaw);

          saveAllBtn.disabled = true;
          saveAllBtn.style.opacity = "0.6";

          (async () => {
            try {
              await Promise.all([
                ctx.system.storage.set("quick_emojis", parsed),
                ctx.system.storage.set("user_css", cssToSave),
              ]);
              applyUserCss();
              hideQuickPicker();
              wrappedClose();
              ctx.ui.toast("已保存并应用");
            } catch (e) {
              ctx.system.log("保存失败:", e && e.message ? e.message : String(e));
              ctx.ui.toast("保存失败，请重试");
              saveAllBtn.disabled = false;
              saveAllBtn.style.opacity = "1";
            }
          })();
        };

        const handleRestorePreset = () => {
          presetEditor.value = DEFAULT_QUICK_EMOJIS.join(" ");
        };

        const handleClearCss = () => {
          editor.value = "";
          editor.focus();
        };

        saveAllBtn.onclick = handleSaveAll;
        presetRestoreBtn.onclick = handleRestorePreset;
        exampleBtn.onclick = () => { editor.value = DEFAULT_USER_CSS; editor.focus(); };
        clearBtn.onclick = handleClearCss;

        closeBtn.onclick = wrappedClose;

        return () => {
          cleanupKeyboardListeners();
          try { modalDetachObserver.disconnect(); } catch (e) {}
        };
      });
    };

    /* ============================================================ */
    /* MutationObserver 控制                                          */
    /* ============================================================ */
    const isFloatingMenu = (node) => {
      if (!node || node.nodeType !== 1 || !node.classList) return false;
      if (node.classList.contains("chat-floating-ctx-menu")) return true;
      if (node.classList.contains("ctx-menu") && node.querySelector && node.querySelector(".ctx-menu-btn")) return true;
      return false;
    };

    const handleMenuAppear = (menu) => {
      const bubbleEl = pendingBubble;
      pendingBubble = null;
      if (!bubbleEl || !bubbleEl.isConnected) return;
      const msgId = bubbleEl.dataset ? bubbleEl.dataset.imsgMsgId : null;
      if (!msgId) return;
      const entry = messageMap.get(msgId);
      if (!entry) return;
      activeMenu = menu;
      requestAnimationFrame(() => {
        if (!menu.isConnected || !bubbleEl.isConnected) return;
        const latest = messageMap.get(msgId) || entry;
        showQuickPicker(menu, latest.msg, latest.sessionId);
      });
    };

    const buildMenuObserver = () => {
      if (menuObserver) return menuObserver;
      menuObserver = new MutationObserver((mutations) => {
        if (!menuWatchEnabled && !activeMenu) return;
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            if (isFloatingMenu(node)) handleMenuAppear(node);
            else if (node.querySelector) {
              const inner = node.querySelector(".chat-floating-ctx-menu");
              if (inner) handleMenuAppear(inner);
            }
          });
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType !== 1 || !activeMenu) return;
            if (node === activeMenu || (node.contains && node.contains(activeMenu))) {
              queueMicrotask(() => {
                if (activeMenu && !activeMenu.isConnected) hideQuickPicker();
              });
            }
          });
        }
      });
      return menuObserver;
    };

    const ensureMenuObserverArmed = () => {
      if (menuObserverArmed || !document.body) return;
      const obs = buildMenuObserver();
      obs.observe(document.body, { childList: true, subtree: true });
      menuObserverArmed = true;
    };
    const maybeDisarmMenuObserver = () => {
      if (!menuObserverArmed) return;
      if (menuWatchEnabled || activeMenu) return;
      if (menuObserver) menuObserver.disconnect();
      menuObserverArmed = false;
    };

    const armMenuWatch = () => {
      menuWatchEnabled = true;
      ensureMenuObserverArmed();
      if (menuWatchTimer) clearTimeout(menuWatchTimer);
      menuWatchTimer = setTimeout(() => {
        menuWatchEnabled = false;
        menuWatchTimer = null;
        pendingBubble = null;
        maybeDisarmMenuObserver();
      }, MENU_WATCH_MS);
    };
    const disarmMenuWatch = () => {
      menuWatchEnabled = false;
      if (menuWatchTimer) { clearTimeout(menuWatchTimer); menuWatchTimer = null; }
      pendingBubble = null;
      maybeDisarmMenuObserver();
    };

    /* ============================================================ */
    /* 快捷选择条                                                    */
    /* ============================================================ */
    const buildQuickPicker = (msg, sessionId) => {
      const picker = document.createElement("div");
      picker.className = "imsg-rx-quick-picker";
      picker.style.display = "flex";

      const listDiv = document.createElement("div");
      listDiv.className = "imsg-rx-quick-picker-list";

      const arrowBtn = document.createElement("div");
      arrowBtn.className = "imsg-rx-quick-picker-arrow-btn";
      arrowBtn.title = "打开设置";
      arrowBtn.innerHTML = `<svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
      arrowBtn.onclick = (e) => {
        e.stopPropagation();
        hideQuickPicker();
        openReactionModal(msg, sessionId);
      };
      listDiv.appendChild(arrowBtn);

      getQuickEmojis().forEach((em) => {
        const span = document.createElement("span");
        span.className = "imsg-rx-quick-picker-emoji";
        span.textContent = em;
        span.title = em;
        span.onclick = async (e) => {
          e.stopPropagation();
          hideQuickPicker();
          try {
            await saveUserReaction(msg, sessionId, em);
          } catch (err) {
            ctx.system.log("保存回应失败:", err && err.message ? err.message : String(err));
            ctx.ui.toast("保存回应失败，请重试");
          }
        };
        listDiv.appendChild(span);
      });

      picker.appendChild(listDiv);

      if (ctx.system.storage.get(`user_reaction_${msg.id}`)) {
        const removeBtn = document.createElement("div");
        removeBtn.className = "imsg-rx-quick-picker-remove-btn";
        removeBtn.textContent = "×";
        removeBtn.title = "移除回应";
        removeBtn.onclick = async (e) => {
          e.stopPropagation();
          hideQuickPicker();
          try {
            await removeUserReaction(msg, sessionId);
          } catch (err) {
            ctx.system.log("移除回应失败:", err && err.message ? err.message : String(err));
            ctx.ui.toast("移除回应失败，请重试");
          }
        };
        picker.appendChild(removeBtn);
      }

      return picker;
    };

    // FIX(#1): hideQuickPicker 同时清掉 pendingBubble / menuWatchTimer，避免
    // 残留的 watch 状态在下一次无关浮层出现时误触发 picker。
    const hideQuickPicker = () => {
      if (activePicker) { activePicker.remove(); activePicker = null; }
      activeMenu = null;
      pendingBubble = null;
      if (menuWatchTimer) { clearTimeout(menuWatchTimer); menuWatchTimer = null; }
      menuWatchEnabled = false;
      maybeDisarmMenuObserver();
    };

    const showQuickPicker = (menu, msg, sessionId) => {
      hideQuickPicker();
      const picker = buildQuickPicker(msg, sessionId);
      document.body.appendChild(picker);

      const gap = Math.min(20, Math.max(0, getCssPxVar("--imsg-rx-picker-gap", 4)));
      const pr = picker.getBoundingClientRect();
      const mr = menu.getBoundingClientRect();

      let left = mr.left;
      let top = mr.top - pr.height - gap;
      if (top < 8) top = mr.bottom + gap;
      const maxLeft = window.innerWidth - pr.width - 8;
      if (left > maxLeft) left = maxLeft;
      if (left < 8) left = 8;

      picker.style.left = `${left}px`;
      picker.style.top = `${top}px`;
      activePicker = picker;
      activeMenu = menu;
      try { menu.dataset.imsgRxMsgId = String(msg.id); } catch (e) {}
    };

    /* ============================================================ */
    /* 全局指针事件                                                  */
    /* ============================================================ */
    const onDocumentPointerDown = (e) => {
      const target = e.target;
      if (!target || !target.closest) return;
      if (activePicker) {
        if (target.closest(".imsg-rx-quick-picker, .chat-floating-ctx-menu")) return;
        hideQuickPicker();
      }
      const bubble = target.closest('[data-ui="bubble-user"], [data-ui="bubble-bot"]');
      if (bubble) {
        pendingBubble = bubble;
        armMenuWatch();
      }
    };
    document.addEventListener("pointerdown", onDocumentPointerDown, true);

    /* ============================================================ */
    /* LLM 回复拦截                                                  */
    /* ============================================================ */
    const findTargetUserMsg = (userMsgs, quoteText) => {
      if (!userMsgs || userMsgs.length === 0) return null;
      if (quoteText && quoteText.trim()) {
        const queryRaw = quoteText.trim();
        const queryNorm = sanitizeForMatch(queryRaw);
        for (let i = userMsgs.length - 1; i >= 0; i--) {
          const m = userMsgs[i];
          const text = contentToString(m.content);
          if (text.includes(queryRaw)) return m;
          if (queryNorm) {
            const tNorm = sanitizeForMatch(text);
            if (tNorm && tNorm.includes(queryNorm)) return m;
          }
        }
        return null;
      }
      return userMsgs[userMsgs.length - 1];
    };

    // FIX(#10): 结尾 ] 改为必须闭合，避免正文里出现半截标签被误删。
    const stripReactionTags = (text) => String(text || "")
      .replace(/\[(?:remove_reaction|撤回回应)[^\]]*\]/gi, "")
      .replace(/\[(?:reaction|回应)[:：][^\]]*\]/gi, "")
      .trim();

    ctx.hooks.transform("llm.response", async (p) => {
      if (!p.text || !p.sessionId) return p;
      const sessionId = p.sessionId;
      return runReactionOp(async () => {
        try {
          const msgs = ctx.data.messages.list ? ctx.data.messages.list(sessionId) : [];
          const userMsgs = msgs.filter((m) => m.role === "user");

          let removeMatches = [...p.text.matchAll(/\[(?:remove_reaction|撤回回应)(?:[:：\s]*(?:\(([^)\n]{0,80})\)|["'“]([^"'”\n]{0,80})["'”]))?\]/gi)];
          removeMatches = removeMatches.slice(0, 2);
          const removedMsgIds = [];

          for (const rm of removeMatches) {
            const quote = (rm[1] || rm[2] || "").trim();
            const targetMsg = findTargetUserMsg(userMsgs, quote);
            if (targetMsg) {
              const existed = ctx.system.storage.get(`char_reaction_${targetMsg.id}`);
              if (existed) {
                ctx.system.storage.remove(`char_reaction_${targetMsg.id}`);
                removedMsgIds.push(targetMsg.id);
                getCacheEntry(targetMsg.id).char = null;
                const rerender = rerenderMap.get(String(targetMsg.id));
                if (rerender) rerender();
                ctx.ui.toast("对方撤回了对你消息的回应");
              }
            }
          }

          let addMatches = [...p.text.matchAll(/\[(?:reaction|回应)[:：]\s*([^\s()"'\[\]]{1,16})(?:\s*(?:\(([^)\n]{0,80})\)|["'“]([^"'”\n]{0,80})["'”]))?\]/gi)];
          addMatches = addMatches.slice(0, 2);
          const newReactions = [];

          for (const match of addMatches) {
            const emoji = sanitizeEmoji(match[1] || "");
            const quote = (match[2] || match[3] || "").trim();
            if (emoji) {
              const targetMsg = findTargetUserMsg(userMsgs, quote);
              if (targetMsg) {
                ctx.system.storage.set(`char_reaction_${targetMsg.id}`, emoji);
                newReactions.push({
                  msgId: targetMsg.id, msgText: sanitizeMsgText(targetMsg.content),
                  emoji: emoji, time: Date.now(),
                  role: targetMsg.role,
                });
                getCacheEntry(targetMsg.id).char = emoji;
                const rerender = rerenderMap.get(String(targetMsg.id));
                if (rerender) rerender();
                ctx.ui.toast(`对方回应了你的消息: ${emoji}`);
              }
            }
          }

          const historyKey = `char_reaction_history_${sessionId}`;
          let charHistory = ctx.system.storage.get(historyKey) || [];
          if (!Array.isArray(charHistory)) charHistory = [];
          if (removedMsgIds.length > 0) charHistory = charHistory.filter((item) => !removedMsgIds.includes(item.msgId));
          for (const nr of newReactions) {
            charHistory = charHistory.filter((item) => item.msgId !== nr.msgId);
            charHistory.push(nr);
          }
          if (charHistory.length > MAX_CHAR_REACTION_HISTORY) charHistory = charHistory.slice(-MAX_CHAR_REACTION_HISTORY);

          await Promise.all([
            ctx.system.storage.set(historyKey, charHistory),
            ctx.system.storage.remove(`session_reactions_${sessionId}`),
          ]);
        } catch (e) {
          ctx.system.log("处理 reaction 指令失败:", e && e.message ? e.message : String(e));
        } finally {
          p.text = stripReactionTags(p.text);
        }
        return p;
      });
    });

    /* ============================================================ */
    /* 消息气泡渲染                                                  */
    /* ============================================================ */
    ctx.ui.slot("message.footer", (el, props) => {
      const msg = props && props.message;
      const sessionId = props && props.sessionId;
      if (!msg || !sessionId || msg.id == null) return;

      const bubbleEl = el.closest ? el.closest('[data-ui="bubble-user"], [data-ui="bubble-bot"]') : null;
      if (!bubbleEl) return;

      const key = String(msg.id);
      messageMap.set(key, { msg, sessionId });
      trimMapTo(messageMap, MAX_MESSAGE_MAP);
      bubbleEl.dataset.imsgMsgId = key;

      const originalOverflow = bubbleEl.style.overflow;

      const wrapper = document.createElement("div");
      wrapper.className = msg.role === "assistant" ? "imsg-rx-assistant-wrapper" : "imsg-rx-user-wrapper";

      let lastRenderKey = null;

      const render = () => {
        const preventOverflowClip = ctx.system.settings.get("preventOverflowClip") === true;
        if (preventOverflowClip) bubbleEl.style.overflow = "visible";
        else if (bubbleEl.style.overflow === "visible" && originalOverflow !== "visible") bubbleEl.style.overflow = originalOverflow;

        const cache = getCacheEntry(msg.id);

        let userEmoji = cache.user;
        if (userEmoji === undefined) {
          userEmoji = ctx.system.storage.get(`user_reaction_${msg.id}`) || null;

          if (!userEmoji && msg.role === "assistant" && !recoveryAttempted.has(key)) {
            const historyKey = `user_reaction_history_${sessionId}`;
            const historyList = ctx.system.storage.get(historyKey) || [];
            const matched = Array.isArray(historyList)
              ? (historyList.find((item) => item && !item.removed && item.emoji && String(item.msgId) === key)
                || historyList.find((item) => item && !item.removed && item.emoji && safeTextEq(item.msgText, msg.content)))
              : null;
            // FIX(#9): 只在成功匹配时标记，避免首次失败后永久放弃恢复
            if (matched) {
              recoveryAttempted.add(key);
              userEmoji = matched.emoji;
              (async () => {
                try {
                  if (!ctx.system || !ctx.system.storage || typeof ctx.system.storage.set !== "function") return;
                  await ctx.system.storage.set(`user_reaction_${msg.id}`, userEmoji);
                  const list = ctx.system.storage.get(historyKey) || [];
                  const item = Array.isArray(list)
                    ? list.find((x) => x && !x.removed && safeTextEq(x.msgText, msg.content))
                    : null;
                  if (item) item.msgId = msg.id;
                  if (Array.isArray(list)) await ctx.system.storage.set(historyKey, list);
                } catch (e) {
                  ctx.system.log("恢复回应时更新存储失败:", e && e.message ? e.message : String(e));
                }
              })();
            }
          }

          cache.user = userEmoji;
        }

        let charEmoji = cache.char;
        if (charEmoji === undefined) {
          charEmoji = msg.role === "user"
            ? (ctx.system.storage.get(`char_reaction_${msg.id}`) || null)
            : null;
          cache.char = charEmoji;
        }

        const renderKey = `${userEmoji || ""}|${charEmoji || ""}`;
        if (renderKey === lastRenderKey) return;
        lastRenderKey = renderKey;

        wrapper.innerHTML = "";
        if (userEmoji) {
          wrapper.appendChild(createBadgeGroup(userEmoji, msg.role === "assistant" ? "assistant" : "user"));
        }
        if (charEmoji) {
          wrapper.appendChild(createBadgeGroup(charEmoji, "user"));
        }
      };

      bubbleEl.appendChild(wrapper);
      render();
      rerenderMap.set(key, render);

      return () => {
        rerenderMap.delete(key);
        messageMap.delete(key);
        recoveryAttempted.delete(key);
        emojiCache.delete(key);
        try { delete bubbleEl.dataset.imsgMsgId; } catch (e) {}
        if (activePicker && activeMenu && activeMenu.dataset && activeMenu.dataset.imsgRxMsgId === key) {
          hideQuickPicker();
        }
        if (wrapper.parentElement) wrapper.parentElement.removeChild(wrapper);
        if (bubbleEl.style.overflow === "visible" && originalOverflow !== "visible") {
          bubbleEl.style.overflow = originalOverflow;
        }
      };
    });

    /* ============================================================ */
    /* 消息删除 → 清理缓存与提示词来源                                */
    /* ============================================================ */
    ctx.hooks.on("message.deleted", (payload) => {
      const id = payload && payload.id;
      if (id == null) return;
      const key = String(id);

      let sessionId = payload && payload.sessionId;
      if (!sessionId) {
        const entry = messageMap.get(key);
        if (entry) sessionId = entry.sessionId;
      }

      removeReactionForMessage(id, sessionId);

      rerenderMap.delete(key);
      messageMap.delete(key);
      emojiCache.delete(key);
      recoveryAttempted.delete(key);

      if (activePicker && activeMenu && activeMenu.dataset && activeMenu.dataset.imsgRxMsgId === key) {
        hideQuickPicker();
      }
    });

    /* ============================================================ */
    /* 消息更新 → 同步缓存与历史 msgText                              */
    /* ============================================================ */
    // FIX(#6): 消息内容被编辑后，同步刷新内存映射和 storage 里的历史 msgText
    ctx.hooks.on("message.updated", (payload) => {
      const id = payload && payload.id;
      if (id == null) return;
      const patch = payload && payload.patch;
      if (!patch || typeof patch.content === "undefined") return;

      const key = String(id);
      const newText = sanitizeMsgText(patch.content);

      const entry = messageMap.get(key);
      const sessionId = entry ? entry.sessionId : null;
      if (entry) {
        try { entry.msg = { ...entry.msg, content: patch.content }; } catch (e) {}
      }

      if (!sessionId) return;

      const updateHistory = (historyKey) => {
        let list;
        try { list = ctx.system.storage.get(historyKey); } catch (e) { return; }
        if (!Array.isArray(list) || list.length === 0) return;
        let changed = false;
        const next = list.map((item) => {
          if (item && item.msgId != null && String(item.msgId) === key && item.msgText !== newText) {
            changed = true;
            return { ...item, msgText: newText };
          }
          return item;
        });
        if (changed) {
          try { ctx.system.storage.set(historyKey, next); }
          catch (e) { ctx.system.log("更新 history msgText 失败:", e && e.message ? e.message : String(e)); }
        }
      };

      updateHistory(`user_reaction_history_${sessionId}`);
      updateHistory(`char_reaction_history_${sessionId}`);
      updateHistory(`session_reactions_${sessionId}`);

      // 让下一次 render 重新读 storage
      emojiCache.delete(key);
      recoveryAttempted.delete(key);
      const rerender = rerenderMap.get(key);
      if (rerender) rerender();
    });

    /* ============================================================ */
    /* 提示词注入                                                    */
    /* ============================================================ */
    ctx.hooks.transform("prompt.system", (payload) => {
      if (ctx.system.settings.get("injectPrompt") === false) return payload;
      if (!payload.sessionId) return payload;

      let promptAddition = "\n\n【表情回应机制】";
      const sessionId = payload.sessionId;

      const userHistoryList = ctx.system.storage.get(`user_reaction_history_${sessionId}`) || [];
      const userRoundList   = ctx.system.storage.get(`session_reactions_${sessionId}`) || [];
      const charHistory     = ctx.system.storage.get(`char_reaction_history_${sessionId}`) || [];

      const userMap = new Map();
      if (Array.isArray(userHistoryList)) {
        for (const item of userHistoryList) {
          if (item && item.msgId != null) userMap.set(String(item.msgId), item);
        }
      }
      if (Array.isArray(userRoundList)) {
        for (const item of userRoundList) {
          if (item && item.msgId != null) userMap.set(String(item.msgId), item);
        }
      }
      const userList = Array.from(userMap.values());

      const merged = [
        ...userList.map((item) => ({ ...item, kind: "user" })),
        ...(Array.isArray(charHistory) ? charHistory : []).map((item) => ({ ...item, kind: "char" })),
      ].sort((a, b) => (a.time || 0) - (b.time || 0));

      const recent = merged.slice(-MAX_PROMPT_REACTIONS);

      if (recent.length > 0) {
        const lines = recent.map((item) => {
          const targetRole = resolveTargetRole(item, sessionId, item.kind);
          const targetLabel = targetRole === "user" ? "{{user}}" : "{{char}}";

          if (item.kind === "user") {
            if (item.removed) {
              return `- {{user}} 撤回了对${targetLabel}消息“${sanitizeMsgText(item.msgText)}”做出的表情回应（原回应：${escapeHtml(item.emoji)}）`;
            }
            return `- {{user}} 对${targetLabel}的消息“${sanitizeMsgText(item.msgText)}”做出了表情回应：${escapeHtml(item.emoji)}`;
          }

          if (item.removed) {
            return `- {{char}} 撤回了对${targetLabel}消息“${sanitizeMsgText(item.msgText)}”做出的表情回应（原回应：${escapeHtml(item.emoji)}）`;
          }
          return `- {{char}} 对${targetLabel}的消息“${sanitizeMsgText(item.msgText)}”做出了表情回应：${escapeHtml(item.emoji)}`;
        });
        promptAddition += `\n最近 ${recent.length} 条表情回应记录（请自然体会{{user}}情绪）：\n${lines.join("\n")}`;
      }

      promptAddition += `\n如果{{char}}对{{user}}刚才说的某一句话有强烈的表情反应（如喜爱、大笑、赞同、震惊等），可以在回复的最末尾附带标记：\n- 回应指定一句话：[reaction:emoji(该句部分文字)]（例如 [reaction:❤️(喜欢你)] 或 [reaction:😂] 默认上一句）\n- 撤回对某句话的回应：[remove_reaction(该句部分文字)] 或 [remove_reaction]\n系统会自动将其转化为对应气泡左上角的emoji reaction，请勿在正文其他地方提及代码指令本身。`;

      payload.hint = (payload.hint || "") + promptAddition;
      return payload;
    });

    /* ============================================================ */
    /* 设置变化                                                      */
    /* ============================================================ */
    // FIX(#8): 只有 preventOverflowClip 真正变化时才 rerenderAll，避免无关设置变动引发全量重渲染
    let cachedPreventOverflow = ctx.system.settings.get("preventOverflowClip") === true;
    if (ctx.system.settings && typeof ctx.system.settings.onChange === "function") {
      const unsub = ctx.system.settings.onChange(() => {
        const now = ctx.system.settings.get("preventOverflowClip") === true;
        if (now === cachedPreventOverflow) return;
        cachedPreventOverflow = now;
        rerenderAll();
      });
      if (typeof unsub === "function") settingsUnsubscribe = unsub;
    }

    /* ============================================================ */
    /* 清理                                                          */
    /* ============================================================ */
    return () => {
      if (settingsUnsubscribe) { settingsUnsubscribe(); settingsUnsubscribe = null; }
      disarmMenuWatch();
      if (menuObserver) { menuObserver.disconnect(); menuObserver = null; }
      menuObserverArmed = false;
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      hideQuickPicker();
      rerenderMap.clear();
      messageMap.clear();
      emojiCache.clear();
      recoveryAttempted.clear();
      cssVarCache.clear();
      pendingBubble = null;
      if (userCssEl && userCssEl.parentElement) userCssEl.parentElement.removeChild(userCssEl);
      userCssEl = null;
    };
  },
};
