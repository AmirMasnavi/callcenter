export type Role='AGENT'|'SUPERVISOR'|'MANAGER'|'ADMIN';
export type Status='DRAFT'|'SUBMITTED'|'APPROVED'|'CORRECTED_APPROVED';

/** Kept in sync with AuthController.MIN_PASSWORD_LENGTH on the server. */
export const MIN_PASSWORD_LENGTH=8;

/** A user may hold several roles at once; `impersonatedBy` is set while an admin views as them. */
export interface Me{id:number;username:string;displayName:string;roles:Role[];mustChangePassword:boolean;impersonatedBy?:number|null}

export interface Report{id:number;agentId:number;agentName:string;reportDate:string;reportLabel?:string;totalPeople:number;contactedCount:number;notContacted:number;okCount:number;maybeCount:number;noCount:number;noAnswerCount:number;notes?:string;status:Status;createdAt:string;updatedAt:string;submittedAt?:string;reviewedAt?:string;reviewerName?:string;version:number;voided?:boolean;voidedAt?:string;voidedByName?:string;voidReason?:string}

const apiBaseUrl=(import.meta.env.VITE_API_BASE_URL||'').replace(/\/+$/,'');
export const apiUrl=(path:string)=>`${apiBaseUrl}${path}`;
function cookie(name:string){return document.cookie.split('; ').find(x=>x.startsWith(name+'='))?.split('=').slice(1).join('=');}
export async function api<T>(path:string,init:RequestInit={}):Promise<T>{
 const method=init.method?.toUpperCase()||'GET';if(method!=='GET'&&!cookie('XSRF-TOKEN'))await fetch(apiUrl('/api/v1/auth/csrf'),{credentials:'include'});
 const headers=new Headers(init.headers);if(init.body&&!(init.body instanceof FormData))headers.set('Content-Type','application/json');const token=cookie('XSRF-TOKEN');if(token)headers.set('X-XSRF-TOKEN',decodeURIComponent(token));
 const res=await fetch(apiUrl(path),{...init,headers,credentials:'include'});if(res.status===401&&path!=='/api/v1/auth/login')window.dispatchEvent(new Event('auth:expired'));if(!res.ok){let message=res.status===403?'دسترسی شما برای این عملیات معتبر نیست؛ یک‌بار خارج شوید و دوباره وارد شوید.':'خطایی رخ داد';try{message=(await res.json()).message||message}catch{}throw new Error(message)}
 return res.status===204?undefined as T:res.json();
}

export const hasRole=(me:Pick<Me,'roles'>|null|undefined,...candidates:Role[])=>!!me&&candidates.some(r=>me.roles.includes(r));

export const roleLabel:Record<Role,string>={AGENT:'اپراتور',SUPERVISOR:'ناظر',MANAGER:'مدیر',ADMIN:'مدیر سامانه'};

/** Highest-authority role first — used when one short label must stand for the whole account. */
export const primaryRole=(roles:Role[]):Role=>
 (['ADMIN','MANAGER','SUPERVISOR','AGENT'] as Role[]).find(r=>roles.includes(r))??'AGENT';

export const fa=(n:number|string)=>new Intl.NumberFormat('fa-IR',{maximumFractionDigits:1}).format(Number(n));
export const faDate=(iso:string)=>new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long',day:'numeric'}).format(new Date(iso+'T12:00:00'));
export const faDateTime=(iso?:string)=>iso?new Intl.DateTimeFormat('fa-IR-u-ca-persian',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(iso)):'—';
export const statusLabel:Record<Status,string>={DRAFT:'پیش‌نویس',SUBMITTED:'در انتظار تأیید',APPROVED:'تأییدشده',CORRECTED_APPROVED:'اصلاح و تأییدشده'};
