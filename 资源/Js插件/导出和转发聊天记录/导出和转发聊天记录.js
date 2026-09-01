// 消息快照（chat-snapshot）apiVersion 1
// 入口：聊天输入栏「+」面板；仅读取当前打开的这一个会话；空消息不入选；导出前重新取数，已删除消息不会进入快照。
export default {
  manifest: {
    id: "chat-snapshot",
    name: "消息快照",
    apiVersion: 1,
    version: "1.0.0",
    author: "Doubao",
    description: "多选当前聊天消息生成长图/TXT下载，或转发私聊；支持楼层范围快速选择",
    permissions: ["chat.read"],
    settings: [
      { key: "imageWidth", label: "长图宽度(px，320~1200)", type: "number", default: 720 },
      { key: "fontSize", label: "长图正文字号(px，10~28)", type: "number", default: 15 },
      { key: "showTime", label: "快照中显示时间", type: "boolean", default: true },
    ],
  },
  setup(ctx) {
    // ========== 全局样式：半透明高级灰白、紧凑尺寸 ==========
    const CSS = `
.cs-root{padding:0!important;background:transparent!important;box-shadow:none!important;border:none!important;max-width:94vw!important}
.cs-modal{width:min(92vw,380px);max-height:74vh;display:flex;flex-direction:column;border-radius:18px;overflow:hidden;color:#262729;background:rgba(248,248,250,.82);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);border:1px solid rgba(255,255,255,.8);box-shadow:0 18px 50px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.9);font-family:inherit}
.cs-head{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid rgba(0,0,0,.06)}
.cs-title{font-size:13.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white:nowrap}
.cs-iconbtn{border:none;background:rgba(0,0,0,.06);width:22px;height:22px;border-radius:50%;font-size:13px;color:#666;cursor:pointer;display:grid;place-items:center;flex:none;line-height:1}
.cs-iconbtn:active{transform:scale(.92)}
.cs-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 12px;border-bottom:1px solid rgba(0,0,0,.05);font-size:11.5px;color:#666}
.cs-mini{border:1px solid rgba(0,0,0,.12);background:rgba(255,255,255,.6);border-radius:8px;padding:3px 6px;font-size:11.5px;color:#333;outline:none;font-family:inherit}
.cs-mini[type=number]{width:44px;text-align:center;-moz-appearance:textfield}
.cs-mini::-webkit-outer-spin-button,.cs-mini::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
.cs-mini:focus{border-color:rgba(0,0,0,.32);background:rgba(255,255,255,.85)}
select.cs-mini{padding:3px 4px}
.cs-sep{color:#bbb}
.cs-list{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:5px 6px;min-height:130px}
.cs-item{display:flex;gap:8px;align-items:flex-start;padding:7px 8px;border-radius:11px;cursor:pointer}
.cs-item:active{background:rgba(0,0,0,.04)}
.cs-item.cs-on{background:rgba(0,0,0,.06)}
.cs-dot{width:16px;height:16px;border-radius:50%;border:1.5px solid rgba(0,0,0,.28);flex:none;margin-top:1px;display:grid;place-items:center;font-size:10px;color:transparent}
.cs-item.cs-on .cs-dot{background:#2e2f31;border-color:#2e2f31;color:#fff}
.cs-floor{font-size:10.5px;color:#a0a0a6;flex:none;min-width:26px;margin-top:2px;font-variant-numeric:tabular-nums}
.cs-body{flex:1;min-width:0}
.cs-name{font-size:11px;color:#8a8a92;margin-bottom:1px}
.cs-txt{font-size:12.5px;line-height:1.45;color:#333;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;white-space:pre-wrap}
.cs-empty{text-align:center;color:#a0a0a6;font-size:12px;padding:28px 0}
.cs-foot{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:9px 12px;border-top:1px solid rgba(0,0,0,.06);background:rgba(255,255,255,.35)}
.cs-count{font-size:11.5px;color:#8a8a92;margin-right:auto}
.cs-btn{border:1px solid rgba(0,0,0,.12);background:rgba(255,255,255,.72);color:#333;border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer;font-family:inherit;transition:transform .08s}
.cs-btn.cs-primary{background:#2e2f31;border-color:#2e2f31;color:#fff}
.cs-btn.cs-warn{background:#c95448;border-color:#c95448;color:#fff}
.cs-btn:disabled{opacity:.38;cursor:not-allowed}
.cs-btn:active:not(:disabled){transform:scale(.95)}
.cs-entry-btn{appearance:none;border:1px solid rgba(0,0,0,.1);background:rgba(255,255,255,.62);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#3c3c40;border-radius:999px;padding:5px 13px;font-size:12.5px;line-height:1.4;display:inline-flex;align-items:center;gap:6px;cursor:pointer;box-shadow:0 1px 5px rgba(0,0,0,.06);font-family:inherit}
.cs-entry-btn::before{content:"";width:12px;height:12px;border-radius:4px;background:linear-gradient(135deg,#8e8e94,#d4d4da);display:inline-block}
.cs-entry-btn:active{transform:scale(.96)}
.cs-citem{display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:11px}
.cs-cinfo{flex:1;min-width:0}
.cs-cname{font-size:13px;color:#2e2f31;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-csub{font-size:10.5px;color:#9a9aa0;margin-top:1px}
.cs-fwd-card{border:1px solid rgba(0,0,0,.1);border-radius:12px;background:rgba(255,255,255,.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);overflow:hidden;min-width:200px;max-width:100%;box-shadow:0 1px 4px rgba(0,0,0,.05)}
.cs-fwd-head{display:flex;align-items:center;gap:8px;padding:9px 11px;cursor:pointer;user-select:none;font-size:12px;color:#555;line-height:1.3}
.cs-fwd-head:active{background:rgba(0,0,0,.04)}
.cs-fwd-tt{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cs-fwd-arrow{margin-left:auto;flex:none;font-size:11px;color:#9a9aa2}
.cs-fwd-body{display:none;border-top:1px dashed rgba(0,0,0,.12);padding:9px 11px;white-space:pre-wrap;word-break:break-word;color:#333;font-size:12px;line-height:1.6;max-height:320px;overflow-y:auto}
.cs-fwd-card.cs-open .cs-fwd-body{display:block}
`;
    ctx.ui.injectCSS(CSS);

    // ========== 转发消息：纯文字折叠卡片（默认收起，点击展开/再点收起） ==========
    const fwdOpenSet = new Set();
    ctx.ui.messageKind("snapshot-forward", (el, msg) => {
      el.innerHTML = "";
      const d = msg.mediaData || msg.media || msg.data || {};
      const mid = msg.id || "";
      const card = document.createElement("div");
      card.className = "cs-fwd-card" + (fwdOpenSet.has(mid) ? " cs-open" : "");
      const head = document.createElement("div");
      head.className = "cs-fwd-head";
      const ttl = document.createElement("span");
      ttl.className = "cs-fwd-tt";
      ttl.textContent = `消息快照 · 来自「${d.from || "聊天"}」· ${d.count || 0} 条${d.time ? " · " + d.time : ""}`;
      const arrow = document.createElement("span");
      arrow.className = "cs-fwd-arrow";
      arrow.textContent = fwdOpenSet.has(mid) ? "收起 ▾" : "展开 ▸";
      const body = document.createElement("div");
      body.className = "cs-fwd-body";
      body.textContent = d.text || msg.content || "";
      head.append(ttl, arrow);
      head.addEventListener("click", () => {
        const open = !fwdOpenSet.has(mid);
        if (open) fwdOpenSet.add(mid); else fwdOpenSet.delete(mid);
        card.classList.toggle("cs-open", open);
        arrow.textContent = open ? "收起 ▾" : "展开 ▸";
      });
      card.append(head, body);
      el.appendChild(card);
    });

    // ========== 当前会话追踪（只认当前打开的这一个角色窗口） ==========
    let currentSessionId = null;
    ctx.hooks.on("session.opened", (p) => {
      if (p && p.sessionId) currentSessionId = p.sessionId;
    });
    // header 坑位作为双保险同步 sessionId（不渲染任何可见内容）
    ctx.ui.slot("chat.header", (el, props) => {
      if (props && props.sessionId) currentSessionId = props.sessionId;
      el.innerHTML = "";
    });

    // ========== 入口：仅放在「+」面板，不挂长按菜单、不悬浮 ==========
    ctx.ui.slot("chat.inputToolbar", (el) => {
      el.innerHTML = "";
      const btn = document.createElement("button");
      btn.className = "cs-entry-btn";
      btn.type = "button";
      btn.textContent = "消息快照";
      btn.addEventListener("click", () => {
        if (!currentSessionId) {
          ctx.ui.toast("未识别当前聊天，请重新进入该会话后再试");
          return;
        }
        openSnapshot(currentSessionId);
      });
      el.appendChild(btn);
    });

    // ========== 通用工具 ==========
    function el(tag, cls, text) {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = String(text);
      return e;
    }
    function p2(n) { return String(n).padStart(2, "0"); }
    function clampInt(v, min, max, dft) {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n)) return dft;
      return Math.max(min, Math.min(max, n));
    }
    function pickTs(m) {
      return m.createdAt ?? m.timestamp ?? m.createTime ?? m.created_at ?? m.time ?? null;
    }
    function normDate(ts) {
      if (ts == null) return null;
      let n = Number(ts);
      if (!Number.isFinite(n)) {
        const d = new Date(ts);
        return isNaN(d) ? null : d;
      }
      if (n < 1e12) n *= 1000;
      const d = new Date(n);
      return isNaN(d) ? null : d;
    }
    function fmtHM(ts) {
      const d = normDate(ts);
      return d ? `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}` : "";
    }
    function fmtFull(ts) {
      const d = normDate(ts) || new Date();
      return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
    }
    function fileStamp() {
      const d = new Date();
      return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    }
    function safeName(s) {
      return String(s || "当前聊天").replace(/[\\/:*?"<>|\n\r\t]/g, "_").slice(0, 24) || "当前聊天";
    }
    function msgText(m) {
      let t = m.content ?? m.text ?? "";
      if (typeof t !== "string") {
        try { t = JSON.stringify(t); } catch { t = ""; }
      }
      return t;
    }
    function hasMedia(m) {
      return !!(m.mediaType || m.mediaData || m.mediaUrl || m.mediaId || /^mediastore:\/\//.test(msgText(m)));
    }
    function isEmptyMsg(m) {
      return msgText(m).trim() === "" && !hasMedia(m);
    }
    function categoryTag(cat) {
      return ({ image: "[图片]", audio: "[语音]", video: "[视频]", file: "[文件]" })[cat] || "[媒体]";
    }
    function guessMediaTag(m) {
      const t = String(m.mediaType || "").toLowerCase();
      if (t.includes("image")) return "[图片]";
      if (t.includes("audio") || t.includes("voice")) return "[语音]";
      if (t.includes("video")) return "[视频]";
      if (t.includes("file")) return "[文件]";
      if (/^mediastore:\/\//.test(msgText(m))) return "[媒体消息]";
      return "";
    }
    function getSession(sid) {
      try { return ctx.data.sessions.get(sid); } catch { return null; }
    }
    function charName(charId) {
      try {
        const c = ctx.data.characters && ctx.data.characters.get && ctx.data.characters.get(charId);
        return c && (c.name || c.title) || "";
      } catch { return ""; }
    }
    function sessionLabel(s) {
      if (!s) return "当前聊天";
      return s.title || s.name || s.displayName || (s.characterId ? charName(s.characterId) : "") || "当前聊天";
    }
    function senderName(m, session) {
      if (m.role === "user") return "我";
      if (m.role === "system") return "系统";
      const cid = m.characterId || (session && session.characterId);
      if (cid) {
        const n = charName(cid);
        if (n) return n;
      }
      return m.senderName || (session && sessionLabel(session)) || "TA";
    }
    // 只取当前会话；剔除 system 与空消息；时间正序（楼层依据）
    function collectMessages(sid) {
      let raw = [];
      try { raw = ctx.data.messages.list(sid) || []; } catch { raw = []; }
      const list = raw.filter((m) => m && m.role !== "system" && !isEmptyMsg(m));
      let anyTs = false;
      list.forEach((m) => { if (normDate(pickTs(m))) anyTs = true; });
      if (anyTs) {
        list.sort((a, b) => {
          const da = normDate(pickTs(a));
          const db = normDate(pickTs(b));
          if (da && db) return da - db;
          if (da) return -1;
          if (db) return 1;
          return 0;
        });
      }
      return list;
    }
    function loadImage(src) {
      return new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = src;
      });
    }
    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    function wrapLines(c2, text, maxW) {
      const out = [];
      String(text).split(/\r?\n/).forEach((para) => {
        if (para === "") { out.push(""); return; }
        let line = "";
        for (const ch of para) {
          if (line && c2.measureText(line + ch).width > maxW) {
            out.push(line);
            line = ch;
          } else {
            line += ch;
          }
        }
        out.push(line);
      });
      return out;
    }
    function truncateTo(c2, t, maxW) {
      if (c2.measureText(t).width <= maxW) return t;
      let s = t;
      while (s.length > 1 && c2.measureText(s + "…").width > maxW) s = s.slice(0, -1);
      return s + "…";
    }
    function roundRect(c, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + w, y, x + w, y + h, rr);
      c.arcTo(x + w, y + h, x, y + h, rr);
      c.arcTo(x, y + h, x, y, rr);
      c.arcTo(x, y, x + w, y, rr);
      c.closePath();
    }

    // ========== 长图绘制 ==========
    async function buildCanvas(rows, floorOf, session) {
      const W = clampInt(ctx.system.settings.get("imageWidth"), 320, 1200, 720);
      const FS = clampInt(ctx.system.settings.get("fontSize"), 10, 28, 15);
      const showTime = ctx.system.settings.get("showTime") !== false;
      const pad = 22, topH = 48, bottomH = 40, gap = 14, nameH = 18;
      const maxBubble = Math.round((W - pad * 2) * 0.86);
      const lh = Math.round(FS * 1.55);
      const mc = document.createElement("canvas").getContext("2d");
      mc.font = `${FS}px sans-serif`;

      // 预取媒体：图片尝试嵌入，其他类型显示标签，失败静默降级
      const mediaMap = new Map();
      for (const m of rows) {
        let r = null;
        try { r = await ctx.data.messages.resolveMedia(m); } catch { r = null; }
        if (r && r.category === "image" && r.dataURL) {
          const img = await loadImage(r.dataURL);
          mediaMap.set(m.id, img ? { img } : { tag: "[图片]" });
        } else if (r) {
          mediaMap.set(m.id, { tag: categoryTag(r.category) });
        } else if (hasMedia(m)) {
          const tg = guessMediaTag(m);
          if (tg) mediaMap.set(m.id, { tag: tg });
        }
      }

      // 第一遍：布局测量
      const blocks = [];
      let y = topH;
      for (const m of rows) {
        const text = msgText(m);
        const lines = text ? wrapLines(mc, text, maxBubble - 28) : [];
        let longest = 0;
        lines.forEach((l) => { longest = Math.max(longest, mc.measureText(l).width); });
        const bubbleW = lines.length ? Math.ceil(Math.min(maxBubble, longest + 28)) : 0;
        const textH = lines.length ? lines.length * lh + 18 : 0;
        const md = mediaMap.get(m.id);
        let imgBox = null;
        if (md && md.img) {
          const iw = md.img.width || maxBubble;
          const ih = md.img.height || iw;
          let dw = Math.min(maxBubble, iw);
          let dh = ih * dw / iw;
          if (dh > 260) { dh = 260; dw = iw * dh / ih; }
          imgBox = { w: Math.round(dw), h: Math.round(dh), img: md.img };
        }
        const tag = md && md.tag ? md.tag : null;
        let h = nameH;
        if (textH) h += textH + 5;
        if (imgBox) h += imgBox.h + 6;
        if (tag && !imgBox) h += 28;
        blocks.push({ m, lines, bubbleW, textH, imgBox, tag, top: y, h });
        y += h + gap;
      }
      const totalH = y + bottomH;
      if (totalH > 30000) throw new Error("快照过长，请减少选中条数后再试");

      // 第二遍：绘制
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = totalH;
      const c = cv.getContext("2d");
      c.fillStyle = "#f2f2f4";
      c.fillRect(0, 0, W, totalH);
      c.textBaseline = "alphabetic";

      c.fillStyle = "#202124";
      c.font = "600 17px sans-serif";
      c.textAlign = "left";
      c.fillText("消息快照", pad, 30);
      c.fillStyle = "#9a9aa2";
      c.font = "12px sans-serif";
      c.textAlign = "right";
      const sub = truncateTo(c, `${sessionLabel(session)} · 共 ${rows.length} 条 · ${fmtFull(new Date())}`, W - pad - 96);
      c.fillText(sub, W - pad, 30);
      c.textAlign = "left";
      c.strokeStyle = "rgba(0,0,0,.08)";
      c.beginPath();
      c.moveTo(pad, 44);
      c.lineTo(W - pad, 44);
      c.stroke();

      for (const b of blocks) {
        const m = b.m;
        const isUser = m.role === "user";
        let by = b.top;
        const nameStr = `#${floorOf.get(m.id) || "-"} ${senderName(m, session)}${showTime && pickTs(m) ? "  " + fmtHM(pickTs(m)) : ""}`;
        c.fillStyle = "#94949b";
        c.font = "12px sans-serif";
        if (isUser) {
          c.textAlign = "right";
          c.fillText(nameStr, W - pad, by + 13);
          c.textAlign = "left";
        } else {
          c.fillText(nameStr, pad, by + 13);
        }
        by += nameH;

        if (b.textH) {
          const bx = isUser ? W - pad - b.bubbleW : pad;
          c.fillStyle = isUser ? "#2e2f31" : "#ffffff";
          roundRect(c, bx, by + 2, b.bubbleW, b.textH, 14);
          c.fill();
          if (!isUser) {
            c.strokeStyle = "rgba(0,0,0,.08)";
            c.stroke();
          }
          c.fillStyle = isUser ? "#f5f5f7" : "#2a2b2e";
          c.font = `${FS}px sans-serif`;
          const padT = (b.textH - b.lines.length * lh) / 2;
          b.lines.forEach((ln, i) => {
            c.fillText(ln, bx + 14, by + 2 + padT + FS * 0.78 + i * lh);
          });
          by += b.textH + 5;
        }
        if (b.imgBox) {
          const ix = isUser ? W - pad - b.imgBox.w : pad;
          c.save();
          roundRect(c, ix, by, b.imgBox.w, b.imgBox.h, 12);
          c.clip();
          c.drawImage(b.imgBox.img, ix, by, b.imgBox.w, b.imgBox.h);
          c.restore();
          c.strokeStyle = "rgba(0,0,0,.08)";
          roundRect(c, ix, by, b.imgBox.w, b.imgBox.h, 12);
          c.stroke();
          by += b.imgBox.h + 6;
        }
        if (b.tag && !b.imgBox) {
          c.font = "12px sans-serif";
          const tw = c.measureText(b.tag).width + 22;
          const tx = isUser ? W - pad - tw : pad;
          c.fillStyle = "rgba(0,0,0,.06)";
          roundRect(c, tx, by, tw, 24, 8);
          c.fill();
          c.fillStyle = "#6a6a70";
          c.fillText(b.tag, tx + 11, by + 16);
        }
      }

      c.fillStyle = "#9a9aa2";
      c.font = "12px sans-serif";
      c.textAlign = "center";
      c.fillText(`消息快照生成 · ${fmtFull(new Date())}`, W / 2, totalH - 16);
      c.textAlign = "left";
      return cv;
    }

    function downloadCanvas(cv, filename) {
      return new Promise((resolve, reject) => {
        if (cv.toBlob) {
          cv.toBlob((blob) => {
            if (!blob) { reject(new Error("图片编码失败")); return; }
            downloadBlob(blob, filename);
            resolve();
          }, "image/png");
        } else {
          const a = document.createElement("a");
          a.href = cv.toDataURL("image/png");
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          resolve();
        }
      });
    }

    // ========== 主浮层 ==========
    function openSnapshot(sid) {
      ctx.ui.openModal((root, { close }) => {
        root.className = "cs-root";
        root.style.cssText = "padding:0!important;background:transparent!important;box-shadow:none!important;border:none!important;";
        const session = getSession(sid);
        const selected = new Set();
        let roleFilter = "all";   // all | user | assistant
        let view = "list";        // list | contacts
        let busy = false;
        let kw = "";
        let contactListEl = null;
        let countEl = null, btnTxt = null, btnImg = null, btnFwd = null;
        let scrollToId = null;

        // 每次操作都重新取数：已删除/其他角色会话的消息不会混入
        const latestAll = () => collectMessages(sid);
        const selectedRows = () => latestAll().filter((m) => selected.has(m.id));
        const floorMapOf = (arr) => new Map(arr.map((m, i) => [m.id, i + 1]));
        const visibleByFilter = (m) =>
          roleFilter === "all" ||
          (roleFilter === "user" && m.role === "user") ||
          (roleFilter === "assistant" && m.role === "assistant");

        function syncFoot() {
          const n = selectedRows().length; // 实时计数：已删除消息不计入
          if (countEl) countEl.textContent = `已选 ${n} 条`;
          [btnTxt, btnImg, btnFwd].forEach((b) => {
            if (b) b.disabled = n === 0 || busy;
          });
        }

        // ---- 工具条 ----
        function buildTools() {
          const box = el("div", "cs-tools");
          const allBtn = el("button", "cs-mini", "全选");
          allBtn.type = "button";
          allBtn.addEventListener("click", () => {
            latestAll().filter(visibleByFilter).forEach((m) => selected.add(m.id));
            render();
          });
          const clearBtn = el("button", "cs-mini", "清空");
          clearBtn.type = "button";
          clearBtn.addEventListener("click", () => { selected.clear(); render(); });

          const sep1 = el("span", "cs-sep", "|");
          const tip = el("span", null, "楼层");
          const i1 = el("input", "cs-mini");
          i1.type = "number";
          i1.min = "1";
          i1.placeholder = "起";
          const dash = el("span", "cs-sep", "-");
          const i2 = el("input", "cs-mini");
          i2.type = "number";
          i2.min = "1";
          i2.placeholder = "止";
          const rangeBtn = el("button", "cs-mini", "选定范围");
          rangeBtn.type = "button";
          rangeBtn.addEventListener("click", () => {
            const total = latestAll();
            let a = parseInt(i1.value, 10);
            let b = parseInt(i2.value, 10);
            if (!Number.isFinite(a) || !Number.isFinite(b)) {
              ctx.ui.toast(`输入楼层范围，例如 1 到 ${total.length || "?"}`);
              return;
            }
            if (a > b) { const t = a; a = b; b = t; }
            a = Math.max(1, Math.min(a, total.length));
            b = Math.max(1, Math.min(b, total.length));
            for (let i = a - 1; i < b; i++) selected.add(total[i].id);
            roleFilter = "all";
            scrollToId = total[a - 1] ? total[a - 1].id : null;
            render();
            ctx.ui.toast(`已选中 ${a}-${b} 楼，共 ${b - a + 1} 条`);
          });

          const sep2 = el("span", "cs-sep", "|");
          const sel = el("select", "cs-mini");
          [["all", "全部消息"], ["user", "只看我"], ["assistant", "只看TA"]].forEach(([v, label]) => {
            const op = document.createElement("option");
            op.value = v;
            op.textContent = label;
            if (v === roleFilter) op.selected = true;
            sel.appendChild(op);
          });
          sel.addEventListener("change", () => { roleFilter = sel.value; render(); });

          box.append(allBtn, clearBtn, sep1, tip, i1, dash, i2, rangeBtn, sep2, sel);
          return box;
        }

        // ---- 消息列表 ----
        function renderMessageList(listEl) {
          listEl.innerHTML = "";
          const all = latestAll();
          const floorOf = floorMapOf(all);
          const vis = all.filter(visibleByFilter);
          if (!vis.length) {
            listEl.appendChild(el("div", "cs-empty", all.length ? "该筛选下暂无消息" : "当前会话暂无可导出的消息"));
            return;
          }
          const frag = document.createDocumentFragment();
          vis.forEach((m) => {
            const item = el("div", "cs-item" + (selected.has(m.id) ? " cs-on" : ""));
            item.dataset.mid = m.id;
            item.append(
              el("span", "cs-dot", "✓"),
              el("span", "cs-floor", "#" + floorOf.get(m.id)),
              (() => {
                const body = el("div", "cs-body");
                const head = `${senderName(m, session)}${pickTs(m) ? " · " + fmtHM(pickTs(m)) : ""}`;
                body.appendChild(el("div", "cs-name", head));
                body.appendChild(el("div", "cs-txt", msgText(m) || guessMediaTag(m) || "[空]"));
                return body;
              })()
            );
            item.addEventListener("click", () => {
              if (busy) return;
              if (selected.has(m.id)) selected.delete(m.id);
              else selected.add(m.id);
              item.classList.toggle("cs-on");
              syncFoot();
            });
            frag.appendChild(item);
          });
          listEl.appendChild(frag);
          if (scrollToId) {
            try {
              const mid = (window.CSS && CSS.escape) ? CSS.escape(scrollToId) : scrollToId.replace(/["\\]/g, "");
              const target = listEl.querySelector(`[data-mid="${mid}"]`);
              if (target) target.scrollIntoView({ block: "center", behavior: "smooth" });
            } catch { /* 滚动定位仅为增强，失败忽略 */ }
            scrollToId = null;
          }
        }

        // ---- 底部操作条 ----
        function buildFoot() {
          const foot = el("div", "cs-foot");
          countEl = el("span", "cs-count", "已选 0 条");
          btnTxt = el("button", "cs-btn", "导出TXT");
          btnTxt.type = "button";
          btnTxt.addEventListener("click", doTxt);
          btnFwd = el("button", "cs-btn", "转发私聊");
          btnFwd.type = "button";
          btnFwd.addEventListener("click", () => { view = "contacts"; kw = ""; render(); });
          btnImg = el("button", "cs-btn cs-primary", "生成长图");
          btnImg.type = "button";
          btnImg.addEventListener("click", doImage);
          foot.append(countEl, btnTxt, btnFwd, btnImg);
          return foot;
        }

        // ---- TXT 导出 ----
        function doTxt() {
          if (busy) return;
          const rows = selectedRows();
          if (!rows.length) { ctx.ui.toast("所选消息已不存在"); return; }
          const floorOf = floorMapOf(latestAll());
          const showTime = ctx.system.settings.get("showTime") !== false;
          const out = [`【消息快照】${sessionLabel(session)} · ${fmtFull(new Date())}`, `共 ${rows.length} 条`, "———————————————"];
          rows.forEach((m) => {
            out.push(`#${floorOf.get(m.id) || "-"} ${senderName(m, session)}${showTime && pickTs(m) ? " ｜ " + fmtHM(pickTs(m)) : ""}`);
            out.push(msgText(m) || guessMediaTag(m) || "[空消息]");
            out.push("");
          });
          const blob = new Blob(["\ufeff" + out.join("\n")], { type: "text/plain;charset=utf-8" });
          downloadBlob(blob, `消息快照_${safeName(sessionLabel(session))}_${fileStamp()}.txt`);
          ctx.ui.toast("TXT 已开始下载");
        }

        // ---- 长图导出 ----
        async function doImage() {
          if (busy) return;
          busy = true;
          render();
          const loading = ctx.ui.toast("正在生成长图…", { durationMs: 0 });
          try {
            const rows = selectedRows();
            if (!rows.length) throw new Error("所选消息已不存在");
            const cv = await buildCanvas(rows, floorMapOf(latestAll()), session);
            if (!cv) return;
            await downloadCanvas(cv, `消息快照_${safeName(sessionLabel(session))}_${fileStamp()}.png`);
            ctx.ui.toast("长图已开始下载");
          } catch (e) {
            try { ctx.system.log("chat-snapshot 长图失败", e); } catch {}
            ctx.ui.toast("生成失败：" + ((e && e.message) || e));
          } finally {
            loading.close();
            busy = false;
            render();
          }
        }

        // ---- 联系人拉取（多字段/异步/会话兜底，兼容不同宿主结构） ----
        function toArray(v) {
          if (Array.isArray(v)) return v;
          if (v && typeof v.then === "function") return v; // Promise 交给 awaitList
          if (v && Array.isArray(v.list)) return v.list;
          if (v && Array.isArray(v.contacts)) return v.contacts;
          if (v && Array.isArray(v.items)) return v.items;
          if (v && Array.isArray(v.records)) return v.records;
          if (v && Array.isArray(v.data)) return v.data;
          return [];
        }
        async function awaitList(v) {
          let r = toArray(v);
          if (r && typeof r.then === "function") { try { r = await r; } catch { r = []; } }
          return toArray(r);
        }
        function isGroupSession(s) {
          if (s.isGroup === true || s.is_group === true) return true;
          const t = String(s.type ?? s.sessionType ?? s.chatType ?? s.session_type ?? "").toLowerCase();
          return t.includes("group");
        }
        function peerIdsOf(s) {
          return new Set([s.contactId, s.contact_id, s.contactID, s.peerId, s.peer_id, s.targetId, s.target_id, s.buddyId, s.userId]
            .filter((v) => v != null).map(String));
        }
        function contactIdOf(c) {
          const v = c.id ?? c.contactId ?? c.contact_id ?? c.uid ?? c.userId ?? c.peerId ?? c.username;
          return v == null ? "" : String(v);
        }
        function contactNameOf(c) {
          return c.name || c.nickname || c.remark || c.remarkName || c.title || c.displayName || c.userName || c.username || "";
        }
        async function buildContactItems() {
          let contacts = [], sessions = [];
          try { contacts = await awaitList(ctx.data.contacts.list()); } catch { contacts = []; }
          try { sessions = await awaitList(ctx.data.sessions.list()); } catch { sessions = []; }
          // 非群聊会话一律视为可转发的私聊目标
          const priv = sessions.filter((s) => s && !isGroupSession(s));
          try { ctx.system.log(`消息快照：读取联系人 ${contacts.length} 个，会话 ${sessions.length} 个，私聊 ${priv.length} 个`); } catch {}
          const used = new Set();
          const items = [];
          contacts.forEach((c) => {
            if (!c) return;
            const cid = contactIdOf(c);
            let sid = c.sessionId || c.session_id || null;
            if (!sid && cid) {
              const hit = priv.find((s) => peerIdsOf(s).has(cid));
              sid = hit ? hit.id : null;
            }
            if (sid) used.add(sid);
            items.push({ id: cid || contactNameOf(c) || "c" + items.length, name: contactNameOf(c) || "未命名联系人", sid });
          });
          // 兜底：联系人接口为空或匹配不上时，私聊会话本身就是转发目标
          priv.forEach((s) => {
            if (!used.has(s.id)) items.push({ id: s.id, name: sessionLabel(s), sid: s.id });
          });
          items.sort((a, b) => (a.sid ? 0 : 1) - (b.sid ? 0 : 1) || a.name.localeCompare(b.name, "zh"));
          return items;
        }

        function buildSearchBar() {
          const box = el("div", "cs-tools");
          const inp = el("input", "cs-mini");
          inp.type = "text";
          inp.placeholder = "搜索联系人";
          inp.style.width = "100%";
          inp.style.boxSizing = "border-box";
          inp.value = kw;
          inp.addEventListener("input", () => {
            kw = inp.value.trim();
            if (contactListEl) renderContactList();
          });
          box.appendChild(inp);
          return box;
        }

        let contactReqSeq = 0;
        async function renderContactList() {
          if (!contactListEl) return;
          const seq = ++contactReqSeq;
          contactListEl.innerHTML = "";
          contactListEl.appendChild(el("div", "cs-empty", "正在读取联系人…"));
          let allItems = [];
          try { allItems = await buildContactItems(); } catch (e) {
            try { ctx.system.log("消息快照：联系人读取失败", e); } catch {}
            allItems = [];
          }
          if (!contactListEl || seq !== contactReqSeq) return; // 已被新一次渲染取代
          contactListEl.innerHTML = "";
          const items = allItems.filter((it) => !kw || it.name.includes(kw));
          if (!items.length) {
            contactListEl.appendChild(el("div", "cs-empty", allItems.length ? "没有匹配的联系人" : "未读到联系人：请确认小手机内存在私聊会话"));
            return;
          }
          items.forEach((it) => {
            const row = el("div", "cs-citem");
            const info = el("div", "cs-cinfo");
            info.appendChild(el("div", "cs-cname", it.name));
            info.appendChild(el("div", "cs-csub", it.sid ? "私聊会话" : "暂无聊天会话，不可转发"));
            const send = el("button", "cs-btn", it.sid ? "发送" : "不可用");
            send.type = "button";
            send.disabled = !it.sid || selectedRows().length === 0;
            let armed = false;
            let timer = null;
            send.addEventListener("click", async () => {
              if (!it.sid || busy) return;
              if (!armed) {
                armed = true;
                send.textContent = "确认发送";
                send.classList.add("cs-warn");
                timer = setTimeout(() => {
                  armed = false;
                  send.textContent = "发送";
                  send.classList.remove("cs-warn");
                }, 2200);
                return;
              }
              clearTimeout(timer);
              busy = true;
              send.disabled = true;
              send.textContent = "发送中";
              try {
                await doForward(it.sid, it.name);
              } catch (e) {
                try { ctx.system.log("chat-snapshot 转发失败", e); } catch {}
                ctx.ui.toast("转发失败：" + ((e && e.message) || e));
                busy = false;
                render();
              }
            });
            row.append(info, send);
            contactListEl.appendChild(row);
          });
        }

        function buildContactFoot() {
          const foot = el("div", "cs-foot");
          foot.appendChild(el("span", "cs-count", `将转发 ${selectedRows().length} 条`));
          const back = el("button", "cs-btn cs-primary", "返回选择");
          back.type = "button";
          back.addEventListener("click", () => { view = "list"; render(); });
          foot.appendChild(back);
          return foot;
        }

        async function doForward(targetSid, name) {
          const rows = selectedRows();
          if (!rows.length) { ctx.ui.toast("所选消息已不存在"); return; }
          const floorOf = floorMapOf(latestAll());
          const showTime = ctx.system.settings.get("showTime") !== false;
          const parts = [`【消息快照 · 转发自「${sessionLabel(session)}」共 ${rows.length} 条】`, "———————————————"];
          rows.forEach((m) => {
            parts.push(`#${floorOf.get(m.id) || "-"} ${senderName(m, session)}${showTime && pickTs(m) ? " ｜ " + fmtHM(pickTs(m)) : ""}`);
            parts.push(msgText(m) || guessMediaTag(m) || "[空消息]");
            parts.push("———————————————");
          });
          const text = parts.join("\n");
          // 折叠卡片：由 messageKind("snapshot-forward") 渲染，默认收起点击展开；content 作为纯文本降级
          const payload = {
            sessionId: targetSid,
            role: "user",
            content: text,
            mediaType: "plugin:snapshot-forward",
            mediaData: { from: sessionLabel(session), count: rows.length, time: fmtFull(new Date()), text },
          };
          // 补全目标会话的常见字段，提高不同宿主下 push 的成功率
          let target = null;
          try { target = (await awaitList(ctx.data.sessions.list())).find((s) => s && s.id === targetSid) || null; } catch { target = null; }
          if (target) {
            payload.isGroup = target.isGroup === true;
            if (target.contactId != null) payload.contactId = target.contactId;
            else if (target.contact_id != null) payload.contactId = target.contact_id;
          } else {
            payload.isGroup = false;
          }
          await ctx.data.messages.push(payload);
          ctx.ui.toast(`已转发给 ${name}`);
          close();
        }

        // ---- 整体渲染 ----
        function render() {
          root.innerHTML = "";
          const modal = el("div", "cs-modal");
          const head = el("div", "cs-head");
          head.appendChild(el("div", "cs-title", view === "list" ? `消息快照 · ${sessionLabel(session)}` : "转发给联系人"));
          const x = el("button", "cs-iconbtn", "×");
          x.type = "button";
          x.addEventListener("click", close);
          head.appendChild(x);
          modal.appendChild(head);

          modal.appendChild(view === "list" ? buildTools() : buildSearchBar());
          const listEl = el("div", "cs-list");
          modal.appendChild(listEl);

          if (view === "list") {
            renderMessageList(listEl);
            modal.appendChild(buildFoot());
          } else {
            contactListEl = listEl;
            renderContactList();
            modal.appendChild(buildContactFoot());
          }
          root.appendChild(modal);
          syncFoot();
        }

        render();
      });
    }
  },
};
