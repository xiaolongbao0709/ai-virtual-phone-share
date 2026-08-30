export default {
  manifest: {
    id: "doc-importer-fab",
    name: "文档导入悬浮球",
    apiVersion: 1,
    version: "1.1.0",
    author: "小卷",
    description: "悬浮球点击导入 txt/docx 文件到当前输入框，闲置自动贴边隐藏",
    settings: [
      { key: "mode", label: "导入模式", type: "select", default: "replace",
        options: [{ value: "replace", label: "覆盖原内容" }, { value: "append", label: "追加到末尾" }] },
      { key: "size", label: "悬浮球大小", type: "select", default: "46",
        options: [{ value: "36", label: "小" }, { value: "46", label: "中" }, { value: "52", label: "大" }] },
      { key: "hideDelay", label: "贴边收缩延迟", type: "select", default: "2000",
        options: [{ value: "1500", label: "1.5秒" }, { value: "2000", label: "2秒" }, { value: "3000", label: "3秒" }] },
    ],
  },

  setup(ctx) {
    /* ── 动态加载 mammoth.js ── */
    let mammothReady = null;
    function ensureMammoth() {
      if (mammothReady) return mammothReady;
      mammothReady = new Promise((resolve, reject) => {
        if (window.mammoth) return resolve(window.mammoth);
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js";
        s.onload = () => resolve(window.mammoth);
        s.onerror = () => reject(new Error("mammoth.js 加载失败"));
        document.head.appendChild(s);
      });
      return mammothReady;
    }

    /* ── 读取文件 ── */
    async function readFile(file) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (ext === "txt" || ext === "md") return await file.text();
      if (ext === "docx") {
        const mammoth = await ensureMammoth();
        const buf = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        return result.value;
      }
      throw new Error("不支持的格式，仅支持 txt / md / docx");
    }

    /* ── 找 textarea ── */
    function findActiveTextarea() {
      const active = document.activeElement;
      if (active && active.tagName === "TEXTAREA") return active;
      const all = [...document.querySelectorAll("textarea")];
      const visible = all.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      visible.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return (rb.width * rb.height) - (ra.width * ra.height);
      });
      return visible[0] || null;
    }

    /* ── 填入内容 ── */
    function fillTextarea(textarea, text) {
      const mode = ctx.system.settings.get("mode") || "replace";
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      ).set;
      const newValue = mode === "append"
        ? textarea.value + (textarea.value ? "\n" : "") + text
        : text;
      setter.call(textarea, newValue);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
      textarea.focus();
    }

    /* ── 注入样式（呼吸灯动画） ── */
    const css = ctx.ui.injectCSS(`
      @keyframes docFabPulse {
        0%   { box-shadow: 0 0 0 0 rgba(0,0,0,0.3); }
        70%  { box-shadow: 0 0 0 10px rgba(0,0,0,0); }
        100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
      }
      .doc-fab-notify {
        animation: docFabPulse 1.5s infinite !important;
        background: rgba(0,0,0,0.9) !important;
      }
    `);

    /* ── 创建悬浮球 ── */
    const size = parseInt(ctx.system.settings.get("size") || "46");
    const hideDelay = parseInt(ctx.system.settings.get("hideDelay") || "2000");

    const fab = document.createElement("div");
    Object.assign(fab.style, {
      position: "fixed",
      width: size + "px",
      height: size + "px",
      borderRadius: "50%",
      background: "rgba(30,30,30,0.85)",
      backdropFilter: "blur(12px)",
      webkitBackdropFilter: "blur(12px)",
      border: "1.5px solid rgba(255,255,255,0.2)",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "grab",
      zIndex: "99999",
      userSelect: "none",
      touchAction: "none",
      transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
      top: "40%",
      left: (window.innerWidth - size) + "px",
    });
    fab.innerHTML = `
      <div style="width:${size * 0.6}px;height:${size * 0.6}px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;transition:all 0.3s;pointer-events:none;" class="doc-fab-icon">
        <svg width="${size * 0.35}" height="${size * 0.35}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
      </div>`;
    document.body.appendChild(fab);

    /* ── 贴边状态管理 ── */
    let currentSide = "right"; // "left" | "right"
    let isSnapped = false;     // 是否已收缩为细条
    let hideTimer = null;

    function scheduleSnap() {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => {
        collapseToStrip();
      }, hideDelay);
    }

    function collapseToStrip() {
      isSnapped = true;
      fab.style.transition = "all 0.3s cubic-bezier(0.4,0,0.2,1)";
      fab.style.borderRadius = currentSide === "left" ? "0 4px 4px 0" : "4px 0 0 4px";
      fab.style.width = "6px";
      fab.style.height = "40px";
      fab.style.background = "rgba(0,0,0,0.25)";
      fab.style.boxShadow = "none";
      fab.style.border = "none";
      if (currentSide === "left") {
        fab.style.left = "0px";
      } else {
        fab.style.left = (window.innerWidth - 6) + "px";
      }
      // 隐藏内部图标
      const icon = fab.querySelector(".doc-fab-icon");
      if (icon) {
        icon.style.opacity = "0";
        icon.style.transform = "scale(0)";
      }
    }

    function expandFromStrip() {
      isSnapped = false;
      fab.style.transition = "all 0.3s cubic-bezier(0.4,0,0.2,1)";
      fab.style.borderRadius = "50%";
      fab.style.width = size + "px";
      fab.style.height = size + "px";
      fab.style.background = "rgba(30,30,30,0.85)";
      fab.style.boxShadow = "0 4px 15px rgba(0,0,0,0.2)";
      fab.style.border = "1.5px solid rgba(255,255,255,0.2)";
      if (currentSide === "left") {
        fab.style.left = "0px";
      } else {
        fab.style.left = (window.innerWidth - size) + "px";
      }
      // 恢复图标
      const icon = fab.querySelector(".doc-fab-icon");
      if (icon) {
        icon.style.opacity = "1";
        icon.style.transform = "scale(1)";
      }
    }

    function snapToEdge() {
      fab.style.transition = "all 0.3s cubic-bezier(0.4,0,0.2,1)";
      // 限制上下
      const top = Math.max(40, Math.min(window.innerHeight - size - 40, parseInt(fab.style.top)));
      fab.style.top = top + "px";

      if (currentSide === "left") {
        fab.style.left = "0px";
      } else {
        fab.style.left = (window.innerWidth - size) + "px";
      }
      scheduleSnap();
    }

    // 初始贴右边，然后自动收缩
    scheduleSnap();

    /* ── 拖拽逻辑 ── */
    let isDragging = false;
    let dragMoved = false;
    let startX, startY, fabStartLeft, fabStartTop;

    function onPointerDown(e) {
      e.preventDefault();
      clearTimeout(hideTimer);
      isDragging = true;
      dragMoved = false;

      // 如果处于收缩态先展开
      if (isSnapped) {
        expandFromStrip();
      }

      fab.style.transition = "none";
      fab.style.cursor = "grabbing";

      const rect = fab.getBoundingClientRect();
      fabStartLeft = rect.left;
      fabStartTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      fab.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragMoved = true;
      if (dragMoved) {
        let newL = fabStartLeft + dx;
        let newT = fabStartTop + dy;
        newL = Math.max(0, Math.min(window.innerWidth - size, newL));
        newT = Math.max(0, Math.min(window.innerHeight - size, newT));
        fab.style.left = newL + "px";
        fab.style.top = newT + "px";
      }
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      fab.style.cursor = "grab";

      if (!dragMoved) {
        // 点击 → 打开文件选择
        handleTap();
        scheduleSnap();
      } else {
        // 拖拽结束 → 判断贴哪边
        const rect = fab.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        currentSide = centerX < window.innerWidth / 2 ? "left" : "right";
        snapToEdge();
      }
    }

    fab.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);

    /* ── 点击处理 ── */
    function handleTap() {
      const textarea = findActiveTextarea();
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".txt,.md,.docx";
      input.style.display = "none";
      document.body.appendChild(input);

      input.addEventListener("change", async () => {
        const file = input.files[0];
        if (!file) { input.remove(); return; }

        const toast = ctx.ui.toast("📄 正在读取: " + file.name, { durationMs: 0 });
        try {
          const text = await readFile(file);
          const target = findActiveTextarea() || textarea;
          if (!target) {
            toast.close();
            ctx.ui.toast("⚠️ 没找到输入框，请先点击一个文本框再试");
            return;
          }
          fillTextarea(target, text);
          toast.close();
          ctx.ui.toast("✅ 已导入 " + file.name);
        } catch (err) {
          toast.close();
          ctx.ui.toast("❌ " + err.message);
          ctx.system.log("导入失败", err);
        } finally {
          input.remove();
        }
      });
      input.click();
    }

    /* ── 清理 ── */
    return () => {
      clearTimeout(hideTimer);
      fab.remove();
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  },
};
