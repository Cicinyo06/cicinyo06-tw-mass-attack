/*!
 * Mass Attack Planner (Custom)
 * Base: v1.1.8 / Custom Build: v1.2.0 (2025-09-04)
 * Author (base): RedAlert / Custom: prepared for Yekta
 * URL: https://twscripts.dev/
 *
 * Notes:
 * - This custom build adds "Send" links (same URL logic as Single Village Planner)
 * - Popup window UI with group filter, targets textarea, and results table with Send button
 */

(function () {
    // -- Environment guard
    if (typeof window === 'undefined') return;
    if (typeof game_data === 'undefined') {
        alert('Bu script Tribal Wars oyun ekranında çalıştırılmalıdır (game_data yok)!');
        return;
    }
    if (typeof jQuery === 'undefined') {
        alert('jQuery bulunamadı. Oyunun bir iç sayfasında deneyin.');
        return;
    }

    /*-------------------------------------------
      Base script data
    -------------------------------------------*/
    var scriptData = {
        name: 'Mass Attack Planner',
        version: 'v1.2.0-custom',
        author: 'RedAlert',
        authorUrl: 'https://twscripts.dev/',
        helpLink:
            'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/',
    };

    // Config & storage
    if (typeof DEBUG !== 'boolean') DEBUG = false;
    var LS_PREFIX = 'ra_massAttackPlanner_';
    var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30; // 30 gün
    var LAST_UPDATED_TIME = localStorage.getItem(LS_PREFIX + '_last_updated') ?? 0;

    // Globals
    var unitInfo, attackPlannerWindow = null;
    var MAP_GROUP_ID =
        parseInt(localStorage.getItem(LS_PREFIX + '_chosen_group') ?? 0) || 0;
    var MAP_VILLAGES_CACHE = []; // [{id, name, coords}]

    // Init debug
    initDebug();

    // Fetch unit info only when needed
    (function () {
        if (LAST_UPDATED_TIME !== null) {
            if (Date.parse(new Date()) >= LAST_UPDATED_TIME + TIME_INTERVAL) {
                fetchUnitInfo();
            } else {
                unitInfo = JSON.parse(localStorage.getItem(LS_PREFIX + '_unit_info'));
                init(unitInfo);
            }
        } else {
            fetchUnitInfo();
        }
    })();

    /*===========================================
    =            Script Initializer             =
    ===========================================*/
    function init() {
        // Open App Window
        const content = getAppContent();
        const windowContent = prepareWindowContent(content);
        attackPlannerWindow = window.open(
            '',
            '',
            'left=10px,top=10px,width=700,height=720,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0'
        );
        if (!attackPlannerWindow) {
            alert(
                'Pop-up engellendi. Lütfen bu site için pop-up izni verin ve tekrar deneyin.'
            );
            return;
        }
        attackPlannerWindow.document.write(windowContent);

        // Fill defaults & wire events once window is ready
        setTimeout(async function () {
            const doc = attackPlannerWindow.document;
            doc.getElementById('mapLandingTime').value = getCurrentDateTime();

            // Load groups + villages for selected group
            await mapLoadGroupsAndVillages(MAP_GROUP_ID);

            // Wire events
            doc.getElementById('mapGroups').addEventListener('change', async (e) => {
                MAP_GROUP_ID = parseInt(e.target.value || 0);
                localStorage.setItem(LS_PREFIX + '_chosen_group', MAP_GROUP_ID);
                await mapLoadVillagesForGroup(MAP_GROUP_ID);
            });

            doc.getElementById('mapGetPlan').addEventListener('click', (e) => {
                e.preventDefault();
                handleGetPlan();
            });
        }, 100);
    }

    /*===========================================
    =            UI CONTENT & STYLES            =
    ===========================================*/
    function getAppContent() {
        return `
<div class="ra-app">
    <div class="ra-grid ra-mb15">
        <div>
            <label for="mapLandingTime">Landing Time (opsiyonel)</label>
            <input id="mapLandingTime" type="text" placeholder="YYYY-MM-DD HH:mm:ss" />
        </div>
        <div>
            <label for="mapGroups">Group</label>
            <select id="mapGroups">
                <option value="0">All</option>
            </select>
        </div>
        <div>
            <label for="mapNukesPerTarget">Nukes per Target</label>
            <input id="mapNukesPerTarget" type="number" min="1" value="1"/>
        </div>
        <div>
            <label for="mapNoblesPerTarget">Nobles per Target</label>
            <input id="mapNoblesPerTarget" type="number" min="0" value="0"/>
        </div>
    </div>

    <div class="ra-mb15">
        <label for="mapTargets">Targets Coords (her satıra bir koordinat, ör: 500|500)</label>
        <textarea id="mapTargets" placeholder="500|500\n501|498"></textarea>
    </div>

    <div class="ra-mb15">
        <a href="javascript:void(0);" id="mapGetPlan" class="btn btn-confirm-yes">Get Plan!</a>
    </div>

    <h3>Results</h3>
    <table id="mapResults" class="ra-table" width="100%">
        <thead>
            <tr>
                <th>#</th>
                <th>From (village)</th>
                <th>To (coords)</th>
                <th>Dist.</th>
                <th>Type</th>
                <th>Send</th>
            </tr>
        </thead>
        <tbody id="mapResultsBody"></tbody>
    </table>
</div>
`;
    }

    function prepareWindowContent(windowBody) {
        const windowHeader = `<h2>${scriptData.name}</h2>`;
        const windowFooter = `${scriptData.name} ${scriptData.version} - <a href="${scriptData.authorUrl}" target="_blank" rel="noopener noreferrer">${scriptData.author}</a> - <a href="${scriptData.helpLink}" target="_blank" rel="noopener noreferrer">Help</a>`;
        const windowStyle = `
<style>
    body { font-family: Verdana, Arial, sans-serif; font-size: 12px; color: #000; }
    .ra-app { position: relative; display: block; width: auto; height: auto; margin: 0 auto 10px; padding: 10px; border: 1px solid #603000; background: #f4e4bc; }
    .ra-app * { box-sizing: border-box; }
    .ra-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .ra-mb15 { margin-bottom: 15px; }
    input[type="text"], input[type="number"], select, textarea { width: 100%; padding: 6px 8px; border: 1px solid #000; font-size: 13px; }
    textarea { height: 100px; resize: vertical; }
    .btn { padding: 4px 6px; }
    .ra-table { border-collapse: separate !important; border-spacing: 2px !important; width: 100%; }
    .ra-table th, .ra-table td { background: #fff5da; padding: 4px; text-align: center; }
    .ra-table tbody tr:hover td { background: #ffdd30 !important; }
    .ra-text-left { text-align: left !important; }
</style>`;
        const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${scriptData.name} ${scriptData.version}</title>
${windowStyle}
</head>
<body>
${windowHeader}
${windowBody}
<br/>
<small><strong>${windowFooter}</strong></small>
</body>
</html>`;
        return html;
    }

    /*===========================================
    =            Core Handlers & Logic          =
    ===========================================*/
    async function mapLoadGroupsAndVillages(groupId) {
        const groups = await fetchVillageGroups();
        const doc = attackPlannerWindow.document;
        const sel = doc.getElementById('mapGroups');
        sel.innerHTML = ''; // reset

        if (groups && groups.result) {
            for (const [_, g] of Object.entries(groups.result)) {
                const gid = parseInt(g.group_id);
                const name = g.name ?? `Group ${gid}`;
                const opt = attackPlannerWindow.document.createElement('option');
                opt.value = gid;
                opt.textContent = name;
                if (gid === parseInt(groupId)) opt.selected = true;
                sel.appendChild(opt);
            }
        } else {
            const opt = attackPlannerWindow.document.createElement('option');
            opt.value = 0;
            opt.textContent = 'All';
            sel.appendChild(opt);
        }
        await mapLoadVillagesForGroup(groupId);
    }

    async function mapLoadVillagesForGroup(groupId) {
        MAP_VILLAGES_CACHE = await fetchAllPlayerVillagesByGroup(groupId);
    }

    function handleGetPlan() {
        const doc = attackPlannerWindow.document;
        const targetsText = (doc.getElementById('mapTargets').value || '').trim();
        const nukesPerTarget = Math.max(
            1,
            parseInt(doc.getElementById('mapNukesPerTarget').value || '1')
        );
        const noblesPerTarget = Math.max(
            0,
            parseInt(doc.getElementById('mapNoblesPerTarget').value || '0')
        );

        if (!targetsText) {
            try {
                UI.ErrorMessage('Targets boş!');
            } catch (e) {}
            return;
        }
        if (!MAP_VILLAGES_CACHE.length) {
            try {
                UI.ErrorMessage('Köy listesi alınamadı!');
            } catch (e) {}
            return;
        }

        const targets = targetsText
            .split('\n')
            .map((s) => s.trim())
            .filter((s) => /^\d{3}\|\d{3}$/.test(s));

        if (!targets.length) {
            try {
                UI.ErrorMessage('Geçerli hedef koordinat bulunamadı!');
            } catch (e) {}
            return;
        }

        // Build plans
        const plans = [];
        let rowIdx = 1;

        targets.forEach((toCoords) => {
            const withDist = MAP_VILLAGES_CACHE.map((v) => {
                return {
                    ...v,
                    distance: calculateDistance(v.coords, toCoords),
                };
            }).sort((a, b) => a.distance - b.distance);

            // Nukes
            withDist.slice(0, nukesPerTarget).forEach((v) => {
                plans.push({
                    idx: rowIdx++,
                    type: 'Nuke',
                    fromId: v.id,
                    fromName: v.name,
                    fromCoords: v.coords,
                    toCoords: toCoords,
                    distance: v.distance,
                });
            });

            // Nobles
            if (noblesPerTarget > 0) {
                withDist
                    .slice(nukesPerTarget, nukesPerTarget + noblesPerTarget)
                    .forEach((v) => {
                        plans.push({
                            idx: rowIdx++,
                            type: 'Noble',
                            fromId: v.id,
                            fromName: v.name,
                            fromCoords: v.coords,
                            toCoords: toCoords,
                            distance: v.distance,
                        });
                    });
            }
        });

        renderMassPlans(plans);
    }

    function renderMassPlans(plans) {
        const doc = attackPlannerWindow.document;
        const tbody = doc.getElementById('mapResultsBody');
        if (!tbody) return;

        if (!plans.length) {
            tbody.innerHTML = `<tr><td colspan="6"><b>No plans</b></td></tr>`;
            return;
        }

        const rows = plans
            .map((p) => {
                const sendBtn = createSendButtonHTML(p.fromId, p.toCoords, 'Send');
                const link = game_data.link_base_pure + 'info_village&id=' + p.fromId;
                return `
<tr>
  <td>${p.idx}</td>
  <td class="ra-text-left"><a href="${link}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                    p.fromName
                )} (${p.fromCoords})</a></td>
  <td>${p.toCoords}</td>
  <td>${p.distance.toFixed(2)}</td>
  <td>${p.type}</td>
  <td>${sendBtn}</td>
</tr>`;
            })
            .join('');

        tbody.innerHTML = rows;
    }

    /*===========================================
    =            Helpers (ported/added)         =
    ===========================================*/
    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;',
            }[m];
        });
    }

    /** "500|500" -> [x,y] */
    function parseCoordsToXY(coords) {
        const [x, y] = coords.split('|').map((s) => s.trim());
        return [x, y];
    }

    /**
     * /place komut URL'si üretir
     * - UK pazarında &x=&y= eklenmez
     * - Sitter aktifse t=playerId eklenir
     * (Mantık Single Village Planner ile aynıdır)
     */
    function buildCommandUrl(villageId, targetCoords) {
        const [toX, toY] = parseCoordsToXY(targetCoords);
        const rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
        const sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}&` : '';
        return `${window.location.origin}/game.php?${sitterData}village=${villageId}&screen=place${rallyPointData}`;
    }

    function createSendButtonHTML(villageId, targetCoords, label = 'Send') {
        const href = buildCommandUrl(villageId, targetCoords);
        return `<a href="${href}" class="btn btn-confirm-yes" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }

    /** "YYYY-MM-DD HH:mm:ss" */
    function getCurrentDateTime() {
        let d = new Date();
        var Y = d.getFullYear(),
            M = ('' + (d.getMonth() + 1)).padStart(2, '0'),
            D = ('' + d.getDate()).padStart(2, '0'),
            h = ('' + d.getHours()).padStart(2, '0'),
            m = ('' + d.getMinutes()).padStart(2, '0'),
            s = ('' + d.getSeconds()).padStart(2, '0');
        return Y + '-' + M + '-' + D + ' ' + h + ':' + m + ':' + s;
    }

    /** Mesafe (iki koordinat) */
    function calculateDistance(villageA, villageB) {
        const x1 = villageA.split('|')[0];
        const y1 = villageA.split('|')[1];
        const x2 = villageB.split('|')[0];
        const y2 = villageB.split('|')[1];
        const deltaX = Math.abs(x1 - x2);
        const deltaY = Math.abs(y1 - y2);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        return distance;
    }

    /** World Unit Info fetch */
    function fetchUnitInfo() {
        jQuery
            .ajax({ url: '/interface.php?func=get_unit_info' })
            .done(function (response) {
                unitInfo = xml2json($(response));
                localStorage.setItem(LS_PREFIX + '_unit_info', JSON.stringify(unitInfo));
                localStorage.setItem(LS_PREFIX + '_last_updated', Date.parse(new Date()));
                init(unitInfo);
            });
    }

    /** XML to JSON converter (from original) */
    var xml2json = function ($xml) {
        var data = {};
        $.each($xml.children(), function (i) {
            var $this = $(this);
            if ($this.children().length > 0) {
                data[$this.prop('tagName')] = xml2json($this);
            } else {
                data[$this.prop('tagName')] = $.trim($this.text());
            }
        });
        return data;
    };

    /** Script info */
    function scriptInfo() {
        return '[' + scriptData.name + ' ' + scriptData.version + ']';
    }

    /** Debug */
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

    /*===========================================
    =        Groups & Villages (ported)         =
    ===========================================*/
    async function fetchVillageGroups() {
        const villageGroups = await jQuery
            .get(game_data.link_base_pure + 'groups&mode=overview&ajax=load_group_menu')
            .then((response) => response)
            .catch((error) => {
                try {
                    UI.ErrorMessage('Error fetching village groups!');
                } catch (e) {}
                console.error(scriptInfo() + ' Error:', error);
            });
        return villageGroups;
    }

    async function fetchAllPlayerVillagesByGroup(groupId) {
        let villagesByGroup = [];
        try {
            const url =
                game_data.link_base_pure + 'groups&ajax=load_villages_from_group';
            villagesByGroup = await jQuery
                .post({
                    url: url,
                    data: { group_id: groupId },
                })
                .then((response) => {
                    const parser = new DOMParser();
                    const htmlDoc = parser.parseFromString(response.html, 'text/html');
                    const tableRows = jQuery(htmlDoc)
                        .find('#group_table > tbody > tr')
                        .not(':eq(0)');
                    let villagesList = [];
                    tableRows.each(function () {
                        const villageId =
                            jQuery(this)
                                .find('td:eq(0) a')
                                .attr('data-village-id') ??
                            jQuery(this)
                                .find('td:eq(0) a')
                                .attr('href')
                                .match(/\d+/)[0];
                        const villageName = jQuery(this)
                            .find('td:eq(0)')
                            .text()
                            .trim();
                        const villageCoords = jQuery(this)
                            .find('td:eq(1)')
                            .text()
                            .trim();
                        villagesList.push({
                            id: parseInt(villageId),
                            name: villageName,
                            coords: villageCoords,
                        });
                    });
                    return villagesList;
                })
                .catch((error) => {
                    try {
                        UI.ErrorMessage('Villages list could not be fetched!');
                    } catch (e) {}
                    return [];
                });
        } catch (error) {
            console.error(scriptInfo() + ' Error:', error);
            try {
                UI.ErrorMessage('Villages list could not be fetched!');
            } catch (e) {}
            return [];
        }
        return villagesByGroup;
    }
})();
