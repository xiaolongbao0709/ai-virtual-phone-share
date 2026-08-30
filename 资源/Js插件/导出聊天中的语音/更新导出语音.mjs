// 小手机语音导出 + 通话录音插件（v2）
// 一、聊天语音消息导出：长按语音消息 → 「导出语音 MP3」；聊天标题栏「导出语音」列表
// 二、通话/实时 TTS 录音（v2 新增）：
//   - 拦截 MiniMax t2a_v2 / OpenAI audio/speech 网络请求，实时抓取合成出的音频字节
//   - 通话中 AI 说的话、聊天里生成的语音消息，都会被捕获
//   - 识别通话时段（系统消息 [发起了XX通话] / [挂断了XX通话]），打上「通话/消息」标签
//   - 通话中和挂断后都可随时打开悬浮「录音」按钮反复收听，并可导出 MP3 / 全部导出
export default {
  manifest: {
    id: "voice-exporter",
    name: "语音导出与通话录音",
    apiVersion: 1,
    version: "2.0.0",
    author: "you",
    description: "导出聊天语音为MP3；实时捕获通话/语音的TTS音频，通话中与挂断后可反复收听并导出",
    permissions: ["chat.read"],
    settings: [
      { key: "filenameWithText", label: "文件名带台词前缀", type: "boolean", default: true },
      { key: "batchGap", label: "批量导出间隔(ms)", type: "number", default: 500 },
      { key: "captureTts", label: "实时捕获TTS音频", type: "boolean", default: true },
      { key: "maxClips", label: "录音条数上限", type: "number", default: 120 },
      {
        key: "recordPos", label: "录音悬浮钮位置", type: "select", default: "tl",
        options: [
          { value: "tl", label: "左上角" },
          { value: "tr", label: "右上角" },
          { value: "bl", label: "左下角" },
          { value: "br", label: "右下角" },
        ],
      },
    ],
  },

  setup(ctx) {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const clips = [];      // 捕获的 TTS 音频 { id, text, dataURL, time, kind, provider }
    let inCall = false;    // 当前是否处于通话中
    let clipSeq = 0;

    // ══════════ 一、聊天语音消息导出（v1）══════════

    ctx.ui.messageAction({
      id: "export-audio",
      label: "导出语音 MP3",
      filter: (msg) => msg.mediaType === "audio",
      onSelect: async (msg, { toast }) => {
        try {
          const media = await ctx.data.messages.resolveMedia(msg);
          const blob = await getAudioBlob(media);
          if (!blob) { toast("未找到可导出的音频数据"); return; }
          const name = buildFileName(msg, ctx);
          triggerDownload(blob, name);
          toast("已导出 " + name);
        } catch (err) {
          toast("导出失败：" + (err && err.message ? err.message : "未知错误"));
        }
      },
    });

    ctx.ui.slot("chat.header", (el, props) => {
      if (!props || !props.sessionId) return;
      const wrap = document.createElement("div");
      wrap.style.cssText = "padding:6px 12px;display:flex;gap:8px;flex-wrap:wrap;";
      const mk = (label) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.style.cssText =
          "font-size:12px;padding:3px 12px;border:1px solid rgba(128,128,128,.45);" +
          "border-radius:999px;background:transparent;color:inherit;cursor:pointer;opacity:.85;";
        return b;
      };
      const btnVoice = mk("导出语音");
      btnVoice.onclick = () => openVoiceExportModal(ctx, props.sessionId);
      const btnRecord = mk("通话录音 0");
      btnRecord.id = "av-record-header-btn";
      btnRecord.onclick = () => openRecordModal(ctx);
      wrap.appendChild(btnVoice);
      wrap.appendChild(btnRecord);
      el.appendChild(wrap);
      return () => { wrap.remove(); };
    });

    // ══════════ 二、通话/实时 TTS 录音（v2）══════════

    // 通话时段识别：监听系统消息 [发起/挂断XX通话]
    ctx.hooks.on("message.persisted", (p) => {
      const c = p && p.message && p.message.content ? String(p.message.content) : "";
      if (/发起了(语音|视频)?通话/.test(c) && !/挂断/.test(c)) {
        inCall = true;
        updateRecordBtn();
      } else if (/挂断了.*通话|通话已结束/.test(c)) {
        inCall = false;
        updateRecordBtn();
      }
    });

    // 悬浮录音钮
    const recordBtn = document.createElement("button");
    recordBtn.id = "av-record-fab";
    document.body.appendChild(recordBtn);
    applyFabPos(ctx.system.settings.get("recordPos") || "tl");
    recordBtn.addEventListener("click", () => openRecordModal(ctx));

    function applyFabPos(p) {
      const m = {
        tl: "left:12px;top:14px;", tr: "right:12px;top:14px;",
        bl: "left:12px;bottom:16px;", br: "right:12px;bottom:16px;",
      }[p] || "left:12px;top:14px;";
      recordBtn.style.cssText =
        "position:fixed;z-index:2147483001;min-width:56px;height:32px;padding:0 10px;" +
        "border-radius:999px;border:1px solid rgba(255,255,255,.25);" +
        "background:rgba(20,20,25,.72);color:#fff;font-size:12px;cursor:pointer;" +
        "box-shadow:0 4px 16px rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);" +
        "display:none;align-items:center;justify-content:center;gap:4px;" + m;
    }

    function updateRecordBtn() {
      const show = clips.length > 0 || inCall;
      recordBtn.style.display = show ? "flex" : "none";
      recordBtn.textContent = "录音 " + clips.length;
      const headerBtn = document.getElementById("av-record-header-btn");
      if (headerBtn) headerBtn.textContent = "通话录音 " + clips.length;
    }

    // 捕获：拦截全局 fetch 的 TTS 请求
    if (ctx.system.settings.get("captureTts") !== false) {
      installTtsCapture();
    }

    function installTtsCapture() {
      if (window.__avTtsCaptureInstalled) return;
      window.__avTtsCaptureInstalled = true;
      const origFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const res = await origFetch(...args);
        try {
          const urlStr = String(
            args[0] && typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || "",
          );
          if (!/t2a_v2|\/audio\/speech/i.test(urlStr) || !res || !res.ok) return res;
          const bodyStr = args[1] && args[1].body ? String(args[1].body) : "";
          const text = extractTtsText(bodyStr);
          const clone = res.clone();
          void (async () => {
            try {
              if (/t2a_v2/i.test(urlStr)) {
                const json = await clone.json();
                const hex = json && json.data && json.data.audio;
                if (hex) {
                  const blob = hexToBlob(hex);
                  addClip(blob, text, "minimax");
                }
              } else {
                const buf = await clone.arrayBuffer();
                addClip(new Blob([buf], { type: "audio/mpeg" }), text, "openai");
              }
            } catch (e) { /* 单条失败跳过 */ }
          })();
        } catch (e) { /* 拦截失败不影响原请求 */ }
        return res;
      };
    }

    function addClip(blob, text, provider) {
      const max = Number(ctx.system.settings.get("maxClips")) || 120;
      if (clips.length >= max) clips.shift();
      void blobToDataURL(blob).then((dataURL) => {
        clips.push({
          id: "clip-" + (++clipSeq),
          text: (text || "").slice(0, 120),
          dataURL,
          time: Date.now(),
          kind: inCall ? "通话" : "语音",
          provider,
        });
        updateRecordBtn();
      });
    }

    // ══════════ 录音弹窗 ══════════

    function openRecordModal(ctx) {
      ctx.ui.openModal((el, { close }) => {
        el.style.cssText =
          "width:min(92vw,420px);max-height:78vh;overflow:auto;padding:16px;" +
          "border-radius:14px;background:var(--card-bg,#fff);color:inherit;" +
          "box-shadow:0 8px 30px rgba(0,0,0,.18);position:relative;";

        const title = document.createElement("div");
        title.textContent = "通话录音（" + clips.length + " 条）";
        title.style.cssText = "font-weight:600;font-size:15px;margin-bottom:10px;";

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.style.cssText =
          "position:absolute;top:10px;right:12px;border:none;background:transparent;" +
          "font-size:20px;cursor:pointer;color:inherit;opacity:.6;";
        closeBtn.onclick = close;
        el.appendChild(closeBtn);
        el.appendChild(title);

        if (!clips.length) {
          const empty = document.createElement("div");
          empty.textContent = "暂无录音。通话中或生成语音时会自动捕获。";
          empty.style.cssText = "font-size:13px;opacity:.6;padding:20px 0;text-align:center;";
          el.appendChild(empty);
          return;
        }

        const bar = document.createElement("div");
        bar.style.cssText = "display:flex;gap:8px;margin-bottom:10px;";
        const dlAll = document.createElement("button");
        dlAll.textContent = "导出全部";
        dlAll.style.cssText = btnPlainCss();
        dlAll.onclick = async () => {
          dlAll.disabled = true;
          const gap = Number(ctx.system.settings.get("batchGap")) || 500;
          let ok = 0;
          for (const c of clips) {
            try {
              const b = await dataURLToBlob(c.dataURL);
              if (b) { triggerDownload(b, clipName(c, ctx)); ok++; }
            } catch (e) { /* 跳过 */ }
            await new Promise((r) => setTimeout(r, Math.max(200, gap)));
          }
          dlAll.disabled = false;
          dlAll.textContent = "已导出 " + ok;
          setTimeout(() => { dlAll.textContent = "导出全部"; }, 2000);
        };
        const clear = document.createElement("button");
        clear.textContent = "清空";
        clear.style.cssText = btnPlainCss();
        clear.onclick = () => {
          clips.length = 0;
          updateRecordBtn();
          close();
        };
        bar.appendChild(dlAll);
        bar.appendChild(clear);
        el.appendChild(bar);

        const list = document.createElement("div");
        list.style.cssText = "display:flex;flex-direction:column;gap:6px;";
        clips.slice().reverse().forEach((c) => {
          const row = document.createElement("div");
          row.style.cssText =
            "display:flex;align-items:center;gap:8px;font-size:12px;padding:6px 8px;" +
            "border-radius:8px;background:rgba(128,128,128,.08);";
          const tag = document.createElement("span");
          tag.textContent = c.kind === "通话" ? "[通话]" : "[语音]";
          tag.style.cssText = "flex:none;font-size:10px;opacity:.7;";
          const info = document.createElement("div");
          info.style.cssText = "flex:1;overflow:hidden;";
          const t = document.createElement("div");
          t.textContent = c.text || "（无文本）";
          t.style.cssText = "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
          const meta = document.createElement("div");
          meta.textContent = fmtTime(c.time) + " · " + c.kind;
          meta.style.cssText = "font-size:10px;opacity:.6;";
          info.appendChild(t);
          info.appendChild(meta);
          const play = document.createElement("button");
          play.textContent = "▶";
          play.style.cssText = btnPlainCss() + "flex:none;width:30px;";
          play.onclick = () => togglePlay(c, play);
          const dl = document.createElement("button");
          dl.textContent = "⭳";
          dl.style.cssText = btnPlainCss() + "flex:none;width:30px;";
          dl.onclick = async () => {
            const b = await dataURLToBlob(c.dataURL);
            if (b) triggerDownload(b, clipName(c, ctx));
          };
          row.appendChild(tag);
          row.appendChild(info);
          row.appendChild(play);
          row.appendChild(dl);
          list.appendChild(row);
        });
        el.appendChild(list);
      });
    }

    // 播放（同时只播一条）
    let currentAudio = null;
    let currentPlayBtn = null;
    function togglePlay(clip, btn) {
      if (currentAudio) {
        currentAudio.pause();
        if (currentPlayBtn) currentPlayBtn.textContent = "▶";
        currentAudio = null;
        currentPlayBtn = null;
      }
      const a = new Audio(clip.dataURL);
      currentAudio = a;
      currentPlayBtn = btn;
      btn.textContent = "❚❚";
      a.onended = () => {
        btn.textContent = "▶";
        if (currentAudio === a) { currentAudio = null; currentPlayBtn = null; }
      };
      a.onerror = () => { btn.textContent = "▶"; currentAudio = null; };
      void a.play().catch(() => { btn.textContent = "▶"; });
    }

    // ══════════ 工具函数 ══════════

    function btnPlainCss() {
      return "font-size:12px;padding:3px 10px;border:1px solid rgba(128,128,128,.4);" +
        "border-radius:6px;background:transparent;color:inherit;cursor:pointer;";
    }

    function fmtTime(ts) {
      const d = new Date(ts);
      const pad = (n) => String(n).padStart(2, "0");
      return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    }

    function clipName(c, ctx) {
      const withText = ctx.system.settings.get("filenameWithText") !== false;
      const text = withText ? safeName(c.text, 18) : "";
      const d = new Date(c.time);
      const pad = (n) => String(n).padStart(2, "0");
      const stamp =
        "" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
        "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
      return stamp + (text ? "_" + text : "") + "_" + (c.kind === "通话" ? "call" : "voice") + ".mp3";
    }

    function extractTtsText(bodyStr) {
      try {
        const o = JSON.parse(bodyStr);
        return typeof o.text === "string" ? o.text : "";
      } catch (e) {
        return "";
      }
    }

    function hexToBlob(hex) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
      }
      return new Blob([bytes], { type: "audio/mpeg" });
    }

    function blobToDataURL(blob) {
      return new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result || ""));
        fr.onerror = () => resolve("");
        fr.readAsDataURL(blob);
      });
    }

    async function dataURLToBlob(dataURL) {
      if (!dataURL) return null;
      try {
        const res = await fetch(dataURL);
        return await res.blob();
      } catch (e) {
        return null;
      }
    }

    function triggerDownload(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1500);
    }

    async function getAudioBlob(media) {
      if (!media) return null;
      if (media.blob && media.blob.size > 0) return media.blob;
      try {
        const res = await fetch(media.dataURL);
        return await res.blob();
      } catch (e) { return null; }
    }

    function safeName(s, max) {
      return (s || "")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/[\\/:*?"<>|]+/g, "_")
        .replace(/\s+/g, "_")
        .trim()
        .slice(0, max || 20);
    }

    function buildFileName(msg, ctx) {
      const withText = ctx.system.settings.get("filenameWithText") !== false;
      const raw = msg.content || (msg.mediaData && msg.mediaData.synthesizedFromText) || "";
      const text = withText ? safeName(raw, 18) : "";
      const ts = new Date(msg.createdAt || Date.now());
      const pad = (n) => String(n).padStart(2, "0");
      const stamp =
        "" + ts.getFullYear() + pad(ts.getMonth() + 1) + pad(ts.getDate()) +
        "_" + pad(ts.getHours()) + pad(ts.getMinutes()) + pad(ts.getSeconds());
      return stamp + (text ? "_" + text : "") + "_voice.mp3";
    }

    function openVoiceExportModal(ctx, sessionId) {
      const msgs = ctx.data.messages.list(sessionId) || [];
      const voices = msgs.filter(
        (m) => m.mediaType === "audio" && (m.mediaUrl || (m.mediaData && m.mediaData.stickerUrl)),
      );
      ctx.ui.openModal((el, { close }) => {
        el.style.cssText =
          "width:min(92vw,420px);max-height:78vh;overflow:auto;padding:16px;" +
          "border-radius:14px;background:var(--card-bg,#fff);color:inherit;" +
          "box-shadow:0 8px 30px rgba(0,0,0,.18);position:relative;";
        const title = document.createElement("div");
        title.textContent = "语音导出（" + voices.length + " 条）";
        title.style.cssText = "font-weight:600;font-size:15px;margin-bottom:10px;";
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.style.cssText =
          "position:absolute;top:10px;right:12px;border:none;background:transparent;" +
          "font-size:20px;cursor:pointer;color:inherit;opacity:.6;";
        closeBtn.onclick = close;
        el.appendChild(closeBtn);
        el.appendChild(title);
        if (!voices.length) {
          const empty = document.createElement("div");
          empty.textContent = "本会话暂无语音消息";
          empty.style.cssText = "font-size:13px;opacity:.6;padding:20px 0;text-align:center;";
          el.appendChild(empty);
          return;
        }
        const allBtn = document.createElement("button");
        allBtn.textContent = "全部导出为 MP3";
        allBtn.style.cssText =
          "width:100%;padding:9px 0;border:none;border-radius:10px;cursor:pointer;" +
          "background:var(--accent,#3b82f6);color:#fff;font-size:14px;font-weight:500;";
        const list = document.createElement("div");
        list.style.cssText =
          "margin-top:12px;display:flex;flex-direction:column;gap:6px;max-height:300px;overflow:auto;";
        const rows = voices.map((msg, i) => {
          const row = document.createElement("div");
          row.style.cssText =
            "display:flex;align-items:center;gap:8px;font-size:12px;padding:6px 8px;" +
            "border-radius:8px;background:rgba(128,128,128,.08);";
          const label = document.createElement("span");
          const text = safeName(
            msg.content || (msg.mediaData && msg.mediaData.synthesizedFromText) || "语音", 16,
          ) || "语音";
          label.textContent = (i + 1) + ". " + text;
          label.style.cssText = "flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
          const dl = document.createElement("button");
          dl.textContent = "下载";
          dl.style.cssText =
            "font-size:12px;padding:2px 10px;border:1px solid rgba(128,128,128,.4);" +
            "border-radius:6px;background:transparent;color:inherit;cursor:pointer;flex:none;";
          row.appendChild(label);
          row.appendChild(dl);
          return row;
        });
        rows.forEach((r) => list.appendChild(r));
        el.appendChild(allBtn);
        el.appendChild(list);
        rows.forEach((row, i) => {
          const dl = row.querySelector("button");
          dl.addEventListener("click", async () => {
            const msg = voices[i];
            dl.disabled = true;
            dl.textContent = "…";
            try {
              const media = await ctx.data.messages.resolveMedia(msg);
              const blob = await getAudioBlob(media);
              if (blob) {
                triggerDownload(blob, buildFileName(msg, ctx));
                dl.textContent = "完成";
              } else {
                dl.textContent = "无数据";
              }
            } catch (e) { dl.textContent = "失败"; }
            setTimeout(() => { dl.disabled = false; dl.textContent = "下载"; }, 1500);
          });
        });
        allBtn.addEventListener("click", async () => {
          allBtn.disabled = true;
          allBtn.textContent = "导出中…";
          const gap = Number(ctx.system.settings.get("batchGap")) || 500;
          let ok = 0;
          for (const msg of voices) {
            try {
              const media = await ctx.data.messages.resolveMedia(msg);
              const blob = await getAudioBlob(media);
              if (blob) { triggerDownload(blob, buildFileName(msg, ctx)); ok++; }
            } catch (e) { /* 单条失败不中断 */ }
            await new Promise((r) => setTimeout(r, Math.max(200, gap)));
          }
          allBtn.disabled = false;
          allBtn.textContent = "已导出 " + ok + "/" + voices.length;
          setTimeout(() => { allBtn.textContent = "全部导出为 MP3"; }, 3000);
        });
      });
    }

    // ══════════ 卸载清理 ══════════

    return () => {
      recordBtn.remove();
      if (currentAudio) { try { currentAudio.pause(); } catch (e) { /* ignore */ } }
    };
  },
};
