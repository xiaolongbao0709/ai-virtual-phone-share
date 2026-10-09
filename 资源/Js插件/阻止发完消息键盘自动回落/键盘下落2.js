export default {
  manifest: {
    id: "keep-keyboard-open",
    name: "键盘不回落",
    apiVersion: 1,
    version: "1.0.0",
    author: "小手机插件",
    description: "发送消息后键盘不回落，点空白处才收起。",
    permissions: ["chat.read"],
    settings: [
      { key: "enabled", label: "启用", type: "boolean", default: true },
      { key: "holdMs", label: "保持时长(毫秒，0为一直)", type: "number", default: 10000 }
    ]
  },
  setup(ctx) {
    let lastInput = null;
    let timer = null;
    let hold = false;

    const isOn = () => ctx.system.settings.get("enabled") !== false;
    const getMs = () => {
      let n = Number(ctx.system.settings.get("holdMs"));
      return isNaN(n) || n < 0 ? 10000 : n;
    };

    function isEditable(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el.isContentEditable) return true;
      if (el.tagName === "TEXTAREA") return !el.disabled && !el.readOnly;
      if (el.tagName === "INPUT") {
        let t = (el.getAttribute("type") || "text").toLowerCase();
        return ["text", "search", "url", "tel", "email", "password"].includes(t) && !el.disabled && !el.readOnly;
      }
      return false;
    }

    function isVisible(el) {
      if (!el || !el.isConnected) return false;
      let r = el.getBoundingClientRect();
      if (r.width < 16 || r.height < 8) return false;
      let cs = getComputedStyle(el);
      return cs && cs.display !== "none" && cs.visibility !== "hidden";
    }

    function findInput() {
      let list = [];
      let nodes = document.querySelectorAll('textarea, input, [contenteditable="true"]');
      for (let el of nodes) {
        if (isEditable(el) && isVisible(el)) list.push(el);
      }
      if (!list.length) return null;
      list.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
      return list[0];
    }

    function getTarget() {
      if (lastInput && lastInput.isConnected && isEditable(lastInput) && isVisible(lastInput)) return lastInput;
      return findInput();
    }

    function doFocus() {
      let input = getTarget();
      if (!input || document.activeElement === input) return;
      if (document.activeElement && isEditable(document.activeElement) && isVisible(document.activeElement)) return;
      try { input.focus({ preventScroll: true }); } catch (e) { return; }
      if (document.activeElement !== input) return;
      try {
        if (input.isContentEditable) {
          let sel = window.getSelection();
          if (sel) {
            let r = document.createRange();
            r.selectNodeContents(input);
            r.collapse(false);
            sel.removeAllRanges();
            sel.addRange(r);
          }
        } else if (typeof input.setSelectionRange === "function") {
          let len = (input.value || "").length;
          input.setSelectionRange(len, len);
        }
      } catch (e) {}
    }

    function startHold() {
      if (!isOn()) return;
      hold = true;
      let ms = getMs();
      if (timer) timer();
      if (ms > 0) {
        timer = ctx.system.timers.setTimeout(() => {
          hold = false;
          timer = null;
        }, ms);
      } else {
        timer = null;
      }
      tick();
    }

    function stopHold() {
      hold = false;
      if (timer) { timer(); timer = null; }
    }

    function tick() {
      if (!hold || !isOn()) return;
      doFocus();
      if (hold && !timer) {
        timer = ctx.system.timers.setTimeout(tick, 150);
      } else if (hold && timer) {
        // 已有 timer 时会自然重试，这里仅作补充
      }
    }

    // 记录聚焦
    document.addEventListener("focusin", (e) => {
      if (isEditable(e.target)) lastInput = e.target;
    }, true);

    // 发送时启动保持
    ctx.hooks.transform("user.beforeSend", (p) => { startHold(); return p; });
    ctx.hooks.on("message.persisted", (p) => {
      if (p && p.message && p.message.role === "user") startHold();
    });

    // 失焦时拉回
    document.addEventListener("focusout", (e) => {
      if (!isEditable(e.target) || !hold || !isOn()) return;
      doFocus();
      setTimeout(doFocus, 0);
      setTimeout(doFocus, 50);
    }, true);

    // 点空白处停止
    document.addEventListener("pointerdown", (e) => {
      if (!hold) return;
      if (isEditable(e.target)) return;
      let input = getTarget();
      if (!input) return;
      let a = input.getBoundingClientRect();
      let b = e.target.getBoundingClientRect();
      let vGap = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
      let hGap = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
      if (vGap <= 20 && hGap <= 260) return; // 点在输入框附近，不管
      stopHold();
    }, true);

    ctx.hooks.on("session.opened", () => stopHold());

    return () => {
      stopHold();
      lastInput = null;
    };
  }
};