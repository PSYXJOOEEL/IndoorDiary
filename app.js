const $ = s => document.querySelector(s);
const app = $('#app');
const modal = $('#modal');
const KEY = 'indoorDiaryV2';
const OLD_KEY = 'indoorDiaryV1';
const SUPABASE_URL = 'https://aslfyuhzbazgtcvzkwef.supabase.co';
const SUPABASE_KEY = 'sb_publishable_0in1Q2EZfe7NP1pO9BPguw_TRhiVM7d';
const cloud = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
let currentUser = null;
let cloudReady = false;
let cloudStatus = 'Local';
let cloudTimer = null;
let isLoadingCloud = false;
let tab = 'home';
let filter = 'Todos';
let state = load();
let saveErrorShown = false;
document.addEventListener('click', ev=>{const item=ev.target.closest('[data-photo-view]'); if(item){ev.preventDefault(); openPhotoViewer(decodeURIComponent(item.dataset.photoView), item.dataset.photoName || 'foto-indoor');}});

function demo(){
  return {
    settings:{start:'2026-06-18',phase:'Vegetativo',light:'18/6',on:'00:00',off:'18:00',tent:'Mars Hydro 120x60x180',lamp:'TSL2000',pots:'19L',substrate:'Janeco Light Mix'},
    fertilizers:[
      {id:1,name:'Bio Grow',unit:'ml/L',notes:'Crecimiento',color:'🟢'},
      {id:2,name:'Bio Bloom',unit:'ml/L',notes:'Floración',color:'🌸'},
      {id:3,name:'Top Max',unit:'ml/L',notes:'Estimulador',color:'⚡'},
      {id:4,name:'CalMag',unit:'ml/L',notes:'Calcio y magnesio',color:'🧱'},
      {id:5,name:'Bio Heaven',unit:'ml/L',notes:'Complemento',color:'✨'}
    ],
    plants:['Runtz x Layer Cake','Purple Punch x Lemon Drizzle','Sour Diesel','Cherry Poppers'].map((n,i)=>({id:i+1,name:n,genetic:n,phase:'Plántula',height:i?2:3,notes:'Sin incidencias',status:'Correcta',iconPhoto:'',emoji:['🌱','🌿','☘️','🪴'][i]})),
    entries:[
      {id:1,date:'2026-06-18',type:'Nota',plants:[1,2,3,4],notes:'Pasadas a mini macetas de 0,2L.',ph:'6.2',ec:'',temp:'24',hum:'70',fertilizers:[]},
      {id:2,date:'2026-06-19',type:'Riego',plants:[1,2,3,4],notes:'Pulverizado suave alrededor del tallo.',liters:'0.1',ph:'6.2',ec:'',temp:'25',hum:'68',fertilizers:[]}
    ],
    results:[]
  };
}
function migrate(s){
  const d = demo();
  if(!s || typeof s !== 'object') s = d;
  s.settings = {...d.settings, ...(s.settings||{})};
  s.plants = Array.isArray(s.plants) ? s.plants : [];
  s.entries = Array.isArray(s.entries) ? s.entries : [];
  s.fertilizers = Array.isArray(s.fertilizers) ? s.fertilizers : d.fertilizers;
  s.results = Array.isArray(s.results) ? s.results : [];
  s.plants = s.plants.map((p,i)=>({
    id:+p.id || i+1,
    name:p.name || 'Planta sin nombre',
    genetic:p.genetic || p.name || 'Sin genética',
    phase:p.phase || 'Plántula',
    height:p.height || '',
    notes:p.notes || '',
    status:p.status || 'Correcta',
    iconPhoto:p.iconPhoto || '',
    emoji:p.emoji || '🌱'
  }));
  s.fertilizers = s.fertilizers.map((f,i)=>({
    id:+f.id || i+1,
    name:f.name || 'Fertilizante sin nombre',
    unit:f.unit || 'ml/L',
    notes:f.notes || '',
    color:f.color || '🧪'
  }));
  s.entries = s.entries.map((e,i)=>({
    id:+e.id || Date.now()+i,
    date:e.date || new Date().toISOString().slice(0,10),
    type:e.type || 'Nota',
    plants:Array.isArray(e.plants)?e.plants.map(Number).filter(Boolean):[],
    notes:e.notes || '',
    liters:e.liters || '', ph:e.ph || '', ec:e.ec || '', temp:e.temp || '', hum:e.hum || '', height:e.height || '',
    fertilizers:Array.isArray(e.fertilizers)?e.fertilizers.map(x=>({id:+x.id, amount:x.amount||'', unit:x.unit||''})).filter(x=>x.id):[],
    photos:Array.isArray(e.photos)?e.photos:(e.photo?[e.photo]:[]),
    photo:''
  }));
  s.entries.forEach(e=>{ e.photo=e.photos[0]||''; });
  s.results = s.results.map((r,i)=>({
    id:+r.id || Date.now()+i,
    date:r.date || new Date().toISOString().slice(0,10),
    plantId:+r.plantId || '',
    wet:r.wet || '', dry:r.dry || '', final:r.final || '', days:r.days || '', quality:r.quality || '', notes:r.notes || '',
    photos:Array.isArray(r.photos)?r.photos:(r.photo?[r.photo]:[]),
    photo:''
  }));
  s.results.forEach(r=>{ r.photo=r.photos[0]||''; });
  return s;
}
function load(){
  try{return migrate(JSON.parse(localStorage.getItem(KEY)) || JSON.parse(localStorage.getItem(OLD_KEY)) || demo())}catch{return demo()}
}
function save(){
  try{
    localStorage.setItem(KEY, JSON.stringify(state));
  }catch(err){
    console.error('No se pudieron guardar los datos', err);
    if(!saveErrorShown){
      saveErrorShown = true;
      alert('Aviso: el navegador no ha podido guardar los datos. Puede que haya demasiadas fotos pesadas. Exporta una copia JSON desde Ajustes y elimina o reduce fotos si hace falta.');
    }
  }
  scheduleCloudSave();
}
function scheduleCloudSave(){
  if(!cloudReady || !currentUser || isLoadingCloud) return;
  clearTimeout(cloudTimer);
  cloudTimer=setTimeout(saveToCloud, 900);
}
async function saveToCloud(){
  if(!cloud || !currentUser) return;
  try{
    cloudStatus='Guardando nube...'; updateCloudBadge();
    const payload={user_id: currentUser.id, data: state, updated_at: new Date().toISOString()};
    const {error}=await cloud.from('app_states').upsert(payload,{onConflict:'user_id'});
    if(error) throw error;
    cloudStatus='Sincronizado'; updateCloudBadge();
  }catch(err){
    console.error('Error guardando en Supabase', err);
    cloudStatus='Error nube'; updateCloudBadge();
  }
}
async function loadFromCloud(){
  if(!cloud || !currentUser) return;
  try{
    isLoadingCloud=true; cloudStatus='Cargando nube...'; updateCloudBadge();
    const {data,error}=await cloud.from('app_states').select('data,updated_at').eq('user_id',currentUser.id).maybeSingle();
    if(error) throw error;
    if(data && data.data){
      state=migrate(data.data);
      localStorage.setItem(KEY, JSON.stringify(state));
      cloudStatus='Sincronizado';
    }else{
      cloudStatus='Creando copia nube...';
      await cloud.from('app_states').upsert({user_id: currentUser.id, data: state, updated_at:new Date().toISOString()},{onConflict:'user_id'});
      cloudStatus='Sincronizado';
    }
  }catch(err){
    console.error('Error cargando Supabase', err); cloudStatus='Error nube';
    alert('No se pudo cargar la nube. Revisa que hayas ejecutado el SQL de setup en Supabase. La app seguirá en modo local.');
  }finally{isLoadingCloud=false; updateCloudBadge(); render();}
}
function updateCloudBadge(){
  const el=document.querySelector('#cloudStatus');
  if(el) el.textContent=cloudStatus;
}
async function initCloud(){
  if(!cloud){ cloudStatus='Sin Supabase'; return; }
  const {data}=await cloud.auth.getSession();
  currentUser=data?.session?.user || null;
  cloudReady=!!currentUser;
  if(currentUser) await loadFromCloud(); else {cloudStatus='Local'; updateCloudBadge();}
  cloud.auth.onAuthStateChange(async (_event, session)=>{
    currentUser=session?.user || null; cloudReady=!!currentUser;
    if(currentUser) await loadFromCloud(); else {cloudStatus='Local'; render();}
  });
}
async function signInEmail(email=null,password=null){
  email = email || document.querySelector('#authEmail')?.value?.trim();
  password = password || document.querySelector('#authPassword')?.value;
  if(!email || !password){ alert('Escribe email y contraseña.'); return; }
  setAuthMessage('Entrando...');
  const {error}=await cloud.auth.signInWithPassword({email,password});
  if(error) setAuthMessage('No se pudo iniciar sesión: '+error.message, true);
  else setAuthMessage('Sesión iniciada. Cargando tus datos...');
}
async function signUpEmail(email=null,password=null){
  email = email || document.querySelector('#authEmail')?.value?.trim();
  password = password || document.querySelector('#authPassword')?.value;
  if(!email || !password){ alert('Escribe email y contraseña.'); return; }
  if(password.length < 6){ alert('La contraseña debe tener mínimo 6 caracteres.'); return; }
  setAuthMessage('Creando cuenta...');
  const {error}=await cloud.auth.signUp({email,password});
  if(error) setAuthMessage('No se pudo crear la cuenta: '+error.message, true);
  else setAuthMessage('Cuenta creada. Si Supabase pide confirmación, revisa tu email.');
}
function setAuthMessage(text, danger=false){
  const el=document.querySelector('#authMessage');
  if(el){ el.textContent=text; el.classList.toggle('danger-text', !!danger); }
}
async function signInProvider(provider){
  const {error}=await cloud.auth.signInWithOAuth({provider, options:{redirectTo: location.origin + location.pathname}});
  if(error) alert('No se pudo iniciar con '+provider+': '+error.message);
}
async function signOut(){
  if(!cloud) return;
  await cloud.auth.signOut();
}
function days(){return Math.max(0, Math.floor((new Date()-new Date(state.settings.start))/(864e5))+1)}
function dateTxt(d){return new Date(d+'T12:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'})}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function plantNames(ids=[]){let names=ids.map(id=>state.plants.find(p=>p.id==id)?.name).filter(Boolean);return names.length?names.join(', '):'Sin planta asignada'}
function plantAvatar(p){return p.iconPhoto?`<img src="${p.iconPhoto}" alt="${esc(p.name)}">`:esc(p.emoji||'🌱')}
function photoGallery(list=[], alt='Foto'){
  return (list||[]).length ? `<div class="photo-gallery">${(list||[]).map((src,i)=>`<button type="button" class="photo-item" data-photo-view="${encodeURIComponent(src)}" data-photo-name="${esc(alt)}-${i+1}"><img class="thumb" src="${src}" alt="${esc(alt)}"><span>Ver / descargar</span></button>`).join('')}</div>` : '';
}
function dataUrlToBlob(dataUrl){
  const parts=String(dataUrl).split(',');
  if(parts.length<2) return new Blob([dataUrl],{type:'text/plain'});
  const match=parts[0].match(/data:([^;]+)/);
  const mime=match?match[1]:'image/jpeg';
  const bin=atob(parts[1]);
  const len=bin.length;
  const bytes=new Uint8Array(len);
  for(let i=0;i<len;i++) bytes[i]=bin.charCodeAt(i);
  return new Blob([bytes],{type:mime});
}
function safeFileName(name='foto-indoor'){
  return String(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'') || 'foto-indoor';
}
function photoObjectUrl(src){
  try{ return URL.createObjectURL(dataUrlToBlob(src)); }catch{ return src; }
}
function downloadPhoto(src,name='foto-indoor'){
  const url=photoObjectUrl(src);
  const a=document.createElement('a');
  a.href=url;
  a.download=safeFileName(name)+'.jpg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>{try{URL.revokeObjectURL(url)}catch{}}, 2000);
}
function openPhotoInNewTab(src){
  const url=photoObjectUrl(src);
  const win=window.open('', '_blank');
  if(win){
    win.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Foto Indoor Diary</title><style>html,body{margin:0;background:#050208;height:100%;display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="${url}" alt="Foto"></body></html>`);
    win.document.close();
  }else{
    location.href=url;
  }
}
function openPhotoViewer(src,name='foto-indoor'){
  modal.classList.remove('hidden');
  modal.innerHTML=`<div class="sheet photo-viewer"><button class="close" type="button">Cerrar</button><h3>Foto</h3><div class="big-photo-wrap"><img class="big-photo" src="${src}" alt="Foto ampliada"></div><div class="photo-actions"><button class="primary" type="button" id="downloadPhotoBtn">Descargar</button><button class="primary ghost" type="button" id="openPhotoNew">Abrir grande</button></div><p class="hint">La foto se guarda con buena calidad. En iPhone, si el botón Descargar no abre Fotos directamente, pulsa “Abrir grande” y mantén pulsada la imagen para guardarla.</p></div>`;
  modal.querySelector('.close').onclick=()=>modal.classList.add('hidden');
  modal.querySelector('#downloadPhotoBtn').onclick=()=>downloadPhoto(src,name);
  modal.querySelector('#openPhotoNew').onclick=()=>openPhotoInNewTab(src);
}
function compressImageDataUrl(dataUrl, maxSize=2600, quality=0.92){
  return new Promise(resolve=>{
    if(!String(dataUrl).startsWith('data:image/')) return resolve(dataUrl);
    const img=new Image();
    img.onload=()=>{
      let w=img.width, h=img.height;
      const scale=Math.min(1, maxSize/Math.max(w,h));
      w=Math.round(w*scale); h=Math.round(h*scale);
      const canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror=()=>resolve(dataUrl);
    img.src=dataUrl;
  });
}
function readFileAsDataUrl(file){
  return new Promise(res=>{const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>res(''); r.readAsDataURL(file);});
}
function fileListToDataUrls(files, cb){
  const arr=[...files];
  if(!arr.length){cb([]);return;}
  Promise.all(arr.map(async file=>compressImageDataUrl(await readFileAsDataUrl(file)))).then(list=>cb(list.filter(Boolean)));
}
function nextPlantId(){return Math.max(0,...state.plants.map(p=>+p.id||0))+1}
function nextFertId(){return Math.max(0,...state.fertilizers.map(f=>+f.id||0))+1}
function nextResultId(){return Math.max(0,...state.results.map(r=>+r.id||0))+1}
function icon(t){return {Riego:'💧',Foto:'📸',Fertilizante:'🧪',Nota:'📝',Ambiente:'🌡️'}[t]||'📝'}
function fertText(list=[]){
  return list.map(x=>{let f=state.fertilizers.find(a=>a.id==x.id);return f?`${f.color||'🧪'} ${esc(f.name)} ${esc(x.amount||'')} ${esc(x.unit||f.unit||'')}`:''}).filter(Boolean).join(' · ');
}
function num(v){const n=parseFloat(String(v||'').replace(',','.'));return isNaN(n)?0:n}
function resultWeight(r){return num(r.final || r.dry)}
function totalDry(){return state.results.reduce((a,r)=>a+resultWeight(r),0)}
function bestResult(){return [...state.results].sort((a,b)=>resultWeight(b)-resultWeight(a))[0]}
function render(){
  save();
  $('#todayText').textContent = new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  $('#phasePill').textContent = state.settings.phase + (currentUser ? ' · ☁️' : '');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab==tab));
  app.innerHTML = views[tab]();
  bind();
}
const views = {
  home(){return `<section class="hero"><p>Día de cultivo</p><h2>${days()}</h2><p>${esc(state.settings.phase)} · Luz ${esc(state.settings.light)} · ${esc(state.settings.on)}-${esc(state.settings.off)}</p></section><div class="grid"><div class="card"><div class="metric">24°C</div><div class="label">Temperatura objetivo</div></div><div class="card"><div class="metric">65%</div><div class="label">Humedad objetivo</div></div><div class="quick" data-add="Riego"><span>💧</span>Riego</div><div class="quick" data-add="Foto"><span>📸</span>Foto</div></div><div class="section-title"><h3>Tus plantas</h3><button class="small-btn" data-tabgo="plants">Ver</button></div>${state.plants.map(plantMini).join('')}<div class="section-title"><h3>Recordatorios</h3></div><div class="card">💧 Próximo riego: revisar sustrato hoy<br>📸 Próxima foto: cada 2-3 días<br>🧪 Fertilizantes creados: ${state.fertilizers.length}</div>`},
  diary(){let items=state.entries.filter(e=>filter=='Todos'||e.type==filter).sort((a,b)=>b.id-a.id);let addType=filter=='Todos'?'Nota':filter;let helper=filter=='Fertilizante'?`<div class="custom-card compact"><h4>🧪 Productos personalizados</h4><p>Para crear un producto nuevo ve a Personal → Fertilizantes. Aquí “Añadir” crea un registro de aplicación usando los productos ya creados.</p><button class="small-btn" data-tabgo="customize">Crear o editar fertilizantes</button></div>`:'';return `<div class="section-title"><h3>Diario</h3><button class="small-btn" data-add="${addType}">Añadir</button></div><div class="filters">${['Todos','Riego','Foto','Fertilizante','Nota','Ambiente'].map(f=>`<button class="filter ${filter==f?'active':''}" data-filter="${f}">${f}</button>`).join('')}</div>${helper}${items.length?items.map(entryCard).join(''):'<div class="empty">Aún no hay registros.</div>'}<button class="fab" data-add="${addType}">+</button>`},
  plants(){return `<div class="section-title"><h3>Plantas</h3><button class="small-btn" id="addPlant">+ Planta</button></div>${state.plants.length?state.plants.map(plantCard).join(''):'<div class="empty">No hay plantas. Añade una para empezar.</div>'}`},
  customize(){return `<div class="section-title"><h3>Personalizar</h3><button class="small-btn" id="addFert">+ Fertilizante</button></div><div class="custom-card"><h4>🧪 Fertilizantes y productos</h4><p>Crea tus propios fertilizantes, ponles icono, unidad y notas. Luego aparecerán como casillas seleccionables al crear un riego o registro.</p><div class="custom-actions"><button class="small-btn" id="addFertTop">Crear fertilizante</button></div></div>${state.fertilizers.length?state.fertilizers.map(fertCard).join(''):'<div class="empty">No hay fertilizantes creados. Pulsa “Crear fertilizante”.</div>'}<div class="custom-card"><h4>☘️ Plantas</h4><p>Las plantas también son personalizables: nombre, genética, fase, altura, notas y foto/icono.</p><div class="custom-actions"><button class="small-btn" data-tabgo="plants">Ir a plantas</button></div></div>`},
  results(){let best=bestResult();let total=totalDry();let avg=state.results.length?(total/state.results.length).toFixed(1):'0';return `<div class="section-title"><h3>Resultados</h3><button class="small-btn" id="addResult">+ Resultado</button></div><section class="hero results-hero"><p>Producción total registrada</p><h2>${total.toFixed(1)} g</h2><p>${state.results.length} resultado(s) · Media ${avg} g/planta</p></section><div class="grid"><div class="card"><div class="metric">${best?esc(plantNames([best.plantId])):'—'}</div><div class="label">Mejor planta</div></div><div class="card"><div class="metric">${best?esc(best.final||best.dry||0)+' g':'0 g'}</div><div class="label">Mayor peso final/seco</div></div></div><div class="section-title"><h3>Historial de cosecha</h3></div>${state.results.length?state.results.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(resultCard).join(''):'<div class="empty">Aún no hay resultados. Cuando coseches, guarda aquí gramos, calidad y fotos finales.</div>'}`},
  settings(){let s=state.settings;return `<div class="section-title"><h3>Ajustes</h3></div><div class="card"><label>Fecha germinación</label><input id="setStart" type="date" value="${esc(s.start)}"><label>Fase</label><input id="setPhase" value="${esc(s.phase)}"><div class="row"><div><label>Encendido</label><input id="setOn" value="${esc(s.on)}"></div><div><label>Apagado</label><input id="setOff" value="${esc(s.off)}"></div></div><label>Armario</label><input id="setTent" value="${esc(s.tent)}"><label>Luz</label><input id="setLamp" value="${esc(s.lamp)}"><label>Sustrato</label><input id="setSub" value="${esc(s.substrate)}"><button class="primary" id="saveSettings">Guardar ajustes</button></div>${accountCard()}<div class="card"><button class="primary" data-tabgo="customize">Abrir personalización</button><p class="hint">La app guarda copia local y, si inicias sesión, sincroniza una copia completa en Supabase.</p><button class="primary" id="exportData">Exportar JSON</button><input id="importFile" type="file" accept="application/json"><button class="primary danger" id="clearEntries">Borrar todo el diario</button><button class="primary danger" id="resetDemo">Resetear demo</button></div>`}
};
function plantMini(p){return `<div class="plant-card"><div class="avatar">${plantAvatar(p)}</div><div><h4>${esc(p.name)}</h4><p>${esc(p.phase)} · ${p.height||0} cm</p><div class="progress"><div class="bar" style="width:${Math.min(100,(p.height||1)*9)}%"></div></div></div><span class="tag">${esc(p.status)}</span></div>`}
function plantCard(p){return `<div class="plant-card"><div class="avatar">${plantAvatar(p)}</div><div><h4>${esc(p.name)}</h4><p>${esc(p.genetic)}</p><p>${esc(p.phase)} · ${p.height||0} cm · ${esc(p.notes||'')}</p></div><div class="plant-actions"><button class="small-btn" data-viewplant="${p.id}">Diario</button><button class="small-btn" data-editplant="${p.id}">Editar</button><button class="small-btn danger ghost" data-delplant="${p.id}">Borrar planta</button></div></div>`}
function fertCard(f){return `<div class="fert-card"><div class="fert-icon">${esc(f.color||'🧪')}</div><div><h4>${esc(f.name)}</h4><p>${esc(f.unit||'ml/L')} · ${esc(f.notes||'Sin notas')}</p></div><div class="plant-actions"><button class="small-btn" data-editfert="${f.id}">Editar</button><button class="small-btn danger ghost" data-delfert="${f.id}">Borrar</button></div></div>`}
function entryCard(e){let ft=fertText(e.fertilizers||[]);return `<article class="entry"><div class="entry-head"><span class="tag">${icon(e.type)} ${esc(e.type)}</span><span class="date">${dateTxt(e.date)}</span></div><p><b>${esc(plantNames(e.plants))}</b></p><p>${esc(e.notes||'')}</p><p>${[e.liters&&esc(e.liters)+'L',e.ph&&'pH '+esc(e.ph),e.ec&&'EC '+esc(e.ec),e.temp&&esc(e.temp)+'°C',e.hum&&esc(e.hum)+'% HR',e.height&&'Altura '+esc(e.height)+' cm'].filter(Boolean).join(' · ')}</p>${ft?`<div class="fert-used"><b>Fertilizantes:</b> ${ft}</div>`:''}${photoGallery(e.photos||[],'Foto del registro')}<div class="entry-actions"><button class="small-btn" data-editentry="${e.id}">Editar</button><button class="small-btn danger ghost" data-delentry="${e.id}">Borrar registro</button></div></article>`}
function resultCard(r){return `<article class="entry result-card"><div class="entry-head"><span class="tag">🏆 Resultado</span><span class="date">${dateTxt(r.date)}</span></div><p><b>${esc(plantNames([r.plantId]))}</b></p><p>${[r.wet&&'Húmedo '+esc(r.wet)+' g',r.dry&&'Seco '+esc(r.dry)+' g',r.final&&'Final '+esc(r.final)+' g',r.days&&esc(r.days)+' días',r.quality&&'Calidad '+esc(r.quality)+'/10'].filter(Boolean).join(' · ')}</p><p>${esc(r.notes||'')}</p>${photoGallery(r.photos||[],'Foto final')}<div class="entry-actions"><button class="small-btn" data-editresult="${r.id}">Editar</button><button class="small-btn danger ghost" data-delresult="${r.id}">Borrar</button></div></article>`}

function accountCard(){
  if(!cloud) return `<div class="card"><h3>Cuenta y nube</h3><p class="hint">No se cargó Supabase. Revisa conexión a internet.</p></div>`;
  if(currentUser){
    return `<div class="card account-card connected-card"><div class="connected-icon">✓</div><h3>Cuenta conectada</h3><p><b>${esc(currentUser.email || 'Cuenta conectada')}</b></p><p class="hint">Estado: <span id="cloudStatus">${esc(cloudStatus)}</span>. Tus plantas, diario, fertilizantes, resultados y fotos se sincronizan con Supabase.</p><button class="primary" id="syncNow">Sincronizar ahora</button><button class="primary danger" id="logoutBtn">Cerrar sesión</button></div>`;
  }
  return `<section class="login-hero">
    <div class="login-glow"></div>
    <div class="login-brand">
      <div class="login-logo">☾</div>
      <div><p class="eyebrow">Indoor Diary Cloud</p><h2>Bienvenido de nuevo</h2></div>
    </div>
    <p class="login-subtitle">Inicia sesión para sincronizar tu diario entre iPhone, PC y cualquier dispositivo.</p>
    <div class="social-grid">
      <button class="social-btn" id="loginGoogle"><span class="google-dot">G</span> Google</button>
      <button class="social-btn" id="loginApple"><span></span> Apple</button>
    </div>
    <div class="divider"><span>o entra con email</span></div>
    <div class="auth-form">
      <label>Email</label>
      <input id="authEmail" type="email" autocomplete="email" placeholder="tu@email.com">
      <label>Contraseña</label>
      <input id="authPassword" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres">
      <button class="primary" id="loginEmail">Iniciar sesión</button>
      <button class="primary ghost" id="signupEmail">Crear cuenta nueva</button>
      <p id="authMessage" class="auth-message"></p>
    </div>
    <div class="security-row">
      <span>🔒 Datos privados por cuenta</span>
      <span>☁️ Copia en nube</span>
      <span>📱 iPhone ready</span>
    </div>
    <p class="hint">Face ID se añadirá después como Passkey/WebAuthn cuando la app esté publicada con HTTPS y dominio estable.</p>
  </section>`;
}

function bind(){
  document.querySelectorAll('[data-tabgo],.nav-btn').forEach(b=>b.onclick=()=>{tab=b.dataset.tabgo||b.dataset.tab;render()});
  document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render()});
  document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openEntry(b.dataset.add));
  document.querySelectorAll('[data-viewplant]').forEach(b=>b.onclick=()=>openPlantDetail(+b.dataset.viewplant));
  document.querySelectorAll('[data-editplant]').forEach(b=>b.onclick=()=>openPlant(+b.dataset.editplant));
  document.querySelectorAll('[data-delplant]').forEach(b=>b.onclick=()=>deletePlant(+b.dataset.delplant));
  document.querySelectorAll('[data-editentry]').forEach(b=>b.onclick=()=>openEntry(null,+b.dataset.editentry));
  document.querySelectorAll('[data-delentry]').forEach(b=>b.onclick=()=>deleteEntry(+b.dataset.delentry));
  document.querySelectorAll('[data-editfert]').forEach(b=>b.onclick=()=>openFert(+b.dataset.editfert));
  document.querySelectorAll('[data-delfert]').forEach(b=>b.onclick=()=>deleteFert(+b.dataset.delfert));
  let ap=$('#addPlant'); if(ap) ap.onclick=()=>openPlant();
  let af=$('#addFert'); if(af) af.onclick=()=>openFert(); let aft=$('#addFertTop'); if(aft) aft.onclick=()=>openFert();
  let ar=$('#addResult'); if(ar) ar.onclick=()=>openResult();
  document.querySelectorAll('[data-editresult]').forEach(b=>b.onclick=()=>openResult(+b.dataset.editresult));
  document.querySelectorAll('[data-delresult]').forEach(b=>b.onclick=()=>deleteResult(+b.dataset.delresult));
  let ss=$('#saveSettings'); if(ss) ss.onclick=()=>{Object.assign(state.settings,{start:$('#setStart').value,phase:$('#setPhase').value,on:$('#setOn').value,off:$('#setOff').value,tent:$('#setTent').value,lamp:$('#setLamp').value,substrate:$('#setSub').value});render()};
  let ex=$('#exportData'); if(ex) ex.onclick=()=>{let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download='indoor-diary.json';a.click()};
  let im=$('#importFile'); if(im) im.onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{state=migrate(JSON.parse(r.result));render()}catch{alert('JSON no válido')}};r.readAsText(f)};
  let ce=$('#clearEntries'); if(ce) ce.onclick=()=>confirm('¿Borrar TODOS los registros del diario? Las plantas, fertilizantes y ajustes se conservan.')&&(state.entries=[],render());
  let rs=$('#resetDemo'); if(rs) rs.onclick=()=>confirm('¿Resetear datos?')&&(state=demo(),render());
  let lg=$('#loginGoogle'); if(lg) lg.onclick=()=>signInProvider('google');
  let la=$('#loginApple'); if(la) la.onclick=()=>signInProvider('apple');
  let le=$('#loginEmail'); if(le) le.onclick=()=>signInEmail();
  let se=$('#signupEmail'); if(se) se.onclick=()=>signUpEmail();
  let apw=$('#authPassword'); if(apw) apw.onkeydown=(ev)=>{if(ev.key==='Enter') signInEmail();};
  let lo=$('#logoutBtn'); if(lo) lo.onclick=()=>signOut();
  let sn=$('#syncNow'); if(sn) sn.onclick=()=>saveToCloud();
}
function fertRowsHtml(entry, context){
  if(!state.fertilizers.length){
    return '<p class="hint">No tienes fertilizantes creados. Ve a Personalizar → Crear fertilizante.</p>';
  }
  return state.fertilizers.map(f=>{
    const used=(entry.fertilizers||[]).find(x=>+x.id===+f.id);
    return `<div class="fert-select"><label><input type="checkbox" class="eFert" data-context="${context}" value="${f.id}" ${used?'checked':''}> ${esc(f.color||'🧪')} ${esc(f.name)}</label><input class="fertAmount" data-context="${context}" data-fertid="${f.id}" placeholder="Cantidad" value="${esc(used?.amount||'')}"><span>${esc(f.unit||'ml/L')}</span></div>`;
  }).join('');
}
function selectedFertilizers(context){
  return [...modal.querySelectorAll(`.eFert[data-context="${context}"]:checked`)].map(ch=>{
    const id=+ch.value;
    const f=state.fertilizers.find(x=>+x.id===id);
    const amount=modal.querySelector(`.fertAmount[data-context="${context}"][data-fertid="${id}"]`)?.value||'';
    return {id,amount,unit:f?.unit||'ml/L'};
  });
}
function openEntry(type='Nota',entryId=null, forcedPlantId=null){
  const editing=entryId!==null;
  const e=editing?state.entries.find(x=>x.id==entryId):{id:Date.now(),type:type||'Nota',date:new Date().toISOString().slice(0,10),plants:forcedPlantId?[forcedPlantId]:state.plants.map(p=>p.id),notes:'',liters:'',ph:'',ec:'',temp:'',hum:'',height:'',photo:'',photos:[],fertilizers:[]};
  if(!e)return;
  modal.classList.remove('hidden');
  const types=['Riego','Foto','Fertilizante','Nota','Ambiente'];
  modal.innerHTML = `<div class="sheet"><button class="close">Cerrar</button><h3>${editing?'Editar registro':'Nuevo registro'}</h3>
    <label>Tipo</label><select id="eType">${types.map(t=>`<option ${t==e.type?'selected':''}>${t}</option>`).join('')}</select>
    <label>Fecha</label><input id="eDate" type="date" value="${esc(e.date)}">
    <label>Plantas</label><div class="checks">${state.plants.length?state.plants.map(pl=>`<label><input type="checkbox" class="ePlant" value="${pl.id}" ${(e.plants||[]).includes(pl.id)||(!editing&&!forcedPlantId)?'checked':''}> ${esc(pl.name)}</label>`).join(''):'<p class="hint">No hay plantas creadas.</p>'}</div>
    <label id="notesLabel">Notas</label><textarea id="eNotes">${esc(e.notes||'')}</textarea>

    <div class="type-fields" data-for="Riego">
      <div class="hint">Riego completo: agua, pH/EC, productos usados y foto opcional del momento.</div>
      <div class="row"><input id="eLiters" placeholder="Litros de agua" value="${esc(e.liters||'')}"><input id="ePh" placeholder="pH" value="${esc(e.ph||'')}"><input id="eEc" placeholder="EC" value="${esc(e.ec||'')}"></div>
      <div class="row"><input id="eTemp" placeholder="Temp °C opcional" value="${esc(e.temp||'')}"><input id="eHum" placeholder="Humedad % opcional" value="${esc(e.hum||'')}"></div>
      <label>Fertilizantes usados en este riego</label><button type="button" class="small-btn ghost create-fert-inline" data-createfert="Riego">+ Crear fertilizante</button><div class="fert-box">${fertRowsHtml(e,'riego')}</div>
      ${(e.photos||[]).length?`${photoGallery(e.photos,'Fotos actuales')}<button class="small-btn danger ghost" id="removeEntryPhoto">Quitar fotos del registro</button>`:''}
      <label>Foto opcional del riego</label><input id="ePhoto" type="file" accept="image/*" multiple><p class="hint">Puedes hacer fotos o elegirlas de la galería. Puedes seleccionar varias.</p>
    </div>

    <div class="type-fields" data-for="Foto">
      <div class="hint">Registro visual para LST, poda, evolución o detalles. Sin datos de riego.</div>
      ${(e.photos||[]).length?`${photoGallery(e.photos,'Fotos actuales')}<button class="small-btn danger ghost" id="removeEntryPhotoFoto">Quitar fotos del registro</button>`:''}
      <label>Añadir foto</label><input id="ePhotoFoto" type="file" accept="image/*" multiple><p class="hint">Puedes hacer fotos o elegirlas de la galería. Puedes seleccionar varias.</p>
    </div>

    <div class="type-fields" data-for="Fertilizante">
      <div class="hint">Registro solo de productos aplicados y cantidad. Sin litros, pH ni EC.</div>
      <label>Productos aplicados</label><button type="button" class="small-btn ghost create-fert-inline" data-createfert="Fertilizante">+ Crear fertilizante</button><div class="fert-box">${fertRowsHtml(e,'fertilizante')}</div>
    </div>

    <div class="type-fields" data-for="Nota"><div class="hint">Nota libre: observaciones, tareas hechas o recordatorios.</div></div>

    <div class="type-fields" data-for="Ambiente">
      <div class="hint">Registro de clima del indoor.</div>
      <div class="row"><input id="eTempOnly" placeholder="Temperatura °C" value="${esc(e.temp||'')}"><input id="eHumOnly" placeholder="Humedad %" value="${esc(e.hum||'')}"></div>
    </div>

    <button class="primary" id="saveEntry">${editing?'Guardar cambios':'Guardar'}</button>${editing?'<button class="primary danger" id="deleteEntryModal">Borrar este registro</button>':''}</div>`;
  modal.querySelector('.close').onclick=()=>modal.classList.add('hidden');
  let removePhoto=false;
  ['#removeEntryPhoto','#removeEntryPhotoFoto'].forEach(sel=>{const b=modal.querySelector(sel); if(b)b.onclick=()=>{removePhoto=true;b.textContent='Foto marcada para quitar';};});
  const updateFormForType=()=>{
    const t=modal.querySelector('#eType').value;
    modal.querySelectorAll('.type-fields').forEach(box=>box.style.display=(box.dataset.for===t)?'block':'none');
    const data={
      Riego:['Notas del riego','Ej. Riego suave, drenaje, aspecto tras regar...'],
      Foto:['Nota de la foto','Ej. LST, poda, evolución visual, detalle de hojas...'],
      Fertilizante:['Notas de fertilización','Ej. Productos aplicados y reacción observada...'],
      Nota:['Notas','Escribe una observación, tarea o recordatorio...'],
      Ambiente:['Notas del ambiente','Ej. Temperatura estable, humedad alta, ventilación...']
    }[t];
    modal.querySelector('#notesLabel').textContent=data[0];
    modal.querySelector('#eNotes').placeholder=data[1];
  };
  modal.querySelector('#eType').onchange=updateFormForType; updateFormForType();
  modal.querySelectorAll('[data-createfert]').forEach(btn=>btn.onclick=()=>{const currentType=modal.querySelector('#eType').value; openFert(null, currentType);});
  const saveWithPhotos=(base,inputSel)=>{
    const files=modal.querySelector(inputSel)?.files||[];
    const finish=(newPhotos=[])=>{
      const kept=removePhoto?[]:(e.photos||[]);
      base.photos=[...kept,...newPhotos];
      base.photo=base.photos[0]||'';
      if(editing) Object.assign(e,base); else state.entries.push(base);
      filter=base.type;
      modal.classList.add('hidden'); tab='diary'; render();
    };
    fileListToDataUrls(files, finish);
  };
  modal.querySelector('#saveEntry').onclick=()=>{
    const selectedType=modal.querySelector('#eType').value;
    const val=id=>modal.querySelector(id)?.value||'';
    const base={id:e.id,type:selectedType,date:val('#eDate')||new Date().toISOString().slice(0,10),plants:[...modal.querySelectorAll('.ePlant:checked')].map(x=>+x.value),notes:val('#eNotes'),liters:'',ph:'',ec:'',temp:'',hum:'',height:'',photo:'',photos:[],fertilizers:[]};
    if(selectedType==='Riego'){
      base.liters=val('#eLiters'); base.ph=val('#ePh'); base.ec=val('#eEc'); base.temp=val('#eTemp'); base.hum=val('#eHum'); base.fertilizers=selectedFertilizers('riego');
      return saveWithPhotos(base,'#ePhoto');
    }
    if(selectedType==='Foto') return saveWithPhotos(base,'#ePhotoFoto');
    if(selectedType==='Fertilizante') base.fertilizers=selectedFertilizers('fertilizante');
    if(selectedType==='Ambiente'){base.temp=val('#eTempOnly'); base.hum=val('#eHumOnly');}
    if(editing) Object.assign(e,base); else state.entries.push(base);
    filter=selectedType;
    modal.classList.add('hidden'); tab='diary'; render();
  };
  const de=modal.querySelector('#deleteEntryModal'); if(de) de.onclick=()=>deleteEntry(e.id);
}
function deleteEntry(id){let e=state.entries.find(x=>x.id==id);if(!e)return;if(!confirm(`¿Borrar este registro de ${e.type} del ${dateTxt(e.date)}?`))return;state.entries=state.entries.filter(x=>x.id!=id);modal.classList.add('hidden');tab='diary';render()}
function openFert(id, returnEntryType=null){
  let isNew=!id; let f=isNew?{id:nextFertId(),name:'',unit:'ml/L',notes:'',color:'🧪'}:state.fertilizers.find(x=>x.id==id); if(!f)return;
  modal.classList.remove('hidden');
  modal.innerHTML=`<div class="sheet"><button class="close">Cerrar</button><h3>${isNew?'Crear fertilizante':'Editar fertilizante'}</h3><label>Nombre del fertilizante/producto</label><input id="fName" value="${esc(f.name)}" placeholder="Ej. Bio Grow, CalMag, Root Juice..."><label>Unidad de cantidad</label><select id="fUnit">${['ml/L','ml','g/L','g','gotas/L','otro'].map(u=>`<option ${u==(f.unit||'ml/L')?'selected':''}>${u}</option>`).join('')}</select><label>Icono/color</label><input id="fColor" value="${esc(f.color||'🧪')}" maxlength="4" placeholder="🧪"><label>Notas</label><textarea id="fNotes" placeholder="Para qué lo usas, dosis habitual, etc.">${esc(f.notes||'')}</textarea><button class="primary" id="saveFert">${isNew?'Crear':'Guardar'}</button>${!isNew?'<button class="primary danger" id="deleteFertModal">Borrar fertilizante</button>':''}</div>`;
  $('.close').onclick=()=>modal.classList.add('hidden');
  $('#saveFert').onclick=()=>{const name=$('#fName').value.trim(); if(!name){alert('Pon un nombre al fertilizante/producto.'); return;} Object.assign(f,{name,unit:$('#fUnit').value,notes:$('#fNotes').value,color:$('#fColor').value||'🧪'}); if(isNew) state.fertilizers.push(f); save(); modal.classList.add('hidden'); if(returnEntryType){openEntry(returnEntryType); return;} tab='customize'; render();};
  let df=$('#deleteFertModal'); if(df) df.onclick=()=>deleteFert(f.id);
}
function deleteFert(id){let f=state.fertilizers.find(x=>x.id==id);if(!f)return;if(!confirm(`¿Borrar "${f.name}"? También se quitará de registros anteriores.`))return;state.fertilizers=state.fertilizers.filter(x=>x.id!=id);state.entries.forEach(e=>e.fertilizers=(e.fertilizers||[]).filter(x=>x.id!=id));modal.classList.add('hidden');tab='customize';render()}
function openPlant(id){let isNew=!id;let p=isNew?{id:nextPlantId(),name:'',genetic:'',phase:'Plántula',height:0,notes:'',status:'Correcta',emoji:'🌱',iconPhoto:''}:state.plants.find(x=>x.id==id);modal.classList.remove('hidden');modal.innerHTML=`<div class="sheet"><button class="close">Cerrar</button><h3>${isNew?'Añadir planta':'Editar planta'}</h3><label>Nombre</label><input id="pName" value="${esc(p.name)}" placeholder="Ej. Critical Kush"><label>Genética</label><input id="pGen" value="${esc(p.genetic)}" placeholder="Variedad/genética"><div class="row"><div><label>Fase</label><input id="pPhase" value="${esc(p.phase)}"></div><div><label>Altura cm</label><input id="pHeight" type="number" value="${p.height||0}"></div></div><label>Estado</label><input id="pStatus" value="${esc(p.status||'Correcta')}"><label>Icono emoji</label><input id="pEmoji" value="${esc(p.emoji||'🌱')}" maxlength="4" placeholder="🌱"><label>Foto de icono personalizada</label><input id="pIcon" type="file" accept="image/*"><div class="preview-avatar avatar" id="pPreview">${plantAvatar(p)}</div>${p.iconPhoto?'<button class="small-btn danger ghost" id="removePlantPhoto">Quitar foto de icono</button>':''}<label>Notas</label><textarea id="pNotes">${esc(p.notes||'')}</textarea><button class="primary" id="savePlant">${isNew?'Añadir planta':'Guardar planta'}</button>${!isNew?'<button class="primary danger" id="deletePlantModal">Borrar esta planta</button>':''}</div>`;$('.close').onclick=()=>modal.classList.add('hidden');let removePlantPhoto=false;let rpp=$('#removePlantPhoto');if(rpp)rpp.onclick=()=>{removePlantPhoto=true;p.iconPhoto='';$('#pPreview').innerHTML=esc($('#pEmoji').value||'🌱');rpp.textContent='Foto marcada para quitar'};let pi=$('#pIcon');if(pi)pi.onchange=()=>{let file=pi.files[0];if(!file)return;let r=new FileReader();r.onload=()=>{$('#pPreview').innerHTML=`<img src="${r.result}" alt="Vista previa">`};r.readAsDataURL(file)};let savePlant=photo=>{Object.assign(p,{name:$('#pName').value||'Planta sin nombre',genetic:$('#pGen').value||$('#pName').value||'Sin genética',phase:$('#pPhase').value,height:$('#pHeight').value,notes:$('#pNotes').value,status:$('#pStatus').value,emoji:$('#pEmoji').value||'🌱'});if(removePlantPhoto)p.iconPhoto='';else if(photo!==undefined)p.iconPhoto=photo;if(isNew)state.plants.push(p);modal.classList.add('hidden');tab='plants';render()};$('#savePlant').onclick=()=>{let file=$('#pIcon').files[0];if(file){let r=new FileReader();r.onload=()=>savePlant(r.result);r.readAsDataURL(file)}else savePlant()};let dm=$('#deletePlantModal');if(dm)dm.onclick=()=>deletePlant(p.id)}
function openPlantDetail(id){let p=state.plants.find(x=>x.id==id);if(!p)return;let entries=state.entries.filter(e=>(e.plants||[]).includes(id)).sort((a,b)=>b.id-a.id);modal.classList.remove('hidden');modal.innerHTML=`<div class="sheet"><button class="close">Cerrar</button><h3>${esc(p.name)}</h3><div class="plant-card detail-card"><div class="avatar">${plantAvatar(p)}</div><div><h4>${esc(p.name)}</h4><p>${esc(p.phase)} · ${p.height||0} cm</p><p>${esc(p.notes||'Sin notas')}</p></div></div><button class="primary" id="addEntryForPlant">Añadir registro a esta planta</button><h3>Registros de esta planta</h3>${entries.length?entries.map(entryCard).join(''):'<div class="empty">Esta planta todavía no tiene registros.</div>'}</div>`;$('.close').onclick=()=>modal.classList.add('hidden');$('#addEntryForPlant').onclick=()=>{modal.classList.add('hidden');openEntry('Nota',null,id)};modal.querySelectorAll('[data-editentry]').forEach(b=>b.onclick=()=>openEntry(null,+b.dataset.editentry));modal.querySelectorAll('[data-delentry]').forEach(b=>b.onclick=()=>deleteEntry(+b.dataset.delentry))}
function deletePlant(id){let p=state.plants.find(x=>x.id==id);if(!p)return;if(!confirm(`¿Borrar "${p.name}"? Sus registros del diario se conservarán, pero dejarán de estar asociados a esta planta.`))return;state.plants=state.plants.filter(x=>x.id!=id);state.entries.forEach(e=>e.plants=(e.plants||[]).filter(pid=>pid!=id));state.results.forEach(r=>{if(r.plantId==id)r.plantId=''});modal.classList.add('hidden');tab='plants';render()}

function openResult(id=null){
  const editing=id!==null;
  let r=editing?state.results.find(x=>x.id==id):{id:nextResultId(),date:new Date().toISOString().slice(0,10),plantId:state.plants[0]?.id||'',wet:'',dry:'',final:'',days:days(),quality:'',notes:'',photo:'',photos:[]};
  if(!r)return;
  modal.classList.remove('hidden');
  modal.innerHTML=`<div class="sheet"><button class="close">Cerrar</button><h3>${editing?'Editar resultado':'Nuevo resultado de cosecha'}</h3>
    <label>Planta</label><select id="rPlant">${state.plants.length?state.plants.map(p=>`<option value="${p.id}" ${+p.id===+r.plantId?'selected':''}>${esc(p.name)}</option>`).join(''):'<option value="">Sin plantas creadas</option>'}</select>
    <label>Fecha de cosecha / resultado</label><input id="rDate" type="date" value="${esc(r.date)}">
    <div class="row"><input id="rWet" type="number" step="0.1" placeholder="Peso húmedo g" value="${esc(r.wet||'')}"><input id="rDry" type="number" step="0.1" placeholder="Peso seco g" value="${esc(r.dry||'')}"></div>
    <div class="row"><input id="rFinal" type="number" step="0.1" placeholder="Peso final curado g" value="${esc(r.final||'')}"><input id="rDays" type="number" placeholder="Días de cultivo" value="${esc(r.days||days())}"></div>
    <label>Calidad del resultado</label><select id="rQuality"><option value="">Sin valorar</option>${[1,2,3,4,5,6,7,8,9,10].map(n=>`<option value="${n}" ${String(r.quality||'')===String(n)?'selected':''}>${n}/10</option>`).join('')}</select>
    ${(r.photos||[]).length?`${photoGallery(r.photos,'Fotos actuales')}<button class="small-btn danger ghost" id="removeResultPhoto">Quitar fotos</button>`:''}
    <label>Foto final opcional</label><input id="rPhoto" type="file" accept="image/*" multiple>
    <label>Notas del resultado</label><textarea id="rNotes" placeholder="Aroma, estructura, secado, curado, observaciones...">${esc(r.notes||'')}</textarea>
    <button class="primary" id="saveResult">${editing?'Guardar cambios':'Guardar resultado'}</button>${editing?'<button class="primary danger" id="deleteResultModal">Borrar resultado</button>':''}</div>`;
  modal.querySelector('.close').onclick=()=>modal.classList.add('hidden');
  let removePhoto=false; const rp=$('#removeResultPhoto'); if(rp) rp.onclick=()=>{removePhoto=true; rp.textContent='Foto marcada para quitar';};
  const finish=(newPhotos=[])=>{const kept=removePhoto?[]:(r.photos||[]); const photos=[...kept,...newPhotos]; Object.assign(r,{plantId:+$('#rPlant').value||'',date:$('#rDate').value||new Date().toISOString().slice(0,10),wet:$('#rWet').value,dry:$('#rDry').value,final:$('#rFinal').value,days:$('#rDays').value,quality:$('#rQuality').value,notes:$('#rNotes').value,photos,photo:photos[0]||''}); if(!editing) state.results.push(r); modal.classList.add('hidden'); tab='results'; render();};
  $('#saveResult').onclick=()=>{fileListToDataUrls($('#rPhoto').files||[], finish);};
  const dr=$('#deleteResultModal'); if(dr) dr.onclick=()=>deleteResult(r.id);
}
function deleteResult(id){let r=state.results.find(x=>x.id==id);if(!r)return;if(!confirm(`¿Borrar resultado de ${plantNames([r.plantId])}?`))return;state.results=state.results.filter(x=>x.id!=id);modal.classList.add('hidden');tab='results';render()}

render();
initCloud();
