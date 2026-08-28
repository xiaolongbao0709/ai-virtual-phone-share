export default {
  manifest: {
    id: "format-cleaner",
    name: "角色对话格式净化器",
    apiVersion: 1,
    version: "1.3.0",
    author: "AI Collaborator",
    description: "全面、自动清除新老聊天内容中的双引号，打开会话即自动静默清理历史记录",
    permissions: ["chat.read"],
    settings: [],
  },
  setup(ctx) {
    // 核心清洗函数：剥离所有中文、英文双引号
    function cleanText(text) {
      if (!text || typeof text !== 'string') return text;
      return text.replace(/[“”"]/g, "").trim();
    }

    // 清理某个会话的所有历史消息
    function cleanSessionHistory(sessionId) {
      const messages = ctx.data.messages.list(sessionId);
      if (!messages || messages.length === 0) return;

      for (const msg of messages) {
        if (msg.content) {
          const cleaned = cleanText(msg.content);
          // 如果清洗后的内容和原来不同，说明有引号，立刻更新数据库
          if (cleaned !== msg.content) {
            ctx.data.messages.update(msg.id, { content: cleaned });
          }
        }
      }
    }

    // 1. 每次打开聊天会话，自动静默清理该会话所有的历史引号
    ctx.hooks.on("session.opened", ({ sessionId }) => {
      if (!sessionId) return;
      cleanSessionHistory(sessionId);
    });

    // 2. 拦截 LLM 实时回复流
    ctx.hooks.transform("llm.response", (p) => {
      p.text = cleanText(p.text);
      return p;
    });

    // 3. 拦截即将写入数据库的消息
    ctx.hooks.transform("message.beforePersist", (p) => {
      if (p.message && p.message.content) {
        p.message.content = cleanText(p.message.content);
      }
      return p;
    });

    // 4. 交互弹窗（带有一键强力全量清理按钮及实时测试）
    function openCleanerModal(sessionId) {
      ctx.ui.openModal((container, { close }) => {
        container.style.cssText = `
          background: #ffffff;
          color: #333333;
          padding: 20px;
          border-radius: 12px;
          width: 90%;
          max-width: 450px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          font-family: inherit;
        `;

        container.innerHTML = `
          <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 18px; display: flex; align-items: center; justify-content: space-between;">
            <span>✨ 格式净化器面板</span>
            <button id="close-btn" style="background:none; border:none; font-size:16px; cursor:pointer; color:#999;">✕</button>
          </h3>
          <div style="font-size: 13px; color: #666; margin-bottom: 15px; line-height: 1.4;">
            插件已设置为<b>自动清除新老消息中的双引号</b>。如果当前页面的历史消息没变，点下方按钮手动强力刷新一次即可。
          </div>
          
          <div style="margin-bottom: 15px;">
            <button id="force-clean-btn" style="width: 100%; padding: 10px; background: #007aff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold;">⚡ 立即强力刷新当前聊天所有引号</button>
            <div id="clean-status" style="font-size: 12px; color: #888; margin-top: 6px; text-align: center;"></div>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button id="ok-btn" style="padding: 6px 16px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">关闭</button>
          </div>
        `;

        const closeBtn = container.querySelector("#close-btn");
        const okBtn = container.querySelector("#ok-btn");
        const forceCleanBtn = container.querySelector("#force-clean-btn");
        const cleanStatus = container.querySelector("#clean-status");

        forceCleanBtn.onclick = () => {
          cleanSessionHistory(sessionId);
          cleanStatus.textContent = "✅ 已成功强力刷新当前聊天的所有气泡！";
          ctx.ui.toast("历史引号已全部清除！");
        };

        closeBtn.onclick = close;
        okBtn.onclick = close;
      });
    }

    // 聊天顶部栏注入按钮
    ctx.ui.slot("chat.header", (el, props) => {
      const { sessionId } = props;
      if (!sessionId) return;

      el.innerHTML = "";
      const btn = document.createElement("button");
      btn.textContent = "✨ 格式净化";
      btn.style.cssText = `
        font-size: 11px;
        padding: 2px 8px;
        margin: 4px 0 0 4px;
        background: rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(0, 0, 0, 0.15);
        border-radius: 4px;
        cursor: pointer;
        opacity: 0.8;
      `;
      btn.onclick = () => openCleanerModal(sessionId);
      el.appendChild(btn);
    });
  }
};
