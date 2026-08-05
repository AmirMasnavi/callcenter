import{useEffect,useMemo,useState}from'react';
import{useMutation,useQuery,useQueryClient}from'@tanstack/react-query';
import{api,fa,faDate,faDateTime,Report,School,statusLabel}from'../lib/api';
import JalaliDate,{todayIso}from'../components/JalaliDate';
import Loading from'../components/Loading';

// attendeeCount is '' until the class has actually happened — it is not known at call time.
type Form={reportLabel:string;school:string;totalPeople:number;contactedCount:number;okCount:number;maybeCount:number;noCount:number;noAnswerCount:number;attendeeCount:number|'';notes:string};
const empty:Form={reportLabel:'',school:'',totalPeople:0,contactedCount:0,okCount:0,maybeCount:0,noCount:0,noAnswerCount:0,attendeeCount:'',notes:''};
const localKey=(date:string,id?:number)=>`agent-draft:${date}:${id||'new'}`;
const toForm=(r:Report):Form=>({reportLabel:r.reportLabel||'',school:r.school||'',totalPeople:r.totalPeople,contactedCount:r.contactedCount,okCount:r.okCount,maybeCount:r.maybeCount,noCount:r.noCount,noAnswerCount:r.noAnswerCount,attendeeCount:r.attendeeCount??'',notes:r.notes||''});

export default function AgentPage({view}:{view:'form'|'history'}){
 const qc=useQueryClient(),q=useQuery({queryKey:['mine'],queryFn:()=>api<Report[]>('/api/v1/reports/mine')});
 // Managed list, so everyone spells a school the same way and the manager's per-school
 // comparison doesn't split one school across several near-identical names.
 const schools=useQuery({queryKey:['schools'],queryFn:()=>api<School[]>('/api/v1/schools')});
 const[date,setDate]=useState(todayIso()),[activeId,setActiveId]=useState<number>(),[form,setForm]=useState<Form>(empty),[version,setVersion]=useState<number>(),[notice,setNotice]=useState(''),[touched,setTouched]=useState(false);
 const dayReports=useMemo(()=>q.data?.filter(r=>r.reportDate===date)||[],[q.data,date]);
 const current=q.data?.find(r=>r.id===activeId);
 useEffect(()=>{if(!q.isSuccess)return;const r=activeId?q.data.find(x=>x.id===activeId):undefined;if(r&&r.reportDate===date){setVersion(r.version);setForm(toForm(r));return}setActiveId(undefined);setVersion(undefined);try{setForm(JSON.parse(sessionStorage.getItem(localKey(date))||'null')||empty)}catch{setForm(empty)}},[date,activeId,q.isSuccess,q.data]);
 function update(next:Form){setTouched(true);setForm(next);sessionStorage.setItem(localKey(date,activeId),JSON.stringify(next))}
 function select(r:Report){setDate(r.reportDate);setActiveId(r.id);setNotice('')}
 function newReport(){setActiveId(undefined);setVersion(undefined);setForm(empty);setTouched(false);setNotice('گزارش تازه آماده است.')}
 function changeDate(next:string){if(next&&next!==date){sessionStorage.setItem(localKey(date,activeId),JSON.stringify(form));setDate(next);setActiveId(undefined);setNotice('')}}
 function number(key:Exclude<keyof Form,'notes'|'reportLabel'|'school'|'attendeeCount'>,value:string){const normalized=value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));update({...form,[key]:Math.max(0,Number(normalized)||0)})}
 // Kept separate: blank is meaningful here (not yet known), so it must not collapse to 0.
 function attendees(value:string){const normalized=value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));update({...form,attendeeCount:normalized.trim()===''?'':Math.max(0,Number(normalized)||0)})}
 const outcomes=form.okCount+form.maybeCount+form.noCount+form.noAnswerCount,notContacted=form.totalPeople-form.contactedCount,errors:string[]=[];
 if(form.totalPeople<=0)errors.push('کل افراد باید بیشتر از صفر باشد.');
 if(form.contactedCount>form.totalPeople)errors.push('تعداد تماس‌گرفته نمی‌تواند از کل افراد بیشتر باشد.');
 if(outcomes!==form.contactedCount)errors.push(`جمع چهار نتیجه باید دقیقاً برابر ${fa(form.contactedCount)} تماس باشد؛ اکنون ${fa(outcomes)} است.`);
 if(form.attendeeCount!==''&&form.attendeeCount>form.totalPeople)errors.push('تعداد حاضرین نمی‌تواند از کل افراد بیشتر باشد.');
 const valid=!errors.length;
 const approved=!!current&&(current.status==='APPROVED'||current.status==='CORRECTED_APPROVED');
 // Approved reports stay open for the attendance figure alone — it is usually only known
 // after the class has run. Saving it sends the report back for re-approval.
 const locked=approved;
 const attendanceOnly=approved;
 // Only complain once they have actually engaged with the form.
 const showErrors=touched&&!valid;
 const payload=()=>({...form,attendeeCount:form.attendeeCount===''?null:form.attendeeCount,school:form.school.trim()||null,reportId:activeId||null,reportDate:date,version});
 function sync(r:Report){qc.setQueryData<Report[]>(['mine'],old=>[r,...(old||[]).filter(x=>x.id!==r.id)]);setActiveId(r.id);setVersion(r.version)}
 const save=useMutation({mutationFn:()=>api<Report>('/api/v1/reports/draft',{method:'POST',body:JSON.stringify(payload())}),onSuccess:r=>{sync(r);sessionStorage.removeItem(localKey(date,activeId));setNotice(r.status==='SUBMITTED'?'تغییرات گزارش برای ناظر به‌روز شد.':'پیش‌نویس ذخیره شد.')}});
 const submit=useMutation({mutationFn:async()=>{const saved=await api<Report>('/api/v1/reports/draft',{method:'POST',body:JSON.stringify(payload())});return api<Report>(`/api/v1/reports/${saved.id}/submit?version=${saved.version}`,{method:'POST'})},onSuccess:r=>{sync(r);sessionStorage.removeItem(localKey(date,activeId));setNotice('گزارش با موفقیت برای ناظر ارسال شد و تا قبل از تأیید قابل ویرایش است.')}});
 const list=<div className="report-list">{q.data?.map((r,i)=><button className={activeId===r.id?'active':''} key={r.id} onClick={()=>{select(r);if(view==='history'){window.history.pushState({},'','/app/report');dispatchEvent(new PopStateEvent('popstate'))}}}><span className={'status '+r.status}>{statusLabel[r.status]}</span><b>{r.reportLabel||`گزارش ${fa((q.data?.filter(x=>x.reportDate===r.reportDate).length||0)-q.data!.filter(x=>x.reportDate===r.reportDate).indexOf(r))}`} · {faDate(r.reportDate)}</b><small>{fa(r.contactedCount)} تماس از {fa(r.totalPeople)} نفر</small><em>{faDateTime(r.updatedAt)}</em></button>)}</div>;
 if(view==='history')return <div className="page"><header className="page-head"><div><span className="eyebrow">سوابق من</span><h1>گزارش‌های ثبت‌شده</h1><p>هر روز می‌تواند چند گزارش مستقل داشته باشد.</p></div></header><section className="history standalone">{q.isLoading?<Loading/>:q.data?.length?list:<div className="empty">هنوز گزارشی ثبت نشده است.</div>}</section></div>;
 return <div className="page"><header className="page-head"><div><span className="eyebrow">گزارش تماس</span><h1>ثبت عملکرد تماس‌ها</h1><p>پس از ارسال نیز تا زمان تأیید ناظر می‌توانید اعداد را اصلاح کنید.</p></div><div className="date-box"><span>تاریخ گزارش</span><JalaliDate value={date} onChange={changeDate}/></div></header>
 {notice&&<div className="success">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
 <div className="day-report-bar"><div><b>گزارش‌های {faDate(date)}</b><span>{fa(dayReports.length)} مورد ثبت شده</span></div><div className="report-tabs">{dayReports.map((r,i)=><button className={activeId===r.id?'active':''} onClick={()=>select(r)} key={r.id}>{r.reportLabel||`گزارش ${fa(dayReports.length-i)}`}</button>)}<button className={!activeId?'active new':''} onClick={newReport}>+ گزارش جدید</button></div></div>
 <section className="form-card"><div className="section-title"><b>{current?current.reportLabel||'ویرایش گزارش':'گزارش جدید'}</b><span>{current?statusLabel[current.status]:'پیش‌نویس تازه'}</span></div>
 <label className="report-label">عنوان اختیاری گزارش<input disabled={locked} maxLength={120} value={form.reportLabel} onChange={e=>update({...form,reportLabel:e.target.value})} placeholder="مثلاً لیست صبح یا پیگیری مرحله دوم"/></label>
 <label className="report-label">مدرسه
  <select disabled={locked} value={schools.data?.some(x=>x.name===form.school)||!form.school?form.school:'__other'}
    onChange={e=>update({...form,school:e.target.value==='__other'?'':e.target.value})}>
   <option value="">— انتخاب مدرسه —</option>
   {schools.data?.map(x=><option key={x.id} value={x.name}>{x.name}</option>)}
   <option value="__other">مدرسه دیگر…</option>
  </select>
 </label>
 {/* Only appears after choosing "other", so the common path stays a single tap. */}
 {!!form.school!==undefined&&form.school!==''&&!schools.data?.some(x=>x.name===form.school)&&
  <label className="report-label">نام مدرسه جدید
   <input disabled={locked} maxLength={160} value={form.school} autoFocus
     onChange={e=>update({...form,school:e.target.value})} placeholder="نام مدرسه را وارد کنید"/>
  </label>}
 <div className="number-grid">{([['totalPeople','کل افراد','نفر'],['contactedCount','تماس‌گرفته','تماس'],['okCount','نتیجه OK','موفق'],['maybeCount','شاید','پیگیری'],['noCount','نتیجه NO','ناموفق'],['noAnswerCount','جواب نداد','تماس']]as const).map(([k,l,s])=><label className={'metric-input '+k} key={k}><span>{l}</span><input aria-label={l} inputMode="numeric" disabled={locked} value={form[k]} onChange={e=>number(k,e.target.value)}/><small>{s}</small></label>)}</div>
 <div className={'equation '+(!touched?'neutral':valid?'valid':'invalid')}><div><span>جمع نتایج</span><b>{fa(outcomes)}</b></div><span>{!touched?'اعداد را وارد کنید':valid?'✓ اعداد آماده ثبت هستند':'اعداد نیاز به اصلاح دارند'}</span><div><span>تماس‌نگرفته</span><b>{fa(Math.max(0,notContacted))}</b></div></div>
 {showErrors&&<div className="validation-list">{errors.map(e=><div key={e}>• {e}</div>)}</div>}
 <div className="attendance-block">
  <label className="metric-input attendeeCount">
   <span>تعداد حاضرین</span>
   <input aria-label="تعداد حاضرین" inputMode="numeric" disabled={locked&&!attendanceOnly} value={form.attendeeCount} onChange={e=>attendees(e.target.value)} placeholder="—"/>
   <small>نفر</small>
  </label>
  <p className="hint">
   تعداد افرادی که واقعاً در کلاس حاضر شدند. اگر هنوز کلاس برگزار نشده، خالی بگذارید و بعداً تکمیل کنید.
   {form.attendeeCount!==''&&form.okCount>0&&<> نرخ حضور: <b>{fa(Math.round((form.attendeeCount/form.okCount)*1000)/10)}٪</b> از پاسخ‌های مثبت.</>}
  </p>
 </div>
 <label className="notes">توضیحات اختیاری<textarea disabled={locked} maxLength={1000} value={form.notes} onChange={e=>update({...form,notes:e.target.value})}/></label>
 {attendanceOnly?<div className="actions attendance-reopen">
  <p className="hint">این گزارش تأیید شده است. فقط می‌توانید «تعداد حاضرین» را ثبت کنید؛ پس از ذخیره، گزارش برای تأیید مجدد نزد ناظر می‌رود.</p>
  <button className="primary" disabled={save.isPending||form.attendeeCount===''} onClick={()=>save.mutate()}>ثبت تعداد حاضرین و ارسال برای تأیید</button>
 </div>:!locked?<div className="actions">{current?.status==='SUBMITTED'?<button className="primary" disabled={!valid||save.isPending} onClick={()=>save.mutate()}>ذخیره تغییرات ارسال‌شده</button>:<><button className="secondary" onClick={()=>save.mutate()} disabled={save.isPending||submit.isPending}>ذخیره پیش‌نویس</button><button className="primary" disabled={!valid||save.isPending||submit.isPending} onClick={()=>submit.mutate()}>ثبت و ارسال برای بررسی ←</button></>}</div>:<div className="locked">این گزارش تأیید شده و فقط ناظر می‌تواند آن را با ثبت دلیل اصلاح کند.</div>}
 {(save.error||submit.error)&&<div className="error">{(save.error||submit.error)?.message}</div>}</section></div>
}
