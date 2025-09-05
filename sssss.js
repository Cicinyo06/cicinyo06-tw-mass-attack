/*
 * File: dddd.js (v6.5)
 * Purpose: Büyük Atak – TR BBCode Export + "Gönder" linki (stabil, noktalı tarih/saat)
 * Yenilikler:
 *  - Tarih/saat: 06.06.2025 08.25.25 (noktalar). Slash (/) da kabul edilir; başlıkta nasıl girdiysen öyle kalır.
 *  - Satır kalkışları: noktalı ve başta 0’suz gün/ay (örn. 3.10.2025 10.47.42).
 *  - Targets/Nukes/Nobles/Support etiketleri sade; örnek metinler ve uzun placeholder’lar kaldırıldı.
 *  - Her hedef için 3 ayrı tablo: NUKES -> 'kami', NOBLES -> 'mis', SUPPORT -> 'destek'.
 *  - Tüm listeler her hedef için kullanılır (shift yok).
 *  - Stabilite: tek seferlik event, timeout’lu AJAX, esnek tarih regex, durum çubuğu.
 */
(function DDDD_MassAttack_TR_BBCode_OneFile_v65() {
  // ---------- Durum ----------
  var LS_PREFIX = 'dd_tr_mass_attack';
  var TIME_INTERVAL = 60 * 60 * 1000 * 30; // 30 gün
  var unitInfo = null;
  var attackPlannerWindow = null;

  // ---------- Yardımcılar ----------
  function log(){ try { console.log('[DD-MassAttack]', ...arguments); } catch(e){} }
  function setStatus(msg){ try{
    if (!attackPlannerWindow || !attackPlannerWindow.document) return;
    var bar = attackPlannerWindow.document.getElementById('statusBar');
    if (bar) bar.textContent = msg || '';
  }catch(e){} }

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

  // dd.mm.yyyy HH.mm.ss  veya  dd/mm/yyyy HH:mm:ss  --> Date (esnek)
  function parseLandingTime(s){
    var m = s.match(/^(\d{1,2})././\s+(\d{1,2}):.:.$/);
    if (!m) return NaN;
    var dd=m[1].padStart(2,'0'), mm=m[2].padStart(2,'0'), yy=m[3],
        HH=m[4].padStart(2,'0'), MM=m[5], SS=m[6];
    return new Date(`${yy}-${mm}-${dd} ${HH}:${MM}:${SS}`);
  }
  // Satırlarda örnekteki gibi (baştaki 0'sız gün/ay) ve NOKTA ayraçlı
  function fmtUnpaddedDot(date){
    var D  = String(date.getDate());
    var M  = String(date.getMonth()+1);
    var Y  = date.getFullYear();
    var HH = String(date.getHours()).padStart(2,'0');
    var MM = String(date.getMinutes()).padStart(2,'0');
    var SS = String(date.getSeconds()).padStart(2,'0');
    return `${D}.${M}.${Y} ${HH}.${MM}.${SS}`;
  }
  // Sıralama için pad'li NOKTA ayraçlı
  function padDateTimeDot(date){
    var dd = String(date.getDate()).padStart(2,'0');
    var mm = String(date.getMonth()+1).padStart(2,'0');
    var yy = date.getFullYear();
    var HH = String(date.getHours()).padStart(2,'0');
    var MM = String(date.getMinutes()).padStart(2,'0');
    var SS = String(date.getSeconds()).padStart(2,'0');
    return `${dd}.${mm}.${yy} ${HH}.${MM}.${SS}`;
  }
  // dd.mm.yyyy HH.mm.ss -> Date (sıralama için)
  function parseDTdot(s){
    var m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2})\.(\d{2})\.(\d{2})$/);
    if (!m) return new Date(NaN);
    var dd=m[1], mm=m[2], yy=m[3], HH=m[4], MM=m[5], SS=m[6];
    return new Date(`${yy}-${mm}-${dd} ${HH}:${MM}:${SS}`);
  }

  // İsimli satırlardan koordinatları ayıkla (tekrarları eler, sırayı korur)
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

  // AJAX yardımcı: timeout'lu
  function ajaxGetWithTimeout(url, timeoutMs){
    return new Promise(function(resolve, reject){
      var done = false;
      var t = setTimeout(function(){
        if (done) return; done = true;
        reject(new Error('timeout '+timeoutMs+'ms: '+url));
      }, timeoutMs);
      $.get(url)
        .done(function(res){ if (done) return; done = true; clearTimeout(t); resolve(res); })
        .fail(function(err){ if (done) return; done = true; clearTimeout(t); reject(err || new Error('ajax fail: '+url)); });
    });
  }

  // villageId eşlemesi – başarısız olursa boş bırakır (link yine çalışır)
  async function mapOwnVillageIdsByCoords(){
    try{
      setStatus('Köy ID eşlemesi alınıyor…');
      var url = game_data.link_base_pure + 'overview_villages&mode=combined&group=0';
      var html = await ajaxGetWithTimeout(url, 6000); // 6sn
      var htmlDoc = jQuery.parseHTML(html);
      var rows = jQuery(htmlDoc).find('#combined_table tr.nowrap');
      var map = {};
      rows.each(function(){
        var cell = jQuery(this).find('td:eq(1) span.quickedit-vn');
        var id   = cell.attr('data-id');
        var coords = (cell.text().match(/\d{3}\|\d{3}/) || [])[0];
        if (id && coords) map[coords] = parseInt(id,10);
      });
      log('coordToId size:', Object.keys(map).length);
      return map;
    } catch(e){
      log('coordToId error:', e);
      return {};
    } finally { setStatus(''); }
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
      var launchTimeFormatted = p.launchTimeFormatted; // NOKTA & unpadded
      var to = String(destinationVillage).split('|');
      var toX = to[0] || '', toY = to[1] || '';

      var rallyPointData = game_data?.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
      var sitterData = (game_data?.player?.sitter > 0) ? `t=${game_data.player.id}` : '';
      var commandUrl = `/game.php?${sitterData}&village=${villageId}&screen=place${rallyPointData}`;

      bb += `[*][unit]${unit}[/unit][|] ${coords} [|][b][color=#ff0000]${highPrio}[/color][/b][|]` +
            `${launchTimeFormatted}[|][url=${origin}${commandUrl}]Gönder[/url][|]\n`;
    });

    bb += `[/table]`;
    return bb;
  }

  // ---------- Popup ----------
  function openWindow() {
    var W = 560, H = 820;
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
          #statusBar { margin: 4px 0 8px; color:#555; }
        </style>
      </head>
      <body>
        <h3>Büyük Atak – TR BBCode</h3>

        <div id="statusBar"></div>

        <label>İniş Zamanı (gg.aa.yyyy ss.dd.ss)</label>
        <input id="arrivalTime" type="text" placeholder="06.06.2025 08.25.25"/>

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

        <!-- Sade etiketler, örnekli placeholder kaldırıldı -->
        <label>Targets</label>
        <textarea id="targetsCoords" placeholder=""></textarea>

        <label>Nukes Coords</label>
        <textarea id="nukesCoords" placeholder=""></textarea>

        <label>Nobles Coords</label>
        <textarea id="noblesCoords" placeholder=""></textarea>

        <label>Support Coords</label>
        <textarea id="supportCoords" placeholder=""></textarea>

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

      // Tek seferlik bağlama koruması
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';

      // Parent sayfada landingTime input'u oluştur (BBCode başlığı için)
      if (!document.getElementById('raLandingTime')) {
        var inp = document.createElement('input');
        inp.type = 'hidden'; inp.id = 'raLandingTime';
        document.body.appendChild(inp);
      }

      btn.addEventListener('click', function(e){
        e.preventDefault();
        if (btn.disabled) return; // işlem devam ediyorsa tekrar basma

        (async function runGeneration(){
          try{
            btn.disabled = true;
            btn.textContent = 'Hesaplanıyor...';
            setStatus('Plan hesaplanıyor, lütfen bekleyin…');

            // --- Girişleri oku ---
            var arrivalStr = (doc.getElementById('arrivalTime').value || '').trim();
            if (!arrivalStr) { alert('İniş zamanı boş.'); return; }
            var arrivalDate = parseLandingTime(arrivalStr);
            if (!(arrivalDate instanceof Date) || isNaN(arrivalDate)) {
              alert('İniş zamanı formatı gg.aa.yyyy ss.dd.ss veya gg/aa/yyyy ss:dd:ss olmalı.'); return;
            }
            // Başlık için parent gizli alana yaz
            document.getElementById('raLandingTime').value = arrivalStr;

            var targets   = parseCoords((doc.getElementById('targetsCoords').value || ''));
            var nukesAll  = parseCoords((doc.getElementById('nukesCoords').value  || ''));
            var noblesAll = parseCoords((doc.getElementById('noblesCoords').value || ''));
            var supAll    = parseCoords((doc.getElementById('supportCoords').value|| ''));
            if (!targets.length) { alert('Targets içinde koordinat bulunamadı.'); return; }

            var nukeUnit    = doc.getElementById('slowestNukeUnit').value || 'ram';
            var supportUnit = doc.getElementById('slowestSupportUnit').value || 'spear';

            // villageId eşlemesini al (timeout'lu). Başarısızsa boş map ile devam.
            var coordToId = {};
            try { coordToId = await mapOwnVillageIdsByCoords(); }
            catch(err){ log('map error (ignored):', err); coordToId = {}; }

            // HER HEDEF için TÜM kaynaklar kullanılır.
            var fullBB = '';
            for (var t = 0; t < targets.length; t++){
              var target = targets[t];
              var allPlans = [];

              nukesAll.forEach(function(from){
                allPlans.push(makePlan(from, target, nukeUnit, 'nuke', arrivalDate, coordToId[from]));
              });
              noblesAll.forEach(function(from){
                allPlans.push(makePlan(from, target, 'snob', 'noble', arrivalDate, coordToId[from]));
              });
              supAll.forEach(function(from){
                allPlans.push(makePlan(from, target, supportUnit, 'support', arrivalDate, coordToId[from]));
              });

              allPlans.sort(function(a,b){
                return parseDTdot(a.launchTimeFormattedPad) - parseDTdot(b.launchTimeFormattedPad);
              });

              var nukesPlans   = allPlans.filter(function(p){ return p.category === 'nuke';   }).map(stripPadForOutput);
              var noblesPlans  = allPlans.filter(function(p){ return p.category === 'noble';  }).map(stripPadForOutput);
              var supportPlans = allPlans.filter(function(p){ return p.category === 'support';}).map(stripPadForOutput);

              if (nukesPlans.length)   fullBB += getBBCodePlans_TR(nukesPlans,  target, arrivalStr, 'kami')   + '\n\n';
              if (noblesPlans.length)  fullBB += getBBCodePlans_TR(noblesPlans, target, arrivalStr, 'mis')    + '\n\n';
              if (supportPlans.length) fullBB += getBBCodePlans_TR(supportPlans,target, arrivalStr, 'destek') + '\n\n';
            }

            doc.getElementById('resultsBBCode').value = fullBB.trim();
          } catch(err){
            alert('Plan üretiminde hata: ' + (err && err.message ? err.message : err));
          } finally {
            btn.disabled = false;
            btn.textContent = 'Get Plan!';
            setStatus('');
          }
        })();
      });
    } catch(e){
      alert('Handler bağlanamadı: ' + (e && e.message ? e.message : e));
    }
  }

  // Çıkışta NOKTA ve pad'siz tarih kullan
  function stripPadForOutput(p){
    return {
      unit: p.unit,
      highPrio: p.highPrio,
      coords: p.coords,
      villageId: p.villageId,
      launchTimeFormatted: p.launchTimeFormatted // unpadded + dots
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
      launchTimeFormatted: fmtUnpaddedDot(launch),      // örnekle aynı, DOT + unpadded
      launchTimeFormattedPad: padDateTimeDot(launch)    // sıralama için DOT + padded
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
