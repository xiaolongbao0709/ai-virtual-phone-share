const PLUGIN_ID = "float-chat-avatar-switcher";
const STORAGE_KEY = "avatar-state-v1";
const MESSAGE_AVATAR_KEY = "_floatChatAvatarId";
const AVATAR_CHANGE_EVENT = "float-avatar-switcher-change";
const AVATAR_REQUEST_EVENT = "float-avatar-switcher-request";
const DEFAULT_PROMPT_TEMPLATE = `【聊天头像切换】
你可用的头像名称：{{可用头像}}。
当前头像：{{当前头像}}。
若要换成已有头像，在回复最开头单独输出 [[头像:名称]]，名称必须从可用列表中原样选择。
{{照片头像规则}}
已有头像、照片头像与情侣头像指令一次最多选择一种；无需更换时不要输出。指令是界面控制标记，不要解释。`;

const DEFAULT_SINGLE_PHOTO_PROMPT_TEMPLATE = `用户刚通过照片墙发送了一张图片{{照片描述}}。如果你认为它适合作为自己的头像，可以在回复最开头单独输出 [[照片头像:你为图片取的简短名称]]；插件会自动收藏并立即换上。`;

const DEFAULT_PAIR_PHOTO_PROMPT_TEMPLATE = `用户最近通过照片墙发送了两张图片，插件会按发送顺序标为候选 1 和候选 2。
如果用户只是询问哪张更适合当头像，请结合图片内容、你的形象与当前话题进行比较，明确推荐候选编号并自然说明理由；此时不要输出任何头像控制指令，也不要擅自更换头像。
只有用户明确要求将两张图片应用或分配为情侣头像时，你才可以从中选择一张作为自己的头像，并把另一张留给用户。请在回复最开头单独输出 [[情侣头像:角色=1|角色头像名称;用户=2|用户头像名称]]；编号也可反选，但角色与用户必须使用不同候选。名称应依据各自图片内容简短命名。插件会立即换上角色头像，并把另一张保存到“我的头像”，等待用户自行切换。`;

const DEFAULT_SELECTIVE_PROMPT_TEMPLATE = `【头像变化提醒】
{{头像变化说明}}
你已经看到了随本提示附上的新头像图片。可以结合你的性格、你们的关系和当前语境，自然地注意、询问、评价或调侃；若此刻不适合提及，也可以不展开。不要说明这是系统提示。`;

const DEFAULT_STATE = {
  version: 1,
  assets: {},
  activeUserAvatarId: "",
  activeByCharacter: {},
  llmEnabledByCharacter: {},
  promptTemplate: DEFAULT_PROMPT_TEMPLATE,
  singlePhotoPromptTemplate: DEFAULT_SINGLE_PHOTO_PROMPT_TEMPLATE,
  pairPhotoPromptTemplate: DEFAULT_PAIR_PHOTO_PROMPT_TEMPLATE,
  selectivePromptTemplate: DEFAULT_SELECTIVE_PROMPT_TEMPLATE,
  noticeUserAvatarChanges: true,
  noticeCharacterAvatarChanges: true,
  sidebarEnabled: true,
  sidebarTop: null,
};

const CSS = `
.fav-handle{position:fixed;right:0;top:42vh;z-index:2147483000;width:23px;height:62px;padding:0;border:1px solid rgba(255,255,255,.72);border-right:0;border-radius:13px 0 0 13px;background:linear-gradient(180deg,rgba(181,210,158,.95),rgba(137,174,112,.93));color:#fff;box-shadow:-4px 8px 22px rgba(70,96,55,.2);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);touch-action:none;user-select:none;cursor:grab}
.fav-handle:active{cursor:grabbing}.fav-handle svg,.fav-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.fav-handle[hidden],.fav-panel[hidden]{display:none!important}
.fav-panel{position:fixed;right:30px;top:10vh;z-index:2147482999;width:min(430px,calc(100vw - 42px));height:min(76vh,720px);display:grid;grid-template-columns:92px minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;gap:9px 11px;padding:12px;border:1px solid rgba(164,194,141,.72);border-radius:18px;background:rgba(221,237,208,.88);box-shadow:0 18px 50px rgba(67,88,54,.22),inset 0 1px 0 rgba(255,255,255,.82);backdrop-filter:blur(24px) saturate(1.08);-webkit-backdrop-filter:blur(24px) saturate(1.08);font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#52604b;box-sizing:border-box;overflow:hidden}
.fav-tabs{grid-column:1;grid-row:1;min-height:0;display:flex;flex-direction:column;gap:7px;padding:0 8px 8px 0;border-right:1px solid rgba(145,178,120,.4);overflow-y:auto}.fav-tab{width:100%;min-height:36px;padding:6px;border:1px solid rgba(151,184,126,.5);border-radius:10px;background:rgba(255,255,255,.5);color:#617257;font:inherit;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fav-tab.active{background:linear-gradient(135deg,#b7d2a1,#8eaf75);border-color:#86a86d;color:#fff;box-shadow:0 5px 14px rgba(78,108,58,.17)}
.fav-content{grid-column:2;grid-row:1;min-width:0;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:1px 2px 10px}.fav-footer-left{grid-column:1;grid-row:2;display:flex;align-items:center;justify-content:center;padding:8px 8px 0 0;border-right:1px solid rgba(145,178,120,.4)}.fav-footer{grid-column:2;grid-row:2;display:flex;justify-content:center;gap:9px;padding:8px;border:1px solid rgba(151,184,126,.42);border-radius:12px;background:rgba(245,251,240,.7)}
.fav-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px}.fav-title{font-size:14px;font-weight:700;color:#4d6045}.fav-muted{font-size:11px;color:#7e9074}.fav-list{display:flex;flex-direction:column;gap:8px}.fav-card{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:9px;align-items:center;padding:8px;border:1px solid rgba(151,184,126,.43);border-radius:12px;background:rgba(255,255,255,.54);box-shadow:inset 0 1px 0 rgba(255,255,255,.72)}.fav-thumb{width:48px;height:48px;border-radius:50%;overflow:hidden;background:#e4eddd}.fav-thumb img,.fav-crop-img{width:100%;height:100%;object-fit:cover;display:block}.fav-card-name{font-size:13px;font-weight:650;color:#506149;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fav-card-meta{font-size:10px;color:#819078;margin-top:2px}.fav-card.active{border-color:#8dad73;box-shadow:0 0 0 2px rgba(126,161,99,.14)}
.fav-icon{display:grid;place-items:center;width:33px;height:33px;padding:0;border:1px solid rgba(145,178,120,.52);border-radius:9px;background:rgba(255,255,255,.68);color:#607455;cursor:pointer}.fav-icon.primary{background:#94b47d;border-color:#94b47d;color:#fff}.fav-icon.danger{color:#8a6e58}.fav-icon:disabled{opacity:.42;cursor:default}.fav-btn{min-height:34px;padding:6px 11px;border:1px solid rgba(137,174,109,.58);border-radius:9px;background:rgba(255,255,255,.72);color:#5c704f;font:inherit;cursor:pointer}.fav-btn.primary{background:#94b47d;border-color:#94b47d;color:#fff}.fav-btn.danger{color:#876955}.fav-empty{padding:28px 12px;text-align:center;color:#809177;font-size:12px}
.fav-field{display:flex;flex-direction:column;gap:5px;margin:0 0 10px}.fav-label{font-size:11px;color:#66785c}.fav-input,.fav-select{width:100%;height:35px;padding:6px 9px;border:1px solid rgba(137,174,109,.52);border-radius:9px;background:rgba(255,255,255,.7);color:#52604b;font:inherit;box-sizing:border-box;outline:none}.fav-input:focus,.fav-select:focus{border-color:#8fae78;box-shadow:0 0 0 2px rgba(128,164,100,.13)}.fav-source-row{display:grid;grid-template-columns:1fr auto;gap:7px}.fav-crop{width:190px;aspect-ratio:1;max-width:100%;margin:4px auto 6px;border-radius:12px;overflow:hidden;position:relative;background:linear-gradient(135deg,#dcebd1,#f3f8ef);box-shadow:0 0 0 1px rgba(128,164,100,.46),0 8px 24px rgba(62,87,48,.15);touch-action:none;cursor:grab}.fav-crop:active{cursor:grabbing}.fav-crop::before{content:"";position:absolute;z-index:2;inset:0;background:linear-gradient(to right,transparent 33.05%,rgba(255,255,255,.62) 33.15%,rgba(255,255,255,.62) 33.7%,transparent 33.8%,transparent 66.2%,rgba(255,255,255,.62) 66.3%,rgba(255,255,255,.62) 66.85%,transparent 66.95%);pointer-events:none}.fav-crop::after{content:"";position:absolute;z-index:2;inset:0;border-radius:12px;background:linear-gradient(to bottom,transparent 33.05%,rgba(255,255,255,.62) 33.15%,rgba(255,255,255,.62) 33.7%,transparent 33.8%,transparent 66.2%,rgba(255,255,255,.62) 66.3%,rgba(255,255,255,.62) 66.85%,transparent 66.95%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.75);pointer-events:none}.fav-crop-img{transform-origin:center;user-select:none;pointer-events:none}.fav-crop-help{text-align:center;margin:0 0 10px;color:#7e9074;font-size:10px}
.fav-range-row{display:grid;grid-template-columns:38px 1fr 42px;gap:7px;align-items:center;margin:8px 0}.fav-range-row input[type=range]{width:100%;accent-color:#8eae76}.fav-range-value{text-align:right;font-size:10px;color:#7e9074}.fav-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:13px}.fav-note{padding:9px 10px;border-radius:10px;background:rgba(173,204,149,.25);color:#607254;font-size:11px;line-height:1.55}.fav-switch{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0}.fav-switch input{accent-color:#8eae76;width:18px;height:18px}
.fav-settings{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 2px;color:#52604b}.fav-settings input{accent-color:#8eae76;width:18px;height:18px}
.fav-prompt{margin:1px 0 9px;padding:9px;border:1px solid rgba(151,184,126,.42);border-radius:11px;background:rgba(255,255,255,.4)}.fav-prompt>summary{list-style:none;display:flex;align-items:center;gap:7px;cursor:pointer;color:#607254;font-size:12px;font-weight:700;user-select:none}.fav-prompt>summary::-webkit-details-marker{display:none}.fav-prompt>summary::before{content:"›";display:inline-block;font-size:18px;line-height:1;transform:rotate(0deg);transition:transform .16s ease}.fav-prompt[open]>summary::before{transform:rotate(90deg)}.fav-prompt textarea{width:100%;min-height:170px;margin-top:8px;padding:8px;border:1px solid rgba(137,174,109,.5);border-radius:9px;box-sizing:border-box;resize:vertical;background:rgba(255,255,255,.76);color:#52604b;font:11px/1.5 system-ui,-apple-system,sans-serif;outline:none}.fav-prompt textarea:focus{border-color:#8fae78;box-shadow:0 0 0 2px rgba(128,164,100,.13)}.fav-prompt-help{margin:6px 0;color:#7e9074;font-size:10px;line-height:1.45}.fav-prompt-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:12px}
.fav-avatar-clip-layer{position:absolute!important;inset:0!important;display:block!important;overflow:hidden!important;pointer-events:none!important;z-index:0!important}.fav-avatar-clip-layer>img{width:100%!important;height:100%!important;display:block!important;object-fit:cover!important;border-radius:0!important}
@media(max-width:520px){.fav-panel{right:27px;top:7vh;width:calc(100vw - 37px);height:82vh;grid-template-columns:78px minmax(0,1fr);gap:8px}.fav-tabs{padding-right:7px}.fav-tab{font-size:10px;padding:5px}.fav-crop{width:165px}.fav-card{grid-template-columns:43px minmax(0,1fr) auto}.fav-thumb{width:43px;height:43px}}
`;

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function uid(prefix = "avatar") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function normalizeAsset(raw) {
  return {
    id: String(raw?.id || uid()),
    name: String(raw?.name || "未命名头像"),
    source: String(raw?.source || ""),
    targetType: raw?.targetType === "user" ? "user" : "character",
    targetId: String(raw?.targetId || ""),
    positionX: clamp(raw?.positionX, 0, 100, 50),
    positionY: clamp(raw?.positionY, 0, 100, 50),
    zoom: clamp(raw?.zoom, 1, 3, 1),
    pairId: String(raw?.pairId || ""),
    pairRole: raw?.pairRole === "user" || raw?.pairRole === "character" ? raw.pairRole : "",
    pairedAssetId: String(raw?.pairedAssetId || ""),
    pairCharacterId: String(raw?.pairCharacterId || ""),
    createdAt: String(raw?.createdAt || new Date().toISOString()),
  };
}

function normalizeState(raw) {
  const state = cloneDefault();
  if (!raw || typeof raw !== "object") return state;
  state.sidebarEnabled = raw.sidebarEnabled !== false;
  state.sidebarTop = Number.isFinite(Number(raw.sidebarTop)) ? Number(raw.sidebarTop) : null;
  state.activeUserAvatarId = String(raw.activeUserAvatarId || "");
  state.activeByCharacter = raw.activeByCharacter && typeof raw.activeByCharacter === "object" ? { ...raw.activeByCharacter } : {};
  state.llmEnabledByCharacter = raw.llmEnabledByCharacter && typeof raw.llmEnabledByCharacter === "object" ? { ...raw.llmEnabledByCharacter } : {};
  state.promptTemplate = typeof raw.promptTemplate === "string" ? raw.promptTemplate : DEFAULT_PROMPT_TEMPLATE;
  state.singlePhotoPromptTemplate = typeof raw.singlePhotoPromptTemplate === "string" ? raw.singlePhotoPromptTemplate : DEFAULT_SINGLE_PHOTO_PROMPT_TEMPLATE;
  state.pairPhotoPromptTemplate = typeof raw.pairPhotoPromptTemplate === "string" ? raw.pairPhotoPromptTemplate : DEFAULT_PAIR_PHOTO_PROMPT_TEMPLATE;
  state.selectivePromptTemplate = typeof raw.selectivePromptTemplate === "string" ? raw.selectivePromptTemplate : DEFAULT_SELECTIVE_PROMPT_TEMPLATE;
  state.noticeUserAvatarChanges = raw.noticeUserAvatarChanges !== false;
  state.noticeCharacterAvatarChanges = raw.noticeCharacterAvatarChanges !== false;
  if (raw.assets && typeof raw.assets === "object") {
    for (const value of Object.values(raw.assets)) {
      const asset = normalizeAsset(value);
      if (asset.source) state.assets[asset.id] = asset;
    }
  }
  return state;
}

function isImageSource(value) {
  return /^data:image\//i.test(value) || /^https?:\/\//i.test(value);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function escapePromptName(value) {
  return String(value || "").replace(/[\[\]\r\n]/g, " ").trim();
}

function assetStyle(asset) {
  const zoom = Math.max(1, Number(asset.zoom) || 1);
  const shiftX = (50 - asset.positionX) * (zoom - 1) / zoom;
  const shiftY = (50 - asset.positionY) * (zoom - 1) / zoom;
  const baseInset = (1 - 1 / zoom) / 2;
  const offsetX = shiftX / 100;
  const offsetY = shiftY / 100;
  const left = Math.max(0, Math.min(1, baseInset - offsetX));
  const right = Math.max(0, Math.min(1, baseInset + offsetX));
  const top = Math.max(0, Math.min(1, baseInset - offsetY));
  const bottom = Math.max(0, Math.min(1, baseInset + offsetY));
  return {
    objectPosition: `${asset.positionX}% ${asset.positionY}%`,
    transform: `scale(${zoom}) translate(${shiftX}%, ${shiftY}%)`,
    transformOrigin: "center",
    clipPath: `inset(${top * 100}% ${right * 100}% ${bottom * 100}% ${left * 100}%)`,
  };
}

function avatarThemeTarget(img) {
  if (img.closest?.(".chat-room-wrapper")) return "chat-room";
  if (img.closest?.(".feed-cover-shell,.feed-profile,.feed-post,.feed-comment")) return "feeds";
  if (img.closest?.(".user-profile-page-root")) return "me";
  const root = document.documentElement;
  const active = String(root.getAttribute("data-fis-active-view") || "");
  if (active === "chatRoom") return "chat-room";
  if (["messages", "contacts", "feeds", "me"].includes(active)) return active;
  const page = img.closest?.(".page-shell");
  if (page?.querySelector?.(".chat-list-tabs,.messages-page-root")) return "messages";
  if (page?.querySelector?.(".contacts-page-root,input[placeholder='Search contacts...']")) return "contacts";
  return "";
}

function avatarThemeRadiusForImage(img) {
  const root = document.documentElement;
  if (root.getAttribute("data-fis-avatar-style") !== "1") return "";
  const target = avatarThemeTarget(img);
  if (!target || root.getAttribute(`data-fis-avatar-target-${target}`) !== "1") return "";
  return root.style.getPropertyValue("--fis-avatar-radius").trim()
    || getComputedStyle(root).getPropertyValue("--fis-avatar-radius").trim()
    || "50%";
}

function avatarContainerClipsImage(img) {
  const container = img?.parentElement;
  if (!container || typeof getComputedStyle !== "function") return false;
  const style = getComputedStyle(container);
  const clips = value => value === "hidden" || value === "clip";
  return clips(style.overflowX) && clips(style.overflowY);
}

function applyAssetToImage(img, asset, options = {}) {
  if (!img || !asset) return;
  const styles = assetStyle(asset);
  const themeRadius = avatarThemeRadiusForImage(img);
  const clipRadius = themeRadius
    ? (avatarContainerClipsImage(img) ? "" : themeRadius)
    : "50%";
  const finalClip = options.clipMode === "none"
    ? "none"
    : clipRadius && styles.clipPath.endsWith(")")
      ? `${styles.clipPath.slice(0, -1)} round ${clipRadius})`
      : styles.clipPath;
  if (img.getAttribute("src") !== asset.source) img.src = asset.source;
  img.style.setProperty("width", "100%", "important");
  img.style.setProperty("height", "100%", "important");
  img.style.setProperty("display", "block", "important");
  img.style.setProperty("object-fit", "cover", "important");
  img.style.setProperty("object-position", styles.objectPosition, "important");
  img.style.setProperty("transform", styles.transform, "important");
  img.style.setProperty("transform-origin", "center", "important");
  img.style.setProperty("clip-path", finalClip, "important");
  // 可裁切容器独占外轮廓；消息列表等需保留在线圆点的容器由 clip-path 单层裁切。
  img.style.setProperty("border-radius", "0", "important");
  if (options.markManaged !== false) img.dataset.floatAvatarManaged = asset.id;
}

export default {
  manifest: {
    id: PLUGIN_ID,
    name: "聊天头像切换",
    apiVersion: 1,
    version: "1.1.11",
    author: "NEEN&GPT",
    description: "为 user 与 char 管理聊天头像、调整取景，并支持角色自行换头像及感知用户触发的头像变化",
    permissions: ["chat.read", "ai", "network", "ui", "storage"],
  },

  setup(ctx) {
    let state = normalizeState(ctx.system.storage.get(STORAGE_KEY));
    let currentSessionId = "";
    let selectedTarget = "user";
    let sidebarOpen = false;
    let scanQueued = false;
    let scanFrame = 0;
    let editorOpen = false;
    const pendingCharacterBySession = new Map();
    const pendingPhotoBySession = new Map();
    const pendingPhotoPairsBySession = new Map();
    const pendingAvatarNoticesByCharacter = new Map();
    const avatarNoticeInFlightBySession = new Map();
    const visionSourceCache = new Map();
    const visionAvatarCache = new Map();
    const originalImages = new Map();
    const clipLayers = new Map();
    const clipContainerPositions = new Map();
    const hiddenFallbacks = new Map();
    const profileEmptySince = new WeakMap();
    const settingsRefreshers = new Set();

    ctx.ui.injectCSS(CSS);
    document.documentElement?.setAttribute("data-float-avatar-switcher", "1");
    const persist = () => ctx.system.storage.set(STORAGE_KEY, state);

    function characters() {
      try {
        const list = ctx.data.characters.list();
        return Array.isArray(list) ? list : [];
      } catch (error) {
        ctx.system.log("[聊天头像切换] 读取角色失败", error);
        return [];
      }
    }

    function sessions() {
      try {
        const list = ctx.data.sessions.list();
        return Array.isArray(list) ? list : [];
      } catch (_) {
        return [];
      }
    }

    function getSession(sessionId) {
      try { return ctx.data.sessions.get(sessionId); } catch (_) { return null; }
    }

    function resolveSessionCharacterId(sessionId) {
      const session = getSession(sessionId);
      if (!session || session.isGroup) return "";
      const contactId = String(session.contactId || "");
      try {
        const contact = (ctx.data.contacts.list() || []).find(item => String(item?.id || "") === contactId);
        return String(contact?.characterId || contactId || "");
      } catch (_) {
        return contactId;
      }
    }

    function resolveMessageCharacterId(message, sessionId) {
      return String(message?.senderCharacterId || message?.characterId || resolveSessionCharacterId(sessionId) || "");
    }

    function assetsForTarget(target) {
      return Object.values(state.assets)
        .filter(asset => target === "user"
          ? asset.targetType === "user"
          : asset.targetType === "character" && asset.targetId === target)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    function activeAssetForTarget(target) {
      const id = target === "user" ? state.activeUserAvatarId : state.activeByCharacter[target];
      const asset = state.assets[id];
      return asset && (target === "user" ? asset.targetType === "user" : asset.targetId === target) ? asset : null;
    }

    function notifyAvatarChange(target) {
      const asset = activeAssetForTarget(target);
      window.dispatchEvent(new CustomEvent(AVATAR_CHANGE_EVENT, {
        detail: {
          active: true,
          target: String(target || ""),
          source: String(asset?.source || ""),
        },
      }));
    }

    function onAvatarRequest(event) {
      const target = event instanceof CustomEvent ? String(event.detail?.target || "") : "";
      if (target) {
        notifyAvatarChange(target);
        return;
      }
      notifyAvatarChange("user");
      const characterId = resolveSessionCharacterId(currentSessionId);
      if (characterId) notifyAvatarChange(characterId);
    }

    window.addEventListener(AVATAR_REQUEST_EVENT, onAvatarRequest);

    function setActive(target, assetId) {
      const previousId = target === "user" ? state.activeUserAvatarId : state.activeByCharacter[target];
      if (target === "user") state.activeUserAvatarId = assetId;
      else state.activeByCharacter[target] = assetId;
      if (previousId !== assetId) queueAvatarNotice(target, assetId);
      persist();
      notifyAvatarChange(target);
      scheduleScan();
      renderPanel();
    }

    function isUserPhotoMessage(message) {
      if (!message || message.role !== "user") return false;
      if (message.mediaType === "image") return true;
      return message.mediaType === "media_file" && message.mediaData?.fileType === "image";
    }

    function photoLabel(message) {
      return String(message?.mediaData?.label || message?.content || "").trim().slice(0, 40);
    }

    function rememberPendingPhoto(message, source) {
      if (!isUserPhotoMessage(message) || !isImageSource(source)) return;
      const sessionId = String(message.sessionId || "");
      if (!sessionId) return;
      const photo = {
        messageId: String(message.id || ""),
        source,
        label: photoLabel(message),
        capturedAt: Date.now(),
      };
      pendingPhotoBySession.set(sessionId, photo);
      const previous = pendingPhotoPairsBySession.get(sessionId) || [];
      const next = previous.filter(item => item.source !== source && Date.now() - Number(item.capturedAt || 0) < 30 * 60 * 1000);
      next.push(photo);
      pendingPhotoPairsBySession.set(sessionId, next.slice(-2));
    }

    function uniquePhotoName(target, wanted) {
      const base = escapePromptName(wanted).slice(0, 32) || "照片头像";
      const used = new Set(assetsForTarget(target).map(asset => asset.name.trim()));
      if (!used.has(base)) return base;
      let index = 2;
      while (used.has(`${base} ${index}`)) index += 1;
      return `${base} ${index}`;
    }

    function fillTemplate(template, values) {
      let text = String(template || "");
      for (const [key, value] of Object.entries(values)) {
        text = text.split(`{{${key}}}`).join(String(value || ""));
      }
      return text.replace(/\n{3,}/g, "\n\n").trim();
    }

    function queueAvatarNotice(target, assetId) {
      const asset = state.assets[assetId];
      if (!asset) return;
      const kind = target === "user" ? "user" : "character";
      if (kind === "user" && !state.noticeUserAvatarChanges) return;
      if (kind === "character" && !state.noticeCharacterAvatarChanges) return;
      const characterId = kind === "character"
        ? String(target || "")
        : String(asset.pairId && asset.pairCharacterId
          ? asset.pairCharacterId
          : pendingCharacterBySession.get(currentSessionId) || resolveSessionCharacterId(currentSessionId) || "");
      if (!characterId) return;
      const previous = pendingAvatarNoticesByCharacter.get(characterId) || [];
      const next = previous.filter(item => item.kind !== kind);
      next.push({
        id: uid("avatar-notice"),
        kind,
        assetId: asset.id,
        name: asset.name,
        source: asset.source,
        pairId: asset.pairId,
        pairedAssetId: asset.pairedAssetId,
        pairCharacterId: asset.pairCharacterId,
      });
      pendingAvatarNoticesByCharacter.set(characterId, next);
    }

    function avatarNoticeDescription(characterId, notices) {
      return notices.map(item => {
        if (item.kind !== "user") return `用户刚亲手将你的聊天头像更换为“${escapePromptName(item.name)}”。`;
        const paired = item.pairId && item.pairCharacterId === characterId
          ? state.assets[item.pairedAssetId]
          : null;
        if (!paired) return `用户刚将自己的聊天头像更换为“${escapePromptName(item.name)}”。`;
        const relation = state.activeByCharacter[characterId] === paired.id
          ? `正与你当前使用的“${escapePromptName(paired.name)}”配套`
          : `与你们此前选定的角色头像“${escapePromptName(paired.name)}”是一对`;
        return `用户刚换上了你们此前选定的情侣头像“${escapePromptName(item.name)}”，${relation}。可以自然接续当时选择情侣头像的话题。`;
      }).join("\n");
    }

    async function sourceForVision(source) {
      if (/^data:image\//i.test(source)) return source;
      if (!/^https?:\/\//i.test(source)) return "";
      if (visionSourceCache.has(source)) return visionSourceCache.get(source);
      let resolved = source;
      try {
        const response = await ctx.system.fetch(source);
        if (response?.ok) {
          const blob = await response.blob();
          if (/^image\//i.test(blob.type || "")) resolved = await readFileAsDataURL(blob);
        }
      } catch (_) {}
      visionSourceCache.set(source, resolved);
      return resolved;
    }

    async function croppedAvatarForVision(notice) {
      const asset = state.assets[notice.assetId];
      if (!asset) return sourceForVision(notice.source);
      const cacheKey = [asset.id, asset.source, asset.positionX, asset.positionY, asset.zoom].join("|");
      if (visionAvatarCache.has(cacheKey)) return visionAvatarCache.get(cacheKey);
      const source = await sourceForVision(asset.source);
      if (!source) return "";
      try {
        const image = await new Promise((resolve, reject) => {
          const node = new Image();
          node.onload = () => resolve(node);
          node.onerror = () => reject(new Error("头像图片解码失败"));
          node.src = source;
        });
        const width = Number(image.naturalWidth || image.width || 0);
        const height = Number(image.naturalHeight || image.height || 0);
        if (!width || !height) return source;
        const zoom = clamp(asset.zoom, 1, 3, 1);
        const cropSize = Math.min(width, height) / zoom;
        const sourceX = (width - cropSize) * clamp(asset.positionX, 0, 100, 50) / 100;
        const sourceY = (height - cropSize) * clamp(asset.positionY, 0, 100, 50) / 100;
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) return source;
        context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, 256, 256);
        const result = canvas.toDataURL("image/png");
        visionAvatarCache.set(cacheKey, result);
        return result;
      } catch (_) {
        return source;
      }
    }

    async function attachAvatarNotices(payload, characterId, notices) {
      const description = avatarNoticeDescription(characterId, notices);
      const instruction = fillTemplate(state.selectivePromptTemplate, {
        头像变化说明: description,
        头像名称: notices.map(item => escapePromptName(item.name)).join("、"),
      });
      if (!instruction || !Array.isArray(payload?.messages)) return false;
      const messages = payload.messages.slice();
      let index = -1;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i]?.role === "user") { index = i; break; }
      }
      const extraParts = [{ type: "text", text: `\n\n${instruction}` }];
      for (const notice of notices) {
        const visionSource = await croppedAvatarForVision(notice);
        if (!isImageSource(visionSource)) continue;
        extraParts.push({
          type: "text",
          text: notice.kind === "user" ? "以下是用户更换后的头像：" : "以下是你被更换后的头像：",
        });
        extraParts.push({ type: "image_url", image_url: { url: visionSource, detail: "low" } });
      }
      if (index >= 0) {
        const message = messages[index];
        const content = Array.isArray(message.content)
          ? message.content.slice()
          : [{ type: "text", text: String(message.content || "") }];
        messages[index] = { ...message, content: content.concat(extraParts) };
      } else {
        messages.push({ role: "user", content: extraParts });
      }
      payload.messages = messages;
      return true;
    }

    async function attachPhotoPairCandidates(payload, photos) {
      if (!Array.isArray(payload?.messages) || photos.length < 2) return false;
      const messages = payload.messages.slice();
      let index = -1;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i]?.role === "user") { index = i; break; }
      }
      const parts = [{
        type: "text",
        text: "\n\n【情侣头像候选】以下两张图片按用户发送顺序编号；候选 1 是先发送的图片，候选 2 是后发送的图片。",
      }];
      for (let i = 0; i < 2; i += 1) {
        const source = await sourceForVision(photos[i].source);
        if (!isImageSource(source)) continue;
        parts.push({ type: "text", text: `情侣头像候选 ${i + 1}：` });
        parts.push({ type: "image_url", image_url: { url: source, detail: "low" } });
      }
      if (index >= 0) {
        const message = messages[index];
        const content = Array.isArray(message.content)
          ? message.content.slice()
          : [{ type: "text", text: String(message.content || "") }];
        messages[index] = { ...message, content: content.concat(parts) };
      } else {
        messages.push({ role: "user", content: parts });
      }
      payload.messages = messages;
      return true;
    }

    function clearDeliveredAvatarNotices(sessionId) {
      const delivery = avatarNoticeInFlightBySession.get(sessionId);
      if (!delivery) return;
      avatarNoticeInFlightBySession.delete(sessionId);
      const pending = pendingAvatarNoticesByCharacter.get(delivery.characterId) || [];
      const deliveredIds = new Set(delivery.noticeIds);
      const remaining = pending.filter(item => !deliveredIds.has(item.id));
      if (remaining.length) pendingAvatarNoticesByCharacter.set(delivery.characterId, remaining);
      else pendingAvatarNoticesByCharacter.delete(delivery.characterId);
    }

    function findMessage(messageId) {
      const orderedSessionIds = [currentSessionId, ...sessions().map(item => String(item?.id || ""))].filter(Boolean);
      for (const sessionId of [...new Set(orderedSessionIds)]) {
        try {
          const message = (ctx.data.messages.list(sessionId) || []).find(item => String(item?.id || "") === messageId);
          if (message) return { message, sessionId };
        } catch (_) {}
      }
      return null;
    }

    function chooseAsset(message, sessionId) {
      const savedId = String(message?.[MESSAGE_AVATAR_KEY] || "");
      if (message?.role === "user") {
        if (savedId && state.assets[savedId]) return state.assets[savedId];
        return activeAssetForTarget("user");
      }
      if (message?.role !== "assistant") return null;
      const characterId = resolveMessageCharacterId(message, sessionId);
      const active = characterId ? activeAssetForTarget(characterId) : null;
      if (active) return active;
      return savedId && state.assets[savedId] ? state.assets[savedId] : null;
    }

    function rememberOriginal(img) {
      if (originalImages.has(img)) return;
      originalImages.set(img, {
        src: img.getAttribute("src"),
        style: img.getAttribute("style"),
        created: img.dataset.floatAvatarCreated === "1",
      });
    }

    function originalSource(img) {
      const remembered = originalImages.get(img);
      return String(remembered?.src ?? img?.getAttribute?.("src") ?? "");
    }

    function restoreOriginalImageNode(img) {
      const original = originalImages.get(img);
      if (!original) return;
      if (original.src == null) img.removeAttribute("src"); else img.setAttribute("src", original.src);
      if (original.style == null) img.removeAttribute("style"); else img.setAttribute("style", original.style);
      delete img.dataset.floatAvatarManaged;
    }

    function restoreClipContainerPosition(container) {
      if (!container || !clipContainerPositions.has(container)) return;
      const original = clipContainerPositions.get(container);
      if (original.value) container.style.setProperty("position", original.value, original.priority);
      else container.style.removeProperty("position");
      clipContainerPositions.delete(container);
    }

    function removeClipLayer(img) {
      const record = clipLayers.get(img);
      if (!record) return;
      record.layer.remove();
      clipLayers.delete(img);
      const containerStillUsed = [...clipLayers.values()].some(item => item.container === record.container);
      if (!containerStillUsed) restoreClipContainerPosition(record.container);
    }

    function applyManagedAssetToImage(img, asset) {
      if (!img || img.dataset.floatAvatarRenderCopy === "1") return;
      const container = img.parentElement;
      const isUserProfileAvatar = Boolean(img.closest?.(".user-profile-page-root"));
      if (!container || isUserProfileAvatar || avatarContainerClipsImage(img)) {
        const hadLayer = clipLayers.has(img);
        removeClipLayer(img);
        if (hadLayer || img.dataset.floatAvatarManaged !== asset.id) restoreOriginalImageNode(img);
        applyAssetToImage(img, asset);
        return;
      }

      let record = clipLayers.get(img);
      const reusableLayer = record && record.container === container && record.layer.isConnected;
      if (!reusableLayer) restoreOriginalImageNode(img);
      if (!record || record.container !== container || !record.layer.isConnected) {
        removeClipLayer(img);
        if (getComputedStyle(container).position === "static" && !clipContainerPositions.has(container)) {
          clipContainerPositions.set(container, {
            value: container.style.getPropertyValue("position"),
            priority: container.style.getPropertyPriority("position"),
          });
          container.style.setProperty("position", "relative");
        }
        const layer = document.createElement("span");
        layer.className = "fav-avatar-clip-layer";
        layer.setAttribute("aria-hidden", "true");
        const copy = document.createElement("img");
        copy.alt = "";
        copy.dataset.floatAvatarRenderCopy = "1";
        layer.appendChild(copy);
        container.appendChild(layer);
        record = { container, layer, copy };
        clipLayers.set(img, record);
      }

      const radius = avatarThemeRadiusForImage(img) || "50%";
      record.layer.style.setProperty("border-radius", radius, "important");
      applyAssetToImage(record.copy, asset, { clipMode: "none", markManaged: false });
      img.style.setProperty("visibility", "hidden", "important");
      img.dataset.floatAvatarManaged = asset.id;
    }

    function existingUserProfileAvatar(container) {
      if (!container) return null;
      const images = Array.from(container.querySelectorAll("img:not([data-float-avatar-render-copy='1'])"));
      const nativeImage = images.find(img => img.dataset.floatAvatarCreated !== "1") || null;
      if (nativeImage) {
        profileEmptySince.delete(container);
        for (const img of images) {
          if (img.dataset.floatAvatarCreated !== "1") continue;
          removeClipLayer(img);
          originalImages.delete(img);
          img.remove();
        }
        return nativeImage;
      }
      const createdImage = images.find(img => img.dataset.floatAvatarCreated === "1") || null;
      if (createdImage) return createdImage;
      const firstSeen = profileEmptySince.get(container);
      if (!firstSeen) {
        profileEmptySince.set(container, Date.now());
        ctx.system.timers.setTimeout(scheduleScan, 160);
        return null;
      }
      if (Date.now() - firstSeen < 140) return null;
      profileEmptySince.delete(container);
      return ensureAvatarImage(container);
    }

    function inferTargetFromContext(img, chars, userName) {
      const host = img.closest?.(".feed-post,.feed-comment,.minimal-list-item,.chat-contact-item,.freq-list-item,.freq-dialog,.add-friend-item");
      if (!host) return "";
      const author = host.querySelector?.(".feed-post-author-name,.feed-comment-author,.chat-contact-name,.menu-label,[class*='font-medium']");
      const text = String(author?.textContent || host.textContent || "").trim();
      if (userName && text === userName) return "user";
      const aliasMatches = sessions()
        .filter(session => !session?.isGroup && session?.alias && text.includes(String(session.alias)))
        .sort((a, b) => String(b.alias).length - String(a.alias).length);
      if (aliasMatches[0]) return resolveSessionCharacterId(String(aliasMatches[0].id || ""));
      const matches = chars
        .filter(char => char?.name && text.includes(String(char.name)))
        .sort((a, b) => String(b.name).length - String(a.name).length);
      return String(matches[0]?.id || "");
    }

    function scanPageAvatars() {
      const chars = characters();
      const userName = String(document.querySelector(".chat-app .feed-profile-name,.chat-app .user-profile-page-root .page-title")?.textContent || "").trim();
      const sourceTargets = new Map();
      for (const char of chars) {
        if (char?.avatar) sourceTargets.set(String(char.avatar), String(char.id));
      }

      const explicitUserSelector = [
        ".chat-msg-wrapper[data-role='user']>.chat-msg-avatar img",
        ".chat-offline-entry[data-role='user']>.chat-offline-avatar img",
        "img[alt='Me']",
        "img[alt='Avatar']",
        "img[alt='User Avatar']",
        ".feed-profile-avatar-image",
        ".user-profile-page-root [class~='w-[84px]'][class~='h-[84px]'] img",
      ].join(",");
      const userSources = new Set();
      for (const img of document.querySelectorAll(explicitUserSelector)) {
        if (img.dataset.floatAvatarRenderCopy === "1") continue;
        const source = originalSource(img);
        if (source && !source.includes("/images/default-moment-avatar.png")) userSources.add(source);
      }

      const userAsset = activeAssetForTarget("user");
      if (userAsset) {
        const userContainers = document.querySelectorAll([
          ".chat-app .feed-profile-avatar",
          ".chat-app .user-profile-page-root [class~='w-[84px]'][class~='h-[84px]']",
          ".chat-app .page-shell:has(.chat-list-tabs,.messages-page-root)>.page-header [class~='w-[36px]'][class~='h-[36px]']",
        ].join(","));
        for (const container of userContainers) {
          const img = container.closest?.(".user-profile-page-root")
            ? existingUserProfileAvatar(container)
            : ensureAvatarImage(container);
          if (!img) continue;
          rememberOriginal(img);
          applyManagedAssetToImage(img, userAsset);
        }
      }

      const avatarSelector = [
        ".chat-app .minimal-avatar-wrapper img",
        ".chat-app .chat-contact-avatar img",
        ".chat-app .freq-avatar img",
        ".chat-app .freq-detail-avatar img",
        ".chat-app .add-friend-avatar img",
        ".chat-app .feed-profile-avatar img",
        ".chat-app .feed-post-author-avatar img",
        ".chat-app .feed-comment-avatar img",
        ".chat-app .user-profile-page-root [class~='w-[84px]'][class~='h-[84px]'] img",
        ".chat-app .chat-msg-avatar img",
        ".chat-app .chat-offline-avatar img",
        ".chat-app img[alt='Avatar']",
        ".chat-app img[alt='Me']",
        ".chat-app img[alt='User Avatar']",
      ].join(",");

      for (const img of document.querySelectorAll(avatarSelector)) {
        if (img.dataset.floatAvatarRenderCopy === "1") continue;
        const source = originalSource(img);
        let target = userSources.has(source) ? "user" : sourceTargets.get(source) || "";
        if (!target) {
          if (img.matches(".feed-profile-avatar-image,img[alt='Avatar'],img[alt='Me'],img[alt='User Avatar']") || img.closest(".feed-profile-avatar,.user-profile-page-root [class~='w-[84px]'][class~='h-[84px]']")) {
            target = "user";
          } else {
            target = inferTargetFromContext(img, chars, userName);
          }
        }
        const asset = target ? activeAssetForTarget(target) : null;
        if (!asset) continue;
        rememberOriginal(img);
        applyManagedAssetToImage(img, asset);
      }

      const emptyContainers = document.querySelectorAll([
        ".chat-app .freq-avatar",
        ".chat-app .freq-detail-avatar",
        ".chat-app .chat-contact-avatar",
        ".chat-app .feed-post-author-avatar",
        ".chat-app .feed-comment-avatar",
      ].join(","));
      for (const container of emptyContainers) {
        if (container.querySelector("img")) continue;
        const target = inferTargetFromContext(container, chars, userName);
        const asset = target ? activeAssetForTarget(target) : null;
        if (!asset) continue;
        const img = ensureAvatarImage(container);
        if (!img) continue;
        rememberOriginal(img);
        applyManagedAssetToImage(img, asset);
      }
    }

    function restoreManagedImages() {
      for (const { layer } of clipLayers.values()) layer.remove();
      clipLayers.clear();
      for (const container of [...clipContainerPositions.keys()]) restoreClipContainerPosition(container);
      for (const [img, original] of originalImages.entries()) {
        if (!img.isConnected) continue;
        if (original.created) {
          img.remove();
          continue;
        }
        if (original.src == null) img.removeAttribute("src"); else img.setAttribute("src", original.src);
        if (original.style == null) img.removeAttribute("style"); else img.setAttribute("style", original.style);
        delete img.dataset.floatAvatarManaged;
      }
      originalImages.clear();
      for (const [element, style] of hiddenFallbacks.entries()) {
        if (!element.isConnected) continue;
        if (style == null) element.removeAttribute("style"); else element.setAttribute("style", style);
      }
      hiddenFallbacks.clear();
    }

    function ensureAvatarImage(container) {
      let img = container?.querySelector("img:not([data-float-avatar-render-copy='1'])");
      if (img) return img;
      if (!container) return null;
      img = document.createElement("img");
      img.alt = "";
      img.dataset.floatAvatarCreated = "1";
      for (const child of Array.from(container.children || [])) {
        if (!child.matches?.("svg,.feed-profile-avatar-fallback,.freq-avatar-fallback,.chat-contact-avatar-fallback")) continue;
        if (!hiddenFallbacks.has(child)) hiddenFallbacks.set(child, child.getAttribute("style"));
        child.style.setProperty("display", "none", "important");
      }
      container.appendChild(img);
      return img;
    }

    function scanAvatars() {
      scanQueued = false;
      if (typeof document === "undefined") return;
      for (const img of originalImages.keys()) {
        if (!img.isConnected) {
          removeClipLayer(img);
          originalImages.delete(img);
        }
      }
      for (const element of hiddenFallbacks.keys()) {
        if (!element.isConnected) hiddenFallbacks.delete(element);
      }
      scanPageAvatars();
      const wrappers = document.querySelectorAll('.chat-msg-wrapper[id^="message-"]');
      for (const wrapper of wrappers) {
        const messageId = String(wrapper.id || "").replace(/^message-/, "");
        if (!messageId) continue;
        const found = findMessage(messageId);
        if (!found) continue;
        const asset = chooseAsset(found.message, found.sessionId);
        if (!asset) continue;
        const directChildren = Array.from(wrapper.children || []);
        const avatarBox = directChildren.find(el => el.classList?.contains("chat-msg-avatar"));
        const circle = avatarBox?.matches?.(".w\\[40px\\]") ? avatarBox : avatarBox?.querySelector("div") || avatarBox;
        const img = ensureAvatarImage(circle);
        if (!img) continue;
        rememberOriginal(img);
        applyManagedAssetToImage(img, asset);
      }

      for (const wrapper of document.querySelectorAll('.chat-offline-message,.chat-offline-entry,[data-offline-message-id]')) {
        const messageId = String(wrapper.dataset?.msgId || wrapper.dataset?.messageId || wrapper.id || "").replace(/^message-/, "");
        const found = messageId ? findMessage(messageId) : null;
        const role = wrapper.dataset?.role;
        let asset = found ? chooseAsset(found.message, found.sessionId) : null;
        if (!asset && role === "user") asset = activeAssetForTarget("user");
        if (!asset && role && role !== "user") asset = activeAssetForTarget(resolveSessionCharacterId(currentSessionId));
        const img = wrapper.querySelector(".chat-offline-avatar img:not([data-float-avatar-render-copy='1'])");
        if (asset && img) { rememberOriginal(img); applyManagedAssetToImage(img, asset); }
      }
    }

    function scheduleScan() {
      if (scanQueued) return;
      scanQueued = true;
      scanFrame = requestAnimationFrame(() => {
        scanFrame = 0;
        scanAvatars();
      });
    }

    ctx.hooks.on("session.opened", payload => {
      currentSessionId = String(payload?.sessionId || "");
      const charId = resolveSessionCharacterId(currentSessionId);
      if (charId) selectedTarget = charId;
      renderPanel();
      scheduleScan();
      notifyAvatarChange("user");
      if (charId) notifyAvatarChange(charId);
    });

    ctx.hooks.on("message.persisted", payload => {
      scheduleScan();
      const message = payload?.message;
      if (message?.role === "assistant") {
        clearDeliveredAvatarNotices(String(message.sessionId || ""));
      }
      if (!isUserPhotoMessage(message)) return;
      const directSource = String(message?.mediaUrl || "");
      if (isImageSource(directSource)) {
        rememberPendingPhoto(message, directSource);
        return;
      }
      Promise.resolve(ctx.data.messages.resolveMedia(message)).then(media => {
        if (media?.category === "image" && isImageSource(media.dataURL)) {
          rememberPendingPhoto(message, media.dataURL);
        }
      }).catch(error => ctx.system.log("[聊天头像切换] 读取照片墙图片失败", error));
    });
    ctx.hooks.on("message.updated", scheduleScan);

    ctx.hooks.transform("prompt.system", payload => {
      const characterId = String(payload?.characterId || resolveSessionCharacterId(payload?.sessionId) || "");
      if (!characterId || !state.llmEnabledByCharacter[characterId]) return payload;
      const available = assetsForTarget(characterId);
      const sessionId = String(payload.sessionId || "");
      const pendingPhoto = pendingPhotoBySession.get(sessionId);
      const pendingPair = pendingPhotoPairsBySession.get(sessionId) || [];
      if (!available.length && !pendingPhoto?.source && pendingPair.length < 2) return payload;
      pendingCharacterBySession.set(sessionId, characterId);
      const active = activeAssetForTarget(characterId);
      const names = available.map(asset => escapePromptName(asset.name)).filter(Boolean);
      const labelHint = pendingPhoto?.label ? `，用户描述为“${escapePromptName(pendingPhoto.label)}”` : "";
      const photoRule = pendingPair.length >= 2
        ? fillTemplate(state.pairPhotoPromptTemplate, {})
        : pendingPhoto?.source
          ? fillTemplate(state.singlePhotoPromptTemplate, { 照片描述: labelHint })
          : "";
      const instruction = fillTemplate(state.promptTemplate, {
        可用头像: names.join("、") || "暂无",
        当前头像: active ? escapePromptName(active.name) : "未指定",
        照片头像规则: photoRule,
      });
      if (!instruction) return payload;
      payload.hint = [payload.hint, instruction].filter(Boolean).join("\n\n");
      return payload;
    }, { priority: 120 });

    ctx.hooks.transform("llm.request", async payload => {
      if (payload?.purpose && payload.purpose !== "chat") return payload;
      const sessionId = String(payload?.sessionId || "");
      const characterId = String(pendingCharacterBySession.get(sessionId) || resolveSessionCharacterId(sessionId) || "");
      if (!sessionId || !characterId) return payload;
      const photoPair = pendingPhotoPairsBySession.get(sessionId) || [];
      if (state.llmEnabledByCharacter[characterId] && photoPair.length >= 2) {
        await attachPhotoPairCandidates(payload, photoPair);
      }
      const pending = pendingAvatarNoticesByCharacter.get(characterId) || [];
      const notices = pending.filter(item => item.kind === "user"
        ? state.noticeUserAvatarChanges
        : state.noticeCharacterAvatarChanges);
      if (notices.length && await attachAvatarNotices(payload, characterId, notices)) {
        avatarNoticeInFlightBySession.set(sessionId, {
          characterId,
          noticeIds: notices.map(item => item.id),
        });
      }
      return payload;
    }, { priority: 115 });

    ctx.hooks.transform("llm.response", payload => {
      const sessionId = String(payload?.sessionId || "");
      const characterId = pendingCharacterBySession.get(sessionId) || resolveSessionCharacterId(sessionId);
      if (!characterId) return payload;
      const available = assetsForTarget(characterId);
      const pendingPhoto = pendingPhotoBySession.get(sessionId);
      const pendingPair = pendingPhotoPairsBySession.get(sessionId) || [];
      if (!available.length && !pendingPhoto?.source && pendingPair.length < 2) return payload;
      let chosen = null;
      let importedPhoto = null;
      let importedPair = null;
      payload.text = String(payload.text || "").replace(/\[\[\s*情侣头像\s*[:：]\s*角色\s*=\s*([12])\s*\|\s*([^;；\]\r\n]+)\s*[;；]\s*用户\s*=\s*([12])\s*\|\s*([^\]\r\n]+?)\s*\]\]/gi, (whole, rawCharacterIndex, rawCharacterName, rawUserIndex, rawUserName) => {
        const characterIndex = Number(rawCharacterIndex) - 1;
        const userIndex = Number(rawUserIndex) - 1;
        if (!importedPair && pendingPair.length >= 2 && characterIndex !== userIndex) {
          const pairId = uid("avatar-pair");
          const characterAssetId = uid("photo-avatar");
          const userAssetId = uid("photo-avatar");
          const characterAsset = normalizeAsset({
            id: characterAssetId,
            name: uniquePhotoName(characterId, rawCharacterName),
            source: pendingPair[characterIndex].source,
            targetType: "character",
            targetId: characterId,
            positionX: 50,
            positionY: 50,
            zoom: 1,
            pairId,
            pairRole: "character",
            pairedAssetId: userAssetId,
            pairCharacterId: characterId,
            createdAt: new Date().toISOString(),
          });
          const userAsset = normalizeAsset({
            id: userAssetId,
            name: uniquePhotoName("user", rawUserName),
            source: pendingPair[userIndex].source,
            targetType: "user",
            targetId: "",
            positionX: 50,
            positionY: 50,
            zoom: 1,
            pairId,
            pairRole: "user",
            pairedAssetId: characterAssetId,
            pairCharacterId: characterId,
            createdAt: new Date().toISOString(),
          });
          state.assets[characterAsset.id] = characterAsset;
          state.assets[userAsset.id] = userAsset;
          chosen = characterAsset;
          importedPhoto = characterAsset;
          importedPair = { characterAsset, userAsset };
        }
        return "";
      });
      payload.text = String(payload.text || "").replace(/\[\[\s*照片头像\s*[:：]\s*([^\]\r\n]+?)\s*\]\]/gi, (whole, rawName) => {
        if (!importedPhoto && pendingPhoto?.source) {
          const name = uniquePhotoName(characterId, rawName);
          importedPhoto = normalizeAsset({
            id: uid("photo-avatar"),
            name,
            source: pendingPhoto.source,
            targetType: "character",
            targetId: characterId,
            positionX: 50,
            positionY: 50,
            zoom: 1,
            createdAt: new Date().toISOString(),
          });
          state.assets[importedPhoto.id] = importedPhoto;
          chosen = importedPhoto;
        }
        return "";
      });
      payload.text = String(payload.text || "").replace(/\[\[\s*头像\s*[:：]\s*([^\]\r\n]+?)\s*\]\]/gi, (whole, rawName) => {
        const wanted = String(rawName || "").trim();
        const asset = available.find(item => item.name.trim() === wanted);
        if (!chosen && asset) chosen = asset;
        return "";
      }).replace(/^\s+/, "");
      pendingPhotoBySession.delete(sessionId);
      if (pendingPair.length >= 2) pendingPhotoPairsBySession.delete(sessionId);
      if (chosen) {
        state.activeByCharacter[characterId] = chosen.id;
        persist();
        renderPanel();
        scheduleScan();
        if (importedPair) {
          ctx.ui.toast(`角色已换上「${importedPair.characterAsset.name}」，另一张已保存到我的头像`);
        } else if (importedPhoto) {
          ctx.ui.toast(`已收藏并换上头像「${importedPhoto.name}」`);
        }
      }
      return payload;
    }, { priority: 80 });

    ctx.hooks.transform("message.beforePersist", payload => {
      const message = payload?.message;
      if (!message || (message.role !== "user" && message.role !== "assistant")) return payload;
      if (message.role === "user") {
        rememberPendingPhoto(message, String(message.mediaUrl || ""));
        if (state.assets[state.activeUserAvatarId]) message[MESSAGE_AVATAR_KEY] = state.activeUserAvatarId;
        return payload;
      }
      const sessionId = String(message.sessionId || "");
      const characterId = resolveMessageCharacterId(message, sessionId);
      const assetId = state.activeByCharacter[characterId];
      if (state.assets[assetId]) message[MESSAGE_AVATAR_KEY] = assetId;
      return payload;
    }, { priority: 120 });

    const observer = typeof MutationObserver === "function" && typeof document !== "undefined"
      ? new MutationObserver(scheduleScan)
      : null;
    if (observer && document.body) observer.observe(document.body, { childList: true, subtree: true });
    const themeObserver = typeof MutationObserver === "function" && typeof document !== "undefined"
      ? new MutationObserver(scheduleScan)
      : null;
    if (themeObserver) {
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: [
          "style",
          "data-fis-avatar-style",
          "data-fis-avatar-target-messages",
          "data-fis-avatar-target-contacts",
          "data-fis-avatar-target-feeds",
          "data-fis-avatar-target-me",
          "data-fis-avatar-target-chat-room",
          "data-fis-active-view",
        ],
      });
    }

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "fav-handle";
    handle.title = "聊天头像";
    handle.setAttribute("aria-label", "打开聊天头像侧边栏");
    handle.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 20c.8-4.2 3.3-6.3 7.5-6.3s6.7 2.1 7.5 6.3"/></svg>';

    const panel = document.createElement("aside");
    panel.className = "fav-panel";
    panel.hidden = true;
    const tabs = document.createElement("div");
    tabs.className = "fav-tabs";
    const content = document.createElement("div");
    content.className = "fav-content";
    const footerLeft = document.createElement("div");
    footerLeft.className = "fav-footer-left";
    const footer = document.createElement("div");
    footer.className = "fav-footer";
    panel.append(tabs, content, footerLeft, footer);
    document.body.append(handle, panel);

    function iconButton(label, svg, className, click) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `fav-icon${className ? ` ${className}` : ""}`;
      button.title = label;
      button.setAttribute("aria-label", label);
      button.innerHTML = svg;
      button.addEventListener("click", click);
      return button;
    }

    const addSvg = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
    const closeSvg = '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    const editSvg = '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
    const trashSvg = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>';
    const promptSvg = '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>';

    function targetLabel(target) {
      if (target === "user") return "我的头像";
      return characters().find(char => String(char?.id || "") === target)?.name || "未知角色";
    }

    function positionPanel() {
      if (panel.hidden) return;
      const handleRect = handle.getBoundingClientRect();
      const panelHeight = panel.getBoundingClientRect().height || Math.min(window.innerHeight * .76, 720);
      const maxTop = Math.max(8, window.innerHeight - panelHeight - 8);
      const centeredTop = handleRect.top + handleRect.height / 2 - panelHeight / 2;
      panel.style.top = `${clamp(centeredTop, 8, maxTop, 8)}px`;
    }

    function syncVisibility() {
      handle.hidden = !state.sidebarEnabled;
      panel.hidden = !state.sidebarEnabled || !sidebarOpen;
      if (state.sidebarTop != null) {
        handle.style.top = `${clamp(state.sidebarTop, 8, Math.max(8, window.innerHeight - 70), window.innerHeight * .42)}px`;
      }
      positionPanel();
    }

    function renderThumb(img, asset) {
      img.src = asset.source;
      Object.assign(img.style, assetStyle(asset));
    }

    function renderPanel() {
      if (!panel.isConnected) return;
      const chars = characters();
      const validTargets = new Set(["user", ...chars.map(char => String(char.id))]);
      if (!validTargets.has(selectedTarget)) selectedTarget = "user";
      tabs.textContent = "";
      const targets = [{ id: "user", name: "我的头像" }, ...chars.map(char => ({ id: String(char.id), name: char.name || "未命名" }))];
      for (const target of targets) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `fav-tab${selectedTarget === target.id ? " active" : ""}`;
        button.textContent = target.name;
        button.title = target.name;
        button.addEventListener("click", () => { selectedTarget = target.id; renderPanel(); });
        tabs.appendChild(button);
      }

      content.textContent = "";
      const head = document.createElement("div");
      head.className = "fav-head";
      const heading = document.createElement("div");
      heading.innerHTML = `<div class="fav-title"></div><div class="fav-muted"></div>`;
      heading.querySelector(".fav-title").textContent = targetLabel(selectedTarget);
      heading.querySelector(".fav-muted").textContent = selectedTarget === "user" ? "聊天中我的头像" : "按名称切换角色头像";
      head.appendChild(heading);
      content.appendChild(head);

      if (selectedTarget !== "user") {
        const switchRow = document.createElement("label");
        switchRow.className = "fav-switch";
        const switchText = document.createElement("span");
        switchText.textContent = "允许角色自行切换";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = !!state.llmEnabledByCharacter[selectedTarget];
        checkbox.addEventListener("change", () => {
          state.llmEnabledByCharacter[selectedTarget] = checkbox.checked;
          persist();
          renderPanel();
        });
        switchRow.append(switchText, checkbox);
        content.appendChild(switchRow);
      }

      const list = document.createElement("div");
      list.className = "fav-list";
      const assets = assetsForTarget(selectedTarget);
      const active = activeAssetForTarget(selectedTarget);
      if (!assets.length) {
        const empty = document.createElement("div");
        empty.className = "fav-empty";
        empty.textContent = "还没有头像，点下方＋导入一张吧。";
        list.appendChild(empty);
      }
      for (const asset of assets) {
        const card = document.createElement("div");
        card.className = `fav-card${active?.id === asset.id ? " active" : ""}`;
        const thumb = document.createElement("div");
        thumb.className = "fav-thumb";
        const img = document.createElement("img");
        img.alt = "";
        renderThumb(img, asset);
        thumb.appendChild(img);
        const info = document.createElement("button");
        info.type = "button";
        info.style.cssText = "min-width:0;text-align:left;border:0;background:none;padding:0;color:inherit;cursor:pointer";
        const name = document.createElement("div");
        name.className = "fav-card-name";
        name.textContent = asset.name;
        const meta = document.createElement("div");
        meta.className = "fav-card-meta";
        meta.textContent = active?.id === asset.id
          ? (asset.pairId ? "当前使用 · 情侣头像" : "当前使用")
          : (asset.pairId ? "情侣头像 · 点击使用" : "点击设为当前");
        info.append(name, meta);
        info.addEventListener("click", () => setActive(selectedTarget, asset.id));
        const edit = iconButton("编辑", editSvg, "", () => openEditor(asset));
        card.append(thumb, info, edit);
        list.appendChild(card);
      }
      content.appendChild(list);

      footerLeft.textContent = "";
      footer.textContent = "";
      footerLeft.append(iconButton("编辑注入提示词", promptSvg, "", openPromptEditor));
      footer.append(
        iconButton("新增头像", addSvg, "primary", () => openEditor(null)),
        iconButton("关闭", closeSvg, "", () => { sidebarOpen = false; syncVisibility(); }),
      );
    }

    function openPromptEditor() {
      if (editorOpen) return;
      editorOpen = true;
      ctx.ui.openModal((host, api) => {
        host.style.cssText = "width:min(430px,calc(100vw - 28px));max-height:88vh;overflow:auto;padding:16px;border:1px solid rgba(151,184,126,.5);border-radius:18px;background:rgba(236,246,229,.97);color:#52604b;box-shadow:0 20px 60px rgba(58,82,45,.27);font:13px/1.45 system-ui,-apple-system,sans-serif";
        const title = document.createElement("div");
        title.className = "fav-title";
        title.style.marginBottom = "10px";
        title.textContent = "提示词设置（所有角色共用）";

        const persistentBox = document.createElement("details");
        persistentBox.className = "fav-prompt";
        const persistentTitle = document.createElement("summary");
        persistentTitle.className = "fav-title";
        persistentTitle.textContent = "常驻注入";
        const persistentInput = document.createElement("textarea");
        persistentInput.value = state.promptTemplate;
        persistentInput.spellcheck = false;
        const persistentHelp = document.createElement("div");
        persistentHelp.className = "fav-prompt-help";
        persistentHelp.textContent = "用于角色自行切换头像；仅向已开启该权限的角色注入。动态变量：{{可用头像}}、{{当前头像}}、{{照片头像规则}}";
        persistentBox.append(persistentTitle, persistentInput, persistentHelp);

        const singlePhotoBox = document.createElement("details");
        singlePhotoBox.className = "fav-prompt";
        const singlePhotoTitle = document.createElement("summary");
        singlePhotoTitle.className = "fav-title";
        singlePhotoTitle.textContent = "单张照片";
        const singlePhotoInput = document.createElement("textarea");
        singlePhotoInput.style.minHeight = "105px";
        singlePhotoInput.value = state.singlePhotoPromptTemplate;
        singlePhotoInput.spellcheck = false;
        const singleHelp = document.createElement("div");
        singleHelp.className = "fav-prompt-help";
        singleHelp.textContent = "发送一张图片时按条件注入。动态变量：{{照片描述}}";
        singlePhotoBox.append(singlePhotoTitle, singlePhotoInput, singleHelp);

        const pairPhotoBox = document.createElement("details");
        pairPhotoBox.className = "fav-prompt";
        const pairPhotoTitle = document.createElement("summary");
        pairPhotoTitle.className = "fav-title";
        pairPhotoTitle.textContent = "双图／情侣头像";
        const pairPhotoInput = document.createElement("textarea");
        pairPhotoInput.style.minHeight = "190px";
        pairPhotoInput.value = state.pairPhotoPromptTemplate;
        pairPhotoInput.spellcheck = false;
        const pairHelp = document.createElement("div");
        pairHelp.className = "fav-prompt-help";
        pairHelp.textContent = "发送两张图片时按条件注入；候选编号与图片由插件自动附加。固定指令格式不要随意改动，否则插件无法识别。";
        pairPhotoBox.append(pairPhotoTitle, pairPhotoInput, pairHelp);

        const selectiveBox = document.createElement("details");
        selectiveBox.className = "fav-prompt";
        const selectiveTitle = document.createElement("summary");
        selectiveTitle.className = "fav-title";
        selectiveTitle.textContent = "选择性注入";
        const makeNoticeSwitch = (label, checked) => {
          const row = document.createElement("label");
          row.className = "fav-switch";
          const textNode = document.createElement("span");
          textNode.textContent = label;
          const input = document.createElement("input");
          input.type = "checkbox";
          input.checked = checked;
          row.append(textNode, input);
          return { row, input };
        };
        const userNotice = makeNoticeSwitch("用户更换自己的头像后注入一次", state.noticeUserAvatarChanges);
        const characterNotice = makeNoticeSwitch("用户替角色更换头像后注入一次", state.noticeCharacterAvatarChanges);
        const selectiveInput = document.createElement("textarea");
        selectiveInput.style.minHeight = "135px";
        selectiveInput.value = state.selectivePromptTemplate;
        selectiveInput.spellcheck = false;
        const selectiveHelp = document.createElement("div");
        selectiveHelp.className = "fav-prompt-help";
        selectiveHelp.textContent = "仅在所选事件发生后的下一次回复注入，并附上新头像图片；成功回复后自动清除。若要看懂图片内容，请在 API 配置中开启图片识别。动态变量：{{头像变化说明}}、{{头像名称}}";
        selectiveBox.append(selectiveTitle, userNotice.row, characterNotice.row, selectiveInput, selectiveHelp);

        const actions = document.createElement("div");
        actions.className = "fav-prompt-actions";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "fav-btn";
        cancel.textContent = "取消";
        const reset = document.createElement("button");
        reset.type = "button";
        reset.className = "fav-btn";
        reset.textContent = "全部恢复默认";
        reset.addEventListener("click", () => {
          persistentInput.value = DEFAULT_PROMPT_TEMPLATE;
          singlePhotoInput.value = DEFAULT_SINGLE_PHOTO_PROMPT_TEMPLATE;
          pairPhotoInput.value = DEFAULT_PAIR_PHOTO_PROMPT_TEMPLATE;
          selectiveInput.value = DEFAULT_SELECTIVE_PROMPT_TEMPLATE;
          userNotice.input.checked = true;
          characterNotice.input.checked = true;
        });
        const save = document.createElement("button");
        save.type = "button";
        save.className = "fav-btn primary";
        save.textContent = "保存提示词";
        const closePromptEditor = () => { editorOpen = false; api.close(); };
        cancel.addEventListener("click", closePromptEditor);
        save.addEventListener("click", () => {
          state.promptTemplate = persistentInput.value;
          state.singlePhotoPromptTemplate = singlePhotoInput.value;
          state.pairPhotoPromptTemplate = pairPhotoInput.value;
          state.selectivePromptTemplate = selectiveInput.value;
          state.noticeUserAvatarChanges = userNotice.input.checked;
          state.noticeCharacterAvatarChanges = characterNotice.input.checked;
          if (!state.noticeUserAvatarChanges || !state.noticeCharacterAvatarChanges) {
            for (const [characterId, notices] of pendingAvatarNoticesByCharacter) {
              const remaining = notices.filter(item => item.kind === "user"
                ? state.noticeUserAvatarChanges
                : state.noticeCharacterAvatarChanges);
              if (remaining.length) pendingAvatarNoticesByCharacter.set(characterId, remaining);
              else pendingAvatarNoticesByCharacter.delete(characterId);
            }
          }
          persist();
          ctx.ui.toast("提示词已保存");
          closePromptEditor();
        });
        actions.append(cancel, reset, save);
        host.append(title, persistentBox, singlePhotoBox, pairPhotoBox, selectiveBox, actions);
        return () => { editorOpen = false; };
      });
    }

    function openEditor(existing) {
      if (editorOpen) return;
      editorOpen = true;
      const original = existing ? { ...existing } : null;
      const draft = existing ? { ...existing } : normalizeAsset({
        id: uid(),
        name: "",
        targetType: selectedTarget === "user" ? "user" : "character",
        targetId: selectedTarget === "user" ? "" : selectedTarget,
        source: "",
      });
      ctx.ui.openModal((host, api) => {
        host.style.cssText = "width:min(390px,calc(100vw - 28px));max-height:88vh;overflow:auto;padding:16px;border:1px solid rgba(151,184,126,.5);border-radius:18px;background:rgba(236,246,229,.97);color:#52604b;box-shadow:0 20px 60px rgba(58,82,45,.27);font:13px/1.45 system-ui,-apple-system,sans-serif";
        const title = document.createElement("div");
        title.className = "fav-title";
        title.style.marginBottom = "12px";
        title.textContent = existing ? "编辑头像" : "新增头像";

        const nameField = document.createElement("label");
        nameField.className = "fav-field";
        nameField.innerHTML = '<span class="fav-label">图片名称（角色按这个名称选择）</span>';
        const nameInput = document.createElement("input");
        nameInput.className = "fav-input";
        nameInput.placeholder = "例如：浅笑、认真、困倦";
        nameInput.value = draft.name;
        nameInput.addEventListener("input", () => { draft.name = nameInput.value; });
        nameField.appendChild(nameInput);

        const sourceField = document.createElement("div");
        sourceField.className = "fav-field";
        const sourceLabel = document.createElement("span");
        sourceLabel.className = "fav-label";
        sourceLabel.textContent = "头像图片";
        const sourceRow = document.createElement("div");
        sourceRow.className = "fav-source-row";
        const urlInput = document.createElement("input");
        urlInput.className = "fav-input";
        urlInput.placeholder = "粘贴 http(s) 图片链接";
        urlInput.value = /^https?:\/\//i.test(draft.source) ? draft.source : "";
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/png,image/jpeg,image/webp,image/gif";
        fileInput.hidden = true;
        const fileButton = document.createElement("button");
        fileButton.type = "button";
        fileButton.className = "fav-btn";
        fileButton.textContent = "本地上传";
        fileButton.addEventListener("click", () => fileInput.click());
        sourceRow.append(urlInput, fileButton, fileInput);
        sourceField.append(sourceLabel, sourceRow);

        const crop = document.createElement("div");
        crop.className = "fav-crop";
        const preview = document.createElement("img");
        preview.className = "fav-crop-img";
        preview.alt = "头像取景预览";
        crop.appendChild(preview);
        const cropHelp = document.createElement("div");
        cropHelp.className = "fav-crop-help";
        cropHelp.textContent = "拖动图片选择要保留的 1:1 区域";
        const rangeControls = {};

        const updatePreview = () => {
          if (draft.source) {
            preview.hidden = false;
            preview.src = draft.source;
            Object.assign(preview.style, assetStyle(draft));
          } else {
            preview.hidden = true;
          }
        };
        urlInput.addEventListener("change", () => {
          const value = urlInput.value.trim();
          if (value && !/^https?:\/\//i.test(value)) {
            ctx.ui.toast("URL 需要以 http:// 或 https:// 开头");
            return;
          }
          draft.source = value;
          updatePreview();
        });
        fileInput.addEventListener("change", async () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          if (!file.type.startsWith("image/")) return ctx.ui.toast("请选择图片文件");
          if (file.size > 12 * 1024 * 1024) return ctx.ui.toast("单张头像不能超过 12 MB");
          try {
            draft.source = await readFileAsDataURL(file);
            urlInput.value = "";
            updatePreview();
          } catch (error) {
            ctx.system.log("[聊天头像切换] 图片读取失败", error);
            ctx.ui.toast("图片读取失败");
          }
        });

        function range(label, key, min, max, step, suffix) {
          const row = document.createElement("label");
          row.className = "fav-range-row";
          const text = document.createElement("span");
          text.textContent = label;
          const input = document.createElement("input");
          input.type = "range";
          input.min = String(min);
          input.max = String(max);
          input.step = String(step);
          input.value = String(draft[key]);
          const value = document.createElement("span");
          value.className = "fav-range-value";
          const sync = () => {
            draft[key] = clamp(input.value, min, max, draft[key]);
            value.textContent = `${draft[key]}${suffix}`;
            updatePreview();
          };
          input.addEventListener("input", sync);
          sync();
          rangeControls[key] = { input, value };
          row.append(text, input, value);
          return row;
        }

        let cropDrag = null;
        crop.addEventListener("pointerdown", event => {
          cropDrag = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            startX: draft.positionX,
            startY: draft.positionY,
          };
          crop.setPointerCapture?.(event.pointerId);
          event.preventDefault();
        });
        crop.addEventListener("pointermove", event => {
          if (!cropDrag || cropDrag.id !== event.pointerId) return;
          const rect = crop.getBoundingClientRect();
          draft.positionX = clamp(cropDrag.startX - (event.clientX - cropDrag.x) / Math.max(1, rect.width) * 100, 0, 100, draft.positionX);
          draft.positionY = clamp(cropDrag.startY - (event.clientY - cropDrag.y) / Math.max(1, rect.height) * 100, 0, 100, draft.positionY);
          for (const key of ["positionX", "positionY"]) {
            const control = rangeControls[key];
            if (!control) continue;
            control.input.value = String(draft[key]);
            control.value.textContent = `${Math.round(draft[key])}%`;
          }
          updatePreview();
        });
        const finishCropDrag = event => {
          if (!cropDrag || cropDrag.id !== event.pointerId) return;
          crop.releasePointerCapture?.(event.pointerId);
          cropDrag = null;
        };
        crop.addEventListener("pointerup", finishCropDrag);
        crop.addEventListener("pointercancel", () => { cropDrag = null; });

        const note = document.createElement("div");
        note.className = "fav-note";
        note.textContent = selectedTarget === "user"
          ? "我的头像只由你手动切换。新发送的消息会记住当时使用的头像。"
          : "开启“允许角色自行切换”后，模型可切换已有头像，也可收藏并换上你刚从照片墙发送的图片。";

        const actions = document.createElement("div");
        actions.className = "fav-actions";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "fav-btn";
        cancel.textContent = "取消";
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "fav-btn danger";
        remove.textContent = "删除";
        remove.hidden = !existing;
        const save = document.createElement("button");
        save.type = "button";
        save.className = "fav-btn primary";
        save.textContent = "保存";
        actions.append(remove, cancel, save);

        const closeEditor = () => { editorOpen = false; api.close(); };
        cancel.addEventListener("click", closeEditor);
        let deleteArmed = false;
        remove.addEventListener("click", () => {
          if (!existing) return;
          if (!deleteArmed) {
            deleteArmed = true;
            remove.textContent = "确认删除";
            return;
          }
          delete state.assets[existing.id];
          if (state.activeUserAvatarId === existing.id) state.activeUserAvatarId = "";
          for (const [charId, assetId] of Object.entries(state.activeByCharacter)) {
            if (assetId === existing.id) delete state.activeByCharacter[charId];
          }
          persist();
          notifyAvatarChange(selectedTarget);
          restoreManagedImages();
          renderPanel();
          scheduleScan();
          closeEditor();
        });
        save.addEventListener("click", () => {
          draft.name = draft.name.trim();
          if (urlInput.value.trim()) draft.source = urlInput.value.trim();
          if (!draft.name) return ctx.ui.toast("请填写图片名称");
          if (!isImageSource(draft.source)) return ctx.ui.toast("请上传图片或填写有效图片链接");
          const duplicate = assetsForTarget(selectedTarget).find(item => item.id !== draft.id && item.name.trim() === draft.name);
          if (duplicate) return ctx.ui.toast("同一角色下的图片名称不能重复");
          const previousActiveId = selectedTarget === "user"
            ? state.activeUserAvatarId
            : state.activeByCharacter[selectedTarget];
          state.assets[draft.id] = normalizeAsset(draft);
          if (selectedTarget === "user" && !state.activeUserAvatarId) state.activeUserAvatarId = draft.id;
          if (selectedTarget !== "user" && !state.activeByCharacter[selectedTarget]) state.activeByCharacter[selectedTarget] = draft.id;
          const currentActiveId = selectedTarget === "user"
            ? state.activeUserAvatarId
            : state.activeByCharacter[selectedTarget];
          const activeVisualChanged = Boolean(original && currentActiveId === draft.id && (
            original.source !== draft.source
            || original.positionX !== draft.positionX
            || original.positionY !== draft.positionY
            || original.zoom !== draft.zoom
          ));
          if ((previousActiveId !== currentActiveId || activeVisualChanged) && currentActiveId === draft.id) {
            queueAvatarNotice(selectedTarget, draft.id);
          }
          persist();
          if (currentActiveId === draft.id) notifyAvatarChange(selectedTarget);
          restoreManagedImages();
          renderPanel();
          scheduleScan();
          closeEditor();
        });

        host.append(title, nameField, sourceField, crop, cropHelp,
          range("横向", "positionX", 0, 100, 1, "%"),
          range("纵向", "positionY", 0, 100, 1, "%"),
          range("缩放", "zoom", 1, 3, .05, "×"),
          note, actions);
        updatePreview();
        return () => { editorOpen = false; };
      });
    }

    let drag = null;
    handle.addEventListener("pointerdown", event => {
      drag = { id: event.pointerId, startY: event.clientY, startTop: handle.getBoundingClientRect().top, moved: false };
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      const delta = event.clientY - drag.startY;
      if (Math.abs(delta) > 4) drag.moved = true;
      const top = clamp(drag.startTop + delta, 8, Math.max(8, window.innerHeight - 70), drag.startTop);
      state.sidebarTop = top;
      handle.style.top = `${top}px`;
      positionPanel();
    });
    const finishDrag = event => {
      if (!drag || drag.id !== event.pointerId) return;
      const moved = drag.moved;
      drag = null;
      handle.releasePointerCapture?.(event.pointerId);
      if (moved) persist();
      else { sidebarOpen = !sidebarOpen; renderPanel(); syncVisibility(); }
    };
    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", () => { drag = null; });
    const handleResize = () => {
      if (state.sidebarTop != null) {
        state.sidebarTop = clamp(state.sidebarTop, 8, Math.max(8, window.innerHeight - 70), 8);
        handle.style.top = `${state.sidebarTop}px`;
      }
      positionPanel();
    };
    window.addEventListener("resize", handleResize);

    ctx.ui.slot("settings.section", el => {
      const row = document.createElement("label");
      row.className = "fav-settings";
      const text = document.createElement("span");
      text.textContent = "显示聊天头像侧边栏";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.sidebarEnabled;
      checkbox.addEventListener("change", () => {
        state.sidebarEnabled = checkbox.checked;
        if (!state.sidebarEnabled) sidebarOpen = false;
        persist();
        syncVisibility();
      });
      row.append(text, checkbox);
      el.appendChild(row);
      const refresh = () => { checkbox.checked = state.sidebarEnabled; };
      settingsRefreshers.add(refresh);
      return () => { settingsRefreshers.delete(refresh); row.remove(); };
    });

    renderPanel();
    syncVisibility();
    scheduleScan();
    notifyAvatarChange("user");

    return () => {
      observer?.disconnect();
      themeObserver?.disconnect();
      if (scanFrame) cancelAnimationFrame(scanFrame);
      restoreManagedImages();
      handle.remove();
      panel.remove();
      settingsRefreshers.clear();
      pendingCharacterBySession.clear();
      pendingPhotoBySession.clear();
      pendingPhotoPairsBySession.clear();
      pendingAvatarNoticesByCharacter.clear();
      avatarNoticeInFlightBySession.clear();
      visionSourceCache.clear();
      visionAvatarCache.clear();
      document.documentElement?.removeAttribute("data-float-avatar-switcher");
      window.dispatchEvent(new CustomEvent(AVATAR_CHANGE_EVENT, { detail: { active: false } }));
      window.removeEventListener(AVATAR_REQUEST_EVENT, onAvatarRequest);
      window.removeEventListener("resize", handleResize);
    };
  },
};
