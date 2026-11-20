/* Soft Blank・标题栏 · 完成版1.0 —— 给标题栏挂常驻小气泡，回复时冒三个跳点，每个聊天室各存各的头像图 */

export default {
  manifest: {
    id: "a2-header-card",
    name: "Soft Blank・标题栏",
    author: "山羊",
    apiVersion: 1,
    version: "1.0.0",
    description: "标题栏常驻一颗小气泡（平时只有颜文字，回复时冒三个跳点），按聊天室各存各的头像图；需配合同版 CSS 使用。",
    permissions: ["ui", "storage"],
    settings: [
      { key: "showBubble", label: "显示常驻气泡", type: "boolean", default: true },
      { key: "showAvatar", label: "显示头像", type: "boolean", default: true },
      { key: "bubbleText", label: "气泡文字", type: "text", default: ">ω<" }
    ]
  },

  setup(ctx) {
    const TARGET_KEY = "a2_hdr_targets";
    const AVATAR_PREFIX = "a2_hdr_avatar:";
    const TEXT_KEY = "a2_hdr_text";
    const DEFAULT_TEXT = ">ω<";
    const MARK = "data-a2-hdr";

    const getTargets = () => {
      const v = ctx.system.storage.get(TARGET_KEY);
      if (v === undefined || v === null) return [];
      return Array.isArray(v) ? v.map(String) : [];
    };
    const isActive = (sid) => getTargets().some(id => id === String(sid));
    const getAvatar = (sid) => ctx.system.storage.get(AVATAR_PREFIX + sid) || "";
    const getText = () => {
      const v = ctx.system.storage.get(TEXT_KEY);
      return (typeof v === "string" && v.length) ? v : DEFAULT_TEXT;
    };

    let refreshPanel = () => {};
    let rafId = 0;

    const sidOf = (w) => (String(w.className).match(/\bsession-([^\s]+)\b/) || [])[1] || "";
    const wrappers = () => [...document.querySelectorAll(".chat-room-layer .chat-room-wrapper")];
    const hasOurCss = (header) => {
      try { return !!getComputedStyle(header).getPropertyValue("--dot-d").trim(); }
      catch (e) { return false; }
    };

    function ensure(w) {
      const sid = sidOf(w);
      const header = w.querySelector(":scope > .page-header");
      if (!sid || !header) return;

      if (!isActive(sid) || !hasOurCss(header)) {
        header.querySelectorAll(":scope > [" + MARK + "]").forEach(n => n.remove());
        w.style.removeProperty("--a2-avatar-url");
        return;
      }

      const showBubble = ctx.system.settings.get("showBubble") !== false;
      const showAvatar = ctx.system.settings.get("showAvatar") !== false;
      const text = getText();

      const src = showAvatar ? getAvatar(sid) : "";
      if (src) {
        w.style.setProperty("--a2-avatar-url", 'url("' + String(src).replace(/"/g, '\\"') + '")');
      } else {
        w.style.removeProperty("--a2-avatar-url");
      }

      let box = header.querySelector(":scope > [" + MARK + "]");
      if (!showBubble) {
        if (box) box.remove();
        return;
      }
      if (!box) {
        box = document.createElement("div");
        box.className = "a2-hdr-bubble";
        box.setAttribute(MARK, "1");
        const t = document.createElement("span");
        t.className = "a2-hdr-text";
        box.appendChild(t);
        header.appendChild(box);
      }
      const t = box.querySelector(".a2-hdr-text");
      if (t && t.textContent !== text) t.textContent = text;

      const generating = !!header.querySelector(".chat-typing-indicator");
      const dots = box.querySelector(".chat-typing-dots");
      if (generating && !dots) {
        const d = document.createElement("span");
        d.className = "chat-typing-dots";
        d.setAttribute(MARK, "1");
        d.innerHTML = "<i></i><i></i><i></i>";
        box.appendChild(d);
      } else if (!generating && dots) {
        dots.remove();
      }
    }

    function schedule() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => { rafId = 0; wrappers().forEach(ensure); });
    }

    const observer = new MutationObserver((records) => {
      const onlyMine = records.every(r =>
        [...r.addedNodes, ...r.removedNodes].every(n =>
          n.nodeType !== 1 || (n.hasAttribute && n.hasAttribute(MARK))
        )
      );
      if (onlyMine) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    if (ctx.system.settings.onChange) ctx.system.settings.onChange(schedule);
    ctx.hooks.on("session.opened", schedule);
    ctx.hooks.on("app.ready", schedule);
    ctx.hooks.on("plugins.changed", schedule);
    ctx.system.timers.setTimeout(schedule, 500);
    schedule();

    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.setAttribute(MARK, "1");
    picker.style.cssText = "display:none;";
    document.body.appendChild(picker);

    const pickFor = (sid) => {
      picker.dataset.sessionId = String(sid);
      picker.value = "";
      picker.click();
    };

    picker.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      const sid = picker.dataset.sessionId;
      if (!file || !sid) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        ctx.system.storage.set(AVATAR_PREFIX + sid, re.target.result);
        ctx.ui.toast("头像上传成功 🌸");
        refreshPanel();
        schedule();
      };
      reader.readAsDataURL(file);
    };

    const PINK = {
      card: "#f5e4f5", line: "#ecd9ee", ink: "#6b5566", soft: "#9b7d94",
      row: "rgba(255,255,255,.72)", rowLine: "rgba(196,150,190,.38)",
      dot: "#d3aecb", dotOn: "#f5d1ea", btn: "#f5d1ea"
    };

    ctx.ui.slot("settings.section", (host) => {
      const render = () => {
        host.innerHTML = "";
        const box = document.createElement("div");
        box.style.cssText = [
          "margin-top:16px", "padding:14px", "border-radius:16px",
          "border:1px solid " + PINK.line, "background:" + PINK.card,
          "display:flex", "flex-direction:column", "gap:10px",
          "font-family:inherit", "color:" + PINK.ink
        ].join(";") + ";";

        const sessions = ctx.data.sessions.list() || [];
        const selected = getTargets();

        const head = document.createElement("div");
        head.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
        const title = document.createElement("div");
        title.textContent = "🌸 Soft Blank・标题栏";
        title.style.cssText = "font-size:14px;font-weight:700;";
        head.appendChild(title);
        const acts = document.createElement("div");
        const mkBtn = (txt, fn) => {
          const b = document.createElement("button");
          b.textContent = txt;
          b.style.cssText = "background:none;border:none;font-size:12px;color:" + PINK.soft + ";cursor:pointer;margin-left:10px;";
          b.onclick = () => { fn(); render(); schedule(); };
          return b;
        };
        acts.appendChild(mkBtn("全选", () => ctx.system.storage.set(TARGET_KEY, sessions.map(x => String(x.id)))));
        acts.appendChild(mkBtn("清空", () => ctx.system.storage.set(TARGET_KEY, [])));
        head.appendChild(acts);
        box.appendChild(head);

        const list = document.createElement("div");
        list.style.cssText = "display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;";
        if (!sessions.length) {
          const empty = document.createElement("div");
          empty.textContent = "暂无会话";
          empty.style.cssText = "text-align:center;font-size:12px;opacity:.6;padding:16px 0;";
          list.appendChild(empty);
        } else {
          sessions.forEach(sess => {
            const sid = String(sess.id);
            let name = sess.alias || "";
            let typeLabel = "单聊";
            if (sess.isGroup) { name = sess.groupName || "群聊"; typeLabel = "群聊"; }
            else {
              let ch = null;
              try { ch = ctx.data.characters.get(sess.contactId); } catch (e) {}
              name = name || (ch && ch.name) || ("联系人 " + sid.slice(-4));
            }

            const on = selected.some(id => id === sid);
            const item = document.createElement("div");
            item.style.cssText = [
              "display:flex", "align-items:center", "gap:10px",
              "padding:9px 11px", "border-radius:12px",
              "border:1px solid " + PINK.rowLine, "background:" + PINK.row,
              "cursor:pointer"
            ].join(";") + ";";

            const dot = document.createElement("div");
            dot.style.cssText = [
              "width:18px", "height:18px", "border-radius:50%",
              "border:2px solid " + PINK.dot, "box-sizing:border-box",
              "display:flex", "align-items:center", "justify-content:center",
              "font-size:11px", "flex:none",
              on ? "background:" + PINK.dotOn : ""
            ].join(";") + ";";
            dot.textContent = on ? "✓" : "";

            const nm = document.createElement("span");
            nm.textContent = name;
            nm.style.cssText = "flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

            const tag = document.createElement("span");
            tag.textContent = typeLabel;
            tag.style.cssText = "font-size:11px;color:" + PINK.soft + ";border:1px solid " + PINK.rowLine + ";border-radius:999px;padding:1px 8px;flex:none;";

            const has = !!getAvatar(sid);
            const upload = document.createElement("button");
            upload.textContent = has ? "成功 · 点击换图" : "选图";
            upload.style.cssText = [
              "border:none", "border-radius:999px", "padding:6px 12px",
              "font-size:11px", "line-height:1.2", "white-space:nowrap",
              "cursor:pointer", "flex:none", "min-width:44px",
              "background:" + (has ? PINK.dotOn : PINK.btn), "color:" + PINK.ink
            ].join(";") + ";";
            if (has) upload.title = "已上传，点这里换一张";
            upload.onclick = (ev) => { ev.stopPropagation(); pickFor(sid); };

            const clear = document.createElement("button");
            clear.textContent = "清除";
            clear.style.cssText = "background:none;border:none;font-size:11px;color:" + PINK.soft + ";cursor:pointer;flex:none;padding:4px;";
            clear.onclick = (ev) => {
              ev.stopPropagation();
              ctx.system.storage.remove(AVATAR_PREFIX + sid);
              render(); schedule();
            };

            item.onclick = () => {
              const cur = new Set(selected);
              if (cur.has(sid)) cur.delete(sid); else cur.add(sid);
              ctx.system.storage.set(TARGET_KEY, Array.from(cur));
              render(); schedule();
            };
            item.appendChild(dot); item.appendChild(nm); item.appendChild(tag);
            item.appendChild(upload); if (has) item.appendChild(clear);
            list.appendChild(item);
          });
        }
        box.appendChild(list);

        const textBox = document.createElement("div");
        textBox.style.cssText = "margin-top:4px;padding-top:12px;border-top:1px dashed " + PINK.line + ";display:flex;flex-direction:column;gap:6px;";
        const textLabel = document.createElement("label");
        textLabel.textContent = "✏️ 常驻气泡里的文字";
        textLabel.style.cssText = "font-size:13px;font-weight:600;";
        const textInput = document.createElement("input");
        textInput.type = "text";
        textInput.value = getText();
        textInput.placeholder = DEFAULT_TEXT;
        textInput.style.cssText = [
          "width:100%", "box-sizing:border-box", "padding:9px 11px",
          "border-radius:10px", "border:1px solid " + PINK.rowLine,
          "background:rgba(255,255,255,.8)", "color:" + PINK.ink,
          "font-size:13px", "font-family:inherit", "outline:none"
        ].join(";") + ";";
        textInput.oninput = () => {
          ctx.system.storage.set(TEXT_KEY, textInput.value || DEFAULT_TEXT);
          schedule();
        };
        textBox.appendChild(textLabel); textBox.appendChild(textInput);
        box.appendChild(textBox);

        host.appendChild(box);
      };
      refreshPanel = render;
      render();
    });

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      document.querySelectorAll("[" + MARK + "]").forEach(el => el.remove());
      wrappers().forEach(w => w.style.removeProperty("--a2-avatar-url"));
      refreshPanel = () => {};
    };
  }
};
