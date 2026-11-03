'use client';

import { useRouter } from 'next/navigation';
import { Ellipsis, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MenuButton } from '@/components/ui/MenuButton';
import { useThemeEntries } from './ThemeMenu';
import { pageShortTitle, pageTitle } from './nav';

/**
 * Sticky top bar: page title (h1) and the global Upload action.
 * Phones get the compact version: title, "Upload" (icon + short label) and a "More" menu (theme lives there,
 * because the sidebar is not visible).
 */
export function TopBar({ pathname }: { pathname: string }) {
  const router = useRouter();
  const { entries } = useThemeEntries();

  // TEMPORARY (until the Upload dialog in Phase 7): open the old page's own file picker.
  const upload = () => {
    // (the Data page's JSON import input is marked data-import and must not be mistaken for the PDF picker)
    const input = document.querySelector<HTMLInputElement>('input[type="file"]:not([data-import])');
    if (input) input.click();
    else router.push('/invoices');
  };

  return (
    <header className="shell-top no-print">
      <h1 className="shell-title">
        {pageShortTitle(pathname) !== pageTitle(pathname) ? (
          <>
            <span className="title-long">{pageTitle(pathname)}</span>
            <span className="title-short">{pageShortTitle(pathname)}</span>
          </>
        ) : (
          pageTitle(pathname)
        )}
      </h1>
      <div className="shell-actions">
        <div className="only-phone">
          <MenuButton label="More" icon={Ellipsis} align="end" entries={[{ type: 'group', label: 'Theme' }, ...entries]} />
        </div>
        <Button variant="primary" icon={Upload} onClick={upload}>
          <span className="hidden sm:inline">Upload PDFs</span>
          <span className="sm:hidden">Upload</span>
        </Button>
      </div>
    </header>
  );
}
