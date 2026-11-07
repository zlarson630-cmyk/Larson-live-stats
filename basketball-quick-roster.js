/* Quick Roster Editor — basketball. Game edits persist through the normal cloud write queue. */
(()=>{
let side='home',rows=[],busy=false;
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const panel=document.createElement('div');
panel.id='quickRosterPanel';panel.className='qr-overlay';panel.hidden=true;
panel.innerHTML='<div class="qr-sheet" role="dialog" aria-modal="true" aria-label="Quick Roster Editor"><div class="qr-top"><div><small>LARSON LIVE STATS · BASKETBALL</small><h2>Quick Roster Editor</h2></div><button id="qrClose" type="button">✕ Close</button></div><div class="qr-tabs"><button id="qrHome" type="button">Home</button><button id="qrAway" type="button">Visitor</button></div><p class="qr-note">Type a jersey number and name. Tab moves across cells; Enter moves to the next player. Save Game Roster updates this game only. The clock keeps its current state.</p><div class="qr-scroll"><table><thead><tr><th>#</th><th>Player name</th><th>Height</th><th>Year</th><th></th></tr></thead><tbody id="qrRows"></tbody></table></div><div class="qr-actions"><button id="qrAdd" type="button">+ Add player</button><button id="qrSave" class="primary" type="button">Save Game Roster</button></div><p id="qrStatus" role="status" aria-live="polite"></p></div>';
document.body.append(panel);
const css=document.createElement('style');css.textContent=`
.qr-overlay[hidden]{display:none!important}.qr-overlay{position:fixed;inset:0;z-index:45;background:#080f1be8;display:flex;justify-content:center;align-items:center;padding:10px}
.qr-sheet{width:min(850px,100%);max-height:95dvh;overflow:auto;background:#182438;border:1px solid #65748a;border-top:6px solid #c91c2b;border-radius:14px;padding:15px;color:#fff;box-shadow:0 20px 60px #0009}
.qr-top,.qr-tabs,.qr-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.qr-top h2{margin:3px 0;font-size:26px}.qr-top small{color:#f19ba4;letter-spacing:.1em}.qr-note{font-size:12px;color:#c1cede}.qr-tabs button{flex:1}.qr-tabs .selected{background:#b62d43}.qr-scroll{overflow:auto;max-height:54dvh}.qr-sheet table{width:100%;border-collapse:collapse}.qr-sheet th{text-align:left;font-size:12px;color:#d8e0ec;padding:6px}.qr-sheet td{padding:3px}.qr-sheet td input{background:#0e1725;color:#fff;border:1px solid #6b7a90;border-radius:3px;padding:9px 6px;width:100%;max-width:none;min-width:0}.qr-sheet td:nth-child(1){width:65px}.qr-sheet td:nth-child(3){width:85px}.qr-sheet td:nth-child(4){width:85px}.qr-sheet td:nth-child(5){width:42px}.qr-sheet td button{padding:7px;margin:0}.qr-actions{margin-top:12px}.qr-actions button{flex:1;min-width:155px}.qr-sheet button:disabled{opacity:.5}.qr-sheet #qrStatus{min-height:18px;font-size:13px}.qr-sheet #qrStatus.error{color:#ff9aa5}@media(max-width:550px){.qr-sheet{padding:9px}.qr-sheet td:nth-child(3),.qr-sheet th:nth-child(3),.qr-sheet td:nth-child(4),.qr-sheet th:nth-child(4){display:none}.qr-sheet td:nth-child(1){width:52px}.qr-sheet input{font-size:14px}.qr-actions button{min-width:125px;font-size:12px}}
`;document.head.append(css);
const button=document.createElement('button');button.id='quickRosterOpen';button.type='button';button.textContent='✎ Rosters';button.onclick=()=>open('home');
const tabs=document.querySelector('#app > .row');if(tabs)tabs.append(button);
function status(t,error=false){$('qrStatus').textContent=t;$('qrStatus').classList.toggle('error',error)}
function read(){rows=[...(state?.rosters?.[side]||[])].map(p=>({number:String(p.number||''),name:p.name||'',height:p.height||'',year:p.year||''}));rows.push({number:'',name:'',height:'',year:''});paint()}
function open(which){if(!state||!canWrite()){scorerToast('Sign in as game owner to edit rosters',true);return}side=which;panel.hidden=false;read();status('Unsaved changes remain here until you choose Save.')}
function close(){if(busy)return;panel.hidden=true}
function setSide(which){if(which===side)return;if(rows.some(r=>r._dirty)&&!confirm('Discard unsaved roster edits?'))return;side=which;read();status('')}
function paint(focusRow=-1,focusCol=0){
 $('qrHome').textContent='Home · '+(state?.home||'');$('qrAway').textContent='Visitor · '+(state?.away||'');
 $('qrHome').classList.toggle('selected',side==='home');$('qrAway').classList.toggle('selected',side==='away');
 $('qrRows').innerHTML=rows.map((p,i)=>'<tr>'+['number','name','height','year'].map((k,j)=>'<td><input data-row="'+i+'" data-key="'+k+'" aria-label="'+k+' player '+(i+1)+'" value="'+safe(p[k])+'" '+(k==='number'?'inputmode="numeric" maxlength="2"':'')+'></td>').join('')+'<td><button type="button" data-remove="'+i+'" aria-label="Remove row '+(i+1)+'">×</button></td></tr>').join('');
 if(focusRow>=0){const input=$('qrRows').querySelector('input[data-row="'+focusRow+'"][data-key="'+['number','name','height','year'][focusCol]+'"]');input?.focus()}
}
function add(){if(rows.length>=50){status('Maximum 50 players',true);return}rows.push({number:'',name:'',height:'',year:'',_dirty:true});paint(rows.length-1)}
function clean(){
 const active=rows.filter(p=>p.number.trim()||p.name.trim());
 if(active.some(p=>!/^[0-9]{1,2}$/.test(p.number.trim())))throw Error('Every player needs a jersey number from 0 to 99.');
 if(new Set(active.map(p=>String(Number(p.number)))).size!==active.length)throw Error('Duplicate jersey numbers. Each player must have a unique number.');
 return active.map(p=>({number:p.number.trim(),name:p.name.trim(),height:p.height.trim(),year:p.year.trim()}));
}
async function save(){
 if(busy)return;let next;try{next=clean()}catch(e){status(e.message,true);return}
 if(!canWrite()){status('You must be the game owner.',true);return}
 const old=state.rosters?.[side]||[];
 // Jersey numbers are the event identifiers in the current basketball schema.
 // Never silently reassign existing scoring/foul attribution.
 const used=new Set((state.events||[]).filter(e=>e.team===side).flatMap(e=>[e.scorer,e.assist,e.player,...String(e.out||'').split(', '),...String(e.in||'').split(', ')]).filter(v=>/^\d{1,2}$/.test(String(v??''))).map(String));
 const oldNums=new Set(old.map(p=>String(p.number)));
 const newNums=new Set(next.map(p=>p.number));
 const removed=[...used].filter(n=>oldNums.has(n)&&!newNums.has(n));
 if(removed.length){status('Cannot remove #'+removed.join(', #')+' because game events reference them. Keep those jersey numbers to preserve statistics.',true);return}
 busy=true;panel.querySelectorAll('button').forEach(b=>b.disabled=true);status('Saving game roster…');
 try{
  const ok=await write(s=>{s.rosters=s.rosters||{};s.rosters[side]=next});
  if(!ok)throw Error('Cloud game roster did not save. Try again.');
  rows=next.map(p=>({...p}));rows.push({number:'',name:'',height:'',year:''});paint();
  status('Game roster saved. Existing plays and statistics preserved.');
 }catch(e){status(e.message,true)}
 finally{busy=false;panel.querySelectorAll('button').forEach(b=>b.disabled=false)}
}
$('qrClose').onclick=close;$('qrHome').onclick=()=>setSide('home');$('qrAway').onclick=()=>setSide('away');$('qrAdd').onclick=add;$('qrSave').onclick=save;
$('qrRows').addEventListener('input',e=>{const i=Number(e.target.dataset.row),k=e.target.dataset.key;if(!k||!rows[i])return;rows[i][k]=e.target.value;rows[i]._dirty=true});
$('qrRows').addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const i=Number(e.target.dataset.row);if(i===rows.length-1)add();else paint(i+1,0)});
$('qrRows').addEventListener('click',e=>{const i=e.target.dataset.remove;if(i===undefined)return;rows.splice(Number(i),1);if(!rows.length)rows.push({number:'',name:'',height:'',year:''});paint()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)close()});
})();
