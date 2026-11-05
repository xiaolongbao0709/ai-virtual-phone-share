export default {
  manifest: {
    id: "floating-ball-dock",
    name: "悬浮球收纳盒",
    apiVersion: 1,
    version: "2.0.0",
    author: "可丽饼＆Gemini",
    description: "极细贴边半透明收纳条，自动识别普通悬浮球与零宽高复合挂件（如MiniMax语音条）",
    settings: [
      {
        key: "maxBallSize",
        label: "识别悬浮球的最大尺寸(px)",
        type: "number",
        default: 100,
      },
      {
        key: "barWidth",
        label: "贴边条宽度(px，建议8~16)",
        type: "number",
        default: 10,
      },
      {
        key: "barHeight",
        label: "贴边条高度(px，建议40~64)",
        type: "number",
        default: 48,
      },
      {
        key: "barOpacity",
        label: "平时不透明度(0.15~0.9)",
        type: "number",
        default: 0.42,
      },
    ],
  },

  setup(ctx) {
    const DOCK_ID = "__plugin_float_dock_master__";
    const PANEL_ID = "__plugin_float_dock_panel__";
    const ATTR_CAPTURED = "data-dock-captured";

    // Map<HTMLElement(触发按钮本身), { el, rootEl, label, avatarStyle, innerPreview }>
    const capturedBalls = new Map();
    let showOriginalBalls = false;
    let panelOpen = false;

    // 注入样式：极细贴边半透明条 + 抽屉面板
    ctx.ui.injectCSS(`
      #${DOCK_ID} {
        position: fixed;
        right: 0;
        top: 42vh;
        width: 10px;
        height: 48px;
        border-radius: 8px 0 0 8px;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(180, 210, 230, 0.45));
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.38);
        border-right: none;
        box-shadow: -1px 2px 8px rgba(0, 0, 0, 0.18);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        z-index: 2147483640;
        cursor: pointer;
        user-select: none;
        touch-action: none;
        transition: width 0.18s ease, opacity 0.2s ease, background 0.18s ease;
      }
      /* 悬停或按住时稍微变亮展开一点点，方便看清 */
      #${DOCK_ID}:hover, #${DOCK_ID}:active {
        width: 15px !important;
        opacity: 0.9 !important;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(160, 205, 235, 0.72));
      }
      /* 极细竖线指示器 */
      #${DOCK_ID} .dock-grip {
        width: 2.5px;
        height: 16px;
        border-radius: 2px;
        background: rgba(40, 60, 80, 0.55);
      }
      /* 迷你内嵌数量点 */
      #${DOCK_ID} .dock-mini-count {
        font-size: 8.5px;
        font-weight: 700;
        line-height: 1;
        color: rgba(25, 45, 65, 0.85);
        transform: scale(0.88);
      }

      /* 只隐藏触发球本体，不影响同容器下的弹出面板 */
      [${ATTR_CAPTURED}="hidden"] {
        opacity: 0 !important;
        pointer-events: none !important;
        width: 0px !important;
        min-width: 0px !important;
        overflow: hidden !important;
        border: none !important;
        box-shadow: none !important;
      }

      #${PANEL_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483645;
        background: rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: dockFadeIn 0.15s ease-out;
      }
      @keyframes dockFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      #${PANEL_ID} .dock-card {
        width: min(295px, 84vw);
        max-height: 70vh;
        background: rgba(32, 35, 44, 0.86);
        backdrop-filter: blur(22px) saturate(1.2);
        -webkit-backdrop-filter: blur(22px) saturate(1.2);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 20px;
        padding: 14px;
        color: #fff;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.42);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      #${PANEL_ID} .dock-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 13px;
        font-weight: 600;
        opacity: 0.9;
        padding: 0 4px;
      }
      #${PANEL_ID} .dock-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        overflow-y: auto;
        padding: 2px;
      }
      #${PANEL_ID} .dock-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        padding: 9px 5px;
        border-radius: 13px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.08);
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
        text-align: center;
      }
      #${PANEL_ID} .dock-item:hover, #${PANEL_ID} .dock-item:active {
        background: rgba(255, 255, 255, 0.18);
        transform: scale(0.96);
      }
      #${PANEL_ID} .dock-item-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.14);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        overflow: hidden;
        background-size: cover;
        background-position: center;
        color: #fff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.22);
      }
      #${PANEL_ID} .dock-item-avatar img,
      #${PANEL_ID} .dock-item-avatar svg {
        max-width: 72%;
        max-height: 72%;
        object-fit: contain;
      }
      #${PANEL_ID} .dock-item-label {
        font-size: 10.5px;
        line-height: 1.2;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.9;
      }
      #${PANEL_ID} .dock-footer {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding-top: 6px;
        border-top: 1px solid rgba(255,255,255,0.1);
      }
      #${PANEL_ID} .dock-btn {
        flex: 1;
        padding: 7px 8px;
        border-radius: 9px;
        border: none;
        background: rgba(255, 255, 255, 0.12);
        color: #fff;
        font-size: 11.5px;
        cursor: pointer;
      }
      #${PANEL_ID} .dock-btn:active {
        background: rgba(255, 255, 255, 0.22);
      }
    `);

    const masterBar = document.createElement("div");
    masterBar.id = DOCK_ID;

    // 恢复上次的上下位置及左右贴边方向
    const savedPos = ctx.system.storage.get("dockPosV2");
    let dockSide = (savedPos && savedPos.side) || "right";

    const applyBarGeometry = () => {
      const w = Math.max(6, Math.min(28, Number(ctx.system.settings.get("barWidth")) || 10));
      const h = Math.max(28, Math.min(120, Number(ctx.system.settings.get("barHeight")) || 48));
      const op = Math.max(0.12, Math.min(0.95, Number(ctx.system.settings.get("barOpacity")) || 0.42));

      masterBar.style.width = w + "px";
      masterBar.style.height = h + "px";
      masterBar.style.opacity = String(op);

      if (dockSide === "left") {
        masterBar.style.left = "0px";
        masterBar.style.right = "auto";
        masterBar.style.borderRadius = "0 8px 8px 0";
        masterBar.style.borderLeft = "none";
        masterBar.style.borderRight = "1px solid rgba(255,255,255,0.38)";
      } else {
        masterBar.style.right = "0px";
        masterBar.style.left = "auto";
        masterBar.style.borderRadius = "8px 0 0 8px";
        masterBar.style.borderRight = "none";
        masterBar.style.borderLeft = "1px solid rgba(255,255,255,0.38)";
      }
    };

    if (savedPos && typeof savedPos.top === "number") {
      masterBar.style.top = Math.min(Math.max(12, savedPos.top), window.innerHeight - 60) + "px";
    }

    const updateMasterUI = () => {
      for (const [el] of capturedBalls) {
        if (!document.body.contains(el)) {
          capturedBalls.delete(el);
        }
      }
      applyBarGeometry();
      const count = capturedBalls.size;
      masterBar.innerHTML = `
        <span class="dock-grip"></span>
        ${count > 0 ? `<span class="dock-mini-count">${count}</span>` : ""}
      `;
    };

    // 判断一个元素的尺寸是否像悬浮球/贴边条触发器
    const isTriggerSize = (rect, maxSize) => {
      // 允许窄贴边条（如宽度 14~24px、高度 40~80px 的 .mmv-tab）
      if (rect.width < 10 || rect.height < 14) return false;
      if (rect.width > maxSize || rect.height > maxSize) return false;
      return true;
    };

    // 寻找页面上的野生悬浮球（含直接 fixed 球 + 0x0 fixed 容器内的触发器）
    const findTriggerElements = () => {
      const maxSize = Number(ctx.system.settings.get("maxBallSize")) || 100;
      const results = [];
      const topNodes = document.querySelectorAll("body > *");

      topNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.id === DOCK_ID || node.id === PANEL_ID) return;
        if (node.id === "__next" || node.id === "root" || node.tagName === "SCRIPT" || node.tagName === "STYLE") {
          return;
        }

        const style = window.getComputedStyle(node);
        if (style.position !== "fixed") return;
        if (style.display === "none" || style.visibility === "hidden") return;

        // 如果已经被捕获过，直接跳过尺寸检查（因为被隐藏后 width 是 0）
        if (capturedBalls.has(node)) {
          results.push(node);
          return;
        }

        const rect = node.getBoundingClientRect();

        // 情况 A：这个 fixed 元素本身就是一个尺寸合适的悬浮球
        // 但要先检查它里面是不是含有一个独立面板（例如既有 tab 又有 panel）
        const childCandidates = Array.from(node.children).filter((c) => c instanceof HTMLElement);
        const hasLargePanelSibling = childCandidates.some((c) => {
          const cr = c.getBoundingClientRect();
          const cs = window.getComputedStyle(c);
          return cr.width > maxSize || cr.height > maxSize || /panel|modal|drawer|list/i.test(c.className);
        });

        if (!hasLargePanelSibling && isTriggerSize(rect, maxSize)) {
          results.push(node);
          return;
        }

        // 情况 B：像 #mmv-root 这种 0x0 的 fixed 外壳，或者内部包含独立 .mmv-tab + .mmv-panel 的复合容器
        childCandidates.forEach((child) => {
          if (capturedBalls.has(child)) {
            results.push(child);
            return;
          }
          const cs = window.getComputedStyle(child);
          if (cs.display === "none" || cs.visibility === "hidden") return;
          // 排除弹出面板本身
          if (/panel|modal|popup|menu|drawer/i.test(child.className)) return;

          const cr = child.getBoundingClientRect();
          if (isTriggerSize(cr, maxSize)) {
            results.push(child);
          }
        });
      });

      return results;
    };

    // 提取原悬浮球的名称与图标外观
    const extractBallInfo = (el, index) => {
      const style = window.getComputedStyle(el);
      const rawTitle =
        el.getAttribute("title") ||
        el.getAttribute("aria-label") ||
        el.getAttribute("data-name") ||
        (el.parentElement && el.parentElement.getAttribute("title")) ||
        "";

      // 清洗标题（比如 "语音缓存，点击展开 / 可拖动" 取逗号前）
      let cleanTitle = rawTitle.split(/[，,\/（(]/)[0].trim();
      const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");

      if (!cleanTitle) {
        if (text && !/^\d+$/.test(text)) {
          cleanTitle = text;
        } else if (el.id || (el.parentElement && el.parentElement.id)) {
          const rawId = el.id || el.parentElement.id;
          cleanTitle = rawId.replace(/[-_]|root|tab|btn/gi, " ").trim() || `插件 #${index}`;
        } else {
          cleanTitle = `插件 #${index}`;
        }
      }

      let avatarStyle = "";
      let innerPreview = "";

      const img = el.querySelector("img");
      const svg = el.querySelector("svg");
      if (img && img.src) {
        innerPreview = `<img src="${img.src}" alt="" />`;
      } else if (svg) {
        innerPreview = svg.outerHTML;
      } else if (style.backgroundImage && style.backgroundImage !== "none" && !style.backgroundImage.includes("gradient")) {
        avatarStyle = `background-image: ${style.backgroundImage};`;
      } else {
        innerPreview = text && !/^\d+$/.test(text) ? text.slice(0, 2) : "⚡";
      }

      // 保留原悬浮球的背景渐变或底色，方便一眼认出（比如浅水蓝的语音条）
      if (style.backgroundImage && style.backgroundImage.includes("gradient")) {
        avatarStyle += `background-image: ${style.backgroundImage};`;
      } else if (style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)") {
        avatarStyle += `background-color: ${style.backgroundColor};`;
      }

      return {
        el,
        label: cleanTitle.slice(0, 9),
        avatarStyle,
        innerPreview,
      };
    };

    // 扫描并收纳
    const scanFloatingBalls = () => {
      const triggers = findTriggerElements();
      let idx = capturedBalls.size + 1;

      triggers.forEach((el) => {
        if (!capturedBalls.has(el)) {
          // 必须在加上 hidden 属性之前提取外观与尺寸！
          const info = extractBallInfo(el, idx++);
          capturedBalls.set(el, info);
        }
        el.setAttribute(ATTR_CAPTURED, showOriginalBalls ? "shown" : "hidden");
      });

      updateMasterUI();
    };

    // 模拟真实点击（完美兼容 pointerdown -> pointerup 绑定的插件如 MiniMax 语音条）
    const triggerOriginalBall = (targetEl) => {
      if (!targetEl) return;

      // 临时解除隐藏以获取正常坐标并触发事件
      const prevAttr = targetEl.getAttribute(ATTR_CAPTURED);
      targetEl.removeAttribute(ATTR_CAPTURED);

      try {
        const rect = targetEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        // 依次派发 pointerdown -> mousedown -> pointerup -> mouseup -> click
        // 同一坐标（moved = false），即可触发像 .mmv-tab 这种在 pointerup 里判断 !moved 的开关
        ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach((type) => {
          const Evt = type.startsWith("pointer") ? PointerEvent : MouseEvent;
          targetEl.dispatchEvent(
            new Evt(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              pointerId: 1,
              isPrimary: true,
              clientX: cx,
              clientY: cy,
            })
          );
        });
      } finally {
        if (!showOriginalBalls && prevAttr) {
          setTimeout(() => {
            targetEl.setAttribute(ATTR_CAPTURED, "hidden");
          }, 60);
        }
      }
    };

    // 打开收纳面板
    const openDockPanel = () => {
      if (panelOpen) return;
      scanFloatingBalls();
      panelOpen = true;

      const overlay = document.createElement("div");
      overlay.id = PANEL_ID;

      const closePanel = () => {
        overlay.remove();
        panelOpen = false;
      };

      const renderCard = () => {
        const items = Array.from(capturedBalls.values());
        overlay.innerHTML = `
          <div class="dock-card">
            <div class="dock-header">
              <span>插件收纳盒 (${items.length})</span>
              <span class="dock-close" style="cursor:pointer;padding:2px 6px;opacity:0.7;">✕</span>
            </div>
            ${
              items.length === 0
                ? `<div style="padding:22px 10px;text-align:center;font-size:12.5px;opacity:0.65;">
                    暂未检测到悬浮球<br/>可点击下方「重新扫描」
                   </div>`
                : `<div class="dock-grid">
                    ${items
                      .map(
                        (item, i) => `
                      <div class="dock-item" data-idx="${i}">
                        <div class="dock-item-avatar" style="${item.avatarStyle}">
                          ${item.innerPreview}
                        </div>
                        <div class="dock-item-label">${item.label}</div>
                      </div>
                    `
                      )
                      .join("")}
                   </div>`
            }
            <div class="dock-footer">
              <button class="dock-btn" data-action="rescan">🔄 重新扫描</button>
              <button class="dock-btn" data-action="toggle-raw">
                ${showOriginalBalls ? "🙈 隐藏原球" : "👁️ 显示原球"}
              </button>
            </div>
          </div>
        `;

        overlay.querySelector(".dock-close").onclick = closePanel;

        overlay.querySelectorAll(".dock-item").forEach((itemEl) => {
          itemEl.onclick = () => {
            const idx = Number(itemEl.getAttribute("data-idx"));
            const target = items[idx];
            closePanel();
            if (target && target.el) {
              triggerOriginalBall(target.el);
            }
          };
        });

        overlay.querySelector('[data-action="rescan"]').onclick = () => {
          // 先临时恢复原状以重新采集图标和尺寸
          for (const [el] of capturedBalls) {
            el.removeAttribute(ATTR_CAPTURED);
          }
          capturedBalls.clear();
          scanFloatingBalls();
          renderCard();
        };

        overlay.querySelector('[data-action="toggle-raw"]').onclick = () => {
          showOriginalBalls = !showOriginalBalls;
          for (const [el] of capturedBalls) {
            el.setAttribute(ATTR_CAPTURED, showOriginalBalls ? "shown" : "hidden");
          }
          renderCard();
        };
      };

      overlay.onclick = (e) => {
        if (e.target === overlay) closePanel();
      };

      renderCard();
      document.body.appendChild(overlay);
    };

    // 贴边条拖拽（支持上下滑动 + 拖到左半屏自动贴左边，右半屏自动贴右边）
    let isDragging = false;
    let hasMoved = false;
    let startX = 0;
    let startY = 0;
    let initTop = 0;

    masterBar.addEventListener("pointerdown", (e) => {
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      initTop = masterBar.getBoundingClientRect().top;
      try {
        masterBar.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    masterBar.addEventListener("pointermove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;
      }
      if (hasMoved) {
        const newTop = Math.min(Math.max(12, initTop + dy), window.innerHeight - 60);
        masterBar.style.top = newTop + "px";
        // 根据手指水平位置自动判断吸附左边缘还是右边缘
        dockSide = e.clientX < window.innerWidth / 2 ? "left" : "right";
        applyBarGeometry();
      }
    });

    masterBar.addEventListener("pointerup", (e) => {
      if (!isDragging) return;
      isDragging = false;
      try {
        masterBar.releasePointerCapture(e.pointerId);
      } catch (err) {}

      if (hasMoved) {
        const rect = masterBar.getBoundingClientRect();
        ctx.system.storage.set("dockPosV2", { top: rect.top, side: dockSide });
      } else {
        openDockPanel();
      }
    });

    document.body.appendChild(masterBar);
    updateMasterUI();

    // 定时扫描补抓
    scanFloatingBalls();
    ctx.system.timers.setInterval(scanFloatingBalls, 1500);
    ctx.hooks.on("app.ready", scanFloatingBalls);
    ctx.hooks.on("session.opened", scanFloatingBalls);
    ctx.hooks.on("plugins.changed", scanFloatingBalls);
    ctx.system.settings.onChange(updateMasterUI);

    return () => {
      masterBar.remove();
      const existingPanel = document.getElementById(PANEL_ID);
      if (existingPanel) existingPanel.remove();
      for (const [el] of capturedBalls) {
        el.removeAttribute(ATTR_CAPTURED);
      }
      capturedBalls.clear();
    };
  },
};