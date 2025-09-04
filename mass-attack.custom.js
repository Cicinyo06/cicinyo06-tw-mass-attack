/*!
 * Mass Attack Planner (Custom)
 * Base: v1.1.8 / Custom Build: v1.2.1-bbexport (2025-09-04)
 * Author (base): RedAlert / Custom: prepared for Yekta
 * URL: https://twscripts.dev/
 *
 * This build keeps your existing "Mass Attack" flow and ONLY adds:
 *  - Export Plan as BB Code area under Results
 *  - BB Code generator using SVP link logic (sitter + UK rules)
 */

(function(){
  if (typeof window === 'undefined') return;
  if (typeof game_data === 'undefined') {
    alert('Bu script Tribal Wars oyun ekranında çalıştırılmalıdır (game_data yok)!');
    return;
  }

  // jQuery çoğu TW sayfasında var ama yine de kontrol edelim
  if (typeof jQuery === 'undefined') {
    alert('jQuery bulunamadı. Oyunun bir iç sayfasında deneyin.');
    return;
  }

  /*-------------------------------------------
    Script Meta
  -------------------------------------------*/
  var scriptData = {
    name: 'Mass Attack Planner',
    version: 'v1.2.1-bbexport',
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

  // Unit info gerekirse çek
  (function(){
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
      '', '', 'left=10px,top=10px,width=700,height=720,toolbar=0,resizable=1,location=0,menubar=0,scrollbars=1,status=0'
    );
    if (!attackPlannerWindow) {
      alert('Pop-up engellendi. Lütfen bu site için pop-up izni verin ve tekrar deneyin.');
      return;
    }
    attackPlannerWindow.document.write(windowContent);

    setTimeout(async function(){
      const doc = attackPlannerWindow.document;
      doc.getElementById('mapLandingTime').value = getCurrentDateTime();

      // Grupları ve köyleri yükle
      await mapLoadGroupsAndVillages(MAP_GROUP_ID);

      // Events
      doc.getElementById('mapGroups').addEventListener('change', async (e)=>{
        MAP_GROUP_ID = parseInt(e.target.value || 0);
        localStorage.setItem(LS_PREFIX + '_chosen_group', MAP_GROUP_ID);
        await mapLoadVillagesForGroup(MAP_GROUP_ID);
      });

      doc.getElementById('mapGetPlan').addEventListener('click', (e)=>{
        e.preventDefault();
        handleGetPlan();
      });

      // BB Code kopyalama butonu
      var copyBtn = doc.getElementById('raMassCopyBB');
      if (copyBtn) {
        copyBtn.addEventListener('click', function(){
          var ta = doc.getElementById('raMassExportBBCode');
          if (!ta) return;
          ta.select(); ta.setSelectionRange(0, ta.value.length);
          (doc.execCommand && doc.execCommand('copy')) || navigator.clipboard?.writeText(ta.value);
          try { UI.SuccessMessage('BB Code kopyalandı!'); } catch(e) { alert('BB Code kopyalandı!'); }
        });
      }
    }, 100);
  }

  /* ============== UI ============== */
  function getAppContent(){
    return '\
<div class="ra-app">\
  <div class="ra-grid ra-mb15" style="grid-template-columns: 1fr 150px 150px;">\
    <div>\
      <label for="mapLandingTime">Landing Time (opsiyonel)</label>\
      <input id="mapLandingTime" type="text" placeholder="YYYY-MM-DD HH:mm:ss"/>\
    </div>\
    <div>\
      <label for="mapGroups">Group</label>\
      <select id="mapGroups"><option value="0">All</option></select>\
    </div>\
    <div>\
      <label for="mapNukesPerTarget">Nukes per Target</label>\
      <input id="mapNukesPerTarget" type="number" min="1" value="1"/>\
    </div>\
  </div>\
  <div class="ra-mb15">\
    <label for="mapTargets">Targets Coords (her satıra bir koordinat, ör: 500|500)</label>\
    <textarea id="mapTargets" placeholder="500|500\\n501|498"></textarea>\
  </div>\
  <div class="ra-mb15">\
    <a href="javascript:void(0);" id="mapGetPlan" class="btn btn-confirm-yes">Get Plan!</a>\
  </div>\
  <h3>Results</h3>\
  <table id="mapResults" class="ra-table" width="100%">\
    <thead><tr><th>#</th><th>From (village)</th><th>To (coords)</th><th>Dist.</th><th>Type</th><th>Send</th></tr></thead>\
    <tbody id="mapResultsBody"></tbody>\
  </table>\
  <!-- ▼ Yeni eklendi: BB Code export alanı -->\
  <div class="ra-mb15" id="raMassBBExport" style="margin-top:10px;">\
    <label for="raMassExportBBCode"><b>Export Plan as BB Code</b></label>\
    <textarea id="raMassExportBBCode" readonly placeholder="[table] ... [/table]"></textarea>\
    <div style="margin-top:6px;">\
      <a href="javascript:void(0);" id="raMassCopyBB" class="btn">Copy BB Code</a>\
    </div>\
  </div>\
  <!-- ▲ Yeni eklendi -->\
</div>';
  }

  function prepareWindowContent(windowBody){
    const windowHeader = '<h2>'+scriptData.name+'</h2>';
    const windowFooter = scriptData.name+' '+scriptData.version+' - <a href="'+scriptData.authorUrl+'" target="_blank" rel="noopener noreferrer">'+scriptData.author+'</a> - <a href="'+scriptData.helpLink+'" target="_blank" rel="noopener noreferrer">Help</a>';
    const windowStyle = '<style>body{font-family:Verdana,Arial,sans-serif;font-size:12px;color:#000}.ra-app{position:relative;display:block;width:auto;height:auto;margin:0 auto 10px;padding:10px;border:1px solid #603000;background:#f4e4bc}.ra-app *{box-sizing:border-box}.ra-grid{display:grid;gap:10px}.ra-mb15{margin-bottom:15px}input[type=text],input[type=number],select,textarea{width:100%;padding:6px 8px;border:1px solid #000;font-size:13px}textarea{height:100px;resize:vertical}.btn{padding:4px 6px}.ra-table{border-collapse:separate!important;border-spacing:2px!important;width:100%}.ra-table th,.ra-table td{background:#fff5da;padding:4px;text-align:center}.ra-table tbody tr:hover td{background:#ffdd30!important}.ra-text-left{text-align:left!important}</style>';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>'+scriptData.name+' '+scriptData.version+'</title>'+windowStyle+'</head><body>'+windowHeader+windowBody+'<br/><small><strong>'+windowFooter+'</strong></small></body></html>';
  }

  /* ============== GROUPS & VILLAGES ============== */
  async function mapLoadGroupsAndVillages(groupId){
    const groups = await fetchVillageGroups();
    const doc = attackPlannerWindow.document, sel = doc.getElementById('mapGroups');
    sel.innerHTML = '';
    if (groups && groups.result) {
      for (const [_, g] of Object.entries(groups.result)) {
        const gid = parseInt(g.group_id), name = g.name ?? ('Group '+gid);
        const opt = doc.createElement('option');
        opt.value = gid; opt.textContent = name;
        if (gid === parseInt(groupId)) opt.selected = true;
        sel.appendChild(opt);
      }
    } else {
      const opt = attackPlannerWindow.document.createElement('option');
      opt.value = 0; opt.textContent = 'All'; sel.appendChild(opt);
    }
    await mapLoadVillagesForGroup(groupId);
  }

  async function mapLoadVillagesForGroup(groupId){
    MAP_VILLAGES_CACHE = await fetchAllPlayerVillagesByGroup(groupId);
  }

  /* ============== PLAN FLOW (senin mevcut akışın) ============== */
  function handleGetPlan(){
    const doc = attackPlannerWindow.document;
    const targetsText = (doc.getElementById('mapTargets').value || '').trim();
    const nukesPerTarget = Math.max(1, parseInt(doc.getElementById('mapNukesPerTarget').value || '1'));

    if (!targetsText){ try{ UI.ErrorMessage('Targets boş!'); }catch(e){} return; }
    if (!MAP_VILLAGES_CACHE.length){ try{ UI.ErrorMessage('Köy listesi alınamadı!'); }catch(e){} return; }

    const targets = targetsText.split('\n').map(s=>s.trim()).filter(s=>/^\d{3}\|\d{3}$/.test(s));
    if (!targets.length){ try{ UI.ErrorMessage('Geçerli hedef koordinat bulunamadı!'); }catch(e){} return; }

    const plans = []; let rowIdx = 1;
    targets.forEach((toCoords)=>{
      const withDist = MAP_VILLAGES_CACHE.map(v=>({...v, distance:calculateDistance(v.coords,toCoords)}))
        .sort((a,b)=>a.distance-b.distance);

      // Basit örnek: her hedef için en yakın N köyü "Nuke" olarak ata
      withDist.slice(0, nukesPerTarget).forEach(v=>{
        plans.push({
          idx: rowIdx++,
          type: 'Nuke',
          unit: '',                     // unit seçimi yoksa boş bırakıyoruz (BB tablosu boş gösterir)
          fromId: v.id,
          fromName: v.name,
          fromCoords: v.coords,
          toCoords: toCoords,
          distance: v.distance,
          villageId: v.id,
          // launchTime opsiyonel: landing time ile hesaplanmıyorsa boş kalabilir
        });
      });
    });

    renderMassPlans(plans);

    // ▼ Yeni: BB Code alanını doldur
    var landingTimeString = (doc.getElementById('mapLandingTime')?.value || '').trim();
    raFillMassBB(plans, landingTimeString);
  }

  function renderMassPlans(plans){
    const doc = attackPlannerWindow.document, tbody = doc.getElementById('mapResultsBody');
    if (!tbody) return;
    if (!plans.length){ tbody.innerHTML = '<tr><td colspan="6"><b>No plans</b></td></tr>'; return; }
    const rows = plans.map(p=>{
      const sendBtn = createSendButtonHTML(p.fromId || p.villageId, p.toCoords, 'Send');
      const link = game_data.link_base_pure + 'info_village&id=' + (p.fromId || p.villageId);
      return '<tr>\
        <td>'+p.idx+'</td>\
        <td class="ra-text-left"><a href="'+link+'" target="_blank" rel="noopener noreferrer">'+escapeHtml(p.fromName)+' ('+p.fromCoords+')</a></td>\
        <td>'+p.toCoords+'</td>\
        <td>'+p.distance.toFixed(2)+'</td>\
        <td>'+p.type+'</td>\
        <td>'+sendBtn+'</td>\
      </tr>';
    }).join('');
    tbody.innerHTML = rows;
  }

  /* ============== BB CODE EKLENTİSİ (YENİ) ============== */

  /** "500|500" -> [x,y] */
  function raParseXY(coords){
    var a = (coords || '').split('|').map(s=>s.trim()); return [a[0], a[1]];
  }

  /** SVP mantığıyla /place linki: sitter + UK kuralı */
  function raBuildCommandUrl(villageId, toCoords){
    var xy = raParseXY(toCoords), toX = xy[0], toY = xy[1];
    var rally = (game_data.market !== 'uk') ? ('&x='+toX+'&y='+toY) : '';
    var sitter = (game_data.player.sitter > 0) ? ('t='+game_data.player.id+'&') : '';
    return window.location.origin + '/game.php?' + sitter + 'village=' + villageId + '&screen=place' + rally;
  }

  /** Tarih formatlayıcı (dd/mm/yyyy HH:mm:ss) */
  function raFormatDT(dOrMs){
    var d = (dOrMs instanceof Date) ? dOrMs : new Date(dOrMs || Date.now());
    var Y=d.getFullYear(), M=(''+(d.getMonth()+1)).padStart(2,'0'), D=(''+d.getDate()).padStart(2,'0');
    var h=(''+d.getHours()).padStart(2,'0'), m=(''+d.getMinutes()).padStart(2,'0'), s=(''+d.getSeconds()).padStart(2,'0');
    return D+'/'+M+'/'+Y+' '+h+':'+m+':'+s;
  }

  /**
   * plans: [{ unit, fromCoords, toCoords, villageId, launchTime?, launchTimeFormatted?, type? }]
   * landingTimeString: "dd/mm/yyyy HH:mm:ss" veya "yyyy-mm-dd HH:mm:ss" (başlıkta göstermek için)
   */
  function raBuildMassBBCode(plans, landingTimeString){
    if (!Array.isArray(plans) || plans.length === 0) return '';

    // hedefe göre grupla
    var byTarget = {};
    plans.forEach(function(p){
      var key = p.toCoords || 'Unknown';
      if (!byTarget[key]) byTarget[key] = [];
      byTarget[key].push(p);
    });

    var bb = '[size=12][b]Mass Attack Plan[/b][/size]\\n\\n';
    Object.keys(byTarget).forEach(function(target){
      var rows = byTarget[target].slice().sort(function(a,b){
        var ta = a.launchTime || 0, tb = b.launchTime || 0; return ta - tb;
      });
      bb += '[u][b]Target:[/b] '+target+'[/u]\\n';
      if (landingTimeString) bb += '[b]Landing Time:[/b] '+landingTimeString+'\\n\\n';
      bb += '[table][**]Unit[||]From[||]Type[||]Launch Time[||]Command[||]Status[/**]\\n';
      rows.forEach(function(r){
        var unit = r.unit || '';
        var from = r.fromCoords || '';
        var type = r.type || '';
        var launch = r.launchTimeFormatted || (r.launchTime ? raFormatDT(r.launchTime) : '-');
        var url = raBuildCommandUrl(r.villageId || r.fromId, target);
        bb += '[*][unit]'+unit+'[/unit][|] '+from+' [|] '+type+' [|] '+launch+' [|][url='+url+']Send[/url][|] \\n';
      });
      bb += '[/table]\\n\\n';
    });
    return bb;
  }

  /** Export alanını doldur (Get Plan sonrası çağrılır) */
  function raFillMassBB(plans, landingTimeString){
    var doc = (attackPlannerWindow && attackPlannerWindow.document) || document;
    var ta = doc.getElementById('raMassExportBBCode');
    if (!ta) return;
    ta.value = raBuildMassBBCode(plans, landingTimeString);
  }

  /* ============== HELPERLAR (mevcutlardan) ============== */
  function escapeHtml(s){ return String(s ?? '').replace(/[&<>\"']/g, function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',\"'\":'&#039;'}[m];}); }
  function getCurrentDateTime(){
    let d=new Date();var Y=d.getFullYear(),M=(''+(d.getMonth()+1)).padStart(2,'0'),D=(''+d.getDate()).padStart(2,'0'),h=(''+d.getHours()).padStart(2,'0'),m=(''+d.getMinutes()).padStart(2,'0'),s=(''+d.getSeconds()).padStart(2,'0');
    return Y+'-'+M+'-'+D+' '+h+':'+m+':'+s;
  }
  function calculateDistance(a,b){
    const x1=a.split('|')[0],y1=a.split('|')[1],x2=b.split('|')[0],y2=b.split('|')[1];
    const dx=Math.abs(x1-x2),dy=Math.abs(y1-y2);return Math.sqrt(dx*dx+dy*dy);
  }
  function parseCoordsToXY(coords){
    const a=coords.split('|').map(s=>s.trim()); return [a[0],a[1]];
  }
  function buildCommandUrl(villageId, targetCoords){
    const xy=parseCoordsToXY(targetCoords);const toX=xy[0],toY=xy[1];
    const rallyPointData=game_data.market!=='uk'?'&x='+toX+'&y='+toY:''; const sitterData=game_data.player.sitter>0?('t='+game_data.player.id+'&'):'';
    return window.location.origin+'/game.php?'+sitterData+'village='+villageId+'&screen=place'+rallyPointData;
  }
  function createSendButtonHTML(villageId, targetCoords, label){
    label=label||'Send'; const href=buildCommandUrl(villageId, targetCoords);
    return '<a href="'+href+'" class="btn btn-confirm-yes" target="_blank" rel="noopener noreferrer">'+label+'</a>';
  }

  /* ============== FETCHERS (mevcutlardan) ============== */
  async function fetchVillageGroups(){
    const villageGroups=await jQuery.get(game_data.link_base_pure+'groups&mode=overview&ajax=load_group_menu')
      .then((response)=>response)
      .catch((error)=>{ try{ UI.ErrorMessage('Error fetching village groups!'); }catch(e){} console.error(scriptInfo()+' Error:',error); });
    return villageGroups;
  }
  async function fetchAllPlayerVillagesByGroup(groupId){
    let villagesByGroup=[]; try{
      const url=game_data.link_base_pure+'groups&ajax=load_villages_from_group';
      villagesByGroup=await jQuery.post({url:url,data:{group_id:groupId}}).then((response)=>{
        const parser=new DOMParser(); const htmlDoc=parser.parseFromString(response.html,'text/html');
        const rows=jQuery(htmlDoc).find('#group_table > tbody > tr').not(':eq(0)'); let list=[];
        rows.each(function(){
          const villageId=jQuery(this).find('td:eq(0) a').attr('data-village-id') ?? jQuery(this).find('td:eq(0) a').attr('href').match(/\d+/)[0];
          const villageName=jQuery(this).find('td:eq(0)').text().trim();
          const villageCoords=jQuery(this).find('td:eq(1)').text().trim();
          list.push({ id:parseInt(villageId), name:villageName, coords:villageCoords });
        });
        return list;
      }).catch((_e)=>{ try{ UI.ErrorMessage('Villages list could not be fetched!'); }catch(__){} return []; });
    }catch(error){ console.error(scriptInfo()+' Error:',error); try{ UI.ErrorMessage('Villages list could not be fetched!'); }catch(__){} return []; }
    return villagesByGroup;
  }

  /* ============== UNIT INFO (orijinal akış) ============== */
  function fetchUnitInfo(){
    jQuery.ajax({url:'/interface.php?func=get_unit_info'}).done(function(response){
      unitInfo=xml2json($(response));
      localStorage.setItem(LS_PREFIX+'_unit_info',JSON.stringify(unitInfo));
      localStorage.setItem(LS_PREFIX+'_last_updated',Date.parse(new Date()));
      init();
    });
  }
  var xml2json=function($xml){ var data={}; $.each($xml.children(),function(){ var $this=$(this); if($this.children().length>0){ data[$this.prop('tagName')]=xml2json($this); }else{ data[$this.prop('tagName')]=$.trim($this.text()); } }); return data; };

  function scriptInfo(){ return '['+scriptData.name+' '+scriptData.version+']'; }
  function initDebug(){
    console.debug(scriptInfo()+' It works ğẏš€!'); console.debug(scriptInfo()+' HELP:',scriptData.helpLink);
    if (DEBUG){
      console.debug(scriptInfo()+' Market:',game_data.market);
      console.debug(scriptInfo()+' World:',game_data.world);
      console.debug(scriptInfo()+' Screen:',game_data.screen);
      console.debug(scriptInfo()+' Game Version:',game_data.majorVersion);
      console.debug(scriptInfo()+' Game Build:',game_data.version);
      console.debug(scriptInfo()+' Locale:',game_data.locale);
      console.debug(scriptInfo()+' Premium:',game_data.features.Premium.active);
    }
  }

})();
