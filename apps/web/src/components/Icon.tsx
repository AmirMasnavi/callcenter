/*
 * Inline SVG icon set.
 *
 * Everything inherits `currentColor` and sizes from the font, so an icon always matches
 * the text it sits with and needs no per-theme colour rules.
 *
 * An icon replaces a label only where the mapping is unambiguous (a trash can means
 * delete). Anything that would need explaining keeps its words — an icon nobody can read
 * is worse than the text it replaced.
 */

export type IconName =
  | 'plus' | 'history' | 'check' | 'chart' | 'users' | 'user'
  | 'logout' | 'trash' | 'close' | 'download' | 'sheet' | 'eye'
  | 'sun' | 'moon' | 'auto' | 'key' | 'refresh' | 'school' | 'menu' | 'search' | 'back' | 'edit';

const PATHS: Record<IconName, string> = {
  plus: 'M12 5v14M5 12h14',
  history: 'M12 8v4l3 2M3.05 11a9 9 0 1 1 .5 4',
  check: 'M20 6 9 17l-5-5',
  chart: 'M3 3v18h18M7 15v3M12 9v9M17 12v6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  trash: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
  close: 'M18 6 6 18M6 6l12 12',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  sheet: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM3 9h18M3 15h18M9 3v18',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  auto: 'M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18',
  key: 'M21 2l-2 2M15.5 8.5 19 5M10.5 13.5 15.5 8.5M7 21a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6',
  school: 'M3 10 12 5l9 5-9 5-9-5zM6 12v5c0 1.1 2.7 2 6 2s6-.9 6-2v-5',
  menu: 'M4 7h16M4 12h16M4 17h16',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  back: 'M15 18l-6-6 6-6',
};

interface Props {
  name: IconName;
  /** Accessible name. Omit ONLY when adjacent text already names the control. */
  label?: string;
  size?: number;
  className?: string;
}

export default function Icon({ name, label, size = 20, className }: Props) {
  return (
    <svg
      className={className}
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
