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
 *
 * This script can NOT be cloned and modified without permission from the script author.
 */

/* global game_data, jQuery, $ */

// ========================= Script Meta =========================
var scriptData = {
  name: 'Mass Attack Planner',
  version: 'v1.1.8',
  author: 'RedAlert',
  authorUrl: 'https://twscripts.dev/',
  helpLink: 'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/',
};

// ========================= User Input =========================
if (typeof DEBUG !== 'boolean') DEBUG = false;

// ========================= Local Storage =========================
var LS_PREFIX = `ra_massAttackPlanner_`;
var TIME_INTERVAL = 60 * 60 * 1000 * 24 * 30; /* fetch data every 30 days */
var LAST_UPDATED_TIME = localStorage.getItem(`${LS_PREFIX}_last_updated`) ?? 0;

// ========================= Globals =========================
var unitInfo;
var attackPlannerWindow; // açılan pencere referansı

// --------- BBCode entegrasyonu ---------
let bbCode = '';
const ttx = (window.tt && typeof window.tt === 'function') ? window.tt : (s) => s;

/**
 * BBCode satırı ekler ve pencere içindeki Results alanını günceller
 * @param {Object} p
 * @param {string} p.unit  - örn: 'ram', 'axe', 'light', 'heavy', 'catapult', ...
 * @param {string} p.coords - örn: '500|500'
 * @param {string} p.priority - örn: 'Yüksek' | 'Orta' | 'Düşük'
 * @param {string} p.launchTimeFormatted - 'YYYY-MM-DD HH:mm:ss'
 * @param {string} p.commandUrl - örn: '/game.php?village=123&screen=place&target=456'
 */
function appendBBCodeRow({ unit, coords, priority, launchTimeFormatted, commandUrl }) {
  bbCode += `[*][unit]${unit}[/unit][|] ${coords} [|][b][color=#ff0000]${priority}[/color][/b][|]${launchTimeFormatted}[|][url=${window.location.origin}${commandUrl}]${ttx('Send')}[/url][|]\n`;
  const $area = attackPlannerWindow?.document?.getElementById('resultsArea');
  if ($area) $area.value = bbCode;
}

/** BBCode çıktısını temizler */
function resetBBCode() {
  bbCode = '';
  const $area = attackPlannerWindow?.document?.getElementById('resultsArea');
  if ($area) $area.value = '';
}
// --------------------------------------

// ========================= Init & Boot =========================
initDebug();
/* Fetch unit info only when needed */
(function () {
  if (LAST_UPDATED_TIME !== null) {
    if (Date.parse(new Date()) >= LAST_UPDATED_TIME + TIME_INTERVAL) {
      fetchUnitInfo();
    } else {
      unitInfo = JSON.parse(localStorage.getItem(`${LS_PREFIX}_unit_info`));
      init(unitInfo);
    }
  } else {
    fetchUnitInfo();
  }
})();

// ========================= Initializer =========================
function init(unitInfo) {
  var currentDateTime = getCurrentDateTime();

  // fix for no paladin worlds
  let knightSpeed = 0;
  const worldUnits = (game_data && game_data.units) || [];
  if (worldUnits.includes('knight')) {
    knightSpeed = unitInfo?.config?.['knight']?.speed || 0;
  } else {
    try {
      jQuery('#support_unit option[data-option-unit="knight"]').attr('disabled', true);
    } catch (e) {}
  }

  // ---- Pencere içeriği ----
  const content = `
    <div class="ra-wrap">
      <div class="ra-section">
        <h3>Arrival Time</h3>
        <input type="text" id="arrivalTime" placeholder="${currentDateTime}" style="width:100%;" />
      </div>

      <div class="ra-section">
        <h3>Slowest Nuke unit</h3>
        <div class="ra-grid">
          <label><input type="radio" name="nuke_slowest" value="axe" /> Axe</label>
          <label><input type="radio" name="nuke_slowest" value="light" /> LC</label>
          <label><input type="radio" name="nuke_slowest" value="marcher" /> MA</label>
          <label><input type="radio" name="nuke_slowest" value="knight" ${worldUnits.includes('knight') ? '' : 'disabled'} /> Paladin</label>
          <label><input type="radio" name="nuke_slowest" value="heavy" /> HC</label>
          <label><input type="radio" name="nuke_slowest" value="ram" /> Ram</label>
          <label><input type="radio" name="nuke_slowest" value="catapult" /> Cat</label>
        </div>
      </div>

      <div class="ra-section">
        <h3>Slowest Support unit</h3>
        <div class="ra-grid">
          <label><input type="radio" name="sup_slowest" value="spear" /> Spear</label>
          <label><input type="radio" name="sup_slowest" value="archer" ${worldUnits.includes('archer') ? '' : 'disabled'} /> Archer</label>
          <label><input type="radio" name="sup_slowest" value="sword" /> Sword</label>
          <label><input type="radio" name="sup_slowest" value="spy" /> Spy</label>
          <label><input type="radio" name="sup_slowest" value="knight" ${worldUnits.includes('knight') ? '' : 'disabled'} /> Paladin</label>
          <label><input type="radio" name="sup_slowest" value="heavy" /> HC</label>
          <label><input type="radio" name="sup_slowest" value="catapult" /> Cat</label>
        </div>
      </div>

      <div class="ra-section">
        <h3>Targets Coords</h3>
        <textarea id="targets" placeholder="xxx|yyy, bir satıra bir hedef" style="width:100%;height:70px;"></textarea>
      </div>

      <div class="ra-section">
        <h3>Nobles Coords</h3>
        <textarea id="nobles" placeholder="xxx|yyy, noblar" style="width:100%;height:70px;"></textarea>
        <label style="display:block;margin-top:4px;">Nobles per Target: <input type="number" id="noblesPerTarget" min="0" value="1" style="width:60px;"></label>
      </div>

      <div class="ra-section">
        <h3>Nukes Coords</h3>
        <textarea id="nukes" placeholder="xxx|yyy, nuke köyleri" style="width:100%;height:70px;"></textarea>
        <label style="display:block;margin-top:4px;">Nukes per Target: <input type="number" id="nukesPerTarget" min="0" value="1" style="width:60px;"></label>
      </div>

      <div class="ra-section">
        <h3>Support Coords</h3>
        <textarea id="supports" placeholder="xxx|yyy, destek köyleri" style="width:100%;height:70px;"></textarea>
        <label style="display:block;margin-top:4px;">Support per Target: <input type="number" id="supportsPerTarget" min="0" value="0" style="width:60px;"></label>
      </div>

      <div class="ra-actions">
        <a id="btnGetPlan" href="javascript:void(0);" class="btn-getplan">Get Plan!</a>
      </div>

      <div class="ra-section">
        <h3>Results</h3>
        <textarea id="resultsArea" style="width: 100%; height: 160px; resize: vertical;" readonly></textarea>
        <div style="margin-top:6px; display:flex; gap:6px;">
          <button id="btnCopy">Copy</button>
          <button id="btnReset">Clear</button>
        </div>
      </div>
    </div>
  `;

  const windowContent = prepareWindowContent(content);

  attackPlannerWindow = window.open(
    '',
    '',
    'left=10px,top=10px,width=520,height=760,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0'
  );
  attackPlannerWindow.document.write(windowContent);

  // ---- Buton eventleri ----
  const doc = attackPlannerWindow.document;

  // Plan oluşturma butonu: burada kendi planlama mantığını tetikle
  doc.getElementById('btnGetPlan')?.addEventListener('click', () => {
    // TEST AMAÇLI: Örnek satır ekleme (çalıştığını görmek için yorumdan çıkar)
    // appendBBCodeRow({
    //   unit: 'ram',
    //   coords: '500|500',
    //   priority: 'Yüksek',
    //   launchTimeFormatted: getCurrentDateTime(),
    //   commandUrl: '/game.php?village=123&screen=place&target=456'
    // });
  });

  // Kopyalama
  doc.getElementById('btnCopy')?.addEventListener('click', () => {
    const area = doc.getElementById('resultsArea');
    if (!area) return;
    area.focus();
    area.select();
    const apiclip = attackPlannerWindow.navigator.clipboard;
    if (apiclip && apiclip.writeText) {
      apiclip.writeText(area.value).catch(() => {
        try { attackPlannerWindow.document.execCommand('copy'); } catch (e) {}
      });
    } else {
      try { attackPlannerWindow.document.execCommand('copy'); } catch (e) {}
    }
  });

  // Temizleme
  doc.getElementById('btnReset')?.addEventListener('click', resetBBCode);
}

// ========================= Window Templating =========================
function prepareWindowContent(windowBody) {
  const windowHeader = `
    <div class="ra-header">
      <h2 style="margin:0;">${scriptData.name}</h2>
    </div>
  `;

  const windowFooter = `
    <div class="ra-footer">
      ${scriptData.name} ${scriptData.version} - 
      <a href="${scriptData.authorUrl}" target="_blank" rel="noopener noreferrer">${scriptData.author}</a> - 
      <a href="${scriptData.helpLink}" target="_blank" rel="noopener noreferrer">Help</a>
    </div>
  `;

  const windowStyle = `
    <style>
      body { font-family: Verdana, Arial, sans-serif; font-size: 12px; padding: 8px; }
      .ra-header, .ra-footer { padding: 6px 0; }
      .ra-wrap { display: block; }
      .ra-section { margin-bottom: 10px; }
      .ra-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px 8px; }
      .ra-actions { margin: 12px 0; }
      .btn-getplan { display:inline-block; padding:6px 10px; background:#6c9; color:#000; text-decoration:none; border:1px solid #397; border-radius:3px; }
      textarea, input[type="text"], input[type="number"] { box-sizing: border-box; }
      button { padding: 4px 8px; }
      a, button { cursor: pointer; }
    </style>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${scriptData.name} ${scriptData.version}</title>
        ${windowStyle}
      </head>
      <body>
        ${windowHeader}
        ${windowBody}
        ${windowFooter}
      </body>
    </html>
  `;
  return html;
}

// ========================= Helpers =========================
function getCurrentDateTime() {
  let currentDateTime = new Date();
  var currentYear = currentDateTime.getFullYear();
  var currentMonth = currentDateTime.getMonth() + 1;
  var currentDate = '' + currentDateTime.getDate();
  var currentHours = '' + currentDateTime.getHours();
  var currentMinutes = '' + currentDateTime.getMinutes();
  var currentSeconds = '' + currentDateTime.getSeconds();

  currentMonth = ('' + currentMonth).padStart(2, '0');
  currentDate = currentDate.padStart(2, '0');
  currentHours = currentHours.padStart(2, '0');
  currentMinutes = currentMinutes.padStart(2, '0');
  currentSeconds = currentSeconds.padStart(2, '0');

  let formatted_date =
    currentYear + '-' + currentMonth + '-' + currentDate + ' ' + currentHours + ':' + currentMinutes + ':' + currentSeconds;
  return formatted_date;
}

/* Fetch World Unit Info */
function fetchUnitInfo() {
  jQuery
    .ajax({ url: '/interface.php?func=get_unit_info' })
    .done(function (response) {
      unitInfo = xml2json($(response));
      localStorage.setItem(`${LS_PREFIX}_unit_info`, JSON.stringify(unitInfo));
      localStorage.setItem(`${LS_PREFIX}_last_updated`, Date.parse(new Date()));
      init(unitInfo);
    });
}

// XML to JSON converter
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

// Script info (console)
function scriptInfo() {
  return `[${scriptData.name} ${scriptData.version}]`;
}

// Debug
function initDebug() {
  try {
    console.debug(`${scriptInfo()} It works!`);
    console.debug(`${scriptInfo()} HELP:`, scriptData.helpLink);
    if (DEBUG) {
      console.debug(`${scriptInfo()} Market:`, game_data.market);
      console.debug(`${scriptInfo()} World:`, game_data.world);
      console.debug(`${scriptInfo()} Screen:`, game_data.screen);
      console.debug(`${scriptInfo()} Game Version:`, game_data.majorVersion);
      console.debug(`${scriptInfo()} Game Build:`, game_data.version);
      console.debug(`${scriptInfo()} Locale:`, game_data.locale);
      console.debug(`${scriptInfo()} Premium:`, game_data.features?.Premium?.active);
    }
  } catch (e) {}
}
