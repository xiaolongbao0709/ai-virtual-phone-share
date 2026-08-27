export default {
  manifest: {
    id: "imessage-reaction",
    name: "消息表情回应",
    apiVersion: 1,
    version: "2.2.2",
    author: "小坊",
    description: "用emoji回应对方的消息",
    permissions: [
      "chat.read",
      "prompt.inject",
      "storage",
      "ui.render"
    ],
    settings: [
      {
        key: "hidePlusBtn",
        label: "隐藏未使用的「+」按钮",
        type: "boolean",
        default: false,
      },
      {
        key: "injectPrompt",
        label: "在提示词中注入用户的回应状态与触发指令",
        type: "boolean",
        default: true,
      },
      {
        key: "preventOverflowClip",
        label: "允许Emoji超出气泡边界显示",
        type: "boolean",
        default: false,
      },
    ],
  },

  setup(ctx) {
    const rerenderMap = new Map();
    let settingsUnsubscribe = null;
    let activeQuickPicker = null;

    const QUICK_EMOJIS = ["❤️", "👍", "👎", "😂", "‼️", "❓", "🔥", "🥺", "🥰", "😭", "✨", "🎉", "👏"];

    const escapeHtml = (str) => {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    const isValidColor = (color) => {
      return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color) ||
             /^[a-zA-Z]+$/.test(color);
    };

    // 严格校验：只保留真正的 emoji 字符
    const sanitizeEmoji = (emoji) => {
      if (!emoji) return "";
      emoji = emoji.replace(/<[^>]*>/g, "");
      const emojiChars = [...emoji].filter(ch => /\p{Extended_Pictographic}/u.test(ch));
      return emojiChars.slice(0, 8).join("");
    };

    // 清理可能注入提示词的特殊字符
    const sanitizeMsgText = (text) => {
      return String(text || "")
        .replace(/[\r\n\[\]`"']/g, "")
        .slice(0, 30);
    };

    // 用于消息文本匹配的归一化：去除所有空白、标点和符号，只保留字母数字和中文字符
    const sanitizeForMatch = (text) => {
      return String(text || "")
        .replace(/[\s\p{P}\p{S}]/gu, "")
        .slice(0, 50);
    };

    ctx.ui.injectCSS(`
      .imsg-rx-assistant-wrapper,
      .imsg-rx-user-wrapper {
        position: absolute;
        pointer-events: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1;
      }
      .imsg-rx-badge-group {
        position: relative;
        display: inline-block;
        user-select: none;
        animation: imsg-badge-pop 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      @keyframes imsg-badge-pop {
        from { transform: scale(0.4); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      .imsg-rx-main-circle {
        box-sizing: border-box;
        border-radius: 50%;
        display: grid;
        place-items: center;
        position: relative;
        z-index: 3;
        padding: 0;
        margin: 0;
      }
      .imsg-rx-assistant-wrapper .imsg-rx-main-circle {
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      .imsg-rx-assistant-wrapper .imsg-rx-badge-group:active {
        transform: scale(0.88);
      }
      .imsg-rx-user-wrapper .imsg-rx-main-circle {
      }
      .imsg-rx-tail-dot-asst-1 {
        position: absolute;
        border-radius: 50%;
        bottom: -2px;
        right: -1px;
        z-index: 2;
      }
      .imsg-rx-tail-dot-asst-2 {
        position: absolute;
        border-radius: 50%;
        bottom: -7px;
        right: -6px;
        z-index: 1;
      }
      .imsg-rx-tail-dot-user-1 {
        position: absolute;
        border-radius: 50%;
        bottom: -2px;
        left: -1px;
        z-index: 2;
      }
      .imsg-rx-tail-dot-user-2 {
        position: absolute;
        border-radius: 50%;
        bottom: -7px;
        left: -6px;
        z-index: 1;
      }
      .imsg-rx-badge-icon {
        line-height: 1;
        display: block;
        text-align: center;
        transform: translateY(0.5px);
      }
      .imsg-rx-plus-btn {
        background: #8e8e93;
        color: #ffffff;
        border-radius: 50%;
        display: grid;
        place-items: center;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
        user-select: none;
        opacity: 0.85;
        transition: transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease;
      }
      .imsg-rx-plus-btn:hover {
        opacity: 1;
        background: #636366;
      }
      .imsg-rx-plus-btn:active {
        transform: scale(0.88);
      }
      .imsg-rx-plus-btn.imsg-invisible {
        opacity: 0 !important;
        background: transparent !important;
      }
      .imsg-no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .imsg-no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      /* quick picker 胶囊容器：定位到气泡上方，左对齐，宽度300px */
      .imsg-rx-quick-picker {
        position: absolute;
        left: 0;
        bottom: 100%;
        display: flex;
        align-items: center;
        z-index: 20;
        height: 36px;
        padding: 0 8px;
        border-radius: 18px;
        background: #fafafa;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        white-space: nowrap;
        width: 300px;
        box-sizing: border-box;
      }
      .imsg-rx-quick-picker-list {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        overflow-x: auto;
        scrollbar-width: none;
        -ms-overflow-style: none;
        padding: 0 4px;
        background: transparent;
        height: 36px;
      }
      .imsg-rx-quick-picker-list::-webkit-scrollbar {
        display: none;
      }
      .imsg-rx-quick-picker-arrow-btn {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #e0e0e0;
        color: #252525;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        user-select: none;
        flex-shrink: 0;
        margin-right: 6px;
      }
      .imsg-rx-quick-picker-arrow-btn svg {
        width: 14px;
        height: 14px;
        fill: none;
        stroke: #252525;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .imsg-rx-quick-picker-emoji {
        font-size: 20px;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0 2px;
        line-height: 1;
        user-select: none;
      }
      .imsg-rx-quick-picker-remove-btn {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #e74c3c;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        user-select: none;
        flex-shrink: 0;
        margin-left: 6px;
      }
    `);

    const getGlobalConfig = () => {
      const rawSize = Number(ctx.system.storage.get("global_size") ?? 30);
      const rawFontSize = Number(ctx.system.storage.get("global_fontSize") ?? 16);
      const rawZIndex = Number(ctx.system.storage.get("global_zIndex") ?? 1);
      const asstBg = ctx.system.storage.get("global_assistantBgColor") ?? "#ffffff";
      const userBg = ctx.system.storage.get("global_userBgColor") ?? "#ffffff";
      const quickPickerBg = ctx.system.storage.get("quick_picker_bg") ?? "#fafafa";

      const asstOffsetTop = Number(ctx.system.storage.get("assistant_offset_top") ?? -18);
      const asstOffsetRight = Number(ctx.system.storage.get("assistant_offset_right") ?? -12);
      const userOffsetTop = Number(ctx.system.storage.get("user_offset_top") ?? -18);
      const userOffsetLeft = Number(ctx.system.storage.get("user_offset_left") ?? -12);

      const rawQuickPickerMarginBottom = Number(ctx.system.storage.get("quick_picker_margin_bottom") ?? 4);
      const quickPickerMarginBottom = Math.min(20, Math.max(0, rawQuickPickerMarginBottom));

      return {
        size: Math.min(64, Math.max(12, rawSize)),
        fontSize: Math.min(48, Math.max(8, rawFontSize)),
        zIndex: Math.min(9999, Math.max(0, rawZIndex)),
        assistantBg: isValidColor(asstBg) ? asstBg : "#ffffff",
        userBg: isValidColor(userBg) ? userBg : "#ffffff",
        quickPickerBg: isValidColor(quickPickerBg) ? quickPickerBg : "#fafafa",
        assistantOffsetTop: Math.min(100, Math.max(-100, asstOffsetTop)),
        assistantOffsetRight: Math.min(100, Math.max(-100, asstOffsetRight)),
        userOffsetTop: Math.min(100, Math.max(-100, userOffsetTop)),
        userOffsetLeft: Math.min(100, Math.max(-100, userOffsetLeft)),
        quickPickerMarginBottom,
      };
    };

    const createBadgeGroup = (emoji, bgColor, type = "assistant") => {
      const cfg = getGlobalConfig();
      const mainSize = cfg.size;

      const group = document.createElement("div");
      group.className = "imsg-rx-badge-group";
      group.style.width = `${mainSize}px`;
      group.style.height = `${mainSize}px`;

      const mainCircle = document.createElement("div");
      mainCircle.className = "imsg-rx-main-circle";
      mainCircle.style.width = `${mainSize}px`;
      mainCircle.style.height = `${mainSize}px`;
      mainCircle.style.backgroundColor = bgColor;

      const icon = document.createElement("span");
      icon.className = "imsg-rx-badge-icon";
      icon.textContent = emoji;
      icon.style.fontSize = `${cfg.fontSize}px`;
      mainCircle.appendChild(icon);
      group.appendChild(mainCircle);

      const dot1Size = Math.max(6, Math.round(mainSize * 0.35));
      const dot2Size = Math.max(3.5, Math.round(mainSize * 0.2));

      const dot1 = document.createElement("div");
      const dot2 = document.createElement("div");
      dot1.style.width = `${dot1Size}px`;
      dot1.style.height = `${dot1Size}px`;
      dot1.style.backgroundColor = bgColor;
      dot2.style.width = `${dot2Size}px`;
      dot2.style.height = `${dot2Size}px`;
      dot2.style.backgroundColor = bgColor;

      if (type === "assistant") {
        dot1.className = "imsg-rx-tail-dot-asst-1";
        dot2.className = "imsg-rx-tail-dot-asst-2";
      } else {
        dot1.className = "imsg-rx-tail-dot-user-1";
        dot2.className = "imsg-rx-tail-dot-user-2";
      }

      group.appendChild(dot1);
      group.appendChild(dot2);
      return group;
    };

    const rerenderAll = () => {
      rerenderMap.forEach((fn) => fn());
    };

    const hideQuickPicker = () => {
      if (activeQuickPicker) {
        activeQuickPicker.style.display = "none";
        activeQuickPicker = null;
        document.removeEventListener("click", outsideClickHandler);
      }
    };

    const outsideClickHandler = (e) => {
      if (activeQuickPicker && !activeQuickPicker.contains(e.target)) {
        hideQuickPicker();
      }
    };

    const showQuickPicker = (quickPicker) => {
      if (activeQuickPicker && activeQuickPicker !== quickPicker) {
        hideQuickPicker();
      }
      activeQuickPicker = quickPicker;
      quickPicker.style.display = "flex";
      document.addEventListener("click", outsideClickHandler);
    };

    const saveUserReaction = async (message, sessionId, emoji) => {
      const cleanEmoji = sanitizeEmoji(emoji);
      if (!cleanEmoji) {
        ctx.ui.toast("请输入有效的 Emoji 表情");
        return;
      }

      const key = `user_reaction_${message.id}`;
      await ctx.system.storage.set(key, cleanEmoji);

      const storageKey = `session_reactions_${sessionId}`;
      let currentRoundList = (await ctx.system.storage.get(storageKey)) || [];
      currentRoundList = currentRoundList.filter((item) => item.msgId !== message.id);
      currentRoundList.push({
        msgId: message.id,
        msgText: sanitizeMsgText(message.content),
        emoji: cleanEmoji,
        removed: false,
        time: Date.now(),
      });
      await ctx.system.storage.set(storageKey, currentRoundList);

      const historyKey = `user_reaction_history_${sessionId}`;
      let historyList = (await ctx.system.storage.get(historyKey)) || [];
      historyList = historyList.filter(
        (item) => sanitizeForMatch(item.msgText) !== sanitizeForMatch(message.content)
      );
      historyList.push({
        msgId: message.id,
        msgText: sanitizeMsgText(message.content),
        emoji: cleanEmoji,
        removed: false,
        time: Date.now(),
      });
      if (historyList.length > 200) {
        historyList = historyList.slice(-200);
      }
      await ctx.system.storage.set(historyKey, historyList);

      const rerender = rerenderMap.get(message.id);
      if (rerender) rerender();
    };

    const removeUserReaction = async (message, sessionId) => {
      const key = `user_reaction_${message.id}`;
      const existingEmoji = await ctx.system.storage.get(key);

      await ctx.system.storage.remove(key);

      const storageKey = `session_reactions_${sessionId}`;
      let currentRoundList = (await ctx.system.storage.get(storageKey)) || [];
      currentRoundList = currentRoundList.filter((item) => item.msgId !== message.id);
      if (existingEmoji) {
        currentRoundList.push({
          msgId: message.id,
          msgText: sanitizeMsgText(message.content),
          emoji: existingEmoji,
          removed: true,
          time: Date.now(),
        });
      }
      await ctx.system.storage.set(storageKey, currentRoundList);

      const historyKey = `user_reaction_history_${sessionId}`;
      let historyList = (await ctx.system.storage.get(historyKey)) || [];
      historyList = historyList.filter(
        (item) => sanitizeForMatch(item.msgText) !== sanitizeForMatch(message.content)
      );
      await ctx.system.storage.set(historyKey, historyList);

      const rerender = rerenderMap.get(message.id);
      if (rerender) rerender();
    };

    const openReactionModal = (message, sessionId, currentEmoji) => {
      ctx.ui.openModal((modalEl, { close }) => {
        const cfg = getGlobalConfig();
        const safeCurrentEmoji = escapeHtml(sanitizeEmoji(currentEmoji) || "");
        const safeSize = escapeHtml(cfg.size);
        const safeFontSize = escapeHtml(cfg.fontSize);
        const safeZIndex = escapeHtml(cfg.zIndex);
        const safeAssBg = escapeHtml(cfg.assistantBg);
        const safeUserBg = escapeHtml(cfg.userBg);
        const safeQuickPickerBg = escapeHtml(cfg.quickPickerBg);
        const safeAsstOffsetTop = escapeHtml(cfg.assistantOffsetTop);
        const safeAsstOffsetRight = escapeHtml(cfg.assistantOffsetRight);
        const safeUserOffsetTop = escapeHtml(cfg.userOffsetTop);
        const safeUserOffsetLeft = escapeHtml(cfg.userOffsetLeft);
        const safeQuickPickerMarginBottom = escapeHtml(cfg.quickPickerMarginBottom);

        modalEl.style.maxWidth = "330px";
        modalEl.style.padding = "20px";
        modalEl.style.borderRadius = "2px";
        modalEl.style.background = "#ffffff";
        modalEl.style.boxShadow = "0 16px 42px rgba(0,0,0,0.22)";
        modalEl.style.boxSizing = "border-box";
        modalEl.style.fontFamily = "'Times New Roman', SimSun, 'Songti SC', 'STSong', serif";

        modalEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
            <span style="font-family: 'Times New Roman', Times, serif; font-size: 24px; font-weight: bold; letter-spacing: 1.5px; color: #111111;">
              REACTION
            </span>
            <span id="imsg-modal-close-btn" style="font-family: SimSun, 'Songti SC', serif; font-size: 13px; color: #8e8e93; cursor: pointer; user-select: none; padding: 2px 4px;">
              关闭
            </span>
          </div>

          <div style="height: 1px; background: #e5e5ea; margin-bottom: 12px;"></div>

          <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 12px;">
            <input id="imsg-single-input" type="text" value="${safeCurrentEmoji}" placeholder="输入 Emoji..." maxlength="6" style="flex: 1; height: 36px; padding: 0 8px; border: 1px solid #d1d1d6; border-radius: 0px; outline: none; font-family: 'Times New Roman', SimSun, serif; font-size: 15px; box-sizing: border-box; background: #fafafa;" />
            <button id="imsg-single-save-btn" style="height: 36px; padding: 0 14px; border: none; border-radius: 0px; background: #000000; color: #ffffff; font-family: SimSun, 'Songti SC', serif; font-size: 15px; cursor: pointer; font-weight: 500; white-space: nowrap;">保存</button>
          </div>

          <button id="imsg-more-settings-btn" style="width: 100%; background: #252525; color: #ffffff; border: none; border-radius: 0; padding: 10px 0; font-family: SimSun, 'Songti SC', serif; font-size: 15px; cursor: pointer; letter-spacing: 2px; margin-bottom: 12px;">
            更多设置
          </button>

          <div id="imsg-more-settings-panel" style="display: none;">
            <div style="height: 1px; background: #e5e5ea; margin-bottom: 12px;"></div>

            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px; padding-top: 6px; border-top: 1px dashed #e5e5ea;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">圆形直径</span>
                <input id="cfg-size" type="number" value="${safeSize}" style="width: 80px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">emoji字号</span>
                <input id="cfg-fontSize" type="number" value="${safeFontSize}" style="width: 80px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">气泡层级</span>
                <input id="cfg-zIndex" type="number" value="${safeZIndex}" style="width: 80px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">快速选择栏与气泡距离</span>
                <input id="cfg-quick-picker-margin" type="number" value="${safeQuickPickerMarginBottom}" style="width: 80px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">快速选择栏背景底色</span>
                <input id="cfg-quick-picker-bg" type="text" value="${safeQuickPickerBg}" placeholder="#fafafa" style="width: 90px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">角色emoji气泡底色</span>
                <input id="cfg-assistantBg" type="text" value="${safeAssBg}" placeholder="#ffffff" style="width: 90px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">用户emoji气泡底色</span>
                <input id="cfg-userBg" type="text" value="${safeUserBg}" placeholder="#ffffff" style="width: 90px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>

              <div style="height: 1px; background: #e5e5ea; margin: 6px 0;"></div>

              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">角色消息reaction 上偏移</span>
                <input id="cfg-assistant-offset-top" type="number" value="${safeAsstOffsetTop}" style="width: 80px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">角色消息reaction 右偏移</span>
                <input id="cfg-assistant-offset-right" type="number" value="${safeAsstOffsetRight}" style="width: 80px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">用户消息reaction 上偏移</span>
                <input id="cfg-user-offset-top" type="number" value="${safeUserOffsetTop}" style="width: 80px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: SimSun, 'Songti SC', serif; font-size: 15px; color: #222222;">用户消息reaction 左偏移</span>
                <input id="cfg-user-offset-left" type="number" value="${safeUserOffsetLeft}" style="width: 80px; text-align: right; border: none; border-bottom: 1px solid #8e8e93; border-radius: 0px; outline: none; font-family: 'Times New Roman', Times, serif; font-size: 16px; background: transparent; padding: 2px 0;" />
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end;">
              <button id="imsg-finish-all-btn" style="height: 34px; padding: 0 22px; border: none; border-radius: 0px; background: #000000; color: #ffffff; font-family: SimSun, 'Songti SC', serif; font-size: 15px; cursor: pointer; font-weight: 500;">
                完成
              </button>
            </div>
          </div>
        `;

        modalEl.querySelector("#imsg-modal-close-btn").onclick = close;

        const inputEl = modalEl.querySelector("#imsg-single-input");
        const saveBtn = modalEl.querySelector("#imsg-single-save-btn");
        const moreBtn = modalEl.querySelector("#imsg-more-settings-btn");
        const morePanel = modalEl.querySelector("#imsg-more-settings-panel");
        const finishBtn = modalEl.querySelector("#imsg-finish-all-btn");

        moreBtn.onclick = () => {
          if (morePanel.style.display === "none") {
            morePanel.style.display = "block";
            moreBtn.textContent = "收起设置";
          } else {
            morePanel.style.display = "none";
            moreBtn.textContent = "更多设置";
          }
        };

        const handleSaveSingle = async () => {
          const emoji = inputEl.value.trim();
          await saveUserReaction(message, sessionId, emoji);
          close();
        };

        const handleSaveGlobalConfig = async () => {
          let sizeVal = Number(modalEl.querySelector("#cfg-size").value ?? 30);
          let fontVal = Number(modalEl.querySelector("#cfg-fontSize").value ?? 16);
          let zIndexVal = Number(modalEl.querySelector("#cfg-zIndex").value ?? 1);
          let asstBgVal = modalEl.querySelector("#cfg-assistantBg").value.trim() || "#ffffff";
          let userBgVal = modalEl.querySelector("#cfg-userBg").value.trim() || "#ffffff";
          let quickPickerBgVal = modalEl.querySelector("#cfg-quick-picker-bg").value.trim() || "#fafafa";

          let asstOffsetTop = Number(modalEl.querySelector("#cfg-assistant-offset-top").value ?? -18);
          let asstOffsetRight = Number(modalEl.querySelector("#cfg-assistant-offset-right").value ?? -12);
          let userOffsetTop = Number(modalEl.querySelector("#cfg-user-offset-top").value ?? -18);
          let userOffsetLeft = Number(modalEl.querySelector("#cfg-user-offset-left").value ?? -12);

          let quickPickerMargin = Number(modalEl.querySelector("#cfg-quick-picker-margin").value ?? 4);

          sizeVal = Math.min(64, Math.max(12, sizeVal));
          fontVal = Math.min(48, Math.max(8, fontVal));
          zIndexVal = Math.min(9999, Math.max(0, zIndexVal));
          if (!isValidColor(asstBgVal)) asstBgVal = "#ffffff";
          if (!isValidColor(userBgVal)) userBgVal = "#ffffff";
          if (!isValidColor(quickPickerBgVal)) quickPickerBgVal = "#fafafa";

          asstOffsetTop = Math.min(100, Math.max(-100, asstOffsetTop));
          asstOffsetRight = Math.min(100, Math.max(-100, asstOffsetRight));
          userOffsetTop = Math.min(100, Math.max(-100, userOffsetTop));
          userOffsetLeft = Math.min(100, Math.max(-100, userOffsetLeft));
          quickPickerMargin = Math.min(20, Math.max(0, quickPickerMargin));

          await ctx.system.storage.set("global_size", sizeVal);
          await ctx.system.storage.set("global_fontSize", fontVal);
          await ctx.system.storage.set("global_zIndex", zIndexVal);
          await ctx.system.storage.set("global_assistantBgColor", asstBgVal);
          await ctx.system.storage.set("global_userBgColor", userBgVal);
          await ctx.system.storage.set("quick_picker_bg", quickPickerBgVal);
          await ctx.system.storage.set("assistant_offset_top", asstOffsetTop);
          await ctx.system.storage.set("assistant_offset_right", asstOffsetRight);
          await ctx.system.storage.set("user_offset_top", userOffsetTop);
          await ctx.system.storage.set("user_offset_left", userOffsetLeft);
          await ctx.system.storage.set("quick_picker_margin_bottom", quickPickerMargin);

          rerenderAll();
          ctx.ui.toast("全局设置已保存");
          close();
        };

        saveBtn.onclick = handleSaveSingle;
        inputEl.onkeydown = (e) => {
          if (e.key === "Enter") handleSaveSingle();
        };
        finishBtn.onclick = handleSaveGlobalConfig;

        const focusTimer = setTimeout(() => inputEl.focus(), 40);
        const originalClose = close;
        const wrappedClose = () => {
          clearTimeout(focusTimer);
          originalClose();
        };
        modalEl.querySelector("#imsg-modal-close-btn").onclick = wrappedClose;
      });
    };

    const findTargetUserMsg = (sessionId, quoteText) => {
      const msgs = ctx.data.messages.list ? ctx.data.messages.list(sessionId) : [];
      const userMsgs = msgs.filter((m) => m.role === "user");
      if (userMsgs.length === 0) return null;

      if (quoteText && quoteText.trim()) {
        const query = quoteText.trim();
        const matched = [...userMsgs].reverse().find((m) => (m.content || "").includes(query));
        if (matched) return matched;
      }

      return userMsgs[userMsgs.length - 1];
    };

    ctx.hooks.transform("llm.response", async (p) => {
      if (!p.text || !p.sessionId) return p;

      const sessionId = p.sessionId;

      try {
        const lastListKey = `last_char_reaction_list_${sessionId}`;
        const lastList = (await ctx.system.storage.get(lastListKey)) || [];
        for (const msgId of lastList) {
          await ctx.system.storage.remove(`char_reaction_${msgId}`);
          const rerender = rerenderMap.get(msgId);
          if (rerender) rerender();
        }
        await ctx.system.storage.set(lastListKey, []);

        const newList = [];

        let removeMatches = [...p.text.matchAll(/\[(?:remove_reaction|撤回回应)(?:[:：\s]*(?:\(([^)]+)\)|["'“]([^"'”]+)["'”]))?\]/gi)];
        removeMatches = removeMatches.slice(0, 2);

        for (const rm of removeMatches) {
          const quote = (rm[1] || rm[2] || "").trim();
          const targetMsg = findTargetUserMsg(sessionId, quote);
          if (targetMsg) {
            const existed = await ctx.system.storage.get(`char_reaction_${targetMsg.id}`);
            if (existed) {
              await ctx.system.storage.remove(`char_reaction_${targetMsg.id}`);
              const rerender = rerenderMap.get(targetMsg.id);
              if (rerender) rerender();

              ctx.ui.toast("对方撤回了对你消息的回应");
            }
          }
        }

        let addMatches = [...p.text.matchAll(/\[(?:reaction|回应)[:：]\s*([^\s()\"'\[\]]+)(?:\s*(?:\(([^)]+)\)|["'“]([^"'”]+)["'”]))?\]/gi)];
        addMatches = addMatches.slice(0, 2);

        for (const match of addMatches) {
          let emoji = sanitizeEmoji(match[1] || "");
          const quote = (match[2] || match[3] || "").trim();

          if (emoji) {
            const targetMsg = findTargetUserMsg(sessionId, quote);
            if (targetMsg) {
              await ctx.system.storage.set(`char_reaction_${targetMsg.id}`, emoji);
              newList.push(targetMsg.id);

              const rerender = rerenderMap.get(targetMsg.id);
              if (rerender) rerender();

              ctx.ui.toast(`对方回应了你的消息: ${escapeHtml(emoji)}`);
            }
          }
        }

        await ctx.system.storage.set(lastListKey, newList);
        const storageKey = `session_reactions_${sessionId}`;
        await ctx.system.storage.remove(storageKey);
      } catch (e) {
        ctx.system.log("处理 reaction 指令失败", e);
      } finally {
        p.text = p.text.replace(/\[(?:remove_reaction|撤回回应)[^\]]*\]/gi, "").trim();
        p.text = p.text.replace(/\[(?:reaction|回应)[:：][^\]]+\]/gi, "").trim();
      }

      return p;
    });

    ctx.ui.slot("message.footer", (el, props) => {
      const msg = props.message;
      const sessionId = props.sessionId;
      if (!msg) return;

      const bubbleEl = el.closest('[data-ui="bubble-user"], [data-ui="bubble-bot"]');
      if (!bubbleEl) return;

      const originalOverflow = bubbleEl.style.overflow;

      const wrapper = document.createElement("div");
      wrapper.className = msg.role === "assistant" ? "imsg-rx-assistant-wrapper" : "imsg-rx-user-wrapper";
      wrapper.style.position = "absolute";
      const cfg = getGlobalConfig();
      wrapper.style.width = `${cfg.size}px`;
      wrapper.style.height = `${cfg.size}px`;

      let quickPickerEl = null;

      const render = () => {
        const latestCfg = getGlobalConfig();
        wrapper.style.zIndex = `${latestCfg.zIndex}`;

        const preventOverflowClip = ctx.system.settings.get("preventOverflowClip") === true;
        if (preventOverflowClip) {
          bubbleEl.style.overflow = "visible";
        } else {
          if (bubbleEl.style.overflow === "visible" && originalOverflow !== "visible") {
            bubbleEl.style.overflow = originalOverflow;
          }
        }

        if (msg.role === "assistant") {
          wrapper.style.top = `${latestCfg.assistantOffsetTop}px`;
          wrapper.style.right = `${latestCfg.assistantOffsetRight}px`;
        } else {
          wrapper.style.top = `${latestCfg.userOffsetTop}px`;
          wrapper.style.left = `${latestCfg.userOffsetLeft}px`;
        }

        wrapper.innerHTML = "";

        if (quickPickerEl && quickPickerEl.parentElement) {
          quickPickerEl.parentElement.removeChild(quickPickerEl);
          quickPickerEl = null;
        }

        let mainElement;
        const savedEmoji = ctx.system.storage.get(`user_reaction_${msg.id}`);

        if (msg.role === "assistant") {
          let effectiveEmoji = savedEmoji;

          if (!effectiveEmoji) {
            const historyKey = `user_reaction_history_${sessionId}`;
            const historyList = ctx.system.storage.get(historyKey) || [];
            const matched = historyList
              .filter(item => !item.removed && item.emoji)
              .find(item => sanitizeForMatch(item.msgText) === sanitizeForMatch(msg.content));

            if (matched) {
              effectiveEmoji = matched.emoji;
              (async () => {
                try {
                  await ctx.system.storage.set(`user_reaction_${msg.id}`, effectiveEmoji);
                  const currentList = await ctx.system.storage.get(historyKey) || [];
                  const item = currentList.find(x => !x.removed && sanitizeForMatch(x.msgText) === sanitizeForMatch(msg.content));
                  if (item) item.msgId = msg.id;
                  await ctx.system.storage.set(historyKey, currentList);
                  const rerender = rerenderMap.get(msg.id);
                  if (rerender) rerender();
                } catch (e) {
                  ctx.system.log("恢复回应时更新存储失败", e);
                }
              })();
            }
          }

          if (effectiveEmoji) {
            mainElement = createBadgeGroup(effectiveEmoji, latestCfg.assistantBg, "assistant");
            mainElement.title = "点击修改或移除回应";
          } else {
            mainElement = document.createElement("div");
            mainElement.className = `imsg-rx-plus-btn ${ctx.system.settings.get("hidePlusBtn") === true ? "imsg-invisible" : ""}`;
            mainElement.textContent = "+";
            mainElement.title = "添加表情回应与设置";
            mainElement.style.width = `${latestCfg.size}px`;
            mainElement.style.height = `${latestCfg.size}px`;
            mainElement.style.fontSize = `${latestCfg.fontSize}px`;
          }

          const quickPicker = document.createElement("div");
          quickPicker.className = "imsg-rx-quick-picker";
          quickPicker.style.display = "none";
          quickPicker.dataset.msgId = String(msg.id);
          quickPicker.style.marginBottom = `${latestCfg.quickPickerMarginBottom}px`;
          quickPicker.style.backgroundColor = latestCfg.quickPickerBg; // 应用自定义背景色

          const listDiv = document.createElement("div");
          listDiv.className = "imsg-rx-quick-picker-list";

          const arrowBtn = document.createElement("div");
          arrowBtn.className = "imsg-rx-quick-picker-arrow-btn";
          arrowBtn.title = "打开设置";
          arrowBtn.innerHTML = `
            <svg viewBox="0 0 24 24">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          `;
          arrowBtn.onclick = () => {
            hideQuickPicker();
            openReactionModal(msg, sessionId, effectiveEmoji);
          };
          listDiv.appendChild(arrowBtn);

          QUICK_EMOJIS.forEach((em) => {
            const span = document.createElement("span");
            span.className = "imsg-rx-quick-picker-emoji";
            span.textContent = em;
            span.title = em;
            span.onclick = async () => {
              hideQuickPicker();
              await saveUserReaction(msg, sessionId, em);
            };
            listDiv.appendChild(span);
          });

          quickPicker.appendChild(listDiv);

          if (effectiveEmoji) {
            const removeBtn = document.createElement("div");
            removeBtn.className = "imsg-rx-quick-picker-remove-btn";
            removeBtn.textContent = "×";
            removeBtn.title = "移除回应";
            removeBtn.onclick = async () => {
              hideQuickPicker();
              await removeUserReaction(msg, sessionId);
            };
            quickPicker.appendChild(removeBtn);
          }

          mainElement.onclick = (e) => {
            e.stopPropagation();
            if (quickPicker.style.display === "none") {
              showQuickPicker(quickPicker);
            } else {
              hideQuickPicker();
            }
          };

          wrapper.appendChild(mainElement);
          bubbleEl.appendChild(quickPicker);
          quickPickerEl = quickPicker;
        } else {
          const charEmoji = ctx.system.storage.get(`char_reaction_${msg.id}`);
          if (charEmoji) {
            const badgeGroup = createBadgeGroup(charEmoji, latestCfg.userBg, "user");
            badgeGroup.title = "角色对你的回应";
            wrapper.appendChild(badgeGroup);
          }
        }
      };

      bubbleEl.appendChild(wrapper);
      render();
      rerenderMap.set(msg.id, render);

      return () => {
        rerenderMap.delete(msg.id);
        if (activeQuickPicker && activeQuickPicker.dataset.msgId === String(msg.id)) {
          hideQuickPicker();
        }
        if (quickPickerEl && quickPickerEl.parentElement) {
          quickPickerEl.parentElement.removeChild(quickPickerEl);
          quickPickerEl = null;
        }
        if (wrapper.parentElement) {
          wrapper.parentElement.removeChild(wrapper);
        }
        if (bubbleEl.style.overflow === "visible" && originalOverflow !== "visible") {
          bubbleEl.style.overflow = originalOverflow;
        }
      };
    });

    ctx.hooks.transform("prompt.system", (payload) => {
      if (ctx.system.settings.get("injectPrompt") === false) return payload;
      if (!payload.sessionId) return payload;

      let promptAddition = "\n\n【表情回应机制】";

      const storageKey = `session_reactions_${payload.sessionId}`;
      const roundList = ctx.system.storage.get(storageKey);
      if (roundList && roundList.length > 0) {
        const lines = roundList.map((item) => {
          if (item.removed) {
            return `- {{user}} 撤回了对{{char}}消息“${sanitizeMsgText(item.msgText)}”做出的表情回应（原回应：${escapeHtml(item.emoji)}）`;
          }
          return `- {{user}} 对{{char}}的消息“${sanitizeMsgText(item.msgText)}”做出了表情回应：${escapeHtml(item.emoji)}`;
        });
        promptAddition += `\n{{user}} 本轮对{{char}}消息的回应/撤回记录（请自然体会{{user}}情绪）：\n${lines.join("\n")}`;
      }

      promptAddition += `\n如果{{char}}对{{user}}刚才说的某一句话有强烈的表情反应（如喜爱、大笑、赞同、震惊等），可以在回复的最末尾附带标记：\n- 回应指定一句话：[reaction:emoji(该句部分文字)]（例如 [reaction:❤️(喜欢你)] 或 [reaction:😂] 默认上一句）\n- 撤回对某句话的回应：[remove_reaction(该句部分文字)] 或 [remove_reaction]\n系统会自动将其转化为对应气泡左上角的emoji reaction，请勿在正文其他地方提及代码指令本身。`;

      payload.hint = (payload.hint || "") + promptAddition;
      return payload;
    });

    if (ctx.system.settings.onChange) {
      settingsUnsubscribe = ctx.system.settings.onChange(() => {
        rerenderAll();
      });
    }

    return () => {
      if (settingsUnsubscribe) {
        settingsUnsubscribe();
      }
      rerenderMap.clear();
      hideQuickPicker();
    };
  },
};
