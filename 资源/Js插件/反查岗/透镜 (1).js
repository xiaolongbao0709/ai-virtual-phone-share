export default {
  manifest: {
    id: "nordic-editorial-patrol",
    name: "透镜 · 极简画报查岗与心智审讯终端",
    apiVersion: 1,
    version: "23.0.2",
    author: "镜观雪",
    description: "查岗状态聊天室全景感知、最小化悬浮球、自由拖拽、自定义拍照自证。新增世界书增强、巡视与拍照控制开关。",
    permissions: ["chat.read", "chat.write", "ai", "worldbook"],
    settings: [
      { key: "enabled", label: "启用巡视系统（主开关）", type: "boolean", default: true },
      { key: "autoPatrolEnabled", label: "开启自动随机巡视", type: "boolean", default: true },
      { key: "enablePhotoRequest", label: "允许角色要求拍照自证", type: "boolean", default: true },
      { key: "triggerKeywords", label: "查岗触发关键词（逗号分隔）", type: "text", default: "查岗,在干嘛,看什么呢,偷偷看谁,抓包" },
      { key: "customPhotoPrompt", label: "拍照自证自定义要求", type: "text", default: "你可以根据角色当前的心情与性格，在质问中自然地要求用户发照片自证（如实时正脸自拍、特定手势验证、当前周围环境照等，要求必须完全符合角色人设语气，不要生硬刻板）。" },
      { key: "targetCharName", label: "锁定监视角色（留空自动）", type: "text", default: "" },
      { key: "intervalMin", label: "基础巡视周期（分钟）", type: "number", default: 12 },
      { key: "randomVariance", label: "随机浮动周期（分钟）", type: "number", default: 4 },
      { key: "strictness", label: "审讯原谅门槛（1-5）", type: "number", default: 3 },
    ],
  },

  setup(ctx) {
    let lastActiveSessionId = null;
    let isPatrolling = false;
    let currentPatrolCharName = "";
    let currentPatrolTension = 50;
    let floatingPanelEl = null;
    let floatingBallEl = null;
    let snoopIntervalCleaner = null;
    let nextPatrolTimeoutCleaner = null;
    let currentInspectionResolver = null;

    // 1.2px 极细几何 SVG 图标库（全代码严禁任何 Emoji）
    const ICONS = {
      aperture: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="14.31" y1="8" x2="20.05" y2="17.94"/><line x1="9.69" y1="8" x2="21.17" y2="8"/><line x1="7.38" y1="12" x2="13.12" y2="2.06"/><line x1="9.69" y1="16" x2="3.95" y2="6.06"/><line x1="14.31" y1="16" x2="2.83" y2="16"/><line x1="16.62" y1="12" x2="10.88" y2="21.94"/></svg>`,
      waveform: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h3l3-9 4 18 3-9h5"/></svg>`,
      arrowUpRight: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>`,
      crosshair: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`,
      power: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>`,
      clock: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
      archive: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
      eye: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
      camera: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
      minimize: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="14" x2="10" y2="14"/><line x1="10" y1="14" x2="10" y2="20"/><line x1="20" y1="10" x2="14" y2="10"/><line x1="14" y1="10" x2="14" y2="4"/></svg>`,
    };

    // 定义证据卡片的消息模板，确保拍照提交的证据以卡片形式显示在聊天记录中
    ctx.ui.messageKind("patrol_statement", (el, msg) => {
      const data = msg.mediaData || {};
      el.innerHTML = `
        <div style="background:#f9f9f7; border:1px solid #e5e5df; padding:10px; border-radius:2px; margin:4px 0;">
          <div style="font-size:9px; color:#888; margin-bottom:5px; font-family:sans-serif;">SENT // EVIDENCE</div>
          ${data.photoUrl ? `<img src="${data.photoUrl}" style="width:100%; height:80px; object-fit:cover; margin-bottom:8px; border:1px solid #ddd;">` : ""}
          <div style="font-size:12px; color:#333; line-height:1.4; font-family:serif;">“${data.text || ""}”</div>
        </div>
      `;
    });
    
    // 样式注入：北欧空气感 · 拖拽悬浮球 · 固定悬浮画报视窗
    ctx.ui.injectCSS(`
      @keyframes patrol-breathing-light {
        0%, 100% { transform: scale(1); opacity: 0.55; box-shadow: 0 0 0 0 rgba(26, 26, 26, 0.2); }
        50% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 8px 2px rgba(26, 26, 26, 0.35); }
      }
      .editorial-status-lamp {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #1a1a1a;
        display: inline-block;
        animation: patrol-breathing-light 2.2s infinite ease-in-out;
        flex-shrink: 0;
      }
      .editorial-floating-container {
        position: fixed;
        width: calc(100vw - 28px);
        max-width: 410px;
        height: 520px;
        max-height: 82vh;
        background: #fbfbf9;
        color: #1a1a1a;
        border-radius: 4px;
        border: 1px solid rgba(0, 0, 0, 0.14);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18), 0 2px 10px rgba(0, 0, 0, 0.05);
        padding: 16px 18px 14px 18px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Didot", "Playfair Display", "Times New Roman", "PingFang SC", serif;
        touch-action: none;
      }
      .editorial-floating-container.is-hidden {
        display: none !important;
      }
      .editorial-ball {
        position: fixed;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: #fbfbf9;
        border: 1.5px solid rgba(0, 0, 0, 0.16);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 999999;
        user-select: none;
        touch-action: none;
        transition: transform 0.15s ease-out;
      }
      .editorial-ball:active {
        transform: scale(0.92);
      }
      .editorial-ball.is-hidden {
        display: none !important;
      }
      .editorial-snoop-ticker {
        background: #f2f2ee;
        border: 1px dashed #deded8;
        border-radius: 2px;
        padding: 5px 8px;
        font-size: 10px;
        font-family: -apple-system, sans-serif;
        color: #555;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        flex-shrink: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .editorial-header-fixed {
        flex-shrink: 0;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 6px;
        padding-bottom: 6px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06);
        cursor: move;
        user-select: none;
        touch-action: none;
      }
      .editorial-tag {
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 8.5px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: #888;
      }
      .editorial-dialog-scroll {
        flex: 1;
        overflow-y: auto;
        padding-right: 4px;
        margin: 6px 0;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scrollbar-width: thin;
      }
      .editorial-footer-fixed {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding-top: 6px;
        border-top: 1px solid rgba(0, 0, 0, 0.06);
      }
      .editorial-item-char {
        padding-left: 9px;
        border-left: 1.5px solid #1a1a1a;
      }
      .editorial-item-user {
        padding-right: 9px;
        border-right: 1.5px solid #888;
        text-align: right;
      }
      .editorial-chip-action {
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 9.5px;
        letter-spacing: 0.03em;
        padding: 3px 7px;
        border-radius: 1px;
        background: #f1f1ed;
        border: 1px solid #e2e2dc;
        color: #555;
        cursor: pointer;
        transition: all 0.2s;
      }
      .editorial-chip-action:hover {
        background: #e6e6df;
        color: #111;
      }
      .editorial-btn-abort {
        background: transparent;
        border: 1px solid rgba(0, 0, 0, 0.15);
        color: #666;
        font-size: 9.5px;
        font-family: -apple-system, sans-serif;
        letter-spacing: 0.06em;
        padding: 2px 7px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s;
        border-radius: 1px;
        flex-shrink: 0;
      }
      .editorial-btn-abort:hover {
        border-color: #111;
        color: #111;
      }
      .editorial-dossier-card {
        background: #fafaf8;
        border: 1px solid #e8e8e2;
        padding: 16px;
        border-radius: 2px;
        margin: 6px 0;
        font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Times New Roman", serif;
      }
      .editorial-history-drawer {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.25s ease-out;
        background: #f4f4f0;
        border-radius: 2px;
        padding: 0 8px;
        font-size: 10px;
        line-height: 1.5;
        color: #666;
        margin-bottom: 6px;
        flex-shrink: 0;
      }
      .editorial-history-drawer.open {
        max-height: 90px;
        overflow-y: auto;
        padding: 6px 8px;
        border: 1px solid #e5e5df;
      }
    `);

      .editorial-lock-overlay {
        position: fixed; top:0; left:0; width:100vw; height:100vh;
        background: rgba(245, 245, 243, 0.95);
        z-index: 9999999;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        backdrop-filter: blur(5px);
      }
      .editorial-lock-input {
        background: transparent; border: none; border-bottom: 1px solid #1a1a1a;
        font-size: 18px; padding: 10px; text-align: center; width: 200px;
        outline: none;
      }
      
    // 工业级原生 Pointer Capture 拖拽绑定
    function makeDraggable(handleEl, targetEl, isClickable = false, onClickCallback = null) {
      let isDragging = false;
      let startX = 0, startY = 0;
      let initialLeft = 0, initialTop = 0;
      let hasMoved = false;

      const onPointerDown = (e) => {
        if (e.target.closest("button") || e.target.closest("textarea") || e.target.closest(".editorial-tag")) return;
        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;

        const rect = targetEl.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        targetEl.style.left = `${initialLeft}px`;
        targetEl.style.top = `${initialTop}px`;
        targetEl.style.right = "auto";
        targetEl.style.bottom = "auto";
        targetEl.style.transform = "none";

        try {
          handleEl.setPointerCapture(e.pointerId);
        } catch (err) {}

        handleEl.addEventListener("pointermove", onPointerMove);
        handleEl.addEventListener("pointerup", onPointerUp);
        handleEl.addEventListener("pointercancel", onPointerUp);
      };

      const onPointerMove = (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
          hasMoved = true;
        }

        const winW = window.innerWidth;
        const winH = window.innerHeight;
        const elW = targetEl.offsetWidth;
        const elH = targetEl.offsetHeight;

        const nextLeft = Math.max(8, Math.min(winW - elW - 8, initialLeft + deltaX));
        const nextTop = Math.max(8, Math.min(winH - elH - 8, initialTop + deltaY));

        targetEl.style.left = `${nextLeft}px`;
        targetEl.style.top = `${nextTop}px`;
      };

      const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;

        try {
          handleEl.releasePointerCapture(e.pointerId);
        } catch (err) {}

        handleEl.removeEventListener("pointermove", onPointerMove);
        handleEl.removeEventListener("pointerup", onPointerUp);
        handleEl.removeEventListener("pointercancel", onPointerUp);

        if (!hasMoved && isClickable && typeof onClickCallback === "function") {
          onClickCallback();
        }
      };

      handleEl.addEventListener("pointerdown", onPointerDown);
    }

    // BL / 攻受 严格熔断拦截器
    const BL_FORBIDDEN_REGEX = /(总攻|总受|小攻|小受|主攻|主受|纯爱耽美|耽美|BL|耽改|男男相恋|强攻弱受|年下攻|年上攻|帝王攻|忠犬攻|女王受|谁攻谁受|攻方|受方|\bBL\b|\bDanmei\b|\bYaoi\b)/i;

    function assertNoBlViolation(contextString, sourceLabel = "当前上下文") {
      if (!contextString) return;
      const match = String(contextString).match(BL_FORBIDDEN_REGEX);
      if (match) {
        const errorMsg = `[题材门禁拦截] 检测到包含 BL / 攻受属性设定 (${match[0]})，本插件已拒绝在此类设定下运行！`;
        ctx.system.log(`FATAL: ${errorMsg} (来源: ${sourceLabel})`);
        ctx.ui.toast(`⛔ 拦截报错: 检测到 BL/攻受 设定，插件已中止执行`);
        throw new Error(errorMsg);
      }
    }

    // 通用卷宗卡片渲染器
    function renderUniversalDossierHTML(data) {
      const transcript = Array.isArray(data.transcript) ? data.transcript : [];
      let dialogHtml = "";

      if (transcript.length > 0) {
        dialogHtml = transcript.map((t) => {
          const isUser = t.speaker === "YOU" || t.speaker === "用户";
          return `
            <div style="margin-bottom:8px; font-size:11.5px; line-height:1.5; ${isUser ? "text-align:right; padding-right:8px; border-right:1px solid #aaa;" : "padding-left:8px; border-left:1px solid #111;"}">
              <div style="font-size:8px; letter-spacing:0.14em; text-transform:uppercase; color:#888; margin-bottom:2px;">
                ${isUser ? "STATEMENT // USER" : `INTERROGATION // ${t.speaker || "OBSERVER"}`}
              </div>
              <div style="color:${isUser ? "#444" : "#111"}; font-style:${isUser ? "normal" : "italic"};">
                ${isUser ? t.text : `“${t.text}”`}
              </div>
            </div>
          `;
        }).join("");
      } else if (data.interrogation) {
        dialogHtml = `
          <div style="margin-bottom:8px; font-size:11.5px; line-height:1.5; padding-left:8px; border-left:1px solid #111;">
            <div style="font-size:8px; letter-spacing:0.14em; text-transform:uppercase; color:#888; margin-bottom:2px;">
              INTERROGATION // ${data.characterName || "OBSERVER"}
            </div>
            <div style="color:#111; font-style:italic;">“${data.interrogation}”</div>
          </div>
        `;
      }

      const snapshot = data.snapshot || (data.mediaData && data.mediaData.url) || "";
      const verdict = data.finalVerdict || data.verdict || "Logged";
      const tension = Number.isFinite(data.tension) ? data.tension : (Number.isFinite(data.suspicion) ? data.suspicion : 0);

      return `
        <div class="editorial-dossier-card">
          <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
            <span class="editorial-tag">Inspection Dossier // Ref. ${data.refId || "ARCHIVE"}</span>
            <span style="font-family:sans-serif; font-size:9.5px; color:#999; display:inline-flex; align-items:center; gap:4px;">
              ${ICONS.clock} ${data.time || ""}
            </span>
          </div>

          <div style="margin-bottom:12px;">
            ${dialogHtml}
          </div>

          ${snapshot ? `
            <div style="margin:10px 0; background:#eee;">
              <img src="${snapshot}" style="width:100%; display:block; filter:grayscale(100%); mix-blend-mode:multiply; max-height:120px; object-fit:cover;" />
            </div>
          ` : ""}

          <div style="margin-top:12px; padding-top:10px; border-top:1px dashed #dedede; display:flex; justify-content:space-between; align-items:baseline;">
            <div>
              <div style="font-family:sans-serif; font-size:8.5px; letter-spacing:0.12em; text-transform:uppercase; color:#888;">Conclusion</div>
              <div style="font-size:11.5px; color:#111; font-weight:500; margin-top:2px;">${verdict}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:sans-serif; font-size:8.5px; letter-spacing:0.12em; text-transform:uppercase; color:#888;">Doubt Tension</div>
              <div style="font-size:11.5px; font-family:sans-serif; color:#222; margin-top:2px;">${tension}%</div>
            </div>
          </div>
        </div>
      `;
    }

    const KIND_LIST = [
      "editorial_dossier_live",
      "editorial_inspection_card",
      "editorial_dossier",
      "editorial_record",
      "patrol_report"
    ];
    KIND_LIST.forEach((kind) => {
      ctx.ui.messageKind(kind, (el, msg) => {
        el.innerHTML = renderUniversalDossierHTML(msg.mediaData || {});
      });
    });

    ctx.hooks.on("session.opened", ({ sessionId, isGroup }) => {
      if (!isGroup) lastActiveSessionId = sessionId;
    });

    // 关键词陷阱监听
    ctx.hooks.transform("user.beforeSend", async (payload) => {
      if (!payload || !payload.text || isPatrolling) return payload;
      const rawKeywords = String(ctx.system.settings.get("triggerKeywords") || "");
      const keywordList = rawKeywords.split(/[,，|]/).map((k) => k.trim()).filter(Boolean);

      const isHit = keywordList.some((kw) => payload.text.includes(kw));
      if (isHit) {
        lastActiveSessionId = payload.sessionId;
        ctx.system.log(`[陷阱命中] 用户输入触发查岗关键词: "${payload.text}"`);
        ctx.system.timers.setTimeout(() => {
          startInteractiveInspection().finally(() => {
            scheduleLoop();
          });
        }, 300);
      }
      return payload;
    });

    // 核心认知同步注入：日常对话 + 实时查岗态双向感知 + 聊天记忆强制校准
    ctx.hooks.transform("prompt.system", (payload) => {
      let hintAdd = "";

      // 获取当前聊天室的历史消息，读取最近50条，避免超出 Token 限制导致报错
      let chatContext = "（无近期对话）";
      if (lastActiveSessionId) {
        const msgs = ctx.data.messages.list(lastActiveSessionId) || [];
        // 这里读取最近50条记录，确保记忆充足，又不会撑爆模型
        chatContext = msgs.slice(-50).map(m => `${m.role === 'user' ? '用户' : '角色'}: ${m.content}`).join("\n");
      }

      // 1. 如果当前正在查岗中，注入强状态感知与近期对话记录
      if (isPatrolling) {
        hintAdd += `\n【当前紧急状态 · 查岗审讯进行中】：
你（${currentPatrolCharName || "角色"}）此刻正在对用户发起突击查岗！
【近期聊天室上下文（必须作为你当前判断态度的依据，严禁忘记刚才的对话）：】
${chatContext}
你必须时刻牢记并体现出【正在查岗】的威严/质问/吃醋态度，绝不能像普通日常一样若无其事地聊天！要求用户先在查岗终端中向你解释或老实交代！\n`;
      }

      // 2. 注入历史长久档案
      let historyStr = ctx.system.storage.get("all_patrol_history") || "";
      if (historyStr.trim()) {
        hintAdd += `\n【透镜·过往全部屏幕查岗始末与真实审讯档案】：\n${historyStr}\n【认知规则】：牢记查岗与翻看手机发现的痕迹。严禁输出任何BL/攻受设定及Emoji。\n`;
      }

      payload.hint = (payload.hint || "") + hintAdd;
      return payload;
    });

    // 解析角色档案
    function resolveTargetProfile() {
      const targetName = String(ctx.system.settings.get("targetCharName") || "").trim().toLowerCase();
      const sessions = Array.isArray(ctx.data.sessions.list()) ? ctx.data.sessions.list() : [];
      const characters = Array.isArray(ctx.data.characters.list()) ? ctx.data.characters.list() : [];

      let matchedChar = null;
      let targetSession = null;

      if (targetName) {
        matchedChar = characters.find((c) => String(c.name || "").toLowerCase().includes(targetName));
      }

      if (matchedChar) {
        targetSession = sessions.find((s) => !s.isGroup && (s.characterId === matchedChar.id || s.contactId === matchedChar.id));
      }

      if (!targetSession && lastActiveSessionId) {
        targetSession = ctx.data.sessions.get(lastActiveSessionId);
      }

      if (!targetSession) {
        targetSession = sessions.find((s) => !s.isGroup);
      }

      if (targetSession && !matchedChar && targetSession.characterId) {
        matchedChar = ctx.data.characters.get(targetSession.characterId);
      }

      let recentChatMemory = "（暂无近期交流记录）";
      if (targetSession) {
        const msgs = Array.isArray(ctx.data.messages.list(targetSession.id)) ? ctx.data.messages.list(targetSession.id) : [];
        const lastFew = msgs.slice(-6);
        if (lastFew.length > 0) {
          recentChatMemory = lastFew
            .map((m) => `${m.role === "user" ? "用户" : (matchedChar ? matchedChar.name : "角色")}: ${m.content || ""}`)
            .join("\n");
        }
      }

      let profileText = "";
      let worldbookKeywords = [];
      if (matchedChar) {
        profileText += `【角色名】: ${matchedChar.name || "未知"}\n`;
        if (matchedChar.description) profileText += `【人设】: ${matchedChar.description}\n`;
        if (matchedChar.personality) profileText += `【脾气性格与口吻】: ${matchedChar.personality}\n`;
        
        // 读取角色绑定的世界书内容
        try {
          if (matchedChar.worldbookId && ctx.data.worldbooks) {
            const wb = ctx.data.worldbooks.get(matchedChar.worldbookId);
            if (wb && wb.entries) {
               // 确保即使 entries 格式不同也能安全读取
               const entries = Array.isArray(wb.entries) ? wb.entries : [wb.entries];
               const wbContent = entries.map(e => (typeof e === 'string' ? e : e.content || "")).join(" ");
               profileText += `【世界书深度内容】: ${wbContent.slice(0, 600)}\n`;
               const matches = wbContent.match(/[\u4e00-\u9fa5]{2,6}/g) || [];
               worldbookKeywords = matches.slice(0, 10);
            }
          }
        } catch (e) {
            ctx.system.log("世界书读取异常: " + e.message);
        }
      }

      assertNoBlViolation(profileText, "角色卡与世界书");
      assertNoBlViolation(recentChatMemory, "近期聊天记录");

      return {
        session: targetSession,
        character: matchedChar,
        characterName: matchedChar ? (matchedChar.name || "Observant") : "Observant",
        sessionId: targetSession ? targetSession.id : null,
        profile: profileText,
        recentMemory: recentChatMemory,
        keywords: worldbookKeywords,
      };
    }

    function extractPhoneSnoopData() {
      const contacts = Array.isArray(ctx.data.contacts.list()) ? ctx.data.contacts.list() : [];
      const sessions = Array.isArray(ctx.data.sessions.list()) ? ctx.data.sessions.list() : [];
      const contactNames = contacts.map(c => c.name || "某人").slice(0, 6);
      const sessionTitles = sessions.map(s => s.title || s.name || "私聊").slice(0, 5);

      let otherMsgSnippet = "";
      for (const s of sessions) {
        if (!s.isGroup) {
          const msgs = Array.isArray(ctx.data.messages.list(s.id)) ? ctx.data.messages.list(s.id) : [];
          if (msgs.length > 0) {
            const lastM = msgs[msgs.length - 1];
            otherMsgSnippet = `[${s.title || "某对话"}]: ${String(lastM.content || "").slice(0, 35)}`;
            break;
          }
        }
      }

      return { contactNames, sessionTitles, otherMsgSnippet };
    }

    function readScreenAndFoci(keywords) {
      try {
        const text = String(document.body.innerText || "").replace(/\s+/g, " ").trim();
        const snippet = text.slice(0, 320);
        const foundFoci = [];
        keywords.forEach((kw) => {
          if (snippet.includes(kw) && !foundFoci.includes(kw)) {
            foundFoci.push(kw);
          }
        });
        return { snippet, foci: foundFoci };
      } catch (e) {
        return { snippet: "视窗静止浏览中。", foci: [] };
      }
    }

    async function createEditorialSnapshot(snippet, charName, foci) {
      try {
        const canvas = document.createElement("canvas");
        const w = 380;
        const h = 480;
        canvas.width = w;
        canvas.height = h;
        const c = canvas.getContext("2d");

        c.fillStyle = "#f5f5f3";
        c.fillRect(0, 0, w, h);

        c.fillStyle = "#888888";
        c.font = "8.5px -apple-system, sans-serif";
        c.fillText("OPTICAL EVIDENCE PROOF // MONOCHROME", 20, 28);

        c.fillStyle = "#111111";
        c.font = "italic 15px Didot, serif";
        c.fillText(`Subject · ${charName}`, 20, 52);

        c.strokeStyle = "#e0e0dc";
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(20, 66);
        c.lineTo(w - 20, 66);
        c.stroke();

        c.fillStyle = "#333333";
        c.font = "11px -apple-system, serif";
        const chars = snippet.split("");
        let line = "";
        let y = 92;
        for (let i = 0; i < chars.length; i++) {
          line += chars[i];
          if (line.length >= 26 || i === chars.length - 1) {
            c.fillText(line, 20, y);
            y += 18;
            line = "";
            if (y > 380) break;
          }
        }

        if (foci.length > 0) {
          c.fillStyle = "#111111";
          c.font = "9px -apple-system, sans-serif";
          c.fillText(`[FOCUSED ENTITIES: ${foci.join(" / ")}]`, 20, y + 16);
        }

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        c.fillStyle = "#999999";
        c.font = "8.5px -apple-system, sans-serif";
        c.fillText(`RECORDED AT ${timeStr} · ARCHIVE ONLY`, 20, h - 22);

        return canvas.toDataURL("image/png");
      } catch (e) {
        return null;
      }
    }

    function parseAiEvaluation(rawText) {
      assertNoBlViolation(rawText, "AI输出响应");

      const clean = String(rawText || "")
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji}/gu, "")
        .trim();

      let isSatisfied = false;
      if (
        clean.includes("[STATUS:SATISFIED]") ||
        clean.includes("【状态：满意】") ||
        clean.includes("【状态：原谅】") ||
        clean.includes("【状态：通过】")
      ) {
        isSatisfied = true;
      } else if (
        clean.includes("[STATUS:CONTINUE]") ||
        clean.includes("【状态：继续】") ||
        clean.includes("【状态：追问】")
      ) {
        isSatisfied = false;
      } else {
        const satisfySignals = ["放过你", "原谅", "相信你", "这次就算了", "不追究", "既然你", "下不为例", "拍得还行", "照片收到了"];
        isSatisfied = satisfySignals.some((s) => clean.includes(s));
      }

      const replyLine = clean
        .replace(/\[STATUS:\s*(SATISFIED|CONTINUE)\]/gi, "")
        .replace(/【状态：[^】]+】/g, "")
        .trim();

      return {
        isSatisfied,
        replyContent: replyLine || (isSatisfied ? "既然你把话说得这么明白，这次便不再追究。" : "你觉得这样的理由能让人信服吗？"),
      };
    }

    // 核心悬浮审讯调度
    function startInteractiveInspection() {
      return new Promise(async (resolveInspection) => {
        if (isPatrolling) {
          resolveInspection();
          return;
        }
        if (ctx.system.settings.get("enabled") === false) {
          resolveInspection();
          return;
        }

        let target;
        try {
          target = resolveTargetProfile();
        } catch (gateErr) {
          resolveInspection();
          return;
        }

        isPatrolling = true;
        currentPatrolCharName = target.characterName;
        currentInspectionResolver = resolveInspection;

        const charName = target.characterName;
        const sessionId = target.sessionId;
        
        let rawStrictness = Number(ctx.system.settings.get("strictness"));
        const strictness = Number.isFinite(rawStrictness) ? Math.max(1, Math.min(5, rawStrictness)) : 3;

        currentPatrolTension = 50 + strictness * 8;

        const isPhotoEnabled = ctx.system.settings.get("enablePhotoRequest");
        const customPhotoRule = isPhotoEnabled 
          ? (String(ctx.system.settings.get("customPhotoPrompt") || "").trim() || "你可以根据角色当前的心情与性格，在质问中自然地要求用户发照片自证（如实时正脸自拍、特定手势验证、当前周围环境照等，要求必须完全符合角色人设语气，不要生硬刻板）。")
          : "禁止要求用户发送照片自证。请完全依靠对话与心理博弈来审讯用户，不要让用户进行拍照操作。";

        const snoopData = extractPhoneSnoopData();

        const toastScanning = ctx.ui.toast(`${charName} 正在拿过手机翻阅你的对话列表与联系人…`, { durationMs: 0 });
        const { snippet: screenText, foci } = readScreenAndFoci(target.keywords);
        const snapshotUrl = await createEditorialSnapshot(screenText, charName, foci);
        toastScanning.close();

        const toastComposing = ctx.ui.toast(`${charName} 正在根据性格与心情构思质询…`, { durationMs: 0 });

        let tension = currentPatrolTension;
        let roundCount = 0;
        const transcript = [];
        const refId = String(Math.floor(Math.random() * 800 + 100));

        const pastHistory = ctx.system.storage.get("all_patrol_history") || "（暂无更早的旧审讯记录）";

        let initialInterrogation = "你刚才在屏幕上看什么？不打算跟我交代一下吗？";
        try {
          const initPrompt = `【扮演角色设定】：\n${target.profile}\n\n【角色与用户的过往聊天】：\n${target.recentMemory}\n\n【透镜·全部过往审讯始末档案】：\n${pastHistory}\n\n【角色翻阅手机发现的数据】：\n- 最近联系人: ${snoopData.contactNames.join(", ") || "无"}\n- 会话列表: ${snoopData.sessionTitles.join(", ") || "无"}\n- 偶遇的聊天切片: ${snoopData.otherMsgSnippet || "无"}\n- 屏幕可见文字: "${screenText}"\n${foci.length ? `【命中的世界书/敏感词】：${foci.join(", ")}\n` : ""}【重要审讯证据规则】：
1. 深度沉浸扮演角色！必须严格体现角色人设的语气习惯、口癖与性格（如病娇占有欲、傲娇嘴硬、高冷威严、温柔吃醋等）。
2. ${customPhotoRule}
3. 严禁任何 BL/攻受设定、Emoji。严禁输出废话，禁止重复刚才说过的台词。
4. 【强制引用证据】：你必须明确提及刚才抓拍到的屏幕文字内容（如下方所列），以此作为你怀疑的铁证。不要模糊提问，直接点出证据内容。
   【抓拍证据原文】："${screenText}"
【任务】：发起第一句极具针对性、完全贴合人设、并引用了上方【抓拍证据原文】的开场质问（2句以内）。`;

          const resp = await ctx.ai.chat({
            system: "你是一个真实立体的互动角色，严禁输出任何BL/攻受属性及Emoji表情。",
            prompt: initPrompt,
            temperature: 0.85,
          });

          assertNoBlViolation(resp, "首轮质问台词");
          if (resp && resp.trim()) {
            initialInterrogation = resp.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji}/gu, "").trim();
          }
        } catch (e) {
          ctx.system.log("首轮质问生成回退: " + e.message);
        } finally {
          toastComposing.close();
        }

        transcript.push({ speaker: charName, text: initialInterrogation });

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

        let liveMessageId = null;
        if (sessionId) {
          try {
            const pushResult = ctx.data.messages.push({
              sessionId: sessionId,
              role: "assistant",
              content: `[透镜巡视中] ${initialInterrogation}`,
              mediaType: "plugin:editorial_dossier_live",
              mediaData: {
                refId: refId,
                time: timeStr,
                transcript: [...transcript],
                snapshot: snapshotUrl,
                finalVerdict: "Interrogation Live (In Progress)",
                isDone: false,
                tension: tension,
              },
            });
            if (pushResult && pushResult.id) {
              liveMessageId = pushResult.id;
            }
          } catch (e) {
            ctx.system.log("实时卡片创建失败: " + e.message);
          }
        }

        const updateLiveDossier = (isDone = false, finalVerdictText = "In Progress") => {
          if (!sessionId || !liveMessageId) return;
          try {
            const currentData = {
              refId: refId,
              time: timeStr,
              transcript: [...transcript],
              snapshot: snapshotUrl,
              finalVerdict: finalVerdictText,
              isDone: isDone,
              tension: tension,
            };
            ctx.data.messages.update(liveMessageId, {
              content: `[透镜卷宗] ${isDone ? "审讯已结案" : "多轮审讯进行中"}`,
              mediaData: currentData,
            });
          } catch (e) {}
        };

        const snoopLogs = [
          `翻阅了联系人列表（发现: ${snoopData.contactNames.slice(0, 3).join(", ") || "常规"}）`,
          `检视了最近消息窗口（锁定: ${snoopData.sessionTitles[0] || "当前"}）`,
          `核验了视窗提取文字（捕获: ${screenText.slice(0, 18)}...）`,
          `比对了过往审讯案卷档案...`,
        ];
        let snoopIndex = 0;

        // 创建悬浮画报面板与悬浮球
        floatingPanelEl = document.createElement("div");
        floatingPanelEl.className = "editorial-floating-container";
        floatingPanelEl.style.left = `${Math.max(14, (window.innerWidth - Math.min(410, window.innerWidth - 28)) / 2)}px`;
        floatingPanelEl.style.top = `${Math.max(40, window.innerHeight - 540)}px`;

        floatingBallEl = document.createElement("div");
        floatingBallEl.className = "editorial-ball is-hidden";
        floatingBallEl.style.left = `${Math.max(20, window.innerWidth - 66)}px`;
        floatingBallEl.style.top = `${Math.max(80, window.innerHeight - 140)}px`;
        floatingBallEl.innerHTML = `<span class="editorial-status-lamp"></span>`;

        document.body.appendChild(floatingPanelEl);
        document.body.appendChild(floatingBallEl);

        floatingPanelEl.innerHTML = `
          <div class="editorial-header-fixed" id="ed-panel-header">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="editorial-status-lamp" title="透镜呼吸状态指示灯"></span>
              <div>
                <div id="ed-toggle-history" class="editorial-tag" style="cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="点击展开过往案卷档案">
                  <span>Inspection // Round <span id="ed-round-num">1</span></span>
                  ${ICONS.archive}
                </div>
                <div style="font-size:15px; letter-spacing:-0.02em; font-weight:400; margin-top:1px;">Presence Inspection</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <span id="ed-tension-tag" style="font-size:9.5px; font-family:sans-serif; color:#777;">TENSION : ${tension}%</span>
              <button id="ed-btn-minimize" class="editorial-btn-abort" title="最小化为悬浮球">
                ${ICONS.minimize}
              </button>
              <button id="ed-btn-force-abort" class="editorial-btn-abort" title="强制脱离（增加怀疑度并被记录）">
                ${ICONS.power}
              </button>
            </div>
          </div>

          <div class="editorial-snoop-ticker">
            <span style="display:inline-flex; align-items:center; gap:4px; color:#111;">${ICONS.eye} <b>${charName}</b></span>
            <span id="ed-snoop-text" style="color:#666; overflow:hidden; text-overflow:ellipsis;">正在翻看你的手机界面与对话列表...</span>
          </div>

          <div id="ed-history-drawer" class="editorial-history-drawer">
            <div style="font-family:sans-serif; font-size:8px; letter-spacing:0.12em; text-transform:uppercase; color:#999; margin-bottom:4px;">Historical Dossier Archive</div>
            <div>${pastHistory.replace(/\n/g, "<br/>")}</div>
          </div>

          <div id="ed-dialog-flow" class="editorial-dialog-scroll">
            <div class="editorial-item-char">
              <div style="font-family:sans-serif; font-size:8.5px; letter-spacing:0.12em; text-transform:uppercase; color:#999; margin-bottom:3px;">
                Interrogation · ${charName}
              </div>
              <div style="font-size:12.5px; line-height:1.55; color:#111; font-style:italic;">
                “${initialInterrogation}”
              </div>
            </div>
          </div>

          <div class="editorial-footer-fixed">
            <div style="display:flex; gap:4px; margin-bottom:3px; flex-wrap:wrap;">
              <button class="editorial-chip-action" data-text="我承认我刚才分心了，保证以后绝不会瞒着你。">
                认错自白
              </button>
              <button class="editorial-chip-action" data-text="我只是在查阅一些资料，心里只有你，不信你可以看。">
                出示痕迹
              </button>
              <button id="ed-chip-photo-selfie" class="editorial-chip-action" style="border-color:#111; color:#111; display:inline-flex; align-items:center; gap:3px;">
                ${ICONS.camera} 呈递实时自拍
              </button>
              <button id="ed-chip-photo-env" class="editorial-chip-action">
                呈递当前环境照
              </button>
            </div>

            <div>
              <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
                <span class="editorial-tag">Your Statement</span>
                <span id="ed-eval-status" style="font-family:sans-serif; font-size:9px; color:#888; display:none;">
                  ${ICONS.waveform} 比对心智与情绪中…
                </span>
              </div>
              <textarea id="ed-reply-input" placeholder="诚恳陈述、自证或回应照片要求… (Enter 快速发送, Shift+Enter 换行)" style="width:100%; height:38px; background:#f2f2ee; border:none; border-radius:1px; padding:6px 8px; font-size:11.5px; font-family:inherit; color:#1a1a1a; resize:none; outline:none; box-sizing:border-box; line-height:1.4;"></textarea>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:9px; font-family:sans-serif; color:#999;">
                ${ICONS.crosshair} 达成角色释怀即可解锁
              </div>
              <button id="ed-btn-send" style="display:inline-flex; align-items:center; gap:4px; background:#111; color:#fafaf8; border:none; padding:5px 12px; font-size:11px; font-family:sans-serif; letter-spacing:0.06em; cursor:pointer; border-radius:1px;">
                <span>递交陈述</span>
                ${ICONS.arrowUpRight}
              </button>
            </div>
          </div>
        `;

        // 绑定拖拽
        const panelHeader = floatingPanelEl.querySelector("#ed-panel-header");
        makeDraggable(panelHeader, floatingPanelEl, false);
        makeDraggable(floatingBallEl, floatingBallEl, true, () => {
          floatingBallEl.classList.add("is-hidden");
          floatingPanelEl.classList.remove("is-hidden");
        });

        const dialogFlow = floatingPanelEl.querySelector("#ed-dialog-flow");
        const replyInput = floatingPanelEl.querySelector("#ed-reply-input");
        const sendBtn = floatingPanelEl.querySelector("#ed-btn-send");
        const abortBtn = floatingPanelEl.querySelector("#ed-btn-force-abort");
        const minimizeBtn = floatingPanelEl.querySelector("#ed-btn-minimize");
        const evalStatus = floatingPanelEl.querySelector("#ed-eval-status");
        const roundNumEl = floatingPanelEl.querySelector("#ed-round-num");
        const tensionTag = floatingPanelEl.querySelector("#ed-tension-tag");
        const chipButtons = floatingPanelEl.querySelectorAll(".editorial-chip-action");
        const selfieBtn = floatingPanelEl.querySelector("#ed-chip-photo-selfie");
        const envBtn = floatingPanelEl.querySelector("#ed-chip-photo-env");
        const toggleHistory = floatingPanelEl.querySelector("#ed-toggle-history");
        const historyDrawer = floatingPanelEl.querySelector("#ed-history-drawer");
        const snoopTextEl = floatingPanelEl.querySelector("#ed-snoop-text");

        // 最小化为悬浮球
        minimizeBtn.onclick = () => {
          floatingPanelEl.classList.add("is-hidden");
          floatingBallEl.classList.remove("is-hidden");
          ctx.ui.toast("已缩为悬浮球，点击悬浮球可随时恢复小窗");
        };

        snoopIntervalCleaner = ctx.system.timers.setInterval(() => {
          if (!isPatrolling) return;
          snoopIndex = (snoopIndex + 1) % snoopLogs.length;
          if (snoopTextEl) {
            snoopTextEl.textContent = snoopLogs[snoopIndex];
          }
        }, 3500);

        toggleHistory.onclick = () => {
          historyDrawer.classList.toggle("open");
        };

        // 拍照点击逻辑：直接向聊天室发送证据卡片，确保有记录留底
        const sendEvidence = async (text, isPhoto = false) => {
            const evidenceData = {
                text: text,
                photoUrl: isPhoto ? "data:image/svg+xml;utf8,<svg width='200' height='200' xmlns='http://www.w3.org/2000/svg'><rect width='200' height='200' fill='%23eee'/><text x='50%' y='50%' font-size='12' text-anchor='middle'>LIVE_EVIDENCE</text></svg>" : null
            };

            if (sessionId) {
                ctx.data.messages.push({
                    sessionId: sessionId,
                    role: "user",
                    content: `[证据呈递] ${text}`,
                    mediaType: "plugin:patrol_statement",
                    mediaData: evidenceData
                });
            }
            // 提交给 AI 进行审讯判断
            processRound(text);
        };

        if (selfieBtn) {
            selfieBtn.onclick = () => sendEvidence("呈递了一张实时正脸自拍，我真的在忙，你看我的表情。", true);
        }
        if (envBtn) {
            envBtn.onclick = () => sendEvidence("呈递了一张当前桌面环境抓拍，真的在处理事务，没有做别的事情。", true);
        }

        const scrollDialogToBottom = () => {
          setTimeout(() => {
            dialogFlow.scrollTop = dialogFlow.scrollHeight;
          }, 30);
        };

        const closePanel = () => {
          if (snoopIntervalCleaner) {
            if (typeof snoopIntervalCleaner === "function") snoopIntervalCleaner();
            snoopIntervalCleaner = null;
          }
          if (floatingPanelEl && floatingPanelEl.parentNode) {
            floatingPanelEl.parentNode.removeChild(floatingPanelEl);
            floatingPanelEl = null;
          }
          if (floatingBallEl && floatingBallEl.parentNode) {
            floatingBallEl.parentNode.removeChild(floatingBallEl);
            floatingBallEl = null;
          }
          isPatrolling = false;
          currentPatrolCharName = "";
          if (currentInspectionResolver) {
            currentInspectionResolver();
            currentInspectionResolver = null;
          }
        };

        abortBtn.onclick = () => {
          tension = Math.min(100, tension + 35);
          currentPatrolTension = tension;
          transcript.push({ speaker: "SYSTEM", text: "（用户强行中断了审讯，判定为心虚逃逸）" });
          
          const sessionSummary = `【案卷 No.${refId} | ${timeStr}】\n- 翻查事实: ${screenText.slice(0, 100)}...\n- 审讯始末: \n${transcript.map(t => `  * ${t.speaker}: ${t.text}`).join("\n")}\n- 结案结论: 用户强行中断逃逸，怀疑度激增至 ${tension}%\n`;
          const updatedAllHistory = (pastHistory === "（暂无更早的旧审讯记录）" ? "" : pastHistory + "\n---\n") + sessionSummary;
          ctx.system.storage.set("all_patrol_history", updatedAllHistory);

          updateLiveDossier(true, "Force Aborted (Evaded)");

          closePanel();
          ctx.ui.toast(`已强制脱离 · 逃逸始末已留存，怀疑度升至 ${tension}%`);
        };

        const processRound = async (userText) => {
          try {
            assertNoBlViolation(userText, "用户陈述输入");
          } catch (inputErr) {
            return;
          }

          if (!userText.trim()) return;

          roundCount++;
          sendBtn.disabled = true;
          evalStatus.style.display = "inline-flex";

          transcript.push({ speaker: "YOU", text: userText });
          updateLiveDossier(false, "Evaluating Statement");

          const userItem = document.createElement("div");
          userItem.className = "editorial-item-user";
          userItem.innerHTML = `
            <div style="font-family:sans-serif; font-size:8.5px; letter-spacing:0.12em; text-transform:uppercase; color:#999; margin-bottom:3px;">
              You · Statement
            </div>
            <div style="font-size:12px; line-height:1.45; color:#333;">
              ${userText}
            </div>
          `;
          dialogFlow.appendChild(userItem);
          scrollDialogToBottom();
          replyInput.value = "";

          const historyPrompt = transcript
            .map((t) => `${t.speaker === "YOU" ? "用户" : target.characterName}: ${t.text}`)
            .join("\n");

          let isSatisfied = false;
          let replyContent = "";

          try {
            const judgePrompt = `【扮演角色设定】：\n${target.profile}\n\n【过往聊天记忆】：\n${target.recentMemory}\n\n【过往案卷始末】：\n${pastHistory}\n\n【角色翻阅手机发现的数据】：\n- 联系人: ${snoopData.contactNames.join(", ")}\n- 屏幕可见文字: "${screenText}"\n\n【当前审讯对话历史】：\n${historyPrompt}\n\n【重要评判规则】：
1. 严格依据角色人设脾气与口吻回应，严禁输出任何重复的台词或无意义的口头禅。
2. ${customPhotoRule}
3. 如果用户提供了诚恳解释或配合发送了自拍照/自证照片，结合角色人设判断是否消气。
4. 若不满意/在狡辩，第一行输出 [STATUS:CONTINUE]，第二行输出紧逼追问（必须针对上一步用户的陈述进行反驳，不要重复之前的质问）。
5. 若态度真诚、说服了你、或成功哄好了你，第一行输出 [STATUS:SATISFIED]，第二行输出释怀/原谅的话语。
【严禁规则】：严禁BL/攻受，严禁Emoji，禁止重复陈词滥调。每句回答必须言之有物。`;

            const aiEval = await ctx.ai.chat({
              system: "你是一个拥有鲜明性格与完整记忆的审讯角色，首行必须严格输出 [STATUS:CONTINUE] 或 [STATUS:SATISFIED]，严禁BL/攻受及Emoji。",
              prompt: judgePrompt,
              temperature: 0.8,
            });

            const parsed = parseAiEvaluation(aiEval);
            isSatisfied = parsed.isSatisfied;
            replyContent = parsed.replyContent;

            if (isSatisfied) {
              tension = Math.max(5, tension - 35);
            } else {
              tension = Math.min(100, tension + 8);
            }
            currentPatrolTension = tension;
          } catch (err) {
            replyContent = "……你最好再认真想想怎么回答。";
            isSatisfied = false;
          } finally {
            evalStatus.style.display = "none";
            sendBtn.disabled = false;
          }

          transcript.push({ speaker: target.characterName, text: replyContent });
          updateLiveDossier(isSatisfied, isSatisfied ? "Satisfied / Resolved" : `In Progress (Round ${roundCount})`);

          const charItem = document.createElement("div");
          charItem.className = "editorial-item-char";
          charItem.innerHTML = `
            <div style="font-family:sans-serif; font-size:8.5px; letter-spacing:0.12em; text-transform:uppercase; color:${isSatisfied ? "#2a6f4e" : "#999"}; margin-bottom:3px;">
              ${isSatisfied ? "Interrogation · Resolved" : `Interrogation · ${target.characterName}`}
            </div>
            <div style="font-size:12.5px; line-height:1.55; color:#111; font-style:italic;">
              “${replyContent}”
            </div>
          `;
          dialogFlow.appendChild(charItem);
          scrollDialogToBottom();

          roundNumEl.textContent = `${roundCount + 1}`;
          tensionTag.textContent = `TENSION : ${tension}%`;

          if (isSatisfied) {
            sendBtn.disabled = true;
            replyInput.disabled = true;

            const sessionSummary = `【案卷 No.${refId} | ${timeStr}】\n- 翻查事实: ${screenText.slice(0, 100)}...\n- 审讯始末: \n${transcript.map(t => `  * ${t.speaker}: ${t.text}`).join("\n")}\n- 结案结论: 达成释怀，怀疑度降至 ${tension}%\n`;
            const updatedAllHistory = (pastHistory === "（暂无更早的旧审讯记录）" ? "" : pastHistory + "\n---\n") + sessionSummary;
            ctx.system.storage.set("all_patrol_history", updatedAllHistory);

            updateLiveDossier(true, "Satisfied / Unlocked");

            setTimeout(() => {
              closePanel();
              ctx.ui.toast(`心智审讯通过 · 巡视已完成`);
            }, 1100);
          }
        };

        chipButtons.forEach((btn) => {
          if (btn.id !== "ed-chip-photo-selfie" && btn.id !== "ed-chip-photo-env") {
            btn.onclick = () => {
              const text = btn.getAttribute("data-text");
              if (text) processRound(text);
            };
          }
        });

        sendBtn.onclick = () => {
          const val = replyInput.value;
          if (!val.trim()) {
            ctx.ui.toast("请输入陈述内容");
            return;
          }
          processRound(val);
        };

        replyInput.onkeydown = (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
          }
        };
      });
    }

    // 调度循环：增加开关判断
    function scheduleLoop() {
      if (nextPatrolTimeoutCleaner) {
        if (typeof nextPatrolTimeoutCleaner === "function") nextPatrolTimeoutCleaner();
        nextPatrolTimeoutCleaner = null;
      }

      // 如果开关关闭则停止循环调度
      if (ctx.system.settings.get("autoPatrolEnabled") === false) return;

      let rawBase = Number(ctx.system.settings.get("intervalMin"));
      let rawVariance = Number(ctx.system.settings.get("randomVariance"));

      const baseMin = Number.isFinite(rawBase) ? Math.max(1, rawBase) : 12;
      const varianceMin = Number.isFinite(rawVariance) ? Math.max(0, rawVariance) : 4;

      const offset = (Math.random() * 2 - 1) * varianceMin;
      const finalMinutes = Math.max(1, baseMin + offset);
      const delayMs = Math.round(finalMinutes * 60 * 1000);

      ctx.system.log(`[巡视调度] 下次静默审视预定于 ${Math.round(finalMinutes)} 分钟后触发（${delayMs} ms）`);

      nextPatrolTimeoutCleaner = ctx.system.timers.setTimeout(() => {
        startInteractiveInspection().finally(() => {
          scheduleLoop();
        });
      }, delayMs);
    }

    ctx.system.settings.onChange(() => {
      if (!isPatrolling) {
        ctx.system.log("[巡视调度] 设置已更新，重置倒计时");
        scheduleLoop();
      }
    });

    scheduleLoop();

    // 聊天头部入口
    ctx.ui.slot("chat.header", (el, props) => {
      const btn = document.createElement("button");
      btn.innerHTML = `<span style="display:inline-flex; align-items:center; gap:5px;">${ICONS.aperture} <span>主动受审</span></span>`;
      btn.style.cssText = "font-family:-apple-system,sans-serif; font-size:10px; letter-spacing:0.06em; padding:3px 8px; border-radius:1px; background:transparent; border:1px solid rgba(0,0,0,0.15); color:inherit; cursor:pointer; margin:4px; opacity:0.75; user-select:none;";

      btn.onclick = () => {
        lastActiveSessionId = props.sessionId;
        startInteractiveInspection().finally(() => {
          scheduleLoop();
        });
      };
      el.appendChild(btn);
    });

    return () => {
      if (floatingPanelEl && floatingPanelEl.parentNode) {
        floatingPanelEl.parentNode.removeChild(floatingPanelEl);
      }
      if (floatingBallEl && floatingBallEl.parentNode) {
        floatingBallEl.parentNode.removeChild(floatingBallEl);
      }
      if (snoopIntervalCleaner && typeof snoopIntervalCleaner === "function") {
        snoopIntervalCleaner();
      }
      if (nextPatrolTimeoutCleaner && typeof nextPatrolTimeoutCleaner === "function") {
        nextPatrolTimeoutCleaner();
      }
    };
  },
};