123
export default {
  manifest: {
    id: 'chat-pet-dock',
    name: 'chat pet dock',
    apiVersion: 1,
    version: '1.7.0',
    permissions: ['chat.read'],
    settings: [
      { key: 'size', label: '高度px', type: 'number', default: 72 },
      { key: 'mode', label: '动效', type: 'select', default: 'bounce',
        options: [{ value: 'bounce', label: '一弹一弹' }, { value: 'static', label: '静止' }] }
    ]
  },
  setup(ctx) {
    var S = ctx.system.storage;
    var box = document.createElement('div');
    var img = null;
    var pos = { x: 100, y: 320 };
    var st = null;
    var moved = false;
    var lpd = false;
    var lt = null;

    box.id = 'cpd';
    box.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483000;touch-action:none;-webkit-tap-highlight-color:transparent';
    document.body.appendChild(box);

    ctx.ui.injectCSS(
      '#cpd img{display:block;max-width:70vw;transform-origin:50% 100%;user-select:none;-webkit-user-drag:none}' +
      '#cpd .b{animation:cpb 1.2s ease-in-out infinite}' +
      '#cpd button{font:inherit;font-size:11px;padding:8px 12px;border-radius:12px;border:1px dashed rgba(128,128,128,.6);background:rgba(255,255,255,.7);color:inherit}' +
      '@keyframes cpb{0%,100%{transform:translateY(0)}55%{transform:translateY(-12%)}}'
    );

    function num(v, d) {
      var x = Number(v);
      return isNaN(x) ? d : x;
    }

    function paint() {
      var w = box.offsetWidth || 52;
      var h = box.offsetHeight || 52;
      var W = window.innerWidth || 360;
      var H = window.innerHeight || 640;
      pos.x = Math.max(0, Math.min(pos.x, W - w));
      pos.y = Math.max(0, Math.min(pos.y, H - h));
      box.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
    }

    function save() {
      try {
        S.set('pp', JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y) }));
      } catch (e) {}
    }

    function load() {
      try {
        var r = S.get('pp');
        if (r) {
          var o = typeof r === 'string' ? JSON.parse(r) : r;
          if (o && typeof o.x === 'number' && typeof o.y === 'number') {
            pos.x = o.x;
            pos.y = o.y;
          }
        }
      } catch (e) {}
      paint();
    }

    function render() {
      box.innerHTML = '';
      img = null;
      var src = null;
      try { src = S.get('pi'); } catch (e) {}
      if (!src || typeof src !== 'string') {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = '＋ 添加宠物图片';
        b.onclick = function (e) { e.stopPropagation(); choose(); };
        box.appendChild(b);
      } else {
        img = document.createElement('img');
        img.src = src;
        img.alt = 'pet';
        img.className = ctx.system.settings.get('mode') === 'static' ? '' : 'b';
        img.style.height = num(ctx.system.settings.get('size'), 72) + 'px';
        box.appendChild(img);
      }
    }

    function choose() {
      var f = document.createElement('input');
      f.type = 'file';
      f.accept = 'image/*';
      f.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(f);
      f.onchange = function () {
        var file = f.files && f.files[0];
        setTimeout(function () { f.remove(); }, 0);
        if (!file) return;
        var rd = new FileReader();
        rd.onload = function () {
          var i = new Image();
          i.onload = function () {
            var w = i.naturalWidth || 1;
            var h = i.naturalHeight || 1;
            var s = Math.min(1, 512 / Math.max(w, h));
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(w * s));
            c.height = Math.max(1, Math.round(h * s));
            var g2 = c.getContext('2d');
            g2.drawImage(i, 0, 0, c.width, c.height);
            try { S.set('pi', c.toDataURL('image/png')); } catch (e) {}
            render();
            paint();
            ctx.ui.toast('已保存');
          };
          i.src = rd.result;
        };
        rd.readAsDataURL(file);
      };
      f.click();
    }

    function poke() {
      if (!img) return;
      img.style.transition = 'transform .13s';
      img.style.transform = 'scale(1.14,.86)';
      setTimeout(function () {
        img.style.transform = 'scale(1,1)';
        setTimeout(function () {
          img.style.transition = '';
          img.style.transform = '';
        }, 150);
      }, 130);
    }

    box.onpointerdown = function (e) {
      st = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y };
      moved = false;
      lpd = false;
      clearTimeout(lt);
      lt = setTimeout(function () {
        if (!moved) { lpd = true; choose(); }
      }, 700);
      try { box.setPointerCapture(e.pointerId); } catch (err) {}
    };

    box.onpointermove = function (e) {
      if (!st) return;
      var dx = e.clientX - st.x;
      var dy = e.clientY - st.y;
      if (!moved) {
        if (Math.abs(dx) + Math.abs(dy) < 6) return;
        moved = true;
        clearTimeout(lt);
      }
      pos.x = st.ox + dx;
      pos.y = st.oy + dy;
      paint();
    };

    box.onpointerup = function () {
      clearTimeout(lt);
      if (moved) save();
      else if (!lpd) poke();
      st = null;
    };

    box.onpointercancel = function () {
      clearTimeout(lt);
      st = null;
      moved = false;
    };

    box.oncontextmenu = function (e) { e.preventDefault(); };

    if (ctx.system.settings.onChange) {
      ctx.system.settings.onChange(function () { render(); paint(); });
    }

    function onRz() { paint(); }
    window.addEventListener('resize', onRz);

    render();
    pos.x = Math.round(((window.innerWidth || 360) - (box.offsetWidth || 52)) / 2);
    pos.y = (window.innerHeight || 640) - num(ctx.system.settings.get('size'), 72) - 120;
    load();

    return function () {
      clearTimeout(lt);
      window.removeEventListener('resize', onRz);
      if (box.parentNode) box.parentNode.removeChild(box);
    };
  }
};
