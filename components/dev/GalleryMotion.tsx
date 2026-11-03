'use client';

import { useState } from 'react';
import { Dices, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { RollingNumber } from '@/components/ui/RollingNumber';
import { fmtMoney, fmtMoneyWhole, fmtDelta } from '@/lib/format';

const h4 = 'text-[13px] font-medium text-ink-muted mb-2';

/** "Press me": every pressable control shares one sink-to-95% / spring-back mechanism (controls.css). */
export function PressDemo() {
  const [seg, setSeg] = useState('b');
  const [chip, setChip] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-muted max-w-prose">
        Hold the mouse button down (or press Space or Enter on a focused control). The control sinks to 95 %, then springs back with a
        small overshoot. Only the transform changes, so nothing around it moves. Disabled and loading controls do not move. With
        “Reduce motion” on, only the colour changes.
      </p>
      <div className="flex flex-wrap items-center gap-3" data-press-demo>
        <Button variant="primary" size="lg">Press me</Button>
        <Button variant="primary">Press me</Button>
        <Button variant="secondary">Press me</Button>
        <Button variant="ghost">Press me</Button>
        <Button variant="destructive-quiet" icon={Trash2}>Press me</Button>
        <IconButton label="Press me (icon-only)" icon={Plus} variant="secondary" />
        <SegmentedControl
          aria-label="Press demo segmented"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'a', label: 'Press' },
            { value: 'b', label: 'Me' },
            { value: 'c', label: 'Too' },
          ]}
        />
        <ToggleChip label="Press me" pressed={chip} onPressedChange={setChip} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] text-ink-subtle">Never moves:</span>
        <Button variant="secondary" disabledReason="Disabled controls do not press">Disabled</Button>
        <Button variant="primary" loading>Loading</Button>
      </div>
    </div>
  );
}

/** Rolling digits: change the total and the digits roll into place, one after another. */
export function RollingDemo() {
  const [total, setTotal] = useState(5935.09);
  const [prev, setPrev] = useState(5935.09);
  const [count, setCount] = useState(46);
  const set = (v: number) => {
    setPrev(total);
    setTotal(Math.round(v * 100) / 100);
  };
  const delta = fmtDelta(total, prev);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-[13px] text-ink-muted mb-1">Total · Nov 2026</p>
        <p className="text-[40px] leading-[44px] font-semibold" data-rolling-demo="total">
          <RollingNumber value={fmtMoney(total)} live="polite" />
        </p>
        <p className="text-[13px] mt-1 text-ink-muted" data-rolling-demo="delta">
          {delta.direction === 'flat' ? 'No change' : `${delta.text} vs previous value`}
        </p>
        <p className="mt-3 text-[20px] leading-7 font-semibold text-ink-muted">
          <RollingNumber value={fmtMoneyWhole(total * 12)} /> <span className="text-[13px] font-normal">per year (no decimals)</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={Dices} onClick={() => set(Math.round(Math.random() * 1_500_000) / 100)} data-testid="randomise">
          Randomise total
        </Button>
        <Button variant="secondary" size="md" icon={Plus} onClick={() => set(total + 1)}>1 zł</Button>
        <Button variant="secondary" size="md" icon={Plus} onClick={() => set(total + 100)}>100 zł</Button>
        <Button variant="secondary" size="md" icon={Minus} onClick={() => set(Math.max(0, total - 1000))}>1 000 zł</Button>
        <Button variant="ghost" onClick={() => set(999)}>Set 999,00</Button>
        <Button variant="ghost" onClick={() => set(1000)}>Set 1 000,00</Button>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-[28px] leading-8 font-bold" data-rolling-demo="count"><RollingNumber value={String(count)} /></span>
        <span className="text-[13px] text-ink-muted">invoices</span>
        <IconButton label="One fewer invoice" icon={Minus} variant="secondary" onClick={() => setCount((c) => Math.max(0, c - 1))} />
        <IconButton label="One more invoice" icon={Plus} variant="secondary" onClick={() => setCount((c) => c + 1)} />
      </div>
      <p className="text-[12px] text-ink-subtle max-w-prose">
        No animation on first load. Digits that change start left to right, 40 ms apart, each taking about 520 ms; unchanged digits stay
        still. Separators, “zł” and the minus sign never move. With “Reduce motion” on, the value just swaps.
      </p>
    </div>
  );
}
