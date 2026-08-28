const PLUGIN_ID = "float-nine-slice-bubble-skins";
const STORAGE_KEY = "state-v4";

const DEFAULT_STATE = {
  version: 6,
  userSkinId: "",
  groups: {},
  skins: {},
  characterBindings: {},
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function safeNumber(value, fallback, min = 0, max = 9999) {
  if (typeof value === "string" && value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function normalizeSkin(raw) {
  const slice = raw && raw.slice ? raw.slice : {};
  const padding = raw && raw.padding ? raw.padding : {};
  return {
    id: String(raw && raw.id || ""),
    name: String(raw && raw.name || "未命名皮肤"),
    groupId: String(raw && raw.groupId || ""),
    image: String(raw && raw.image || ""),
    width: safeNumber(raw && raw.width, 0),
    height: safeNumber(raw && raw.height, 0),
    slice: {
      top: safeNumber(slice.top, 20),
      right: safeNumber(slice.right, 20),
      bottom: safeNumber(slice.bottom, 20),
      left: safeNumber(slice.left, 20),
    },
    padding: {
      top: safeNumber(padding.top, 10),
      right: safeNumber(padding.right, 14),
      bottom: safeNumber(padding.bottom, 10),
      left: safeNumber(padding.left, 14),
    },
    edgeScale: safeNumber(raw && raw.edgeScale, 0.6, 0.05, 2),
    textColor: String(raw && raw.textColor || "#4b5563"),
  };
}

function normalizeState(raw) {
  const state = cloneDefaultState();
  if (!raw || typeof raw !== "object") return state;
  state.userSkinId = String(raw.userSkinId || "");
  if (raw.groups && typeof raw.groups === "object") {
    for (const [id, value] of Object.entries(raw.groups)) {
      if (!id) continue;
      state.groups[id] = { id, name: String(value && value.name || "未命名分组") };
    }
  }
  if (raw.skins && typeof raw.skins === "object") {
    for (const [id, value] of Object.entries(raw.skins)) {
      const skin = normalizeSkin({ ...value, id });
      if (skin.groupId && !state.groups[skin.groupId]) skin.groupId = "";
      if (skin.id) state.skins[skin.id] = skin;
    }
  }
  if (raw.characterBindings && typeof raw.characterBindings === "object") {
    for (const [characterId, skinId] of Object.entries(raw.characterBindings)) {
      if (characterId && state.skins[String(skinId)]) {
        state.characterBindings[String(characterId)] = String(skinId);
      }
    }
  }
  if (!state.skins[state.userSkinId]) state.userSkinId = "";
  return state;
}

function uid() {
  return "skin-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function escapeCssUrl(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\n\r]/g, "");
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) return text;
    }
  }
  return "";
}

function displayName(item, fallback) {
  return firstString(item && item.name, item && item.nickname, item && item.title, item && item.displayName, fallback);
}

function getId(item) {
  return firstString(item && item.id, item && item.characterId, item && item.contactId, item && item.uuid);
}

function fieldCandidates(message) {
  const m = message || {};
  const meta = m.metadata || m.meta || {};
  const sender = m.sender || m.author || {};
  return [
    m.characterId,
    m.senderCharacterId,
    m.sourceCharacterId,
    m.speakerId,
    m.senderId,
    m.authorId,
    meta.characterId,
    meta.senderCharacterId,
    meta.speakerId,
    meta.senderId,
    sender.characterId,
    sender.id,
  ].map(v => firstString(v)).filter(Boolean);
}

function findBubbleElement(el) {
  if (!el || !el.closest) return null;
  const selector = '[class*="chat-bubble-role-"]';
  const direct = el.closest(selector);
  if (direct) return direct;
  let node = el.parentElement;
  for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
    if (node.matches && node.matches(selector)) return node;
    if (node.querySelector) {
      const found = node.querySelector(selector);
      if (found) return found;
    }
  }
  return null;
}

function findSkinTarget(bubble, role) {
  if (!bubble || role !== "user") return bubble;
  return bubble.querySelector(".chat-bilingual-section:first-child")
    || bubble.querySelector(".chat-markdown")
    || bubble;
}

function clearBubbleWrapper(bubble) {
  if (!bubble) return;
  delete bubble.dataset.nineSliceBubbleWrapper;
}

function clearBubbleSkin(bubble) {
  if (!bubble) return;
  delete bubble.dataset.nineSliceBubbleSkin;
  delete bubble.dataset.nineSliceBubbleRole;
  [
    "--nsb-image", "--nsb-slice-top", "--nsb-slice-right", "--nsb-slice-bottom", "--nsb-slice-left",
    "--nsb-edge-top", "--nsb-edge-right", "--nsb-edge-bottom", "--nsb-edge-left",
    "--nsb-pad-top", "--nsb-pad-right", "--nsb-pad-bottom", "--nsb-pad-left",
    "--nsb-text-color",
  ].forEach(name => bubble.style.removeProperty(name));
}

function applySkinToBubble(bubble, skin, role) {
  if (!bubble || !skin || !skin.image) {
    clearBubbleSkin(bubble);
    return;
  }
  const s = skin.slice;
  const p = skin.padding;
  const scale = skin.edgeScale;
  bubble.dataset.nineSliceBubbleSkin = "1";
  bubble.dataset.nineSliceBubbleRole = role === "user" ? "user" : "assistant";
  bubble.style.setProperty("--nsb-image", `url("${escapeCssUrl(skin.image)}")`);
  bubble.style.setProperty("--nsb-slice-top", String(s.top));
  bubble.style.setProperty("--nsb-slice-right", String(s.right));
  bubble.style.setProperty("--nsb-slice-bottom", String(s.bottom));
  bubble.style.setProperty("--nsb-slice-left", String(s.left));
  bubble.style.setProperty("--nsb-edge-top", `${s.top * scale}px`);
  bubble.style.setProperty("--nsb-edge-right", `${s.right * scale}px`);
  bubble.style.setProperty("--nsb-edge-bottom", `${s.bottom * scale}px`);
  bubble.style.setProperty("--nsb-edge-left", `${s.left * scale}px`);
  bubble.style.setProperty("--nsb-pad-top", `${p.top}px`);
  bubble.style.setProperty("--nsb-pad-right", `${p.right}px`);
  bubble.style.setProperty("--nsb-pad-bottom", `${p.bottom}px`);
  bubble.style.setProperty("--nsb-pad-left", `${p.left}px`);
  bubble.style.setProperty("--nsb-text-color", skin.textColor);
}

const RUNTIME_CSS = `
[data-nine-slice-bubble-skin="1"] {
  position: relative !important;
  isolation: isolate !important;
  overflow: visible !important;
  background: transparent !important;
  background-image: none !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  color: var(--nsb-text-color) !important;
  padding: var(--nsb-pad-top) var(--nsb-pad-right) var(--nsb-pad-bottom) var(--nsb-pad-left) !important;
  animation: none !important;
  box-sizing: border-box !important;
  min-width: calc(var(--nsb-edge-left) + var(--nsb-edge-right)) !important;
  min-height: calc(var(--nsb-edge-top) + var(--nsb-edge-bottom)) !important;
}
[data-nine-slice-bubble-skin="1"][data-nine-slice-bubble-role="user"] {
  min-height: 0 !important;
  height: auto !important;
}
[data-nine-slice-bubble-wrapper="user"] {
  overflow: visible !important;
  background: transparent !important;
  background-image: none !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
}
[data-nine-slice-bubble-skin="1"]::after {
  content: "" !important;
  display: block !important;
  position: absolute !important;
  inset: 0 !important;
  z-index: -1 !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  border-style: solid !important;
  border-color: transparent !important;
  border-width: var(--nsb-edge-top) var(--nsb-edge-right) var(--nsb-edge-bottom) var(--nsb-edge-left) !important;
  border-image-source: var(--nsb-image) !important;
  border-image-slice: var(--nsb-slice-top) var(--nsb-slice-right) var(--nsb-slice-bottom) var(--nsb-slice-left) fill !important;
  border-image-width: var(--nsb-edge-top) var(--nsb-edge-right) var(--nsb-edge-bottom) var(--nsb-edge-left) !important;
  border-image-repeat: stretch !important;
  background: transparent !important;
}
`;

const MIRROR_CSS = `
[data-nine-slice-bubble-wrapper="voice"] {
  overflow: visible !important;
  background: transparent !important;
  background-image: none !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 0 !important;
}
[data-nine-slice-bubble-skin="1"][data-nine-slice-bubble-role="assistant"]::after {
  transform: scaleX(-1) !important;
  transform-origin: center center !important;
}
`;

const EDITOR_CSS = `
.nsb-editor{font-family:system-ui,-apple-system,sans-serif;color:#263241;width:min(920px,96vw);height:calc(100vh - 28px);height:calc(100dvh - 28px);max-height:calc(100vh - 28px);max-height:calc(100dvh - 28px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#f8fafc;border-radius:18px;padding:18px 18px 28px;box-sizing:border-box}
.nsb-editor *{box-sizing:border-box}.nsb-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.nsb-title{font-size:18px;font-weight:750}.nsb-close,.nsb-btn{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 12px;color:#334155;cursor:pointer}.nsb-btn.primary{background:#5f7fa8;color:white;border-color:#5f7fa8}.nsb-btn.danger{color:#b42318}.nsb-grid{display:grid;grid-template-columns:minmax(210px,260px) minmax(0,1fr);gap:16px}.nsb-side,.nsb-main,.nsb-card{background:#fff;border:1px solid #dce4ee;border-radius:14px;padding:13px}.nsb-row{display:flex;gap:8px;align-items:center;margin:8px 0}.nsb-row.wrap{flex-wrap:wrap}.nsb-row label{font-size:12px;color:#64748b;min-width:58px}.nsb-input,.nsb-select{width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:7px 9px;background:white;color:#27364a}.nsb-num{width:72px}.nsb-list{display:flex;flex-direction:column;gap:6px;margin:10px 0}.nsb-skin-item{border:1px solid #dce4ee;border-radius:10px;padding:9px;background:#fff;text-align:left;cursor:pointer}.nsb-skin-item.active{border-color:#6f91ba;background:#edf4fb}.nsb-muted{font-size:11px;color:#77869a;line-height:1.45}.nsb-section-title{font-size:13px;font-weight:700;margin:14px 0 7px}.nsb-stage{position:relative;display:inline-block;max-width:100%;line-height:0;background:repeating-conic-gradient(#eef2f6 0 25%,#fff 0 50%) 0/16px 16px;border:1px solid #d8e0ea;touch-action:none}.nsb-stage img{display:block;max-width:100%;max-height:330px;object-fit:contain}.nsb-line{position:absolute;background:#f04438;z-index:3;touch-action:none}.nsb-line.v{top:0;bottom:0;width:2px;cursor:ew-resize}.nsb-line.h{left:0;right:0;height:2px;cursor:ns-resize}.nsb-control-grid{display:grid;grid-template-columns:repeat(4,minmax(72px,1fr));gap:8px}.nsb-control-grid label{font-size:11px;color:#64748b}.nsb-control-grid input{margin-top:4px}.nsb-preview{padding:24px;background:#edf2f7;border-radius:12px;display:flex;flex-direction:column;gap:14px;overflow:hidden}.nsb-demo{position:relative;isolation:isolate;align-self:flex-start;max-width:72%;padding:10px 14px;color:#46576d}.nsb-demo.user{align-self:flex-end}.nsb-demo::after{content:"";position:absolute;inset:0;z-index:-1;border-style:solid;border-color:transparent;border-image-repeat:stretch}.nsb-binding{display:grid;grid-template-columns:minmax(100px,1fr) minmax(140px,1.2fr);gap:7px;align-items:center;margin:7px 0}.nsb-foot{display:flex;justify-content:space-between;gap:10px;margin-top:14px}.nsb-file{font-size:12px;max-width:100%}@media(max-width:700px){.nsb-grid{grid-template-columns:1fr}.nsb-control-grid{grid-template-columns:repeat(2,1fr)}.nsb-editor{padding:12px}.nsb-side{order:2}}
.nsb-foot{padding-bottom:max(8px,env(safe-area-inset-bottom))}@media(max-width:700px){.nsb-editor{padding-bottom:24px}}
.nsb-grid.single{grid-template-columns:minmax(0,1fr)}.nsb-settings-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;background:#eef2f7;border-radius:11px;margin-bottom:12px}.nsb-settings-tab{border:0;border-radius:8px;padding:8px;background:transparent;color:#64748b}.nsb-settings-tab.active{background:#fff;color:#334155;box-shadow:0 1px 4px rgba(51,65,85,.12)}.nsb-library-head,.nsb-library-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.nsb-library-head{margin:5px 0 8px;font-weight:700}.nsb-library-row{padding:10px 0;border-bottom:1px solid rgba(120,140,165,.16)}.nsb-library-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nsb-mini-actions{display:flex;gap:6px;flex-shrink:0}.nsb-mini-btn{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px 9px;color:#475569}.nsb-mini-btn.primary{background:#6f8fb5;color:#fff;border-color:#6f8fb5}.nsb-mini-btn.danger{color:#b42318}.nsb-role-picker{border:1px solid #d7e0ea;border-radius:10px;background:#fff}.nsb-role-picker summary{cursor:pointer;padding:8px 10px;font-size:12px;color:#526174;list-style:none}.nsb-role-picker summary::-webkit-details-marker{display:none}.nsb-role-options{max-height:190px;overflow:auto;border-top:1px solid #e2e8f0;padding:6px}.nsb-role-option{display:flex;align-items:center;gap:8px;padding:7px 5px;font-size:12px}.nsb-bind-row{display:grid;grid-template-columns:minmax(90px,1fr) minmax(150px,1.35fr);gap:8px;align-items:start;margin:9px 0}
.nsb-library-tools{display:flex;gap:6px;flex-wrap:wrap}.nsb-basic-row{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(110px,160px) auto;gap:8px;align-items:center;margin:8px 0 12px}.nsb-slider-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}.nsb-slider-item{display:grid;grid-template-columns:24px minmax(0,1fr) 64px;gap:6px;align-items:center;font-size:12px;color:#64748b}.nsb-slider-item input[type="range"]{width:100%;min-width:0}.nsb-slider-item input[type="number"]{width:64px;padding:6px 7px;border:1px solid #cbd5e1;border-radius:8px;color:#334155;background:#fff}.nsb-group{border:1px solid rgba(120,140,165,.18);border-radius:11px;margin:10px 0;padding:0 10px}.nsb-group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;font-weight:650}.nsb-group-actions{display:flex;gap:5px}.nsb-role-summary{display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-height:18px}.nsb-role-tag{display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:999px;background:#edf3f9;color:#4d6480;font-size:11px}.nsb-role-placeholder{color:#78879a}.nsb-role-arrow{margin-left:auto}@media(max-width:680px){.nsb-library-head{align-items:flex-start;flex-direction:column}.nsb-basic-row{grid-template-columns:auto minmax(0,1fr) auto}.nsb-basic-row .nsb-select{grid-column:2}.nsb-basic-row .nsb-file-button{grid-column:3;grid-row:1/3}.nsb-slider-grid{grid-template-columns:1fr}}
.nsb-line{pointer-events:none!important;cursor:default!important}
.nsb-demo::after{inset:0;border-width:var(--preview-edge-top) var(--preview-edge-right) var(--preview-edge-bottom) var(--preview-edge-left);border-image-source:var(--preview-image);border-image-slice:var(--preview-slice-top) var(--preview-slice-right) var(--preview-slice-bottom) var(--preview-slice-left) fill;border-image-width:var(--preview-edge-top) var(--preview-edge-right) var(--preview-edge-bottom) var(--preview-edge-left)}.nsb-bind-row,.nsb-bind-row .nsb-select,.nsb-role-picker summary,.nsb-role-option{font-size:13px!important}
.nsb-demo:not(.user)::after{transform:scaleX(-1);transform-origin:center center}
.nsb-role-picker summary{display:flex;align-items:center;gap:6px}
.nsb-unified-toolbar{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap;margin-bottom:11px}.nsb-icon-btn{display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#52677f;cursor:pointer}.nsb-icon-btn svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.nsb-icon-btn.primary{background:#6f8fb5;border-color:#6f8fb5;color:#fff}.nsb-icon-btn.danger{color:#b42318}.nsb-icon-btn.active{background:#fff0f0;border-color:#e4a6a6;color:#b42318}.nsb-group-tabs{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px}.nsb-group-tab{border:1px solid #d7e0ea;border-radius:999px;background:#fff;color:#68788d;padding:6px 11px;font-size:12px}.nsb-group-tab.active{background:#6f8fb5;border-color:#6f8fb5;color:#fff}.nsb-group-tab.delete-selected{background:#fff0f0;border-color:#d88c8c;color:#b42318}.nsb-group-tab.delete-disabled{opacity:.45;cursor:not-allowed}.nsb-section-block{margin:12px 0}.nsb-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;padding:0 2px;font-size:13px;font-weight:650}.nsb-skin-card{border:1px solid rgba(120,140,165,.2);border-radius:11px;background:#fff;margin:7px 0;overflow:hidden}.nsb-skin-top{display:grid;grid-template-columns:32px minmax(0,1fr) 36px;align-items:center;gap:5px;padding:7px}.nsb-chevron{display:grid;place-items:center;width:30px;height:30px;border:0;background:transparent;color:#6b7e94;transition:transform .15s}.nsb-chevron.open{transform:rotate(180deg)}.nsb-skin-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600}.nsb-bound-tags{display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-height:31px;padding:0 10px 8px;cursor:pointer}.nsb-bound-tag{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:#edf3f9;color:#4d6480;font-size:11px}.nsb-bound-tag.user{background:#f9e7ef;color:#a54f73}.nsb-bound-tag .remove{margin-left:4px;font-weight:700}.nsb-unbound{font-size:11px;color:#9aa7b7}.nsb-picker-list{display:none;border-top:1px solid #e5eaf0;padding:7px 10px;max-height:220px;overflow:auto}.nsb-picker-list.open{display:block}.nsb-picker-option{display:flex;align-items:center;gap:8px;padding:7px 2px;font-size:12px}.nsb-picker-option.user{color:#a54f73}.nsb-delete-row{display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:5px;padding:10px}.nsb-delete-row input{width:18px;height:18px}.nsb-delete-bar{position:sticky;bottom:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding:9px;background:rgba(248,250,252,.96);border:1px solid #d9e1ea;border-radius:11px;backdrop-filter:blur(10px)}.nsb-delete-actions{display:flex;gap:7px}.nsb-action-btn{border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#526174;padding:7px 10px}.nsb-action-btn.danger{background:#b94b4b;border-color:#b94b4b;color:#fff}.nsb-empty{padding:18px 4px;text-align:center;color:#8a98a9;font-size:12px}
.nsb-delete-chips{display:flex;flex-wrap:wrap;gap:7px;padding:3px 0 8px}.nsb-delete-chip{display:inline-flex;align-items:center;border:1px solid #d7e0ea;border-radius:999px;background:#fff;color:#607086;padding:6px 9px;font-size:12px}.nsb-delete-chip.selected{border-color:#d88c8c;background:#fff0f0;color:#b42318}.nsb-name-dialog{width:min(390px,88vw);padding:16px;border-radius:15px;background:#fff;color:#334155;box-shadow:0 16px 46px rgba(35,48,66,.24)}.nsb-name-title{font-size:15px;font-weight:700;margin-bottom:11px}.nsb-name-input{width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:9px 10px;font-size:14px}.nsb-name-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:13px}
`;

export default {
  manifest: {
    id: PLUGIN_ID,
    name: "自定义气泡",
    apiVersion: 1,
    version: "0.10.9",
    author: "NEEN&GPT",
    description: "上传透明 PNG 制作自定义气泡，并按角色 ID 绑定皮肤",
  },

  setup(ctx) {
    let state = normalizeState(ctx.system.storage.get(STORAGE_KEY));
    const mounted = new Map();
    const loggedUnknownShapes = new Set();
    const settingsRefreshers = new Set();
    let editorOpen = false;
    let currentSessionId = "";
    let voiceScanPending = false;

    ctx.ui.injectCSS(RUNTIME_CSS + MIRROR_CSS + EDITOR_CSS);

    const persist = () => ctx.system.storage.set(STORAGE_KEY, state);
    const enabled = () => true;
    const refreshSettingsPanels = () => {
      for (const refresh of settingsRefreshers) {
        try { refresh(); }
        catch (error) { ctx.system.log("[自定义气泡] 刷新绑定界面失败", error); }
      }
    };

    function resolveCharacterId(message, sessionId) {
      const direct = fieldCandidates(message);
      for (const id of direct) {
        if (state.characterBindings[id]) return id;
      }
      if (direct.length) return direct[0];

      try {
        const session = sessionId ? ctx.data.sessions.get(sessionId) : null;
        if (session && !session.isGroup) {
          const contactId = firstString(session.contactId, session.characterId);
          if (contactId) {
            let contact = null;
            try {
              const contacts = ctx.data.contacts.list() || [];
              contact = contacts.find(item => getId(item) === contactId) || null;
            } catch (_) {}
            return firstString(contact && contact.characterId, contact && contact.roleId, session.characterId, contactId);
          }
        }
      } catch (_) {}
      return "";
    }

    function chooseSkin(meta) {
      if (!enabled()) return null;
      const message = meta.message || {};
      if (message.role === "user") return state.skins[state.userSkinId] || null;
      if (message.role !== "assistant") return null;
      const characterId = resolveCharacterId(message, meta.sessionId);
      if (!characterId) return null;
      return state.skins[state.characterBindings[characterId]] || null;
    }

    function applyMounted() {
      for (const [bubble, meta] of mounted.entries()) {
        if (!bubble.isConnected) {
          clearBubbleWrapper(meta.outerBubble);
          mounted.delete(bubble);
          continue;
        }
        const role = meta.message && meta.message.role;
        const skin = chooseSkin(meta);
        if (skin && meta.outerBubble && bubble !== meta.outerBubble && (role === "user" || meta.isVoice)) {
          meta.outerBubble.dataset.nineSliceBubbleWrapper = meta.isVoice ? "voice" : "user";
        } else {
          clearBubbleWrapper(meta.outerBubble);
        }
        applySkinToBubble(bubble, skin, role);
      }
    }

    function clearMounted() {
      for (const [bubble, meta] of mounted.entries()) {
        clearBubbleSkin(bubble);
        clearBubbleWrapper(meta.outerBubble);
      }
      mounted.clear();
    }

    ctx.ui.slot("message.footer", (el, props) => {
      const message = props && props.message;
      if (!message || (message.role !== "user" && message.role !== "assistant")) return;

      const originalFooterStyle = el.style.cssText;
      if (message.role === "user") {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("height", "0", "important");
        el.style.setProperty("min-height", "0", "important");
        el.style.setProperty("margin", "0", "important");
        el.style.setProperty("padding", "0", "important");
      }

      let bubble = null;
      let outerBubble = null;
      const mount = () => {
        outerBubble = findBubbleElement(el);
        if (!outerBubble) return;
        bubble = findSkinTarget(outerBubble, message.role);
        if (!bubble) return;
        const meta = { message, sessionId: props.sessionId, outerBubble };
        const skin = chooseSkin(meta);
        if (message.role === "user" && skin && bubble !== outerBubble) {
          outerBubble.dataset.nineSliceBubbleWrapper = "user";
        } else {
          clearBubbleWrapper(outerBubble);
        }
        mounted.set(bubble, meta);
        applySkinToBubble(bubble, skin, message.role);

        if (message.role === "assistant" && !resolveCharacterId(message, props.sessionId)) {
          const signature = Object.keys(message).sort().join(",");
          if (!loggedUnknownShapes.has(signature)) {
            loggedUnknownShapes.add(signature);
            ctx.system.log("[自定义气泡] 无法识别发言角色。消息字段：", Object.keys(message));
          }
        }
      };
      mount();
      ctx.system.timers.setTimeout(mount, 0);
      return () => {
        el.style.cssText = originalFooterStyle;
        if (bubble) {
          mounted.delete(bubble);
          clearBubbleSkin(bubble);
        }
        clearBubbleWrapper(outerBubble);
      };
    });

    function findMessageForVoice(messageId) {
      const findInSession = sessionId => {
        if (!sessionId) return null;
        try {
          const messages = ctx.data.messages.list(sessionId) || [];
          const message = messages.find(item => String(item && item.id || "") === messageId);
          return message ? { message, sessionId } : null;
        } catch (_) { return null; }
      };
      const current = findInSession(currentSessionId);
      if (current) return current;
      try {
        const sessions = ctx.data.sessions.list() || [];
        for (const session of sessions) {
          const found = findInSession(String(session && session.id || ""));
          if (found) return found;
        }
      } catch (_) {}
      return null;
    }

    function scanVoiceBubbles() {
      voiceScanPending = false;
      if (typeof document === "undefined") return;
      for (const voice of document.querySelectorAll(".voice-msg-bubble")) {
        const outerBubble = voice.closest('[data-msg-id][class*="chat-bubble-role-"]');
        if (!outerBubble) continue;
        const messageId = String(outerBubble.dataset.msgId || "");
        const found = findMessageForVoice(messageId);
        if (!found) continue;
        const meta = { message: found.message, sessionId: found.sessionId, outerBubble, isVoice: true };
        const skin = chooseSkin(meta);
        if (skin) {
          outerBubble.dataset.nineSliceBubbleWrapper = "voice";
        } else {
          clearBubbleWrapper(outerBubble);
        }
        mounted.set(voice, meta);
        applySkinToBubble(voice, skin, found.message.role);
      }
      applyMounted();
    }

    function scheduleVoiceScan() {
      if (voiceScanPending) return;
      voiceScanPending = true;
      ctx.system.timers.setTimeout(scanVoiceBubbles, 0);
    }

    const voiceObserver = typeof MutationObserver === "function" && typeof document !== "undefined"
      ? new MutationObserver(scheduleVoiceScan)
      : null;
    if (voiceObserver && document.body) {
      voiceObserver.observe(document.body, { childList: true, subtree: true });
    }

    ctx.hooks.on("app.ready", scheduleVoiceScan);
    ctx.hooks.on("message.persisted", scheduleVoiceScan);
    ctx.hooks.on("message.updated", scheduleVoiceScan);
    ctx.hooks.on("session.opened", payload => {
      currentSessionId = String(payload && payload.sessionId || "");
      ctx.system.timers.setTimeout(() => { applyMounted(); scanVoiceBubbles(); }, 0);
    });
    scheduleVoiceScan();

    function buildSkinOptions(select, selected, includeDefault = true) {
      select.textContent = "";
      if (includeDefault) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "默认";
        select.appendChild(option);
      }
      for (const skin of Object.values(state.skins)) {
        const option = document.createElement("option");
        option.value = skin.id;
        option.textContent = skin.name;
        select.appendChild(option);
      }
      select.value = selected || "";
    }

    async function getCharacters() {
      try {
        const result = await Promise.resolve(ctx.data.characters.list());
        return Array.isArray(result) ? result : [];
      } catch (error) {
        ctx.system.log("[自定义气泡] 读取角色列表失败", error);
        return [];
      }
    }

    function openEditor(skinId, isNew = false) {
      if (editorOpen) return;
      if (!skinId || !state.skins[skinId]) return;
      editorOpen = true;
      ctx.ui.openModal((host, { close }) => {
        const selectedId = skinId;

        host.style.width = "min(920px, 96vw)";
        host.style.maxWidth = "96vw";
        host.style.maxHeight = "calc(100dvh - 16px)";
        host.style.padding = "0";
        host.style.overflow = "visible";
        host.style.background = "transparent";
        host.style.boxShadow = "none";
        const root = document.createElement("div");
        root.className = "nsb-editor";
        host.appendChild(root);

        let editorClosed = false;
        const discardEmptyNewSkin = () => {
          if (!isNew || !state.skins[selectedId] || state.skins[selectedId].image) return;
          delete state.skins[selectedId];
          persist();
          refreshSettingsPanels();
        };
        const closeEditor = () => {
          if (editorClosed) return;
          editorClosed = true;
          discardEmptyNewSkin();
          editorOpen = false;
          close();
        };
        const saveEditor = () => {
          const current = state.skins[selectedId];
          if (!current || !current.image) {
            ctx.ui.toast("请先选择气泡图片");
            return;
          }
          editorClosed = true;
          editorOpen = false;
          persist();
          refreshSettingsPanels();
          close();
        };

        function input(type, value, className = "nsb-input") {
          const el = document.createElement("input");
          el.type = type;
          el.value = value == null ? "" : String(value);
          el.className = className;
          if (type === "number") {
            el.inputMode = "decimal";
            let valueBeforeEdit = el.value;
            el.addEventListener("focus", () => {
              valueBeforeEdit = el.value;
              el.value = "";
            });
            el.addEventListener("blur", () => {
              if (el.value.trim() === "") el.value = valueBeforeEdit;
            });
          }
          return el;
        }

        function button(text, className, onClick) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "nsb-btn" + (className ? " " + className : "");
          el.textContent = text;
          el.addEventListener("click", onClick);
          return el;
        }

        function render() {
          root.textContent = "";
          const grid = document.createElement("div");
          grid.className = "nsb-grid single";
          const main = document.createElement("div");
          main.className = "nsb-main";
          grid.appendChild(main);
          root.appendChild(grid);

          const selected = state.skins[selectedId];
          if (!selected) {
            const empty = document.createElement("div");
            empty.className = "nsb-muted";
            empty.textContent = "请先新建一个气泡皮肤。";
            main.appendChild(empty);
          } else {
            let repositionLines = () => {};
            let previewFrame = 0;
            const schedulePreview = () => {
              if (previewFrame) return;
              previewFrame = requestAnimationFrame(() => {
                previewFrame = 0;
                repositionLines();
                updatePreview();
              });
            };
            const nameRow = document.createElement("div");
            nameRow.className = "nsb-basic-row";
            const nameLabel = document.createElement("label");
            nameLabel.textContent = "名称";
            const nameInput = input("text", selected.name);
            nameInput.addEventListener("input", () => { selected.name = nameInput.value || "未命名皮肤"; persist(); });
            nameInput.addEventListener("change", () => { refreshSettingsPanels(); render(); });
            const fileInput = input("file", "", "nsb-file");
            fileInput.accept = "image/png,image/webp";
            fileInput.style.display = "none";
            const fileButton = button("选择文件", "nsb-file-button", () => fileInput.click());
            fileInput.addEventListener("change", () => {
              const file = fileInput.files && fileInput.files[0];
              if (!file) return;
              const replacingExistingImage = Boolean(selected.image);
              const reader = new FileReader();
              reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                  selected.image = String(reader.result);
                  selected.width = img.naturalWidth;
                  selected.height = img.naturalHeight;
                  if (!selected.slice.top || selected.slice.top >= img.naturalHeight / 2) selected.slice.top = Math.round(img.naturalHeight * .25);
                  if (!selected.slice.bottom || selected.slice.bottom >= img.naturalHeight / 2) selected.slice.bottom = Math.round(img.naturalHeight * .25);
                  if (!selected.slice.left || selected.slice.left >= img.naturalWidth / 2) selected.slice.left = Math.round(img.naturalWidth * .25);
                  if (!selected.slice.right || selected.slice.right >= img.naturalWidth / 2) selected.slice.right = Math.round(img.naturalWidth * .25);
                  if (!replacingExistingImage) {
                    const fixedVerticalPixels = selected.slice.top + selected.slice.bottom;
                    selected.edgeScale = fixedVerticalPixels > 0
                      ? Math.min(1, Math.max(0.05, 44 / fixedVerticalPixels))
                      : 0.6;
                  }
                  persist(); applyMounted(); render();
                };
                img.src = String(reader.result);
              };
              reader.readAsDataURL(file);
            });
            const groupSelect = document.createElement("select");
            groupSelect.className = "nsb-select";
            const noGroup = document.createElement("option");
            noGroup.value = "";
            noGroup.textContent = "默认分组";
            groupSelect.appendChild(noGroup);
            for (const group of Object.values(state.groups)) {
              const option = document.createElement("option");
              option.value = group.id;
              option.textContent = group.name;
              groupSelect.appendChild(option);
            }
            groupSelect.value = selected.groupId || "";
            groupSelect.addEventListener("change", () => {
              selected.groupId = groupSelect.value;
              persist(); refreshSettingsPanels();
            });
            nameRow.append(nameLabel, nameInput, groupSelect, fileButton, fileInput);
            main.append(nameRow);

            if (selected.image) {
              const stageWrap = document.createElement("div");
              stageWrap.style.textAlign = "center";
              const stage = document.createElement("div");
              stage.className = "nsb-stage";
              const image = document.createElement("img");
              image.src = selected.image;
              image.alt = "气泡切割预览";
              const lines = {
                left: Object.assign(document.createElement("div"), { className: "nsb-line v" }),
                right: Object.assign(document.createElement("div"), { className: "nsb-line v" }),
                top: Object.assign(document.createElement("div"), { className: "nsb-line h" }),
                bottom: Object.assign(document.createElement("div"), { className: "nsb-line h" }),
              };
              stage.append(image, lines.left, lines.right, lines.top, lines.bottom);
              stageWrap.appendChild(stage);
              main.appendChild(stageWrap);

              const positionLines = () => {
                const w = image.clientWidth || 1;
                const h = image.clientHeight || 1;
                lines.left.style.left = `${selected.slice.left / selected.width * w}px`;
                lines.right.style.left = `${w - selected.slice.right / selected.width * w}px`;
                lines.top.style.top = `${selected.slice.top / selected.height * h}px`;
                lines.bottom.style.top = `${h - selected.slice.bottom / selected.height * h}px`;
              };
              repositionLines = positionLines;
              image.addEventListener("load", positionLines);
              requestAnimationFrame(positionLines);
            }

            function pairedControls(titleText, object, entries, onPreview) {
              const titleEl = document.createElement("div");
              titleEl.className = "nsb-section-title";
              titleEl.textContent = titleText;
              const box = document.createElement("div");
              box.className = "nsb-slider-grid";
              for (const entry of entries) {
                const item = document.createElement("label");
                item.className = "nsb-slider-item";
                const name = document.createElement("span");
                name.textContent = entry.label;
                const range = document.createElement("input");
                range.type = "range";
                range.min = String(entry.min);
                range.max = String(entry.max);
                range.step = String(entry.step);
                range.value = String(object[entry.key]);
                const number = input("number", object[entry.key], "");
                number.min = String(entry.min);
                number.max = String(entry.max);
                number.step = String(entry.step);
                const sync = (source, target) => {
                  object[entry.key] = safeNumber(source.value, object[entry.key], entry.min, entry.max);
                  target.value = String(object[entry.key]);
                  if (onPreview) onPreview();
                };
                range.addEventListener("input", () => sync(range, number));
                number.addEventListener("input", () => sync(number, range));
                const commit = () => { persist(); applyMounted(); };
                range.addEventListener("change", commit);
                number.addEventListener("change", commit);
                item.append(name, range, number);
                box.appendChild(item);
              }
              main.append(titleEl, box);
            }

            const labels = { top: "上", bottom: "下", left: "左", right: "右" };
            const orderedKeys = ["top", "bottom", "left", "right"];
            pairedControls("切割线", selected.slice, orderedKeys.map(key => ({
              key,
              label: labels[key],
              min: 0,
              max: Math.max(1, /top|bottom/.test(key) ? selected.height || 200 : selected.width || 400),
              step: 1,
            })), schedulePreview);
            pairedControls("文字内边距", selected.padding, orderedKeys.map(key => ({
              key,
              label: labels[key],
              min: 0,
              max: 200,
              step: 1,
            })), schedulePreview);

            const visualRow = document.createElement("div");
            visualRow.className = "nsb-row wrap";
            const scaleLabel = document.createElement("label");
            scaleLabel.textContent = "图片大小";
            const scaleRange = document.createElement("input");
            scaleRange.type = "range";
            scaleRange.min = "0.05"; scaleRange.max = "2"; scaleRange.step = "0.05"; scaleRange.value = String(selected.edgeScale);
            scaleRange.style.width = "min(260px,45vw)";
            const scaleInput = input("number", selected.edgeScale, "nsb-input nsb-num");
            scaleInput.step = "0.05"; scaleInput.min = "0.05"; scaleInput.max = "2";
            const syncScale = (source, target) => {
              selected.edgeScale = safeNumber(source.value, selected.edgeScale, .05, 2);
              target.value = String(selected.edgeScale);
              schedulePreview();
            };
            scaleRange.addEventListener("input", () => syncScale(scaleRange, scaleInput));
            scaleInput.addEventListener("input", () => syncScale(scaleInput, scaleRange));
            const commitScale = () => { persist(); applyMounted(); };
            scaleRange.addEventListener("change", commitScale);
            scaleInput.addEventListener("change", commitScale);
            const colorLabel = document.createElement("label");
            colorLabel.textContent = "文字颜色";
            const colorInput = input("color", selected.textColor, "nsb-input");
            colorInput.style.width = "52px";
            colorInput.addEventListener("input", () => { selected.textColor = colorInput.value; persist(); applyMounted(); updatePreview(); });
            visualRow.append(scaleLabel, scaleRange, scaleInput, colorLabel, colorInput);
            main.appendChild(visualRow);

            const previewTitle = document.createElement("div");
            previewTitle.className = "nsb-section-title";
            previewTitle.textContent = "拉伸预览";
            const preview = document.createElement("div");
            preview.className = "nsb-preview";
            preview.style.setProperty("--preview-image", `url("${escapeCssUrl(selected.image)}")`);
            const demos = [
              ["nsb-demo", "短消息"],
              ["nsb-demo user", "拖动滑杆或输入数值，查看气泡的横向与纵向拉伸效果。"],
              ["nsb-demo", "推荐透明 PNG：400 × 150 px；通常无需超过 600 × 225 px。"],
            ].map(([className, text]) => {
              const el = document.createElement("div"); el.className = className; el.textContent = text; preview.appendChild(el); return el;
            });
            main.append(previewTitle, preview);

            function updatePreview() {
              const s = selected.slice;
              const scale = selected.edgeScale;
              preview.style.setProperty("--preview-slice-top", String(s.top));
              preview.style.setProperty("--preview-slice-right", String(s.right));
              preview.style.setProperty("--preview-slice-bottom", String(s.bottom));
              preview.style.setProperty("--preview-slice-left", String(s.left));
              preview.style.setProperty("--preview-edge-top", `${s.top * scale}px`);
              preview.style.setProperty("--preview-edge-right", `${s.right * scale}px`);
              preview.style.setProperty("--preview-edge-bottom", `${s.bottom * scale}px`);
              preview.style.setProperty("--preview-edge-left", `${s.left * scale}px`);
              for (const demo of demos) {
                demo.style.padding = `${selected.padding.top}px ${selected.padding.right}px ${selected.padding.bottom}px ${selected.padding.left}px`;
                demo.style.color = selected.textColor;
                demo.style.minWidth = `${(s.left + s.right) * scale}px`;
                demo.style.minHeight = `${(s.top + s.bottom) * scale}px`;
                demo.style.setProperty("border-width", "0");
              }
            }
            updatePreview();

          }

          const foot = document.createElement("div");
          foot.className = "nsb-foot";
          foot.style.justifyContent = "flex-end";
          foot.append(button("关闭", "", closeEditor), button("保存", "primary", saveEditor));
          root.appendChild(foot);
        }

        render();
        return () => {
          if (!editorClosed) discardEmptyNewSkin();
          editorOpen = false;
        };
      });
    }

    false && ctx.ui.slot("settings.section", (el) => {
      let alive = true;
      let characters = [];
      let charactersLoaded = false;
      let activeTab = "library";
      const box = document.createElement("div");
      box.style.cssText = "padding:12px;border:1px solid rgba(120,140,165,.24);border-radius:12px;margin-top:10px;";
      el.appendChild(box);

      const renderSettings = () => {
        if (!alive) return;
        box.textContent = "";

        const makeButton = (text, className, onClick) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = className;
          button.textContent = text;
          button.addEventListener("click", onClick);
          return button;
        };

        const tabs = document.createElement("div");
        tabs.className = "nsb-settings-tabs";
        for (const [value, label] of [["library", "皮肤库"], ["bindings", "气泡绑定"]]) {
          tabs.appendChild(makeButton(label, "nsb-settings-tab" + (activeTab === value ? " active" : ""), () => {
            activeTab = value;
            renderSettings();
          }));
        }
        box.appendChild(tabs);

        if (activeTab === "library") {
          const importInput = document.createElement("input");
          importInput.type = "file";
          importInput.accept = "application/json,.json";
          importInput.style.display = "none";
          importInput.addEventListener("change", () => {
            const file = importInput.files && importInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                state = normalizeState(JSON.parse(String(reader.result)));
                persist(); applyMounted(); renderSettings();
                ctx.ui.toast("气泡皮肤配置已导入");
              } catch (_) { ctx.ui.toast("导入失败：不是有效的配置文件"); }
            };
            reader.readAsText(file);
          });

          const head = document.createElement("div");
          head.className = "nsb-library-head";
          const tools = document.createElement("div");
          tools.className = "nsb-library-tools";
          tools.append(
            makeButton("新建皮肤", "nsb-mini-btn primary", () => {
              const id = uid();
              state.skins[id] = normalizeSkin({ id, name: "新气泡皮肤" });
              persist(); renderSettings(); openEditor(id);
            }),
            makeButton("新建分组", "nsb-mini-btn", () => {
              const name = prompt("请输入分组名称");
              if (!name || !name.trim()) return;
              const id = uid().replace("skin-", "group-");
              state.groups[id] = { id, name: name.trim() };
              persist(); renderSettings();
            }),
            makeButton("导入配置", "nsb-mini-btn", () => importInput.click()),
            makeButton("导出配置", "nsb-mini-btn", () => {
              const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "float-bubble-skins.json"; a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }),
            importInput
          );
          head.appendChild(tools);
          box.appendChild(head);

          const skins = Object.values(state.skins);
          if (!skins.length) {
            const empty = document.createElement("div");
            empty.className = "nsb-muted";
            empty.textContent = "还没有皮肤，点击“新建”开始制作。";
            empty.style.padding = "12px 0";
            box.appendChild(empty);
          }
          const appendSkinRow = (skin, container) => {
            const row = document.createElement("div");
            row.className = "nsb-library-row";
            const name = document.createElement("div");
            name.className = "nsb-library-name";
            name.textContent = skin.name;
            const actions = document.createElement("div");
            actions.className = "nsb-mini-actions";
            actions.append(
              makeButton("编辑", "nsb-mini-btn", () => openEditor(skin.id)),
              makeButton("删除", "nsb-mini-btn danger", () => {
                if (!confirm(`删除皮肤“${skin.name}”？`)) return;
                delete state.skins[skin.id];
                if (state.userSkinId === skin.id) state.userSkinId = "";
                for (const characterId of Object.keys(state.characterBindings)) {
                  if (state.characterBindings[characterId] === skin.id) delete state.characterBindings[characterId];
                }
                persist(); applyMounted(); renderSettings();
              })
            );
            row.append(name, actions);
            container.appendChild(row);
          };

          const groupEntries = [
            ...Object.values(state.groups),
            { id: "", name: "未分组", virtual: true },
          ];
          for (const group of groupEntries) {
            const groupSkins = skins.filter(skin => (skin.groupId || "") === group.id);
            if (group.virtual && !groupSkins.length) continue;
            const groupBox = document.createElement("div");
            groupBox.className = "nsb-group";
            const groupHead = document.createElement("div");
            groupHead.className = "nsb-group-head";
            const groupName = document.createElement("span");
            groupName.textContent = group.name;
            const groupActions = document.createElement("div");
            groupActions.className = "nsb-group-actions";
            if (!group.virtual) {
              groupActions.append(
                makeButton("重命名", "nsb-mini-btn", () => {
                  const nextName = prompt("修改分组名称", group.name);
                  if (!nextName || !nextName.trim()) return;
                  state.groups[group.id].name = nextName.trim();
                  persist(); renderSettings();
                }),
                makeButton("删除分组", "nsb-mini-btn danger", () => {
                  if (!confirm(`删除分组“${group.name}”？组内皮肤会移至“未分组”。`)) return;
                  for (const skin of Object.values(state.skins)) {
                    if (skin.groupId === group.id) skin.groupId = "";
                  }
                  delete state.groups[group.id];
                  persist(); renderSettings();
                })
              );
            }
            groupHead.append(groupName, groupActions);
            groupBox.appendChild(groupHead);
            for (const skin of groupSkins) appendSkinRow(skin, groupBox);
            box.appendChild(groupBox);
          }

          return;
        }

        const userRow = document.createElement("div");
        userRow.className = "nsb-bind-row";
        const userLabel = document.createElement("div");
        userLabel.textContent = "用户气泡";
        userLabel.style.fontSize = "13px";
        const userSelect = document.createElement("select");
        userSelect.className = "nsb-select";
        buildSkinOptions(userSelect, state.userSkinId);
        userSelect.addEventListener("change", () => {
          state.userSkinId = userSelect.value;
          persist(); applyMounted();
        });
        userRow.append(userLabel, userSelect);
        box.appendChild(userRow);

        if (!charactersLoaded) {
          const loading = document.createElement("div");
          loading.className = "nsb-muted";
          loading.textContent = "正在读取角色列表……";
          box.appendChild(loading);
        } else if (!characters.length) {
          const empty = document.createElement("div");
          empty.className = "nsb-muted";
          empty.textContent = "没有读取到可绑定的角色。";
          box.appendChild(empty);
        }

        const refreshRoleSummaries = () => {
          for (const details of box.querySelectorAll("details[data-skin-id]")) {
            const skinId = details.dataset.skinId;
            const detailsSummary = details.querySelector("summary");
            if (!detailsSummary) continue;
            detailsSummary.textContent = "";
            const tags = document.createElement("span");
            tags.className = "nsb-role-summary";
            const assigned = characters.filter(character => state.characterBindings[getId(character)] === skinId);
            if (!assigned.length) {
              const placeholder = document.createElement("span");
              placeholder.className = "nsb-role-placeholder";
              placeholder.textContent = "选择多个角色";
              tags.appendChild(placeholder);
            } else {
              for (const character of assigned) {
                const characterId = getId(character);
                const tag = document.createElement("span");
                tag.className = "nsb-role-tag";
                tag.textContent = displayName(character, characterId) + " ×";
                tag.addEventListener("click", event => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (state.characterBindings[characterId] === skinId) delete state.characterBindings[characterId];
                  for (const checkbox of box.querySelectorAll("input[data-character-id]")) {
                    if (checkbox.dataset.characterId === characterId) checkbox.checked = false;
                  }
                  persist(); applyMounted(); refreshRoleSummaries();
                });
                tags.appendChild(tag);
              }
            }
            const arrow = document.createElement("span");
            arrow.className = "nsb-role-arrow";
            arrow.textContent = "⌄";
            detailsSummary.append(tags, arrow);
          }
        };

        for (const skin of Object.values(state.skins)) {
          const row = document.createElement("div");
          row.className = "nsb-bind-row";
          const label = document.createElement("div");
          label.textContent = skin.name;
          label.className = "nsb-library-name";
          label.style.fontSize = "13px";

          const picker = document.createElement("details");
          picker.className = "nsb-role-picker";
          picker.dataset.skinId = skin.id;
          const summary = document.createElement("summary");
          const options = document.createElement("div");
          options.className = "nsb-role-options";
          for (const character of characters) {
            const characterId = getId(character);
            if (!characterId) continue;
            const option = document.createElement("label");
            option.className = "nsb-role-option";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.dataset.characterId = characterId;
            checkbox.dataset.skinId = skin.id;
            checkbox.checked = state.characterBindings[characterId] === skin.id;
            const name = document.createElement("span");
            name.textContent = displayName(character, characterId);
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) state.characterBindings[characterId] = skin.id;
              else if (state.characterBindings[characterId] === skin.id) delete state.characterBindings[characterId];
              if (checkbox.checked) {
                for (const other of box.querySelectorAll("input[data-character-id]")) {
                  if (other !== checkbox && other.dataset.characterId === characterId) other.checked = false;
                }
              }
              persist(); applyMounted(); refreshRoleSummaries();
            });
            option.append(checkbox, name);
            options.appendChild(option);
          }
          picker.append(summary, options);
          row.append(label, picker);
          box.appendChild(row);
        }
        refreshRoleSummaries();
      };

      settingsRefreshers.add(renderSettings);
      renderSettings();
      getCharacters().then(list => { characters = list; charactersLoaded = true; renderSettings(); });
      return () => {
        alive = false;
        settingsRefreshers.delete(renderSettings);
        box.remove();
      };
    });

    ctx.ui.slot("settings.section", (el) => {
      let alive = true;
      let characters = [];
      let charactersLoaded = false;
      let activeGroup = "all";
      let deleteMode = false;
      let groupDeleteMode = false;
      const expandedSkins = new Set();
      const deleteSelection = new Set();
      const groupDeleteSelection = new Set();
      const box = document.createElement("div");
      box.style.cssText = "padding:12px;border:1px solid rgba(120,140,165,.24);border-radius:12px;margin-top:10px;";
      el.appendChild(box);

      const icons = {
        imagePlus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
        folderPlus: '<svg viewBox="0 0 24 24"><path d="M3 6.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6M9 14h6"/></svg>',
        upload: '<svg viewBox="0 0 24 24"><path d="M12 16V4M8 8l4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
        download: '<svg viewBox="0 0 24 24"><path d="M12 4v12M8 12l4 4 4-4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
        trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
        pencil: '<svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2zM14.5 7.1l2.8 2.8"/></svg>',
        folderX: '<svg viewBox="0 0 24 24"><path d="M3 6.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM10 12l5 5M15 12l-5 5"/></svg>',
        chevron: '<svg viewBox="0 0 24 24"><path d="m7 9 5 5 5-5"/></svg>',
        close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
        check: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
      };

      const iconButton = (icon, label, onClick, className = "") => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nsb-icon-btn" + (className ? " " + className : "");
        button.innerHTML = icons[icon];
        button.title = label;
        button.setAttribute("aria-label", label);
        button.addEventListener("click", onClick);
        return button;
      };

      const openNameDialog = (titleText, initialValue, onSave) => {
        ctx.ui.openModal((host, { close }) => {
          host.style.cssText = "width:auto;max-width:92vw;padding:0;background:transparent;box-shadow:none;overflow:visible;";
          const dialog = document.createElement("div");
          dialog.className = "nsb-name-dialog";
          const title = document.createElement("div");
          title.className = "nsb-name-title";
          title.textContent = titleText;
          const field = document.createElement("input");
          field.className = "nsb-name-input";
          field.type = "text";
          field.value = initialValue || "";
          const actions = document.createElement("div");
          actions.className = "nsb-name-actions";
          const save = () => {
            const value = field.value.trim();
            if (!value) { field.focus(); return; }
            onSave(value);
            close();
          };
          actions.append(
            iconButton("close", "取消", close),
            iconButton("check", "保存", save, "primary")
          );
          field.addEventListener("keydown", event => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") close();
          });
          dialog.append(title, field, actions);
          host.appendChild(dialog);
          requestAnimationFrame(() => { field.focus(); field.select(); });
        });
      };

      const skinGroupKey = skin => skin.groupId || "default";

      const deleteSkinIds = ids => {
        for (const skinId of ids) {
          delete state.skins[skinId];
          if (state.userSkinId === skinId) state.userSkinId = "";
          for (const characterId of Object.keys(state.characterBindings)) {
            if (state.characterBindings[characterId] === skinId) delete state.characterBindings[characterId];
          }
          expandedSkins.delete(skinId);
          deleteSelection.delete(skinId);
        }
        persist();
        applyMounted();
      };

      const renderSettings = () => {
        if (!alive) return;
        box.textContent = "";

        const importInput = document.createElement("input");
        importInput.type = "file";
        importInput.accept = "application/json,.json";
        importInput.style.display = "none";
        importInput.addEventListener("change", () => {
          const file = importInput.files && importInput.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              state = normalizeState(JSON.parse(String(reader.result)));
              activeGroup = "all";
              deleteMode = false;
              groupDeleteMode = false;
              deleteSelection.clear();
              groupDeleteSelection.clear();
              persist(); applyMounted(); renderSettings();
              ctx.ui.toast("气泡配置已导入");
            } catch (_) { ctx.ui.toast("导入失败：不是有效的配置文件"); }
          };
          reader.readAsText(file);
        });

        const toolbar = document.createElement("div");
        toolbar.className = "nsb-unified-toolbar";
        toolbar.append(
          iconButton("imagePlus", "新建气泡", () => {
            const id = uid();
            state.skins[id] = normalizeSkin({ id, name: "新气泡皮肤", groupId: "" });
            persist(); renderSettings(); openEditor(id, true);
          }, "primary"),
          iconButton("folderPlus", "新建分组", () => {
            openNameDialog("新建分组", "", name => {
              const id = uid().replace("skin-", "group-");
              state.groups[id] = { id, name };
              persist(); renderSettings();
            });
          }),
          iconButton("upload", "导入配置", () => importInput.click()),
          iconButton("download", "导出配置", () => {
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "float-bubble-skins.json"; a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }),
          iconButton("folderX", "批量删除分组", () => {
            if (!groupDeleteMode) {
              groupDeleteMode = true;
              groupDeleteSelection.clear();
              deleteMode = false;
              deleteSelection.clear();
              renderSettings();
              return;
            }
            if (!groupDeleteSelection.size) {
              groupDeleteMode = false;
              renderSettings();
              return;
            }
            const confirmed = confirm(`确定删除选中的 ${groupDeleteSelection.size} 个分组？组内气泡会移至默认分组。`);
            if (confirmed) {
              for (const groupId of groupDeleteSelection) {
                for (const skin of Object.values(state.skins)) {
                  if (skin.groupId === groupId) skin.groupId = "";
                }
                delete state.groups[groupId];
              }
              if (groupDeleteSelection.has(activeGroup)) activeGroup = "default";
              persist();
            }
            groupDeleteMode = false;
            groupDeleteSelection.clear();
            renderSettings();
          }, groupDeleteMode ? "active" : "danger"),
          iconButton("trash", "批量删除气泡", () => {
            if (!deleteMode) {
              deleteMode = true;
              deleteSelection.clear();
              groupDeleteMode = false;
              groupDeleteSelection.clear();
              renderSettings();
              return;
            }
            if (!deleteSelection.size) {
              deleteMode = false;
              renderSettings();
              return;
            }
            const confirmed = confirm(`确定删除选中的 ${deleteSelection.size} 个气泡？`);
            if (confirmed) deleteSkinIds([...deleteSelection]);
            deleteMode = false;
            deleteSelection.clear();
            renderSettings();
          }, deleteMode ? "active" : "danger"),
          importInput
        );
        box.appendChild(toolbar);

        const tabs = document.createElement("div");
        tabs.className = "nsb-group-tabs";
        const tabEntries = [
          ["all", "全部"],
          ["default", "默认分组"],
          ...Object.values(state.groups).map(group => [group.id, group.name]),
        ];
        for (const [id, name] of tabEntries) {
          const fixedGroup = id === "all" || id === "default";
          const tab = document.createElement("button");
          tab.type = "button";
          tab.className = "nsb-group-tab";
          if (groupDeleteMode) {
            if (fixedGroup) tab.classList.add("delete-disabled");
            else if (groupDeleteSelection.has(id)) tab.classList.add("delete-selected");
          } else if (activeGroup === id) {
            tab.classList.add("active");
          }
          tab.textContent = name;
          tab.disabled = groupDeleteMode && fixedGroup;
          tab.addEventListener("click", () => {
            if (groupDeleteMode) {
              if (groupDeleteSelection.has(id)) groupDeleteSelection.delete(id);
              else groupDeleteSelection.add(id);
            } else {
              activeGroup = id;
            }
            renderSettings();
          });
          tabs.appendChild(tab);
        }
        box.appendChild(tabs);

        const allGroups = [
          { id: "default", name: "默认分组", isDefault: true },
          ...Object.values(state.groups),
        ];
        const visibleGroups = activeGroup === "all"
          ? allGroups
          : allGroups.filter(group => group.id === activeGroup);

        const appendBoundTag = (container, text, isUser, onRemove) => {
          const tag = document.createElement("span");
          tag.className = "nsb-bound-tag" + (isUser ? " user" : "");
          tag.appendChild(document.createTextNode(text));
          const remove = document.createElement("span");
          remove.className = "remove";
          remove.textContent = "×";
          remove.addEventListener("click", event => {
            event.preventDefault(); event.stopPropagation(); onRemove();
          });
          tag.appendChild(remove);
          container.appendChild(tag);
        };

        const appendSkinCard = (skin, container) => {
          if (deleteMode) {
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "nsb-delete-chip" + (deleteSelection.has(skin.id) ? " selected" : "");
            const name = document.createElement("span");
            name.textContent = skin.name;
            chip.append(name);
            chip.addEventListener("click", () => {
              if (deleteSelection.has(skin.id)) deleteSelection.delete(skin.id);
              else deleteSelection.add(skin.id);
              renderSettings();
            });
            container.appendChild(chip);
            return;
          }

          const card = document.createElement("div");
          card.className = "nsb-skin-card";

          const open = expandedSkins.has(skin.id);
          const top = document.createElement("div");
          top.className = "nsb-skin-top";
          const chevron = iconButton("chevron", open ? "收起角色选择" : "展开角色选择", () => {
            if (expandedSkins.has(skin.id)) expandedSkins.delete(skin.id);
            else expandedSkins.add(skin.id);
            renderSettings();
          });
          chevron.className = "nsb-icon-btn nsb-chevron" + (open ? " open" : "");
          const name = document.createElement("div");
          name.className = "nsb-skin-name";
          name.textContent = skin.name;
          const edit = iconButton("pencil", "编辑气泡", () => openEditor(skin.id));
          top.append(chevron, name, edit);
          card.appendChild(top);

          const tags = document.createElement("div");
          tags.className = "nsb-bound-tags";
          tags.addEventListener("click", () => {
            expandedSkins.add(skin.id);
            renderSettings();
          });
          let hasBinding = false;
          if (state.userSkinId === skin.id) {
            hasBinding = true;
            appendBoundTag(tags, "用户", true, () => {
              state.userSkinId = ""; persist(); applyMounted(); renderSettings();
            });
          }
          for (const character of characters) {
            const characterId = getId(character);
            if (state.characterBindings[characterId] !== skin.id) continue;
            hasBinding = true;
            appendBoundTag(tags, displayName(character, characterId), false, () => {
              delete state.characterBindings[characterId]; persist(); applyMounted(); renderSettings();
            });
          }
          if (!hasBinding) {
            const empty = document.createElement("span");
            empty.className = "nsb-unbound";
            empty.textContent = "尚未绑定";
            tags.appendChild(empty);
          }
          card.appendChild(tags);

          const picker = document.createElement("div");
          picker.className = "nsb-picker-list" + (open ? " open" : "");
          const userOption = document.createElement("label");
          userOption.className = "nsb-picker-option user";
          const userCheckbox = document.createElement("input");
          userCheckbox.type = "checkbox";
          userCheckbox.checked = state.userSkinId === skin.id;
          userCheckbox.addEventListener("change", () => {
            if (userCheckbox.checked) state.userSkinId = skin.id;
            else if (state.userSkinId === skin.id) state.userSkinId = "";
            persist(); applyMounted(); renderSettings();
          });
          userOption.append(userCheckbox, document.createTextNode("用户"));
          picker.appendChild(userOption);
          for (const character of characters) {
            const characterId = getId(character);
            if (!characterId) continue;
            const option = document.createElement("label");
            option.className = "nsb-picker-option";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = state.characterBindings[characterId] === skin.id;
            checkbox.addEventListener("change", () => {
              if (checkbox.checked) state.characterBindings[characterId] = skin.id;
              else if (state.characterBindings[characterId] === skin.id) delete state.characterBindings[characterId];
              persist(); applyMounted(); renderSettings();
            });
            option.append(checkbox, document.createTextNode(displayName(character, characterId)));
            picker.appendChild(option);
          }
          if (charactersLoaded && !characters.length) {
            const empty = document.createElement("div");
            empty.className = "nsb-empty";
            empty.textContent = "没有读取到可绑定角色";
            picker.appendChild(empty);
          }
          card.appendChild(picker);
          container.appendChild(card);
        };

        let visibleSkinCount = 0;
        for (const group of visibleGroups) {
          const skins = Object.values(state.skins).filter(skin => skinGroupKey(skin) === group.id);
          if (activeGroup === "all" && !skins.length && group.isDefault) continue;
          const section = document.createElement("section");
          section.className = "nsb-section-block";
          const head = document.createElement("div");
          head.className = "nsb-section-head";
          const name = document.createElement("span");
          name.textContent = group.name;
          const actions = document.createElement("div");
          actions.className = "nsb-mini-actions";
          if (activeGroup === "all" && !group.isDefault && !deleteMode && !groupDeleteMode) {
            actions.append(iconButton("pencil", "重命名分组", () => {
              openNameDialog("重命名分组", group.name, nextName => {
                state.groups[group.id].name = nextName;
                persist(); renderSettings();
              });
            }));
          }
          if (activeGroup === "all") {
            head.append(name, actions);
            section.appendChild(head);
          }
          const itemsContainer = deleteMode ? document.createElement("div") : section;
          if (deleteMode) {
            itemsContainer.className = "nsb-delete-chips";
            section.appendChild(itemsContainer);
          }
          for (const skin of skins) {
            visibleSkinCount += 1;
            appendSkinCard(skin, itemsContainer);
          }
          if (!skins.length) {
            const empty = document.createElement("div");
            empty.className = "nsb-empty";
            empty.textContent = "此分组暂无气泡";
            section.appendChild(empty);
          }
          box.appendChild(section);
        }
      };

      settingsRefreshers.add(renderSettings);
      renderSettings();
      getCharacters().then(list => { characters = list; charactersLoaded = true; renderSettings(); });
      return () => {
        alive = false;
        settingsRefreshers.delete(renderSettings);
        box.remove();
      };
    });

    return () => {
      if (voiceObserver) voiceObserver.disconnect();
      clearMounted();
      editorOpen = false;
    };
  },
};
