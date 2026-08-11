#!/usr/bin/env python3
"""生成 Life OS Desktop index.html — 对齐手机端功能"""
import os

HTML = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Life OS</title>
<style>
:root{--bg:#F5F0E8;--card:#fff;--ink:#1A1815;--sub:#6B6560;--muted:#9E9890;--line:#E5DFD5;--accent:#E05A33;--accentSoft:#FBE8E0;--q1:#D43B2F;--q2:#D4930A;--q3:#2B7CB5;--q4:#3A9D6A;--success:#3A9D6A;--danger:#D43B2F}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh}
#app{display:flex;flex-direction:column;min-height:100vh;max-width:820px;margin:0 auto}
header{padding:12px 20px;background:var(--card);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between}
header h1{font-size:20px;font-weight:800}
.tabs{display:flex;border-bottom:1px solid var(--line);background:var(--card)}
.tab{flex:1;text-align:center;padding:12px 0;font-size:13px;color:var(--sub);cursor:pointer;border-bottom:2px solid transparent;transition:.15s}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);font-weight:700}
#content{flex:1;overflow-y:auto;padding:16px;padding-bottom:80px}
.card{background:var(--card);border-radius:14px;border:1px solid var(--line);padding:14px;margin-bottom:10px}
.empty{text-align:center;color:var(--muted);padding:30px;font-size:13px}
.btn{padding:8px 16px;border-radius:10px;border:none;font-size:13px;cursor:pointer;font-weight:600}
.btn-accent{background:var(--accent);color:#fff}
.btn-outline{background:transparent;border:1px solid var(--line);color:var(--ink)}
.btn-sm{padding:5px 10px;font-size:11px}
.btn-danger{background:transparent;border:1px solid var(--danger);color:var(--danger)}
.btn:disabled{opacity:.4;cursor:not-allowed}
.input{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:10px;font-size:13px;background:var(--bg);outline:none;color:var(--ink)}
.input:focus{border-color:var(--accent)}
textarea.input{min-height:60px;resize:vertical;font-family:inherit}
.fab{position:fixed;bottom:70px;right:24px;width:50px;height:50px;border-radius:50%;background:var(--accent);color:#fff;border:none;font-size:22px;cursor:pointer;box-shadow:0 4px 12px rgba(224,90,51,.35);z-index:100;display:flex;align-items:center;justify-content:center}
.view-toggle{display:flex;background:var(--card);border-radius:12px;border:1px solid var(--line);padding:3px;margin-bottom:14px}
.view-btn{flex:1;padding:8px 0;border-radius:9px;text-align:center;cursor:pointer;font-size:13px;color:var(--sub);font-weight:600;transition:.15s}
.view-btn.active{background:var(--accent);color:#fff;font-weight:700}
.summary-bar{background:var(--card);border-radius:10px;border:1px solid var(--line);padding:10px 14px;margin-bottom:14px;font-size:13px;color:var(--sub)}
.quad-grid{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px}
.quad-cell{width:48%;background:var(--card);border-radius:14px;border:1px solid var(--line);border-top-width:3px;padding:10px;min-height:120px}
.quad-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
.quad-title{font-size:14px;font-weight:800}
.quad-count{padding:2px 7px;border-radius:10px;font-size:11px;font-weight:700}
.quad-desc{font-size:10px;color:var(--muted);margin-bottom:8px}
.quad-empty{font-size:11px;color:var(--muted);text-align:center;margin-top:12px}
.task-card{background:var(--card);border-radius:12px;border:1px solid var(--line);padding:12px;margin-bottom:8px;cursor:pointer;transition:box-shadow .15s}
.task-card:hover{box-shadow:0 2px 8px rgba(0,0,0,.06)}
.t-title{font-size:14px;font-weight:600;line-height:20px}
.t-row{display:flex;align-items:center;gap:6px;margin-top:8px}
.task-badge{padding:3px 8px;border-radius:8px;font-size:11px;font-weight:700}
.task-ddl{font-size:11px;color:var(--sub);margin-top:6px}
.task-ddl.overdue{color:var(--danger);font-weight:700}
.chips-row{display:flex;flex-wrap:wrap;gap:8px}
.chip{padding:8px 14px;border-radius:20px;border:1px solid var(--line);background:var(--card);font-size:13px;color:var(--sub);cursor:pointer;font-weight:500;transition:.15s}
.chip.active{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:700}
.switch-row{display:flex;align-items:center;justify-content:space-between;background:var(--card);border-radius:12px;border:1px solid var(--line);padding:14px;margin-top:12px}
.switch-label{font-size:14px;font-weight:600}
.switch-hint{font-size:11px;color:var(--muted);margin-top:2px}
.switch{position:relative;width:44px;height:24px;border-radius:12px;background:var(--line);cursor:pointer;transition:background .2s;flex-shrink:0}
.switch.on{background:var(--accent)}
.switch::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
.switch.on::after{transform:translateX(20px)}
.preview-box{background:var(--accentSoft);border-radius:12px;border-left:4px solid var(--accent);padding:12px;margin-top:16px;font-size:13px}
.add-form{background:var(--card);border-radius:14px;padding:16px;margin-bottom:14px}
.add-form h3{font-size:16px;font-weight:800;margin-bottom:12px}
.form-row{margin-bottom:10px}
.form-row label{display:block;font-size:12px;color:var(--sub);margin-bottom:4px;font-weight:600}
.section-title{font-size:13px;color:var(--sub);margin:14px 0 6px;font-weight:700}
.check{width:20px;height:20px;border-radius:7px;border:2px solid var(--line);cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}
.check.done{background:var(--success);border-color:var(--success);color:#fff}
.week-nav{display:flex;align-items:center;margin-bottom:6px}
.nav-btn{width:40px;height:40px;border-radius:12px;background:var(--card);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;color:var(--sub);font-weight:700}
.week-center{flex:1;text-align:center}
.week-title{font-size:20px;font-weight:800}
.week-range{font-size:12px;color:var(--sub);margin-top:2px}
.back-to-now{text-align:center;margin-bottom:10px;cursor:pointer}
.back-to-now span{font-size:12px;color:var(--accent);font-weight:600}
.plan-column{background:var(--card);border-radius:16px;border:1px solid var(--line);padding:14px;margin-bottom:14px}
.plan-col-title{font-size:15px;font-weight:800}
.plan-col-count{font-size:12px;color:var(--muted);font-weight:600}
.plan-col-hint{font-size:11px;color:var(--muted);margin-top:2px;margin-bottom:10px}
.plan-empty{font-size:13px;color:var(--muted);padding:8px 0}
.plan-item{display:flex;align-items:center;gap:8px;padding:4px 0}
.plan-checkbox{width:22px;height:22px;border-radius:7px;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;font-size:13px;font-weight:800}
.plan-checkbox.on{background:var(--success);border-color:var(--success);color:#fff}
.plan-item-text{font-size:14px;line-height:20px}
.plan-item-text.done{color:var(--muted);text-decoration:line-through}
.plan-del{padding:4px;cursor:pointer;font-size:13px;color:var(--muted);background:none;border:none}
.plan-del:hover{color:var(--danger)}
.link-chip{display:flex;align-items:center;gap:8px;background:var(--accentSoft);border-radius:10px;padding:6px 10px;margin-top:8px}
.link-chip-text{flex:1;font-size:12px;color:var(--accent);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.plan-add-row{display:flex;align-items:center;gap:8px;margin-top:10px}
.plan-link-btn{width:38px;height:38px;border-radius:10px;border:1px solid var(--line);background:var(--bg);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;color:var(--sub)}
.plan-add-input{flex:1;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:13px;color:var(--ink);outline:none}
.plan-add-input:focus{border-color:var(--accent)}
.plan-add-btn{border-radius:10px;padding:0 14px;height:38px;border:none;color:#fff;font-weight:700;font-size:13px;cursor:pointer}
.habit-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)}
.habit-row:last-child{border-bottom:none}
.habit-streak{font-size:11px;color:var(--accent);font-weight:600}
.del-btn{background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:4px;opacity:.5}
.del-btn:hover{opacity:1}
.settings-group{margin-bottom:20px}
.settings-group h3{font-size:13px;margin-bottom:10px;color:var(--sub);text-transform:uppercase;letter-spacing:.5px}
.model-list{margin-top:6px;max-height:200px;overflow-y:auto;border:1px solid var(--line);border-radius:7px}
.model-item{padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--line)}
.model-item:hover{background:var(--bg)}
.model-item:last-child{border-bottom:none}
.sync-url-box{background:var(--bg);padding:8px 10px;border-radius:7px;font-size:12px;font-family:monospace;word-break:break-all;cursor:pointer}
.hidden{display:none!important}
.ai-panel{position:fixed;top:0;left:0;right:0;bottom:0;background:var(--bg);z-index:200;display:flex;flex-direction:column}
.ai-header{padding:10px 16px;background:var(--card);display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line)}
.ai-messages{flex:1;overflow-y:auto;padding:16px}
.ai-msg{margin-bottom:10px;max-width:85%}
.ai-msg.user{margin-left:auto;background:var(--accent);color:#fff;padding:8px 12px;border-radius:14px 14px 4px 14px}
.ai-msg.bot{background:var(--card);padding:8px 12px;border-radius:4px 14px 14px 14px;white-space:pre-wrap;line-height:1.5;font-size:13px}
.ai-input{padding:10px;background:var(--card);display:flex;gap:8px;border-top:1px solid var(--line)}
.ai-input input{flex:1}
.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);z-index:300;display:flex;align-items:center;justify-content:center;padding:24px}
.modal-sheet{background:var(--bg);border-radius:20px;padding:20px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto}
.modal-title{font-size:18px;font-weight:800;margin-bottom:16px}
.picker-item{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line);cursor:pointer}
.picker-dot{width:8px;height:8px;border-radius:4px;flex-shrink:0}
.reminder{background:var(--accentSoft);border-radius:12px;padding:12px;margin-bottom:12px;font-size:13px;color:var(--accent);line-height:19px}
.detail-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.4);z-index:300;display:flex;align-items:flex-end;justify-content:center}
.detail-inner{background:var(--bg);border-radius:24px 24px 0 0;padding:20px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto}
</style>
</head>
<body>
<div id="app">
<header><h1>Life OS</h1><span class="status" id="syncStatus">检查中...</span></header>
<div class="tabs">
<div class="tab active" data-tab="todo">待办</div>
<div class="tab" data-tab="course">课程</div>
<div class="tab" data-tab="habit">习惯</div>
<div class="tab" data-tab="plan">计划</div>
<div class="tab" data-tab="diary">日记</div>
<div class="tab" data-tab="settings">设置</div>
</div>
<div id="content"><div class="empty">加载中...</div></div>
<button class="fab" id="aiBtn">💬</button>
</div>
<div class="ai-panel hidden" id="aiPanel">
<div class="ai-header"><button class="btn btn-outline btn-sm" id="aiClose">← 返回</button><h3>AI 助手</h3></div>
<div class="ai-messages" id="aiMessages"></div>
<div class="ai-input"><input class="input" id="aiInput" placeholder="问点什么..."><button class="btn btn-accent" id="aiSend">发送</button></div>
</div>
<script>
const API=location.origin+'/api';
let state={tasks:[],courses:[],habits:[],habitRecords:{},settings:{},chatHistory:[],plans:{},diary:[],insights:[]};
let currentTab='todo',initError=null;
const Q={Q1:{name:'马上做',desc:'短期 · 紧急',color:'#D43B2F'},Q2:{name:'计划做',desc:'长期 · 紧急',color:'#D4930A'},Q3:{name:'顺手做',desc:'短期 · 不紧急',color:'#2B7CB5'},Q4:{name:'有空做',desc:'长期 · 不紧急',color:'#3A9D6A'}};
const DDL_PRESETS=[{label:'今天',days:0},{label:'明天',days:1},{label:'3天后',days:3},{label:'7天后',days:7},{label:'14天后',days:14},{label:'30天后',days:30}];
const WEEKDAYS=['周日','周一','周二','周三','周四','周五','周六'];
const TH=7;
function fmtYMD(d){const y=d.getFullYear();const m=String(d.getMonth()+1).padStart(2,'0');const da=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+da}
function parseYMD(s){const p=String(s).slice(0,10).split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
function startOfDay(d){const x=new Date(d);x.setHours(0,0,0,0);return x}
const DAY_MS=86400000;
function daysLeft(ddl){if(!ddl)return null;const t=typeof ddl==='string'?parseYMD(ddl):ddl;return Math.round((startOfDay(t)-startOfDay(new Date()))/DAY_MS)}
function timeScope(ddl,th=7){const d=daysLeft(ddl);if(d===null)return 'long';return d<=th?'short':'long'}
function quadrantOf(task,th=7){const s=timeScope(task.ddl,th);if(s==='short'&&task.urgent)return'Q1';if(s==='long'&&task.urgent)return'Q2';if(s==='short'&&!task.urgent)return'Q3';return'Q4'}
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

function render(){const c=document.getElementById('content');c.innerHTML='';if(initError){c.appendChild(h('div',{className:'empty'},initError));return}if(currentTab==='todo')renderTodo(c);else if(currentTab==='course')renderCourses(c);else if(currentTab==='habit')renderHabits(c);else if(currentTab==='plan')renderPlans(c);else if(currentTab==='diary')renderDiary(c);else if(currentTab==='settings')renderSettings(c)}

// ====== 待办 ======
function renderTodo(c){
  const th=state.settings.threshold||TH;
  const activeTasks=state.tasks.filter(t=>!t.done&&!t.deleted);
  const groups=groupByQuadrant(activeTasks,th);
  c.appendChild(h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}},
    h('div',{},h('div',{style:{fontSize:'24px',fontWeight:'800'}},'我的待办'),h('div',{style:{fontSize:'12px',color:'#6B6560',marginTop:'2px'}},'DDL 自动归类 · 你只需标紧急')),
    h('button',{className:'btn btn-accent',onClick:()=>{addingTask=true;editTask=null;renderTodo(c)}},'＋ 新建')));
  c.appendChild(h('div',{className:'view-toggle'},
    h('div',{className:'view-btn'+(todoView==='grid'?' active':''),onClick:()=>{todoView='grid';renderTodo(c)}},'任务总览'),
    h('div',{className:'view-btn'+(todoView==='plan'?' active':''),onClick:()=>{todoView='plan';renderTodo(c)}},'本周计划')));
  if(todoView==='plan'){renderWeekPlan(c);return}
  if(addingTask)renderAddTaskForm(c,th);
  const oc=activeTasks.filter(t=>isOverdue(t.ddl)).length;
  const q1=groups.Q1.length;
  let parts=['共 '+activeTasks.length+' 项任务'];
  if(q1>0)parts.push(h('span',{style:{color:'#D43B2F'}},' · '+q1+' 项紧急'));
  if(oc>0)parts.push(h('span',{style:{color:'#D43B2F'}},' · '+oc+' 项逾期'));
  c.appendChild(h('div',{className:'summary-bar'},...parts));
  const grid=h('div',{className:'quad-grid'});
  ['Q1','Q2','Q3','Q4'].forEach(qk=>{
    const meta=Q[qk];const tasks=groups[qk];
    const cell=h('div',{className:'quad-cell',style:{borderTopColor:meta.color}},
      h('div',{className:'quad-head'},
        h('span',{className:'quad-title',style:{color:meta.color}},meta.name),
        h('span',{className:'quad-count',style:{background:meta.color+'20',color:meta.color}},tasks.length)),
      h('div',{className:'quad-desc'},meta.desc));
    if(tasks.length===0)cell.appendChild(h('div',{className:'quad-empty'},'暂无任务'));
    else tasks.forEach(t=>cell.appendChild(taskCardEl(t,th)));
    grid.appendChild(cell)});
  c.appendChild(grid);
  c.appendChild(h('div',{style:{fontSize:'12px',color:'#9E9890',marginTop:'14px',lineHeight:'18px'}},'剩余 ≤ '+th+' 天的任务自动归入「短期」象限。标记紧急后进入「马上做」。'));
  const dt=state.tasks.filter(t=>t.done&&!t.deleted);
  if(dt.length>0){
    c.appendChild(h('div',{className:'section-title',style:{cursor:'pointer'},onClick:()=>{showDone=!showDone;renderTodo(c)}},'已完成 ('+dt.length+') '+(showDone?'收起':'展开')));
    if(showDone){dt.forEach(t=>{
      c.appendChild(h('div',{className:'card',style:{display:'flex',alignItems:'center',gap:'10px'}},
        h('div',{className:'check done',onClick:async()=>{const tk=state.tasks.find(x=>x.id===t.id);if(tk){tk.done=false;tk.completedAt=null;await save('tasks');renderTodo(c)}}},