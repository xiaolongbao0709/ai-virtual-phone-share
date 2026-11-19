export default {
  manifest: {
    id: "fuzzy-clock-time-skip",
    name: "剧情时钟",
    apiVersion: 1,
    version: "2.2.0",
    author: "Wynn",
    description: "拟物拨动钟表推进剧情时间，支持与现实时间动态同步",
    permissions: ["chat.read", "chat.write", "prompts"],
    settings: [
      {
        key: "stepMinutes",
        label: "拨动表盘最小步进（分钟）",
        type: "select",
        default: "5",
        options: [
          { value: "1", label: "1 分钟（精确）" },
          { value: "5", label: "5 分钟（推荐）" },
          { value: "15", label: "15 分钟" },
        ],
      },
    ],
  },

  setup(ctx) {
    // ================= 1. 样式注入 =================
    ctx.ui.injectCSS(`
      .fc-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(128, 128, 128, 0.12);
        border: 1px solid rgba(128, 128, 128, 0.22);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s ease;
        margin: 4px 8px;
      }
      .fc-pill-btn:active {
        transform: scale(0.96);
        background: rgba(128, 128, 128, 0.22);
      }
      .fc-sync-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #52c41a;
        box-shadow: 0 0 6px rgba(82, 196, 26, 0.7);
      }
      .fc-sync-dot.paused {
        background: #e2c07d;
        box-shadow: 0 0 6px rgba(226, 192, 125, 0.8);
      }
      .fc-modal-wrap {
        position: relative;
        width: 324px;
        max-width: 92vw;
        padding: 18px 16px 16px;
        border-radius: 20px;
        background: linear-gradient(165deg, #1b2236 0%, #111524 100%);
        color: #f3e9d2;
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 232, 180, 0.16);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        user-select: none;
        overflow: hidden;
      }
      .fc-title {
        font-size: 14px;
        letter-spacing: 1.5px;
        color: #d4bc8b;
        margin-bottom: 2px;
      }
      .fc-digital {
        font-size: 28px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        letter-spacing: 1.5px;
        color: #fff6e0;
        text-shadow: 0 0 14px rgba(235, 198, 120, 0.35);
      }
      .fc-sub-anchor {
        margin-top: 4px;
        font-size: 11px;
        color: rgba(216, 198, 160, 0.85);
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .fc-edit-anchor-btn {
        background: rgba(212, 188, 139, 0.18);
        border: 1px solid rgba(212, 188, 139, 0.35);
        color: #f3d999;
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 6px;
        cursor: pointer;
      }
      .fc-edit-anchor-btn:active {
        background: rgba(212, 188, 139, 0.35);
      }
      .fc-delta-badge {
        margin-top: 7px;
        font-size: 12px;
        padding: 4px 12px;
        border-radius: 999px;
        background: rgba(212, 188, 139, 0.14);
        color: #ebd5a7;
        border: 1px solid rgba(212, 188, 139, 0.28);
        text-align: center;
        line-height: 1.4;
      }
      /* 复古星象天体仪钟表 */
      .fc-dial {
        position: relative;
        width: 224px;
        height: 224px;
        margin: 12px 0 10px;
        border-radius: 50%;
        background: radial-gradient(circle at 50% 45%, #23304d 0%, #151c2e 65%, #0e1321 100%);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55), inset 0 0 18px rgba(0, 0, 0, 0.65);
        touch-action: none;
        cursor: grab;
      }
      .fc-dial:active {
        cursor: grabbing;
      }
      .fc-dial-svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .fc-roman {
        position: absolute;
        width: 28px;
        height: 20px;
        margin-left: -14px;
        margin-top: -10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: "Times New Roman", Georgia, serif;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #e6cf9c;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
        pointer-events: none;
      }
      .fc-hand-hour-wrap,
      .fc-hand-min-wrap {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .fc-quick-row {
        display: flex;
        gap: 5px;
        width: 100%;
        justify-content: center;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      .fc-quick-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(212, 188, 139, 0.25);
        color: #e6d5b2;
        font-size: 11px;
        padding: 4px 7px;
        border-radius: 8px;
        cursor: pointer;
      }
      .fc-quick-btn:active {
        background: rgba(212, 188, 139, 0.25);
      }
      .fc-mode-box {
        width: 100%;
        margin-bottom: 12px;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .fc-mode-label {
        font-size: 11px;
        color: rgba(216, 198, 160, 0.75);
        text-align: left;
        padding-left: 2px;
      }
      .fc-mode-group {
        display: flex;
        background: rgba(0, 0, 0, 0.28);
        border: 1px solid rgba(212, 188, 139, 0.25);
        border-radius: 10px;
        padding: 2px;
        gap: 2px;
      }
      .fc-mode-opt {
        flex: 1;
        padding: 5px 4px;
        font-size: 11px;
        border: none;
        border-radius: 8px;
        background: transparent;
        color: #b8b2a6;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
      }
      .fc-mode-opt.active {
        background: rgba(212, 188, 139, 0.25);
        color: #fff3d6;
        font-weight: 600;
      }
      .fc-actions {
        display: flex;
        gap: 10px;
        width: 100%;
      }
      .fc-btn {
        flex: 1;
        padding: 9px 0;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: opacity 0.2s ease;
      }
      .fc-btn-cancel {
        background: rgba(255, 255, 255, 0.1);
        color: #c5c9d6;
      }
      .fc-btn-confirm {
        background: linear-gradient(135deg, #e2c07d 0%, #b88d42 100%);
        color: #1a160d;
        box-shadow: 0 4px 12px rgba(200, 158, 78, 0.35);
      }
      .fc-btn-confirm:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        box-shadow: none;
      }
      .fc-msg-card {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 6px 14px;
        margin: 4px auto;
        border-radius: 10px;
        background: rgba(191, 162, 106, 0.12);
        border: 1px dashed rgba(191, 162, 106, 0.45);
        font-size: 12px;
        opacity: 0.9;
        text-align: center;
      }
      .fc-msg-card.fc-hidden-banner {
        display: none !important;
      }
      .fc-calib-overlay {
        position: absolute;
        inset: 0;
        background: rgba(16, 19, 31, 0.96);
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 20px;
        z-index: 10;
        text-align: center;
      }
      .fc-calib-overlay.open {
        display: flex;
      }
      .fc-calib-title {
        font-size: 15px;
        font-weight: 600;
        color: #f3d999;
        margin-bottom: 6px;
      }
      .fc-calib-desc {
        font-size: 12px;
        color: #cfc6b4;
        line-height: 1.5;
        margin-bottom: 14px;
      }
      .fc-calib-inputs {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }
      .fc-calib-days-wrap {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(212, 188, 139, 0.35);
        color: #fff6e0;
        border-radius: 8px;
        padding: 6px 8px;
        font-size: 13px;
      }
      .fc-calib-days-input {
        width: 38px;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(212, 188, 139, 0.6);
        color: #fff6e0;
        font-size: 14px;
        text-align: center;
        outline: none;
        font-variant-numeric: tabular-nums;
      }
      .fc-calib-time {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(212, 188, 139, 0.35);
        color: #fff6e0;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 15px;
        font-variant-numeric: tabular-nums;
      }
      .fc-calib-err {
        min-height: 18px;
        font-size: 11px;
        color: #ff7875;
        margin-bottom: 10px;
      }
    `);

    // ================= 2. 齿轮机械音效合成器（Web Audio API） =================
    let audioCtx = null;
    function playGearTickSound(isMajor = false) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === "suspended") audioCtx.resume();

        const now = audioCtx.currentTime;

        // 1. 金属棘轮短促脉冲
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = isMajor ? "triangle" : "sine";
        const startFreq = isMajor ? 520 : 780;
        const endFreq = isMajor ? 140 : 210;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.032);

        gain.gain.setValueAtTime(isMajor ? 0.16 : 0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.036);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.038);

        // 2. 齿轮咬合高频微噪音（模拟金属摩擦质感）
        const bufferSize = Math.floor(audioCtx.sampleRate * 0.018);
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = isMajor ? 1900 : 2600;
        filter.Q.value = 3.2;

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(isMajor ? 0.14 : 0.08, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(now);
      } catch (_) {}
    }

    // ================= 3. 基础工具函数 =================
    const pad = (n) => String(Math.floor(n)).padStart(2, "0");
    const ROMAN_NUMERALS = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];

    function getStepMinutes() {
      const val = Number(ctx.system.settings.get("stepMinutes"));
      return [1, 5, 15].includes(val) ? val : 5;
    }

    function getNotifyMode() {
      const mode = ctx.system.storage.get("pref_notifyMode");
      return ["both", "delta_only", "time_only"].includes(mode) ? mode : "both";
    }

    function setNotifyMode(mode) {
      ctx.system.storage.set("pref_notifyMode", mode);
    }

    function getPeriodName(hour) {
      if (hour >= 0 && hour < 5) return "凌晨";
      if (hour >= 5 && hour < 8) return "清晨";
      if (hour >= 8 && hour < 11) return "上午";
      if (hour >= 11 && hour < 13) return "中午";
      if (hour >= 13 && hour < 17) return "下午";
      if (hour >= 17 && hour < 19) return "傍晚";
      return "夜晚";
    }

    function formatDeltaText(diffMinutes) {
      const total = Math.max(0, Math.round(diffMinutes));
      if (total <= 0) return "不到 1 分钟";
      const days = Math.floor(total / 1440);
      const rem = total % 1440;
      const hours = Math.floor(rem / 60);
      const mins = rem % 60;

      const parts = [];
      if (days > 0) parts.push(`${days}天`);
      if (hours > 0) parts.push(`${hours}小时`);
      if (mins > 0) parts.push(`${mins}分钟`);
      return parts.join("");
    }

    function parseTimestamp(ts) {
      const d = new Date(ts);
      const hour = d.getHours();
      const minute = d.getMinutes();
      return { hour, minute, period: getPeriodName(hour) };
    }

    function calcDayDiff(tsA, tsB) {
      const dA = new Date(tsA);
      const dB = new Date(tsB);
      const utcA = Date.UTC(dA.getFullYear(), dA.getMonth(), dA.getDate());
      const utcB = Date.UTC(dB.getFullYear(), dB.getMonth(), dB.getDate());
      return Math.round((utcB - utcA) / 86400000);
    }

    // ================= 4. 时间戳提取与自动基准校准 =================
    function extractTimestampFromObject(obj, depth = 0) {
      if (!obj || typeof obj !== "object" || depth > 2) return null;
      for (const k of Object.keys(obj)) {
        const val = obj[k];
        if (val == null || val === "") continue;
        if (typeof val === "object" && !Array.isArray(val)) {
          const nested = extractTimestampFromObject(val, depth + 1);
          if (nested) return nested;
          continue;
        }
        if (!/time|date|at|ts|stamp/i.test(k)) continue;
        if (typeof val === "number" && !Number.isNaN(val)) {
          if (val > 1000000000 && val < 10000000000) return val * 1000;
          if (val >= 1000000000000 && val < 9999999999999) return val;
        } else if (typeof val === "string") {
          const num = Number(val);
          if (!Number.isNaN(num)) {
            if (num > 1000000000 && num < 10000000000) return num * 1000;
            if (num >= 1000000000000 && num < 9999999999999) return num;
          }
          const parsed = Date.parse(val.replace(/-/g, "/"));
          if (!Number.isNaN(parsed) && parsed > 1000000000000) return parsed;
          const parsedIso = Date.parse(val);
          if (!Number.isNaN(parsedIso) && parsedIso > 1000000000000) return parsedIso;
        }
      }
      return null;
    }

    function extractLastTimestampFromDOM() {
      try {
        const now = new Date();
        const candidates = document.querySelectorAll("span, div, time, p, small");
        for (let i = candidates.length - 1; i >= 0; i--) {
          const el = candidates[i];
          if (el.children.length > 0) continue;
          const text = (el.textContent || "").trim();
          if (!text || text.length > 25) continue;
          if (el.closest(".fc-pill-btn, .fc-modal-wrap, .fc-msg-card")) continue;

          const fullMatch = text.match(/^(?:(\d{4})[-/])?(\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})$/);
          if (fullMatch) {
            const year = fullMatch[1] ? Number(fullMatch[1]) : now.getFullYear();
            const month = Number(fullMatch[2]) - 1;
            const day = Number(fullMatch[3]);
            const hour = Number(fullMatch[4]);
            const minute = Number(fullMatch[5]);
            const d = new Date(year, month, day, hour, minute, 0, 0);
            if (!fullMatch[1] && d.getTime() > now.getTime() + 86400000) {
              d.setFullYear(year - 1);
            }
            if (!Number.isNaN(d.getTime())) return d.getTime();
          }

          const timeOnlyMatch = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
          if (timeOnlyMatch) {
            const rect = el.getBoundingClientRect();
            if (rect.top > 70 && rect.bottom < window.innerHeight - 40) {
              const hour = Number(timeOnlyMatch[1]);
              const minute = Number(timeOnlyMatch[2]);
              const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
              if (d.getTime() > now.getTime() + 300000) {
                d.setDate(d.getDate() - 1);
              }
              return d.getTime();
            }
          }
        }
      } catch (_) {}
      return null;
    }

    function getEffectiveTimeState(sessionId) {
      const now = Date.now();
      const overrideTs = ctx.system.storage.get(`overrideTs_${sessionId}`);
      if (typeof overrideTs === "number" && !Number.isNaN(overrideTs)) {
        if (now < overrideTs) {
          return { timestamp: overrideTs, isPausedSync: true };
        } else {
          ctx.system.storage.remove(`overrideTs_${sessionId}`);
          ctx.system.storage.remove(`lastDelta_${sessionId}`);
        }
      }
      return { timestamp: now, isPausedSync: false };
    }

    function autoCalibrateInteractionTs(sessionId) {
      const now = Date.now();
      const { isPausedSync, timestamp: effectiveTs } = getEffectiveTimeState(sessionId);

      if (isPausedSync) {
        ctx.system.storage.set(`lastStoryTs_${sessionId}`, effectiveTs);
        return effectiveTs;
      }

      let latestBannerTarget = null;
      let latestRealMsgTs = null;

      try {
        const msgs = ctx.data.messages.list(sessionId) || [];
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (!m) continue;
          if (
            latestBannerTarget === null &&
            m.mediaType === "plugin:time-skip-banner" &&
            typeof m.mediaData?.targetTs === "number"
          ) {
            latestBannerTarget = m.mediaData.targetTs;
          }
          if (latestRealMsgTs === null && m.mediaType !== "plugin:time-skip-banner") {
            const ts = extractTimestampFromObject(m);
            if (ts) latestRealMsgTs = ts;
          }
          if (latestBannerTarget !== null && latestRealMsgTs !== null) break;
        }
      } catch (_) {}

      if (latestBannerTarget !== null) {
        if (latestBannerTarget > now) {
          ctx.system.storage.set(`overrideTs_${sessionId}`, latestBannerTarget);
        }
        ctx.system.storage.set(`lastStoryTs_${sessionId}`, latestBannerTarget);
        return latestBannerTarget;
      }

      const saved = ctx.system.storage.get(`lastStoryTs_${sessionId}`);
      const resolvedTs =
        latestRealMsgTs ||
        (typeof saved === "number" && !Number.isNaN(saved) ? saved : null) ||
        extractLastTimestampFromDOM() ||
        now;

      ctx.system.storage.set(`lastStoryTs_${sessionId}`, resolvedTs);
      return resolvedTs;
    }

    // ================= 5. 提示词构建与同步 =================
    function buildTimePromptSentence(mode, deltaText, nowTimeText, hasDelta, dayOffset = 0) {
      const dayPrefix = dayOffset >= 1 ? (dayOffset === 1 ? "次日" : `${dayOffset}天后`) : "";
      const fullTimeLabel = `${dayPrefix}${nowTimeText}`;

      if (mode === "delta_only") {
        return hasDelta
          ? `距离上一次对话已经过去了【${deltaText}】！（注意：上一轮对话的时间段已经过去，请承接上文状态，根据时间流逝推进接下来的剧情。）`
          : `时间刚刚流逝了片刻，请承接上文状态推进接下来的剧情。`;
      }
      if (mode === "time_only") {
        return `现在已经是【${fullTimeLabel}】了！（注意：上一轮对话的时间段已经过去，现在是${fullTimeLabel}，请承接上文状态，根据新的时间推进接下来的剧情。）`;
      }
      return hasDelta
        ? `距离上一次对话已经过去了【${deltaText}】，现在已经是【${fullTimeLabel}】了！（注意：上一轮对话的时间段已经过去，现在是${fullTimeLabel}，请承接上文状态，根据新的时间推进接下来的剧情。）`
        : `现在已经是【${fullTimeLabel}】了！（注意：请承接上文状态，根据当前时间推进接下来的剧情。）`;
    }

    function syncPromptForSession(sessionId) {
      const { timestamp } = getEffectiveTimeState(sessionId);
      const lastStoryTs = autoCalibrateInteractionTs(sessionId);
      const { hour, minute, period } = parseTimestamp(timestamp);
      const nowTimeText = `${period} ${pad(hour)}:${pad(minute)}`;
      const elapsedMins = Math.max(0, Math.floor((timestamp - lastStoryTs) / 60000));
      const dayOffset = calcDayDiff(lastStoryTs, timestamp);
      const mode = getNotifyMode();

      const sentence = buildTimePromptSentence(
        mode,
        formatDeltaText(elapsedMins),
        nowTimeText,
        elapsedMins > 5,
        dayOffset
      );
      ctx.prompts.set(`【场景切换】：${sentence}`, { sessionId });
    }

    // ================= 6. 时间卡片渲染与动态显隐 =================
    function syncAllDomBannersVisibility() {
      const cards = document.querySelectorAll(".fc-msg-card");
      if (!cards.length) return;

      cards.forEach((card) => {
        let rowEl = card.parentElement;
        while (
          rowEl &&
          rowEl.parentElement &&
          rowEl.parentElement.children.length === 1 &&
          rowEl.parentElement !== document.body
        ) {
          rowEl = rowEl.parentElement;
        }

        if (!rowEl || !rowEl.parentElement) {
          card.classList.add("fc-hidden-banner");
          return;
        }

        let hasSubsequentMessage = false;
        let next = rowEl.nextElementSibling;
        while (next) {
          const text = (next.textContent || "").trim();
          const hasMedia = next.querySelector("img, video, audio, canvas, svg");
          if (text.length > 0 || hasMedia) {
            hasSubsequentMessage = true;
            break;
          }
          next = next.nextElementSibling;
        }

        card.classList.toggle("fc-hidden-banner", hasSubsequentMessage);
      });
    }

    let domObserver = null;
    if (typeof MutationObserver !== "undefined" && document.body) {
      domObserver = new MutationObserver(() => {
        syncAllDomBannersVisibility();
      });
      domObserver.observe(document.body, { childList: true, subtree: true });
    }

    ctx.ui.messageKind("time-skip-banner", (el, msg) => {
      const data = msg.mediaData || {};
      const card = document.createElement("div");
      card.className = "fc-msg-card fc-hidden-banner";
      card.innerHTML = `
        <span>⏳</span>
        <span>${data.summary || "时间向前推进了"}</span>
      `;
      el.appendChild(card);

      syncAllDomBannersVisibility();
      requestAnimationFrame(() => syncAllDomBannersVisibility());
    });

    // ================= 7. 消息落库与删除事件监听 =================
    ctx.hooks.on("message.persisted", (payload) => {
      const msg = payload && payload.message;
      if (!msg || !msg.sessionId) return;

      syncAllDomBannersVisibility();
      ctx.system.timers.setTimeout(syncAllDomBannersVisibility, 60);

      if (msg.mediaType === "plugin:time-skip-banner") return;
      if (msg.role === "user" || msg.role === "assistant") {
        const { timestamp } = getEffectiveTimeState(msg.sessionId);
        ctx.system.storage.set(`lastStoryTs_${msg.sessionId}`, timestamp);
        syncPromptForSession(msg.sessionId);
      }
    });

    ctx.hooks.on("message.deleted", (payload) => {
      const sessionId = payload && payload.sessionId;
      if (!sessionId) return;

      ctx.system.storage.remove(`overrideTs_${sessionId}`);
      autoCalibrateInteractionTs(sessionId);
      syncPromptForSession(sessionId);
      syncAllDomBannersVisibility();
      ctx.system.timers.setTimeout(syncAllDomBannersVisibility, 60);
    });

    // ================= 8. 复古星象天体仪钟表弹窗 =================
    function buildAstrolabeDialSVG() {
      // 生成外圈 60 精细刻度线
      let ticksSvg = "";
      for (let i = 0; i < 60; i++) {
        const isHour = i % 5 === 0;
        const r1 = isHour ? 97 : 99;
        const r2 = 104;
        const strokeW = isHour ? 1.6 : 0.8;
        const opacity = isHour ? 0.95 : 0.55;
        ticksSvg += `<line x1="112" y1="${112 - r1}" x2="112" y2="${112 - r2}" stroke="#e4c988" stroke-width="${strokeW}" stroke-opacity="${opacity}" transform="rotate(${i * 6} 112 112)" />`;
      }

      // 生成内盘罗盘方位刻度与星芒射线
      let innerTicks = "";
      for (let i = 0; i < 24; i++) {
        const r1 = i % 2 === 0 ? 48 : 51;
        innerTicks += `<line x1="112" y1="${112 - r1}" x2="112" y2="57" stroke="#c9ac6c" stroke-width="0.7" stroke-opacity="0.45" transform="rotate(${i * 15} 112 112)" />`;
      }

      return `
        <svg class="fc-dial-svg" viewBox="0 0 224 224">
          <defs>
            <linearGradient id="fc-gold-bezel" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f7e3b0" />
              <stop offset="35%" stop-color="#c9a054" />
              <stop offset="70%" stop-color="#7c5d26" />
              <stop offset="100%" stop-color="#ebd194" />
            </linearGradient>
            <linearGradient id="fc-hand-gold" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#b88e43" />
              <stop offset="50%" stop-color="#f5dfab" />
              <stop offset="100%" stop-color="#fff7de" />
            </linearGradient>
            <radialGradient id="fc-sun-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#fff3c4" stop-opacity="0.4" />
              <stop offset="100%" stop-color="#d4af64" stop-opacity="0" />
            </radialGradient>
          </defs>

          <!-- 外圈厚重古铜金表壳 -->
          <circle cx="112" cy="112" r="108.5" fill="none" stroke="url(#fc-gold-bezel)" stroke-width="5.5" />
          <circle cx="112" cy="112" r="104.5" fill="none" stroke="#5c441c" stroke-width="1" />
          <circle cx="112" cy="112" r="96.5" fill="none" stroke="url(#fc-gold-bezel)" stroke-width="1.4" />
          <circle cx="112" cy="112" r="71" fill="none" stroke="url(#fc-gold-bezel)" stroke-width="1.3" stroke-opacity="0.8" />

          <!-- 60 精细刻度 -->
          ${ticksSvg}

          <!-- 内盘偏心天体黄道环（仿图复古星象仪结构） -->
          <g transform="rotate(-28 112 112)">
            <circle cx="112" cy="96" r="44" fill="none" stroke="#d4b46e" stroke-width="1.2" stroke-opacity="0.65" />
            <circle cx="112" cy="96" r="39" fill="none" stroke="#d4b46e" stroke-width="0.7" stroke-dasharray="2 3" stroke-opacity="0.5" />
            <!-- 月牙与星辰装饰 -->
            <path d="M108 55 A6 6 0 1 0 116 55 A4.5 4.5 0 1 1 108 55 Z" fill="#f3dca4" opacity="0.85" />
            <circle cx="112" cy="138" r="2.2" fill="#f3dca4" opacity="0.8" />
          </g>

          <!-- 中心罗盘刻度与星芒 -->
          <circle cx="112" cy="112" r="57" fill="none" stroke="#c8a862" stroke-width="0.9" stroke-opacity="0.55" />
          ${innerTicks}
          <polygon points="112,62 117,107 162,112 117,117 112,162 107,117 62,112 107,107" fill="none" stroke="#dfc280" stroke-width="0.9" stroke-opacity="0.55" />
          <polygon points="82,82 112,107 142,82 117,112 142,142 112,117 82,142 107,112" fill="none" stroke="#dfc280" stroke-width="0.7" stroke-opacity="0.4" />

          <!-- 太阳轮轴光晕与轮辐 -->
          <circle cx="112" cy="112" r="26" fill="url(#fc-sun-glow)" />
          <circle cx="112" cy="112" r="14" fill="#182034" stroke="url(#fc-gold-bezel)" stroke-width="1.6" />
          <circle cx="112" cy="112" r="9" fill="none" stroke="#e5c882" stroke-width="0.9" stroke-dasharray="2 2" />
        </svg>
      `;
    }

    function openClockModal(sessionId, onSaved) {
      const { timestamp: currentClockTs } = getEffectiveTimeState(sessionId);
      let lastStoryTs = autoCalibrateInteractionTs(sessionId);
      let isTempCalibrated = false;

      const baseDate = new Date(currentClockTs);
      baseDate.setSeconds(0, 0);
      const cleanBaseTs = baseDate.getTime();

      const nowDate = new Date();
      nowDate.setSeconds(0, 0);
      const cleanNowTs = nowDate.getTime();

      const minDialOffset = Math.min(0, Math.round((cleanNowTs - cleanBaseTs) / 60000));

      const getCleanAnchor = () => {
        const d = new Date(lastStoryTs);
        d.setSeconds(0, 0);
        return d.getTime();
      };

      const step = getStepMinutes();
      let rawDialOffset = 0;
      let dialOffsetMinutes = 0;
      let lastPlayedTickStep = 0;
      let currentMode = getNotifyMode();

      ctx.ui.openModal((el, { close }) => {
        el.style.background = "transparent";
        el.style.boxShadow = "none";
        el.style.padding = "0";

        el.innerHTML = `
          <div class="fc-modal-wrap">
            <div class="fc-title">✦ 剧情时钟 ✦</div>
            <div class="fc-digital" id="fc-digital">--:--</div>
            <div class="fc-sub-anchor">
              <span id="fc-anchor-text">上次基准：--:--</span>
              <button class="fc-edit-anchor-btn" id="fc-edit-anchor" type="button">手动校准</button>
            </div>
            <div class="fc-delta-badge" id="fc-delta">计算中...</div>
            <div class="fc-dial" id="fc-dial">
              ${buildAstrolabeDialSVG()}
              <!-- 复古镂空针型时针 -->
              <svg class="fc-hand-hour-wrap" id="fc-hand-h" viewBox="0 0 224 224">
                <path d="M112 122 L108.5 112 L110 74 L107 69 L112 56 L117 69 L114 74 L115.5 112 Z" fill="url(#fc-hand-gold)" stroke="#4d3712" stroke-width="0.8" />
                <circle cx="112" cy="70" r="2.2" fill="#182034" />
              </svg>
              <!-- 复古星芒纤长分针 -->
              <svg class="fc-hand-min-wrap" id="fc-hand-m" viewBox="0 0 224 224">
                <path d="M112 126 L109.8 112 L111 45 L108.5 40 L112 24 L115.5 40 L113 45 L114.2 112 Z" fill="url(#fc-hand-gold)" stroke="#4d3712" stroke-width="0.7" />
                <circle cx="112" cy="112" r="4.5" fill="#f7e3b0" stroke="#594016" stroke-width="1.2" />
                <circle cx="112" cy="112" r="1.6" fill="#23304d" />
              </svg>
            </div>
            <div class="fc-quick-row">
              <button class="fc-quick-btn" data-add="-30">-30分</button>
              <button class="fc-quick-btn" data-add="30">+30分</button>
              <button class="fc-quick-btn" data-add="60">+1小时</button>
              <button class="fc-quick-btn" data-add="180">+3小时</button>
              <button class="fc-quick-btn" data-reset="1">归位</button>
            </div>
            <div class="fc-mode-box">
              <div class="fc-mode-label">告知 AI 的内容：</div>
              <div class="fc-mode-group" id="fc-mode-group">
                <button type="button" class="fc-mode-opt" data-mode="both">时间+时长</button>
                <button type="button" class="fc-mode-opt" data-mode="delta_only">仅流逝时长</button>
                <button type="button" class="fc-mode-opt" data-mode="time_only">仅当前时间</button>
              </div>
            </div>
            <div class="fc-actions">
              <button class="fc-btn fc-btn-cancel" id="fc-cancel">取消</button>
              <button class="fc-btn fc-btn-confirm" id="fc-confirm">确认推进</button>
            </div>

            <div class="fc-calib-overlay" id="fc-calib-overlay">
              <div class="fc-calib-title" id="fc-calib-title">校准上次互动时间</div>
              <div class="fc-calib-desc" id="fc-calib-desc">自定义几天前（0为今天）及具体时刻，直接决定流逝时长</div>
              <div class="fc-calib-inputs">
                <div class="fc-calib-days-wrap">
                  <input type="number" min="0" max="999" value="0" class="fc-calib-days-input" id="fc-calib-days-ago" />
                  <span>天前</span>
                </div>
                <input type="time" class="fc-calib-time" id="fc-calib-time" />
              </div>
              <div class="fc-calib-err" id="fc-calib-err"></div>
              <div class="fc-actions">
                <button class="fc-btn fc-btn-cancel" id="fc-calib-cancel" type="button">取消</button>
                <button class="fc-btn fc-btn-confirm" id="fc-calib-ok" type="button">确认校准</button>
              </div>
            </div>
          </div>
        `;

        const dial = el.querySelector("#fc-dial");
        const digitalEl = el.querySelector("#fc-digital");
        const anchorTextEl = el.querySelector("#fc-anchor-text");
        const deltaEl = el.querySelector("#fc-delta");
        const handH = el.querySelector("#fc-hand-h");
        const handM = el.querySelector("#fc-hand-m");
        const confirmBtn = el.querySelector("#fc-confirm");
        const modeBtns = el.querySelectorAll(".fc-mode-opt");

        const calibOverlay = el.querySelector("#fc-calib-overlay");
        const calibTitle = el.querySelector("#fc-calib-title");
        const calibDesc = el.querySelector("#fc-calib-desc");
        const calibDaysAgo = el.querySelector("#fc-calib-days-ago");
        const calibTime = el.querySelector("#fc-calib-time");
        const calibErr = el.querySelector("#fc-calib-err");
        let pendingAutoConfirmAfterCalib = false;
        let calibUpperLimitTs = null;

        // 绘制表盘外环罗马数字（XII, I ~ XI）
        const radius = 84;
        for (let i = 0; i < 12; i++) {
          const angleRad = ((i * 30 - 90) * Math.PI) / 180;
          const x = 112 + radius * Math.cos(angleRad);
          const y = 112 + radius * Math.sin(angleRad);
          const numDiv = document.createElement("div");
          numDiv.className = "fc-roman";
          numDiv.style.left = `${x}px`;
          numDiv.style.top = `${y}px`;
          numDiv.textContent = ROMAN_NUMERALS[i];
          dial.appendChild(numDiv);
        }

        function refreshModeButtons() {
          modeBtns.forEach((b) => {
            b.classList.toggle("active", b.dataset.mode === currentMode);
          });
        }

        modeBtns.forEach((b) => {
          b.addEventListener("click", () => {
            currentMode = b.dataset.mode;
            setNotifyMode(currentMode);
            refreshModeButtons();
          });
        });
        refreshModeButtons();

        function clampOffset(mins) {
          const snapped = Math.round(mins / step) * step;
          return Math.max(minDialOffset, snapped);
        }

        function computeEffectiveDiffMinutes(targetTs, cleanAnchorTs) {
          if (isTempCalibrated) {
            const anchorD = new Date(cleanAnchorTs);
            const targetD = new Date(targetTs);
            const daysAgo = Math.max(0, calcDayDiff(cleanAnchorTs, cleanNowTs));
            const anchorMinsOfDay = anchorD.getHours() * 60 + anchorD.getMinutes();
            const targetMinsOfDay = targetD.getHours() * 60 + targetD.getMinutes();
            return daysAgo * 1440 + (targetMinsOfDay - anchorMinsOfDay);
          }
          return Math.round((targetTs - cleanAnchorTs) / 60000);
        }

        function renderClockUI(withSound = false) {
          dialOffsetMinutes = clampOffset(rawDialOffset);

          // 步进发生变化时播放齿轮咬合声（整点重音，普通刻度轻音）
          if (withSound && dialOffsetMinutes !== lastPlayedTickStep) {
            const targetCheck = new Date(cleanBaseTs + dialOffsetMinutes * 60000);
            const isHourMark = targetCheck.getMinutes() === 0;
            playGearTickSound(isHourMark);
            lastPlayedTickStep = dialOffsetMinutes;
          }

          const cleanAnchorTs = getCleanAnchor();
          const anchorClock = parseTimestamp(cleanAnchorTs);
          const targetTs = cleanBaseTs + dialOffsetMinutes * 60000;
          const { hour, minute, period } = parseTimestamp(targetTs);

          const rawDiffMins = computeEffectiveDiffMinutes(targetTs, cleanAnchorTs);
          const totalElapsedMins = Math.max(0, rawDiffMins);
          const displayDays = Math.floor(totalElapsedMins / 1440);
          const dayTag = displayDays > 0 ? ` (+${displayDays}天)` : "";

          const anchorDaysAgo = Math.max(0, calcDayDiff(cleanAnchorTs, cleanNowTs));
          const anchorDayPrefix = anchorDaysAgo > 0 ? `${anchorDaysAgo}天前 ` : "";

          digitalEl.textContent = `${period} ${pad(hour)}:${pad(minute)}`;
          anchorTextEl.textContent = `上次基准：${anchorDayPrefix}${anchorClock.period} ${pad(anchorClock.hour)}:${pad(anchorClock.minute)}`;

          const canSave = rawDiffMins > 5 || dialOffsetMinutes < 0;
          confirmBtn.disabled = !canSave;

          if (dialOffsetMinutes < 0) {
            if (rawDiffMins <= 0) {
              deltaEl.textContent = `回拨时间早于/等于上次基准，保存时需校准上次互动时间`;
              confirmBtn.textContent = "校准并回拨";
            } else {
              deltaEl.textContent = `已回拨 ${formatDeltaText(Math.abs(dialOffsetMinutes))} · 距上次基准 ${formatDeltaText(totalElapsedMins)}`;
              confirmBtn.textContent = "确认回拨";
            }
          } else if (rawDiffMins <= 5) {
            deltaEl.textContent = `距上次基准仅 ${totalElapsedMins} 分钟（大于5分钟或拨动指针可保存）`;
            confirmBtn.textContent = "确认推进";
          } else if (dialOffsetMinutes === 0) {
            deltaEl.textContent = `距上次基准已流逝 ${formatDeltaText(totalElapsedMins)}${dayTag}`;
            confirmBtn.textContent = "同步当前时间";
          } else {
            deltaEl.textContent = `距上次基准过去了 ${formatDeltaText(totalElapsedMins)}${dayTag}`;
            confirmBtn.textContent = "确认推进";
          }

          const hour12 = (hour % 12) + minute / 60;
          handH.style.transform = `rotate(${hour12 * 30}deg)`;
          handM.style.transform = `rotate(${minute * 6}deg)`;
        }

        function openCalibrationBox({ autoConfirm = false, upperLimitTs = null, reasonText = "" } = {}) {
          pendingAutoConfirmAfterCalib = autoConfirm;
          calibUpperLimitTs = upperLimitTs;
          calibErr.textContent = "";

          if (upperLimitTs) {
            const u = parseTimestamp(upperLimitTs);
            calibTitle.textContent = "需先校准上次互动时间";
            calibDesc.textContent =
              reasonText ||
              `回拨后的时间（${u.period} ${pad(u.hour)}:${pad(u.minute)}）早于当前基准，请输入更早的“上次互动时间”：`;
          } else {
            calibTitle.textContent = "校准上次互动基准时间";
            calibDesc.textContent = "输入几天前（0代表今天）及具体时刻，将直接决定时间流逝跨度：";
          }

          const curAnchorTs = getCleanAnchor();
          const aDate = new Date(curAnchorTs);
          const daysAgo = Math.max(0, calcDayDiff(curAnchorTs, cleanNowTs));
          calibDaysAgo.value = String(daysAgo);
          calibTime.value = `${pad(aDate.getHours())}:${pad(aDate.getMinutes())}`;

          calibOverlay.classList.add("open");
        }

        el.querySelector("#fc-edit-anchor").addEventListener("click", () => {
          openCalibrationBox({ autoConfirm: false, upperLimitTs: null });
        });

        el.querySelector("#fc-calib-cancel").addEventListener("click", () => {
          calibOverlay.classList.remove("open");
          pendingAutoConfirmAfterCalib = false;
        });

        el.querySelector("#fc-calib-ok").addEventListener("click", () => {
          const timeVal = calibTime.value;
          if (!timeVal || !timeVal.includes(":")) {
            calibErr.textContent = "请选择有效的时间";
            return;
          }
          const daysAgo = Math.max(0, Math.floor(Number(calibDaysAgo.value) || 0));
          const [hh, mm] = timeVal.split(":").map(Number);

          const d = new Date(cleanNowTs);
          d.setDate(d.getDate() - daysAgo);
          d.setHours(hh, mm, 0, 0);
          const candidateAnchorTs = d.getTime();

          if (calibUpperLimitTs !== null && candidateAnchorTs >= calibUpperLimitTs) {
            const u = parseTimestamp(calibUpperLimitTs);
            calibErr.textContent = `输入无效：上次互动时间必须早于回拨时间（${pad(u.hour)}:${pad(u.minute)}），否则回拨无法生效！`;
            return;
          }

          lastStoryTs = candidateAnchorTs;
          isTempCalibrated = true;

          calibOverlay.classList.remove("open");
          renderClockUI(false);

          if (pendingAutoConfirmAfterCalib) {
            pendingAutoConfirmAfterCalib = false;
            executeSaveConfirm();
          } else {
            const showD = new Date(lastStoryTs);
            const tag = daysAgo === 0 ? "今天" : `${daysAgo}天前`;
            ctx.ui.toast(`已临时校准基准为 ${tag} ${pad(showD.getHours())}:${pad(showD.getMinutes())}`);
          }
        });

        function executeSaveConfirm() {
          const cleanAnchorTs = getCleanAnchor();
          const dialTargetTs = cleanBaseTs + dialOffsetMinutes * 60000;
          const rawDiffMins = computeEffectiveDiffMinutes(dialTargetTs, cleanAnchorTs);

          if (dialOffsetMinutes < 0 && rawDiffMins <= 0) {
            openCalibrationBox({
              autoConfirm: true,
              upperLimitTs: dialTargetTs,
            });
            return;
          }

          if (rawDiffMins <= 5 && dialOffsetMinutes >= 0) {
            ctx.ui.toast("距离上次基准不足 5 分钟，请先拨动表盘");
            return;
          }

          const totalElapsedMins = Math.max(1, rawDiffMins);
          const finalTargetTs = isTempCalibrated
            ? cleanAnchorTs + totalElapsedMins * 60000
            : dialTargetTs;

          const dayOffset = Math.floor(totalElapsedMins / 1440);
          const deltaText = formatDeltaText(totalElapsedMins);
          const { hour, minute, period } = parseTimestamp(finalTargetTs);
          const nowTimeText = `${period} ${pad(hour)}:${pad(minute)}`;
          const dayPrefix = dayOffset >= 1 ? (dayOffset === 1 ? "次日" : `${dayOffset}天后`) : "";

          if (finalTargetTs > Date.now()) {
            ctx.system.storage.set(`overrideTs_${sessionId}`, finalTargetTs);
          } else {
            ctx.system.storage.remove(`overrideTs_${sessionId}`);
          }

          ctx.system.storage.set(`lastStoryTs_${sessionId}`, finalTargetTs);
          ctx.system.storage.set(`lastDelta_${sessionId}`, deltaText);

          syncPromptForSession(sessionId);

          const sentence = buildTimePromptSentence(
            currentMode,
            deltaText,
            nowTimeText,
            true,
            dayOffset
          );
          const fullPromptText = `【场景切换】：${sentence}`;

          let cardSummary = `距离上次互动过去了 ${deltaText} · 现在是 ${dayPrefix}${nowTimeText}`;
          if (currentMode === "delta_only") {
            cardSummary = `距离上次互动过去了 ${deltaText}`;
          } else if (currentMode === "time_only") {
            cardSummary = `现在是 ${dayPrefix}${nowTimeText}`;
          }

          ctx.data.messages.push({
            sessionId,
            role: "system",
            content: fullPromptText,
            mediaType: "plugin:time-skip-banner",
            mediaData: {
              summary: cardSummary,
              fullPrompt: fullPromptText,
              targetTs: finalTargetTs,
            },
          });

          syncAllDomBannersVisibility();
          ctx.ui.toast(`已保存：${cardSummary}`);
          if (typeof onSaved === "function") onSaved();
          close();
        }

        // 表盘顺/逆时针拖拽交互（带实时齿轮棘轮声）
        let dragging = false;
        let lastAngle = null;

        function getPointerAngle(clientX, clientY) {
          const rect = dial.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          let deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90;
          if (deg < 0) deg += 360;
          return deg;
        }

        function onPointerDown(e) {
          dragging = true;
          const pt = e.touches ? e.touches[0] : e;
          lastAngle = getPointerAngle(pt.clientX, pt.clientY);
          lastPlayedTickStep = dialOffsetMinutes;
        }

        function onPointerMove(e) {
          if (!dragging) return;
          if (e.cancelable) e.preventDefault();
          const pt = e.touches ? e.touches[0] : e;
          const angle = getPointerAngle(pt.clientX, pt.clientY);
          let deltaDeg = angle - lastAngle;
          if (deltaDeg > 180) deltaDeg -= 360;
          if (deltaDeg < -180) deltaDeg += 360;
          lastAngle = angle;

          rawDialOffset = Math.max(minDialOffset, rawDialOffset + deltaDeg * 2);
          renderClockUI(true);
        }

        function onPointerUp() {
          if (!dragging) return;
          dragging = false;
          rawDialOffset = dialOffsetMinutes;
          renderClockUI(false);
        }

        dial.addEventListener("mousedown", onPointerDown);
        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseup", onPointerUp);

        dial.addEventListener("touchstart", onPointerDown, { passive: false });
        window.addEventListener("touchmove", onPointerMove, { passive: false });
        window.addEventListener("touchend", onPointerUp);

        el.querySelectorAll(".fc-quick-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (btn.dataset.reset) {
              rawDialOffset = 0;
            } else {
              const add = Number(btn.dataset.add) || 0;
              if (add < 0 && minDialOffset >= 0) {
                ctx.ui.toast("当前已与现实时间同步，回拨不能早于当前现实时间");
                return;
              }
              rawDialOffset = clampOffset(dialOffsetMinutes + add);
            }
            renderClockUI(true);
          });
        });

        el.querySelector("#fc-cancel").addEventListener("click", () => close());
        el.querySelector("#fc-confirm").addEventListener("click", () => executeSaveConfirm());

        renderClockUI(false);

        return () => {
          window.removeEventListener("mousemove", onPointerMove);
          window.removeEventListener("mouseup", onPointerUp);
          window.removeEventListener("touchmove", onPointerMove);
          window.removeEventListener("touchend", onPointerUp);
        };
      });
    }

    // ================= 9. 聊天顶部时钟入口挂载 =================
    ctx.ui.slot("chat.header", (el, props) => {
      if (!props || !props.sessionId) return;
      const { sessionId } = props;

      ctx.system.timers.setTimeout(() => {
        autoCalibrateInteractionTs(sessionId);
        syncPromptForSession(sessionId);
        syncAllDomBannersVisibility();
      }, 300);

      const btn = document.createElement("button");
      btn.className = "fc-pill-btn";
      btn.type = "button";

      let lastRenderedKey = "";

      const updateBtnLabel = (force = false) => {
        const { timestamp, isPausedSync } = getEffectiveTimeState(sessionId);
        const { hour, minute, period } = parseTimestamp(timestamp);
        const stateKey = `${isPausedSync ? "P" : "S"}-${hour}:${minute}`;

        if (!force && stateKey === lastRenderedKey) return;
        lastRenderedKey = stateKey;

        const dotClass = isPausedSync ? "fc-sync-dot paused" : "fc-sync-dot";
        btn.title = isPausedSync ? "剧情时间锁定中" : "与现实时间同步中";
        btn.innerHTML = `<span class="${dotClass}"></span><span>${period} ${pad(hour)}:${pad(minute)}</span><span style="opacity:.6">▸</span>`;

        syncPromptForSession(sessionId);
      };

      updateBtnLabel(true);

      const stopTimer = ctx.system.timers.setInterval(() => {
        updateBtnLabel(false);
      }, 2000);

      btn.addEventListener("click", () => {
        openClockModal(sessionId, () => updateBtnLabel(true));
      });

      el.appendChild(btn);

      return () => {
        if (typeof stopTimer === "function") stopTimer();
      };
    });

    // ================= 10. 模型请求管线高权重场景注入 =================
    ctx.hooks.transform("llm.request", (payload) => {
      if (!payload || !Array.isArray(payload.messages)) return payload;
      const sessionId = payload.sessionId;
      if (!sessionId) return payload;

      let storedMsgs = [];
      try {
        storedMsgs = ctx.data.messages.list(sessionId) || [];
      } catch (_) {}

      for (const msg of payload.messages) {
        if (msg && msg.mediaType === "plugin:time-skip-banner" && msg.mediaData) {
          msg.role = "user";
          msg.content =
            msg.mediaData.fullPrompt ||
            `【场景切换】：${msg.mediaData.summary}。请承接上文状态，根据新的时间推进接下来的剧情。`;
        }
      }

      let lastBannerIdx = -1;
      let bannerPrompt = "";
      for (let i = storedMsgs.length - 1; i >= 0; i--) {
        const m = storedMsgs[i];
        if (m && m.mediaType === "plugin:time-skip-banner") {
          lastBannerIdx = i;
          bannerPrompt =
            m.mediaData?.fullPrompt ||
            m.content ||
            `【场景切换】：${m.mediaData?.summary || "时间向前推进了"}。请承接上文状态，根据新的时间推进接下来的剧情。`;
          break;
        }
      }

      if (lastBannerIdx === -1 || !bannerPrompt) return payload;

      let firstUserMsgAfterBanner = null;
      for (let j = lastBannerIdx + 1; j < storedMsgs.length; j++) {
        const m = storedMsgs[j];
        if (m && m.role === "user" && m.mediaType !== "plugin:time-skip-banner") {
          firstUserMsgAfterBanner = m;
          break;
        }
      }

      if (!firstUserMsgAfterBanner) {
        const tail = payload.messages[payload.messages.length - 1];
        const tailText =
          tail && typeof tail.content === "string" ? tail.content : JSON.stringify(tail?.content || "");
        if (!tailText.includes("【场景切换】：")) {
          payload.messages.push({ role: "user", content: bannerPrompt });
        }
        return payload;
      }

      const targetRawContent =
        typeof firstUserMsgAfterBanner.content === "string"
          ? firstUserMsgAfterBanner.content.trim()
          : "";

      let injected = false;
      for (let k = payload.messages.length - 1; k >= 0; k--) {
        const pm = payload.messages[k];
        if (!pm || pm.role !== "user") continue;

        if (typeof pm.content === "string") {
          if (pm.content.includes("【场景切换】：")) {
            injected = true;
            break;
          }
          if (!targetRawContent || pm.content.trim() === targetRawContent) {
            pm.content = `${pm.content}\n${bannerPrompt}`;
            injected = true;
            break;
          }
        } else if (Array.isArray(pm.content)) {
          const hasTag = pm.content.some(
            (p) => p && p.type === "text" && String(p.text).includes("【场景切换】：")
          );
          if (hasTag) {
            injected = true;
            break;
          }
          pm.content = [...pm.content, { type: "text", text: `\n${bannerPrompt}` }];
          injected = true;
          break;
        }
      }

      if (!injected) {
        for (let k = payload.messages.length - 1; k >= 0; k--) {
          const pm = payload.messages[k];
          if (pm && pm.role === "user" && typeof pm.content === "string") {
            if (!pm.content.includes("【场景切换】：")) {
              pm.content = `${pm.content}\n${bannerPrompt}`;
            }
            break;
          }
        }
      }

      return payload;
    });

    return () => {
      if (domObserver) domObserver.disconnect();
      if (audioCtx && typeof audioCtx.close === "function") {
        audioCtx.close().catch(() => {});
      }
    };
  },
};