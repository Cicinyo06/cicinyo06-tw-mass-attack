/*!
 * Mass Attack Planner (Custom)
 * Base: v1.1.8 / Custom Build: v1.3.0 (2025-09-04)
 * Author (base): RedAlert / Custom: prepared for Yekta
 * URL: https://twscripts.dev/
 *
 * Adds:
 * - Arrival Time, Slowest Nuke/Support unit selectors
 * - Targets/Nobles/Nukes/Support coords + per target counts
 * - GET PLAN -> Table with Send + BB Code export for forum/notepad
 */

(function () {
    if (typeof window === 'undefined') return;
    if (typeof game_data === 'undefined') {
        alert('Bu script Tribal Wars oyun ekranında çalıştırılmalıdır (game_data yok)!');
        return;
    }
    if (typeof jQuery === 'undefined') {
        alert('jQuery bulunamadı. Oyunun bir iç sayfasında deneyin.');
        return;
    }

    var scriptData = {
        name: 'Mass Attack Planner',
        version: 'v1.3.0-custom',
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
    var MAP_VILLAGES_CACHE = []; // [{id,name,coords}]

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
            '', '', 'left=10px,top=10px,width=860,height=760,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0'
        );
        if (!attackPlannerWindow) {
            alert('Pop-up engellendi. Lütfen bu site için pop-up izni verin ve tekrar deneyin.');
            return;
        }
        attackPlannerWindow.document.write(windowContent);

        setTimeout(async function () {
            const doc = attackPlannerWindow.document;

            // Varsayılan landing time
            doc.getElementById('mapLandingTime').value = formatDateTimeLocal(new Date());

            // Birim select’lerini doldur (dünya birimlerine göre)
            populateUnitSelects();

            // Grupları ve köyleri çek
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

            doc.getElementById('mapCopyBB').addEventListener('click', (e) => {
                e.preventDefault();
                const ta = doc.getElementById('mapExportPlanBBCode');
                ta.select(); ta.setSelectionRange(0, ta.value.length);
                attackPlannerWindow.document.execCommand('copy');
                try { UI.SuccessMessage('BB Code kopyalandı!'); } catch (e) { alert('BB Code kopyalandı!'); }
            });

        }, 120);
    }

    /* ============== UI ============== */
    function getAppContent() {
        return `
<div class="ra-app">
  <div class="ra-grid ra-mb15" style="grid-template-columns: 1fr 220px 220px;">
    <div>
      <label for="mapLandingTime">Arrival Time (dd/mm/yyyy HH:mm:ss veya yyyy-mm-dd HH:mm:ss)</label>
      <input id="mapLandingTime" type="text" placeholder="dd/mm/yyyy HH:mm:ss"/>
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

  <div class="ra-grid ra-mb15" style="grid-template-columns: repeat(3, 1fr);">
    <div>
      <label for="mapTargets">Targets Coords (her satıra bir koordinat, ör: 500|500)</label>
      <textarea id="mapTargets" placeholder="500|500&#10;501|498"></textarea>
    </div>
    <div>
      <label for="mapNoblesCoords">Nobles Coords (opsiyonel, boşsa gruptan)</label>
      <textarea id="mapNoblesCoords" placeholder="Sadece kendi köy koordinatların"></textarea>
    </div>
    <div>
      <label for="mapNukesCoords">Nukes Coords (opsiyonel, boşsa gruptan)</label>
      <textarea id="mapNukesCoords" placeholder="Sadece kendi köy koordinatların"></textarea>
    </div>
  </div>

  <div class="ra-grid ra-mb15" style="grid-template-columns: 1fr 1fr 1fr;">
    <div>
      <label for="mapSupportCoords">Support Coords (opsiyonel, boşsa gruptan)</label>
      <textarea id="mapSupportCoords" placeholder="Sadece kendi köy koordinatların"></textarea>
    </div>
    <div>
      <label for="mapGroups">Group</label>
      <select id="mapGroups"><option value="0">All</option></select>
    </div>
    <div>
      <label>Per Target</label>
      <div class="ra-grid" style="grid-template-columns: repeat(3, 1fr); gap: 6px;">
        <div><small>Nobles</small><input id="mapNoblesPerTarget" type="number" min="0" value="0"/></div>
        <div><small>Nukes</small><input id="mapNukesPerTarget" type="number" min="0" value="1"/></div>
        <div><small>Support</small><input id="mapSupportPerTarget" type="number" min="0" value="0"/></div>
      </div>
    </div>
  </div>

  <div class="ra-mb15">
    <a href="javascript:void(0);" id="mapGetPlan" class="btn btn-confirm-yes">Get Plan!</a>
  </div>

  <h3>Results</h3>
  <div class="ra-grid ra-mb15" style="grid-template-columns: 1fr 1fr;">
    <div>
      <table id="mapResults" class="ra-table" width="100%">
        <thead><tr><th>#</th><th>From</th><th>To</th><th>Type</th><th>Dist.</th><th>Launch</th><th>Send</th></tr></thead>
        <tbody id="mapResultsBody"></tbody>
      </table>
    </div>
    <div>
      <label for="mapExportPlanBBCode"><b>Export Plan as BB Code</b></label>
      <textarea id="mapExportPlanBBCode" readonly placeholder="[table] ... [/table]"></textarea>
      <div style="margin-top:6px;">
        <a href="javascript:void(0);" id="mapCopyBB" class="btn">Copy BB Code</a>
      </div>
    </div>
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
  textarea{height:100px;resize:vertical}
  .btn{padding:4px 6px}
  .ra-table{border-collapse:separate!important;border-spacing:2px!important;width:100%}
  .ra-table th,.ra-table td{background:#fff5da;padding:4px;text-align:center}
  .ra-table tbody tr:hover td{background:#ffdd30!important}
  .ra-text-left{text-align:left!important}
</style>`;
        return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${scriptData.name} ${scriptData.version}</title>${windowStyle}</head>
<body>${windowHeader}${windowBody}<br/><small><strong>${windowFooter}</strong></small></body></html>`;
    }

    /* ============== LOAD GROUPS/VILLAGES ============== */
    async function mapLoadGroupsAndVillages(groupId) {
        const groups = await fetchVillageGroups();
        const doc = attackPlannerWindow.document, sel = doc.getElementById('mapGroups');
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

    /* ============== PLAN BUILDING ============== */
    function handleGetPlan() {
        const doc = attackPlannerWindow.document;

        // Inputs
        const landingStr = (doc.getElementById('mapLandingTime').value || '').trim();
        const slowestNuke = (doc.getElementById('mapSlowestNuke').value || 'ram');
        const slowestSupport = (doc.getElementById('mapSlowestSupport').value || 'spear');

        const targets = parseCoordsTextarea(doc.getElementById('mapTargets').value);
        const noblesSrc = parseCoordsTextarea(doc.getElementById('mapNoblesCoords').value);
        const nukesSrc = parseCoordsTextarea(doc.getElementById('mapNukesCoords').value);
        const supportSrc = parseCoordsTextarea(doc.getElementById('mapSupportCoords').value);

        const noblesPerTarget = Math.max(0, parseInt(doc.getElementById('mapNoblesPerTarget').value || '0'));
        const nukesPerTarget  = Math.max(0, parseInt(doc.getElementById('mapNukesPerTarget').value  || '1'));
        const supportPerTarget= Math.max(0, parseInt(doc.getElementById('mapSupportPerTarget').value|| '0'));

        if (!targets.length) { try { UI.ErrorMessage('Targets boş!'); } catch(e) {} return; }

        let landingTime = parseLandingTimeFlexible(landingStr);
        if (!landingTime) {
            try { UI.ErrorMessage('Arrival Time formatı geçersiz!'); } catch(e) {}
            return;
        }

        // Kaynak köy listelerini (coords) oyuncunun köy ID'lerine eşleyelim
        const noblesVillages  = filterVillagesByCoordsOrAll(noblesSrc);
        const nukesVillages   = filterVillagesByCoordsOrAll(nukesSrc);
        const supportVillages = filterVillagesByCoordsOrAll(supportSrc);

        // Plan üret
        const plans = []; // düz liste (tabloda gösterim için)
        const groupedForBB = {}; // bb code için hedefe göre gruplanmış

        // Köy tekrarını hedef başına engellemek için set (opsiyonel)
        targets.forEach(toCoord => {
            const usedThisTarget = new Set();

            // NUKES
            if (nukesPerTarget > 0) {
                const ranked = rankByDistance(nukesVillages, toCoord).filter(v => !usedThisTarget.has(v.id));
                const chosen = ranked.slice(0, nukesPerTarget);
                chosen.forEach(v => {
                    usedThisTarget.add(v.id);
                    const launch = getLaunchTimeByUnit(slowestNuke, landingTime, v.distance);
                    plans.push(makePlanRow(v, toCoord, 'Nuke', slowestNuke, v.distance, launch));
                    pushGrouped(groupedForBB, toCoord, makePlanRow(v, toCoord, 'Nuke', slowestNuke, v.distance, launch));
                });
            }

            // NOBLES
            if (noblesPerTarget > 0) {
                const ranked = rankByDistance(noblesVillages, toCoord).filter(v => !usedThisTarget.has(v.id));
                const chosen = ranked.slice(0, noblesPerTarget);
                chosen.forEach(v => {
                    usedThisTarget.add(v.id);
                    const launch = getLaunchTimeByUnit('snob', landingTime, v.distance);
                    plans.push(makePlanRow(v, toCoord, 'Noble', 'snob', v.distance, launch));
                    pushGrouped(groupedForBB, toCoord, makePlanRow(v, toCoord, 'Noble', 'snob', v.distance, launch));
                });
            }

            // SUPPORT
            if (supportPerTarget > 0) {
                const ranked = rankByDistance(supportVillages, toCoord).filter(v => !usedThisTarget.has(v.id));
                const chosen = ranked.slice(0, supportPerTarget);
                chosen.forEach(v => {
                    usedThisTarget.add(v.id);
                    const launch = getLaunchTimeByUnit(slowestSupport, landingTime, v.distance);
                    plans.push(makePlanRow(v, toCoord, 'Support', slowestSupport, v.distance, launch));
                    pushGrouped(groupedForBB, toCoord, makePlanRow(v, toCoord, 'Support', slowestSupport, v.distance, launch));
                });
            }
        });

        // Sıra & tablo render
        plans.sort((a,b)=>a.launchTime - b.launchTime);
        renderTable(plans);

        // BB Code üret
        const bb = buildMassBBCode(groupedForBB, landingTime);
        doc.getElementById('mapExportPlanBBCode').value = bb;

        try { UI.SuccessMessage('Plan hazır!'); } catch(e) {}
    }

    function renderTable(plans) {
        const doc = attackPlannerWindow.document, tbody = doc.getElementById('mapResultsBody');
        if (!tbody) return;
        if (!plans.length) { tbody.innerHTML = `<tr><td colspan="7"><b>No plans</b></td></tr>`; return; }
        let idx = 1;
        const rows = plans.map(p => {
            const sendBtn = createSendButtonHTML(p.villageId, p.toCoords, 'Send');
            const link = game_data.link_base_pure + 'info_village&id=' + p.villageId;
            return `
<tr>
  <td>${idx++}</td>
  <td class="ra-text-left"><a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.fromName)} (${p.fromCoords})</a></td>
  <td>${p.toCoords}</td>
  <td>${p.type}</td>
  <td>${p.distance.toFixed(2)}</td>
  <td>${formatDateTime(p.launchTime)}</td>
  <td>${sendBtn}</td>
</tr>`;
        }).join('');
        tbody.innerHTML = rows;
    }

    /* ============== UNIT SELECTS ============== */
    function populateUnitSelects() {
        const doc = attackPlannerWindow.document;
        const worldUnits = game_data.units || [];

        // Nuke için makul seçenekler
        const nukeCandidates = ['axe','light','marcher','heavy','ram','catapult','knight'].filter(u => worldUnits.includes(u));
        // Support için makul seçenekler
        const supportCandidates = ['spear','sword','archer','spy','heavy','knight','catapult'].filter(u => worldUnits.includes(u));

        const selNuke = doc.getElementById('mapSlowestNuke');
        const selSupp = doc.getElementById('mapSlowestSupport');

        selNuke.innerHTML = nukeCandidates.map(u => `<option value="${u}">${u}</option>`).join('');
        selSupp.innerHTML = supportCandidates.map(u => `<option value="${u}">${u}</option>`).join('');

        // Varsayılanlar
        if (worldUnits.includes('ram')) setSelectIfExists(selNuke,'ram');
        if (worldUnits.includes('spear')) setSelectIfExists(selSupp,'spear');
    }
    function setSelectIfExists(sel, val) {
        for (let i=0;i<sel.options.length;i++) { if (sel.options[i].value === val) { sel.selectedIndex = i; break; } }
    }

    /* ============== HELPERS: DATA & TIME ============== */
    function parseCoordsTextarea(text) {
        return (text || '')
            .split('\n')
            .map(s => s.trim())
            .filter(s => /^\d{3}\|\d{3}$/.test(s));
    }
    function parseLandingTimeFlexible(str) {
        if (!str) return null;
        // Destek: "dd/mm/yyyy HH:mm:ss" veya "yyyy-mm-dd HH:mm:ss"
        let d = null;
        if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(:\d{2})?$/.test(str)) {
            const [datePart, timePart] = str.split(' ');
            const [dd, mm, yyyy] = datePart.split('/');
            const hhmmss = timePart.length === 5 ? timePart + ':00' : timePart;
            d = new Date(`${yyyy}-${mm}-${dd} ${hhmmss}`);
        } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(str)) {
            const t = str.length === 16 ? str + ':00' : str;
            d = new Date(t);
        } else {
            return null;
        }
        return isNaN(d) ? null : d;
    }
    function rankByDistance(sourceVillages, toCoord) {
        return sourceVillages.map(v => {
            const dist = calculateDistance(v.coords, toCoord);
            return {...v, distance: dist};
        }).sort((a,b) => a.distance - b.distance);
    }
    function filterVillagesByCoordsOrAll(coordList) {
        if (!coordList.length) return MAP_VILLAGES_CACHE.slice();
        // Koordinattan oyuncu köyüne eşleme
        const set = new Set(coordList);
        return MAP_VILLAGES_CACHE.filter(v => set.has(v.coords));
    }
    function makePlanRow(fromVillage, toCoord, type, unit, distance, launchTime) {
        return {
            villageId: fromVillage.id,
            fromName: fromVillage.name,
            fromCoords: fromVillage.coords,
            toCoords: toCoord,
            type, unit, distance,
            launchTime
        };
    }
    function pushGrouped(grouped, toCoord, row) {
        if (!grouped[toCoord]) grouped[toCoord] = [];
        grouped[toCoord].push(row);
    }

    /* ============== TIME & URL UTILS (SVP mantığıyla) ============== */
    function getLaunchTimeByUnit(unit, landingTimeDate, distance) {
        const msPerSec = 1000, secsPerMin = 60, msPerMin = msPerSec * secsPerMin;
        const sp = unitInfo?.config?.[unit]?.speed || 30; // fallback
        const unitTime = distance * sp * msPerMin;
        const launch = new Date(Math.round((landingTimeDate.getTime() - unitTime) / msPerSec) * msPerSec);
        return launch.getTime();
    }
    function getServerTime() {
        const serverTime = jQuery('#serverTime').text();
        const serverDate = jQuery('#serverDate').text();
        if (!serverTime || !serverDate) return new Date();
        const [day, month, year] = serverDate.split('/');
        return new Date(`${year}-${month}-${day} ${serverTime}`);
    }
    function formatDateTime(dateOrMs) {
        const d = (dateOrMs instanceof Date) ? dateOrMs : new Date(dateOrMs);
        let Y = d.getFullYear(), M=(''+(d.getMonth()+1)).padStart(2,'0'), D=(''+d.getDate()).padStart(2,'0');
        let h=(''+d.getHours()).padStart(2,'0'), m=(''+d.getMinutes()).padStart(2,'0'), s=(''+d.getSeconds()).padStart(2,'0');
        return `${D}/${M}/${Y} ${h}:${m}:${s}`;
    }
    function formatDateTimeLocal(d) {
        // dd/mm/yyyy HH:mm:ss
        return formatDateTime(d);
    }
    function calculateDistance(a,b){
        const [x1,y1]=a.split('|'),[x2,y2]=b.split('|');
        const dx=Math.abs(x1 - x2), dy=Math.abs(y1 - y2);
        return Math.sqrt(dx*dx + dy*dy);
    }
    function parseCoordsToXY(coords) {
        const [x,y]=coords.split('|').map(s=>s.trim()); return [x,y];
    }

    function buildCommandUrl(villageId, targetCoords) {
        const [toX, toY] = parseCoordsToXY(targetCoords);
        const rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
        const sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}&` : '';
        return `${window.location.origin}/game.php?${sitterData}village=${villageId}&screen=place${rallyPointData}`;
    }
    function createSendButtonHTML(villageId, targetCoords, label) {
        label = label || 'Send';
        const href = buildCommandUrl(villageId, targetCoords);
        return `<a href="${href}" class="btn btn-confirm-yes" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }

    /* ============== BB CODE EXPORT ============== */
    function buildMassBBCode(groupedByTarget, landingTimeDate) {
        // Tek Köy Planlayıcı mantığına benzer; başlık+her hedefe tablo
        const landingStr = formatDateTime(landingTimeDate);
        let bb = `[size=12][b]Mass Attack Plan[/b][/size]\\n\\n`;

        const targets = Object.keys(groupedByTarget);
        if (!targets.length) return bb;

        targets.forEach(toCoord => {
            bb += `[u][b]Target:[/b] ${toCoord}[/u]\\n[b]Landing Time:[/b] ${landingStr}\\n\\n`;
            bb += `[table][**]Unit[||]From[||]Type[||]Launch Time[||]Command[||]Status[/**]\\n`;
            groupedByTarget[toCoord]
                .sort((a,b)=>a.launchTime - b.launchTime)
                .forEach(row => {
                    const {unit, fromCoords, villageId, launchTime} = row;
                    const [toX, toY] = parseCoordsToXY(toCoord);
                    const priority = ''; // istersen erken gönder vb. işaretleyebilirsin
                    let rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
                    let sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}&` : '';
                    let commandUrl = `/game.php?${sitterData}village=${villageId}&screen=place${rallyPointData}`;
                    bb += `[*][unit]${unit}[/unit][|] ${fromCoords} [|] ${row.type} [|] ${formatDateTime(launchTime)} [|][url=${window.location.origin}${commandUrl}]Send[/url][|] \\n`;
                });
            bb += `[/table]\\n\\n`;
        });

        return bb;
    }

    /* ============== FETCHERS (ported) ============== */
    async function fetchVillageGroups() {
        const villageGroups = await jQuery
            .get(game_data.link_base_pure + 'groups&mode=overview&ajax=load_group_menu')
            .then((response) => response)
            .catch((error) => {
                try { UI.ErrorMessage('Error fetching village groups!'); } catch (e) {}
                console.error(scriptInfo() + ' Error:', error);
            });
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
                        const villageName = jQuery(this).find('td:eq(0)').text().trim();
                        const villageCoords = jQuery(this).find('td:eq(1)').text().trim();
                        list.push({ id: parseInt(villageId), name: villageName, coords: villageCoords });
                    });
                    return list;
                })
                .catch(() => {
                    try { UI.ErrorMessage('Villages list could not be fetched!'); } catch (e) {}
                    return [];
                });
        } catch (error) {
            console.error(scriptInfo() + ' Error:', error);
            try { UI.ErrorMessage('Villages list could not be fetched!'); } catch (e) {}
            return [];
        }
        return villagesByGroup;
    }

    /* ============== MISC ============== */
    function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
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
