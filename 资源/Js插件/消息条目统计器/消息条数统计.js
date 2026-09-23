export default {
  manifest: {
    id: "message-counter-database",
    name: "全局消息计数",
    apiVersion: 1,
    version: "7.0.0",
    author: "小卷",
    description: "在输入框扩展栏添加【计条数】，直接读取数据库统计该会话所有真实消息",
    permissions: ["chat.read"] // 必须申请阅读权限，才能查数据库
  },
  setup(ctx) {
    // 监听打开了哪个会话
    let currentSessionId = null;
    ctx.hooks.on("session.opened", (p) => {
      currentSessionId = p.sessionId;
    });
// 智能获取当前会话ID（防止热重载时丢失ID）
    function getSessionId() {
      if (currentSessionId) return currentSessionId;
      // 如果没监听到，直接从网址路由里强行挖出来
      const hash = window.location.hash;
      if (hash.startsWith("#/chat/")) {
        // 比如 #/chat/%E5%B0%8F%E5%8D%B7，解码后就是“小卷”
        return decodeURIComponent(hash.split("/").pop());
      }
      return null;
    }
// 注入到输入框上方的工具栏插槽
    ctx.ui.slot("chat.inputToolbar", (el) => {
      const btn = document.createElement("button");
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>计条数
      `;
      
      btn.style.cssText = `
        display: flex;
        align-items: center;
        background: transparent;
        border: 1px solid rgba(128,128,128,0.2);
        border-radius: 14px;
        padding: 4px 10px;
        font-size: 13px;
        cursor: pointer;
        color: inherit;
        margin-right: 8px;
        transition: opacity 0.2s;
        flex-shrink: 0;
      `;
      
      btn.onmouseover = () => btn.style.opacity = "0.7";
      btn.onmouseout = () => btn.style.opacity = "1";
btn.onclick = () => {
        const targetId = getSessionId();
        
        if (!targetId) {
          ctx.ui.toast("⚠️ 找不到会话，请点击左上角退出当前聊天，再重新点进来一次！");
          return;
        }
try {
          // 直接从系统的数据库里拉取当前会话的完整历史！
          const history = ctx.data.messages.list(targetId);
          
          if (!history || history.length === 0) {
            ctx.ui.toast("当前会话还没有任何消息哦");
            return;
          }
let userCount = 0;
          let aiCount = 0;
          let systemCount = 0;
history.forEach(msg => {
            if (msg.role === "user") userCount++;
            else if (msg.role === "assistant") aiCount++;
            else systemCount++;
          });
// 弹窗展示精准数据
          ctx.ui.openModal((modalEl, { close }) => {
            modalEl.style.cssText = "width:75vw;max-width:300px;padding:20px;color:#e0e0e0;background:#1a1a2e;border-radius:14px;text-align:center;";
            modalEl.innerHTML = `
              <div style="font-size:16px;font-weight:bold;margin-bottom:16px;color:#a8b4ff;">📊 全局消息统计</div>
              <div style="font-size:32px;font-weight:bold;margin-bottom:16px;color:#fff;">
                ${history.length} <span style="font-size:14px;color:#888;font-weight:normal;">条</span>
              </div>
              <div style="display:flex;justify-content:space-around;margin-bottom:20px;font-size:13px;">
                <div style="display:flex;flex-direction:column;gap:4px;">
                  <span style="color:#888;">你发送</span>
                  <span style="color:#8f8;font-weight:bold;font-size:16px;">${userCount}</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;">
                  <span style="color:#888;">AI回复</span>
                  <span style="color:#f88;font-weight:bold;font-size:16px;">${aiCount}</span>
                </div>
              </div>
              <button id="btn-close-stats" style="width:100%;padding:10px;background:#333;color:#888;border:1px solid #444;border-radius:10px;font-size:13px;cursor:pointer;">确定</button>
            `;
            modalEl.querySelector("#btn-close-stats").onclick = close;
          });
} catch (err) {
          ctx.system.log("统计消息失败", err);
          ctx.ui.toast("⚠️ 获取消息数据失败");
        }
      };
el.appendChild(btn);
    });
  }
};