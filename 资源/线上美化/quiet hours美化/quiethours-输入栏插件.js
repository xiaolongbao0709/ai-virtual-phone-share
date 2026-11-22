/* ===========================================================================
   File: quiethours-输入栏插件.js
   THIRD-PARTY NOTICES - quiet hours chat theme (input-bar companion plugin)
   ===========================================================================
   SCOPE
   This JavaScript plugin contains no inlined SVG, no data:image URIs and
   no icon assets. It only references CSS custom properties defined by the
   companion quiet hours stylesheet. Three icons in that companion
   stylesheet are derived from Google Material icon sets and are licensed
   under the Apache License, Version 2.0 (January 2004). Their attribution
   is reproduced below so that the notices remain with this file if it is
   distributed separately. All other plugin logic, layout, variables and
   the six CC0 icons are outside this notice. Nothing here asserts a
   licence over the author's own JavaScript.
   Colons and fixed columns are a reading aid only; no licence prescribes
   file layout, and no user-interface credit is required.
   Apart from the manifest "name" field, the original plugin source is
   preserved byte-for-byte; the notice is a comment and adds no behaviour.

   ---------------------------------------------------------------------------
   1. LICENSE TEXT (redistribution condition: give recipients a copy)
   ---------------------------------------------------------------------------
   ASF licenses index            : https://www.apache.org/licenses/
   Authoritative English text    : https://www.apache.org/licenses/LICENSE-2.0
   Plain-text official copy      : https://www.apache.org/licenses/LICENSE-2.0.txt
   ASF licensing FAQ             : https://www.apache.org/foundation/license-faq.html
   ASF "Apply the license"       : https://www.apache.org/legal/apply-license.html
   SPDX entry / short id         : https://spdx.org/licenses/Apache-2.0.html
   OSI license page              : https://opensource.org/license/apache-2.0
   The complete, unmodified English text of Apache License 2.0 follows this
   notice at the top of this file. The same text is also shipped with the
   companion stylesheet as the separate files LICENSE and
   LICENSE_Apache-2.0.txt. One full copy per distribution is sufficient;
   the embedded copy alone satisfies this condition when this plugin is
   distributed by itself. Only the English text of the licence is
   authoritative.

   ---------------------------------------------------------------------------
   2. UPSTREAM ICON SOURCES (redistribution condition: retain notices)
   ---------------------------------------------------------------------------
   Browse / download (Google)    : https://fonts.google.com/icons
   Iconify collection index      : https://github.com/iconify/icon-sets/blob/master/collections.md
   Iconify set - Material Symbols: https://icon-sets.iconify.design/material-symbols/
   Iconify set - ic              : https://icon-sets.iconify.design/ic/
   Iconify data - symbols        : https://api.iconify.design/material-symbols.json
   Iconify data - ic             : https://api.iconify.design/ic.json
   Browse UI used by author      : https://yesicon.app/
   Per-icon URL form             : https://yesicon.app/zh-Hans/PREFIX/ICON-NAME
   Author-supplied example       : https://yesicon.app/zh-Hans/tabler/checks

   A. material-symbols:forward-to-inbox-rounded
      Set         : Material Symbols
      Author      : Google
      License     : Apache-2.0
      Upstream    : https://github.com/google/material-design-icons
      LICENSE     : https://github.com/google/material-design-icons/blob/master/LICENSE
      Used in     : companion CSS --icon-reply (reply / offline send button)

   B. ic:baseline-add-a-photo
      Set         : Google Material Icons
      Author      : Material Design Authors
      License     : Apache-2.0
      Upstream    : https://github.com/material-icons/material-icons
      LICENSE     : https://github.com/material-icons/material-icons/blob/master/LICENSE
      Used in     : companion CSS --icon-red (composer front key / plus slot)
   The "ic" prefix maps to material-icons/material-icons, not to
   google/material-design-icons.

   C. ic:baseline-voice-over-off
      Set         : Google Material Icons
      Author      : Material Design Authors
      License     : Apache-2.0
      Upstream    : https://github.com/material-icons/material-icons
      LICENSE     : https://github.com/material-icons/material-icons/blob/master/LICENSE
      Used in     : companion CSS --icon-blue (composer front key / capsule toggle)
   The original per-icon comments are also kept above each --icon-*
   variable in the companion stylesheet. Upstream SVG files contain no
   copyright header, no Apache notice and no comment block, only path data
   and the SVG namespace, so no file-level notice is carried over.

   ---------------------------------------------------------------------------
   3. MODIFICATIONS (redistribution condition: prominent change notice)
   ---------------------------------------------------------------------------
   SVG path data was extracted, converted to data:image/svg+xml URIs,
   resized, recoloured and embedded into custom selectors in the companion
   stylesheet. This notice is placed at the top of the file so that it
   cannot be detached from the modified material.

   ---------------------------------------------------------------------------
   4. NOTICE FILE (redistribution condition: only if the Work has one)
   ---------------------------------------------------------------------------
   Root listings of both upstream repositories were checked: each contains
   a LICENSE file and no NOTICE file. This condition is not triggered, and
   no NOTICE text is reproduced. Google, Apache and ASF names identify
   provenance only and imply no endorsement.

   ---------------------------------------------------------------------------
   5. CC0 ICONS - NOT ENUMERATED
   ---------------------------------------------------------------------------
   CC0 1.0 Universal is a public domain dedication with no conditions. It
   imposes no attribution, no source-link and no licence-copy duty. The six
   CC0 icons are therefore not enumerated, no CC0 URL is recorded and no
   CC0 text is attached. The "(CC0)" marks in the companion stylesheet are
   descriptive labels, not notices. CC0 does not affect third-party
   trademark, patent, privacy or publicity rights, and no author
   endorsement is implied.

   ---------------------------------------------------------------------------
   6. REFERENCES CHECKED BUT NOT CONTAINED IN THIS FILE
   ---------------------------------------------------------------------------
   SVG namespace URI
         W3C namespace                 : http://www.w3.org/2000/svg
         SVG2 structure chapter        : https://www.w3.org/TR/SVG2/struct.html
         Current SVG specification     : https://www.w3.org/TR/SVG/
        It is a W3C XML namespace identifier, not a licensed asset and not
        a source attribution. This plugin contains zero SVG namespace URIs.
   DM Sans / Google Fonts
         Specimen                      : https://fonts.google.com/specimen/DM+Sans
         Upstream                      : https://github.com/googlefonts/dm-fonts
         SIL OFL 1.1                   : https://openfontlicense.org/
        Zero occurrences of @import, "DM Sans" and "fonts.googleapis" in
        this plugin; no font file is bundled.
   Tabler Icons "checks"
         Author-supplied link          : https://yesicon.app/zh-Hans/tabler/checks
         Site                          : https://tabler.io/icons
         Upstream                      : https://github.com/tabler/tabler-icons
         Licence (MIT)                 : https://docs.tabler.io/ui/getting-started/license
        Zero occurrences of "tabler" and "checks" in this plugin; it
        belongs to another theme / plugin, not this file.
   =========================================================================== */

/* ===========================================================================
   BEGIN VERBATIM APACHE LICENSE 2.0 TEXT - ENGLISH, AUTHORITATIVE
   ===========================================================================


                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

   =========================================================================== */

export default {
  manifest: {
    id: "a2-input-suite",
    name: "quiethours-输入栏插件",
    apiVersion: 1,
    version: "1.0.3",
    author: "山羊",
    description: "输入栏配套",
    permissions: ["ui", "storage"],
    settings: [
      { key: "capsulesHidden", label: "默认收起三个小胶囊", type: "boolean", default: false }
    ]
  },

  setup(ctx) {
    const TARGET_KEY = "a2_input_targets";
    const PH_KEY = "a2_input_placeholder";
    const DEFAULT_PH = "Message...";
    const NATIVE_PH = "Send a chat…";
    const EXCLUDE_NAMES = ["小卷"];
    const MARK = "data-a2-input";
    const BTN_CLASS = "a2-input-blue-btn";
    const HIDDEN_CLASS = "a2-capsules-hidden";

    const CAP_SLOTS = [
      { key: "emoji", i: 0, exists: 'button:has(path[d^="M8 14s1.5"])', icon: "--icon-capsule-emoji", label: "--in-label-emoji" },
      { key: "sticker", i: 1, exists: 'button:has(path[d^="M15.5 3H5"])', icon: "--icon-capsule-sticker", label: "--in-label-sticker" },
      { key: "offline", i: 2, exists: 'button[aria-label="线下模式"], button[aria-label="返回线上模式"]', icon: "--icon-capsule-offline", label: "--in-label-offline" }
    ];

    const MONO = {
      card: "#FFFFFF",
      line: "#E6E6E8",
      ink: "#1C1C1E",
      soft: "#8A8A8E",
      row: "#FAFAFA",
      rowLine: "#ECECEE",
      dot: "#C9C9CE",
      on: "#1C1C1E",
      btn: "#F2F2F4"
    };

    const getTargets = () => {
      const v = ctx.system.storage.get(TARGET_KEY);
      return Array.isArray(v) ? v.map(String) : [];
    };
    const setTargets = (arr) => ctx.system.storage.set(TARGET_KEY, Array.from(new Set(arr.map(String))));
    const isActive = (sid) => !!sid && getTargets().some(id => String(id) === String(sid));
    const roomIdOf = (wrapper) => {
      const m = String(wrapper && wrapper.className || "").match(/\bsession-([^\s]+)\b/);
      return m ? m[1] : null;
    };
    const isExcluded = (name) => EXCLUDE_NAMES.some(x => String(name || "").indexOf(x) >= 0);
    const sessionName = (sess) => {
      let name = sess.alias || "";
      if (sess.isGroup) return sess.groupName || "群聊";
      let ch = null;
      try { ch = sess.contactId && ctx.data.characters.get(sess.contactId); } catch (e) {}
      return name || (ch && ch.name) || ("会话 " + String(sess.id).slice(-4));
    };

    let stored = ctx.system.storage.get(PH_KEY);
    if (typeof stored !== "string" || !stored.length) {
      const legacy = ctx.system.settings.get("placeholder");
      stored = typeof legacy === "string" && legacy.length ? legacy : DEFAULT_PH;
    }
    if (stored === "Message…") stored = DEFAULT_PH;
    let localPh = stored;
    const getPh = () => localPh || DEFAULT_PH;

    const writtenPhs = new Set([DEFAULT_PH, NATIVE_PH]);
    const seenBars = new WeakSet();
    let lastKey = {};
    let rafId = 0;

    function applyPlaceholder(ta) {
      if (!ta) return;
      const ph = getPh();
      const cur = ta.getAttribute("placeholder");
      if (!cur || writtenPhs.has(cur)) {
        if (cur !== ph) ta.setAttribute("placeholder", ph);
        writtenPhs.add(ph);
      }
    }

    function cleanupBar(bar) {
      if (!bar) return;
      bar.querySelectorAll("[" + MARK + "]").forEach(el => el.remove());
      bar.classList.remove(HIDDEN_CLASS);
    }

    function ensureBlueButton(bar) {
      let btn = bar.querySelector("." + BTN_CLASS);
      if (btn) return btn;
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = BTN_CLASS;
      btn.setAttribute(MARK, "1");
      btn.setAttribute("aria-label", "收起或展开三个小胶囊");
      btn.style.cssText = [
        "position:absolute",
        "left:calc(var(--in-pad-x) + var(--in-key-size) + var(--in-key-gap))",
        "top:calc((var(--in-h) - var(--in-key-size)) / 2)",
        "width:var(--in-key-size)",
        "height:var(--in-key-size)",
        "min-width:0",
        "padding:0",
        "margin:0",
        "border:0",
        "background:transparent",
        "cursor:pointer",
        "z-index:4",
        "font-size:0",
        "-webkit-tap-highlight-color:transparent"
      ].join(";") + ";";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        bar.classList.toggle(HIDDEN_CLASS);
      });
      bar.appendChild(btn);
      return btn;
    }

    function syncFakeCapsules(bar, keys) {
      bar.querySelectorAll("[data-a2-fake]").forEach(el => el.remove());
      CAP_SLOTS.forEach(slot => {
        if (keys.indexOf(slot.key) < 0) return;
        const el = document.createElement("div");
        el.className = "a2-fake-capsule";
        el.setAttribute(MARK, "1");
        el.setAttribute("data-a2-fake", slot.key);
        el.style.setProperty("--a2-slot", String(slot.i));
        el.style.setProperty("--a2-icon", "var(" + slot.icon + ")");
        el.style.setProperty("--a2-label", "var(" + slot.label + ")");
        bar.appendChild(el);
      });
    }

    function scanAndRender() {
      const ph = getPh();
      const hiddenDefault = ctx.system.settings.get("capsulesHidden") === true;
      document.querySelectorAll(".chat-room-layer").forEach(layer => {
        const wrapper = layer.querySelector(".chat-room-wrapper");
        if (!wrapper) return;
        const sid = roomIdOf(wrapper);
        const bar = wrapper.querySelector('.chat-input-bar[data-ui="input"]');
        if (!isActive(sid) || !bar) {
          cleanupBar(bar);
          if (sid) delete lastKey[sid];
          return;
        }
        const ta = bar.querySelector(".chat-input-textarea");
        const actions = bar.querySelector(".chat-input-actions");
        const missing = actions
          ? CAP_SLOTS.filter(slot => !actions.querySelector(slot.exists)).map(slot => slot.key)
          : [];
        const key = [sid, ph, missing.join(",")].join("|");
        const ok = !!bar.querySelector("." + BTN_CLASS) && !!ta && ta.getAttribute("placeholder") === ph
          && bar.querySelectorAll("[data-a2-fake]").length === missing.length;
        if (ok && lastKey[sid] === key) return;
        lastKey[sid] = key;
        applyPlaceholder(ta);
        ensureBlueButton(bar);
        syncFakeCapsules(bar, missing);
        if (!seenBars.has(bar)) {
          seenBars.add(bar);
          bar.classList.toggle(HIDDEN_CLASS, hiddenDefault);
        }
      });
    }

    function schedule() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => { rafId = 0; scanAndRender(); });
    }

    function onPhEdit(v) {
      localPh = v || DEFAULT_PH;
      ctx.system.storage.set(PH_KEY, localPh);
      writtenPhs.add(localPh);
      lastKey = {};
      schedule();
    }

    ctx.ui.slot("settings.section", (host) => {
      let box = host.querySelector("[data-a2-input-panel]");
      if (!box) {
        box = document.createElement("div");
        box.setAttribute("data-a2-input-panel", "1");
        box.style.cssText = [
          "font-family:inherit",
          "color:" + MONO.ink,
          "background:" + MONO.card,
          "border:1px solid " + MONO.line,
          "border-radius:12px",
          "padding:14px",
          "display:flex",
          "flex-direction:column",
          "gap:12px",
          "box-sizing:border-box"
        ].join(";") + ";";
        host.appendChild(box);
      }

      let headWrap = box.querySelector("[data-a2-head]");
      if (!headWrap) {
        headWrap = document.createElement("div");
        headWrap.setAttribute("data-a2-head", "1");
        box.appendChild(headWrap);
      }
      let listWrap = box.querySelector("[data-a2-list]");
      if (!listWrap) {
        listWrap = document.createElement("div");
        listWrap.setAttribute("data-a2-list", "1");
        listWrap.style.cssText = "display:flex;flex-direction:column;gap:6px;max-height:220px;overflow-y:auto;";
        box.appendChild(listWrap);
      }

      let phInput = box.querySelector("input[data-a2-ph]");
      if (!phInput) {
        const phBox = document.createElement("div");
        phBox.setAttribute("data-a2-phbox", "1");
        phBox.style.cssText = "padding-top:10px;border-top:1px solid " + MONO.line + ";display:flex;flex-direction:column;gap:6px;";
        const phLabel = document.createElement("label");
        phLabel.textContent = "打字框占位文字";
        phLabel.style.cssText = "font-size:12px;font-weight:600;";
        phInput = document.createElement("input");
        phInput.type = "text";
        phInput.setAttribute("data-a2-ph", "1");
        phInput.value = getPh();
        phInput.placeholder = DEFAULT_PH;
        phInput.style.cssText = [
          "width:100%", "box-sizing:border-box", "padding:8px 10px",
          "font-family:inherit", "font-size:13px", "color:" + MONO.ink,
          "border:1px solid " + MONO.line, "border-radius:8px",
          "background:" + MONO.row, "outline:none"
        ].join(";") + ";";
        phInput.addEventListener("input", () => onPhEdit(phInput.value));
        phBox.appendChild(phLabel);
        phBox.appendChild(phInput);
        box.appendChild(phBox);
      }

      const render = () => {
        if (document.activeElement !== phInput && phInput.value !== getPh()) phInput.value = getPh();
        headWrap.innerHTML = "";
        const head = document.createElement("div");
        head.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:8px;";
        const title = document.createElement("div");
        title.textContent = "输入栏 · 生效范围";
        title.style.cssText = "font-size:14px;font-weight:600;letter-spacing:.01em;";
        head.appendChild(title);
        const acts = document.createElement("div");
        const mkBtn = (txt, fn) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = txt;
          b.style.cssText = [
            "font-family:inherit", "font-size:12px", "color:" + MONO.ink,
            "background:" + MONO.btn, "border:1px solid " + MONO.line,
            "border-radius:8px", "padding:5px 10px", "cursor:pointer", "margin-left:6px"
          ].join(";") + ";";
          b.onclick = () => { fn(); render(); lastKey = {}; schedule(); };
          return b;
        };
        const sessions = (ctx.data.sessions.list() || []).filter(s => !isExcluded(sessionName(s)));
        acts.appendChild(mkBtn("全选", () => setTargets(sessions.map(x => String(x.id)))));
        acts.appendChild(mkBtn("清空", () => setTargets([])));
        head.appendChild(acts);
        headWrap.appendChild(head);

        listWrap.innerHTML = "";
        const selected = getTargets();
        if (!sessions.length) {
          const empty = document.createElement("div");
          empty.textContent = "暂无可选会话";
          empty.style.cssText = "text-align:center;font-size:12px;color:" + MONO.soft + ";padding:14px 0;";
          listWrap.appendChild(empty);
        } else {
          sessions.forEach(sess => {
            const sid = String(sess.id);
            const on = selected.some(id => String(id) === sid);
            const item = document.createElement("div");
            item.style.cssText = [
              "display:flex", "align-items:center", "gap:10px", "cursor:pointer",
              "padding:8px 10px", "border-radius:10px", "box-sizing:border-box",
              "border:1px solid " + MONO.rowLine, "background:" + MONO.row
            ].join(";") + ";";
            const dot = document.createElement("div");
            dot.style.cssText = [
              "width:16px", "height:16px", "border-radius:50%", "flex:none",
              "box-sizing:border-box", "border:2px solid " + MONO.dot,
              "background:" + (on ? MONO.on : "transparent")
            ].join(";") + ";";
            const nm = document.createElement("div");
            nm.textContent = sessionName(sess);
            nm.style.cssText = "font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";
            const tag = document.createElement("div");
            tag.textContent = sess.isGroup ? "群聊" : "单聊";
            tag.style.cssText = "font-size:11px;color:" + MONO.soft + ";flex:none;";
            item.onclick = () => {
              const cur = new Set(getTargets());
              if (cur.has(sid)) cur.delete(sid); else cur.add(sid);
              setTargets(Array.from(cur));
              lastKey = {};
              render();
              schedule();
            };
            item.appendChild(dot);
            item.appendChild(nm);
            item.appendChild(tag);
            listWrap.appendChild(item);
          });
        }
      };

      render();
    });

    const observer = new MutationObserver((records) => {
      const hit = records.some(r => {
        const n = r.target;
        if (!n || n.nodeType !== 1) return false;
        if (n.closest && n.closest("#a2-settings-host")) return false;
        return !!(n.classList && (n.classList.contains("chat-room-layer") || n.classList.contains("chat-room-wrapper")));
      });
      if (hit) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.hooks.on("app.ready", schedule);
    ctx.hooks.on("session.opened", schedule);
    ctx.hooks.on("plugins.changed", schedule);
    if (ctx.system.settings.onChange) {
      ctx.system.settings.onChange(() => { lastKey = {}; schedule(); });
    }
    schedule();

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
      document.querySelectorAll("[" + MARK + "]").forEach(el => el.remove());
      document.querySelectorAll("." + HIDDEN_CLASS).forEach(el => el.classList.remove(HIDDEN_CLASS));
      lastKey = {};
    };
  }
};
