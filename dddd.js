/*
 * Script Name: Mass Attack Planner
 * Version: v1.1.8
 * Last Updated: 2023-07-24
 * Author: RedAlert
 * Author URL: https://twscripts.dev/
 * Author Contact: redalert_tw (Discord)
 * Approved: t14001534
 * Approved Date: 2020-06-05
 * Mod: JawJaw
 */

/*--------------------------------------------------------------------------------------
 * This script can NOT be cloned and modified without permission from the script author.
 --------------------------------------------------------------------------------------*/

var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.1.8',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink:
        'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/',
};

// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;

// Local Storage
var LS_PREFIX = `ra_massAttackPlanner_`;
var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30; /* fetch data every 30 days */
var LAST_UPDATED_TIME = localStorage.getItem(`${LS_PREFIX}_last_updated`) ?? 0;

var unitInfo;

// Init Debug
initDebug();

/* Fetch unit info only when needed */
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

// Script Initializer
function init(unitInfo) {
    var currentDateTime = getCurrentDateTime();

    // fix for no paladin worlds
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
		`;

    const windowContent = prepareWindowContent(content);
    attackPlannerWindow = window.open(
        '',
        '',
        'left=10px,top=10px,width=480,height=670,toolbar=0,resizable=0,location=0,menubar=0,scrollbars=0,status=0'
    );
    attackPlannerWindow.document.write(windowContent);
}

// Helper: Window Content
function prepareWindowContent(windowBody) {
    const windowHeader = `<h1 class="ra-fs18 ra-fw600">${scriptData.name}</h1>`;
    const windowFooter = `<small><strong>${scriptData.name} ${scriptData.version}</strong> - <a href="${scriptData.authorUrl}" target="_blank" rel="noreferrer noopener">${scriptData.author}</a> - <a href="${scriptData.helpLink}" target="_blank" rel="noreferrer noopener">Help</a></small>`;
    const windowStyle = `
		<style>
			body { background-color: #f4e4bc; font-family: Verdana, Arial, sans-serif; font-size: 14px; line-height: 1; }
			main { max-width: 768px; margin: 0 auto; }
			h1 { font-size: 27px; }
			a { font-weight: 700; text-decoration: none; color: #603000; }
			small { font-size: 10px; }
			input[type="text"],
			select { display: block; width: 100%; height: auto; line-height: 1; box-sizing: border-box; padding: 5px; outline: none; border: 1px solid #999; }
			input[type="text"]:focus { outline: none; box-shadow: none; border: 1px solid #603000; background-color: #eee; }
			label { font-weight: 600; display: block; margin-bottom: 5px; font-size: 12px; }
			textarea { width: 100%; height: 80px; box-sizing: border-box; padding: 5px; resize: none; }
			textarea:focus { box-shadow: none; outline: none; border: 1px solid #603000; background-color: #eee; }
			.ra-mb15 { margin-bottom: 15px; }
			.ra-flex { display: flex; flex-flow: row wrap; justify-content: space-between; }
			.ra-flex-6 { flex: 0 0 48%; }
			.ra-flex-4 { flex: 0 0 30%; }
			.button { padding: 10px 20px; background-color: #603000; font-weight: 500; color: #fff; text-align: center; display: inline-block; cursor: pointer; text-transform: uppercase; }
		</style>
	`;

    const html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${scriptData.name} ${scriptData.version}</title>
			${windowStyle}
		</head>
		<body>
			<main>
				${windowHeader}
				${windowBody}
				${windowFooter}
			</main>
			<script>
				function loadJS(url, callback) {
					var scriptTag = document.createElement('script');
					scriptTag.src = url;
					scriptTag.onload = callback;
					scriptTag.onreadystatechange = callback;
					document.body.appendChild(scriptTag);
				}

				loadJS('https://code.jquery.com/jquery-3.6.0.min.js', function() {
					loadJS('https://twscripts.dev/scripts/attackPlannerHelper.js', function() {
						console.log('Helper libraries loaded!');
					});
				});
			</script>
		</body>
		</html>
	`;

    return html;
}

// Helper: Get and format current datetime
function getCurrentDateTime() {
    let currentDateTime = new Date();

    var currentYear = currentDateTime.getFullYear();
    var currentMonth = currentDateTime.getMonth();
    var currentDate = '' + currentDateTime.getDate();
    var currentHours = '' + currentDateTime.getHours();
    var currentMinutes = '' + currentDateTime.getMinutes();
    var currentSeconds = '' + currentDateTime.getSeconds();

    currentMonth = currentMonth + 1;
    currentMonth = '' + currentMonth;
    currentMonth = currentMonth.padStart(2, '0');

    currentDate = currentDate.padStart(2, '0');
    currentHours = currentHours.padStart(2, '0');
    currentMinutes = currentMinutes.padStart(2, '0');
    currentSeconds = currentSeconds.padStart(2, '0');

    let formatted_date =
        currentYear +
        '-' +
        currentMonth +
        '-' +
        currentDate +
        ' ' +
        currentHours +
        ':' +
        currentMinutes +
        ':' +
        currentSeconds;

    return formatted_date;
}

/* Helper: Fetch World Unit Info */
function fetchUnitInfo() {
    jQuery
        .ajax({
            url: '/interface.php?func=get_unit_info',
        })
        .done(function (response) {
            unitInfo = xml2json($(response));
            localStorage.setItem(
                `${LS_PREFIX}_unit_info`,
                JSON.stringify(unitInfo)
            );
            localStorage.setItem(
                `${LS_PREFIX}_last_updated`,
                Date.parse(new Date())
            );
            init(unitInfo);
        });
}

// Helper: XML to JSON converter
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

// Helper: Generates script info
function scriptInfo() {
    return `[${scriptData.name} ${scriptData.version}]`;
}

// Helper: Prints universal debug information
function initDebug() {
    console.debug(`${scriptInfo()} It works ğŸš€!`);
    console.debug(`${scriptInfo()} HELP:`, scriptData.helpLink);
    if (DEBUG) {
        console.debug(`${scriptInfo()} Market:`, game_data.market);
        console.debug(`${scriptInfo()} World:`, game_data.world);
        console.debug(`${scriptInfo()} Screen:`, game_data.screen);
        console.debug(`${scriptInfo()} Game Version:`, game_data.majorVersion);
        console.debug(`${scriptInfo()} Game Build:`, game_data.version);
        console.debug(`${scriptInfo()} Locale:`, game_data.locale);
        console.debug(
            `${scriptInfo()} Premium:`,
            game_data.features.Premium.active
        );
    }
}


// =============================
// Export Integration (adds export functions and UI without modifying them)
// Source of export functions: atak planer.txt (Single Village Planner)
// =============================

// Provide a minimal translator if not present
if (typeof tt !== 'function') {
  function tt(s) { return s; }
}

// --- BEGIN: Export plan as BB Code (UNMODIFIED) ---
function getBBCodePlans(plans, destinationVillage) {
  const landingTime = jQuery('#raLandingTime').val().trim();
  let bbCode = `[size=12][b]${tt('Plan for:')}[/b] ${destinationVillage}\n` +
               `[b]${tt('Landing Time:')}[/b] ${landingTime}[/size]\n\n`;
  bbCode += `[table][**]${tt('Unit')}[\\]${tt('From')}[\\]${tt('Priority')}[\\]${tt('Launch Time')}[\\]${tt('Command')}[\\]${tt('Status')}[/**]\n`;
  plans.forEach((plan) => {
    const { unit, highPrio, coords, villageId, launchTimeFormatted } = plan;
    const [toX, toY] = destinationVillage.split('|');
    const priority = highPrio ? tt('Early send') : '';
    let rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
    let sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}` : '';
    let commandUrl = `/game.php?${sitterData}&village=${villageId}&screen=place${rallyPointData}`;
    bbCode += `[*][unit]${unit}[/unit][\\] ${coords} [\\][b][color=#ff0000]${priority}[/color][/b][\\]${launchTimeFormatted}[\\][url=${window.location.origin}${commandUrl}]${tt('Send')}[/url][\\]\n`;
  });
  bbCode += `[/table]`;
  return bbCode;
}
// --- END: Export plan as BB Code ---

// --- BEGIN: Export plans without table (UNMODIFIED) ---
function getCodePlans(plans, destinationVillage) {
  const landingTime = jQuery('#raLandingTime').val().trim();
  let planCode = `[size=12][b]${tt('Plan for:')}[/b] ${destinationVillage}\n` +
                 `[b]${tt('Landing Time:')}[/b] ${landingTime}[/size]\n\n`;
  plans.forEach((plan) => {
    const { unit, highPrio, coords, villageId, launchTimeFormatted } = plan;
    const [toX, toY] = destinationVillage.split('|');
    const priority = highPrio ? tt('Early send') : '';
    let rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
    let sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}` : '';
    let commandUrl = `/game.php?${sitterData}&village=${villageId}&screen=place${rallyPointData}`;
    planCode += `[unit]${unit}[/unit] ${coords} [b][color=#ff0000]${priority}[/color][/b]${launchTimeFormatted}[url=${window.location.origin}${commandUrl}]${tt('Send')}[/url]\n`;
  });
  return planCode;
}
// --- END: Export plans without table ---

// --- BEGIN: Integration UI inside attackPlannerWindow ---
(function attachExportUI() {
  const ensureHiddenLandingInput = () => {
    if (!document.getElementById('raLandingTime')) {
      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.id = 'raLandingTime';
      document.body.appendChild(hidden);
    }
  };
  ensureHiddenLandingInput();

  const attempt = setInterval(() => {
    try {
      if (window.attackPlannerWindow && window.attackPlannerWindow.document && window.attackPlannerWindow.document.body) {
        clearInterval(attempt);
        const doc = window.attackPlannerWindow.document;

        // Create Export UI
        const wrap = doc.createElement('div');
        wrap.id = 'export-ui';
        wrap.style.margin = '8px 0';
        wrap.innerHTML = `
          <fieldset style="border:1px solid #999;padding:8px;">
            <legend>Export</legend>
            <label style="display:block;margin-bottom:6px;">
              Landing Time (dd/mm/yyyy HH:mm:ss):
              <input id="_child_raLandingTime" type="text" style="width:100%;" placeholder="dd/mm/yyyy HH:mm:ss">
            </label>
            <label style="display:block;margin-bottom:6px;">
              Destination (x|y):
              <input id="destCoord" type="text" style="width:100%;" placeholder="500|500">
            </label>
            <label style="display:block;margin-bottom:6px;">
              Plans JSON:
              <textarea id="plansJson" style="width:100%;height:120px;" placeholder='[{"unit":"ram","highPrio":true,"coords":"500|501","villageId":123,"launchTimeFormatted":"01/09/2025 12:34:56"}]'></textarea>
            </label>
            <div style="margin:6px 0;">
              <button id="btnGenBB" type="button">Generate BBCode</button>
              <button id="btnGenCode" type="button">Generate Plain Code</button>
            </div>
            <label style="display:block;margin-bottom:6px;">BBCode:
              <textarea id="outBB" style="width:100%;height:120px;" readonly></textarea>
            </label>
            <label style="display:block;margin-bottom:6px;">Plain:
              <textarea id="outCode" style="width:100%;height:120px;" readonly></textarea>
            </label>
          </fieldset>
        `;
        doc.body.appendChild(wrap);

        // Keep parent hidden #raLandingTime in sync (so export funcs can read it via jQuery in parent)
        const syncLanding = () => {
          const val = doc.getElementById('_child_raLandingTime').value;
          const parentInput = window.opener ? window.opener.document.getElementById('raLandingTime') : document.getElementById('raLandingTime');
          if (parentInput) parentInput.value = val;
        };
        doc.getElementById('_child_raLandingTime').addEventListener('input', syncLanding);

        const getPlans = () => {
          const raw = doc.getElementById('plansJson').value.trim();
          if (!raw) return [];
          try { return JSON.parse(raw); } catch (e) { alert('Invalid JSON in Plans'); return []; }
        };
        const getDest = () => doc.getElementById('destCoord').value.trim();

        doc.getElementById('btnGenBB').onclick = () => {
          syncLanding();
          const plans = getPlans();
          const dest = getDest();
          doc.getElementById('outBB').value = getBBCodePlans(plans, dest);
        };
        doc.getElementById('btnGenCode').onclick = () => {
          syncLanding();
          const plans = getPlans();
          const dest = getDest();
          doc.getElementById('outCode').value = getCodePlans(plans, dest);
        };
      }
    } catch (e) { /* retry */ }
  }, 150);
})();
// --- END: Integration UI ---

/*
 * Script Name: Mass Attack Planner
 * Version: v1.1.8
 * Last Updated: 2023-07-24
 * Author: RedAlert
 * Author URL: https://twscripts.dev/
 * Author Contact: redalert_tw (Discord)
 * Approved: t14001534
 * Approved Date: 2020-06-05
 * Mod: JawJaw
 */

/*--------------------------------------------------------------------------------------
 * This script can NOT be cloned and modified without permission from the script author.
 --------------------------------------------------------------------------------------*/

var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.1.8',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink:
        'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/',
};

// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;

// Local Storage
var LS_PREFIX = `ra_massAttackPlanner_`;
var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30; /* fetch data every 30 days */
var LAST_UPDATED_TIME = localStorage.getItem(`${LS_PREFIX}_last_updated`) ?? 0;

var unitInfo;

// Init Debug
initDebug();

/* Fetch unit info only when needed */
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

// Script Initializer
function init(unitInfo) {
    var currentDateTime = getCurrentDateTime();

    // fix for no paladin worlds
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
		`;

    const windowContent = prepareWindowContent(content);
    attackPlannerWindow = window.open(
        '',
        '',
        'left=10px,top=10px,width=480,height=670,toolbar=0,resizable=0,location=0,menubar=0,scrollbars=0,status=0'
    );
    attackPlannerWindow.document.write(windowContent);
}

// Helper: Window Content
function prepareWindowContent(windowBody) {
    const windowHeader = `<h1 class="ra-fs18 ra-fw600">${scriptData.name}</h1>`;
    const windowFooter = `<small><strong>${scriptData.name} ${scriptData.version}</strong> - <a href="${scriptData.authorUrl}" target="_blank" rel="noreferrer noopener">${scriptData.author}</a> - <a href="${scriptData.helpLink}" target="_blank" rel="noreferrer noopener">Help</a></small>`;
    const windowStyle = `
		<style>
			body { background-color: #f4e4bc; font-family: Verdana, Arial, sans-serif; font-size: 14px; line-height: 1; }
			main { max-width: 768px; margin: 0 auto; }
			h1 { font-size: 27px; }
			a { font-weight: 700; text-decoration: none; color: #603000; }
			small { font-size: 10px; }
			input[type="text"],
			select { display: block; width: 100%; height: auto; line-height: 1; box-sizing: border-box; padding: 5px; outline: none; border: 1px solid #999; }
			input[type="text"]:focus { outline: none; box-shadow: none; border: 1px solid #603000; background-color: #eee; }
			label { font-weight: 600; display: block; margin-bottom: 5px; font-size: 12px; }
			textarea { width: 100%; height: 80px; box-sizing: border-box; padding: 5px; resize: none; }
			textarea:focus { box-shadow: none; outline: none; border: 1px solid #603000; background-color: #eee; }
			.ra-mb15 { margin-bottom: 15px; }
			.ra-flex { display: flex; flex-flow: row wrap; justify-content: space-between; }
			.ra-flex-6 { flex: 0 0 48%; }
			.ra-flex-4 { flex: 0 0 30%; }
			.button { padding: 10px 20px; background-color: #603000; font-weight: 500; color: #fff; text-align: center; display: inline-block; cursor: pointer; text-transform: uppercase; }
		</style>
	`;

    const html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${scriptData.name} ${scriptData.version}</title>
			${windowStyle}
		</head>
		<body>
			<main>
				${windowHeader}
				${windowBody}
				${windowFooter}
			</main>
			<script>
				function loadJS(url, callback) {
					var scriptTag = document.createElement('script');
					scriptTag.src = url;
					scriptTag.onload = callback;
					scriptTag.onreadystatechange = callback;
					document.body.appendChild(scriptTag);
				}

				loadJS('https://code.jquery.com/jquery-3.6.0.min.js', function() {
					loadJS('https://twscripts.dev/scripts/attackPlannerHelper.js', function() {
						console.log('Helper libraries loaded!');
					});
				});
			</script>
		</body>
		</html>
	`;

    return html;
}

// Helper: Get and format current datetime
function getCurrentDateTime() {
    let currentDateTime = new Date();

    var currentYear = currentDateTime.getFullYear();
    var currentMonth = currentDateTime.getMonth();
    var currentDate = '' + currentDateTime.getDate();
    var currentHours = '' + currentDateTime.getHours();
    var currentMinutes = '' + currentDateTime.getMinutes();
    var currentSeconds = '' + currentDateTime.getSeconds();

    currentMonth = currentMonth + 1;
    currentMonth = '' + currentMonth;
    currentMonth = currentMonth.padStart(2, '0');

    currentDate = currentDate.padStart(2, '0');
    currentHours = currentHours.padStart(2, '0');
    currentMinutes = currentMinutes.padStart(2, '0');
    currentSeconds = currentSeconds.padStart(2, '0');

    let formatted_date =
        currentYear +
        '-' +
        currentMonth +
        '-' +
        currentDate +
        ' ' +
        currentHours +
        ':' +
        currentMinutes +
        ':' +
        currentSeconds;

    return formatted_date;
}

/* Helper: Fetch World Unit Info */
function fetchUnitInfo() {
    jQuery
        .ajax({
            url: '/interface.php?func=get_unit_info',
        })
        .done(function (response) {
            unitInfo = xml2json($(response));
            localStorage.setItem(
                `${LS_PREFIX}_unit_info`,
                JSON.stringify(unitInfo)
            );
            localStorage.setItem(
                `${LS_PREFIX}_last_updated`,
                Date.parse(new Date())
            );
            init(unitInfo);
        });
}

// Helper: XML to JSON converter
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

// Helper: Generates script info
function scriptInfo() {
    return `[${scriptData.name} ${scriptData.version}]`;
}

// Helper: Prints universal debug information
function initDebug() {
    console.debug(`${scriptInfo()} It works ğŸš€!`);
    console.debug(`${scriptInfo()} HELP:`, scriptData.helpLink);
    if (DEBUG) {
        console.debug(`${scriptInfo()} Market:`, game_data.market);
        console.debug(`${scriptInfo()} World:`, game_data.world);
        console.debug(`${scriptInfo()} Screen:`, game_data.screen);
        console.debug(`${scriptInfo()} Game Version:`, game_data.majorVersion);
        console.debug(`${scriptInfo()} Game Build:`, game_data.version);
        console.debug(`${scriptInfo()} Locale:`, game_data.locale);
        console.debug(
            `${scriptInfo()} Premium:`,
            game_data.features.Premium.active
        );
    }
}


// ============================================================
// Mass Attack Planner – BBCode Export on "Get Plan!" (No Merge)
// This patch adds: (1) getBBCodePlans (unchanged), (2) Get Plan handler
// that builds plans per target using your inputs and prints BBCode
// into a Results textarea in the popup. It does not merge scripts.
// ============================================================

(function MassAttack_BBCode_Export_Patch(){
  // Fallback translator if not present
  if (typeof tt !== 'function') { window.tt = function(s){ return s; }; }

  // Wait until the popup window and unitInfo exist
  const readyTick = setInterval(()=>{
    try{
      if (window.attackPlannerWindow && window.attackPlannerWindow.document && window.unitInfo) {
        clearInterval(readyTick);
        attachHandler();
      }
    }catch(e){}
  }, 200);

  function attachHandler(){
    const doc = window.attackPlannerWindow.document;

    // Ensure Results area exists
    ensureResultsArea();

    // Try to find an existing Get Plan button/link; if not, create one
    let getBtn = doc.getElementById('getPlanBtn');
    if (!getBtn) {
      getBtn = Array.from(doc.querySelectorAll('button,a,input[type="button"],input[type="submit"]'))
        .find(el => /get\s*plan/i.test(el.textContent || el.value || ''));
    }
    if (!getBtn) {
      // Create a basic button without altering other UI
      const btn = doc.createElement('button');
      btn.id = 'getPlanBtn';
      btn.type = 'button';
      btn.textContent = 'Get Plan!';
      btn.style.margin = '6px 0';
      doc.body.appendChild(btn);
      getBtn = btn;
    }

    getBtn.addEventListener('click', async function(e){
      e.preventDefault();

      const d = doc; // alias

      // Read inputs (IDs are common; adapt if your UI differs)
      const arrivalTimeStr = (d.getElementById('arrivalTime')?.value || '').trim();
      const targetsText    = (d.getElementById('targetsCoords')?.value || '').trim();
      const noblesText     = (d.getElementById('noblesCoords')?.value || '').trim();
      const nukesText      = (d.getElementById('nukesCoords')?.value || '').trim();
      const supportText    = (d.getElementById('supportCoords')?.value || '').trim();

      const noblesPerTarget  = parseInt(d.getElementById('noblesPerTarget')?.value || '0') || 0;
      const nukesPerTarget   = parseInt(d.getElementById('nukesPerTarget')?.value  || '0') || 0;
      const supportPerTarget = parseInt(d.getElementById('supportPerTarget')?.value|| '0') || 0;

      // Slowest unit selects (fallback defaults)
      const nukeUnit    = (d.getElementById('slowestNukeUnit')?.value    || 'ram');
      const supportUnit = (d.getElementById('slowestSupportUnit')?.value || 'spear');

      if (!arrivalTimeStr) return alert('Arrival Time boş olamaz.');
      const arrivalTime = parseLandingTime(arrivalTimeStr);
      if (!(arrivalTime instanceof Date) || isNaN(arrivalTime)) return alert('Arrival Time formatı geçersiz. dd/mm/yyyy HH:mm:ss');

      const targets = parseCoords(targetsText);
      if (targets.length === 0) return alert('Targets Coords boş.');

      let nobles  = parseCoords(noblesText);
      let nukes   = parseCoords(nukesText);
      let support = parseCoords(supportText);

      // Map own villages (coords -> id) to build correct Send links
      const coordToId = await mapOwnVillageIdsByCoords();

      // Build BBCode per target
      let fullBB = '';
      for (const target of targets) {
        const plans = [];

        // Assign nukes
        for (let i=0;i<nukesPerTarget;i++) {
          const from = nukes.shift(); if (!from) break;
          plans.push(buildPlan(from, target, nukeUnit, arrivalTime, coordToId[from]));
        }
        // Assign nobles (snob)
        for (let i=0;i<noblesPerTarget;i++) {
          const from = nobles.shift(); if (!from) break;
          plans.push(buildPlan(from, target, 'snob', arrivalTime, coordToId[from]));
        }
        // Assign support
        for (let i=0;i<supportPerTarget;i++) {
          const from = support.shift(); if (!from) break;
          plans.push(buildPlan(from, target, supportUnit, arrivalTime, coordToId[from]));
        }

        // Sort by launch time ascending
        plans.sort((a,b)=>{
          const ad = parseDateTime(a.launchTimeFormatted); const bd = parseDateTime(b.launchTimeFormatted);
          return ad - bd;
        });

        fullBB += getBBCodePlans(plans, target) + '\n\n';
      }

      d.getElementById('resultsBBCode').value = fullBB.trim();
    });
  }

  function ensureResultsArea(){
    const d = window.attackPlannerWindow.document;
    if (!d.getElementById('resultsBBCode')){
      const fs = d.createElement('fieldset');
      fs.style.border = '1px solid #999';
      fs.style.padding = '8px';
      fs.innerHTML = '<legend>Results</legend>'+
        '<textarea id="resultsBBCode" style="width:100%;height:220px;"></textarea>';
      d.body.appendChild(fs);
    }
  }

  // === Utility functions ===
  function parseCoords(text){
    if (!text) return [];
    const arr = text.split(/[^0-9|]+/).filter(Boolean);
    const coords = arr.filter(x=>/^[0-9]{3}\|[0-9]{3}$/.test(x));
    return coords;
  }

  function parseLandingTime(str){
    // dd/mm/yyyy HH:mm:ss
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return NaN;
    const [_, dd, mm, yyyy, HH, MM, SS] = m;
    return new Date(`${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`);
  }
  function parseDateTime(str){
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return new Date(NaN);
    const [_, dd, mm, yyyy, HH, MM, SS] = m;
    return new Date(`${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`);
  }
  function formatDateTime(date){
    const dd = String(date.getDate()).padStart(2,'0');
    const mm = String(date.getMonth()+1).padStart(2,'0');
    const yyyy = date.getFullYear();
    const HH = String(date.getHours()).padStart(2,'0');
    const MM = String(date.getMinutes()).padStart(2,'0');
    const SS = String(date.getSeconds()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
  }
  function calculateDistance(a, b){
    if (!a || !b) return 0;
    const [x1,y1] = a.split('|').map(Number);
    const [x2,y2] = b.split('|').map(Number);
    const dx = Math.abs(x1 - x2); const dy = Math.abs(y1 - y2);
    return Math.sqrt(dx*dx + dy*dy);
  }
  function getLaunchTime(unit, landingDate, distance){
    const speed = Number(window.unitInfo?.config?.[unit]?.speed || 0); // minutes per tile
    const travelMs = distance * speed * 60 * 1000;
    const launchMs = Math.floor((landingDate.getTime() - travelMs)/1000)*1000; // snap to seconds
    return new Date(launchMs);
  }
  function buildPlan(fromCoord, targetCoord, unit, landingDate, villageId){
    const distance = calculateDistance(fromCoord, targetCoord);
    const launch = getLaunchTime(unit, landingDate, distance);
    return {
      unit: unit,
      highPrio: false,
      coords: fromCoord,
      villageId: villageId || '',
      launchTimeFormatted: formatDateTime(launch)
    };
  }

  async function mapOwnVillageIdsByCoords(){
    try{
      const html = await jQuery.get(game_data.link_base_pure + 'overview_villages&mode=combined&group=0');
      const htmlDoc = jQuery.parseHTML(html);
      const rows = jQuery(htmlDoc).find('#combined_table tr.nowrap');
      const map = {};
      rows.each(function(){
        const cell = jQuery(this).find('td:eq(1) span.quickedit-vn');
        const id = cell.attr('data-id');
        const text = cell.text();
        const coords = (text.match(/\d{3}\|\d{3}/) || [])[0];
        if (id && coords) map[coords] = parseInt(id,10);
      });
      return map;
    }catch(e){ return {}; }
  }

  // === Export function copied (unchanged) from Single Village Planner ===
  if (typeof getBBCodePlans !== 'function'){
    function getBBCodePlans(plans, destinationVillage) {
      const landingTime = jQuery('#raLandingTime').val()?.trim?.() || '';
      let bbCode = `[size=12][b]${tt('Plan for:')}[/b] ${destinationVillage}\n` +
                   `[b]${tt('Landing Time:')}[/b] ${landingTime}[/size]\n\n`;
      bbCode += `[table][**]${tt('Unit')}[\\]${tt('From')}[\\]${tt('Priority')}[\\]${tt('Launch Time')}[\\]${tt('Command')}[\\]${tt('Status')}[/**]\n`;
      plans.forEach((plan) => {
        const { unit, highPrio, coords, villageId, launchTimeFormatted } = plan;
        const [toX, toY] = destinationVillage.split('|');
        const priority = highPrio ? tt('Early send') : '';
        let rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
        let sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}` : '';
        let commandUrl = `/game.php?${sitterData}&village=${villageId}&screen=place${rallyPointData}`;
        bbCode += `[*][unit]${unit}[/unit][\\] ${coords} [\\][b][color=#ff0000]${priority}[/color][/b][\\]${launchTimeFormatted}[\\][url=${window.location.origin}${commandUrl}]${tt('Send')}[/url][\\]\n`;
      });
      bbCode += `[/table]`;
      return bbCode;
    }
  }
})();

/*
 * Script Name: Mass Attack Planner
 * Version: v1.1.8
 * Last Updated: 2023-07-24
 * Author: RedAlert
 * Author URL: https://twscripts.dev/
 * Author Contact: redalert_tw (Discord)
 * Approved: t14001534
 * Approved Date: 2020-06-05
 * Mod: JawJaw
 */

/*--------------------------------------------------------------------------------------
 * This script can NOT be cloned and modified without permission from the script author.
 --------------------------------------------------------------------------------------*/

var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.1.8',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink:
        'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/',
};

// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;

// Local Storage
var LS_PREFIX = `ra_massAttackPlanner_`;
var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30; /* fetch data every 30 days */
var LAST_UPDATED_TIME = localStorage.getItem(`${LS_PREFIX}_last_updated`) ?? 0;

var unitInfo;

// Init Debug
initDebug();

/* Fetch unit info only when needed */
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

// Script Initializer
function init(unitInfo) {
    var currentDateTime = getCurrentDateTime();

    // fix for no paladin worlds
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
		`;

    const windowContent = prepareWindowContent(content);
    attackPlannerWindow = window.open(
        '',
        '',
        'left=10px,top=10px,width=480,height=670,toolbar=0,resizable=0,location=0,menubar=0,scrollbars=0,status=0'
    );
    attackPlannerWindow.document.write(windowContent);
}

// Helper: Window Content
function prepareWindowContent(windowBody) {
    const windowHeader = `<h1 class="ra-fs18 ra-fw600">${scriptData.name}</h1>`;
    const windowFooter = `<small><strong>${scriptData.name} ${scriptData.version}</strong> - <a href="${scriptData.authorUrl}" target="_blank" rel="noreferrer noopener">${scriptData.author}</a> - <a href="${scriptData.helpLink}" target="_blank" rel="noreferrer noopener">Help</a></small>`;
    const windowStyle = `
		<style>
			body { background-color: #f4e4bc; font-family: Verdana, Arial, sans-serif; font-size: 14px; line-height: 1; }
			main { max-width: 768px; margin: 0 auto; }
			h1 { font-size: 27px; }
			a { font-weight: 700; text-decoration: none; color: #603000; }
			small { font-size: 10px; }
			input[type="text"],
			select { display: block; width: 100%; height: auto; line-height: 1; box-sizing: border-box; padding: 5px; outline: none; border: 1px solid #999; }
			input[type="text"]:focus { outline: none; box-shadow: none; border: 1px solid #603000; background-color: #eee; }
			label { font-weight: 600; display: block; margin-bottom: 5px; font-size: 12px; }
			textarea { width: 100%; height: 80px; box-sizing: border-box; padding: 5px; resize: none; }
			textarea:focus { box-shadow: none; outline: none; border: 1px solid #603000; background-color: #eee; }
			.ra-mb15 { margin-bottom: 15px; }
			.ra-flex { display: flex; flex-flow: row wrap; justify-content: space-between; }
			.ra-flex-6 { flex: 0 0 48%; }
			.ra-flex-4 { flex: 0 0 30%; }
			.button { padding: 10px 20px; background-color: #603000; font-weight: 500; color: #fff; text-align: center; display: inline-block; cursor: pointer; text-transform: uppercase; }
		</style>
	`;

    const html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${scriptData.name} ${scriptData.version}</title>
			${windowStyle}
		</head>
		<body>
			<main>
				${windowHeader}
				${windowBody}
				${windowFooter}
			</main>
			<script>
				function loadJS(url, callback) {
					var scriptTag = document.createElement('script');
					scriptTag.src = url;
					scriptTag.onload = callback;
					scriptTag.onreadystatechange = callback;
					document.body.appendChild(scriptTag);
				}

				loadJS('https://code.jquery.com/jquery-3.6.0.min.js', function() {
					loadJS('https://twscripts.dev/scripts/attackPlannerHelper.js', function() {
						console.log('Helper libraries loaded!');
					});
				});
			</script>
		</body>
		</html>
	`;

    return html;
}

// Helper: Get and format current datetime
function getCurrentDateTime() {
    let currentDateTime = new Date();

    var currentYear = currentDateTime.getFullYear();
    var currentMonth = currentDateTime.getMonth();
    var currentDate = '' + currentDateTime.getDate();
    var currentHours = '' + currentDateTime.getHours();
    var currentMinutes = '' + currentDateTime.getMinutes();
    var currentSeconds = '' + currentDateTime.getSeconds();

    currentMonth = currentMonth + 1;
    currentMonth = '' + currentMonth;
    currentMonth = currentMonth.padStart(2, '0');

    currentDate = currentDate.padStart(2, '0');
    currentHours = currentHours.padStart(2, '0');
    currentMinutes = currentMinutes.padStart(2, '0');
    currentSeconds = currentSeconds.padStart(2, '0');

    let formatted_date =
        currentYear +
        '-' +
        currentMonth +
        '-' +
        currentDate +
        ' ' +
        currentHours +
        ':' +
        currentMinutes +
        ':' +
        currentSeconds;

    return formatted_date;
}

/* Helper: Fetch World Unit Info */
function fetchUnitInfo() {
    jQuery
        .ajax({
            url: '/interface.php?func=get_unit_info',
        })
        .done(function (response) {
            unitInfo = xml2json($(response));
            localStorage.setItem(
                `${LS_PREFIX}_unit_info`,
                JSON.stringify(unitInfo)
            );
            localStorage.setItem(
                `${LS_PREFIX}_last_updated`,
                Date.parse(new Date())
            );
            init(unitInfo);
        });
}

// Helper: XML to JSON converter
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

// Helper: Generates script info
function scriptInfo() {
    return `[${scriptData.name} ${scriptData.version}]`;
}

// Helper: Prints universal debug information
function initDebug() {
    console.debug(`${scriptInfo()} It works ğŸš€!`);
    console.debug(`${scriptInfo()} HELP:`, scriptData.helpLink);
    if (DEBUG) {
        console.debug(`${scriptInfo()} Market:`, game_data.market);
        console.debug(`${scriptInfo()} World:`, game_data.world);
        console.debug(`${scriptInfo()} Screen:`, game_data.screen);
        console.debug(`${scriptInfo()} Game Version:`, game_data.majorVersion);
        console.debug(`${scriptInfo()} Game Build:`, game_data.version);
        console.debug(`${scriptInfo()} Locale:`, game_data.locale);
        console.debug(
            `${scriptInfo()} Premium:`,
            game_data.features.Premium.active
        );
    }
}


// ============================================================
// Mass Attack Planner – BBCode Export + Send Link (No Merge)
// v2: fixes origin + landing time + ensures inputs if absent
// ============================================================
(function MassAttack_BBCode_Export_Patch_v2(){
  // Provide base origin from parent page (game tab)
  window.__TW_BASE_ORIGIN__ = window.location.origin;
  if (typeof tt !== 'function') { window.tt = function(s){ return s; }; }

  // Ensure parent has hidden #raLandingTime so getBBCodePlans can read it
  (function ensureParentLanding(){
    if (!document.getElementById('raLandingTime')){
      var inp = document.createElement('input');
      inp.type = 'hidden';
      inp.id = 'raLandingTime';
      document.body.appendChild(inp);
    }
  })();

  const ready = setInterval(()=>{
    try{
      if (window.attackPlannerWindow && window.attackPlannerWindow.document && window.unitInfo){
        clearInterval(ready);
        hookGetPlan();
      }
    }catch(e){}
  },200);

  function hookGetPlan(){
    const doc = window.attackPlannerWindow.document;

    // Ensure minimal inputs exist if the original UI hasn't created them
    ensureInput(doc, 'arrivalTime', 'Arrival Time (dd/mm/yyyy HH:mm:ss)', '06/09/2025 20:15:00');
    ensureInput(doc, 'targetsCoords', 'Targets Coords (one per line)', '500|500\n501|500');
    ensureInput(doc, 'nukesCoords', 'Nukes Coords', '510|510\n511|510');
    ensureInput(doc, 'noblesCoords', 'Nobles Coords', '520|520');
    ensureInput(doc, 'supportCoords', 'Support Coords', '530|530');
    ensureInput(doc, 'nukesPerTarget', 'Nukes per Target', '1');
    ensureInput(doc, 'noblesPerTarget', 'Nobles per Target', '1');
    ensureInput(doc, 'supportPerTarget', 'Support per Target', '0');
    ensureSelect(doc, 'slowestNukeUnit', 'Slowest Nuke unit', ['axe','light','marcher','ram','catapult','snob']);
    ensureSelect(doc, 'slowestSupportUnit', 'Slowest Support unit', ['spear','archer','sword','spy','knight','heavy','catapult']);

    ensureResultsArea(doc);

    let getBtn = doc.getElementById('getPlanBtn');
    if (!getBtn) {
      getBtn = doc.createElement('button');
      getBtn.id = 'getPlanBtn';
      getBtn.type = 'button';
      getBtn.textContent = 'Get Plan!';
      getBtn.style.margin = '6px 0';
      doc.body.appendChild(getBtn);
    }

    getBtn.addEventListener('click', async function(e){
      e.preventDefault();
      const d = doc;

      const arrivalTimeStr = (d.getElementById('arrivalTime')?.value || '').trim();
      if (!arrivalTimeStr) return alert('Arrival Time boş olamaz.');
      const arrivalDate = parseLandingTime(arrivalTimeStr);
      if (!(arrivalDate instanceof Date) || isNaN(arrivalDate)) return alert('Arrival Time formatı dd/mm/yyyy HH:mm:ss olmalı');

      // sync to parent hidden input for getBBCodePlans
      const parentLanding = document.getElementById('raLandingTime');
      if (parentLanding) parentLanding.value = arrivalTimeStr;

      const targets  = parseCoords((d.getElementById('targetsCoords')?.value || ''));
      let nukesArr   = parseCoords((d.getElementById('nukesCoords')?.value  || ''));
      let noblesArr  = parseCoords((d.getElementById('noblesCoords')?.value || ''));
      let supportArr = parseCoords((d.getElementById('supportCoords')?.value|| ''));

      const nukesPerTarget   = toInt(d.getElementById('nukesPerTarget')?.value,1);
      const noblesPerTarget  = toInt(d.getElementById('noblesPerTarget')?.value,1);
      const supportPerTarget = toInt(d.getElementById('supportPerTarget')?.value,0);

      const nukeUnit    = d.getElementById('slowestNukeUnit')?.value || 'ram';
      const supportUnit = d.getElementById('slowestSupportUnit')?.value || 'spear';

      if (!targets.length) return alert('Targets Coords boş.');

      const coordToId = await mapOwnVillageIdsByCoords();

      let out = '';
      for (const target of targets){
        const plans = [];
        // Nukes
        for (let i=0;i<nukesPerTarget;i++){ const from = nukesArr.shift(); if (!from) break; plans.push(buildPlan(from,target,nukeUnit,arrivalDate,coordToId[from])); }
        // Nobles
        for (let i=0;i<noblesPerTarget;i++){ const from = noblesArr.shift(); if (!from) break; plans.push(buildPlan(from,target,'snob',arrivalDate,coordToId[from])); }
        // Support
        for (let i=0;i<supportPerTarget;i++){ const from = supportArr.shift(); if (!from) break; plans.push(buildPlan(from,target,supportUnit,arrivalDate,coordToId[from])); }
        // Sort by launch time
        plans.sort((a,b)=> parseDT(a.launchTimeFormatted) - parseDT(b.launchTimeFormatted));
        out += getBBCodePlans(plans, target) + '\n\n';
      }

      d.getElementById('resultsBBCode').value = out.trim();
    });
  }

  function ensureInput(doc, id, label, placeholder){
    if (doc.getElementById(id)) return;
    const wrap = doc.createElement('div');
    wrap.style.margin = '6px 0';
    const lbl = doc.createElement('label');
    lbl.htmlFor = id; lbl.textContent = label;
    const el = /per\s*target/i.test(label) ? doc.createElement('input') : doc.createElement('textarea');
    el.id = id; el.style.width = '100%';
    if (el.tagName === 'TEXTAREA') el.style.height = '64px';
    if (placeholder) el.placeholder = placeholder;
    wrap.appendChild(lbl); wrap.appendChild(el); doc.body.appendChild(wrap);
  }
  function ensureSelect(doc, id, label, options){
    if (doc.getElementById(id)) return;
    const wrap = doc.createElement('div'); wrap.style.margin = '6px 0';
    const lbl = doc.createElement('label'); lbl.htmlFor = id; lbl.textContent = label; wrap.appendChild(lbl);
    const sel = doc.createElement('select'); sel.id = id; sel.style.width='100%';
    options.forEach(opt=>{ const o=doc.createElement('option'); o.value=opt; o.textContent=opt; sel.appendChild(o); });
    wrap.appendChild(sel); doc.body.appendChild(wrap);
  }
  function ensureResultsArea(doc){
    if (doc.getElementById('resultsBBCode')) return;
    const fs = doc.createElement('fieldset'); fs.style.border='1px solid #999'; fs.style.padding='8px';
    fs.innerHTML = '<legend>Results</legend>'+
      '<textarea id="resultsBBCode" style="width:100%;height:220px;"></textarea>';
    doc.body.appendChild(fs);
  }

  function parseCoords(text){
    const arr = (text||'').split(/[^0-9|]+/).filter(Boolean);
    return arr.filter(x=>/^\d{3}\|\d{3}$/.test(x));
  }
  function toInt(v,def){ const n=parseInt(v,10); return isNaN(n)?def:n; }
  function parseLandingTime(s){ const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/); if(!m) return NaN; const[_,dd,mm,yy,HH,MM,SS]=m; return new Date(`${yy}-${mm}-${dd} ${HH}:${MM}:${SS}`); }
  function parseDT(s){ const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/); if(!m) return new Date(NaN); const[_,dd,mm,yy,HH,MM,SS]=m; return new Date(`${yy}-${mm}-${dd} ${HH}:${MM}:${SS}`); }
  function fmt(date){ const dd=String(date.getDate()).padStart(2,'0'); const mm=String(date.getMonth()+1).padStart(2,'0'); const yy=date.getFullYear(); const HH=String(date.getHours()).padStart(2,'0'); const MM=String(date.getMinutes()).padStart(2,'0'); const SS=String(date.getSeconds()).padStart(2,'0'); return `${dd}/${mm}/${yy} ${HH}:${MM}:${SS}`; }
  function dist(a,b){ const [x1,y1]=a.split('|').map(Number); const[x2,y2]=b.split('|').map(Number); const dx=x1-x2, dy=y1-y2; return Math.sqrt(dx*dx+dy*dy); }
  function launchTime(unit, landingDate, distance){ const speed = Number(window.unitInfo?.config?.[unit]?.speed||0); const ms = distance*speed*60*1000; const t=Math.floor((landingDate.getTime()-ms)/1000)*1000; return new Date(t); }
  function buildPlan(fromCoord, targetCoord, unit, landingDate, villageId){ const d=dist(fromCoord,targetCoord); const l=launchTime(unit,landingDate,d); return { unit, highPrio:false, coords:fromCoord, villageId:(villageId||''), launchTimeFormatted: fmt(l) }; }
  async function mapOwnVillageIdsByCoords(){ try{ const html = await jQuery.get(game_data.link_base_pure+'overview_villages&mode=combined&group=0'); const htmlDoc=jQuery.parseHTML(html); const rows=jQuery(htmlDoc).find('#combined_table tr.nowrap'); const map={}; rows.each(function(){ const cell=jQuery(this).find('td:eq(1) span.quickedit-vn'); const id=cell.attr('data-id'); const coords=(cell.text().match(/\d{3}\|\d{3}/)||[])[0]; if(id&&coords) map[coords]=parseInt(id,10); }); return map; }catch(e){ return {}; } }

  // --- getBBCodePlans (adjusted ONLY for origin fallback) ---
  if (typeof getBBCodePlans !== 'function'){
    function getBBCodePlans(plans, destinationVillage) {
      const landingTime = jQuery('#raLandingTime').val()?.trim?.() || '';
      let bbCode = `[size=12][b]${tt('Plan for:')}[/b] ${destinationVillage}\n` +
                   `[b]${tt('Landing Time:')}[/b] ${landingTime}[/size]\n\n`;
      bbCode += `[table][**]${tt('Unit')}[\\]${tt('From')}[\\]${tt('Priority')}[\\]${tt('Launch Time')}[\\]${tt('Command')}[\\]${tt('Status')}[/**]\n`;
      const origin = (window.__TW_BASE_ORIGIN__ || (window.opener&&window.opener.location&&window.opener.location.origin) || window.location.origin || '').replace(/\/$/,'');
      plans.forEach((plan) => {
        const { unit, highPrio, coords, villageId, launchTimeFormatted } = plan;
        const [toX, toY] = (destinationVillage||'').split('|');
        const priority = highPrio ? tt('Early send') : '';
        let rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
        let sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}` : '';
        let commandUrl = `/game.php?${sitterData}&village=${villageId||''}&screen=place${rallyPointData}`;
        bbCode += `[*][unit]${unit}[/unit][\\] ${coords} [\\][b][color=#ff0000]${priority}[/color][/b][\\]${launchTimeFormatted}[\\][url=${origin}${commandUrl}]${tt('Send')}[/url][\\]\n`;
      });
      bbCode += `[/table]`;
      return bbCode;
    }
  }
})();

