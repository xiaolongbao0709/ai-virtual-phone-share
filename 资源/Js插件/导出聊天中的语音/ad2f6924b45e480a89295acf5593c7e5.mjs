// 小手机语音导出插件：导出聊天中的 MiniMax 语音缓存为 MP3 文件
// - 单条导出：长按语音消息 → 「导出语音 MP3」
// - 批量导出：聊天标题栏下方「导出语音」按钮 → 弹窗列出该会话全部语音，可单个下载或一键全部下载
export default {
  manifest: {
    id: "voice-exporter",
    name: "语音导出器",
    apiVersion: 1,
    version: "1.0.0",
    author: "you",
    description: "导出聊天中的 MiniMax 语音缓存，下载为 MP3 文件（支持单条 / 批量）",
    permissions: ["chat.read"],
    settings: [
      { key: "filenameWithText", label: "文件名带台词前缀", type: "boolean", default: true },
      { key: "batchGap", label: "批量导出间隔(ms)", type: "number", default: 500 },
    ],
  },

  setup(ctx) {
    // ── 单条导出：长按语音消息 ─────────────────────────────
    ctx.ui.messageAction({
      id: "export-audio",
      label: "导出语音 MP3",
      filter: (msg) => msg.mediaType === "audio",
      onSelect: async (msg, { toast }) => {
        try {
          const media = await ctx.data.messages.resolveMedia(msg);
          const blob = await getAudioBlob(media);
          if (!blob) {
            toast("未找到可导出的音频数据");
            return;
          }
          const name = buildFileName(msg, ctx);
          triggerDownload(blob, name);
          toast("已导出 " + name);
        } catch (err) {
          toast("导出失败：" + (err && err.message ? err.message : "未知错误"));
        }
      },
    });

    // ── 批量导出：聊天标题栏下方按钮 ───────────────────────
    ctx.ui.slot("chat.header", (el, props) => {
      if (!props || !props.sessionId) return;
      const wrap = document.createElement("div");
      wrap.style.cssText = "padding:6px 12px;display:flex;gap:8px;";

      const btn = document.createElement("button");
      btn.textContent = "导出语音";
      btn.style.cssText =
        "font-size:12px;padding:3px 12px;border:1px solid rgba(128,128,128,.45);" +
        "border-radius:999px;background:transparent;color:inherit;cursor:pointer;opacity:.85;";
      btn.onclick = () => openExportModal(ctx, props.sessionId);

      wrap.appendChild(btn);
      el.appendChild(wrap);
      return () => { wrap.remove(); };
    });
  },
};

// ── 工具函数 ─────────────────────────────────────────

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
  } catch {
    return null;
  }
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
  return (stamp + (text ? "_" + text : "") + "_voice.mp3");
}

function openExportModal(ctx, sessionId) {
  const msgs = ctx.data.messages.list(sessionId) || [];
  const voices = msgs.filter(
    (m) => m.mediaType === "audio" && (m.mediaUrl || (m.mediaData && m.mediaData.stickerUrl)),
  );

  ctx.ui.openModal((el, { close }) => {
    el.style.cssText =
      "width:min(92vw,420px);max-height:78vh;overflow:auto;padding:16px;" +
      "border-radius:14px;background:var(--card-bg,#fff);color:inherit;" +
      "box-shadow:0 8px 30px rgba(0,0,0,.18);";

    const title = document.createElement("div");
    title.textContent = "语音导出（" + voices.length + " 条）";
    title.style.cssText = "font-weight:600;font-size:15px;margin-bottom:10px;";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "×";
    closeBtn.style.cssText =
      "position:absolute;top:10px;right:12px;border:none;background:transparent;" +
      "font-size:20px;cursor:pointer;color:inherit;opacity:.6;";
    closeBtn.onclick = close;
    el.style.position = "relative";
    el.appendChild(closeBtn);

    if (!voices.length) {
      const empty = document.createElement("div");
      empty.textContent = "本会话暂无语音消息";
      empty.style.cssText = "font-size:13px;opacity:.6;padding:20px 0;text-align:center;";
      el.appendChild(title);
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
    el.appendChild(title);
    el.appendChild(allBtn);
    el.appendChild(list);

    // 单条下载
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
        } catch {
          dl.textContent = "失败";
        }
        setTimeout(() => { dl.disabled = false; dl.textContent = "下载"; }, 1500);
      });
    });

    // 全部下载（串行 + 间隔，避免浏览器拦截批量下载）
    allBtn.addEventListener("click", async () => {
      allBtn.disabled = true;
      allBtn.textContent = "导出中…";
      const gap = Number(ctx.system.settings.get("batchGap")) || 500;
      let ok = 0;
      for (const msg of voices) {
        try {
          const media = await ctx.data.messages.resolveMedia(msg);
          const blob = await getAudioBlob(media);
          if (blob) {
            triggerDownload(blob, buildFileName(msg, ctx));
            ok++;
          }
        } catch {
          // 单条失败不中断整体
        }
        await new Promise((r) => setTimeout(r, Math.max(200, gap)));
      }
      allBtn.disabled = false;
      allBtn.textContent = "已导出 " + ok + "/" + voices.length;
      setTimeout(() => { allBtn.textContent = "全部导出为 MP3"; }, 3000);
    });
  });
}
