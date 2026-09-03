export default {
  manifest: {
    id: "emergency-touch-repair",
    name: "手势劫持急救工具",
    apiVersion: 1,
    version: "1.0.0",
    author: "repair",
    description: "强制恢复页面滚动，清除坏悬浮球DOM。修复完成请手动删除故障插件。",
    permissions: []
  },
  setup(ctx) {
    let destroyed = false;

    // 使用官方injectCSS注入强制滚动样式，最高权重
    ctx.ui.injectCSS(`
      html,body,html *,body * {
        touch-action: pan-y pan-x !important;
        -webkit-touch-action: pan-y pan-x !important;
        pointer-events: auto !important;
      }
    `);

    function cleanBadElements() {
      // 移除坏插件的根DOM
      const badRoot = document.querySelector("#aiphone-image-api-floating-ball");
      if (badRoot) {
        badRoot.remove();
        ctx.system.log("已移除故障悬浮球DOM");
      }
      // 清理残留toast元素
      document.querySelectorAll(".vapb-local-toast").forEach(el => el.remove());
    }

    // 插件全部加载完毕执行清理
    ctx.hooks.on("app.ready", async () => {
      if (destroyed) return;
      cleanBadElements();
      ctx.ui.toast("✅已执行修复！请尽快删除 image‑api‑floating‑ball");
    });

    // 插件被禁用时
    return () => {
      destroyed = true;
    };
  }
};