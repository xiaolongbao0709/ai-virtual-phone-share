// On Air · News & Navigation | ee × codex
// 独立列表插件。只标记原生节点及添加装饰，不复制聊天记录、不搬动 React 节点。
const paths={message:'<path d="M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 3V5a2 2 0 0 1 2-2Z"/><path d="M7 8h10M7 12h7"/>',contacts:'<rect x="5" y="3" width="15" height="18" rx="2.5"/><path d="M3 7h4M3 12h4M3 17h4M10 8h6M10 12h6M10 16h4"/>',feeds:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3m9 6h-3M12 21v-3m-9-6h3"/>',me:'<path d="m3 10.5 7.8-6.6a1.9 1.9 0 0 1 2.4 0l7.8 6.6M5.5 8.5v11A1.5 1.5 0 0 0 7 21h3v-6h4v6h3a1.5 1.5 0 0 0 1.5-1.5v-11"/>',tools:'<rect x="3" y="3" width="6" height="6" rx="2"/><rect x="15" y="3" width="6" height="6" rx="2"/><rect x="3" y="15" width="6" height="6" rx="2"/><path d="M18 14v8m-4-4h8"/>',play:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4Z" fill="currentColor" stroke-linejoin="round"/>'};
const solidPaths={message:'<path d="M7 3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-3v4l-5-4H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="M2 8v8a4 4 0 0 0 4 4h3l-4 3v-3a5 5 0 0 1-5-5V9Z"/>',contacts:'<path fill-rule="evenodd" d="M7.5 2h11A2.5 2.5 0 0 1 21 4.5v15a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 5 19.5v-15A2.5 2.5 0 0 1 7.5 2ZM10 7h7v1.5h-7ZM10 11.25h7v1.5h-7ZM10 15.5h5V17h-5Z"/><path d="M2 6h5v2H2ZM2 11h5v2H2ZM2 16h5v2H2Z"/>',feeds:'<rect x="2" y="2" width="8" height="8" rx="2"/><rect x="14" y="2" width="8" height="8" rx="2"/><rect x="2" y="14" width="8" height="8" rx="2"/><rect x="14" y="14" width="8" height="8" rx="2"/>',me:'<path d="M10.65 3.65a2.1 2.1 0 0 1 2.7 0l8 6.75a1 1 0 0 1-1.3 1.52L19 11v8.5a2 2 0 0 1-2 2h-3v-7h-4v7H7a2 2 0 0 1-2-2V11l-1.05.92a1 1 0 1 1-1.3-1.52Z"/>'};
paths.message='<path d="M7 3h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-3v4l-5-4H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="M2 9v7a4 4 0 0 0 4 4h2"/>';
paths.feeds='<rect x="2.5" y="2.5" width="7" height="7" rx="1.8"/><rect x="14.5" y="2.5" width="7" height="7" rx="1.8"/><rect x="2.5" y="14.5" width="7" height="7" rx="1.8"/><rect x="14.5" y="14.5" width="7" height="7" rx="1.8"/>';
paths.tools='<path d="M3 7h7m4 0h7M3 17h11m4 0h3"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>';
paths.compose='<path d="m15 4 5 5M4 20l4.5-1 12-12a2.8 2.8 0 0 0-4-4l-12 12L4 20ZM13 20h7"/>';
paths.search='<circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>';
paths.play='<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>';
paths.back='<path d="m15 5-7 7 7 7"/>';
paths.profile='<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>';
function navIcon(kind){const el=icon(kind);el.firstElementChild.setAttribute('data-pod-variant','outline');el.insertAdjacentHTML('beforeend','<svg data-pod-variant="solid" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'+solidPaths[kind]+'</svg>');return el;}

function icon(kind){const el=document.createElement('span');el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[kind]+'</svg>';return el;}
// Static ornaments only: no audio, progress simulation, timers or new observers.
function playCapsule(){const el=document.createElement('span');el.className='pod-play';el.setAttribute('aria-hidden','true');const symbol=icon('play');symbol.className='pod-play-symbol';const time=document.createElement('span');time.className='pod-time-label';el.append(symbol,time);return el;}
paths.hearts='<g stroke-width="2" fill="white"><path transform="translate(0 0) scale(.7)" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" opacity=".65"/><path transform="translate(6 4) scale(.7)" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></g>';
paths.squares='<rect x="3" y="3" width="12" height="14" rx="2.8"/><rect x="8" y="7" width="13" height="14" rx="2.8" fill="white"/>';
function sectionHeading(kind,label){
 const h=document.createElement('h2');h.className='pod-section';h.setAttribute('data-pod-section',kind);
 const copy=document.createElement('span');copy.className='pod-section-copy';
 const name=document.createElement('span');name.className='pod-section-label';name.textContent=label;const symbol=icon(kind==='private'?'hearts':'squares');symbol.className='pod-section-symbol';symbol.setAttribute('aria-hidden','true');name.prepend(symbol);
 const subtitle=document.createElement('small');subtitle.className='pod-section-tag';subtitle.textContent=kind==='private'?'PRIVATE RADIO':'COVE RADIO';copy.append(subtitle,name);
 // 原生列表只有 All/Private/Groups 筛选，没有对应的查看全部跳转；这里只展示文字。
 const all=document.createElement('span');all.className='pod-section-all';all.setAttribute('aria-disabled','true');all.append(document.createTextNode('See All'));
 const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 2.5 3.5 3.5-3.5 3.5"/></svg>';all.append(arrow);h.append(copy,all);return h;
}
function groupEmptyContent(){
 const fragment=document.createDocumentFragment(),symbol=document.createElement('span');symbol.className='pod-empty-symbol';symbol.setAttribute('aria-hidden','true');
 symbol.innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9l-5 5V6a2 2 0 0 1 2-2Z"/><path d="M24 11h2a2 2 0 0 1 2 2v15l-5-5h-8a2 2 0 0 1-2-2v-1"/></svg>';
 const label=document.createElement('strong');label.className='pod-empty-label';label.textContent='还没有群聊记录';
 const caption=document.createElement('small');caption.className='pod-empty-caption';caption.textContent='NO GROUP CHANNELS YET';fragment.append(symbol,label,caption);return fragment;
}
// 仅缩短原生显示时间，不读取或改写会话数据。
function cardTime(raw){return raw.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日/,(_,y,m,d)=>y.slice(-2)+'/'+m+'/'+d).replace(/(\d{1,2})月(\d{1,2})日/,'$1/$2');}
export default {
 manifest:{id:'onair-news-pages',name:'On Air · 聊天列表',version:'1.6.0',author:'ee × codex',apiVersion:1,permissions:['ui'],description:'独立四页美化：News 节目卡片、联系人频道目录、朋友圈随笔与个人频道。配套 CSS 放入聊天 App 外观；请停用旧列表主题。'},
 setup(ctx){
  let stopped=false,app=null,parent=null,anchor=null,queued=false,pending=null,menu=null,dialog=null,consoleTab='0';
  const saved=new Map(),owned=new Set(),abort=new AbortController();
  function attr(el,key,value){if(!el)return;if(!saved.has(el))saved.set(el,new Map());const m=saved.get(el);if(!m.has(key))m.set(key,el.getAttribute(key));if(value===null)el.removeAttribute(key);else if(el.getAttribute(key)!==value)el.setAttribute(key,value);}
  function own(el){el.setAttribute('data-pod-owned','');owned.add(el);return el;}
  function clear(){closeDialog(false);for(const el of owned)el.remove();owned.clear();for(const[el,attrs]of saved)for(const[k,v]of attrs)v===null?el.removeAttribute(k):el.setAttribute(k,v);saved.clear();menu=null;pending=null;}
  function prune(){for(const el of owned)if(!app.contains(el))owned.delete(el);for(const el of saved.keys())if(!app.contains(el)&&el!==app)saved.delete(el);}
  function closeMenu(){if(menu){owned.delete(menu);menu.remove();menu=null;}}
  function tab(){const tabs=[...app.querySelectorAll('.chat-tab-bar>.chat-tab')],i=tabs.findIndex(b=>b.classList.contains('chat-tab-active'));return ['messages','contacts','feeds','me'][i]||null;}
  function page(){return app.querySelector('.chat-main-content .page-shell');}
  function notify(text){ctx.ui.toast(text);}
  function nativeQuery(input,value){if(!input?.isConnected||input.value===value)return;const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}
  function closeDialog(focus=true){if(!dialog)return;const old=dialog;dialog=null;owned.delete(old.overlay);old.overlay.remove();nativeQuery(old.native,old.initial);old.entries=[];if(focus&&app?.isConnected&&!app.hasAttribute('data-room-active'))app.querySelector('.pod-quick')?.focus();}
  function dialogBase(title){closeMenu();closeDialog(false);const overlay=own(document.createElement('div'));overlay.className='pod-dialog-overlay';const panel=document.createElement('section');panel.className='pod-dialog';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);const head=document.createElement('div');head.className='pod-dialog-head';const label=document.createElement('h2');label.textContent=title;const close=document.createElement('button');close.type='button';close.className='pod-dialog-close';close.setAttribute('aria-label','关闭');close.textContent='×';close.onclick=()=>closeDialog();head.append(label,close);panel.append(head);overlay.append(panel);overlay.onclick=e=>{if(e.target===overlay)closeDialog();};app.append(overlay);dialog={overlay,panel,tab:tab(),entries:[],mode:'empty'};return dialog;}
  function showEmptyFriends(){const state=dialogBase('New Friends');const text=document.createElement('p');text.className='pod-search-empty';text.textContent='暂时没有新的好友申请';state.panel.append(text);state.panel.querySelector('button').focus();}
  function showSearch(p,native,contacts=false){const state=dialogBase(contacts?'搜索联系人':'搜索消息');state.mode='search';state.contacts=contacts;state.native=native;state.initial=native.value;state.page=p;const wrap=document.createElement('label');wrap.className='pod-search-field';const symbol=icon('search');symbol.setAttribute('aria-hidden','true');const field=document.createElement('input');field.type='search';field.placeholder=contacts?'搜索联系人':'搜索联系人或群聊';field.setAttribute('aria-label',field.placeholder);field.value=native.value;field.autocomplete='off';field.oninput=()=>{nativeQuery(native,field.value);schedule();};wrap.append(symbol,field);const results=document.createElement('div');results.className='pod-search-results';const hint=document.createElement('p');hint.className='pod-search-hint';hint.setAttribute('role','status');state.panel.append(wrap,results,hint);state.field=field;state.results=results;state.hint=hint;renderResults();field.focus();}
  function renderResults(){const state=dialog;if(!state||state.mode!=='search')return;const rows=[...state.page.querySelectorAll(state.contacts?'[data-pod-contact]':'[data-pod-list] .minimal-list-item')];const entries=rows.slice(0,50).map(row=>({row,name:row.querySelector('.ts-16')?.textContent?.trim()||'会话',preview:row.querySelector('.ts-13')?.textContent?.trim()||'',time:row.querySelector('.ts-12')?.textContent?.trim()||'',avatar:row.querySelector('.minimal-avatar-wrapper')?.outerHTML||''}));if(state.rendered&&entries.length===state.entries.length&&entries.every((e,i)=>{const o=state.entries[i];return e.row===o.row&&e.name===o.name&&e.preview===o.preview&&e.time===o.time&&e.avatar===o.avatar;}))return;state.rendered=true;state.entries=entries;state.results.replaceChildren();for(const e of entries){const button=document.createElement('button');button.type='button';button.className='pod-search-result';const image=document.createElement('span');image.className='pod-result-avatar';// Clone the visible native avatar only; no message-history or media fetch.
const nativeAvatar=e.row.querySelector('.minimal-avatar-wrapper');if(nativeAvatar)image.append(nativeAvatar.cloneNode(true));const text=document.createElement('span');text.className='pod-result-text';const name=document.createElement('strong');name.textContent=e.name;const preview=document.createElement('small');preview.textContent=e.preview;text.append(name,preview);const time=document.createElement('span');time.className='pod-result-time';time.textContent=e.time;button.append(image,text,time);button.onclick=()=>{const original=e.row;/* Close after the native click: restoring a contact filter can unmount this row. */if(original.isConnected)original.click();closeDialog(false);};state.results.append(button);}if(!entries.length){const empty=document.createElement('p');empty.className='pod-search-empty';empty.textContent=state.contacts?'没有找到匹配的联系人':'没有找到匹配的会话';state.results.append(empty);}state.hint.textContent=rows.length>50?'显示前 50 项，可输入名字缩小范围':rows.length+(state.contacts?' 位联系人':' 个会话');}

  function act(kind){const current=tab();if(kind!==current){pending=kind;const i=['messages','contacts','feeds','me'].indexOf(kind);app.querySelectorAll('.chat-tab-bar>.chat-tab')[i]?.click();return;}
   const p=page();if(!p)return;
   if(kind==='messages'){const input=p.querySelector('input.chat-search-input');if(!input){notify('当前页面没有消息搜索入口');return;}showSearch(p,input);}
   if(kind==='contacts'){const target=[...p.querySelectorAll('.minimal-list-item')].find(n=>n.textContent.includes('New Friends'));if(target){target.click();if(!target.querySelector('.minimal-unread-count'))showEmptyFriends();}else notify('当前页面没有 New Friends 入口');}
   if(kind==='feeds'){const b=p.querySelector('button[aria-label="发布朋友圈"],button[title="发布朋友圈"]');if(b&&!b.disabled)b.click();else notify('当前页面没有发布入口');}
  }
  function quick(){if(menu){closeMenu();return;}const kind=tab();if(kind!=='me'&&kind!=='contacts'){act(kind);return;}menu=own(document.createElement('div'));menu.className='pod-actions';menu.setAttribute('role','group');menu.setAttribute('aria-label','快捷操作');const items=kind==='contacts'?[['contact-search','搜索联系人'],['contacts','New Friends']]:[['messages','搜索消息'],['contacts','New Friends'],['feeds','发布动态']];for(const[k,label]of items){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{closeMenu();if(k==='contact-search'){const p=page(),input=p?.querySelector('input.chat-search-input');if(input)showSearch(p,input,true);else notify('当前页面没有联系人搜索入口');}else act(k);};menu.append(b);}app.append(menu);}
  // 读取原生页头已有的用户头像。原按钮与 React 点击处理保持原位。
  function markNewsAvatar(p){
   const head=p.querySelector('.page-header-content'),button=head?.querySelector('.page-header-right button');if(!button)return;
   attr(button,'data-pod-profile-action','');attr(button,'aria-label','新建对话菜单');
   let face=button.querySelector(':scope>.pod-user-avatar');if(!face){face=own(document.createElement('span'));face.className='pod-user-avatar';face.setAttribute('aria-hidden','true');button.append(face);}
   const source=head.querySelector(':scope>span:first-child img'),src=source?.getAttribute('src')||source?.currentSrc||'';
   if(src){let img=face.querySelector('img');if(!img){img=document.createElement('img');img.alt='';img.decoding='async';face.replaceChildren(img);}if(img.getAttribute('src')!==src)img.setAttribute('src',src);}
   else if(!face.querySelector('.pod-avatar-fallback')){const fallback=icon('profile');fallback.className='pod-avatar-fallback';face.replaceChildren(fallback);}
  }
  function label(parent,cls,value,tag='span'){
   if(!parent)return null;let el=parent.querySelector(':scope>.'+cls);if(!el){el=own(document.createElement(tag));el.className=cls;parent.append(el);}if(el.textContent!==value)el.textContent=value;return el;
  }
  function ornament(parent,cls,svg){if(!parent||parent.querySelector(':scope>.'+cls))return;const el=own(document.createElement('span'));el.className=cls;el.setAttribute('aria-hidden','true');el.innerHTML=svg;parent.append(el);}
  const radioSVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="1.6"/><path d="m8 21 4-10 4 10M9.8 16h4.4M6.5 4a7 7 0 0 0 0 10M17.5 4a7 7 0 0 1 0 10M3.5 1.5a11 11 0 0 0 0 15M20.5 1.5a11 11 0 0 1 0 15"/></svg>';
  const walletSVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6V4h14v4M4 6h15a1 1 0 0 1 1 1v13H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><path d="M20 11h-6v5h6M16 13.5h.1"/></svg>';
  const waveSVG='<svg viewBox="0 0 260 22" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M2 10v2m6-4v6m6-8v10m6-6v2m6-7v12m6-10v8m6-6v4m6-3v2m6-7v12m6-10v8m6-5v2m6-5v8m6-6v4m6-7v10m6-6v2m6-3v4m6-6v8m6-10v12m6-8v4m6-5v6m6-3v1"/><path opacity=".3" d="M130 8v6m6-8v10m6-6v2m6-4v6m6-7v8m6-4v1m6-7v12m6-9v6m6-4v2m6-5v8m6-6v4m6-3v2m6-6v10m6-8v6m6-4v2m6-7v12m6-9v6m6-4v2m6-3v4m6-5v6m6-4v2m6-3v4"/></g></svg>';
  function markHeader(p,current){
   const head=p.querySelector(':scope>.page-header .page-header-content');if(!head)return;
   attr(head,'data-pod-header',current);const back=head.querySelector('button[aria-label="返回"]');if(current!=='messages')attr(back,'data-pod-back','');
   if(current==='feeds'||current==='me')ornament(head,'pod-header-fm','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r=".7" fill="currentColor"/><path d="M6 9a7 7 0 0 1 3-3m6 12a7 7 0 0 0 3-3" stroke-linecap="round"/></svg><small>FM</small>');
  }
  function markContacts(p){
   const input=p.querySelector('input.chat-search-input'),body=p.querySelector(':scope>.page-body');if(!input||!body)return;
   const content=input.closest('.chat-search-bar')?.parentElement?.parentElement;if(!content||!body.contains(content))return;attr(content,'data-pod-directory','');attr(input.closest('.chat-search-bar')?.parentElement,'data-pod-contact-search','');
   const newFriends=[...content.querySelectorAll('.minimal-list-item')].find(n=>n.querySelector('.ts-16')?.textContent.trim()==='New Friends');if(newFriends)attr(newFriends.parentElement,'data-pod-newfriends','');
   const rows=[...content.querySelectorAll('.minimal-list-item')].filter(row=>row!==newFriends&&row.querySelector('.ts-16'));
   let heading=content.querySelector(':scope>.pod-directory-head');if(!heading){heading=own(document.createElement('div'));heading.className='pod-directory-head';heading.setAttribute('role','heading');heading.setAttribute('aria-level','2');const name=document.createElement('strong');name.textContent='CHANNEL DIRECTORY';heading.append(name);ornament(heading,'pod-directory-symbol',radioSVG);content.prepend(heading);}label(heading,'pod-directory-count',rows.length+' CHANNELS');
   rows.forEach((row,index)=>{attr(row,'data-pod-contact','');label(row,'pod-contact-code','CH.'+String(index).padStart(3,'0'));});
  }
  function markFeed(p){
   attr(p.querySelector('button[aria-label="发布朋友圈"]'),'data-pod-compose','');
   const profile=p.querySelector('.feed-profile');if(profile){
    label(profile,'pod-station-label','PUBLIC CHANNEL');label(profile,'pod-station-fm','FM / 01');ornament(profile,'pod-station-wave',waveSVG);
    label(profile,'pod-station-caption','MEMORIES ARE LIKE A WINDOW');label(profile,'pod-station-stay','STAY TUNED');
   }
   [...p.querySelectorAll('.feed-post')].forEach((post,index)=>{
    attr(post,'data-pod-has-media',post.querySelector('.feed-post-media img')?'':null);
    label(post.querySelector('.feed-post-author'),'pod-field-note','FIELD NOTE / '+String(index+1).padStart(3,'0'));
    const menu=post.querySelector('.feed-post-action-menu'),trigger=post.querySelector('.feed-post-more-btn');if(menu&&trigger&&!menu.hasAttribute('data-pod-menu')){attr(menu,'data-pod-menu','');attr(menu,'style',(menu.getAttribute('style')||'')+';--pod-menu-top:'+(trigger.offsetTop+trigger.offsetHeight+5)+'px');}
    const comments=post.querySelector('.feed-comments');if(comments){
     label(comments,'pod-listener-notes','LISTENER NOTES / '+String(comments.querySelectorAll('.feed-comment').length).padStart(3,'0'));
     for(const reply of comments.querySelectorAll('.feed-comment-child')){
      const author=reply.querySelector('.feed-comment-author'),target=reply.querySelector('.feed-comment-reply-target')?.textContent.trim();
      if(author)label(author,'pod-reply-target',target?'→ '+target:'');
     }
    }
   });
  }
  function markProfile(p){
   const body=p.querySelector(':scope>.page-body'),root=body?.querySelector(':scope>div');if(!root)return;
   const hero=[...root.children].find(n=>n.querySelector('img[alt="User Avatar"]')||n.querySelector('.ts-22'));if(!hero)return;
   attr(root,'data-pod-profile-layout','');attr(hero,'data-pod-profile-hero','');
   const name=hero.querySelector('.ts-22'),avatar=hero.querySelector('img[alt="User Avatar"]')?.parentElement||hero.firstElementChild?.firstElementChild;
   attr(name,'data-pod-profile-name','');if(avatar){attr(avatar,'data-pod-profile-avatar','');attr(avatar.parentElement,'data-pod-profile-face-wrap','');ornament(avatar.parentElement,'pod-profile-record','<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="31.5" fill="#e2e3e7" stroke="#d9dbe0"/><g stroke="#bfc2cb" stroke-opacity=".65" stroke-width=".65" stroke-linecap="round"><path d="M46 7.8a28 28 0 0 1 0 48.4"/><path d="M43 13a22 22 0 0 1 0 38"/></g></svg>');}
   if(name){attr(name.parentElement,'data-pod-profile-name-row','');attr(name.parentElement?.parentElement,'data-pod-profile-copy','');}
   const stats=[...hero.querySelectorAll('div')].find(n=>n.textContent.includes('Chatting')&&n.textContent.includes('Moments')&&!n.querySelector('.ts-22'));attr(stats,'data-pod-profile-stats','');
   label(hero,'pod-personal-channel','MY PERSONAL CHANNEL');ornament(hero,'pod-personal-timeline','<svg viewBox="0 0 144 20" fill="none"><g fill="currentColor" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="9" font-weight="500"><text x="0" y="13">0:00</text><text x="144" y="13" text-anchor="end">5:19</text></g><path d="M29 10h83" stroke="currentColor" stroke-opacity=".45" stroke-width="1.5" stroke-linecap="round"/><path d="M29 10h20" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="49" cy="10" r="2.6" fill="currentColor"/></svg>');
   let library=root.querySelector(':scope>.pod-library-heading');if(!library){library=own(document.createElement('div'));library.className='pod-library-heading';library.append(document.createTextNode('快捷访问'));label(library,'pod-heading-en','LIBRARY');root.append(library);}
   let consoleHead=root.querySelector(':scope>.pod-console-heading');if(!consoleHead){consoleHead=own(document.createElement('div'));consoleHead.className='pod-console-heading';consoleHead.append(document.createTextNode('控制台'));label(consoleHead,'pod-heading-en','SETTINGS');root.append(consoleHead);}
   const wallet=[...root.querySelectorAll(':scope>button')].find(n=>n.textContent.includes('Real Balance'));if(wallet){attr(wallet,'data-pod-wallet-shortcut','');attr(wallet,'aria-label','钱包 · '+(wallet.querySelector('.ts-30')?.textContent||'银行管理'));ornament(wallet,'pod-wallet-icon',walletSVG);label(wallet,'pod-wallet-label','钱包');}
   const shortcuts=[...root.children].find(n=>n.tagName==='DIV'&&[...n.children].some(c=>c.tagName==='BUTTON'&&c.textContent.includes('朋友圈互动')));
   if(shortcuts){attr(shortcuts,'data-pod-shortcuts','');[...shortcuts.children].filter(n=>n.tagName==='BUTTON').forEach((button,i)=>attr(button,'data-pod-shortcut',String(i)));}
   const groups=[...root.children].filter(n=>n!==hero&&n!==shortcuts&&n.tagName==='DIV'&&!n.hasAttribute('data-pod-owned'));
   let index=0;groups.forEach((group,i)=>{attr(group,'data-pod-settings-group',String(i));for(const row of group.children)if(row.tagName==='BUTTON'||row.tagName==='DIV')attr(row,'data-pod-setting-tab',index++<4?'0':'1');});
   let tabs=root.querySelector(':scope>.pod-console-tabs');if(!tabs){tabs=own(document.createElement('div'));tabs.className='pod-console-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','控制台分类');for(const [i,name]of ['通信与时间','使用偏好'].entries()){const button=document.createElement('button');button.type='button';button.textContent=name;button.onclick=()=>{consoleTab=String(i);updateConsole(root);};tabs.append(button);}root.append(tabs);}updateConsole(root);
  }
  function updateConsole(root){
   attr(root.querySelector('.pod-console-tabs'),'data-pod-selected',consoleTab);
   root.querySelectorAll('.pod-console-tabs button').forEach((button,i)=>attr(button,'aria-pressed',String(String(i)===consoleTab)));
   let first=true;for(const group of root.querySelectorAll(':scope>[data-pod-settings-group]')){let count=0;for(const row of group.querySelectorAll(':scope>[data-pod-setting-tab]')){const visible=row.getAttribute('data-pod-setting-tab')===consoleTab;attr(row,'data-pod-settings-hidden',visible?null:'');if(visible)count++;}attr(group,'data-pod-settings-hidden',count?null:'');attr(group,'data-pod-settings-first',count&&first?'':null);if(count)first=false;}
  }
  function markMessages(p){
   markNewsAvatar(p);
   const input=p.querySelector('input.chat-search-input');if(!input)return;
   let search=input.closest('.chat-search-bar');while(search?.parentElement&&search.parentElement!==p.querySelector(':scope>.page-body'))search=search.parentElement;
   attr(search,'data-pod-search','');
   const list=p.querySelector('.page-body>div.px-5.pt-2');if(!list)return;attr(list,'data-pod-list','');
   const all=p.querySelector('.chat-list-tab');if(all&&!all.classList.contains('active')){all.click();return;}
   for(const[k,label]of [['private','Heartbeat'],['group','Group']])if(!list.querySelector('[data-pod-section="'+k+'"]'))list.append(own(sectionHeading(k,label)));
   for(const child of list.children)if(!child.hasAttribute('data-pod-owned')&&!child.matches('.minimal-list-item')&&!child.querySelector('.minimal-list-item'))attr(child,'data-pod-native-empty','');
   let privateCount=0,groupCount=0,lastPrivate=null,lastGroup=null;
   for(const row of list.querySelectorAll('.minimal-list-item')){const group=!!row.querySelector('.minimal-avatar-wrapper.grid-cols-2'),holder=row.parentElement===list?row:row.parentElement;attr(holder,'data-pod-kind',group?'group':'private');group?groupCount++:privateCount++;attr(row,'data-pod-last',null);if(group)lastGroup=row;else lastPrivate=row;let play=row.querySelector('.pod-play');if(!play){play=own(playCapsule());row.append(play);}const name=row.querySelector('.ts-16')?.textContent?.trim()||'会话',raw=row.querySelector('.ts-12')?.textContent?.trim()||'',label=play.querySelector('.pod-time-label');if(label.textContent!==name)label.textContent=name;if(play.title!==name)play.title=name;
    let time=row.querySelector('.pod-card-time');if(!time){time=own(document.createElement('span'));time.className='pod-card-time';row.append(time);}const stamp='TIME · '+(raw&&raw!=='AI'?cardTime(raw):'—');if(time.textContent!==stamp)time.textContent=stamp;
   }
   if(lastPrivate)attr(lastPrivate,'data-pod-last','');if(lastGroup)attr(lastGroup,'data-pod-last','');
   for(const[k,count]of [['private',privateCount],['group',groupCount]]){const h=list.querySelector('[data-pod-section="'+k+'"]');let empty=list.querySelector('[data-pod-empty="'+k+'"]');if(!count&&!empty){empty=own(document.createElement('p'));empty.className='pod-empty';if(k==='group')empty.append(groupEmptyContent());else empty.textContent='还没有单聊记录';empty.style.order=k==='private'?'1':'4';empty.setAttribute('data-pod-empty',k);list.append(empty);}if(count&&empty){owned.delete(empty);empty.remove();}if(h)h.hidden=false;}
   const header=p.querySelector('.page-header-content');if(header&&!header.querySelector('.pod-news')){const b=own(document.createElement('button'));b.type='button';b.className='pod-news';const symbol=icon('back');symbol.setAttribute('aria-hidden','true');b.append(symbol);b.setAttribute('aria-label','返回手机桌面');b.onclick=()=>p.querySelector('.page-header button[aria-label="返回"]')?.click();header.append(b);}
  }
  function scan(){queued=false;if(stopped||!app?.isConnected||document.visibilityState==='hidden')return;observer.disconnect();try{
   const ready=getComputedStyle(app).getPropertyValue('--air-pages-ready').trim()==='1';if(!ready||app.hasAttribute('data-threads-pages')){clear();return;}
   attr(app,'data-pod-pages','');if(app.hasAttribute('data-room-active')||app.hasAttribute('data-tabbar-hidden')){closeMenu();closeDialog(false);return;}
   const nav=app.querySelector('.chat-tab-bar');if(!nav)return;
   const tabs=[...nav.querySelectorAll(':scope>.chat-tab')];tabs.forEach((b,i)=>{if(!b.querySelector('.pod-nav-icon')){const image=own(navIcon(['message','contacts','feeds','me'][i]||'me'));image.className='pod-nav-icon';b.prepend(image);}});
   let button=nav.querySelector('.pod-quick');if(!button){button=own(document.createElement('button'));button.type='button';button.className='pod-quick';button.append(icon('tools'));button.onclick=e=>{e.stopPropagation();quick();};nav.append(button);}
   const current=tab(),p=page();
   let indicator=nav.querySelector(':scope>.pod-nav-selection');if(!indicator){indicator=own(document.createElement('span'));indicator.className='pod-nav-selection';indicator.setAttribute('aria-hidden','true');nav.append(indicator);}
   attr(nav,'data-pod-selected',String(Math.max(0,tabs.findIndex(b=>b.classList.contains('chat-tab-active')))));
   button.setAttribute('aria-label',({messages:'搜索消息',contacts:'联系人快捷操作',feeds:'发布朋友圈',me:'快捷操作'})[current]||'快捷操作');
   const quickIcon=({messages:'search',contacts:'search',feeds:'compose',me:'tools'})[current]||'tools';if(button.getAttribute('data-pod-quick-icon')!==quickIcon){attr(button,'data-pod-quick-icon',quickIcon);button.replaceChildren(icon(quickIcon));}
   if(p){attr(p,'data-pod-page',current);markHeader(p,current);if(current==='messages')markMessages(p);if(current==='contacts')markContacts(p);if(current==='feeds')markFeed(p);if(current==='me')markProfile(p);}
   if(dialog&&dialog.tab!==current)closeDialog(false);if(dialog?.mode==='search')renderResults();
   if(pending&&pending===current){const k=pending;pending=null;act(k);}prune();
  }finally{if(!stopped&&app?.isConnected&&document.visibilityState!=='hidden'){const inactive=app.hasAttribute('data-room-active')||app.hasAttribute('data-tabbar-hidden');observer.observe(app,inactive?{attributes:true,attributeFilter:['data-room-active','data-tabbar-hidden']}:{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','src','srcset','data-room-active','data-tabbar-hidden']});}}}
  function schedule(){if(stopped||queued||document.visibilityState==='hidden')return;queued=true;queueMicrotask(scan);}
  const observer=new MutationObserver(records=>{if(app?.hasAttribute('data-room-active')||app?.hasAttribute('data-tabbar-hidden')){if(records.some(r=>r.target===app))schedule();return;}if(records.some(r=>r.type==='childList'||(r.type==='characterData'&&r.target.parentElement?.closest('[data-pod-page]')&&!r.target.parentElement?.closest('[data-pod-owned]'))||(dialog?.mode==='search'&&(r.type==='characterData'||r.attributeName==='src'||r.attributeName==='srcset'))||((r.attributeName==='src'||r.attributeName==='srcset')&&r.target.closest?.('[data-pod-page] .page-header'))||r.target===app||r.target.closest?.('.chat-tab-bar')))schedule();});
  // 隐藏的音乐迷你聊天窗会常驻在主 App 前面；只接管主聊天 App。
  // 等待主界面时观察 workspace 挂载；找到后仅监听 workspace/pane 的直接子节点。
  function find(){
   if(stopped)return;
   const found=[...document.querySelectorAll('.chat-app')].find(el=>!el.closest('.mini-app-window'))||null;
   const workspace=document.querySelector('.phone-workspace');
   if(found===app&&workspace===anchor&&parent===(found?.parentElement||null))return;
   if(found!==app){observer.disconnect();clear();app=found;}
   anchor=workspace;parent=app?.parentElement||null;parentObserver.disconnect();
   if(anchor){bootstrap.disconnect();parentObserver.observe(anchor,{childList:true,subtree:!app});}
   if(parent){bootstrap.disconnect();if(parent!==anchor)parentObserver.observe(parent,{childList:true});}
   if(!anchor&&!app)bootstrap.observe(document.body,{childList:true,subtree:true});
   if(app)schedule();
  }
  const parentObserver=new MutationObserver(find),bootstrap=new MutationObserver(find);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){observer.disconnect();queued=false;}else{find();schedule();}},{signal:abort.signal});
  document.addEventListener('keydown',e=>{if(!dialog)return;if(e.key==='Escape'){e.preventDefault();closeDialog();}else if(e.key==='Tab'){const nodes=[...dialog.panel.querySelectorAll('button,input')].filter(n=>!n.disabled);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}},{signal:abort.signal});
  document.addEventListener('click',e=>{if(menu&&!menu.contains(e.target)&&!e.target.closest?.('.pod-quick'))closeMenu();},{signal:abort.signal});
  find();if(!app&&!anchor)bootstrap.observe(document.body,{childList:true,subtree:true});
  return()=>{stopped=true;abort.abort();observer.disconnect();parentObserver.disconnect();bootstrap.disconnect();clear();app=null;parent=null;anchor=null;};
 }
};
