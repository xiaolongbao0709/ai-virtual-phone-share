export default {
  manifest: {
    id: "nordic-minimal-snap",
    name: "微光志 Lucent Journal",
    apiVersion: 1,
    version: "3.2.0",
    author: "镜观雪",
    description: "北欧空气感黑白极简摄影悬浮球。轻点直达实时拍照取景，支持指定发送给具体角色名称/备注、相册自动保存与错落画报排版，全矢量SVG且彻底屏蔽误触描述。",
    permissions: ["chat.read", "ai"],
    settings: [
      {
        key: "autoSaveAlbum",
        label: "拍照同时自动保存到本地相册",
        type: "boolean",
        default: true,
      },
      {
        key: "aiVisionPerception",
        label: "AI 画面静默感知 (角色可理解照片内容)",
        type: "boolean",
        default: true,
      },
      {
        key: "defaultFacing",
        label: "默认启动镜头",
        type: "select",
        default: "environment",
        options: [
          { value: "environment", label: "后置环境镜头 (Environment)" },
          { value: "user", label: "前置自拍镜头 (User)" },
        ],
      },
    ],
  },

  setup(ctx) {
    // ==========================================
    // 1. 会话状态追踪与角色名称/备注精准解析
    // ==========================================
    let currentActiveSessionId = null;

    ctx.hooks.on("session.opened", (payload) => {
      if (payload?.sessionId) currentActiveSessionId = payload.sessionId;
    });

    ctx.ui.slot("chat.header", (el, props) => {
      if (props?.sessionId) currentActiveSessionId = props.sessionId;
    });

    ctx.hooks.transform("user.beforeSend", (payload) => {
      if (payload?.sessionId) currentActiveSessionId = payload.sessionId;
      return payload;
    });

    function resolveCurrentSession() {
      if (currentActiveSessionId) return currentActiveSessionId;
      const list = ctx.data.sessions.list();
      return list?.length > 0 ? list[0].id : null;
    }

    // 精准解析会话对应的角色名称或备注（杜绝“当前会话”等笼统字眼）
    function getSessionTargetName(session) {
      if (!session) return "未指定角色";

      // 1. 群聊场景
      if (session.isGroup) {
        return session.groupName ? `${session.groupName} (群聊)` : "群聊会话";
      }

      const targetId = session.contactId || session.characterId;

      // 2. 查找角色库真实姓名与备注
      if (targetId) {
        try {
          const char = ctx.data.characters?.get?.(targetId);
          if (char?.name) return char.remark ? `${char.name} (${char.remark})` : char.name;
        } catch (e) {}

        try {
          const charList = ctx.data.characters?.list?.() || [];
          const foundChar = charList.find((c) => c.id === targetId);
          if (foundChar?.name) return foundChar.remark ? `${foundChar.name} (${foundChar.remark})` : foundChar.name;
        } catch (e) {}

        // 3. 查找联系人列表
        try {
          const contacts = ctx.data.contacts?.list?.() || [];
          const foundContact = contacts.find((c) => c.id === targetId || c.characterId === targetId);
          if (foundContact?.name) return foundContact.remark ? `${foundContact.name} (${foundContact.remark})` : foundContact.name;
        } catch (e) {}
      }

      // 4. 读取会话自带名称
      if (session.contactName) return session.contactName;
      if (session.name) return session.name;

      return "指定角色";
    }

    // ==========================================
    // 2. 全矢量极细线 SVG 图标库（严禁任何 Emoji）
    // ==========================================
    const SVG = {
      lens: `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="3" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="3" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="21" y2="12"/></svg>`,
      flip: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0-4.4-3.6-8-8-8s-8 3.6-8 8c0 2.2.9 4.2 2.3 5.7L4 18"/><path d="M4 14h4v4"/><path d="M4 14c0 4.4 3.6 8 8 8s8-3.6 8-8c0-2.2-.9-4.2-2.3-5.7L20 6"/><path d="M20 10h-4V6"/></svg>`,
      close: `<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
      gallery: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
      send: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
      download: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
      back: `<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
      user: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    };

    // ==========================================
    // 3. 样式注入：北欧极简悬浮球 + 杂志画报排版
    // ==========================================
    ctx.ui.injectCSS(`
      /* 全局杂志西文排印 */
      .lucent-font {
        font-family: -apple-system, BlinkMacSystemFont, "Didot", "Bodoni MT", "Cinzel", "Times New Roman", "PingFang SC", serif;
      }

      /* 灵动空气感悬浮球 */
      .lucent-floating-ball {
        position: fixed;
        z-index: 99990;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.82);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        border: 1px solid rgba(0, 0, 0, 0.08);
        color: #111111;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 10px 30px -4px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.04);
        cursor: grab;
        user-select: none;
        touch-action: none;
        transition: transform 0.12s ease, box-shadow 0.2s ease, opacity 0.2s ease;
      }
      .lucent-floating-ball:active {
        cursor: grabbing;
        transform: scale(0.92);
      }
      .lucent-floating-ball.is-dragging {
        transition: none !important;
        opacity: 0.85;
      }

      /* 杂志气泡画报：纯白底座、错落留白、呼吸浅影、绝无突兀黑线 */
      .lucent-magazine-card {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
        touch-action: pan-y;
        position: relative;
        display: inline-block;
        background: #ffffff;
        color: #111111;
        padding: 12px 12px 18px 12px;
        margin: 4px 0 8px 0;
        max-width: 250px;
        border-radius: 2px;
        box-shadow: 0 12px 30px -10px rgba(0, 0, 0, 0.07), 0 1px 2px rgba(0, 0, 0, 0.02);
        cursor: pointer;
      }
      .lucent-magazine-card:active {
        transform: scale(0.992);
      }

      .lucent-card-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 8px;
        padding: 0 1px;
        font-size: 8px;
        letter-spacing: 1.6px;
        text-transform: uppercase;
        color: #999999;
      }
      .lucent-card-media {
        position: relative;
        overflow: hidden;
        background: #fafafa;
      }
      .lucent-card-img {
        display: block;
        width: 100%;
        height: auto;
        max-height: 320px;
        object-fit: cover;
        pointer-events: none;
        -webkit-user-drag: none;
      }
      .lucent-card-footer {
        margin-top: 10px;
        padding: 0 1px;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .lucent-card-caption {
        font-size: 11.5px;
        line-height: 1.45;
        color: #1a1a1a;
        letter-spacing: 0.2px;
        font-weight: 300;
        word-break: break-word;
      }
      .lucent-card-meta {
        font-size: 7.5px;
        letter-spacing: 1px;
        color: #bbbbbb;
        text-transform: uppercase;
      }

      /* 极简快门环 */
      .lucent-shutter-ring {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: transparent;
        padding: 0;
        transition: transform 0.15s ease, border-color 0.2s;
      }
      .lucent-shutter-core {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #ffffff;
      }
      .lucent-shutter-ring:active {
        transform: scale(0.92);
        border-color: rgba(255, 255, 255, 0.7);
      }
    `);

    // ==========================================
    // 4. 构建全局灵动悬浮球（轻点直接启动实时拍照）
    // ==========================================
    let ballEl = null;

    function initFloatingBall() {
      ballEl = document.createElement("div");
      ballEl.className = "lucent-floating-ball lucent-font";
      ballEl.innerHTML = SVG.lens;

      // 默认位置：右下角
      let posX = window.innerWidth - 62;
      let posY = window.innerHeight - 135;
      ballEl.style.left = `${posX}px`;
      ballEl.style.top = `${posY}px`;

      document.body.appendChild(ballEl);

      let isDragging = false;
      let hasMoved = false;
      let startTouchX = 0;
      let startTouchY = 0;
      let initialLeft = 0;
      let initialTop = 0;

      const onStart = (clientX, clientY) => {
        isDragging = true;
        hasMoved = false;
        startTouchX = clientX;
        startTouchY = clientY;
        initialLeft = ballEl.offsetLeft;
        initialTop = ballEl.offsetTop;
        ballEl.classList.add("is-dragging");
      };

      const onMove = (clientX, clientY) => {
        if (!isDragging) return;
        const dx = clientX - startTouchX;
        const dy = clientY - startTouchY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
          hasMoved = true;
        }
        let nextX = initialLeft + dx;
        let nextY = initialTop + dy;

        // 边界保护
        nextX = Math.max(10, Math.min(window.innerWidth - 56, nextX));
        nextY = Math.max(20, Math.min(window.innerHeight - 70, nextY));

        ballEl.style.left = `${nextX}px`;
        ballEl.style.top = `${nextY}px`;
      };

      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        ballEl.classList.remove("is-dragging");

        // 边缘轻吸附
        const currentX = ballEl.offsetLeft;
        const targetX = currentX < window.innerWidth / 2 ? 14 : window.innerWidth - 60;
        ballEl.style.transition = "left 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
        ballEl.style.left = `${targetX}px`;
        setTimeout(() => {
          ballEl.style.transition = "";
        }, 260);

        // 判定为点击时立即拉起拍照
        if (!hasMoved) {
          openCaptureStudio(resolveCurrentSession());
        }
      };

      // 触摸事件 (移动端)
      ballEl.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) onStart(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      window.addEventListener("touchmove", (e) => {
        if (isDragging && e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: true });

      window.addEventListener("touchend", onEnd);

      // 鼠标事件 (桌面端)
      ballEl.addEventListener("mousedown", (e) => {
        onStart(e.clientX, e.clientY);
        const mouseMove = (ev) => onMove(ev.clientX, ev.clientY);
        const mouseUp = () => {
          onEnd();
          window.removeEventListener("mousemove", mouseMove);
          window.removeEventListener("mouseup", mouseUp);
        };
        window.addEventListener("mousemove", mouseMove);
        window.addEventListener("mouseup", mouseUp);
      });
    }

    initFloatingBall();

    // ==========================================
    // 5. 实时相机取景与发送窗口（清晰展示角色名与备注）
    // ==========================================
    function openCaptureStudio(targetSessionId) {
      let activeStream = null;
      let facingMode = ctx.system.settings.get("defaultFacing") || "environment";
      let currentDataUrl = "";
      const sessions = ctx.data.sessions.list() || [];
      let selectedSessionId = targetSessionId || resolveCurrentSession() || sessions[0]?.id;

      ctx.ui.openModal((modalEl, { close }) => {
        modalEl.className = "lucent-font";
        modalEl.style.cssText = `
          width: 90vw;
          max-width: 360px;
          border-radius: 2px;
          background: #0d0d0d;
          color: #f5f5f5;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0,0,0,0.85);
          padding: 0;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(255,255,255,0.06);
        `;

        modalEl.innerHTML = `
          <div style="padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.04);">
            <div style="font-size:8.5px; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.4);">Lucent Studio</div>
            <div style="display:flex; gap:12px; align-items:center;">
              <button id="std-flip" style="background:none; border:none; color:rgba(255,255,255,0.6); cursor:pointer; padding:4px; display:flex;">${SVG.flip}</button>
              <button id="std-close" style="background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; padding:4px; display:flex;">${SVG.close}</button>
            </div>
          </div>
          
          <div style="position:relative; width:100%; height:320px; background:#000000; overflow:hidden; display:flex; align-items:center; justify-content:center;">
            <video id="std-video" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;"></video>
            <img id="std-preview" style="display:none; width:100%; height:100%; object-fit:cover;" alt="" />
            <div id="std-flash" style="position:absolute; inset:0; background:#ffffff; opacity:0; pointer-events:none; transition:opacity 0.12s ease;"></div>
          </div>

          <div style="padding:16px; display:flex; flex-direction:column; gap:12px; background:#121212;">
            <!-- 指定发送角色：明确展示角色真实名称与备注 -->
            <div style="display:flex; align-items:center; justify-content:space-between; padding:2px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
              <span style="font-size:10px; color:rgba(255,255,255,0.45); display:flex; align-items:center; gap:5px;">
                ${SVG.user} 发送给角色
              </span>
              <select id="std-target-select" style="background:transparent; border:none; color:#ffffff; font-size:11.5px; outline:none; font-family:inherit; text-align:right; max-width:180px;">
                ${sessions.map(s => {
                  const displayName = getSessionTargetName(s);
                  return `<option value="${s.id}" ${s.id === selectedSessionId ? "selected" : ""} style="background:#1a1a1a; color:#fff;">${escapeHtml(displayName)}</option>`;
                }).join("")}
              </select>
            </div>

            <input id="std-caption" type="text" placeholder="Add editorial note..." style="width:100%; box-sizing:border-box; background:transparent; border:none; border-bottom:1px solid rgba(255,255,255,0.1); padding:6px 2px; color:#ffffff; font-size:12px; font-weight:300; letter-spacing:0.4px; outline:none; font-family:inherit;" />

            <!-- 取景中操作 -->
            <div id="std-bar-live" style="display:flex; justify-content:space-between; align-items:center; padding:2px 8px;">
              <label style="cursor:pointer; display:flex; align-items:center; justify-content:center; color:rgba(255,255,255,0.5); padding:6px;" title="本地相册">
                ${SVG.gallery}
                <input id="std-file-input" type="file" accept="image/*" style="display:none;" />
              </label>

              <button id="std-shutter" class="lucent-shutter-ring">
                <div class="lucent-shutter-core"></div>
              </button>

              <div style="width:27px;"></div>
            </div>

            <!-- 拍摄后确认操作 -->
            <div id="std-bar-confirm" style="display:none; justify-content:space-between; align-items:center; padding:2px 4px;">
              <button id="std-retake" style="background:transparent; border:none; color:rgba(255,255,255,0.5); font-size:10px; letter-spacing:1px; text-transform:uppercase; cursor:pointer; display:flex; align-items:center; gap:5px; font-family:inherit; padding:6px;">
                ${SVG.back} <span>Retake</span>
              </button>
              <button id="std-send" style="background:#ffffff; border:none; color:#000000; font-size:10px; letter-spacing:1px; text-transform:uppercase; font-weight:600; cursor:pointer; padding:6px 16px; border-radius:20px; display:flex; align-items:center; gap:5px; font-family:inherit;">
                <span>Send</span> ${SVG.send}
              </button>
            </div>
          </div>
        `;

        const video = modalEl.querySelector("#std-video");
        const previewImg = modalEl.querySelector("#std-preview");
        const flash = modalEl.querySelector("#std-flash");
        const shutterBtn = modalEl.querySelector("#std-shutter");
        const flipBtn = modalEl.querySelector("#std-flip");
        const closeBtn = modalEl.querySelector("#std-close");
        const retakeBtn = modalEl.querySelector("#std-retake");
        const sendBtn = modalEl.querySelector("#std-send");
        const barLive = modalEl.querySelector("#std-bar-live");
        const barConfirm = modalEl.querySelector("#std-bar-confirm");
        const fileInput = modalEl.querySelector("#std-file-input");
        const captionInput = modalEl.querySelector("#std-caption");
        const targetSelect = modalEl.querySelector("#std-target-select");

        async function startLens() {
          if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
          try {
            activeStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
              audio: false,
            });
            video.srcObject = activeStream;
          } catch (e) {
            ctx.ui.toast("已切换为相册选取模式", { durationMs: 2000 });
          }
        }

        startLens();

        flipBtn.onclick = () => {
          facingMode = facingMode === "environment" ? "user" : "environment";
          startLens();
        };

        shutterBtn.onclick = () => {
          flash.style.opacity = "0.85";
          setTimeout(() => (flash.style.opacity = "0"), 100);

          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 720;
          canvas.height = video.videoHeight || 960;
          const g = canvas.getContext("2d");

          if (facingMode === "user") {
            g.translate(canvas.width, 0);
            g.scale(-1, 1);
          }
          g.drawImage(video, 0, 0, canvas.width, canvas.height);

          currentDataUrl = canvas.toDataURL("image/jpeg", 0.9);
          previewImg.src = currentDataUrl;
          previewImg.style.display = "block";
          video.style.display = "none";
          barLive.style.display = "none";
          barConfirm.style.display = "flex";
        };

        fileInput.onchange = (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            currentDataUrl = reader.result;
            previewImg.src = currentDataUrl;
            previewImg.style.display = "block";
            video.style.display = "none";
            barLive.style.display = "none";
            barConfirm.style.display = "flex";
          };
          reader.readAsDataURL(f);
        };

        retakeBtn.onclick = () => {
          previewImg.style.display = "none";
          video.style.display = "block";
          barLive.style.display = "flex";
          barConfirm.style.display = "none";
          currentDataUrl = "";
        };

        sendBtn.onclick = () => {
          if (!currentDataUrl) return;
          const finalSession = targetSelect.value || selectedSessionId;
          const note = captionInput.value.trim();
          executeSendMessage(currentDataUrl, note, finalSession);
          dismissModal();
        };

        function dismissModal() {
          if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
          close();
        }

        closeBtn.onclick = dismissModal;

        return () => {
          if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
        };
      });
    }

    // ==========================================
    // 6. 统一消息发送落库与相册存档
    // ==========================================
    function executeSendMessage(dataUrl, caption, sessionId) {
      if (!sessionId) {
        ctx.ui.toast("未指定目标角色", { durationMs: 2000 });
        return;
      }

      const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const issueStr = "ISSUE " + Math.floor(Math.random() * 89 + 10);

      // 1. 自动保存至本地相册
      if (ctx.system.settings.get("autoSaveAlbum")) {
        saveBase64ToAlbum(dataUrl, `LUCENT_${Date.now()}.jpg`);
      }

      // 2. 落库消息至目标角色聊天
      try {
        ctx.data.messages.push({
          sessionId: sessionId,
          role: "user",
          content: caption ? `[照片] ${caption}` : "[照片]",
          mediaType: "plugin:snap_photo",
          mediaData: {
            url: dataUrl,
            caption: caption,
            time: timeNow,
            issue: issueStr,
          },
        });
        ctx.ui.toast("照片已送达");
      } catch (err) {
        ctx.system.log("落库异常:", err);
      }

      // 3. AI 画面静默感知
      if (ctx.system.settings.get("aiVisionPerception")) {
        triggerAiVision(dataUrl, caption, sessionId);
      }
    }

    // ==========================================
    // 7. 自定义画报卡片渲染器与纯净全屏大图
    // ==========================================
    ctx.ui.messageKind("snap_photo", (el, msg) => {
      const data = msg.mediaData || {};
      const imgUrl = data.url || "";
      const caption = data.caption || "";
      const timeStr = data.time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const issueNum = data.issue || ("ISSUE " + Math.floor(Math.random() * 89 + 10));

      el.innerHTML = "";

      const card = document.createElement("div");
      card.className = "lucent-magazine-card lucent-font";

      card.innerHTML = `
        <div class="lucent-card-header">
          <span>LUCENT JOURNAL</span>
          <span>${issueNum}</span>
        </div>
        <div class="lucent-card-media">
          <img class="lucent-card-img" src="${imgUrl}" alt="" />
        </div>
        <div class="lucent-card-footer">
          ${caption ? `<div class="lucent-card-caption">${escapeHtml(caption)}</div>` : ""}
          <div class="lucent-card-meta">RECORDED AT ${timeStr} · ARCHIVE</div>
        </div>
      `;

      const imgElem = card.querySelector(".lucent-card-img");
      imgElem.removeAttribute("title");
      imgElem.alt = "";

      // 严格判定：滑动超 6px 锁定滚动，禁止触发点击放大
      let touchStartX = 0;
      let touchStartY = 0;
      let isScrollingPage = false;

      card.addEventListener("touchstart", (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          isScrollingPage = false;
        }
      }, { passive: true });

      card.addEventListener("touchmove", (e) => {
        if (e.touches.length === 1) {
          const moveX = Math.abs(e.touches[0].clientX - touchStartX);
          const moveY = Math.abs(e.touches[0].clientY - touchStartY);
          if (moveX > 6 || moveY > 6) isScrollingPage = true;
        }
      }, { passive: true });

      // 屏蔽默认右键与长按菜单
      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      card.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isScrollingPage) return;
        showPureEditorialLightbox(imgUrl, caption, issueNum, timeStr);
      });

      el.appendChild(card);
    });

    function showPureEditorialLightbox(url, caption, issue, time) {
      const modal = document.createElement("div");
      modal.className = "lucent-font";
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(10, 10, 10, 0.94);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        user-select: none;
        padding: 24px;
        box-sizing: border-box;
      `;

      modal.innerHTML = `
        <div style="width:100%; max-width:400px; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; color:rgba(255,255,255,0.4); font-size:9px; letter-spacing:2px;">
          <span>${issue || "LUCENT ARCHIVE"}</span>
          <div style="display:flex; gap:16px; align-items:center;">
            <span id="lb-download" style="cursor:pointer; color:rgba(255,255,255,0.7); display:flex;">${SVG.download}</span>
            <span id="lb-close" style="cursor:pointer; color:rgba(255,255,255,0.7); display:flex;">${SVG.close}</span>
          </div>
        </div>
        <div style="position:relative; width:100%; max-width:400px; max-height:70vh; display:flex; align-items:center; justify-content:center; overflow:hidden;">
          <img src="${url}" style="max-width:100%; max-height:70vh; object-fit:contain; border-radius:1px; box-shadow:0 30px 60px rgba(0,0,0,0.6);" alt="" />
        </div>
        <div style="width:100%; max-width:400px; margin-top:14px; color:#ffffff; font-size:12px; font-weight:300; letter-spacing:0.3px; text-align:left; line-height:1.5;">
          ${caption ? `<div>${escapeHtml(caption)}</div>` : ""}
          <div style="color:rgba(255,255,255,0.3); font-size:8px; letter-spacing:1px; margin-top:4px; text-transform:uppercase;">RECORD · ${time || ""}</div>
        </div>
      `;

      document.body.appendChild(modal);

      requestAnimationFrame(() => {
        modal.style.opacity = "1";
      });

      function closeLight() {
        modal.style.opacity = "0";
        setTimeout(() => modal.remove(), 250);
      }

      modal.querySelector("#lb-close").onclick = closeLight;
      modal.querySelector("#lb-download").onclick = () => {
        saveBase64ToAlbum(url, `LUCENT_${Date.now()}.jpg`);
        ctx.ui.toast("已保存到相册", { durationMs: 1500 });
      };

      modal.onclick = (e) => {
        if (e.target === modal) closeLight();
      };
    }

    // ==========================================
    // 8. 辅助工具与清理回收
    // ==========================================
    function saveBase64ToAlbum(base64Data, fileName) {
      try {
        const arr = base64Data.split(",");
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.style.display = "none";
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
          a.remove();
        }, 300);
      } catch (err) {
        ctx.system.log("保存本地相册异常:", err);
      }
    }

    async function triggerAiVision(dataUrl, caption, sessionId) {
      try {
        const desc = await ctx.ai.chat({
          prompt: "用1句话简要描述这张照片画面的视觉主体与氛围，供角色自然回应：",
          system: "你是一个精炼的视觉分析助手。只输出客观画面描述，禁止废话。",
          temperature: 0.2,
          maxTokens: 60,
        });

        if (desc && desc.trim()) {
          const promptText = `[用户实时拍了一张照片发送给你。画面内容：${desc.trim()}${caption ? `；用户附言：“${caption}”` : ""}]`;
          ctx.prompts.set(promptText, { sessionId });
        }
      } catch (e) {}
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    return () => {
      if (ballEl) ballEl.remove();
    };
  },
};