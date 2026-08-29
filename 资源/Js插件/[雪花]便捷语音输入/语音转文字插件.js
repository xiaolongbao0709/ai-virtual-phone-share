export default {
  manifest: {
    id: "universal-voice-input-pro",
    name: "通用语音转文字 (ASR Pro)",
    apiVersion: 1,
    version: "1.2.0",
    author: "小坊",
    description: "多厂商通用语音输入。精准绑定聊天室输入框长按（绝不误触设置页），支持 SiliconFlow、Groq、OpenAI 及中转，内置模型拉取与诊断。",
    permissions: ["chat.read"],
    settings: [
      {
        key: "presetProvider",
        label: "服务商预设",
        type: "select",
        default: "siliconflow",
        options: [
          { value: "siliconflow", label: "SiliconFlow 硅基流动 (国内推荐·免翻)" },
          { value: "groq", label: "Groq Whisper (海外直连·极速)" },
          { value: "openai", label: "OpenAI 官方 (whisper-1)" },
          { value: "custom", label: "自定义 / 第三方免翻中转站" },
        ],
      },
      {
        key: "apiKey",
        label: "API Key (密钥)",
        type: "text",
        default: "",
      },
      {
        key: "apiBase",
        label: "API Base URL (随预设自动填入)",
        type: "text",
        default: "https://api.siliconflow.cn/v1",
      },
      {
        key: "modelName",
        label: "ASR 语音模型",
        type: "text",
        default: "FunAudioLLM/SenseVoiceSmall",
      },
      {
        key: "language",
        label: "识别语言",
        type: "select",
        default: "zh",
        options: [
          { value: "zh", label: "中文 (含方言/中英混合)" },
          { value: "auto", label: "自动识别 (中/英/日/粤/韩等)" },
          { value: "en", label: "英语" },
          { value: "ja", label: "日语" },
          { value: "yue", label: "粤语" },
        ],
      },
      {
        key: "showFab",
        label: "开启聊天室深灰悬浮麦克风",
        type: "boolean",
        default: false,
      },
      {
        key: "autoSend",
        label: "转写后直接发送消息给角色",
        type: "boolean",
        default: false,
      },
    ],
  },

  setup(ctx) {
    let currentSessionId = null;
    let isInsideChat = false;
    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;
    let recordStartTime = 0;
    let activeInputEl = null;

    const PROVIDER_CONFIGS = {
      siliconflow: {
        base: "https://api.siliconflow.cn/v1",
        model: "FunAudioLLM/SenseVoiceSmall",
      },
      groq: {
        base: "https://api.groq.com/openai/v1",
        model: "whisper-large-v3-turbo",
      },
      openai: {
        base: "https://api.openai.com/v1",
        model: "whisper-1",
      },
    };

    ctx.hooks.on("session.opened", (p) => {
      if (p && p.sessionId) {
        currentSessionId = p.sessionId;
        isInsideChat = true;
        updateUI();
      }
    });

    const applyProviderPreset = (providerKey) => {
      const cfg = PROVIDER_CONFIGS[providerKey];
      if (!cfg) return;

      ctx.system.settings.set("presetProvider", providerKey);
      ctx.system.settings.set("apiBase", cfg.base);
      ctx.system.settings.set("modelName", cfg.model);

      const allInputs = document.querySelectorAll("input[type='text'], input:not([type])");
      allInputs.forEach((input) => {
        const rowText = input.closest("div, label, tr")?.textContent || "";
        if (rowText.includes("Base URL") || rowText.includes("API Base")) {
          input.value = cfg.base;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (rowText.includes("语音模型") || rowText.includes("模型名称")) {
          input.value = cfg.model;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
    };

    ctx.system.settings.onChange((key, val) => {
      if (key === "presetProvider") {
        applyProviderPreset(val);
      }
    });

    const bindSelectWatcher = () => {
      const selects = document.querySelectorAll("select");
      selects.forEach((sel) => {
        if (sel.__xf_bound) return;
        const txt = sel.closest("div, label, tr")?.textContent || "";
        if (txt.includes("服务商预设")) {
          sel.__xf_bound = true;
          sel.addEventListener("change", (e) => {
            applyProviderPreset(e.target.value);
          });
        }
      });
    };
    const selectTimer = ctx.system.timers.setInterval(bindSelectWatcher, 800);

    // 录音视觉反馈样式
    ctx.ui.injectCSS(`
      .xf-pro-pressing {
        outline: 2px solid rgba(160, 160, 175, 0.7) !important;
        background: rgba(125, 125, 125, 0.08) !important;
      }
      .xf-pro-recording {
        outline: 2px solid #ef4444 !important;
        box-shadow: 0 0 12px rgba(239, 68, 68, 0.6) !important;
      }
      .xf-pro-capsule {
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%) translateY(-10px);
        background: rgba(24, 24, 28, 0.92);
        color: #f4f4f5;
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        padding: 9px 18px;
        border-radius: 9999px;
        display: none;
        align-items: center;
        gap: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
        z-index: 100000;
        font-size: 13px;
        font-weight: 500;
        opacity: 0;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
        pointer-events: none;
      }
      .xf-pro-capsule.active {
        display: flex;
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      .xf-pro-wave {
        display: flex;
        align-items: center;
        gap: 3px;
        height: 14px;
      }
      .xf-pro-wave span {
        width: 3px;
        height: 100%;
        background: #ef4444;
        border-radius: 3px;
        animation: xf-pro-wave-anim 0.8s infinite ease-in-out;
      }
      .xf-pro-wave span:nth-child(2) { animation-delay: 0.15s; height: 70%; }
      .xf-pro-wave span:nth-child(3) { animation-delay: 0.3s; height: 100%; }
      @keyframes xf-pro-wave-anim {
        0%, 100% { transform: scaleY(0.3); }
        50% { transform: scaleY(1); }
      }
      .xf-pro-fab-wrap {
        position: fixed;
        right: 16px;
        bottom: 80px;
        display: none;
        z-index: 9999;
        user-select: none;
      }
      .xf-pro-fab-mic {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: rgba(30, 32, 38, 0.78);
        color: #e4e4e7;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        transition: transform 0.15s ease, background-color 0.2s ease;
      }
      .xf-pro-fab-mic:active { transform: scale(0.92); }
      .xf-pro-fab-mic.is-rec {
        background: rgba(220, 38, 38, 0.85) !important;
        border-color: rgba(239, 68, 68, 0.6) !important;
        color: #ffffff !important;
      }
    `);

    // 录音胶囊 DOM
    const capsuleEl = document.createElement("div");
    capsuleEl.className = "xf-pro-capsule";
    capsuleEl.innerHTML = `
      <div class="xf-pro-wave"><span></span><span></span><span></span></div>
      <span>🎤 正在录音 · 松手完成转写</span>
    `;
    document.body.appendChild(capsuleEl);

    // 悬浮球 DOM
    let fabWrap = document.createElement("div");
    fabWrap.className = "xf-pro-fab-wrap";
    fabWrap.innerHTML = `
      <div class="xf-pro-fab-mic" id="xf-fab-mic-btn" title="点击开始/停止录音">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
          <line x1="12" y1="19" y2="22"></line>
        </svg>
      </div>
    `;

    fabWrap.querySelector("#xf-fab-mic-btn").onclick = (e) => {
      e.stopPropagation();
      if (!isRecording) {
        startRecording("float");
      } else {
        stopRecording();
      }
    };

    document.body.appendChild(fabWrap);

    const updateUI = () => {
      const showFab = ctx.system.settings.get("showFab") === true;
      const chatTextarea = document.querySelector(".chat-input-textarea");
      if (!showFab || !chatTextarea) {
        fabWrap.style.display = "none";
        return;
      }
      fabWrap.style.display = "flex";
    };

    const uiCheckTimer = ctx.system.timers.setInterval(updateUI, 600);

    const getCleanKey = () => {
      let raw = (ctx.system.settings.get("apiKey") || "").trim();
      return raw.replace(/^Bearer\s+/i, "").replace(/[\r\n\t\s"']/g, "").trim();
    };

    const getBaseUrl = () => {
      let b = (ctx.system.settings.get("apiBase") || "").trim();
      if (!b) {
        const p = ctx.system.settings.get("presetProvider") || "siliconflow";
        return PROVIDER_CONFIGS[p]?.base || "https://api.siliconflow.cn/v1";
      }
      return b.replace(/\/+$/, "");
    };

    // 诊断与拉取面板
    ctx.ui.slot("settings.section", (container) => {
      container.style.cssText = "margin-top:14px;padding:14px;background:rgba(125,125,125,0.08);border-radius:12px;border:1px solid rgba(125,125,125,0.15);";
      container.innerHTML = `
        <div style="font-size:13px;font-weight:600;margin-bottom:4px;">
          <span>🔍 ASR 模型拉取与连通性诊断</span>
        </div>
        <div style="font-size:12px;opacity:0.75;margin-bottom:10px;">
          填入上方 Key 后点此测试，可自动校验 Key 有效性并筛选可用语音模型：
        </div>
        <button id="xf-diag-btn" style="width:100%;padding:9px;border-radius:6px;background:#2563eb;color:#fff;border:none;font-size:12px;font-weight:500;cursor:pointer;">
          拉取远程模型并测试连通性
        </button>
        <div id="xf-diag-box" style="margin-top:10px;display:none;padding:10px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-all;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);"></div>
      `;

      const btn = container.querySelector("#xf-diag-btn");
      const resBox = container.querySelector("#xf-diag-box");

      btn.onclick = async () => {
        const key = getCleanKey();
        const base = getBaseUrl();
        resBox.style.display = "block";

        if (!key) {
          resBox.innerHTML = `<span style="color:#ef4444;">❌ 请先在上方设置项中填写 API Key</span>`;
          return;
        }

        resBox.innerHTML = `⏳ 正在请求 ${base}/models ...`;

        try {
          const res = await (window.fetch || ctx.system.fetch)(`${base}/models`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${key}`,
            },
          });

          if (!res.ok) {
            const errTxt = await res.text();
            resBox.innerHTML = `<span style="color:#ef4444;">❌ 请求失败 [HTTP ${res.status}]</span>\n${errTxt}\n\n💡 若提示 401：请核对 Key 是否正确；若使用海外服务请检查网络代理。`;
            return;
          }

          const data = await res.json();
          const list = data.data || [];

          const audioModels = list.filter((m) => {
            const id = (m.id || "").toLowerCase();
            return id.includes("voice") || id.includes("audio") || id.includes("sense") || id.includes("whisper") || id.includes("funaudio") || id.includes("speech");
          });

          let out = `<span style="color:#10b981;">✅ Key 校验通过！共获取到 ${list.length} 个可用模型</span>\n`;

          if (audioModels.length > 0) {
            out += `\n🎧 <b>检测到 ASR 模型 (点击即可自动选用)：</b>\n`;
            audioModels.forEach((m) => {
              out += `<div class="xf-pick-item" data-id="${m.id}" style="padding:6px 8px;margin:5px 0;background:rgba(255,255,255,0.08);border-radius:6px;cursor:pointer;color:#60a5fa;display:flex;justify-content:space-between;align-items:center;">
                <span>${m.id}</span>
                <span style="color:#a1a1aa;font-size:11px;">点击选用</span>
              </div>`;
            });
          } else {
            out += `\n💡 接口已连通，可直接使用默认推荐的模型名。\n`;
          }

          resBox.innerHTML = out;

          resBox.querySelectorAll(".xf-pick-item").forEach((item) => {
            item.onclick = () => {
              const modelId = item.getAttribute("data-id");
              ctx.system.settings.set("modelName", modelId);

              const allInputs = document.querySelectorAll("input[type='text'], input:not([type])");
              allInputs.forEach((input) => {
                const label = input.closest("div, label, tr")?.textContent || "";
                if (label.includes("语音模型") || label.includes("模型名称")) {
                  input.value = modelId;
                  input.dispatchEvent(new Event("input", { bubbles: true }));
                }
              });

              ctx.ui.toast(`已选用模型: ${modelId}`);
            };
          });
        } catch (e) {
          resBox.innerHTML = `<span style="color:#ef4444;">❌ 网络异常：</span>\n${e.message || e}`;
        }
      };
    });

    // ==================== 核心：精准识别聊天输入框 ====================
    const isChatRoomInput = (el) => {
      if (!el) return false;

      // 绝不拦截下拉框、按钮、选择项、密码框
      if (["SELECT", "OPTION", "BUTTON"].includes(el.tagName)) return false;
      if (el.type === "checkbox" || el.type === "radio" || el.type === "password") return false;

      // 绝不拦截插件管理、弹窗、设置页内部的 input
      if (el.closest(".settings-container, .modal, [role='dialog'], .xf-pro-capsule, .plugin-settings, form")) {
        return false;
      }

      // 1. 优先认准原生聊天室输入框类名
      if (el.classList?.contains("chat-input-textarea")) return true;

      // 2. 属于聊天室底部输入栏 .chat-input-bar
      if (el.closest(".chat-input-bar, .chat-room-main-pane") && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
        return true;
      }

      return false;
    };

    let pressTimer = null;
    let triggerMode = "hold";

    const handleStart = (e) => {
      const target = e.target;
      if (!isChatRoomInput(target)) return;

      activeInputEl = target;
      activeInputEl.classList.add("xf-pro-pressing");

      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        if (activeInputEl) {
          activeInputEl.classList.remove("xf-pro-pressing");
          activeInputEl.classList.add("xf-pro-recording");
        }
        if (navigator.vibrate) navigator.vibrate(40);
        startRecording("hold");
      }, 350);
    };

    const handleEnd = () => {
      clearTimeout(pressTimer);
      if (activeInputEl) {
        activeInputEl.classList.remove("xf-pro-pressing");
        activeInputEl.classList.remove("xf-pro-recording");
      }
      if (isRecording && triggerMode === "hold") {
        stopRecording();
      }
    };

    document.addEventListener("pointerdown", handleStart, { capture: true, passive: true });
    document.addEventListener("pointerup", handleEnd, { capture: true, passive: true });
    document.addEventListener("pointercancel", handleEnd, { capture: true, passive: true });

    // 录音流程
    const startRecording = async (mode = "hold") => {
      if (isRecording) return;
      triggerMode = mode;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];

        const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/wav"].find((t) => MediaRecorder.isTypeSupported(t)) || "";
        mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const duration = Date.now() - recordStartTime;
          if (duration < 400) {
            ctx.ui.toast("说话时间太短");
            return;
          }
          const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
          await doUniversalTranscription(blob);
        };

        mediaRecorder.start(100);
        isRecording = true;
        recordStartTime = Date.now();

        const micBtn = fabWrap.querySelector("#xf-fab-mic-btn");
        if (micBtn) micBtn.classList.add("is-rec");

        capsuleEl.classList.add("active");
      } catch (err) {
        ctx.system.log("麦克风启动失败", err);
        ctx.ui.toast("无法开启麦克风，请检查权限");
        isRecording = false;
        capsuleEl.classList.remove("active");
      }
    };

    const stopRecording = () => {
      if (!isRecording) return;
      isRecording = false;
      capsuleEl.classList.remove("active");

      const micBtn = fabWrap.querySelector("#xf-fab-mic-btn");
      if (micBtn) micBtn.classList.remove("is-rec");

      if (activeInputEl) {
        activeInputEl.classList.remove("xf-pro-pressing");
        activeInputEl.classList.remove("xf-pro-recording");
      }
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };

    // ASR 转写提交
    async function doUniversalTranscription(blob) {
      const key = getCleanKey();
      const base = getBaseUrl();
      const model = (ctx.system.settings.get("modelName") || "FunAudioLLM/SenseVoiceSmall").trim();
      const language = ctx.system.settings.get("language") || "zh";
      const autoSend = ctx.system.settings.get("autoSend") === true;

      if (!key && !base.startsWith("/")) {
        ctx.ui.toast("请在插件设置中填写 API Key！");
        return;
      }

      const toast = ctx.ui.toast(`⚡ 正在转写 (${model})…`, { durationMs: 0 });

      try {
        const formData = new FormData();
        const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("wav") ? "wav" : "webm";
        formData.append("file", new File([blob], `audio.${ext}`, { type: blob.type || "audio/webm" }));
        formData.append("model", model);
        if (language !== "auto") formData.append("language", language);

        const headers = {};
        if (key) {
          headers["Authorization"] = `Bearer ${key}`;
        }

        const res = await (window.fetch || ctx.system.fetch)(`${base}/audio/transcriptions`, {
          method: "POST",
          headers,
          body: formData,
        });

        if (!res.ok) {
          const detail = await res.text();
          throw new Error(`[HTTP ${res.status}] ${detail}`);
        }

        const data = await res.json();
        const text = (data.text || data.result || (typeof data === "string" ? data : "")).trim();

        if (!text) {
          ctx.ui.toast("未识别到清晰语音");
          return;
        }

        if (autoSend && currentSessionId) {
          ctx.data.messages.push({
            sessionId: currentSessionId,
            role: "user",
            content: text,
          });
          ctx.ui.toast("已发送");
        } else {
          // 优先填入当前激活的聊天输入框，或者根据 .chat-input-textarea 自动定位
          const target = activeInputEl || document.querySelector(".chat-input-textarea, textarea");
          if (target) {
            if (target.isContentEditable) {
              target.innerText = (target.innerText ? target.innerText + " " : "") + text;
            } else {
              target.value = (target.value ? target.value + " " : "") + text;
            }
            target.dispatchEvent(new Event("input", { bubbles: true }));
            target.focus();
            ctx.ui.toast("已填入输入框");
          } else {
            await navigator.clipboard.writeText(text);
            ctx.ui.toast(`已转写：${text}`);
          }
        }
      } catch (err) {
        ctx.system.log("ASR 转写失败", err);
        ctx.ui.toast(`转写失败: ${err.message || err}`);
      } finally {
        toast.close();
      }
    }

    return () => {
      clearInterval(selectTimer);
      clearInterval(uiCheckTimer);
      document.removeEventListener("pointerdown", handleStart, { capture: true });
      document.removeEventListener("pointerup", handleEnd, { capture: true });
      document.removeEventListener("pointercancel", handleEnd, { capture: true });
      if (capsuleEl && capsuleEl.parentElement) capsuleEl.parentElement.removeChild(capsuleEl);
      if (fabWrap && fabWrap.parentElement) fabWrap.parentElement.removeChild(fabWrap);
      if (isRecording) stopRecording();
    };
  },
};