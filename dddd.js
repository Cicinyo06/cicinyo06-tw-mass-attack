/*
 * File: dddd.js (v3)
 * Purpose: Büyük Atak – TR BBCode Export + "Gönder" linki (tek parça, güvenli bağlama ve hata yakalama ile)
 */
(function DDDD_MassAttack_TR_BBCode_OneFile_v3() {
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
  function parseCoords(text){
    var arr = (text||'').split(/[^0-9|]+/).filter(Boolean);
    return arr.filter(function(x){ return /^\d{3}\|\d{3}$/.test(x); });
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
  function getBBCodePlans_TR(plans, destinationVillage, landingTimeString) {
    var bb  = `[size=12][b]Plan için:[/b] ${destinationVillage}\n`;
        bb += `[b]İniş zamanı:[/b] ${landingTimeString}[/size]\n\n`;
        bb += `[table][**]Birim[||]Z[||]Öncelik[||]Başlatma Zamanı:[||]Komut[||]Durum[/**]\n`;

    var origin = (window.location.origin || '').replace(/\/$/,'');

    plans.forEach(function(p){
      var unit = p.unit;
      var highPrio = p.highPrio ? 'erken gönder' : '';
      var coords = p.coords;
      var villageId = p.villageId || ''; // boş da olsa link çalışır (mevcut köye gider)
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
        <input id="arrivalTime" type="text" placeholder="05/10/2025 22:50:56"/>

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

        <label>Targets Coords (her satır bir hedef)</label>
        <textarea id="targetsCoords" placeholder="605|572&#10;600|570"></textarea>

        <label>Nukes Coords</label>
        <textarea id="nukesCoords" placeholder="621|409&#10;620|410"></textarea>

        <label>Nobles Coords</label>
        <textarea id="noblesCoords" placeholder="630|400"></textarea>

        <label>Support Coords</label>
        <textarea id="supportCoords" placeholder="540|540"></textarea>

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

  function attachHandlerSafe(){
    try{
      var doc = attackPlannerWindow.document;
      var btn = doc.getElementById('getPlanBtn');
      if (!btn) { alert('Buton bulunamadı.'); return; }

      // Parent sayfada landingTime input'u oluştur (BBCode başlığı için)
      if (!document.getElementById('raLandingTime')) {
        var inp = document.createElement('input');
        inp.type = 'hidden'; inp.id = 'raLandingTime';
        document.body.appendChild(inp);
      }

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
          document.getElementById('raLandingTime').value = arrivalStr;

          var targets  = parseCoords((doc.getElementById('targetsCoords').value || ''));
          var nukesArr = parseCoords((doc.getElementById('nukesCoords').value  || ''));
          var noblesArr= parseCoords((doc.getElementById('noblesCoords').value || ''));
          var supArr   = parseCoords((doc.getElementById('supportCoords').value|| ''));
          if (!targets.length) { alert('Targets Coords boş.'); return; }

          var nukeUnit    = doc.getElementById('slowestNukeUnit').value || 'ram';
          var supportUnit = doc.getElementById('slowestSupportUnit').value || 'spear';
          var nukesPerTarget   = toInt(doc.getElementById('nukesPerTarget').value, 1);
          var noblesPerTarget  = toInt(doc.getElementById('noblesPerTarget').value, 1);
          var supportPerTarget = toInt(doc.getElementById('supportPerTarget').value, 0);

          // villageId eşlemesini al ve devam et (hata olsa da BBCode üretilecek)
          mapOwnVillageIdsByCoords().then(function(coordToId){
            try{
              var fullBB = '';
              targets.forEach(function(target){
                var plans = [];

                for (var i=0;i<nukesPerTarget;i++){
                  var from = nukesArr.shift(); if (!from) break;
                  plans.push(makePlan(from, target, nukeUnit, arrivalDate, coordToId[from]));
                }
                for (var j=0;j<noblesPerTarget;j++){
                  var from2 = noblesArr.shift(); if (!from2) break;
                  plans.push(makePlan(from2, target, 'snob', arrivalDate, coordToId[from2]));
                }
                for (var k=0;k<supportPerTarget;k++){
                  var from3 = supArr.shift(); if (!from3) break;
                  plans.push(makePlan(from3, target, supportUnit, arrivalDate, coordToId[from3]));
                }

                plans.sort(function(a,b){
                  return parseDT(a.launchTimeFormattedPad) - parseDT(b.launchTimeFormattedPad);
                });

                fullBB += getBBCodePlans_TR(
                  plans.map(function(p){
                    return {
                      unit: p.unit,
                      highPrio: p.highPrio,
                      coords: p.coords,
                      villageId: p.villageId,
                      launchTimeFormatted: p.launchTimeFormatted // unpadded
                    };
                  }),
                  target,
                  arrivalStr
                ) + '\n\n';
              });

              doc.getElementById('resultsBBCode').value = fullBB.trim();
            } catch(err){
              alert('Plan üretiminde hata: ' + (err && err.message ? err.message : err));
            }
          }).catch(function(err){
            alert('Köy ID eşlemesi alınamadı, yine de BBCode üretmeye çalışıyorum...');
            // Eşleme alınamazsa boş map ile de çıkar
            var fakeMap = {};
            var fullBB = '';
            targets.forEach(function(target){
              var plans = [];
              for (var i=0;i<nukesPerTarget;i++){
                var from = nukesArr.shift(); if (!from) break;
                plans.push(makePlan(from, target, nukeUnit, arrivalDate, fakeMap[from]));
              }
              for (var j=0;j<noblesPerTarget;j++){
                var from2 = noblesArr.shift(); if (!from2) break;
                plans.push(makePlan(from2, target, 'snob', arrivalDate, fakeMap[from2]));
              }
              for (var k=0;k<supportPerTarget;k++){
                var from3 = supArr.shift(); if (!from3) break;
                plans.push(makePlan(from3, target, supportUnit, arrivalDate, fakeMap[from3]));
              }
              plans.sort(function(a,b){
                return parseDT(a.launchTimeFormattedPad) - parseDT(b.launchTimeFormattedPad);
              });
              fullBB += getBBCodePlans_TR(plans, target, arrivalStr) + '\n\n';
            });
            doc.getElementById('resultsBBCode').value = fullBB.trim();
          });
        } catch(errOuter){
          alert('Tıklama işleyicisinde hata: ' + (errOuter && errOuter.message ? errOuter.message : errOuter));
        }
      });
    } catch(e){
      alert('Handler bağlanamadı: ' + (e && e.message ? e.message : e));
    }
  }

  function makePlan(from, target, unit, arrivalDate, villageId){
    var dist = distance(from, target);
    var launch = launchTime(unit, arrivalDate, dist);
    return {
      unit: unit,
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
    // attachHandlerSafe; popup hazır olunca interval ile bağlanıyor (openWindow içinde)
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
