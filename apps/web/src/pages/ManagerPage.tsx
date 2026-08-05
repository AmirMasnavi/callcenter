import{useEffect,useMemo,useState}from'react';import{useQuery}from'@tanstack/react-query';import ReactECharts from'echarts-for-react';import{api,apiUrl,fa,faDate,faDateTime,Report,statusLabel}from'../lib/api';import JalaliDate,{todayIso}from'../components/JalaliDate';
const daysAgoIso=(n:number)=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)};import Loading from'../components/Loading';
import{chartBase,useChartTheme}from'../lib/chartTheme';
import{toCsv,download as saveFile}from'../lib/exportTable';
import Icon from'../components/Icon';
import Sheet from'../components/Sheet';
type Totals={reports:number,totalPeople:number,contacted:number,notContacted:number,ok:number,maybe:number,no:number,noAnswer:number,attendees:number,contactRate:number,okRate:number,showUpRate:number};type Agent={agentId:number;agentName:string;reports:number;totalPeople:number;contacted:number;ok:number;maybe:number;no:number;noAnswer:number;attendees:number;showUpRate:number};type SchoolRow={school:string;reports:number;totalPeople:number;contacted:number;ok:number;attendees:number;showUpRate:number};
type Data={totals:Totals;previous:Totals;schools:SchoolRow[];trend:{date:string;totalPeople:number;contacted:number;ok:number;maybe:number;no:number;noAnswer:number;attendees:number}[];agents:Agent[];reports:Report[]};
export default function ManagerPage(){
 const ct=useChartTheme(),base=chartBase(ct);
 // Filters and exports are occasional. Keeping both permanently on screen was the single
 // biggest source of clutter on this page, so each lives behind one control.
 const[filtersOpen,setFiltersOpen]=useState(false);
 const[exportOpen,setExportOpen]=useState(false);
 // A dashboard defaulting to a single day opens empty on any morning before the first
 // report lands, which reads as "broken" rather than "no data yet". Last 7 days shows a
 // trend immediately and still loads fast.
 const[from,setFrom]=useState(daysAgoIso(6)),[to,setTo]=useState(todayIso()),[context,setContext]=useState<'OPERATIONAL'|'OFFICIAL'>('OPERATIONAL'),[supervisor,setSupervisor]=useState(''),[agent,setAgent]=useState(''),[visible,setVisible]=useState<number[]>([]);
 const filters=useQuery({queryKey:['dashboard-filters'],queryFn:()=>api<{supervisors:{id:number;name:string}[];agents:{id:number;name:string;supervisorId?:number}[]}>('/api/v1/dashboard/filters')});
 const suffix=`&supervisorId=${supervisor}&agentId=${agent}`.replace(/&(?:supervisorId|agentId)=(&|$)/g,'$1'),q=useQuery({queryKey:['dashboard',from,to,context,supervisor,agent],queryFn:()=>api<Data>(`/api/v1/dashboard?from=${from}&to=${to}&context=${context}${suffix}`)});
 const d=q.data,t=d?.totals;useEffect(()=>{if(d)setVisible(d.agents.map(a=>a.agentId))},[d]);
 const cards=[['حاضرین در کلاس',t?.attendees,'attendees',d?.previous.attendees],['کل افراد',t?.totalPeople,'users',d?.previous.totalPeople],['تماس‌گرفته',t?.contacted,'phone',d?.previous.contacted],['تماس‌نگرفته',t?.notContacted,'doc',d?.previous.notContacted],['نتیجه OK',t?.ok,'ok',d?.previous.ok],['نرخ تماس',t?`${fa(t.contactRate)}٪`:0,'rate',d?.previous.contactRate]];
 const line={...base,tooltip:{...base.tooltip,trigger:'axis'},legend:{...base.legend,top:0},grid:{left:20,right:18,top:52,bottom:60,containLabel:true},xAxis:{...base.categoryAxis,type:'category',axisLabel:{...base.categoryAxis.axisLabel,rotate:(d?.trend.length||0)>5?30:0},data:d?.trend.map(x=>faDate(x.date))},yAxis:{...base.valueAxis,type:'value'},series:[{name:'کل افراد',type:'bar',data:d?.trend.map(x=>x.totalPeople),itemStyle:{color:ct.metric.total,borderRadius:[4,4,0,0]}},{name:'تماس‌گرفته',type:'line',smooth:true,symbolSize:7,data:d?.trend.map(x=>x.contacted),itemStyle:{color:ct.metric.contacted},lineStyle:{width:3}},{name:'OK',type:'line',smooth:true,symbolSize:7,data:d?.trend.map(x=>x.ok),itemStyle:{color:ct.metric.ok},lineStyle:{width:3}},{name:'حاضرین',type:'line',smooth:true,symbolSize:7,data:d?.trend.map(x=>x.attendees),itemStyle:{color:ct.metric.attendees},lineStyle:{width:3,type:'dashed'}}]};
 const shown=d?.agents.filter(a=>visible.includes(a.agentId))||[];
 const compare={...base,tooltip:{...base.tooltip,trigger:'axis'},legend:{...base.legend,top:0},grid:{left:20,right:15,top:48,bottom:70,containLabel:true},xAxis:{...base.categoryAxis,type:'category',axisLabel:{...base.categoryAxis.axisLabel,rotate:25},data:shown.map(a=>a.agentName)},yAxis:{...base.valueAxis,type:'value'},series:[{name:'تماس',type:'bar',data:shown.map(a=>a.contacted),itemStyle:{color:ct.metric.contacted,borderRadius:[4,4,0,0]}},{name:'OK',type:'bar',data:shown.map(a=>a.ok),itemStyle:{color:ct.metric.ok,borderRadius:[4,4,0,0]}},{name:'حاضرین',type:'bar',data:shown.map(a=>a.attendees),itemStyle:{color:ct.metric.attendees,borderRadius:[4,4,0,0]}}]};
 const topSchools=(d?.schools||[]).slice(0,10).slice().reverse();
 const schoolChart={...base,tooltip:{...base.tooltip,trigger:'axis',axisPointer:{type:'shadow'}},legend:{...base.legend,top:0},
  grid:{left:12,right:20,top:44,bottom:12,containLabel:true},
  xAxis:{...base.valueAxis,type:'value'},
  yAxis:{...base.categoryAxis,type:'category',data:topSchools.map(x=>x.school)},
  series:[
   {name:'پاسخ مثبت',type:'bar',data:topSchools.map(x=>x.ok),itemStyle:{color:ct.metric.ok,borderRadius:[0,4,4,0]}},
   {name:'حاضرین',type:'bar',data:topSchools.map(x=>x.attendees),itemStyle:{color:ct.metric.attendees,borderRadius:[0,4,4,0]}}]};
 const pie={...base,tooltip:{...base.tooltip,trigger:'item'},legend:{...base.legend,bottom:0},series:[{type:'pie',radius:['43%','72%'],avoidLabelOverlap:true,label:{position:'inside',formatter:'{b}\n{c}',fontSize:10,color:'#fff'},labelLine:{show:false},data:[{name:'OK',value:t?.ok||0,itemStyle:{color:ct.metric.ok}},{name:'شاید',value:t?.maybe||0,itemStyle:{color:ct.metric.maybe}},{name:'NO',value:t?.no||0,itemStyle:{color:ct.metric.no}},{name:'جواب نداد',value:t?.noAnswer||0,itemStyle:{color:ct.metric.noAnswer}}]}]};
 function download(ext:string){window.open(apiUrl(`/api/v1/exports/reports.${ext}?from=${from}&to=${to}&context=${context}${suffix}`))}
 return <div className="page manager"><header className="page-head"><div><span className="eyebrow">داشبورد مدیریت</span><h1>تصویر کامل کال‌سنتر</h1><p>آمار لحظه‌ای، مقایسه اپراتورها و جزئیات تمام گزارش‌ها.</p></div><div className="live"><i/>به‌روز و لحظه‌ای</div></header>
 <section className="toolbar">
  <div className="segmented"><button className={context==='OPERATIONAL'?'active':''} onClick={()=>setContext('OPERATIONAL')}>نمای لحظه‌ای</button><button className={context==='OFFICIAL'?'active':''} onClick={()=>setContext('OFFICIAL')}>آمار قطعی</button></div>
  <div className="toolbar-actions">
   {/* The current range is the one filter worth showing at rest — it frames every number
       on the page. Everything else opens on demand. */}
   <button className="filter-chip" onClick={()=>setFiltersOpen(true)}>
    <Icon name="search" size={16}/><span>{faDate(from)} — {faDate(to)}</span>
    {(supervisor||agent)&&<em className="filter-dot" aria-label="فیلتر فعال"/>}
   </button>
   <button className="icon-button" title="خروجی گرفتن" onClick={()=>setExportOpen(true)}>
    <Icon name="download" label="خروجی گرفتن"/>
   </button>
  </div>
 </section>
 {filtersOpen&&<Sheet onClose={()=>setFiltersOpen(false)} labelledBy="filters-title">
  <h2 id="filters-title">فیلترها</h2>
  <div className="filter-sheet">
   <label>از تاریخ<JalaliDate value={from} onChange={setFrom} max={false}/></label>
   <label>تا تاریخ<JalaliDate value={to} onChange={setTo}/></label>
   <label>ناظر<select value={supervisor} onChange={e=>{setSupervisor(e.target.value);setAgent('')}}><option value="">همه ناظران</option>{filters.data?.supervisors.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
   <label>اپراتور<select value={agent} onChange={e=>setAgent(e.target.value)}><option value="">همه اپراتورها</option>{filters.data?.agents.filter(x=>!supervisor||x.supervisorId===Number(supervisor)).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
  </div>
  <div className="admin-action-row">
   <button className="primary wide" onClick={()=>setFiltersOpen(false)}>نمایش نتایج</button>
   {(supervisor||agent)&&<button className="secondary" onClick={()=>{setSupervisor('');setAgent('')}}>پاک کردن</button>}
  </div>
 </Sheet>}
 {exportOpen&&<Sheet onClose={()=>setExportOpen(false)} labelledBy="export-title">
  <h2 id="export-title">خروجی گرفتن</h2>
  <p className="hint">خروجی بر اساس همان بازه و فیلترهای فعلی ساخته می‌شود.</p>
  <div className="more-list">
   <button onClick={()=>{download('xlsx');setExportOpen(false)}}><Icon name="sheet"/><span>فایل Excel</span><i aria-hidden="true">‹</i></button>
   <button onClick={()=>{download('csv');setExportOpen(false)}}><Icon name="download"/><span>فایل CSV</span><i aria-hidden="true">‹</i></button>
  </div>
 </Sheet>}
 
 {q.isLoading?<Loading/>:<><div className="kpis">{cards.map(([l,v,c,p])=><article className={String(c)} key={String(l)}><span>{l}</span><b>{typeof v==='number'?fa(v):v}</b><small>دوره قبل: {fa(Number(p||0))}</small></article>)}</div>
 <div className="charts"><section><div className="section-title"><b>روند روزانه</b><span>ستونی و خطی</span></div><ReactECharts option={line} style={{height:330}}/></section><section><div className="section-title"><b>توزیع نتایج</b><span>{fa(t?.contacted||0)} تماس</span></div><ReactECharts option={pie} style={{height:330}}/></section></div>
 <section className="table-card comparison"><div className="section-title"><b>مقایسه اپراتورها</b><span>برای حذف یا نمایش هر نفر روی نام او بزنید</span></div><div className="operator-chips">{d?.agents.map(a=><button className={visible.includes(a.agentId)?'active':''} onClick={()=>setVisible(v=>v.includes(a.agentId)?v.filter(x=>x!==a.agentId):[...v,a.agentId])} key={a.agentId}>✓ {a.agentName}</button>)}</div><ReactECharts option={compare} style={{height:330}}/></section>
 <section className="table-card"><div className="section-title"><b>عملکرد اپراتورها</b>
 <span>{fa(d?.agents.length||0)} اپراتور
  <button className="ghost inline-export" disabled={!d?.agents.length} onClick={()=>saveFile('agents-performance.csv',toCsv((d?.agents||[]).map(a=>({'اپراتور':a.agentName,'گزارش':a.reports,'کل افراد':a.totalPeople,'تماس‌گرفته':a.contacted,'OK':a.ok,'شاید':a.maybe,'NO':a.no,'جواب نداد':a.noAnswer,'حاضرین':a.attendees,'نرخ حضور':Math.round(a.showUpRate*10)/10}))))}>CSV</button>
 </span></div><div className="table-scroll"><table><thead><tr><th>اپراتور</th><th>گزارش</th><th>کل</th><th>تماس</th><th>نرخ تماس</th><th>OK</th><th>شاید</th><th>NO</th><th>جواب نداد</th><th>حاضرین</th><th>نرخ حضور</th></tr></thead><tbody>{d?.agents.map(a=><tr key={a.agentId}><td><b>{a.agentName}</b></td><td>{fa(a.reports)}</td><td>{fa(a.totalPeople)}</td><td>{fa(a.contacted)}</td><td>{fa(a.totalPeople?a.contacted*100/a.totalPeople:0)}٪</td><td className="green">{fa(a.ok)}</td><td>{fa(a.maybe)}</td><td>{fa(a.no)}</td><td>{fa(a.noAnswer)}</td><td className="green"><b>{fa(a.attendees)}</b></td><td>{a.ok?fa(a.showUpRate)+'٪':'—'}</td></tr>)}</tbody></table></div></section>

 {/* Per-school comparison: the same outcomes grouped by who was called rather than who
     called. This is what tells a manager which schools actually convert into attendance. */}
 <section className="charts school-chart"><div className="section-title"><b>مقایسه مدارس</b><span>حاضرین در برابر پاسخ‌های مثبت</span></div>
 {d?.schools?.length
  ? <ReactECharts option={schoolChart} style={{height:Math.max(220,topSchools.length*46)}} notMerge/>
  : <div className="empty compact">برای مقایسه مدارس، ابتدا نام مدرسه را در گزارش‌ها ثبت کنید.</div>}
 </section>
 <section className="table-card"><div className="section-title"><b>عملکرد به تفکیک مدرسه</b>
 <span>{fa(d?.schools?.length||0)} مدرسه
  <button className="ghost inline-export" disabled={!d?.schools?.length} onClick={()=>saveFile('schools-performance.csv',toCsv((d?.schools||[]).map(x=>({'مدرسه':x.school,'گزارش':x.reports,'کل افراد':x.totalPeople,'تماس‌گرفته':x.contacted,'OK':x.ok,'حاضرین':x.attendees,'نرخ حضور':Math.round(x.showUpRate*10)/10}))))}>CSV</button>
 </span></div>
 <div className="table-scroll"><table><thead><tr><th>مدرسه</th><th>گزارش</th><th>کل افراد</th><th>تماس‌گرفته</th><th>OK</th><th>حاضرین</th><th>نرخ حضور</th></tr></thead>
 <tbody>{d?.schools?.length?d.schools.map(sc=><tr key={sc.school}><td><b>{sc.school}</b></td><td>{fa(sc.reports)}</td><td>{fa(sc.totalPeople)}</td><td>{fa(sc.contacted)}</td><td className="green">{fa(sc.ok)}</td><td><b>{fa(sc.attendees)}</b></td><td>{sc.ok?fa(sc.showUpRate)+'٪':'—'}</td></tr>)
  :<tr><td colSpan={7} className="empty-cell">هنوز مدرسه‌ای در گزارش‌ها ثبت نشده است.</td></tr>}</tbody></table></div></section>
 <section className="ledger-link">
  <div><b>دفتر گزارش‌ها</b><span>{fa(d?.reports.length||0)} گزارش در این بازه</span></div>
  <button className="secondary" onClick={()=>{history.pushState({},'','/app/ledger');dispatchEvent(new PopStateEvent('popstate'))}}>
   مشاهده فهرست کامل
  </button>
 </section></>}</div>
}
