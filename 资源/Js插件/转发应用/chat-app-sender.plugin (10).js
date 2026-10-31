// ─────────────────────────────────────────────────────────────
// 转发应用 · 小手机聊天插件（apiVersion 1）
//
// 把手机上的应用转发给聊天对象：
//   · 「+」面板 →「应用」：选一个应用 → 选转发对象（可多选）
//   · 桌面整理态：每个应用图标右上角出现「转发」角标，点它选对象
// 对象支持：AI 助手小卷、一个/多个 AI 角色、一个/多个群聊。
//
// 应用来源：宿主桌面布局（分页/程序坞/文件夹）+ 已安装的自定义应用 +
// 内置应用清单。只读宿主的 AiPhoneKvDB，不写宿主数据。
//
// 转发消息走宿主的 plugin:app-share 消息类型，聊天里显示应用卡片，
// 点卡片用宿主的 open-app 事件直接打开应用。小卷没有插件消息接口，
// 走它自己的聊天窗口：打开面板、填入文字、点发送。
// ─────────────────────────────────────────────────────────────

const APP_DB = "AiPhoneKvDB";
const KEY_LAYOUT = "ai_phone_icon_layout_v2";
const KEY_DOCK = "ai_phone_dock_layout_v1";
const KEY_FOLDERS = "ai_phone_desktop_folders_v1";
const KEY_CUSTOM_APPS = "ai_phone_custom_apps_v1";

const BUILTIN_APPS = [
  { id: "chat", name: "聊天", glyph: "💬", description: "和角色聊天、发消息" },
  { id: "diary", name: "手记", glyph: "📔", description: "记录日常和心情" },
  { id: "music", name: "音乐", glyph: "🎵", description: "听歌、播放音乐" },
  { id: "reading", name: "阅读", glyph: "📖", description: "读小说和文章" },
  { id: "cocreate", name: "共创", glyph: "🎨", description: "和角色一起创作" },
  { id: "story", name: "剧情", glyph: "🎬", description: "剧情模式" },
  { id: "game", name: "游戏", glyph: "🎮", description: "玩小游戏" },
  { id: "appmarket", name: "应用市场", glyph: "🧩", description: "安装更多应用" },
  { id: "xiaohongshu", name: "小红书", glyph: "📕", description: "刷小红书" },
  { id: "checkphone", name: "查手机", glyph: "🔍", description: "查看手机里的内容" },
  { id: "dwelling", name: "栖所", glyph: "🏠", description: "角色住的地方" },
  { id: "shopping", name: "购物", glyph: "🛒", description: "买东西" },
  { id: "interview_magazine", name: "在场", glyph: "🎙️", description: "访谈杂志" },
  { id: "vnmode", name: "漫卷", glyph: "🎞️", description: "视觉小说" },
  { id: "mapmode", name: "冒险", glyph: "🗺️", description: "地图冒险" },
  { id: "moments", name: "朋友圈", glyph: "🌈", description: "看朋友圈" },
  { id: "group_chat", name: "群聊", glyph: "👥", description: "群聊" },
  { id: "realitybridge", name: "现实桥", glyph: "🌉", description: "和现实联动" },
  { id: "settings", name: "设置", glyph: "⚙️", description: "手机设置" },
  { id: "resources", name: "资源库", glyph: "📦", description: "素材资源" },
  { id: "resource_hub", name: "资源集市", glyph: "🛍️", description: "资源市场" },
  { id: "characters", name: "角色", glyph: "👤", description: "角色卡" },
  { id: "worldbuilder", name: "筑境", glyph: "🏗️", description: "世界设定" },
  { id: "qa", name: "工坊", glyph: "🛠️", description: "工坊" },
  { id: "mixology", name: "独家特调", glyph: "🍸", description: "特调玩法" },
];

const BUILTIN_BY_ID = new Map(BUILTIN_APPS.map((app) => [app.id, app]));

const APP_SHARE_SVG =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/>' +
  '<rect x="3" y="14" width="7" height="7" rx="1.6"/>' +
  '<path d="M14.5 17.5h6M17.5 14.5l3 3-3 3"/></svg>';

const FORWARD_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4 12l16-8-6 16-2.5-6.5L4 12z"/></svg>';

const CSS = `
.cas-row {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 4px 16px 12px;
}
.cas-entry { -webkit-tap-highlight-color: transparent; cursor: pointer; }
.cas-entry:active .chat-plus-icon-box { transform: scale(.94); }

.cas-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  min-height: 320px;
  box-sizing: border-box;
  font-size: 14px;
  color: var(--c-text, #222);
  text-align: left;
}
.cas-head { display: flex; align-items: center; gap: 8px; }
.cas-title { flex: 1 1 auto; font-size: 16px; font-weight: 600; }
.cas-done {
  font: inherit;
  font-size: 13px;
  padding: 6px 14px;
  border-radius: 9px;
  border: 1px solid rgba(120, 120, 120, .35);
  background: rgba(120, 120, 120, .1);
  color: inherit;
  cursor: pointer;
}
.cas-search {
  width: 100%;
  box-sizing: border-box;
  font: inherit;
  font-size: 14px;
  padding: 10px 12px;
  border-radius: 11px;
  border: 1px solid rgba(120, 120, 120, .3);
  background: rgba(120, 120, 120, .06);
  color: inherit;
}
.cas-search:focus { outline: 2px solid rgba(74, 124, 89, .45); outline-offset: 1px; }
.cas-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  max-height: 50vh;
  overflow: auto;
  padding: 2px;
}
.cas-app {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 13px;
  border: 1px solid transparent;
  background: rgba(120, 120, 120, .07);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}
.cas-app:active { background: rgba(120, 120, 120, .14); }
.cas-app-icon {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 11px;
  background: rgba(120, 120, 120, .12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 21px;
  background-size: cover;
  background-position: center;
}
.cas-app-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cas-app-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cas-app-desc {
  font-size: 11px;
  opacity: .65;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cas-tip { margin: 0; font-size: 12px; line-height: 1.6; color: rgba(120, 120, 120, .95); }
.cas-empty { padding: 26px 8px; text-align: center; font-size: 13px; opacity: .65; }

.cas-card {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 236px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 11px;
  border-radius: 14px;
  border: 1px solid rgba(120, 120, 120, .18);
  background: rgba(255, 255, 255, .72);
  color: inherit;
  cursor: pointer;
}
.cas-card-icon {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  background: rgba(120, 120, 120, .12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  background-size: cover;
  background-position: center;
}
.cas-card-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cas-card-name { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cas-card-desc {
  font-size: 11px;
  opacity: .68;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cas-card-open {
  flex: 0 0 auto;
  font-size: 11px;
  padding: 4px 9px;
  border-radius: 8px;
  background: rgba(74, 124, 89, .14);
  color: #3f6b4d;
}

/* 桌面整理态：图标右上角转发角标 */
.cas-fwd-anchor { position: relative !important; overflow: visible !important; }
.cas-fwd-badge {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--c-page-body-bg, #f7f3ec);
  background: #4a7c59;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, .22);
  z-index: 30;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.cas-fwd-badge:active { transform: scale(.9); }

/* 转发对象选择 */
.cas-rcp-app {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 13px;
  background: rgba(120, 120, 120, .07);
}
.cas-rcp-sections { display: flex; flex-direction: column; gap: 10px; max-height: 44vh; overflow: auto; padding: 2px; }
.cas-rcp-section { display: flex; flex-direction: column; gap: 2px; }
.cas-rcp-section-title { font-size: 11px; opacity: .6; padding: 4px 4px 2px; }
.cas-rcp {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.cas-rcp[data-on="1"] { background: rgba(74, 124, 89, .1); border-color: rgba(74, 124, 89, .35); }
.cas-rcp-check {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid rgba(120, 120, 120, .5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
}
.cas-rcp[data-on="1"] .cas-rcp-check { background: #4a7c59; border-color: #4a7c59; }
.cas-rcp-avatar {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(120, 120, 120, .14);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  opacity: .9;
}
.cas-rcp-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.cas-rcp-name { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cas-rcp-sub { font-size: 11px; opacity: .6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cas-rcp-footer { display: flex; gap: 8px; align-items: center; }
.cas-rcp-footer .cas-done { flex: 0 0 auto; }
.cas-rcp-go {
  flex: 1 1 auto;
  font: inherit;
  font-size: 14px;
  padding: 10px;
  border-radius: 11px;
  border: 1px solid #4a7c59;
  background: #4a7c59;
  color: #fff;
  cursor: pointer;
}
.cas-rcp-go:disabled { opacity: .45; cursor: default; }
`;

export default {
  manifest: {
    id: "chat-app-sender",
    name: "转发应用",
    apiVersion: 1,
    version: "1.2.2",
    author: "",
    description:
      "把手机桌面上的应用转发给别人：整理桌面时点图标右上角的转发角标（文件夹会列出里面的应用），或在「+」→「应用」里选；可多选小卷、多个 AI 角色和群聊。",
    permissions: ["chat.read", "chat.write", "ui"],
    settings: [
      {
        key: "autoReply",
        label: "转发后让 AI 角色回应（多选时每个角色都会收到请求）",
        type: "boolean",
        default: false,
      },
    ],
  },

  setup(ctx) {
    const doc = document;
    const win = typeof window !== "undefined" ? window : globalThis;
    const later = (fn, ms) => win.setTimeout(fn, Math.max(0, Number(ms) || 0));
    const delay = (ms) => new Promise((resolve) => later(resolve, ms));

    ctx.ui.injectCSS(CSS);

    function setting(key, fallback) {
      try {
        const value = ctx.system.settings.get(key);
        return value === undefined || value === null ? fallback : value;
      } catch (err) {
        return fallback;
      }
    }

    function toast(text) {
      try {
        if (ctx.ui && typeof ctx.ui.toast === "function") ctx.ui.toast(text);
      } catch (err) { /* ignore */ }
    }

    // ── 会话追踪 ──────────────────────────────────────────
    let currentSessionId = null;
    // 只读取会话 id，不改宿主的 header 布局（避免动到 React 管理的节点）
    ctx.ui.slot("chat.header", (el, props) => {
      if (props && props.sessionId) currentSessionId = props.sessionId;
    });
    ctx.hooks.on("session.opened", (payload) => {
      if (payload && payload.sessionId) currentSessionId = payload.sessionId;
    });

    // ── 应用目录 ──────────────────────────────────────────
    let catalog = [];
    let folderMap = new Map();
    let catalogLoaded = false;
    let catalogLoading = null;
    let catalogVersion = 0;

    function parseJson(raw) {
      if (typeof raw !== "string" || !raw) return null;
      try { return JSON.parse(raw); } catch (err) { return null; }
    }

    function readKvMany(keys) {
      return new Promise((resolve) => {
        const result = {};
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        later(finish, 1800);
        try {
          if (typeof indexedDB === "undefined") { finish(); return; }
          const request = indexedDB.open(APP_DB);
          request.onerror = finish;
          request.onsuccess = () => {
            const db = request.result;
            let remaining = keys.length;
            const oneDone = () => {
              remaining -= 1;
              if (remaining <= 0) {
                try { db.close(); } catch (err) { /* ignore */ }
                finish();
              }
            };
            try {
              const tx = db.transaction("entries", "readonly");
              const store = tx.objectStore("entries");
              for (let i = 0; i < keys.length; i += 1) {
                const key = keys[i];
                const get = store.get(key);
                get.onsuccess = () => {
                  const record = get.result;
                  if (record && typeof record.value === "string") result[key] = record.value;
                  oneDone();
                };
                get.onerror = oneDone;
              }
            } catch (err) {
              try { db.close(); } catch (closeErr) { /* ignore */ }
              finish();
            }
          };
        } catch (err) {
          finish();
        }
      });
    }

    function normalizeCustomApps(raw) {
      const list = parseJson(raw);
      if (!Array.isArray(list)) return [];
      const out = [];
      for (let i = 0; i < list.length; i += 1) {
        const item = list[i];
        if (!item || typeof item.id !== "string" || !item.id) continue;
        const manifest = item.manifest && typeof item.manifest === "object" ? item.manifest : {};
        out.push({
          id: item.id,
          name: String(item.name || manifest.name || item.id),
          description: String(item.description || manifest.description || ""),
          iconDataUrl: typeof item.iconDataUrl === "string" ? item.iconDataUrl : "",
        });
      }
      return out;
    }

    function buildCatalog(layoutRaw, dockRaw, foldersRaw, customRaw) {
      const layout = parseJson(layoutRaw) || {};
      const dock = parseJson(dockRaw);
      const folders = parseJson(foldersRaw) || {};
      const customApps = normalizeCustomApps(customRaw);
      const customById = new Map(customApps.map((app) => [app.id, app]));

      const order = [];
      const seen = new Set();
      const pushId = (id) => {
        if (typeof id !== "string" || !id || seen.has(id)) return;
        seen.add(id);
        order.push(id);
      };

      const pageKeys = Object.keys(layout)
        .filter((key) => /^page\d+$/.test(key))
        .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
      for (let i = 0; i < pageKeys.length; i += 1) {
        const items = Array.isArray(layout[pageKeys[i]]) ? layout[pageKeys[i]].slice() : [];
        items.sort((a, b) => ((Number(a && a.row) || 0) - (Number(b && b.row) || 0))
          || ((Number(a && a.col) || 0) - (Number(b && b.col) || 0)));
        for (let j = 0; j < items.length; j += 1) pushId(items[j] && items[j].id);
      }
      if (Array.isArray(dock)) {
        for (let i = 0; i < dock.length; i += 1) pushId(dock[i]);
      }
      folderMap = new Map();
      if (folders && typeof folders === "object") {
        Object.keys(folders).forEach((folderId) => {
          const folder = folders[folderId];
          if (!folder || !Array.isArray(folder.icons)) return;
          folderMap.set(folderId, {
            id: folderId,
            name: String(folder.name || "文件夹"),
            icons: folder.icons.filter((id) => typeof id === "string"),
          });
          folder.icons.forEach((id) => pushId(id));
        });
      }
      customApps.forEach((app) => pushId(`custom_app:${app.id}`));
      if (!order.length) BUILTIN_APPS.forEach((app) => pushId(app.id));

      const apps = [];
      for (let i = 0; i < order.length; i += 1) {
        const iconId = order[i];
        if (iconId.startsWith("folder:")) continue;
        if (iconId.startsWith("custom_app:")) {
          const id = iconId.slice("custom_app:".length);
          const app = customById.get(id);
          if (!app) continue;
          apps.push({
            kind: "custom",
            id,
            iconId,
            name: app.name,
            description: app.description,
            iconDataUrl: app.iconDataUrl,
            glyph: "🧩",
          });
          continue;
        }
        const builtin = BUILTIN_BY_ID.get(iconId);
        if (!builtin) continue;
        apps.push({
          kind: "builtin",
          id: builtin.id,
          iconId,
          name: builtin.name,
          description: builtin.description,
          iconDataUrl: "",
          glyph: builtin.glyph,
        });
      }
      return apps;
    }

    function loadCatalog(force) {
      if (catalogLoading) return catalogLoading;
      if (catalogLoaded && !force) return Promise.resolve(catalog);
      const version = ++catalogVersion;
      catalogLoading = readKvMany([KEY_LAYOUT, KEY_DOCK, KEY_FOLDERS, KEY_CUSTOM_APPS])
        .then((values) => {
          const apps = buildCatalog(
            values[KEY_LAYOUT] || null,
            values[KEY_DOCK] || null,
            values[KEY_FOLDERS] || null,
            values[KEY_CUSTOM_APPS] || null,
          );
          if (version === catalogVersion) {
            catalog = apps;
            catalogLoaded = true;
          }
          catalogLoading = null;
          return apps;
        })
        .catch(() => {
          const apps = buildCatalog(null, null, null, null);
          if (version === catalogVersion) {
            catalog = apps;
            catalogLoaded = true;
          }
          catalogLoading = null;
          return apps;
        });
      return catalogLoading;
    }

    function appForIconId(iconId, fallbackLabel) {
      if (!iconId) return null;
      if (iconId.startsWith("custom_app:")) {
        const id = iconId.slice("custom_app:".length);
        const found = catalog.find((app) => app.kind === "custom" && app.id === id);
        if (found) return found;
        return {
          kind: "custom",
          id,
          iconId,
          name: fallbackLabel || id,
          description: "",
          iconDataUrl: "",
          glyph: "🧩",
        };
      }
      if (iconId.startsWith("folder:")) return null;
      const found = catalog.find((app) => app.kind === "builtin" && app.id === iconId);
      if (found) return found;
      const builtin = BUILTIN_BY_ID.get(iconId);
      if (builtin) {
        return {
          kind: "builtin",
          id: builtin.id,
          iconId,
          name: builtin.name,
          description: builtin.description,
          iconDataUrl: "",
          glyph: builtin.glyph,
        };
      }
      return null;
    }

    function openApp(app) {
      if (!app) return;
      const appId = app.kind === "custom" ? `custom_app:${app.id}` : app.id;
      try {
        window.dispatchEvent(new CustomEvent("open-app", {
          detail: { appId, launchContext: { source: "app_share_card" } },
        }));
      } catch (err) { /* ignore */ }
    }

    // ── 发送 / 转发 ───────────────────────────────────────
    function refreshChat(sessionId) {
      try {
        window.dispatchEvent(new CustomEvent("chat-messages-updated", { detail: { sessionId } }));
      } catch (err) { /* ignore */ }
    }

    function askReply(sessionId) {
      try {
        const event = new CustomEvent("chat-request-reply", { detail: { sessionId } });
        window.dispatchEvent(event);
        return Boolean(event.detail && event.detail.handled);
      } catch (err) {
        return false;
      }
    }

    function shareText(app) {
      const description = app.description ? `它能做：${app.description}。` : "";
      return `【应用分享】我把手机上的「${app.name}」应用发给你了，你可以直接使用它。${description}`;
    }

    function deliverToSession(app, sessionId) {
      try {
        ctx.data.messages.push({
          sessionId,
          role: "user",
          content: shareText(app),
          mediaType: "plugin:app-share",
          mediaData: {
            appId: app.id,
            appKind: app.kind,
            appName: app.name,
            appDescription: app.description || "",
          },
        });
      } catch (err) {
        return false;
      }
      refreshChat(sessionId);
      if (setting("autoReply", false) === true) askReply(sessionId);
      return true;
    }

    // ── 小卷：走它自己的聊天窗口 ──────────────────────────
    function findMascotPanel() {
      return doc.querySelector(".mascot-panel") || doc.querySelector('[class*="mascot-panel"]');
    }

    function openMascotPanel() {
      const float = doc.querySelector(".mascot-float") || doc.querySelector('[class*="mascot-float"]');
      if (!float) return false;
      // 小卷的浮球监听的是 pointerdown / pointerup（点击/拖动共用），
      // 单纯 click() 不会切换面板，所以补一对原地按下的指针事件。
      try {
        const rect = float.getBoundingClientRect ? float.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const base = {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: "touch",
          isPrimary: true,
          clientX: x,
          clientY: y,
          button: 0,
        };
        float.dispatchEvent(new PointerEvent("pointerdown", Object.assign({}, base, { buttons: 1 })));
        float.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, base, { buttons: 0 })));
        return true;
      } catch (err) {
        try {
          float.click();
          return true;
        } catch (clickErr) {
          return false;
        }
      }
    }

    async function sendToMascot(app) {
      let panel = findMascotPanel();
      if (!panel) {
        if (!openMascotPanel()) return false;
        for (let i = 0; i < 24 && !panel; i += 1) {
          await delay(90);
          panel = findMascotPanel();
        }
      }
      if (!panel) return false;

      const input = panel.querySelector("textarea.chat-input-textarea") || panel.querySelector("textarea");
      if (!input) return false;

      const text = shareText(app);
      try {
        const proto = win.HTMLTextAreaElement && win.HTMLTextAreaElement.prototype;
        const setter = proto && Object.getOwnPropertyDescriptor(proto, "value");
        if (setter && typeof setter.set === "function") setter.set.call(input, text);
        else input.value = text;
      } catch (err) {
        input.value = text;
      }
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await delay(80);

      let button = null;
      const actionsEl = panel.querySelector(".chat-input-actions");
      if (actionsEl) {
        const buttons = actionsEl.querySelectorAll ? actionsEl.querySelectorAll("button") : [];
        for (let i = 0; i < buttons.length; i += 1) {
          const label = buttons[i].getAttribute ? buttons[i].getAttribute("aria-label") : "";
          if (label === "发送") { button = buttons[i]; break; }
        }
        if (!button && buttons.length) button = buttons[buttons.length - 1];
      }
      if (!button) return false;
      if (button.disabled) return false;
      button.click();
      return true;
    }

    async function forwardApp(app, targets) {
      let delivered = 0;
      let mascotTried = false;
      let mascotOk = false;
      for (let i = 0; i < targets.length; i += 1) {
        const target = targets[i];
        if (target.kind === "mascot") {
          mascotTried = true;
          // eslint-disable-next-line no-await-in-loop
          mascotOk = await sendToMascot(app);
          if (mascotOk) delivered += 1;
          continue;
        }
        if (deliverToSession(app, target.id)) delivered += 1;
      }
      if (delivered > 0) toast(`已转发给 ${delivered} 个对象`);
      else toast("转发失败，请重试");
      if (mascotTried && !mascotOk && delivered > 0) {
        toast("没找到小卷的聊天窗口，其余对象已转发");
      }
      exitHostEditMode();
      return delivered;
    }

    // ── 应用卡片消息 ──────────────────────────────────────
    function iconFor(app) {
      const box = doc.createElement("div");
      box.className = "cas-card-icon";
      if (app && app.kind === "custom" && app.iconDataUrl) {
        box.style.backgroundImage = `url("${String(app.iconDataUrl).replace(/"/g, '\\"')}")`;
        return box;
      }
      box.textContent = (app && app.glyph) || (app && app.kind === "custom" ? "🧩" : "📱");
      return box;
    }

    function resolveAppData(data) {
      const appId = data && data.appId ? String(data.appId) : "";
      const kind = data && data.appKind === "custom" ? "custom" : "builtin";
      const found = catalog.find((app) => app.kind === kind && app.id === appId);
      if (found) return found;
      return {
        kind,
        id: appId,
        iconId: kind === "custom" ? `custom_app:${appId}` : appId,
        name: data && data.appName ? String(data.appName) : "应用",
        description: data && data.appDescription ? String(data.appDescription) : "",
        iconDataUrl: "",
        glyph: kind === "custom" ? "🧩" : "📱",
      };
    }

    const offKind = ctx.ui.messageKind("app-share", (el, msg) => {
      try {
        const data = msg && msg.mediaData ? msg.mediaData : {};
        const app = resolveAppData(data);
        el.textContent = "";

        const card = doc.createElement("div");
        card.className = "cas-card";
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");

        const main = doc.createElement("div");
        main.className = "cas-card-main";
        const name = doc.createElement("div");
        name.className = "cas-card-name";
        name.textContent = app.name;
        const desc = doc.createElement("div");
        desc.className = "cas-card-desc";
        desc.textContent = app.description || "点开使用这个应用";
        main.appendChild(name);
        main.appendChild(desc);

        const open = doc.createElement("div");
        open.className = "cas-card-open";
        open.textContent = "打开";

        card.appendChild(iconFor(app));
        card.appendChild(main);
        card.appendChild(open);

        const activate = () => openApp(app);
        card.addEventListener("click", activate);
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        });
        el.appendChild(card);
      } catch (err) {
        try { el.textContent = ""; } catch (clearErr) { /* ignore */ }
      }
    });

    // ── 给模型一段说明，让它知道可以用这个应用 ────────────
    const offTransform = ctx.hooks.transform("llm.request", (payload) => {
      if (!payload || !Array.isArray(payload.messages)) return payload;
      let lastUser = null;
      for (let i = payload.messages.length - 1; i >= 0; i -= 1) {
        if (payload.messages[i] && payload.messages[i].role === "user") {
          lastUser = payload.messages[i];
          break;
        }
      }
      if (!lastUser || typeof lastUser.content !== "string") return payload;
      if (lastUser.content.indexOf("【应用分享】") !== 0) return payload;
      payload.messages.push({
        role: "system",
        content: "对方刚刚通过手机把应用分享给了你，并说你可以直接使用。请自然地接受，"
          + "在接下来的对话里像真的打开、使用这个应用一样回应（可以描述界面、功能、看到的内容），"
          + "不要质疑应用不存在，也不需要真的执行代码。",
      });
      return payload;
    });

    // ── 「+」入口与应用选择器 ─────────────────────────────
    let pickerHandle = null;
    let pickerLoading = false;
    let pickerSearch = "";
    let pickerGen = 0;

    const offSlot = ctx.ui.slot("chat.inputToolbar", (el) => {
      el.textContent = "";
      const row = doc.createElement("div");
      row.className = "cas-row";

      const item = doc.createElement("div");
      item.className = "chat-plus-menu-item cas-entry";
      item.setAttribute("role", "button");
      item.setAttribute("tabindex", "0");
      item.setAttribute("title", "转发应用");
      item.setAttribute("data-app-sender", "1");

      const box = doc.createElement("div");
      box.className = "chat-plus-icon-box";
      box.innerHTML = APP_SHARE_SVG;

      const label = doc.createElement("span");
      label.className = "ts-11";
      label.textContent = "转发应用";

      item.appendChild(box);
      item.appendChild(label);

      const activate = () => openPicker();
      item.addEventListener("click", activate);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });

      row.appendChild(item);
      el.insertBefore(row, el.firstChild || null);

      return () => { el.textContent = ""; };
    });

    function openPicker() {
      if (pickerHandle) return;
      pickerSearch = "";
      pickerLoading = !catalogLoaded;
      const gen = ++pickerGen;

      const handle = ctx.ui.openModal((root, api) => {
        let closed = false;
        root.classList.add("cas-modal");
        root.textContent = "";

        const rerender = () => {
          if (closed) return;
          renderPicker(root, api);
        };
        renderPicker(root, api);

        loadCatalog(true).then(() => {
          if (closed || gen !== pickerGen) return;
          pickerLoading = false;
          rerender();
        });

        return () => {
          closed = true;
          pickerHandle = null;
        };
      });
      pickerHandle = handle || null;
    }

    function element(tag, className, text) {
      const el = doc.createElement(tag);
      if (className) el.className = className;
      if (text != null) el.textContent = text;
      return el;
    }

    function matchesSearch(app, query) {
      if (!query) return true;
      const haystack = `${app.name} ${app.description}`.toLowerCase();
      return haystack.indexOf(query) >= 0;
    }

    function appButton(app, api) {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "cas-app";

      const icon = doc.createElement("div");
      icon.className = "cas-app-icon";
      if (app.kind === "custom" && app.iconDataUrl) {
        icon.style.backgroundImage = `url("${String(app.iconDataUrl).replace(/"/g, '\\"')}")`;
      } else {
        icon.textContent = app.glyph || (app.kind === "custom" ? "🧩" : "📱");
      }

      const main = element("div", "cas-app-main");
      main.appendChild(element("div", "cas-app-name", app.name));
      main.appendChild(element("div", "cas-app-desc", app.description || (app.kind === "custom" ? "自定义应用" : "内置应用")));

      button.appendChild(icon);
      button.appendChild(main);
      button.addEventListener("click", () => {
        if (api && typeof api.close === "function") api.close();
        pickerHandle = null;
        openRecipients(app);
      });
      return button;
    }

    function renderPicker(root, api) {
      while (root.firstChild) root.removeChild(root.firstChild);

      const head = element("div", "cas-head");
      head.appendChild(element("div", "cas-title", "选择应用"));
      const done = element("button", "cas-done", "完成");
      done.type = "button";
      done.addEventListener("click", () => {
        if (api && typeof api.close === "function") api.close();
        else if (pickerHandle && typeof pickerHandle.close === "function") pickerHandle.close();
        pickerHandle = null;
      });
      head.appendChild(done);
      root.appendChild(head);

      if (pickerLoading) {
        root.appendChild(element("div", "cas-empty", "正在读取桌面应用…"));
        return;
      }

      const search = doc.createElement("input");
      search.className = "cas-search";
      search.type = "search";
      search.placeholder = "搜索应用…";
      search.value = pickerSearch;
      root.appendChild(search);

      const list = element("div", "cas-list");
      const count = element("p", "cas-tip", "");

      const fill = () => {
        while (list.firstChild) list.removeChild(list.firstChild);
        const query = pickerSearch;
        const visible = catalog.filter((app) => matchesSearch(app, query));
        if (!visible.length) {
          list.appendChild(element("div", "cas-empty", "没有找到应用"));
        } else {
          for (let i = 0; i < visible.length; i += 1) {
            list.appendChild(appButton(visible[i], api));
          }
        }
        count.textContent = query ? `共 ${visible.length} 个结果` : "";
      };

      search.addEventListener("input", () => {
        pickerSearch = String(search.value || "").toLowerCase().trim();
        fill();
      });

      root.appendChild(list);
      root.appendChild(element("p", "cas-tip", "选好应用后，再选要转发给谁（可以多选）。"));
      root.appendChild(count);
      fill();
    }

    // ── 转发对象 ──────────────────────────────────────────
    function loadRecipients() {
      const sessions = (() => {
        try { return ctx.data.sessions.list() || []; } catch (err) { return []; }
      })();
      const characters = (() => {
        try { return ctx.data.characters.list() || []; } catch (err) { return []; }
      })();
      const byChar = new Map();
      for (let i = 0; i < characters.length; i += 1) {
        const c = characters[i];
        if (c && typeof c.id === "string") byChar.set(c.id, c);
      }

      const privates = [];
      const groups = [];
      const seenContacts = new Set();
      for (let i = 0; i < sessions.length; i += 1) {
        const session = sessions[i];
        if (!session || typeof session.id !== "string") continue;
        if (session.isGroup) {
          groups.push({
            kind: "session",
            id: session.id,
            name: String(session.groupName || "群聊"),
            subtitle: Array.isArray(session.participantIds) ? `${session.participantIds.length} 个成员` : "群聊",
            avatar: "",
            isGroup: true,
          });
          continue;
        }
        if (seenContacts.has(session.contactId)) continue;
        seenContacts.add(session.contactId);
        const character = byChar.get(session.contactId);
        const name = String((character && character.name) || session.alias || "未命名角色");
        const avatar = String((character && (character.avatar || character.avatarUrl)) || "");
        privates.push({
          kind: "session",
          id: session.id,
          name,
          subtitle: "AI 角色",
          avatar,
          isGroup: false,
        });
      }

      privates.sort((a, b) => a.name.localeCompare(b.name, "zh"));
      groups.sort((a, b) => a.name.localeCompare(b.name, "zh"));

      return [{ kind: "mascot", id: "mascot", name: "小卷", subtitle: "AI 助手", avatar: "" }]
        .concat(privates, groups);
    }

    function targetKey(target) {
      return `${target.kind}:${target.id}`;
    }

    let folderHandle = null;

    function appsInFolder(folderId) {
      const folder = folderMap.get(folderId);
      if (!folder) return null;
      const seen = new Set();
      const apps = [];
      for (let i = 0; i < folder.icons.length; i += 1) {
        const id = folder.icons[i];
        if (seen.has(id)) continue;
        seen.add(id);
        const app = appForIconId(id, "");
        if (app) apps.push(app);
      }
      return { folder, apps };
    }

    function folderAppTile(app, onPick) {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "cas-app";

      const icon = doc.createElement("div");
      icon.className = "cas-app-icon";
      if (app.kind === "custom" && app.iconDataUrl) {
        icon.style.backgroundImage = `url("${String(app.iconDataUrl).replace(/"/g, '\\"')}")`;
      } else {
        icon.textContent = app.glyph || (app.kind === "custom" ? "🧩" : "📱");
      }

      const main = element("div", "cas-app-main");
      main.appendChild(element("div", "cas-app-name", app.name));
      main.appendChild(element("div", "cas-app-desc", app.description || (app.kind === "custom" ? "自定义应用" : "内置应用")));

      button.appendChild(icon);
      button.appendChild(main);
      button.addEventListener("click", onPick);
      return button;
    }

    function openFolderApps(folderId) {
      if (folderHandle) return;
      const data = appsInFolder(folderId);
      if (!data) {
        toast("读不到这个文件夹");
        return;
      }
      if (!data.apps.length) {
        toast("文件夹里没有可转发的应用");
        return;
      }

      const handle = ctx.ui.openModal((root, api) => {
        root.classList.add("cas-modal");
        root.textContent = "";

        const head = element("div", "cas-head");
        head.appendChild(element("div", "cas-title", `文件夹「${data.folder.name}」`));
        const done = element("button", "cas-done", "完成");
        done.type = "button";
        done.addEventListener("click", () => {
          api.close();
          folderHandle = null;
        });
        head.appendChild(done);
        root.appendChild(head);

        root.appendChild(element("p", "cas-tip", "选一个应用转发给别人："));
        const list = element("div", "cas-list");
        for (let i = 0; i < data.apps.length; i += 1) {
          const app = data.apps[i];
          list.appendChild(folderAppTile(app, () => {
            api.close();
            folderHandle = null;
            openRecipients(app);
          }));
        }
        root.appendChild(list);

        return () => { folderHandle = null; };
      });
      folderHandle = handle || null;
    }

    let recipientHandle = null;

    function openRecipients(app) {
      if (recipientHandle) return;
      const all = loadRecipients();
      const selected = new Set();
      if (currentSessionId) {
        const found = all.find((t) => t.kind === "session" && t.id === currentSessionId);
        if (found) selected.add(targetKey(found));
      }

      const state = { search: "" };

      const handle = ctx.ui.openModal((root, api) => {
        root.classList.add("cas-modal");
        root.textContent = "";

        const render = () => {
          while (root.firstChild) root.removeChild(root.firstChild);

          const head = element("div", "cas-head");
          head.appendChild(element("div", "cas-title", "转发应用"));
          const done = element("button", "cas-done", "完成");
          done.type = "button";
          done.addEventListener("click", () => {
            if (api && typeof api.close === "function") api.close();
            recipientHandle = null;
          });
          head.appendChild(done);
          root.appendChild(head);

          const appRow = element("div", "cas-rcp-app");
          appRow.appendChild(iconFor(app));
          const appMain = element("div", "cas-app-main");
          appMain.appendChild(element("div", "cas-app-name", app.name));
          appMain.appendChild(element("div", "cas-app-desc", app.description || "应用"));
          appRow.appendChild(appMain);
          root.appendChild(appRow);

          const search = doc.createElement("input");
          search.className = "cas-search";
          search.type = "search";
          search.placeholder = "搜索转发对象…";
          search.value = state.search;
          search.addEventListener("input", () => {
            state.search = String(search.value || "").toLowerCase().trim();
            renderSections();
          });
          root.appendChild(search);

          const sections = element("div", "cas-rcp-sections");
          const footer = element("div", "cas-rcp-footer");

          const matches = (target) => {
            if (!state.search) return true;
            return `${target.name} ${target.subtitle}`.toLowerCase().indexOf(state.search) >= 0;
          };

          const rowFor = (target) => {
            const row = doc.createElement("button");
            row.type = "button";
            row.className = "cas-rcp";
            const key = targetKey(target);
            row.setAttribute("data-on", selected.has(key) ? "1" : "0");

            const check = element("span", "cas-rcp-check", selected.has(key) ? "✓" : "");
            const avatar = element("span", "cas-rcp-avatar");
            if (target.avatar) {
              avatar.style.backgroundImage = `url("${String(target.avatar).replace(/"/g, '\\"')}")`;
            } else {
              avatar.textContent = target.name.slice(0, 1);
            }
            const main = element("span", "cas-rcp-main");
            main.appendChild(element("span", "cas-rcp-name", target.name));
            main.appendChild(element("span", "cas-rcp-sub", target.subtitle));

            row.appendChild(check);
            row.appendChild(avatar);
            row.appendChild(main);
            row.addEventListener("click", () => {
              if (selected.has(key)) selected.delete(key);
              else selected.add(key);
              row.setAttribute("data-on", selected.has(key) ? "1" : "0");
              check.textContent = selected.has(key) ? "✓" : "";
              updateFooter();
            });
            return row;
          };

          const updateFooter = () => {
            while (footer.firstChild) footer.removeChild(footer.firstChild);
            const cancel = element("button", "cas-done", "取消");
            cancel.type = "button";
            cancel.addEventListener("click", () => {
              if (api && typeof api.close === "function") api.close();
              recipientHandle = null;
            });
            const go = element("button", "cas-rcp-go", selected.size ? `转发给 ${selected.size} 个对象` : "请选择对象");
            go.type = "button";
            go.disabled = selected.size === 0;
            go.addEventListener("click", () => {
              const targets = all.filter((t) => selected.has(targetKey(t)));
              if (!targets.length) return;
              if (api && typeof api.close === "function") api.close();
              recipientHandle = null;
              void forwardApp(app, targets);
            });
            footer.appendChild(cancel);
            footer.appendChild(go);
          };

          const renderSections = () => {
            while (sections.firstChild) sections.removeChild(sections.firstChild);
            const addSection = (title, list) => {
              const visible = list.filter(matches);
              if (!visible.length) return;
              const section = element("div", "cas-rcp-section");
              section.appendChild(element("div", "cas-rcp-section-title", title));
              visible.forEach((target) => section.appendChild(rowFor(target)));
              sections.appendChild(section);
            };
            addSection("AI 助手", all.filter((t) => t.kind === "mascot"));
            addSection("AI 角色", all.filter((t) => t.kind === "session" && !t.isGroup));
            addSection("群聊", all.filter((t) => t.kind === "session" && t.isGroup));
            if (!sections.firstChild) {
              sections.appendChild(element("div", "cas-empty", "没有找到可转发的对象"));
            }
          };

          root.appendChild(sections);
          root.appendChild(footer);
          renderSections();
          updateFooter();
        };
        render();

        return () => {
          recipientHandle = null;
        };
      });
      recipientHandle = handle || null;
    }

    // ── 桌面整理态角标 ────────────────────────────────────
    function exitHostEditMode() {
      try {
        const done = doc.querySelector(".edit-mode-done");
        if (done && typeof done.click === "function") done.click();
      } catch (err) { /* ignore */ }
    }

    function hasBadge(icon) {
      const children = icon.children || [];
      for (let i = 0; i < children.length; i += 1) {
        if (children[i].classList && children[i].classList.contains("cas-fwd-badge")) return true;
      }
      return false;
    }

    let badgeOpenAt = 0;

    function badgeFromTarget(target) {
      let node = target;
      let guard = 0;
      while (node && guard < 8) {
        if (node.classList && node.classList.contains("cas-fwd-badge")) return node;
        node = node.parentNode;
        guard += 1;
      }
      return null;
    }

    function openBadge(badge, event) {
      if (event) {
        if (event.stopPropagation) event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
      }
      if (!badge) return;
      // pointerdown / touchstart / click 可能连着来，同一个角标只认第一次
      const last = Number(badge.getAttribute("data-last-open") || 0) || 0;
      if (Date.now() - last < 600) return;
      badge.setAttribute("data-last-open", String(Date.now()));
      if (badge.getAttribute("data-badge-kind") === "folder") {
        openFolderApps(badge.getAttribute("data-icon-id") || "");
        return;
      }
      const iconId = badge.getAttribute("data-icon-id") || "";
      const label = badge.getAttribute("data-icon-label") || "";
      const app = appForIconId(iconId, label);
      if (app) openRecipients(app);
    }

    function onBadgePointerDown(event) {
      const badge = badgeFromTarget(event.target);
      if (badge) openBadge(badge, event);
    }

    function addBadge(icon, iconId) {
      icon.classList.add("cas-fwd-anchor");
      const labelEl = icon.querySelector(".icon-label");
      const label = labelEl && labelEl.textContent ? String(labelEl.textContent).trim() : "";
      const isFolder = iconId.indexOf("folder:") === 0;

      // 图标本身是 <button>，角标用 span 避免 button 嵌套
      const badge = doc.createElement("span");
      badge.className = "cas-fwd-badge";
      badge.setAttribute("role", "button");
      badge.setAttribute("tabindex", "0");
      badge.setAttribute("aria-label", isFolder ? "转发文件夹里的应用" : "转发应用");
      badge.setAttribute("data-badge-kind", isFolder ? "folder" : "app");
      badge.setAttribute("data-icon-id", iconId);
      badge.setAttribute("data-icon-label", label);
      badge.innerHTML = FORWARD_SVG;

      const stop = (event) => {
        if (event.stopPropagation) event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
      };
      // 直接用 pointerdown 打开：宿主的图标会 setPointerCapture，
      // 等 click 时事件目标已经变成图标，角标永远收不到 click。
      badge.addEventListener("pointerdown", (event) => openBadge(badge, event));
      badge.addEventListener("touchstart", (event) => openBadge(badge, event), { passive: false });
      badge.addEventListener("click", (event) => openBadge(badge, event));
      badge.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") openBadge(badge, event);
      });
      icon.appendChild(badge);
    }

    function syncEditBadges() {
      const editing = Boolean(doc.querySelector(".edit-mode-done"));
      const badges = doc.querySelectorAll(".cas-fwd-badge");
      if (!editing) {
        for (let i = 0; i < badges.length; i += 1) {
          const badge = badges[i];
          const parent = badge.parentNode;
          badge.remove();
          if (parent && parent.classList) parent.classList.remove("cas-fwd-anchor");
        }
        return;
      }
      const icons = doc.querySelectorAll('[data-flip-id^="icon:"]');
      for (let i = 0; i < icons.length; i += 1) {
        const icon = icons[i];
        const flip = icon.getAttribute ? icon.getAttribute("data-flip-id") : "";
        if (!flip || flip.indexOf("icon:") !== 0) continue;
        const iconId = flip.slice(5);
        if (!iconId) continue;
        if (hasBadge(icon)) continue;
        addBadge(icon, iconId);
      }
    }

    const badgeTimer = win.setInterval(() => {
      try { syncEditBadges(); } catch (err) { /* ignore */ }
    }, 600);

    // 整理态里宿主的文件夹点击被禁用了；自己识别一次轻点，打开文件夹里的应用
    let folderPress = null;

    function folderIconFrom(target) {
      let node = target;
      let guard = 0;
      while (node && guard < 12) {
        const flip = node.getAttribute ? node.getAttribute("data-flip-id") : "";
        if (flip && flip.indexOf("icon:folder:") === 0) return { folderId: flip.slice(5) };
        node = node.parentNode;
        guard += 1;
      }
      return null;
    }

    function onFolderPointerDown(event) {
      if (!doc.querySelector(".edit-mode-done")) return;
      if (badgeFromTarget(event.target)) return;
      const folder = folderIconFrom(event.target);
      if (!folder) return;
      folderPress = {
        id: folder.folderId,
        x: event.clientX || 0,
        y: event.clientY || 0,
        time: Date.now(),
      };
    }

    function onFolderPointerMove(event) {
      if (!folderPress) return;
      const dx = (event.clientX || 0) - folderPress.x;
      const dy = (event.clientY || 0) - folderPress.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) folderPress = null;
    }

    function onFolderPointerUp() {
      if (!folderPress) return;
      const press = folderPress;
      folderPress = null;
      if (Date.now() - press.time > 900) return;
      if (!doc.querySelector(".edit-mode-done")) return;
      openFolderApps(press.id);
    }

    function onFolderPointerCancel() { folderPress = null; }

    doc.addEventListener("pointerdown", onFolderPointerDown, true);
    doc.addEventListener("pointermove", onFolderPointerMove, true);
    doc.addEventListener("pointerup", onFolderPointerUp, true);
    doc.addEventListener("pointercancel", onFolderPointerCancel, true);

    // 捕获阶段兜底：宿主的拖拽层如果在捕获阶段截事件，角标自己的监听可能收不到
    doc.addEventListener("pointerdown", onBadgePointerDown, true);
    doc.addEventListener("touchstart", onBadgePointerDown, { capture: true, passive: false });

    const onCustomAppsUpdated = () => { loadCatalog(true); };
    try { window.addEventListener("ai-phone-custom-apps-updated", onCustomAppsUpdated); } catch (err) { /* ignore */ }

    void loadCatalog(false);

    // ── 清理 ──────────────────────────────────────────────
    return () => {
      if (typeof offSlot === "function") offSlot();
      if (typeof offKind === "function") offKind();
      if (typeof offTransform === "function") offTransform();
      if (pickerHandle && typeof pickerHandle.close === "function") {
        try { pickerHandle.close(); } catch (err) { /* ignore */ }
      }
      if (recipientHandle && typeof recipientHandle.close === "function") {
        try { recipientHandle.close(); } catch (err) { /* ignore */ }
      }
      pickerHandle = null;
      recipientHandle = null;
      pickerGen += 1;
      try { win.clearInterval(badgeTimer); } catch (err) { /* ignore */ }
      doc.removeEventListener("pointerdown", onFolderPointerDown, true);
      doc.removeEventListener("pointermove", onFolderPointerMove, true);
      doc.removeEventListener("pointerup", onFolderPointerUp, true);
      doc.removeEventListener("pointercancel", onFolderPointerCancel, true);
      folderPress = null;
      if (folderHandle && typeof folderHandle.close === "function") {
        try { folderHandle.close(); } catch (err) { /* ignore */ }
      }
      folderHandle = null;
      doc.removeEventListener("pointerdown", onBadgePointerDown, true);
      doc.removeEventListener("touchstart", onBadgePointerDown, { capture: true, passive: false });
      const badges = doc.querySelectorAll(".cas-fwd-badge");
      for (let i = 0; i < badges.length; i += 1) {
        const badge = badges[i];
        const parent = badge.parentNode;
        badge.remove();
        if (parent && parent.classList) parent.classList.remove("cas-fwd-anchor");
      }
      try { window.removeEventListener("ai-phone-custom-apps-updated", onCustomAppsUpdated); } catch (err) { /* ignore */ }
    };
  },
};
