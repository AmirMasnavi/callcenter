import{describe,expect,it}from'vitest';import{fa,faDate}from'./api';
describe('Persian presentation',()=>{it('formats Persian digits',()=>expect(fa(1234)).toContain('۱٬۲۳۴'));it('formats ISO date as Jalali',()=>expect(faDate('2026-03-21')).toContain('۱۴۰۵'));});
