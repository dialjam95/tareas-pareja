import {firebaseConfig,VAPID_KEY} from './firebase-config.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {initializeFirestore,persistentLocalCache,doc,collection,setDoc,updateDoc,deleteDoc,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {getMessaging,getToken,isSupported} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';
const $=id=>document.getElementById(id);
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=initializeFirestore(app,{localCache:persistentLocalCache()});
const DEF=['Comprar','Llamar','Reservar','Pagar','Limpiar','Arreglar','Revisar'];
const ST=[['pendiente','Pendiente'],['curso','En curso'],['hecha','Hecha']];
let tasks=[],L={acciones:null,personas:[]},filtro='todas',vista=localStorage.getItem('vista')||'lista',q='',cerr=new Set(['hecha']),unsubs=[],timer,editId=null,tt;
const LS=k=>localStorage.getItem(k)||'',yo=()=>LS('yo');
const acc=()=>L.acciones&&L.acciones.length?L.acciones:DEF;
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const opt=(v,t)=>{const o=el('option',null,t);o.value=v;return o};
const setSel=(s,v)=>{if(v&&![...s.options].some(o=>o.value===v))s.append(opt(v,v));s.value=v};
const pad=n=>String(n).padStart(2,'0');
const toInput=ms=>{const d=new Date(ms);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
function rel(ms){const h=new Date(ms).toLocaleTimeString('es',{hour:'numeric',minute:'2-digit'});
  const a=new Date();a.setHours(0,0,0,0);const b=new Date(ms);b.setHours(0,0,0,0);const n=Math.round((b-a)/864e5);
  if(n===0)return 'Hoy '+h;if(n===1)return 'Mañana '+h;if(n===-1)return 'Ayer '+h;
  if(n>1&&n<7)return new Date(ms).toLocaleDateString('es',{weekday:'long'})+' '+h;
  return new Date(ms).toLocaleDateString('es',{day:'numeric',month:'short'})+' '+h}
const fail=e=>alert('No se pudo guardar: '+(e.message||e));
const saveL=()=>setDoc(doc(db,'config','listas'),{acciones:acc(),personas:L.personas}).catch(fail);
function toast(msg,undo){const t=$('toast');t.replaceChildren(el('span',null,msg));
  if(undo){const b=el('button',null,'Deshacer');b.onclick=()=>{undo();t.hidden=true};t.append(b)}
  t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,6000)}

function siguiente(t){const d=new Date(t.fechaMs);
  do{if(t.repite==='diaria')d.setDate(d.getDate()+1);else if(t.repite==='semanal')d.setDate(d.getDate()+7);else d.setMonth(d.getMonth()+1)}while(d.getTime()<=Date.now());
  return d.getTime()}
function setEstado(t,e){
  updateDoc(doc(db,'tasks',t.id),{estado:e}).catch(fail);
  if(e==='hecha'&&t.estado!=='hecha'&&t.repite&&t.fechaMs){
    const {id,...r}=t;
    setDoc(doc(collection(db,'tasks')),{...r,fechaMs:siguiente(t),estado:'pendiente',notificada:false,avisarAsignacion:false,creada:Date.now()}).catch(fail);
    toast('Se programó la siguiente repetición');
  }}

const late=t=>t.fechaMs&&t.estado!=='hecha'&&t.fechaMs<Date.now();
const av=n=>{const s=el('span','av',(n||'?')[0].toUpperCase());s.style.background=`hsl(${[...(n||'?')].reduce((a,c)=>a+c.charCodeAt(0),0)*47%360} 50% 46%)`;return s};
const who=n=>{const w=el('span','who');if(n)w.append(av(n),el('span',null,n));else w.append(el('span','mu','Sin asignar'));return w};
const fecha=t=>t.fechaMs?el('span','dt'+(late(t)?' late':''),(t.repite?'🔁 ':'')+rel(t.fechaMs)+(late(t)?' (vencida)':'')):el('span','mu','Sin fecha');
const pill=t=>{const b=el('button','pill s-'+t.estado,(ST.find(x=>x[0]===t.estado)||ST[0])[1]);
  b.onclick=e=>{e.stopPropagation();setEstado(t,ST[(ST.findIndex(x=>x[0]===t.estado)+1)%3][0])};return b};
const SVG='fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const ICO_OK=`<svg viewBox="0 0 24 24" width="20" height="20" ${SVG}><circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/></svg>`;
const ICO_RM=`<svg viewBox="0 0 24 24" width="18" height="18" ${SVG}><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg>`;
let porBorrar=null;
function pedirBorrar(t){porBorrar=t;$('cdt').textContent='«'+t.cosa+'»';$('cdel').showModal()}
const acciones=t=>{const w=el('span','ia'),hecha=t.estado==='hecha';
  const ok=el('button','ic ok'+(hecha?' on':''));ok.innerHTML=ICO_OK;ok.title=hecha?'Reabrir tarea':'Marcar como hecha';ok.setAttribute('aria-label',ok.title);
  ok.onclick=e=>{e.stopPropagation();setEstado(t,hecha?'pendiente':'hecha')};
  const rm=el('button','ic rm');rm.innerHTML=ICO_RM;rm.title='Borrar tarea';rm.setAttribute('aria-label','Borrar tarea');
  rm.onclick=e=>{e.stopPropagation();pedirBorrar(t)};
  w.append(ok,rm);return w};
const byFecha=(a,b)=>(a.fechaMs||9e15)-(b.fechaMs||9e15);

function fila(t){
  const tr=el('tr','t'+(t.estado==='hecha'?' hecha':''));tr.onclick=e=>{if(!e.target.closest('button,input'))abrir(t)};
  const cell=(l,c)=>{const td=el('td');td.dataset.l=l;td.append(c);tr.append(td)};
  cell('Tarea',el('strong','ct',t.cosa));cell('Acción',el('span','tag',t.accion));cell('Encargado',who(t.encargado));
  cell('Recordatorio',fecha(t));cell('Estado',pill(t));cell('',acciones(t));return tr}
function tarjeta(t){
  const c=el('div','cd'+(t.estado==='hecha'?' hecha':''));c.draggable=true;
  c.ondragstart=e=>e.dataTransfer.setData('text/plain',t.id);c.onclick=e=>{if(!e.target.closest('button,input'))abrir(t)};
  const r1=el('div','r'),r2=el('div','r');
  r1.append(el('span','tag',t.accion),fecha(t));r2.append(who(t.encargado),pill(t),acciones(t));
  c.append(el('strong','ct',t.cosa),r1,r2);return c}

function chips(box,arr,isP){box.replaceChildren(...arr.map(v=>{const c=el('span','chip',v),b=el('button',null,'✕');b.setAttribute('aria-label','Quitar '+v);
  b.onclick=()=>{if(isP)L.personas=L.personas.filter(x=>x!==v);else L.acciones=acc().filter(x=>x!==v);saveL()};c.append(b);return c}))}
function navItem(k,label,n,pre){const b=el('button',filtro===k?'on':'');if(pre)b.append(pre);b.append(el('span',null,label),el('span','n',String(n)));b.onclick=()=>{filtro=k;render()};return b}

function render(){
  const va=$('acc').value,vp=$('per').value;
  $('acc').replaceChildren(...acc().map(x=>opt(x,x)));
  $('per').replaceChildren(...(L.personas.length?L.personas:['']).map(x=>opt(x,x||'(añade personas en Ajustes)')));
  if(va)setSel($('acc'),va);if(vp)setSel($('per'),vp);
  $('yo').replaceChildren(opt('','(elige)'),...L.personas.map(x=>opt(x,x)));$('yo').value=yo();
  chips($('cp'),L.personas,true);chips($('ca'),acc(),false);
  const pend=tasks.filter(t=>t.estado!=='hecha');
  // navegación lateral
  const nav=[el('div','sec','Vistas'),navItem('todas','Todas',pend.length)];
  if(yo())nav.push(navItem('mias','Mis tareas',pend.filter(t=>t.encargado===yo()).length));
  nav.push(navItem('vencidas','Vencidas',tasks.filter(late).length));
  if(L.personas.length)nav.push(el('div','sec','Personas'),...L.personas.map(p=>navItem('p:'+p,p,pend.filter(t=>t.encargado===p).length,av(p))));
  $('nav').replaceChildren(...nav);
  $('seg').replaceChildren(...[['lista','☰ Lista'],['tablero','▦ Tablero']].map(([k,n])=>{const b=el('button',vista===k?'on':'',n);b.onclick=()=>{vista=k;localStorage.setItem('vista',k);render()};return b}));
  $('lst').hidden=vista!=='lista';$('bd').hidden=vista!=='tablero';
  // filtro + búsqueda
  const pasa=t=>filtro==='todas'||(filtro==='mias'&&t.encargado===yo())||(filtro==='vencidas'&&late(t))||(filtro.startsWith('p:')&&t.encargado===filtro.slice(2));
  const base=tasks.filter(pasa),ql=q.trim().toLowerCase();
  const v=ql?base.filter(t=>(t.cosa+' '+t.accion+' '+(t.encargado||'')).toLowerCase().includes(ql)):base;
  $('ttl').textContent=filtro==='todas'?'Todas las tareas':filtro==='mias'?'Mis tareas':filtro==='vencidas'?'Vencidas':filtro.slice(2);
  $('sub').textContent=v.length+(v.length===1?' tarea':' tareas');
  const n=e=>base.filter(t=>t.estado===e).length,nl=base.filter(late).length;
  $('stats').replaceChildren(...[['Pendientes',n('pendiente')],['En curso',n('curso')],['Vencidas',nl],['Hechas',n('hecha')]].map(([l,c])=>{
    const d=el('div','sc'),b=el('b',l==='Vencidas'&&c?'late':'',String(c));d.append(b,el('span',null,l));return d}));
  $('pg').style.width=(base.length?Math.round(n('hecha')/base.length*100):0)+'%';
  $('qh').textContent=`Se creará como «${LS('ultAcc')||acc()[0]}» para ${yo()||L.personas[0]||'nadie'}.`+(L.personas.length&&!yo()?' Elige quién eres en Ajustes para recibir solo tus avisos.':'');
  // lista agrupada por estado
  const rows=[];
  ST.forEach(([g,lbl])=>{const it=v.filter(t=>t.estado===g).sort(byFecha);if(!it.length)return;
    const tr=el('tr','gh'),td=el('td');td.colSpan=6;
    td.append(el('span','dot s-'+g),el('span',null,(cerr.has(g)?'▸ ':'▾ ')+lbl),el('span','n',String(it.length)));
    tr.onclick=()=>{cerr.has(g)?cerr.delete(g):cerr.add(g);render()};tr.append(td);rows.push(tr);
    if(!cerr.has(g))it.forEach(t=>rows.push(fila(t)))});
  if(!v.length){const tr=el('tr'),td=el('td','mu','Nada por aquí todavía. Escribe una tarea arriba o pulsa «Nueva tarea».');td.colSpan=6;td.style.textAlign='center';td.style.padding='28px';tr.append(td);rows.push(tr)}
  $('tb').replaceChildren(...rows);
  // tablero
  $('bd').replaceChildren(...ST.map(([g,lbl])=>{
    const it=v.filter(t=>t.estado===g).sort(byFecha),col=el('div','col'),h=el('h3');
    h.append(el('span','dot s-'+g),document.createTextNode(lbl),el('span',null,String(it.length)));col.append(h,...it.map(tarjeta));
    col.ondragover=e=>{e.preventDefault();col.classList.add('over')};col.ondragleave=()=>col.classList.remove('over');
    col.ondrop=e=>{e.preventDefault();col.classList.remove('over');const t=tasks.find(x=>x.id===e.dataTransfer.getData('text/plain'));if(t&&t.estado!==g)setEstado(t,g)};
    return col}));
  const due=tasks.filter(late);$('bn').hidden=!due.length;$('bn').textContent='⏰ '+due.length+' vencida(s): '+due.slice(0,3).map(t=>t.cosa).join(', ');
}
function abrir(t){editId=t?t.id:null;$('mt').textContent=t?'Editar tarea':'Nueva tarea';
  $('cosa').value=t?t.cosa:'';setSel($('acc'),t?t.accion:(LS('ultAcc')||acc()[0]));setSel($('per'),t?(t.encargado||''):(yo()||L.personas[0]||''));
  $('fec').value=t&&t.fechaMs?toInput(t.fechaMs):'';$('avi').value=String(t?t.aviso||0:0);$('rep').value=t?t.repite||'':'';
  $('dlg').showModal();if(!t)$('cosa').focus()}
const atajos=[['En 1 h',()=>Date.now()+36e5],['Hoy 6 pm',()=>{const d=new Date();d.setHours(18,0,0,0);return d.getTime()}],
  ['Mañana 9 am',()=>{const d=new Date();d.setDate(d.getDate()+1);d.setHours(9,0,0,0);return d.getTime()}],['Quitar',()=>null]];
$('qd').replaceChildren(...atajos.map(([n,f])=>{const b=el('button','sm',n);b.type='button';b.onclick=()=>{const ms=f();$('fec').value=ms?toInput(ms):''};return b}));

async function avisos(){
  try{if(!(await isSupported()))throw 0;
    if(await Notification.requestPermission()!=='granted'){$('notif').textContent='🔕 Bloqueados';return}
    const reg=await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;
    const t=await getToken(getMessaging(app),{vapidKey:VAPID_KEY,serviceWorkerRegistration:reg});
    await setDoc(doc(db,'tokens',t),{email:auth.currentUser.email,persona:yo(),ts:Date.now()});$('notif').textContent='🔔 Avisos activos';
  }catch(e){console.warn(e);$('notif').textContent='🔕 No disponible'}
}
onAuthStateChanged(auth,u=>{
  $('login').hidden=!!u;$('app').hidden=!u;unsubs.forEach(f=>f());unsubs=[];clearInterval(timer);if(!u)return;
  unsubs.push(onSnapshot(collection(db,'tasks'),s=>{tasks=s.docs.map(d=>({id:d.id,...d.data()}));render()},fail));
  unsubs.push(onSnapshot(doc(db,'config','listas'),s=>{if(s.exists()){const d=s.data();L={acciones:d.acciones||null,personas:d.personas||[]}}render()},fail));
  timer=setInterval(render,30000);
  if('Notification' in window&&Notification.permission==='granted')avisos();
});
$('in').onclick=()=>signInWithEmailAndPassword(auth,$('em').value.trim(),$('pw').value).catch(()=>$('err').textContent='Correo o contraseña incorrectos.');
$('pw').addEventListener('keydown',e=>{if(e.key==='Enter')$('in').click()});
$('out').onclick=()=>{$('cfg').close();signOut(auth)};$('notif').onclick=avisos;
$('cfgb').onclick=()=>$('cfg').showModal();$('cfgx').onclick=()=>$('cfg').close();
$('yo').onchange=()=>{localStorage.setItem('yo',$('yo').value);if('Notification' in window&&Notification.permission==='granted')avisos();render()};
$('q').oninput=e=>{q=e.target.value;render()};
$('cdno').onclick=()=>$('cdel').close();
$('cdsi').onclick=()=>{const t=porBorrar;porBorrar=null;$('cdel').close();if(!t)return;const {id,...data}=t;
  deleteDoc(doc(db,'tasks',id)).then(()=>toast('Tarea eliminada',()=>setDoc(doc(db,'tasks',id),data))).catch(fail)};
$('new').onclick=()=>abrir(null);$('cancel').onclick=()=>$('dlg').close();
['dlg','cfg','cdel'].forEach(i=>$(i).addEventListener('click',e=>{if(e.target===$(i))$(i).close()}));
$('go').onclick=()=>{
  const cosa=$('cosa').value.trim();if(!cosa)return $('cosa').focus();
  const f=$('fec').value,fechaMs=f?new Date(f).getTime():null,enc=$('per').value;
  const base={cosa,accion:$('acc').value,encargado:enc,fechaMs,aviso:+$('avi').value,repite:$('rep').value};
  const otro=!!(enc&&yo()&&enc!==yo());localStorage.setItem('ultAcc',base.accion);
  let p;
  if(editId){const t=tasks.find(x=>x.id===editId)||{};
    const cambio=t.fechaMs!==fechaMs||(t.aviso||0)!==base.aviso;
    p=updateDoc(doc(db,'tasks',editId),{...base,...(cambio?{notificada:false}:{}),...(otro&&enc!==t.encargado?{avisarAsignacion:true}:{})});
  }else p=setDoc(doc(collection(db,'tasks')),{...base,estado:'pendiente',notificada:false,avisarAsignacion:otro,creada:Date.now()});
  p.then(()=>$('dlg').close()).catch(fail)};
$('qa').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const cosa=e.target.value.trim();if(!cosa)return;
  setDoc(doc(collection(db,'tasks')),{cosa,accion:LS('ultAcc')||acc()[0],encargado:yo()||L.personas[0]||'',fechaMs:null,aviso:0,repite:'',estado:'pendiente',notificada:false,avisarAsignacion:false,creada:Date.now()})
    .then(()=>{e.target.value=''}).catch(fail)});
$('ap').onclick=()=>{const n=$('np').value.trim();if(n&&!L.personas.includes(n)){L.personas=[...L.personas,n];$('np').value='';saveL()}};
$('aa').onclick=()=>{const n=$('na').value.trim();if(n&&!acc().includes(n)){L.acciones=[...acc(),n];$('na').value='';saveL()}};
