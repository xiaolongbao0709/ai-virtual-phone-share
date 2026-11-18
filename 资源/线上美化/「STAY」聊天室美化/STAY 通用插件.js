/* STAY / Float · independently authored presentation adapter · ee × codex */
export default {
  manifest: {
    id: 'unit-89757-float-room', name: 'STAY·昼', apiVersion: 1,
    version: '1.0.25', author: 'ee × codex',
    description: '连续文字、语音、表情包与引用只在首条显示姓名和时间；有气泡时间时隐藏重复的居中时间提示。',
    permissions: ['ui', 'chat.read'],
    settings: [{key: 'motion', label: '界面动效', type: 'boolean', default: true},{key:'rain',label:'背景数据雨',type:'boolean',default:true},{key:'rainOpacity',label:'数据雨透明度',type:'select',default:'18',options:[{value:'8',label:'8% 很淡'},{value:'13',label:'13% 柔和'},{value:'18',label:'18% 标准'},{value:'25',label:'25% 明显'},{value:'35',label:'35% 高亮'}]},{key:'rainSpeed',label:'数据雨速度',type:'select',default:'normal',options:[{value:'slow',label:'慢速'},{value:'normal',label:'标准'},{value:'fast',label:'快速'}]}],
  },
  setup(ctx) {
    const controllers = new Set();
    const off = [];
    let stopped = false, panelSequence = 0;

    function rainHex(value) {if(typeof value!=='string')return '';const s=value.trim();if(/^#[0-9a-f]{6}$/i.test(s))return s.toLowerCase();if(/^#[0-9a-f]{3}$/i.test(s))return '#'+s.slice(1).split('').map(c=>c+c).join('').toLowerCase();return '';}
    function mountRainSettings(host) {
      let disposed=false;const box=document.createElement('div');box.style.cssText='display:flex;flex-direction:column;gap:8px;color:var(--c-text-title);';
      const label=document.createElement('span');label.textContent='数据雨颜色';
      const row=document.createElement('div');row.style.cssText='display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
      const picker=document.createElement('input');picker.type='color';picker.setAttribute('aria-label','选择数据雨颜色');picker.style.cssText='width:44px;height:36px;padding:2px;border:1px solid var(--c-panel-border);border-radius:4px;background:var(--c-panel);';
      const code=document.createElement('input');code.type='text';code.maxLength=7;code.placeholder='#RRGGBB';code.setAttribute('aria-label','数据雨颜色代码');code.style.cssText='width:105px;min-height:36px;padding:5px 8px;border:1px solid var(--c-panel-border);border-radius:4px;background:var(--c-input);color:var(--c-text-title);font-size:14px;';
      const reset=document.createElement('button');reset.type='button';reset.textContent='跟随主题';reset.style.cssText='min-height:36px;padding:5px 10px;border:1px solid var(--c-panel-border);border-radius:4px;background:var(--c-panel);color:var(--c-text-title);';
      const status=document.createElement('span');status.setAttribute('role','status');status.style.cssText='font-size:12px;color:var(--c-text);';
      const defaultColor=()=>Array.from(controllers).map(c=>c.rainDefault()).find(Boolean)||'#7087b0';
      const render=()=>{if(disposed)return;const selected=rainHex(ctx.system.settings.get('rainColor'));picker.value=selected||defaultColor();code.value=selected;status.textContent=selected?'普通字符与歌词共用此颜色':'当前跟随主题，普通字符与歌词同色';};
      const save=value=>{const selected=rainHex(value);if(!selected){status.textContent='请输入有效的 #RRGGBB 颜色';return;}ctx.system.settings.set('rainColor',selected);render();};
      picker.addEventListener('change',()=>save(picker.value));code.addEventListener('change',()=>save(code.value));reset.addEventListener('click',()=>{ctx.system.settings.set('rainColor','');render();});
      row.append(picker,code,reset);box.append(label,row,status);host.append(box);render();const unwatch=ctx.system.settings.onChange(render);
      return ()=>{disposed=true;unwatch();box.remove();};
    }

    function mountHeader(host, props) {
      const room = host.closest('.chat-room-wrapper');
      if (!room || stopped) return;
      let dead = false, frame = 0, consoleNode = null, enabled = false;
      let press = null, composer = null, observedInput = null, pendingRich = null, richTimer = 0;
      const messages = new Map(), styleOriginals = new Map();
      const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
      let motionEnabled=false, motionPrimed=false, seenIds=new Set(), newestStamp=0;
      let pendingSend=null, sendExpiry=0, packetJob=null;
      const errorViews=new Map(),offlineViews=new Map();
      const effectJobs=new Map();let rain=null,rainUnit='',rainSpeed='',lastLyricAt=Date.now();
      // Originals are stored only for live nodes; detached message nodes are pruned.
      const originals = new Map();
      const own = new Set();
      const mark = (node, name, value) => {
        if (!node) return;
        if (!originals.has(node)) originals.set(node, new Map());
        const saved = originals.get(node);
        if (!saved.has(name)) saved.set(name, node.getAttribute(name));
        if (value === null) { if (node.hasAttribute(name)) node.removeAttribute(name); }
        else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value));
      };
      function restoreNode(node, values) {
        for (const [key, value] of values) {
          if (value === null) node.removeAttribute(key); else node.setAttribute(key, value);
        }
      }
      function restoreKeys(node, keys) {
        const values=originals.get(node);if(!values)return;
        for(const key of keys)if(values.has(key)){const value=values.get(key);if(value===null){if(node.hasAttribute(key))node.removeAttribute(key);}else if(node.getAttribute(key)!==value)node.setAttribute(key,value);values.delete(key);}
        if(!values.size)originals.delete(node);
      }
      function prune() {
        for (const [node, values] of originals) {
          if (node !== room && !room.contains(node)) { restoreNode(node, values); originals.delete(node); }
        }
        const liveIds=new Set(Array.from(room.querySelectorAll('[data-msg-id]'),n=>n.getAttribute('data-msg-id')));
        for (const id of messages.keys()) if (!liveIds.has(id)) messages.delete(id);
        for(const node of own)if(!room.contains(node)){sizes?.unobserve(node);own.delete(node);}
      }
      const setStyle = (key, value) => {
        if (!styleOriginals.has(key)) styleOriginals.set(key, [room.style.getPropertyValue(key),room.style.getPropertyPriority(key)]);
        if (room.style.getPropertyValue(key) !== value) room.style.setProperty(key,value);
      };
      const text = (parent, cls, value) => {
        const node = document.createElement('span'); node.className = cls;
        node.textContent = value; parent.append(node); return node;
      };
      function pixelIcon(kind) {
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
        svg.setAttribute('viewBox',kind==='settings'?'0 0 20 20':'0 0 16 16');
        svg.setAttribute('width','16');svg.setAttribute('height','16');svg.setAttribute('aria-hidden','true');
        const path=document.createElementNS(svg.namespaceURI,'path');
        path.setAttribute('fill','currentColor');path.setAttribute('fill-rule','evenodd');
        const shapes={back:'M7 2H5V4H3V6H1V8H3V10H5V12H7V10H5V8H15V6H5V4H7Z',settings:'M8 2h4v3h3v3h3v4h-3v3h-3v3H8v-3H5v-3H2V8h3V5h3Z M8 8h4v4H8Z',monitor:'M1 1H15V11H9V13H12V15H4V13H7V11H1Z M2 2V10H14V2Z',wallet:'M1 3H13V5H15V13H1Z M3 5V11H13V9H9V7H13V5Z M3 1H12V3H3Z M10 7H12V9H10Z',packet:'M2 1H14V15H2Z M4 3V5H6V7H10V5H12V3Z M4 7V13H12V7H10V9H6V7Z',note:'M5 2H14V11H12V13H9V9H12V5H7V13H5V15H2V11H5Z'};
        path.setAttribute('d',shapes[kind]);svg.append(path);return svg;
      }
      function bilingualBlock(bubble) {return bubble?.querySelector(':scope > .chat-bilingual-block, :scope > .chat-quote-message > .chat-bilingual-block');}
      function canMove() {return enabled&&!dead&&motionEnabled&&!document.hidden;}
      function clearRowEffect(row) {
        const job=effectJobs.get(row);if(!job)return;
        window.clearTimeout(job.timer);restoreKeys(job.face,['data-u89-charge']);
        if(job.quote)restoreKeys(job.quote,['data-u89-history-call']);effectJobs.delete(row);
      }
      function clearPacket() {if(packetJob){window.clearTimeout(packetJob.timer);window.clearTimeout(packetJob.pressTimer);composer?.send.removeAttribute('data-u89-pressed');packetJob.node.remove();own.delete(packetJob.node);packetJob=null;}}
      function cancelSubmission() {if(sendExpiry)window.clearTimeout(sendExpiry);sendExpiry=0;pendingSend=null;}
      function prepareSubmission(native) {
        cancelSubmission();if(!native?.value.trim())return;
        pendingSend={text:native.value};sendExpiry=window.setTimeout(cancelSubmission,1500);
      }
      function sendPacket() {
        if(!canMove()||!composer)return;clearPacket();
        const line=composer.footer.querySelector('.u89-compose-line'),field=composer.footer.querySelector('.u89-input-field'),a=line.getBoundingClientRect(),b=field.getBoundingClientRect();
        const node=document.createElement('span');node.className='u89-packets';node.dataset.u89Owned='';node.setAttribute('aria-hidden','true');
        node.style.left=(b.left-a.left)+'px';node.style.width=b.width+'px';node.style.setProperty('--u89-travel',(b.width+36)+'px');
        node.append(document.createElement('i'));line.append(node);own.add(node);
        packetJob={node,pressTimer:window.setTimeout(()=>{if(canMove())composer?.send.setAttribute('data-u89-pressed','');},590),timer:window.setTimeout(clearPacket,800)};
      }
      function confirmSubmission(native) {if(pendingSend&&native.value===''){cancelSubmission();sendPacket();}}
      function clearMotion() {for(const row of Array.from(effectJobs.keys()))clearRowEffect(row);clearPacket();}
      function animateNewRows(rows) {
        let lastKnown=-1;for(let i=0;i<rows.length;i++)if(seenIds.has(rows[i].id))lastKnown=i;
        let nextNewest=newestStamp;
        for(let i=0;i<rows.length;i++){
          const row=rows[i],bubble=row.querySelector('[data-msg-id][data-ui^="bubble-"]');
          const stamp=Date.parse(messages.get(bubble?.getAttribute('data-msg-id'))?.createdAt||'');
          if(!Number.isFinite(stamp))continue;nextNewest=Math.max(nextNewest,stamp);
          if(!motionPrimed||seenIds.has(row.id)||stamp<newestStamp||(lastKnown<0?stamp<=newestStamp:i<=lastKnown)||!canMove()||effectJobs.size>=2)continue;
          const kind=row.getAttribute('data-u89-kind');if(kind!=='text'&&kind!=='audio')continue;
          const bounds=row.getBoundingClientRect(),top=consoleNode.panel.getBoundingClientRect().bottom,bottom=composer.footer.getBoundingClientRect().top;
          if(bounds.bottom<=top||bounds.top>=bottom)continue;
          const face=bilingualBlock(bubble)?.querySelector(':scope > .chat-bilingual-section:first-child')||bubble.querySelector(':scope > .chat-quote-message > div:not(.chat-quote-preview)')||bubble;
          const quote=bubble.querySelector('.chat-quote-preview');
          mark(face,'data-u89-charge','');if(quote)mark(quote,'data-u89-history-call','');
          const job={face,quote,timer:window.setTimeout(()=>clearRowEffect(row),620)};effectJobs.set(row,job);
        }
        for(const row of Array.from(effectJobs.keys()))if(!room.contains(row))clearRowEffect(row);
        newestStamp=nextNewest;seenIds=new Set(rows.map(r=>r.id));motionPrimed=true;
      }
      function hideCenterTimes(rows) {
        const body=room.querySelector('.page-body.chat-room-main-pane');if(!body)return;
        const hidden=new Set();
        for(const row of rows){
          const wrap=row.querySelector(':scope > .chat-msg-content-wrap');
          if(!body.contains(row)||!wrap?.getAttribute('data-u89-time'))continue;
          let anchor=row;while(anchor.parentElement&&anchor.parentElement!==body)anchor=anchor.parentElement;
          // Native online date/time separators only; system messages and offline times keep their own UI.
          const label=anchor.querySelector(':scope > .flex.justify-center > span.chat-sys-msg.select-none');
          const line=label?.parentElement;if(!line)continue;
          hidden.add(line);mark(line,'data-u89-center-time','');
          if(line.style.getPropertyValue('display')!=='none'||line.style.getPropertyPriority('display')!=='important'){
            mark(line,'style',line.getAttribute('style'));
            line.style.setProperty('display','none','important');
          }
        }
        for(const line of body.querySelectorAll('[data-u89-center-time]'))if(!hidden.has(line))restoreKeys(line,['style','data-u89-center-time']);
      }
      function groupMessageRuns(rows,isGroup) {
        const body=room.querySelector('.page-body.chat-room-main-pane');if(!body)return;
        const anchors=new Map(),counts=new Map(),gaps=new Map();
        for(const row of rows){if(!body.contains(row))continue;let anchor=row;while(anchor.parentElement&&anchor.parentElement!==body)anchor=anchor.parentElement;
          anchors.set(row,anchor);counts.set(anchor,(counts.get(anchor)||0)+1);
        }
        let previous=null;
        for(const row of rows){
          if(!anchors.has(row))continue;
          const wrap=row.querySelector(':scope > .chat-msg-content-wrap'),bubble=wrap?.querySelector('[data-msg-id][data-ui^="bubble-"]');
          const anchor=anchors.get(row),m=messages.get(bubble?.getAttribute('data-msg-id')),stamp=Date.parse(m?.createdAt||'');
          const role=row.getAttribute('data-role'),kind=row.getAttribute('data-u89-kind');
          // Stickers and quoted text participate in sender/time grouping; native contents/layout stay intact.
          const conversational=kind==='text'||kind==='audio'||(kind==='media'&&!!bubble?.querySelector(':scope > .chat-sticker'));
          const valid=!!wrap&&!!bubble&&Number.isFinite(stamp)&&(role==='user'||role==='assistant')&&conversational;
          const author=role==='user'?'user':isGroup?(m?.senderCharacterId||m?.senderName||null):'assistant';
          let boundary=false;
          if(previous&&anchor!==previous.anchor){
            let between=previous.anchor.nextElementSibling;
            boundary=between!==anchor;
          }
          const dated=anchor!==row&&!!anchor.querySelector(':scope > .flex.justify-center > .chat-sys-msg, :scope > .chat-offline-time');
          const reasoning=!!row.previousElementSibling?.matches('[data-reasoning-row]');
          const continued=!!(valid&&author&&previous&&!boundary&&!dated&&!reasoning&&previous.author===author&&previous.role===role&&Math.floor(stamp/60000)===previous.minute);
          mark(row,'data-u89-run',continued?'continue':'start');if(wrap)mark(wrap,'data-u89-run',continued?'continue':'start');
          if(continued&&counts.get(anchor)===1)gaps.set(anchor,'compact');
          previous=valid&&author?{anchor,author,role,minute:Math.floor(stamp/60000)}:null;
        }
        for(const anchor of counts.keys())mark(anchor,'data-u89-run-gap',gaps.get(anchor)||null);
      }
      const rainLyrics=['我属于你 没有期限','从这一刻就是你给我的姓名','我行为变得不由自己','主人 我绝对不背叛你','我只是问问我们可以在一起吗 爱我吧'];
      function fillRain(col,forceUnit=false) {
        const pool='001101ABCDEF23456789/:_+>[]',length=8+Math.floor(Math.random()*17);
        let value=Array.from({length},()=>pool[Math.floor(Math.random()*pool.length)]).join('');
        const lyricAllowed=rain&&Date.now()-lastLyricAt>45000&&!rain.querySelector('[data-lyric="true"]');
        const lyric=!forceUnit&&lyricAllowed&&Math.random()<.07;
        if(lyric){value=rainLyrics[Math.floor(Math.random()*rainLyrics.length)];lastLyricAt=Date.now();}
        else if(forceUnit||Math.random()<.08)value=value.slice(0,5)+(forceUnit?rainUnit:['CORE','LINK','SYNC','MEMORY',rainUnit][Math.floor(Math.random()*5)])+value.slice(5);
        col.dataset.lyric=String(lyric);col.textContent=value.split('').join('\n');col.style.left=(2+Math.random()*94)+'%';
      }
      function clearOfflineView(source) {
        const view=offlineViews.get(source);if(!view)return;view.node.remove();own.delete(view.node);restoreKeys(source,['data-u89-offline-rendered','data-u89-source-open']);offlineViews.delete(source);
      }
      function decorateOffline() {
        const candidates=new Set(room.querySelectorAll('.chat-offline-entry[data-role="assistant"] .chat-offline-text .chat-markdown-paragraph, .chat-offline-entry[data-role="assistant"] .chat-offline-text .chat-markdown p'));
        for(const source of Array.from(offlineViews.keys()))if(!room.contains(source)||!candidates.has(source))clearOfflineView(source);
        for(const source of candidates){
          if(source.closest('[data-u89-owned], .chat-bilingual-section-translation')||source.querySelector('a,button,input,iframe,pre,code')||source.parentElement?.tagName!=='DIV')continue;
          const raw=source.textContent.trim(),old=offlineViews.get(source);if(old?.raw===raw&&old.node.isConnected)continue;if(old)clearOfflineView(source);
          const values=[...raw.matchAll(/\[([^\[\]:：\n]{1,16})[:：](-?\d+(?:\.\d+)?)\]/g)];
          const states=values.length>0&&values.length<=10&&values.map(m=>m[0]).join('')===raw.replace(/\s+/g,'');
          const thought=raw.match(/^\[内心\]([\s\S]+?)(?:\[\/内心\]|\[内心\])$/);
          if(!states&&(!thought||/\[\/?内心\]/.test(thought[1])))continue;
          const node=document.createElement('section');node.className='u89-offline-extract';node.dataset.u89Owned='';
          const body=document.createElement('div');body.className=states?'u89-offline-values':'u89-offline-thought';
          if(states){for(const m of values){const cell=document.createElement('div');text(cell,'',m[1]);text(cell,'',m[2]);body.append(cell);}}
          else {text(body,'u89-offline-thought-title','INNER LOG');const content=document.createElement('div');content.textContent=thought[1].trim();body.append(content);}
          const toggle=document.createElement('button');toggle.type='button';toggle.className='u89-offline-source';toggle.textContent='查看原文';toggle.setAttribute('aria-expanded','false');
          toggle.addEventListener('pointerdown',event=>event.stopPropagation());toggle.addEventListener('pointerup',event=>event.stopPropagation());
          toggle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const show=source.getAttribute('data-u89-source-open')!=='true';mark(source,'data-u89-source-open',String(show));body.hidden=show;toggle.textContent=show?'收起原文':'查看原文';toggle.setAttribute('aria-expanded',String(show));});
          node.append(body,toggle);source.before(node);own.add(node);mark(source,'data-u89-offline-rendered','');offlineViews.set(source,{node,raw});
        }
      }
      function clearErrorView(source) {const view=errorViews.get(source);if(!view)return;view.node.remove();own.delete(view.node);restoreKeys(source,['data-u89-error-source']);errorViews.delete(source);}
      function decorateErrors() {
        const candidates=new Set(room.querySelectorAll('.chat-msg-wrapper[data-role="system"] > .chat-sys-msg'));
        for(const source of Array.from(errorViews.keys()))if(!room.contains(source)||!candidates.has(source))clearErrorView(source);
        for(const source of candidates){
          const raw=Array.from(source.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim(),old=errorViews.get(source);
          if(old?.raw===raw&&old.node.isConnected)continue;if(old)clearErrorView(source);
          if(!/^(?:⚠️?\s*)?(?:发送失败|请求失败|生成失败)\s*[:：]/.test(raw))continue;
          let payload=null;try{const a=raw.indexOf('{'),b=raw.lastIndexOf('}');if(a>=0&&b>a)payload=JSON.parse(raw.slice(a,b+1));}catch{}
          const match=raw.match(/(?:API(?: Tool)? Error|HTTP|status(?: code)?)\s*[:：]?\s*(\d{3})\b/i),status=match?.[1]||'';
          const message=typeof payload?.error?.message==='string'?payload.error.message:'';
          let reason='请求未完成，详情中保留了完整错误信息。';
          if(/requested model.*temporarily unavailable/i.test(message||raw))reason='请求的模型暂时不可用，请稍后再试。';
          else if(status==='503')reason='服务当前不可用，请稍后再试。';else if(status==='401')reason='服务返回了身份验证错误。';else if(status==='403')reason='服务拒绝了本次请求。';else if(status==='429')reason='服务返回了请求限制错误。';
          const node=document.createElement('section');node.className='u89-error-window';node.dataset.u89Owned='';node.setAttribute('role','group');node.setAttribute('aria-label','请求错误提醒');
          text(node,'u89-error-title','!  API ERROR'+(status?' / '+status:''));text(node,'u89-error-reason',reason);
          const details=document.createElement('details');details.className='u89-error-details';const summary=document.createElement('summary');summary.textContent='展开详情';
          const pre=document.createElement('pre');pre.textContent=raw;pre.tabIndex=0;details.append(summary,pre);
          details.addEventListener('toggle',()=>{summary.textContent=details.open?'收起详情':'展开详情';});
          const copy=document.createElement('button');copy.type='button';copy.className='u89-error-copy';copy.textContent='复制错误';
          const feedback=text(node,'u89-error-feedback','');feedback.setAttribute('role','status');
          copy.addEventListener('click',async event=>{event.stopPropagation();copy.disabled=true;let copied=false;
            try{if(window.navigator.clipboard?.writeText){await window.navigator.clipboard.writeText(raw);copied=true;}}catch{}
            if(!copied&&node.isConnected&&!dead){const area=document.createElement('textarea');area.value=raw;area.readOnly=true;area.style.cssText='position:fixed;left:-10000px;top:0';const focused=document.activeElement;node.append(area);area.select();try{copied=!!document.execCommand?.('copy');}catch{}area.remove();focused?.focus?.({preventScroll:true});}
            if(!dead&&node.isConnected){copy.disabled=false;feedback.textContent=copied?'已复制完整错误':'复制失败，请展开详情手动选择原文。';if(!copied)details.open=true;}
          });
          for(const target of [summary,copy,pre]){target.addEventListener('pointerdown',event=>event.stopPropagation());target.addEventListener('pointerup',event=>event.stopPropagation());target.addEventListener('click',event=>event.stopPropagation());target.addEventListener('contextmenu',event=>event.stopPropagation());}
          // Preserve the native system-message menu for long press/right click on the card.
          for(const type of ['pointerdown','pointerup','pointermove','pointercancel','contextmenu'])node.addEventListener(type,event=>{
            if(event.target.closest('button,summary,pre'))return;event.stopPropagation();if(type==='contextmenu')event.preventDefault();
            const Constructor=type==='contextmenu'?window.MouseEvent:window.PointerEvent||window.MouseEvent;
            source.dispatchEvent(new Constructor(type,{bubbles:true,cancelable:true,clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId,pointerType:event.pointerType,button:event.button,buttons:event.buttons}));
          });
          node.append(details,copy,feedback);source.before(node);own.add(node);mark(source,'data-u89-error-source','');errorViews.set(source,{node,raw});
        }
      }
      function updateRain() {
        if(ctx.system.settings.get('rain')===false){if(rain){rain.remove();own.delete(rain);rain=null;rainUnit='';}return;}
        if(!rain){rain=document.createElement('div');rain.className='u89-data-rain';rain.dataset.u89Owned='';rain.setAttribute('aria-hidden','true');
          rain.addEventListener('animationiteration',event=>{if(canMove()&&event.target.parentElement===rain)fillRain(event.target);});host.append(rain);own.add(rain);
        }
        const selectedColor=rainHex(ctx.system.settings.get('rainColor'));if(rain.dataset.color!==selectedColor){rain.style.color=selectedColor;rain.dataset.color=selectedColor;}
        const opacity=String(ctx.system.settings.get('rainOpacity')||'18');rain.style.opacity=String((['8','13','18','25','35'].includes(opacity)?Number(opacity):18)/100);
        const speed=String(ctx.system.settings.get('rainSpeed')||'normal'),range=speed==='slow'?[7,4]:speed==='fast'?[2.5,2.5]:[4,4];
        const unit=window.getComputedStyle(room).getPropertyValue('--u89-unit').trim().replace(/^["']|["']$/g,'')||'89757';
        if(unit!==rainUnit||speed!==rainSpeed||!rain.children.length){rainUnit=unit;rainSpeed=speed;rain.replaceChildren();
          for(let i=0;i<7;i++){const col=document.createElement('span');col.style.setProperty('--duration',(range[0]+Math.random()*range[1]).toFixed(2)+'s');col.style.animationDelay=(-Math.random()*10).toFixed(2)+'s';rain.append(col);fillRain(col,i===0);}
        }
        rain.dataset.running=String(canMove());
      }
      function cardIcons(bubble) {
        for(const [selector,kind] of [['.chat-transfer-body','wallet'],['.chat-red-packet-body','packet']]){
          const body=bubble?.querySelector(selector);if(body&&kind==='packet')mark(body.parentElement,'data-u89-packet-state',body.classList.contains('bg-declined-gradient')?'declined':body.classList.contains('bg-opened-gradient')?'opened':'sealed');
          const icon=body?.querySelector(':scope > div:first-child');if(!icon||icon.querySelector('[data-u89-owned]'))continue;
          const svg=pixelIcon(kind);svg.dataset.u89Owned='';svg.classList.add('u89-card-icon');icon.append(svg);own.add(svg);
        }
      }
      function createConsole() {
        const panel = document.createElement('section');
        panel.className = 'u89-console'; panel.dataset.u89Owned = '';
        panel.setAttribute('aria-label', '机器人运行监测');
        const profile = document.createElement('div'); profile.className = 'u89-profile';
        const portrait = document.createElement('div'); portrait.className = 'u89-portrait';
        portrait.setAttribute('role', 'img'); portrait.setAttribute('aria-label', '顶部头像，可在 CSS 中修改');
        const robot = document.createElement('i'); robot.className = 'u89-robot'; robot.setAttribute('aria-hidden', 'true'); portrait.append(robot);
        const copy = document.createElement('div'); copy.className = 'u89-copy';
        text(copy, 'u89-designation', 'PERSONAL ANDROID');
        const number = document.createElement('strong'); number.className = 'u89-unit'; number.setAttribute('aria-label', '机器人编号，可在 CSS 中修改'); copy.append(number);
        text(copy, 'u89-link', 'CONNECTED TO YOU');
        const chip = document.createElement('div'); chip.className = 'u89-chip'; chip.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 3; i++) chip.append(document.createElement('i'));
        profile.append(portrait, copy, chip);
        const monitor = document.createElement('div'); monitor.className = 'u89-monitor';
        monitor.setAttribute('role', 'img'); monitor.setAttribute('aria-label', '机器人监测装饰动画，不代表真实硬件读数');
        text(monitor, 'u89-monitor-label', '▪ CORE');
        const cells = document.createElement('span'); cells.className = 'u89-cells'; cells.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 12; i++) {const cell = document.createElement('i'); cell.style.setProperty('--n', i); cells.append(cell);}
        const link = document.createElement('span'); link.className = 'u89-monitor-link'; link.textContent = 'LINK';
        const scan = document.createElement('i'); scan.className = 'u89-scan'; scan.setAttribute('aria-hidden', 'true'); link.append(scan);
        monitor.append(cells, link); profile.append(monitor);
        const strip = document.createElement('div'); strip.className = 'u89-strip';
        const status = text(strip, 'u89-process', '');
        text(strip, 'u89-memory', 'MEMORY / ');
        const bar = document.createElement('div'); bar.className = 'u89-titlebar';
        const back = document.createElement('button'); back.type = 'button'; back.className = 'u89-window-button'; back.append(pixelIcon('back')); back.setAttribute('aria-label','返回');
        back.addEventListener('click',()=>room.querySelector('.page-header .page-back-btn')?.click());
        const title = document.createElement('span'); title.className = 'u89-window-title'; title.append(pixelIcon('monitor'));
        const titleUnit=text(title,'u89-title-unit','');titleUnit.setAttribute('aria-label','STAY.EXE');text(title,'u89-title-caption','— Companion');
        const settings = document.createElement('button'); settings.type = 'button'; settings.className = 'u89-window-button'; settings.append(pixelIcon('settings')); settings.setAttribute('aria-label','聊天室设置');
        settings.addEventListener('click',()=>room.querySelector('.page-header-right .page-back-btn')?.click());
        const body=document.createElement('div');body.className='u89-console-body';body.id='u89-console-body-'+(++panelSequence);body.append(profile,strip);
        const minimize=document.createElement('button');minimize.type='button';minimize.className='u89-window-button u89-minimize';
        minimize.setAttribute('aria-controls',body.id);minimize.setAttribute('aria-expanded','true');minimize.setAttribute('aria-label','收起机器人面板');
        minimize.addEventListener('click',()=>{
          body.hidden=!body.hidden;panel.dataset.u89Collapsed=String(body.hidden);
          minimize.setAttribute('aria-expanded',String(!body.hidden));minimize.setAttribute('aria-label',body.hidden?'展开机器人面板':'收起机器人面板');
          measure();queue();
        });
        const actions=document.createElement('div');actions.className='u89-window-actions';actions.append(minimize,settings);
        bar.append(back,title,actions);
        panel.append(bar,body); host.append(panel); own.add(panel);
        sizes?.observe(panel);
        return {panel, status};
      }

      function nativeAction(action) {return room.querySelector('.chat-input-actions > [data-u89-action="'+action+'"]');}
      const primaryItems = new Set(['照片墙','文字图片','语音条']);
      function closeOwnMenu() {if(composer){composer.menu.hidden=true;composer.add.setAttribute('aria-expanded','false');}}
      function cancelRich() {
        if(richTimer)window.clearTimeout(richTimer);richTimer=0;pendingRich=null;
        mark(room,'data-u89-picking',null);
      }
      function openRich(label) {
        const plus=nativeAction('plus');if(!plus||plus.disabled)return;
        cancelRich();pendingRich=label;mark(room,'data-u89-picking','');
        if(!room.querySelector('.chat-plus-menu'))plus.click();
        richTimer=window.setTimeout(()=>{cancelRich();ctx.ui.toast?.('当前界面暂未提供“'+label+'”');},1500);
        queue();
      }
      function createComposer() {
        const footer = document.createElement('footer'); footer.className = 'u89-composer'; footer.dataset.u89Owned = '';
        const meta = document.createElement('div'); meta.className = 'u89-input-meta';
        const state = text(meta,'u89-input-state','LINK STABLE');
        const menu = document.createElement('div'); menu.className = 'u89-tools'; menu.hidden = true;
        const entries = [['photo','照片墙'],['text_photo','文字图片'],['voice_msg','语音条'],['emoji','Emoji'],['offline','线下模式'],['plus','更多附件']];
        for (const [action,label] of entries) {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.u89Proxy = action;
          if(primaryItems.has(label))b.dataset.u89Rich=label;
          b.addEventListener('click',()=>{
            if(b.dataset.u89Rich){openRich(b.dataset.u89Rich);return;}
            cancelRich();const n=action==='offline'?(nativeAction('offline')||nativeAction('online')):nativeAction(action);
            if(n&&!n.disabled){closeOwnMenu();n.click();queue();}
          });menu.append(b);
        }
        const line = document.createElement('div'); line.className = 'u89-compose-line';
        const add = document.createElement('button'); add.type = 'button'; add.className = 'u89-add'; add.textContent = '+'; add.setAttribute('aria-label','展开功能菜单'); add.setAttribute('aria-expanded','false');
        add.addEventListener('click',()=>{cancelRich();if(room.querySelector('.chat-plus-menu')){nativeAction('plus')?.click();menu.hidden=true;}else menu.hidden=!menu.hidden;add.setAttribute('aria-expanded',String(!menu.hidden));queue();});
        const field = document.createElement('div'); field.className = 'u89-input-field';
        const input = document.createElement('textarea'); input.className = 'u89-input chat-input-textarea'; input.rows = 1; input.setAttribute('aria-label','消息内容');
        const emoji = document.createElement('button'); emoji.type = 'button'; emoji.className = 'u89-emoji'; emoji.textContent = 'STICKERS'; emoji.setAttribute('aria-label','表情包');
        emoji.addEventListener('click',()=>{closeOwnMenu();nativeAction('sticker')?.click();queue();});
        const send = document.createElement('button'); send.type = 'button'; send.className = 'u89-send'; send.dataset.u89Send = 'send';
        function relayInput() {
          const native=room.querySelector('.chat-input-bar .chat-input-textarea'); if(!native||native.disabled)return;cancelSubmission();
          Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(native,input.value);
          native.dispatchEvent(new window.Event('input',{bubbles:true}));
          input.style.height='auto';input.style.height=Math.min(input.scrollHeight||38,104)+'px';queue();
        }
        input.addEventListener('input',relayInput);
        input.addEventListener('keydown',e=>{
          const native=room.querySelector('.chat-input-bar .chat-input-textarea');if(!native)return;
          const event=new window.KeyboardEvent('keydown',{key:e.key,code:e.code,keyCode:e.keyCode,which:e.which,shiftKey:e.shiftKey,ctrlKey:e.ctrlKey,altKey:e.altKey,metaKey:e.metaKey,isComposing:e.isComposing,bubbles:true,cancelable:true});
          native.dispatchEvent(event);if(event.defaultPrevented){e.preventDefault();if(e.key==='Enter'&&!e.isComposing&&!e.shiftKey)prepareSubmission({value:input.value});}queue();
        });
        send.addEventListener('click',()=>{
          const n=nativeAction('stop')||nativeAction('reply')||nativeAction('send');
          if(n&&!n.disabled){if(n.getAttribute('data-u89-action')!=='stop')prepareSubmission(room.querySelector('.chat-input-bar .chat-input-textarea'));n.click();queue();}
        });
        meta.append(emoji);field.append(input);line.append(add,field,send);
        const home = document.createElement('div'); home.className='u89-home';home.setAttribute('aria-hidden','true');
        footer.append(meta,menu,line,home);host.append(footer);own.add(footer);sizes?.observe(footer);
        return {footer,input,emoji,send,menu,add,state,stickerSource:null};
      }
      function measure() {
        if (dead||!enabled) return;
        const hh=consoleNode?.panel.getBoundingClientRect().height||0, fh=composer?.footer.getBoundingClientRect().height||0;
        setStyle('--u89-rain-height',Math.max(100,(room.clientHeight||window.innerHeight||800)-hh-fh-48)+'px');
        if(hh)setStyle('--u89-header-h',Math.ceil(hh)+'px');
        if(fh)setStyle('--u89-footer-h',Math.ceil(fh)+'px');
        const available=(room.clientHeight||window.innerHeight||800)-(parseFloat(window.getComputedStyle(room).getPropertyValue('--safe-area-top'))||48)-hh-fh-24;
        setStyle('--u89-panel-max-height',Math.max(0,Math.min(360,available))+'px');
        const panelH=observedInput?.getBoundingClientRect().height||0;
        if(fh)setStyle('--u89-bottom-h',Math.ceil(fh+panelH)+'px');
      }
      const sizes=typeof window.ResizeObserver==='function'?new window.ResizeObserver(measure):null;
      function readMessages(ids) {
        if(!ctx.data.messages?.list)return;
        try{
          const list=ctx.data.messages.list(props.sessionId),byId=new Map(list.map(m=>[m.id,m]));
          for(const m of list)if(ids.has(m.id)){
            let quoted=byId.get(m.mediaData?.quoteMessageId);
            const normalize=value=>{const parts=(value||'').split('|');return (parts.length===2&&/[\u3400-\u9fff]/.test(parts[1])?parts[0]:value||'').replace(/\s+/g,' ').trim();};
            if(!quoted&&!m.mediaData?.quoteRole&&m.mediaData?.quotePreview){
              const preview=normalize(m.mediaData.quotePreview),time=Date.parse(m.createdAt);
              const matches=preview?list.filter(candidate=>candidate.id!==m.id&&candidate.role!=='system'&&Date.parse(candidate.createdAt)<=time&&(()=>{const content=normalize(candidate.content);return content===preview||(preview.length>=8&&content.startsWith(preview));})()):[];
              if(matches.length===1)quoted=matches[0];
            }
            const role=quoted?.role||m.mediaData?.quoteRole;
            messages.set(m.id,{id:m.id,createdAt:m.createdAt,senderName:m.senderName,senderCharacterId:m.senderCharacterId,role:m.role,quoteRole:role||'unknown',quoteLabel:quoted?.senderName||(role==='user'?'YOU':role==='assistant'?'角色':null)});
          }
        }catch{/* No fabricated timestamps when metadata isn't available. */}
      }
      function musicWindow(card) {
        if(card.querySelector('.u89-music-play'))return;
        const body=card.querySelector('.chat-music-share-body'),cover=card.querySelector('.chat-music-share-cover');
        if(!body)return;
        if(cover){const robot=document.createElement('i');robot.className='u89-robot u89-cover-robot';robot.dataset.u89Owned='';robot.setAttribute('aria-hidden','true');cover.append(robot);own.add(robot);}
        const play=document.createElement('button');play.type='button';play.className='u89-music-play';play.dataset.u89Owned='';play.textContent='▷';play.setAttribute('aria-label','在原生播放器中播放这首音乐');
        play.addEventListener('click',e=>{e.stopPropagation();card.click();});body.append(play);own.add(play);

      }

      function update() {
        frame = 0;
        if (dead) return;
        const themeStyle=window.getComputedStyle(room);
        const ready=themeStyle.getPropertyValue('--u89-enabled').trim()==='1'&&themeStyle.getPropertyValue('--u89-theme').trim()==='unit89757';
        if (!ready) {
          if (enabled) reset();
          return;
        }
        enabled = true;
        mark(room, 'data-u89-room', '');
        motionEnabled=ctx.system.settings.get('motion')!==false&&!reducedMotion?.matches;
        mark(room,'data-u89-motion',motionEnabled?'on':'off');if(!canMove())clearMotion();
        if (!consoleNode) consoleNode = createConsole();
        if (!composer) composer = createComposer();updateRain();
        const offline = !!room.querySelector('.chat-input-actions > [aria-label="返回线上模式"]');
        const generating = !!room.querySelector('.chat-typing-indicator, .chat-input-actions > [aria-label*="停止"]');
        mark(room, 'data-u89-state', generating ? 'receiving' : offline ? 'offline' : 'ready');
        let session;
        try {session = ctx.data.sessions.get(props.sessionId);} catch { /* native title remains usable */ }
        const title = room.querySelector('.page-header .page-title');
        const actualName = session?.alias || session?.groupName || (title ? Array.from(title.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : '');
        const next = '' + (actualName || '常驻进程') + (generating ? ' · 正在接收信号' : offline ? ' · 线下会话' : ' · 待命');
        if (consoleNode.status.textContent !== next) consoleNode.status.textContent = next;
        if (actualName) {
          mark(consoleNode.panel, 'aria-label', '机器人运行监测 · ' + actualName);
          mark(title, 'data-u89-native-name', actualName);
        }
        const rows=Array.from(room.querySelectorAll('.chat-msg-wrapper[id]'));
        const missing=new Set(rows.map(r=>r.querySelector('[data-msg-id]')?.getAttribute('data-msg-id')).filter(id=>id&&!messages.has(id)));
        if(missing.size)readMessages(missing);
        for (const row of rows) {
          const bubble = row.querySelector('[data-msg-id][data-ui^="bubble-"]');
          let kind = 'text';
          if (!bubble) kind = 'silent';
          else if (bubble.querySelector('.voice-msg-bubble')) kind = 'audio';
          else if (bubble.classList.contains('chat-bubble-media') || bubble.querySelector('[data-chat-plugin-kind]')) kind = 'media';
          mark(row, 'data-u89-kind', kind);
          if (bubble) mark(bubble, 'data-u89-kind', kind);
          // Read the native duration label without replacing its node or playback handler.
          if(bubble&&kind==='audio'){
            const durationText=bubble.querySelector('.voice-msg-dur')?.textContent?.trim()||'';
            const match=durationText.match(/^(?:(\d+):([0-5]\d)|(\d+(?:\.\d+)?))\s*(?:["″”'’]|秒|s)?$/i);
            const seconds=match?(match[1]!==undefined?Number(match[1])*60+Number(match[2]):Number(match[3])):null;
            if(seconds!==null&&Number.isFinite(seconds))mark(bubble,'data-u89-voice-seconds',String(Math.max(1,Math.min(60,Math.ceil(seconds)))));
            else if(!bubble.hasAttribute('data-u89-voice-seconds'))mark(bubble,'data-u89-voice-seconds','8');
            mark(bubble,'data-u89-voice-status',durationText&&!match?'true':null);
          }else if(bubble)restoreKeys(bubble,['data-u89-voice-seconds','data-u89-voice-status']);
          const toggle=bilingualBlock(bubble)?.querySelector(':scope > .chat-bilingual-toggle');
          if(toggle&&kind==='text'){
            mark(bubble,'data-u89-translate','');mark(bubble,'role','button');mark(bubble,'tabindex','0');
            mark(bubble,'aria-label','查看或收起这条消息的译文');mark(bubble,'aria-expanded',toggle.getAttribute('aria-expanded')||'false');
          }else if(bubble)restoreKeys(bubble,['data-u89-translate','role','tabindex','aria-label','aria-expanded']);
          cardIcons(bubble);const music=bubble?.querySelector('.chat-music-share-card');if(music)musicWindow(music);
          const quote=bubble?.querySelector('.chat-quote-preview');
          if(quote){
            // Leave React's text node untouched; present a compact, derived preview through attributes.
            const raw=quote.textContent||'',parts=raw.split('|');
            const bilingual=parts.length===2&&parts.every(p=>p.trim())&&/[\u3400-\u9fff]/.test(parts[1]);
            mark(quote,'data-u89-quote-text',bilingual?parts[0].trim():raw);
            const info=messages.get(bubble.getAttribute('data-msg-id')),label=info?.quoteLabel;
            mark(quote,'data-u89-quote-label-source',label?'known':'fallback');
            mark(quote,'data-u89-quote-role',info?.quoteRole||'unknown');
            mark(quote,'data-u89-quote-label',label==='角色'?(actualName||'角色'):label||'');
          }

          const wrap=row.querySelector(':scope > .chat-msg-content-wrap');
          if(wrap&&bubble){
            const m=messages.get(bubble.getAttribute('data-msg-id'));
            let time='';if(m?.createdAt){const date=new Date(m.createdAt);if(Number.isFinite(date.getTime()))time=new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);}
            mark(wrap,'data-u89-time',time);
            mark(wrap,'data-u89-sender',session?.isGroup?(m?.senderName||actualName):'');
            mark(wrap,'data-u89-group',session?.isGroup?'true':'false');
          }
          const heart = row.querySelector(':scope > .chat-monologue-heart');
          if (heart) {
            const expanded = !!row.parentElement?.querySelector(':scope > .chat-thought-card, :scope > .chat-status-bare');
            mark(heart, 'data-u89-thought', '');
            mark(heart, 'aria-label', expanded ? '收起心声与状态' : '展开心声与状态');
            mark(heart, 'aria-expanded', String(expanded));
            mark(heart, 'title', null);
            if (heart.tagName !== 'BUTTON') {mark(heart, 'role', 'button'); mark(heart, 'tabindex', '0');}
          }
        }
        const input = room.querySelector('.chat-input-bar');
        if (input) {
          mark(input,'data-u89-managed','');
          if(observedInput!==input){if(observedInput)sizes?.unobserve(observedInput);observedInput=input;sizes?.observe(input);}
          mark(input, 'data-u89-mode', offline ? 'offline' : 'online');
          const buttons = Array.from(input.querySelectorAll(':scope > .chat-input-actions > button'));
          for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            const label = button.getAttribute('aria-label') || button.getAttribute('title') || '';
            let action = '';
            if (/停止/.test(label)) action = 'stop';
            else if (/返回线上/.test(label)) action = 'online';
            else if (button.classList.contains('chat-offline-toggle')) action = 'offline';
            else if (/触发|主动回复/.test(label)) action = 'reply';
            else if (/发送/.test(label)) action = 'send';
            else if (offline) action = i === 1 ? 'emoji' : 'send';
            else action = ['offline', 'emoji', 'sticker', 'plus', 'send', 'reply'][i] || 'extra';
            mark(button, 'data-u89-action', action);
            // Native unlabeled emoji/sticker/plus/reply controls get accessible names.
            if (!button.getAttribute('aria-label')) {
              const names = {emoji:'表情', sticker:'表情包', plus:'更多功能', reply:'触发 AI 回复', offline:'线下模式'};
              if (names[action]) mark(button, 'aria-label', names[action]);
            }
          }
          const nativeInput=input.querySelector('.chat-input-textarea');
          if(nativeInput){
            if(composer.input.value!==nativeInput.value){composer.input.value=nativeInput.value;composer.input.style.height='auto';composer.input.style.height=Math.max(40,Math.min(composer.input.scrollHeight||40,104))+'px';}
            composer.input.disabled=nativeInput.disabled;confirmSubmission(nativeInput);
            const unit=window.getComputedStyle(room).getPropertyValue('--u89-unit').trim().replace(/^["']|["']$/g,'')||'89757';
            const placeholder=nativeInput.getAttribute('placeholder')||('向 '+unit+' 发送信号…');
            if(composer.input.placeholder!==placeholder)composer.input.placeholder=placeholder;
            const sticker=nativeAction('sticker');composer.emoji.disabled=!sticker||sticker.disabled;
            const stickerIcon=sticker?.querySelector('svg');
            if(composer.stickerSource!==stickerIcon){composer.stickerSource=stickerIcon;composer.emoji.replaceChildren();if(stickerIcon){const icon=stickerIcon.cloneNode(true);icon.setAttribute('aria-hidden','true');composer.emoji.append(icon);}text(composer.emoji,'','STICKERS');}
            const action=nativeAction('stop')||nativeAction('reply')||nativeAction('send');
            composer.send.disabled=!action||action.disabled;
            const stopping=action?.getAttribute('data-u89-action')==='stop';
            const sendMode=stopping?'stop':'send';if(composer.send.dataset.u89Send!==sendMode)composer.send.dataset.u89Send=sendMode;
            composer.send.setAttribute('aria-label',stopping?'停止生成':offline?'发送线下消息':'发送并触发回复');
            const status=generating?'RECEIVING SIGNAL':offline?'OFFLINE SESSION':'LINK STABLE';if(composer.state.textContent!==status)composer.state.textContent=status;
            for(const b of composer.menu.querySelectorAll('button')){const action=b.dataset.u89Proxy,n=b.dataset.u89Rich?nativeAction('plus'):action==='offline'?(nativeAction('offline')||nativeAction('online')):nativeAction(action);b.disabled=!n||n.disabled;if(action==='offline'){const label=offline?'返回线上':'线下模式';if(b.textContent!==label)b.textContent=label;}}
          }
        }
        const plusItems=Array.from(room.querySelectorAll('.chat-plus-menu > .chat-plus-menu-item'));
        for(const item of plusItems){const label=item.querySelector(':scope > span')?.textContent?.trim();if(primaryItems.has(label))mark(item,'data-u89-primary-item','');}
        if(pendingRich){
          const item=plusItems.find(n=>n.querySelector(':scope > span')?.textContent?.trim()===pendingRich);
          if(item){cancelRich();closeOwnMenu();item.click();}
        }
        decorateErrors();decorateOffline();
        groupMessageRuns(rows,!!session?.isGroup);
        hideCenterTimes(rows);
        animateNewRows(rows);
        measure();
        prune();
      }
      function queue() {
        if (!dead && !frame) frame = window.requestAnimationFrame(update);
      }
      function reset() {
        enabled = false; press = null;
        for(const source of Array.from(errorViews.keys()))clearErrorView(source);
        for(const source of Array.from(offlineViews.keys()))clearOfflineView(source);
        clearMotion();cancelSubmission();rain=null;rainUnit='';rainSpeed='';seenIds.clear();motionPrimed=false;newestStamp=0;
        cancelRich();
        for (const node of own) {sizes?.unobserve(node);node.remove();} own.clear(); consoleNode = null; composer=null;
        if(observedInput)sizes?.unobserve(observedInput);observedInput=null;
        for(const [key,[value,priority]] of styleOriginals){if(value)room.style.setProperty(key,value,priority);else room.style.removeProperty(key);}styleOriginals.clear();messages.clear();
        for (const [node, values] of originals) restoreNode(node, values);
        originals.clear();
      }
      const observer = new window.MutationObserver(records => {
        if (dead) return;
        const relevant = records.some(r => {
          const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
          if (el?.closest('[data-u89-owned]')) return false;
          if(r.type==='childList'){
            const nodes=[...r.addedNodes,...r.removedNodes];
            if(nodes.length&&nodes.every(n=>n.nodeType===1&&n.hasAttribute('data-u89-owned')))return false;
          }
          return true;
        });
        if (relevant) queue();
      });
      observer.observe(room, {subtree:true, childList:true, characterData:true, attributes:true,
        attributeFilter:['class', 'style', 'aria-label', 'aria-expanded', 'title', 'disabled', 'data-active', 'data-settings-open']});
      function pointerDown(e) {if(!enabled||dead)return;press = {time: Date.now(), x:e.clientX, y:e.clientY, id:e.pointerId};}
      function pointerMove(e) {if (press && (Math.abs(e.clientX-press.x)>8 || Math.abs(e.clientY-press.y)>8)) press.moved = true;}
      function click(e) {
        if (!enabled || dead || e.defaultPrevented) return;
        const target = e.target instanceof window.Element ? e.target : e.target.parentElement;
        if(target&&!target.closest('.u89-composer')&&composer&&!composer.menu.hidden){composer.menu.hidden=true;composer.add.setAttribute('aria-expanded','false');}
        const bubble=target?.closest('[data-u89-kind="text"][data-msg-id]');
        const interactive=target?.closest('button, a, input, textarea, select, summary, [role="button"], [contenteditable="true"], iframe, .ctx-menu, .voice-msg-bubble, .chat-html-inline');
        if (!target || (interactive&&interactive!==bubble)) return;
        if (press && (press.moved || Date.now() - press.time > 420)) {press = null;return;}
        press = null;
        if (window.getSelection()?.toString()) return;
        if (!bubble || !room.contains(bubble) || bubble.hasAttribute('data-active') || bubble.closest('[data-multi-select]')) return;
        if (target.closest('.chat-bilingual-section-translation, .chat-quote-preview, .chat-plugin-message-footer')) return;
        const block = bilingualBlock(bubble);
        const toggle = block?.querySelector(':scope > .chat-bilingual-toggle');
        if (toggle && !toggle.disabled) toggle.click();
      }
      function keyboard(e) {
        if(!enabled||dead)return;
        const bubble=e.target.closest?.('[data-u89-translate]');
        if(bubble&&bubble===e.target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();bilingualBlock(bubble)?.querySelector(':scope > .chat-bilingual-toggle')?.click();return;}
        const trigger = e.target.closest?.('[data-u89-thought][role="button"]');
        if (trigger && trigger.tagName !== 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) {e.preventDefault();trigger.click();}
      }
      room.addEventListener('pointerdown', pointerDown, true);
      room.addEventListener('pointermove', pointerMove, true);
      room.addEventListener('pointercancel', clearPress, true);
      room.addEventListener('click', click, true);
      room.addEventListener('keydown', keyboard);
      function clearPress() {press = null;}
      window.addEventListener('resize', queue);
      reducedMotion?.addEventListener?.('change',queue);document.addEventListener('visibilitychange',queue);
      const controller = {queue, rainDefault:()=>enabled?rainHex(window.getComputedStyle(room).getPropertyValue('--u89-rain-ink')):'', close() {
        if (dead) return; dead = true;
        observer.disconnect();sizes?.disconnect(); if (frame) window.cancelAnimationFrame(frame); frame = 0;
        room.removeEventListener('pointerdown', pointerDown, true);
        room.removeEventListener('pointermove', pointerMove, true);
        room.removeEventListener('pointercancel', clearPress, true);
        room.removeEventListener('click', click, true); room.removeEventListener('keydown', keyboard);
        window.removeEventListener('resize', queue);reducedMotion?.removeEventListener?.('change',queue);document.removeEventListener('visibilitychange',queue); press = null; reset(); controllers.delete(controller);
      }};
      controllers.add(controller); update();
      return controller.close;
    }
    off.push(ctx.ui.slot('chat.header', mountHeader));
    off.push(ctx.ui.slot('settings.section', mountRainSettings));
    off.push(ctx.system.settings.onChange(() => controllers.forEach(c => c.queue())));
    return () => {if (stopped) return;stopped = true;for (const c of Array.from(controllers)) c.close();off.reverse().forEach(fn => fn?.());};
  },
};
