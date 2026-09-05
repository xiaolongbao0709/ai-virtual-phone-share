/*
 * Float 底栏按钮收纳 · 贴纸/回复保留版
 * 基于「按钮收纳聊天室分离版」的实际生效机制重写
 *
 * 核心：
 * - 直接从每个 .chat-input-actions 往上找 .chat-room-wrapper
 * - 从 .chat-room-wrapper 的 session-xxxx class 解析当前聊天室 id
 * - 不依赖 session.opened 事件来判断当前会话
 * - 不依赖固定 nth-child 顺序
 * - 用按钮 title / aria-label / SVG 特征识别功能
 *
 * 生效后底栏保留：
 * - Sticker
 * - Reply / 触发 AI 回复
 * - 一个“⋯”收纳按钮（劫持原本某个被收纳按钮）
 *
 * 收进菜单：
 * - 线下模式
 * - Emoji
 * - Plus / 更多功能
 * - Send / Stop（默认也收进去）
 */

export default {
  manifest: {
    id: "collapse-bottom-toolbar-sticker-reply",
    name: "聊天底栏按钮收纳·贴纸回复版",
    apiVersion: 1,
    version: "2.1.0",
    author: "小池",
    description: "支持按聊天室启用：底栏仅保留贴纸与回复，其余按钮收进菜单。",
    permissions: ["chat.read"],
  },

  setup(ctx) {
    ctx.ui.injectCSS(`
      /* 被收纳按钮 */
      .chat-input-actions button.cb-folded-hide {
        display: none !important;
      }

      /* 被劫持成“菜单”的那个按钮 */
      .chat-input-actions button.cb-menu-trigger svg {
        display: none !important;
      }

      .chat-input-actions button.cb-menu-trigger::after {
        content: "⋯";
        font-size: 22px;
        font-weight: 700;
        line-height: 1;
        color: var(--c-text);
        margin-top: -4px;
      }

      /*
       * 给保留下来的两个关键按钮打稳定属性，
       * 以后做美化时直接用：
       *
       * [data-float-action="sticker"]
       * [data-float-action="reply"]
       * [data-float-action="menu"]
       */
      .chat-input-actions [data-float-action] {
        position: relative;
      }

      .cb-folded-popover {
        position: fixed;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 12px;
        border: 1px solid var(--c-border, rgba(0,0,0,.12));
        border-radius: 20px;
        background: var(--c-card, #fff);
        box-shadow: 0 5px 24px rgba(0,0,0,.18);
        z-index: 99999;
        touch-action: manipulation;
        animation: cbFadeIn .14s ease-out;
      }

      @keyframes cbFadeIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .cb-folded-popover button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        flex: 0 0 auto;
        padding: 6px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: var(--c-text);
        cursor: pointer;
      }

      .cb-folded-popover button:active {
        background: var(--c-input, rgba(0,0,0,.08));
      }

      .cb-folded-popover button svg {
        width: 24px;
        height: 24px;
      }

      /* 设置区 */
      .cb-settings-box {
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        border-top: 1px solid color-mix(in srgb, var(--c-card-border, #ccc) 20%, transparent);
      }

      .cb-scope-row {
        display: flex;
        gap: 8px;
      }

      .cb-scope-btn {
        flex: 1;
        padding: 7px 10px;
        border: 1px solid var(--c-border, rgba(0,0,0,.15));
        border-radius: 9px;
        background: var(--c-input, rgba(0,0,0,.04));
        color: var(--c-text);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
      }

      .cb-scope-btn.active {
        background: var(--c-primary, #8b5cf6);
        color: #fff;
        border-color: var(--c-primary, #8b5cf6);
      }

      .cb-actions-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        font-size: 12px;
      }

      .cb-link-group {
        display: flex;
        gap: 10px;
      }

      .cb-link-btn {
        padding: 0;
        border: 0;
        background: none;
        color: var(--c-primary, #8b5cf6);
        font-size: 12px;
        cursor: pointer;
      }

      .cb-session-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 240px;
        overflow-y: auto;
        padding: 4px 2px;
      }

      .cb-session-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        border-radius: 10px;
        background: var(--c-input, rgba(0,0,0,.04));
        cursor: pointer;
        user-select: none;
      }

      .cb-session-item input {
        width: 16px;
        height: 16px;
      }

      .cb-session-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--c-text);
        font-size: 13px;
        font-weight: 500;
      }

      .cb-session-type {
        color: var(--c-text);
        font-size: 11px;
        opacity: .55;
      }
    `);

    let popoverEl = null;
    let bypassClickEl = null;
    const hijackedMap = new WeakMap();

    const getApplyScope = () =>
      ctx.system.storage.get("applyScope") || "selected";

    const getTargetSessions = () => {
      const value = ctx.system.storage.get("targetSessions");
      return Array.isArray(value) ? value.map(String) : [];
    };

    const isSessionActive = (sessionId) => {
      if (getApplyScope() === "all") return true;
      if (!sessionId) return false;
      return getTargetSessions().includes(String(sessionId));
    };

    /*
     * 这一段就是之前两版没命中的关键。
     * 不是靠“记住当前 session”，而是对每个 actionBar
     * 直接找到它自己所属的 .chat-room-wrapper，
     * 然后解析 session-xxxx class。
     */
    const getSessionIdFromElement = (el) => {
      const roomWrapper = el.closest(".chat-room-wrapper");
      if (!roomWrapper) return null;

      const className =
        typeof roomWrapper.className === "string"
          ? roomWrapper.className
          : "";

      const match = className.match(/\bsession-([^\s]+)/);
      return match ? match[1] : null;
    };

    const closePopover = () => {
      if (popoverEl) {
        popoverEl.remove();
        popoverEl = null;
      }
    };

    const handleGlobalPointer = (e) => {
      if (!popoverEl) return;

      if (
        !popoverEl.contains(e.target) &&
        !e.target.closest(".cb-menu-trigger")
      ) {
        closePopover();
      }
    };

    document.addEventListener("pointerdown", handleGlobalPointer, true);

    /*
     * 功能识别
     * 优先看 title / aria-label，再看 SVG / class。
     * 不使用固定 nth-child。
     */
    const identifyButton = (btn) => {
      const title =
        (
          btn.getAttribute("title") ||
          btn.getAttribute("aria-label") ||
          ""
        ).trim();

      const lower = title.toLowerCase();
      const html = btn.innerHTML || "";

      if (
        btn.classList.contains("chat-offline-toggle") ||
        lower.includes("线下") ||
        lower.includes("offline")
      ) {
        return "offline";
      }

      if (
        lower.includes("贴纸") ||
        lower.includes("sticker") ||
        lower.includes("表情包")
      ) {
        return "sticker";
      }

      if (
        lower.includes("emoji") ||
        lower === "表情" ||
        lower.includes("emoji")
      ) {
        return "emoji";
      }

      if (
        lower.includes("回复") ||
        lower.includes("reply") ||
        lower.includes("生成") ||
        html.includes("M9.937") ||
        html.includes("M20 3v4")
      ) {
        return "reply";
      }

      if (
        lower.includes("发送") ||
        lower.includes("send") ||
        lower.includes("停止") ||
        lower.includes("stop") ||
        html.includes("<polygon")
      ) {
        return "send";
      }

      if (
        lower.includes("更多") ||
        lower.includes("功能") ||
        lower.includes("plus") ||
        lower.includes("more")
      ) {
        return "plus";
      }

      return "unknown";
    };

    const closeAndNativeClick = (data, triggerBtn) => {
      closePopover();

      if (data.el === triggerBtn) {
        bypassClickEl = triggerBtn;
      }

      data.el.click();
    };

    const captureClickListener = (e) => {
      const triggerBtn = e.currentTarget;

      if (bypassClickEl === triggerBtn) {
        bypassClickEl = null;
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      if (popoverEl) {
        closePopover();
        return;
      }

      const foldedData = hijackedMap.get(triggerBtn);
      if (!foldedData || foldedData.length === 0) return;

      const rect = triggerBtn.getBoundingClientRect();

      popoverEl = document.createElement("div");
      popoverEl.className = "cb-folded-popover";

      popoverEl.style.bottom =
        `${Math.max(12, window.innerHeight - rect.top + 12)}px`;

      const desiredLeft = Math.max(
        12,
        Math.min(rect.left, window.innerWidth - 220)
      );

      popoverEl.style.left = `${desiredLeft}px`;

      for (const data of foldedData) {
        const clone = document.createElement("button");
        clone.type = "button";
        clone.title = data.title || data.kind || "";
        clone.innerHTML = data.html;
        clone.disabled = !!data.el.disabled;

        clone.addEventListener("click", (ev) => {
          ev.stopPropagation();
          closeAndNativeClick(data, triggerBtn);
        });

        popoverEl.appendChild(clone);
      }

      document.body.appendChild(popoverEl);
    };

    /*
     * 收纳规则：
     * - Sticker：永远保留
     * - Reply：永远保留
     * - 其余按钮：全部收纳
     *
     * 被收纳按钮中的第一个不隐藏，
     * 而是劫持成“⋯”菜单按钮。
     */
    const processInputActions = () => {
      const actionBars =
        document.querySelectorAll(".chat-input-actions");

      actionBars.forEach((actionsBar) => {
        const buttons = Array.from(
          actionsBar.querySelectorAll(":scope > button.ui-bare-btn")
        );

        if (buttons.length === 0) return;

        const sessionId = getSessionIdFromElement(actionsBar);
        const enabled = isSessionActive(sessionId);

        /*
         * 先完整恢复，再重新分拣。
         * 避免 React 重渲染 / 切换会话后残留旧状态。
         */
        buttons.forEach((btn) => {
          btn.classList.remove(
            "cb-folded-hide",
            "cb-menu-trigger"
          );
          btn.removeEventListener(
            "click",
            captureClickListener,
            true
          );
          delete btn.dataset.floatAction;
        });

        if (!enabled) return;

        const folded = [];
        let stickerBtn = null;
        let replyBtn = null;

        buttons.forEach((btn) => {
          const kind = identifyButton(btn);

          if (kind === "sticker") {
            stickerBtn = btn;
            btn.dataset.floatAction = "sticker";
            return;
          }

          if (kind === "reply") {
            replyBtn = btn;
            btn.dataset.floatAction = "reply";
            return;
          }

          /*
           * 如果没识别出来也收进去。
           * 这样新版 Float 新增按钮时不会突然又塞满底栏。
           */
          folded.push({
            el: btn,
            html: btn.innerHTML,
            title:
              btn.getAttribute("title") ||
              btn.getAttribute("aria-label") ||
              "",
            kind
          });
        });

        /*
         * 如果 title/aria 没把 Sticker 识别出来，
         * 使用当前 Float 已确认的相对顺序兜底：
         * offline / emoji / sticker / plus / send / reply
         */
        if (!stickerBtn && buttons.length >= 3) {
          const candidate = buttons[2];

          const foldedIndex = folded.findIndex(
            x => x.el === candidate
          );

          if (foldedIndex >= 0) {
            folded.splice(foldedIndex, 1);
          }

          stickerBtn = candidate;
          stickerBtn.dataset.floatAction = "sticker";
        }

        /*
         * Reply 通常是最后一个。
         * 如果没有被 SVG/title 正确识别，用最后一个兜底。
         */
        if (!replyBtn && buttons.length >= 2) {
          const candidate = buttons[buttons.length - 1];

          if (candidate !== stickerBtn) {
            const foldedIndex = folded.findIndex(
              x => x.el === candidate
            );

            if (foldedIndex >= 0) {
              folded.splice(foldedIndex, 1);
            }

            replyBtn = candidate;
            replyBtn.dataset.floatAction = "reply";
          }
        }

        if (folded.length === 0) return;

        const triggerBtn = folded[0].el;

        triggerBtn.dataset.floatAction = "menu";
        triggerBtn.classList.add("cb-menu-trigger");

        hijackedMap.set(triggerBtn, folded);

        triggerBtn.addEventListener(
          "click",
          captureClickListener,
          true
        );

        folded.forEach((data, idx) => {
          if (idx === 0) {
            data.el.classList.remove("cb-folded-hide");
          } else {
            data.el.classList.add("cb-folded-hide");
          }
        });
      });
    };

    /* 设置面板 */
    ctx.ui.slot("settings.section", (el) => {
      const render = () => {
        el.innerHTML = "";

        const box = document.createElement("div");
        box.className = "cb-settings-box";

        const currentScope = getApplyScope();
        const selectedList = getTargetSessions();

        const scopeRow = document.createElement("div");
        scopeRow.className = "cb-scope-row";

        const selectedBtn = document.createElement("button");
        selectedBtn.type = "button";
        selectedBtn.className =
          `cb-scope-btn ${currentScope === "selected" ? "active" : ""}`;
        selectedBtn.textContent = "仅勾选的聊天室";

        selectedBtn.onclick = () => {
          ctx.system.storage.set("applyScope", "selected");
          render();
          processInputActions();
        };

        const allBtn = document.createElement("button");
        allBtn.type = "button";
        allBtn.className =
          `cb-scope-btn ${currentScope === "all" ? "active" : ""}`;
        allBtn.textContent = "全部聊天室";

        allBtn.onclick = () => {
          ctx.system.storage.set("applyScope", "all");
          render();
          processInputActions();
        };

        scopeRow.append(selectedBtn, allBtn);
        box.appendChild(scopeRow);

        if (currentScope === "selected") {
          const sessions = ctx.data.sessions.list() || [];

          const actionsBar = document.createElement("div");
          actionsBar.className = "cb-actions-bar";

          const counter = document.createElement("span");
          counter.style.opacity = ".72";
          counter.textContent =
            `已选 ${selectedList.length}/${sessions.length} 个聊天室`;

          const links = document.createElement("div");
          links.className = "cb-link-group";

          const selectAll = document.createElement("button");
          selectAll.type = "button";
          selectAll.className = "cb-link-btn";
          selectAll.textContent = "全选";
          selectAll.onclick = () => {
            ctx.system.storage.set(
              "targetSessions",
              sessions.map(s => String(s.id))
            );
            render();
            processInputActions();
          };

          const clear = document.createElement("button");
          clear.type = "button";
          clear.className = "cb-link-btn";
          clear.textContent = "清空";
          clear.onclick = () => {
            ctx.system.storage.set("targetSessions", []);
            render();
            processInputActions();
          };

          links.append(selectAll, clear);
          actionsBar.append(counter, links);
          box.appendChild(actionsBar);

          const listEl = document.createElement("div");
          listEl.className = "cb-session-list";

          if (sessions.length === 0) {
            const empty = document.createElement("div");
            empty.style.cssText =
              "text-align:center;opacity:.5;font-size:12px;padding:12px;";
            empty.textContent = "暂无聊天会话";
            listEl.appendChild(empty);
          } else {
            sessions.forEach((sess) => {
              const sessionId = String(sess.id);
              let name = sess.alias || "";
              let typeLabel = "单聊";

              if (sess.isGroup) {
                name = sess.groupName || name || "群聊";
                typeLabel = "群聊";
              } else {
                let char = null;

                try {
                  char = ctx.data.characters.get(sess.contactId);
                } catch {}

                name =
                  name ||
                  char?.name ||
                  `联系人 (${String(sess.contactId || "").slice(-4)})`;
              }

              const item = document.createElement("label");
              item.className = "cb-session-item";

              const checkbox = document.createElement("input");
              checkbox.type = "checkbox";
              checkbox.checked =
                selectedList.includes(sessionId);

              checkbox.onchange = (e) => {
                const current =
                  new Set(getTargetSessions());

                if (e.target.checked) {
                  current.add(sessionId);
                } else {
                  current.delete(sessionId);
                }

                ctx.system.storage.set(
                  "targetSessions",
                  Array.from(current)
                );

                render();
                processInputActions();
              };

              const nameSpan = document.createElement("span");
              nameSpan.className = "cb-session-name";
              nameSpan.textContent = name;

              const typeSpan = document.createElement("span");
              typeSpan.className = "cb-session-type";
              typeSpan.textContent = typeLabel;

              item.append(
                checkbox,
                nameSpan,
                typeSpan
              );

              listEl.appendChild(item);
            });
          }

          box.appendChild(listEl);
        }

        el.appendChild(box);
      };

      render();
    });

    const observer = new MutationObserver(() => {
      processInputActions();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    processInputActions();

    return () => {
      observer.disconnect();

      document.removeEventListener(
        "pointerdown",
        handleGlobalPointer,
        true
      );

      closePopover();

      document
        .querySelectorAll(".cb-menu-trigger")
        .forEach((el) => {
          el.removeEventListener(
            "click",
            captureClickListener,
            true
          );
          el.classList.remove("cb-menu-trigger");
          delete el.dataset.floatAction;
        });

      document
        .querySelectorAll(".cb-folded-hide")
        .forEach((el) => {
          el.classList.remove("cb-folded-hide");
          delete el.dataset.floatAction;
        });

      document
        .querySelectorAll("[data-float-action]")
        .forEach((el) => {
          delete el.dataset.floatAction;
        });
    };
  }
};
