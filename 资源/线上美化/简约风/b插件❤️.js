/**
 * @license MIT
 * SPDX-License-Identifier: MIT
 * SPDX-FileCopyrightText: 2020-2026 Paweł Kuna
 *
 * Third-party icon notice.
 * This file includes SVG icon assets from Tabler Icons
 * (https://tablericons.com/), Copyright (c) 2020-2026 Paweł Kuna,
 * distributed under the MIT License. The icon markup has been
 * modified and inlined into this file. As required by the MIT
 * License, the copyright notice and the permission notice are
 * reproduced in full below.
 *
 * MIT License
 *
 * Copyright (c) 2020-2026 Paweł Kuna
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export default {
  manifest: {
    id: "music-header-card",
    name: "音乐卡片标题栏",
    author: "Deepseek&Claude",
    apiVersion: 1,
    version: "1.2.0",
    description: "接管标题栏的图片与歌名。",
    settings: [
      { key: "enabled", label: "启用音乐卡片", type: "boolean", default: true }
    ]
  },
  setup(ctx) {
    const TARGET_KEY = "music_header_targets";
    const AVATAR_KEY = "music_header_avatar";
    const TITLE_KEY = "music_header_title";

    const getTargets = () => {
      const v = ctx.system.storage.get(TARGET_KEY);
      return Array.isArray(v) ? v : [];
    };

    const mounts = new Set();
    const repaintAll = () => { for (const m of mounts) { try { m.paint(); } catch(e){} } };

    function paint(el, props) {
      if (ctx.system.settings.get("enabled") === false) { el.replaceChildren(); return; }
      const targets = getTargets();
      if (!targets.some(id => String(id) === String(props.sessionId))) { el.replaceChildren(); return; }

      const avatarSrc = ctx.system.storage.get(AVATAR_KEY) || '';
      const songTitle = ctx.system.storage.get(TITLE_KEY) || '示例歌名';

      el.replaceChildren();

      if (avatarSrc) {
        const img = document.createElement('img');
        img.className = 'plugin-music-avatar';
        img.src = avatarSrc;
        el.appendChild(img);
      }
      
      const span = document.createElement('span');
      span.className = 'plugin-music-title';
      span.textContent = songTitle;
      el.appendChild(span);
    }

    ctx.ui.slot("chat.header", (el, props) => {
      el.style.cssText = "position:absolute; inset:0; pointer-events:none;";
      const entry = { paint: () => paint(el, props) };
      mounts.add(entry);
      entry.paint();

      return () => {
        mounts.delete(entry);
        el.replaceChildren();
      };
    });

    const offSettings = ctx.system.settings.onChange(repaintAll);

    ctx.ui.slot("settings.section", (host) => {
      const renderPanel = () => {
        host.innerHTML = "";
        const box = document.createElement("div");
        box.style.cssText = "margin-top:16px; padding:14px; border-radius:14px; border:1px dashed rgba(128,128,128,.35); background:rgba(128,128,128,.06); display:flex; flex-direction:column; gap:10px; font-family:inherit;";

        const selected = getTargets();
        const sessions = ctx.data.sessions.list() || [];

        const head = document.createElement("div");
        head.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
        head.innerHTML = `<div style="font-size:14px; font-weight:700; opacity:.9;">🎵 音乐卡片生效范围</div>`;
        const acts = document.createElement("div");
        const bAll = document.createElement("button");
        bAll.textContent = "全选";
        bAll.style.cssText = "background:none;border:none;font-size:12px;opacity:.6;cursor:pointer;margin-right:8px;";
        bAll.onclick = () => { ctx.system.storage.set(TARGET_KEY, sessions.map(x => x.id)); renderPanel(); repaintAll(); };
        const bNone = document.createElement("button");
        bNone.textContent = "清空";
        bNone.style.cssText = "background:none;border:none;font-size:12px;opacity:.6;cursor:pointer;";
        bNone.onclick = () => { ctx.system.storage.set(TARGET_KEY, []); renderPanel(); repaintAll(); };
        acts.appendChild(bAll); acts.appendChild(bNone);
        head.appendChild(acts);
        box.appendChild(head);

        const list = document.createElement("div");
        list.style.cssText = "display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto;";
        sessions.forEach(sess => {
          let name = sess.alias || "";
          if (sess.isGroup) name = sess.groupName || "群聊";
          else {
            let ch = null;
            try { ch = ctx.data.characters.get(sess.contactId); } catch (e) {}
            name = name || (ch && ch.name) || ("联系人 " + String(sess.contactId).slice(-4));
          }
          const on = selected.some(id => String(id) === String(sess.id));
          const item = document.createElement("div");
          item.style.cssText = "display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; border:1px solid rgba(128,128,128,.25); background:rgba(128,128,128,.05); cursor:pointer;";
          item.innerHTML = `<div style="width:16px;height:16px;border-radius:50%;border:2px solid rgba(128,128,128,.5);display:flex;align-items:center;justify-content:center;font-size:10px; ${on ? 'background:rgba(128,128,128,.45);' : ''}">${on ? '✓' : ''}</div>
              <span style="flex:1; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>`;
          item.onclick = () => {
            const cur = new Set(getTargets().map(id => String(id)));
            if (cur.has(String(sess.id))) cur.delete(String(sess.id));
            else cur.add(String(sess.id));
            ctx.system.storage.set(TARGET_KEY, Array.from(cur));
            renderPanel(); 
            repaintAll();
          };
          list.appendChild(item);
        });
        box.appendChild(list);

        const titleBox = document.createElement("div");
        titleBox.style.cssText = "margin-top:12px; padding-top:12px; border-top:1px dashed rgba(128,128,128,.25);";
        const curTitle = ctx.system.storage.get(TITLE_KEY) || "示例歌名";
        titleBox.innerHTML = `
          <label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px;">自定义歌曲名称</label>
          <input type="text" id="music-title-input" value="${curTitle}" style="width:100%; padding:8px 10px; border-radius:6px; border:1px solid rgba(128,128,128,.3); background:rgba(0,0,0,0.02); font-size:13px; color:inherit;" />
        `;
        titleBox.querySelector('#music-title-input').onchange = (e) => {
          ctx.system.storage.set(TITLE_KEY, e.target.value);
          ctx.ui.toast("歌名已更新！");
          repaintAll();
        };
        box.appendChild(titleBox);

        const avatarBox = document.createElement("div");
        avatarBox.style.cssText = "margin-top:12px; padding-top:12px; border-top:1px dashed rgba(128,128,128,.25);";
        const hasAvatar = !!ctx.system.storage.get(AVATAR_KEY);
        avatarBox.innerHTML = `
          <label for="music-avatar-upload" style="display:block; width:100%; padding:10px; background:rgba(128,128,128,.15); border-radius:6px; font-size:13px; text-align:center; cursor:pointer;">
            ${hasAvatar ? "✅ 已上传，点击更换封面图" : "📁 点击上传封面图"}
          </label>
          <input type="file" id="music-avatar-upload" accept="image/*" style="display:none;" />
        `;
        avatarBox.querySelector('#music-avatar-upload').onchange = (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (re) => {
            ctx.system.storage.set(AVATAR_KEY, re.target.result);
            ctx.ui.toast("封面图更新成功！");
            renderPanel();
            repaintAll();
          };
          reader.readAsDataURL(file);
        };
        box.appendChild(avatarBox);

        host.appendChild(box);
      };
      renderPanel();
    });

    return () => {
      offSettings();
      mounts.clear();
    };
  }
};