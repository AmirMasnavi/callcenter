import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSheetDrag } from '../lib/motion';

/*
 * A modal/sheet that always renders into <body>.
 *
 * This is not optional polish. Any ancestor with a mask, filter or transform creates a
 * stacking context, and a modal nested inside one cannot escape it no matter how high its
 * z-index — which is exactly how the submit button ended up unreachable underneath the
 * bottom navigation. Portalling to <body> makes the sheet immune to whatever the page
 * layout does above it.
 */
export default function Sheet({
  children, onClose, labelledBy,
}: { children: ReactNode; onClose: () => void; labelledBy?: string }) {
  const drag = useSheetDrag(onClose);

  // Escape closes, and the page behind must not scroll while a sheet is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="modal" onMouseDown={onClose} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="sheet-body" onMouseDown={e => e.stopPropagation()}
           ref={drag.ref as React.Ref<HTMLDivElement>}
           onPointerDown={drag.onPointerDown} onPointerMove={drag.onPointerMove}
           onPointerUp={drag.onPointerUp} onPointerCancel={drag.onPointerCancel}>
        <div className="sheet-grabber" aria-hidden="true" />
        <button type="button" className="close" onClick={onClose} aria-label="بستن">×</button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
