import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, fa, faDate, faDateTime, Report, statusLabel } from '../lib/api';
import Loading from '../components/Loading';
import Icon from '../components/Icon';
import { toCsv, download } from '../lib/exportTable';

/*
 * The full report ledger, moved off the manager's dashboard.
 *
 * A manager opening the dashboard wants the charts; the ledger is a lookup tool they reach
 * deliberately. Keeping it at the bottom of the main page meant scrolling past hundreds of
 * rows to reach anything, and it grew worse with every report filed.
 */
export default function LedgerPage() {
  const q = useQuery({ queryKey: ['ledger'], queryFn: () => api<Report[]>('/api/v1/admin/reports/ledger') });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ARCHIVED' | Report['status']>('ALL');

  const rows = useMemo(() => (q.data ?? []).filter(r => {
    const matchesStatus = status === 'ALL' ? true
      : status === 'ARCHIVED' ? !!r.archived
      : r.status === status && !r.archived;
    const haystack = `${r.agentName} ${r.school ?? ''} ${r.reportLabel ?? ''}`;
    return matchesStatus && (!query.trim() || haystack.includes(query.trim()));
  }), [q.data, query, status]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <span className="eyebrow">گزارش‌گیری</span>
          <h1>دفتر گزارش‌ها</h1>
          <p>جست‌وجو در تمام گزارش‌های ثبت‌شده.</p>
        </div>
        <div className="head-actions">
          <button className="icon-button" title="خروجی CSV" disabled={!rows.length}
                  onClick={() => download('ledger.csv', toCsv(rows.map(r => ({
                    'اپراتور': r.agentName, 'مدرسه': r.school ?? '', 'عنوان': r.reportLabel ?? '',
                    'تاریخ': faDate(r.reportDate), 'وضعیت': statusLabel[r.status],
                    'تماس': r.contactedCount, 'کل': r.totalPeople, 'حاضرین': r.attendeeCount ?? '',
                  }))))}>
            <Icon name="download" label="خروجی CSV" />
          </button>
        </div>
      </header>

      <div className="search-field">
        <Icon name="search" size={18} />
        <input value={query} onChange={e => setQuery(e.target.value)}
               placeholder="جست‌وجوی اپراتور، مدرسه یا عنوان…" aria-label="جست‌وجو" />
        {query && (
          <button className="icon-button ghost-clear" onClick={() => setQuery('')} title="پاک کردن">
            <Icon name="close" size={16} label="پاک کردن" />
          </button>
        )}
      </div>

      <div className="segmented ledger-tabs">
        {([['ALL', 'همه'], ['SUBMITTED', 'در انتظار'], ['APPROVED', 'تأییدشده'], ['ARCHIVED', 'بایگانی']] as const)
          .map(([value, label]) => (
            <button key={value} className={status === value ? 'active' : ''}
                    onClick={() => setStatus(value as typeof status)}>{label}</button>
          ))}
      </div>

      {q.isLoading ? <Loading /> : (
        <section className="table-card">
          <div className="section-title"><b>نتایج</b><span>{fa(rows.length)} گزارش</span></div>
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>اپراتور</th><th>مدرسه</th><th>تاریخ</th><th>وضعیت</th>
                <th>تماس / کل</th><th>حاضرین</th><th>ارسال</th>
              </tr></thead>
              <tbody>
                {rows.length ? rows.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.agentName}</b></td>
                    <td>{r.school || '—'}</td>
                    <td>{faDate(r.reportDate)}</td>
                    <td>
                      <span className={'status ' + r.status}>{statusLabel[r.status]}</span>
                      {r.archived && <span className="perm-tag removed">بایگانی</span>}
                    </td>
                    <td>{fa(r.contactedCount)} / {fa(r.totalPeople)}</td>
                    <td>{r.attendeeCount == null ? '—' : fa(r.attendeeCount)}</td>
                    <td>{faDateTime(r.submittedAt)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="empty-cell">
                    {query || status !== 'ALL' ? 'گزارشی با این فیلترها پیدا نشد.' : 'هنوز گزارشی ثبت نشده است.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
