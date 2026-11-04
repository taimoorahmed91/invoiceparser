import { Fragment } from 'react';

interface Shortcut {
  keys: string[][];
  does: string;
}

/**
 * Only shortcuts that work. Each entry is a list of alternative key combinations; keys inside one combination are pressed together.
 */
const SHORTCUTS: Shortcut[] = [
  { keys: [['/']], does: 'On the Invoices page: jump to the search box (when you are not typing).' },
  { keys: [['Esc']], does: 'Close a menu, a dialog, the invoice drawer or full screen. In a heating-units box it puts the saved value back.' },
  { keys: [['Enter']], does: 'Save the value in a heating-units box.' },
  { keys: [['←'], ['→']], does: 'Move between tabs and choices such as Chart | Table. On the Overview chart they move across the months.' },
  { keys: [['Enter']], does: 'On the Overview chart: show the month the arrow keys are on.' },
  { keys: [['↑'], ['↓']], does: 'Move through the items of an open menu; Enter picks one. In the invoice list they move between rows; Enter opens one and Space ticks it for Compare.' },
  { keys: [['Ctrl', 'Shift', 'F'], ['⌘', 'Shift', 'F']], does: 'Open or close full screen for the chart or table you are working in.' },
  { keys: [['Ctrl', 'Z'], ['⌘', 'Z']], does: 'Undo a delete (on the Invoices page, when you are not typing).' },
];

export function ShortcutsPanel() {
  return (
    <div className="dt-card">
      <div>
        <h2 className="dt-title" id="shortcuts-title">Keyboard shortcuts</h2>
        <p className="dt-desc">Everything in the app can be done from the keyboard. These are the shortcuts worth knowing.</p>
      </div>
      <dl className="dt-keys">
        {SHORTCUTS.map((s) => (
          <Fragment key={s.does}>
            <dt>
              {s.keys.map((combo, i) => (
                <Fragment key={combo.join('+')}>
                  {i > 0 && <span className="text-ink-subtle" aria-hidden="true">or</span>}
                  <span className="sr-only-text">{i > 0 ? ' or ' : ''}</span>
                  {combo.map((k, j) => (
                    <Fragment key={k}>
                      {j > 0 && <span className="sr-only-text"> plus </span>}
                      <kbd className="dt-kbd">{k}</kbd>
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </dt>
            <dd>{s.does}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
