// Carnet de vol : import LogTen, filtres, édition, export.
// Base locale propre (clé prevol.logbook.v2), sans interférence avec le
// brouillon de dossier ni les dossiers enregistrés.

const STORAGE_KEY='prevol.logbook.v2';let flights=[],editingId=null,importRows=[],importHeaders=[],currentPage=1;const PAGE_SIZE=50,selectedIds=new Set();
// Seuls les rôles qui figurent au carnet réglementaire sont saisissables.
// Les quatorze autres (relief, mécanicien, observateurs, personnel de cabine)
// alourdissaient le formulaire sans jamais servir.
const CREW_FIELDS=[
['PIC','Pilot-in-Command'],['SIC','Co-pilot / SIC'],['Commander','Commander']
];
// Rôles retirés du formulaire mais CONSERVÉS en base : un import LogTen peut
// les contenir, et les effacer ferait perdre des données sans prévenir.
const CREW_LEGACY=['Relief','Relief2','Relief3','Relief4','FlightEngineer','Instructor',
'Student','Observer','Observer2','Purser','FlightAttendant','FlightAttendant2',
'FlightAttendant3','FlightAttendant4'];
const TIME_FIELDS=[['total','Total'],['pic','PIC'],['sic','SIC'],['night','Night'],['ifr','IFR'],['actualInstrument','Actual Instrument'],['simInstrument','Simulated Instrument'],['dualReceived','Dual Received'],['dualGiven','Dual Given'],['solo','Solo'],['p1','P1'],['p1us','P1 u/s / PICUS'],['relief','Relief'],['multiPilot','Multi-pilot'],['simulator','Simulator']];
const OPS_FIELDS=[['dayTakeoffs','Day Takeoffs'],['nightTakeoffs','Night Takeoffs'],['dayLandings','Day Landings'],['nightLandings','Night Landings'],['touchAndGoes','Touch & Go'],['fullStops','Full Stops'],['autolands','Autolands'],['goArounds','Go-arounds']];
const WX_FIELDS=[['weather','Météo'],['sky','Ciel'],['visibility','Visibilité'],['cloudbase','Cloudbase'],['windDirection','Vent direction'],['windVelocity','Vent vitesse'],['review','Flight Review'],['ipc','IPC']];
const PAX_FIELDS=[['count','Nombre total'],['business','Business'],['1','Passager 1'],['2','Passager 2'],['3','Passager 3'],['4','Passager 4']];
function $(id){return document.getElementById(id)}function uid(){return'fl_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9)}function toast(m){const e=$('toast');if(!e)return; e.textContent=m;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),2800)}function n(v){const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0}function tmin(v){if(v===''||v==null)return 0;const s=String(v).trim();if(/^\d+:\d{1,2}$/.test(s)){const[a,b]=s.split(':').map(Number);return a*60+b}if(/^\d+([.,]\d+)?$/.test(s))return Math.round(Number(s.replace(',','.'))*60);return 0}function fmt(m){m=Math.max(0,Math.round(m||0));return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}function esc(v){return String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[x]))}function dateDisp(v){if(!v)return'';if(/^\d{4}-\d{2}-\d{2}$/.test(v)){const[a,b,c]=v.split('-');return`${c}/${b}/${a.slice(-2)}`}const d=new Date(v);return Number.isNaN(d.getTime())?v:`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`}function sortF(a,b){return String(b.date).localeCompare(String(a.date))||String(b.actualDeparture).localeCompare(String(a.actualDeparture))}function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(flights))}function load(){try{flights=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');if(!Array.isArray(flights))flights=[];flights.sort(sortF)}catch{flights=[]}}
function emptyFlight(){return{id:uid(),date:'',entryType:'Flight',flightNumber:'',from:'',to:'',actualDeparture:'',actualArrival:'',distance:'',route:'',aircraftId:'',aircraftType:'',engineClass:'',pilotMode:'',crew:Object.fromEntries(CREW_FIELDS.map(x=>[x[0],''])),times:Object.fromEntries(TIME_FIELDS.map(x=>[x[0],''])),operations:Object.fromEntries(OPS_FIELDS.map(x=>[x[0],0])),approaches:Array.from({length:10},()=>({type:'',category:'',mode:'',airport:''})),duty:{},fuel:{},weather:{},pax:{},notes:'',sim:{type:'',total:'',remark:''},rawLogTen:{}}}
// Une séance de simulateur n'est pas un vol : pas de terrains, pas
// d'immatriculation, pas de temps de vol. Elle n'alimente que la colonne
// « Synthetic training devices » du carnet EASA, qui ne demande que la date,
// le type d'appareillage et la durée de la séance.
function isSim(f){
  if(String(f?.entryType||'').toLowerCase()==='simulator') return true;
  // Une séance importée de LogTen ne porte pas toujours le type « Simulator ».
  // Signature sûre : du temps de simulateur et aucun temps de vol.
  return tmin(f?.times?.simulator)>0 && tmin(f?.times?.total)===0;
}
function simTotal(f){return isSim(f)?(f.sim?.total||f.times?.simulator||''):(f.times?.simulator||'')}

function findH(headers,cands){const h=headers.map(x=>String(x).trim().toLowerCase());for(const c of cands){const i=h.indexOf(c.toLowerCase());if(i>=0)return headers[i]}for(let i=0;i<h.length;i++)for(const c of cands)if(h[i].includes(c.toLowerCase()))return headers[i];return null}
function rv(row,headers,cands){const h=findH(headers,cands);return h?row[h]:''}
function mapRow(row,headers){const f=emptyFlight();f.date=rv(row,headers,['flight_flightDate','date']);f.entryType=rv(row,headers,['flight_type','entry type'])||'Flight';f.flightNumber=rv(row,headers,['flight_flightNumber','flight number']);f.from=(rv(row,headers,['flight_from','from','departure'])||'').toUpperCase();f.to=(rv(row,headers,['flight_to','to','arrival'])||'').toUpperCase();f.actualDeparture=rv(row,headers,['flight_actualDepartureTime','actual departure time']);f.actualArrival=rv(row,headers,['flight_actualArrivalTime','actual arrival time']);f.distance=rv(row,headers,['flight_distance','distance']);f.route=rv(row,headers,['flight_route','route']);f.aircraftId=(rv(row,headers,['aircraft_aircraftID','registration','aircraft'])||'').toUpperCase();f.aircraftType=rv(row,headers,['aircraftType_type','aircraft type']);f.engineClass=/multi/i.test(rv(row,headers,['aircraftType_selectedAircraftClass','aircraft class']))?'ME':'SE';f.pilotMode=rv(row,headers,['flight_multiPilot','multi pilot'])?'Multi-Pilot':'Single-Pilot';const tm={total:['flight_totalTime','total time','flight time'],pic:['flight_pic','pic'],sic:['flight_sic','sic'],night:['flight_night','night'],ifr:['flight_ifr','ifr'],actualInstrument:['flight_actualInstrument'],simInstrument:['flight_simulatedInstrument'],dualReceived:['flight_dualReceived'],dualGiven:['flight_dualGiven'],solo:['flight_solo'],p1us:['flight_p1us','picus'],simulator:['flight_simulator']};for(const[k,c]of Object.entries(tm))f.times[k]=rv(row,headers,c);for(const[k]of TIME_FIELDS.map(x=>x[0]))if(f.times[k]===undefined)f.times[k]='';for(const[k]of CREW_FIELDS)f.crew[k]=rv(row,headers,[`flight_selectedCrew${k}`,'']);f.crew.PIC=rv(row,headers,['flight_selectedCrewPIC']);f.crew.SIC=rv(row,headers,['flight_selectedCrewSIC']);f.crew.Instructor=rv(row,headers,['flight_selectedCrewInstructor']);f.crew.Student=rv(row,headers,['flight_selectedCrewStudent']);for(const[k]of OPS_FIELDS.map(x=>x[0]))f.operations[k]=n(rv(row,headers,[`flight_${k}`]));for(let i=0;i<10;i++)f.approaches[i].type=rv(row,headers,[`flight_selectedApproach${i+1}`]);f.duty={on:rv(row,headers,['flight_onDutyTime']),off:rv(row,headers,['flight_offDutyTime']),total:rv(row,headers,['flight_totalDutyTime']),rest:rv(row,headers,['flight_rest']),fdpStart:rv(row,headers,['flight_flightDutyStartTime']),fdpEnd:rv(row,headers,['flight_flightDutyEndTime']),fdpTotal:rv(row,headers,['flight_flightDutyTotal'])};f.fuel={added:rv(row,headers,['flight_fuelAdded']),burned:rv(row,headers,['flight_fuelBurned']),diversion:rv(row,headers,['flight_fuelMinimumForDiversion']),aboard:rv(row,headers,['flight_fuelTotalAboard']),beforeUplift:rv(row,headers,['flight_fuelTotalBeforeUplift']),uplift:rv(row,headers,['flight_fuelUplift'])};f.weather={weather:rv(row,headers,['flight_weather']),sky:rv(row,headers,['flight_sky']),visibility:rv(row,headers,['flight_visibility']),cloudbase:rv(row,headers,['flight_cloudbase']),windDirection:rv(row,headers,['flight_windDirection']),windVelocity:rv(row,headers,['flight_windVelocity']),review:rv(row,headers,['flight_review']),ipc:rv(row,headers,['flight_instrumentProficiencyCheck'])};f.pax={count:n(rv(row,headers,['flight_paxCount'])),business:n(rv(row,headers,['flight_paxCountBusiness']))};for(let i=1;i<=4;i++)f.pax[i]=rv(row,headers,[`flight_selectedPax${i}`]);f.notes=rv(row,headers,['flight_remarks']);f.rawLogTen={...row};
 // Normalisation : si la ligne décrit une séance, on la marque comme telle et
 // on remplit l'entité simulateur, sinon elle resterait un vol sans données.
 if(tmin(f.times.simulator)>0 && tmin(f.times.total)===0){
   f.entryType='Simulator';
   f.sim={type:f.aircraftType||f.aircraftId||'', total:f.times.simulator, remark:f.notes||''};
 }
 return f}
function parseDelimited(text,delimiter){const rows=[];let row=[],field='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c=='"'){if(text[i+1]=='"'){field+='"';i++}else q=false}else field+=c;continue}if(c=='"'){q=true;continue}if(c===delimiter){row.push(field);field='';continue}if(c==='\n'){row.push(field);rows.push(row);row=[];field='';continue}if(c==='\r')continue;field+=c}row.push(field);if(row.some(v=>v))rows.push(row);return rows}
function parseFile(text){const first=text.split(/\r?\n/)[0]||'';const counts=[['\t', (first.match(/\t/g)||[]).length],[';', (first.match(/;/g)||[]).length],[',',(first.match(/,/g)||[]).length]].sort((a,b)=>b[1]-a[1]);const m=counts[0][0];const matrix=parseDelimited(text,m);const headers=matrix[0].map((h,i)=>String(h||`Column_${i+1}`).trim());return{headers,rows:matrix.slice(1).map(a=>Object.fromEntries(headers.map((h,i)=>[h,a[i]??''])))}}function dupKey(f){return[f.date,f.aircraftId,f.from,f.to,f.actualDeparture,f.actualArrival,f.times?.total].join('|')}

function refreshDatalists(){const as=new Set(),ps=new Set();flights.forEach(f=>{if(f.aircraftId)as.add(f.aircraftId);CREW_FIELDS.forEach(r=>{if(f.crew?.[r[0]])ps.add(f.crew[r[0]])})});$('aircraftList').innerHTML=[...as].sort().map(x=>`<option value="${esc(x)}">`).join('');$('peopleList').innerHTML=[...ps].sort().map(x=>`<option value="${esc(x)}">`).join('')}
function refreshFilters(){const keepA=$('filterAircraft').value,keepT=$('filterType').value,keepY=$('filterYear').value;const A=[...new Set(flights.map(f=>f.aircraftId).filter(Boolean))].sort(),T=[...new Set(flights.map(f=>f.aircraftType).filter(Boolean))].sort(),Y=[...new Set(flights.map(f=>String(f.date).slice(0,4)).filter(x=>/^\d{4}$/.test(x)))].sort().reverse();const fill=(id,arr,first,keep)=>{$(id).innerHTML=`<option value="">${first}</option>`+arr.map(x=>`<option ${x===keep?'selected':''} value="${esc(x)}">${esc(x)}</option>`).join('')};fill('filterAircraft',A,'Tous',keepA);fill('filterType',T,'Tous',keepT);fill('filterYear',Y,'Toutes',keepY)}
function filtered(){const q=$('searchInput').value.toLowerCase().trim(),A=$('filterAircraft').value,T=$('filterType').value,Y=$('filterYear').value,R=$('filterRole').value;return flights.filter(f=>{if(A&&f.aircraftId!==A)return false;if(T&&f.aircraftType!==T)return false;if(Y&&!String(f.date).startsWith(Y))return false;if(R){const m={PIC:'pic',SIC:'sic',P1US:'p1us',DUAL:'dualReceived',SOLO:'solo'}[R];if(R==='SIM'){if(String(f.entryType).toLowerCase()!=='simulator'&&!tmin(f.times?.simulator))return false}else if(m&&!tmin(f.times?.[m]))return false}if(q){const hay=JSON.stringify(f).toLowerCase();if(!hay.includes(q))return false}return true})}
function renderStats(){
 // Le temps de simulateur ne compte pas dans les totaux de vol : l'inclure
 // gonflerait artificiellement l'expérience déclarée.
 const vols=flights.filter(f=>!isSim(f));
 const sum=k=>vols.reduce((a,f)=>a+tmin(f.times?.[k]),0);$('statFlights').textContent=vols.length;$('statTotal').textContent=fmt(sum('total'));$('statPIC').textContent=fmt(sum('pic'));$('statSIC').textContent=fmt(sum('sic'));$('statIFR').textContent=fmt(sum('ifr'));$('statNight').textContent=fmt(sum('night'));
 // Le simulateur a sa propre carte : c'est le seul endroit où ce temps
 // apparaît, puisqu'il est exclu de tous les totaux de vol.
 const seances=flights.filter(isSim);
 if($('statSim'))$('statSim').textContent=fmt(seances.reduce((a,f)=>a+tmin(simTotal(f)),0));
 if($('statSimCount'))$('statSimCount').textContent=seances.length+' séance'+(seances.length>1?'s':'');const A=new Set(flights.map(f=>f.aircraftId).filter(Boolean)),P=new Set(),T=new Set();flights.forEach(f=>{f.from&&P.add(f.from);f.to&&P.add(f.to);f.aircraftType&&T.add(f.aircraftType)});$('sumRecords').textContent=flights.length;$('sumAircraft').textContent=A.size;$('sumAirports').textContent=P.size;$('sumTypes').textContent=T.size}

// Une ligne du tableau. Le carnet mêle deux natures d'entrée : un vol remplit
// les seize colonnes, une séance de simulateur n'en concerne que trois. Les
// afficher côte à côte avec la même grille donnait une file de tirets illisible
// et rendait la séance invisible. Elle reçoit donc sa propre ligne, où les
// colonnes sans objet sont fusionnées en une mention explicite.
function celluleActions(f){
  return `<td><div class="actions-cell">`
    + `<button class="icon-btn" data-edit="${esc(f.id)}" title="Modifier">✎</button>`
    + `<button class="icon-btn" data-dup="${esc(f.id)}" title="Dupliquer">⧉</button>`
    + `<button class="icon-btn" data-del="${esc(f.id)}" title="Supprimer">×</button>`
    + `</div></td>`;
}

function ligneCarnet(f){
  const coche = `<td><input type="checkbox" data-sel="${esc(f.id)}" ${selectedIds.has(f.id)?'checked':''}></td>`;

  if(isSim(f)){
    const type = f.sim?.type || 'Type non renseigné';
    const duree = simTotal(f) || '—';
    const note = f.sim?.remark || f.notes || '';
    return `<tr class="sim-row">
      ${coche}
      <td class="mono">${esc(dateDisp(f.date)) || '—'}</td>
      <td colspan="6" class="sim-label"><span class="badge">SIM</span> Séance simulateur — ${esc(type)}</td>
      <td class="mono">${esc(duree)}</td>
      <td colspan="5" class="small">Hors temps de vol</td>
      <td class="comment-cell" title="${esc(note)}">${esc(note || '—')}</td>
      ${celluleActions(f)}
    </tr>`;
  }

  return `<tr>
    ${coche}
    <td class="mono">${esc(dateDisp(f.date))}</td>
    <td class="mono">${esc(f.from)}</td>
    <td class="mono">${esc(f.to)}</td>
    <td class="mono">${esc(f.aircraftId)}</td>
    <td>${esc(f.aircraftType||f.entryType)}</td>
    <td>${esc(f.engineClass||'—')}</td>
    <td>${esc(f.pilotMode||'—')}</td>
    <td class="mono">${esc(f.times?.total||'—')}</td>
    <td class="mono">${esc(f.times?.pic||'—')}</td>
    <td class="mono">${esc(f.times?.sic||'—')}</td>
    <td class="mono">${esc(f.times?.night||'—')}</td>
    <td class="mono">${esc(f.times?.ifr||'—')}</td>
    <td>${esc(f.crew?.PIC||'—')}</td>
    <td class="comment-cell" title="${esc(f.notes||'')}">${esc(f.notes||'—')}</td>
    ${celluleActions(f)}
  </tr>`;
}

function renderTable(){const data=filtered(),pages=Math.max(1,Math.ceil(data.length/PAGE_SIZE));currentPage=Math.min(currentPage,pages);const rows=data.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);$('flightTableBody').innerHTML=rows.map(f=>ligneCarnet(f)).join('');$('emptyState').classList.toggle('hidden',rows.length>0);$('tableMeta').textContent=`${data.length} vol${data.length>1?'s':''}`;$('pageMeta').textContent=`Page ${currentPage} / ${pages}`;$('prevPage').disabled=currentPage<=1;$('nextPage').disabled=currentPage>=pages;$('selectAll').checked=rows.length>0&&rows.every(f=>selectedIds.has(f.id));$('selectionBadge').textContent=`${selectedIds.size} sélectionné${selectedIds.size>1?'s':''}`}
function refresh(){refreshFilters();refreshDatalists();renderStats();renderTable()}
function buildDynamic(){ $('crewRows').innerHTML=CREW_FIELDS.map(([k,l])=>`<tr><td style="padding:8px">${l}</td><td><input id="crew_${k}" list="peopleList" style="width:100%;padding:8px;border:1px solid var(--line);border-radius:9px"></td></tr>`).join('');$('timeFields').innerHTML=TIME_FIELDS.map(([k,l])=>`<div class="field"><label>${l}</label><input id="t_${k}" placeholder="00:00"></div>`).join('');$('opsFields').innerHTML=OPS_FIELDS.map(([k,l])=>`<div class="field"><label>${l}</label><input id="ops_${k}" type="number" min="0" step="1"></div>`).join('');$('weatherFields').innerHTML=WX_FIELDS.map(([k,l])=>`<div class="field"><label>${l}</label><input id="wx_${k}"></div>`).join('');$('paxFields').innerHTML=PAX_FIELDS.map(([k,l])=>`<div class="field"><label>${l}</label><input id="pax_${k}" ${k==='count'||k==='business'?'type="number" min="0"':''}></div>`).join('')}
// Une seule ligne d'approche par défaut. Dix lignes vides à remplir alors
// qu'un vol en compte rarement plus d'une n'apportaient rien.
const APPROACH_MAX=10;
function approaches(data){
  const remplies=(data||[]).filter(a=>a&&(a.type||a.category||a.mode||a.airport)).length;
  dessinerApproches(data, Math.max(1, remplies));
}
function dessinerApproches(data, nb){
  const corps=$('approachRows');
  if(!corps) return;
  corps.dataset.count=nb;
  corps.innerHTML=Array.from({length:nb},(_,i)=>{
    const a=data?.[i]||{};
    return `<tr><td style="padding:8px">${i+1}</td>
      <td><input data-ap="${i}" data-f="type" value="${esc(a.type||'')}" list="approachTypes" style="width:100%;padding:7px"></td>
      <td><input data-ap="${i}" data-f="category" value="${esc(a.category||'')}" style="width:100%;padding:7px"></td>
      <td><input data-ap="${i}" data-f="mode" value="${esc(a.mode||'')}" style="width:100%;padding:7px"></td>
      <td><input data-ap="${i}" data-f="airport" value="${esc(a.airport||'')}" style="width:100%;padding:7px;text-transform:uppercase"></td></tr>`;
  }).join('');
  const b=$('addApproach');
  if(b) b.style.display = nb>=APPROACH_MAX ? 'none' : '';
}
function lireApproches(){
  const nb=+($('approachRows')?.dataset.count||1);
  return Array.from({length:nb},(_,i)=>({
    type:document.querySelector(`[data-ap="${i}"][data-f="type"]`)?.value||'',
    category:document.querySelector(`[data-ap="${i}"][data-f="category"]`)?.value||'',
    mode:document.querySelector(`[data-ap="${i}"][data-f="mode"]`)?.value||'',
    airport:(document.querySelector(`[data-ap="${i}"][data-f="airport"]`)?.value||'').toUpperCase()
  })).filter(a=>a.type||a.category||a.mode||a.airport);
}

// --- Distance orthodromique entre deux terrains ---
// Les coordonnées viennent de la base aérodromes de PréVol (app.js, chargé
// sur cette page). Un terrain absent de la base laisse la distance à saisir :
// mieux vaut un champ vide qu'un chiffre inventé.
function coordsTerrain(icao){
  const k=String(icao||'').trim().toUpperCase();
  if(k.length!==4 || typeof allAirports!=='function') return null;
  const ap=allAirports()[k];
  return (ap && ap.lat!=null && ap.lon!=null) ? {lat:+ap.lat, lon:+ap.lon} : null;
}
function distanceNM(a,b){
  const A=coordsTerrain(a), B=coordsTerrain(b);
  if(!A||!B) return null;
  const R=3440.065;                       // rayon terrestre en milles marins
  const r=x=>x*Math.PI/180;
  const dLat=r(B.lat-A.lat), dLon=r(B.lon-A.lon);
  const h=Math.sin(dLat/2)**2 + Math.cos(r(A.lat))*Math.cos(r(B.lat))*Math.sin(dLon/2)**2;
  return Math.round(2*R*Math.asin(Math.min(1,Math.sqrt(h))));
}
function majDistance(){
  const champ=$('f_distance'), tag=$('distAuto');
  if(!champ) return;
  const d=distanceNM($('f_from')?.value, $('f_to')?.value);
  if(d==null){
    if(tag) tag.textContent = ($('f_from')?.value && $('f_to')?.value) ? 'terrain inconnu' : '';
    return;                               // on n'efface jamais une saisie
  }
  champ.value=d;
  if(tag) tag.textContent = d===0 ? 'circuit local' : 'orthodromie';
}

function openFlight(id){editingId=id;const f=id?flights.find(x=>x.id===id):emptyFlight();if(!f)return;buildDynamic();$('modalTitle').textContent=id?'Modifier le vol':'Ajouter un vol';for(const[k,v]of Object.entries({f_date:f.date,f_entryType:f.entryType,f_flightNumber:f.flightNumber,f_from:f.from,f_to:f.to,f_actualDeparture:f.actualDeparture,f_actualArrival:f.actualArrival,f_distance:f.distance,f_route:f.route,f_aircraftId:f.aircraftId,f_aircraftType:f.aircraftType,f_engineClass:f.engineClass,f_pilotMode:f.pilotMode,notes_remarks:f.notes,rawLogTen:f.rawLogTen&&Object.keys(f.rawLogTen).length?JSON.stringify(f.rawLogTen,null,2):''})){if($(k))$(k).value=v||''}CREW_FIELDS.forEach(([k])=>{if($(`crew_${k}`))$(`crew_${k}`).value=f.crew?.[k]||''});TIME_FIELDS.forEach(([k])=>{if($(`t_${k}`))$(`t_${k}`).value=f.times?.[k]||''});OPS_FIELDS.forEach(([k])=>{if($(`ops_${k}`))$(`ops_${k}`).value=f.operations?.[k]??0});approaches(f.approaches);$('duty_on').value=f.duty?.on||'';$('duty_off').value=f.duty?.off||'';$('duty_total').value=f.duty?.total||'';$('duty_rest').value=f.duty?.rest||'';$('duty_fdpStart').value=f.duty?.fdpStart||'';$('duty_fdpEnd').value=f.duty?.fdpEnd||'';$('duty_fdpTotal').value=f.duty?.fdpTotal||'';[['fuel_added','added'],['fuel_burned','burned'],['fuel_diversion','diversion'],['fuel_aboard','aboard'],['fuel_uplift','uplift']].forEach(([a,b])=>$(a).value=f.fuel?.[b]??'');WX_FIELDS.forEach(([k])=>{if($(`wx_${k}`))$(`wx_${k}`).value=f.weather?.[k]||''});PAX_FIELDS.forEach(([k])=>{if($(`pax_${k}`))$(`pax_${k}`).value=f.pax?.[k]??''});if($('f_simDate'))$('f_simDate').value=f.date||'';
 if($('f_simType'))$('f_simType').value=f.sim?.type||f.aircraftType||'';
 if($('f_simTotal'))$('f_simTotal').value=simTotal(f)||'';
 if($('f_simRemark'))$('f_simRemark').value=f.sim?.remark||f.notes||'';
 deduireRapide(f);
 syncEntryType();
 $('deleteFlightBtn').style.display=id?'':'none';$('flightModal').classList.add('open')}
// Affiche le formulaire adapté au type d'entrée : une séance simulateur
// masque tout ce qui relève du vol, qui n'aurait aucun sens à remplir.
function syncEntryType(){
  const sim = String($('f_entryType')?.value||'').toLowerCase()==='simulator';
  const bloc = $('simSection');
  if(bloc) bloc.style.display = sim ? '' : 'none';
  document.querySelectorAll('.flight-only').forEach(el=>{ el.style.display = sim ? 'none' : ''; });
  // Les terrains et horaires de la section 01 ne concernent pas le simulateur
  ['f_flightNumber','f_from','f_to','f_actualDeparture','f_actualArrival','f_distance','f_route']
    .forEach(id=>{ const el=$(id); if(el && el.closest('.field')) el.closest('.field').style.display = sim?'none':''; });
  const d=$('f_date'); if(d && d.closest('.field')) d.closest('.field').style.display = sim?'none':'';
  $('modalTitle').textContent = sim
    ? (editingId?'Modifier la séance simulateur':'Ajouter une séance simulateur')
    : (editingId?'Modifier le vol':'Ajouter un vol');
}


// ============ SAISIE RAPIDE DES TEMPS ============
// Le carnet compte quinze colonnes de durées. En pratique elles valent
// presque toutes le temps de vol : un vol de nuit reporte le total en nuit,
// un vol commandant de bord le reporte en PIC. On calcule donc le total à
// partir des horaires, et des cases à cocher le recopient là où il faut.
// Le détail reste accessible pour les vols où une durée diffère.

// « 14:30 » ou « 1430 » -> minutes depuis minuit
function heureEnMinutes(v){
  const t=String(v==null?'':v).trim();
  let m=t.match(/^(\d{1,2})[:hH.](\d{2})$/);
  if(!m) m=t.match(/^(\d{2})(\d{2})$/);
  if(!m) return null;
  const h=+m[1], mi=+m[2];
  if(h>23||mi>59) return null;
  return h*60+mi;
}

function calculerTotal(){
  const dep=heureEnMinutes($('f_actualDeparture')?.value);
  const arr=heureEnMinutes($('f_actualArrival')?.value);
  const tag=$('totalAuto');
  if(dep==null||arr==null){ if(tag) tag.textContent='à saisir'; return null; }
  // Un vol qui passe minuit arrive « avant » son départ : on ajoute 24 h.
  let d=arr-dep; if(d<0) d+=24*60;
  if(tag) tag.textContent='calculé';
  return d;
}

function majTotalAuto(){
  const min=calculerTotal();
  const champ=$('t_total_quick');
  if(min==null||!champ) return;
  champ.value=fmt(min);
  appliquerRapide();
}

// Reporte le total dans les colonnes cochées, et vide celles qui ne le sont
// plus — sans quoi une case décochée laisserait une durée fantôme.
function appliquerRapide(){
  const total=$('t_total_quick')?.value||'';
  if($('t_total')) $('t_total').value=total;

  const fonction=$('q_function')?.value||'';
  ['pic','sic','p1us','dualReceived','dualGiven','solo'].forEach(k=>{
    if($('t_'+k)) $('t_'+k).value = (k===fonction)?total:'';
  });
  if($('t_night')) $('t_night').value = $('q_night')?.checked?total:'';
  if($('t_ifr'))   $('t_ifr').value   = $('q_ifr')?.checked?total:'';
  if($('t_multiPilot')) $('t_multiPilot').value = $('q_multi')?.checked?total:'';
  const pm=$('f_pilotMode');
  if(pm && $('q_multi')) pm.value = $('q_multi').checked ? 'Multi-Pilot' : (pm.value==='Multi-Pilot'?'Single-Pilot':pm.value);
}

// L'inverse : à l'ouverture d'un vol existant, on déduit l'état des cases
// des durées déjà enregistrées, pour ne pas les écraser.
function deduireRapide(f){
  const total=f.times?.total||'';
  if($('t_total_quick')) $('t_total_quick').value=total;
  const eq=k=>total && f.times?.[k]===total;
  const fonction=['pic','sic','p1us','dualReceived','dualGiven','solo'].find(eq)||'';
  if($('q_function')) $('q_function').value=fonction;
  if($('q_night')) $('q_night').checked=eq('night');
  if($('q_ifr'))   $('q_ifr').checked=eq('ifr');
  if($('q_multi')) $('q_multi').checked = f.pilotMode==='Multi-Pilot' || eq('multiPilot');
  const tag=$('totalAuto'); if(tag) tag.textContent = total?'enregistré':'à saisir';

  // Si une durée ne correspond pas au total, le détail est ouvert d'office :
  // la saisie rapide ne saurait pas la représenter.
  const particulier=['pic','sic','p1us','dualReceived','dualGiven','solo','night','ifr']
    .some(k=>{const v=f.times?.[k]||''; return v && v!==total;});
  const detail=$('timeFields');
  if(detail) detail.style.display = particulier ? '' : 'none';
  const b=$('toggleTimeDetail');
  if(b) b.textContent = particulier ? 'Masquer le détail ▴' : 'Détail des temps ▾';
}

(function initSaisieRapide(){
  ['f_actualDeparture','f_actualArrival'].forEach(id=>{
    const el=$(id); if(el) el.addEventListener('input', majTotalAuto);
  });
  const t=$('t_total_quick'); if(t) t.addEventListener('input', appliquerRapide);
  ['q_function','q_night','q_ifr','q_multi'].forEach(id=>{
    const el=$(id); if(el) el.addEventListener('change', appliquerRapide);
  });
  const b=$('toggleTimeDetail');
  if(b) b.addEventListener('click', ()=>{
    const d=$('timeFields'); if(!d) return;
    const ouvert = d.style.display!=='none';
    d.style.display = ouvert?'none':'';
    b.textContent = ouvert?'Détail des temps ▾':'Masquer le détail ▴';
  });
  ['f_from','f_to'].forEach(id=>{
    const el=$(id); if(el) el.addEventListener('input', majDistance);
  });
  const ap=$('addApproach');
  if(ap) ap.addEventListener('click', ()=>{
    const corps=$('approachRows');
    const nb=Math.min(APPROACH_MAX, (+(corps?.dataset.count||1))+1);
    dessinerApproches(lireApproches(), nb);
  });

  const e=$('toggleExtras');
  if(e) e.addEventListener('click', ()=>{
    const secs=[...document.querySelectorAll('.extra-section')];
    const ouvert = secs.some(x=>x.dataset.open==='1');
    secs.forEach(x=>{ x.dataset.open = ouvert?'':'1'; x.style.display = ouvert?'none':''; });
    e.textContent = ouvert?'Afficher les rubriques détaillées ▾':'Masquer les rubriques détaillées ▴';
  });
  // Repliées au départ
  document.querySelectorAll('.extra-section').forEach(x=>{ x.style.display='none'; });
})();

function closeFlight(){ $('flightModal').classList.remove('open');editingId=null}
function saveFlight(){const f=editingId?flights.find(x=>x.id===editingId):emptyFlight();
 f.entryType=$('f_entryType').value;
 if(isSim(f)){
   // Séance simulateur : on enregistre les trois champs du carnet EASA et on
   // vide tout ce qui relève du vol, pour qu'aucune donnée de vol résiduelle
   // ne remonte dans les colonnes avion de l'export.
   // Une entrée sans date se retrouverait en dernière page du carnet, donc
   // introuvable. À défaut de saisie, on prend la date du jour.
   f.date=$('f_simDate').value || new Date().toISOString().slice(0,10);
   f.sim={type:$('f_simType').value.trim(), total:$('f_simTotal').value.trim(), remark:$('f_simRemark').value.trim()};
   f.times=Object.fromEntries(TIME_FIELDS.map(x=>[x[0],'']));
   f.times.simulator=f.sim.total;
   f.from='';f.to='';f.flightNumber='';f.actualDeparture='';f.actualArrival='';
   f.distance='';f.route='';f.aircraftId='';f.aircraftType=f.sim.type;
   f.engineClass='';f.pilotMode='';
   f.notes=f.sim.remark;
   if(!editingId)flights.push(f); else {const i=flights.findIndex(x=>x.id===editingId);if(i>=0)flights[i]=f}
   flights.sort(sortF);save();refresh();closeFlight();toast(editingId?'Séance modifiée.':'Séance simulateur ajoutée.');
   return;
 }
 f.sim={type:'',total:'',remark:''};
 f.date=$('f_date').value;f.flightNumber=$('f_flightNumber').value.trim();f.from=$('f_from').value.toUpperCase();f.to=$('f_to').value.toUpperCase();f.actualDeparture=$('f_actualDeparture').value;f.actualArrival=$('f_actualArrival').value;f.distance=$('f_distance').value;f.route=$('f_route').value.trim();f.aircraftId=$('f_aircraftId').value.toUpperCase();f.aircraftType=$('f_aircraftType').value.trim();f.engineClass=$('f_engineClass').value;f.pilotMode=$('f_pilotMode').value;CREW_FIELDS.forEach(([k])=>f.crew[k]=$(`crew_${k}`).value.trim());TIME_FIELDS.forEach(([k])=>f.times[k]=$(`t_${k}`).value.trim());OPS_FIELDS.forEach(([k])=>f.operations[k]=n($(`ops_${k}`).value));f.approaches=lireApproches();f.duty={on:$('duty_on').value,off:$('duty_off').value,total:$('duty_total').value,rest:$('duty_rest').value,fdpStart:$('duty_fdpStart').value,fdpEnd:$('duty_fdpEnd').value,fdpTotal:$('duty_fdpTotal').value};f.fuel={added:$('fuel_added').value,burned:$('fuel_burned').value,diversion:$('fuel_diversion').value,aboard:$('fuel_aboard').value,uplift:$('fuel_uplift').value};f.weather=Object.fromEntries(WX_FIELDS.map(([k])=>[k,$(`wx_${k}`).value]));f.pax=Object.fromEntries(PAX_FIELDS.map(([k])=>[k,['count','business'].includes(k)?n($(`pax_${k}`).value):$(`pax_${k}`).value]));f.notes=$('notes_remarks').value;try{f.rawLogTen=JSON.parse($('rawLogTen').value||'{}')}catch{toast('JSON LogTen invalide');return}if(!editingId){flights.push(f)}else{const i=flights.findIndex(x=>x.id===editingId);if(i>=0)flights[i]=f}flights.sort(sortF);save();refresh();closeFlight();toast(editingId?'Vol modifié.':'Vol ajouté.')}
function del(id){if(!confirm('Supprimer ce vol ?'))return;flights=flights.filter(f=>f.id!==id);selectedIds.delete(id);save();refresh();toast('Vol supprimé.')}
function duplicate(id){const f=flights.find(x=>x.id===id);if(!f)return;const c=JSON.parse(JSON.stringify(f));c.id=uid();flights.push(c);flights.sort(sortF);save();refresh();openFlight(c.id)}
$('addFlightBtn').onclick=()=>openFlight(null);$('closeModalBtn').onclick=closeFlight;$('cancelFlightBtn').onclick=closeFlight;$('saveFlightBtn').onclick=saveFlight;$('deleteFlightBtn').onclick=()=>editingId&&del(editingId);
$('searchInput').oninput=()=>{currentPage=1;renderTable()};$('filterAircraft').onchange=$('filterType').onchange=$('filterYear').onchange=$('filterRole').onchange=()=>{currentPage=1;renderTable()};$('resetFiltersBtn').onclick=()=>{$('searchInput').value='';$('filterAircraft').value='';$('filterType').value='';$('filterYear').value='';$('filterRole').value='';currentPage=1;renderTable()};$('prevPage').onclick=()=>{if(currentPage>1){currentPage--;renderTable()}};$('nextPage').onclick=()=>{const p=Math.max(1,Math.ceil(filtered().length/PAGE_SIZE));if(currentPage<p){currentPage++;renderTable()}};
$('flightTableBody').addEventListener('click',e=>{const b=e.target.closest('button'),c=e.target.closest('[data-sel]');if(b){if(b.dataset.edit)openFlight(b.dataset.edit);if(b.dataset.del)del(b.dataset.del);if(b.dataset.dup)duplicate(b.dataset.dup)}if(c){c.checked=c.checked;c.checked?selectedIds.add(c.dataset.sel):selectedIds.delete(c.dataset.sel);renderTable()}});
$('selectAll').onchange=()=>{const data=filtered().slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);data.forEach(f=>$('selectAll').checked?selectedIds.add(f.id):selectedIds.delete(f.id));renderTable()};

$('importBtn').onclick=()=>$('importModal').classList.add('open');$('closeImportBtn').onclick=()=>$('importModal').classList.remove('open');$('cancelImportBtn').onclick=()=>$('importModal').classList.remove('open');$('chooseImportFile').onclick=()=>$('csvInput').click();$('csvInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const p=parseFile(await file.text());importHeaders=p.headers;importRows=p.rows;$('importInfo').textContent=`${file.name} · ${importRows.length} lignes · ${importHeaders.length} colonnes`;$('importPreviewWrap').classList.remove('hidden');$('importCount').textContent=importRows.length;$('importCols').textContent=importHeaders.length;const A=new Set(importRows.map(r=>rv(r,importHeaders,['aircraft_aircraftID','registration'])).filter(Boolean));$('importAircraftCount').textContent=A.size;$('importWarnings').textContent=importRows.filter(r=>!rv(r,importHeaders,['flight_flightDate','date'])).length;const hs=importHeaders.slice(0,10);$('importPreviewTable').innerHTML=`<thead><tr>${hs.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${importRows.slice(0,10).map(r=>`<tr>${hs.map(h=>`<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>`;$('confirmImportBtn').disabled=!importRows.length}catch(err){toast('Import impossible : '+err.message)}e.target.value=''};
$('confirmImportBtn').onclick=()=>{const keys=new Set(flights.map(dupKey));let add=0,skip=0;for(const r of importRows){const f=mapRow(r,importHeaders);if(keys.has(dupKey(f))){skip++;continue}flights.push(f);keys.add(dupKey(f));add++}flights.sort(sortF);save();refresh();$('importModal').classList.remove('open');toast(`${add} vol(s) importé(s)${skip?` · ${skip} doublon(s) ignoré(s)`:''}`)};

$('exportCsvBtn').onclick=()=>{const headers=['Date','Entry Type','Flight Number','Departure','Arrival','Actual Departure','Actual Arrival','Aircraft ID','Aircraft Type','SE/ME','Single/Multi Pilot','Total','PIC','SIC','Night','IFR','Day Takeoffs','Night Takeoffs','Day Landings','Night Landings','PIC Name','SIC Name','Instructor','Student','Remarks'];const rows=[headers,...flights.map(f=>[f.date,f.entryType,f.flightNumber,f.from,f.to,f.actualDeparture,f.actualArrival,f.aircraftId,f.aircraftType,f.engineClass,f.pilotMode,f.times.total,f.times.pic,f.times.sic,f.times.night,f.times.ifr,f.operations.dayTakeoffs,f.operations.nightTakeoffs,f.operations.dayLandings,f.operations.nightLandings,f.crew.PIC,f.crew.SIC,f.crew.Instructor,f.crew.Student,f.notes].map(v=>`"${String(v??'').replace(/"/g,'""')}"`))];download('\ufeff'+rows.map(r=>Array.isArray(r)?r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','):r).join('\r\n'),'prevol-carnet.csv','text/csv;charset=utf-8')};
$('exportJsonBtn').onclick=()=>download(JSON.stringify({schema:'prevol-logbook-v2',exportedAt:new Date().toISOString(),flights},null,2),'prevol-carnet-backup.json','application/json');
$('importJsonBtn').onclick=()=>$('jsonInput').click();$('jsonInput').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const j=JSON.parse(await file.text());if(!Array.isArray(j.flights))throw Error('Sauvegarde invalide');const keys=new Set(flights.map(dupKey));let a=0;for(const f of j.flights)if(!keys.has(dupKey(f))){flights.push(f);keys.add(dupKey(f));a++}flights.sort(sortF);save();refresh();toast(`${a} vol(s) restauré(s)`)}catch(err){toast(err.message)}e.target.value=''};
function download(content,name,type){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function easaDate(v){
  if(!v)return'';
  const s=String(v).slice(0,10);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    const[a,b,c]=s.split('-');return`${c}/${b}/${a.slice(-2)}`;
  }
  return dateDisp(v);
}
function escAttr(v){return esc(v).replace(/`/g,'&#096;')}
function safeText(v){return v==null?'':String(v)}
function addMinutes(a,b){return a+b}
function easaRows(){
  // The on-screen carnet is newest-first; the EASA report follows
  // chronological order, matching the supplied LogTen/EASA reference.
  return [...flights].sort((a,b)=>
    String(a.date).localeCompare(String(b.date)) ||
    String(a.actualDeparture).localeCompare(String(b.actualDeparture))
  );
}
// ============ EXPORT EASA-FCL ============
// Modèle : le carnet professionnel LogTen, qui suit la présentation
// réglementaire. Une page est un double feuillet : la moitié gauche (A)
// décrit le vol sur aéronef, la moitié droite (B) les conditions, les
// fonctions et la colonne 11 « Synthetic training devices ».
//
// Point structurant : une séance de simulateur laisse la moitié GAUCHE
// entièrement vide — ni date, ni terrains, ni aéronef — et n'apparaît que
// dans la colonne 11. C'est ainsi que le carnet officiel les présente, et
// c'est ce qui permet aux totaux de temps de vol de rester justes.

function easaCell(v,cls=''){return`<td class="${cls}">${esc(safeText(v)||'')}</td>`}

// Moitié gauche : colonnes 1 à 8 plus décollages et atterrissages (16 cases)
function easaFlightA(f){
  if(isSim(f)){
    // Séance : la ligne existe pour rester en regard de la colonne 11,
    // mais aucune case du vol n'est renseignée.
    return '<tr class="simrow">' + '<td></td>'.repeat(16) + '</tr>';
  }
  const total=f.times?.total||'';
  const multi=f.pilotMode==='Multi-Pilot';
  return `<tr>
    ${easaCell(easaDate(f.date),'date')}
    ${easaCell(f.from,'place')}${easaCell(f.actualDeparture,'hour')}
    ${easaCell(f.to,'place')}${easaCell(f.actualArrival,'hour')}
    ${easaCell(f.aircraftType,'model')}${easaCell(f.aircraftId,'reg')}
    ${easaCell(!multi && f.engineClass==='SE' ? total : '','time')}
    ${easaCell(!multi && f.engineClass==='ME' ? total : '','time')}
    ${easaCell(multi ? total : '','time')}
    ${easaCell(total,'time')}
    ${easaCell(f.crew?.PIC,'name')}
    ${easaCell(f.operations?.dayTakeoffs||'','count')}
    ${easaCell(f.operations?.nightTakeoffs||'','count')}
    ${easaCell(f.operations?.dayLandings||'','count')}
    ${easaCell(f.operations?.nightLandings||'','count')}
  </tr>`;
}

// Moitié droite : colonnes 9 à 12 (11 cases)
function easaFlightB(f){
  const sim=isSim(f);
  return `<tr${sim?' class="simrow"':''}>
    ${easaCell(sim?'':f.times?.night,'time')}
    ${easaCell(sim?'':f.times?.ifr,'time')}
    ${easaCell(sim?'':f.times?.pic,'time')}
    ${easaCell(sim?'':f.times?.p1us,'time')}
    ${easaCell(sim?'':f.times?.sic,'time')}
    ${easaCell(sim?'':f.times?.dualReceived,'time')}
    ${easaCell(sim?'':f.times?.dualGiven,'time')}
    ${easaCell(sim?easaDate(f.date):'','date')}
    ${easaCell(sim?(f.sim?.type||f.aircraftType||''):'','model')}
    ${easaCell(sim?simTotal(f):'','time')}
    ${easaCell(f.sim?.remark||f.notes||'','remark')}
  </tr>`;
}

// ---- Totaux ----
// Chaque colonne chiffrée a sa propre règle : les temps de vol excluent les
// séances, la colonne 11 ne compte qu'elles, les décollages et atterrissages
// se comptent en unités.
const EASA_TIME_COLS = {
  se:      f=>(!isSim(f) && f.pilotMode!=='Multi-Pilot' && f.engineClass==='SE') ? f.times?.total : '',
  me:      f=>(!isSim(f) && f.pilotMode!=='Multi-Pilot' && f.engineClass==='ME') ? f.times?.total : '',
  multi:   f=>(!isSim(f) && f.pilotMode==='Multi-Pilot') ? f.times?.total : '',
  total:   f=>isSim(f)?'':f.times?.total,
  night:   f=>isSim(f)?'':f.times?.night,
  ifr:     f=>isSim(f)?'':f.times?.ifr,
  p1:      f=>isSim(f)?'':f.times?.pic,
  p1us:    f=>isSim(f)?'':f.times?.p1us,
  copilot: f=>isSim(f)?'':f.times?.sic,
  dual:    f=>isSim(f)?'':f.times?.dualReceived,
  instr:   f=>isSim(f)?'':f.times?.dualGiven,
  session: f=>isSim(f)?simTotal(f):''
};
const EASA_COUNT_COLS = {
  toDay:   f=>isSim(f)?0:(f.operations?.dayTakeoffs||0),
  toNight: f=>isSim(f)?0:(f.operations?.nightTakeoffs||0),
  ldgDay:  f=>isSim(f)?0:(f.operations?.dayLandings||0),
  ldgNight:f=>isSim(f)?0:(f.operations?.nightLandings||0)
};

function easaSums(rows){
  const out={};
  for(const k in EASA_TIME_COLS) out[k]=rows.reduce((s,f)=>s+tmin(EASA_TIME_COLS[k](f)),0);
  for(const k in EASA_COUNT_COLS) out[k]=rows.reduce((s,f)=>s+n(EASA_COUNT_COLS[k](f)),0);
  return out;
}
function easaAdd(a,b){const o={};for(const k in a)o[k]=(a[k]||0)+(b[k]||0);return o}
// Une case de total vide s'écrit « --- » dans le carnet officiel
function tt(m){return m>0?fmt(m):'---'}
function tc(v){return v>0?String(v):'---'}

// Conservé pour la couverture et les statistiques
function easaTotalTime(rows,key){
  if(key==='simulator') return fmt(rows.reduce((s,f)=>s+tmin(simTotal(f)),0));
  return fmt(rows.filter(f=>!isSim(f)).reduce((s,f)=>s+tmin(f.times?.[key]),0));
}

function easaPagePair(rows,pageNo,prev,plage){
  const page=easaSums(rows);
  const cum=easaAdd(prev,page);
  const lignesA=rows.map(easaFlightA).join('');
  const lignesB=rows.map(easaFlightB).join('');

  const totauxA=(lib,t)=>`<tr class="totals"><td colspan="7">${lib}</td>
    <td>${tt(t.se)}</td><td>${tt(t.me)}</td><td>${tt(t.multi)}</td><td>${tt(t.total)}</td>
    <td>---</td><td>${tc(t.toDay)}</td><td>${tc(t.toNight)}</td><td>${tc(t.ldgDay)}</td><td>${tc(t.ldgNight)}</td></tr>`;
  const totauxB=(t,derniere)=>`<tr class="totals${derniere?' grand':''}">
    <td>${tt(t.night)}</td><td>${tt(t.ifr)}</td><td>${tt(t.p1)}</td><td>${tt(t.p1us)}</td>
    <td>${tt(t.copilot)}</td><td>${tt(t.dual)}</td><td>${tt(t.instr)}</td>
    <td>---</td><td>---</td><td>${tt(t.session)}</td>
    <td class="remark">${derniere?'<b>I certify that the entries in this log are true.</b><br><br>________________________________<br>PILOT\u2019S SIGNATURE':''}</td></tr>`;

  return `
  <section class="easa-sheet">
    <table class="sheet-table table-a">
      <colgroup><col class="c-date"><col class="c-place"><col class="c-hour"><col class="c-place"><col class="c-hour"><col class="c-model"><col class="c-reg"><col class="c-t"><col class="c-t"><col class="c-t"><col class="c-t"><col class="c-name"><col class="c-n"><col class="c-n"><col class="c-n"><col class="c-n"></colgroup>
      <thead>
        <tr class="grp"><th>1</th><th colspan="2">2</th><th colspan="2">3</th><th colspan="2">4</th><th colspan="2">5</th><th>6</th><th>7</th><th>8</th><th colspan="2">&nbsp;</th><th colspan="2">&nbsp;</th></tr>
        <tr><th rowspan="2">DATE<br><small>(dd/mm/yy)</small></th>
            <th colspan="2">DEPARTURE</th><th colspan="2">ARRIVAL</th>
            <th colspan="2">AIRCRAFT</th>
            <th colspan="2">SINGLE-PILOT</th>
            <th rowspan="2">MULTI-<br>PILOT</th>
            <th rowspan="2">TOTAL<br>TIME OF<br>FLIGHT</th>
            <th rowspan="2">NAME PIC</th>
            <th colspan="2">TAKEOFFS</th><th colspan="2">LANDINGS</th></tr>
        <tr><th>PLACE</th><th>TIME</th><th>PLACE</th><th>TIME</th>
            <th>MAKE, MODEL,<br>VARIANT</th><th>REGISTRATION</th>
            <th>SE</th><th>ME</th>
            <th>DAY</th><th>NIGHT</th><th>DAY</th><th>NIGHT</th></tr>
      </thead>
      <tbody>${lignesA}</tbody>
      <tfoot>
        ${totauxA('TOTAL THIS PAGE',page)}
        ${totauxA('TOTAL FROM PREVIOUS PAGES',prev)}
        ${totauxA('TOTAL TIME',cum)}
      </tfoot>
    </table>
    <div class="sheet-foot">PAGE ${pageNo}A <span>( REPORT: ${esc(plage)} )</span></div>
  </section>

  <section class="easa-sheet">
    <table class="sheet-table table-b">
      <colgroup><col class="c-t"><col class="c-t"><col class="c-t"><col class="c-t"><col class="c-t"><col class="c-t"><col class="c-t"><col class="c-date"><col class="c-model"><col class="c-t"><col class="c-remark"></colgroup>
      <thead>
        <tr class="grp"><th colspan="2">9</th><th colspan="5">10</th><th colspan="3">11</th><th>12</th></tr>
        <tr><th colspan="2">OPERATIONAL<br>CONDITION TIME</th>
            <th colspan="5">PILOT FUNCTION TIME</th>
            <th colspan="3">SYNTHETIC TRAINING<br>DEVICES SESSION</th>
            <th rowspan="2">REMARKS AND<br>ENDORSEMENTS</th></tr>
        <tr><th>NIGHT</th><th>IFR</th>
            <th>P1</th><th>P1 u/s</th><th>CO-PILOT</th><th>DUAL</th><th>INSTRUCTOR</th>
            <th>DATE<br><small>(dd/mm/yy)</small></th><th>TYPE</th><th>TOTAL TIME<br>OF SESSION</th></tr>
      </thead>
      <tbody>${lignesB}</tbody>
      <tfoot>
        ${totauxB(page,false)}
        ${totauxB(prev,false)}
        ${totauxB(cum,true)}
      </tfoot>
    </table>
    <div class="sheet-foot">( REPORT: ${esc(plage)} ) <span>PAGE ${pageNo}B</span></div>
  </section>`;
}

function exportEASA(){
  const rows=easaRows();
  if(!rows.length){toast('Aucun vol à exporter.');return}
  const chunkSize=27, chunks=[];
  for(let i=0;i<rows.length;i+=chunkSize)chunks.push(rows.slice(i,i+chunkSize));
  const from=easaDate(rows[0].date),to=easaDate(rows[rows.length-1].date);
  const total=easaTotalTime(rows,'total');
  const pic=easaTotalTime(rows,'pic');
  const sic=easaTotalTime(rows,'sic');
  const night=easaTotalTime(rows,'night');
  const ifr=easaTotalTime(rows,'ifr');
  const dual=easaTotalTime(rows,'dualReceived');
  const sim=easaTotalTime(rows,'simulator');
  let sheets='';
  // Les totaux se reportent de page en page, comme dans un carnet papier :
  // chaque feuillet affiche son total, celui des pages précédentes, et la somme.
  const plage=from+' - '+to;
  let cumul={};
  chunks.forEach((chunk,i)=>{
    sheets+=easaPagePair(chunk,i+1,cumul,plage);
    cumul=easaAdd(cumul,easaSums(chunk));
  });
  const cover=`<section class="cover">
    <div class="cover-logo">PréVol</div>
    <div class="cover-title">PROFESSIONAL PILOT<br>LOGBOOK</div>
    <div class="cover-sub">EASA-FCL COMPLIANT REPORT</div>
    <div class="cover-range">Entries from: <strong>${esc(from)}</strong> Through: <strong>${esc(to)}</strong></div>
    <div class="cover-stats">
      <div><b>${esc(total)}</b><span>TOTAL TIME</span></div>
      <div><b>${esc(pic)}</b><span>PILOT-IN-COMMAND</span></div>
      <div><b>${esc(sic)}</b><span>CO-PILOT</span></div>
      <div><b>${esc(night)}</b><span>NIGHT</span></div>
      <div><b>${esc(ifr)}</b><span>IFR</span></div>
      <div><b>${esc(sim)}</b><span>SIMULATOR</span></div>
    </div>
  </section>`;
  const w=window.open('','_blank','noopener,noreferrer,width=1400,height=1000');
  if(!w){toast('Le navigateur a bloqué la fenêtre d’export. Autorise les pop-ups pour PréVol.');return}
  w.document.open();
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>PréVol - EASA-FCL Professional Pilot Logbook</title>
  <style>
  @page{size:A4 landscape;margin:7mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif}
  body{font-size:7px}
  .cover{page-break-after:always;height:180mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .cover-logo{font-size:40px;font-weight:800;letter-spacing:-2px;margin-bottom:20mm}
  .cover-title{font-size:21px;font-weight:700;line-height:1.15;letter-spacing:1px}
  .cover-sub{font-size:10px;margin-top:5mm;letter-spacing:1.5px}
  .cover-range{margin-top:12mm;font-size:9px}
  .cover-stats{display:grid;grid-template-columns:repeat(6,1fr);width:90%;gap:3mm;margin-top:15mm}
  .cover-stats div{border:1px solid #222;padding:4mm 2mm}
  .cover-stats b{display:block;font-size:15px}.cover-stats span{display:block;margin-top:1mm;font-size:7px}
  .easa-sheet{page-break-after:always;break-after:page;position:relative}
  /* Le numéro de page figure SOUS le tableau, comme dans le carnet officiel */
  .sheet-foot{font-size:6.5px;margin:1.5mm 0 0;display:flex;justify-content:space-between}
  table{border-collapse:collapse;width:100%;table-layout:fixed}
  .sheet-table{border:1px solid #111}
  th,td{border:1px solid #111;padding:.8mm .6mm;vertical-align:middle;text-align:center;
    height:5.9mm;line-height:1.05;overflow:hidden}
  th{font-size:5.6px;font-weight:700;background:#fff}
  th small{font-size:4.4px;font-weight:400}
  td{font-size:6.4px}
  /* Bandeau des numéros de rubrique EASA (1 à 12) */
  .grp th{height:3.4mm;font-size:6px;font-weight:600;border-bottom:1px solid #111}

  /* Moitié gauche, 16 colonnes */
  .table-a col.c-date{width:6.4%} .table-a col.c-place{width:5.4%} .table-a col.c-hour{width:5%}
  .table-a col.c-model{width:9%} .table-a col.c-reg{width:8%} .table-a col.c-t{width:5.4%}
  .table-a col.c-name{width:13%} .table-a col.c-n{width:3.1%}
  /* Moitié droite, 11 colonnes */
  .table-b col.c-t{width:5.6%} .table-b col.c-date{width:6.6%}
  .table-b col.c-model{width:9%} .table-b col.c-remark{width:29%}

  .name{text-align:left;padding-left:1.2mm;font-size:6px}
  .remark{text-align:left;padding-left:1.2mm;font-size:5.8px}
  .count,.time,.hour,.date{font-variant-numeric:tabular-nums}
  /* Une séance laisse la moitié gauche vide : on garde la hauteur de ligne */
  .simrow td{height:5.9mm}
  tfoot .totals td{font-weight:700;background:#fff}
  tfoot .grand td{font-weight:800}
  tfoot .totals td:first-child{text-align:left;padding-left:1.4mm}
  .table-b tfoot .totals td:first-child{text-align:center;padding-left:0}
  @media print{.easa-sheet{break-inside:avoid}}
  </style></head><body>${cover}${sheets}<script>window.onload=()=>setTimeout(()=>window.print(),350);<\/script></body></html>`);
  w.document.close();
}
const _et=$('f_entryType'); if(_et) _et.addEventListener('change', syncEntryType);
$('easaBtn').onclick=exportEASA;;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('flightModal').classList.contains('open'))closeFlight();if($('importModal').classList.contains('open'))$('importModal').classList.remove('open')}});

load();buildDynamic();refresh();
