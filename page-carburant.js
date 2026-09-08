// Script propre à la page Carburant (bloc <script id="fuel-page-script">).
// Extrait pour que carburant.html ait la même structure que les autres pages.

(function(){
  function byId(id){return document.getElementById(id);}
  function n(id){const e=byId(id); const v=parseFloat(e && e.value); return Number.isFinite(v)?v:0;}
  function fmt(v,d){return Number.isFinite(v)?v.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
  function hm(min){
    if(!Number.isFinite(min)) return '—';
    const m=Math.max(0,Math.round(min));
    return Math.floor(m/60)+' h '+String(m%60).padStart(2,'0')+' min';
  }
  function formatAircraftFuelInfo(a){
    const trip = fmt(a.consoTrip,1);
    const appr = fmt(a.consoAppr,1);
    const capacity = String(a.fuelCapacityNote || (fmt(a.fuelCapacity,0)+' L')).trim().replace(/\s+/g,' ');
    const max = fmt(a.fuelCapacity,0);
    return `Consommation : ${trip} L/h · approche : ${appr} L/h · capacité : ${capacity} (max ${max} L)`;
  }
  function syncAircraft(key){
    if(typeof applyAircraft==='function') applyAircraft(key);
    const a=(typeof getAircraft==='function')?getAircraft(key):null;
    if(!a) return;
    const info=byId('fuelAircraftInfo');
    if(info) info.textContent=formatAircraftFuelInfo(a);
    const f=byId('fuelOnBoard'); if(f) f.max=a.fuelCapacity;
    calculate();
  }
  function populateAircraft(){
    const sel=byId('fuelAircraftSelect');
    if(!sel || typeof allAircraft!=='function') return;
    const all=allAircraft(); const keys=Object.keys(all).sort();
    sel.innerHTML=keys.map(k=>'<option value="'+k.replace(/"/g,'&quot;')+'">'+(all[k].label||k)+'</option>').join('');
    const main=byId('aircraftSelect');
    const current=main && main.value && all[main.value] ? main.value : keys[0];
    sel.value=current;
    sel.addEventListener('change',()=>syncAircraft(sel.value));
    syncAircraft(current);
  }
  function calculate(){
    const flightTime=n('flightTime');
    const reserve=n('reserveType') || 30;
    const fuelOnBoard=n('fuelOnBoard');
    const consoTrip=n('consoTrip');
    const consoAppr=n('consoAppr');
    const density=n('fuelDensity');
    if(!(flightTime>0) || !(fuelOnBoard>=0) || !(consoTrip>0)){
      byId('fuelTripResult').textContent='—'; byId('fuelMinResult').textContent='—'; byId('fuelEnduranceResult').textContent='—'; byId('fuelMarginResult').textContent='—';
      byId('fuelStatus').className='fuel-status'; byId('fuelStatus').textContent='Renseignez le temps de vol et le fuel embarqué puis lancez le calcul.';
      return;
    }
    const tripFuel=(flightTime/60)*consoTrip + (10/60)*consoAppr;
    const contingency=(5/60)*consoTrip;
    const reserveL=(reserve/60)*consoTrip;
    const minRequired=tripFuel+contingency+reserveL;
    const endurance=fuelOnBoard/consoTrip*60;
    const margin=(fuelOnBoard-minRequired)/consoTrip*60;
    byId('fuelTripResult').innerHTML=fmt(tripFuel,1)+'<span class="unit">L</span>';
    byId('fuelMinResult').innerHTML=fmt(minRequired,1)+'<span class="unit">L</span>';
    byId('fuelEnduranceResult').innerHTML=hm(endurance);
    byId('fuelMarginResult').innerHTML=(margin>=0?'+':'−')+hm(Math.abs(margin));
    const status=byId('fuelStatus');
    if(fuelOnBoard>=minRequired){
      status.className='fuel-status ok';
      status.textContent='GO carburant : '+fmt(fuelOnBoard-minRequired,1)+' L de marge au-dessus du minimum réglementaire.';
    }else{
      status.className='fuel-status bad';
      status.textContent='NOGO carburant : il manque '+fmt(minRequired-fuelOnBoard,1)+' L pour atteindre le minimum réglementaire.';
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    populateAircraft();
    const b=byId('fuelCalculateBtn'); if(b) b.addEventListener('click',calculate);
    ['flightTime','reserveType','fuelOnBoard'].forEach(id=>{const e=byId(id); if(e) e.addEventListener('input',calculate); if(e) e && e.addEventListener('change',calculate);});
  });
})();
