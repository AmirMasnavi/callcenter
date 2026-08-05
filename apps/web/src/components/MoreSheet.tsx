import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import Icon, { IconName } from './Icon';
import { Me, Permission } from '../lib/api';

/*
 * "بیشتر" — everything that is not a daily task.
 *
 * The bottom bar previously carried up to seven destinations, which truncated every label
 * and put rarely-used admin screens next to the one thing an operator does all day. Only
 * the daily work stays in the bar; the rest is grouped here, one tap away.
 */

interface Entry { path: string; label: string; icon: IconName; needs?: Permission[] }
interface Group { title: string; entries: Entry[] }

const GROUPS: Group[] = [
  {
    title: 'مدیریت',
    entries: [
      { path: '/app/admin',   label: 'کاربران و دسترسی‌ها', icon: 'users',  needs: ['MANAGE_USERS'] },
      { path: '/app/schools', label: 'فهرست مدارس',         icon: 'school', needs: ['MANAGE_SCHOOLS'] },
    ],
  },
  {
    title: 'گزارش‌گیری',
    entries: [
      { path: '/app/dashboard', label: 'داشبورد تحلیلی', icon: 'chart',   needs: ['VIEW_DASHBOARD'] },
      { path: '/app/history',   label: 'گزارش‌های من',   icon: 'history', needs: ['SUBMIT_REPORTS'] },
      { path: '/app/ledger',    label: 'دفتر گزارش‌ها',  icon: 'sheet',   needs: ['VIEW_ALL_REPORTS'] },
    ],
  },
  {
    title: 'حضور و غیاب',
    entries: [
      { path: '/app/attendance', label: 'ثبت ورود و خروج', icon: 'clock', needs: ['RECORD_ATTENDANCE'] },
      { path: '/app/timesheet',  label: 'ساعات کاری',      icon: 'hours', needs: ['VIEW_ATTENDANCE'] },
    ],
  },
  {
    title: 'سامانه',
    entries: [
      { path: '/app/security', label: 'امنیت ورود',      icon: 'key', needs: ['MANAGE_SETTINGS'] },
      { path: '/app/audit',    label: 'تاریخچه فعالیت', icon: 'eye', needs: ['VIEW_AUDIT'] },
    ],
  },
  {
    title: 'حساب من',
    entries: [
      { path: '/app/profile', label: 'حساب و ظاهر برنامه', icon: 'user' },
    ],
  },
];

interface Props {
  me: Me;
  onNavigate: (path: string) => void;
  onClose: () => void;
  onLogout: () => void;
  /** Hidden when the destination is already in the bottom bar, so nothing appears twice. */
  hidePaths: string[];
}

export default function MoreSheet({ me, onNavigate, onClose, onLogout, hidePaths }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; removeEventListener('keydown', onKey); };
  }, [onClose]);

  const allowed = (e: Entry) =>
    (!e.needs || e.needs.some(p => me.permissions?.includes(p))) && !hidePaths.includes(e.path);

  const groups = GROUPS
    .map(g => ({ ...g, entries: g.entries.filter(allowed) }))
    .filter(g => g.entries.length);

  return createPortal(
    <div className="more-sheet-backdrop" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="سایر بخش‌ها">
      <div className="more-sheet" onMouseDown={e => e.stopPropagation()}>
        <div className="sheet-grabber" aria-hidden="true" />
        <header className="more-sheet-head">
          <h2>سایر بخش‌ها</h2>
          <button className="icon-button" onClick={onClose} aria-label="بستن"><Icon name="close" /></button>
        </header>

        <div className="more-sheet-body">
          {groups.map(g => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              <div className="more-list">
                {g.entries.map(e => (
                  <button key={e.path} onClick={() => { onNavigate(e.path); onClose(); }}>
                    <Icon name={e.icon} />
                    <span>{e.label}</span>
                    <i aria-hidden="true">‹</i>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <section>
            <div className="more-list">
              <button className="danger-row" onClick={onLogout}>
                <Icon name="logout" />
                <span>خروج از حساب</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}
