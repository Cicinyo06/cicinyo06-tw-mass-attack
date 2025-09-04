/* * Script Name: Mass Attack Planner * Version: v1.1.8 * Last Updated: 2023-07-24 * Author: RedAlert * Author URL: https://twscripts.dev/ * Author Contact: redalert_tw (Discord) * Approved: t14001534 * Approved Date: 2020-06-05 * Mod: JawJaw */
/*----------------------------------------------------------------------------------------------
 * This script can NOT be cloned and modified without permission from the script author.
 *----------------------------------------------------------------------------------------------*/

var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.1.8',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink: 'https://forum.tribalwars.net/index.php?threads/mass-attack-planner.285331/',
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
            unitInfo = JSON.parse(localStorage.getItem(`${LS_PREFIX}_unit_info`));
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
        jQuery('#support_unit option[data-option-unit="knight"]').attr('disabled');
    }

    const content = `
<div style="padding:8px;">
  <div style="margin-bottom:8px;">
    <label><b>Arrival Time</b></label>
    <!-- (Buradaki giriş alanları orijinal betiğinizde nasılsa öyle kalıyor) -->
  </div>

  <div style="margin-bottom:8px;">
    <label><b>Slowest Nuke unit</b></label> Axe LC/MA/Paladin HC Ram/Cat
  </div>

  <div style="margin-bottom:8px;">
    <label><b>Slowest Support unit</b></label> Spear/Archer Sword Spy Paladin HC Cat
  </div>

  <div style="margin-bottom:8px;">
    <label><b>Targets Coords</b></label>
  </div>

  <div style="margin-bottom:8px;">
    <label><b>Nobles Coords</b></label>
  </div>

  <div style="margin-bottom:8px;">
    <label><b>Nobles per Target</b></label>
  </div>

  <div style="margin-bottom:8px;">
    <label><b>Nukes Coords</b></label>
  </div>

  <div style="margin-bottom:8px;">
    <label><b>Nukes per Target</b></label>
  </div>

  <div style="margin-bottom:8px;">
    <label><b>Support Coords</b></label>
  </div>

  <div style="margin-bottom:8px;">
    <label><b>Support per Target</b></label>
  </div>

  <div style="margin:10px 0;">
    <a href="javascript:void(0)" id="raMassGetPlan" class="btn">Get Plan!</a>
  </div>

  <div style="margin-top:10px;">
    <h3>Results</h3>
    <div id="raMassResults"></div>
  </div>
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
    const windowHeader = `
        <h2 style="margin:0 0 8px 0;">${scriptData.name}</h2>
    `;
    const windowFooter = `${scriptData.name} ${scriptData.version} - ${scriptData.author} - Help`;
    const windowStyle = `
        <style>
            body{font-family: Arial, sans-serif; font-size: 14px;}
            .btn{display:inline-block;padding:4px 6px;background:#6c3;color:#fff;border-radius:2px;text-decoration:none}
            .btn:hover{opacity:.9}
            textarea,input,select{font-size:13px;}
            #raMassResults textarea { width:100%; height:140px; }
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
<br/>
<small>${windowFooter}</small>

<script>
// (Bu pencere içinde jQuery, game_data vb. zaten ana sayfadan geliyor varsayımıyla kullanılır)
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
    console.debug(`${scriptInfo()} It works ịš€!`);
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

/* =============================================================================
   >>> EKLENEN KISIM: BB kodunda "Send" linki üretimi (atak planer.txt'den uyarlanmıştır)
   - Bu kısım "Send" düğmesi bağlantısını üretmek için tek başına kullanılabilir.
   - Mevcut plan üretiminizde, oluşturduğunuz plan dizisini bu fonksiyonlara vererek
     BB kodu çıktısına "Send" linklerini ekleyebilirsiniz.

   Plan nesnesi beklenen alanlar:
   {
     unit: 'axe' | 'light' | ...,
     highPrio: boolean,
     coords: '500|500',
     villageId: 123456,
     launchTimeFormatted: '01/09/2025 12:34:56'
   }

   Kullanım (örnek):
   const bb = getBBCodePlans(plans, '500|500', '01/09/2025 12:34:56');
   const code = getCodePlans(plans, '500|500', '01/09/2025 12:34:56');
   ============================================================================= */

// Tek bir köy için komut ekranına giden URL’yi üretir (sitter ve market farklarını dikkate alır)
function createSendUrl(villageId, destinationVillage) {
    const parts = String(destinationVillage).split('|');
    const toX = (parts[0] || '').trim();
    const toY = (parts[1] || '').trim();

    // UK markette x/y parametresi gönderilmiyor (atak planer mantığına uygun).
    const rallyPointData = game_data.market !== 'uk' ? `&x=${toX}&y=${toY}` : '';
    // Sitter modundaysa t=playerId eklenir.
    const sitterData = game_data.player.sitter > 0 ? `t=${game_data.player.id}&` : '';

    // Tam URL
    return `${window.location.origin}/game.php?${sitterData}village=${villageId}&screen=place${rallyPointData}`;
}

// BB Kodlu çıktı (tablolu) – her satıra "Send" linki eklenir
function getBBCodePlans(plans, destinationVillage, landingTimeString) {
    let bbCode =
        `[size=12][b]Plan for:[/b] ${destinationVillage}\n` +
        `[b]Landing Time:[/b] ${landingTimeString}[/size]\n\n`;

    // Başlık satırı (Single Village Planner’daki düzen ile uyumlu)
    bbCode += `[table][**]Unit[\\][\\]From[\\][\\]Priority[\\][\\]Launch Time[\\][\\]Command[\\][\\]Status[/**]\n`;

    plans.forEach((plan) => {
        const { unit, highPrio, coords, villageId, launchTimeFormatted } = plan;
        const priority = highPrio ? 'Early send' : '';
        const sendUrl = createSendUrl(villageId, destinationVillage);

        // Not: Status alanı sizin kullanımınıza göre boş bırakıldı
        bbCode += `[*][unit]${unit}[/unit][\\] ${coords} [\\][b][color=#ff0000]${priority}[/color][/b][\\]${launchTimeFormatted}[\\][url=${sendUrl}]Send[/url][\\]\n`;
    });

    bbCode += `[/table]`;
    return bbCode;
}

// BB Kodsuz sade çıktı – her satıra "Send" linki eklenir
function getCodePlans(plans, destinationVillage, landingTimeString) {
    let planCode =
        `[size=12][b]Plan for:[/b] ${destinationVillage}\n` +
        `[b]Landing Time:[/b] ${landingTimeString}[/size]\n\n`;

    plans.forEach((plan) => {
        const { unit, highPrio, coords, villageId, launchTimeFormatted } = plan;
        const priority = highPrio ? 'Early send' : '';
        const sendUrl = createSendUrl(villageId, destinationVillage);

        planCode += `[unit]${unit}[/unit] ${coords} [b][color=#ff0000]${priority}[/color][/b]${launchTimeFormatted}[url=${sendUrl}]Send[/url]\n`;
    });

    return planCode;
}

/* -----------------------------------------------------------------------------
   (İsteğe bağlı) Yardımcılar – plan süre hesabı gibi senaryolarda işinize yarayabilir.
   Mevcut akışınızı bozmamak için ayrı fonksiyonlar halinde bırakıldı.
----------------------------------------------------------------------------- */

// Hedefe varış zamanı (Date objesi) ve mesafeye göre kalkış zamanını hesaplar
function getLaunchTime(unit, landingTimeMs, distance) {
    const msPerSec = 1000;
    const secsPerMin = 60;
    const msPerMin = msPerSec * secsPerMin;
    const unitSpeed = unitInfo?.config?.[unit]?.speed || 0; // dakika/alan
    const unitTime = distance * unitSpeed * msPerMin;

    const launchTime = new Date();
    launchTime.setTime(Math.round((landingTimeMs - unitTime) / msPerSec) * msPerSec);
    return launchTime.getTime();
}

// İki köy arasındaki Öklid mesafe
function calculateDistance(villageA, villageB) {
    const [x1, y1] = String(villageA).split('|').map((n) => parseInt(n.trim(), 10));
    const [x2, y2] = String(villageB).split('|').map((n) => parseInt(n.trim(), 10));
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return Math.sqrt(dx * dx + dy * dy);
}

// Sunucu zamanını Date objesi olarak döndürür
function getServerTime() {
    const serverTime = jQuery('#serverTime').text();
    const serverDate = jQuery('#serverDate').text();
    const [day, month, year] = serverDate.split('/');
    const serverTimeFormatted = year + '-' + month + '-' + day + ' ' + serverTime;
    return new Date(serverTimeFormatted);
}

// dd/mm/yyyy HH:mm:ss -> Date (yerel)
function parseLandingTime(landingTimeStr) {
    const [landingDay, landingHour] = landingTimeStr.split(' ');
    const [day, month, year] = landingDay.split('/');
    const landingTimeFormatted = `${year}-${month}-${day} ${landingHour}`;
    return new Date(landingTimeFormatted);
}

// Date -> dd/mm/yyyy HH:mm:ss
function formatDateTime(date) {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    const DD = pad(d.getDate());
    const MM = pad(d.getMonth() + 1);
    const YYYY = d.getFullYear();
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${DD}/${MM}/${YYYY} ${hh}:${mm}:${ss}`;
}

/* =============================================================================
   >>> EKLENEN KISIM SONU
   (Yukarıdaki fonksiyonlar, yalnızca "Send" linkini BB koduna eklemek için
    atak planer mantığını birebir taşır. Kendi plan hesaplamanızda bu fonksiyonları
    çağırarak mevcut çıktınıza "Send" butonları ekleyebilirsiniz.)
   Kaynak: atak planer.txt’deki BB kodu üretim ve bağlantı kurgusu. [2](https://stdominicsballyfermot-my.sharepoint.com/personal/yektayasinkorkmaz_yazilimbudur_com/_layouts/15/download.aspx?UniqueId=4feb7f4e-aaef-4585-9fc0-317b822567d1&Translate=false&tempauth=v1.eyJzaXRlaWQiOiJiYjZhM2RlYS1lZDhkLTQ4MjUtYTVmMy1mYjQ3MGU3M2ZkODYiLCJhcHBfZGlzcGxheW5hbWUiOiJPZmZpY2UgMzY1IFNlYXJjaCBTZXJ2aWNlIiwiYXBwaWQiOiI2NmE4ODc1Ny0yNThjLTRjNzItODkzYy0zZThiZWQ0ZDY4OTkiLCJhdWQiOiIwMDAwMDAwMy0wMDAwLTBmZjEtY2UwMC0wMDAwMDAwMDAwMDAvc3Rkb21pbmljc2JhbGx5ZmVybW90LW15LnNoYXJlcG9pbnQuY29tQDRiYTY3YTY5LTRhZmEtNDM5MS1iYTc5LTQ1MjZmYWU2ZDMxNiIsImV4cCI6IjE3NTcwMTkyMDkifQ.CkAKDGVudHJhX2NsYWltcxIwQ01pMzU4VUdFQUFhRm1waFduSnlUbmR2U2xWcE5WSXpXbUZEYTNkeFFWRXFBQT09CjIKCmFjdG9yYXBwaWQSJDAwMDAwMDAzLTAwMDAtMDAwMC1jMDAwLTAwMDAwMDAwMDAwMAoKCgRzbmlkEgI2NBILCKjcxonY_bU-EAUaDTQwLjEyNi4zMi4xNjAqLGRmT09zQjJURW5ncGd2Y1VOcnRZU2t3RmZpekJMTmxrZ1hmNFFubHFNT0U9MLMBOAFCEKHCh3Z7AADgDlubX2YyRE9KEGhhc2hlZHByb29mdG9rZW5qJDAwN2IwNDQ5LTZjMzAtNzRiOC1kNTIyLTgwMzUwZTU2NzcwN3IpMGguZnxtZW1iZXJzaGlwfDEwMDMyMDAzZTA4YzcwNmJAbGl2ZS5jb216ATKCARIJaXqmS_pKkUMRunlFJvrm0xaSAQtZZWt0YSBZYXNpbpoBB0tvcmttYXqiASJ5ZWt0YXlhc2lua29ya21hekB5YXppbGltYnVkdXIuY29tqgEQMTAwMzIwMDNFMDhDNzA2QrIBOmdyb3VwLnJlYWQgYWxsZmlsZXMucmVhZCBhbGxwcm9maWxlcy5yZWFkIGFsbHByb2ZpbGVzLnJlYWTIAQE.gmqiCSxl4D4kXbuHPx3-FR2H6MjJlFOj3G7d1L_Bh70&ApiVersion=2.0&web=1)
   Orijinal büyük atak gövdesi korunmuştur. [1](https://stdominicsballyfermot-my.sharepoint.com/personal/yektayasinkorkmaz_yazilimbudur_com/_layouts/15/download.aspx?UniqueId=968ac000-edd9-4f3f-a98c-81a5494e195a&Translate=false&tempauth=v1.eyJzaXRlaWQiOiJiYjZhM2RlYS1lZDhkLTQ4MjUtYTVmMy1mYjQ3MGU3M2ZkODYiLCJhcHBfZGlzcGxheW5hbWUiOiJPZmZpY2UgMzY1IFNlYXJjaCBTZXJ2aWNlIiwiYXBwaWQiOiI2NmE4ODc1Ny0yNThjLTRjNzItODkzYy0zZThiZWQ0ZDY4OTkiLCJhdWQiOiIwMDAwMDAwMy0wMDAwLTBmZjEtY2UwMC0wMDAwMDAwMDAwMDAvc3Rkb21pbmljc2JhbGx5ZmVybW90LW15LnNoYXJlcG9pbnQuY29tQDRiYTY3YTY5LTRhZmEtNDM5MS1iYTc5LTQ1MjZmYWU2ZDMxNiIsImV4cCI6IjE3NTcwMTkyMDkifQ.CkAKDGVudHJhX2NsYWltcxIwQ01pMzU4VUdFQUFhRm1waFduSnlUbmR2U2xWcE5WSXpXbUZEYTNkeFFWRXFBQT09CjIKCmFjdG9yYXBwaWQSJDAwMDAwMDAzLTAwMDAtMDAwMC1jMDAwLTAwMDAwMDAwMDAwMAoKCgRzbmlkEgI2NBILCOTmzofY_bU-EAUaDTQwLjEyNi4zMi4xNjAqLGpjYk4yZ1kxV2FPVUUxY01kN0EwM0dHeUprNGs5ZVpucjYvZ2kxcUFxV2c9MLMBOAFCEKHCh3ZwQADQy5D0O2JGLBBKEGhhc2hlZHByb29mdG9rZW5qJDAwN2IwNDQ5LTZjMzAtNzRiOC1kNTIyLTgwMzUwZTU2NzcwN3IpMGguZnxtZW1iZXJzaGlwfDEwMDMyMDAzZTA4YzcwNmJAbGl2ZS5jb216ATKCARIJaXqmS_pKkUMRunlFJvrm0xaSAQtZZWt0YSBZYXNpbpoBB0tvcmttYXqiASJ5ZWt0YXlhc2lua29ya21hekB5YXppbGltYnVkdXIuY29tqgEQMTAwMzIwMDNFMDhDNzA2QrIBOmdyb3VwLnJlYWQgYWxsZmlsZXMucmVhZCBhbGxwcm9maWxlcy5yZWFkIGFsbHByb2ZpbGVzLnJlYWTIAQE.YziZl_jGMdeXifZepzCAnnIwJPKQvaiWTxfMuJGA2vA&ApiVersion=2.0&web=1)
   ============================================================================ */
