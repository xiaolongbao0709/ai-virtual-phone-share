export default {
  manifest: {
    id: "salfisher-custom-input",
    name: "简约风输入栏插件",
    author: "DeepSeek & Claude",
    apiVersion: 1,
    version: "1.7.0",
    description: "简约风的聊天室输入栏美化（Sal版），支持自定义文案、颜色、头像、占位提示，并能精确选择生效的聊天室。",
    permissions: ["ui", "storage"],
    settings: [
      { key: "enabled", label: "启用输入栏美化", type: "boolean", default: true },
      { key: "nickname", label: "昵称", type: "text", default: "User" },
      { key: "signature", label: "文案", type: "text", default: "插件内点击自定义文案" },
      { key: "avatarSize", label: "头像大小(px)", type: "number", default: 37.5 },
      { key: "titleColor", label: "昵称与小球的颜色(如#333333)", type: "text", default: "#333333" },
      { key: "descColor", label: "个性签名颜色(如#888888)", type: "text", default: "#888888" },
      { key: "placeholderText", label: "输入框占位提示文字", type: "text", default: "Message…" }
    ]
  },
  setup(ctx) {
    const CONFIG = {
      titleSize: 15,
      descSize: 12,
      circleSize: 30,
      topOffset: 63,
      leftOffset: 27.5,
      rightOffset: 27.5,
      avatarGap: 10,
      circleGap: 8
    };

    const icons = {
      plus: '<svg class="salfisher-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor;"><path d="M16 20.975v-3h-3v-2h3v-3h2v3h3v2h-3v3zM4 18v-2h7.075q-.075.525-.062 1t.087 1zm0-4v-2h9.65q-.575.4-1.037.9T11.8 14zm0-4V8h15v2zm0-4V4h15v2z"/></svg>',
      reply: '<svg class="salfisher-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:22px;height:22px;fill:currentColor;"><path d="M18.175 18H15q-.425 0-.712-.288T14 17t.288-.712T15 16h3.175l-.875-.875q-.275-.3-.288-.712t.288-.713t.7-.3t.7.3l2.6 2.6q.3.3.3.7t-.3.7l-2.6 2.6q-.3.3-.7.3t-.7-.3t-.288-.712t.288-.713zM6 18l-2.15 2.15q-.25.25-.55.125T3 19.8V6q0-.825.588-1.412T5 4h12q.825 0 1.413.588T19 6v4q0 .425-.288.713T18 11t-.712-.288T17 10V6H5v10h6q.425 0 .713.288T12 17t-.288.713T11 18zm2-8h6q.425 0 .713-.288T15 9t-.288-.712T14 8H8q-.425 0-.712.288T7 9t.288.713T8 10m0 4h3q.425 0 .713-.288T12 13t-.288-.712T11 12H8q-.425 0-.712.288T7 13t.288.713T8 14m-3 2V6z"/></svg>',
      emoji: '<svg class="salfisher-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;"><path d="M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2q1.075 0 2.075.213T16 2.825v2.25q-.875-.5-1.888-.788T12 4Q8.675 4 6.337 6.338T4 12t2.338 5.663T12 20t5.663-2.337T20 12q0-.8-.162-1.55T19.4 9h2.15q.225.725.338 1.463T22 12q0 2.075-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m8-15V5h-2V3h2V1h2v2h2v2h-2v2zm-4.5 4q.625 0 1.063-.437T17 9.5t-.437-1.062T15.5 8t-1.062.438T14 9.5t.438 1.063T15.5 11m-7 0q.625 0 1.063-.437T10 9.5t-.437-1.062T8.5 8t-1.062.438T7 9.5t.438 1.063T8.5 11m6.588 5.538Q16.475 15.575 17.1 14H6.9q.625 1.575 2.013 2.538T12 17.5t3.088-.962"/></svg>',
      sticker: '<svg class="salfisher-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26" style="width:18px;height:18px;fill:currentColor;"><g fill="none"><defs><mask id="m1"><path fill="#fff" d="M0 0h26v26H0z"/><g fill="#000" fill-rule="evenodd" clip-rule="evenodd"><path d="M12.455 6.188a4 4 0 0 1 5.79 5.521l-5.349 5.608a2.25 2.25 0 0 1-3.258-3.106l4.485-4.706a.5.5 0 1 1 .724.69L10.362 14.9a1.25 1.25 0 0 0 1.81 1.726l5.349-5.608a3 3 0 1 0-4.342-4.141l-4.831 5.066a.5.5 0 1 1-.724-.69z"/><path d="M7.463 19.391c-.439-.419-.824-1.056-1.145-1.758c-.71-1.552-.17-3.383 1.097-4.712L11.8 8.325a.5.5 0 0 0-.724-.69l-4.383 4.596c-1.455 1.526-2.214 3.783-1.284 5.818c.342.747.791 1.518 1.365 2.066c.566.54 1.342.947 2.094 1.251c2.095.849 4.337-.039 5.791-1.593l5.692-6.081a.5.5 0 1 0-.73-.684l-5.692 6.082c-1.267 1.354-3.089 1.996-4.686 1.35c-.704-.286-1.346-.636-1.779-1.049"/></g></mask></defs><circle cx="13" cy="13" r="13" fill="currentColor" mask="url(#m1)"/></g></svg>',
      offline: '<svg class="salfisher-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;"><path d="M12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2q1.9 0 3.6.663T18.625 4.5t2.2 2.775t1.1 3.475q-.5-.275-1.05-.45t-1.125-.25q-.475-1.875-1.713-3.3T15 4.6V5q0 .825-.587 1.413T13 7h-2v2q0 .425-.288.713T10 10H8v2h6.5q-.725.8-1.112 1.8T13 15.9q0 1.95.775 3.025t2 2.35q-.9.35-1.85.538T12 22m-1-2.05V18q-.825 0-1.412-.587T9 16v-1l-4.8-4.8q-.075.45-.137.9T4 12q0 3.025 1.988 5.3T11 19.95m9.063-2.887q.437-.438.437-1.063t-.425-1.062t-1.05-.438q-.65 0-1.088.438T17.5 16t.438 1.063T19 17.5t1.063-.437M19 22q-.075 0-.4-.275l-.1-.175q-.55-.95-1.388-1.687T15.676 18.2q-.35-.5-.513-1.088T15 15.9q0-1.65 1.175-2.775T19 12t2.825 1.125T23 15.9q0 .625-.162 1.213t-.513 1.087q-.6.925-1.437 1.663T19.5 21.55l-.1.175q-.05.125-.162.2T19 22"/></svg>'
    };

    const TARGET_KEY = "salfisher_targets";
    const AVATAR_KEY = "salfisher_avatar";

    const getTargets = () => {
      const v = ctx.system.storage.get(TARGET_KEY);
      return Array.isArray(v) ? v : [];
    };

    const isSessionActive = (sessionId) => {
      if (ctx.system.settings.get("enabled") === false) return false;
      if (!sessionId) return false;
      return getTargets().some(id => String(id) === String(sessionId));
    };

    let lastRoomState = {};

    function scanAndRender() {
      const layers = document.querySelectorAll('.chat-room-layer');

      layers.forEach(layer => {
        const wrapper = layer.querySelector('.chat-room-wrapper');
        if (!wrapper) return;

        const mm = String(wrapper.className).match(/\bsession-([^\s]+)\b/);
        const sessionId = mm ? mm[1] : null;
        const isActive = isSessionActive(sessionId);

        if (!isActive) {
          layer.removeAttribute('data-salfisher-layer');
          const oldBar = wrapper.querySelector('.salfisher-top-bar');
          if (oldBar) oldBar.remove();
          wrapper.querySelectorAll('.chat-input-actions button[data-salfisher-icon="1"]').forEach(btn => {
            const newSvg = btn.querySelector('.salfisher-icon');
            if (newSvg) newSvg.remove();
            btn.removeAttribute('data-salfisher-icon');
            delete btn.dataset.replacedPlus;
            delete btn.dataset.replacedReply;
          });
          return;
        }

        layer.setAttribute('data-salfisher-layer', '1');

        const textarea = wrapper.querySelector('.chat-input-textarea');
        if (textarea) {
          const ph = ctx.system.settings.get('placeholderText') || 'Message…';
          if (textarea.getAttribute('placeholder') !== ph) {
            textarea.setAttribute('placeholder', ph);
          }
        }

        const actions = wrapper.querySelector('.chat-input-actions');
        if (actions) {
          const plusBtn = actions.querySelector('button:has(svg line[x1="12"][y1="8"]), button[data-salfisher-icon="1"]');
          if (plusBtn && !plusBtn.dataset.replacedPlus) {
            plusBtn.setAttribute('data-salfisher-icon', '1');
            plusBtn.insertAdjacentHTML('beforeend', icons.plus);
            plusBtn.dataset.replacedPlus = 'true';
          }
          const replyBtn = actions.querySelector('button[title*="触发 AI 主动回复"], button[title*="发送输入框内容"]');
          if (replyBtn && !replyBtn.dataset.replacedReply) {
            replyBtn.setAttribute('data-salfisher-icon', '1');
            replyBtn.insertAdjacentHTML('beforeend', icons.reply);
            replyBtn.dataset.replacedReply = 'true';
          }
        }

        const nickname = ctx.system.settings.get('nickname') || 'User';
        const signature = ctx.system.settings.get('signature') || '插件内点击自定义文案';
        const avatarSize = ctx.system.settings.get('avatarSize') || 37.5;
        const titleColor = ctx.system.settings.get('titleColor') || '#333333';
        const descColor = ctx.system.settings.get('descColor') || '#888888';
        const avatarSrc = ctx.system.storage.get(AVATAR_KEY) || '';

        const stateKey = `${sessionId}_${nickname}_${signature}_${avatarSize}_${titleColor}_${descColor}_${avatarSrc}`;

        let topBar = wrapper.querySelector('.salfisher-top-bar');

        if (topBar && lastRoomState[sessionId] === stateKey) {
          return;
        }

        if (!topBar) {
          topBar = document.createElement('div');
          topBar.className = 'salfisher-top-bar';
          wrapper.appendChild(topBar);
        }

        lastRoomState[sessionId] = stateKey;

        const avatarHtml = avatarSrc
          ? `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;" />`
          : '';

        const uniqueSticker = icons.sticker
          .replace(/id="m1"/g, `id="m1_${sessionId}"`)
          .replace(/url\(#m1\)/g, `url(#m1_${sessionId})`);

        topBar.style.cssText = `position:absolute; left:${CONFIG.leftOffset}px; right:${CONFIG.rightOffset}px; bottom:${CONFIG.topOffset}px; display:flex; justify-content:space-between; align-items:center; z-index:99; pointer-events:none;`;

        topBar.innerHTML = `
          <div style="display:flex; align-items:center; gap:${CONFIG.avatarGap}px; flex:1; overflow:hidden; pointer-events:auto;">
            <div style="width:${avatarSize}px; height:${avatarSize}px; border-radius:50%; background:#e0e0e0; flex-shrink:0; overflow:hidden;">
               ${avatarHtml}
            </div>
            <div style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
               <span style="font-size:${CONFIG.titleSize}px; font-weight:600; color:${titleColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;">${nickname}</span>
               <span style="font-size:${CONFIG.descSize}px; color:${descColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2; margin-top:2px;">${signature}</span>
            </div>
          </div>
          <div style="display:flex; gap:${CONFIG.circleGap}px; align-items:center; flex-shrink:0; pointer-events:auto; color:${titleColor};">
            <button class="salfisher-btn-emoji" style="width:${CONFIG.circleSize}px; height:${CONFIG.circleSize}px; border-radius:50%; background:#f0f0f5; border:none; display:grid; place-items:center; color:inherit; cursor:pointer;">${icons.emoji}</button>
            <button class="salfisher-btn-sticker" style="width:${CONFIG.circleSize}px; height:${CONFIG.circleSize}px; border-radius:50%; background:#f0f0f5; border:none; display:grid; place-items:center; color:inherit; cursor:pointer;">${uniqueSticker}</button>
            <button class="salfisher-btn-offline" style="width:${CONFIG.circleSize}px; height:${CONFIG.circleSize}px; border-radius:50%; background:#f0f0f5; border:none; display:grid; place-items:center; color:inherit; cursor:pointer;">${icons.offline}</button>
          </div>
        `;

        topBar.querySelector('.salfisher-btn-emoji').onclick = () => {
          const btn = wrapper.querySelector('.chat-input-actions button:has(path[d^="M8 14s1.5"])');
          if(btn) btn.click();
        };
        topBar.querySelector('.salfisher-btn-sticker').onclick = () => {
          const btn = wrapper.querySelector('.chat-input-actions button:has(path[d^="M15.5 3H5"])');
          if(btn) btn.click();
        };
        topBar.querySelector('.salfisher-btn-offline').onclick = () => {
          const btn = wrapper.querySelector('button[aria-label="线下模式"]') || wrapper.querySelector('button[aria-label="返回线上模式"]');
          if(btn && !btn.disabled) btn.click();
        };
      });
    }

    let rafId = 0;
    const observer = new MutationObserver(() => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        scanAndRender();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (ctx.system.settings.onChange) {
      ctx.system.settings.onChange(() => {
        lastRoomState = {};
        scanAndRender();
      });
    }

    ctx.ui.slot("settings.section", (host) => {
      const render = () => {
        host.innerHTML = "";
        const box = document.createElement("div");
        box.style.cssText = "margin-top:16px; padding:14px; border-radius:14px; border:1px dashed rgba(128,128,128,.35); background:rgba(128,128,128,.06); display:flex; flex-direction:column; gap:10px; font-family:inherit;";

        const selected = getTargets();
        const sessions = ctx.data.sessions.list() || [];

        const head = document.createElement("div");
        head.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
        head.innerHTML = `<div style="font-size:14px; font-weight:700; opacity:.9;">📱 输入栏生效范围</div>`;

        const acts = document.createElement("div");
        const bAll = document.createElement("button");
        bAll.textContent = "全选";
        bAll.style.cssText = "background:none;border:none;font-size:12px;opacity:.6;cursor:pointer;margin-right:8px;";
        bAll.onclick = () => { ctx.system.storage.set(TARGET_KEY, sessions.map(x => x.id)); render(); lastRoomState={}; scanAndRender(); };
        const bNone = document.createElement("button");
        bNone.textContent = "清空";
        bNone.style.cssText = "background:none;border:none;font-size:12px;opacity:.6;cursor:pointer;";
        bNone.onclick = () => { ctx.system.storage.set(TARGET_KEY, []); render(); lastRoomState={}; scanAndRender(); };
        acts.appendChild(bAll); acts.appendChild(bNone);
        head.appendChild(acts);
        box.appendChild(head);

        const list = document.createElement("div");
        list.style.cssText = "display:flex; flex-direction:column; gap:6px; max-height:230px; overflow-y:auto;";
        if (!sessions.length) {
          list.innerHTML = `<div style="text-align:center; font-size:12px; opacity:.5; padding:16px 0;">暂无会话</div>`;
        } else {
          sessions.forEach(sess => {
            let name = sess.alias || "";
            let typeLabel = "单聊";
            if (sess.isGroup) { name = sess.groupName || "群聊"; typeLabel = "群聊"; }
            else {
              let ch = null;
              try { ch = ctx.data.characters.get(sess.contactId); } catch (e) {}
              name = name || (ch && ch.name) || ("联系人 " + String(sess.contactId).slice(-4));
            }
            const on = selected.some(id => String(id) === String(sess.id));
            const item = document.createElement("div");
            item.style.cssText = "display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; border:1px solid rgba(128,128,128,.25); background:rgba(128,128,128,.05); cursor:pointer;";

            item.innerHTML = `
              <div style="width:18px;height:18px;border-radius:50%;border:2px solid rgba(128,128,128,.5);display:flex;align-items:center;justify-content:center;font-size:11px; ${on ? 'background:rgba(128,128,128,.45);' : ''}">${on ? '✓' : ''}</div>
              <span style="flex:1; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>
              <span style="font-size:11px;opacity:.55;border:1px solid rgba(128,128,128,.3);border-radius:999px;padding:1px 8px;">${typeLabel}</span>
            `;

            item.onclick = () => {
              const cur = new Set(getTargets().map(id => String(id)));
              if (cur.has(String(sess.id))) cur.delete(String(sess.id));
              else cur.add(String(sess.id));
              ctx.system.storage.set(TARGET_KEY, Array.from(cur));
              render(); lastRoomState={}; scanAndRender();
            };
            list.appendChild(item);
          });
        }
        box.appendChild(list);

        const tip = document.createElement("div");
        tip.style.cssText = "font-size:12px; opacity:.6; line-height:1.7; margin-top:6px;";
        tip.textContent = "默认一个都不勾选：在上面点一下要生效的聊天室即可。新开的聊天室需要回来再勾一次。";
        box.appendChild(tip);

        const avatarBox = document.createElement("div");
        avatarBox.style.cssText = "margin-top:16px; padding-top:16px; border-top:1px dashed rgba(128,128,128,.25);";
        const hasAvatar = !!ctx.system.storage.get(AVATAR_KEY);
        const btnText = hasAvatar ? "✅ 已上传，点击更换头像" : "📁 点击上传头像";

        avatarBox.innerHTML = `
          <label style="display:block; font-size:14px; font-weight:600; margin-bottom:8px;">自定义顶栏头像</label>
          <label for="salfisher-avatar-upload" style="display:block; width:100%; padding:12px; background:rgba(128,128,128,.15); border-radius:8px; font-size:13px; text-align:center; cursor:pointer;">
            ${btnText}
          </label>
          <input type="file" id="salfisher-avatar-upload" accept="image/*" style="display:none;" />
        `;

        avatarBox.querySelector('#salfisher-avatar-upload').onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (re) => {
            ctx.system.storage.set(AVATAR_KEY, re.target.result);
            ctx.ui.toast("头像更新成功！");
            const label = avatarBox.querySelector('label[for="salfisher-avatar-upload"]');
            if(label) label.innerHTML = "✅ 已上传，点击更换头像";
            lastRoomState = {};
            scanAndRender();
          };
          reader.readAsDataURL(file);
        };
        box.appendChild(avatarBox);

        host.appendChild(box);
      };
      render();
    });

    setTimeout(scanAndRender, 500);

    return () => {
      observer.disconnect();
      if(rafId) cancelAnimationFrame(rafId);
      document.querySelectorAll('.chat-room-layer[data-salfisher-layer]').forEach(layer => layer.removeAttribute('data-salfisher-layer'));
      document.querySelectorAll('.chat-room-wrapper').forEach(wrapper => {
        wrapper.querySelectorAll('.salfisher-top-bar').forEach(bar => bar.remove());
        wrapper.querySelectorAll('.chat-input-actions button[data-salfisher-icon="1"]').forEach(btn => {
          btn.querySelectorAll('.salfisher-icon').forEach(svg => svg.remove());
          btn.removeAttribute('data-salfisher-icon');
          delete btn.dataset.replacedPlus;
          delete btn.dataset.replacedReply;
        });
      });
    };
  }
};