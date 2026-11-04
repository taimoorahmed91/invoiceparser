import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { UI_INIT_SCRIPT } from '@/lib/uiPrefs';
import { ToastProvider } from '@/components/toast/ToastProvider';
import { PressFeedback } from '@/components/ui/PressFeedback';

/*
 * Fira Sans + Fira Code, vendored as woff2 (plan §2.3, risk R5: no build-time network).
 * The `latin` file has no Polish letters, so each family has a second `-ext` face
 * (latin-ext: ł ż ś ć ą ę ó ń …). The CSS font stack lists both; the browser falls
 * through to the -ext face for the glyphs the first one lacks.
 */
const firaSans = localFont({
  src: [
    { path: './fonts/FiraSans-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/FiraSans-500-latin.woff2', weight: '500', style: 'normal' },
    { path: './fonts/FiraSans-600-latin.woff2', weight: '600', style: 'normal' },
    { path: './fonts/FiraSans-700-latin.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-fira-sans',
  display: 'swap',
  // no generated Arial fallback face: it would sit before the -ext face in the stack and catch ł ż ś ć …
  adjustFontFallback: false,
});
const firaSansExt = localFont({
  src: [
    { path: './fonts/FiraSans-400-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './fonts/FiraSans-500-latin-ext.woff2', weight: '500', style: 'normal' },
    { path: './fonts/FiraSans-600-latin-ext.woff2', weight: '600', style: 'normal' },
    { path: './fonts/FiraSans-700-latin-ext.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-fira-sans-ext',
  display: 'swap',
  // no generated Arial fallback face: it would sit before the -ext face in the stack and catch ł ż ś ć …
  adjustFontFallback: false,
  preload: false,
});
const firaCode = localFont({
  src: [
    { path: './fonts/FiraCode-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/FiraCode-500-latin.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-fira-code',
  display: 'swap',
  // no generated Arial fallback face: it would sit before the -ext face in the stack and catch ł ż ś ć …
  adjustFontFallback: false,
  preload: false,
});
const firaCodeExt = localFont({
  src: [
    { path: './fonts/FiraCode-400-latin-ext.woff2', weight: '400', style: 'normal' },
    { path: './fonts/FiraCode-500-latin-ext.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-fira-code-ext',
  display: 'swap',
  // no generated Arial fallback face: it would sit before the -ext face in the stack and catch ł ż ś ć …
  adjustFontFallback: false,
  preload: false,
});

export const metadata: Metadata = {
  // each route adds its own name in front: "Invoices · Invoice Parser"
  title: { default: 'Invoice Parser', template: '%s · Invoice Parser' },
  description: 'Parse and display PDF invoice data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the inline script below sets class="dark" before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${firaSans.variable} ${firaSansExt.variable} ${firaCode.variable} ${firaCodeExt.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: UI_INIT_SCRIPT }} />
      </head>
      <body className="bg-canvas text-ink min-h-screen font-sans antialiased">
        <PressFeedback />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
