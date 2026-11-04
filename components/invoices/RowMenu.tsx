'use client';

import { Eye, Pencil, Trash2 } from 'lucide-react';
import { MenuButton } from '@/components/ui/MenuButton';

/** ⋯ on every row, always visible (touch and keyboard friendly): Open · Edit · Delete (plan §4.3). */
export function RowMenu({ number, onOpen, onEdit, onDelete }: { number: string; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <MenuButton
      trigger="icon"
      label={`Actions for ${number}`}
      align="end"
      entries={[
        { label: 'Open', icon: Eye, onSelect: onOpen },
        { label: 'Edit', icon: Pencil, onSelect: onEdit },
        { type: 'separator' },
        { label: 'Delete', icon: Trash2, destructive: true, onSelect: onDelete },
      ]}
    />
  );
}
