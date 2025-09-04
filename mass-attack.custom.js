/*!
 * Mass Attack Planner (Custom)
 * Build: v1.3.1-sendonly (2025-09-04)
 * Change: UI sağdaki gibi kalsın; Results bölümünde yalnızca SEND içeren BB Code verilsin.
 * URL logic: Single Village Planner ile aynı (sitter + UK istisnası)
 */

(function () {
  if (typeof window === 'undefined') return;
  if (typeof game_data === 'undefined') { alert('Bu script Tribal Wars oyun ekranında çalıştırılmalıdır.'); return; }
  if (typeof jQuery === 'undefined') { alert('jQuery bulunamadı. Oyunun bir iç sayfasında deneyin.'); return; }

  var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.3.1-sendonly',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink: 'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/'
  };

  if (typeof DEBUG !== 'boolean') DEBUG = false;
  var LS_PREFIX = 'ra_massAttackPlanner_';
  var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30;
  var LAST_UPDATED_TIME = localStorage.getItem(LS_PREFIX + '_last_updated') ?? 0;

  var unitInfo, attackPlannerWindow = null;
  var MAP_GROUP_ID = parseInt(localStorage.getItem(LS_PREFIX + '_chosen_group') ?? 0) || 0;
  var MAP_VILLAGES_CACHE = [];

  initDebug();

  (function () {
    if (LAST_UPDATED_TIME !== null) {
      if (Date.parse(new Date()) >= LAST_UPDATED_TIME + TIME_INTERVAL) {
        fetchUnitInfo();
      } else {
        unitInfo = JSON.parse(localStorage.getItem(LS_PREFIX + '_unit_info'));
        init();
      }
    } else {
      fetchUnitInfo();
    }
  })();

  /* ============== INIT ============== */
  function init() {
    const content = getAppContent();
    const windowContent = prepareWindowContent(content);
    attackPlannerWindow = window.open(
      '', '',
      'left=10px,top=10px,width=860,height=760,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0'
    );
    if (!attackPlannerWindow) {
      alert('Pop-up engellendi. Bu site için pop-up izni verin ve tekrar deneyin.');
      return;
    }
    attackPlannerWindow.document.write(windowContent);

    setTimeout(async function () {
      const doc = attackPlannerWindow.document;

      // Varsayılan iniş zamanı
      doc.getElementById('mapLandingTime').value = formatDateTimeLocal(new Date());

      // Birim select'leri
      populateUnitSelects();

      // Gruplar & köyler
      await mapLoadGroupsAndVillages(MAP_GROUP_ID);

      // Events
      doc.getElementById('mapGroups').addEventListener('change', async (e) => {
        MAP_GROUP_ID = parseInt(e.target.value || 0);
        localStorage.setItem(LS_PREFIX + '_chosen_group', MAP_GROUP_ID);
        await mapLoadVillagesForGroup(MAP_GROUP_ID);
      });

      doc.getElementById('mapGetPlan').addEventListener('click', (e) => {
        e.preventDefault();
        handleGetPlan();
      });

      // Copy BB
      const copyBtn = doc.getElementById('mapCopyBB');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          const ta = doc.getElementById('mapResultsBB');
          if (!ta) return;
          ta.select(); ta.setSelectionRange(0, ta.value.length);
          (doc.execCommand && doc.execCommand('copy')) || navigator.clipboard?.writeText(ta.value);
          try { UI.SuccessMessage('BB Code kopyalandı!'); } catch (e) { alert('BB Code kopyalandı!'); }
        });
      }
    }, 120);
  }

  /* ============== UI (sağdaki gibi) ============== */
  function getAppContent() {
    return `
<div class="ra-app">
  <div class="ra-grid ra-mb15" style="grid-template-columns: 1fr 220px 220px;">
    <div>
      <label for="mapLandingTime">Arrival Time</label>
      <input id="mapLandingTime" type="text" placeholder="yyyy-mm-dd HH:mm:ss veya dd/mm/yyyy HH:mm:ss" />
    </div>
    <div>
      <label for="mapSlowestNuke">Slowest Nuke unit</label>
      <select id="mapSlowestNuke"></select>
    </div>
    <div>
      <label for="mapSlowestSupport">Slowest Support unit</label>
      <select id="mapSlowestSupport"></select>
    </div>
  </div>

  <div class="ra-mb15">
    <label for="mapTargets">Targets Coords</label>
    <textarea id="mapTargets" placeholder="500|500&#10;501|498"></textarea>
  </div>

  <div class="ra-grid ra-mb15" style="grid-template-columns: repeat(3, 1fr);">
    <div>
      <label for="mapNoblesCoords">Nobles Coords (opsiyonel)</label>
      <textarea id="mapNoblesCoords" placeholder=""></textarea>
    </div>
    <div>
      <label for="mapNukesCoords">Nukes Coords (opsiyonel)</label>
      <textarea id="mapNukesCoords" placeholder=""></textarea>
    </div>
    <div>
      <label for="mapSupportCoords">Support Coords (opsiyonel)</label>
      <textarea id="mapSupportCoords" placeholder=""></textarea>
    </div>
  </div>

  <div class="ra-grid ra-mb15" style="grid-template-columns: 1fr 1fr 1fr;">
    <div>
      <label for="mapGroups">Group</label>
      <select id="mapGroups"><option value="0">All</option></select>
    </div>
    <div>
      <label for="mapNoblesPerTarget">Nobles per Target</label>
      <input id="mapNoblesPerTarget" type="number" min="0" value="0"/>
    </div>
    <div>
      <label for="mapNukesPerTarget">Nukes per Target</label>
      <input id="mapNukesPerTarget" type="number" min="0" value="1"/>
    </div>
  </div>

  <div class="ra-grid ra-mb15" style="grid-template-columns: 1fr 1fr 1fr;">
    <div>
      <label for="mapSupportPerTarget">Support per Target</label>
      <input id="mapSupportPerTarget" type="number" min="0" value="0"/>
    </div>
    <div></div>
    <div>
      <a href="javascript:void(0);" id="mapGetPlan" class="btn btn-confirm-yes" style="margin-top:18px;">GET PLAN</a>
    </div>
  </div>

  <h3>Results</h3>
  <!-- SADECE BB CODE: SEND linklerinden oluşan çıktı -->
  <textarea id="mapResultsBB" placeholder="[table]... sadece [url]Send[/url]..." style="width:100%;height:120px;"></textarea>
  <div style="margin-top:6px;">
    <a href="javascript:void(0);" id="mapCopyBB" class="btn">Copy BB Code</a>
  </div>
</div>
`;
  }

  function prepareWindowContent(windowBody) {
    const windowHeader = `<h2>${scriptData.name}</h2>`;
    const windowFooter = `${scriptData.name} ${scriptData.version} - <a href="${scriptData.authorUrl}" target="_blank" rel="noopener noreferrer">${scriptData.author}</a> - <a href="${scriptData.helpLink}" target="_blank" rel="noopener noreferrer">Help</a>`;
    const windowStyle = `
<style>
  body{font-family:Verdana,Arial,sans-serif;font-size:12px;color:#000}
  .ra-app{position:relative;display:block;width:auto;height:auto;margin:0 auto 10px;padding:10px;border:1px solid #603000;background:#f4e4bc}
  .ra-app *{box-sizing:border-box}
  .ra-grid{display:grid;gap:10px}
  .ra-mb15{margin-bottom:15px}
  input[type=text],input[type=number],select,textarea{width:100%;padding:6px 8px;border:1px solid #000;font-size:13px}
  textarea{resize:vertical}
  .btn{padding:4px 6px}
</style>`;
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>${scriptData.name} ${scriptData.version}</title>${windowStyle}</head>
<body>${windowHeader}${windowBody}<br/><small><strong>${windowFooter}</strong></small></body></html>`;
  }

  /* ============== DATA LOAD ============== */
  async function mapLoadGroupsAndVillages(groupId) {
    const groups = await fetchVillageGroups();
    const doc = attackPlannerWindow.document;
    const sel = doc.getElementById('mapGroups');
    sel.innerHTML = '';
    if (groups && groups.result) {
      for (const [_, g] of Object.entries(groups.result)) {
        const gid = parseInt(g.group_id), name = g.name ?? ('Group ' + gid);
        const opt = doc.createElement('option');
        opt.value = gid; opt.textContent = name;
        if (gid === parseInt(groupId)) opt.selected = true;
        sel.appendChild(opt);
      }
    } else {
      const opt = doc.createElement('option'); opt.value = 0; opt.textContent = 'All'; sel.appendChild(opt);
    }
    await mapLoadVillagesForGroup(groupId);
  }

  async function mapLoadVillagesForGroup(groupId) {
    MAP_VILLAGES_CACHE = await fetchAllPlayerVillagesByGroup(groupId);
  }

  /* ============== PLAN & BB CODE (SEND ONLY) ============== */
  function handleGetPlan() {
    const doc = attackPlannerWindow.document;

    const landingStr = (doc.getElementById('mapLandingTime').value || '').trim();
    const slowestNuke = (doc.getElementById('mapSlowestNuke').value || 'ram');
    const slowestSupport = (doc.getElementById('mapSlowestSupport').value || 'spear');

    const targets = parseCoordsTextarea(doc.getElementById('mapTargets').value);
    const noblesSrc = parseCoordsTextarea(doc.getElementById('mapNoblesCoords').value);
    const nukesSrc  = parseCoordsTextarea(doc.getElementById('mapNukesCoords').value);
    const supportSrc= parseCoordsTextarea(doc.getElementById('mapSupportCoords').value);

    const noblesPerTarget  = Math.max(0, parseInt(doc.getElementById('mapNoblesPerTarget').value  || '0'));
    const nukesPerTarget   = Math.max(0, parseInt(doc.getElementById('mapNukesPerTarget').value   || '1'));
    const supportPerTarget = Math.max(0, parseInt(doc.getElementById('mapSupportPerTarget').value || '0'));

    if (!targets.length) { try { UI.ErrorMessage('Targets boş!'); } catch(e) {} return; }
    const landingTime = parseLandingTimeFlexible(landingStr) || new Date();

    const noblesVillages  = filterVillagesByCoordsOrAll(noblesSrc);
    const nukesVillages   = filterVillagesByCoordsOrAll(nukesSrc);
    const supportVillages = filterVillagesByCoordsOrAll(supportSrc);

    const plans = [];

    targets.forEach(toCoord => {
      const used = new Set();

      // Nukes
      if (nukesPerTarget > 0) {
        rankByDistance(nukesVillages, toCoord).filter(v => !used.has(v.id))
          .slice(0, nukesPerTarget)
          .forEach(v => {
            used.add(v.id);
            const launch = getLaunchTimeByUnit(slowestNuke, landingTime, v.distance);
            plans.push({ unit:'', fromCoords:v.coords, toCoords:toCoord, villageId:v.id, type:'Nuke', launchTime:launch });
          });
      }
      // Nobles
      if (noblesPerTarget > 0) {
        rankByDistance(noblesVillages, toCoord).filter(v => !used.has(v.id))
          .slice(0, noblesPerTarget)
          .forEach(v => {
            used.add(v.id);
            const launch = getLaunchTimeByUnit('snob', landingTime, v.distance);
            plans.push({ unit:'snob', fromCoords:v.coords, toCoords:toCoord, villageId:v.id, type:'Noble', launchTime:launch });
          });
      }
      // Support
      if (supportPerTarget > 0) {
        rankByDistance(supportVillages, toCoord).filter(v => !used.has(v.id))
          .slice(0, supportPerTarget)
          .forEach(v => {
            used.add(v.id);
            const launch = getLaunchTimeByUnit(slowestSupport, landingTime, v.distance);
            plans.push({ unit:'', fromCoords:v.coords, toCoords:toCoord, villageId:v.id, type:'Support', launchTime:launch });
          });
      }
    });

    // SADECE SEND: BB kodu üret ve Results alanına yaz
    const bb = buildSendOnlyBBCode(plans, landingTime);
    doc.getElementById('mapResultsBB').value = bb;

    try { UI.SuccessMessage('BB Code oluşturuldu.'); } catch(e) {}
  }

  // Sadece SEND sütunu içeren BB Code
  function buildSendOnlyBBCode(plans, landingTimeDate) {
    if (!plans || !plans.length) return '';
    // İstersen hedefe göre gruplama yapmadan düz liste yazıyoruz:
    let bb = '[table][**]Send[/**]\\n';
    plans.forEach(p => {
      const url = buildCommandUrl(p.villageId, p.toCoords);
      bb += `[*][url=${url}]Send[/url]\\n`;
    });
    bb += '[/table]';
    return bb;
  }

  /* ============== UNIT SELECTS ============== */
  function populateUnitSelects() {
    const doc = attackPlannerWindow.document;
    const worldUnits = game_data.units || [];
    const nukeCandidates = ['axe','light','marcher','heavy','ram','catapult','knight'].filter(u => worldUnits.includes(u));
    const supportCandidates = ['spear','sword','archer','spy','heavy','knight','catapult'].filter(u => worldUnits.includes(u));

    const selNuke = doc.getElementById('mapSlowestNuke');
    const selSupp = doc.getElementById('mapSlowestSupport');

    selNuke.innerHTML = nukeCandidates.map(u => `<option value="${u}">${u}</option>`).join('');
    selSupp.innerHTML = supportCandidates.map(u => `<option value="${u}">${u}</option>`).join('');

    if (worldUnits.includes('ram')) setSelectIfExists(selNuke,'ram');
    if (worldUnits.includes('spear')) setSelectIfExists(selSupp,'spear');
  }
  function setSelectIfExists(sel, val) {
    for (let i=0;i<sel.options.length;i++) if (sel.options[i].value === val) { sel.selectedIndex = i; break; }
  }

  /* ============== HELPERS ============== */
  function parseCoordsTextarea(text) {
    return (text || '').split('\n').map(s => s.trim()).filter(s => /^\d{3}\|\d{3}$/.test(s));
  }
  function parseLandingTimeFlexible(str) {
    if (!str) return null;
    let d = null;
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      const [datePart, timePart] = str.split(' ');
      const [dd, mm, yyyy] = datePart.split('/');
      const hhmmss = timePart.length === 5 ? timePart + ':00' : timePart;
      d = new Date(`${yyyy}-${mm}-${dd} ${hhmmss}`);
    } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(str)) {
      const t = str.length === 16 ? str + ':00' : str;
      d = new Date(t);
    }
    return isNaN(d?.getTime?.()) ? null : d;
  }
  function rankByDistance(sourceVillages, toCoord) {
    return sourceVillages.map(v => ({ ...v, distance: calculateDistance(v.coords, toCoord) }))
                         .sort((a,b) => a.distance - b.distance);
  }
  function filterVillagesByCoordsOrAll(coordList) {
    if (!coordList.length) return MAP_VILLAGES_CACHE.slice();
    const set = new Set(coordList);
    return MAP_VILLAGES_CACHE.filter(v => set.has(v.coords));
  }

  function calculateDistance(a,b){
    const [x1,y1]=a.split('|'),[x2,y2]=b.split('|');
    const dx=Math.abs(x1-x2), dy=Math.abs(y1-y2);
    return Math.sqrt(dx*dx + dy*dy);
  }

  function formatDateTimeLocal(d){ return formatDateTime(d); }
  function formatDateTime(dateOrMs){
    const d = (dateOrMs instanceof Date) ? dateOrMs : new Date(dateOrMs);
    let Y=d.getFullYear(), M=(''+(d.getMonth()+1)).padStart(2,'0'), D=(''+d.getDate()).padStart(2,'0');
    let h=(''+d.getHours()).padStart(2,'0'), m=(''+d.getMinutes()).padStart(2,'0'), s=(''+d.getSeconds()).padStart(2,'0');
    return `${D}/${M}/${Y} ${h}:${m}:${s}`;
  }

  function parseCoordsToXY(coords){ const [x,y]=coords.split('|').map(s=>s.trim()); return [x,y]; }

  // /place URL (SVP ile aynı mantık)
  function buildCommandUrl(villageId, targetCoords) {
    const [toX, toY] = parseCoordsToXY(targetCoords);
    const rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
    const sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}&` : '';
    return `${window.location.origin}/game.php?${sitterData}village=${villageId}&screen=place${rallyPointData}`;
  }

  /* ============== FETCHERS ============== */
  async function fetchVillageGroups() {
    const villageGroups = await jQuery
      .get(game_data.link_base_pure + 'groups&mode=overview&ajax=load_group_menu')
      .then((response) => response)
      .catch((error) => { try { UI.ErrorMessage('Error fetching village groups!'); } catch (e) {} console.error(scriptInfo() + ' Error:', error); });
    return villageGroups;
  }
  async function fetchAllPlayerVillagesByGroup(groupId) {
    let villagesByGroup = [];
    try {
      const url = game_data.link_base_pure + 'groups&ajax=load_villages_from_group';
      villagesByGroup = await jQuery
        .post({ url: url, data: { group_id: groupId } })
        .then((response) => {
          const parser = new DOMParser();
          const htmlDoc = parser.parseFromString(response.html, 'text/html');
          const rows = jQuery(htmlDoc).find('#group_table > tbody > tr').not(':eq(0)');
          let list = [];
          rows.each(function () {
            const villageId =
              jQuery(this).find('td:eq(0) a').attr('data-village-id') ??
              jQuery(this).find('td:eq(0) a').attr('href').match(/\d+/)[0];
            const villageName  = jQuery(this).find('td:eq(0)').text().trim();
            const villageCoords= jQuery(this).find('td:eq(1)').text().trim();
            list.push({ id: parseInt(villageId), name: villageName, coords: villageCoords });
          });
          return list;
        })
        .catch(() => { try { UI.ErrorMessage('Villages list could not be fetched!'); } catch (e) {} return []; });
    } catch (error) {
      console.error(scriptInfo() + ' Error:', error);
      try { UI.ErrorMessage('Villages list could not be fetched!'); } catch (e) {}
      return [];
    }
    return villagesByGroup;
  }

  /* ============== UNIT INFO ============== */
  function fetchUnitInfo() {
    jQuery.ajax({ url: '/interface.php?func=get_unit_info' }).done(function (response) {
      unitInfo = xml2json($(response));
      localStorage.setItem(LS_PREFIX + '_unit_info', JSON.stringify(unitInfo));
      localStorage.setItem(LS_PREFIX + '_last_updated', Date.parse(new Date()));
      init();
    });
  }

  var xml2json = function ($xml) {
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
  };

  function scriptInfo() { return '[' + scriptData.name + ' ' + scriptData.version + ']'; }
  function initDebug() {
    console.debug(scriptInfo() + ' It works ğẏš€!');
    console.debug(scriptInfo() + ' HELP:', scriptData.helpLink);
    if (DEBUG) {
      console.debug(scriptInfo() + ' Market:', game_data.market);
      console.debug(scriptInfo() + ' World:', game_data.world);
      console.debug(scriptInfo() + ' Screen:', game_data.screen);
      console.debug(scriptInfo() + ' Game Version:', game_data.majorVersion);
      console.debug(scriptInfo() + ' Game Build:', game_data.version);
      console.debug(scriptInfo() + ' Locale:', game_data.locale);
      console.debug(scriptInfo() + ' Premium:', game_data.features.Premium.active);
    }
  }

})();
