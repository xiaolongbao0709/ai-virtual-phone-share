export default {
  manifest: {
    id: "xhs-reader",
    name: "小红书读取",
    apiVersion: 1,
    version: "6.3.0",
    author: "克里 & 小卷",
    description: "发小红书链接自动抓取笔记内容，微信风格卡片显示，AI可主动搜索分享小红书",
    permissions: ["chat.read", "ai"],
    settings: [
      { key: "apiKey", label: "TikHub API Key", type: "text", default: "" },
      { key: "workerUrl", label: "后端地址", type: "text", default: "" },
      { key: "sendImages", label: "让AI看到配图", type: "boolean", default: true },
      { key: "maxImages", label: "最多发送图片数", type: "number", default: 5 },
      { key: "fetchComments", label: "读取评论", type: "boolean", default: true },
      { key: "commentCount", label: "评论数量", type: "number", default: 10 },
      { key: "commentSort", label: "评论排序", type: "select", default: "latest_v2", options: [
        { value: "latest_v2", label: "最新" },
        { value: "like_count", label: "最热" },
        { value: "default", label: "默认" }
      ]},
      { key: "musicCover", label: "音乐卡片显示封面", type: "boolean", default: true },
      { key: "musicApi", label: "网易云API地址", type: "text", default: "" },
      { key: "searchCount", label: "搜索结果数量", type: "number", default: 3 },
    ],
  },
  setup(ctx) {
    var XHS_RE = /https?:\/\/(www\.xiaohongshu\.com\/(explore|discovery\/item)\/[a-zA-Z0-9]+|xhslink\.cn\/[a-zA-Z0-9/]+)/;
    var XHS_ID_RE = /xiaohongshu\.com\/(explore|discovery\/item)\/([a-zA-Z0-9]+)/;
    var isLoading = false;
    var coverCache = {};
    var musicCoverCache = {};

    function fmtNum(n){if(!n&&n!==0)return"0";if(n>=10000)return(n/10000).toFixed(1)+"w";if(n>=1000)return(n/1000).toFixed(1)+"k";return String(n)}

    function buildCardHtml(data) {
      var title=data.title||"小红书笔记",author=data.author||"",likes=data.likes||0,cmt=data.comments||0,collected=data.collected||0,imageCount=data.imageCount||0,type=data.type||"normal",loading=data.loading!==false,coverB64=data.coverB64||"",link=data.link||"";
      var coverHtml=coverB64?'<img src="'+coverB64+'" style="width:100%;height:100%;object-fit:cover;"/>':'';
      return '<div class="xhs-card-wrap" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e0e0e0;width:100%;font-family:-apple-system,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.06);'+(link?'cursor:pointer;':'')+'">'
        +'<div style="display:flex;padding:14px;gap:12px;align-items:center;">'
          +'<div style="flex:1;min-width:0;">'
            +'<div style="font-size:15px;font-weight:600;color:#333;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">'+title+'</div>'
            +(loading?'<div style="font-size:12px;color:#999;margin-top:6px;">\uD83D\uDCD5 读取中...</div>'
              :(author?'<div style="font-size:12px;color:#999;margin-top:5px;">@'+author+'</div>':'')
                +'<div style="font-size:11px;color:#bbb;margin-top:3px;">'+fmtNum(likes)+'赞 · '+fmtNum(cmt)+'评论 · '+fmtNum(collected)+'收藏'+(imageCount>0?' · '+imageCount+'图':'')+(type==="video"?' · 视频':'')+'</div>')
          +'</div>'
          +'<div class="xhs-card-cover" style="width:50px;height:50px;border-radius:6px;background:#f5f5f5;flex-shrink:0;overflow:hidden;">'+coverHtml+'</div>'
        +'</div>'
        +'<div style="border-top:1px solid #f0f0f0;padding:7px 14px;display:flex;align-items:center;gap:6px;">'
          +'<div style="width:16px;height:16px;background:#ff2442;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:bold;">红</div>'
          +'<span style="font-size:12px;color:#999;">小红书</span>'
        +'</div></div>';
    }

    async function loadMusicCovers(){
      var enabled=ctx.system.settings.get("musicCover");if(enabled===false||enabled==="false")return;
      var musicApi=(ctx.system.settings.get("musicApi")||"").replace(/\/$/,"");if(!musicApi)return;
      var cards=document.querySelectorAll(".chat-music-share-card");
      for(var ci=0;ci<cards.length;ci++){
        var card=cards[ci];
        var coverEl=card.querySelector(".chat-music-share-cover");if(!coverEl||coverEl.querySelector("img"))continue;
        var titleEl=card.querySelector(".chat-music-share-title"),artistEl=card.querySelector(".chat-music-share-artist");if(!titleEl)continue;
        var songName=titleEl.textContent||"",artist=artistEl?artistEl.textContent||"":"",cacheKey=songName+" "+artist;
        if(musicCoverCache[cacheKey]){coverEl.innerHTML='<img src="'+musicCoverCache[cacheKey]+'" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"/>';continue}
        var stored=null;try{stored=ctx.system.storage.get("music-cover-"+cacheKey);if(stored&&typeof stored.then==="function")stored=await stored}catch(e){}
        if(stored){musicCoverCache[cacheKey]=stored;coverEl.innerHTML='<img src="'+stored+'" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"/>';continue}
        try{
          var r=await fetch(musicApi+"/search?keywords="+encodeURIComponent(cacheKey)+"&limit=1");var d=await r.json();
          if(!d.result||!d.result.songs||!d.result.songs[0])continue;var albumId=d.result.songs[0].album&&d.result.songs[0].album.id;if(!albumId)continue;
          var r2=await fetch(musicApi+"/album?id="+albumId);var ad=await r2.json();
          if(!ad||!ad.album||!ad.album.picUrl)continue;
          musicCoverCache[cacheKey]=ad.album.picUrl;
          try{var sr=ctx.system.storage.set("music-cover-"+cacheKey,ad.album.picUrl);if(sr&&typeof sr.then==="function")await sr}catch(e){}
          if(coverEl)coverEl.innerHTML='<img src="'+ad.album.picUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"/>';
        }catch(e){}
      }
    }
    ctx.hooks.on("session.opened",function(){setTimeout(loadMusicCovers,1000)});
    ctx.system.timers.setInterval(loadMusicCovers,5000);

    ctx.ui.messageKind("xhs-card",function(el,msg){
      try{var data=msg.mediaData||{};var node=el.parentElement;for(var i=0;i<8&&node;i++){if((node.className||"").indexOf("chat-bubble-role-user")!==-1||(node.className||"").indexOf("chat-bubble-role-assistant")!==-1){node.classList.add("chat-bubble-media");node.style.padding="0";break}node=node.parentElement}
      el.style.cssText="padding:0;margin:0;";el.innerHTML=buildCardHtml(data);
      var link=data.link||"";if(link){var cardEl=el.querySelector(".xhs-card-wrap");if(cardEl)cardEl.onclick=function(){window.open(link,"_blank")}}
      if(!data.coverB64&&data.coverUrl&&data.loading===false){var coverEl=el.querySelector(".xhs-card-cover");if(coverCache[data.coverUrl]){coverEl.innerHTML='<img src="'+coverCache[data.coverUrl]+'" style="width:100%;height:100%;object-fit:cover;"/>';}else{var wUrl=(ctx.system.settings.get("workerUrl")||"").replace(/\/$/,"");if(wUrl){ctx.system.fetch(wUrl+"/api/xhs-images",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({urls:[data.coverUrl]})}).then(function(r){return r.json()}).then(function(rd){if(rd.ok&&rd.images&&rd.images[0]&&rd.images[0].base64){var src="data:"+(rd.images[0].mime||"image/webp")+";base64,"+rd.images[0].base64;coverCache[data.coverUrl]=src;if(coverEl)coverEl.innerHTML='<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;"/>';}}).catch(function(){});}}}
      }catch(e){el.innerHTML='<div style="padding:10px;color:#999;font-size:12px;">[小红书卡片]</div>'}
    });

    ctx.hooks.transform("message.beforePersist",function(p){
      try{if(!p||!p.message)return p;var msg=p.message;if(msg.role!=="user"&&msg.role!=="assistant")return p;var text=msg.content||"";if(!text.match(XHS_RE))return p;var match=text.match(XHS_RE);
      p.message=Object.assign({},msg,{mediaType:"plugin:xhs-card",mediaData:{title:"小红书笔记",link:match[0],loading:true}})}catch(e){}return p;
    });

    ctx.hooks.transform("llm.response",async function(p){
      if(!p.text||!p.sessionId)return p;
      var match=p.text.match(/【搜索小红书[：:]([^】]+)】/);
      if(!match)return p;
      var keyword=match[1].trim();
      var workerUrl=(ctx.system.settings.get("workerUrl")||"").replace(/\/$/,"");
      if(!workerUrl||!keyword){p.text=p.text.replace(/【搜索小红书[：:][^】]+】/g,"");return p}
      try{
        var resp=await ctx.system.fetch(workerUrl+"/api/xhs-search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({keyword:keyword,count:ctx.system.settings.get("searchCount")||3})});
        var d=await resp.json();
        if(d.ok&&d.results&&d.results.length>0){
          var resultText="\n\n";
          var titles=[];
          d.results.slice(0,2).forEach(function(r){
            resultText+="https://www.xiaohongshu.com/explore/"+r.noteId+"\n\n";
            titles.push(r.title);
          });
          try{
            var comment=await ctx.ai.chat({prompt:"你刚在小红书上搜到了这些内容："+titles.join("、")+"。请用1-2句话随意评价一下（可以是期待、吐槽、感叹、推荐理由等），语气自然随性，不要太正式。只输出评价，不要输出链接。",temperature:0.9,maxTokens:100});
            if(comment)resultText+=comment.trim()+"\n";
          }catch(e){}
          p.text=p.text.replace(/【搜索小红书[：:][^】]+】/,resultText);
        }else{p.text=p.text.replace(/【搜索小红书[：:][^】]+】/,"（没找到相关内容）")}
      }catch(e){p.text=p.text.replace(/【搜索小红书[：:][^】]+】/g,"")}
      return p;
    },{priority:40,timeoutMs:60000});

    ctx.hooks.on("message.persisted",async function(payload){
      var msg=payload.message;if(!msg)return;
      if(msg.mediaType&&msg.mediaType.indexOf("music")!==-1){setTimeout(loadMusicCovers,800);return}
      var text=msg.content||"";
      if(msg.role==="user"&&!text.match(XHS_RE)){
        var hasXhs=/小红书|xhs/i.test(text);
        var hasSearch=/搜|找|推荐|看看|有没有|有什么|想看|想找|刷|逛/.test(text);
        if(!hasXhs&&!hasSearch)return;
        if(!hasSearch)return;
        if(!hasXhs){var recent=ctx.data.messages.list(msg.sessionId).slice(-10);var recentHasXhs=recent.some(function(m){return/小红书|xhs/i.test(m.content||"")});if(!recentHasXhs)return}
        if(/测试|测一下|试试|试一下|搜索功能|怎么用|怎么搜/.test(text))return;
        var keyword;
        try{
          var recentMsgs=ctx.data.messages.list(msg.sessionId).slice(-6);
          var context=recentMsgs.map(function(m){return(m.role==="user"?"用户：":"AI：")+m.content}).join("\n");
          keyword=await ctx.ai.chat({prompt:"根据以下对话上下文，提取用户最新一条消息中想在小红书搜索的关键词。只输出关键词本身，不要输出任何其他文字、标点或解释：\n\n"+context+"\n\n用户最新消息："+text,temperature:0});
          keyword=(keyword||"").trim().replace(/^["「『"']|["」』"']$/g,"").replace(/^关键词[：:]\s*/,"").trim();
        }catch(e){keyword=null}
        if(!keyword||keyword.length<2||keyword.length>30)return;
        var workerUrl=(ctx.system.settings.get("workerUrl")||"").replace(/\/$/,"");if(!workerUrl)return;
        var searchCount=ctx.system.settings.get("searchCount")||3;
        ctx.system.log("xhs: 搜索触发，关键词:",keyword);
        var toast=ctx.ui.toast("\uD83D\uDD0D 正在搜索小红书: "+keyword,{durationMs:0});
        try{var resp=await ctx.system.fetch(workerUrl+"/api/xhs-search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({keyword:keyword,count:searchCount})});
        var d=await resp.json();if(!d.ok||!d.results||d.results.length===0){toast.close();ctx.ui.toast("没有找到相关内容",{durationMs:2000});return}
        ctx.system.log("xhs: 搜索到",d.results.length,"条结果");
        var resultText="\n【系统提示：以下是小红书搜索「"+keyword+"」的结果，请根据你的角色性格和当前聊天氛围，自然地分享给用户。每条推荐后单独一行附上对应的链接即可。不要输出【搜索小红书】这样的标记。】\n\n";
        d.results.forEach(function(r,i){resultText+=(i+1)+". 「"+r.title+"」\n作者: @"+r.author+" | "+fmtNum(r.likedCount)+"赞 "+fmtNum(r.commentCount)+"评论 "+fmtNum(r.collectedCount)+"收藏"+(r.type==="video"?" | 视频":" | "+r.imageCount+"图")+"\n   链接: https://www.xiaohongshu.com/explore/"+r.noteId+"\n\n"});
        await ctx.system.storage.remove("xhs-pending-"+msg.sessionId);
        await ctx.system.storage.set("xhs-search-"+msg.sessionId,JSON.stringify({resultText:resultText,timestamp:Date.now()}));
        toast.close();ctx.ui.toast("\u2705 找到 "+d.results.length+" 条结果",{durationMs:2000})}catch(e){ctx.system.log("xhs: 搜索失败",e.message);toast.close();ctx.ui.toast("\u274C 搜索失败",{durationMs:2000})}return;
      }
      var match=text.match(XHS_RE);if(!match)return;if(msg.role!=="user"&&msg.role!=="assistant")return;
      var apiKey=ctx.system.settings.get("apiKey")||"",workerUrl=(ctx.system.settings.get("workerUrl")||"").replace(/\/$/,"");if(!workerUrl)return;
      var sessionId=msg.sessionId,msgId=msg.id;ctx.system.log("xhs: found link in",msg.role,match[0]);isLoading=true;
      var toast=ctx.ui.toast("\uD83D\uDCD5 正在读取小红书笔记...",{durationMs:0});
      try{var reqBody={apiKey:apiKey};var idMatch=text.match(XHS_ID_RE);if(idMatch)reqBody.noteId=idMatch[2];else reqBody.shareText=text;
      var fc=ctx.system.settings.get("fetchComments");reqBody.fetchComments=fc!==false&&fc!=="false";reqBody.commentCount=ctx.system.settings.get("commentCount")||10;reqBody.commentSort=ctx.system.settings.get("commentSort")||"latest_v2";
      var resp=await ctx.system.fetch(workerUrl+"/api/xhs-card",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(reqBody)});
      var d=await resp.json();if(!d.ok||!d.note)throw new Error(d.error||"获取失败");var note=d.note;
      ctx.system.log("xhs: got",note.title,"author:"+note.author,"type:"+note.type,"source:"+(d.source||"unknown"));
      var displayTitle=note.title||"小红书笔记";toast.close();toast=ctx.ui.toast("加载封面...",{durationMs:0});
      var coverB64="";if(note.images&&note.images[0]){try{var cr=await ctx.system.fetch(workerUrl+"/api/xhs-images",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({urls:[note.images[0]]})});var cd=await cr.json();if(cd.ok&&cd.images&&cd.images[0]){coverB64="data:"+(cd.images[0].mime||"image/webp")+";base64,"+cd.images[0].base64;coverCache[note.images[0]]=coverB64;}}catch(e){}}
      var cardData={title:displayTitle,author:note.author||"",likes:note.likedCount||0,comments:note.commentCount||0,collected:note.collectedCount||0,imageCount:note.imageCount||0,type:note.type||"normal",coverUrl:(note.images&&note.images[0])||"",coverB64:coverB64,link:match[0],loading:false};
      ctx.data.messages.update(msgId,{mediaData:cardData});
      setTimeout(function(){var wraps=document.querySelectorAll(".xhs-card-wrap");for(var j=wraps.length-1;j>=0;j--){var w=wraps[j];if(w.querySelector("div[style*='读取中']")||(w.querySelector("div[style*='font-weight:600']")&&w.querySelector("div[style*='font-weight:600']").textContent==="小红书笔记")){var parent=w.parentElement;if(parent){parent.innerHTML=buildCardHtml(cardData);var newCard=parent.querySelector(".xhs-card-wrap");if(newCard&&cardData.link)newCard.onclick=function(){window.open(cardData.link,"_blank")};}break;}}},300);
      toast.close();ctx.ui.toast("\u2705 "+displayTitle,{durationMs:2000});
      if(msg.role==="user"){var imgs64=[];var sendImg=ctx.system.settings.get("sendImages");
      if(sendImg!==false&&sendImg!=="false"){var max=ctx.system.settings.get("maxImages")||5;if(note.images&&note.images.length>0){var urls=note.images.slice(0,max);for(var i=0;i<urls.length;i++){try{var ir=await ctx.system.fetch(workerUrl+"/api/xhs-images",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({urls:[urls[i]]})});var id2=await ir.json();if(id2.ok&&id2.images&&id2.images[0])imgs64.push(id2.images[0])}catch(e){}}}
      if(note.videoFrames&&note.videoFrames.length>0){for(var i=0;i<note.videoFrames.length;i++)imgs64.push(note.videoFrames[i])}}
      var nt="\u3010\u5C0F\u7EA2\u4E66\u7B14\u8BB0\u3011\n\u6807\u9898\uFF1A"+displayTitle+"\n\u4F5C\u8005\uFF1A"+(note.author||"未知")+"\n\u6B63\u6587\uFF1A"+note.desc+"\n\u4E92\u52A8\uFF1A\u2764\uFE0F"+note.likedCount+" \uD83D\uDCAC"+note.commentCount+" \u2B50"+note.collectedCount+"\n";
      if(note.type==="video")nt+="\u7C7B\u578B\uFF1A\u89C6\u9891\u7B14\u8BB0\n";nt+="\u914D\u56FE\uFF1A"+note.imageCount+"\u5F20\n";
      if(note.videoFrames&&note.videoFrames.length>0)nt+="\u89C6\u9891\u62BD\u5E27\uFF1A"+note.videoFrames.length+"\u5E27\n";
      if(note.tags&&note.tags.length>0)nt+="\u6807\u7B7E\uFF1A"+note.tags.join(" / ")+"\n";
      if(note.comments&&note.comments.length>0){nt+="\n\u8BC4\u8BBA\u533A\uFF1A\n";note.comments.forEach(function(c,i){var line=(i+1)+". "+c.user;if(c.ipLocation)line+="("+c.ipLocation+")";line+="\uFF1A"+c.content;if(c.likeCount>0)line+=" [\u2764\uFE0F"+c.likeCount+"]";nt+=line+"\n"})}
      if(imgs64.length>0)nt+="\n\uFF08\u4EE5\u4E0B\u9644\u6709\u56FE\u7247/\u89C6\u9891\u5E27\uFF09\n";
      await ctx.system.storage.set("xhs-pending-"+sessionId,JSON.stringify({noteText:nt,imagesBase64:imgs64,timestamp:Date.now()}));}
      }catch(err){ctx.system.log("xhs error:",err.message||err);toast.close();ctx.ui.toast("\u274C "+(err.message||"加载失败"),{durationMs:3000})}finally{isLoading=false}
    });

    ctx.hooks.transform("llm.request",async function(p){
      if(!p.sessionId)return p;
      var searchRaw=await ctx.system.storage.get("xhs-search-"+p.sessionId);
      if(searchRaw){await ctx.system.storage.remove("xhs-search-"+p.sessionId);try{var sd=JSON.parse(searchRaw);if(Date.now()-sd.timestamp<60000){var msgs=p.messages;for(var i=msgs.length-1;i>=0;i--){if(msgs[i].role==="user"){if(typeof msgs[i].content==="string")msgs[i].content+=sd.resultText;break}}}}catch(e){}}
      var raw=await ctx.system.storage.get("xhs-pending-"+p.sessionId);if(!raw)return p;
      var d;try{d=JSON.parse(raw)}catch(e){return p}if(Date.now()-d.timestamp>300000)return p;
      var parts=[{type:"text",text:d.noteText}];if(d.imagesBase64){for(var i=0;i<d.imagesBase64.length;i++){var img=d.imagesBase64[i];if(img&&img.base64)parts.push({type:"image_url",image_url:{url:"data:"+(img.mime||"image/webp")+";base64,"+img.base64}})}}
      var msgs2=p.messages;for(var i=msgs2.length-1;i>=0;i--){if(msgs2[i].role==="user"){var orig=msgs2[i].content;if(typeof orig==="string")msgs2[i].content=[{type:"text",text:orig}].concat(parts);else if(Array.isArray(orig))msgs2[i].content=orig.concat(parts);break}}
      return p;
    },{priority:50,timeoutMs:60000});

    ctx.hooks.transform("user.beforeSend",function(p){if(isLoading){ctx.ui.toast("内容还在加载中，稍等一下~");p.cancelled=true}return p},{priority:10});
  },
};