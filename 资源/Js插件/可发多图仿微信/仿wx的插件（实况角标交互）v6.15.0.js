export default {
  manifest: {
    id: "image-carousel",
    name: "图片轮播",
    apiVersion: 1,
    version: "6.15.0",
    author: "你",
    description: "多选发图/实况（Live Photo，含声音），图与实况可混发；发出后卡片自动静音播放一次，大图点左下角“实况”再播（带声）；相册动态照片与拍摄实况均可识别；AI 可看连续画面、听实况声音，可选静音；微信风格轮播与沉浸式大图浏览",
    permissions: ["chat.read", "chat.write"],
    settings: [
      { key: "loop", label: "循环滚动（首尾相连）", type: "boolean", default: false },
      {
        key: "indicator",
        label: "页码指示器",
        type: "select",
        default: "dots",
        options: [
          { value: "dots", label: "底部圆点" },
          { value: "counter", label: "右上角 3/9" },
          { value: "none", label: "不显示" },
        ],
      },
      { key: "minImages", label: "触发轮播最少图片数", type: "number", default: 2 },
    ],
  },

  setup(ctx) {
    /* ============================================================
     *  样式注入
     * ============================================================ */
    ctx.ui.injectCSS(`
      /* —— 微信堆叠式多图预览 —— */
      .ic-stack{position:relative;height:220px;user-select:none;-webkit-user-select:none;touch-action:none;display:flex;align-items:center;gap:8px;overflow:visible;}
      .ic-stack-btn{flex-shrink:0;background:rgba(255,255,255,.1);color:rgba(255,255,255,.55);font-size:12px;padding:5px 11px;border-radius:16px;cursor:pointer;backdrop-filter:blur(4px);font-family:system-ui,sans-serif;white-space:nowrap;z-index:5;}
      .ic-stack-btn:active{background:rgba(255,255,255,.18);}
      .ic-stack-cards{position:relative;width:170px;height:220px;flex-shrink:0;z-index:1;}
      .ic-stack-card{position:absolute;top:0;left:0;width:170px;height:220px;border-radius:14px;overflow:hidden;background:#2a2a2a;box-shadow:0 4px 20px rgba(0,0,0,.4);will-change:transform;transform-origin:left center;}
      .ic-stack-card img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;-webkit-user-drag:none;}
      .ic-stack-card video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;opacity:0;transition:opacity .18s;}
      .ic-stack-card.is-playing video{opacity:1;}
      .ic-stack-card.is-playing img{opacity:0;}
      .ic-live-badge{position:absolute;top:8px;left:8px;display:flex;align-items:center;gap:3px;height:20px;padding:0 7px;border-radius:10px;background:rgba(0,0,0,.45);color:#fff;font-size:11px;line-height:1;pointer-events:auto;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(6px);z-index:2;}
      .ic-live-badge .ic-live-dot{width:5px;height:5px;border-radius:50%;background:#ffd60a;}
      .ic-stack-card.is-playing .ic-live-badge{opacity:0;pointer-events:none;}
      .wx-video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;opacity:0;transition:opacity .18s;pointer-events:none;}
      .wx-img.is-playing .wx-video{opacity:1;}
      .wx-img.is-playing .wx-photo{opacity:0;}
      .wx-live-badge{position:absolute;bottom:26px;left:14px;top:auto;display:flex;align-items:center;gap:4px;height:28px;padding:0 14px;border-radius:14px;background:rgba(0,0,0,.55);color:#fff;font-size:13px;z-index:4;cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent;}
      .wx-live-badge:active{background:rgba(0,0,0,.8);}
      .wx-live-badge .ic-live-dot{width:6px;height:6px;border-radius:50%;background:#ffd60a;}
      .wx-img.is-playing .wx-live-badge{opacity:0;pointer-events:none;}
      /* 展开模式：竖排一张张来 */
      .ic-stack-cards.expanded{width:170px;height:auto;display:flex;flex-direction:column;gap:8px;align-items:flex-end;touch-action:auto !important;}
      .ic-stack-cards.expanded .ic-stack-card{position:relative;top:auto;right:auto;width:170px;height:220px;flex-shrink:0;transform:none!important;box-shadow:0 2px 10px rgba(0,0,0,.3);cursor:pointer;border-radius:12px;}
      /* —— 输入栏按钮 —— */
      .ic-toolbar-btn{display:inline-flex;flex-direction:column;align-items:center;gap:5px;padding:8px 14px;border:none;background:transparent;cursor:pointer;border-radius:10px;font-size:11px;color:#555;transition:background .15s;}
      .ic-toolbar-btn:hover{background:rgba(0,0,0,.06);}
      .ic-toolbar-icon{width:36px;height:36px;border-radius:10px;background:#f2f2f2;display:flex;align-items:center;justify-content:center;}
      .ic-toolbar-icon svg{width:20px;height:20px;stroke:#555;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;}
      .ic-footer-carousel{margin-top:1px;}
      .ic-footer-carousel.user{display:flex;justify-content:flex-end;padding-right:52px;}
      .ic-footer-carousel.assistant{display:flex;justify-content:flex-start;}

      /* —— 微信风格全屏大图浏览器 —— */
      .wx-overlay{position:fixed;inset:0;background:#000;z-index:100000;overflow:hidden;-webkit-tap-highlight-color:transparent;}
      .wx-viewport{position:absolute;inset:0;overflow:hidden;touch-action:none;}
      .wx-track{display:flex;height:100%;will-change:transform;}
      .wx-slide{flex:0 0 100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;}
      .wx-img{max-width:86%;max-height:80%;object-fit:contain;will-change:transform;user-select:none;-webkit-user-drag:none;pointer-events:none;box-shadow:0 8px 40px rgba(0,0,0,.5);}
      .wx-img.wx-live{position:relative;display:inline-flex;align-items:center;justify-content:center;object-fit:fill;background:transparent;}
      .wx-live .wx-photo{max-width:86vw;max-height:80vh;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;box-shadow:0 8px 40px rgba(0,0,0,.5);transition:opacity .18s;}
      .wx-live .wx-video{width:100%;height:100%;}
      .wx-img.wx-live.is-playing .wx-photo{box-shadow:none;}
      .wx-counter{position:absolute;top:18px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.88);font-size:15px;z-index:100001;font-family:system-ui,sans-serif;font-weight:400;letter-spacing:.5px;pointer-events:none;}
      .wx-close{position:absolute;top:14px;right:14px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.12);color:rgba(255,255,255,.9);display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;z-index:100001;line-height:1;backdrop-filter:blur(8px);}
      .wx-close:active{background:rgba(255,255,255,.25);}
    `);

    /* ============================================================
     *  全局状态
     * ============================================================ */
    let currentSessionId = null;
    let pendingCarousel = null; // { sessionId, images }  绑定会话，防止串台
    const carouselBySession = {}; // sessionId -> { images, timestamp }  footer 兜底用
    const carouselById = {}; // msgId -> 全量 images（含视频 Blob/dataURL），当次会话内存缓存，消除持久化竞态

    // 轻量元数据（封面/连续帧/标志，剔除 Blob 与大 dataURL 视频），存 storage
    function buildCarouselMeta(images) {
      return images.map((x) => {
        if (x.isLive && (x.videoURL || x.videoBlob)) {
          return {
            dataURL: x.dataURL, mimeType: x.mimeType || "image/jpeg",
            isLive: true, liveMuted: !!x.liveMuted, hasVideo: true,
            videoMime: x.videoMime || "video/webm",
            hasAudio: !!x.audioURL,
            audioMime: x.audioMime || null,
            frames: Array.isArray(x.frames) && x.frames.length ? x.frames : [x.dataURL]
          };
        }
        return { dataURL: x.dataURL, mimeType: x.mimeType || "image/jpeg" };
      });
    }
    // 视频/音频 Blob 数组（与 images 同索引），存 IndexedDB
    function buildCarouselBlobs(images) {
      return images.map((x) => ((x.isLive && (x.videoBlob || x.videoURL))
        ? {
            videoBlob: x.videoBlob || dataURLToBlob(x.videoURL),
            videoMime: x.videoMime || "video/webm",
            audioBlob: x.audioBlob || (x.audioURL ? dataURLToBlob(x.audioURL) : null),
            audioMime: x.audioMime || null
          }
        : null));
    }
    function safeSetMeta(id, meta) {
      try { ctx.system.storage.set("carousel_msg_" + id, meta); return true; } catch (e) {}
      // 去掉连续帧再试
      try {
        const slim = meta.map((x) => { if (x.frames) { const c = Object.assign({}, x); delete c.frames; return c; } return x; });
        ctx.system.storage.set("carousel_msg_" + id, slim);
        return true;
      } catch (e) {}
      // 只保留封面
      try {
        ctx.system.storage.set("carousel_msg_" + id, meta.map((x) => Object.assign(
          { dataURL: x.dataURL, mimeType: x.mimeType || "image/jpeg" },
          x.isLive ? { isLive: true, hasVideo: !!x.hasVideo, liveMuted: !!x.liveMuted } : {}
        )));
        return true;
      } catch (e2) { ctx.system.log("carousel: meta storage failed:", e2); return false; }
    }
    // 完整持久化：大 Blob 进 IndexedDB，轻量元数据进 storage
    async function persistCarousel(id, images) {
      carouselById[id] = images; // 内存立即生效，消除"先渲染后写盘"的竞态
      const blobs = buildCarouselBlobs(images);
      if (blobs.some(Boolean)) {
        const ok = await idbSet("live_" + id, blobs);
        ctx.system.log("carousel: idb persisted live_" + id + " =", ok);
      }
      safeSetMeta(id, buildCarouselMeta(images));
    }
    // 从 IndexedDB 把视频/音频补回元数据（用于 footer 渲染 / 播放 / AI 注入）
    async function hydrateCarousel(id, images) {
      if (!images || !images.length) return images;
      if (!images.some((x) => x.isLive && x.hasVideo && !x.videoURL)) return images;
      const blobs = await idbGet("live_" + id);
      if (!blobs) return images;
      const out = [];
      for (let i = 0; i < images.length; i++) {
        const x = images[i];
        if (!(x.isLive && x.hasVideo && !x.videoURL)) { out.push(x); continue; }
        const b = blobs[i];
        if (!b) { out.push(x); continue; }
        const y = Object.assign({}, x);
        if (b.videoBlob) {
          y.videoBlob = b.videoBlob;
          y.videoMime = b.videoMime || x.videoMime;
          y.hasVideo = true;
          y.videoURL = URL.createObjectURL(b.videoBlob);
        }
        if (b.audioBlob) {
          y.audioBlob = b.audioBlob;
          y.audioMime = b.audioMime || x.audioMime;
          y.hasAudio = true;
          if (!y.audioURL) { try { y.audioURL = await blobToDataURL(b.audioBlob); } catch (_) {} }
        }
        out.push(y);
      }
      return out;
    }

    // 渲染前补齐实况播放地址：已有地址（处理时建好的/IDB 还原建好的）直接用，
    // 只有缺地址但有 Blob 时才临时创建，避免反复重建弄坏原本可用的地址
    function ensurePlayableURLs(images) {
      if (!images || !images.length) return images;
      for (const x of images) {
        if (x && x.isLive && !x.videoURL && x.videoBlob) {
          try { x.videoURL = URL.createObjectURL(x.videoBlob); } catch (_) {}
        }
      }
      return images;
    }
    // 单个实况：优先用已验证可用的地址，否则用视频 Blob 现场生成
    function videoURLFor(d) {
      if (d && d.videoURL) return d.videoURL;
      if (d && d.videoBlob) {
        try { return URL.createObjectURL(d.videoBlob); } catch (_) {}
      }
      return null;
    }

    ctx.hooks.on("session.opened", ({ sessionId }) => {
      if (sessionId) currentSessionId = sessionId;
    });
    ctx.ui.slot("chat.header", (el, props) => {
      if (props.sessionId) currentSessionId = props.sessionId;
    });

    /* ============================================================
     *  工具函数
     * ============================================================ */
    function readFileAsDataURL(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    function compressImage(file, maxSize = 1600, quality = 0.88) {
      return new Promise(async (resolve) => {
        try {
          const dataURL = await readFileAsDataURL(file);
          const img = new Image();
          img.onload = () => {
            let { width, height } = img;
            if (width > maxSize || height > maxSize) {
              if (width > height) { height = Math.round((height * maxSize) / width); width = maxSize; }
              else { width = Math.round((width * maxSize) / height); height = maxSize; }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const c = canvas.getContext("2d");
            c.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", quality));
          };
          img.onerror = () => resolve(dataURL);
          img.src = dataURL;
        } catch { resolve(readFileAsDataURL(file)); }
      });
    }

    function blobToDataURL(blob) {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    }
    function dataURLToBlob(dataURL) {
      try {
        const [head, b64] = String(dataURL).split(",");
        const mime = (head.match(/data:(.*?);/) || [, ""])[1] || "application/octet-stream";
        const bin = atob(b64 || "");
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
      } catch (_) { return null; }
    }

    /* ===== IndexedDB：大容量持久化实况视频/音频 Blob（不受 localStorage 5MB 限制） ===== */
    const IDB_NAME = "image_carousel_db";
    const IDB_STORE = "liveblobs";
    function idbOpen() {
      return new Promise((resolve, reject) => {
        if (typeof indexedDB === "undefined") { reject(new Error("no idb")); return; }
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    async function idbSet(key, val) {
      try {
        const db = await idbOpen();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).put(val, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } catch (e) { ctx.system.log("carousel: idbSet failed:", key, e); return false; }
    }
    async function idbGet(key) {
      try {
        const db = await idbOpen();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(IDB_STORE, "readonly");
          const rq = tx.objectStore(IDB_STORE).get(key);
          rq.onsuccess = () => resolve(rq.result);
          rq.onerror = () => reject(rq.error);
        });
      } catch (e) { return null; }
    }

    /* PCM AudioBuffer -> 16bit mono WAV dataURL */
    function encodeWav(audioBuffer) {
      const sr = audioBuffer.sampleRate;
      const data = audioBuffer.getChannelData(0);
      const len = data.length;
      const buf = new ArrayBuffer(44 + len * 2);
      const v = new DataView(buf);
      const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      ws(0, "RIFF"); v.setUint32(4, 36 + len * 2, true); ws(8, "WAVE");
      ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
      v.setUint16(22, 1, true); v.setUint32(24, sr, true);
      v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true);
      v.setUint16(34, 16, true); ws(36, "data"); v.setUint32(40, len * 2, true);
      let o = 44;
      for (let i = 0; i < len; i++) {
        const s = Math.max(-1, Math.min(1, data[i]));
        v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
      }
      const bytes = new Uint8Array(buf);
      let bin = ""; const CH = 0x8000;
      for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
      return "data:audio/wav;base64," + btoa(bin);
    }

    /* 从录制好的 webm 提取音频，重采样为 16kHz 单声道 WAV（语音识别/听觉模型通用） */
    async function extractWav(blob, maxDur) {
      try {
        const arr = await blob.arrayBuffer();
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        const tmp = new AC();
        const ab = await tmp.decodeAudioData(arr.slice(0));
        if (tmp.close) try { tmp.close(); } catch (_) {}
        const targetSR = 16000;
        const dur = Math.min(ab.duration || maxDur, maxDur);
        const frames = Math.max(1, Math.ceil(dur * targetSR));
        const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OAC) return null;
        const off = new OAC(1, frames, targetSR);
        const src = off.createBufferSource();
        src.buffer = ab;
        src.connect(off.destination);
        src.start(0);
        const rendered = await off.startRendering();
        const url = encodeWav(rendered);
        return { url, blob: dataURLToBlob(url) };
      } catch (e) {
        return null;
      }
    }

    /* 处理实况：直接使用原始视频（拍实况/相册视频的原格式，浏览器能播就不重录，避免移动端重录损坏），
       快速 seek 抓封面+连续帧（给 AI 看），解码音频提取 16kHz WAV（给 AI 听）。
       返回 {videoURL, videoBlob, videoMime, coverURL, frames, audioURL, audioBlob}；失败返回 null */
    function compressLiveVideo(file, opts) {
      const maxW = (opts && opts.maxW) || 480;
      const maxDuration = (opts && opts.maxDuration) || 5;
      const q = (opts && opts.quality) || 0.72;
      const mute = !!(opts && opts.mute);
      return new Promise(async (resolve) => {
        let video = null, objectUrl = null, settled = false;
        const done = (v) => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          try { if (video) video.pause(); } catch (_) {}
          resolve(v);
        };
        const watchdog = setTimeout(() => {
          ctx.system.log("carousel: 实况处理超时（15s 兜底）");
          done(null);
        }, 15000);
        try {
          const blob = (file instanceof Blob) ? file : new Blob([file]);
          objectUrl = URL.createObjectURL(blob);
          video = document.createElement("video");
          video.muted = true; video.playsInline = true; video.preload = "auto";
          video.setAttribute("muted", ""); video.setAttribute("playsinline", "");
          video.setAttribute("webkit-playsinline", "");
          video.src = objectUrl;
          await new Promise((res, rej) => {
            video.onloadedmetadata = res;
            video.onerror = rej;
            setTimeout(rej, 8000);
          });
          const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : maxDuration;
          const clipDur = Math.min(dur, maxDuration);
          let vw = video.videoWidth || 480, vh = video.videoHeight || 480;
          if (vw > maxW) { vh = Math.round(vh * maxW / vw); vw = maxW; }
          vw -= vw % 2; vh -= vh % 2;
          const canvas = document.createElement("canvas");
          canvas.width = vw; canvas.height = vh;
          const c2 = canvas.getContext("2d");
          const seek = (t) => new Promise((res) => {
            let r = false;
            const on = () => { if (r) return; r = true; video.removeEventListener("seeked", on); res(); };
            video.addEventListener("seeked", on);
            try { video.currentTime = Math.max(0, Math.min(t, Math.max(0, clipDur - 0.02))); } catch (_) {}
            setTimeout(on, 500);
          });
          const grab = (quality) => {
            try { c2.drawImage(video, 0, 0, vw, vh); return canvas.toDataURL("image/jpeg", quality); }
            catch (_) { return null; }
          };
          // 采样当前画面的平均亮度（每隔若干像素），用于挑出非黑封面
          const lumOf = () => {
            try {
              const step = Math.max(20, Math.round(vw / 12));
              const data = c2.getImageData(0, 0, vw, vh).data;
              let sum = 0, n = 0;
              for (let y = 0; y < vh; y += step) {
                for (let x = 0; x < vw; x += step) {
                  const i = (y * vw + x) * 4;
                  sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                  n++;
                }
              }
              return sum / Math.max(1, n);
            } catch (_) { return 128; }
          };
          // 在多个时间点抓帧，手机录像开头常有黑帧，不能只抓第 0.08 秒
          const timeList = [];
          [0.08, 0.2, 0.4, 0.6, 0.9].forEach((fr) => {
            const t = Math.min(Math.max(0.02, clipDur * fr), Math.max(0.02, clipDur - 0.05));
            timeList.push(+t.toFixed(3));
          });
          const cands = [];
          for (const t of (timeList.filter((v, i, a) => a.indexOf(v) === i))) {
            await seek(t);
            const url = grab(0.6);
            if (url) cands.push({ url, t, lum: lumOf() });
          }
          if (!cands.length) throw new Error("grab no frame");
          cands.sort((a, b) => b.lum - a.lum); // 最亮（最不黑）的一帧
          await seek(cands[0].t);
          const coverURL = grab(q) || cands[0].url;
          const frames = [coverURL];
          for (const c of cands) {
            if (c.url && frames.indexOf(c.url) < 0) frames.push(c.url);
          }

          let mime = (blob.type || "").toLowerCase();
          if (!mime || mime.indexOf("video") !== 0) {
            mime = /\.(mov|m4v)$/i.test(blob.name || "") ? "video/quicktime" : "video/mp4";
          }
          let audio = null;
          if (!mute) {
            try { audio = await extractWav(blob, clipDur); }
            catch (e) { ctx.system.log("carousel: 音频提取失败（可能本就无声或不支持解码）:", e); }
          }
          const audioURL = audio ? audio.url : null;
          ctx.system.log("carousel: live ready videoKB=", Math.round(blob.size / 1024), "mime=", mime,
            "audioKB=", audio ? Math.round(audio.blob.size / 1024) : 0, "frames=", frames.length, "dur=", clipDur.toFixed(2));
          try { video.pause(); } catch (_) {}
          done({
            videoURL: objectUrl,
            videoBlob: blob,
            coverURL,
            videoMime: mime,
            audioURL,
            audioBlob: audio ? audio.blob : null,
            audioMime: audioURL ? "audio/wav" : null,
            frames
          });
        } catch (e) {
          ctx.system.log("carousel: compressLiveVideo error:", e);
          try { if (video) video.pause(); } catch (_) {}
          if (objectUrl) { try { URL.revokeObjectURL(objectUrl); } catch (_) {} }
          done(null);
        }
      });
    }

    /* ============================================================
     *  安卓动态照片 / Motion Photo：JPEG 里内嵌 MP4，从字节里切出
     *  荣耀/华为/三星/Google 等机型常见。用真实 <video> 逐个验证候选，
     *  保证返回的视频一定能在当前浏览器播放。返回 { jpegBlob, videoBlob } 或 null
     * ============================================================ */
    function probeVideoBlob(blob) {
      return new Promise((resolve) => {
        let url = null, v = null, done = false;
        const timer = setTimeout(() => finish(false), 3000);
        function finish(ok) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { if (v) v.pause(); } catch (_) {}
          if (url) { try { URL.revokeObjectURL(url); } catch (_) {} }
          resolve(ok);
        }
        try {
          url = URL.createObjectURL(blob);
          v = document.createElement("video");
          v.muted = true; v.playsInline = true; v.preload = "auto";
          v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
          v.onloadedmetadata = () => {
            if (v.videoWidth > 0 && isFinite(v.duration) && v.duration > 0) {
              try { v.currentTime = Math.min(0.5, v.duration * 0.5); } catch (_) { finish(true); return; }
              v.onseeked = () => finish(true); // seek 成功代表能真正解码
              setTimeout(() => finish(v.videoWidth > 0), 1200);
            } else {
              finish(false);
            }
          };
          v.onerror = () => finish(false);
          v.src = url;
        } catch (_) { finish(false); }
      });
    }

    async function extractMotionPhoto(file) {
      try {
        if (!file || file.size < 120 * 1024) return null; // 太小不可能内嵌视频
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const len = bytes.length;
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null; // 不是 JPEG

        const dec = new TextDecoder("latin1");
        // XMP 偏移标记可能在文件头（Google GCamera）或文件尾部（MicroVideo/华为 MP Trailer），头尾都扫
        const headBytes = bytes.subarray(0, Math.min(len, 2 * 1024 * 1024));
        const tailBytes = len > 2 * 1024 * 1024 ? bytes.subarray(len - 512 * 1024) : new Uint8Array(0);
        const text = dec.decode(headBytes) + "\n" + dec.decode(tailBytes);
        const tailLen = tailBytes.length;
        const tailOffset = len - tailLen;
        const hasMotionMark = /MotionPhoto|MicroVideo|GCamera|MotionPhotoVersion|MicroVideoPresentationTimestampUs|MP-Tags|MotionPhotoV/i.test(text);
        const ascii = (a, b) => {
          let s = "";
          for (let i = a; i < b; i++) s += String.fromCharCode(bytes[i]);
          return s;
        };
        const MIN_VIDEO = 16 * 1024;
        const BRANDS = ["mp42", "mp41", "isom", "iso2", "iso3", "iso4", "iso5", "iso6", "qt  ", "dash", "M4V ", "M4A ", "avc1", "MSNV", "heic", "mif1", "iso "];
        const u32 = (off) => ((bytes[off] * 0x1000000 + (bytes[off + 1] << 16) + (bytes[off + 2] << 8) + bytes[off + 3]) >>> 0);
        // 按 MP4 顶层 box 链（ftyp/moov/mdat/free…）走到视频真正结尾，剥离动态照片末尾附带的 XMP/MP-Tags 尾巴
        const findMp4End = (st0) => {
          let p = st0, guard = 0;
          while (p + 8 <= len && guard < 256) {
            guard++;
            const size = u32(p);
            let next;
            if (size === 1) {
              if (p + 16 > len) break;
              const big = u32(p + 8) * 4294967296 + u32(p + 12);
              if (!isFinite(big) || big < 16 || p + big > len) break;
              next = p + big;
            } else if (size === 0) {
              next = len;
            } else {
              if (size < 8 || p + size > len) break;
              next = p + size;
            }
            if (next < len && next + 8 <= len) {
              const nt = ascii(next + 4, next + 8);
              if (!/^[\x20-\x7e]{4}$/.test(nt)) return p; // 下一段不是合法 box，视频到此为止
            }
            p = next;
            if (size === 0) break;
          }
          return p;
        };
        const starts = new Set();
        const addFtyp = (st) => {
          if (st >= 16 && st < len - 16 && (len - st) >= MIN_VIDEO && ascii(st + 4, st + 8) === "ftyp") starts.add(st);
        };

        // 1) Google MicroVideo：MicroVideoOffset = 从文件末尾到视频起点的偏移
        const mv = text.match(/MicroVideoOffset[^0-9]{0,10}(\d+)/i);
        if (mv) {
          const off = parseInt(mv[1], 10);
          if (off > 16 && off < len) addFtyp(len - off);
        }
        // 2) 新版统一 Motion Photo / 华为：XMP Item:Offset（相对文件头偏移）
        const itemMatches = text.match(/Item:Offset[^0-9]{0,8}(\d+)/gi);
        if (itemMatches) {
          itemMatches.forEach((mm) => {
            const n = parseInt((mm.match(/(\d+)/) || [])[1], 10);
            if (n > 0 && n < len - 16) addFtyp(n);
          });
        }
        // 3) 全文 ftyp 搜索（最终由 probeVideoBlob 严格验证，能解码才算，放宽匹配也安全）
        for (let i = 4; i + 16 <= len; i++) {
          if (bytes[i] === 0x66 && bytes[i + 1] === 0x74 && bytes[i + 2] === 0x79 && bytes[i + 3] === 0x70) {
            const st = i - 4;
            if (st < 16 || st >= len - 16 || (len - st) < MIN_VIDEO) continue;
            const size = (bytes[st] * 0x1000000 + (bytes[st + 1] << 16) + (bytes[st + 2] << 8) + bytes[st + 3]) >>> 0;
            const brand = ascii(i + 4, i + 8);
            const printable = /^[\x20-\x7e]{4}$/.test(brand);
            const sizeOk = size === 1 || (size >= 16 && size <= 65536);
            if (printable && sizeOk && (BRANDS.indexOf(brand) >= 0 || hasMotionMark)) starts.add(st);
          }
        }

        if (!starts.size) return null;
        // 视频通常在文件末尾，靠后候选优先；逐个用真实视频验证（总预算 12s），取能播的
        const sorted = Array.from(starts).sort((a, b) => b - a).slice(0, 8);
        const deadline = Date.now() + 12000;
        for (const st of sorted) {
          if (Date.now() > deadline) break;
          // 同一候选先试“精确剥离尾部 XMP”，再退回“切到文件末尾”
          const endExact = findMp4End(st);
          const cuts = [];
          if (endExact > st + MIN_VIDEO) cuts.push(endExact);
          if (endExact !== len) cuts.push(len);
          else if (cuts.length === 0) cuts.push(len);
          for (const end of cuts) {
            if (Date.now() > deadline) break;
            const videoBlob = file.slice(st, end, "video/mp4");
            if (videoBlob.size < MIN_VIDEO) continue;
            const ok = await probeVideoBlob(videoBlob);
            if (ok) {
              const jpegBlob = file.slice(0, st, "image/jpeg");
              ctx.system.log("carousel: 动态照片视频提取成功 offset=", st, "videoKB=", Math.round(videoBlob.size / 1024), "xmpMark=", hasMotionMark);
              return { jpegBlob, videoBlob };
            }
          }
        }
        ctx.system.log("carousel: 发现疑似动态视频段但当前浏览器都无法解码，候选数=", sorted.length, "xmpMark=", hasMotionMark);
        return null;
      } catch (e) {
        ctx.system.log("carousel: extractMotionPhoto error:", e);
        return null;
      }
    }
    function isVisible(el) {
      return el.offsetParent !== null || el.getClientRects().length > 0;
    }

    function isSearchEl(el) {
      if (!el) return false;
      const type = (el.type || "").toLowerCase();
      if (type === "search") return true;
      const ph = (el.placeholder || "").toLowerCase();
      if (/搜索|search|查找|find|筛选|filter|query|搜一搜/i.test(ph)) return true;
      const cls = (el.className || "").toString().toLowerCase();
      if (/search|filter|query|find/i.test(cls)) return true;
      let p = el.parentElement;
      for (let i = 0; i < 4 && p; i++) {
        const pcls = (p.className || "").toString().toLowerCase();
        const prole = (p.getAttribute && p.getAttribute("role")) || "";
        if (/search|filter|query|find/i.test(pcls)) return true;
        if (prole === "search") return true;
        p = p.parentElement;
      }
      return false;
    }

    function findChatInput() {
      const vh = window.innerHeight;
      const candidates = [];
      document.querySelectorAll("textarea").forEach((el) => {
        if (isVisible(el) && !isSearchEl(el)) candidates.push({ el, priority: 0 });
      });
      document.querySelectorAll('[contenteditable="true"]').forEach((el) => {
        if (isVisible(el) && !isSearchEl(el)) candidates.push({ el, priority: 1 });
      });
      document.querySelectorAll('input[type="text"], input:not([type])').forEach((el) => {
        if (isVisible(el) && !isSearchEl(el)) candidates.push({ el, priority: 2 });
      });
      if (!candidates.length) return null;
      candidates.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const ra = a.el.getBoundingClientRect();
        const rb = b.el.getBoundingClientRect();
        return rb.top - ra.top;
      });
      for (const c of candidates) {
        const r = c.el.getBoundingClientRect();
        if (r.top > vh * 0.4) return c.el;
      }
      return candidates[0].el;
    }

    function fillInput(el, text) {
      if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
        const proto = el.tagName === "TEXTAREA"
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
        if (setter) setter.call(el, text); else el.value = text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (el.isContentEditable) {
        el.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, text);
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    function findSendButtonNear(input) {
      let container = input.closest('form, [class*="input"], [class*="chat"], [class*="send"], [class*="composer"], [class*="toolbar"]');
      if (container) {
        const btns = container.querySelectorAll("button, [role='button'], [class*='send'], [class*='submit']");
        for (const btn of btns) {
          if (!isVisible(btn) || isSearchEl(btn)) continue;
          const text = (btn.textContent || btn.getAttribute("aria-label") || "").trim();
          if (/发送|Send|send/i.test(text)) return btn;
        }
      }
      return null;
    }

    function triggerSend(text) {
      const input = findChatInput();
      if (!input) {
        ctx.system.log("carousel: no chat input found");
        return false;
      }
      ctx.system.log("carousel: found input:", input.tagName, "class=", input.className, "ph=", input.placeholder);
      fillInput(input, text);
      const val = input.value || input.textContent || "";
      if (!val.includes(text)) {
        ctx.system.log("carousel: fill failed, value=", val);
        return false;
      }
      const sendBtn = findSendButtonNear(input);
      if (sendBtn) {
        ctx.system.log("carousel: clicking send button");
        sendBtn.click();
        return true;
      }
      ctx.system.log("carousel: no send button, simulating Enter");
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      return true;
    }

    /* ============================================================
     *  微信风格全屏大图浏览器
     * ============================================================ */
    function openWechatViewer(images, startIndex, thumbEl) {
      const W = window.innerWidth;
      const H = window.innerHeight;
      let currentIndex = startIndex;
      let trackX = -startIndex * W;
      const slides = [];
      // 打开大图通常由一次触摸/点击触发，紧接着浏览器会合成一组鼠标事件，初始时间用于抑制它们，避免“打开后立即被单击关闭”
      let lastTouchTs = Date.now();

      const overlay = document.createElement("div");
      overlay.className = "wx-overlay";

      const viewport = document.createElement("div");
      viewport.className = "wx-viewport";

      const track = document.createElement("div");
      track.className = "wx-track";

      images.forEach((src) => {
        const slide = document.createElement("div");
        slide.className = "wx-slide";
        let target, videoEl = null;
        if (src.isLive && (src.videoURL || src.videoBlob)) {
          target = document.createElement("div");
          target.className = "wx-img wx-live";
          const photo = document.createElement("img");
          photo.src = src.dataURL;
          photo.className = "wx-photo";
          photo.draggable = false;
          videoEl = document.createElement("video");
          videoEl.src = videoURLFor(src);
          videoEl.className = "wx-video";
          if (src.dataURL) { try { videoEl.poster = src.dataURL; } catch (_) {} }
          videoEl.muted = true; videoEl.loop = true; videoEl.playsInline = true;
          videoEl.setAttribute("muted", ""); videoEl.setAttribute("playsinline", "");
          videoEl.setAttribute("webkit-playsinline", "");
          videoEl.preload = "auto";
          const badge = document.createElement("div");
          badge.className = "wx-live-badge";
          badge.innerHTML = '<span class="ic-live-dot"></span>实况';

          // 诊断：确认视频能否加载（关键排查）
          videoEl.addEventListener("loadeddata", () => {
            ctx.system.log("carousel: 大图视频就绪", videoEl.videoWidth + "x" + videoEl.videoHeight, "dur=", videoEl.duration);
          });
          videoEl.addEventListener("error", () => {
            ctx.system.log("carousel: 大图视频加载失败 code=", videoEl.error && videoEl.error.code,
              "src=", String(videoEl.src).slice(0, 48));
            badge.innerHTML = '<span class="ic-live-dot"></span>视频无法播放';
            badge.style.background = "rgba(180,40,40,.7)";
          });
          // 自动播放（单次）结束后回到封面
          videoEl.addEventListener("ended", () => { if (!videoEl.loop) target.classList.remove("is-playing"); });

          // 角标可点按：播放/暂停（不会再触发关闭）
          const doPlay = () => {
            target.classList.add("is-playing");
            try {
              videoEl.loop = true;
              videoEl.currentTime = 0;
              videoEl.muted = src.liveMuted ? true : false;
              videoEl.volume = 1;
              const p = videoEl.play();
              if (p && p.catch) p.catch(() => {
                // 有声被拦截时退回静音也要让画面动起来
                try { videoEl.muted = true; videoEl.play().catch(() => {}); } catch (_) {}
              });
            } catch (_) {}
          };
          const toggleBadge = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isPlaying = target.classList.contains("is-playing");
            stopLiveAll();
            if (isPlaying) {
              target.classList.remove("is-playing");
              try { videoEl.pause(); } catch (_) {}
            } else if (videoEl.readyState >= 2) {
              doPlay();
            } else {
              // 还没缓冲好：先加载，canplay 后再播
              target.classList.add("is-playing");
              try { videoEl.load(); } catch (_) {}
              const onCan = () => { videoEl.removeEventListener("canplay", onCan); doPlay(); };
              videoEl.addEventListener("canplay", onCan);
              setTimeout(doPlay, 900);
            }
          };
          badge.addEventListener("touchstart", (e) => { e.stopPropagation(); }, { passive: true });
          badge.addEventListener("touchmove", (e) => { e.stopPropagation(); }, { passive: true });
          let lastTouchToggleTs = 0;
          badge.addEventListener("touchend", (e) => { lastTouchToggleTs = Date.now(); toggleBadge(e); });
          // 鼠标点击也要拦截，否则 mousedown/mouseup 会冒泡到大图手势，被当成“单击关闭”
          badge.addEventListener("mousedown", (e) => { e.stopPropagation(); });
          badge.addEventListener("mouseup", (e) => { e.stopPropagation(); });
          badge.addEventListener("click", (e) => {
            if (Date.now() - lastTouchToggleTs < 500) { e.stopPropagation(); e.preventDefault(); return; }
            toggleBadge(e);
          });

          target.appendChild(photo);
          target.appendChild(videoEl);
          target.appendChild(badge);
        } else {
          target = document.createElement("img");
          target.src = src.dataURL || src;
          target.className = "wx-img";
          target.draggable = false;
        }
        slide.appendChild(target);
        track.appendChild(slide);
        slides.push({ el: slide, img: target, video: videoEl, liveMuted: !!(src.isLive && src.liveMuted), scale: 1, tx: 0, ty: 0 });
      });

      viewport.appendChild(track);
      overlay.appendChild(viewport);

      const counter = document.createElement("div");
      counter.className = "wx-counter";
      counter.textContent = `${startIndex + 1} / ${images.length}`;
      overlay.appendChild(counter);

      const closeBtn = document.createElement("div");
      closeBtn.className = "wx-close";
      closeBtn.textContent = "×";
      overlay.appendChild(closeBtn);

      document.body.appendChild(overlay);
      track.style.transform = `translateX(${trackX}px)`;

      let fromRect = null;
      if (thumbEl) {
        try { fromRect = thumbEl.getBoundingClientRect(); } catch (_) {}
      }

      if (fromRect && fromRect.width > 0) {
        const s = slides[currentIndex];
        const scale = Math.min(fromRect.width / W, fromRect.height / H, 1);
        const tx = fromRect.left + fromRect.width / 2 - W / 2;
        const ty = fromRect.top + fromRect.height / 2 - H / 2;
        s.scale = scale; s.tx = tx; s.ty = ty;
        s.img.style.transition = "none";
        applySlide(currentIndex);
        overlay.style.background = "rgba(0,0,0,0)";
        void overlay.offsetWidth;
        requestAnimationFrame(() => {
          s.img.style.transition = "transform .28s cubic-bezier(.32,.72,0,1)";
          s.scale = 1; s.tx = 0; s.ty = 0;
          applySlide(currentIndex);
          overlay.style.transition = "background .28s ease";
          overlay.style.background = "#000";
        });
      }

      function applySlide(i) {
        const s = slides[i];
        s.img.style.transform = `translate(${s.tx}px, ${s.ty}px) scale(${s.scale})`;
      }

      function updateCounter() {
        counter.textContent = `${currentIndex + 1} / ${images.length}`;
      }

      function goTo(index, animate = true) {
        stopLiveAll();
        currentIndex = Math.max(0, Math.min(images.length - 1, index));
        trackX = -currentIndex * W;
        track.style.transition = animate ? "transform .3s cubic-bezier(.32,.72,0,1)" : "none";
        track.style.transform = `translateX(${trackX}px)`;
        updateCounter();
      }

      function resetSlide(i) {
        const s = slides[i];
        s.scale = 1; s.tx = 0; s.ty = 0;
        s.img.style.transition = "transform .25s ease";
        applySlide(i);
      }

      function close() {
        clearTimeout(liveTimer);
        stopLiveAll();
        if (fromRect && fromRect.width > 0) {
          const s = slides[currentIndex];
          s.img.style.transition = "transform .25s cubic-bezier(.32,.72,0,1)";
          const scale = Math.min(fromRect.width / W, fromRect.height / H, 1);
          const tx = fromRect.left + fromRect.width / 2 - W / 2;
          const ty = fromRect.top + fromRect.height / 2 - H / 2;
          s.scale = scale; s.tx = tx; s.ty = ty;
          applySlide(currentIndex);
          overlay.style.transition = "background .25s ease";
          overlay.style.background = "rgba(0,0,0,0)";
          setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 260);
        } else {
          overlay.style.transition = "opacity .2s";
          overlay.style.opacity = "0";
          setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
        }
        window.removeEventListener("keydown", onKey);
      }

      closeBtn.addEventListener("click", (e) => { e.stopPropagation(); close(); });

      let mode = null;
      let sx = 0, sy = 0, st = 0;
      let pinchDist = 0, pinchScale = 1;
      let dragTx = 0, dragTy = 0;
      let lastTap = 0, lastTapX = 0, lastTapY = 0;
      let tapTimer = null, liveTimer = null;

      function stopLiveAll() {
        slides.forEach((sl) => {
          if (sl.video) {
            sl.img.classList.remove("is-playing");
            try { sl.video.pause(); } catch (_) {}
          }
        });
      }
      function playLive() {
        const s = slides[currentIndex];
        if (!s || !s.video) return;
        stopLiveAll();
        mode = "live";
        s.img.classList.add("is-playing");
        try {
          s.video.loop = true;
          s.video.currentTime = 0;
          if (s.liveMuted) { s.video.muted = true; }
          else { s.video.muted = false; s.video.volume = 1; }
          const p = s.video.play();
          if (p && p.catch) p.catch(() => {
            try { s.video.muted = true; s.video.play().catch(() => {}); } catch (_) {}
          });
        } catch (_) {}
      }
      function stopLive() {
        const s = slides[currentIndex];
        if (s && s.video) {
          s.img.classList.remove("is-playing");
          try { s.video.pause(); } catch (_) {}
        }
      }

      function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }

      viewport.addEventListener("touchstart", (e) => {
        lastTouchTs = Date.now();
        clearTimeout(liveTimer);
        if (e.touches.length === 2) {
          mode = "pinch";
          pinchDist = dist(e.touches[0], e.touches[1]);
          pinchScale = slides[currentIndex].scale;
        } else if (e.touches.length === 1) {
          sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now();
          if (slides[currentIndex].scale > 1.01) {
            mode = "drag";
            dragTx = slides[currentIndex].tx;
            dragTy = slides[currentIndex].ty;
          } else {
            mode = null;
            // 实况且未放大：长按播放
            if (slides[currentIndex].video) {
              const lx = sx, ly = sy;
              liveTimer = setTimeout(() => {
                if (mode === null) playLive();
              }, 300);
            }
          }
        }
      }, { passive: true });

      viewport.addEventListener("touchmove", (e) => {
        if (e.touches.length === 2 && mode === "pinch") {
          e.preventDefault();
          const d = dist(e.touches[0], e.touches[1]);
          const s = slides[currentIndex];
          s.scale = Math.max(1, Math.min(4, pinchScale * (d / pinchDist)));
          s.img.style.transition = "none";
          applySlide(currentIndex);
        } else if (e.touches.length === 1) {
          const dx = e.touches[0].clientX - sx;
          const dy = e.touches[0].clientY - sy;

          if (mode === "live") { e.preventDefault(); return; }

          if (mode === null) {
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
              clearTimeout(liveTimer);
              mode = Math.abs(dx) > Math.abs(dy) ? "pan-x" : "pan-y";
            }
          }

          if (mode === "drag") {
            const s = slides[currentIndex];
            const maxX = (s.scale - 1) * W / 2;
            const maxY = (s.scale - 1) * H / 2;
            s.tx = Math.max(-maxX, Math.min(maxX, dragTx + dx));
            s.ty = Math.max(-maxY, Math.min(maxY, dragTy + dy));
            s.img.style.transition = "none";
            applySlide(currentIndex);
          } else if (mode === "pan-x") {
            e.preventDefault();
            let nx = trackX + dx;
            if (currentIndex === 0 && dx < 0) nx = trackX + dx * 0.3;
            if (currentIndex === images.length - 1 && dx > 0) nx = trackX + dx * 0.3;
            track.style.transition = "none";
            track.style.transform = `translateX(${nx}px)`;
          } else if (mode === "pan-y") {
            e.preventDefault();
            const s = slides[currentIndex];
            const progress = Math.min(1, Math.abs(dy) / (H * 0.6));
            s.ty = dy;
            s.scale = Math.max(0.5, 1 - progress * 0.4);
            s.img.style.transition = "none";
            applySlide(currentIndex);
            overlay.style.background = `rgba(0,0,0,${Math.max(0, 1 - progress)})`;
          }
        }
      }, { passive: false });

      viewport.addEventListener("touchend", (e) => {
        clearTimeout(liveTimer);
        if (mode === "live") { stopLive(); mode = null; return; }
        const ex = e.changedTouches[0].clientX;
        const ey = e.changedTouches[0].clientY;
        const dx = ex - sx, dy = ey - sy;
        const dt = Date.now() - st;
        const vel = Math.abs(dx) / Math.max(1, dt);

        if (mode === "pan-x") {
          if (Math.abs(dx) > W * 0.22 || vel > 0.5) {
            goTo(currentIndex + (dx < 0 ? 1 : -1));
          } else {
            goTo(currentIndex);
          }
        } else if (mode === "pan-y") {
          if (dy > 80 || (dy > 20 && dt < 250)) {
            close();
          } else {
            resetSlide(currentIndex);
            overlay.style.transition = "background .25s ease";
            overlay.style.background = "#000";
          }
        } else if (mode === "pinch") {
          const s = slides[currentIndex];
          if (s.scale < 1.01) { resetSlide(currentIndex); }
        } else if (mode === null) {
          handleTap(ex, ey);
        }
        mode = null;
      });

      function handleTap(x, y) {
        const now = Date.now();
        if (now - lastTap < 280 && Math.abs(x - lastTapX) < 24 && Math.abs(y - lastTapY) < 24) {
          clearTimeout(tapTimer);
          lastTap = 0;
          const s = slides[currentIndex];
          s.img.style.transition = "transform .25s cubic-bezier(.32,.72,0,1)";
          if (s.scale > 1.01) {
            s.scale = 1; s.tx = 0; s.ty = 0;
          } else {
            s.scale = 2.2;
            s.tx = (W / 2 - x) * 1.2;
            s.ty = (H / 2 - y) * 1.2;
            const maxX = (s.scale - 1) * W / 2;
            const maxY = (s.scale - 1) * H / 2;
            s.tx = Math.max(-maxX, Math.min(maxX, s.tx));
            s.ty = Math.max(-maxY, Math.min(maxY, s.ty));
          }
          applySlide(currentIndex);
        } else {
          lastTap = now; lastTapX = x; lastTapY = y;
          tapTimer = setTimeout(() => { close(); }, 290);
        }
      }

      let mouseDown = false, mouseSX = 0, mouseSY = 0, mouseST = 0, mouseMode = null;
      viewport.addEventListener("mousedown", (e) => {
        // 触摸后浏览器会合成一组鼠标事件，600ms 内忽略，避免“触摸打开后又被鼠标单击关闭”
        if (Date.now() - lastTouchTs < 600) return;
        clearTimeout(liveTimer);
        mouseDown = true; mouseSX = e.clientX; mouseSY = e.clientY; mouseST = Date.now();
        mouseMode = slides[currentIndex].scale > 1.01 ? "drag" : null;
        if (mouseMode === "drag") { dragTx = slides[currentIndex].tx; dragTy = slides[currentIndex].ty; }
        else if (slides[currentIndex].video) {
          liveTimer = setTimeout(() => {
            if (mouseMode === null) { mouseMode = "live"; mode = "live"; playLive(); }
          }, 300);
        }
      });
      window.addEventListener("mousemove", (e) => {
        if (!mouseDown) return;
        if (mouseMode === "live") return;
        const dx = e.clientX - mouseSX, dy = e.clientY - mouseSY;
        if (mouseMode === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
          clearTimeout(liveTimer);
          mouseMode = Math.abs(dx) > Math.abs(dy) ? "pan-x" : "pan-y";
        }
        if (mouseMode === "drag") {
          const s = slides[currentIndex];
          const maxX = (s.scale - 1) * W / 2, maxY = (s.scale - 1) * H / 2;
          s.tx = Math.max(-maxX, Math.min(maxX, dragTx + dx));
          s.ty = Math.max(-maxY, Math.min(maxY, dragTy + dy));
          s.img.style.transition = "none"; applySlide(currentIndex);
        } else if (mouseMode === "pan-x") {
          let nx = trackX + dx;
          if (currentIndex === 0 && dx > 0) nx = trackX + dx * 0.3;
          if (currentIndex === images.length - 1 && dx < 0) nx = trackX + dx * 0.3;
          track.style.transition = "none";
          track.style.transform = `translateX(${nx}px)`;
        } else if (mouseMode === "pan-y") {
          const s = slides[currentIndex];
          const progress = Math.min(1, Math.abs(dy) / (H * 0.6));
          s.ty = dy; s.scale = Math.max(0.5, 1 - progress * 0.4);
          s.img.style.transition = "none"; applySlide(currentIndex);
          overlay.style.background = `rgba(0,0,0,${Math.max(0, 1 - progress)})`;
        }
      });
      window.addEventListener("mouseup", (e) => {
        if (Date.now() - lastTouchTs < 600) { mouseDown = false; return; }
        if (!mouseDown) return;
        mouseDown = false;
        clearTimeout(liveTimer);
        if (mouseMode === "live") { stopLive(); mouseMode = null; mode = null; return; }
        const dx = e.clientX - mouseSX, dy = e.clientY - mouseSY, dt = Date.now() - mouseST;
        if (mouseMode === "pan-x") {
          if (Math.abs(dx) > W * 0.2 || Math.abs(dx) / Math.max(1, dt) > 0.5) goTo(currentIndex + (dx < 0 ? 1 : -1));
          else goTo(currentIndex);
        } else if (mouseMode === "pan-y") {
          if (dy > 80) close();
          else { resetSlide(currentIndex); overlay.style.transition = "background .25s"; overlay.style.background = "#000"; }
        } else if (mouseMode === null && Math.abs(dx) < 6 && Math.abs(dy) < 6 && dt < 300) {
          handleTap(e.clientX, e.clientY);
        }
        mouseMode = null;
      });
      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          goTo(currentIndex + (e.deltaX > 0 ? 1 : -1));
        } else {
          goTo(currentIndex + (e.deltaY > 0 ? 1 : -1));
        }
      }, { passive: false });

      function onKey(e) {
        if (e.key === "Escape") close();
        else if (e.key === "ArrowLeft") goTo(currentIndex - 1);
        else if (e.key === "ArrowRight") goTo(currentIndex + 1);
      }
      window.addEventListener("keydown", onKey);
    }

    /* ============================================================
     *  缩略轮播渲染
     * ============================================================ */
    function renderCarouselToEl(el, images) {
      if (!images || !images.length) { el.innerHTML = ""; return; }
      const CARD_W = 170, CARD_H = 220;
      let idx = 0, dragX = 0, dragging = false, expanded = false, liveActive = false;
      let startX = 0, startY = 0, startTime = 0, hasMoved = false;
      let autoEndTimer = null;

      el.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "ic-stack";

      const btn = document.createElement("div");
      btn.className = "ic-stack-btn";
      btn.textContent = "展开 " + images.length;

      const cardsBox = document.createElement("div");
      cardsBox.className = "ic-stack-cards";

      let cards = [];

      function buildCards() {
        clearTimeout(autoEndTimer);
        cardsBox.innerHTML = "";
        cards = images.map((d, i) => {
          const card = document.createElement("div");
          card.className = "ic-stack-card";
          const img = document.createElement("img");
          img.src = d.dataURL || d;
          img.alt = "";
          card.appendChild(img);

          if (d.isLive && (d.videoURL || d.videoBlob)) {
            const video = document.createElement("video");
            video.src = videoURLFor(d);
            if (d.dataURL) { try { video.poster = d.dataURL; } catch (_) {} }
            video.muted = true; video.loop = true; video.playsInline = true;
            video.setAttribute("muted", ""); video.setAttribute("playsinline", "");
            video.setAttribute("webkit-playsinline", "");
            video.preload = "auto";
            card.appendChild(video);
            const badge = document.createElement("div");
            badge.className = "ic-live-badge";
            badge.innerHTML = '<span class="ic-live-dot"></span>实况';
            card.appendChild(badge);

            let lpTimer = null, lpMoved = false, lpSX = 0, lpSY = 0, playing = false;
            const playCard = () => {
              if (playing) return;
              playing = true; liveActive = true;
              card.classList.add("is-playing");
              try {
                clearTimeout(autoEndTimer);
                video.loop = true;
                video.onended = null;
                video.currentTime = 0;
                if (d.liveMuted) { video.muted = true; }
                else { video.muted = false; video.volume = 1; }
                const p = video.play();
                if (p && p.catch) p.catch(() => {
                  try { video.muted = true; video.play().catch(() => {}); } catch (_) {}
                });
              } catch (_) {}
            };
            const stopCard = () => {
              if (!playing) return;
              playing = false;
              card.classList.remove("is-playing");
              try { video.pause(); } catch (_) {}
            };
            // 点角标：小窗静音单次播放一遍后回封面（不循环、不打开大图、不触发滑动）
            const replayOnce = () => {
              if (playing) return;
              clearTimeout(lpTimer);
              clearTimeout(autoEndTimer);
              playing = true; liveActive = true;
              card.classList.add("is-playing");
              const finish = () => {
                playing = false; liveActive = false;
                clearTimeout(autoEndTimer);
                card.classList.remove("is-playing");
                try { video.pause(); video.currentTime = 0; } catch (_) {}
              };
              try {
                video.loop = false;
                video.onended = finish;
                video.muted = true; // 小窗快速回看默认静音，有声在全屏大图里播放
                video.currentTime = 0;
                const p = video.play();
                if (p && p.catch) p.catch(() => { try { video.muted = true; video.play().then(finish, finish).catch(finish); } catch (_) { finish(); } });
                const dur = (isFinite(video.duration) && video.duration > 0) ? video.duration : 3;
                autoEndTimer = setTimeout(finish, dur * 1000 + 500);
              } catch (_) { finish(); }
            };
            const onStart = (x, y) => {
              if (expanded) return;
              lpMoved = false; lpSX = x; lpSY = y;
              clearTimeout(lpTimer);
              lpTimer = setTimeout(playCard, 300);
            };
            const onMove = (x, y) => {
              if (Math.abs(x - lpSX) > 10 || Math.abs(y - lpSY) > 10) {
                lpMoved = true; clearTimeout(lpTimer); stopCard();
              }
            };
            card.addEventListener("touchstart", (e) => {
              const t = e.touches[0]; onStart(t.clientX, t.clientY);
            }, { passive: true });
            card.addEventListener("touchmove", (e) => {
              const t = e.touches[0];
              if (playing) { e.preventDefault(); e.stopPropagation(); }
              onMove(t.clientX, t.clientY);
            }, { passive: false });
            card.addEventListener("touchend", () => { clearTimeout(lpTimer); stopCard(); });
            card.addEventListener("touchcancel", () => { clearTimeout(lpTimer); stopCard(); });
            // 桌面：鼠标按住播放（绑在卡片自身，避免反复渲染时 window 监听累积）
            card.addEventListener("mousedown", (e) => { e.preventDefault(); onStart(e.clientX, e.clientY); });
            card.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
            card.addEventListener("mouseup", () => { clearTimeout(lpTimer); stopCard(); });
            card.addEventListener("mouseleave", () => { clearTimeout(lpTimer); stopCard(); });
            // 左上角“实况”角标：点它在小窗再播一遍；阻止冒泡，避免触发长按/横滑/打开大图
            let lastBadgeTouch = 0;
            const onBadge = (e) => {
              e.preventDefault();
              e.stopPropagation();
            };
            badge.addEventListener("touchstart", (e) => { e.stopPropagation(); clearTimeout(lpTimer); }, { passive: true });
            badge.addEventListener("touchmove", (e) => { e.stopPropagation(); }, { passive: true });
            badge.addEventListener("touchend", (e) => {
              e.preventDefault(); e.stopPropagation();
              lastBadgeTouch = Date.now();
              replayOnce();
            }, { passive: false });
            badge.addEventListener("touchcancel", (e) => e.stopPropagation());
            badge.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
            badge.addEventListener("mouseup", (e) => { e.preventDefault(); e.stopPropagation(); });
            badge.addEventListener("click", (e) => {
              e.preventDefault(); e.stopPropagation();
              if (Date.now() - lastBadgeTouch < 500) return; // 触摸的合成 click 去重
              replayOnce();
            });
          }

          if (expanded) {
            card.addEventListener("click", (e) => {
              e.stopPropagation();
              openWechatViewer(images, i, img);
            });
          }
          cardsBox.appendChild(card);
          return card;
        });
      }

      function updateStack(animate = true, offset = 0) {
        cards.forEach((card, i) => {
          const rel = i - idx;
          let x, scale, z, opacity;
          if (Math.abs(rel) > 2) {
            x = rel > 0 ? CARD_W : -CARD_W;
            scale = 0.82; z = 0; opacity = 0;
          } else {
            x = (rel * 18) + offset;
            scale = 1 - Math.abs(rel) * 0.07;
            z = Math.round(10 - Math.abs(rel) * 2);
            opacity = Math.abs(rel) > 2 ? 0 : 1;
          }
          if (Math.abs(rel) > 2) opacity = 0;
          
          if (animate) {
            card.style.transition = "transform .32s cubic-bezier(.25,.8,.35,1), opacity .32s";
          } else {
            card.style.transition = "none";
          }
          card.style.transform = `translateX(${x}px) scale(${scale})`;
          card.style.zIndex = z;
          card.style.opacity = opacity;
        });
      }

      // 卡片自动播放：某张实况第一次成为当前卡片时，静音自动播一次，结束回封面
      const autoPlayedCards = new Set();
      function tryAutoPlayCurrent() {
        if (expanded) return;
        const card = cards[idx];
        if (!card || autoPlayedCards.has(idx)) return;
        const video = card.querySelector("video");
        if (!video) return;
        autoPlayedCards.add(idx);
        const clear = () => {
          clearTimeout(autoEndTimer);
          try { card.classList.remove("is-playing"); } catch (_) {}
          try { video.pause(); video.currentTime = 0; } catch (_) {}
        };
        try {
          clearTimeout(autoEndTimer);
          video.loop = false;
          video.muted = true;
          video.onended = clear;
          card.classList.add("is-playing");
          try { video.currentTime = 0; } catch (_) {}
          const p = video.play();
          if (p && p.catch) p.catch(clear);
          // 兜底：个别手机不触发 ended，按视频时长结束回封面，避免停在最后一帧黑画面
          const dur = (isFinite(video.duration) && video.duration > 0) ? video.duration : 3;
          autoEndTimer = setTimeout(clear, dur * 1000 + 500);
        } catch (_) { clear(); }
      }

      function render() {
        // 展开按钮只在「多张普通图」时出现；单张或含实况的组都不显示，避免突兀
        const hasLive = images.some((x) => x && x.isLive);
        const canExpand = images.length > 1 && !hasLive;
        btn.style.display = canExpand ? "" : "none";
        if (expanded) {
          cardsBox.classList.add("expanded");
          wrap.style.height = "auto";
          wrap.style.touchAction = "auto";
          wrap.style.overflowY = "auto";
          cardsBox.style.touchAction = "auto";
          cardsBox.style.overflowY = "auto";
          btn.textContent = "收起";
        } else {
          cardsBox.classList.remove("expanded");
          wrap.style.height = "220px";
          wrap.style.touchAction = "none";
          wrap.style.overflowY = "visible";
          cardsBox.style.touchAction = "pan-y";
          btn.textContent = "展开 " + images.length;
        }
        buildCards();
        if (!expanded) {
          updateStack(false);
          setTimeout(tryAutoPlayCurrent, 500);
        } else {
          setTimeout(() => {
            if (cards[0]) cards[0].scrollIntoView({ block: "nearest" });
          }, 50);
        }
      }

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        expanded = !expanded;
        render();
      });

      function openCurrent() {
        openWechatViewer(images, idx, cards[idx] ? cards[idx].querySelector("img") : null);
      }

      wrap.addEventListener("touchstart", (e) => {
        if (expanded) return;
        if (e.target.closest(".ic-stack-btn")) return;
        
        dragging = true;
        hasMoved = false;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        startTime = Date.now();
        dragX = 0;
      }, { passive: false });

      wrap.addEventListener("touchmove", (e) => {
        if (!dragging || expanded) return;
        if (liveActive) { e.preventDefault(); return; }

        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;

        if (!hasMoved) {
          if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
          if (Math.abs(dy) > Math.abs(dx)) {
            dragging = false;
            return;
          }
          hasMoved = true;
          e.preventDefault();
        }

        e.preventDefault();
        e.stopPropagation();

        let moveX = dx;
        if (idx === 0 && moveX > 0) moveX = 0;
        if (idx === images.length - 1 && moveX < 0) moveX = 0;

        dragX = moveX;
        updateStack(false, moveX);
      }, { passive: false });

      wrap.addEventListener("touchend", (e) => {
        if (liveActive) { liveActive = false; dragging = false; return; }
        if (!dragging) return;
        dragging = false;
        
        const duration = Date.now() - startTime;
        const finalDx = e.changedTouches[0].clientX - startX;

        if (!hasMoved) {
          openCurrent();
          updateStack(true);
          return;
        }

        const threshold = CARD_W * 0.25;
        const isQuickSwipe = duration < 250 && Math.abs(finalDx) > 20;
        const isDragEnough = Math.abs(finalDx) > threshold;

        if (isDragEnough || isQuickSwipe) {
          if (finalDx < 0) {
            idx = Math.min(images.length - 1, idx + 1);
          } else {
            idx = Math.max(0, idx - 1);
          }
        }
        updateStack(true);
        setTimeout(tryAutoPlayCurrent, 380);
        e.stopPropagation();
      });

      let mDown = false, mSx = 0, mSt = 0;
      wrap.addEventListener("mousedown", (e) => {
        if (expanded) return;
        if (e.target.closest(".ic-stack-btn")) return;
        e.preventDefault(); 
        mDown = true; mSx = e.clientX; mSt = Date.now();
        dragX = 0;
      });
      window.addEventListener("mousemove", (e) => {
        if (!mDown || expanded) return;
        if (liveActive) return;
        let dx = e.clientX - mSx;
        if (idx === 0 && dx > 0) dx = 0;
        if (idx === images.length - 1 && dx < 0) dx = 0;
        dragX = dx;
        updateStack(false, dx);
      });
      window.addEventListener("mouseup", (e) => {
        if (liveActive) { liveActive = false; mDown = false; return; }
        if (!mDown) return;
        mDown = false;
        const dt = Date.now() - mSt;
        const dx = dragX;
        
        if (Math.abs(dx) < 8 && dt < 300) {
          openCurrent();
          updateStack(true);
          return;
        }
        
        if (Math.abs(dx) > CARD_W * 0.18 || (Math.abs(dx) > 20 && dt < 250)) {
          if (dx < 0) {
            idx = Math.min(images.length - 1, idx + 1);
          } else {
            idx = Math.max(0, idx - 1);
          }
        }
        updateStack(true);
        setTimeout(tryAutoPlayCurrent, 380);
      });

      wrap.appendChild(btn);
      wrap.appendChild(cardsBox);
      render();
      el.appendChild(wrap);
    }

    /* ============================================================
     *  把轮播图片注入 LLM 请求，让 AI 真正"看到"图片
     * ============================================================ */
    ctx.hooks.transform("llm.request", async (payload) => {
      try {
        const sid = payload.sessionId || currentSessionId;
        if (!sid || !payload.messages || !payload.messages.length) return payload;

        const allMsgs = ctx.data.messages.list(sid) || [];

        // 真实消息里，按先后顺序记录每一条 user 消息的轮播内容（含实况，必要时从 IndexedDB 取音频）
        const allUserSeq = [];
        for (const m of allMsgs) {
          if (m.role !== "user") continue;
          let imgs = m._carouselImages;
          if (!imgs || !imgs.length) imgs = carouselById[m.id];
          if (!imgs || !imgs.length) imgs = ctx.system.storage.get("carousel_msg_" + m.id);
          if (imgs && imgs.length) {
            try { imgs = await hydrateCarousel(m.id, imgs); } catch (_) {}
            allUserSeq.push(imgs);
          } else {
            allUserSeq.push(null);
          }
        }

        // 发给 LLM 的 user 消息数量；payload 一般是最近 N 条，取真实序列尾部对齐
        const payloadUserCount = payload.messages.filter((x) => x.role === "user").length;
        const aligned = allUserSeq.slice(-payloadUserCount);

        let injected = 0, uIdx = 0, audioInjected = 0, frameInjected = 0;
        payload.messages = payload.messages.map((msg) => {
          if (msg.role !== "user") return msg;
          const imgs = aligned[uIdx++];
          if (!imgs || !imgs.length) return msg;
          const liveN = imgs.filter((x) => x.isLive && (x.hasVideo || x.videoURL)).length;
          const audioN = imgs.filter((x) => x.isLive && x.audioURL).length;
          let note;
          if (liveN && audioN) {
            note = "（用户发送了 " + imgs.length + " 个内容，其中 " + liveN + " 个为实况照片，" + audioN + " 个带声音。每个实况按时间顺序给出多帧连续画面（让你看到动态过程），并在连续帧后紧跟对应的现场音频（wav）。请逐帧查看画面并听取音频，把画面变化和声音一起纳入理解后再回复）";
          } else if (liveN) {
            note = "（用户发送了 " + imgs.length + " 个内容，其中 " + liveN + " 个为静音实况（无声音）。每个实况按时间顺序给出多帧连续画面，让你看到动态过程，请逐帧查看并理解）";
          } else {
            note = "（用户发送了 " + imgs.length + " 张图片，请查看并理解图片内容）";
          }
          const parts = [{ type: "text", text: note }];
          imgs.forEach((im) => {
            const isLive = !!(im.isLive && (im.hasVideo || im.videoURL));
            const frames = isLive && Array.isArray(im.frames) && im.frames.length ? im.frames : null;
            if (frames) {
              frames.forEach((f) => { parts.push({ type: "image_url", image_url: { url: f } }); frameInjected++; });
            } else {
              parts.push({ type: "image_url", image_url: { url: im.dataURL || im } });
              frameInjected++;
            }
            if (isLive && im.audioURL) {
              const b64 = String(im.audioURL).split(",")[1] || "";
              parts.push({ type: "input_audio", input_audio: { data: b64, format: "wav" } });
              audioInjected++;
            }
          });
          injected++;
          return Object.assign({}, msg, { content: parts });
        });

        ctx.system.log(
          "carousel: llm.request diag payloadUser=" + payloadUserCount +
          " storedCarouselUser=" + allUserSeq.filter(Boolean).length +
          " injected=" + injected + " frames=" + frameInjected + " audio=" + audioInjected
        );
        // 诊断：打印 payload 里每条 user 消息正文前 30 个字符，便于核对
        payload.messages.forEach((mm) => {
          if (mm.role !== "user") return;
          let desc;
          if (Array.isArray(mm.content)) desc = "[多模态 " + mm.content.length + " 段]";
          else desc = JSON.stringify(String(mm.content).slice(0, 30));
          ctx.system.log("carousel:   user msg ->", desc);
        });
      } catch (err) {
        ctx.system.log("carousel: llm.request inject error:", err);
      }
      return payload;
    });

    /* ============================================================
     *  拦截用户发送（绑定 sessionId，防串台）
     * ============================================================ */
    ctx.hooks.transform("user.beforeSend", (payload) => {
      if (pendingCarousel && payload.sessionId === pendingCarousel.sessionId) {
        payload.text = "图片";
      }
      return payload;
    });

    let awaitingPersist = null; // beforePersist 阶段还没有正式 id 时，暂存全量 images
    ctx.hooks.transform("message.beforePersist", (payload) => {
      const msg = payload.message;
      ctx.system.log("carousel: beforePersist", "role=", msg.role, "sid=", msg.sessionId, "content=", JSON.stringify(msg.content), "id=", msg.id, "pending=", !!pendingCarousel);
      if (pendingCarousel && msg.role === "user" && msg.content === "图片") {
        const imgs = pendingCarousel.images;
        msg._carouselImages = imgs;
        carouselBySession[msg.sessionId || "default"] = { images: imgs, timestamp: Date.now() };
        if (msg.id) {
          persistCarousel(msg.id, imgs); // 异步：Blob 进 IndexedDB
        } else {
          awaitingPersist = imgs;
        }
        ctx.system.log("carousel: beforePersist ATTACHED images, hasId=", !!msg.id, "sid=", msg.sessionId);
        pendingCarousel = null;
      }
      return payload;
    });

    ctx.hooks.on("message.persisted", ({ message }) => {
      if (message.role !== "user" || message.content !== "图片") return;
      const imgs = awaitingPersist || message._carouselImages || (pendingCarousel && pendingCarousel.images);
      if (message.id && imgs) {
        ctx.system.log("carousel: persisted persist to idb, id=", message.id);
        carouselBySession[message.sessionId || "default"] = { images: imgs, timestamp: Date.now() };
        persistCarousel(message.id, imgs);
        try { ctx.data.messages.update(message.id, { content: "图片" }); } catch (_) {}
      }
      awaitingPersist = null;
      if (pendingCarousel) pendingCarousel = null;
    });

    /* ============================================================
     *  message.footer：渲染轮播
     * ============================================================ */
    ctx.ui.slot("message.footer", async (el, props) => {
      if (props.sessionId) currentSessionId = props.sessionId;
      const msg = props.message;
      if (!msg || !msg.id) return;

      let images = msg._carouselImages;
      if (!images || !images.length) images = carouselById[msg.id];
      if (!images || !images.length) {
        images = ctx.system.storage.get("carousel_msg_" + msg.id);
      }
      if ((!images || !images.length) && msg.content === "图片" && msg.role === "user") {
        const cached = carouselBySession[msg.sessionId] || carouselBySession["default"];
        if (cached && cached.images && Date.now() - cached.timestamp < 60000) {
          images = cached.images;
          ctx.system.log("carousel: footer used session-cache for msg", msg.id);
        }
      }
      if (!images || !images.length) return;

      // 实况视频/音频在 IndexedDB，渲染前异步补全（内存全量时 hydrate 会直接跳过）
      try { images = await hydrateCarousel(msg.id, images); } catch (_) {}
      // 用视频 Blob 现场重建播放地址，杜绝旧 blob:URL 失效导致“无法播放”
      ensurePlayableURLs(images);
      const liveReady = images.filter((x) => x.isLive && x.videoURL).length;
      ctx.system.log("carousel: footer RENDER msgId=", msg.id, "images=", images.length, "liveReady=", liveReady);

      el.className = "ic-footer-carousel " + (msg.role === "user" ? "user" : "assistant");
      el.style.display = "flex";
      el.style.justifyContent = msg.role === "user" ? "flex-end" : "flex-start";
      el.style.paddingRight = msg.role === "user" ? "25px" : "0";
      el.style.touchAction = "none";
      renderCarouselToEl(el, images);

      try {
        let node = el.parentElement;
        for (let i = 0; i < 10 && node; i++) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
          let tn;
          while ((tn = walker.nextNode())) {
            if (tn.textContent.trim() === "图片" && !el.contains(tn)) tn.textContent = "";
          }
          node.querySelectorAll("span,p,div").forEach((te) => {
            if (te.children.length === 0 && te.textContent.trim() === "图片" && !el.contains(te)) {
              te.style.display = "none";
            }
          });
          const st = getComputedStyle(node);
          const bg = st.backgroundColor || "";
          const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" && bg !== "rgba(0,0,0,0)";
          const padL = parseFloat(st.paddingLeft || "0");
          if (hasBg && padL >= 6) {
            node.style.background = "transparent";
            node.style.backgroundColor = "transparent";
            node.style.padding = "0";
            node.style.border = "none";
            node.style.boxShadow = "none";
            node.style.maxWidth = "none";
            node.style.overflow = "visible";
            node.style.borderRadius = "0";
          }
          node = node.parentElement;
        }
      } catch (_) {}

      try {
        let n = el.parentElement;
        for (let i = 0; i < 10 && n; i++) {
          n.style.touchAction = "pan-y";
          n.style.overflowX = "visible";
          n = n.parentElement;
        }
        el.style.touchAction = "pan-y";
        el.style.overflow = "visible";
      } catch (_) {}
    });

    ctx.ui.messageKind("carousel", (el, msg) => {
      const images = (msg && msg.mediaData && msg.mediaData.images) || [];
      if (images.length) renderCarouselToEl(el, images);
    });
    ctx.ui.messageKind("plugin:carousel", (el, msg) => {
      const images = (msg && msg.mediaData && msg.mediaData.images) || [];
      if (images.length) renderCarouselToEl(el, images);
    });

    /* ============================================================
     *  输入栏「多选发图」按钮
     * ============================================================ */
    /* ============================================================
     *  从选择的文件构建轮播数据；live=true 时按同名配对图+视频成实况
     * ============================================================ */
    const isVideoFile = (f) =>
      (f.type && f.type.indexOf("video/") === 0) || /\.(mov|mp4|m4v|webm|3gp)$/i.test(f.name || "");
    const baseName = (f) => (f.name || "file").replace(/\.[^.]+$/, "").trim().toLowerCase();

    async function buildImagesFromFiles(files, live, mute) {
      const images = [];
      if (!live) {
        for (const file of files) {
          if (isVideoFile(file)) continue;
          images.push({ dataURL: await compressImage(file), mimeType: "image/jpeg" });
        }
        return images;
      }
      const liveItem = (cover, lv) => Object.assign({
        dataURL: cover, mimeType: "image/jpeg",
        isLive: true, liveMuted: !!mute,
        videoURL: lv.videoURL,
        videoBlob: lv.videoBlob || null,
        videoMime: lv.videoMime || "video/webm",
        frames: lv.frames || [cover]
      }, lv.audioURL ? {
        audioURL: lv.audioURL,
        audioBlob: lv.audioBlob || null,
        audioMime: lv.audioMime || "audio/wav"
      } : {});
      // 先建视频索引（同名配对）
      const videoMap = new Map();
      files.forEach((f) => { if (isVideoFile(f)) videoMap.set(baseName(f), f); });
      const usedVideo = new Set();
      const leftoverVideos = [];
      for (const file of files) {
        if (isVideoFile(file)) {
          if (!usedVideo.has(baseName(file))) leftoverVideos.push(file);
          continue;
        }
        // 1) 动态照片：单张 JPEG 内部已内嵌 MP4（荣耀/华为/三星/Google 等），直接切出
        const motion = await extractMotionPhoto(file);
        if (motion) {
          let cover;
          try { cover = await compressImage(motion.jpegBlob); } catch (_) { cover = null; }
          const lv = await compressLiveVideo(motion.videoBlob, { mute: !!mute });
          if (lv && lv.videoURL) {
            images.push(liveItem(cover || lv.coverURL, lv));
          } else if (cover) {
            images.push({ dataURL: cover, mimeType: "image/jpeg" });
          }
          continue;
        }
        // 2) 同名配对外部视频
        const dataURL = await compressImage(file);
        const vf = videoMap.get(baseName(file));
        if (vf) {
          usedVideo.add(baseName(file));
          const lv = await compressLiveVideo(vf, { mute: !!mute });
          if (lv && lv.videoURL) {
            images.push(liveItem(lv.coverURL || dataURL, lv));
          } else {
            images.push({ dataURL, mimeType: "image/jpeg" });
          }
        } else {
          images.push({ dataURL, mimeType: "image/jpeg" });
        }
      }
      // 没有配对图片的视频：用首帧做封面
      for (const vf of leftoverVideos) {
        const lv = await compressLiveVideo(vf, { mute: !!mute });
        if (lv && lv.coverURL && lv.videoURL) {
          images.push(liveItem(lv.coverURL, lv));
        } else if (lv && lv.coverURL) {
          images.push({ dataURL: lv.coverURL, mimeType: "image/jpeg" });
        }
      }
      return images;
    }

    /* ============================================================
     *  输入栏「多选发图」「多选发实况」按钮
     * ============================================================ */
    ctx.ui.slot("chat.inputToolbar", (el, props) => {
      // captureVideo=true 时直接调摄像头录像，录完即实况（有声）
      async function pickAndSend(live, mute, captureVideo) {
        let sid = currentSessionId;
        if (!sid) {
          const sessions = ctx.data.sessions.list();
          if (sessions && sessions.length) { sid = sessions[0].id; currentSessionId = sid; }
        }
        if (!sid) { ctx.ui.toast("请切换一次聊天"); return; }

        const input = document.createElement("input");
        input.type = "file";
        if (captureVideo) {
          input.accept = "video/*";
          try { input.setAttribute("capture", "environment"); } catch (_) {}
          input.multiple = false;
        } else {
          input.accept = live ? "image/*,video/*" : "image/*";
          input.multiple = true;
        }
        input.style.cssText = "position:absolute;left:-9999px;top:0;width:1px;height:1px;";
        document.body.appendChild(input);

        input.addEventListener("change", async (e) => {
          const files = Array.from(e.target.files || []);
          if (input.parentNode) document.body.removeChild(input);
          if (!files.length) return;

          const minImages = ctx.system.settings.get("minImages") || 2;
          // 实况/拍摄允许单个；普通多图沿用 minImages
          if (!live && files.length < minImages) { ctx.ui.toast(`请至少选 ${minImages} 张`); return; }

          const toast = ctx.ui.toast(
            captureVideo ? "正在处理实况（含声音）…" : live ? (mute ? "正在处理静音实况…" : "正在处理实况（含声音）…") : "正在处理…",
            { durationMs: 0 }
          );
          try {
            const images = await buildImagesFromFiles(files, live || captureVideo, mute);
            if (!images.length) { ctx.ui.toast(captureVideo ? "录像读取失败，请重拍或改用相册选视频" : "没有可识别的图片"); return; }
            const liveCount = images.filter((x) => x.isLive).length;
            const audioCount = images.filter((x) => x.isLive && x.audioURL).length;
            pendingCarousel = { sessionId: sid, images };
            const sent = triggerSend("图片");
            if (!sent) {
              pendingCarousel = null;
              ctx.ui.toast("未找到聊天输入框，请手动在输入框输入任意文字并发送");
            } else {
              ctx.system.timers.setTimeout(() => {
                if (pendingCarousel && pendingCarousel.sessionId === sid) {
                  pendingCarousel = null;
                  ctx.system.log("carousel: pending timed out, cleared");
                }
              }, 15000);
              if (!live && !captureVideo) {
                ctx.ui.toast("已填入输入框，请点击发送");
              } else if (!liveCount) {
                ctx.ui.toast("没选到视频：发实况请直接用「拍实况」录像，或在相册里选视频文件（.mp4/.mov），请点击发送");
              } else if (mute) {
                ctx.ui.toast(`已处理 ${images.length} 个（含 ${liveCount} 个静音实况，AI 听不到声音），请点击发送`);
              } else {
                ctx.ui.toast(
                  audioCount
                    ? `已处理 ${images.length} 个（含 ${liveCount} 个实况，${audioCount} 个带声音，AI 可听），请点击发送`
                    : `已处理 ${images.length} 个（含 ${liveCount} 个实况；未提取到声音，AI 仅看画面），请点击发送`
                );
              }
            }
          } catch (err) {
            pendingCarousel = null;
            ctx.system.log("carousel send error:", err);
            ctx.ui.toast("发送失败");
          } finally { toast.close(); }
        });
        input.click();
      }

      const btn = document.createElement("button");
      btn.className = "ic-toolbar-btn";
      btn.innerHTML = `
        <span class="ic-toolbar-icon">
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M7 15l3-3 2 2 3-4 3 4"/><circle cx="8.5" cy="9.5" r="1.2"/><path d="M17 8v10a2 2 0 0 1-2 2H7"/></svg>
        </span>
        <span>多选发图</span>
      `;
      btn.addEventListener("click", () => pickAndSend(false, false));
      el.appendChild(btn);

      const captureBtn = document.createElement("button");
      captureBtn.className = "ic-toolbar-btn";
      captureBtn.innerHTML = `
        <span class="ic-toolbar-icon">
          <svg viewBox="0 0 24 24"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/><circle cx="6.5" cy="10" r="1.1" fill="#fff" stroke="none"/></svg>
        </span>
        <span>拍实况</span>
      `;
      captureBtn.addEventListener("click", () => pickAndSend(true, false, true));
      el.appendChild(captureBtn);

      const liveBtn = document.createElement("button");
      liveBtn.className = "ic-toolbar-btn";
      liveBtn.innerHTML = `
        <span class="ic-toolbar-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/></svg>
        </span>
        <span>发实况·有声</span>
      `;
      liveBtn.addEventListener("click", () => pickAndSend(true, false));
      el.appendChild(liveBtn);

      const muteBtn = document.createElement("button");
      muteBtn.className = "ic-toolbar-btn";
      muteBtn.innerHTML = `
        <span class="ic-toolbar-icon">
          <svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><line x1="16" y1="9" x2="21" y2="15"/><line x1="21" y1="9" x2="16" y2="15"/></svg>
        </span>
        <span>发实况·静音</span>
      `;
      muteBtn.addEventListener("click", () => pickAndSend(true, true));
      el.appendChild(muteBtn);
    });

    /* ============================================================
     *  连续图片自动合并（AI 发图）
     * ============================================================ */
    let mergeCancel = null, merging = false;
    async function mergeGroup(messages, anchorId) {
      const ai = messages.findIndex((m) => m.id === anchorId);
      if (ai < 0) return false;
      const role = messages[ai].role;
      let s = ai, e = ai;
      while (s > 0 && messages[s - 1].mediaType === "image" && messages[s - 1].role === role) s--;
      while (e < messages.length - 1 && messages[e + 1].mediaType === "image" && messages[e + 1].role === role) e++;
      const group = messages.slice(s, e + 1);
      const minImages = ctx.system.settings.get("minImages") || 2;
      if (group.length < minImages) return false;

      const images = [];
      for (const m of group) {
        try {
          const media = await ctx.data.messages.resolveMedia(m);
          if (media && media.dataURL) images.push({ dataURL: media.dataURL, mimeType: media.mimeType || "image/jpeg" });
        } catch (_) {}
      }
      if (images.length < minImages) return false;

      const firstId = group[0].id;
      safeSetMeta(firstId, images);
      carouselById[firstId] = images;
      ctx.data.messages.update(firstId, { mediaType: "", mediaData: null, content: "图片", _carouselImages: images });
      for (let i = 1; i < group.length; i++) {
        ctx.data.messages.update(group[i].id, { mediaType: "", mediaData: null, content: "", deleted: true });
      }
      return true;
    }

    ctx.hooks.on("message.persisted", ({ message }) => {
      if (!message || message.mediaType !== "image" || !message.sessionId) return;
      if (mergeCancel) { mergeCancel(); mergeCancel = null; }
      const sid = message.sessionId;
      mergeCancel = ctx.system.timers.setTimeout(() => {
        mergeCancel = null;
        if (merging) return;
        merging = true;
        (async () => {
          try {
            const msgs = ctx.data.messages.list(sid);
            let e = msgs.length - 1;
            while (e >= 0 && msgs[e].mediaType !== "image") e--;
            if (e >= 0) await mergeGroup(msgs, msgs[e].id);
          } catch (err) { ctx.system.log("merge error:", err); }
          finally { merging = false; }
        })();
      }, 600);
    });

    ctx.ui.messageAction({
      id: "merge-to-carousel",
      label: "合并为轮播",
      filter: (msg) => msg && msg.mediaType === "image",
      onSelect: async (msg, { toast }) => {
        if (!msg.sessionId) return;
        const ok = await mergeGroup(ctx.data.messages.list(msg.sessionId), msg.id);
        toast(ok ? "已合并（切换聊天刷新可见）" : "没有可合并的连续图片");
      },
    });
  },
};
//（注：内容由AI生成）