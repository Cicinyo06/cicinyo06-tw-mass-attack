/*
 * File: dddd.js (v8.4 - Strict+)
 * Purpose: Büyük Atak – TR BBCode Export + "Gönder" linki (TABLOSUZ, BAŞLIKSIZ, KALKIŞA GÖRE SIRALI)
 *
 * Öne Çıkanlar (Strict+):
 * - Metni önce normalize eder: │ ｜ ∣ ¦ => '|' ; NBSP/ZWSP/BOM/soft hyphen v.b. temizlenir.
 * - Sonra STRICT regex uygular: yalnızca ###|### (opsiyonel boşluklarla).
 * - UI'da Strict toggle mevcut (varsayılan: AÇIK). Kapalıyken çok formatlı esnek regex kullanılır.
 * - Popup engellenirse otomatik olarak sayfa üstü MODAL açılır.
 * - Kopyala butonu, otomatik giriş kaydı (localStorage), canlı sayaçlar, örnek doldur/temizle.
 */

(function DDDD_MassAttack_TR_BBCode_OneFile_v84(){
  'use strict';

  // ------------ Durum ------------
  const LS_PREFIX = 'dd_tr_mass_attack';
  const TIME_INTERVAL = 1000*60*60*24*30; // 30 gün
  let unitInfo = null;
  let attackPlannerWindow = null; // (popup referansı, varsa)

  // ------------ Yardımcılar ------------
  const nowMs = () => Date.now();

  // jQuery gerekirse yükle
  function ensureJQ(){
    return new Promise((resolve)=>{
      if (window.jQuery) return resolve(window.jQuery);
      const s=document.createElement('script');
      s.src='https://code.jquery.com/jquery-3.6.0.min.js';
      s.onload=()=>resolve(window.jQuery);
      s.onerror=()=>resolve(null);
      document.head.appendChild(s);
    });
  }

  // XML -> JS (küçük dönüştürücü)
  function xml2json($xml) {
    const data = {};
    jQuery.each($xml.children(), function () {
      const $this = jQuery(this);
      if ($this.children().length > 0) {
        data[$this.prop('tagName')] = xml2json($this);
      } else {
        data[$this.prop('tagName')] = jQuery.trim($this.text());
      }
    });
    return data;
  }

  // "dd/mm/yyyy HH:mm:ss" -> Date
  function parseLandingTime(s) {
    const str = String(s||'').trim();
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if(!m) return new Date(NaN);
    const [,dd,mm,yyyy,HH,MM,SS] = m;
    return new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`);
  }
  function fmtUnpadded(date){
    const D=String(date.getDate()), M=String(date.getMonth()+1), Y=date.getFullYear();
    const HH=String(date.getHours()).padStart(2,'0');
    const MM=String(date.getMinutes()).padStart(2,'0');
    const SS=String(date.getSeconds()).padStart(2,'0');
    return `${D}/${M}/${Y} ${HH}:${MM}:${SS}`;
  }
  function padDateTime(date){
    const dd=String(date.getDate()).padStart(2,'0');
    const mm=String(date.getMonth()+1).padStart(2,'0');
    const yy=date.getFullYear();
    const HH=String(date.getHours()).padStart(2,'0');
    const MM=String(date.getMinutes()).padStart(2,'0');
    const SS=String(date.getSeconds()).padStart(2,'0');
    return `${dd}/${mm}/${yy} ${HH}:${MM}:${SS}`;
  }
  const toInt = (v,d)=>{const n=parseInt(v,10);return Number.isFinite(n)?n:d;};
  const toFloat=(v,d)=>{const n=parseFloat(String(v).replace(',','.'));return Number.isFinite(n)?n:d;};

  // ------------ Normalizasyon (Strict+) ------------
  // Görünmez/egzotik boşlukları temizle + pipe lookalike'ları ASCII '|' yap
  function normalizeText(text){
    return String(text)
      // Pipe lookalike -> '|'
      .replace(/[\u2502\uFF5C\u2223\u00A6]/g, '|')    // │, ｜, ∣, ¦
      // NBSP ve farklı genişlikte boşluklar -> normal boşluk
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
      // Zero-width & BOM & soft hyphen -> kaldır
      .replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, '');
  }

  // ------------ Koordinat Araçları ------------
  // Esnek Mod: "362 521", "362|521", "362x521", "362,521", "362/521", "362-521", "362.521"
  const COORD_RE      = /\b(\d{3})\s*(?:[|,.;:xX×/\\-\s])\s*(\d{3})\b/g;
  const COORD_RE_ONE  = /\b(\d{3})\s*(?:[|,.;:xX×/\\-\s])\s*(\d{3})\b/;
  // Strict Mod: yalnızca ###|### (opsiyonel boşluklar)
  const COORD_RE_STRICT     = /\b(\d{3})\s*\|\s*(\d{3})\b/g;
  const COORD_RE_ONE_STRICT = /\b(\d{3})\s*\|\s*(\d{3})\b/;

  // Dahili temsil: "x|y"
  const normCoord=(x,y)=>{
    const xi=+x, yi=+y;
    if(!Number.isFinite(xi)||!Number.isFinite(yi)) return null;
    if(xi<0||xi>999||yi<0||yi>999) return null;
    return `${xi}|${yi}`;
  };
  const dispCoord=(c)=>{const [x,y]=String(c).split('|'); return `(${x}|${y})`;};

  // Metinden koordinatları ayıkla (Strict+ => önce normalize, sonra strict veya flexible)
  // opts.strict => true/false
  function parseCoords(text, opts){
    const strict = !!(opts && (opts.strict || opts === true));
    const base = strict ? COORD_RE_STRICT : COORD_RE;
    // Global regexler lastIndex tuttuğu için her çağrıda kopya üret
    const re = new RegExp(base.source, 'g');

    const s = normalizeText(text);  // Strict+ kritik adım
    const out=[], seen=new Set();
    if(!s) return out;
    let m;
    while((m = re.exec(s)) !== null){
      const c = normCoord(m[1], m[2]);
      if(c && !seen.has(c)){ seen.add(c); out.push(c); }
    }
    return out;
  }

  // İki koordinat arası mesafe (tile)
  function distance(a,b){
    const [ax,ay]=String(a).split('|').map(Number);
    const [bx,by]=String(b).split('|').map(Number);
    if([ax,ay,bx,by].some(n=>!Number.isFinite(n))){
      throw new Error(`Geçersiz koordinat: "${a}" veya "${b}"`);
    }
    return Math.hypot(ax-bx, ay-by);
  }

  // ------------ Hız (dk/kare) ------------
  function getUnitSpeed(unit){
    const ui=unitInfo||{};
    const u=unit||'';
    const candidates=[
      ui?.config?.[u]?.speed,
      ui?.config?.units?.[u]?.speed,
      ui?.[u]?.speed,
      ui?.units?.[u]?.speed
    ];
    for(const v of candidates){
      const n=Number(v);
      if(Number.isFinite(n) && n>0) return n;
    }
    return null;
  }
  const minutesFor=(unit,dist)=>{
    const s=getUnitSpeed(unit);
    if(!s) throw new Error(`Birim hızı bulunamadı: ${unit}`);
    return dist*s;
  };
  function withinMaxHours(hoursStr, unit, dist){
    const raw=String(hoursStr||'').trim();
    if(!raw) return true;
    const h=toFloat(raw,NaN);
    if(!(h>0)) return true;
    return minutesFor(unit,dist) <= h*60;
  }
  function launchTime(unit, landingDate, dist){
    const s=getUnitSpeed(unit);
    if(!(landingDate instanceof Date) || isNaN(landingDate.getTime())) throw new Error('Geçersiz iniş tarihi');
    if(!s) throw new Error(`Birim hızı bulunamadı veya geçersiz: ${unit}`);
    const ms=dist*s*60*1000;
    const t = Math.floor((landingDate.getTime()-ms)/1000)*1000; // saniye hizası
    return new Date(t);
  }

  // Köy ID eşlemesi (başarısız olursa boş döner; link yine çalışır)
  async function mapOwnVillageIdsByCoords(){
    try{
      const html = await jQuery.get(game_data.link_base_pure + 'overview_villages&mode=combined&group=0');
      const htmlDoc = jQuery.parseHTML(html);
      const rows = jQuery(htmlDoc).find('#combined_table tr.nowrap');
      const map = {};
      rows.each(function(){
        const cell=jQuery(this).find('td:eq(1) span.quickedit-vn');
        const id=cell.attr('data-id');
        const cellText = normalizeText(cell.text()); // Strict+ normalize
        // Oyunun listesinde genelde ###|### formatı var -> strict tek eşleşme
        const m=(cellText.match(COORD_RE_ONE_STRICT)||null);
        const coords=m?`${m[1]}|${m[2]}`:undefined;
        if(id && coords) map[coords]=parseInt(id,10);
      });
      return map;
    }catch(e){
      console.warn('[MassAttack] Köy ID eşlemesi alınamadı:', e);
      return {};
    }
  }

  // ------------ Düz Satır Üretici ------------
  function plansToFlatBBCode(plans){
    const origin=(window.location.origin||'').replace(/\/$/,'');
    const gd=(typeof window!=='undefined' && window.game_data) ? window.game_data : null;
    const lines=[];
    for(const p of plans){
      const [toX,toY]=String(p.destination).split('|');
      const params=new URLSearchParams();
      if(gd && gd.player && gd.player.sitter>0) params.set('t', gd.player.id);
      if(p.villageId) params.set('village', String(p.villageId));
      params.set('screen','place'); params.set('x',toX); params.set('y',toY);
      const url=`/game.php?${params.toString()}`;
      lines.push(
        `[unit]${p.unit}[/unit] ${dispCoord(p.coords)} -> ${dispCoord(p.destination)} - `+
        `[color=#ff0000]${p.launchTimeFormatted}[/color] - `+
        `[url=${origin}${url}]Gönder[/url]`
      );
    }
    return lines.join('\n');
  }

  // ------------ UI: HTML ------------
  function buildHTML(){
    return `
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Büyük Atak – TR BBCode (Düz Satır)</title>
<style>
  :root{--b:#999;--mut:#666;}
  body{font:13px/1.4 Arial, sans-serif; padding:12px;}
  label{font-weight:600; display:block; margin:8px 0 4px;}
  input[type=text],textarea,select{width:100%; box-sizing:border-box; padding:6px; border:1px solid var(--b); border-radius:4px;}
  textarea{height:90px;}
  fieldset{border:1px solid var(--b); padding:10px; margin:12px 0; border-radius:6px;}
  button{padding:7px 10px; border:1px solid #777; background:#f5f5f5; border-radius:4px; cursor:pointer;}
  button:disabled{opacity:.6; cursor:default;}
  small{color:#555;}
  .grid{display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;}
  .toolbar{display:flex; gap:8px; flex-wrap:wrap; margin:10px 0;}
  .muted{color:var(--mut); font-size:12px;}
  .row{display:grid; grid-template-columns:1fr 1fr; gap:8px;}
</style>
</head>
<body>
  <h3>Büyük Atak – TR BBCode (Tablosuz & Başlıksız)</h3>

  <fieldset>
    <legend>Zaman</legend>
    <label>İniş Zamanı (dd/mm/yyyy HH:mm:ss)</label>
    <input id="arrivalTime" type="text" placeholder="06/10/2025 23:59:59"/>
  </fieldset>

  <fieldset>
    <legend>Slowest Units</legend>
    <div class="row">
      <div>
        <label>Slowest Nuke unit</label>
        <select id="slowestNukeUnit">
          <option value="axe">axe</option>
          <option value="light">light</option>
          <option value="marcher">marcher</option>
          <option value="ram" selected>ram</option>
          <option value="catapult">catapult</option>
          <option value="snob">snob</option>
        </select>
      </div>
      <div>
        <label>Slowest Support unit</label>
        <select id="slowestSupportUnit">
          <option value="spear" selected>spear</option>
          <option value="archer">archer</option>
          <option value="sword">sword</option>
          <option value="spy">spy</option>
          <option value="knight">knight</option>
          <option value="heavy">heavy</option>
          <option value="catapult">catapult</option>
        </select>
      </div>
    </div>
  </fieldset>

  <fieldset>
    <legend>Maks. Yolculuk Süresi (saat) — boş bırak = sınırsız</legend>
    <div class="grid">
      <div><label>Nuke max (saat)</label><input id="maxHoursNuke" type="text" placeholder=""/></div>
      <div><label>Noble max (saat)</label><input id="maxHoursNoble" type="text" placeholder=""/></div>
      <div><label>Support max (saat)</label><input id="maxHoursSupport" type="text" placeholder=""/></div>
    </div>
    <small>Örn: Noble için 58 saat sınırı olan dünyalarda buraya 58 yaz.</small>
  </fieldset>

  <fieldset>
    <legend>Per Target (her hedefe kaç tane?)</legend>
    <div class="grid">
      <div><label>Nukes per Target</label><input id="nukesPerTarget" type="text" value="1"/></div>
      <div><label>Nobles per Target</label><input id="noblesPerTarget" type="text" value="1"/></div>
      <div><label>Support per Target</label><input id="supportPerTarget" type="text" value="0"/></div>
    </div>
  </fieldset>

  <fieldset>
    <legend>Koordinat Ayrıştırma</legend>
    <label><input type="checkbox" id="strictMode" checked/> Strict+ mode — önce normalize et, sonra yalnızca <b>###|###</b> kabul et</label>
    <small>Kapalıyken çok formatlı (boşluk, x, , / - . ve '|') kabul edilir; normalizasyon yine uygulanır.</small>
  </fieldset>

  <div class="row">
    <div><label>Targets <span id="cntTargets" class="muted"></span></label><textarea id="targetsCoords"></textarea></div>
    <div><label>Nukes Coords <span id="cntNukes" class="muted"></span></label><textarea id="nukesCoords"></textarea></div>
  </div>
  <div class="row">
    <div><label>Nobles Coords <span id="cntNobles" class="muted"></span></label><textarea id="noblesCoords"></textarea></div>
    <div><label>Support Coords <span id="cntSupport" class="muted"></span></label><textarea id="supportCoords"></textarea></div>
  </div>

  <div class="toolbar">
    <button id="getPlanBtn" type="button">Get Plan!</button>
    <button id="copyBtn" type="button">Kopyala</button>
    <button id="clearBtn" type="button">Temizle</button>
    <button id="sampleBtn" type="button">Örnek Doldur</button>
    <span class="muted" id="statusText"></span>
  </div>

  <fieldset>
    <legend>Results (TR BBCode, düz satır)</legend>
    <textarea id="resultsBBCode" style="height:280px;"></textarea>
  </fieldset>

  <small>Not: Girdiler otomatik kaydedilir. Sitter/UK istisnaları linklerde otomatik.</small>
</body>
</html>`;
  }

  // ------------ UI: Modal (overlay) ------------
  function openModal(){
    const wrap=document.createElement('div');
    wrap.id='ddra_modal_wrap';
    Object.assign(wrap.style,{
      position:'fixed', inset:'0', background:'rgba(0,0,0,.45)', zIndex:999999
    });
    const panel=document.createElement('div');
    Object.assign(panel.style,{
      position:'absolute', left:'50%', top:'5%', transform:'translateX(-50%)',
      width:'min(840px, 96vw)', height:'90vh', background:'#fff',
      borderRadius:'8px', boxShadow:'0 10px 30px rgba(0,0,0,.35)', overflow:'hidden'
    });
    const ifr=document.createElement('iframe');
    Object.assign(ifr.style,{border:'0', width:'100%', height:'100%'});
    panel.appendChild(ifr);
    wrap.addEventListener('click', (ev)=>{ if(ev.target===wrap){ document.body.removeChild(wrap); }});
    wrap.appendChild(panel);
    document.body.appendChild(wrap);

    const doc=ifr.contentWindow.document;
    doc.open(); doc.write(buildHTML()); doc.close();
    attachHandlerSafe(doc);
    return {wrap, doc};
  }

  // ------------ UI: Popup ------------
  function openPopup(){
    const features='left=20,top=20,width=640,height=1020,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0';
    attackPlannerWindow = window.open('', '', features);
    if(!attackPlannerWindow) return null;
    let sameOrigin=true;
    try{ void attackPlannerWindow.document; } catch(e){ sameOrigin=false; }
    if(!sameOrigin) return null;

    const doc=attackPlannerWindow.document;
    doc.open(); doc.write(buildHTML()); doc.close();

    // Güvenli bağlama
    let tries=0;
    const t=setInterval(()=>{
      try{
        if(doc && doc.getElementById('getPlanBtn')){
          clearInterval(t);
          attachHandlerSafe(doc);
        }else if(++tries>100){
          clearInterval(t);
          alert('Get Plan butonu bulunamadı (popup yüklenemedi). Modal açmayı deneyin.');
        }
      }catch(e){}
    },100);
    return doc;
  }

  // ------------ Ortak: Handler Bağlama ------------
  function attachHandlerSafe(doc){
    try{
      const get=(id)=>doc.getElementById(id);

      const elArrival=get('arrivalTime');
      const elNuke=get('nukesCoords');
      const elNoble=get('noblesCoords');
      const elSup=get('supportCoords');
      const elTgt=get('targetsCoords');
      const elOut=get('resultsBBCode');
      const elGet=get('getPlanBtn');
      const elCopy=get('copyBtn');
      const elClear=get('clearBtn');
      const elSample=get('sampleBtn');
      const elStatus=get('statusText');

      const elSlowNuke=get('slowestNukeUnit');
      const elSlowSup=get('slowestSupportUnit');
      const elMaxNuke=get('maxHoursNuke');
      const elMaxNoble=get('maxHoursNoble');
      const elMaxSup=get('maxHoursSupport');
      const elNPT=get('nukesPerTarget');
      const elNbPT=get('noblesPerTarget');
      const elSPT=get('supportPerTarget');
      const elStrict=get('strictMode');

      const elCntTargets=get('cntTargets');
      const elCntNukes=get('cntNukes');
      const elCntNobles=get('cntNobles');
      const elCntSupport=get('cntSupport');

      // Otomatik kaydet-yükle
      const SAVE_KEYS=[
        'arrivalTime','nukesCoords','noblesCoords','supportCoords','targetsCoords',
        'slowestNukeUnit','slowestSupportUnit','maxHoursNuke','maxHoursNoble','maxHoursSupport',
        'nukesPerTarget','noblesPerTarget','supportPerTarget','strictMode'
      ];
      function saveForm(){
        try{
          const data={};
          for(const k of SAVE_KEYS){
            const el=get(k);
            if(!el) continue;
            data[k] = (el.type==='checkbox') ? (el.checked?'1':'0') : (el.value||'');
          }
          localStorage.setItem(`${LS_PREFIX}_form`, JSON.stringify(data));
          if(elStatus){ elStatus.textContent='Kaydedildi.'; setTimeout(()=>elStatus.textContent='',1000); }
        }catch{}
      }
      function loadForm(){
        try{
          const raw=localStorage.getItem(`${LS_PREFIX}_form`); if(!raw) return;
          const data=JSON.parse(raw);
          for(const k of SAVE_KEYS){
            const el=get(k);
            if(!el || data[k]==null) continue;
            if(el.type==='checkbox') el.checked = (data[k]==='1');
            else el.value = data[k];
          }
          refreshCounters();
        }catch{}
      }
      function refreshCounters(){
        if(!elCntTargets) return;
        const strict = !!elStrict?.checked;
        elCntTargets.textContent=`(${parseCoords(elTgt.value,   {strict}).length})`;
        elCntNukes.textContent  =`(${parseCoords(elNuke.value,  {strict}).length})`;
        elCntNobles.textContent =`(${parseCoords(elNoble.value, {strict}).length})`;
        elCntSupport.textContent=`(${parseCoords(elSup.value,   {strict}).length})`;
      }

      for(const k of SAVE_KEYS){
        const el=get(k);
        el?.addEventListener('input', ()=>{ saveForm(); refreshCounters(); });
        if(el?.type==='checkbox'){ el.addEventListener('change', ()=>{ saveForm(); refreshCounters(); }); }
      }
      loadForm(); refreshCounters();

      elSample.addEventListener('click', ()=>{
        elArrival.value=elArrival.value||'06/10/2025 23:59:59';
        elTgt.value='**0001\t\n354|467\t8.614\n**0002\t\n355|465\t8.824\n(deneme) 498x497; 503-502';
        elNuke.value='400|400,401|402\n403x404';
        elNoble.value='420|420 421|421';
        elSup.value='450|450 451|451, 452|452';
        saveForm(); refreshCounters();
      });

      elClear.addEventListener('click', ()=>{
        for(const k of ['targetsCoords','nukesCoords','noblesCoords','supportCoords']) get(k).value='';
        elOut.value=''; saveForm(); refreshCounters();
      });

      // Kopyala (güvenli fallback)
      elCopy.addEventListener('click', async ()=>{
        const txt=elOut.value||'';
        try{
          if(navigator.clipboard && window.isSecureContext){
            await navigator.clipboard.writeText(txt);
          }else{
            const ta=doc.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
            doc.body.appendChild(ta); ta.select(); doc.execCommand('copy'); doc.body.removeChild(ta);
          }
          elStatus.textContent='Panoya kopyalandı.'; setTimeout(()=>elStatus.textContent='',1200);
        }catch{
          elStatus.textContent='Kopyalama başarısız.'; setTimeout(()=>elStatus.textContent='',2000);
        }
      });

      // Plan üretimi
      let IS_BUSY=false;
      elGet.addEventListener('click', async (e)=>{
        e.preventDefault();
        if(IS_BUSY) return; IS_BUSY=true; elGet.disabled=true; elGet.textContent='Working...';
        try{
          const arrivalStr=String(elArrival.value||'').trim();
          if(!arrivalStr){ alert('İniş zamanı boş.'); return; }
          const arrivalDate=parseLandingTime(arrivalStr);
          if(isNaN(arrivalDate.getTime())){ alert('İniş zamanı formatı dd/mm/yyyy HH:mm:ss olmalı.'); return; }

          const strict = !!elStrict?.checked;

          const targets   = parseCoords(elTgt.value||'',    {strict});
          const nukesAll  = parseCoords(elNuke.value||'',   {strict});
          const noblesAll = parseCoords(elNoble.value||'',  {strict});
          const supAll    = parseCoords(elSup.value||'',    {strict});

          if(!targets.length){ alert('Targets içinde koordinat bulunamadı.'); return; }

          const nukesPerTarget   = Math.max(0,toInt(elNPT.value,0));
          const noblesPerTarget  = Math.max(0,toInt(elNbPT.value,0));
          const supportPerTarget = Math.max(0,toInt(elSPT.value,0));

          const nukeUnit    = elSlowNuke.value||'ram';
          const supportUnit = elSlowSup.value||'spear';

          const maxNukeStr   = elMaxNuke?.value;
          const maxNobleStr  = elMaxNoble?.value;
          const maxSupportStr= elMaxSup?.value;

          const nukesPool   = nukesAll.slice();
          const noblesPool  = noblesAll.slice();
          const supportPool = supAll.slice();

          console.log('[MassAttack]',
            `Targets=${targets.length}, Nukes=${nukesAll.length}, Nobles=${noblesAll.length}, Support=${supAll.length}`,
            `PerTarget: nukes=${nukesPerTarget}, nobles=${noblesPerTarget}, support=${supportPerTarget}`,
            `Speeds: nuke(${getUnitSpeed(nukeUnit)}), snob(${getUnitSpeed('snob')}), support(${getUnitSpeed(supportUnit)})`,
            `Strict+ (normalize) = ${strict}`
          );

          const coordToId = await mapOwnVillageIdsByCoords().catch(()=> ({}));

          const globalPlans=[];
          const dropped={nuke:0,noble:0,support:0};

          for(const target of targets){
            // Nuke
            const takeN=Math.max(0,Math.min(nukesPerTarget,nukesPool.length));
            const useNukes=nukesPool.splice(0,takeN);
            for(const from of useNukes){
              const dist=distance(from,target);
              if(withinMaxHours(maxNukeStr,nukeUnit,dist)){
                globalPlans.push(makePlan(from,target,nukeUnit,'nuke',arrivalDate,coordToId[from]));
              }else dropped.nuke++;
            }
            // Noble
            const takeNb=Math.max(0,Math.min(noblesPerTarget,noblesPool.length));
            const useNobles=noblesPool.splice(0,takeNb);
            for(const from of useNobles){
              const dist=distance(from,target);
              if(withinMaxHours(maxNobleStr,'snob',dist)){
                globalPlans.push(makePlan(from,target,'snob','noble',arrivalDate,coordToId[from]));
              }else dropped.noble++;
            }
            // Support
            const takeS=Math.max(0,Math.min(supportPerTarget,supportPool.length));
            const useSupport=supportPool.splice(0,takeS);
            for(const from of useSupport){
              const dist=distance(from,target);
              if(withinMaxHours(maxSupportStr,supportUnit,dist)){
                globalPlans.push(makePlan(from,target,supportUnit,'support',arrivalDate,coordToId[from]));
              }else dropped.support++;
            }
          }

          // Kalkışa göre artan sıralama
          globalPlans.sort((a,b)=> a.launchTimeMs - b.launchTimeMs);

          elOut.value = plansToFlatBBCode(globalPlans).trim();

          if(globalPlans.length===0){
            alert('Plan üretilemedi. (Hız/filtre/kaynakları kontrol edin; konsolda teşhis mevcut.)');
          }else if(dropped.nuke||dropped.noble||dropped.support){
            alert(`Süre sınırı nedeniyle elenenler — Nuke: ${dropped.nuke}, Noble: ${dropped.noble}, Support: ${dropped.support}`);
          }
        }catch(err){
          alert('Plan üretimi sırasında hata: '+(err?.message||err));
          console.error(err);
        }finally{
          elGet.disabled=false; elGet.textContent='Get Plan!'; setTimeout(()=>{IS_BUSY=false;},60);
        }
      });

      // İlk sayaç
      refreshCounters();

    }catch(e){
      try{ alert('Handler bağlanamadı: '+(e?.message||e)); }catch{}
    }
  }

  // ------------ Plan Nesnesi ------------
  function makePlan(from,target,unit,category,arrivalDate,villageId){
    const dist=distance(from,target);
    const launch=launchTime(unit,arrivalDate,dist);
    return {
      unit, category, highPrio:false,
      coords:from, destination:target, villageId:villageId||'',
      launchTimeFormatted:fmtUnpadded(launch),
      launchTimeFormattedPad:padDateTime(launch), // opsiyonel
      launchTimeMs: launch.getTime(),
      distance: dist
    };
  }

  // ------------ Başlatma ------------
  function initWithUnitInfo(info){
    unitInfo=info;
    // Önce popup dener, erişilemezse modal açar
    let doc = openPopup();
    if(!doc){
      console.warn('[MassAttack] Popup erişimi yok; modal açılıyor.');
      openModal();
    }
  }

  async function fetchUnitInfo(){
    const jq=await ensureJQ();
    if(!jq){ alert('jQuery yüklenemedi; lütfen sayfayı yenileyip tekrar deneyin.'); return; }
    jQuery.ajax({url:'/interface.php?func=get_unit_info'})
      .done(function(response){
        try{
          const info=xml2json(jQuery(response));
          localStorage.setItem(`${LS_PREFIX}_unit_info`, JSON.stringify(info));
          localStorage.setItem(`${LS_PREFIX}_last_update`, String(nowMs()));
          initWithUnitInfo(info);
        }catch(e){
          alert('Birim bilgisi işlenemedi: '+e);
        }
      })
      .fail(function(){
        alert('Birim bilgisi alınamadı. Tekrar deneyin.');
      });
  }

  (function bootstrap(){
    try{
      const last=parseInt(localStorage.getItem(`${LS_PREFIX}_last_update`)||'0',10);
      if(last && nowMs() < (last+TIME_INTERVAL)){
        const cached=JSON.parse(localStorage.getItem(`${LS_PREFIX}_unit_info`)||'null');
        if(cached){ initWithUnitInfo(cached); return; }
      }
    }catch{}
    fetchUnitInfo();
  })();
})();
