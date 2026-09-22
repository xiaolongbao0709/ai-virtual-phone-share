export default {
  manifest: {
    id: "online-status-notifier",
    name: "多选上线感知",
    apiVersion: 1,
    version: "1.3.0",
    author: "镜观雪",
    description: "支持多选指定角色与群聊，进入时触发系统提示并让模型感知，不强制干预角色发言",
    permissions: ["chat.read"],
    settings: [
      {
        key: "notifyMode",
        label: "提示形式",
        type: "select",
        default: "both",
        options: [
          { value: "both", label: "系统消息 + 顶部轻提示" },
          { value: "toast", label: "仅顶部轻提示 (Toast)" },
          { value: "message", label: "仅聊天窗口系统消息" },
        ],
      },
      {
        key: "onlineText",
        label: "单聊上线文案",
        type: "text",
        default: "你已上线",
      },
      {
        key: "groupOnlineText",
        label: "群聊上线文案",
        type: "text",
        default: "你已进入群聊",
      },
      {
        key: "cooldownMinutes",
        label: "防刷冷却时间 (分钟)",
        type: "number",
        default: 3,
      },
    ],
  },

  setup(ctx) {
    const STORAGE_KEY_CHARS = "bound_char_ids_json";
    const STORAGE_KEY_GROUPS = "bound_group_ids_json";

    // 读写工具
    const getStoredList = (key) => {
      try {
        const raw = ctx.system.storage.get(key);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    };
    const saveStoredList = (key, list) => {
      ctx.system.storage.set(key, JSON.stringify(list));
    };

    // ----------------------------------------------------
    // 1. 设置面板：角色与群聊的多选勾选框 UI
    // ----------------------------------------------------
    ctx.ui.slot("settings.section", (el) => {
      el.innerHTML = "";
      el.style.cssText = "margin-top: 14px; display: flex; flex-direction: column; gap: 14px; font-size: 13px;";

      const renderCheckboxGroup = ({ title, items, storageKey, emptyTip }) => {
        const container = document.createElement("div");
        container.style.cssText = "background: rgba(128,128,128,0.08); padding: 12px; border-radius: 8px;";

        const header = document.createElement("div");
        header.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;";

        const titleSpan = document.createElement("span");
        titleSpan.textContent = title;
        titleSpan.style.cssText = "font-weight: 600;";
        header.appendChild(titleSpan);

        const btnGroup = document.createElement("div");
        btnGroup.style.cssText = "display: flex; gap: 8px;";

        const allBtn = document.createElement("button");
        allBtn.textContent = "全选";
        allBtn.type = "button";
        allBtn.style.cssText = "padding: 2px 8px; font-size: 11px; border-radius: 4px; border: 1px solid rgba(128,128,128,0.3); background: transparent; cursor: pointer; color: inherit;";

        const clearBtn = document.createElement("button");
        clearBtn.textContent = "全不选";
        clearBtn.type = "button";
        clearBtn.style.cssText = "padding: 2px 8px; font-size: 11px; border-radius: 4px; border: 1px solid rgba(128,128,128,0.3); background: transparent; cursor: pointer; color: inherit;";

        btnGroup.appendChild(allBtn);
        btnGroup.appendChild(clearBtn);
        header.appendChild(btnGroup);
        container.appendChild(header);

        if (!items || items.length === 0) {
          const empty = document.createElement("div");
          empty.textContent = emptyTip || "暂无数据";
          empty.style.cssText = "font-size: 12px; opacity: 0.5; padding: 4px 0;";
          container.appendChild(empty);
          return container;
        }

        const listDiv = document.createElement("div");
        listDiv.style.cssText = "display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto; padding-right: 4px;";

        let selected = getStoredList(storageKey);

        const updateAllCheckboxes = (newSelected) => {
          selected = newSelected;
          saveStoredList(storageKey, selected);
          listDiv.querySelectorAll("input[type=checkbox]").forEach((cb) => {
            cb.checked = selected.includes(cb.value);
          });
        };

        allBtn.onclick = () => updateAllCheckboxes(items.map((i) => i.id));
        clearBtn.onclick = () => updateAllCheckboxes([]);

        items.forEach((item) => {
          const label = document.createElement("label");
          label.style.cssText = "display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 12.5px; padding: 3px 0;";

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.value = item.id;
          checkbox.checked = selected.includes(item.id);

          checkbox.onchange = () => {
            if (checkbox.checked) {
              if (!selected.includes(item.id)) selected.push(item.id);
            } else {
              selected = selected.filter((id) => id !== item.id);
            }
            saveStoredList(storageKey, selected);
          };

          const nameSpan = document.createElement("span");
          nameSpan.textContent = item.name || "未命名";

          label.appendChild(checkbox);
          label.appendChild(nameSpan);
          listDiv.appendChild(label);
        });

        container.appendChild(listDiv);
        return container;
      };

      const characters = (ctx.data.characters.list() || []).map((c) => ({
        id: c.id,
        name: c.name || "未命名角色",
      }));
      el.appendChild(
        renderCheckboxGroup({
          title: "绑定单聊角色（勾选生效）",
          items: characters,
          storageKey: STORAGE_KEY_CHARS,
          emptyTip: "暂无单聊角色",
        })
      );

      const groupSessions = (ctx.data.sessions.list() || [])
        .filter((s) => s.isGroup)
        .map((s) => ({
          id: s.id,
          name: s.name || s.title || "未命名群聊",
        }));
      el.appendChild(
        renderCheckboxGroup({
          title: "绑定群聊（勾选生效）",
          items: groupSessions,
          storageKey: STORAGE_KEY_GROUPS,
          emptyTip: "暂无群聊",
        })
      );
    });

    // ----------------------------------------------------
    // 2. 无感环境注入：让模型知道你上线了，但不强制它发消息
    // ----------------------------------------------------
    ctx.hooks.transform("prompt.system", async (payload) => {
      const { sessionId, isGroup } = payload;
      if (!sessionId) return payload;

      const lastOnline = Number(ctx.system.storage.get(`last_online_${sessionId}`) || 0);
      const now = Date.now();

      // 上线后 5 分钟内的对话，向系统提示词末尾轻轻推一把上下文
      // 不破坏原有格式，模型会在你说话时自然地带出欢迎或相关反应
      if (lastOnline > 0 && now - lastOnline < 5 * 60 * 1000) {
        if (isGroup) {
          payload.hint =
            (payload.hint || "") +
            "\n[系统感知: 对方刚刚打开了本群聊天窗口，处于在线状态。]";
        } else {
          payload.hint =
            (payload.hint || "") +
            "\n[系统感知: 对方刚刚打开了私聊窗口，处于在线状态。]";
        }
      }
      return payload;
    });

    // ----------------------------------------------------
    // 3. 触发系统事件（仅落库消息和 Toast，无任何 AI 强干预）
    // ----------------------------------------------------
    ctx.hooks.on("session.opened", async ({ sessionId, isGroup }) => {
      if (!sessionId) return;

      const session = ctx.data.sessions.get(sessionId);
      if (!session) return;

      if (isGroup) {
        const boundGroups = getStoredList(STORAGE_KEY_GROUPS);
        if (!boundGroups.includes(sessionId)) return;
      } else {
        const boundChars = getStoredList(STORAGE_KEY_CHARS);
        const sessionCharId = session.characterId || session.contactId;
        if (!boundChars.includes(sessionCharId)) return;
      }

      const cooldownMin = Number(ctx.system.settings.get("cooldownMinutes") ?? 3);
      const cooldownMs = Math.max(0, cooldownMin) * 60 * 1000;
      const storageKey = `last_online_${sessionId}`;
      const lastOnlineTime = Number(ctx.system.storage.get(storageKey) || 0);
      const now = Date.now();

      if (cooldownMs > 0 && now - lastOnlineTime < cooldownMs) {
        return;
      }
      ctx.system.storage.set(storageKey, String(now));

      const defaultText = isGroup ? "你已进入群聊" : "你已上线";
      const configKey = isGroup ? "groupOnlineText" : "onlineText";
      const text = (ctx.system.settings.get(configKey) || defaultText).trim();
      const mode = ctx.system.settings.get("notifyMode") || "both";

      if (mode === "both" || mode === "toast") {
        ctx.ui.toast(text);
      }

      if (mode === "both" || mode === "message") {
        try {
          await ctx.data.messages.push({
            sessionId,
            role: "system",
            content: `【系统提示】${text}`,
          });
        } catch (err) {
          ctx.system.log("写入系统上线消息失败:", err);
        }
      }
    });
  },
};