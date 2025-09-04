/**
 * Mass Attack Planner (Custom)
 * UI: Sağdaki örneğe hizalanmış
 * Özellikler: Ünite hızları, mesafe, kalkış zamanı, villageId eşleme ve BB Code + Send linkleri
 * Not: Tarayıcı pop-up engelini kapatın (window.open kullanır)
 */

(function () {
  'use strict';

  // --- Script Meta -----------------------------------------------------------
  var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.0.0-custom',
    author: 'Cicinyo06 + Yekta',
    authorUrl: 'https://github.com/Cicinyo06',
    helpLink: '#'
  };

  // --- Globals ---------------------------------------------------------------
  var DEBUG = false;
  var LS_PREFIX = 'cicinyo_massAttack_';
  var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30; // 30 gün
  var LAST_UPDATED_TIME = localStorage.getItem(LS_PREFIX + 'last_updated') ?? 0;

  var unitInfo = null;                     // /interface.php unit hızları
  var attackPlannerWindow = null;          // popup penceresi
  var mapVillageCache = null;              // /map/village.txt -> { "x|y": villageId }

  // --- Init ------------------------------------------------------------------
  initDebug();
  if (LAST_UPDATED_TIME !== null) {
    if (Date.now() >= (parseInt(LAST_UPDATED_TIME, 10) + TIME_INTERVAL)) {
      fetchUnitInfo();
    } else {
      try {
        unitInfo = JSON.parse(localStorage.getItem(LS_PREFIX + 'unit_info'));
      } catch (e) { unitInfo = null; }
      if (!unitInfo) fetchUnitInfo(); else init(unitInfo);
    }
  } else {
    fetchUnitInfo();
  }

  // --- Fetch Unit Info -------------------------------------------------------
  function fetchUnitInfo() {
    jQuery.ajax({ url: '/interface.php?func=get_unit_info' })
      .done(function (response) {
        unitInfo = xml2json(jQuery(response));
        localStorage.setItem(LS_PREFIX + 'unit_info', JSON.stringify(unitInfo));
        localStorage.setItem(LS_PREFIX + 'last_updated', Date.now());
        init(unitInfo);
      })
      .fail(function () {
        alert('[Mass Attack] Unit info çekilemedi. Sayfayı yenileyip tekrar deneyin.');
      });
  }

  // --- Main UI ---------------------------------------------------------------
  function init(unitInfo) {
    var content = getUiContent();
    var windowContent = prepareWindowContent(content);

    attackPlannerWindow = window.open(
      '',
      '',
      'left=10,top=10,width=520,height=780,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0'
    );
    if (!attackPlannerWindow) {
      alert('Pop-up engellendi. Bu scriptin çalışması için pop-up’lara izin verin.');
      return;
    }
    attackPlannerWindow.document.write(windowContent);

    // UI hazır: Varsayılan Arrival Time
    setTimeout(function () {
      try {
        var doc = attackPlannerWindow.document;
        var now = new Date();
        doc.getElementById('raArrivalTime').value = formatIso(now); // yyyy-mm-dd HH:mm:ss

        // GET PLAN tıklandığında planla
        doc.getElementById('raMassGetPlan').addEventListener('click', async function (e) {
          e.preventDefault();
          await onGetPlanClick(doc);
        });
      } catch (e) {
        console.error('[Mass Attack] UI init error:', e);
      }
    }, 100);
  }

  // --- Click Handler ---------------------------------------------------------
  async function onGetPlanClick(doc) {
    // Girdileri oku
    var arrivalStr = (doc.getElementById('raArrivalTime').value || '').trim(); // yyyy-mm-dd HH:mm:ss
    var slowestNuke = doc.getElementById('raSlowestNuke').value;               // unit name
    var slowestSupport = doc.getElementById('raSlowestSupport').value;         // unit name

    var targets = linesToCoords(doc.getElementById('raTargets').value);
    var noblesSrc = linesToCoords(doc.getElementById('raNoblesCoords').value);
    var nukesSrc = linesToCoords(doc.getElementById('raNukesCoords').value);
    var supportSrc = linesToCoords(doc.getElementById('raSupportCoords').value);

    var noblesPerTarget = parseInt(doc.getElementById('raNoblesPerTarget').value || '0', 10);
    var nukesPerTarget  = parseInt(doc.getElementById('raNukesPerTarget').value  || '0', 10);
    var suppPerTarget   = parseInt(doc.getElementById('raSupportPerTarget').value|| '0', 10);

    if (!arrivalStr || !targets.length) {
      alert('Arrival Time ve Targets Coords zorunlu.');
      return;
    }

    var arrivalTime = parseIso(arrivalStr);
    if (isNaN(arrivalTime.getTime())) {
      alert('Arrival Time formatı geçersiz. Örnek: 2025-09-04 20:37:33');
      return;
    }

    // Kaynak köy ID eşleşmeleri için village.txt yükle
    var allSourceCoords = [].concat(noblesSrc, nukesSrc, supportSrc);
    await ensureVillageMapLoaded(allSourceCoords);

    // Planları hazırla
    var plans = [];
    // Nobles: birim sabit 'snob' (noble)
    if (noblesPerTarget > 0 && noblesSrc.length) {
      var noblePlans = allocatePlans(noblesSrc, targets, noblesPerTarget, 'snob');
      plans = plans.concat(noblePlans);
    }
    // Nukes: birim, kullanıcıdan seçili "Slowest Nuke unit"
    if (nukesPerTarget > 0 && nukesSrc.length) {
      var nukePlans = allocatePlans(nukesSrc, targets, nukesPerTarget, slowestNuke);
      plans = plans.concat(nukePlans);
    }
    // Support: birim, kullanıcıdan seçili "Slowest Support unit"
    if (suppPerTarget > 0 && supportSrc.length) {
      var supportPlans = allocatePlans(supportSrc, targets, suppPerTarget, slowestSupport, true);
      plans = plans.concat(supportPlans);
    }

    if (!plans.length) {
      alert('Üretilecek plan bulunamadı. Per Target değerlerini ve kaynak listelerini kontrol edin.');
      return;
    }

    // Mesafe ve kalkış zamanı hesapla, villageId ve send link hazırla
    var enriched = [];
    for (var i = 0; i < plans.length; i++) {
      var p = plans[i];
      var dist = calculateDistance(p.from, p.to);
      var launchMs = getLaunchTimestamp(p.unit, arrivalTime, dist);
      var launchStr = formatDdMmYyyyHms(new Date(launchMs));

      var vId = (mapVillageCache && mapVillageCache[p.from]) ? mapVillageCache[p.from] : null;
      enriched.push({
        unit: p.unit,
        from: p.from,
        to: p.to,
        distance: dist,
        launchTime: launchMs,
        launchTimeFormatted: launchStr,
        villageId: vId,
        highPrio: false // bu akışta öncelik yok
      });
    }

    // Geçmiş kalkışları at (sunucu saatine göre)
    var serverNow = getServerTime();
    enriched = enriched.filter(function (x) { return x.launchTime >= serverNow.getTime(); });

    // Kalkışa göre sırala (yakından uzağa)
    enriched.sort(function (a, b) { return a.launchTime - b.launchTime; });

    // BB Code üret
    var bbCode = getBBCodePlans(enriched);
    doc.getElementById('raMassResults').value = bbCode;
    alert('Plan hazırlandı. Results alanındaki BB kodunu kopyalayabilirsiniz.');
  }

  // --- Planning Helpers ------------------------------------------------------
  // Kaynak listesini hedeflere sırayla dağıtır; perTarget kadar atanır
  function allocatePlans(sourceCoords, targets, perTarget, unit, isSupport) {
    var plans = [];
    if (!perTarget || !targets.length || !sourceCoords.length) return plans;

    var sIndex = 0;
    for (var t = 0; t < targets.length; t++) {
      for (var k = 0; k < perTarget; k++) {
        var src = sourceCoords[sIndex % sourceCoords.length];
        plans.push({
          unit: unit,
          from: src,
          to: targets[t]
        });
        sIndex++;
      }
    }
    return plans;
  }

  // --- Build Send URL --------------------------------------------------------
  function createSendUrl(villageId, destinationVillage) {
    if (!destinationVillage) return '';
    var parts = String(destinationVillage).split('|');
    var toX = (parts[0] || '').trim();
    var toY = (parts[1] || '').trim();

    // UK markette x/y parametresi gönderilmiyor
    var rallyPointData = (window.game_data && game_data.market !== 'uk') ? ('&x=' + toX + '&y=' + toY) : '';

    // Sitter modundaysa t=playerId eklenir
    var sitterData = (window.game_data && game_data.player && game_data.player.sitter > 0)
      ? ('t=' + game_data.player.id + '&')
      : '';

    var villageParam = villageId ? ('village=' + villageId) : ''; // villageId yoksa açık bırakılır
    var base = window.location.origin || '';

    return base + '/game.php?' + sitterData + villageParam + '&screen=place' + rallyPointData;
  }

  // --- BB Code ---------------------------------------------------------------
  function getBBCodePlans(plans) {
    // Plans aynı hedefi içerebilir; üst başlıkta iniş zamanı ve hedef yazmak yerine,
    // satır bazlı gösterim yapıyoruz (kullanıcı çoklu hedef girmiş olabilir)
    var bb = '[table][**]Unit[\\][\\]From[\\][\\]To[\\][\\]Launch Time[\\][\\]Command[\\][\\]Status[/**]\n';

    plans.forEach(function (p) {
      var sendUrl = p.villageId ? createSendUrl(p.villageId, p.to) : '';
      var sendCell = sendUrl ? ('[url=' + sendUrl + ']Send[/url]') : 'N/A';
      bb += '[*][unit]' + p.unit + '[/unit][\\] ' + p.from + ' [\\] ' + p.to + ' [\\] ' + p.launchTimeFormatted + ' [\\] ' + sendCell + ' [\\]\n';
    });

    bb += '[/table]';
    return bb;
  }

  // --- Village Map Loader (/map/village.txt) --------------------------------
  async function ensureVillageMapLoaded(coordsNeeded) {
    if (mapVillageCache) return;
    mapVillageCache = {};

    // Hiç kaynak yoksa gerek yok
    if (!coordsNeeded || !coordsNeeded.length) return;

    // village.txt: id;name;x;y;playerId
    // Mevcut sayfanın alanından istenir
    var url = '/map/village.txt';
    await jQuery.get(url).then(function (txt) {
      var lines = txt.split('\n');
      var needSet = new Set(coordsNeeded);
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var parts = line.split(',');
        // Bazı pazarlarda ayracı ';' olabilir. Her iki yönü deneyelim.
        if (parts.length < 5) parts = line.split(';');
        if (parts.length < 5) continue;

        var id = parts[0];
        var x  = parts[2];
        var y  = parts[3];
        var coord = x + '|' + y;

        if (needSet.has(coord)) {
          mapVillageCache[coord] = id;
        }
      }
    }).catch(function () {
      // village.txt yüklenemezse, Send linkleri villageId olmadan üretilebilir (N/A)
      mapVillageCache = {};
    });
  }

  // --- Dist/Time Helpers -----------------------------------------------------
  function calculateDistance(a, b) {
    var ax = parseInt(a.split('|')[0], 10);
    var ay = parseInt(a.split('|')[1], 10);
    var bx = parseInt(b.split('|')[0], 10);
    var by = parseInt(b.split('|')[1], 10);
    var dx = Math.abs(ax - bx);
    var dy = Math.abs(ay - by);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getLaunchTimestamp(unit, arrivalDate, distance) {
    // unitInfo.config[unit].speed -> dakika/alan
    var msPerMin = 1000 * 60;
    var speedMinPerField = (unitInfo && unitInfo.config && unitInfo.config[unit] && parseFloat(unitInfo.config[unit].speed)) || 0;
    var travelMs = distance * speedMinPerField * msPerMin;

    var launch = new Date();
    launch.setTime(Math.round((arrivalDate.getTime() - travelMs) / 1000) * 1000); // saniyeye yuvarla
    return launch.getTime();
  }

  // --- UI Builder ------------------------------------------------------------
  function getUiContent() {
    return '' +
      '<div class="ra-mass-wrapper">' +

      '  <div class="ra-row">' +
      '    <label for="raArrivalTime">Arrival Time</label>' +
      '    <input id="raArrivalTime" type="text" placeholder="yyyy-mm-dd HH:MM:SS" />' +
      '  </div>' +

      '  <div class="ra-row ra-grid ra-gap-20">' +
      '    <div>' +
      '      <label for="raSlowestNuke">Slowest Nuke unit</label>' +
      '      <select id="raSlowestNuke">' +
      '        <option value="ram" selected>Ram/Cat</option>' +
      '        <option value="axe">Axe</option>' +
      '        <option value="light">LC</option>' +
      '        <option value="marcher">MA</option>' +
      '        <option value="knight">Paladin</option>' +
      '        <option value="heavy">HC</option>' +
      '        <option value="catapult">Catapult</option>' +
      '      </select>' +
      '    </div>' +
      '    <div>' +
      '      <label for="raSlowestSupport">Slowest Support unit</label>' +
      '      <select id="raSlowestSupport">' +
      '        <option value="sword" selected>Sword</option>' +
      '        <option value="spear">Spear</option>' +
      '        <option value="archer">Archer</option>' +
      '        <option value="spy">Spy</option>' +
      '        <option value="knight">Paladin</option>' +
      '        <option value="heavy">HC</option>' +
      '        <option value="catapult">Catapult</option>' +
      '      </select>' +
      '    </div>' +
      '  </div>' +

      '  <div class="ra-row">' +
      '    <label for="raTargets">Targets Coords</label>' +
      '    <textarea id="raTargets" placeholder="500|500&#10;501|500&#10;..."></textarea>' +
      '  </div>' +

      '  <div class="ra-grid ra-gap-20">' +
      '    <div>' +
      '      <label for="raNoblesCoords">Nobles Coords</label>' +
      '      <textarea id="raNoblesCoords" placeholder="kaynak köyler (noble)"></textarea>' +
      '    </div>' +
      '    <div>' +
      '      <label for="raNukesCoords">Nukes Coords</label>' +
      '      <textarea id="raNukesCoords" placeholder="kaynak köyler (nuke)"></textarea>' +
      '    </div>' +
      '    <div>' +
      '      <label for="raSupportCoords">Support Coords</label>' +
      '      <textarea id="raSupportCoords" placeholder="kaynak köyler (support)"></textarea>' +
      '    </div>' +
      '  </div>' +

      '  <div class="ra-grid ra-gap-20">' +
      '    <div>' +
      '      <label for="raNoblesPerTarget">Nobles per Target</label>' +
      '      <input id="raNoblesPerTarget" type="number" min="0" value="1" />' +
      '    </div>' +
      '    <div>' +
      '      <label for="raNukesPerTarget">Nukes per Target</label>' +
      '      <input id="raNukesPerTarget" type="number" min="0" value="1" />' +
      '    </div>' +
      '    <div>' +
      '      <label for="raSupportPerTarget">Support per Target</label>' +
      '      <input id="raSupportPerTarget" type="number" min="0" value="0" />' +
      '    </div>' +
      '  </div>' +

      '  <div class="ra-row">' +
      '    <a href="javascript:void(0);" id="raMassGetPlan" class="ra-btn">GET PLAN!</a>' +
      '  </div>' +

      '  <div class="ra-row">' +
      '    <label for="raMassResults">Results</label>' +
      '    <textarea id="raMassResults" placeholder=""></textarea>' +
      '  </div>' +

      '</div>';
  }

  function prepareWindowContent(windowBody) {
    var windowHeader = '<h2 style="margin:0 0 10px 0;">' + scriptData.name + '</h2>';
    var windowFooter = scriptData.name + ' ' + scriptData.version + ' - [' + scriptData.author + ']('Help](' + scriptndowStyle = '' +
      '<style>' +
      '  :root{--bg:#f4e4bc;--border:#603000;--text:#000;--btn:#7a4a15;--btn-text:#fff;--field-bg:#fff;}' +
      '  html,body{margin:0;padding:10px;background:var(--bg);color:var(--text);font:14px/1.35 Arial,Helvetica,sans-serif;}' +
      '  h2{font-size:20px;font-weight:700;margin:0 0 12px 0;}' +
      '  .ra-mass-wrapper{width:auto;height:auto;border:1px solid var(--border);background:var(--bg);padding:12px;box-sizing:border-box;}' +
      '  label{display:block;font-weight:700;margin:0 0 6px 0;}' +
      '  input[type="text"], input[type="number"], select, textarea{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #000;background:var(--field-bg);font-size:14px;}' +
      '  textarea{min-height:68px;resize:vertical;}' +
      '  .ra-row{margin-bottom:12px;}' +
      '  .ra-grid{display:grid;grid-template-columns:repeat(3,1fr);}' +
      '  .ra-gap-20{grid-gap:20px;}' +
      '  .ra-btn{display:inline-block;background:var(--btn);color:var(--btn-text);padding:6px 10px;text-decoration:none;border-radius:2px;font-weight:700;}' +
      '  .ra-btn:hover{opacity:.92}' +
      '  small{display:block;margin-top:8px;}' +
      '</style>';

    var html = '' +
      '<!DOCTYPE html>' +
      '<html><head><meta charset="utf-8" />' +
      '<title>' + scriptData.name + ' ' + scriptData.version + '</title>' +
      windowStyle +
      '</head><body>' +
      windowHeader +
      windowBody +
      '<br/><small>' + windowFooter + '</small>' +
      '</body></html>';

    return html;
  }

  // --- Format & Parse Helpers ------------------------------------------------
  function formatIso(d) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
           pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function formatDdMmYyyyHms(d) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
           pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function parseIso(s) {
    // yyyy-mm-dd HH:mm:ss
    var parts = s.split(' ');
    var d = parts[0].split('-');
    var t = (parts[1] || '00:00:00').split(':');
    return new Date(
      parseInt(d[0], 10),
      parseInt(d[1], 10) - 1,
      parseInt(d[2], 10),
      parseInt(t[0], 10), parseInt(t[1], 10), parseInt(t[2], 10)
    );
  }

  function linesToCoords(text) {
    if (!text) return [];
    return text
      .split('\n')
      .map(function (l) { return l.trim(); })
      .filter(function (x) { return /^\d{1,3}\|\d{1,3}$/.test(x); });
  }

  function getServerTime() {
    try {
      var time = jQuery('#serverTime').text();
      var date = jQuery('#serverDate').text();
      if (!time || !date) throw 0;
      var dmY = date.split('/');
      var formatted = dmY[2] + '-' + dmY[1] + '-' + dmY[0] + ' ' + time;
      return new Date(formatted);
    } catch (e) {
      return new Date(); // fallback
    }
  }

  // --- XML -> JSON -----------------------------------------------------------
  function xml2json($xml) {
    var data = {};
    jQuery.each($xml.children(), function () {
      var $this = jQuery(this);
      if ($this.children().length > 0) {
        data[$this.prop('tagName')] = xml2json($this);
      } else {
        data[$this.prop('tagName')] = jQuery.trim($this.text());
      }
    });
    return data;
  }

  // --- Debug -----------------------------------------------------------------
  function scriptInfo() { return '[' + scriptData.name + ' ' + scriptData.version + ']'; }
  function initDebug() {
    if (DEBUG) {
      console.debug(scriptInfo(), 'Market:', window.game_data && game_data.market);
      console.debug(scriptInfo(), 'World:',  window.game_data && game_data.world);
      console.debug(scriptInfo(), 'Screen:', window.game_data && game_data.screen);
    }
  }
})();
