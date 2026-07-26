import DatePicker,{DateObject}from'react-multi-date-picker';import persian from'react-date-object/calendars/persian';import gregorian from'react-date-object/calendars/gregorian';import persianFa from'react-date-object/locales/persian_fa';
export function todayIso(){return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Tehran'});}
export default function JalaliDate({value,onChange,max=true}:{value:string,onChange:(v:string)=>void,max?:boolean}){
 const date=value?new DateObject({date:value,format:'YYYY-MM-DD',calendar:gregorian}).convert(persian):undefined;
 const tehranToday=new DateObject({date:todayIso(),format:'YYYY-MM-DD',calendar:gregorian}).convert(persian);
 return <DatePicker key={value} value={date} calendar={persian} locale={persianFa} calendarPosition="bottom-right" maxDate={max?tehranToday:undefined}
  onChange={(d:DateObject|null)=>{if(d){const native=d.toDate();const iso=`${native.getFullYear()}-${String(native.getMonth()+1).padStart(2,'0')}-${String(native.getDate()).padStart(2,'0')}`;onChange(iso)}}} inputClass="date-input" format="YYYY/MM/DD" editable={false} portal zIndex={1000}/>;
}
