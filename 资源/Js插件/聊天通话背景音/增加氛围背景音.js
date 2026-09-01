// 背景噪声层  bg-noise-layer  (apiVersion 1 / ES Module)
// ------------------------------------------------------------------
// 聊天全局背景音 + 通话叠加底噪，两套独立 MP3 音频库，均支持自建分类。
// UI：超级迷你的半透明浅水色悬浮球，可拖拽、松手吸附屏幕两侧并半隐藏，
//     点击弹出控制面板（导入 / 分类 / 选曲 / 音量），点外部收起贴边。
// 通话：检测到通话界面（私聊语音/视频、群语音/视频）自动叠加环境底噪，
//     同时强制暂停聊天背景音；挂断后通话底噪消失、聊天背景音自动续播。
//     通话中顶部出现迷你胶囊，可点按或用键盘快捷键循环切换底噪。
// 混音：底噪走独立 <audio loop>，与宿主 MiniMax TTS 语音由系统自动叠加，
//     音量独立调节，不盖人声。
// 持久化：分类/曲目元数据存 ctx.system.storage；音频 Blob 存 IndexedDB，
//     IndexedDB 不可用时自动降级为 storage 内 base64。

export default {
  manifest: {
    id: "bg-noise-layer",
    name: "背景噪声层",
    apiVersion: 1,
    version: "1.0.0",
    author: "Doubao",
    description: "聊天/通话双模式环境底噪：MP3导入与自建分类、迷你半透明悬浮球、通话自动叠加与挂断自动关闭、快捷键切换、音量可调，与MiniMax语音自然混音",
    settings: [
      { key: "pluginEnabled", label: "显示悬浮球并启用插件", type: "boolean", default: true },
      { key: "autoCall", label: "接通通话时自动叠加环境底噪", type: "boolean", default: true },
      { key: "resumeChat", label: "挂断后自动恢复聊天背景音", type: "boolean", default: true },
      { key: "switchKey", label: "通话中切换底噪的快捷键(单个按键)", type: "text", default: "b" },
      { key: "callSelector", label: "通话界面判定CSS选择器(高级,留空自动识别)", type: "text", default: "" },
    ],
  },

  setup(ctx) {
    // ============================== 基础工具 ==============================
    const uid = () => "bn" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
    const toast = (text, opts) => ctx.ui.toast(text, opts);
    const settings = ctx.system.settings;

    function h(tag, props, ...children) {
      const el = document.createElement(tag);
      if (props) for (const [k, v] of Object.entries(props)) {
        if (v == null) continue;
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k === "html") el.innerHTML = v;
        else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v);
      }
      for (const c of children.flat()) {
        if (c == null || c === false) continue;
        el.append(c.nodeType ? c : document.createTextNode(String(c)));
      }
      return el;
    }

    // ============================== 元数据 ==============================
    const META_KEY = "bg-noise-layer/meta.v1";
    function defaultMeta() {
      return {
        categories: {
          chat: [{ id: "default", name: "默认分类" }],
          call: [{ id: "default", name: "默认分类" }],
        },
        tracks: [],            // {id,name,type:'chat'|'call',categoryId,addedAt}
        chatVol: 0.45,
        callVol: 0.4,
        lastChatId: null,
        lastCallId: null,
        ball: { side: "right", top: 180 },
      };
    }
    let meta = ctx.system.storage.get(META_KEY);
    if (!meta || typeof meta !== "object" || !Array.isArray(meta.tracks)) {
      meta = defaultMeta();
    } else {
      meta.categories = meta.categories || {};
      meta.categories.chat = Array.isArray(meta.categories.chat) ? meta.categories.chat : [{ id: "default", name: "默认分类" }];
      meta.categories.call = Array.isArray(meta.categories.call) ? meta.categories.call : [{ id: "default", name: "默认分类" }];
      meta.chatVol = typeof meta.chatVol === "number" ? meta.chatVol : 0.45;
      meta.callVol = typeof meta.callVol === "number" ? meta.callVol : 0.4;
      meta.ball = meta.ball || { side: "right", top: 180 };
    }
    const saveMeta = () => ctx.system.storage.set(META_KEY, meta);

    // ====================== 音频二进制存储（IDB + 降级） ======================
    let idbPromise = null;
    function idb() {
      if (!idbPromise) idbPromise = new Promise((resolve, reject) => {
        if (!("indexedDB" in window)) return reject(new Error("no-indexeddb"));
        const req = indexedDB.open("bg-noise-layer-db", 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains("audio")) req.result.createObjectStore("audio");
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return idbPromise;
    }
    function idbTx(storeName, mode, fn) {
      return idb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const rq = fn(tx.objectStore(storeName));
        rq.onsuccess = () => { tx.oncomplete = () => resolve(rq.result); };
        rq.onerror = () => reject(rq.error);
      }));
    }
    const blobPut = (k, v) => idbTx("audio", "readwrite", (s) => s.put(v, k));
    const blobGet = (k) => idbTx("audio", "readonly", (s) => s.get(k));
    const blobDel = (k) => idbTx("audio", "readwrite", (s) => s.delete(k));

    const blobToDataURL = (blob) => new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
    function dataURLToBlob(d) {
      const head = d.split(",")[0] || "";
      const mime = (head.match(/data:(.*?);/) || [])[1] || "audio/mpeg";
      const bin = atob(d.split(",")[1] || "");
      const u8 = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      return new Blob([u8], { type: mime });
    }
    async function saveBlob(id, blob) {
      try { await blobPut(id, blob); }
      catch (e) { ctx.system.storage.set("audiodata:" + id, await blobToDataURL(blob)); }
    }
    async function loadBlob(id) {
      try { const b = await blobGet(id); if (b) return b; } catch (e) { /* 走降级 */ }
      const d = ctx.system.storage.get("audiodata:" + id);
      return d ? dataURLToBlob(d) : null;
    }
    async function deleteBlob(id) {
      try { await blobDel(id); } catch (e) { /* ignore */ }
      ctx.system.storage.remove("audiodata:" + id);
    }

    // ============================== 播放引擎 ==============================
    const chatAudio = new Audio();
    const callAudio = new Audio();
    chatAudio.loop = true; callAudio.loop = true;
    chatAudio.preload = "auto"; callAudio.preload = "auto";

    const state = {
      chat: { currentId: null, playing: false },
      call: { currentId: null, playing: false },
      chatSuspendedByCall: false,
      callActive: false,
      panelTab: "chat",
      selectedCat: { chat: "default", call: "default" },
    };
    const urlCache = new Map();
    async function getTrackURL(id) {
      if (urlCache.has(id)) return urlCache.get(id);
      const blob = await loadBlob(id);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urlCache.set(id, url);
      return url;
    }
    const revokeURL = (id) => { if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); } };
    const audioOf = (type) => (type === "chat" ? chatAudio : callAudio);

    // 静默解锁移动端自动播放策略（需一次用户手势，点悬浮球即触发）
    function unlockAudio() {
      [chatAudio, callAudio].forEach((a) => {
        if (a.dataset.unlocked) return;
        a.dataset.unlocked = "1";
        a.muted = true;
        a.play().then(() => { a.pause(); a.muted = false; }).catch(() => { a.muted = false; });
      });
    }

    async function playTrack(type, id) {
      const track = meta.tracks.find((t) => t.id === id);
      if (!track) return false;
      const url = await getTrackURL(id);
      if (!url) { toast("该音频数据丢失，请重新导入"); return false; }
      const a = audioOf(type);
      if (a.src !== url) a.src = url;
      a.volume = type === "chat" ? meta.chatVol : meta.callVol;
      try {
        await a.play();
        state[type].currentId = id;
        state[type].playing = true;
        meta[type === "chat" ? "lastChatId" : "lastCallId"] = id;
        saveMeta();
        renderPanel(); renderCallBar();
        return true;
      } catch (e) {
        state[type].playing = false;
        toast("播放被浏览器拦截，点一下悬浮球后再试");
        renderPanel(); renderCallBar();
        return false;
      }
    }
    function pauseType(type) {
      audioOf(type).pause();
      state[type].playing = false;
      renderPanel(); renderCallBar();
    }
    function resumeType(type) {
      const a = audioOf(type);
      a.play().then(() => { state[type].playing = true; renderPanel(); renderCallBar(); })
        .catch(() => toast("播放被拦截，点一下悬浮球解锁"));
    }
    function stopType(type) {
      const a = audioOf(type);
      a.pause(); a.removeAttribute("src"); a.load();
      state[type].currentId = null; state[type].playing = false;
      renderPanel(); renderCallBar();
    }
    function togglePlay(type, id) {
      if (state[type].currentId === id && state[type].playing) pauseType(type);
      else playTrack(type, id);
    }
    function tracksOf(type) { return meta.tracks.filter((t) => t.type === type); }
    function cycleCall() {
      const list = tracksOf("call");
      if (!list.length) { toast("请先在悬浮球里导入通话音频"); return; }
      let idx = list.findIndex((t) => t.id === state.call.currentId);
      idx = (idx + 1) % list.length;
      playTrack("call", list[idx].id);
    }

    // ============================== 样式 ==============================
    ctx.ui.injectCSS(`
.bgns-root{all:initial}
.bgns-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}
.bgns-ball{position:fixed;z-index:2147483646;width:30px;height:30px;border-radius:50%;
  background:linear-gradient(135deg,rgba(176,226,236,.62),rgba(143,208,223,.5));
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
  box-shadow:0 2px 10px rgba(80,150,170,.25),inset 0 0 0 1px rgba(255,255,255,.35);
  display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:none;
  transition:transform .25s ease,left .25s ease,right .25s ease,opacity .2s}
.bgns-ball:active{opacity:.85}
.bgns-ball.peek-left{transform:translateX(-58%)}
.bgns-ball.peek-right{transform:translateX(58%)}
.bgns-ball svg{display:block;pointer-events:none}
.bgns-panel{position:fixed;z-index:2147483647;width:272px;max-width:calc(100vw - 20px);max-height:66vh;
  border-radius:16px;overflow:hidden;display:none;flex-direction:column;color:#21586a;
  background:rgba(228,245,249,.82);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);
  box-shadow:0 8px 32px rgba(70,140,160,.28),inset 0 0 0 1px rgba(255,255,255,.5);font-size:12.5px}
.bgns-panel.open{display:flex}
.bgns-phead{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid rgba(120,185,205,.25)}
.bgns-ptitle{font-weight:600;font-size:12.5px;margin-right:auto;white-space:nowrap}
.bgns-tab{border:none;outline:none;border-radius:999px;padding:3px 10px;font-size:11.5px;cursor:pointer;
  color:#357083;background:rgba(255,255,255,.45)}
.bgns-tab.active{background:rgba(96,178,201,.6);color:#fff}
.bgns-x{border:none;outline:none;cursor:pointer;color:#357083;background:rgba(255,255,255,.45);
  border-radius:50%;width:20px;height:20px;font-size:11px;line-height:20px;text-align:center;padding:0}
.bgns-now{padding:5px 12px;font-size:11px;color:#4d8598;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bgns-vol{display:flex;align-items:center;gap:7px;padding:4px 12px 6px;font-size:11px;color:#4d8598}
.bgns-vol input[type=range]{flex:1;height:3px;-webkit-appearance:none;appearance:none;background:rgba(96,178,201,.35);border-radius:2px;outline:none}
.bgns-vol input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;
  background:#5fb6cf;border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.15);cursor:pointer}
.bgns-actions{display:flex;gap:6px;padding:0 10px 7px;flex-wrap:wrap}
.bgns-btn{border:none;outline:none;cursor:pointer;border-radius:9px;padding:4px 9px;font-size:11.5px;color:#2b6478;
  background:rgba(255,255,255,.6);box-shadow:inset 0 0 0 1px rgba(120,185,205,.25)}
.bgns-btn:active{background:rgba(190,230,240,.8)}
.bgns-target{padding:0 12px 6px;font-size:10.5px;color:#6a9cab}
.bgns-list{overflow-y:auto;overscroll-behavior:contain;padding:0 8px;flex:1}
.bgns-list::-webkit-scrollbar{width:3px}
.bgns-list::-webkit-scrollbar-thumb{background:rgba(96,178,201,.4);border-radius:2px}
.bgns-cathead{display:flex;align-items:center;gap:6px;padding:6px 6px 3px;margin-top:2px}
.bgns-catname{font-weight:600;font-size:11.5px;color:#2f6b80;border-radius:6px;padding:2px 6px;cursor:pointer;max-width:170px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bgns-catname.sel{background:rgba(96,178,201,.35)}
.bgns-mini{border:none;outline:none;cursor:pointer;border-radius:6px;background:transparent;color:#5a8a99;
  font-size:10.5px;padding:1px 5px}
.bgns-mini:active{background:rgba(255,255,255,.7)}
.bgns-mini.bgns-del{color:#c06a6a}
.bgns-track{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:9px;cursor:pointer;margin-bottom:2px}
.bgns-track:active{background:rgba(255,255,255,.5)}
.bgns-track.on{background:rgba(125,198,216,.42)}
.bgns-tkicon{width:16px;text-align:center;font-size:9px;color:#357083;flex:none}
.bgns-tkname{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bgns-track .bgns-mini{flex:none;opacity:.65}
.bgns-foot{padding:6px 12px 8px;font-size:10.5px;line-height:1.5;color:#6a9cab;border-top:1px solid rgba(120,185,205,.2)}
.bgns-callbar{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483647;display:none;
  align-items:center;gap:5px;padding:4px 8px;border-radius:999px;color:#21586a;font-size:11.5px;
  background:rgba(206,238,245,.8);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);
  box-shadow:0 4px 16px rgba(70,140,160,.25),inset 0 0 0 1px rgba(255,255,255,.5)}
.bgns-callbar.show{display:flex}
.bgns-cb{border:none;outline:none;cursor:pointer;border-radius:999px;width:24px;height:24px;font-size:11px;
  color:#2b6478;background:rgba(255,255,255,.65);line-height:1;padding:0;text-align:center}
.bgns-cbname{max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`);

    // ============================== 悬浮球 ==============================
    const root = h("div", { class: "bgns-root" });
    const ball = h("div", { class: "bgns-ball", title: "背景噪声层", "aria-label": "背景噪声层" });
    ball.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2a6f82" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="10" x2="4" y2="14"/><line x1="9" y1="6" x2="9" y2="18"/><line x1="14" y1="9" x2="14" y2="15"/><line x1="19" y1="4" x2="19" y2="20"/></svg>';

    function placeBall() {
      const top = clamp(meta.ball.top || 180, 8, window.innerHeight - 40);
      meta.ball.top = top;
      ball.style.top = top + "px";
      if (meta.ball.side === "left") { ball.style.left = "6px"; ball.style.right = ""; }
      else { ball.style.right = "6px"; ball.style.left = ""; }
    }
    // 初始贴边半隐藏
    ball.classList.add(meta.ball.side === "left" ? "peek-left" : "peek-right");

    // 拖拽 / 点击
    let drag = null;
    ball.addEventListener("pointerdown", (e) => {
      unlockAudio();
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
      ball.setPointerCapture(e.pointerId);
    });
    ball.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved) {
        ball.classList.remove("peek-left", "peek-right");
        ball.style.left = clamp(e.clientX - 15, 0, window.innerWidth - 30) + "px";
        ball.style.right = "auto";
        ball.style.top = clamp(e.clientY - 15, 0, window.innerHeight - 30) + "px";
      }
    });
    ball.addEventListener("pointerup", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const wasDrag = drag.moved;
      drag = null;
      if (!wasDrag) { togglePanel(); return; }
      const r = ball.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      meta.ball.side = cx < window.innerWidth / 2 ? "left" : "right";
      meta.ball.top = clamp(r.top, 8, window.innerHeight - 40);
      saveMeta(); placeBall();
      if (panel.classList.contains("open")) placePanel();
    });

    // ============================== 控制面板 ==============================
    const tabChatBtn = h("button", { class: "bgns-tab", onclick: () => { state.panelTab = "chat"; renderPanel(); } }, "聊天");
    const tabCallBtn = h("button", { class: "bgns-tab", onclick: () => { state.panelTab = "call"; renderPanel(); } }, "通话");
    const nowEl = h("div", { class: "bgns-now" }, "未在播放");
    const volRange = h("input", { type: "range", min: "0", max: "100", value: "45" });
    volRange.addEventListener("input", () => {
      const v = Number(volRange.value) / 100;
      const type = state.panelTab;
      if (type === "chat") { meta.chatVol = v; chatAudio.volume = v; }
      else { meta.callVol = v; callAudio.volume = v; }
      saveMeta();
    });
    const targetLabel = h("div", { class: "bgns-target" });
    const listEl = h("div", { class: "bgns-list" });
    const footEl = h("div", { class: "bgns-foot" });

    const fileInput = h("input", { type: "file", accept: "audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac,.opus", multiple: true, style: "display:none" });
    fileInput.addEventListener("change", async () => {
      const files = Array.from(fileInput.files || []);
      fileInput.value = "";
      if (files.length) importFiles(files);
    });

    const panel = h("div", { class: "bgns-panel" },
      h("div", { class: "bgns-phead" },
        h("span", { class: "bgns-ptitle" }, "背景噪声层"),
        tabChatBtn, tabCallBtn,
        h("button", { class: "bgns-x", onclick: closePanel, title: "收起贴边" }, "×"),
      ),
      nowEl,
      h("div", { class: "bgns-vol" }, "音量", volRange, h("span", { id: "bgns-volpct" })),
      h("div", { class: "bgns-actions" },
        h("button", { class: "bgns-btn", onclick: () => fileInput.click() }, "＋ 导入音频"),
        h("button", { class: "bgns-btn", onclick: () => addCategory(state.panelTab) }, "＋ 新分类"),
        h("button", { class: "bgns-btn", onclick: () => stopType(state.panelTab) }, "■ 停止"),
      ),
      targetLabel,
      listEl,
      footEl,
    );

    function currentCatName() {
      const type = state.panelTab;
      let catId = state.selectedCat[type];
      if (!meta.categories[type].some((c) => c.id === catId)) { catId = "default"; state.selectedCat[type] = "default"; }
      const c = meta.categories[type].find((x) => x.id === catId);
      return c ? c.name : "默认分类";
    }

    function trackRow(type, t) {
      const on = state[type].currentId === t.id && state[type].playing;
      const del = h("button", { class: "bgns-mini bgns-del", title: "删除音频", onclick: (e) => { e.stopPropagation(); removeTrack(t.id); } }, "✕");
      return h("div", { class: "bgns-track" + (on ? " on" : ""), onclick: () => togglePlay(type, t.id) },
        h("span", { class: "bgns-tkicon" }, on ? "❚❚" : "▶"),
        h("span", { class: "bgns-tkname", title: t.name }, t.name),
        del,
      );
    }

    function renderPanel() {
      const type = state.panelTab;
      tabChatBtn.classList.toggle("active", type === "chat");
      tabCallBtn.classList.toggle("active", type === "call");
      const vol = type === "chat" ? meta.chatVol : meta.callVol;
      volRange.value = String(Math.round(vol * 100));
      const pct = panel.querySelector("#bgns-volpct");
      if (pct) pct.textContent = Math.round(vol * 100) + "%";
      targetLabel.textContent = "新音频将导入到：「" + currentCatName() + "」（点分类名切换）";
      const cur = meta.tracks.find((x) => x.id === state[type].currentId);
      nowEl.textContent = state[type].playing && cur
        ? "正在播放：" + cur.name
        : (type === "call" && state.callActive ? "通话中，底噪待机" : "未在播放");
      footEl.textContent = type === "chat"
        ? "聊天背景音在全界面持续播放；接通通话时自动暂停，挂断后续播。"
        : "通话接通后自动叠加、挂断自动关闭；通话中可按快捷键「" +
          (String(settings.get("switchKey") || "b").toUpperCase()) + "」或顶部胶囊切换。";

      listEl.innerHTML = "";
      let total = 0;
      meta.categories[type].forEach((cat) => {
        const tracks = meta.tracks.filter((t) => t.categoryId === cat.id && t.type === type);
        total += tracks.length;
        const sel = state.selectedCat[type] === cat.id;
        listEl.append(
          h("div", { class: "bgns-cathead" },
            h("span", { class: "bgns-catname" + (sel ? " sel" : ""), title: "设为导入目标", onclick: () => { state.selectedCat[type] = cat.id; renderPanel(); } },
              cat.name + " (" + tracks.length + ")"),
            h("button", { class: "bgns-mini", title: "重命名", onclick: () => renameCategory(type, cat.id) }, "改名"),
            cat.id === "default" ? null : h("button", { class: "bgns-mini bgns-del", title: "删除分类", onclick: () => removeCategory(type, cat.id) }, "删类"),
          ),
        );
        tracks.forEach((t) => listEl.append(trackRow(type, t)));
      });
      // 分类被删后的孤儿曲目归到默认分类展示
      const known = new Set(meta.categories[type].map((c) => c.id));
      const orphan = meta.tracks.filter((t) => t.type === type && !known.has(t.categoryId));
      orphan.forEach((t) => listEl.append(trackRow(type, t)));
      if (total + orphan.length === 0) {
        listEl.append(h("div", { style: "padding:14px 8px;text-align:center;color:#7aa5b3;line-height:1.7" },
          (type === "chat" ? "还没有聊天背景音，" : "还没有通话底噪，") + "点上方「导入音频」添加 MP3"));
      }
    }

    function placePanel() {
      const r = ball.getBoundingClientRect();
      panel.style.top = clamp(r.top - 4, 8, Math.max(8, window.innerHeight - 300)) + "px";
      panel.style.left = ""; panel.style.right = "";
      panel.style[meta.ball.side === "left" ? "left" : "right"] = "10px";
    }
    function openPanel() {
      ball.classList.remove("peek-left", "peek-right");
      placePanel();
      panel.classList.add("open");
      renderPanel();
    }
    function closePanel() {
      panel.classList.remove("open");
      ball.classList.add(meta.ball.side === "left" ? "peek-left" : "peek-right");
    }
    function togglePanel() { panel.classList.contains("open") ? closePanel() : openPanel(); }

    // 点面板/悬浮球/胶囊之外 → 收起贴边
    function onDocPointerDown(e) {
      if (!panel.classList.contains("open")) return;
      if (panel.contains(e.target) || ball.contains(e.target) || callBar.contains(e.target)) return;
      closePanel();
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);

    // ============================== 导入 / 分类管理 ==============================
    async function importFiles(files) {
      const type = state.panelTab;
      let catId = state.selectedCat[type];
      if (!meta.categories[type].some((c) => c.id === catId)) catId = "default";
      const loading = toast("导入中…", { durationMs: 0 });
      let n = 0;
      try {
        for (const f of files) {
          const okType = /^audio\//.test(f.type) || /\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|amr|webm)$/i.test(f.name);
          if (!okType) continue;
          const id = uid();
          const mime = f.type || "audio/mpeg";
          await saveBlob(id, f.slice(0, f.size, mime));
          meta.tracks.push({
            id,
            name: f.name.replace(/\.[^.]+$/, "").slice(0, 60) || "未命名音频",
            type, categoryId: catId, addedAt: Date.now(),
          });
          n++;
        }
        saveMeta(); renderPanel();
      } finally { loading.close(); }
      toast(n ? "已导入 " + n + " 个音频到「" + currentCatName() + "」" : "没有可导入的音频文件");
    }
    function safePrompt(label, value) {
      try { return window.prompt(label, value); } catch (e) { return null; }
    }
    function safeConfirm(text) {
      try { return window.confirm(text); } catch (e) { return false; }
    }
    function addCategory(type) {
      const name = safePrompt("新分类名字（如：雨声 / 咖啡馆 / 地铁人群）", "");
      if (!name || !name.trim()) return;
      const id = uid();
      meta.categories[type].push({ id, name: name.trim().slice(0, 20) });
      state.selectedCat[type] = id;
      saveMeta(); renderPanel();
    }
    function renameCategory(type, id) {
      const c = meta.categories[type].find((x) => x.id === id);
      if (!c) return;
      const name = safePrompt("重命名分类", c.name);
      if (!name || !name.trim()) return;
      c.name = name.trim().slice(0, 20);
      saveMeta(); renderPanel();
    }
    function removeCategory(type, id) {
      if (id === "default") return;
      if (!safeConfirm("删除该分类？分类内音频会移到「默认分类」，不会删除音频文件。")) return;
      meta.categories[type] = meta.categories[type].filter((c) => c.id !== id);
      meta.tracks.forEach((t) => { if (t.type === type && t.categoryId === id) t.categoryId = "default"; });
      if (state.selectedCat[type] === id) state.selectedCat[type] = "default";
      saveMeta(); renderPanel();
    }
    async function removeTrack(id) {
      if (!safeConfirm("删除这个音频？此操作不可恢复。")) return;
      meta.tracks = meta.tracks.filter((t) => t.id !== id);
      revokeURL(id);
      await deleteBlob(id);
      ["chat", "call"].forEach((tp) => { if (state[tp].currentId === id) stopType(tp); });
      saveMeta(); renderPanel();
    }

    // ============================== 通话快捷胶囊 ==============================
    const cbName = h("span", { class: "bgns-cbname" }, "未开启底噪");
    const cbPP = h("button", { class: "bgns-cb", title: "播放/暂停" });
    const callBar = h("div", { class: "bgns-callbar" },
      h("button", { class: "bgns-cb", title: "切换下一个底噪", onclick: cycleCall }, "⇄"),
      cbName, cbPP,
      h("button", { class: "bgns-cb", title: "关闭底噪", onclick: () => stopType("call") }, "■"),
    );
    function renderCallBar() {
      if (!state.callActive) { callBar.classList.remove("show"); return; }
      callBar.classList.add("show");
      const t = meta.tracks.find((x) => x.id === state.call.currentId);
      cbName.textContent = state.call.playing && t ? t.name : (t ? t.name + "（已暂停）" : "点 ⇄ 开启底噪");
      cbPP.textContent = state.call.playing ? "❚❚" : "▶";
    }
    cbPP.addEventListener("click", () => {
      if (state.call.playing) return pauseType("call");
      if (state.call.currentId) return resumeType("call");
      const list = tracksOf("call");
      if (!list.length) return toast("请先点悬浮球导入通话音频");
      const prefer = meta.lastCallId && list.some((t) => t.id === meta.lastCallId) ? meta.lastCallId : list[0].id;
      playTrack("call", prefer);
    });

    // 键盘快捷键（输入框中不触发）
    function onKeydown(e) {
      if (!state.callActive || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target && e.target.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
      const key = String(settings.get("switchKey") || "b").trim().toLowerCase();
      if (key && e.key && e.key.toLowerCase() === key) { e.preventDefault(); cycleCall(); }
    }
    document.addEventListener("keydown", onKeydown, true);

    // ============================== 通话状态检测 ==============================
    // 主特征：宿主通话界面（私聊语音/视频、群语音/视频）根元素带 call-keyboard-shift 类
    // 双保险：可见的“挂断”类按钮 + 用户自定义高级选择器
    function isVisible(el) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
    }
    function detectCallUI() {
      const custom = String(settings.get("callSelector") || "").trim();
      if (custom) { try { const el = document.querySelector(custom); if (el && isVisible(el)) return true; } catch (e) { /* 选择器非法时忽略 */ } }
      if (document.querySelector('[class*="call-keyboard-shift"]')) return true;
      // 双保险：可见的挂断类按钮（文本/aria-label/class 三种特征，class 用 JS 匹配以兼容旧 webview）
      const btns = document.querySelectorAll('button,[role="button"],[aria-label]');
      for (const b of btns) {
        if (!isVisible(b)) continue;
        const label = ((b.getAttribute && b.getAttribute("aria-label")) || b.textContent || "").trim();
        if (label && label.length <= 8 && /(挂断|结束通话|结束呼叫|hang\s?up|end\s?call)/i.test(label)) return true;
        const cls = (typeof b.className === "string" ? b.className : "") + " " +
          (b.getAttribute && b.getAttribute("data-testid") || "");
        if (/hang[-_]?up|end[-_]?call|reject[-_]?call/i.test(cls)) return true;
      }
      return false;
    }

    function onCallStart() {
      // 1) 强制暂停聊天背景音（记住状态，挂断续播）
      if (!chatAudio.paused || state.chat.playing) {
        state.chatSuspendedByCall = true;
        chatAudio.pause();
        state.chat.playing = false;
      }
      renderCallBar(); renderPanel();
      // 2) 自动叠加通话底噪
      if (settings.get("autoCall") === false) return;
      const list = tracksOf("call");
      if (!list.length) return;
      let pick = meta.lastCallId;
      if (!pick || !list.some((t) => t.id === pick)) pick = list[Math.floor(Math.random() * list.length)].id;
      playTrack("call", pick);
    }
    function onCallEnd() {
      // 1) 通话底噪消失
      stopType("call");
      callBar.classList.remove("show");
      // 2) 聊天背景音续播
      const wasSuspended = state.chatSuspendedByCall;
      state.chatSuspendedByCall = false;
      if (wasSuspended && settings.get("resumeChat") !== false && meta.lastChatId) {
        const t = meta.tracks.find((x) => x.id === meta.lastChatId);
        if (t) playTrack("chat", meta.lastChatId);
      }
      renderPanel();
    }
    function syncCallState() {
      if (settings.get("pluginEnabled") === false) return;
      const active = !!detectCallUI();
      if (active === state.callActive) return;
      state.callActive = active;
      if (active) onCallStart(); else onCallEnd();
    }
    let lastMOCheck = 0;
    const mo = new MutationObserver(() => {
      const now = Date.now();
      if (now - lastMOCheck < 250) return;
      lastMOCheck = now;
      syncCallState();
    });
    const poll = ctx.system.timers.setInterval(syncCallState, 1000);

    // ============================== 设置联动 ==============================
    const offSettings = settings.onChange(() => {
      const on = settings.get("pluginEnabled") !== false;
      root.style.display = on ? "" : "none";
      if (!on) {
        chatAudio.pause(); callAudio.pause();
        state.chat.playing = false; state.call.playing = false;
        callBar.classList.remove("show");
        panel.classList.remove("open");
      } else {
        syncCallState();
      }
    });

    // ============================== 挂载 / 启动 ==============================
    function mount() {
      if (!document.body || root.isConnected) return;
      root.append(ball, panel, callBar, fileInput);
      document.body.appendChild(root);
      placeBall();
      renderPanel();
      mo.observe(document.body, { childList: true, subtree: true });
      syncCallState();
      if (settings.get("pluginEnabled") === false) root.style.display = "none";
    }
    if (document.body) mount();
    else ctx.hooks.on("app.ready", mount);
    window.addEventListener("resize", () => { placeBall(); if (panel.classList.contains("open")) placePanel(); });

    // ============================== 清理 ==============================
    return () => {
      mo.disconnect();
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKeydown, true);
      if (offSettings) try { offSettings(); } catch (e) { /* ignore */ }
      root.remove();
      [chatAudio, callAudio].forEach((a) => { a.pause(); a.removeAttribute("src"); a.load(); });
      urlCache.forEach((u) => URL.revokeObjectURL(u));
      urlCache.clear();
    };
  },
};
