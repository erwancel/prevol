// Carnet de vol : import LogTen, filtres, édition, export.
// Base locale propre (clé prevol.logbook.v2), sans interférence avec le
// brouillon de dossier ni les dossiers enregistrés.

const STORAGE_KEY='prevol.logbook.v2';let flights=[],editingId=null,importRows=[],importHeaders=[],currentPage=1;const PAGE_SIZE=50,selectedIds=new Set();
const CREW_FIELDS=[
['PIC','Pilot-in-Command'],['SIC','Co-pilot / SIC'],['Relief','Relief Crew'],['Relief2','Relief Crew 2'],['Relief3','Relief Crew 3'],['Relief4','Relief Crew 4'],['FlightEngineer','Flight Engineer'],['Instructor','Instructor'],['Student','Student'],['Observer','Observer'],['Observer2','Observer 2'],['Purser','Purser'],['FlightAttendant','Flight Attendant'],['FlightAttendant2','Flight Attendant 2'],['FlightAttendant3','Flight Attendant 3'],['FlightAttendant4','Flight Attendant 4'],['Commander','Commander']
];
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
function approaches(data){$('approachRows').innerHTML=Array.from({length:10},(_,i)=>{const a=data?.[i]||{};return`<tr><td style="padding:8px">${i+1}</td><td><input data-ap="${i}" data-f="type" value="${esc(a.type||'')}" style="width:100%;padding:7px"></td><td><input data-ap="${i}" data-f="category" value="${esc(a.category||'')}" style="width:100%;padding:7px"></td><td><input data-ap="${i}" data-f="mode" value="${esc(a.mode||'')}" style="width:100%;padding:7px"></td><td><input data-ap="${i}" data-f="airport" value="${esc(a.airport||'')}" style="width:100%;padding:7px"></td></tr>`}).join('')}
function openFlight(id){editingId=id;const f=id?flights.find(x=>x.id===id):emptyFlight();if(!f)return;buildDynamic();$('modalTitle').textContent=id?'Modifier le vol':'Ajouter un vol';for(const[k,v]of Object.entries({f_date:f.date,f_entryType:f.entryType,f_flightNumber:f.flightNumber,f_from:f.from,f_to:f.to,f_actualDeparture:f.actualDeparture,f_actualArrival:f.actualArrival,f_distance:f.distance,f_route:f.route,f_aircraftId:f.aircraftId,f_aircraftType:f.aircraftType,f_engineClass:f.engineClass,f_pilotMode:f.pilotMode,notes_remarks:f.notes,rawLogTen:f.rawLogTen&&Object.keys(f.rawLogTen).length?JSON.stringify(f.rawLogTen,null,2):''})){if($(k))$(k).value=v||''}CREW_FIELDS.forEach(([k])=>{if($(`crew_${k}`))$(`crew_${k}`).value=f.crew?.[k]||''});TIME_FIELDS.forEach(([k])=>{if($(`t_${k}`))$(`t_${k}`).value=f.times?.[k]||''});OPS_FIELDS.forEach(([k])=>{if($(`ops_${k}`))$(`ops_${k}`).value=f.operations?.[k]??0});approaches(f.approaches);$('duty_on').value=f.duty?.on||'';$('duty_off').value=f.duty?.off||'';$('duty_total').value=f.duty?.total||'';$('duty_rest').value=f.duty?.rest||'';$('duty_fdpStart').value=f.duty?.fdpStart||'';$('duty_fdpEnd').value=f.duty?.fdpEnd||'';$('duty_fdpTotal').value=f.duty?.fdpTotal||'';[['fuel_added','added'],['fuel_burned','burned'],['fuel_diversion','diversion'],['fuel_aboard','aboard'],['fuel_uplift','uplift']].forEach(([a,b])=>$(a).value=f.fuel?.[b]??'');WX_FIELDS.forEach(([k])=>{if($(`wx_${k}`))$(`wx_${k}`).value=f.weather?.[k]||''});PAX_FIELDS.forEach(([k])=>{if($(`pax_${k}`))$(`pax_${k}`).value=f.pax?.[k]??''});if($('f_simDate'))$('f_simDate').value=f.date||'';
 if($('f_simType'))$('f_simType').value=f.sim?.type||f.aircraftType||'';
 if($('f_simTotal'))$('f_simTotal').value=simTotal(f)||'';
 if($('f_simRemark'))$('f_simRemark').value=f.sim?.remark||f.notes||'';
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
 f.date=$('f_date').value;f.flightNumber=$('f_flightNumber').value.trim();f.from=$('f_from').value.toUpperCase();f.to=$('f_to').value.toUpperCase();f.actualDeparture=$('f_actualDeparture').value;f.actualArrival=$('f_actualArrival').value;f.distance=$('f_distance').value;f.route=$('f_route').value.trim();f.aircraftId=$('f_aircraftId').value.toUpperCase();f.aircraftType=$('f_aircraftType').value.trim();f.engineClass=$('f_engineClass').value;f.pilotMode=$('f_pilotMode').value;CREW_FIELDS.forEach(([k])=>f.crew[k]=$(`crew_${k}`).value.trim());TIME_FIELDS.forEach(([k])=>f.times[k]=$(`t_${k}`).value.trim());OPS_FIELDS.forEach(([k])=>f.operations[k]=n($(`ops_${k}`).value));f.approaches=Array.from({length:10},(_,i)=>({type:document.querySelector(`[data-ap="${i}"][data-f="type"]`)?.value||'',category:document.querySelector(`[data-ap="${i}"][data-f="category"]`)?.value||'',mode:document.querySelector(`[data-ap="${i}"][data-f="mode"]`)?.value||'',airport:document.querySelector(`[data-ap="${i}"][data-f="airport"]`)?.value||''}));f.duty={on:$('duty_on').value,off:$('duty_off').value,total:$('duty_total').value,rest:$('duty_rest').value,fdpStart:$('duty_fdpStart').value,fdpEnd:$('duty_fdpEnd').value,fdpTotal:$('duty_fdpTotal').value};f.fuel={added:$('fuel_added').value,burned:$('fuel_burned').value,diversion:$('fuel_diversion').value,aboard:$('fuel_aboard').value,uplift:$('fuel_uplift').value};f.weather=Object.fromEntries(WX_FIELDS.map(([k])=>[k,$(`wx_${k}`).value]));f.pax=Object.fromEntries(PAX_FIELDS.map(([k])=>[k,['count','business'].includes(k)?n($(`pax_${k}`).value):$(`pax_${k}`).value]));f.notes=$('notes_remarks').value;try{f.rawLogTen=JSON.parse($('rawLogTen').value||'{}')}catch{toast('JSON LogTen invalide');return}if(!editingId){flights.push(f)}else{const i=flights.findIndex(x=>x.id===editingId);if(i>=0)flights[i]=f}flights.sort(sortF);save();refresh();closeFlight();toast(editingId?'Vol modifié.':'Vol ajouté.')}
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
function easaCell(v,cls=''){return`<td class="${cls}">${esc(safeText(v)||'')}</td>`}
function easaFlightA(f){
  // Colonnes 1 à 10 du carnet EASA : elles décrivent un vol sur aéronef.
  // Une séance de simulateur n'y figure pas — seule la date est reportée,
  // pour que la ligne reste lisible en regard de la colonne 11.
  if(isSim(f)){
    return `<tr class="simrow">
      ${easaCell(easaDate(f.date),'date')}
      <td class="route"></td><td class="route"></td>
      <td class="aircraft"><div>SIMULATOR</div><span>${esc(f.sim?.type||'')}</span></td>
      <td class="tiny"></td><td class="tiny"></td>
      <td class="tiny"></td><td class="tiny"></td>
      <td class="time"></td>
      <td class="name"></td>
      <td class="count"></td><td class="count"></td><td class="count"></td><td class="count"></td>
    </tr>`;
  }
  const total=f.times?.total||'';
  const sp=f.pilotMode==='Single-Pilot'?total:'';
  const mp=f.pilotMode==='Multi-Pilot'?total:'';
  const se=f.engineClass==='SE'?total:'';
  const me=f.engineClass==='ME'?total:'';
  return `<tr>
    ${easaCell(easaDate(f.date),'date')}
    <td class="route"><div>${esc(f.from||'')}</div><span>${esc(f.actualDeparture||'')}</span></td>
    <td class="route"><div>${esc(f.to||'')}</div><span>${esc(f.actualArrival||'')}</span></td>
    <td class="aircraft"><div>${esc(f.aircraftType||'')}</div><span>${esc(f.aircraftId||'')}</span></td>
    <td class="tiny">${esc(se)}</td><td class="tiny">${esc(me)}</td>
    <td class="tiny">${esc(sp)}</td><td class="tiny">${esc(mp)}</td>
    <td class="time">${esc(total)}</td>
    <td class="name">${esc(f.crew?.PIC||'')}</td>
    <td class="count">${esc(f.operations?.dayTakeoffs||'')}</td>
    <td class="count">${esc(f.operations?.nightTakeoffs||'')}</td>
    <td class="count">${esc(f.operations?.dayLandings||'')}</td>
    <td class="count">${esc(f.operations?.nightLandings||'')}</td>
  </tr>`;
}
function easaFlightB(f){
  const sim = isSim(f) || tmin(f.times?.simulator)>0;
  const funcPIC=!sim && tmin(f.times?.pic)>0;
  const funcSIC=!sim && tmin(f.times?.sic)>0;
  const dual=f.times?.dualReceived||'';
  const instr=f.crew?.Instructor||'';
  const p1us=f.times?.p1us||'';
  const remark=f.notes||'';
  return `<tr>
    <td>${esc(f.times?.night||'')}</td>
    <td>${esc(f.times?.ifr||'')}</td>
    <td>${funcPIC?esc(f.times?.pic||f.times?.total||''):''}</td>
    <td>${funcSIC?esc(f.times?.sic||''):''}</td>
    <td>${esc(dual)}</td>
    <td>${esc(instr)}</td>
    <td>${esc(sim?easaDate(f.date):'')}</td>
    <td>${esc(sim?(f.sim?.type||f.aircraftType||''):'')}</td>
    <td>${esc(sim?simTotal(f):'')}</td>
    <td>${esc(tmin(f.times?.pic)>0?(f.times?.pic||''):'')}</td>
    <td>${esc(p1us)}</td>
    <td class="remark">${esc(remark)}</td>
  </tr>`;
}
function easaTotalTime(rows,key){
  // Le total « simulator » additionne la durée des séances ; les autres
  // totaux ne portent que sur les vols réels, séances exclues.
  if(key==='simulator') return fmt(rows.reduce((s,f)=>s+tmin(simTotal(f)),0));
  return fmt(rows.filter(f=>!isSim(f)).reduce((s,f)=>s+tmin(f.times?.[key]),0));
}
function easaPagePair(rows,pageNo,totalPrevious){
  const a=rows.map(easaFlightA).join('');
  const b=rows.map(easaFlightB).join('');
  const pageTotal=easaTotalTime(rows,'total');
  const pagePIC=easaTotalTime(rows,'pic');
  const pageSIC=easaTotalTime(rows,'sic');
  const pageNight=easaTotalTime(rows,'night');
  const pageIFR=easaTotalTime(rows,'ifr');
  const pageDual=easaTotalTime(rows,'dualReceived');
  const prevTotal=totalPrevious?.total||'---';
  const grandTotal=fmt(tmin(totalPrevious?.minutes||0)+rows.reduce((s,f)=>s+tmin(f.times?.total),0));
  return `
  <section class="easa-sheet">
    <div class="sheet-head">PAGE ${pageNo}A <span>REPORT: ${esc(easaDate(rows[0]?.date)||'')} - ${esc(easaDate(rows[rows.length-1]?.date)||'')}</span></div>
    <table class="sheet-table table-a">
      <thead><tr>
        <th>DATE<br><small>(dd/mm/yy)</small></th>
        <th colspan="2">DEPARTURE / ARRIVAL<br><small>PLACE &nbsp;&nbsp;&nbsp; TIME</small></th>
        <th colspan="4">AIRCRAFT<br><small>MAKE, MODEL, VARIANT / REGISTRATION / SE / ME</small></th>
        <th colspan="2">SINGLE-PILOT / MULTI-PILOT</th>
        <th>TIME<br>OF FLIGHT</th>
        <th>NAME PIC</th>
        <th colspan="4">TAKEOFFS / LANDINGS<br><small>DAY / NIGHT</small></th>
      </tr></thead>
      <tbody>${a}</tbody>
      <tfoot><tr class="totals"><td colspan="8">TOTAL THIS PAGE</td><td>${esc(pageTotal)}</td><td>---</td><td colspan="4">${esc(pageTotal)}</td></tr>
      <tr class="totals"><td colspan="8">TOTAL FROM PREVIOUS PAGES</td><td>${esc(prevTotal)}</td><td>---</td><td colspan="4">---</td></tr>
      <tr class="totals grand"><td colspan="8">TOTAL TIME</td><td>${esc(grandTotal)}</td><td>---</td><td colspan="4">---</td></tr></tfoot>
    </table>
  </section>

  <section class="easa-sheet">
    <div class="sheet-head">PAGE ${pageNo}B <span>REPORT: ${esc(easaDate(rows[0]?.date)||'')} - ${esc(easaDate(rows[rows.length-1]?.date)||'')}</span></div>
    <table class="sheet-table table-b">
      <thead><tr>
        <th colspan="2">OPERATIONAL CONDITION TIME<br><small>NIGHT / IFR</small></th>
        <th colspan="4">PILOT FUNCTION TIME<br><small>PILOT-IN-COMMAND / CO-PILOT / DUAL / INSTRUCTOR</small></th>
        <th colspan="3">SYNTHETIC TRAINING DEVICES<br><small>DATE / TYPE / TOTAL TIME OF SESSION</small></th>
        <th>P1</th><th>P1 u/s</th><th>REMARKS AND ENDORSEMENTS</th>
      </tr></thead>
      <tbody>${b}</tbody>
      <tfoot><tr class="totals"><td colspan="2">${esc(pageNight)} / ${esc(pageIFR)}</td><td>${esc(pagePIC)}</td><td>${esc(pageSIC)}</td><td>${esc(pageDual)}</td><td>---</td><td colspan="3">---</td><td>---</td><td>---</td><td class="remark">I certify that the entries in this log are true.<br><br>______________________________<br>PILOT'S SIGNATURE</td></tr>
      <tr class="totals grand"><td colspan="2">${esc(easaTotalTime(easaRows(),'night'))} / ${esc(easaTotalTime(easaRows(),'ifr'))}</td><td>${esc(easaTotalTime(easaRows(),'pic'))}</td><td>${esc(easaTotalTime(easaRows(),'sic'))}</td><td>${esc(easaTotalTime(easaRows(),'dualReceived'))}</td><td>---</td><td colspan="3">${esc(easaTotalTime(easaRows(),'simulator'))}</td><td>---</td><td>---</td><td></td></tr></tfoot>
    </table>
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
  let cumulativeMinutes=0;
  chunks.forEach((chunk,i)=>{
    sheets+=easaPagePair(chunk,i+1,{total:fmt(cumulativeMinutes),minutes:cumulativeMinutes});
    cumulativeMinutes+=chunk.reduce((s,f)=>s+tmin(f.times?.total),0);
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
  .sheet-head{font-size:6px;color:#555;margin:0 0 2mm 1mm;text-transform:uppercase}
  .sheet-head span{float:right}
  table{border-collapse:collapse;width:100%;table-layout:fixed}
  .sheet-table{border:1px solid #111}
  th,td{border:1px solid #111;padding:1.1mm .9mm;vertical-align:middle;text-align:center;height:6.4mm;line-height:1.05}
  th{font-size:6px;font-weight:700;background:#f7f7f7}
  th small{font-size:4.5px;font-weight:400}
  td{font-size:6.5px}
  .table-a th:nth-child(1){width:7%}.table-a th:nth-child(2),.table-a th:nth-child(3){width:9%}
  .table-a th:nth-child(4){width:14%}.table-a th:nth-child(5),.table-a th:nth-child(6),.table-a th:nth-child(7),.table-a th:nth-child(8){width:4%}
  .table-a th:nth-child(9){width:5%}.table-a th:nth-child(10){width:10%}
  .table-a th:nth-child(11),.table-a th:nth-child(12),.table-a th:nth-child(13),.table-a th:nth-child(14){width:3.5%}
  .route span,.aircraft span{display:block;font-size:5px;color:#444}
  .name{text-align:left;padding-left:1.4mm}.remark{text-align:left;padding-left:1.4mm}
  .count,.tiny{font-variant-numeric:tabular-nums}
  tfoot .totals td{font-weight:700;background:#f4f4f4}
  tfoot .grand td{font-weight:800}
  .table-b th{height:10mm}
  .table-b td{height:6.4mm}
  .table-b tfoot td{height:10mm}
  @media print{.easa-sheet{break-inside:avoid}}
  </style></head><body>${cover}${sheets}<script>window.onload=()=>setTimeout(()=>window.print(),350);<\/script></body></html>`);
  w.document.close();
}
const _et=$('f_entryType'); if(_et) _et.addEventListener('change', syncEntryType);
$('easaBtn').onclick=exportEASA;;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('flightModal').classList.contains('open'))closeFlight();if($('importModal').classList.contains('open'))$('importModal').classList.remove('open')}});

load();buildDynamic();refresh();
