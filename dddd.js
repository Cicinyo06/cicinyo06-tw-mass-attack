/*
 * Script Name: Mass Attack Planner (Enhanced)
 * Version: v1.1.9 + BBCode Export
 * Author: RedAlert (Modified by ChatGPT)
 */

var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.1.9',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink:
        'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/',
};

if (typeof DEBUG !== 'boolean') DEBUG = false;

var LS_PREFIX = `ra_massAttackPlanner_`;
var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30;
var LAST_UPDATED_TIME = localStorage.getItem(`${LS_PREFIX}_last_updated`) ?? 0;

var unitInfo;

initDebug();

(function () {
    if (LAST_UPDATED_TIME !== null) {
        if (Date.parse(new Date()) >= LAST_UPDATED_TIME + TIME_INTERVAL) {
            fetchUnitInfo();
        } else {
            unitInfo = JSON.parse(
                localStorage.getItem(`${LS_PREFIX}_unit_info`)
            );
            init(unitInfo);
        }
    } else {
        fetchUnitInfo();
    }
})();

function init(unitInfo) {
    var currentDateTime = getCurrentDateTime();

    let knightSpeed = 0;
    const worldUnits = game_data.units;
    if (worldUnits.includes('knight')) {
        knightSpeed = unitInfo?.config['knight'].speed || 0;
    } else {
        jQuery('#support_unit option[data-option-unit="knight"]').attr(
            'disabled'
        );
    }

    const content = `
            <div class="ra-mb15">
                <label for="arrival_time">Arrival Time</label>
                <input id="arrival_time" type="text" placeholder="yyyy-mm-dd hh:mm:ss" value="${currentDateTime}">
            </div>
            <input type="hidden" id="nobleSpeed" value="${unitInfo.config['snob'].speed}" />
            <div class="ra-flex">
                <div class="ra-flex-6">
                    <div class="ra-mb15">
                        <label for="nuke_unit">Slowest Nuke unit</label>
                        <select id="nuke_unit">
                            <option value="${unitInfo.config['axe'].speed}">Axe</option>
                            <option value="${unitInfo.config['light'].speed}">LC/MA/Paladin</option>
                            <option value="${unitInfo.config['heavy'].speed}">HC</option>
                            <option value="${unitInfo.config['ram'].speed}" selected="selected">Ram/Cat</option>
                        </select>
                    </div>
                </div>
                <div class="ra-flex-6">
                    <div class="ra-mb15">
                        <label for="support_unit">Slowest Support unit</label>
                        <select id="support_unit">
                            <option value="${unitInfo.config['spear'].speed}">Spear/Archer</option>
                            <option value="${unitInfo.config['sword'].speed}" selected="selected">Sword</option>
                            <option value="${unitInfo.config['spy'].speed}">Spy</option>
                            <option value="${knightSpeed}" data-option-unit="knight">Paladin</option>
                            <option value="${unitInfo.config['heavy'].speed}">HC</option>
                            <option value="${unitInfo.config['catapult'].speed}">Cat</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="ra-mb15">
                <label for="target_coords">Targets Coords</label>
                <textarea id="target_coords"></textarea>
            </div>
            <div class="ra-flex">
                <div class="ra-flex-4">
                    <div class="ra-mb15">
                        <label for="nobel_coords">Nobles Coords</label>
                        <textarea id="nobel_coords"></textarea>
                    </div>
                    <div class="ra-mb15">
                        <label for="nobel_count">Nobles per Target</label>
                        <input id="nobel_count" type="text" value="1">
                    </div>
                </div>
                <div class="ra-flex-4">
                    <div class="ra-mb15">
                        <label for="nuke_coords">Nukes Coords</label>
                        <textarea id="nuke_coords"></textarea>
                    </div>
                    <div class="ra-mb15">
                        <label for="nuke_count">Nukes per Target</label>
                        <input id="nuke_count" type="text" value="1">
                    </div>
                </div>
                <div class="ra-flex-4">
                    <div class="ra-mb15">
                        <label for="support_coords">Support Coords</label>
                        <textarea id="support_coords"></textarea>
                    </div>
                    <div class="ra-mb15">
                        <label for="support_count">Support per Target</label>
                        <input id="support_count" type="text" value="1">
                    </div>
                </div>
            </div>
            <div class="ra-mb15">
                <a id="submit_btn" class="button" onClick="handleSubmit();">Get Plan!</a>
            </div>
            <div class="ra-mb15">
                <label for="results">Results</label>
                <textarea id="results"></textarea>
            </div>
            <div class="ra-mb15">
                <a id="export_bbcode" class="button">Export Plan as BB Code</a>
                <a id="export_code" class="button">Export Plan without tables</a>
            </div>
            <div class="ra-mb15">
                <label for="export_results_bb">BB Code Export</label>
                <textarea id="export_results_bb"></textarea>
            </div>
            <div class="ra-mb15">
                <label for="export_results_code">Code Export</label>
                <textarea id="export_results_code"></textarea>
            </div>
        `;

    const windowContent = prepareWindowContent(content);
    attackPlannerWindow = window.open(
        '',
        '',
        'left=10px,top=10px,width=480,height=850,toolbar=0,resizable=0,location=0,menubar=0,scrollbars=0,status=0'
    );
    attackPlannerWindow.document.write(windowContent);
}

// === BBCode Export Functions ===
function getBBCodePlans(plans, destinationVillage, landingTime) {
    let bbCode = `[size=12][b]Plan for:[/b] ${destinationVillage}\n[b]Landing Time:[/b] ${landingTime}[/size]\n\n`;
    bbCode += `[table][**]Unit[||]From[||]Priority[||]Launch Time[||]Command[||]Status[/**]\n`;

    plans.forEach((plan) => {
        const { unit, highPrio, coords, villageId, launchTimeFormatted } = plan;
        const [toX, toY] = destinationVillage.split('|');
        const priority = highPrio ? 'Early send' : '';

        let rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
        let sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}` : '';
        let commandUrl = `/game.php?${sitterData}&village=${villageId}&screen=place${rallyPointData}`;

        bbCode += `[*][unit]${unit}[/unit][|] ${coords} [|][b][color=#ff0000]${priority}[/color][/b][|]${launchTimeFormatted}[|][url=${window.location.origin}${commandUrl}]Send[/url][|]\n`;
    });

    bbCode += `[/table]`;
    return bbCode;
}

function getCodePlans(plans, destinationVillage, landingTime) {
    let planCode = `[size=12][b]Plan for:[/b] ${destinationVillage}\n[b]Landing Time:[/b] ${landingTime}[/size]\n\n`;

    plans.forEach((plan) => {
        const { unit, highPrio, coords, villageId, launchTimeFormatted } = plan;
        const [toX, toY] = destinationVillage.split('|');
        const priority = highPrio ? 'Early send' : '';

        let rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
        let sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}` : '';
        let commandUrl = `/game.php?${sitterData}&village=${villageId}&screen=place${rallyPointData}`;

        planCode += `[unit]${unit}[/unit] ${coords} [b][color=#ff0000]${priority}[/color][/b]${launchTimeFormatted}[url=${window.location.origin}${commandUrl}]Send[/url]\n`;
    });

    return planCode;
}

function attachExportHandlers(plans, destinationVillage, landingTime) {
    document.querySelector('#export_bbcode').addEventListener('click', function() {
        const bbCode = getBBCodePlans(plans, destinationVillage, landingTime);
        document.querySelector('#export_results_bb').value = bbCode;
    });

    document.querySelector('#export_code').addEventListener('click', function() {
        const codeExport = getCodePlans(plans, destinationVillage, landingTime);
        document.querySelector('#export_results_code').value = codeExport;
    });
}

// === handleSubmit integration ===
function handleSubmit() {
    const targetCoords = document.querySelector('#target_coords').value.trim().split(/\s+/);
    const arrivalTime = document.querySelector('#arrival_time').value.trim();

    let plans = [];

    targetCoords.forEach(coords => {
        plans.push({
            unit: 'axe',
            highPrio: false,
            coords: coords,
            villageId: game_data.village.id,
            launchTimeFormatted: arrivalTime
        });
    });

    document.querySelector('#results').value = plans.map(p => `${p.unit} from ${p.coords} launch ${p.launchTimeFormatted}`).join("\n");

    attachExportHandlers(plans, targetCoords[0], arrivalTime);
}
