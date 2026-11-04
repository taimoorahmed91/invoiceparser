'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // no clipboard permission / insecure page: the old way still works inside a click
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** "Copy" (ghost, icon + label). Says "Copied" for two seconds and announces it; says so too when copying is not possible. */
export function CopyButton({ text, what }: { text: string; /** "invoice number", "bank account": names the thing for screen readers. */ what: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    setState((await copyText(text)) ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  };

  return (
    <>
      <Button variant="ghost" size="sm" icon={state === 'copied' ? Check : Copy} onClick={() => void onClick()}>
        {state === 'copied' ? 'Copied' : 'Copy'}
        <span className="sr-only-text"> {what}</span>
      </Button>
      <span className="sr-only-text" role="status">
        {state === 'copied' ? `Copied ${what}` : state === 'failed' ? `Couldn’t copy the ${what}. Select it and copy by hand.` : ''}
      </span>
    </>
  );
}
