// ============================================================================
// MiniMax 语音导出 & 通话录音缓存  v5.0.0（ES Module / apiVersion 1）
// ----------------------------------------------------------------------------
// 功能：
//  1. 聊天语音：消息落库/更新自动抓取 + 定时扫描补抓 + 长按菜单「导出此条语音」
//  2. 通话录音：网络层实时嗅探 MiniMax t2a_v2（hex 音频）/ OpenAI audio/speech /
//     任意 audio/* 响应，通话中边说边缓存，挂断后、退出浏览器重进仍可回放
//  3. 悬浮窗：浅水蓝色，贴边竖条可拖拽，点击弹出小面板，再点收起，尺寸紧凑
//  4. 面板内每条语音可在线播放、单条下载 MP3；多选后可逐个下载或打包 ZIP
//  5. 全部音频字节存 IndexedDB（meta/blob 双 store），重开浏览器不丢
// ============================================================================
export default {
  manifest: {
    id: "minimax-voice-exporter",
    name: "MiniMax语音导出与通话录音缓存",
    apiVersion: 1,
    version: "5.0.0",
    author: "custom",
    description: "自动抓取聊天/通话中的MiniMax语音并持久化缓存，悬浮窗内播放、单条/批量导出MP3，挂断后与重开浏览器均可回放",
    permissions: ["chat.read"],
    settings: [
      { key: "autoCapture", label: "自动抓取新语音消息", type: "boolean", default: true },
      { key: "sniffNetwork", label: "网络层实时嗅探通话音频(挂断前缓存)", type: "boolean", default: true },
      { key: "denseScan", label: "通话中密集扫描补抓(4秒/次)", type: "boolean", default: true },
      { key: "startupScan", label: "启动时扫描全部会话补抓历史语音", type: "boolean", default: true },
      { key: "filenameWithText", label: "导出文件名带台词前缀", type: "boolean", default: true },
    ],
  },

  setup(ctx) {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // ──────────────────────────── 基础工具 ────────────────────────────
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const pad2 = (n) => String(n).padStart(2, "0");
    function setting(key, def) {
      try { const v = ctx.system.settings.get(key); return v == null ? def : v; }
      catch (e) { return def; }
    }
    async function prefGet(k, d) {
      try { const v = ctx.system.storage.get(k); const r = v && typeof v.then === "function" ? await v : v; return r == null ? d : r; }
      catch (e) { return d; }
    }
    async function prefSet(k, v) {
      try { const r = ctx.system.storage.set(k, v); if (r && typeof r.then === "function") await r; } catch (e) { /* 忽略 */ }
    }
    function h(tag, attrs, children) {
      const el = document.createElement(tag);
      if (attrs) {
        for (const k in attrs) {
          const v = attrs[k];
          if (v == null || v === false) continue;
          if (k === "class") el.className = v;
          else if (k === "style") el.style.cssText = v;
          else if (k === "text") el.textContent = v;
          else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
          else if (k === "checked") el.checked = !!v;
          else el.setAttribute(k, v);
        }
      }
      if (children != null) {
        (Array.isArray(children) ? children : [children]).forEach((c) => {
          if (c == null || c === false) return;
          el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
        });
      }
      return el;
    }
    // 语音波形图标（SVG，currentColor 随父级颜色）
    function iconWave(px) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", String(px));
      svg.setAttribute("height", String(px));
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("aria-hidden", "true");
      const bars = [[3, 5], [6.6, 10], [10.2, 16], [13.8, 10], [17.4, 5]];
      bars.forEach(([x, bh]) => {
        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", String(x));
        r.setAttribute("y", String(12 - bh / 2));
        r.setAttribute("width", "2.6");
        r.setAttribute("height", String(bh));
        r.setAttribute("rx", "1.3");
        svg.appendChild(r);
      });
      return svg;
    }
    function mimeToExt(mime) {
      const m = String(mime || "").toLowerCase();
      if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
      if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
      if (m.includes("webm")) return "webm";
      if (m.includes("ogg") || m.includes("opus")) return "ogg";
      if (m.includes("wav") || m.includes("wave")) return "wav";
      if (m.includes("flac")) return "flac";
      if (m.includes("amr")) return "amr";
      return "mp3";
    }
    function extFromUrl(url) {
      const m = String(url || "").toLowerCase().split("?")[0].match(/\.(mp3|m4a|aac|ogg|oga|opus|wav|webm|flac|amr)(?:#|$)/);
      return m ? m[1] : "";
    }
    function msgTime(msg) {
      for (const k of ["createdAt", "createTime", "timestamp", "time", "sentAt", "date"]) {
        const v = msg[k];
        if (typeof v === "number" && v > 0) return v > 1e12 ? v : v * 1000;
        if (typeof v === "string" && !isNaN(Date.parse(v))) return Date.parse(v);
      }
      return Date.now();
    }
    function fmtTime(ts) {
      if (!ts) return "";
      const d = new Date(ts), now = new Date();
      const hm = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
      const md = pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
      return (d.getFullYear() !== now.getFullYear() ? d.getFullYear() + "-" : "") + md + " " + hm;
    }
    function fmtDur(s) {
      if (s == null || !isFinite(s) || s <= 0) return "";
      return Math.floor(s / 60) + ":" + pad2(Math.round(s % 60));
    }
    function fmtSize(n) {
      if (!n) return "";
      if (n < 1024 * 1024) return (n / 1024).toFixed(0) + "KB";
      return (n / 1024 / 1024).toFixed(1) + "MB";
    }
    function sanitize(s, max) {
      return String(s || "").replace(/[\\/:*?"<>|\r\n\t]+/g, "_").replace(/\s+/g, "").replace(/^_+|_+$/g, "").slice(0, max || 20);
    }
    function hashStr(s) {
      let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
      for (let i = 0; i < s.length; i++) {
        const ch = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
    }
    function crc32(u8) {
      let c = 0xFFFFFFFF;
      for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    }
    const CRC_TABLE = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
      }
      return t;
    })();

    // ──────────────────────────── 状态 ────────────────────────────
    const state = {
      open: false,
      filter: "all",          // all | current
      selectMode: false,
      selected: new Set(),
      scanning: false,
      currentSessionId: null,
      list: [],
    };
    let inCall = false;
    let callKeepUntil = 0;
    let seqNet = 0;
    const netSeen = new Map();

    // ─────────────────────── IndexedDB 持久层 ───────────────────────
    // meta store 只存元数据（列表渲染轻量），blob store 存音频字节；
    // IndexedDB 不可用时自动降级为内存库（当次可用）。
    const mem = new Map();
    let idbAlive = true;
    let idbPromise = null;
    function openDB() {
      if (idbPromise) return idbPromise;
      idbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") { reject(new Error("no-indexeddb")); return; }
        const req = indexedDB.open("mmx_voice_exporter_v5", 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (!d.objectStoreNames.contains("meta")) {
            const os = d.createObjectStore("meta", { keyPath: "id" });
            os.createIndex("sessionId", "sessionId", { unique: false });
            os.createIndex("createdAt", "createdAt", { unique: false });
          }
          if (!d.objectStoreNames.contains("blob")) d.createObjectStore("blob", { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => { idbPromise = null; reject(req.error); };
      }).catch((e) => { idbPromise = null; throw e; });
      return idbPromise;
    }
    function idbTx(stores, mode, worker) {
      return openDB().then((d) => new Promise((resolve, reject) => {
        const t = d.transaction(stores, mode);
        let out;
        Promise.resolve().then(() => worker(t)).then((r) => { out = r; }).catch(reject);
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }));
    }
    const idbPutMeta = (m) => idbTx("meta", "readwrite", (t) => t.objectStore("meta").put(m));
    const idbPutBlob = (id, blob) => idbTx("blob", "readwrite", (t) => t.objectStore("blob").put({ id, blob }));
    const idbAllMeta = () => idbTx("meta", "readonly", (t) => new Promise((res, rej) => {
      const r = t.objectStore("meta").getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    }));
    const idbGetBlob = (id) => idbTx("blob", "readonly", (t) => new Promise((res, rej) => {
      const r = t.objectStore("blob").get(id);
      r.onsuccess = () => res(r.result ? r.result.blob : null);
      r.onerror = () => rej(r.error);
    }));
    function idbDelete(id) {
      return idbTx(["meta", "blob"], "readwrite", (t) => {
        t.objectStore("meta").delete(id);
        t.objectStore("blob").delete(id);
      });
    }
    function idbClear() {
      return idbTx(["meta", "blob"], "readwrite", (t) => {
        t.objectStore("meta").clear();
        t.objectStore("blob").clear();
      });
    }

    const voiceStore = {
      async save(meta, blob) {
        mem.set(meta.id, meta);
        if (idbAlive) {
          try { await idbPutMeta(meta); await idbPutBlob(meta.id, blob); }
          catch (e) {
            idbAlive = false;
            ctx.system.log("[语音缓存] IndexedDB 不可用，降级为内存存储", e);
            mem.get(meta.id)._blob = blob;
          }
        } else {
          mem.get(meta.id)._blob = blob;
        }
      },
      async loadAll() {
        try {
          const arr = await idbAllMeta();
          arr.forEach((m) => mem.set(m.id, m));
          return arr;
        } catch (e) {
          idbAlive = false;
          return [...mem.values()];
        }
      },
      async getBlob(id) {
        if (!idbAlive) { const m = mem.get(id); return m ? m._blob || null : null; }
        try { return await idbGetBlob(id); } catch (e) { return null; }
      },
      async remove(id) {
        mem.delete(id);
        if (idbAlive) { try { await idbDelete(id); } catch (e) { /* 忽略 */ } }
      },
      async clear() {
        mem.clear();
        if (idbAlive) { try { await idbClear(); } catch (e) { /* 忽略 */ } }
      },
      has(id) { return mem.has(id); },
      get(id) { return mem.get(id); },
      count() { return mem.size; },
    };

    // 播放用 ObjectURL 缓存（面板关闭时统一释放）
    const urlCache = new Map();
    async function objectUrl(id) {
      if (urlCache.has(id)) return urlCache.get(id);
      const blob = await voiceStore.getBlob(id);
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      urlCache.set(id, url);
      return url;
    }
    function releaseAllUrls() {
      urlCache.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) { /* 忽略 */ } });
      urlCache.clear();
    }

    // ─────────────────────── 会话/联系人信息 ───────────────────────
    let contactCache = null, contactCacheAt = 0;
    function contactName(cid) {
      if (!cid) return "";
      try {
        if (!contactCache || Date.now() - contactCacheAt > 60000) {
          contactCache = ctx.data.contacts.list() || [];
          contactCacheAt = Date.now();
        }
        const c = contactCache.find((x) => x.id === cid || x.contactId === cid);
        return c ? (c.name || c.nickname || c.remark || c.displayName || "") : "";
      } catch (e) { return ""; }
    }
    function sessionOf(sid) {
      try { return ctx.data.sessions.get(sid) || null; } catch (e) { return null; }
    }
    function sessionTitle(sid, session) {
      const s = session || sessionOf(sid);
      if (s) {
        const t = s.title || s.name || s.displayName || contactName(s.contactId);
        if (t) return String(t);
      }
      return sid ? "会话" + String(sid).slice(-4) : "未知会话";
    }
    function findMessage(sid, id) {
      try { return (ctx.data.messages.list(sid) || []).find((m) => m.id === id) || null; }
      catch (e) { return null; }
    }

    // 消息是否可能携带音频媒体：
    //  - 宿主实测语音消息 mediaType==="audio"；同时兼容 voice/tts/audio-record 等形态
    //  - 两层深度 BFS，找 mediastore:// 引用、音频 URL、音频字段名，避免漏掉嵌套存放的语音
    const AUDIO_TYPE_RE = /^(audio|voice|tts|speech|record|audiomessage|voice-message)$/i;
    const AUDIO_URL_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|webm|amr|flac)(\?|#|$)/i;
    const AUDIO_KEY_RE = /(audio|voice|tts|speech|record|sound|media)/i;
    function looksLikeMedia(msg) {
      if (!msg || typeof msg !== "object") return false;
      for (const k of ["mediaType", "category", "type", "kind"]) {
        if (typeof msg[k] === "string" && AUDIO_TYPE_RE.test(msg[k])) return true;
      }
      const seen = new Set();
      const queue = [[msg, 0]];
      while (queue.length) {
        const [obj, depth] = queue.shift();
        if (!obj || typeof obj !== "object" || seen.has(obj)) continue;
        seen.add(obj);
        let keys;
        try { keys = Object.keys(obj); } catch (e) { continue; }
        for (const k of keys) {
          let v;
          try { v = obj[k]; } catch (e) { continue; }
          if (v == null) continue;
          if (typeof v === "string") {
            if (v.indexOf("mediastore://") === 0 || v.indexOf("blob:") === 0 || v.indexOf("data:audio") === 0) return true;
            if (AUDIO_URL_RE.test(v)) return true;
            if (depth <= 2 && AUDIO_KEY_RE.test(k) && /^(https?:\/\/|mediastore:\/\/|blob:)/.test(v)) return true;
          } else if (typeof v === "object" && depth < 2) {
            queue.push([v, depth + 1]);
          }
        }
      }
      return false;
    }
    function detectCall(msg) {
      if (!msg) return false;
      if (msg.isCall === true || msg.callId || msg.voiceCallId) return true;
      for (const k of ["type", "mediaType", "category", "callType"]) {
        const v = msg[k];
        if (typeof v === "string" && /call|通话/.test(v)) return true;
      }
      return false;
    }
    function msgText(msg) {
      return String(
        msg.content ||
        (msg.mediaData && (msg.mediaData.synthesizedFromText || msg.mediaData.text)) ||
        msg.text || ""
      ).trim();
    }
    function isCallUiActive() {
      try { return !!document.querySelector('[class*="call-keyboard-shift"]'); } catch (e) { return false; }
    }
    function refreshCallFlag() {
      if (isCallUiActive()) { inCall = true; callKeepUntil = Date.now() + 15000; }
      else if (inCall && Date.now() > callKeepUntil) inCall = false;
    }

    // ──────────────────────────── 抓取核心 ────────────────────────────
    const vidOf = (sid, mid) => String(sid || "nosid") + "::" + String(mid);
    async function captureMessage(sessionId, msg, force) {
      if (!msg || msg.id == null) return false;
      const sid = sessionId || msg.sessionId || state.currentSessionId;
      if (!sid) return false;
      const vid = vidOf(sid, msg.id);
      try {
        const resolved = await ctx.data.messages.resolveMedia(msg);
        if (!resolved || resolved.category !== "audio") return false;
        const blob = resolved.blob;
        if (!blob || blob.size < 32) return false;
        const prev = voiceStore.get(vid);
        // 同一条消息只在「强制」或「新版本更大（录音变长）」时覆盖
        if (!force && prev && prev.size >= blob.size) return false;
        if (prev && !force && prev.size < blob.size) force = true;
        const mime = blob.type || resolved.mimeType || "audio/mpeg";
        const meta = {
          id: vid,
          messageId: String(msg.id),
          sessionId: sid,
          sessionTitle: sessionTitle(sid),
          role: msg.role || (msg.from === "user" ? "user" : "assistant"),
          text: msgText(msg).slice(0, 120),
          mimeType: mime,
          ext: mimeToExt(mime),
          size: blob.size,
          createdAt: msgTime(msg),
          capturedAt: Date.now(),
          isCall: detectCall(msg) || inCall,
          source: "message",
          duration: prev && prev.duration ? prev.duration : null,
        };
        await voiceStore.save(meta, blob);
        scheduleRender();
        return true;
      } catch (e) {
        ctx.system.log("[语音缓存] 抓取消息语音失败", vid, e);
        return false;
      }
    }
    // opts.full=true 时遍历该会话全部消息；否则只扫尾部 limit 条（定时任务用，省开销）
    async function scanSession(sessionId, opts) {
      const stat = { added: 0, scanned: 0, candidates: 0 };
      if (!sessionId) return stat;
      let msgs;
      try { msgs = ctx.data.messages.list(sessionId); } catch (e) { return stat; }
      if (!Array.isArray(msgs) || !msgs.length) return stat;
      const full = opts && opts.full;
      const target = full ? msgs : msgs.slice(-((opts && opts.limit) || 60));
      stat.scanned = target.length;
      for (const msg of target) {
        if (!looksLikeMedia(msg)) continue;
        stat.candidates++;
        if (voiceStore.has(vidOf(sessionId, msg.id))) continue;
        if (await captureMessage(sessionId, msg, false)) stat.added++;
      }
      return stat;
    }
    async function scanCurrent(full) {
      if (!state.currentSessionId) return { added: 0, scanned: 0, candidates: 0 };
      return scanSession(state.currentSessionId, full ? { full: true } : { limit: 24 });
    }
    // 全量扫描所有会话；onProgress 每完成一个会话回调一次
    async function scanAll(opts) {
      const full = opts && opts.full;
      const onProgress = opts && opts.onProgress;
      let sessions = [];
      try { sessions = ctx.data.sessions.list() || []; } catch (e) { sessions = []; }
      const total = sessions.length;
      const agg = { added: 0, scanned: 0, candidates: 0, sessions: total };
      let i = 0;
      for (const s of sessions) {
        const sid = s.id || s.sessionId;
        i++;
        if (sid) {
          try {
            const r = await scanSession(sid, full ? { full: true } : { limit: (opts && opts.limit) || 50 });
            agg.added += r.added; agg.scanned += r.scanned; agg.candidates += r.candidates;
          } catch (e) { /* 单会话失败跳过 */ }
        }
        if (onProgress) { try { onProgress({ i, total, added: agg.added, scanned: agg.scanned }); } catch (e) { /* 忽略 */ } }
        await sleep(full ? 15 : 40);
      }
      // sessions.list 为空（宿主尚未就绪）时兜底扫当前会话
      if (!total && state.currentSessionId) {
        const r = await scanSession(state.currentSessionId, { full: true });
        agg.added += r.added; agg.scanned += r.scanned; agg.candidates += r.candidates;
      }
      return agg;
    }

    // ────────── 网络层嗅探（MiniMax t2a_v2 / OpenAI speech / audio/*）──────────
    let origFetch = null, origXhrOpen = null, origXhrSend = null;
    function looksAudioNet(ct, url) {
      ct = String(ct || "").toLowerCase();
      if (ct.indexOf("audio/") === 0) return true;
      const u = String(url || "").toLowerCase().split("?")[0];
      if (/\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|amr)(?:#|$)/.test(u)) return true;
      if (/\.webm(?:#|$)/.test(u) && /audio|voice|tts|speech|call|talk/.test(u)) return true;
      if (!ct && /(audio|voice|tts|speech|synthes|call|talk)/.test(u)) return true;
      return false;
    }
    function hexToBlob(hex) {
      const clean = String(hex).replace(/\s+/g, "");
      if (!clean || clean.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(clean.slice(0, 2048))) return null;
      const bytes = new Uint8Array(clean.length / 2);
      for (let i = 0; i < clean.length; i += 2) bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
      return new Blob([bytes], { type: "audio/mpeg" });
    }
    function extractRequestBodyText(init) {
      try {
        const bodyStr = init && init.body ? String(init.body) : "";
        if (!bodyStr || bodyStr.charAt(0) !== "{") return "";
        const o = JSON.parse(bodyStr);
        const t = o.text != null ? o.text : (o.input != null ? o.input : "");
        return Array.isArray(t) ? t.map((x) => (typeof x === "string" ? x : x && x.text || "")).join(" ") : String(t || "");
      } catch (e) { return ""; }
    }
    async function saveNetworkBlob(blob, url, reqText, sourceTag) {
      if (!blob || blob.size < 32) return;
      const bytes = new Uint8Array(await blob.slice(0, Math.min(blob.size, 65536)).arrayBuffer());
      const fingerprint = crc32(bytes).toString(16) + "-" + blob.size;
      // 同指纹 60 秒内视为请求重试/分片重复，丢弃；超过 60 秒视为又说了相同的话，照常保留
      const now0 = Date.now();
      if (netSeen.has(fingerprint) && now0 - netSeen.get(fingerprint) < 60000) return;
      netSeen.set(fingerprint, now0);
      const id = "net-" + fingerprint + "-" + (seqNet++).toString(36);
      const sid = state.currentSessionId || "";
      const urlExt = extFromUrl(url);
      const mime = blob.type || (urlExt ? "audio/" + (urlExt === "mp3" ? "mpeg" : urlExt) : "audio/mpeg");
      const meta = {
        id,
        messageId: id,
        sessionId: sid,
        sessionTitle: sid ? sessionTitle(sid) : (inCall ? "通话录音" : "实时语音"),
        role: "assistant",
        text: (reqText || "").slice(0, 120),
        mimeType: mime,
        ext: urlExt || mimeToExt(mime),
        size: blob.size,
        createdAt: Date.now(),
        capturedAt: Date.now(),
        isCall: inCall || isCallUiActive() || /(call|talk|phone)/i.test(String(url || "")),
        source: sourceTag,
        fingerprint,
        duration: null,
      };
      await voiceStore.save(meta, blob);
      scheduleRender();
    }
    function installNetworkSniffer() {
      // ── fetch ──
      if (typeof window.fetch === "function" && !window.fetch.__mmvPatched) {
        origFetch = window.fetch.bind(window);
        const patched = async function (...args) {
          const res = await origFetch(...args);
          try {
            if (setting("sniffNetwork", true) === false) return res;
            const req = args[0];
            const url = typeof req === "string" ? req : (req && req.url) || "";
            const init = args[1] || (req && typeof req === "object" && "body" in req ? req : null);
            const reqText = extractRequestBodyText(init);
            // 1) MiniMax t2a_v2：响应为 JSON，data.audio 是 hex 字符串（可能为数组）
            if (/t2a/i.test(url)) {
              const clone = res.clone();
              clone.json().then((json) => {
                try {
                  let aud = json && json.data && json.data.audio;
                  if (aud == null && json && json.audio) aud = json.audio;
                  const list = Array.isArray(aud) ? aud : [aud];
                  list.forEach((item) => {
                    if (typeof item !== "string" || !item) return;
                    if (/^https?:\/\//.test(item)) {
                      origFetch(item).then((r) => r.blob()).then((b) => saveNetworkBlob(b, item, reqText, "t2a-url")).catch(() => {});
                      return;
                    }
                    const blob = hexToBlob(item);
                    if (blob) saveNetworkBlob(blob, url, reqText, "t2a");
                  });
                } catch (e) { /* 解析失败忽略 */ }
              }).catch(() => {});
            } else if (looksAudioNet(res.headers ? res.headers.get("content-type") : "", url)) {
              // 2) 直接的音频字节流（OpenAI audio/speech 等）
              const clone = res.clone();
              clone.blob().then((b) => saveNetworkBlob(b, url, reqText, "audio-stream")).catch(() => {});
            }
          } catch (e) { /* 嗅探绝不影响原请求 */ }
          return res;
        };
        patched.__mmvPatched = true;
        window.fetch = patched;
      }
      // ── XMLHttpRequest 兜底 ──
      if (window.XMLHttpRequest && !window.XMLHttpRequest.__mmvPatched) {
        origXhrOpen = XMLHttpRequest.prototype.open;
        origXhrSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url) {
          this.__mmvUrl = url;
          return origXhrOpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
          this.addEventListener("load", () => {
            try {
              if (setting("sniffNetwork", true) === false) return;
              const reqText = body && typeof body === "string" && body.charAt(0) === "{" ? extractRequestBodyText({ body }) : "";
              if (this.responseType === "blob" && this.response instanceof Blob &&
                  looksAudioNet(this.response.type, this.__mmvUrl)) {
                saveNetworkBlob(this.response, this.__mmvUrl, reqText, "xhr");
              } else if (this.responseType === "arraybuffer" && this.response &&
                  looksAudioNet("", this.__mmvUrl)) {
                const ext = extFromUrl(this.__mmvUrl);
                saveNetworkBlob(new Blob([this.response], { type: ext ? "audio/" + (ext === "mp3" ? "mpeg" : ext) : "audio/mpeg" }),
                  this.__mmvUrl, reqText, "xhr");
              }
            } catch (e) { /* 忽略 */ }
          });
          return origXhrSend.apply(this, arguments);
        };
        XMLHttpRequest.__mmvPatched = true;
      }
    }

    // ──────────────────────────── 导出下载 ────────────────────────────
    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* 忽略 */ } }, 5000);
    }
    function stampOf(d) {
      return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "_" +
        pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds());
    }
    function buildFileName(meta) {
      const d = new Date(meta.createdAt || Date.now());
      const title = sanitize(meta.sessionTitle, 12) || "会话";
      const role = meta.role === "user" ? "我" : "AI";
      const kind = meta.isCall ? "通话" : "语音";
      let text = "";
      if (setting("filenameWithText", true) && meta.text) text = "_" + sanitize(meta.text, 16);
      return `MiniMax_${kind}_${title}_${role}${text}_${stampOf(d)}.${meta.ext || "mp3"}`;
    }
    async function exportOne(meta) {
      const blob = await voiceStore.getBlob(meta.id);
      if (!blob) { ctx.ui.toast("缓存数据缺失，请重新抓取"); return false; }
      downloadBlob(blob, buildFileName(meta));
      return true;
    }
    // 零依赖 ZIP（store 不压缩 + CRC32），音频本身已压缩，无需 deflate
    function dosParts(d) {
      const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f);
      const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f);
      return { time, date };
    }
    async function buildZip(files) {
      const enc = new TextEncoder();
      const local = [], central = [];
      let offset = 0;
      const { time, date } = dosParts(new Date());
      for (const f of files) {
        const name = enc.encode(f.name);
        const data = new Uint8Array(await f.blob.arrayBuffer());
        const crc = crc32(data);
        const lh = new DataView(new ArrayBuffer(30));
        lh.setUint32(0, 0x04034b50, true);
        lh.setUint16(4, 20, true);
        lh.setUint16(6, 0x0800, true);
        lh.setUint16(8, 0, true);
        lh.setUint16(10, time, true);
        lh.setUint16(12, date, true);
        lh.setUint32(14, crc, true);
        lh.setUint32(18, data.length, true);
        lh.setUint32(22, data.length, true);
        lh.setUint16(26, name.length, true);
        lh.setUint16(28, 0, true);
        local.push(lh.buffer, name, data);
        const ch = new DataView(new ArrayBuffer(46));
        ch.setUint32(0, 0x02014b50, true);
        ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
        ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
        ch.setUint16(12, time, true); ch.setUint16(14, date, true);
        ch.setUint32(16, crc, true);
        ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
        ch.setUint16(28, name.length, true);
        ch.setUint16(30, 0); ch.setUint16(32, 0); ch.setUint16(34, 0); ch.setUint16(36, 0);
        ch.setUint32(38, 0, true);
        ch.setUint32(42, offset, true);
        central.push(ch.buffer, name);
        offset += 30 + name.length + data.length;
      }
      let centralSize = 0;
      for (const p of central) centralSize += p.byteLength;
      const eocd = new DataView(new ArrayBuffer(22));
      eocd.setUint32(0, 0x06054b50, true);
      eocd.setUint16(4, 0, true); eocd.setUint16(6, 0, true);
      eocd.setUint16(8, files.length, true); eocd.setUint16(10, files.length, true);
      eocd.setUint32(12, centralSize, true);
      eocd.setUint32(16, offset, true);
      eocd.setUint16(20, 0, true);
      return new Blob([...local, ...central, eocd.buffer], { type: "application/zip" });
    }
    async function exportSelected(asZip) {
      const metas = state.list.filter((m) => state.selected.has(m.id));
      if (!metas.length) { ctx.ui.toast("请先勾选要导出的语音"); return; }
      if (metas.length === 1) { exportOne(metas[0]); return; }
      if (!asZip) {
        const gap = 400;
        for (const m of metas) { await exportOne(m); await sleep(gap); }
        ctx.ui.toast("已逐个开始下载 " + metas.length + " 条");
        return;
      }
      const tip = ctx.ui.toast("正在打包 " + metas.length + " 条语音…", { durationMs: 0 });
      try {
        const files = [], used = new Set();
        for (const m of metas) {
          const blob = await voiceStore.getBlob(m.id);
          if (!blob) continue;
          let name = buildFileName(m), i = 1;
          const dot = name.lastIndexOf("."), base = name.slice(0, dot), ext = name.slice(dot);
          while (used.has(name)) name = base + "_" + (i++) + ext;
          used.add(name);
          files.push({ name, blob });
        }
        if (!files.length) { tip.close(); ctx.ui.toast("没有可导出的缓存数据"); return; }
        const zip = await buildZip(files);
        downloadBlob(zip, `MiniMax语音_${files.length}条_${stampOf(new Date())}.zip`);
        ctx.ui.toast("已打包导出 " + files.length + " 条语音");
      } catch (e) {
        ctx.system.log("[语音缓存] ZIP 打包失败，回退逐个下载", e);
        ctx.ui.toast("打包失败，改为逐个下载");
        for (const m of metas) { await exportOne(m); await sleep(400); }
      } finally {
        tip.close();
      }
    }

    // ──────────────────────────── 悬浮窗 UI ────────────────────────────
    ctx.ui.injectCSS(`
#mmv-root{position:fixed;right:0;z-index:2147483000;top:38vh;font-family:inherit;-webkit-tap-highlight-color:transparent;}
.mmv-tab{position:absolute;right:0;top:0;width:20px;min-height:52px;padding:6px 0;box-sizing:border-box;
  background:linear-gradient(180deg,rgba(169,221,236,.66),rgba(124,196,219,.66));
  backdrop-filter:blur(10px) saturate(1.15);-webkit-backdrop-filter:blur(10px) saturate(1.15);
  border-radius:10px 0 0 10px;border:1px solid rgba(255,255,255,.35);border-right:none;
  box-shadow:-2px 3px 10px rgba(72,150,178,.22);color:#fff;cursor:grab;user-select:none;touch-action:none;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;}
.mmv-tab:active{cursor:grabbing;}
.mmv-tab svg{width:13px;height:13px;display:block;}
.mmv-tab-badge{min-width:14px;height:14px;padding:0 3px;border-radius:7px;background:rgba(255,255,255,.92);
  color:#2f7f99;font-size:9px;line-height:14px;text-align:center;font-weight:700;display:none;}
.mmv-panel{position:absolute;right:26px;top:0;width:244px;max-width:calc(100vw - 34px);max-height:62vh;
  display:none;flex-direction:column;background:rgba(244,251,253,.84);
  backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);
  border:1px solid rgba(155,205,222,.7);border-radius:13px;
  box-shadow:0 8px 28px rgba(70,140,165,.24);overflow:hidden;color:#275663;}
.mmv-panel.open{display:flex;}
.mmv-head{display:flex;align-items:center;gap:5px;padding:7px 8px;
  background:linear-gradient(135deg,rgba(200,236,246,.72),rgba(146,210,229,.72));color:#23586a;}
.mmv-head svg{width:15px;height:15px;color:#2f7f99;flex:none;}
.mmv-count{background:rgba(255,255,255,.72);border-radius:8px;padding:0 6px;font-size:10px;font-weight:700;color:#2f7f99;}
.mmv-mini{border:none;background:rgba(255,255,255,.55);border-radius:6px;height:21px;padding:0 6px;font-size:10.5px;
  color:#276072;cursor:pointer;}
.mmv-mini:hover{background:rgba(255,255,255,.85);}
.mmv-toolbar{display:flex;align-items:center;gap:6px;padding:6px 8px;
  background:rgba(232,245,250,.66);border-bottom:1px solid rgba(196,228,240,.8);}
.mmv-seg{display:flex;background:rgba(206,234,244,.85);border-radius:7px;overflow:hidden;}
.mmv-seg button{border:none;background:transparent;padding:3px 9px;font-size:10.5px;color:#3d7485;cursor:pointer;}
.mmv-seg button.on{background:#63b7d0;color:#fff;}
.mmv-scan{margin-left:auto;border:none;border-radius:7px;padding:4px 10px;font-size:10.5px;cursor:pointer;
  background:linear-gradient(135deg,rgba(134,205,226,.92),rgba(92,178,205,.92));color:#fff;}
.mmv-scan:disabled{opacity:.6;}
.mmv-scan.busy::before{content:"";display:inline-block;width:9px;height:9px;margin-right:3px;vertical-align:-1px;
  border:2px solid rgba(255,255,255,.55);border-top-color:#fff;border-radius:50%;
  animation:mmvrot .7s linear infinite;}
@keyframes mmvrot{to{transform:rotate(360deg);}}
.mmv-list{flex:1;overflow-y:auto;overscroll-behavior:contain;}
.mmv-empty{padding:24px 16px;text-align:center;color:#7aa6b3;font-size:11.5px;line-height:1.8;}
.mmv-item{padding:6px 8px;border-bottom:1px solid rgba(205,235,244,.75);}
.mmv-item:nth-child(odd){background:rgba(255,255,255,.4);}
.mmv-item.selected{background:rgba(209,238,247,.85);}
.mmv-item-top{display:flex;align-items:center;gap:4px;font-size:10px;color:#538494;margin-bottom:4px;}
.mmv-role{border-radius:5px;padding:0 4px;font-size:9.5px;background:#cfe9f3;color:#2c6b80;}
.mmv-role.user{background:#d4efdc;color:#2c6b43;}
.mmv-tag{border-radius:5px;padding:0 4px;font-size:9.5px;background:#ffe3b8;color:#945e12;}
.mmv-tag.net{background:#e6ddfb;color:#5b439c;}
.mmv-ext{border-radius:5px;padding:0 4px;font-size:9.5px;background:#dff0f7;color:#4a7f91;}
.mmv-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mmv-when{color:#83a9b6;white-space:nowrap;font-size:9.5px;}
.mmv-item-row{display:flex;align-items:center;gap:5px;}
.mmv-item-row input[type=checkbox]{flex:none;width:14px;height:14px;accent-color:#5cb2cd;}
.mmv-item audio{flex:1;min-width:0;height:28px;}
.mmv-ibtn{flex:none;border:none;border-radius:6px;padding:3px 6px;font-size:10.5px;cursor:pointer;
  background:rgba(214,237,246,.9);color:#276072;}
.mmv-ibtn:hover{background:#bfe3ef;}
.mmv-ibtn.del{background:rgba(240,231,231,.9);color:#9b5656;}
.mmv-textline{font-size:10.5px;color:#6997a6;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.mmv-foot{display:none;align-items:center;gap:6px;padding:7px 8px;border-top:1px solid rgba(196,228,240,.8);
  background:rgba(232,245,250,.66);}
.mmv-foot.show{display:flex;}
.mmv-foot label{font-size:10.5px;color:#3d7485;display:flex;align-items:center;gap:4px;white-space:nowrap;}
.mmv-foot input{accent-color:#5cb2cd;}
.mmv-foot .mmv-btn{margin-left:auto;}
.mmv-btn{border:none;border-radius:7px;padding:4px 9px;font-size:10.5px;cursor:pointer;
  background:rgba(214,237,246,.95);color:#276072;}
.mmv-btn.primary{background:linear-gradient(135deg,rgba(134,205,226,.95),rgba(92,178,205,.95));color:#fff;font-weight:600;}
`);

    const els = {};
    function buildUi() {
      const root = h("div", { id: "mmv-root" });
      // 贴边竖条（收起态）：仅语音图标 + 数量徽标
      const tab = h("div", { class: "mmv-tab", title: "语音缓存，点击展开 / 可拖动" }, [
        iconWave(13),
        h("span", { class: "mmv-tab-badge", text: "0" }),
      ]);
      // 头部：语音图标 + 数量，无文字标题
      const btnSelect = h("button", { class: "mmv-mini", text: "多选", title: "进入多选导出" });
      const btnClear = h("button", { class: "mmv-mini", text: "清空", title: "清空全部本地缓存（不影响聊天记录）" });
      const btnClose = h("button", { class: "mmv-mini", text: "×", title: "收起面板" });
      const head = h("div", { class: "mmv-head" }, [
        iconWave(15),
        h("span", { class: "mmv-count", text: "0" }),
        h("span", { style: "flex:1" }),
        btnSelect, btnClear, btnClose,
      ]);
      // 工具条
      const segAll = h("button", { class: "on", text: "全部" });
      const segCur = h("button", { text: "本会话" });
      const seg = h("span", { class: "mmv-seg" }, [segAll, segCur]);
      const btnScan = h("button", { class: "mmv-scan", text: "抓取" });
      const toolbar = h("div", { class: "mmv-toolbar" }, [seg, btnScan]);
      // 列表
      const list = h("div", { class: "mmv-list" });
      // 底部批量条
      const allCk = h("input", { type: "checkbox" });
      const btnEach = h("button", { class: "mmv-btn", text: "逐个下载" });
      const btnExport = h("button", { class: "mmv-btn primary", text: "导出选中" });
      const foot = h("div", { class: "mmv-foot" }, [
        h("label", {}, [allCk, "全选"]),
        btnEach, btnExport,
      ]);
      const panel = h("div", { class: "mmv-panel" }, [head, toolbar, list, foot]);
      root.appendChild(tab); root.appendChild(panel);
      document.body.appendChild(root);

      Object.assign(els, { root, tab, panel, list, foot, btnSelect, btnClear, btnClose,
        segAll, segCur, btnScan, allCk, btnEach, btnExport,
        badge: tab.querySelector(".mmv-tab-badge"), count: head.querySelector(".mmv-count") });

      // 竖条：点击展开，拖拽移动
      let downY = null, startTop = 0, moved = false;
      tab.addEventListener("pointerdown", (e) => {
        moved = false; downY = e.clientY; startTop = root.getBoundingClientRect().top;
        try { tab.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      });
      tab.addEventListener("pointermove", (e) => {
        if (downY == null) return;
        const dy = e.clientY - downY;
        if (Math.abs(dy) > 5) moved = true;
        if (moved) {
          const top = Math.max(0, Math.min(window.innerHeight - 52, startTop + dy));
          root.style.top = top + "px";
        }
      });
      tab.addEventListener("pointerup", (e) => {
        if (!moved) togglePanel();
        else prefSet("tabTop", root.getBoundingClientRect().top);
        downY = null;
      });
      tab.addEventListener("pointercancel", () => { downY = null; });

      btnClose.addEventListener("click", closePanel);
      btnSelect.addEventListener("click", () => {
        state.selectMode = !state.selectMode;
        state.selected.clear();
        els.btnSelect.textContent = state.selectMode ? "退出多选" : "多选";
        els.foot.classList.toggle("show", state.selectMode);
        renderList();
      });
      btnClear.addEventListener("click", async () => {
        if (!voiceStore.count()) { ctx.ui.toast("缓存已经是空的"); return; }
        if (!window.confirm("确定清空全部已缓存语音？此操作只删除本地缓存，不影响聊天与通话记录。")) return;
        releaseAllUrls();
        await voiceStore.clear();
        state.selected.clear();
        updateCount();
        renderList();
        ctx.ui.toast("已清空本地语音缓存");
      });
      segAll.addEventListener("click", () => setFilter("all"));
      segCur.addEventListener("click", () => {
        if (!state.currentSessionId) { ctx.ui.toast("请先打开一个聊天会话"); return; }
        setFilter("current");
      });
      btnScan.addEventListener("click", () => manualScan(state.filter === "current" ? "current" : "all"));
      els.allCk.addEventListener("change", () => {
        if (els.allCk.checked) state.list.forEach((m) => state.selected.add(m.id));
        else state.selected.clear();
        renderList();
      });
      btnEach.addEventListener("click", () => exportSelected(false));
      btnExport.addEventListener("click", () => exportSelected(true));

      prefGet("tabTop", null).then((v) => {
        if (typeof v === "number") root.style.top = Math.max(0, Math.min(window.innerHeight - 52, v)) + "px";
      });
    }

    function setFilter(f) {
      state.filter = f;
      els.segAll.classList.toggle("on", f === "all");
      els.segCur.classList.toggle("on", f === "current");
      renderList();
    }
    function openPanel() {
      state.open = true;
      const top = els.root.getBoundingClientRect().top;
      const wh = window.innerHeight;
      if (top > wh * 0.45) {
        els.panel.style.top = "auto"; els.panel.style.bottom = "0";
        els.panel.style.maxHeight = Math.min(wh * 0.7, Math.max(170, top - 8)) + "px";
      } else {
        els.panel.style.bottom = "auto"; els.panel.style.top = "0";
        els.panel.style.maxHeight = Math.min(wh * 0.7, Math.max(170, wh - top - 10)) + "px";
      }
      els.panel.classList.add("open");
      renderList();
    }
    function closePanel() {
      state.open = false;
      els.panel.classList.remove("open");
      releaseAllUrls();
    }
    function togglePanel() { state.open ? closePanel() : openPanel(); }

    function buildItem(m) {
      const checked = state.selected.has(m.id);
      const ck = h("input", { type: "checkbox", checked });
      ck.addEventListener("change", () => {
        ck.checked ? state.selected.add(m.id) : state.selected.delete(m.id);
        item.classList.toggle("selected", ck.checked);
        updateFoot();
      });
      const audio = h("audio", { controls: "controls", preload: "none" });
      audio.dataset.vid = m.id;
      objectUrl(m.id).then((u) => { if (u && audio.isConnected) audio.src = u; });
      audio.addEventListener("loadedmetadata", () => {
        if ((!m.duration || !isFinite(m.duration)) && isFinite(audio.duration) && audio.duration > 0) {
          m.duration = audio.duration;
          try { idbAlive && idbPutMeta(m); } catch (e) { /* 忽略 */ }
        }
      });
      audio.addEventListener("error", () => {
        audio.title = "缓存数据读取失败，可重新抓取";
      });
      const dl = h("button", { class: "mmv-ibtn", text: "下载", title: "下载为 " + (m.ext || "mp3") });
      dl.addEventListener("click", (e) => { e.stopPropagation(); exportOne(m); });
      const del = h("button", { class: "mmv-ibtn del", text: "删", title: "从本地缓存删除" });
      del.addEventListener("click", async (e) => {
        e.stopPropagation();
        const u = urlCache.get(m.id);
        if (u) { URL.revokeObjectURL(u); urlCache.delete(m.id); }
        await voiceStore.remove(m.id);
        state.selected.delete(m.id);
        updateCount();
        renderList();
      });
      const top = h("div", { class: "mmv-item-top" }, [
        h("span", { class: "mmv-role " + (m.role === "user" ? "user" : "ai"), text: m.role === "user" ? "我" : "AI" }),
        m.isCall ? h("span", { class: "mmv-tag", text: "通话" }) : null,
        m.source && m.source !== "message" ? h("span", { class: "mmv-tag net", text: "实时" }) : null,
        h("span", { class: "mmv-ext", text: (m.ext || "mp3").toUpperCase() + (m.size ? " " + fmtSize(m.size) : "") }),
        h("span", { class: "mmv-title", text: m.sessionTitle || "会话", title: m.sessionTitle || "" }),
        h("span", { class: "mmv-when", text: fmtTime(m.createdAt) + (m.duration ? " · " + fmtDur(m.duration) : "") }),
      ]);
      const row = h("div", { class: "mmv-item-row" }, [
        state.selectMode ? ck : null, audio, dl, del,
      ]);
      const item = h("div", { class: "mmv-item" + (checked ? " selected" : "") }, [top, row]);
      if (m.text) item.appendChild(h("div", { class: "mmv-textline", text: m.text, title: m.text }));
      return item;
    }

    function renderList() {
      if (!els.list) return;
      // 保留正在播放的进度
      let resume = null;
      els.list.querySelectorAll("audio").forEach((a) => {
        if (!a.paused && a.dataset.vid) resume = { vid: a.dataset.vid, t: a.currentTime };
      });
      els.list.innerHTML = "";
      let list = [...mem.values()];
      if (state.filter === "current" && state.currentSessionId) {
        list = list.filter((m) => m.sessionId === state.currentSessionId);
      }
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      state.list = list;
      if (!list.length) {
        els.list.appendChild(h("div", { class: "mmv-empty",
          text: state.filter === "current"
            ? "本会话还没有缓存语音。\n通话中会自动抓取，也可点上方「抓取」扫描本会话。"
            : "还没有缓存语音。\n打开聊天/通话后会自动抓取，也可点「抓取」手动扫描；挂断后、重开浏览器都能在这里回放。" }));
      } else {
        list.forEach((m) => els.list.appendChild(buildItem(m)));
      }
      if (resume) {
        const audios = els.list.querySelectorAll("audio");
        for (const a of audios) {
          if (a.dataset.vid === resume.vid) {
            a.currentTime = resume.t;
            a.play().catch(() => {});
            break;
          }
        }
      }
      updateFoot();
    }
    function updateFoot() {
      const n = state.selected.size;
      els.btnExport.textContent = n === 0 ? "导出选中" : n === 1 ? "导出MP3" : "打包导出(" + n + ")";
      els.allCk.checked = n > 0 && state.list.length > 0 && state.list.every((m) => state.selected.has(m.id));
    }
    function updateCount() {
      const n = voiceStore.count();
      if (els.count) els.count.textContent = String(n);
      if (els.badge) {
        els.badge.textContent = String(n);
        els.badge.style.display = n ? "block" : "none";
      }
    }
    let renderTimer = null;
    function scheduleRender() {
      updateCount();
      if (renderTimer || !state.open) return;
      renderTimer = ctx.system.timers.setTimeout(() => { renderTimer = null; renderList(); }, 260);
    }

    // ─────────────────────── 手动扫描（带提示）───────────────────────
    async function manualScan(scope) {
      if (state.scanning) return;
      state.scanning = true;
      els.btnScan.classList.add("busy");
      els.btnScan.disabled = true;
      const oldText = els.btnScan.textContent;
      els.btnScan.textContent = "抓取中";
      let tip = ctx.ui.toast(scope === "current" ? "正在全量抓取本会话…" : "正在全量抓取全部会话…", { durationMs: 0 });
      const refreshTip = (t) => { tip.close(); tip = ctx.ui.toast(t, { durationMs: 0 }); };
      try {
        let r;
        if (scope === "current") {
          if (!state.currentSessionId) { tip.close(); ctx.ui.toast("请先打开一个聊天会话"); return; }
          r = await scanCurrent(true);
        } else {
          r = await scanAll({
            full: true,
            onProgress: (p) => refreshTip(`正在抓取 ${p.i}/${p.total} 个会话，已新增 ${p.added} 条…`),
          });
        }
        tip.close();
        if (r.added > 0) {
          ctx.ui.toast(`抓取完成：扫描 ${r.scanned} 条消息，新增 ${r.added} 条语音`);
        } else if (r.candidates > 0) {
          ctx.ui.toast(`扫描完成：识别到 ${r.candidates} 条语音，均已缓存`);
        } else {
          ctx.ui.toast("扫描完成，没有发现语音消息");
        }
      } catch (e) {
        tip.close();
        ctx.system.log("[语音缓存] 手动扫描失败", e);
        ctx.ui.toast("扫描中断，已保留抓取成果");
      } finally {
        state.scanning = false;
        els.btnScan.classList.remove("busy");
        els.btnScan.disabled = false;
        els.btnScan.textContent = oldText;
        updateCount();
        if (state.open) renderList();
      }
    }

    // ──────────────────────────── 注册钩子 ────────────────────────────
    // 1) 新消息落库：立即抓 + 延迟重抓两次（等待媒体上传/转码完成、录音变长）
    ctx.hooks.on("message.persisted", (p) => {
      const msg = p && p.message;
      if (!msg) return;
      if (p.sessionId) state.currentSessionId = p.sessionId;
      const content = String(msg.content || "");
      if (/发起了(语音|视频)?通话/.test(content) && !/挂断/.test(content)) { inCall = true; callKeepUntil = Date.now() + 3600 * 1000; }
      else if (/挂断了.*通话|通话已结束|通话结束/.test(content)) { callKeepUntil = Date.now() + 8000; }
      if (setting("autoCapture", true) === false) return;
      if (!looksLikeMedia(msg)) return;
      const sid = msg.sessionId || p.sessionId || state.currentSessionId;
      captureMessage(sid, msg, false);
      ctx.system.timers.setTimeout(() => { const m2 = sid ? findMessage(sid, msg.id) || msg : msg; captureMessage(sid, m2, true); }, 1600);
      ctx.system.timers.setTimeout(() => { const m2 = sid ? findMessage(sid, msg.id) || msg : msg; captureMessage(sid, m2, true); }, 6000);
    });
    // 2) 消息更新（通话录音常在挂断瞬间把媒体填进已有消息）
    ctx.hooks.on("message.updated", (p) => {
      if (setting("autoCapture", true) === false || !p || p.id == null) return;
      const sid = p.sessionId || state.currentSessionId;
      if (!sid) return;
      const tryNow = () => {
        const m = findMessage(sid, p.id);
        if (m && (looksLikeMedia(m) || detectCall(m))) captureMessage(sid, m, true);
      };
      tryNow();
      ctx.system.timers.setTimeout(tryNow, 1200);
      ctx.system.timers.setTimeout(tryNow, 4500);
    });
    ctx.hooks.on("session.opened", (p) => {
      if (!p || !p.sessionId) return;
      state.currentSessionId = p.sessionId;
      if (state.open && state.filter === "current") renderList();
      ctx.system.timers.setTimeout(() => scanSession(p.sessionId, { full: true }), 700);
    });
    ctx.hooks.on("app.ready", () => { init(); });

    // 3) 长按消息菜单
    ctx.ui.messageAction({
      id: "mmv-export-one",
      label: "导出此条语音(MP3)",
      filter: (msg) => looksLikeMedia(msg),
      onSelect: async (msg, api) => {
        const sid = msg.sessionId || state.currentSessionId;
        const tip = ctx.ui.toast("正在解析语音…", { durationMs: 0 });
        const ok = await captureMessage(sid, msg, true);
        tip.close();
        if (!ok) { ctx.ui.toast("这条消息没有可导出的语音"); return; }
        const meta = voiceStore.get(vidOf(sid, msg.id));
        if (meta && await exportOne(meta)) ctx.ui.toast("已开始下载");
      },
    });
    ctx.ui.messageAction({
      id: "mmv-cache-one",
      label: "缓存此条语音到悬浮窗",
      filter: (msg) => looksLikeMedia(msg),
      onSelect: async (msg) => {
        const sid = msg.sessionId || state.currentSessionId;
        const ok = await captureMessage(sid, msg, true);
        ctx.ui.toast(ok ? "已缓存，点右侧「语音缓存」查看" : "这条消息没有语音");
      },
    });

    // 4) 定时补抓：当前会话 4s 密集扫描（通话场景关键）；全局 5 分钟兜底
    ctx.system.timers.setInterval(() => {
      refreshCallFlag();
      if (setting("denseScan", true) === false) return;
      if (state.currentSessionId) scanSession(state.currentSessionId, { limit: 20 });
    }, 4000);
    ctx.system.timers.setInterval(() => { scanAll({ limit: 50 }); }, 300000);

    // 5) 网络嗅探
    installNetworkSniffer();
    buildUi();

    // ──────────────────────────── 初始化 ────────────────────────────
    let inited = false;
    async function init() {
      if (inited) return;
      inited = true;
      try { await voiceStore.loadAll(); } catch (e) { ctx.system.log("[语音缓存] 初始加载失败", e); }
      updateCount();
      if (state.open) renderList();
      if (setting("startupScan", true)) {
        ctx.system.timers.setTimeout(() => scanAll({ full: true }), 2500);
      }
    }
    init();

    // ──────────────────────────── 卸载清理 ────────────────────────────
    return () => {
      try { els.root && els.root.remove(); } catch (e) { /* 忽略 */ }
      try { if (origFetch) window.fetch = origFetch; } catch (e) { /* 忽略 */ }
      try {
        if (origXhrOpen) XMLHttpRequest.prototype.open = origXhrOpen;
        if (origXhrSend) XMLHttpRequest.prototype.send = origXhrSend;
      } catch (e) { /* 忽略 */ }
      releaseAllUrls();
    };
  },
};
