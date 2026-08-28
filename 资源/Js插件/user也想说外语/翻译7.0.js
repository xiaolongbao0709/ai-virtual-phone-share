// 临时缓存，用于在消息落库前暂存用户输入的原始中文
const pendingTranslations = new Map();

export default {
  manifest: {
    id: "bubble-click-translator",
    name: "气泡直点翻译 (仅我方外译版)",
    apiVersion: 1,
    version: "2.7.0",
    author: "小坊",
    description: "仅翻译我方发送的中文为外文，并在我方气泡下提供原文对照。完全不翻译对方（char）发来的消息。",
    permissions: ["chat.read", "ai"],
    settings: [
      {
        key: "autoTranslateInput",
        label: "自动翻译我的中文输入",
        type: "boolean",
        default: true
      },
      {
        key: "transStyle",
        label: "AI 翻译风格 (仅AI引擎有效)",
        type: "select",
        default: "literary",
        options: [
          { value: "literary", label: "文艺优雅 (信雅达、细腻有温度、充满故事感)" },
          { value: "colloquial", label: "自然口语 (通顺、接地气、日常聊天)" }
        ]
      },
      {
        key: "outgoingEngine",
        label: "我发送的翻译引擎 (推荐谷歌，实现0延迟发送)",
        type: "select",
        default: "google",
        options: [
          { value: "google", label: "谷歌翻译 (极速推荐)" },
          { value: "llm", label: "AI 翻译 (消耗 Key)" }
        ]
      }
    ],
  },
  setup(ctx) {
    // 1. 注入样式
    ctx.ui.injectCSS(`
      /* 气泡点击手势 */
      .plugin-trans-enabled-bubble {
        cursor: pointer !important;
        transition: all 0.2s ease !important;
      }
      
      /* 续写翻译样式：默认彻底隐藏 */
      .plugin-trans-append {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed rgba(0, 0, 0, 0.08);
        font-size: 0.92em;
        line-height: 1.6;
        color: inherit;
        opacity: 0.85;
        word-break: break-word;
        text-align: inherit;
        display: none;
        animation: plugin-slide-down 0.25s cubic-bezier(0.1, 1, 0.1, 1) forwards;
      }

      /* ================= 微信绿·微光呼吸演出 ================= */
      @keyframes green-breathing-glow {
        0% { box-shadow: 0 0 0px rgba(7, 193, 96, 0); }
        35% { box-shadow: 0 0 12px rgba(7, 193, 96, 0.5); }
        70% { box-shadow: 0 0 12px rgba(7, 193, 96, 0.5); }
        100% { box-shadow: 0 0 0px rgba(7, 193, 96, 0); }
      }
      
      .plugin-breathing-active {
        animation: green-breathing-glow 2s ease-in-out forwards !important;
      }
      
      @keyframes plugin-slide-down {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 0.85; transform: translateY(0); }
      }

      /* 插件自定义设置面板样式 */
      .plugin-settings-panel {
        margin-top: 20px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        padding-top: 15px;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .plugin-settings-title {
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .plugin-char-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .plugin-char-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(0, 0, 0, 0.02);
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid rgba(0, 0, 0, 0.04);
      }
      .plugin-char-info {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .plugin-char-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        background: #ddd;
      }
      .plugin-char-name {
        font-size: 13px;
        font-weight: 600;
        color: #222;
      }
      .plugin-char-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .plugin-char-checkbox-label {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #555;
        cursor: pointer;
      }
      .plugin-char-checkbox-label input {
        accent-color: #07c160;
        cursor: pointer;
      }
      .plugin-char-select {
        border: 1px solid rgba(0, 0, 0, 0.15) !important;
        border-radius: 4px !important;
        padding: 2px 6px !important;
        font-size: 11px !important;
        background: #fff !important;
        color: #333 !important;
        cursor: pointer !important;
        outline: none !important;
      }
      .plugin-char-custom-input {
        border: 1px solid rgba(0, 0, 0, 0.15) !important;
        border-radius: 4px !important;
        padding: 2px 6px !important;
        font-size: 11px !important;
        width: 70px !important;
        background: #fff !important;
        color: #333 !important;
        outline: none !important;
      }
    `);

    // 2. 辅助解析器
    function getCharacterIdForSession(sessionId) {
      if (!sessionId) return null;
      const session = ctx.data.sessions.get(sessionId);
      if (session && !session.isGroup) {
        return session.contactId;
      }
      return null;
    }

    // 3. 翻译核心工具（外译）
    async function translateToForeign(text, targetLang) {
      const outgoingEngine = ctx.system.settings.get("outgoingEngine") || "google";

      if (outgoingEngine === "google") {
        try {
          let slang = "en";
          if (targetLang.includes("日")) slang = "ja";
          else if (targetLang.includes("韩")) slang = "ko";
          else if (targetLang.includes("法")) slang = "fr";
          else if (targetLang.includes("德")) slang = "de";
          else if (targetLang.includes("西")) slang = "es";
          else if (targetLang.includes("俄")) slang = "ru";

          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=${slang}&dt=t&q=${encodeURIComponent(text)}`;
          const res = await ctx.system.fetch(url);
          const json = await res.json();
          return json[0].map(item => item[0]).join("");
        } catch (err) {
          ctx.system.log("谷歌外译失败，降级到 AI 意译:", err);
        }
      }

      try {
        const prompt = `将以下中文聊天口语翻译为地道${targetLang}。直接输出结果，无拼音或解释：\n\n${text}`;
        const res = await ctx.ai.chat({
          prompt,
          temperature: 0.3,
          maxTokens: 150
        });
        return res.trim();
      } catch (err) {
        ctx.system.log("AI 外译失败:", err);
        throw err;
      }
    }

    // 4. 集中式角色配置面板 (settings.section)
    ctx.ui.slot("settings.section", (el) => {
      const characters = ctx.data.characters.list() || [];
      
      const panel = document.createElement("div");
      panel.className = "plugin-settings-panel";

      const title = document.createElement("div");
      title.className = "plugin-settings-title";
      title.innerHTML = "<span>👤 角色专属翻译配置</span>";
      panel.appendChild(title);

      if (characters.length === 0) {
        const emptyTip = document.createElement("div");
        emptyTip.style.cssText = "font-size:12px; color:#888; text-align:center; padding:10px;";
        emptyTip.textContent = "未检测到角色卡，请先在手机桌面创建或导入角色卡。";
        panel.appendChild(emptyTip);
        el.appendChild(panel);
        return;
      }

      const listContainer = document.createElement("div");
      listContainer.className = "plugin-char-list";

      characters.forEach(char => {
        const isEnabled = ctx.system.storage.get(`char_enabled_${char.id}`) !== false;
        const currentLang = ctx.system.storage.get(`char_lang_${char.id}`) || "英语";

        const row = document.createElement("div");
        row.className = "plugin-char-row";

        const info = document.createElement("div");
        info.className = "plugin-char-info";

        const avatar = document.createElement("img");
        avatar.className = "plugin-char-avatar";
        avatar.src = char.avatar || "";
        avatar.onerror = () => { avatar.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='30' height='30' viewBox='0 0 30 30'><rect width='30' height='30' fill='%23ccc'/></svg>"; };

        const name = document.createElement("span");
        name.className = "plugin-char-name";
        name.textContent = char.name || "未知角色";

        info.appendChild(avatar);
        info.appendChild(name);
        row.appendChild(info);

        const actions = document.createElement("div");
        actions.className = "plugin-char-actions";

        const switchLabel = document.createElement("label");
        switchLabel.className = "plugin-char-checkbox-label";
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = isEnabled;
        
        const switchText = document.createElement("span");
        switchText.textContent = "翻译";

        switchLabel.appendChild(checkbox);
        switchLabel.appendChild(switchText);
        actions.appendChild(switchLabel);

        const select = document.createElement("select");
        select.className = "plugin-char-select";
        select.style.display = isEnabled ? "inline-block" : "none";

        const languages = ["英语", "日语", "韩语", "法语", "德语", "西班牙语", "俄语", "自定义"];
        let isCustom = !languages.includes(currentLang);

        languages.forEach(lang => {
          const opt = document.createElement("option");
          opt.value = lang;
          opt.textContent = lang;
          if (lang === currentLang || (lang === "自定义" && isCustom)) {
            opt.selected = true;
          }
          select.appendChild(opt);
        });
        actions.appendChild(select);

        const customInput = document.createElement("input");
        customInput.type = "text";
        customInput.className = "plugin-char-custom-input";
        customInput.placeholder = "语言名称";
        customInput.value = isCustom ? currentLang : "";
        customInput.style.display = (isEnabled && isCustom) ? "inline-block" : "none";
        actions.appendChild(customInput);

        checkbox.onchange = () => {
          const active = checkbox.checked;
          ctx.system.storage.set(`char_enabled_${char.id}`, active);
          select.style.display = active ? "inline-block" : "none";
          customInput.style.display = (active && select.value === "自定义") ? "inline-block" : "none";
        };

        select.onchange = () => {
          if (select.value === "自定义") {
            customInput.style.display = "inline-block";
            customInput.focus();
            if (customInput.value.trim()) {
              ctx.system.storage.set(`char_lang_${char.id}`, customInput.value.trim());
            }
          } else {
            customInput.style.display = "none";
            ctx.system.storage.set(`char_lang_${char.id}`, select.value);
          }
        };

        customInput.oninput = () => {
          const val = customInput.value.trim();
          if (val) {
            ctx.system.storage.set(`char_lang_${char.id}`, val);
          }
        };

        row.appendChild(actions);
        listContainer.appendChild(row);
      });

      panel.appendChild(listContainer);
      el.appendChild(panel);

      return () => {
        if (el.contains(panel)) el.removeChild(panel);
      };
    });

    // 5. 发送拦截极速外译
    ctx.hooks.transform("user.beforeSend", async (p) => {
      const charId = getCharacterIdForSession(p.sessionId);
      if (!charId) return p;

      const isEnabled = ctx.system.storage.get(`char_enabled_${charId}`) !== false;
      if (!isEnabled) return p;

      const autoTranslate = ctx.system.settings.get("autoTranslateInput") !== false;
      const outgoingLang = ctx.system.storage.get(`char_lang_${charId}`) || "英语";
      const hasChinese = /[\u4e00-\u9fa5]/.test(p.text);

      if (autoTranslate && hasChinese) {
        const originalChinese = p.text;
        try {
          const translatedText = await translateToForeign(originalChinese, outgoingLang);
          pendingTranslations.set(translatedText, originalChinese);
          p.text = translatedText;
        } catch (err) {
          ctx.system.log("外译失败，直接发送");
        }
      }
      return p;
    });

    // 6. 消息落库绑定
    ctx.hooks.on("message.persisted", (payload) => {
      const msg = payload.message;
      if (msg && msg.role === "user") {
        const matchedOriginal = pendingTranslations.get(msg.content);
        if (matchedOriginal) {
          const cacheKey = `trans_obj_${msg.id}`;
          ctx.system.storage.set(cacheKey, {
            original: msg.content,
            translation: matchedOriginal
          });
          pendingTranslations.delete(msg.content);
        }
      }
    });

    // 7. 渲染与触控点击 (已修改：完全跳过 char 消息的渲染与点击)
    ctx.ui.slot("message.footer", (el, props) => {
      const msg = props.message;
      
      // 🚨 关键改动：只对我方用户(user)发送的消息生效，系统消息和角色消息(assistant)直接拦截跳过
      if (!msg || !msg.content || msg.role !== "user") return;

      const charId = getCharacterIdForSession(props.sessionId);
      if (!charId) return;

      const isEnabled = ctx.system.storage.get(`char_enabled_${charId}`) !== false;
      if (!isEnabled) return; // 未开启翻译的角色跳过

      const msgId = msg.id;
      const cacheKey = `trans_obj_${msgId}`;
      const stateKey = `expanded_${msgId}`;

      const bubbleEl = el.closest('[class*="bubble"]') || 
                       el.closest('[class*="message-content"]') || 
                       el.closest('.message-bubble') || 
                       el.parentElement;

      // 7.1. 发送时的微光绿色呼吸演出
      const isNewUserMessage = msg.role === "user" && (Date.now() - msg.createdAt < 2200);
      if (isNewUserMessage && bubbleEl) {
        bubbleEl.classList.add("plugin-breathing-active");
        ctx.system.timers.setTimeout(() => {
          if (bubbleEl) bubbleEl.classList.remove("plugin-breathing-active");
        }, 2000);
      }

      if (bubbleEl) {
        bubbleEl.classList.add("plugin-trans-enabled-bubble");
      }

      const transDiv = document.createElement("div");
      transDiv.className = "plugin-trans-append";
      el.appendChild(transDiv);

      const getValidCache = () => {
        const cached = ctx.system.storage.get(cacheKey);
        if (cached) {
          if (cached.original === msg.content) {
            return cached.translation;
          } else {
            ctx.system.storage.remove(cacheKey);
            ctx.system.storage.remove(stateKey);
          }
        }
        return null;
      };

      const updateUI = () => {
        const validTranslation = getValidCache();
        const isExpanded = ctx.system.storage.get(stateKey) === true;

        if (validTranslation && isExpanded) {
          transDiv.textContent = validTranslation;
          transDiv.style.display = "block";
        } else {
          transDiv.style.display = "none";
        }
      };

      let isTranslating = false;
      const handleBubbleClick = async (e) => {
        if (e.target.tagName === "A" || window.getSelection().toString() !== "") return;

        e.preventDefault();
        e.stopPropagation();

        if (isTranslating) return;

        const validTranslation = getValidCache();
        const isExpanded = ctx.system.storage.get(stateKey) === true;

        if (validTranslation) {
          ctx.system.storage.set(stateKey, !isExpanded);
          updateUI();
        }
      };

      if (bubbleEl) {
        bubbleEl.addEventListener("click", handleBubbleClick);
      }

      updateUI();

      return () => {
        if (bubbleEl) {
          bubbleEl.removeEventListener("click", handleBubbleClick);
          bubbleEl.classList.remove("plugin-trans-enabled-bubble");
          bubbleEl.classList.remove("plugin-breathing-active");
        }
        if (el.contains(transDiv)) {
          el.removeChild(transDiv);
        }
      };
    });
  }
};