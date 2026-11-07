/**
 * 苹果实况动图与短视频 (Live Photo & Video) v2.5.0
 * 基于 v2.4.0 原版架构修改
 * 规范：apiVersion 1 (ES Module)
 */

const plugin = {
  manifest: {
    id: "live-photo-sender-v2",
    name: "Live Photo & Video Sending",
    apiVersion: 1,
    version: "2.5.0",
    author: "可丽饼＆Gemini",
    description: "向角色发送苹果 Live Photo 或视频，支持最高 60 帧动作切片供AI视觉识别；悬浮球快捷发送，点击卡片全屏放大，相册支持折叠与滑动多选管理。",
    permissions: ["chat.read", "chat.write", "ai", "storage", "ui"],
    settings: [
      { key: "autoPlay", label: "聊天卡片自动循环播放", type: "boolean", default: true },
      {
        key: "frameCount",
        label: "默认动作抓取帧数（视频将自动按 1秒=1帧 识别）",
        type: "select",
        default: "8",
        options: [
          { value: "4", label: "4 帧（基础动作）" },
          { value: "6", label: "6 帧" },
          { value: "8", label: "8 帧 (推荐)" },
          { value: "10", label: "10 帧" },
          { value: "15", label: "15 帧" },
          { value: "20", label: "20 帧" },
          { value: "25", label: "25 帧" },
          { value: "30", label: "30 帧" },
          { value: "35", label: "35 帧" },
          { value: "40", label: "40 帧" },
          { value: "45", label: "45 帧" },
          { value: "50", label: "50 帧" },
          { value: "55", label: "55 帧" },
          { value: "60", label: "60 帧" }
        ]
      }
    ]
  },

  setup: function (ctx) {
    let currentSessionId = null;
    const HISTORY_KEY = "live_photo_history_v1";
    const POS_KEY = "live_photo_float_pos_v1";
    const FLOAT_BALL_ID = "lp-floating-ball-v25";

    // 苹果蓝实况同心圆图标 (#007aff)
    const LIVE_BLUE_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#007aff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
      <circle cx="12" cy="12" r="3" fill="#007aff" stroke="none"></circle>
      <circle cx="12" cy="12" r="7" stroke-dasharray="2 3"></circle>
      <circle cx="12" cy="12" r="10" stroke-width="1.5"></circle>
    </svg>`;

    // 悬浮球大号苹果蓝实况图标 (#007aff)
    const FLOAT_BALL_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#007aff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3.5" fill="#007aff" stroke="none"></circle>
      <circle cx="12" cy="12" r="7.5" stroke-dasharray="2.2 3.2"></circle>
      <circle cx="12" cy="12" r="10.5" stroke-width="1.6"></circle>
    </svg>`;

    // 苹果蓝暂停图标 (#007aff) - 用于 >10帧
    const PAUSE_BLUE_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#007aff" style="flex-shrink:0;">
      <rect x="6" y="4" width="4" height="16" rx="1.2"></rect>
      <rect x="14" y="4" width="4" height="16" rx="1.2"></rect>
    </svg>`;

    // ── 0. 注入全局样式 ───────────────────────────────────────
    const removeCSS = ctx.ui.injectCSS(`
      /* 纯净角标容器 */
      .lp-badge-live {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 2;
        background: rgba(0, 0, 0, 0.58);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.3px;
        color: #ffffff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        pointer-events: none;
      }
      /* 聊天气泡实况卡片点击放大效果 */
      .lp-chat-card-media {
        position: relative;
        background: #000;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 160px;
        cursor: zoom-in;
        transition: transform 0.15s ease, opacity 0.15s ease;
      }
      .lp-chat-card-media:hover {
        opacity: 0.95;
      }
      .lp-chat-card-media:active {
        transform: scale(0.98);
      }
      /* 已删除提示气泡容器样式 */
      .lp-chat-deleted-card {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px dashed rgba(255, 255, 255, 0.18);
        border-radius: 10px;
        color: rgba(255, 255, 255, 0.55);
        font-size: 12px;
        line-height: 1.4;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        user-select: none;
        backdrop-filter: blur(4px);
      }
      /* 相册卡片（强制 flex-shrink: 0，杜绝多条记录时被挤瘪） */
      .lp-manage-card {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        background: #111317;
        border: 2px solid rgba(255,255,255,0.08);
        transition: all 0.15s ease;
        flex-shrink: 0;
      }
      .lp-manage-card.selected {
        border-color: #007aff;
        box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.35);
      }
      .lp-manage-card .lp-check-mark {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(0,0,0,0.6);
        border: 1.5px solid #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: #fff;
        font-weight: bold;
        pointer-events: none;
      }
      .lp-manage-card.selected .lp-check-mark {
        background: #007aff;
        border-color: #007aff;
      }
      /* 相册专属平滑滚动条 */
      .lp-scroll-container::-webkit-scrollbar {
        width: 6px;
      }
      .lp-scroll-container::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.03);
        border-radius: 3px;
      }
      .lp-scroll-container::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
      }
      .lp-scroll-container::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.35);
      }

      /* 可拖拽贴边半隐藏悬浮球 */
      #${FLOAT_BALL_ID} {
        position: fixed;
        z-index: 9990;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(24, 26, 32, 0.85);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1.5px solid rgba(0, 122, 255, 0.5);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.32);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease, left 0.25s ease, right 0.25s ease;
      }
      #${FLOAT_BALL_ID}:active {
        cursor: grabbing;
        transform: scale(0.94) !important;
      }
      #${FLOAT_BALL_ID}.dock-left {
        transform: translateX(-52%);
        opacity: 0.68;
      }
      #${FLOAT_BALL_ID}.dock-right {
        transform: translateX(52%);
        opacity: 0.68;
      }
      #${FLOAT_BALL_ID}.dock-left:hover,
      #${FLOAT_BALL_ID}.dock-right:hover,
      #${FLOAT_BALL_ID}.dragging {
        transform: translateX(0) !important;
        opacity: 1 !important;
      }

      /* 下移后的通知弹窗（距顶部 140px） */
      .lp-down-toast {
        position: fixed;
        top: 140px !important;
        left: 50%;
        transform: translateX(-50%) translateY(-10px);
        z-index: 20010;
        background: rgba(24, 26, 32, 0.94);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        color: #fff;
        padding: 9px 20px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 255, 255, 0.12);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .lp-down-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    `);

    // 自定义下移通知弹窗（距顶部 140px）
    function showDownToast(text = "已发送", durationMs = 1800) {
      try {
        const old = document.querySelector(".lp-down-toast");
        if (old) old.remove();

        const el = document.createElement("div");
        el.className = "lp-down-toast";
        el.innerHTML = `${LIVE_BLUE_SVG}<span>${escapeHtml(text)}</span>`;
        document.body.appendChild(el);

        requestAnimationFrame(() => el.classList.add("show"));
        setTimeout(() => {
          el.classList.remove("show");
          setTimeout(() => el.remove(), 220);
        }, durationMs);
      } catch (e) {
        ctx.ui.toast(text);
      }
    }

    // ── 1. 跟踪当前所在会话 ────────────────────────────────────
    const offSessionOpened = ctx.hooks.on("session.opened", ({ sessionId }) => {
      if (sessionId) currentSessionId = sessionId;
    });

    // 辅助通过 chat.header 槽位实时同步当前 sessionId
    const offHeaderSlot = ctx.ui.slot("chat.header", (el, props) => {
      if (props && props.sessionId) {
        currentSessionId = props.sessionId;
      }
      el.style.display = "none";
    });

    async function getActiveSessionId() {
      if (currentSessionId) return currentSessionId;
      const match = window.location.hash.match(/session[=/]([a-zA-Z0-9_-]+)/);
      if (match) {
        currentSessionId = match[1];
        return currentSessionId;
      }
      try {
        const list = await ctx.data.sessions.list();
        if (Array.isArray(list) && list.length > 0) {
          currentSessionId = list[0].id;
          return currentSessionId;
        }
      } catch (e) {}
      return null;
    }

    // 辅助生成「已删除」状态的 HTML 结构
    function renderDeletedHTML() {
      return `
        <div class="lp-chat-deleted-card">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.75;flex-shrink:0;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
          <span>该 Live/Video 已被删除</span>
        </div>
      `;
    }

    // 动态生成角标（>10帧仅显示蓝色暂停键图标，≤10帧显示蓝色实况图标 + 小写 live）
    function renderBadge(frameCount, extraStyle = "") {
      const count = Number(frameCount) || 1;
      if (count > 10) {
        return `
          <div class="lp-badge-live" style="padding:4px 7px;${extraStyle}">
            ${PAUSE_BLUE_SVG}
          </div>
        `;
      }
      return `
        <div class="lp-badge-live" style="${extraStyle}">
          ${LIVE_BLUE_SVG}<span style="text-transform:lowercase;">live</span>
        </div>
      `;
    }

    // ── 核心：联动同步删除聊天消息（带删除占位提示） ─────────
    async function deleteLinkedMessages(records) {
      const targets = Array.isArray(records) ? records : [records];
      for (const item of targets) {
        const msgId = item.msgId;
        const sid = item.sessionId || currentSessionId;
        if (!msgId) continue;

        try {
          if (typeof ctx.data?.messages?.update === "function") {
            await ctx.data.messages.update(msgId, {
              content: "[该 Live/Video 已被删除]",
              rawContent: JSON.stringify({ deleted: true }),
              mediaType: "plugin:livephoto",
              mediaData: { deleted: true }
            });
          }
        } catch (e) {
          console.warn("[LivePhoto] messages.update failed:", e);
        }

        try {
          const doms = document.querySelectorAll(
            `[data-message-id="${msgId}"] .lp-chat-live-root, [data-msg-id="${msgId}"] .lp-chat-live-root, [data-lp-msg-id="${msgId}"]`
          );
          doms.forEach((dom) => {
            dom.innerHTML = renderDeletedHTML();
          });
        } catch (_) {}

        try {
          window.dispatchEvent(new CustomEvent("chat:message:updated", { detail: { messageId: msgId, sessionId: sid } }));
        } catch (_) {}
      }
    }

    // ── 放大查看实况全屏弹窗 ──────────────────────────────────
    function openLightbox(data) {
      const videoSrc = data.videoSrc || "";
      const imgSrc = data.imgSrc || (data.frames && data.frames[0]) || "";
      const fCount = data.frames ? data.frames.length : 1;

      ctx.ui.openModal((modalEl, { close }) => {
        modalEl.style.cssText = `
          width: min(94vw, 560px);
          max-height: 92vh;
          background: rgba(18, 20, 26, 0.96);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          position: relative;
        `;

        modalEl.innerHTML = `
          <div style="position:absolute;top:12px;right:12px;z-index:10;">
            <button id="lpLightboxClose" style="width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,0.6);border:1px solid rgba(255,255,255,0.2);color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;cursor:pointer;">✕</button>
          </div>
          <div style="position:relative;background:#000;display:flex;align-items:center;justify-content:center;max-height:82vh;overflow:hidden;">
            ${renderBadge(fCount, "top:12px;left:12px;")}
            ${
              videoSrc
                ? `<video src="${videoSrc}" controls autoplay loop playsinline webkit-playsinline style="width:100%;max-height:82vh;object-fit:contain;display:block;"></video>`
                : `<img src="${imgSrc}" style="width:100%;max-height:82vh;object-fit:contain;display:block;" />`
            }
          </div>
        `;

        const closeBtn = modalEl.querySelector("#lpLightboxClose");
        if (closeBtn) closeBtn.onclick = close;
      });
    }

    // ── 2. 注册自定义消息卡片：plugin:livephoto ─────────────────
    const offKind = ctx.ui.messageKind("livephoto", (el, msg) => {
      let data = {};
      try {
        data = typeof msg.rawContent === "string" ? JSON.parse(msg.rawContent) : (msg.mediaData || {});
      } catch {
        data = msg.mediaData || {};
      }

      const msgId = msg.id || "";
      if (msgId) {
        el.setAttribute("data-lp-msg-id", msgId);
      }

      // 兼容已被删除状态
      if (data.deleted || msg.content === "[该 Live/Video 已被删除]" || msg.content === "[该实况已被删除]") {
        el.style.display = "block";
        el.innerHTML = renderDeletedHTML();
        return;
      }

      const videoSrc = data.videoSrc || "";
      const imgSrc = data.imgSrc || (data.frames && data.frames[0]) || "";
      const fCount = data.frames ? data.frames.length : 1;
      const autoPlay = ctx.system.settings.get("autoPlay") !== false;

      // 纯净画面卡片：无底部文字遮罩，点击直接放大查看
      el.style.display = "block";
      el.innerHTML = `
        <div class="lp-chat-live-root" style="max-width:230px;border-radius:14px;overflow:hidden;background:#181a20;border:1px solid rgba(255,255,255,0.08);box-shadow:0 4px 12px rgba(0,0,0,0.25);font-family:-apple-system,BlinkMacSystemFont,sans-serif;">
          <div class="lp-chat-card-media" title="点击放大查看">
            ${renderBadge(fCount)}
            ${
              videoSrc
                ? `<video src="${videoSrc}" ${autoPlay ? "autoplay" : ""} loop muted playsinline webkit-playsinline style="width:100%;max-height:260px;object-fit:cover;display:block;pointer-events:none;"></video>`
                : `<img src="${imgSrc}" style="width:100%;max-height:260px;object-fit:cover;display:block;pointer-events:none;" />`
            }
          </div>
        </div>
      `;

      const mediaEl = el.querySelector(".lp-chat-card-media");
      if (mediaEl) {
        mediaEl.onclick = (e) => {
          e.stopPropagation();
          openLightbox(data);
        };
      }
    });

    // ── 3. 可拖拽贴边半隐藏悬浮球（唯一发送入口） ──────────────
    function mountFloatingBall() {
      const old = document.getElementById(FLOAT_BALL_ID);
      if (old) old.remove();

      let pos = { top: 220, side: "right" };
      try {
        const saved = ctx.system.storage.get(POS_KEY);
        if (saved && typeof saved.top === "number") pos = saved;
      } catch (e) {}

      const ball = document.createElement("div");
      ball.id = FLOAT_BALL_ID;
      ball.title = "发送 Live / Video";
      ball.innerHTML = FLOAT_BALL_SVG;

      const applyPos = () => {
        const maxTop = Math.max(60, window.innerHeight - 64);
        const clampedTop = Math.min(maxTop, Math.max(52, pos.top));
        ball.style.top = `${clampedTop}px`;
        if (pos.side === "left") {
          ball.style.left = "0px";
          ball.style.right = "auto";
          ball.classList.add("dock-left");
          ball.classList.remove("dock-right");
        } else {
          ball.style.right = "0px";
          ball.style.left = "auto";
          ball.classList.add("dock-right");
          ball.classList.remove("dock-left");
        }
      };

      applyPos();
      document.body.appendChild(ball);

      let isDragging = false;
      let hasMoved = false;
      let startX = 0;
      let startY = 0;
      let initRect = null;

      const onPointerDown = (e) => {
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        initRect = ball.getBoundingClientRect();
        ball.classList.add("dragging");
        ball.classList.remove("dock-left", "dock-right");
        if (ball.setPointerCapture && e.pointerId !== undefined) {
          try { ball.setPointerCapture(e.pointerId); } catch (_) {}
        }
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
        if (!hasMoved) return;

        const nextLeft = Math.min(window.innerWidth - 44, Math.max(0, initRect.left + dx));
        const nextTop = Math.min(window.innerHeight - 54, Math.max(44, initRect.top + dy));
        ball.style.left = `${nextLeft}px`;
        ball.style.top = `${nextTop}px`;
        ball.style.right = "auto";
      };

      const onPointerUp = async (e) => {
        if (!isDragging) return;
        isDragging = false;
        ball.classList.remove("dragging");
        if (ball.releasePointerCapture && e.pointerId !== undefined) {
          try { ball.releasePointerCapture(e.pointerId); } catch (_) {}
        }

        if (!hasMoved) {
          applyPos();
          const sid = await getActiveSessionId();
          openSendModal(sid);
          return;
        }

        const rect = ball.getBoundingClientRect();
        pos.side = rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right";
        pos.top = rect.top;
        applyPos();
        try { ctx.system.storage.set(POS_KEY, pos); } catch (_) {}
      };

      ball.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);

      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        ball.remove();
      };
    }

    const unmountBall = mountFloatingBall();

    // ── 4. 拦截 LLM 请求：打字发出时注入动作切片（静默不抢答） ──
    const offTransform = ctx.hooks.transform("llm.request", async (payload) => {
      if (!payload.messages || !payload.sessionId) return payload;

      const pendingKey = `pending_live_${payload.sessionId}`;
      const pendingLive = ctx.system.storage.get(pendingKey);

      if (pendingLive && pendingLive.frames && pendingLive.frames.length > 0) {
        const frameCount = pendingLive.frames.length;
        const contentParts = [
          {
            type: "text",
            text: `【用户向你发送了一段 Live Photo 或短视频】\n` +
                  (pendingLive.text ? `画面描述/附言：“${pendingLive.text}”\n` : "") +
                  `下方是你看到的这组影像中按先后顺序提取的 ${frameCount} 张关键动作截片画面。请观察连续画面中人物的动作转变、神态与现场细节，自然地做出真实回应：`
          }
        ];

        pendingLive.frames.forEach((frameUrl) => {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: frameUrl,
              detail: "auto"
            }
          });
        });

        payload.messages.push({
          role: "user",
          content: contentParts
        });

        ctx.system.storage.remove(pendingKey);
      }

      return payload;
    }, { priority: 90, timeoutMs: 40000 });

    // ── 5. 发送实况弹窗（直接 push 上屏并立即刷新） ──────────────
    function openSendModal(sessionId) {
      if (!sessionId) {
        showDownToast("请先进入一个聊天窗口");
        return;
      }

      ctx.ui.openModal((modalEl, { close }) => {
        let selectedFrameCount = parseInt(ctx.system.settings.get("frameCount") || "8", 10);
        let extractedFrames = [];
        let mediaDataUrl = "";
        let isVideo = false;
        let currentFile = null;

        modalEl.style.cssText = `
          width: min(92vw, 420px);
          max-height: 88vh;
          overflow-y: auto;
          background: #181b22;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          border: 1px solid rgba(255,255,255,0.1);
          color: #f3f4f6;
          font-family: -apple-system,BlinkMacSystemFont,sans-serif;
          box-sizing: border-box;
        `;

        modalEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
            <div style="font-size:16px;font-weight:700;color:#fff;display:inline-flex;align-items:center;gap:6px;">
              ${LIVE_BLUE_SVG}<span>发送 Live / Video</span>
            </div>
            <button id="lpCloseBtn" style="background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;padding:4px 8px;">✕</button>
          </div>

          <div id="lpUploadArea" style="border:2px dashed rgba(0,122,255,0.45);border-radius:14px;padding:24px 12px;text-align:center;cursor:pointer;background:rgba(255,255,255,0.02);">
            <input type="file" id="lpFileInput" accept="image/*,video/*" style="display:none;" />
            <div style="color:#007aff;font-size:14px;font-weight:600;">点击选取 Live / Video</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:4px;">支持 .mov / .mp4 / 动图，自动按 1秒=1帧 拆解动作帧</div>
          </div>

          <div id="lpPreviewArea" style="display:none;margin-top:12px;">
            <div style="max-height:180px;border-radius:10px;overflow:hidden;background:#000;display:flex;justify-content:center;position:relative;">
              <video id="lpVideoPreview" loop muted autoplay playsinline webkit-playsinline style="max-height:180px;width:100%;object-fit:contain;display:none;"></video>
              <img id="lpImgPreview" style="max-height:180px;width:100%;object-fit:contain;display:none;" />
              <div id="lpPreviewBadgeContainer">${renderBadge(selectedFrameCount)}</div>
            </div>

            <!-- 帧数手动修改输入框（1~60帧） -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:12px;color:#9ca3af;">
              <span>拆解帧数（≤10帧显示 live，>10帧显示暂停标）：</span>
              <input type="number" id="lpFrameInput" min="1" max="60" value="${selectedFrameCount}" style="width:68px;background:#111;color:#fff;border:1px solid #333;border-radius:6px;padding:4px 8px;font-size:12px;outline:none;text-align:center;" />
            </div>

            <div id="lpFrameList" style="display:grid;grid-template-columns:repeat(5, 1fr);gap:4px;margin-top:8px;max-height:110px;overflow-y:auto;padding-right:4px;"></div>
          </div>

          <div style="margin-top:12px;">
            <textarea id="lpCaption" placeholder="画面描述或附言（供AI识别理解，不在气泡表面露出）..." style="width:100%;height:56px;background:#111317;border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#fff;padding:8px;font-size:13px;resize:none;box-sizing:border-box;outline:none;"></textarea>
          </div>

          <div style="margin-top:14px;display:flex;gap:10px;">
            <button id="lpCancelBtn" style="flex:1;height:38px;border-radius:19px;border:1px solid rgba(255,255,255,0.1);background:#22252d;color:#9ca3af;font-size:14px;cursor:pointer;">取消</button>
            <button id="lpSubmitBtn" disabled style="flex:2;height:38px;border-radius:19px;border:none;background:#007aff;color:#fff;font-size:14px;font-weight:600;cursor:pointer;opacity:0.5;">发送</button>
          </div>
        `;

        const closeBtn = modalEl.querySelector("#lpCloseBtn");
        const cancelBtn = modalEl.querySelector("#lpCancelBtn");
        closeBtn.onclick = close;
        cancelBtn.onclick = close;

        const uploadArea = modalEl.querySelector("#lpUploadArea");
        const fileInput = modalEl.querySelector("#lpFileInput");
        const previewArea = modalEl.querySelector("#lpPreviewArea");
        const videoPreview = modalEl.querySelector("#lpVideoPreview");
        const imgPreview = modalEl.querySelector("#lpImgPreview");
        const badgeContainer = modalEl.querySelector("#lpPreviewBadgeContainer");
        const frameList = modalEl.querySelector("#lpFrameList");
        const submitBtn = modalEl.querySelector("#lpSubmitBtn");
        const captionInput = modalEl.querySelector("#lpCaption");
        const frameInput = modalEl.querySelector("#lpFrameInput");

        uploadArea.onclick = () => fileInput.click();

        async function runExtract(count) {
          const validCount = Math.min(60, Math.max(1, parseInt(count, 10) || 1));
          selectedFrameCount = validCount;
          frameInput.value = String(validCount);

          try {
            frameList.innerHTML = "";
            badgeContainer.innerHTML = renderBadge(validCount);

            if (isVideo) {
              extractedFrames = await extractFramesFromVideo(videoPreview, validCount);
            } else {
              const compressed = await compressImg(imgPreview);
              extractedFrames = [compressed];
            }

            extractedFrames.forEach((fUrl, idx) => {
              const fEl = document.createElement("div");
              fEl.style.cssText = "aspect-ratio:1;border-radius:6px;overflow:hidden;background:#000;border:1px solid #333;position:relative;";
              fEl.innerHTML = `
                <img src="${fUrl}" style="width:100%;height:100%;object-fit:cover;" />
                <span style="position:absolute;bottom:2px;left:2px;font-size:8px;background:rgba(0,0,0,0.7);color:#fff;padding:1px 3px;border-radius:3px;">#${idx+1}</span>
              `;
              frameList.appendChild(fEl);
            });
          } catch (err) {
            console.warn("[LivePhoto] extract error:", err);
          }
        }

        frameInput.onchange = async (e) => {
          let val = parseInt(e.target.value, 10);
          if (!Number.isFinite(val) || val < 1) val = 1;
          if (val > 60) val = 60;
          e.target.value = String(val);
          selectedFrameCount = val;
          if (currentFile) {
            await runExtract(selectedFrameCount);
          }
        };

        fileInput.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          currentFile = file;

          isVideo = file.type.startsWith("video/") || file.name.toLowerCase().endsWith(".mov");

          try {
            mediaDataUrl = await readFileDataUrl(file);

            if (isVideo) {
              imgPreview.style.display = "none";
              videoPreview.style.display = "block";
              videoPreview.src = mediaDataUrl;

              await new Promise((res) => {
                const timer = setTimeout(res, 2000);
                videoPreview.onloadedmetadata = () => {
                  clearTimeout(timer);
                  res();
                };
              });

              // 按 1秒=1帧 自动计算帧数（上限 60 帧）
              const dur = Math.max(1, Math.round(videoPreview.duration || selectedFrameCount));
              selectedFrameCount = Math.min(60, dur);
              frameInput.value = String(selectedFrameCount);

              await videoPreview.play().catch(() => {});
            } else {
              videoPreview.style.display = "none";
              imgPreview.style.display = "block";
              imgPreview.src = mediaDataUrl;
              selectedFrameCount = 1;
              frameInput.value = "1";
            }

            uploadArea.style.display = "none";
            previewArea.style.display = "block";
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";

            await runExtract(selectedFrameCount);
          } catch (err) {
            showDownToast("读取失败，请重试");
          }
        };

        submitBtn.onclick = async () => {
          submitBtn.disabled = true;
          submitBtn.textContent = "发送中...";
          const caption = captionInput.value.trim();

          ctx.system.storage.set(`pending_live_${sessionId}`, {
            frames: extractedFrames,
            text: caption
          });

          const metaPayload = {
            videoSrc: isVideo ? mediaDataUrl : "",
            imgSrc: !isVideo ? mediaDataUrl : (extractedFrames[0] || ""),
            frames: extractedFrames,
            text: caption
          };

          let createdMsg = null;
          try {
            createdMsg = await ctx.data.messages.push({
              sessionId,
              role: "user",
              content: caption ? `[Live/Video] ${caption}` : `[Live/Video]`,
              rawContent: JSON.stringify(metaPayload),
              mediaType: "plugin:livephoto",
              mediaData: metaPayload
            });
          } catch (err) {
            console.error("[LivePhoto] push message error:", err);
          }

          const msgId = createdMsg?.id || (typeof createdMsg === "string" ? createdMsg : null);

          // 立即触发宿主重绘，无需退出聊天重进
          try {
            if (msgId && typeof ctx.data?.messages?.update === "function") {
              await ctx.data.messages.update(msgId, {
                mediaType: "plugin:livephoto",
                mediaData: metaPayload
              });
            }
          } catch (_) {}

          try {
            window.dispatchEvent(new CustomEvent("chat:message:updated", { detail: { messageId: msgId, sessionId } }));
            window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
          } catch (_) {}

          const historyList = ctx.system.storage.get(HISTORY_KEY) || [];
          historyList.unshift({
            id: "rec_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
            msgId: msgId,
            sessionId: sessionId,
            time: Date.now(),
            isVideo: isVideo,
            videoSrc: isVideo ? mediaDataUrl : "",
            imgSrc: !isVideo ? mediaDataUrl : (extractedFrames[0] || ""),
            frames: extractedFrames,
            text: caption
          });
          if (historyList.length > 60) historyList.pop();
          ctx.system.storage.set(HISTORY_KEY, historyList);

          close();
          showDownToast("已发送");
        };
      });
    }

    // ── 6. 相册弹窗（带防挤压、纵向滑动、单选/多选/全选/反选/删除） ───
    function openAlbumModal(onChanged) {
      ctx.ui.openModal((modalEl, { close }) => {
        let isSelecting = false;
        let selectedIds = new Set();

        modalEl.style.cssText = `
          width: min(94vw, 540px);
          height: 82vh;
          max-height: 82vh;
          overflow: hidden;
          background: #181b22;
          border-radius: 18px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          border: 1px solid rgba(255,255,255,0.1);
          color: #f3f4f6;
          font-family: -apple-system,BlinkMacSystemFont,sans-serif;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
        `;

        const render = () => {
          modalEl.innerHTML = "";
          const list = ctx.system.storage.get(HISTORY_KEY) || [];

          const topBar = document.createElement("div");
          topBar.style.cssText = `
            padding: 14px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-shrink: 0;
            flex-wrap: wrap;
            gap: 8px;
          `;

          const titleBox = document.createElement("div");
          titleBox.innerHTML = `
            <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;">Live/Video 相册</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:2px;">共 ${list.length} 条记录（上下滑动浏览，删除后聊天框将同步提示已删除）</div>
          `;
          topBar.appendChild(titleBox);

          const rightActions = document.createElement("div");
          rightActions.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;";

          if (list.length > 0) {
            if (!isSelecting) {
              const selBtn = document.createElement("button");
              selBtn.style.cssText = "padding:4px 10px;border-radius:6px;border:1px solid #007aff;background:rgba(0,122,255,0.12);color:#007aff;font-size:12px;font-weight:500;cursor:pointer;";
              selBtn.textContent = "多选管理";
              selBtn.onclick = () => {
                isSelecting = true;
                selectedIds.clear();
                render();
              };
              rightActions.appendChild(selBtn);
            } else {
              const allBtn = document.createElement("button");
              allBtn.style.cssText = "padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#d1d5db;font-size:12px;cursor:pointer;";
              const allChecked = selectedIds.size === list.length && list.length > 0;
              allBtn.textContent = allChecked ? "取消全选" : "全选";
              allBtn.onclick = () => {
                if (allChecked) selectedIds.clear();
                else list.forEach((it) => selectedIds.add(it.id));
                render();
              };
              rightActions.appendChild(allBtn);

              const invBtn = document.createElement("button");
              invBtn.style.cssText = "padding:4px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#d1d5db;font-size:12px;cursor:pointer;";
              invBtn.textContent = "反选";
              invBtn.onclick = () => {
                list.forEach((it) => {
                  if (selectedIds.has(it.id)) selectedIds.delete(it.id);
                  else selectedIds.add(it.id);
                });
                render();
              };
              rightActions.appendChild(invBtn);

              const delBtn = document.createElement("button");
              delBtn.style.cssText = "padding:4px 10px;border-radius:6px;border:none;background:#ef4444;color:#fff;font-size:12px;font-weight:600;cursor:pointer;";
              delBtn.textContent = `删除 (${selectedIds.size})`;
              delBtn.disabled = selectedIds.size === 0;
              if (selectedIds.size === 0) delBtn.style.opacity = "0.5";

              delBtn.onclick = async () => {
                if (selectedIds.size === 0) return;
                if (window.confirm(`确认删除选中的 ${selectedIds.size} 条记录吗？聊天记录中将同步变为“已删除”提示。`)) {
                  const set = new Set(selectedIds);
                  const targets = list.filter((it) => set.has(it.id));

                  await deleteLinkedMessages(targets);

                  const remain = list.filter((it) => !set.has(it.id));
                  ctx.system.storage.set(HISTORY_KEY, remain);
                  selectedIds.clear();
                  isSelecting = false;
                  if (typeof onChanged === "function") onChanged();
                  showDownToast("已批量删除");
                  render();
                }
              };
              rightActions.appendChild(delBtn);

              const doneBtn = document.createElement("button");
              doneBtn.style.cssText = "padding:4px 8px;border-radius:6px;border:none;background:rgba(255,255,255,0.1);color:#d1d5db;font-size:12px;cursor:pointer;";
              doneBtn.textContent = "退出";
              doneBtn.onclick = () => {
                isSelecting = false;
                selectedIds.clear();
                render();
              };
              rightActions.appendChild(doneBtn);
            }
          }

          const closeBtn = document.createElement("button");
          closeBtn.style.cssText = "background:none;border:none;color:#9ca3af;font-size:18px;cursor:pointer;padding:4px 8px;";
          closeBtn.textContent = "✕";
          closeBtn.onclick = close;
          rightActions.appendChild(closeBtn);

          topBar.appendChild(rightActions);
          modalEl.appendChild(topBar);

          const body = document.createElement("div");
          body.className = "lp-scroll-container";
          body.style.cssText = `
            flex: 1 1 0%;
            min-height: 0;
            overflow-y: auto;
            padding: 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
          `;

          if (list.length === 0) {
            body.innerHTML = `<div style="text-align:center;color:#6b7280;font-size:13px;padding:60px 0;">相册暂无 Live/Video 记录</div>`;
          } else {
            list.forEach((item) => {
              const card = document.createElement("div");
              card.className = "lp-manage-card" + (selectedIds.has(item.id) ? " selected" : "");
              card.style.cssText = `
                padding: 10px;
                display: flex;
                align-items: center;
                gap: 12px;
                flex-shrink: 0;
                cursor: ${isSelecting ? "pointer" : "default"};
              `;

              const coverSrc = item.videoSrc ? (item.frames?.[0] || item.videoSrc) : item.imgSrc;
              const timeStr = item.time ? new Date(item.time).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "近期";
              const fCount = item.frames ? item.frames.length : 1;

              card.innerHTML = `
                <div style="width:72px;height:72px;border-radius:8px;overflow:hidden;background:#000;flex-shrink:0;position:relative;cursor:zoom-in;">
                  ${
                    item.videoSrc
                      ? `<video src="${item.videoSrc}" muted playsinline style="width:100%;height:100%;object-fit:cover;pointer-events:none;"></video>`
                      : `<img src="${coverSrc}" style="width:100%;height:100%;object-fit:cover;pointer-events:none;" />`
                  }
                  ${renderBadge(fCount, "top:4px;left:4px;padding:2px 5px;font-size:8px;")}
                </div>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
                  <div style="font-size:11px;color:#9ca3af;">${timeStr} · ${fCount} 帧</div>
                  <div style="font-size:13px;color:#f3f4f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.text || "(无描述)")}</div>
                  <div style="display:flex;gap:8px;margin-top:4px;">
                    <button class="lp-card-del" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:#ef4444;font-size:11px;cursor:pointer;">删除</button>
                  </div>
                </div>
              `;

              const thumbEl = card.querySelector("div:first-child");
              thumbEl.onclick = (e) => {
                e.stopPropagation();
                openLightbox(item);
              };

              if (isSelecting) {
                const mark = document.createElement("div");
                mark.className = "lp-check-mark";
                mark.textContent = selectedIds.has(item.id) ? "✓" : "";
                card.appendChild(mark);

                card.onclick = () => {
                  if (selectedIds.has(item.id)) selectedIds.delete(item.id);
                  else selectedIds.add(item.id);
                  render();
                };
              }

              const dBtn = card.querySelector(".lp-card-del");
              dBtn.onclick = async (e) => {
                e.stopPropagation();
                if (window.confirm("确定从相册删除此条 Live/Video 记录？聊天记录中将同步变为“已删除”提示。")) {
                  await deleteLinkedMessages(item);
                  const remain = list.filter((it) => it.id !== item.id);
                  ctx.system.storage.set(HISTORY_KEY, remain);
                  if (typeof onChanged === "function") onChanged();
                  showDownToast("已删除");
                  render();
                }
              };

              body.appendChild(card);
            });
          }

          modalEl.appendChild(body);
        };

        render();
      });
    }

    // ── 7. 后台设置挂载「相册」折叠入口 ─────────────────────────
    const offSettingsSection = ctx.ui.slot("settings.section", (el) => {
      const renderEntry = () => {
        el.innerHTML = "";
        const container = document.createElement("div");
        container.style.cssText = `
          padding: 12px 16px 14px;
          border-top: 1px solid color-mix(in srgb, var(--c-card-border, #e5e7eb) 20%, transparent);
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
        `;

        const list = ctx.system.storage.get(HISTORY_KEY) || [];
        container.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;">
            ${LIVE_BLUE_SVG}
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--c-text-title, #fff);">相册</div>
              <div style="font-size:11px;opacity:0.6;margin-top:2px;">已存储 ${list.length} 条记录，点击展开滑动管理</div>
            </div>
          </div>
          <button id="lpOpenAlbumBtn" class="ui-btn ui-btn-outline" style="padding:5px 14px;font-size:12px;font-weight:600;min-height:32px;cursor:pointer;">
            打开相册 ›
          </button>
        `;

        container.onclick = () => {
          openAlbumModal(() => renderEntry());
        };

        el.appendChild(container);
      };

      renderEntry();
      return () => { el.innerHTML = ""; };
    });

    // ── 辅助工具函数 ──────────────────────────────────────────
    function readFileDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function extractFramesFromVideo(video, frameCount) {
      const canvas = document.createElement("canvas");
      const ctx2d = canvas.getContext("2d");

      if (video.readyState < 1) {
        await new Promise((res) => {
          const timer = setTimeout(res, 2000);
          video.onloadedmetadata = () => {
            clearTimeout(timer);
            res();
          };
        });
      }

      const dur = video.duration || 1;
      const count = Math.max(1, frameCount || 8);
      const times = [];
      const step = dur / (count + 1);

      for (let i = 1; i <= count; i++) {
        times.push(Math.min(dur - 0.05, step * i));
      }

      let w = video.videoWidth || 360;
      let h = video.videoHeight || 480;
      const maxW = 360;
      if (w > maxW) {
        h = Math.round(h * (maxW / w));
        w = maxW;
      }
      canvas.width = w;
      canvas.height = h;

      const frames = [];
      for (const t of times) {
        video.currentTime = t;
        await new Promise((r) => {
          const fallback = setTimeout(r, 600);
          const handler = () => {
            clearTimeout(fallback);
            video.removeEventListener("seeked", handler);
            r();
          };
          video.addEventListener("seeked", handler);
        });
        ctx2d.drawImage(video, 0, 0, w, h);
        frames.push(canvas.toDataURL("image/jpeg", 0.65));
      }

      video.currentTime = 0;
      video.play().catch(() => {});
      return frames;
    }

    function compressImg(img) {
      return new Promise((resolve) => {
        const doCompress = () => {
          const canvas = document.createElement("canvas");
          const ctx2d = canvas.getContext("2d");
          let w = img.naturalWidth || 360;
          let h = img.naturalHeight || 480;
          const maxW = 360;
          if (w > maxW) {
            h = Math.round(h * (maxW / w));
            w = maxW;
          }
          canvas.width = w;
          canvas.height = h;
          ctx2d.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.65));
        };
        if (!img.complete) img.onload = doCompress;
        else doCompress();
      });
    }

    function escapeHtml(str) {
      return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // ── 卸载清理 ──────────────────────────────────────────────
    return () => {
      removeCSS();
      offSessionOpened();
      offHeaderSlot();
      offKind();
      unmountBall();
      offTransform();
      offSettingsSection();
    };
  }
};

export default plugin;
export const manifest = plugin.manifest;
export const setup = plugin.setup;