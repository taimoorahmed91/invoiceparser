import { CloudUpload } from 'lucide-react';

/** Full-window hint while files are dragged over any page (plan §4.6 "drop anywhere"). It never takes the pointer: the window itself receives the drop. */
export function DropOverlay() {
  return (
    <div className="up-overlay" aria-hidden="true" data-drop-overlay>
      <div className="up-overlay-card">
        <CloudUpload size={40} strokeWidth={1.5} />
        <p className="up-overlay-title">Release to add</p>
        <p className="up-overlay-sub">PDF invoices are read and saved to your list. Anything else is skipped.</p>
      </div>
    </div>
  );
}
