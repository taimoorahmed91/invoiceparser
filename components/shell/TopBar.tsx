'use client';

import { Ellipsis, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MenuButton } from '@/components/ui/MenuButton';
import { useUpload } from '@/components/upload/UploadProvider';
import { useThemeEntries } from './ThemeMenu';
import { pageShortTitle, pageTitle } from './nav';

/**
 * Sticky top bar: page title (h1) and the global Upload action (opens the Upload dialog, plan §4.6).
 * Phones get the compact version: title, "Upload" (icon + short label) and a "More" menu (theme lives there,
 * because the sidebar is not visible).
 */
export function TopBar({ pathname }: { pathname: string }) {
  const { entries } = useThemeEntries();
  const upload = useUpload();

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
        <Button variant="primary" icon={Upload} onClick={() => upload.open()}>
          <span className="hidden sm:inline">Upload PDFs</span>
          <span className="sm:hidden">Upload</span>
        </Button>
      </div>
    </header>
  );
}
