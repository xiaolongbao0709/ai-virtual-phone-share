/* 独立 Threads room 插件；请配合独立 CSS 使用。 */
// Included in each standalone plugin; no CSS is injected by JavaScript.
function threadsToolkit(owner) {
 const owned=new Set(),attributes=new Map(),classes=new Map(),listeners=[];let stopped=false,frame=0,run=()=>{};
 const q=(root,selector)=>root.querySelector(selector),all=(root,selector)=>Array.from(root.querySelectorAll(selector));
 function attr(node,name,value){if(!node)return;if(!attributes.has(node))attributes.set(node,new Map());const map=attributes.get(node);if(!map.has(name))map.set(name,node.getAttribute(name));if(value==null){if(node.hasAttribute(name))node.removeAttribute(name);}else if(node.getAttribute(name)!==String(value))node.setAttribute(name,String(value));}
 function cls(node,name){if(!node||node.classList.contains(name))return;if(!classes.has(node))classes.set(node,new Set());classes.get(node).add(name);node.classList.add(name);}
 function text(node,value){value=String(value??'');if(node.textContent!==value)node.textContent=value;}
 function el(tag,className,value){const node=document.createElement(tag);if(className)node.className=className;if(value!=null)node.textContent=value;node.dataset.threadsOwner=owner;owned.add(node);return node;}
 function once(root,key,tag,className){let node=Array.from(root.children).find(n=>n.dataset.threadsOwner===owner&&n.dataset.threadsKey===key);if(!node){node=el(tag,className);node.dataset.threadsKey=key;root.appendChild(node);}return node;}
 function on(node,type,fn,options){node.addEventListener(type,fn,options);listeners.push({node,dispose:()=>node.removeEventListener(type,fn,options)});}
 function button(label,className,fn){const node=el('button',className,label);node.type='button';if(fn)on(node,'click',fn);return node;}
 function hide(node){attr(node,'data-threads-hidden',owner);}
 function cssReady(node,kind){return window.getComputedStyle(node).getPropertyValue('--threads-'+kind+'-css-ready').trim()==='1';}
 const paths={mail:'<rect x="2.5" y="4.5" width="19" height="15" rx="4"/><path d="m3.5 7 8.5 6 8.5-6"/>',house:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',heart:'<path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/>',person:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',pencil:'<path d="M13 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 3a2.1 2.1 0 0 1 3 3l-9 9-4 1 1-4Z"/>',more:'<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>',plus:'<path d="M12 4v16M4 12h16"/>',arrow:'<path d="m6 10 6-6 6 6M12 4v16"/>',sticker:'<path d="M14 21H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7ZM14 21v-4a3 3 0 0 1 3-3h4"/><path d="M8 9h.01M15 9h.01M8 12.5q3 3 6 0"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',moments:'<path d="M5 3.5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-6 4v-4.3a2 2 0 0 1-1-1.7v-10a2 2 0 0 1 2-2Z"/><path d="M12 13.5s-4-2.2-4-4.3a2.1 2.1 0 0 1 4-1 2.1 2.1 0 0 1 4 1c0 2.1-4 4.3-4 4.3Z"/>',storage:'<rect x="6" y="3" width="15" height="15" rx="3.5"/><path d="M3 7v11a3 3 0 0 0 3 3h11M11 12.5q2.5 2.5 5 0M11 8h.01M16 8h.01"/>',appearance:'<rect x="3" y="4" width="18" height="16" rx="3.5"/><path d="M3 9h18m-11.5 3-3 2.5 3 2.5m5-5 3 2.5-3 2.5M6 6.5h.01M9 6.5h.01"/>'};
 paths.mailsolid='<rect x="2.5" y="4.5" width="19" height="15" rx="4"/><path d="m3.5 7 8.5 6 8.5-6"/>';
 paths.housesolid='<path fill-rule="evenodd" d="M2 10.5 12 2l10 8.5V21a1 1 0 0 1-1 1h-6v-8H9v8H3a1 1 0 0 1-1-1Z"/>';
 paths.heartsolid=paths.heart;
 paths.personsolid='<circle cx="12" cy="7" r="4.5"/><path d="M3 22v-2a9 9 0 0 1 18 0v2Z"/>';
 paths.sliders='<path d="M4 7h7m5 0h4M4 17h3m5 0h8"/><circle cx="13.5" cy="7" r="2.5"/><circle cx="9.5" cy="17" r="2.5"/>';
 paths.chevron='<path d="m9 5 7 7-7 7"/>';
 paths.addperson='<circle cx="9" cy="7" r="3.5"/><path d="M2.5 21v-2a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v2M19 8v6m-3-3h6"/>';
 paths.pin='<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>';
 paths.ellipsis='<path d="M5 12h.01M12 12h.01M19 12h.01"/>';
 paths.smile='<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M7.5 13.5a4.8 4.8 0 0 0 9 0"/>';
 paths.comment='<path d="M20.5 11.5a8.5 8.5 0 0 1-12 7.7L3 21l1.7-5.5a8.5 8.5 0 1 1 15.8-4Z"/>';
 paths.down='<path d="M12 5v14m-5-5 5 5 5-5"/>';
 paths.copy='<rect x="8" y="8" width="12" height="13" rx="2.5"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>';
 paths.quote='<path d="M10 6H4v7h5c0 3-1.5 4.5-4 5M21 6h-6v7h5c0 3-1.5 4.5-4 5"/>';
 paths.select='<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m7 12 3 3 7-7"/>';
 paths.retry='<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>';
 paths.trash='<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>';
 paths.trashdown='<path d="M4 5h12M8 5V3h4v2M6 5l1 12h6l1-12M19 11v10m-3-3 3 3 3-3"/>';
 paths.undo='<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7v4"/>';
 paths.transcript='<path d="M4 5h16M4 10h16M4 15h9M4 20h7m5-3 2 3 4-5"/>';
 function icon(kind){const node=document.createElementNS('http://www.w3.org/2000/svg','svg');node.setAttribute('viewBox','0 0 24 24');node.setAttribute('width','24');node.setAttribute('height','24');node.setAttribute('fill','none');node.setAttribute('stroke','currentColor');node.setAttribute('stroke-width','1.6');node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');node.setAttribute('aria-hidden','true');node.innerHTML=paths[kind]||paths.more;node.dataset.threadsOwner=owner;owned.add(node);return node;}
 function swapIcon(node,kind){if(!node)return;const current=Array.from(node.children).find(n=>n.dataset.threadsOwner===owner&&n.dataset.threadsKey==='icon');for(const child of Array.from(node.children))if(child.dataset.threadsOwner!==owner&&child.tagName.toLowerCase()==='svg')hide(child);if(current?.dataset.threadsIcon===kind)return;if(current)current.remove();const svg=icon(kind);if(kind==='mail')svg.classList.add('threads-nav-mail');svg.dataset.threadsKey='icon';svg.dataset.threadsIcon=kind;node.appendChild(svg);}
 const hubKey=Symbol.for('threads.observer-hub.v3.2');
 let hub=window[hubKey];
 if(!hub){
  hub={clients:new Set(),depth:0};
  hub.observe=()=>hub.observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','aria-label','aria-expanded','data-active','disabled','src','style','placeholder']});
  hub.pause=fn=>{if(hub.depth++===0)hub.observer.disconnect();try{return fn();}finally{if(--hub.depth===0&&hub.clients.size)hub.observe();}};
  hub.observer=new MutationObserver(records=>hub.pause(()=>{for(const client of Array.from(hub.clients)){const relevant=records.filter(client.accept);if(relevant.length)client.flush(relevant);}}));
  window[hubKey]=hub;
 }
 let client;
 function flush(records=null){frame=0;if(stopped)return;hub.pause(()=>{try{run(records);}catch(error){console.error('[Threads '+owner+']',error);}finally{for(const node of owned)if(!node.isConnected)owned.delete(node);for(const node of attributes.keys())if(!node.isConnected)attributes.delete(node);for(const node of classes.keys())if(!node.isConnected)classes.delete(node);for(let i=listeners.length-1;i>=0;i--)if(listeners[i].node.isConnected===false){listeners[i].dispose();listeners.splice(i,1);}}});}
 function schedule(){if(!stopped&&!frame){frame=1;queueMicrotask(()=>{if(!stopped&&frame)flush();});}}
 function start(fn,accept){run=fn;client={flush,accept:accept||((m)=>{const target=m.target.nodeType===1?m.target:m.target.parentElement;return !!(target?.closest('.chat-app')||Array.from(m.addedNodes||[]).some(n=>n.nodeType===1&&(n.matches('.chat-app')||n.querySelector('.chat-app'))));})};hub.clients.add(client);flush();}
 function reset(){for(const item of listeners.reverse())item.dispose();listeners.length=0;for(const node of owned)node.remove();for(const[node,names]of classes)for(const name of names)node.classList.remove(name);for(const[node,values]of attributes)for(const[name,value]of values){if(value==null)node.removeAttribute(name);else node.setAttribute(name,value);}owned.clear();attributes.clear();classes.clear();}
 function stop(){stopped=true;frame=0;hub.clients.delete(client);if(!hub.clients.size)hub.observer.disconnect();hub.pause(reset);}
 return {q,all,attr,cls,text,el,once,on,button,hide,icon,swapIcon,start,schedule,stop,reset,cssReady,mutate:fn=>{if(!stopped)hub.pause(fn);}};
}

export default {
 manifest:{id:'threads-room-standalone',name:'Threads · 自选角色聊天室',author:'ee × codex',apiVersion:1,version:'3.2.3',description:'独立聊天室交互。展开自定义设置勾选角色；配套 CSS 放在角色聊天室或 App 外观中。未检测到 CSS 时保持原版。',permissions:['ui','chat.read','storage']},
 setup(ctx){
  const master=threadsToolkit('room-settings'),active=new Map();let saved=ctx.system.storage.get('selected-character-ids');let selected=new Set(Array.isArray(saved)?saved:ctx.data.characters.list().map(c=>c.id));if(!Array.isArray(saved))ctx.system.storage.set('selected-character-ids',Array.from(selected));
  function setSelection(ids){selected=new Set(ids);ctx.system.storage.set('selected-character-ids',Array.from(selected));master.schedule();}
  let panelExpanded=ctx.system.storage.get('role-panel-expanded')===true,settingsCount=0;
  const settingsDispose=ctx.ui.slot('settings.section',host=>{
   const root=master.el('section','threads-room-settings flex flex-col gap-2 p-3');
   root.id='threads-role-panel-'+(++settingsCount);
   const toggle=master.button('','threads-role-settings-toggle ui-btn ui-btn-ghost',()=>setExpanded(!panelExpanded));toggle.setAttribute('aria-controls',root.id);toggle.title='角色美化设置';toggle.style.padding='6px';
   const icon=master.icon('sliders');icon.setAttribute('width','17');icon.setAttribute('height','17');toggle.appendChild(icon);
   const card=host.closest('.menu-group'),right=card&&master.q(card,':scope > .menu-item > .menu-right');
   if(right)right.prepend(toggle);else{toggle.appendChild(master.el('span','menu-desc','角色设置'));host.appendChild(toggle);}
   let animation;const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
   function setExpanded(value,animate=true){
    panelExpanded=value;ctx.system.storage.set('role-panel-expanded',value);animation?.cancel();toggle.setAttribute('aria-expanded',String(value));toggle.setAttribute('aria-label',value?'收起角色设置':'展开角色设置');
    if(!value&&root.contains(document.activeElement))toggle.focus();
    if(value){root.hidden=false;root.style.display='flex';}
    const finish=()=>{root.hidden=!value;root.style.display=value?'flex':'none';};
    if(animate&&root.animate&&!reduced()){const height=root.getBoundingClientRect().height||root.scrollHeight;animation=root.animate(value?[{height:'0px',opacity:0},{height:height+'px',opacity:1}]:[{height:height+'px',opacity:1},{height:'0px',opacity:0}],{duration:160,easing:'ease-out'});animation.onfinish=finish;}else finish();
   }
   root.style.overflow='hidden';setExpanded(panelExpanded,false);
   const title=master.el('h3','menu-label','选择启用美化的角色');
   const note=master.el('p','menu-desc','只对勾选且已添加聊天室 CSS 的单聊生效。新角色需要在这里勾选。');
   const search=master.el('input','threads-role-search ui-input w-full');
   const actions=master.el('div','threads-role-actions flex flex-wrap gap-2');
   const list=master.el('div','threads-role-list flex flex-col gap-1 overflow-auto');list.style.maxHeight='240px';
   search.type='search';search.placeholder='搜索角色';search.setAttribute('aria-label','搜索角色');
   root.append(title,note,search,actions,list);host.appendChild(root);
   const draw=()=>{
    list.replaceChildren();
    const characters=ctx.data.characters.list().filter(c=>(c.name||'').toLowerCase().includes(search.value.trim().toLowerCase()));
    for(const character of characters){
     const label=master.el('label','threads-role-item flex items-center gap-2 p-2');
     const check=master.el('input','shrink-0'),name=master.el('span','menu-label truncate',character.name);
     check.type='checkbox';check.checked=selected.has(character.id);check.setAttribute('aria-label','启用 '+character.name+' 的聊天室美化');
     master.on(check,'change',()=>{const next=new Set(selected);if(check.checked)next.add(character.id);else next.delete(character.id);setSelection(next);});
     label.appendChild(check);
     if(character.avatar){const image=master.el('img','h-6 w-6 rounded-full object-cover shrink-0');image.src=character.avatar;image.alt='';image.width=25;image.height=25;label.appendChild(image);}
     label.appendChild(name);list.appendChild(label);
    }
    if(!characters.length)list.appendChild(master.el('p','menu-desc','没有匹配的角色'));
   };
   const actionClass='ui-btn ui-btn-outline ts-11';
   actions.append(master.button('全选',actionClass,()=>{setSelection(ctx.data.characters.list().map(c=>c.id));draw();}),master.button('清空',actionClass,()=>{setSelection([]);draw();}),master.button('刷新角色',actionClass,draw));
   master.on(search,'input',()=>{draw();master.schedule();});draw();return()=>{animation?.cancel();toggle.remove();root.remove();};
  });
  function startRoom(room,initialSession){const t=threadsToolkit('room'),state={messageMap:null,more:false,bilingual:new WeakSet(),gestures:new WeakMap(),styles:new Map(),menuAnchors:new WeakMap(),anchor:null,hearts:new WeakSet()};let resize;
   function session(){return ctx.data.sessions.get(initialSession.id)||initialSession;}
   function character(){return ctx.data.characters.get(session().contactId);}
   function header(){const bar=t.q(room,':scope > .page-header .page-header-content');if(!bar)return;const nativeTitle=Array.from(bar.children).find(n=>n.classList.contains('page-title')&&n.dataset.threadsOwner!=='room');if(!nativeTitle)return;t.hide(nativeTitle);let title=t.q(bar,'[data-threads-key="room-identity"]');if(!title){title=t.el('span','page-title threads-owned-title');title.dataset.threadsKey='room-identity';const inner=t.el('span','threads-title-inner'),avatar=t.el('img','threads-title-avatar'),copy=t.el('span','threads-title-text'),name=t.el('span','threads-title-name'),sub=t.el('small','threads-title-bio');avatar.alt='';avatar.draggable=false;t.on(avatar,'error',()=>{if(avatar.getAttribute('src')!=='/images/default-moment-avatar.png'){avatar.dataset.failed=avatar.getAttribute('src');avatar.src='/images/default-moment-avatar.png';}});copy.append(name,sub);inner.append(avatar,copy);title.appendChild(inner);bar.insertBefore(title,nativeTitle);}const c=character(),name=session().alias||c?.name||'私信',avatar=t.q(title,'img'),src=c?.avatar||'/images/default-moment-avatar.png';if(avatar.getAttribute('src')!==src&&avatar.dataset.failed!==src){avatar.src=src;avatar.dataset.failed='';}t.attr(t.q(title,'.threads-title-name'),'data-default-name',name);const rawName=window.getComputedStyle(room).getPropertyValue('--threads-chat-name').trim();t.text(t.q(title,'.threads-title-name'),/^([\"']).*\1$/.test(rawName)?rawName.slice(1,-1):name);const typing=t.q(nativeTitle,'.chat-typing-indicator'),sub=t.q(title,'small');if(typing){const label=typing.textContent.includes('线下')?'线下生成中':'正在输入';if(sub.className!=='threads-title-status'){sub.className='threads-title-status';sub.replaceChildren(t.el('span','',label));const dots=t.el('span','chat-typing-dots');dots.setAttribute('aria-hidden','true');dots.append(t.el('i',''),t.el('i',''),t.el('i',''));sub.appendChild(dots);}else t.text(sub.firstElementChild,label);}else if(sub.className!=='threads-title-bio'){sub.className='threads-title-bio';sub.replaceChildren();}t.attr(sub,'aria-live','polite');t.swapIcon(t.q(bar,'.page-header-right button'),'more');}
   function translations(root=room){
    for(const block of t.all(root,'.chat-bilingual-block')){
     const toggle=t.q(block,':scope > .chat-bilingual-toggle');if(!toggle)continue;
     t.cls(block,'threads-bilingual');t.attr(block,'role','button');t.attr(block,'tabindex','0');
     t.attr(block,'aria-expanded',toggle.getAttribute('aria-expanded'));t.attr(block,'aria-label',toggle.getAttribute('aria-expanded')==='true'?'收起译文':'展开译文');
     const translation=t.q(block,'.chat-bilingual-section-translation .chat-bilingual-content')||t.q(block,'.chat-bilingual-section-translation > div');if(translation)t.cls(translation,'threads-translation-strip');
     if(state.bilingual.has(block))continue;state.bilingual.add(block);
     t.on(block,'pointerdown',event=>state.gestures.set(block,{time:Date.now(),x:event.clientX,y:event.clientY,moved:false,blocked:event.button>0}),true);
     t.on(block,'pointermove',event=>{const g=state.gestures.get(block);if(g&&(Math.abs(event.clientX-g.x)>8||Math.abs(event.clientY-g.y)>8))g.moved=true;},true);
     for(const type of ['pointercancel','contextmenu'])t.on(block,type,()=>{const g=state.gestures.get(block);if(g)g.blocked=true;},true);
     t.on(block,'click',event=>{
      const target=event.target.nodeType===1?event.target:event.target.parentElement;
      const interactive=target.closest('button,a,input,textarea,select,summary,audio,video,iframe,[role="button"],[data-action]'),g=state.gestures.get(block);
      if(interactive&&interactive!==block)return;
      const selection=window.getSelection(),selectingHere=selection&&!selection.isCollapsed&&((selection.anchorNode&&block.contains(selection.anchorNode))||(selection.focusNode&&block.contains(selection.focusNode)));
      const bubble=block.closest('[data-ui^="bubble-"],.chat-bubble-role-assistant,.chat-bubble-role-user');
      if(g&&(g.moved||g.blocked||event.detail>0&&Date.now()-g.time>=450)||selectingHere||bubble?.hasAttribute('data-active'))return;
      event.stopPropagation();t.q(block,':scope > .chat-bilingual-toggle')?.click();
     },true);
     t.on(block,'keydown',event=>{if(event.target===block&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();t.q(block,':scope > .chat-bilingual-toggle')?.click();}});
    }
   }
   function style(node,key,value){if(!state.styles.has(node))state.styles.set(node,new Map());const old=state.styles.get(node);if(!old.has(key))old.set(key,node.style.getPropertyValue(key));if(node.style.getPropertyValue(key)!==value)node.style.setProperty(key,value);}
   function quote(row,message,map){const bubble=t.q(row,'.chat-quote-message');if(!bubble||!message)return;const preview=t.q(bubble,':scope > .chat-quote-preview');t.cls(bubble,'threads-quote-message');if(preview)t.hide(preview);for(const answer of Array.from(bubble.children))if(answer!==preview&&answer.dataset.threadsOwner!=='room')t.cls(answer,'threads-quote-answer');const target=map.get(message.mediaData?.quoteMessageId),role=target?.role||message.mediaData?.quoteRole,name=role==='user'?(target?.senderName||'你'):role==='assistant'?(session().alias||character()?.name||'对方'):'引用消息',source=t.once(bubble,'quote-source','div','threads-quote-source');if(bubble.firstElementChild!==source)bubble.prepend(source);const label=t.once(source,'quote-author','div','threads-quote-author'),reference=t.once(source,'quote-reference','div','threads-quote-reference');t.text(label,name+'：');const raw=target?.isRetracted?'这条消息已撤回':preview?.textContent||target?.content||message.mediaData?.quotePreview||'';
    if(target?.mediaType==='image'&&!target.isRetracted){const key=target.id+'|'+(target.mediaUrl||'');if(reference.dataset.failedSource===key)return;let img=t.q(reference,'img');if(!img){img=t.el('img','threads-quote-image');img.alt='引用的图片';reference.replaceChildren(img);}if(img.dataset.source!==key){img.dataset.source=key;const unavailable=()=>{if(img.isConnected&&img.dataset.source===key){reference.dataset.failedSource=key;img.remove();t.text(t.once(reference,'unavailable','span','threads-quote-unavailable'),'[图片]');}};ctx.data.messages.resolveMedia(target).then(media=>{if(img.isConnected&&img.dataset.source===key){if(media?.dataURL)img.src=media.dataURL;else unavailable();}}).catch(unavailable);}}
    else{let text=t.q(reference,'.threads-quote-text');if(!text){text=t.el('div','threads-quote-text');reference.replaceChildren(text);}const displayed=target&&t.q(room,'[id="message-'+CSS.escape(target.id)+'"] .chat-bilingual-section:first-child');t.text(text,target?.isRetracted?raw:displayed?.textContent||raw.split('|')[0]);}}
   function messages(focusRows=null,structure=true,reload=true){const body=t.q(room,':scope > .page-body');if(!body)return;if(!state.messageMap||reload)state.messageMap=new Map(ctx.data.messages.list(session().id).map(m=>[m.id,m]));const focus=focusRows?new Set(focusRows):null,map=state.messageMap,measure=[],rows=!structure?Array.from(focus||[]):t.all(body,'.chat-msg-wrapper').filter(row=>row.id.startsWith('message-')||row.parentElement?.classList.contains('chat-stream-preview'));let run=[],avatarRun=[];const finish=()=>{run.forEach((row,i)=>{const position=run.length<2?null:i===0?'first':i===run.length-1?'last':'middle';t.attr(row,'data-threads-group',position);if(row.parentElement!==body&&row.parentElement?.parentElement===body)t.attr(row.parentElement,'data-threads-group-row',position);});run=[];};const finishAvatar=()=>{avatarRun.forEach((row,i)=>t.attr(row,'data-threads-avatar-hidden',i<avatarRun.length-1?'':null));avatarRun=[];};
    for(const row of rows){const message=map.get(row.id.slice(8)),role=row.dataset.role,timestamp=row.parentElement?.parentElement===body&&Array.from(row.parentElement.children).some(n=>n!==row&&n.querySelector?.('.chat-sys-msg')),bubble=t.q(row,'.chat-msg-content-wrap [data-ui^="bubble-"],.chat-msg-content-wrap [class*="chat-bubble-role"]'),eligible=(role==='user'||role==='assistant')&&bubble&&!message?.isRetracted&&!t.q(bubble,'.chat-red-packet-card,.chat-transfer-card,.chat-gift-card,.chat-contact-card,.chat-location-card,.chat-payment-request-card,.chat-music-share-card,.chat-media-file-wrap,.chat-xhs-share-card,iframe');if(structure&&(timestamp||!eligible||run.length&&run[0].dataset.role!==role))finish();if(structure&&eligible)run.push(row);else if(structure){t.attr(row,'data-threads-group',null);if(row.parentElement?.parentElement===body)t.attr(row.parentElement,'data-threads-group-row',null);}if(structure){if(timestamp||role!=='assistant'||message?.isRetracted)finishAvatar();if(role==='assistant'&&!message?.isRetracted)avatarRun.push(row);else t.attr(row,'data-threads-avatar-hidden',null);}quote(row,message,map);const heart=t.q(row,'.chat-monologue-heart');if(heart){t.cls(heart,'threads-side-heart');const indicator=t.q(heart,':scope > span.chat-monologue-heart'),expanded=(indicator||heart).hasAttribute('data-active');if(indicator)t.hide(indicator);t.swapIcon(heart,'heart');const glyph=t.q(heart,':scope > svg[data-threads-owner="room"] path');if(glyph)t.attr(glyph,'d','M12 20.5 5.8 13C1.5 7.4 7.7 3.2 12 8c4.3-4.8 10.5-.6 6.2 5Z');t.attr(heart,'aria-expanded',String(expanded));if(heart.tagName!=='BUTTON'){t.attr(heart,'role','button');t.attr(heart,'tabindex','0');if(!state.hearts.has(heart)){state.hearts.add(heart);t.on(heart,'keydown',event=>{if(event.target===heart&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();heart.click();}});}}}const original=t.q(row,'.threads-quote-answer .chat-bilingual-section:first-child')||t.q(row,'.threads-quote-answer')||t.q(row,'.chat-bilingual-section:first-child')||bubble;if(heart)t.attr(heart,'data-threads-heart-only',original?null:'');if(original&&(!focus||!structure||focus.has(row)||!state.styles.has(row)))measure.push([row,original]);}
    if(structure){finish();finishAvatar();}
    const writes=[];for(const[row,original]of measure){const r=row.getBoundingClientRect(),b=original.getBoundingClientRect(),scale=row.offsetWidth&&r.width?r.width/row.offsetWidth:1;writes.push([row,'--threads-original-bottom',Math.max(0,(b.bottom-r.top)/scale)+'px'],[row,'--threads-original-center',Math.max(0,((b.top+b.bottom)/2-r.top)/scale)+'px'],[row,'--threads-original-right',Math.max(0,(b.right-r.left)/scale)+'px']);}for(const[node,key,value]of writes)style(node,key,value);
   }

   function input(){
    const bar=t.q(room,'.chat-input-bar');if(!bar)return;t.cls(bar,'threads-input');
    const actions=t.q(bar,'.chat-input-actions');if(!actions)return;
    const findNative=()=>t.all(actions,':scope > button').filter(b=>b.dataset.threadsOwner!=='room');
    const nativeButtons=findNative(),offlineMode=nativeButtons.some(b=>b.getAttribute('aria-label')==='返回线上模式');
    t.attr(bar,'data-threads-input-kind',offlineMode?'offline':'online');
    if(offlineMode){
     state.more=false;
     nativeButtons.forEach(b=>t.attr(b,'data-threads-hidden',null));
     for(const node of t.all(bar,':scope > .threads-input-plus,:scope > .threads-owned-plus,.chat-input-actions > [data-threads-owner="room"]'))node.remove();
     return;
    }
    const offline=nativeButtons.find(b=>b.getAttribute('aria-label')==='线下模式'),emoji=nativeButtons[1],sticker=nativeButtons[2],plus=nativeButtons[3];
    const stop=nativeButtons.find(b=>b.getAttribute('aria-label')==='停止本轮生成');
    const isReply=b=>(b.title||'').includes('触发 AI 主动回复')||(b.title||'').includes('发送输入框内容并触发回复');
    const reply=nativeButtons.find(isReply);nativeButtons.forEach(t.hide);
    let plusButton=t.q(bar,':scope > .threads-input-plus');
    if(!plusButton){plusButton=t.button('','threads-input-plus',()=>{state.more=false;findNative()[3]?.click();t.mutate(()=>{input();stickers();intro();});});plusButton.setAttribute('aria-label','更多聊天功能');plusButton.appendChild(t.icon('plus'));bar.appendChild(plusButton);}
    plusButton.disabled=!!plus?.disabled;
    const br=bar.getBoundingClientRect(),pr=plusButton.getBoundingClientRect(),scale=bar.offsetWidth&&br.width?br.width/bar.offsetWidth:1;
    style(bar,'--threads-plus-bottom',Math.max(0,(br.bottom-pr.top)/scale+6)+'px');
    let stickerButton=t.q(actions,'.threads-sticker-button');
    if(!stickerButton){stickerButton=t.button('','threads-sticker-button',()=>findNative()[2]?.click());stickerButton.setAttribute('aria-label','表情包');stickerButton.appendChild(t.icon('sticker'));actions.appendChild(stickerButton);}
    stickerButton.disabled=!!sticker?.disabled;
    let replyButton=t.q(actions,'.threads-reply-button');
    if(!replyButton){replyButton=t.button('','threads-reply-button',()=>{const buttons=findNative(),target=buttons.find(b=>b.getAttribute('aria-label')==='停止本轮生成')||buttons.find(isReply);if(target&&!target.disabled)target.click();});actions.appendChild(replyButton);}
    const mode=stop?'stop':'reply';if(replyButton.dataset.mode!==mode){replyButton.dataset.mode=mode;replyButton.replaceChildren(stop?t.el('span','','■'):t.icon('arrow'));}
    replyButton.disabled=!stop&&!reply;t.attr(replyButton,'aria-label',stop?'停止本轮生成':'触发角色回复');
    const textarea=t.q(bar,'.chat-input-textarea');if(textarea&&!textarea.placeholder)t.attr(textarea,'placeholder','Message...');
    const nativeMenu=t.all(bar,'.chat-plus-menu').find(n=>n.dataset.threadsOwner!=='room');
    let primary=t.q(bar,':scope > .threads-owned-plus');
    const toolbar=t.q(bar,':scope > .chat-plugin-input-toolbar');
    if(toolbar)t.attr(toolbar,'data-threads-hidden',state.more?null:'room');
    if(nativeMenu){
     if(!primary){primary=t.el('div','chat-plus-menu threads-owned-plus');bar.appendChild(primary);}
     const findRich=label=>t.all(nativeMenu,'.chat-plus-menu-item').find(item=>(t.q(item,':scope > span')?.textContent||item.textContent).trim()===label);
     const forward=target=>{if(!target)return;target.click();queueMicrotask(()=>{if(nativeMenu.isConnected)plus?.click();});};
     const choices=[['线下模式','pin',()=>forward(offline)],['Emoji','smile',()=>forward(emoji)],['照片墙','photo',()=>forward(findRich('照片墙'))],['文字图片','text-photo',()=>forward(findRich('文字图片'))],['更多功能','plus',()=>{state.more=true;t.mutate(()=>{input();stickers();intro();});}]];
     for(const[label,kind,action]of choices){
      const rich=kind==='photo'||kind==='text-photo',native=rich?findRich(label):null;if(rich&&!native)continue;
      if(native)t.hide(native);
      let button=t.all(primary,':scope > button').find(node=>node.getAttribute('data-threads-quick-label')===label);
      if(!button){button=t.button('','chat-plus-menu-item',action);button.setAttribute('data-threads-quick-label',label);const icon=t.el('span','chat-plus-icon-box'),svg=t.icon(kind==='photo'?'appearance':kind==='text-photo'?'appearance':kind);
       if(kind==='photo')svg.innerHTML='<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/>';
       if(kind==='text-photo')svg.innerHTML='<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7 8h10M7 12h8M7 16h5"/>';
       icon.appendChild(svg);button.append(icon,t.el('span','',label));primary.appendChild(button);
      }
      // Keep the native order even when available actions arrive after the first scan.
      const expected=choices.filter(choice=>!['photo','text-photo'].includes(choice[1])||findRich(choice[0])).findIndex(choice=>choice[0]===label);const current=primary.children[expected];if(current!==button)primary.insertBefore(button,current||null);
     }
     t.attr(primary,'hidden',state.more?'':null);t.attr(nativeMenu,'data-threads-hidden',state.more?null:'room');t.attr(nativeMenu,'data-threads-level',state.more?'more':null);
     let head=t.q(nativeMenu,':scope > .threads-original-plus-heading');
     if(!head){head=t.el('header','threads-original-plus-heading');head.append(t.el('span','','更多功能'),t.button('返回','',()=>{state.more=false;t.mutate(()=>{input();stickers();intro();});}));nativeMenu.prepend(head);}
    }else{state.more=false;primary?.remove();}
    if(primary)for(const entry of t.all(primary,':scope > button,:scope > .chat-plus-menu-item')){const label=(t.q(entry,':scope > span:last-child')?.textContent||entry.textContent).trim();if(['表情','Emoji','emoji'].includes(label)&&entry.getAttribute('data-threads-quick-label')!=='Emoji')t.hide(entry);}
   }
   function modals(){for(const overlay of t.all(room,'.modal-overlay')){const dialog=overlay.firstElementChild,title=t.q(dialog,'.ts-16')?.textContent.trim();if(!['发红包','转账','发送照片','分享位置','文字图片','系统指令注入','语音消息'].includes(title))continue;t.cls(overlay,'rich-input-overlay');t.cls(dialog,'rich-input-dialog');const buttons=t.all(dialog,'button').filter(b=>b.dataset.threadsOwner!=='room'),cancel=buttons.find(b=>b.textContent.trim()==='取消');if(cancel&&!t.q(dialog,':scope > .threads-modal-close')&&title!=='语音消息'){const b=t.button('','threads-modal-close',()=>cancel.click());b.setAttribute('aria-label','关闭弹窗');b.appendChild(t.icon('close'));dialog.prepend(b);}if(title==='发红包'||title==='转账'){t.cls(dialog,'rich-money-dialog');t.cls(overlay,title==='发红包'?'rich-red-packet-overlay':'rich-transfer-overlay');const native=Array.from(dialog.children).filter(n=>n.dataset.threadsOwner!=='room');t.cls(native[0],'rich-money-heading');t.cls(native[0]?.firstElementChild,'rich-money-icon');t.cls(native[1],'rich-money-body');const amount=t.q(dialog,'input[inputmode="decimal"]');if(amount)t.cls(amount.parentElement,'rich-money-amount');if(cancel)t.cls(cancel.parentElement,'rich-modal-actions');}if(title==='分享位置'){t.cls(overlay,'rich-location-overlay');t.cls(t.q(dialog,'.ui-map-gradient'),'rich-location-preview');}if(title==='语音消息')t.cls(overlay,'rich-voice-overlay');}}
   function responseEditor(){
    for(const overlay of t.all(room,'.chat-html-overlay')){
     const dialog=overlay.firstElementChild,textarea=dialog&&t.q(dialog,'textarea');if(!textarea||t.q(dialog,'.menu-label')?.textContent.trim()!=='编辑本次回复')continue;
     t.cls(overlay,'threads-response-edit-overlay');t.cls(dialog,'threads-response-editor');
     const header=dialog.firstElementChild,footer=dialog.lastElementChild;t.cls(header,'threads-response-edit-header');t.cls(footer,'threads-response-edit-footer');
     const rect=room.getBoundingClientRect(),scale=room.offsetHeight&&rect.height?rect.height/room.offsetHeight:1,viewport=window.visualViewport;
     if(rect.height){const top=Math.max(rect.top,viewport?.offsetTop||0),bottom=Math.min(rect.bottom,(viewport?.offsetTop||0)+(viewport?.height||window.innerHeight));style(dialog,'--threads-edit-space',Math.max(0,(bottom-top)/scale-32)+'px');style(overlay,'--threads-edit-top',Math.max(0,(top-rect.top)/scale)+'px');style(overlay,'--threads-edit-height',Math.max(0,(bottom-top)/scale)+'px');}
    }
   }
   function voiceTranscripts(){
    for(const card of t.all(room,'.voice-msg-text-bubble')){const row=card.closest('.chat-msg-wrapper');if(row)t.cls(row,'threads-voice-transcript-row');}
   }
   function rememberMenuAnchor(event){
    const target=event.target.nodeType===1?event.target:event.target.parentElement;
    if(target.closest('.ctx-menu')||!target.closest('.chat-msg-wrapper,.chat-offline-entry,.chat-sys-msg'))return;
    const rect=target.getBoundingClientRect();state.anchor={x:event.clientX||rect.left+rect.width/2,y:event.clientY||rect.top+rect.height/2};if(t.q(room,'.chat-floating-ctx-menu'))queueMicrotask(()=>t.mutate(contextMenus));
   }
   function contextMenus(){
    const definitions={'复制':['copy',0],'引用':['quote',1],'编辑':['pencil',2],'编辑回复':['pencil',2],'多选':['select',3],'转文字':['transcript',4],'重试以下':['retry',5],'撤回消息':['undo',6],'删除':['trash',100],'删除以下':['trashdown',101]};
    for(const menu of t.all(room,'.chat-floating-ctx-menu')){
     const buttons=t.all(menu,'button.ctx-menu-btn');if(!buttons.length)continue;t.cls(menu,'threads-message-menu');
     let dangerous=false;
     for(const button of buttons){const label=button.textContent.trim(),definition=definitions[label]||['more',10];t.attr(button,'data-threads-menu-action',label);t.attr(button,'data-threads-danger',definition[1]>=100?'':null);style(button,'order',String(definition[1]));t.swapIcon(button,definition[0]);if(definition[1]>=100)dangerous=true;}
     const dangerCount=buttons.filter(button=>button.hasAttribute('data-threads-danger')).length,normalCount=buttons.length-dangerCount,compact=buttons.length<=3,desiredWidth=compact?196:244;t.attr(menu,'data-threads-menu-compact',compact?'':null);t.attr(menu,'data-threads-menu-normal-count',normalCount);t.attr(menu,'data-threads-menu-danger-count',dangerCount);
     let separator=t.q(menu,':scope > .threads-message-menu-divider');
     if(dangerous&&normalCount&&!separator){separator=t.el('div','threads-message-menu-divider');separator.setAttribute('aria-hidden','true');menu.appendChild(separator);}else if(!dangerous||!normalCount)separator?.remove();
     // The native ref positions the old compact menu; remeasure this taller layout in room coordinates.
     const rect=room.getBoundingClientRect(),sx=room.offsetWidth&&rect.width?rect.width/room.offsetWidth:1,sy=room.offsetHeight&&rect.height?rect.height/room.offsetHeight:sx;
     if(!rect.width||!rect.height)continue;
     const viewport=window.visualViewport,leftEdge=viewport?.offsetLeft||0,topEdge=viewport?.offsetTop||0,rightEdge=leftEdge+(viewport?.width||window.innerWidth),bottomEdge=topEdge+(viewport?.height||window.innerHeight);
     const minX=Math.max(0,(leftEdge-rect.left)/sx)+10,maxX=Math.min(rect.width/sx,(rightEdge-rect.left)/sx)-10,minY=Math.max(0,(topEdge-rect.top)/sy)+10,maxY=Math.min(rect.height/sy,(bottomEdge-rect.top)/sy)-10;
     style(menu,'--threads-menu-width',Math.max(0,Math.min(desiredWidth,maxX-minX))+'px');style(menu,'--threads-menu-max-height',Math.max(0,maxY-minY)+'px');
     let anchor=state.anchor||state.menuAnchors.get(menu);if(!anchor)anchor={x:rect.left+rect.width/2,y:rect.top+rect.height/2};state.menuAnchors.set(menu,anchor);
     const width=menu.offsetWidth||Math.min(desiredWidth,maxX-minX),height=menu.offsetHeight||Math.min(214,maxY-minY),x=(anchor.x-rect.left)/sx,y=(anchor.y-rect.top)/sy;
     const below=y-height-10<minY,left=Math.max(minX,Math.min(x-width/2,maxX-width)),top=Math.max(minY,Math.min(below?y+10:y-height-10,maxY-height));
     style(menu,'left',left+'px');style(menu,'top',top+'px');t.attr(menu,'data-threads-placement',below?'below':'above');
    }
   }
   function intro(){
    const body=t.q(room,':scope > .page-body');if(!body)return;
    let card=t.q(body,':scope > .threads-chat-intro');
    const empty=!t.q(body,'.chat-msg-wrapper,.chat-stream-preview,.chat-offline-turn')&&ctx.data.messages.list(session().id).length===0;
    const offline=t.q(room,'.chat-input-bar')?.dataset.threadsInputKind==='offline';
    if(!empty||offline){card?.remove();return;}
    if(!card){
     card=t.el('section','threads-chat-intro');card.setAttribute('aria-label','开始聊天');
     const avatar=t.el('img','threads-intro-avatar');avatar.alt='';avatar.width=104;avatar.height=104;
     t.on(avatar,'error',()=>{const failed=avatar.getAttribute('src');avatar.dataset.failed=failed;if(failed!=='/images/default-moment-avatar.png')avatar.src='/images/default-moment-avatar.png';});
     const title=t.el('h2','threads-intro-name'),hint=t.el('p','threads-intro-hint','从一句问候开始');card.append(avatar,title,hint);body.prepend(card);
    }
    const c=character(),name=session().alias||c?.name||'私信',avatar=t.q(card,'img'),src=c?.avatar||'/images/default-moment-avatar.png';
    if(avatar.getAttribute('src')!==src&&avatar.dataset.failed!==src)avatar.src=src;
    const rawName=window.getComputedStyle(room).getPropertyValue('--threads-chat-name').trim();
    t.text(t.q(card,'.threads-intro-name'),/^([\"']).*\1$/.test(rawName)?rawName.slice(1,-1):name);
    t.attr(card,'aria-label',name+'，从一句问候开始');
   }
   function stickers(){
    const input=t.q(room,'.chat-input-bar');if(!input)return;
    for(const panel of Array.from(input.children).filter(n=>n.classList.contains('h-[220px]'))){
     t.cls(panel,'threads-input-panel');
     const grid=Array.from(panel.children).find(n=>n.classList.contains('grid-cols-5')||n.classList.contains('grid-cols-8')||n.classList.contains('grid-cols-4'));if(!grid)continue;
     const isSticker=grid.classList.contains('grid-cols-5');
     t.cls(panel,isSticker?'threads-sticker-panel':'threads-emoji-panel');
     t.cls(grid,isSticker?'threads-sticker-grid':grid.classList.contains('grid-cols-8')?'threads-emoji-grid':'threads-emoji-effects');
     const tabs=grid.previousElementSibling;if(tabs){t.cls(tabs,'threads-sticker-tabs');for(const tab of t.all(tabs,'.emoji-category-pill')){t.cls(tab,'threads-sticker-tab');t.attr(tab,'aria-pressed',tab.hasAttribute('data-active'));}}
     if(isSticker)for(const item of t.all(grid,':scope > button')){t.cls(item,'threads-sticker-item');t.cls(item.firstElementChild,'threads-sticker-preview');t.cls(item.lastElementChild,'threads-sticker-caption');}
    }
   }
   const scan=(records=null)=>{
    if(!room.isConnected)return;for(const node of state.styles.keys())if(!node.isConnected)state.styles.delete(node);
    t.attr(room,'data-threads-room','');t.attr(room,'data-chat-kind','private');
    if(!records){header();input();modals();stickers();translations();messages();voiceTranscripts();contextMenus();responseEditor();intro();return;}
    const targets=records.map(m=>m.target.nodeType===1?m.target:m.target.parentElement).filter(Boolean),added=records.flatMap(m=>[...m.addedNodes||[],...m.removedNodes||[]]).filter(n=>n.nodeType===1);
    const hits=selector=>targets.some(n=>n.closest(selector))||added.some(n=>n.matches(selector)||n.querySelector(selector));
    const full=records.some(m=>m.target===room&&m.type==='attributes'&&m.attributeName==='class')||added.some(n=>n.matches('.page-body'));
    if(full){header();input();modals();stickers();translations();messages();voiceTranscripts();contextMenus();responseEditor();intro();return;}
    if(hits('.page-header')||records.some(m=>m.target===room&&m.type==='attributes'&&m.attributeName==='style')){header();intro();}if(hits('.chat-input-bar')){input();stickers();intro();}
    if(hits('.modal-overlay'))modals();if(hits('.chat-html-overlay'))responseEditor();if(hits('.chat-floating-ctx-menu'))contextMenus();
    const dirty=new Set(targets.map(n=>n.closest('.chat-msg-wrapper')).filter(Boolean));
    const structure=added.some(n=>n.matches('.chat-msg-wrapper')||n.querySelector('.chat-msg-wrapper'))||added.some(n=>n.matches('.chat-bubble-role-assistant,.chat-bubble-role-user,.chat-red-packet-card,.chat-transfer-card,.chat-quote-message,.voice-msg-bubble'));
    if(structure){translations();messages(dirty,true);voiceTranscripts();intro();}
    else if(dirty.size){for(const row of dirty)translations(row);messages(Array.from(dirty),false,records.some(m=>m.type!=='attributes')&&!Array.from(dirty).every(row=>row.closest('.chat-stream-preview')));}
   };
   t.start(scan,m=>{const node=m.target.nodeType===1?m.target:m.target.parentElement;return !!(node&&(node===room||room.contains(node)));});t.on(room,'load',event=>{const row=event.target.closest?.('.chat-msg-wrapper');if(row)messages([row],false,false);},true);t.on(room,'pointerdown',rememberMenuAnchor,true);t.on(room,'contextmenu',rememberMenuAnchor,true);t.on(window,'resize',t.schedule);t.on(room,'scroll',()=>{if(t.q(room,'.chat-floating-ctx-menu'))contextMenus();},true);if(window.visualViewport){t.on(window.visualViewport,'resize',t.schedule);t.on(window.visualViewport,'scroll',t.schedule);}if(typeof ResizeObserver!=='undefined'){resize=new ResizeObserver(t.schedule);resize.observe(room);}return()=>{resize?.disconnect();t.stop();for(const[node,values]of state.styles)for(const[key,value]of values){if(value)node.style.setProperty(key,value);else node.style.removeProperty(key);}};
  }
  function scan(){const roots=new Set(master.all(document,'.chat-room-wrapper'));for(const[room,dispose]of active){const id=Array.from(room.classList).find(c=>c.startsWith('session-'))?.slice(8),session=id&&ctx.data.sessions.get(id);if(dispose.sessionId!==id||!roots.has(room)||!session||session.isGroup||!selected.has(session.contactId)||!master.cssReady(room,'room')){dispose();active.delete(room);}}for(const room of roots){const id=Array.from(room.classList).find(c=>c.startsWith('session-'))?.slice(8),session=id&&ctx.data.sessions.get(id);if(session&&!session.isGroup&&selected.has(session.contactId)&&master.cssReady(room,'room')&&!active.has(room)){const dispose=startRoom(room,session);dispose.sessionId=session.id;active.set(room,dispose);}}}
  master.start(scan,m=>{const node=m.target.nodeType===1?m.target:m.target.parentElement;if(node?.matches('style')||node?.closest('head'))return true;if(node?.matches('.chat-room-wrapper'))return true;return [...m.addedNodes||[],...m.removedNodes||[]].some(n=>n.nodeType===1&&(n.matches('.chat-room-wrapper,.chat-app')||n.querySelector('.chat-room-wrapper')));});const refresh=ctx.hooks.on('session.opened',master.schedule);return()=>{refresh?.();settingsDispose?.();for(const dispose of active.values())dispose();active.clear();master.stop();};
 }
};
