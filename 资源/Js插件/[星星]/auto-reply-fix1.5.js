// 收起键盘自动回复 · 全局补丁 v1.5
// 修复：多会话同时挂载（历史窗口仅隐藏不卸载）导致 querySelector 串号到最早会话，
//       其它角色窗口全部失效。本版按「当前可见窗口」识别会话，检查均限定在可见窗口内。
// 安装：聊天设置 → 扩展插件 → 导入插件；同 id 重装 = 升级保留设置
export default {
  manifest: {
    id: "kb-dismiss-auto-reply",
    name: "收起键盘自动回复(补丁)",
    apiVersion: 1,
    version: "1.5.0",
    author: "小坊",
    description: "输入框失焦/键盘收起/退出聊天窗口时自动触发角色回复。全局生效，支持多角色窗口。",
    permissions: ["chat.read"],
    settings: [
      { key: "enabled", label: "启用补丁", type: "boolean", default: true },
      {
        key: "debounceMs",
        label: "安静等待(毫秒)",
        type: "number",
        default: 1000,
        description: "建议 500~3000；等待期间又点回输入框/输入内容/打开面板则取消"
      },
      {
        key: "exitFallback",
        label: "退出聊天窗口时兜底触发",
        type: "boolean",
        default: true,
        description: "键盘检测失效时，退出聊天窗口也会自动回消息"
      }
    ]
  },

  setup(ctx) {
    const INPUT_SELECTOR = ".chat-input-textarea";
    const WRAPPER_SELECTOR = ".chat-room-wrapper";
    const FIRE_GAP_MS = 3000;

    const isEnabled = () => ctx.system.settings.get("enabled") !== false;
    const getDebounceMs = () => Math.max(0, Number(ctx.system.settings.get("debounceMs")) || 1000);
    const exitFallbackOn = () => ctx.system.settings.get("exitFallback") !== false;

    let timer = null;
    let inputFocused = false;
    let focusedAtHeight = null;
    let monitorRaf = null;
    let lastSessionId = null;      // 最近进入的会话（session.opened 事件）
    let focusSessionId = null;     // 本次失焦所属的会话（失焦瞬间锁定）
    let lastVisibleSessionId = null; // 上一个可见会话（退出兜底用）
    let lastFireAt = 0;
    let observer = null;

    const viewportHeight = () =>
      window.visualViewport ? window.visualViewport.height : window.innerHeight;

    const wrapperId = (el) => {
      if (!el) return null;
      const m = String(el.className).match(/\bsession-([^\s]+)/);
      return m ? m[1] : null;
    };

    // 当前可见的聊天窗口（多窗口同时挂载时，只有激活的那个可见）
    const visibleWrapper = () => {
      const list = Array.from(document.querySelectorAll(WRAPPER_SELECTOR));
      for (const el of list) {
        if (el.offsetParent !== null) return el;
      }
      for (const el of list) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
      }
      return null;
    };

    // 会话识别优先级：可见窗口 > 失焦时锁定的会话 > 最近进入的会话
    const currentSessionId = () => {
      const vis = wrapperId(visibleWrapper());
      if (vis) return vis;
      if (focusSessionId) return focusSessionId;
      return lastSessionId;
    };

    const isInputFocusedNow = () => {
      const a = document.activeElement;
      return a instanceof HTMLElement && a.matches(INPUT_SELECTOR);
    };

    // 以下检查全部限定在「当前可见窗口」内部，避免隐藏窗口的残留状态串号
    const hasDraft = () => {
      const w = visibleWrapper();
      if (!w) return false;
      const ta = w.querySelector(INPUT_SELECTOR);
      return !!(ta && ta.value && String(ta.value).trim());
    };
    const hasPanelOpen = () => {
      const w = visibleWrapper();
      return !!(w && w.querySelector(".emoji-category-pill, .chat-plus-menu"));
    };
    const isOfflineMode = () => {
      const w = visibleWrapper();
      return !!(w && w.querySelector(".chat-offline-body"));
    };

    const lastVisibleIsUser = (sessionId) => {
      const msgs = ctx.data.messages.list(sessionId);
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "system") continue;
        return msgs[i].role === "user";
      }
      return false;
    };

    const cancel = () => {
      if (timer) { timer(); timer = null; }
    };

    const doFire = (sessionId) => {
      if (!isEnabled()) return;
      if (!sessionId || document.hidden) return;
      if (isOfflineMode()) return;
      if (hasDraft()) return;
      if (hasPanelOpen()) return;
      if (isInputFocusedNow()) return;
      if (!lastVisibleIsUser(sessionId)) return;
      if (Date.now() - lastFireAt < FIRE_GAP_MS) return;
      lastFireAt = Date.now();
      ctx.system.log("收起键盘自动回复触发", sessionId);
      window.dispatchEvent(new CustomEvent("chat-request-reply", { detail: { sessionId } }));
    };

    const fire = () => {
      timer = null;
      doFire(focusSessionId || currentSessionId());
    };

    const schedule = () => {
      if (!isEnabled()) return;
      const sid = focusSessionId || currentSessionId();
      if (!sid) return;
      cancel();
      timer = ctx.system.timers.setTimeout(fire, getDebounceMs());
    };

    const startMonitor = () => {
      if (monitorRaf) return;
      focusedAtHeight = viewportHeight();
      const check = () => {
        if (!inputFocused) { monitorRaf = null; return; }
        const h = viewportHeight();
        if (h - focusedAtHeight >= 48) {
          inputFocused = false;
          monitorRaf = null;
          schedule();
          return;
        }
        monitorRaf = requestAnimationFrame(check);
      };
      monitorRaf = requestAnimationFrame(check);
    };
    const stopMonitor = () => {
      if (monitorRaf) { cancelAnimationFrame(monitorRaf); monitorRaf = null; }
      focusedAtHeight = null;
    };

    const onFocusIn = (e) => {
      if (e.target instanceof HTMLElement && e.target.matches(INPUT_SELECTOR)) {
        inputFocused = true;
        focusSessionId = wrapperId(e.target.closest(WRAPPER_SELECTOR)) || lastSessionId;
        cancel();
        startMonitor();
      }
    };
    const onFocusOut = (e) => {
      if (!(e.target instanceof HTMLElement) || !e.target.matches(INPUT_SELECTOR)) return;
      if (e.relatedTarget instanceof HTMLElement && e.relatedTarget.matches(INPUT_SELECTOR)) return;
      inputFocused = false;
      focusSessionId = wrapperId(e.target.closest(WRAPPER_SELECTOR)) || lastSessionId;
      stopMonitor();
      schedule();
    };
    const onInput = (e) => {
      if (e.target instanceof HTMLElement && e.target.matches(INPUT_SELECTOR)) cancel();
    };
    const onViewportResize = () => {
      if (!inputFocused) return;
      const h = viewportHeight();
      if (focusedAtHeight !== null && h - focusedAtHeight >= 48) {
        inputFocused = false;
        stopMonitor();
        schedule();
      }
    };

    // 退出兜底：可见窗口从「有」变「无」= 当前会话被隐藏/退出 → 触发
    const scanVisible = () => {
      const vis = visibleWrapper();
      const sid = wrapperId(vis);
      if (sid) {
        if (sid !== lastVisibleSessionId) lastVisibleSessionId = sid;
        return;
      }
      // 从有到无
      if (lastVisibleSessionId) {
        const gone = lastVisibleSessionId;
        lastVisibleSessionId = null;
        doFire(gone);
      }
    };
    const startExitWatcher = () => {
      if (observer || !exitFallbackOn()) return;
      observer = new MutationObserver(() => { scanVisible(); });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
      scanVisible();
    };
    const stopExitWatcher = () => {
      if (observer) { observer.disconnect(); observer = null; }
      lastVisibleSessionId = null;
    };

    const vv = window.visualViewport;
    const offSessionOpened = ctx.hooks.on("session.opened", ({ sessionId }) => {
      lastSessionId = sessionId;
    });

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("input", onInput, true);
    if (vv) vv.addEventListener("resize", onViewportResize);
    window.addEventListener("resize", onViewportResize);
    startExitWatcher();

    const offSettings = ctx.system.settings.onChange((s) => {
      if (s.enabled === false) cancel();
      if (s.exitFallback === false) stopExitWatcher();
      else if (s.exitFallback === true) startExitWatcher();
    });

    return () => {
      cancel();
      stopMonitor();
      stopExitWatcher();
      offSessionOpened();
      offSettings();
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("input", onInput, true);
      if (vv) vv.removeEventListener("resize", onViewportResize);
      window.removeEventListener("resize", onViewportResize);
    };
  }
};