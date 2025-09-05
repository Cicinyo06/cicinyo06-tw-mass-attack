/*
 * File: dddd.js (v6.6)
 * Purpose: Büyük Atak – TR BBCode Export + "Gönder" linki
 * Değişiklikler (v6.6):
 *  - Nukes/Nobles/Support per Target değerleri artık aktif.
 *  - Her hedef için ilgili havuzdan en fazla N kaynak çekilir (splice) ve havuzdan düşer.
 *  - Aynı köy bir sonraki hedefte tekrar kullanılmaz.
 */
(function DDDD_MassAttack_TR_BBCode_OneFile_v66() {
  // ---------- Durum ----------
  var LS_PREFIX = 'dd_tr_mass_attack';
  var TIME_INTERVAL = 60 * 60 * 1000 * 30; // 30 gün
  var unitInfo = null;
  var attackPlannerWindow = null;

  // ---------- Yardımcılar ----------
  function tt(s){ return s; }
  function nowMs(){ return Date.parse(new Date()); }
  function xml2json($xml) {
    var data = {};
    $.each($xml.children(), function () {
      var $this = $(this);
      if ($this.children().length > 0) {
        data[$this.prop('tagName')] = xml2json($this);
      } else {
        data[$this.prop('tagName')] = $.trim($this.text());
      }
    });
    return data;
  }
  // dd/mm/yyyy HH:mm:ss -> Date
  function parseLandingTime(s){
    var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    var dd=m[1], mm=m[2], yy=m[3], HH=m[4], MM=m[5], SS=m[6];
    return new Date(`${yy}-${mm}-${dd} ${HH}:${MM}:${SS}`);
  }
  // Satırlarda örnekteki gibi (baştaki 0'sız gün/ay)
  function fmtUnpadded(date){
    var D  = String(date.getDate());
    var M  = String(date.getMonth()+1);
    var Y  = date.getFullYear();
    var HH = String(date.getHours()).padStart(2,'0');
    var MM = String(date.getMinutes()).padStart(2,'0');
    var SS = String(date.getSeconds()).padStart(2,'0');
    return `${D}/${M}/${Y} ${HH}:${MM}:${SS}`;
  }
  // Sıralama için pad'li
  function padDateTime(date){
    var dd = String(date.getDate()).padStart(2,'0');
    var mm = String(date.getMonth()+1).padStart(2,'0');
    var yy = date.getFullYear();
    var HH = String(date.getHours()).padStart(2,'0');
    var MM = String(date.getMinutes()).padStart(2,'0');
    var SS = String(date.getSeconds()).padStart(2,'0');
    return `${dd}/${mm}/${yy} ${HH}:${MM}:${SS}`;
  }
  function parseDT(s){
    var m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return new Date(NaN);
    var dd=m[1], mm=m[2], yy=m[3], HH=m[4], MM=m[5], SS=m[6];
    return new Date(`${yy}-${mm}-${dd} ${HH}:${MM}:${SS}`);
  }
  function toInt(v, def){ var n=parseInt(v,10); return isNaN(n)?def:n; }

  // İsimli satırlardan koordinatları otomatik ayıkla (tekrarları eler, sırayı korur)
  function parseCoords(text){
    var out = [];
    var seen = new Set();
    var lines = (text || '').split(/\r?\n/);
    lines.forEach(function(line){
      var matches = line.match(/\b\d{3}\|\d{3}\b/g) || [];
      matches.forEach(function(coord){
        if (!seen.has(coord)) { seen.add(coord); out.push(coord); }
      });
    });
    if (out.length === 0) {
      var flat = (text || '').match(/\b\d{3}\|\d{3}\b/g) || [];
      flat.forEach(function(c){ if (!seen.has(c)) { seen.add(c); out.push(c); } });
    }
    return out;
  }

  function distance(a,b){
    var p1=a.split('|').map(Number), p2=b.split('|').map(Number);
    var dx=p1[0]-p2[0], dy=p1[1]-p2[1];
    return Math.sqrt(dx*dx + dy*dy);
  }
  function launchTime(unit, landingDate, dist){
    var speed = Number(unitInfo?.config?.[unit]?.speed || 0); // dakika/karocuk
    var ms = dist * speed * 60 * 1000;
    var t = Math.floor((landingDate.getTime() - ms)/1000)*1000;
    return new Date(t);
  }

  // villageId eşlemesi – başarısız olursa boş bırakır (link yine çalışır)
  async function mapOwnVillageIdsByCoords(){
    try{
      var html = await jQuery.get(game_data.link_base_pure + 'overview_villages&mode=combined&group=0');
      var htmlDoc = jQuery.parseHTML(html);
      var rows = jQuery(htmlDoc).find('#combined_table tr.nowrap');
      var map = {};
      rows.each(function(){
        var cell = jQuery(this).find('td:eq(1) span.quickedit-vn');
        var id   = cell.attr('data-id');
        var coords = (cell.text().match(/\d{3}\|\d{3}/) || [])[0];
        if (id && coords) map[coords] = parseInt(id,10);
      });
      return map;
    } catch(e){
      console.warn('[MassAttack] Köy ID eşlemesi alınamadı:', e);
      return {};
    }
  }

  // ---------- TR BBCode üretici (+Gönder linki) ----------
  // prefix: 'kami' | 'mis' | 'destek'
  function getBBCodePlans_TR(plans, destinationVillage, landingTimeString, prefix) {
    var pre = prefix ? (prefix + ' ') : '';
    var bb  = `[size=12][b]Plan için:[/b] ${pre}${destinationVillage}\n`;
        bb += `[b]İniş zamanı:[/b] ${landingTimeString}[/size]\n\n`;
        bb += `[table][**]Birim[||]Z[||]Öncelik[||]Başlatma Zamanı:[||]Komut[||]Durum[/**]\n`;

    var origin = (window.location.origin || '').replace(/\/$/,'');

    plans.forEach(function(p){
      var unit = p.unit;
      var highPrio = p.highPrio ? 'erken gönder' : '';
      var coords = p.coords;
      var villageId = p.villageId || ''; // boş da olsa link çalışır
      var launchTimeFormatted = p.launchTimeFormatted;
      var to = String(destinationVillage).split('|');
      var toX = to[0] || '', toY = to[1] || '';

      var rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
      var sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}` : '';
      var commandUrl = `/game.php?${sitterData}&village=${villageId}&screen=place${rallyPointData}`;

      bb += `[*][unit]${unit}[/unit][|] ${coords} [|][b][color=#ff0000]${highPrio}[/color][/b][|]` +
            `${launchTimeFormatted}[|][url=${origin}${commandUrl}]Gönder[/url][|]\n`;
    });

    bb += `[/table]`;
    return bb;
  }

  // ---------- Popup ----------
  function openWindow() {
    var W = 560, H = 780;
    attackPlannerWindow = window.open('', '', `left=20,top=20,width=${W},height=${H},toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0`);
    if (!attackPlannerWindow) { alert('Popup engellendi. Lütfen bu site için pop-up izni verin.'); return; }

    var html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Büyük Atak – TR BBCode</title>
        <style>
          body { font: 13px/1.4 Arial, sans-serif; padding: 10px; }
          label { font-weight: 600; display:block; margin: 8px 0 4px; }
          input[type="text"], textarea, select { width:100%; box-sizing:border-box; padding:6px; border:1px solid #999; }
          textarea { height: 80px; }
          fieldset { border:1px solid #999; padding:8px; margin:10px 0; }
          button { padding:6px 10px; }
          small { color:#555; }
        </style>
      </head>
      <body>
        <h3>Büyük Atak – TR BBCode</h3>

        <label>İniş Zamanı (dd/mm/yyyy HH:mm:ss)</label>
        <input id="arrivalTime" type="text" placeholder="06/10/2025 23:59:59"/>

        <fieldset>
          <legend>Slowest Units</legend>
          <label>Slowest Nuke unit</label>
          <select id="slowestNukeUnit">
            <option value="axe">axe</option>
            <option value="light">light</option>
            <option value="marcher">marcher</option>
            <option value="ram" selected>ram</option>
            <option value="catapult">catapult</option>
            <option value="snob">snob</option>
          </select>

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
        </fieldset>

        <!-- İsimli satırlardan koordinatları otomatik ayıklar -->
        <label>Targets</label>
        <textarea id="targetsCoords" placeholder="KOORDİNATLAR"></textarea>

        <label>Nukes Coords</label>
        <textarea id="nukesCoords" placeholder="KOORDİNATLAR"></textarea>

        <label>Nobles Coords</label>
        <textarea id="noblesCoords" placeholder="KOORDİNATLAR"></textarea>

        <label>Support Coords</label>
        <textarea id="supportCoords" placeholder="KOORDİNATLAR"></textarea>

        <div style="display:flex; gap:10px;">
          <div style="flex:1">
            <label>Nukes per Target</label>
            <input id="nukesPerTarget" type="text" value="1"/>
          </div>
          <div style="flex:1">
            <label>Nobles per Target</label>
            <input id="noblesPerTarget" type="text" value="1"/>
          </div>
          <div style="flex:1">
            <label>Support per Target</label>
            <input id="supportPerTarget" type="text" value="0"/>
          </div>
        </div>

        <div style="margin:10px 0;">
          <button id="getPlanBtn" type="button">Get Plan!</button>
        </div>

        <fieldset>
          <legend>Results (TR BBCode)</legend>
          <textarea id="resultsBBCode" style="height:260px;"></textarea>
        </fieldset>

        <small>Not: Çıktıda <b>Gönder</b> linkleri dünya pazarına (UK istisnası) ve sitter durumuna göre otomatik oluşturulur.</small>
      </body>
      </html>
    `;
    attackPlannerWindow.document.open();
    attackPlannerWindow.document.write(html);
    attackPlannerWindow.document.close();

    // Güvenli bağlama: buton oluşana kadar bekle
    var tries = 0;
    var bindTick = setInterval(function(){
      try{
        var doc = attackPlannerWindow.document;
        if (doc && doc.getElementById('getPlanBtn')) {
          clearInterval(bindTick);
          attachHandlerSafe();
        } else if (++tries > 100) {
          clearInterval(bindTick);
          alert('Get Plan butonu bulunamadı (popup yüklenemedi).');
        }
      } catch(e){
        // beklemeye devam
      }
    }, 100);
  }

  // ---------- Handler ----------
  function attachHandlerSafe(){
    try{
      var doc = attackPlannerWindow.document;
      var btn = doc.getElementById('getPlanBtn');
      if (!btn) { alert('Buton bulunamadı.'); return; }

      btn.addEventListener('click', function(e){
        try{
          e.preventDefault();

          // --- Girişleri oku ---
          var arrivalStr = (doc.getElementById('arrivalTime').value || '').trim();
          if (!arrivalStr) { alert('İniş zamanı boş.'); return; }
          var arrivalDate = parseLandingTime(arrivalStr);
          if (!(arrivalDate instanceof Date) || isNaN(arrivalDate)) {
            alert('İniş zamanı formatı dd/mm/yyyy HH:mm:ss olmalı.'); return;
          }
          // Başlık için parent gizli alana yaz
          if (!document.getElementById('raLandingTime')) {
            var inp = document.createElement('input'); inp.type='hidden'; inp.id='raLandingTime';
            document.body.appendChild(inp);
          }
          document.getElementById('raLandingTime').value = arrivalStr;

          var targets   = parseCoords((doc.getElementById('targetsCoords').value || ''));
          var nukesAll  = parseCoords((doc.getElementById('nukesCoords').value  || ''));
          var noblesAll = parseCoords((doc.getElementById('noblesCoords').value || ''));
          var supAll    = parseCoords((doc.getElementById('supportCoords').value|| ''));
          if (!targets.length) { alert('Targets içinde koordinat bulunamadı.'); return; }

          var nukesPerTarget   = Math.max(0, toInt(doc.getElementById('nukesPerTarget')?.value, 0));
          var noblesPerTarget  = Math.max(0, toInt(doc.getElementById('noblesPerTarget')?.value, 0));
          var supportPerTarget = Math.max(0, toInt(doc.getElementById('supportPerTarget')?.value, 0));

          var nukeUnit    = doc.getElementById('slowestNukeUnit').value || 'ram';
          var supportUnit = doc.getElementById('slowestSupportUnit').value || 'spear';

          // Havuzlar (tüketilecek kopyalar)
          var nukesPool   = nukesAll.slice();
          var noblesPool  = noblesAll.slice();
          var supportPool = supAll.slice();

          // villageId eşlemesi al (hata olsa da devam)
          mapOwnVillageIdsByCoords().then(function(coordToId){
            var fullBB = '';

            // Her hedef için havuzdan çek → tekrar kullanım yok
            targets.forEach(function(target){
              var allPlans = [];

              // Nukes
              var takeN = Math.max(0, Math.min(nukesPerTarget, nukesPool.length));
              var useNukes = nukesPool.splice(0, takeN);
              useNukes.forEach(function(from){
                allPlans.push(makePlan(from, target, nukeUnit, 'nuke', arrivalDate, coordToId[from]));
              });

              // Nobles
              var takeNb = Math.max(0, Math.min(noblesPerTarget, noblesPool.length));
              var useNobles = noblesPool.splice(0, takeNb);
              useNobles.forEach(function(from){
                allPlans.push(makePlan(from, target, 'snob', 'noble', arrivalDate, coordToId[from]));
              });

              // Support
              var takeS = Math.max(0, Math.min(supportPerTarget, supportPool.length));
              var useSupport = supportPool.splice(0, takeS);
              useSupport.forEach(function(from){
                allPlans.push(makePlan(from, target, supportUnit, 'support', arrivalDate, coordToId[from]));
              });

              // Kalkışa göre sırala
              allPlans.sort(function(a,b){
                return parseDT(a.launchTimeFormattedPad) - parseDT(b.launchTimeFormattedPad);
              });

              var nukesPlans   = allPlans.filter(function(p){ return p.category === 'nuke';   }).map(stripPadForOutput);
              var noblesPlans  = allPlans.filter(function(p){ return p.category === 'noble';  }).map(stripPadForOutput);
              var supportPlans = allPlans.filter(function(p){ return p.category === 'support';}).map(stripPadForOutput);

              if (nukesPlans.length)   fullBB += getBBCodePlans_TR(nukesPlans,  target, arrivalStr, 'kami')   + '\n\n';
              if (noblesPlans.length)  fullBB += getBBCodePlans_TR(noblesPlans, target, arrivalStr, 'mis')    + '\n\n';
              if (supportPlans.length) fullBB += getBBCodePlans_TR(supportPlans,target, arrivalStr, 'destek') + '\n\n';
            });

            attackPlannerWindow.document.getElementById('resultsBBCode').value = fullBB.trim();
          }).catch(function(){
            // Eşleşme yoksa villageId boş; linkler yine çalışır (mevcut köye gider)
            var fullBB = '';
            var nukesPool   = nukesAll.slice();
            var noblesPool  = noblesAll.slice();
            var supportPool = supAll.slice();

            targets.forEach(function(target){
              var allPlans = [];

              var useNukes = nukesPool.splice(0, Math.max(0, Math.min(nukesPerTarget, nukesPool.length)));
              useNukes.forEach(function(from){ allPlans.push(makePlan(from, target, nukeUnit, 'nuke', arrivalDate, null)); });

              var useNobles = noblesPool.splice(0, Math.max(0, Math.min(noblesPerTarget, noblesPool.length)));
              useNobles.forEach(function(from){ allPlans.push(makePlan(from, target, 'snob', 'noble', arrivalDate, null)); });

              var useSupport = supportPool.splice(0, Math.max(0, Math.min(supportPerTarget, supportPool.length)));
              useSupport.forEach(function(from){ allPlans.push(makePlan(from, target, supportUnit, 'support', arrivalDate, null)); });

              allPlans.sort(function(a,b){ return parseDT(a.launchTimeFormattedPad) - parseDT(b.launchTimeFormattedPad); });

              var nukesPlans   = allPlans.filter(function(p){return p.category==='nuke';}).map(stripPadForOutput);
              var noblesPlans  = allPlans.filter(function(p){return p.category==='noble';}).map(stripPadForOutput);
              var supportPlans = allPlans.filter(function(p){return p.category==='support';}).map(stripPadForOutput);

              if (nukesPlans.length)   fullBB += getBBCodePlans_TR(nukesPlans,  target, arrivalStr, 'kami')   + '\n\n';
              if (noblesPlans.length)  fullBB += getBBCodePlans_TR(noblesPlans, target, arrivalStr, 'mis')    + '\n\n';
              if (supportPlans.length) fullBB += getBBCodePlans_TR(supportPlans,target, arrivalStr, 'destek') + '\n\n';
            });

            attackPlannerWindow.document.getElementById('resultsBBCode').value = fullBB.trim();
          });

        } catch(errOuter){
          alert('Tıklama işleyicisinde hata: ' + (errOuter && errOuter.message ? errOuter.message : errOuter));
        }
      });
    } catch(e){
      alert('Handler bağlanamadı: ' + (e && e.message ? e.message : e));
    }
  }

  // Çıkışta pad'siz tarih kullan
  function stripPadForOutput(p){
    return {
      unit: p.unit,
      highPrio: p.highPrio,
      coords: p.coords,
      villageId: p.villageId,
      launchTimeFormatted: p.launchTimeFormatted // unpadded
    };
  }

  function makePlan(from, target, unit, category, arrivalDate, villageId){
    var dist = distance(from, target);
    var launch = launchTime(unit, arrivalDate, dist);
    return {
      unit: unit,
      category: category,           // 'nuke' | 'noble' | 'support'
      highPrio: false,
      coords: from,
      villageId: villageId || '',
      launchTimeFormatted: fmtUnpadded(launch),      // örnekle aynı (3/10/2025 ...)
      launchTimeFormattedPad: padDateTime(launch)    // sıralama için
    };
  }

  // ---------- Unit info fetch & başlat ----------
  function initWithUnitInfo(info){
    unitInfo = info;
    openWindow();
  }
  function fetchUnitInfo(){
    jQuery.ajax({ url: '/interface.php?func=get_unit_info' })
      .done(function(response){
        try{
          var info = xml2json($(response));
          localStorage.setItem(`${LS_PREFIX}_unit_info`, JSON.stringify(info));
          localStorage.setItem(`${LS_PREFIX}_last_update`, String(nowMs()));
          initWithUnitInfo(info);
        } catch(e){
          alert('Birim bilgisi işlenemedi: ' + e);
        }
      })
      .fail(function(){
        alert('Birim bilgisi alınamadı. Tekrar deneyin.');
      });
  }

  (function bootstrap(){
    // Cache kullan
    try{
      var last = parseInt(localStorage.getItem(`${LS_PREFIX}_last_update`) || '0', 10);
      if (last && nowMs() < (last + TIME_INTERVAL)) {
        var cached = JSON.parse(localStorage.getItem(`${LS_PREFIX}_unit_info`) || 'null');
        if (cached) { initWithUnitInfo(cached); return; }
      }
    }catch(e){}
    fetchUnitInfo();
  })();
})();
