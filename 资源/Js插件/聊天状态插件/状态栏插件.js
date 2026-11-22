export default {
  manifest: {
    id: "xieze-wechat-status",
    name: "微信终端状态监测",
    apiVersion: 1,
    version: "1.2.0",
    author: "小卷",
    description: "在微信单聊气泡下方生成可点击展开/收起的暗黑终端状态监测卡片",
    settings: [
      { key: "enabled", label: "启用状态监测卡片", type: "boolean", default: true },
      { key: "injectPrompt", label: "自动注入状态栏格式指令（世界书已配可关闭）", type: "boolean", default: true },
      { key: "targetName", label: "限定生效角色名（留空则对所有单聊生效）", type: "text", default: "谢泽" },
      { key: "defaultOpen", label: "默认展开详情（关闭则默认折叠）", type: "boolean", default: false },
    ],
  },
setup(ctx) {
    ctx.ui.injectCSS(
      ".xz-fold-wrap{margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}" +
      ".xz-fold-summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;background:#161922;border:1px solid #2d3548;color:#60a5fa;font-size:11px;font-weight:600;user-select:none;}" +
      ".xz-fold-summary::-webkit-details-marker{display:none;}" +
      ".xz-fold-sub{color:#94a3b8;font-weight:400;}" +
      ".xz-status-card{margin-top:6px;padding:10px 12px;border-radius:10px;background:#161922;border:1px solid #2d3548;color:#e2e8f0;font-size:12px;line-height:1.55;}" +
      ".xz-status-header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2d3548;padding-bottom:5px;margin-bottom:7px;}" +
      ".xz-status-title{font-weight:700;color:#60a5fa;}" +
      ".xz-status-badge{font-size:11px;background:#1e293b;color:#94a3b8;padding:1px 7px;border-radius:4px;}" +
      ".xz-status-row{margin-bottom:4px;color:#cbd5e1;}" +
      ".xz-status-label{color:#94a3b8;}" +
      ".xz-status-bars{display:flex;gap:10px;margin:6px 0;}" +
      ".xz-bar-col{flex:1;}" +
      ".xz-bar-text{font-size:11px;color:#94a3b8;margin-bottom:2px;}" +
      ".xz-bar-track{height:5px;background:#2d3548;border-radius:3px;overflow:hidden;}" +
      ".xz-bar-fill-order{height:100%;background:#38bdf8;}" +
      ".xz-bar-fill-love{height:100%;background:#f472b6;}" +
      ".xz-status-os{margin-top:6px;padding:5px 9px;background:#0f172a;border-left:3px solid #60a5fa;border-radius:4px;color:#cbd5e1;font-style:italic;}"
    );
const PROMPT_RULE =
      "【状态栏输出指令】\n每次回复末尾必须输出如下格式的标签，严禁修改标签名：\n" +
      "<status>\ntime: 当前时间与地点\nplan: 原定计划\norder: 秩序稳定度数字(0-100)\n" +
      "love: 隐蔽心动值数字(0-100)\nstage: 当前关系阶段简述\nmode: 当前本能反应模式\n" +
      "call: 当前称呼\nos: 一句极简理工男内心OS\n</status>";
function isTargetSession(sessionId) {
      try {
        if (ctx.system.settings.get("enabled") === false) return false;
        if (!sessionId) return false;
        const session = ctx.data.sessions && ctx.data.sessions.get(sessionId);
        if (!session || session.isGroup) return false;
        const targetName = String(ctx.system.settings.get("targetName") || "").trim();
        if (!targetName) return true;
        const contacts = (ctx.data.contacts && ctx.data.contacts.list()) || [];
        const contact = contacts.find((c) => c && c.id === session.contactId);
        if (!contact) return false;
        return String(contact.name || "").includes(targetName) || String(contact.remark || "").includes(targetName);
      } catch (e) {
        return true;
      }
    }
function parseStatus(rawText) {
      if (typeof rawText !== "string") return null;
      const blockMatch = rawText.match(/<status>([\s\S]*?)<\/status>/i);
      if (!blockMatch) return null;
      const body = blockMatch[1];
      const getField = (key, fallback) => {
        const m = body.match(new RegExp(key + "\\s*[:：]\\s*([^\\n\\r]+)", "i"));
        return m ? m[1].trim() : fallback;
      };
      const orderNum = Math.min(100, Math.max(0, parseInt(getField("order", "80"), 10) || 80));
      const loveNum = Math.min(100, Math.max(0, parseInt(getField("love", "50"), 10) || 50));
      return {
        time: getField("time", "-"),
        plan: getField("plan", "-"),
        order: orderNum,
        love: loveNum,
        stage: getField("stage", "-"),
        mode: getField("mode", "-"),
        call: getField("call", "-"),
        os: getField("os", "-"),
      };
    }
function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }
let pendingStatusMap = {};
ctx.hooks.transform("prompt.system", (payload) => {
      if (ctx.system.settings.get("injectPrompt") === false) return payload;
      if (!isTargetSession(payload.sessionId)) return payload;
      payload.hint = (payload.hint ? payload.hint + "\n\n" : "") + PROMPT_RULE;
      return payload;
    });
ctx.hooks.transform("llm.response", (payload) => {
      if (ctx.system.settings.get("enabled") === false) return payload;
      const parsed = parseStatus(payload.text);
      if (parsed) {
        const sid = payload.sessionId || "default";
        pendingStatusMap[sid] = parsed;
        if (payload.sessionId && ctx.data.variables) {
          ctx.data.variables.set("xz_latest_status", parsed, "session", payload.sessionId);
        }
        payload.text = payload.text.replace(/<status>[\s\S]*?<\/status>/gi, "").trim();
      }
      return payload;
    });
ctx.hooks.transform("message.beforePersist", (payload) => {
      const msg = payload.message;
      if (!msg || msg.role !== "assistant") return payload;
      const sid = msg.sessionId || "default";
      if (pendingStatusMap[sid]) {
        msg.xzStatus = pendingStatusMap[sid];
        delete pendingStatusMap[sid];
      }
      return payload;
    });
ctx.ui.slot("message.footer", (el, props) => {
      if (ctx.system.settings.get("enabled") === false) return;
      const msg = props && props.message;
      if (!msg || msg.role !== "assistant") return;
const status = msg.xzStatus || parseStatus(msg.content);
      if (!status) return;
const openAttr = ctx.system.settings.get("defaultOpen") ? " open" : "";
      el.innerHTML =
        '<details class="xz-fold-wrap"' + openAttr + '>' +
          '<summary class="xz-fold-summary">' +
            '<span>📟 终端状态监测</span>' +
            '<span class="xz-fold-sub">· 秩序 ' + status.order + '% | 心动 ' + status.love + '% ▾</span>' +
          '</summary>' +
          '<div class="xz-status-card">' +
            '<div class="xz-status-header">' +
              '<span class="xz-status-title">📟 TERMINAL // 实时状态监测</span>' +
              '<span class="xz-status-badge">' + escapeHtml(status.stage) + '</span>' +
            '</div>' +
            '<div class="xz-status-row"><span class="xz-status-label">📍 坐标日程：</span>' + escapeHtml(status.time) + '（原计划：' + escapeHtml(status.plan) + '）</div>' +
            '<div class="xz-status-bars">' +
              '<div class="xz-bar-col">' +
                '<div class="xz-bar-text">⚙️ 秩序稳定度：' + status.order + '%</div>' +
                '<div class="xz-bar-track"><div class="xz-bar-fill-order" style="width:' + status.order + '%"></div></div>' +
              '</div>' +
              '<div class="xz-bar-col">' +
                '<div class="xz-bar-text">💓 隐蔽心动值：' + status.love + '%</div>' +
                '<div class="xz-bar-track"><div class="xz-bar-fill-love" style="width:' + status.love + '%"></div></div>' +
              '</div>' +
            '</div>' +
            '<div class="xz-status-row"><span class="xz-status-label">🛡️ 本能状态：</span>' + escapeHtml(status.mode) + ' ｜ <span class="xz-status-label">称呼：</span><strong>' + escapeHtml(status.call) + '</strong></div>' +
            '<div class="xz-status-os">“' + escapeHtml(status.os) + '”</div>' +
          '</div>' +
        '</details>';
    });
  },
};