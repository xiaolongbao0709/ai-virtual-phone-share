/* ===========================================================================
   File: Sententiola整合版.js
   THIRD-PARTY NOTICES - Sententiola bundle (companion plugin)
   ===========================================================================
   SCOPE
   This JavaScript plugin embeds three of the four Apache-2.0 icons as
   inline SVG in TAB_ICONS. The fourth is embedded in the companion CSS.
   All four are listed here so the notices stay complete if this plugin is
   distributed on its own. All other plugin logic, settings, DOM handling,
   layout, variables and the remaining CC0 icon glyphs are outside this
   notice. Nothing here asserts a licence over the author's own JavaScript.
   Colons and fixed columns are a reading aid only; no licence prescribes
   file layout, and no user-interface credit is required.
   Apart from the manifest "version" field (14.0.0 to 6.0.0), the original
   plugin source is preserved byte-for-byte; the notice is a comment and
   adds no behaviour.

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
   notice at the top of this file. The same text is also shipped as the
   separate files LICENSE and LICENSE_Apache-2.0.txt. One full copy per
   distribution is sufficient; the embedded copy alone satisfies this
   condition when this plugin is distributed by itself. Only the English text
   of the licence is authoritative.

   ---------------------------------------------------------------------------
   2. UPSTREAM ICON SOURCES (redistribution condition: retain notices)
   ---------------------------------------------------------------------------
   Browse / download (Google)    : https://fonts.google.com/icons
   Iconify collection index      : https://github.com/iconify/icon-sets/blob/master/collections.md
   Iconify set - symbols         : https://icon-sets.iconify.design/material-symbols/
   Iconify set - mdi             : https://icon-sets.iconify.design/mdi/
   Iconify data - symbols        : https://api.iconify.design/material-symbols.json
   Iconify data - mdi            : https://api.iconify.design/mdi.json
   Pictogrammers licence         : https://pictogrammers.com/docs/general/license/
   Pictogrammers site            : https://pictogrammers.com/
   Browse UI used by author      : https://yesicon.app/
   Per-icon URL form             : https://yesicon.app/zh-Hans/PREFIX/ICON-NAME
   Source page - mdi:reply       : https://yesicon.app/zh-Hans/mdi/reply
   Source - chat-display         : https://yesicon.app/zh-Hans/material-symbols/chat-display
   Source - bookmark-heart       : https://yesicon.app/zh-Hans/material-symbols/bookmark-heart
   Source - heart-arrow          : https://yesicon.app/zh-Hans/material-symbols/heart-arrow

   A. mdi:reply
      Set         : Material Design Icons
      Author      : Pictogrammers
      License     : Apache-2.0
      Upstream    : https://github.com/Templarian/MaterialDesign
      LICENSE     : https://github.com/Templarian/MaterialDesign/blob/master/LICENSE
      Used in     : --bb-info-icon-svg (bubble info row arrow, companion CSS)

   B. material-symbols:chat-display
      Set         : Material Symbols
      Author      : Google
      License     : Apache-2.0
      Upstream    : https://github.com/google/material-design-icons
      LICENSE     : https://github.com/google/material-design-icons/blob/master/LICENSE
      Used in     : TAB_ICONS.post (Posts tab, companion plugin)

   C. material-symbols:bookmark-heart
      Set         : Material Symbols
      Author      : Google
      License     : Apache-2.0
      Upstream    : https://github.com/google/material-design-icons
      LICENSE     : https://github.com/google/material-design-icons/blob/master/LICENSE
      Used in     : TAB_ICONS.save (Saved tab, companion plugin)

   D. material-symbols:heart-arrow
      Set         : Material Symbols
      Author      : Google
      License     : Apache-2.0
      Upstream    : https://github.com/google/material-design-icons
      LICENSE     : https://github.com/google/material-design-icons/blob/master/LICENSE
      Used in     : TAB_ICONS.like (Likes tab, companion plugin)

   The "mdi" prefix maps to Templarian/MaterialDesign (Pictogrammers), not
   to google/material-design-icons. Pictogrammers states that icons are
   Apache 2.0, that non-icon code is MIT, and that Brand / Logos icons are
   excluded and deprecated; none of the four icons above is a brand logo.
   Earlier revisions of the Iconify collection index named Austin Andrews
   as the mdi author; the current entry names Pictogrammers. Both agree on
   Apache 2.0. Upstream SVG files carry no copyright header, no Apache
   notice and no comment block, only path data and the SVG namespace, so
   no file-level notice has to be carried over.

   ---------------------------------------------------------------------------
   3. MODIFICATIONS (redistribution condition: prominent change notice)
   ---------------------------------------------------------------------------
   SVG path data was extracted, converted to data:image/svg+xml URIs or
   inline <svg> strings, resized, recoloured and embedded into custom
   selectors and DOM construction. This notice is placed at the top of the
   file so that it cannot be detached from the modified material.

   ---------------------------------------------------------------------------
   4. NOTICE FILE (redistribution condition: only if the Work has one)
   ---------------------------------------------------------------------------
   Root listings of both upstream repositories were checked: each contains
   a LICENSE file and no NOTICE file. This condition is not triggered, and
   no NOTICE text is reproduced. Google, Apache, ASF and Pictogrammers names
   identify provenance only and imply no endorsement.

   ---------------------------------------------------------------------------
   5. CC0 ICONS - NOT ENUMERATED
   ---------------------------------------------------------------------------
   CC0 1.0 Universal is a public domain dedication with no conditions. It
   imposes no attribution, no source-link and no licence-copy duty. The
   remaining icon glyphs are therefore not enumerated, no CC0 URL is
   recorded and no CC0 text is attached. Descriptive "(CC0)" marks, if
   present in the author's code, are labels, not notices. CC0 does not
   affect third-party trademark, patent, privacy or publicity rights, and
   no author endorsement is implied.

   ---------------------------------------------------------------------------
   6. REFERENCES CHECKED BUT NOT CONTAINED IN THIS FILE
   ---------------------------------------------------------------------------
   SVG namespace URI
         W3C namespace                 : http://www.w3.org/2000/svg
         SVG2 structure chapter        : https://www.w3.org/TR/SVG2/struct.html
         Current SVG specification     : https://www.w3.org/TR/SVG/
        Occurs only as the xmlns attribute of inline SVG. It is a W3C XML
        namespace identifier, not a licensed asset and not an attribution.
   DM Sans / Google Fonts
         Specimen                      : https://fonts.google.com/specimen/DM+Sans
         Upstream                      : https://github.com/googlefonts/dm-fonts
         SIL OFL 1.1                   : https://openfontlicense.org/
        Zero occurrences of @import, "DM Sans" and "fonts.googleapis" in
        the non-comment rules; no font file is bundled.
   Tabler Icons "checks"
         Author-supplied link          : https://yesicon.app/zh-Hans/tabler/checks
         Site                          : https://tabler.io/icons
         Upstream                      : https://github.com/tabler/tabler-icons
         Licence (MIT)                 : https://docs.tabler.io/ui/getting-started/license
        Zero occurrences of "tabler" and "checks" in the non-comment rules;
        it belongs to an earlier theme, not this bundle.
   =========================================================================== */

/* ===========================================================================
   BEGIN VERBATIM APACHE LICENSE 2.0 - official English text
   Source: https://www.apache.org/licenses/LICENSE-2.0.txt
   Only the English text of the Apache License is authoritative.
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


   ===========================================================================
   END VERBATIM APACHE LICENSE 2.0
   =========================================================================== */

export default {
  manifest: {
    id: "sententiola-bundle",
    name: "Sententiola整合版",
    apiVersion: 1,
    version: "6.0.0",
    author: "山羊",
    description: "Sententiola整合版：标题栏 + 气泡 + 输入栏配套；译文让位、上传图片、网名与时间戳",
    permissions: ["ui", "storage"],
    settings: [
      { key: "enabled", label: "启用美化", type: "boolean", default: true },
      { key: "transFit", label: "译文外移后精确让位", type: "boolean", default: true },
      { key: "excludedSessions", label: "额外排除的会话 id（逗号分隔）", type: "text", default: "" },
    ],
  },

  setup(ctx) {
    const cleanups = [];
    const run = (fn) => { try { const c = fn(ctx); if (typeof c === "function") cleanups.push(c); } catch (e) { try { ctx.system.log("整合版子模块异常", String(e)); } catch (_) {} } };
    run(setupTitlebar);
    run(setupBubble);
    run(setupSententiolaInfo);
    return () => { cleanups.forEach(c => { try { c(); } catch (_) {} }); };
  },
};

function isOwnMutation(r) {
  const t = r.target && (r.target.nodeType === 1 ? r.target : r.target.parentElement);
  return !!(t && t.closest && t.closest(
    '.tb-root, .tb-panel, [data-sententiola-info], [data-petrichor-h], [data-petrichor-scope], .chat-input-bar'));
}
function keepExternal(recs) {
  return recs.some(r => !isOwnMutation(r));
}

function shortSig(v) {
  const s = String(v == null ? "" : v);
  const n = s.length, step = Math.max(1, Math.floor(n / 512));
  let h = 5381;
  for (let i = 0; i < n; i += step) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return n + ":" + (h >>> 0).toString(36);
}
function withTimeout(p, ms, fallback) {
  return new Promise((resolve) => {
    let done = false;
    const fin = (v) => { if (!done) { done = true; resolve(v); } };
    try { Promise.resolve(p).then(fin, () => fin(fallback)); } catch (_) { fin(fallback); }
    setTimeout(() => fin(fallback), ms);
  });
}
function shrinkImage(dataUrl, isAvatar) {
  return new Promise((resolve) => {
    const head = String(dataUrl).slice(0, 24).toLowerCase();
    if (head.indexOf("data:image/") !== 0 || head.indexOf("data:image/gif") === 0
        || head.indexOf("data:image/svg") === 0) { resolve(dataUrl); return; }
    const max = isAvatar ? 256 : 1600;
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) { resolve(dataUrl); return; }
        const s = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
        const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
        const cx = cv.getContext("2d");
        if (!cx) { resolve(dataUrl); return; }
        cx.drawImage(img, 0, 0, w, h);
        let out;
        if (isAvatar) {
          out = cv.toDataURL("image/png");
        } else {
          out = cv.toDataURL("image/jpeg", 0.85);
          if (out.length > 1400000) out = cv.toDataURL("image/jpeg", 0.7);
          if (out.length > 1400000) out = cv.toDataURL("image/jpeg", 0.55);
        }
        resolve(out && out.length < dataUrl.length ? out : dataUrl);
      } catch (_) { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function setupTitlebar(ctx) {
    
    const SIGIL = "sensiculus";
    const PETRICHOR = "--" + SIGIL + "-sigil";
    const READY = "data-" + SIGIL + "-ready";
    const KEEP_BACK = "data-" + SIGIL + "-keep-back";
    const KEEP_MORE = "data-" + SIGIL + "-keep-more";
    const ROOT = "data-" + SIGIL + "-root";
    const ID = "Sententiola标题栏";

    

    const TAB_ICONS = {
      post: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="128" height="128"><path fill="currentColor" d="M6 11h12V9H6zm0-3h12V6H6zm3 10H6l-4 4V4q0-.825.588-1.412T4 2h16q.825 0 1.413.588T22 4v8.55q-.45-.275-.962-.413T20 12H6v2h3.525q-.275.45-.4.95T9 16zm4 4q-.825 0-1.412-.587T11 20v-4q0-.825.588-1.412T13 14h7q.825 0 1.413.588T22 16v4q0 .825-.587 1.413T20 22zm0-2h7v-4h-7z"/></svg>',
      save: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="128" height="128"><path fill="currentColor" d="M12 14.3q1.275-1.175 2.063-1.937t1.212-1.313t.575-.962T16 9.2q0-.9-.65-1.55T13.8 7q-.525 0-1.013.213T12 7.8q-.3-.375-.775-.587T10.2 7q-.9 0-1.55.65T8 9.2q0 .475.137.875t.563.95t1.2 1.313T12 14.3M5 21V5q0-.825.588-1.412T7 3h10q.825 0 1.413.588T19 5v16l-7-3z"/></svg>',
      like: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="128" height="128"><path fill="currentColor" d="m12 21l-3.175-2.85q-1.8-1.625-3.087-2.9t-2.125-2.4t-1.225-2.175T2 8.475q0-2.35 1.575-3.912T7.5 3q1.3 0 2.475.55T12 5.1q.85-1 2.025-1.55T16.5 3q2 0 3.638 1.338T21.975 8h-2.05Q19.75 6.35 18.6 5.675T16.5 5q-1.275 0-2.2.688T12.575 7.5h-1.15q-.775-1.125-1.763-1.812T7.5 5q-1.425 0-2.463.988T4 8.474q0 .825.35 1.675t1.25 1.963t2.45 2.6T12 18.3l1.525-1.325q1.2-1.05 2.613-2.375t2.387-2.6h-2.2v-2H22v5.65h-2v-2.275q-1.025 1.3-2.475 2.65t-2.675 2.45z"/></svg>',
    };

    const K = { cover: SIGIL + ".cover", avatar: SIGIL + ".avatar", quote: SIGIL + ".quote", ip: SIGIL + ".ip",
              cap1: SIGIL + ".cap1", cap2: SIGIL + ".cap2", cap3: SIGIL + ".cap3", alpha: SIGIL + ".alpha" };
    const DEFAULT_QUOTE = "In love with moment rn<3";
    const DEFAULT_IP = "Japan";
    const DEFAULT_CAP = "";   
    const SIG = "data-sententiola-sig";

    let disposed = false;
    let raf = 0, again = false;
    const unsubs = [];
    const panels = new Set();

    const log = (...a) => { try { ctx.system.log("[Sententiola标题栏]", ...a); } catch (_) {} };
    const get = (k) => Promise.resolve(ctx.system.storage.get(k));
    const set = (k, v) => Promise.resolve(ctx.system.storage.set(k, v));
    const on = (t, e, f) => { t.addEventListener(e, f); return () => t.removeEventListener(e, f); };
    const enabled = () => ctx.system.settings.get("enabled") !== false;
    const excluded = () => String(ctx.system.settings.get("excludedSessions") || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const isAssistant = (sid) => !sid || sid === "mascot" || sid.indexOf("mascot") === 0;

    unsubs.push(ctx.ui.injectCSS(
      '.tb-panel{display:flex;flex-direction:column;gap:8px;font-size:12px;color:#3c4654}' +
      '.tb-panel-title{font-weight:700;color:#1b1d21;margin-bottom:2px}' +
      '.tb-panel-row{display:flex;align-items:center;gap:10px;min-width:0}' +
      '.tb-panel-row input[type=text]{flex:1;min-width:0;padding:5px 8px;border:1px solid #dfe2e6;border-radius:6px;font-size:12px;outline:none}' +
      '.tb-panel-row input[type=file]{display:none}' +
      '.tb-file-state{display:inline-flex;align-items:center;padding:4px 10px;border:1px solid #dfe2e6;' +
        'border-radius:999px;font-size:11px;color:#5c6472;background:#f7f8fa;white-space:nowrap;cursor:pointer}' +
      '.tb-file-state:hover{border-color:#64646F}' +
      '.tb-file-state[data-tb-uploaded="1"]{color:#fff;background:#64646F;border-color:#64646F;font-weight:600}'
    ));

    function sessionIdOf(w) {
      const m = String(w.className || "").match(/session-([\w-]+)/);
      return m ? m[1] : null;
    }
    function hasSigil(w) {
      let v = "";
      try { v = getComputedStyle(w).getPropertyValue(PETRICHOR).trim(); } catch (_) {}
      return v !== "" && Number(v) > 0;
    }
    function isActive(w) {
      const layer = w.closest ? w.closest(".chat-room-layer") : null;
      if (layer && (layer.style.display === "none" || getComputedStyle(layer).display === "none")) return false;
      return true;
    }
    
    function eligible(w) {
      if (!w || !w.closest) return false;
      if (!enabled()) return false;
      const sid = sessionIdOf(w);
      if (isAssistant(sid)) return false;
      if (excluded().indexOf(sid) !== -1) return false;
      if (!hasSigil(w)) return false;
      if (!isActive(w)) return false;
      return true;
    }
    function eligibleShells() {
      return [...document.querySelectorAll(".chat-room-wrapper")].filter(eligible);
    }

    function makeRoot(host, shell) {
      let root = host.querySelector("[" + ROOT + "]");
      if (root) return root;
      root = document.createElement("div");
      root.className = "tb-root";
      root.setAttribute(ROOT, "");
      
      root.innerHTML =
        '<div class="tb-cover" data-tb-cover></div>' +
        '<div class="tb-white"></div>' +
        '<div class="tb-avatar" data-tb-avatar></div>' +
        '<div class="tb-active"><span class="tb-active-txt">Active now</span>' +
          '<span class="tb-typing" data-tb-typing="0"><span class="chat-typing-dots"><i></i><i></i><i></i></span></span></div>' +
        '<div class="tb-ip-row">' +
          '<div class="tb-ip">Based in: <span data-tb-ip-val></span></div>' +
          '<div class="tb-cap"><span class="tb-cap-text" data-tb-cap="1"></span></div>' +
          '<div class="tb-cap"><span class="tb-cap-text" data-tb-cap="2"></span></div>' +
          '<div class="tb-cap"><span class="tb-cap-text" data-tb-cap="3"></span></div>' +
        '</div>' +
        '<div class="tb-quote" data-tb-quote></div>' +
        '<div class="tb-tabs">' +
          '<span class="tb-tab tb-tab-active" data-tb-tab="post"><span class="tb-tab-svg">' + TAB_ICONS.post + '</span>Posts</span>' +
          '<span class="tb-tab" data-tb-tab="save"><span class="tb-tab-svg">' + TAB_ICONS.save + '</span>Saved</span>' +
          '<span class="tb-tab" data-tb-tab="like"><span class="tb-tab-svg">' + TAB_ICONS.like + '</span>Likes</span>' +
        '</div>';
      host.appendChild(root);
      const back = shell.querySelector(".page-header-content > .page-back-btn");
      const more = shell.querySelector(".page-header-right .page-back-btn");
      if (back) back.setAttribute(KEEP_BACK, "");
      if (more) more.setAttribute(KEEP_MORE, "");
      return root;
    }

    function cleanupShell(shell) {
      const host = shell.querySelector(".chat-plugin-header");
      if (host) {
        const root = host.querySelector("[" + ROOT + "]");
        if (root) root.remove();
      }
      ["--tb-cover-img", "--tb-avatar-img", "--tb-quote-text", "--tb-only"].forEach((v) => shell.style.removeProperty(v));
      shell.removeAttribute(READY);
      shell.removeAttribute(SIG);
      shell.querySelectorAll("[" + KEEP_BACK + "],[" + KEEP_MORE + "]").forEach((b) => {
        b.removeAttribute(KEEP_BACK); b.removeAttribute(KEEP_MORE);
      });
    }

    function apply(storage) {
      if (disposed) return;
      const good = eligibleShells();
      const vals = [storage.cover, storage.avatar, storage.quote, storage.ip,
                    storage.cap1, storage.cap2, storage.cap3, storage.alpha];
      const sig = vals.map(shortSig).join("|");

      document.querySelectorAll("[" + READY + "]").forEach((shell) => {
        if (!shell.isConnected) cleanupShell(shell);
      });

      good.forEach((shell) => {
        const host = shell.querySelector(".chat-plugin-header");
        if (!host) return;
        const root = makeRoot(host, shell);
        const coverCss = storage.cover ? 'url("' + storage.cover + '")' : "";
        const avatarCss = storage.avatar ? 'url("' + storage.avatar + '")' : "";
        const put = (el, key, val) => {
          if (!el) return;
          const cur = el.style.getPropertyValue(key);
          if (val && cur !== val) el.style.setProperty(key, val);
          else if (!val && cur) el.style.removeProperty(key);
        };
        put(root, "--tb-cover-img", coverCss);
        put(shell, "--tb-cover-img", coverCss);
        const aRaw = String(storage.alpha == null ? "" : storage.alpha).trim();
        const aNum = Number(aRaw);
        const alphaVal = aRaw !== "" && isFinite(aNum) && aNum >= 0 && aNum <= 1 ? aRaw : "";
        put(root, "--tb-panel-alpha", alphaVal);
        put(shell, "--tb-panel-alpha", alphaVal);
        put(root, "--tb-avatar-img", avatarCss);
        put(shell, "--tb-avatar-img", avatarCss);

        const ty = shell.querySelector(".chat-typing-indicator");
        const on = ty ? "1" : "0";
        const full = sig + "|" + on;
        if (shell.getAttribute(SIG) === full) return;
        const q = root.querySelector("[data-tb-quote]");
        if (q) q.textContent = storage.quote || DEFAULT_QUOTE;
        const ip = root.querySelector("[data-tb-ip-val]");
        if (ip) ip.textContent = storage.ip || DEFAULT_IP;
        root.querySelectorAll("[data-tb-cap]").forEach((el) => {
          const n = el.getAttribute("data-tb-cap");
          el.textContent = storage["cap" + n] || DEFAULT_CAP;
        });
        const tel = root.querySelector("[data-tb-typing]");
        if (tel && tel.getAttribute("data-tb-typing") !== on) tel.setAttribute("data-tb-typing", on);
        shell.setAttribute(SIG, full);
        shell.setAttribute(READY, "");
      });
    }

    function sync() {
      Promise.all([get(K.cover), get(K.avatar), get(K.quote), get(K.ip), get(K.cap1), get(K.cap2), get(K.cap3), get(K.alpha)])
        .then(([cover, avatar, quote, ip, cap1, cap2, cap3, alpha]) => {
          apply({ cover, avatar, quote, ip, cap1, cap2, cap3, alpha });
          refreshPanelStates({ avatar: avatar || "", cover: cover || "" });
        })
        .catch((e) => log("读取失败", e));
    }
    function schedule() {
      if (raf) { again = true; return; }
      raf = requestAnimationFrame(() => {
        raf = 0;
        sync();
        if (again) { again = false; schedule(); }
      });
    }

    
    function refreshPanelStates(known) {
      const task = known ? Promise.resolve(known)
        : Promise.all([get(K.avatar), get(K.cover)]).then(([avatar, cover]) => ({ avatar, cover }));
      task.then((vals) => {
        panels.forEach((box) => {
          if (!box.isConnected) return;
          Object.keys(vals).forEach((k) => {
            if (vals[k] === undefined) return;
            const s = box.querySelector('[data-tb-state="' + k + '"]');
            if (!s) return;
            const has = typeof vals[k] === 'string' && vals[k].length > 0;
            const want = has ? '1' : '0';
            if (s.getAttribute('data-tb-uploaded') === want) return;
            s.textContent = has ? '上传成功 · 点击换图' : '点击上传图片';
            s.setAttribute('data-tb-uploaded', want);
          });
        });
      }).catch(() => {});
    }

    function buildPanel(el) {
      if (el.querySelector("[data-tb-panel]")) return;
      const box = document.createElement("div");
      box.setAttribute("data-tb-panel", "");
      box.className = "tb-panel";
      box.innerHTML =
        '<div class="tb-panel-title">标题栏 · 图片与文案</div>' +
        '<div class="tb-panel-row"><span>头像</span>' +
          '<input type="file" accept="image/*" data-tb-file="avatar" hidden>' +
          '<span class="tb-file-state" data-tb-state="avatar">点击上传图片</span></div>' +
        '<div class="tb-panel-row"><span>背景图</span>' +
          '<input type="file" accept="image/*" data-tb-file="cover" hidden>' +
          '<span class="tb-file-state" data-tb-state="cover">点击上传图片</span></div>' +
        '<label class="tb-panel-row">文案<input type="text" data-tb-text="quote" placeholder="点击自定义文案"></label>' +
        '<label class="tb-panel-row">Based in<input type="text" data-tb-text="ip" placeholder="Japan"></label>' +
        '<label class="tb-panel-row">胶囊 1<input type="text" data-tb-cap-input="1" placeholder="自定义（最多 4 字）"></label>' +
        '<label class="tb-panel-row">胶囊 2<input type="text" data-tb-cap-input="2" placeholder="自定义（最多 4 字）"></label>' +
        '<label class="tb-panel-row">胶囊 3<input type="text" data-tb-cap-input="3" placeholder="自定义（最多 4 字）"></label>' +
        '<label class="tb-panel-row">白区透明度<input type="text" data-tb-alpha placeholder="0.7（自己写 0~1）"></label>';
      el.appendChild(box);
      panels.add(box);
      const forceImage = (key, val) => {
        const varName = key === K.avatar ? "--tb-avatar-img" : "--tb-cover-img";
        const css = val ? 'url("' + val + '")' : "";
        let n = 0;
        document.querySelectorAll(".chat-room-wrapper").forEach(shell => {
          try {
            if (css) shell.style.setProperty(varName, css);
            else shell.style.removeProperty(varName);
            n++;
            const r = shell.querySelector(".tb-root");
            if (r) {
              if (css) r.style.setProperty(varName, css);
              else r.style.removeProperty(varName);
            }
          } catch (_) {}
        });
        return n;
      };
      const readFile = (file, key, state, isAvatar) => {
        if (!file) return;
        if (file.type && String(file.type).indexOf("image/") !== 0) {
          if (state) state.textContent = "请选择图片文件";
          return;
        }
        const fr = new FileReader();
        fr.onerror = () => { log("图片读取失败"); if (state) state.textContent = "读取失败 · 点击重试"; };
        fr.onload = () => {
          const raw = String(fr.result || "");
          if (!raw) { if (state) state.textContent = "读取为空 · 点击重试"; return; }
          forceImage(key, raw);
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            sync();
            refreshPanelStates();
            schedule();
            if (state && document.querySelector(".tb-avatar")) {
              state.textContent = "上传成功 · 点击换图";
              state.setAttribute("data-tb-uploaded", "1");
            }
          };
          try {
            Promise.resolve(set(key, raw)).then(done, () => {
              if (state) state.textContent = "保存失败 · 点击重试";
              done();
            });
          } catch (_) { done(); }
          setTimeout(done, 1200);
          withTimeout(shrinkImage(raw, isAvatar), 4000, raw).then((small) => {
            if (!small || small === raw) return;
            forceImage(key, small);
            try {
              Promise.resolve(set(key, small)).then(() => { sync(); schedule(); }, () => {});
            } catch (_) {}
          });
        };
        fr.readAsDataURL(file);
      };
      box.querySelectorAll("[data-tb-file]").forEach((input) => {
        const kind = input.getAttribute("data-tb-file");
        const state = box.querySelector('[data-tb-state="' + kind + '"]');
        unsubs.push(on(input, "change", () => {
          const f = input.files && input.files[0];
          if (f) readFile(f, kind === "avatar" ? K.avatar : K.cover, state, kind === "avatar");
        }));
      });
      box.querySelectorAll("[data-tb-text]").forEach((input) => {
        const key = input.getAttribute("data-tb-text") === "quote" ? K.quote : K.ip;
        get(key).then((v) => { if (typeof v === "string") input.value = v; });
        
        unsubs.push(on(input, "input", () => { set(key, input.value); schedule(); }));
      });
      box.querySelectorAll("[data-tb-cap-input]").forEach((input) => {
        const n = input.getAttribute("data-tb-cap-input");
        const key = K["cap" + n];
        get(key).then((v) => { if (typeof v === "string") input.value = v; });
        unsubs.push(on(input, "input", () => { set(key, input.value); schedule(); }));
      });
      box.querySelectorAll("[data-tb-alpha]").forEach((input) => {
        get(K.alpha).then((v) => { if (typeof v === "string") input.value = v; });
        unsubs.push(on(input, "input", () => { set(K.alpha, input.value); schedule(); }));
      });
      
      box.querySelectorAll("[data-tb-state]").forEach((state) => {
        const k = state.getAttribute("data-tb-state");
        const inp = box.querySelector('[data-tb-file="' + k + '"]');
        unsubs.push(on(state, "click", () => { if (inp) inp.click(); }));
      });
      
      refreshPanelStates();
    }

    unsubs.push(ctx.ui.slot("chat.header", (el) => {
      const shell = el && el.closest ? el.closest(".chat-room-wrapper") : null;
      if (!eligible(shell)) return;
      makeRoot(el, shell);
      schedule();
    }));
    unsubs.push(ctx.ui.slot("settings.section", (el) => { buildPanel(el); }));
    unsubs.push(ctx.hooks.on("session.opened", schedule));
    unsubs.push(ctx.hooks.on("plugins.changed", schedule));

    const mo = new MutationObserver((recs) => {
      if (!keepExternal(recs)) return;
      mo.takeRecords();
      schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      again = false;
      mo.disconnect();
      unsubs.forEach((fn) => { try { fn(); } catch (_) {} });
      document.querySelectorAll(".chat-room-wrapper").forEach(cleanupShell);
      panels.forEach((p) => p.remove());
      void ID;
    };
}

function setupBubble(ctx) {

    
    const PETRICHOR = "--quietora-sigil";   
    const OLD_SIGIL = "--sensiculus-sigil"; 
    const BB_BG = "--bb-self-bg";           
    const HMARK = "data-petrichor-h";
    const SMARK = "data-petrichor-scope";
    const HVAR = "--trans-h";
    let transRaf = 0, transTimer = 0, lastTransRun = 0;
    let observer = null;
    let disposed = false;
    const unsubs = [];

    const enabled = () => ctx.system.settings.get("enabled") !== false;
    const transOn = () => ctx.system.settings.get("transFit") !== false;
    const excluded = () => String(ctx.system.settings.get("excludedSessions") || "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const isAssistant = (sid) => !sid || sid === "mascot" || sid.indexOf("mascot") === 0;

    function sessionIdOf(node) {
      const w = node && node.closest ? node.closest(".chat-room-wrapper") : null;
      if (!w) return null;
      const m = String(w.className || "").match(/session-([\w-]+)/);
      return m ? m[1] : null;
    }
    function isActive(node) {
      const layer = node.closest ? node.closest(".chat-room-layer") : null;
      if (layer && (layer.style.display === "none" || getComputedStyle(layer).display === "none")) return false;
      return true;
    }
    function hasSigil(w) {
      if (!w) return false;
      let sig = "", old = "", bg = "";
      try {
        const cs = getComputedStyle(w);
        sig = cs.getPropertyValue(PETRICHOR).trim();
        old = cs.getPropertyValue(OLD_SIGIL).trim();
        bg = cs.getPropertyValue(BB_BG).trim();
      } catch (_) {}
      
      if (bg === "") return false;
      return (Number(sig) > 0) || (Number(old) > 0);
    }
    function readNum(w, key, dflt) {
      let v = NaN;
      try { v = parseFloat(getComputedStyle(w).getPropertyValue(key)); } catch (_) {}
      return isFinite(v) && v >= 0 ? v : dflt;
    }
    function isTransRoom(w) {
      if (!w) return false;
      const layer = w.closest ? w.closest(".chat-room-layer") : null;
      if (layer && (layer.style.display === "none" || getComputedStyle(layer).display === "none")) return false;
      const anchor = w.querySelector(".chat-scroll-anchored") || w.querySelector(".page-body.chat-room-main-pane");
      return !!anchor;
    }
    function transRooms() {
      const out = [];
      const seen = new Set();
      const add = (w) => {
        if (!w || seen.has(w) || !isTransRoom(w)) return;
        const anchor = w.querySelector(".chat-scroll-anchored")
          || w.querySelector(".page-body.chat-room-main-pane");
        if (anchor) { seen.add(w); out.push([w, anchor]); }
      };
      
      document.querySelectorAll(".chat-room-layer").forEach(layer => {
        add(layer.querySelector(".chat-room-wrapper") || layer.closest(".chat-room-wrapper") || layer);
      });
      document.querySelectorAll(".chat-room-wrapper").forEach(add);
      return out;
    }

    function clearTrans() {
      document.querySelectorAll("[" + HMARK + "]").forEach(el => {
        el.style.removeProperty(HVAR);
        el.style.removeProperty("padding-bottom");
        el.removeAttribute(HMARK);
      });
      document.querySelectorAll("[" + SMARK + "]").forEach(el => el.removeAttribute(SMARK));

      document.querySelectorAll(".chat-scroll-anchored > div").forEach(el => {
        if (el.style && el.style.getPropertyValue(HVAR) !== "") el.style.removeProperty(HVAR);
      });
    }

    function measureTrans(w, anchor) {
      const gap = readNum(w, "--trans-gap", 8);
      const tight = readNum(w, "--trans-tight", 16);
      const maxH = Math.max(readNum(w, "--trans-h-max", 600), 20000);
      const shells = Array.prototype.slice.call(anchor.children).filter(el =>
        el && el.nodeType === 1 && getComputedStyle(el).display !== "none");

      const plans = [];
      const perTarget = new Map();
      shells.forEach((shell) => {
        const trs = shell.querySelectorAll(
          ".chat-bubble-role-user .chat-bilingual-section-translation, " +
          ".chat-bubble-role-assistant .chat-bilingual-section-translation");
        trs.forEach((tr) => {
          if (tr.closest(".voice-msg-text-bubble")) return;
          const bub = tr.closest(".chat-bubble-role-user, .chat-bubble-role-assistant");
          if (!bub) return;
          let target = shell;
          const group = tr.closest(".chat-vc-group-border");
          if (group) {
            for (let i = 0; i < group.children.length; i++) {
              if (group.children[i].contains(tr)) { target = group.children[i]; break; }
            }
          }
          const r = tr.getBoundingClientRect(), bb = bub.getBoundingClientRect();
          if (!r.height && !r.width) return;
          let H = Math.ceil(r.bottom - bb.bottom + gap - tight);
          H = Math.max(0, Math.min(maxH, H));
          const prev = perTarget.get(target);
          if (prev === undefined || H > prev) perTarget.set(target, H);
        });
      });
      perTarget.forEach((H, target) => plans.push([target, H + "px"]));

      const planned = new Set(plans.map(p => p[0]));
      document.querySelectorAll("[" + HMARK + "]").forEach(el => {
        if (planned.has(el) || el.closest(".chat-room-wrapper") !== w) return;
        el.style.removeProperty(HVAR);
        el.style.removeProperty("padding-bottom");
        el.removeAttribute(HMARK);
        el.removeAttribute(SMARK);
      });
      plans.forEach(pair => {
        const shell = pair[0], val = pair[1];
        if (!shell.hasAttribute(SMARK)) shell.setAttribute(SMARK, "");
        const cur = shell.style.getPropertyValue(HVAR);
        if (cur === val) return;
        const curN = parseFloat(cur), valN = parseFloat(val);
        if (isFinite(curN) && Math.abs(curN - valN) < 1) return;
        shell.style.setProperty(HVAR, val);
        shell.style.setProperty("padding-bottom", (valN + gap) + "px", "important");
        if (shell.getAttribute(HMARK) !== val) shell.setAttribute(HMARK, val);
      });
    }

    function transScan() {
      if (disposed) return;
      if (!enabled() || !transOn()) { clearTrans(); return; }
      const rooms = transRooms();
      if (!rooms.length) return;

      document.querySelectorAll("[" + HMARK + "]").forEach(el => {
        const w = el.closest(".chat-room-wrapper");
        if (!isTransRoom(w)) {
          el.style.removeProperty(HVAR);
          el.style.removeProperty("padding-bottom");
          el.removeAttribute(HMARK);
          el.removeAttribute(SMARK);
        }
      });
      rooms.forEach(pair => measureTrans(pair[0], pair[1]));
    }

    function scheduleTrans() {
      if (disposed) return;
      const now = Date.now();
      const wait = Math.max(0, 64 - (now - lastTransRun));
      if (transRaf || transTimer) return;
      if (wait === 0) {
        transRaf = requestAnimationFrame(() => {
          transRaf = 0; lastTransRun = Date.now(); transScan();
        });
      } else {
        transTimer = setTimeout(() => {
          transTimer = 0;
          transRaf = requestAnimationFrame(() => {
            transRaf = 0; lastTransRun = Date.now(); transScan();
          });
        }, wait);
      }
    }

    unsubs.push(ctx.hooks.on("app.ready", () => { scheduleTrans(); }));
    unsubs.push(ctx.hooks.on("session.opened", () => { scheduleTrans(); }));
    unsubs.push(ctx.hooks.on("plugins.changed", () => { scheduleTrans(); }));
    try { unsubs.push(ctx.system.settings.onChange(() => { scheduleTrans(); })); } catch (_) {}
    try {
      observer = new MutationObserver((recs) => {
        if (!keepExternal(recs)) return;
        observer.takeRecords();
        scheduleTrans();
      });
      observer.observe(document.body, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["style", "class"]
      });
    } catch (_) {}

    scheduleTrans();

    return () => {
      disposed = true;
      if (observer) observer.disconnect();
      if (transRaf) cancelAnimationFrame(transRaf);
      if (transTimer) clearTimeout(transTimer);
      unsubs.forEach((u) => { try { if (typeof u === "function") u(); } catch (_) {} });
      clearTrans();
    };
}

function setupSententiolaInfo(ctx) {
  const MARK = "data-sententiola-info";
  const STAMP = "data-sententiola-stamp";
  const KEY = "data-sententiola-key";
  let disposed = false, raf = 0, mo = null;
  const unsubs = [];
  const excluded = () => String(ctx.system.settings.get("excludedSessions") || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const sidOf = w => { const m = String(w.className || "").match(/session-([\w-]+)/); return m ? m[1] : null; };
  function isActive(w) {
    const layer = w.closest ? w.closest(".chat-room-layer") : null;
    if (layer && (layer.style.display === "none" || getComputedStyle(layer).display === "none")) return false;
    return true;
  }
  function eligible(w) {
    if (!w) return false;
    const sid = sidOf(w);
    if (!sid || sid === "mascot" || sid.indexOf("mascot") === 0) return false;
    if (excluded().indexOf(sid) >= 0) return false;
    if (!isActive(w)) return false;
    let sig = "", bg = "";
    try { const cs = getComputedStyle(w);
      sig = cs.getPropertyValue("--quietora-sigil").trim() || cs.getPropertyValue("--sensiculus-sigil").trim();
      bg = cs.getPropertyValue("--bb-self-bg").trim();
    } catch (_) {}
    return bg !== "" && Number(sig) > 0;
  }
  function rooms() {
    const out = [], seen = new Set();
    document.querySelectorAll(".chat-room-wrapper").forEach(w => {
      if (seen.has(w) || !eligible(w)) return;
      const anc = w.querySelector(".chat-scroll-anchored") || w.querySelector(".page-body.chat-room-main-pane");
      if (anc) { seen.add(w); out.push([w, anc]); }
    });
    return out;
  }
  function netName(w) {
    const t = w.querySelector(".page-title");
    if (!t) return "";
    let s = "";
    for (const n of t.childNodes) {
      if (n.nodeType === 3) s += String(n.textContent || "");
    }
    return s.trim();
  }
  const SELF_NAME = "user";
  function selfName(w) {
    let raw = null;
    try {
      const v = getComputedStyle(w).getPropertyValue("--bb-info-self-name");
      if (v && v.trim()) raw = v.trim();
    } catch (_) {}
    if (raw === null) return SELF_NAME;
    return raw.replace(/^["']|["']$/g, "").trim();
  }
  function fmt(d) {
    const h = d.getHours(), ap = h >= 12 ? "PM" : "AM";
    return (h % 12 || 12) + ":" + String(d.getMinutes()).padStart(2, "0") + " " + ap;
  }
  function parse(v) {
    if (!v) return null;
    const num = Number(v);
    const d = new Date(isFinite(num) && num > 0 ? num : v);
    return isNaN(d.getTime()) ? null : d;
  }
  function fromBar(text) {
    const m = String(text || "").match(/(\d{1,2}):(\d{2})/);
    if (!m) return "";
    const h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return "";
    return (h % 12 || 12) + ":" + String(mi).padStart(2, "0") + " " + (h >= 12 ? "PM" : "AM");
  }
  function barOf(shell) {
    if (!shell) return "";
    const bars = shell.querySelectorAll(":scope > .chat-sys-msg, :scope > div > .chat-sys-msg");
    for (const bar of bars) { const t = fromBar(bar.textContent); if (t) return t; }
    return "";
  }
  function pickStamp(wrap, msgId, last) {
    const shell = wrap.parentElement;
    let t = barOf(shell);
    if (t) return t;
    const ms = String(wrap.id || "").match(/ui-transient-(\d{13})/);
    if (ms) { const d = new Date(Number(ms[1])); if (!isNaN(d.getTime())) return fmt(d); }
    let prev = shell && shell.previousElementSibling, hops = 0;
    while (prev && hops < 40) {
      t = barOf(prev);
      if (t) return t;
      prev = prev.previousElementSibling; hops++;
    }
    try {
      const list = ctx.data && ctx.data.messages && ctx.data.messages.list ? ctx.data.messages.list() : [];
      const m = (list || []).find(x => String(x.id) === String(msgId) || String(x.msgId) === String(msgId));
      if (m) { const d = parse(m.createdAt || m.timestamp || m.time || m.created_at); if (d) return fmt(d); }
    } catch (_) {}
    return last.value || "";
  }
  function sync() {
    if (disposed) return;
    rooms().forEach(pair => {
      const w = pair[0], name = netName(w), self = selfName(w);
      const last = { value: "" };
      const wanted = new Set();
      w.querySelectorAll(".chat-msg-wrapper[data-role]:not([data-reasoning-row]):not([data-consecutive])").forEach(wrap => {
        if (!wrap.querySelector(":scope > .chat-msg-avatar")) return;
        const bub = wrap.querySelector(".chat-bubble-role-user,.chat-bubble-role-assistant");
        if (!bub) return;
        const role = wrap.getAttribute("data-role");
        const msgId = bub.getAttribute("data-msg-id") || "";
        let info = wrap.querySelector(":scope > .bb-info");
        if (!info) {
          info = document.createElement("div");
          info.className = "bb-info";
          info.setAttribute(MARK, "");
          wrap.appendChild(info);
        }
        let stamp = "";
        let html;
        if (role === "user") {
          stamp = pickStamp(wrap, msgId, last);
          if (stamp) last.value = stamp;
          html = '<span class="bb-info-name">' + esc(self) + '</span><span class="bb-info-sub bb-info-time">' + esc(stamp) + '</span>';
          info.setAttribute(STAMP, stamp);
        } else {
          html = '<span class="bb-info-name">' + esc(name) + '</span><span class="bb-info-sub"><i class="bb-info-icon"></i>回復訊息</span>';
        }
        const key = role + "|" + name + "|" + self + "|" + msgId + "|" + stamp;
        if (info.getAttribute(KEY) !== key) {
          info.innerHTML = html;
          info.setAttribute(KEY, key);
        }
        wanted.add(wrap);
      });
      w.querySelectorAll(".bb-info[" + MARK + "]").forEach(el => {
        if (!wanted.has(el.parentElement)) el.remove();
      });
    });
  }
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; sync(); });
  }
  try { unsubs.push(ctx.hooks.on("app.ready", schedule)); } catch (_) {}
  try { unsubs.push(ctx.hooks.on("session.opened", schedule)); } catch (_) {}
  try { unsubs.push(ctx.hooks.on("message.persisted", schedule)); } catch (_) {}
  try { unsubs.push(ctx.hooks.on("plugins.changed", schedule)); } catch (_) {}
  try { unsubs.push(ctx.system.settings.onChange(schedule)); } catch (_) {}
  try {
    mo = new MutationObserver((recs) => {
      if (!keepExternal(recs)) return;
      mo.takeRecords();
      schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "data-consecutive"] });
  } catch (_) {}
  sync();
  return () => {
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    if (mo) mo.disconnect();
    unsubs.forEach(u => { try { if (typeof u === "function") u(); } catch (_) {} });
    document.querySelectorAll("[" + MARK + "]").forEach(el => el.remove());
  };
}
