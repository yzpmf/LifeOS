// ============================================================
//  Life OS Desktop — 前端逻辑（对齐手机端功能）
// ============================================================
const API=location.origin+'/api';
let state={tasks:[],courses:[],habits:[],habitRecords:{},settings:{},chatHistory:[],plans:{},diary:[],insights:[]};
let currentTab='todo',initError=null;
const Q={Q1:{name:'马上做',desc:'短期 · 紧急',color:'#D43B2F'},Q2:{name:'计划做',desc:'长期 · 紧急',color:'#D4930A'},Q3:{name:'顺手做',desc:'短期 · 不紧急',color:'#2B7CB5'},Q4:{name:'有空做',desc:'长期 · 不紧急',color:'#3A9D6A'}};
const DDL_PRESETS=[{label:'今天',days:0},{label:'明天',days:1},{label:'3天后',days:3},{label:'7天后',days:7},{label:'14天后',days:14},{label:'30天后',days:30}];
const WEEKDAYS=['周日','周一','周二','周三','周四','周五','周六'];
const TH=7;
function fmtYMD(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function parseYMD(s){const p=String(s).slice(0,10).split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
function startOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
const DAY_MS=86400000;
function daysLeft(ddl){if(!ddl)return null;const t=typeof ddl==='string'?parseYMD(ddl):ddl;return Math.round((startOfDay(t)-startOfDay(new Date()))/DAY_MS)}
function timeScope(ddl,th=7){const d=daysLeft(ddl);if(d===null)return'long';return d<=th?'short':'long'}
function quadrantOf(t,th=7){const s=timeScope(t.ddl,th);if(s==='short'&&t.urgent)return'Q1';if(s==='long'&&t.urgent)return'Q2';if(s==='short'&&!t.urgent)return'Q3';return'Q4'}
function fmtDDL(ddl){if(!ddl)return'无截止日期';const d=daysLeft(ddl);if(d<0)return'已逾期 '+(-d)+' 天';if(d===0)return'今天截止';if(d===1)return'明天截止';return'剩余 '+d+' 天'}
function isOverdue(ddl){const d=daysLeft(ddl);return d!==null&&d<0}
function todayPlus(n){const d=new Date();d.setDate(d.getDate()+n);return fmtYMD(d)}
function groupByQuadrant(tasks,th=7){const g={Q1:[],Q2:[],Q3:[],Q4:[]};tasks.filter(t=>!t.done&&!t.deleted).forEach(t=>{g[quadrantOf(t,th)].push(t)});return g}
function startOfWeek(d){const x=startOfDay(d);const w=x.getDay()===0?7:x.getDay();x.setDate(x.getDate()-(w-1));return x}
function mondayKey(date){return fmtYMD(startOfWeek(date))}
function shiftDays(ymd,n){const d=parseYMD(ymd);d.setDate(d.getDate()+n);return fmtYMD(d)}
function fmtDate(ds){const d=parseYMD(ds);return(d.getMonth()+1)+'月'+d.getDate()+'日'}
function weekRangeLabel(mk){const m=parseYMD(mk);const s=new Date(m);s.setDate(s.getDate()+6);return(m.getMonth()+1)+'/'+m.getDate()+' - '+(s.getMonth()+1)+'/'+s.getDate()}
function todayWeekday(){const d=new Date().getDay();return d===0?7:d}
function todayStr(){return fmtYMD(new Date())}
function numToCN(n){const C=['零','一','二','三','四','五','六','七','八','九'];if(n<=0)return'零';if(n<10)return C[n];if(n===10)return'十';if(n<20)return'十'+C[n-10];const t=Math.floor(n/10),o=n%10;return C[t]+'十'+(o?C[o]:'')}
function planOrdinal(mk,anchor){const m=startOfDay(parseYMD(mk));const a=anchor?startOfDay(parseYMD(anchor)):m;return Math.round((m-a)/(7*DAY_MS))+1}
function planTitle(mk,anchor){return numToCN(planOrdinal(mk,anchor))+'七计划'}
function calcStreak(records,hid){if(!records||!records[hid])return 0;const dates=Object.keys(records[hid]).filter(d=>records[hid][d]).sort().reverse();if(!dates.length)return 0;let st=0;let cd=startOfDay(new Date());for(let i=0;i<365;i++){const ds=fmtYMD(cd);if(records[hid][ds])st++;else if(i>0)break;cd.setDate(cd.getDate()-1)}return st}
async function api(m,k,b){const u=API+'/'+k;const o={method:m,headers:{'Content-Type':'application/json'}};if(b!==undefined)o.body=JSON.stringify(b);const r=await fetch(u,o);if(!r.ok)throw new Error(m+' '+k+' '+r.status);return r.json()}
async function loadAll(){const keys=['tasks','courses','habits','habitRecords','settings','chatHistory','plans','diary','insights'];const rs=await Promise.all(keys.map(k=>api('GET',k).catch(()=>null)));keys.forEach((k,i)=>{if(rs[i]!==null)state[k]=rs[i]})}
async function save(key){await api('POST',key,state[key])}
function h(tag,attrs,...children){const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='className')el.className=v;else if(k==='style'&&typeof v==='object')Object.assign(el.style,v);else if(k.startsWith('on'))el.addEventListener(k.slice(2),v);else if(v!==null&&v!==undefined)el.setAttribute(k,v)}children.flat().forEach(c=>{if(c!=null&&c!==false)el.append(typeof c==='string'||typeof c==='number'?document.createTextNode(c):c)});return el}

let todoView='grid',showDone=false,addingTask=false,editTask=null,openId=null;
let planWeekKey=mondayKey(new Date()),planPicker=null;
let _planLink=null,_planPickerKind=null;

function render(){const c=document.getElementById('content');c.innerHTML='';if(initError){c.appendChild(h('div',{className:'empty'},initError));return}if(currentTab==='todo')renderTodo(c);else if(currentTab==='course')renderCourses(c);else if(currentTab==='habit')renderHabits(c);else if(currentTab==='plan')renderPlans(c);else if(currentTab==='diary')renderDiary(c);else if(currentTab==='settings')renderSettings(c)}
function renderTodo(c){
  const th=state.settings.threshold||TH;
  const activeTasks=state.tasks.filter(t=>!t.done&&!t.deleted);
  const groups=groupByQuadrant(activeTasks,th);
  c.appendChild(h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}},h('div',{},h('div',{style:{fontSize:'24px',fontWeight:'800'}},'我的待办'),h('div',{style:{fontSize:'12px',color:'#6B6560',marginTop:'2px'}},'DDL 自动归类 · 你只需标紧急')),h('button',{className:'btn btn-accent',onClick:()=>{addingTask=true;editTask=null;renderTodo(c)}},'＋ 新建')));
  c.appendChild(h('div',{className:'view-toggle'},h('div',{className:'view-btn'+(todoView==='grid'?' active':''),onClick:()=>{todoView='grid';renderTodo(c)}},'任务总览'),h('div',{className:'view-btn'+(todoView==='plan'?' active':''),onClick:()=>{todoView='plan';renderTodo(c)}},'本周计划')));
  if(todoView==='plan'){renderWeekPlan(c);return}
  if(addingTask)renderAddTaskForm(c,th);
  const oc=activeTasks.filter(t=>isOverdue(t.ddl)).length;const q1=groups.Q1.length;
  let parts=['共 '+activeTasks.length+' 项任务'];if(q1>0)parts.push(h('span',{style:{color:'#D43B2F'}},' · '+q1+' 项紧急'));if(oc>0)parts.push(h('span',{style:{color:'#D43B2F'}},' · '+oc+' 项逾期'));
  c.appendChild(h('div',{className:'summary-bar'},...parts));
  const grid=h('div',{className:'quad-grid'});
  ['Q1','Q2','Q3','Q4'].forEach(qk=>{const meta=Q[qk];const tasks=groups[qk];const cell=h('div',{className:'quad-cell',style:{borderTopColor:meta.color}},h('div',{className:'quad-head'},h('span',{className:'quad-title',style:{color:meta.color}},meta.name),h('span',{className:'quad-count',style:{background:meta.color+'20',color:meta.color}},tasks.length)),h('div',{className:'quad-desc'},meta.desc));if(tasks.length===0)cell.appendChild(h('div',{className:'quad-empty'},'暂无任务'));else tasks.forEach(t=>cell.appendChild(taskCardEl(t,th)));grid.appendChild(cell)});
  c.appendChild(grid);
  c.appendChild(h('div',{style:{fontSize:'12px',color:'#9E9890',marginTop:'14px',lineHeight:'18px'}},'剩余 ≤ '+th+' 天的任务自动归入「短期」象限。标记紧急后进入「马上做」。'));
  const dt=state.tasks.filter(t=>t.done&&!t.deleted);
  if(dt.length>0){c.appendChild(h('div',{className:'section-title',style:{cursor:'pointer'},onClick:()=>{showDone=!showDone;renderTodo(c)}},'已完成 ('+dt.length+') '+(showDone?'收起':'展开')));if(showDone)dt.forEach(t=>c.appendChild(h('div',{className:'card',style:{display:'flex',alignItems:'center',gap:'10px'}},h('div',{className:'check done',onClick:async()=>{const tk=state.tasks.find(x=>x.id===t.id);if(tk){tk.done=false;tk.completedAt=null;await save('tasks');renderTodo(c)}}},'✓'),h('div',{style:{flex:1}},h('div',{style:{fontSize:'14px',color:'#9E9890',textDecoration:'line-through'}},t.title),h('div',{style:{fontSize:'11px',color:'#9E9890',marginTop:'2px'}},t.completedAt?'完成于 '+fmtDate(t.completedAt):''))))));}
  if(openId){const t=state.tasks.find(x=>x.id===openId);if(t)renderTaskDetail(c,t,th)}
}
function taskCardEl(t,th){const qk=quadrantOf(t,th);const meta=Q[qk];const ov=isOverdue(t.ddl);const total=t.subs?t.subs.length:0;const fin=t.subs?t.subs.filter(s=>s.done).length:0;const el=h('div',{className:'task-card',onClick:()=>{openId=t.id;renderTodo(document.getElementById('content'))}},h('div',{className:'t-title'},t.title),h('div',{className:'t-row'},h('span',{className:'task-badge',style:{background:meta.color+'20',color:meta.color}},meta.name)),h('div',{className:'task-ddl'+(ov?' overdue':'')},fmtDDL(t.ddl)));if(total>0){const pct=Math.round(fin/total*100);el.appendChild(h('div',{style:{display:'flex',alignItems:'center',gap:'8px',marginTop:'8px'}},h('div',{style:{flex:'1',height:'4px',borderRadius:'2px',background:'#E5DFD5',overflow:'hidden'}},h('div',{style:{height:'100%',width:pct+'%',background:meta.color,borderRadius:'2px'}})),h('span',{style:{fontSize:'10px',color:'#9E9890'}},fin+'/'+total)))}return el}

function renderAddTaskForm(c,th){const editing=!!editTask;let ddlDays=editing&&editTask.ddl?daysLeft(editTask.ddl):null;let urgent=editing?editTask.urgent:false;const form=h('div',{className:'add-form'},h('h3',{},editing?'编辑任务':'新建任务'),h('div',{className:'form-row'},h('label',{},'任务标题'),h('input',{className:'input',id:'taskTitle',placeholder:'例如：写完产品 PRD',value:editing?editTask.title:''})),h('div',{className:'form-row'},h('label',{},'截止日期 (DDL)'),h('div',{className:'chips-row',id:'ddlChips'},h('div',{className:'chip'+(ddlDays===null?' active':''),'data-val':'none'},'无期限'),...DDL_PRESETS.map(p=>h('div',{className:'chip'+(ddlDays===p.days?' active':''),'data-val':p.days},p.label)))),h('div',{className:'switch-row'},h('div',{},h('div',{className:'switch-label'},'标记为紧急'),h('div',{className:'switch-hint'},'紧急任务会进入「马上做」或「计划做」')),h('div',{className:'switch'+(urgent?' on':''),id:'urgentSwitch'})),h('div',{className:'form-row'},h('label',{},'备注（可选）'),h('textarea',{className:'input',id:'taskNote',placeholder:'补充说明...'},editing?(editTask.note||''):'')),h('div',{id:'previewBox'}),h('div',{style:{display:'flex',gap:'8px',marginTop:'16px'}},h('button',{className:'btn btn-accent',id:'saveTaskBtn'},editing?'保存修改':'创建任务'),h('button',{className:'btn btn-outline',id:'cancelTaskBtn'},'取消')));c.appendChild(form);
document.querySelectorAll('#ddlChips .chip').forEach(el=>{el.addEventListener('click',()=>{ddlDays=el.dataset.val==='none'?null:Number(el.dataset.val);document.querySelectorAll('#ddlChips .chip').forEach(x=>x.classList.remove('active'));el.classList.add('active');updatePreview()})});
document.getElementById('urgentSwitch').addEventListener('click',function(){urgent=!urgent;this.className='switch'+(urgent?' on':'');updatePreview()});
document.getElementById('taskTitle').addEventListener('input',updatePreview);
document.getElementById('cancelTaskBtn').addEventListener('click',()=>{addingTask=false;editTask=null;renderTodo(c)});
document.getElementById('saveTaskBtn').addEventListener('click',async()=>{const t=document.getElementById('taskTitle').value.trim();if(!t)return;const ddl=ddlDays!==null?todayPlus(ddlDays):null;const n=document.getElementById('taskNote').value.trim();if(editing){editTask.title=t;editTask.ddl=ddl;editTask.urgent=urgent;editTask.note=n}else{state.tasks.push({id:'t'+Date.now(),title:t,ddl,urgent,note:n,done:false,deleted:false,subs:[],createdAt:new Date().toISOString()})}await save('tasks');addingTask=false;editTask=null;renderTodo(c)});
function updatePreview(){const pb=document.getElementById('previewBox');if(!pb)return;const t=document.getElementById('taskTitle').value;if(!t){pb.innerHTML='';return}const ddl=ddlDays!==null?todayPlus(ddlDays):null;const qk=quadrantOf({ddl,urgent},th);const meta=Q[qk];pb.innerHTML='';pb.appendChild(h('div',{className:'preview-box',style:{borderLeftColor:meta.color}},'将归入 ',h('span',{style:{color:meta.color,fontWeight:'700'}},meta.name),'（'+meta.desc+'）',h('div',{style:{fontSize:'11px',color:'#9E9890',marginTop:'4px'}},fmtDDL(ddl)+' · '+(urgent?'紧急':'不紧急'))))}
updatePreview()}

function renderTaskDetail(c,t,th){const qk=quadrantOf(t,th);const meta=Q[qk];const overlay=h('div',{className:'detail-overlay',onClick:e=>{if(e.target===e.currentTarget){openId=null;renderTodo(c)}}});const inner=h('div',{className:'detail-inner'});inner.appendChild(h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}},h('h3',{style:{fontSize:'18px',fontWeight:'800'}},t.title),h('button',{className:'btn btn-outline btn-sm',onClick:()=>{openId=null;renderTodo(c)}},'关闭')));inner.appendChild(h('div',{style:{display:'flex',gap:'8px',marginBottom:'12px'}},h('span',{className:'task-badge',style:{background:meta.color+'20',color:meta.color}},meta.name),h('span',{style:{fontSize:'12px',color:'#6B6560',alignSelf:'center'}},fmtDDL(t.ddl))));inner.appendChild(h('button',{className:'btn '+(t.done?'btn-outline':'btn-accent'),style:{marginBottom:'12px',width:'100%'},onClick:async()=>{t.done=!t.done;t.completedAt=t.done?new Date().toISOString():null;await save('tasks');renderTodo(c)}},t.done?'标记为未完成':'标记为已完成'));inner.appendChild(h('button',{className:'btn btn-outline',style:{marginBottom:'12px',width:'100%'},onClick:()=>{addingTask=true;editTask=t;openId=null;renderTodo(c)}},'编辑任务'));if(t.subs&&t.subs.length>0){inner.appendChild(h('div',{className:'section-title'},'子任务'));t.subs.forEach(s=>inner.appendChild(h('div',{className:'card',style:{display:'flex',alignItems:'center',gap:'8px',padding:'8px 12px'}},h('div',{className:'check'+(s.done?' done':''),style:{width:'16px',height:'16px',borderRadius:'5px',fontSize:'10px'},onClick:async()=>{s.done=!s.done;await save('tasks');renderTodo(c)}},s.done?'✓':''),h('span',{style:{fontSize:'13px',flex:'1',textDecoration:s.done?'line-through':'',color:s.done?'#9E9890':'#1A1815'}},s.text),h('button',{className:'del-btn',onClick:async()=>{t.subs=t.subs.filter(x=>x.id!==s.id);await save('tasks');renderTodo(c)}},'✕'))))}inner.appendChild(h('div',{className:'form-row',style:{marginTop:'12px'}},h('div',{style:{display:'flex',gap:'8px'}},h('input',{className:'input',id:'subInput',placeholder:'添加子任务...'}),h('button',{className:'btn btn-accent btn-sm',onClick:async()=>{const v=document.getElementById('subInput').value.trim();if(!v)return;if(!t.subs)t.subs=[];t.subs.push({id:'s'+Date.now(),text:v,done:false});await save('tasks');renderTodo(c)}},'+'))));if(t.note){inner.appendChild(h('div',{className:'section-title'},'备注'));inner.appendChild(h('div',{className:'card',style:{fontSize:'13px',whiteSpace:'pre-wrap',lineHeight:'1.5'}},t.note))}inner.appendChild(h('button',{className:'btn btn-danger',style:{marginTop:'16px',width:'100%'},onClick:async()=>{state.tasks=state.tasks.filter(x=>x.id!==t.id);await save('tasks');openId=null;renderTodo(c)}},'删除任务'));overlay.appendChild(inner);c.appendChild(overlay)}

// ============== 七计划 ==============
function renderWeekPlan(c){
  const mk=planWeekKey;
  const anchor=state.settings.planAnchor||mk;
  const plan=state.plans[mk]||{long:[],urgent:[]};
  const isThisWeek=mk===mondayKey(new Date());
  c.appendChild(h('div',{className:'week-nav'},
    h('div',{className:'nav-btn',onClick:()=>{planWeekKey=shiftDays(mk,-7);renderTodo(c)}},'‹'),
    h('div',{className:'week-center'},
      h('div',{className:'week-title-row'},
        h('span',{className:'week-title'},planTitle(mk,anchor)),
        isThisWeek?h('span',{className:'now-dot'},h('span',{},'本周')):null
      ),
      h('div',{className:'week-range'},weekRangeLabel(mk))
    ),
    h('div',{className:'nav-btn',onClick:()=>{planWeekKey=shiftDays(mk,7);renderTodo(c)}},'›')
  ));
  if(!isThisWeek){c.appendChild(h('div',{className:'back-to-now',onClick:()=>{planWeekKey=mondayKey(new Date());renderTodo(c)}},h('span',{},'回到本周')))}
  renderPlanColumn(c,'urgent',plan,anchor);
  renderPlanColumn(c,'long',plan,anchor);
  c.appendChild(h('div',{style:{fontSize:'12px',color:'#9E9890',marginTop:'14px',lineHeight:'18px'}},'七计划 = 每周定两件事：一件紧急重要（马上推进），一件长期重要（持续投入）。'));
}

function renderPlanColumn(c,kind,plan,anchor){
  const mk=planWeekKey;
  const items=plan[kind]||[];
  const isUrgent=kind==='urgent';
  const title=isUrgent?'紧急重要':'长期重要';
  const hint=isUrgent?'本周必须推进的关键事项':'本周持续投入的长线事项';
  const color=isUrgent?'#D43B2F':'#D4930A';
  const col=h('div',{className:'plan-column'},
    h('div',{className:'plan-col-head'},
      h('span',{className:'plan-col-title',style:{color}},title),
      h('span',{className:'plan-col-count'},items.length+' 项')
    ),
    h('div',{className:'plan-col-hint'},hint)
  );
  if(items.length===0){col.appendChild(h('div',{className:'plan-empty'},'暂无计划项'))}
  else{items.forEach((item,idx)=>{
    const row=h('div',{className:'plan-item'},
      h('div',{className:'plan-check-area',onClick:async()=>{
        item.done=!item.done;
        if(item.done)item.completedAt=todayStr();
        await save('plans');renderTodo(c);
      }},
        h('div',{className:'plan-checkbox'+(item.done?' on':'')},item.done?'✓':''),
        h('span',{className:'plan-item-text'+(item.done?' done':'')},item.text)
      ),
      h('button',{className:'plan-del',onClick:async()=>{
        plan[kind]=items.filter((_,i)=>i!==idx);
        await save('plans');renderTodo(c);
      }},'✕')
    );
    col.appendChild(row);
    if(item.linkedTaskId){
      const lt=state.tasks.find(t=>t.id===item.linkedTaskId);
      if(lt)col.appendChild(h('div',{className:'link-chip'},
        h('span',{className:'link-chip-text'},'🔗 '+lt.title)
      ));
    }
  })}
  // Add new item
  const addRow=h('div',{className:'plan-add-row'});
  const input=h('input',{className:'plan-add-input',placeholder:'添加计划项...'});
  addRow.appendChild(input);
  addRow.appendChild(h('button',{className:'plan-link-btn',onClick:()=>{
    _planLink=null;_planPickerKind=kind;
    // Show task picker
    const tasks=state.tasks.filter(t=>!t.done&&!t.deleted);
    if(tasks.length===0)return;
    const overlay=h('div',{className:'modal-overlay',onClick:e=>{if(e.target===e.currentTarget){document.body.removeChild(overlay)}}});
    const sheet=h('div',{className:'modal-sheet'});
    sheet.appendChild(h('div',{className:'modal-title'},'选择关联任务'));
    tasks.forEach(t=>{
      sheet.appendChild(h('div',{className:'picker-item',onClick:()=>{
        _planLink=t.id;
        input.value=t.title;
        document.body.removeChild(overlay);
      }},
        h('div',{className:'picker-dot',style:{background:Q[quadrantOf(t,state.settings.threshold||TH)].color}}),
        h('div',{},h('div',{className:'picker-item-title'},t.title),h('div',{className:'picker-item-meta'},fmtDDL(t.ddl)))
      ));
    });
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }},'🔗'));
  addRow.appendChild(h('button',{className:'plan-add-btn',style:{background:color},onClick:async()=>{
    const v=input.value.trim();if(!v)return;
    if(!state.plans[mk])state.plans[mk]={long:[],urgent:[]};
    const newItem={id:'p'+Date.now(),text:v,done:false,createdAt:new Date().toISOString()};
    if(_planLink)newItem.linkedTaskId=_planLink;
    state.plans[mk][kind].push(newItem);
    await save('plans');_planLink=null;_planPickerKind=null;renderTodo(c);
  }},'添加'));
  col.appendChild(addRow);
  c.appendChild(col);
}

// ============== 计划页（独立 Tab） ==============
function renderPlans(c){
  c.appendChild(h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}},
    h('div',{},h('div',{style:{fontSize:'24px',fontWeight:'800'}},'七计划'),h('div',{style:{fontSize:'12px',color:'#6B6560',marginTop:'2px'}},'每周两件事 · 长期坚持')),
    h('button',{className:'btn btn-outline',onClick:()=>{planWeekKey=mondayKey(new Date());renderPlans(c)}},'本周')
  ));
  const mk=planWeekKey;
  const anchor=state.settings.planAnchor||mk;
  const plan=state.plans[mk]||{long:[],urgent:[]};
  const isThisWeek=mk===mondayKey(new Date());
  c.appendChild(h('div',{className:'week-nav'},
    h('div',{className:'nav-btn',onClick:()=>{planWeekKey=shiftDays(mk,-7);renderPlans(c)}},'‹'),
    h('div',{className:'week-center'},
      h('div',{className:'week-title-row'},
        h('span',{className:'week-title'},planTitle(mk,anchor)),
        isThisWeek?h('span',{className:'now-dot'},h('span',{},'本周')):null
      ),
      h('div',{className:'week-range'},weekRangeLabel(mk))
    ),
    h('div',{className:'nav-btn',onClick:()=>{planWeekKey=shiftDays(mk,7);renderPlans(c)}},'›')
  ));
  if(!isThisWeek){c.appendChild(h('div',{className:'back-to-now',onClick:()=>{planWeekKey=mondayKey(new Date());renderPlans(c)}},h('span',{},'回到本周')))}
  renderPlanColumnInPlan(c,'urgent',plan);
  renderPlanColumnInPlan(c,'long',plan);
  c.appendChild(h('div',{style:{fontSize:'12px',color:'#9E9890',marginTop:'14px',lineHeight:'18px'}},'七计划 = 每周定两件事：一件紧急重要（马上推进），一件长期重要（持续投入）。'));
}

// Plan column renderer for the standalone Plan tab (reuses same logic as renderPlanColumn but calls renderPlans)
function renderPlanColumnInPlan(c,kind,plan){
  const mk=planWeekKey;
  const items=plan[kind]||[];
  const isUrgent=kind==='urgent';
  const title=isUrgent?'紧急重要':'长期重要';
  const hint=isUrgent?'本周必须推进的关键事项':'本周持续投入的长线事项';
  const color=isUrgent?'#D43B2F':'#D4930A';
  const col=h('div',{className:'plan-column',
    h('div',{className:'plan-col-head'},
      h('span',{className:'plan-col-title',style:{color}},title),
      h('span',{className:'plan-col-count'},items.length+' 项')
    ),
    h('div',{className:'plan-col-hint'},hint)
  });
  if(items.length===0){col.appendChild(h('div',{className:'plan-empty'},'暂无计划项'))}
  else{items.forEach((item,idx)=>{
    const row=h('div',{className:'plan-item'},
      h('div',{className:'plan-check-area',onClick:async()=>{
        item.done=!item.done;
        if(item.done)item.completedAt=todayStr();
        await save('plans');renderPlans(c);
      }},
        h('div',{className:'plan-checkbox'+(item.done?' on':'')},item.done?'✓':''),
        h('span',{className:'plan-item-text'+(item.done?' done':'')},item.text)
      ),
      h('button',{className:'plan-del',onClick:async()=>{
        plan[kind]=items.filter((_,i)=>i!==idx);
        await save('plans');renderPlans(c);
      }},'✕')
    );
    col.appendChild(row);
    if(item.linkedTaskId){
      const lt=state.tasks.find(t=>t.id===item.linkedTaskId);
      if(lt)col.appendChild(h('div',{className:'link-chip'},
        h('span',{className:'link-chip-text'},'🔗 '+lt.title)
      ));
    }
  })}
  const addRow=h('div',{className:'plan-add-row'});
  const input=h('input',{className:'plan-add-input',placeholder:'添加计划项...'});
  addRow.appendChild(input);
  addRow.appendChild(h('button',{className:'plan-link-btn',onClick:()=>{
    _planLink=null;_planPickerKind=kind;
    const tasks=state.tasks.filter(t=>!t.done&&!t.deleted);
    if(tasks.length===0)return;
    const overlay=h('div',{className:'modal-overlay',onClick:e=>{if(e.target===e.currentTarget){document.body.removeChild(overlay)}}});
    const sheet=h('div',{className:'modal-sheet'});
    sheet.appendChild(h('div',{className:'modal-title'},'选择关联任务'));
    tasks.forEach(t=>{
      sheet.appendChild(h('div',{className:'picker-item',onClick:()=>{
        _planLink=t.id;
        input.value=t.title;
        document.body.removeChild(overlay);
      }},
        h('div',{className:'picker-dot',style:{background:Q[quadrantOf(t,state.settings.threshold||TH)].color}}),
        h('div',{},h('div',{className:'picker-item-title'},t.title),h('div',{className:'picker-item-meta'},fmtDDL(t.ddl)))
      ));
    });
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }},'🔗'));
  addRow.appendChild(h('button',{className:'plan-add-btn',style:{background:color},onClick:async()=>{
    const v=input.value.trim();if(!v)return;
    if(!state.plans[mk])state.plans[mk]={long:[],urgent:[]};
    const newItem={id:'p'+Date.now(),text:v,done:false,createdAt:new Date().toISOString()};
    if(_planLink)newItem.linkedTaskId=_planLink;
    state.plans[mk][kind].push(newItem);
    await save('plans');_planLink=null;_planPickerKind=null;renderPlans(c);
  }},'添加'));
  col.appendChild(addRow);
  c.appendChild(col);
}

// ============== 习惯打卡 ==============
function renderHabits(c){
  const today=todayStr();
  const habits=state.habits||[];
  const records=state.habitRecords||{};
  const activeToday=habits.filter(hb=>{
    const wd=new Date().getDay()===0?7:new Date().getDay();
    if(hb.repeatRule==='每天')return true;
    if(hb.repeatRule==='工作日')return wd>=1&&wd<=5;
    if(hb.repeatRule==='自定义'&&Array.isArray(hb.customDays))return hb.customDays.includes(wd);
    return true;
  });
  const checkedToday=activeToday.filter(hb=>records[hb.id]&&records[hb.id][today]).length;
  const totalCount=activeToday.length;
  const completionRate=totalCount?Math.round(checkedToday/totalCount*100):0;

  c.appendChild(h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}},
    h('div',{},h('div',{style:{fontSize:'24px',fontWeight:'800'}},'每日打卡'),h('div',{style:{fontSize:'12px',color:'#6B6560',marginTop:'2px'}},'到点提醒 · 连续坚持')),
    h('button',{className:'btn btn-accent',onClick:()=>{
      const name=prompt('习惯名称（如：读书）');if(!name)return;
      const icon=prompt('图标 emoji（如：📖）','✅')||'✅';
      const newHabit={id:'hb'+Date.now(),name,icon,repeatRule:'每天',time:'',createdAt:new Date().toISOString()};
      state.habits.push(newHabit);save('habits').then(()=>renderHabits(c));
    }},'＋ 新建')
  ));

  // 今日进度
  c.appendChild(h('div',{className:'card',style:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px',marginBottom:'12px'}},
    h('div',{},
      h('div',{style:{fontSize:'13px',color:'#6B6560'}},'今日打卡'),
      h('div',{style:{fontSize:'28px',fontWeight:'800',marginTop:'4px'}},h('span',{style:{color:'#E05A33'}},checkedToday),' / ',totalCount),
      totalCount===0?h('div',{style:{fontSize:'12px',color:'#9E9890',marginTop:'2px'}},'今天休息日'):null
    ),
    h('div',{style:{width:'60px',height:'60px',borderRadius:'30px',border:'4px solid #E5DFD5',display:'flex',alignItems:'center',justifyContent:'center'}},
      h('div',{style:{width:'48px',height:'48px',borderRadius:'24px',background:'#FBE8E0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'800',color:'#E05A33'}},totalCount?completionRate+'%':'--')
    )
  ));

  // 近7天热力图
  const last7=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);last7.push(fmtYMD(d))}
  const heatRow=h('div',{style:{display:'flex',justifyContent:'space-around',marginBottom:'16px'}});
  last7.forEach(ds=>{
    const wd=parseYMD(ds).getDay()===0?7:parseYMD(ds).getDay();
    const dayHabits=habits.filter(hb=>{
      if(hb.repeatRule==='每天')return true;
      if(hb.repeatRule==='工作日')return wd>=1&&wd<=5;
      if(hb.repeatRule==='自定义'&&Array.isArray(hb.customDays))return hb.customDays.includes(wd);
      return true;
    });
    const count=dayHabits.filter(hb=>records[hb.id]&&records[hb.id][ds]).length;
    const ratio=dayHabits.length?count/dayHabits.length:0;
    const isToday=ds===today;
    let bg='#E5DFD5';
    if(ratio>0&&ratio<0.5)bg='#3A9D6A40';
    else if(ratio>=0.5&&ratio<1)bg='#3A9D6A80';
    else if(ratio===1)bg='#3A9D6A';
    heatRow.appendChild(h('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:'6px'}},
      h('div',{style:{width:'28px',height:'28px',borderRadius:'8px',background:bg,border:isToday?'2px solid #E05A33':'none'}}),
      h('span',{style:{fontSize:'10px',color:isToday?'#E05A33':'#9E9890',fontWeight:isToday?'700':'normal'}},ds.slice(8))
    ));
  });
  c.appendChild(h('div',{className:'card',style:{padding:'16px',marginBottom:'16px'}},h('div',{style:{fontSize:'13px',fontWeight:'700',marginBottom:'12px'}},'📅 近 7 天'),heatRow));

  // 习惯列表
  if(habits.length===0){
    c.appendChild(h('div',{className:'card',style:{textAlign:'center',padding:'36px'}},
      h('div',{style:{fontSize:'40px',marginBottom:'10px'}},'🌱'),
      h('div',{style:{fontSize:'16px',fontWeight:'700'}},'还没有习惯'),
      h('div',{style:{fontSize:'12px',color:'#9E9890',marginTop:'4px'}},'创建一个习惯，开始养成好习惯吧')
    ));
  } else {
    const display=activeToday.length>0||habits.length===0?activeToday:habits;
    display.forEach(hb=>{
      const isChecked=records[hb.id]&&records[hb.id][today];
      const isActive=activeToday.includes(hb);
      const streak=calcStreak(records,hb.id);
      const card=h('div',{className:'card',style:{display:'flex',alignItems:'center',overflow:'hidden',padding:0,marginBottom:'10px',background:isChecked?'#3A9D6A08':'#FFFFFF',border:isChecked?'1px solid #3A9D6A30':'1px solid #E5DFD5'}},
        h('div',{style:{flex:1,display:'flex',alignItems:'center',padding:'14px',gap:'12px',cursor:isActive?'pointer':'default'},onClick:isActive?async()=>{
          if(!state.habitRecords[hb.id])state.habitRecords[hb.id]={};
          if(state.habitRecords[hb.id][today])delete state.habitRecords[hb.id][today];
          else state.habitRecords[hb.id][today]=true;
          await save('habitRecords');renderHabits(c);
        }:null},
          h('div',{style:{width:'36px',height:'36px',borderRadius:'18px',border:'2px solid '+(isChecked?'#3A9D6A':'#E5DFD5'),background:isChecked?'#3A9D6A':'#FFFFFF',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:'900',fontSize:'18px'}},isChecked?'✓':''),
          h('div',{style:{flex:1}},
            h('div',{style:{fontSize:'15px',fontWeight:'600',color:isChecked?'#3A9D6A':'#1A1815'}},hb.icon+' '+hb.name),
            h('div',{style:{display:'flex',gap:'10px',marginTop:'4px'}},
              hb.time?h('span',{style:{fontSize:'11px',color:'#9E9890'}},'⏰ '+hb.time):null,
              h('span',{style:{fontSize:'11px',color:'#9E9890'}},hb.repeatRule)
            )
          ),
          isActive?h('div',{style:{textAlign:'center'}},h('div',{style:{fontSize:'20px',fontWeight:'800',color:'#E05A33'}},streak),h('div',{style:{fontSize:'9px',color:'#9E9890'}},'天连续')):null
        ),
        h('button',{style:{padding:'14px',borderLeft:'1px solid #E5DFD5',background:'none',border:'none',cursor:'pointer',fontSize:'12px',color:'#9E9890'},onClick:()=>{
          if(confirm('删除习惯「'+hb.name+'」？')){state.habits=state.habits.filter(x=>x.id!==hb.id);save('habits').then(()=>renderHabits(c))}
        }},'编辑')
      );
      c.appendChild(card);
    });
  }
}

// ============== 课程表 ==============
function renderCourses(c){
  const courses=state.courses||[];
  const settings=state.settings||{};
  const todayDow=todayWeekday();
  let currentWeek=null;
  if(settings.semesterStart){
    const ss=parseYMD(settings.semesterStart);
    const diff=Math.floor((startOfDay(new Date())-startOfDay(ss))/(7*DAY_MS))+1;
    if(diff>0)currentWeek=diff;
  }
  let selectedDay=todayDow;
  c.appendChild(h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}},
    h('div',{},h('div',{style:{fontSize:'24px',fontWeight:'800'}},'课程表'),h('div',{style:{fontSize:'12px',color:'#6B6560',marginTop:'2px'}},WEEKDAYS[todayDow===7?0:todayDow]+' · '+(currentWeek?'第 '+currentWeek+' 周':'未设置学期'))),
    h('button',{className:'btn btn-accent',onClick:()=>{
      const title=prompt('课程名称');if(!title)return;
      const startTime=prompt('开始时间（如 08:00）','08:00')||'08:00';
      const endTime=prompt('结束时间（如 09:30）','09:30')||'09:30';
      const location=prompt('地点（可选）','')||'';
      const teacher=prompt('教师（可选）','')||'';
      const days=prompt('哪几天？（1-7，逗号分隔，如 1,3,5）','1');
      const dows=days.split(',').map(d=>parseInt(d.trim())).filter(d=>d>=1&&d<=7);
      const colors=['#E05A33','#2B7CB5','#3A9D6A','#D4930A','#8B5CF6','#D43B2F'];
      const color=colors[courses.length%colors.length];
      dows.forEach(d=>{
        state.courses.push({id:'c'+Date.now()+d,title,startTime,endTime,location,teacher,color,day:d,createdAt:new Date().toISOString()});
      });
      save('courses').then(()=>renderCourses(c));
    }},'＋ 添加')
  ));
  // Day tabs
  const dayTabs=h('div',{style:{display:'flex',gap:'6px',marginBottom:'16px',overflowX:'auto'}});
  for(let d=1;d<=7;d++){
    const isToday=d===todayDow;
    const isActive=d===selectedDay;
    const count=courses.filter(co=>co.day===d).length;
    dayTabs.appendChild(h('div',{style:{padding:'10px 14px',borderRadius:'12px',background:isActive?'#E05A33':'#FFFFFF',border:isActive?'1px solid #E05A33':(isToday?'1px solid #E05A3360':'1px solid #E5DFD5'),color:isActive?'#fff':'#6B6560',fontSize:'13px',fontWeight:'600',cursor:'pointer',textAlign:'center',minWidth:'48px'},onClick:()=>{selectedDay=d;renderCourses(c)}},
      WEEKDAYS[d===7?0:d],
      count>0?h('div',{style:{fontSize:'10px',color:isActive?'#fffCC':'#9E9890',marginTop:'2px'}},count+'节'):null
    ));
  }
  c.appendChild(dayTabs);
  // Course list for selected day
  const dayCourses=courses.filter(co=>co.day===selectedDay).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  if(dayCourses.length===0){
    c.appendChild(h('div',{className:'card',style:{textAlign:'center',padding:'32px'}},h('div',{style:{fontSize:'14px',color:'#6B6560',marginBottom:'12px'}},WEEKDAYS[selectedDay===7?0:selectedDay]+'没有课程'),h('button',{className:'btn btn-accent',onClick:()=>{
      const title=prompt('课程名称');if(!title)return;
      const startTime=prompt('开始时间（如 08:00）','08:00')||'08:00';
      const endTime=prompt('结束时间（如 09:30）','09:30')||'09:30';
      const colors=['#E05A33','#2B7CB5','#3A9D6A','#D4930A','#8B5CF6'];
      const color=colors[courses.length%colors.length];
      state.courses.push({id:'c'+Date.now(),title,startTime,endTime,color,day:selectedDay,createdAt:new Date().toISOString()});
      save('courses').then(()=>renderCourses(c));
    }},'添加课程')));
  } else {
    dayCourses.forEach(co=>{
      c.appendChild(h('div',{className:'card',style:{display:'flex',overflow:'hidden',padding:0,cursor:'pointer'},onClick:()=>{
        if(confirm('删除课程「'+co.title+'」？')){state.courses=state.courses.filter(x=>x.id!==co.id);save('courses').then(()=>renderCourses(c))}
      }},
        h('div',{style:{width:'5px',background:co.color||'#E05A33'}}),
        h('div',{style:{flex:1,padding:'14px'}},
          h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center'}},
            h('span',{style:{fontSize:'16px',fontWeight:'700'}},co.title),
            h('span',{style:{padding:'3px 8px',borderRadius:'8px',background:(co.color||'#E05A33')+'15',color:co.color||'#E05A33',fontSize:'11px',fontWeight:'700'}},co.startTime+' - '+co.endTime)
          ),
          h('div',{style:{display:'flex',gap:'16px',marginTop:'8px'}},
            co.teacher?h('span',{style:{fontSize:'12px',color:'#6B6560'}},co.teacher):null,
            co.location?h('span',{style:{fontSize:'12px',color:'#6B6560'}},co.location):null
          )
        )
      ));
    });
  }
  // Week overview
  const weekStats=h('div',{style:{display:'flex',justifyContent:'space-around',alignItems:'flex-end',height:'96px'}});
  const counts=[1,2,3,4,5,6,7].map(d=>courses.filter(co=>co.day===d).length);
  const maxCount=Math.max(1,...counts);
  for(let d=1;d<=7;d++){
    const count=counts[d-1];
    const isToday=d===todayDow;
    const barH=Math.round((count/maxCount)*56)+4;
    weekStats.appendChild(h('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',gap:'4px',height:'96px'}},
      h('div',{style:{width:'24px',borderRadius:'4px',minHeight:'4px',height:barH+'px',background:isToday?'#E05A33':'#E5DFD5'}}),
      h('span',{style:{fontSize:'10px',color:isToday?'#E05A33':'#9E9890',fontWeight:isToday?'700':'normal'}},WEEKDAYS[d===7?0:d].slice(1)),
      h('span',{style:{fontSize:'10px',color:'#9E9890'}},count)
    ));
  }
  c.appendChild(h('div',{className:'card',style:{marginTop:'24px',padding:'16px'}},h('div',{style:{fontSize:'14px',fontWeight:'700',marginBottom:'12px'}},'全周概览'),weekStats));
}

// ============== 日记 ==============
function renderDiary(c){
  const diary=state.diary||[];
  const sorted=[...diary].sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
  c.appendChild(h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}},
    h('div',{},h('div',{style:{fontSize:'24px',fontWeight:'800'}},'日记'),h('div',{style:{fontSize:'12px',color:'#6B6560',marginTop:'2px'}},'记录每天的收获和心情')),
    h('button',{className:'btn btn-accent',onClick:()=>{
      const title=prompt('标题（可选）','')||'';
      const content=prompt('内容','')||'';
      if(!content.trim())return;
      state.diary.push({id:'d'+Date.now(),title,content,date:todayStr(),createdAt:new Date().toISOString()});
      save('diary').then(()=>renderDiary(c));
    }},'＋ 写日记')
  ));
  if(sorted.length===0){
    c.appendChild(h('div',{className:'card',style:{textAlign:'center',padding:'36px'}},
      h('div',{style:{fontSize:'40px',marginBottom:'10px'}},'📝'),
      h('div',{style:{fontSize:'16px',fontWeight:'700'}},'日记本是空的'),
      h('div',{style:{fontSize:'12px',color:'#9E9890',marginTop:'4px'}},'记录一下今天的收获或心情吧')
    ));
  } else {
    // Group by date
    const grouped={};
    sorted.forEach(item=>{
      const key=item.date||todayStr();
      if(!grouped[key])grouped[key]=[];
      grouped[key].push(item);
    });
    Object.entries(grouped).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([date,items])=>{
      c.appendChild(h('div',{style:{fontSize:'12px',color:'#6B6560',fontWeight:'700',marginBottom:'4px',marginTop:'8px'}},fmtDate(date)));
      items.forEach(item=>{
        c.appendChild(h('div',{className:'card',style:{cursor:'pointer'},onClick:()=>{
          if(confirm('删除这条日记？')){state.diary=state.diary.filter(x=>x.id!==item.id);save('diary').then(()=>renderDiary(c))}
        }},
          item.title?h('div',{style:{fontSize:'15px',fontWeight:'700',marginBottom:'4px'}},item.title):null,
          h('div',{style:{fontSize:'14px',color:'#6B6560',lineHeight:'21px',whiteSpace:'pre-wrap'}},item.content)
        ));
      });
    });
  }
}

// ============== 设置 ==============
function renderSettings(c){
  const s=state.settings||{};
  const activeTasks=state.tasks.filter(t=>!t.done&&!t.deleted).length;
  const doneTasks=state.tasks.filter(t=>t.done&&!t.deleted).length;
  c.appendChild(h('div',{style:{fontSize:'24px',fontWeight:'800'}},'设置'));
  c.appendChild(h('div',{style:{fontSize:'12px',color:'#6B6560',marginTop:'2px',marginBottom:'16px'}},'API · 偏好 · 数据管理'));

  // 数据概览
  const stats=h('div',{className:'card',style:{display:'flex',padding:'12px',marginBottom:'20px'}});
  [{num:activeTasks,label:'进行中'},{num:doneTasks,label:'已完成'},{num:state.courses.length,label:'课程'},{num:state.habits.length,label:'习惯'},{num:state.diary.length,label:'笔记'}].forEach(st=>{
    stats.appendChild(h('div',{style:{flex:1,textAlign:'center'}},h('div',{style:{fontSize:'20px',fontWeight:'800',color:'#E05A33'}},st.num),h('div',{style:{fontSize:'10px',color:'#9E9890',marginTop:'2px'}},st.label)));
  });
  c.appendChild(stats);

  // 语言模型
  c.appendChild(renderSettingsSection('📡 语言模型',s.llmModel||'未配置',!!s.llmModel,'#E05A33',h('div',{},
    h('div',{style:{fontSize:'11px',color:'#9E9890',lineHeight:'16px',marginBottom:'10px'}},'填写 OpenAI 兼容的 API 信息。支持 OpenAI、DeepSeek、硅基流动等。'),
    h('div',{style:{marginBottom:'8px'}},h('label',{style:{fontSize:'12px',color:'#9E9890',display:'block',marginBottom:'4px'}},'接口地址 (Base URL)'),h('input',{className:'input',id:'set_llmBaseUrl',value:s.llmBaseUrl||'',placeholder:'https://api.openai.com/v1'})),
    h('div',{style:{marginBottom:'8px'}},h('label',{style:{fontSize:'12px',color:'#9E9890',display:'block',marginBottom:'4px'}},'API Key'),h('input',{className:'input',id:'set_llmApiKey',type:'password',value:s.llmApiKey||'',placeholder:'sk-...'})),
    h('div',{style:{marginBottom:'8px'}},h('label',{style:{fontSize:'12px',color:'#9E9890',display:'block',marginBottom:'4px'}},'模型名称'),h('div',{style:{display:'flex',gap:'8px'}},h('input',{className:'input',id:'set_llmModel',value:s.llmModel||'',placeholder:'gpt-4o-mini',style:{flex:1}}),h('button',{className:'btn btn-outline btn-sm',id:'fetchLlmModels'},'获取模型列表'))),
    h('div',{id:'llmModelList'}),
    h('button',{className:'btn btn-outline',style:{marginTop:'8px'},id:'testLlmBtn'},'测试连接')
  )));

  // 嵌入模型
  c.appendChild(renderSettingsSection('🧬 嵌入模型',s.embeddingModel||'未配置',!!s.embeddingModel,'#8B5CF6',h('div',{},
    h('div',{style:{fontSize:'11px',color:'#9E9890',lineHeight:'16px',marginBottom:'10px'}},'用于日记/学习笔记的语义检索（RAG）。API Key 留空则复用语言模型的。'),
    h('div',{style:{marginBottom:'8px'}},h('label',{style:{fontSize:'12px',color:'#9E9890',display:'block',marginBottom:'4px'}},'接口地址 (Base URL)'),h('input',{className:'input',id:'set_embBaseUrl',value:s.embeddingBaseUrl||'',placeholder:'https://api.openai.com/v1'})),
    h('div',{style:{marginBottom:'8px'}},h('label',{style:{fontSize:'12px',color:'#9E9890',display:'block',marginBottom:'4px'}},'API Key（可选）'),h('input',{className:'input',id:'set_embApiKey',type:'password',value:s.embeddingApiKey||'',placeholder:'留空则复用语言模型 API Key'})),
    h('div',{},h('label',{style:{fontSize:'12px',color:'#9E9890',display:'block',marginBottom:'4px'}},'模型名称'),h('div',{style:{display:'flex',gap:'8px'}},h('input',{className:'input',id:'set_embModel',value:s.embeddingModel||'',placeholder:'text-embedding-3-large',style:{flex:1}}),h('button',{className:'btn btn-outline btn-sm',id:'fetchEmbModels'},'获取模型列表'))),
    h('div',{id:'embModelList'})
  )));

  // 待办规则
  c.appendChild(renderSettingsSection('📋 待办规则','短期阈值 '+(s.threshold||7)+' 天',false,'#2B7CB5',h('div',{},
    h('div',{style:{display:'flex',gap:'8px',marginBottom:'8px'}},[3,5,7,14].map(n=>h('div',{className:'chip'+((s.threshold||7)===n?' active':''),onClick:async()=>{state.settings.threshold=n;await save('settings');renderSettings(c)}},n+' 天'))),
    h('div',{style:{fontSize:'11px',color:'#9E9890',lineHeight:'16px'}},'剩余天数 ≤ 此值的任务自动归入「短期」象限。')
  )));

  // 学期设置
  c.appendChild(renderSettingsSection('📅 学期设置',s.semesterStart?('开学 '+s.semesterStart):'未设置',!!s.semesterStart,'#D4930A',h('div',{},
    h('label',{style:{fontSize:'12px',color:'#9E9890',display:'block',marginBottom:'4px'}},'开学日期'),
    h('input',{className:'input',id:'set_semesterStart',value:s.semesterStart||'',placeholder:'YYYY-MM-DD'}),
    h('div',{style:{fontSize:'11px',color:'#9E9890',lineHeight:'16px',marginTop:'6px'}},'用于计算当前第几周和课程的单双周。格式：2025-09-01')
  )));

  // 数据管理
  c.appendChild(renderSettingsSection('🗑️ 数据管理','清除 / 重置',false,'#D43B2F',h('div',{},
    h('button',{className:'btn btn-danger',onClick:async()=>{
      if(confirm('此操作不可恢复，确定继续？')){
        state.tasks=[];state.courses=[];state.habits=[];state.habitRecords={};state.plans={};state.diary=[];state.insights=[];state.settings={threshold:7};
        await Promise.all(['tasks','courses','habits','habitRecords','settings','plans','diary','insights'].map(k=>save(k)));
        renderSettings(c);
      }
    }},'清除所有数据'),
    h('div',{style:{fontSize:'11px',color:'#9E9890',lineHeight:'16px',marginTop:'6px'}},'清除所有任务、课程、习惯、笔记和设置数据。不可恢复。')
  )));

  // About
  c.appendChild(h('div',{className:'card',style:{marginTop:'8px',textAlign:'center'}},h('div',{style:{fontSize:'12px',color:'#6B6560',lineHeight:'19px'}},'Life OS — 你的个人生活操作系统\n版本 1.0.0 (MVP)\n\n功能：四象限待办 · 课程表 · 每日打卡 · 七计划 · 日记')));

  // Wire up settings interactions
  wireSettingsEvents();
}

function renderSettingsSection(title,sub,active,dotColor,content){
  let expanded=false;
  const row=h('div',{className:'card',style:{marginBottom:'8px',padding:'14px',display:'flex',alignItems:'center',gap:'10px',cursor:'pointer'}},async function(e){
    // toggle
  });
  const dot=h('div',{style:{width:'8px',height:'8px',borderRadius:'4px',background:active?dotColor:'#E5DFD5',flexShrink:'0'}});
  const titleEl=h('div',{style:{flex:1}},h('div',{style:{fontSize:'15px',fontWeight:'700'}},title),h('div',{style:{fontSize:'12px',color:'#9E9890',marginTop:'2px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}},sub));
  const arrow=h('span',{style:{fontSize:'16px',color:'#9E9890'}},'▾');
  row.appendChild(dot);row.appendChild(titleEl);row.appendChild(arrow);
  const expDiv=h('div',{className:'card',style:{marginBottom:'8px',padding:'14px',display:'none'}});
  expDiv.appendChild(content);
  row.addEventListener('click',()=>{
    expanded=!expanded;
    arrow.textContent=expanded?'▴':'▾';
    expDiv.style.display=expanded?'block':'none';
  });
  const container=h('div',{},row,expDiv);
  return container;
}

function wireSettingsEvents(){
  // Delay to ensure DOM is ready
  setTimeout(()=>{
    // Save settings on input blur
    const fields=['set_llmBaseUrl','set_llmApiKey','set_llmModel','set_embBaseUrl','set_embApiKey','set_embModel','set_semesterStart'];
    fields.forEach(id=>{
      const el=document.getElementById(id);
      if(!el)return;
      el.addEventListener('change',async()=>{
        const map={set_llmBaseUrl:'llmBaseUrl',set_llmApiKey:'llmApiKey',set_llmModel:'llmModel',set_embBaseUrl:'embeddingBaseUrl',set_embApiKey:'embeddingApiKey',set_embModel:'embeddingModel',set_semesterStart:'semesterStart'};
        state.settings[map[id]]=el.value;
        await save('settings');
      });
    });

    // Fetch LLM models
    const fetchLlm=document.getElementById('fetchLlmModels');
    if(fetchLlm)fetchLlm.addEventListener('click',async()=>{
      const apiKey=document.getElementById('set_llmApiKey').value;
      const baseUrl=document.getElementById('set_llmBaseUrl').value;
      if(!apiKey||!baseUrl){alert('请先填写 API Key 和 Base URL');return}
      const listEl=document.getElementById('llmModelList');
      listEl.innerHTML='';listEl.appendChild(h('div',{style:{fontSize:'12px',color:'#9E9890',padding:'8px'}},'正在获取模型列表...'));
      try{
        const url=baseUrl.replace(/\/+$/,'')+'/models';
        const resp=await fetch(url,{method:'GET',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'}});
        if(!resp.ok)throw new Error('HTTP '+resp.status);
        const data=await resp.json();
        const models=Array.isArray(data?.data)?data.data:[];
        listEl.innerHTML='';
        if(models.length===0){listEl.appendChild(h('div',{style:{fontSize:'12px',color:'#9E9890',padding:'8px'}},'未获取到模型列表，请手动填写'));return}
        const ml=h('div',{className:'model-list'});
        models.sort((a,b)=>a.id.localeCompare(b.id)).forEach(m=>{
          ml.appendChild(h('div',{className:'model-item',onClick:()=>{
            document.getElementById('set_llmModel').value=m.id;
            state.settings.llmModel=m.id;save('settings');
          }},m.id,m.owned_by?h('div',{style:{fontSize:'10px',color:'#9E9890',marginTop:'2px'}},m.owned_by):null));
        });
        listEl.appendChild(ml);
      }catch(err){listEl.innerHTML='';listEl.appendChild(h('div',{style:{fontSize:'12px',color:'#D43B2F',padding:'8px'}},'获取失败：'+err.message))}
    });

    // Fetch Embedding models
    const fetchEmb=document.getElementById('fetchEmbModels');
    if(fetchEmb)fetchEmb.addEventListener('click',async()=>{
      const apiKey=document.getElementById('set_embApiKey').value||document.getElementById('set_llmApiKey').value;
      const baseUrl=document.getElementById('set_embBaseUrl').value||document.getElementById('set_llmBaseUrl').value;
      if(!apiKey||!baseUrl){alert('请先填写 API Key 和 Base URL');return}
      const listEl=document.getElementById('embModelList');
      listEl.innerHTML='';listEl.appendChild(h('div',{style:{fontSize:'12px',color:'#9E9890',padding:'8px'}},'正在获取模型列表...'));
      try{
        const url=baseUrl.replace(/\/+$/,'')+'/models';
        const resp=await fetch(url,{method:'GET',headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json'}});
        if(!resp.ok)throw new Error('HTTP '+resp.status);
        const data=await resp.json();
        const models=Array.isArray(data?.data)?data.data:[];
        listEl.innerHTML='';
        if(models.length===0){listEl.appendChild(h('div',{style:{fontSize:'12px',color:'#9E9890',padding:'8px'}},'未获取到模型列表'));return}
        const ml=h('div',{className:'model-list'});
        models.filter(m=>/embed|bge/i.test(m.id)).forEach(m=>{
          ml.appendChild(h('div',{className:'model-item',onClick:()=>{
            document.getElementById('set_embModel').value=m.id;
            state.settings.embeddingModel=m.id;save('settings');
          }},m.id,m.owned_by?h('div',{style:{fontSize:'10px',color:'#9E9890',marginTop:'2px'}},m.owned_by):null));
        });
        if(ml.children.length===0)models.forEach(m=>ml.appendChild(h('div',{className:'model-item',onClick:()=>{
          document.getElementById('set_embModel').value=m.id;
          state.settings.embeddingModel=m.id;save('settings');
        }},m.id)));
        listEl.appendChild(ml);
      }catch(err){listEl.innerHTML='';listEl.appendChild(h('div',{style:{fontSize:'12px',color:'#D43B2F',padding:'8px'}},'获取失败：'+err.message))}
    });

    // Test LLM connection
    const testBtn=document.getElementById('testLlmBtn');
    if(testBtn)testBtn.addEventListener('click',async()=>{
      const apiKey=document.getElementById('set_llmApiKey').value;
      const baseUrl=document.getElementById('set_llmBaseUrl').value;
      const model=document.getElementById('set_llmModel').value;
      if(!apiKey||!baseUrl||!model){alert('请先填写 API Key、Base URL 和模型名称');return}
      testBtn.textContent='测试中...';testBtn.disabled=true;
      try{
        const url=baseUrl.replace(/\/+$/,'')+'/chat/completions';
        const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},body:JSON.stringify({model,messages:[{role:'user',content:'Hi'}],max_tokens:5})});
        if(resp.ok){const data=await resp.json();alert('连接成功 · '+(data.model||model))}else{alert('连接失败（'+resp.status+'）')}
      }catch(err){alert('连接失败：'+err.message)}
      testBtn.textContent='测试连接';testBtn.disabled=false;
    });
  },50);
}

// ============== 初始化 ==============
async function init(){
  try{
    await loadAll();
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab=>{
      tab.addEventListener('click',()=>{
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        currentTab=tab.dataset.tab;
        render();
      });
    });
    // AI panel
    const aiBtn=document.getElementById('aiBtn');
    const aiPanel=document.getElementById('aiPanel');
    const aiClose=document.getElementById('aiClose');
    const aiSend=document.getElementById('aiSend');
    const aiInput=document.getElementById('aiInput');
    const aiMessages=document.getElementById('aiMessages');
    if(aiBtn)aiBtn.addEventListener('click',()=>{aiPanel.classList.remove('hidden');aiInput.focus()});
    if(aiClose)aiClose.addEventListener('click',()=>{aiPanel.classList.add('hidden')});
    if(aiSend)aiSend.addEventListener('click',sendAIMessage);
    if(aiInput)aiInput.addEventListener('keydown',e=>{if(e.key==='Enter')sendAIMessage()});
    async function sendAIMessage(){
      const q=aiInput.value.trim();if(!q)return;
      aiInput.value='';
      aiMessages.appendChild(h('div',{className:'ai-msg user'},q));
      const botMsg=h('div',{className:'ai-msg bot'},'思考中...');
      aiMessages.appendChild(botMsg);
      aiMessages.scrollTop=aiMessages.scrollHeight;
      try{
        const s=state.settings;
        if(!s.llmApiKey||!s.llmBaseUrl||!s.llmModel){botMsg.textContent='请先在设置页面配置语言模型 API。';return}
        const url=s.llmBaseUrl.replace(/\/+$/,'')+'/chat/completions';
        const messages=[...state.chatHistory,{role:'user',content:q}];
        const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+s.llmApiKey},body:JSON.stringify({model:s.llmModel,messages,temperature:0.7,max_tokens:1000})});
        if(!resp.ok){botMsg.textContent='API 错误（'+resp.status+'）';return}
        const data=await resp.json();
        const reply=data.choices?.[0]?.message?.content||'未收到回复';
        botMsg.textContent=reply;
        state.chatHistory.push({role:'user',content:q},{role:'assistant',content:reply});
        if(state.chatHistory.length>20)state.chatHistory=state.chatHistory.slice(-20);
        await save('chatHistory');
      }catch(err){botMsg.textContent='请求失败：'+err.message}
      aiMessages.scrollTop=aiMessages.scrollHeight;
    }
    render();
  }catch(err){
    initError='加载失败：'+err.message+'（请确认服务已启动）';
    render();
  }
}

window.addEventListener('load',init);
