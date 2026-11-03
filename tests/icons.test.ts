import { describe, it, expect } from 'vitest';
import * as lucide from 'lucide-react';

// Every icon name the plan uses (§2.5, §2.2 utility sub-types, §2.7). Phase 1 acceptance: they all exist.
const NAMES = [
  'LayoutDashboard', 'ReceiptText', 'ChartColumn', 'Database', 'Upload', 'Search', 'ListFilter',
  'ArrowUp', 'ArrowDown', 'Pencil', 'Trash2', 'GitCompare', 'Download', 'FileUp', 'Sun', 'Moon',
  'Monitor', 'Ellipsis', 'X', 'Copy', 'Check', 'House', 'SquareParking', 'Plug', 'Receipt',
  'Droplet', 'Droplets', 'ThermometerSun', 'Zap', 'Heater', 'Flame',
  // used by the controls / toast / gallery
  'ChevronDown', 'ChevronLeft', 'ChevronRight', 'Minus', 'Info', 'CircleCheck', 'CircleAlert',
  'TriangleAlert', 'LoaderCircle', 'Maximize2', 'Printer', 'Undo2', 'RotateCcw', 'Table2', 'FileText',
  // Overview (Phase 5)
  'Wallet', 'CalendarRange', 'ArrowRight',
  // Upload dialog (Phase 7)
  'CloudUpload', 'Clock', 'CircleX', 'Ban', 'Copy', 'FileUp',
];

describe('lucide-react icon names used in the plan', () => {
  it.each(NAMES)('%s exists', (name) => {
    expect((lucide as Record<string, unknown>)[name]).toBeTruthy();
  });
});
