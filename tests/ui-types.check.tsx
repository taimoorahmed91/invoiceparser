/**
 * Type-level checks, enforced by `npx tsc --noEmit` (plan §2.7.3 / §2.7.4).
 * Each `@ts-expect-error` line must stay an error: if the API ever loosens, tsc fails here.
 * Not executed by vitest (it only picks up *.test.ts).
 */
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';

export function typeChecks() {
  return (
    <>
      {/* fine */}
      <IconButton label="Edit invoice" icon={Pencil} />
      <Button disabledReason="Select one more invoice">Compare</Button>
      <Checkbox aria-label="Select row" disabledReason="Compare works with two invoices" />

      {/* an icon-only button cannot exist without a name */}
      {/* @ts-expect-error label is required */}
      <IconButton icon={Pencil} />

      {/* there is no plain `disabled`: a disabled control must say why */}
      {/* @ts-expect-error use disabledReason */}
      <Button disabled>Save</Button>
      {/* @ts-expect-error use disabledReason */}
      <IconButton label="Edit" icon={Pencil} disabled />
      {/* @ts-expect-error use disabledReason */}
      <Checkbox aria-label="x" disabled />
      {/* @ts-expect-error use disabledReason */}
      <Input label="x" disabled />

      {/* link variant is the only one without a box; destructive is not a menu trigger variant but is a Button variant */}
      <Button variant="destructive">Delete 26 invoices</Button>
    </>
  );
}
