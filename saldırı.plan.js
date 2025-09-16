(function MAP_Popup_Standalone_Vanilla_Fixed_NoParen(){
  'use strict';

  // --- Oyunun origin'ini (https://trXX.tribalwars.com.tr gibi) popup'a taşımak için yakala
  var GAME_ORIGIN = (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : '';

  // --- Popup aç
  var features = 'left=20,top=20,width=680,height=940,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0';
  var win = window.open('', '', features);
  if (!win) { alert('Popup engellendi. Bu site için pop-up izni verin ve tekrar deneyin.'); return; }

  // --- Basit iskelet yaz (script GÖMME! script'i sonradan programatik enjekte edeceğiz)
  var css = [
    '<style>',
    '  :root{--b:#999;--mut:#666;}',
    '  html,body{height:100%}',
    '  body{font:13px/1.4 Arial, sans-serif; padding:12px; box-sizing:border-box;}',
    '  label{font-weight:600; display:block; margin:8px 0 4px;}',
    '  input[type=text],textarea,select{width:100%; box-sizing:border-box; padding:6px; border:1px solid var(--b); border-radius:4px;}',
    '  textarea{height:90px;}',
    '  fieldset{border:1px solid var(--b); padding:10px; margin:12px 0; border-radius:6px;}',
    '  button{padding:7px 10px; border:1px solid #777; background:#f5f5f5; border-radius:4px; cursor:pointer;}',
    '  button:disabled{opacity:.6; cursor:default;}',
    '  small,.muted{color:var(--mut);}',
    '  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}',
    '  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
    '  .toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;}',
    '</style>'
  ].join('\n');

  var bodyHTML = [
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">',
    '  <div><b>Toplu Saldırı Planlayıcı</b> <span class="muted">v1.1.8-standalone-fixed</span></div>',
    '  <div style="font-size:12px" class="muted">Popup içi • jQuery yok • localStorage yok</div>',
    '</div>',
    '<fieldset>',
    '  <legend>Zaman</legend>',
    '  <label>İniş Zamanı (dd/mm/yyyy HH:mm:ss veya yyyy-mm-dd HH:mm:ss)</label>',
    '  <input id="arrivalTime" type="text" placeholder="06/10/2025 23:59:59"/>',
    '</fieldset>',
    '<fieldset>',
    '  <legend>En Yavaş Birimler</legend>',
    '  <div class="grid2">',
    '    <div>',
    '      <label>En Yavaş Kamiler birimi</label>',
    '      <select id="slowestNukeUnit">',
    '        <option value="axe">axe</option>',
    '        <option value="light">light</option>',
    '        <option value="marcher">marcher</option>',
    '        <option value="ram" selected>ram</option>',
    '        <option value="catapult">catapult</option>',
    '        <option value="snob">snob</option>',
    '      </select>',
    '    </div>',
    '    <div>',
    '      <label>En Yavaş Destek birimi</label>',
    '      <select id="slowestSupportUnit">',
    '        <option value="spear" selected>spear</option>',
    '        <option value="archer">archer</option>',
    '        <option value="sword">sword</option>',
    '        <option value="spy">spy</option>',
    '        <option value="knight">knight</option>',
    '        <option value="heavy">heavy</option>',
    '        <option value="catapult">catapult</option>',
    '      </select>',
    '    </div>',
    '  </div>',
    '</fieldset>',
    '<fieldset>',
    '  <legend>Maks. Yolculuk Süresi (saat) — boş bırak = sınırsız</legend>',
    '  <div class="grid3">',
    '    <div><label>Kamiler maks</label><input id="maxHoursNuke" type="text"/></div>',
    '    <div><label>Misyoner maks</label><input id="maxHoursNoble" type="text"/></div>',
    '    <div><label>Destek maks</label><input id="maxHoursSupport" type="text"/></div>',
    '  </div>',
    '</fieldset>',
    '<fieldset>',
    '  <legend>Koordinat Ayrıştırma</legend>',
    '  <label><input type="checkbox" id="strictMode" checked/> Strict+ — yalnızca <b>###|###</b> kabul et (önce normalize)</label>',
    '  <small>Kapalıyken boşluk, x, , / - . ve satır sonu gibi ayraçlar da kabul edilir.</small>',
    '</fieldset>',
    '<div class="grid2">',
    '  <div><label>Hedefler <span id="cntHedefler" class="muted"></span></label><textarea id="targetsCoords"></textarea></div>',
    '  <div><label>Kamiler Koordinatları <span id="cntNukes" class="muted"></span></label><textarea id="nukesCoords"></textarea></div>',
    '</div>',
    '<div class="grid2">',
    '  <div><label>Misyoner Koordinatları <span id="cntNobles" class="muted"></span></label><textarea id="noblesCoords"></textarea></div>',
    '  <div><label>Destek Koordinatları <span id="cntSupport" class="muted"></span></label><textarea id="supportCoords"></textarea></div>',
    '</div>',
    '<fieldset>',
    '  <legend>Hedef Başı (her hedefe kaç adet?)</legend>',
    '  <div class="grid3">',
    '    <div><label>Hedef başı Kamiler</label><input id="nukesPerTarget" type="text" value="1"/></div>',
    '    <div><label>Hedef başı Misyoner</label><input id="noblesPerTarget" type="text" value="1"/></div>',
    '    <div><label>Hedef başı Destek</label><input id="supportPerTarget" type="text" value="0"/></div>',
    '  </div>',
    '</fieldset>',
    '<div class="toolbar">',
    '  <button id="getPlanBtn" type="button" disabled>Planı Oluştur!</button>',
    '  <button id="copyBtn" type="button">Kopyala</button>',
    '  <button id="clearBtn" type="button">Temizle</button>',
    '  <button id="sampleBtn" type="button">Örnek Doldur</button>',
    '  <button id="refreshUnitsBtn" type="button" title="Birim hızlarını yeniden çek">Birim Bilgilerini Yenile</button>',
    '  <span id="statusText" class="muted"></span>',
    '</div>',
    '<fieldset>',
    '  <legend>Sonuçlar (TR BBCode, düz satır)</legend>',
    '  <textarea id="resultsBBCode" style="height:260px;"></textarea>',
    '</fieldset>',
    '<small class="muted">Not: Girdiler tarayıcıya <b>kaydedilmez</b>. Bağlantılar oyun alan adına göre üretilir.</small>'
  ].join('\n');

  var doc = win.document;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><title>Toplu Saldırı Planlayıcı</title>' + css + '</head><body><div id="app"></div></body></html>');
  doc.close();

  function ready(fn){
    if (doc.readyState === 'complete' || doc.readyState === 'interactive') fn();
    else doc.addEventListener('DOMContentLoaded', fn);
  }

  ready(function(){
    // UI’yı yerleştir
    var app = doc.getElementById('app');
    app.innerHTML = bodyHTML;

    // Popup içine çalışacak kodu programatik olarak enjekte et
    var code = `
      (function(){
        'use strict';
        var DEBUG=false;
        var GAME_ORIGIN = ${JSON.stringify(GAME_ORIGIN)};
        var unitInfo=null;

        // Polyfills
        if (typeof Math.hypot !== 'function') { Math.hypot = function(x,y){ return Math.sqrt(x*x + y*y); }; }

        function QS(obj){
          if (typeof URLSearchParams !== 'undefined') {
            var usp = new URLSearchParams();
            for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj,k)) usp.set(k, obj[k]);
            return usp.toString();
          }
          var arr=[]; for (var k2 in obj) if (Object.prototype.hasOwnProperty.call(obj,k2)) arr.push(encodeURIComponent(k2)+'='+encodeURIComponent(obj[k2]));
          return arr.join('&');
        }

        // Date helpers
        function parseLandingTime(str){
          var s = String(str || '').trim();
          var m1 = s.match(/^(\\d{2})\\/(\\d{2})\\/(\\d{4})\\s+(\\d{2}):(\\d{2}):(\\d{2})$/);
          if (m1) return new Date(m1[3]+'-'+m1[2]+'-'+m1[1]+'T'+m1[4]+':'+m1[5]+':'+m1[6]);
          var m2 = s.match(/^(\\d{4})-(\\d{2})-(\\d{2})\\s+(\\d{2}):(\\d{2}):(\\d{2})$/);
          if (m2) return new Date(m2[1]+'-'+m2[2]+'-'+m2[3]+'T'+m2[4]+':'+m2[5]+':'+m2[6]);
          return new Date(NaN);
        }
        function fmtUnpadded(d){
          var D=String(d.getDate()), M=String(d.getMonth()+1), Y=d.getFullYear();
          var H=('0'+d.getHours()).slice(-2), Mi=('0'+d.getMinutes()).slice(-2), S=('0'+d.getSeconds()).slice(-2);
          return D+'/'+M+'/'+Y+' '+H+':'+Mi+':'+S;
        }
        function padDateTime(d){
          var dd=('0'+d.getDate()).slice(-2), mm=('0'+(d.getMonth()+1)).slice(-2), yy=d.getFullYear();
          var H=('0'+d.getHours()).slice(-2), Mi=('0'+d.getMinutes()).slice(-2), S=('0'+d.getSeconds()).slice(-2);
          return dd+'/'+mm+'/'+yy+' '+H+':'+Mi+':'+S;
        }
        function toInt(v,d){ var n=parseInt(v,10); return isFinite(n)?n:d; }
        function toFloat(v,d){ var n=parseFloat(String(v).replace(',','.')); return isFinite(n)?n:d; }

        // Normalize & coords
        function normalizeText(t){
          return String(t)
            .replace(/[\\u2502\\uFF5C\\u2223\\u00A6]/g, '|')
            .replace(/[\\u00A0\\u1680\\u2000-\\u200A\\u202F\\u205F\\u3000]/g, ' ')
            .replace(/[\\u200B\\u200C\\u200D\\u2060\\uFEFF\\u00AD]/g, '');
        }
        var RE_FLEX = /\\b(\\d{3})\\s*(?:[\\n,.;:xX×\\/\\\\\\-\\|\\s])\\s*(\\d{3})\\b/g;
        var RE_STRICT= /\\b(\\d{3})\\s*\\|\\s*(\\d{3})\\b/g;
        var RE_ONE_STRICT = /\\b(\\d{3})\\s*\\|\\s*(\\d{3})\\b/;

        function normCoord(x,y){
          var xi=+x, yi=+y;
          if(!isFinite(xi)||!isFinite(yi)||xi<0||xi>999||yi<0||yi>999) return null;
          return xi+'\\n'+yi;
        }
        // *** Parantezsiz çıktı ***
        function dispCoord(c){ var s=String(c).split('\\n'); return s[0]+'|'+s[1]; }

        function parseCoords(text, strict){
          var base = strict ? RE_STRICT : RE_FLEX;
          var re = new RegExp(base.source, 'g');
          var s = normalizeText(text||'');
          var out=[], seen=new Set(), m;
          while((m=re.exec(s))!==null){
            var c = normCoord(m[1], m[2]);
            if(c && !seen.has(c)){ seen.add(c); out.push(c); }
          }
          return out;
        }

        // Dist & speed
        function distance(a,b){
          var ax=+String(a).split('\\n')[0], ay=+String(a).split('\\n')[1];
          var bx=+String(b).split('\\n')[0], by=+String(b).split('\\n')[1];
          return Math.hypot(ax-bx, ay-by);
        }
        function getUnitSpeed(u){
          var ui=unitInfo||{};
          var cands=[
            ui && ui.config && ui.config[u] && ui.config[u].speed,
            ui && ui.config && ui.config.units && ui.config.units[u] && ui.config.units[u].speed,
            ui && ui[u] && ui[u].speed,
            ui && ui.units && ui.units[u] && ui.units[u].speed
          ];
          for (var i=0;i<cands.length;i++){
            var n=Number(cands[i]);
            if (isFinite(n) && n>0) return n;
          }
          return null;
        }
        function minutesFor(unit,dist){
          var s=getUnitSpeed(unit);
          if(!s) throw new Error('Birim hızı bulunamadı: '+unit);
          return dist*s;
        }
        function withinMaxHours(hStr,unit,dist){
          var raw=String(hStr||'').trim();
          if(!raw) return true;
          var h=toFloat(raw,NaN);
          if(!(h>0)) return true;
          return minutesFor(unit,dist) <= h*60;
        }
        function launchTime(unit,landing,dist){
          var s=getUnitSpeed(unit);
          if(!(landing instanceof Date) || isNaN(landing.getTime())) throw new Error('Geçersiz iniş tarihi');
          if(!s) throw new Error('Birim hızı bulunamadı veya geçersiz: '+unit);
          var ms=dist*s*60*1000;
          var t=Math.floor((landing.getTime()-ms)/1000)*1000;
          return new Date(t);
        }

        // XML -> JSON
        function xmlElementToJson(el){
          if(!el.children || el.children.length===0){
            return (el.textContent||'').trim();
          }
          var obj={};
          for (var i=0;i<el.children.length;i++){
            var ch=el.children[i];
            obj[ch.tagName] = xmlElementToJson(ch);
          }
          return obj;
        }
        function xmlTextToJson(xmlText){
          var parser=new DOMParser();
          var xmlDoc=parser.parseFromString(xmlText, 'application/xml');
          if (xmlDoc.getElementsByTagName('parsererror').length) {
            throw new Error('XML parse hatası');
          }
          return xmlElementToJson(xmlDoc.documentElement);
        }

        // Fetchers
        async function fetchUnitInfo(){
          var btn=document.getElementById('getPlanBtn');
          try{
            if(btn){ btn.disabled=true; btn.textContent='Birimler yükleniyor...'; }
            var res = await fetch('/interface.php?func=get_unit_info', { credentials:'same-origin' });
            if(!res.ok) throw new Error('HTTP '+res.status);
            var xml = await res.text();
            unitInfo = xmlTextToJson(xml);
            if(!getUnitSpeed('ram')) throw new Error('Birim hızları beklenen formatta değil');
            if(btn){ btn.disabled=false; btn.textContent='Planı Oluştur!'; }
          }catch(e){
            alert('Birim bilgisi alınamadı: '+(e&&e.message?e.message:e)+'\\nYine de butonu deneyebilirsiniz; hız yoksa hesap yapılamaz.');
            if(btn){ btn.disabled=false; btn.textContent='Planı Oluştur!'; }
          }
        }

        async function mapOwnVillageIdsByCoords(){
          try{
            var res = await fetch('/game.php?screen=overview_villages&mode=combined&group=0', { credentials:'same-origin' });
            if(!res.ok) throw new Error('HTTP '+res.status);
            var html=await res.text();
            var p=new DOMParser();
            var d=p.parseFromString(html,'text/html');
            var rows=d.querySelectorAll('#combined_table tr.nowrap');
            var map={};
            rows.forEach(function(r){
              var cell=r.querySelector('td:nth-of-type(2) span.quickedit-vn');
              if(!cell) return;
              var id=cell.getAttribute('data-id');
              var txt=(cell.textContent||'');
              var m = txt.replace(/\\s+/g,' ').match(RE_ONE_STRICT);
              var coords = m ? (m[1]+'\\n'+m[2]) : null;
              if(id && coords) map[coords]=parseInt(id,10);
            });
            return map;
          }catch(e){
            console.warn('[MAP] Köy ID eşlemesi alınamadı:', e);
            return {};
          }
        }

        // Output
        function makePlan(from,target,unit,category,arrivalDate,villageId){
          var dist=distance(from,target);
          var launch=launchTime(unit,arrivalDate,dist);
          return {
            unit:unit, category:category, coords:from, destination:target, villageId:villageId||'',
            launchTimeFormatted: fmtUnpadded(launch),
            launchTimeFormattedPad: padDateTime(launch),
            launchTimeMs: launch.getTime(),
            distance: dist
          };
        }
        function colorForCategory(cat){
  switch (cat) {
    case 'nuke':    return '#ff0000'; // Kami: kırmızı
    case 'noble':   return '#00aa00'; // Misyoner: yeşil
    case 'support': return '#0077ff'; // Destek: mavi
    default:        return '#ff0000';
  }
}
function plansToFlatBBCode(plans){
          var origin = GAME_ORIGIN || '';
          var lines=[];
          for (var i=0;i<plans.length;i++){
            var p=plans[i];
            var to=String(p.destination).split('\\n');
            var params = { screen:'place', x:to[0], y:to[1] };
            if (p.villageId) params.village = String(p.villageId);
            var url = '/game.php?'+QS(params);
            lines.push('[unit]'+p.unit+'[/unit] '+dispCoord(p.coords)+' -> '+dispCoord(p.destination)+' - [color=' + colorForCategory(p.category) + ']'+p.launchTimeFormatted+'[/color] - [url='+origin+url+']Gönder[/url]');
          }
          return lines.join('\\n');
        }

        // UI helpers
        function $(id){ return document.getElementById(id); }
        function refreshCounters(){
          var strict=$('strictMode').checked;
          $('cntHedefler').textContent='('+parseCoords($('targetsCoords').value||'',strict).length+')';
          $('cntNukes').textContent='('+parseCoords($('nukesCoords').value||'',strict).length+')';
          $('cntNobles').textContent='('+parseCoords($('noblesCoords').value||'',strict).length+')';
          $('cntSupport').textContent='('+parseCoords($('supportCoords').value||'',strict).length+')';
        }
        async function refreshUnits(){
          var btn=$('refreshUnitsBtn');
          try{ btn.disabled=true; btn.textContent='Yenileniyor...'; await fetchUnitInfo(); }
          catch(e){ alert('Birim bilgisi alınamadı: '+(e&&e.message?e.message:e)); }
          finally{ btn.disabled=false; btn.textContent='Birim Bilgilerini Yenile'; }
        }

        function bind(){
          ['arrivalTime','nukesCoords','noblesCoords','supportCoords','targetsCoords','slowestNukeUnit','slowestSupportUnit','maxHoursNuke','maxHoursNoble','maxHoursSupport','nukesPerTarget','noblesPerTarget','supportPerTarget','strictMode']
            .forEach(function(id){
              var el=$(id); if(!el) return;
              el.addEventListener(el.type==='checkbox'?'change':'input', refreshCounters);
            });

          $('sampleBtn').addEventListener('click', function(){
            if(!$('arrivalTime').value) $('arrivalTime').value='06/10/2025 23:59:59';
            $('targetsCoords').value='**0001\\t\\n354|467\\t8.614\\n**0002\\t\\n355|465\\t8.824\\n(deneme) 498x497; 503-502';
            $('nukesCoords').value='400|400,401|402\\n403x404';
            $('noblesCoords').value='420|420 421|421';
            $('supportCoords').value='450|450 451|451, 452|452';
            refreshCounters();
          });

          $('clearBtn').addEventListener('click', function(){
            ['targetsCoords','nukesCoords','noblesCoords','supportCoords'].forEach(function(k){ $(k).value=''; });
            $('resultsBBCode').value='';
            refreshCounters();
          });

          $('copyBtn').addEventListener('click', function(){
            var txt=$('resultsBBCode').value||'';
            function fallback(){
              var ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
              document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
              $('statusText').textContent='Panoya kopyalandı (fallback).'; setTimeout(function(){ $('statusText').textContent=''; },1200);
            }
            try{
              if(navigator.clipboard && window.isSecureContext){
                navigator.clipboard.writeText(txt).then(function(){
                  $('statusText').textContent='Panoya kopyalandı.'; setTimeout(function(){ $('statusText').textContent=''; },1200);
                }).catch(fallback);
              }else fallback();
            }catch(e){ fallback(); }
          });

          $('refreshUnitsBtn').addEventListener('click', refreshUnits);

          $('getPlanBtn').addEventListener('click', async function(ev){
            ev.preventDefault();
            var btn=$('getPlanBtn'); if(btn.disabled) return;
            btn.disabled=true; btn.textContent='Hazırlanıyor...';
            try{
              var aStr=String($('arrivalTime').value||'').trim();
              if(!aStr){ alert('İniş zamanı boş.'); return; }
              var aDate=parseLandingTime(aStr);
              if(isNaN(aDate.getTime())){ alert('İniş zamanı formatı geçersiz. Örn: 06/10/2025 23:59:59'); return; }
              if(!unitInfo){ alert('Birim bilgisi yok; önce "Birim Bilgilerini Yenile" deneyin.'); return; }

              var strict=$('strictMode').checked;
              var targets=parseCoords($('targetsCoords').value||'',strict);
              var nukesAll=parseCoords($('nukesCoords').value||'',strict);
              var noblesAll=parseCoords($('noblesCoords').value||'',strict);
              var supAll=parseCoords($('supportCoords').value||'',strict);
              if(!targets.length){ alert('Hedefler içinde koordinat bulunamadı.'); return; }

              var npt=Math.max(0,toInt($('nukesPerTarget').value,0));
              var nbpt=Math.max(0,toInt($('noblesPerTarget').value,0));
              var spt=Math.max(0,toInt($('supportPerTarget').value,0));

              var nukeUnit=$('slowestNukeUnit').value||'ram';
              var supportUnit=$('slowestSupportUnit').value||'spear';
              var maxN=$('maxHoursNuke').value, maxNb=$('maxHoursNoble').value, maxS=$('maxHoursSupport').value;

              var coordToId = await mapOwnVillageIdsByCoords().catch(function(){ return {}; });

              var plans=[], dropped={nuke:0,noble:0,support:0};
              var nukesPool=nukesAll.slice(), noblesPool=noblesAll.slice(), supportPool=supAll.slice();

              for (var t=0;t<targets.length;t++){
                var target=targets[t];

                var takeN=Math.max(0,Math.min(npt,nukesPool.length));
                var useN=nukesPool.splice(0,takeN);
                for (var i=0;i<useN.length;i++){
                  var from=useN[i], dist=distance(from,target);
                  if(withinMaxHours(maxN,nukeUnit,dist)){
                    plans.push(makePlan(from,target,nukeUnit,'nuke',aDate,coordToId[from]));
                  }else dropped.nuke++;
                }

                var takeNb=Math.max(0,Math.min(nbpt,noblesPool.length));
                var useNb=noblesPool.splice(0,takeNb);
                for (var j=0;j<useNb.length;j++){
                  var fromNb=useNb[j], distNb=distance(fromNb,target);
                  if(withinMaxHours(maxNb,'snob',distNb)){
                    plans.push(makePlan(fromNb,target,'snob','noble',aDate,coordToId[fromNb]));
                  }else dropped.noble++;
                }

                var takeS=Math.max(0,Math.min(spt,supportPool.length));
                var useS=supportPool.splice(0,takeS);
                for (var k=0;k<useS.length;k++){
                  var fromS=useS[k], distS=distance(fromS,target);
                  if(withinMaxHours(maxS,supportUnit,distS)){
                    plans.push(makePlan(fromS,target,supportUnit,'support',aDate,coordToId[fromS]));
                  }else dropped.support++;
                }
              }

              plans.sort(function(a,b){ return a.launchTimeMs - b.launchTimeMs; });
              $('resultsBBCode').value = plansToFlatBBCode(plans).trim();

              if(plans.length===0){
                alert('Plan üretilemedi. (Hız/filtre/kaynakları kontrol edin; konsolda teşhis mevcut.)');
              }else if(dropped.nuke||dropped.noble||dropped.support){
                alert('Süre sınırı nedeniyle elenenler — Nuke: '+dropped.nuke+', Noble: '+dropped.noble+', Support: '+dropped.support);
              }
            }catch(err){
              alert('Plan üretimi sırasında hata: '+(err&&err.message?err.message:err));
              if (DEBUG) console.error(err);
            }finally{
              btn.disabled=false; btn.textContent='Planı Oluştur!';
            }
          });

          // İlk sayaç
          refreshCounters();
        }

        // Başlat
        (async function(){
          try{ await fetchUnitInfo(); }catch(e){ /* kullanıcı butonla dener */ }
          finally{
            // getPlan butonunu ünite çekilmişse aktif et
            var hasSpeed = !!getUnitSpeed('ram');
            var btn = document.getElementById('getPlanBtn');
            if (btn) btn.disabled = !hasSpeed;
            bind();
          }
        })();

      })();
    `;

    var s = doc.createElement('script');
    s.type = 'text/javascript';
    s.textContent = code; // ESCAPE derdi yok; direkt kod
    doc.body.appendChild(s);
  });
})();
