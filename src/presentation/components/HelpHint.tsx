import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';

/** Ayuda desplegable que funciona con teclado y pantalla táctil. */
export function HelpHint({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="help-hint">
      <summary>
        <CircleHelp size={17} aria-hidden="true" />
        {title}
      </summary>
      <div className="help-content">{children}</div>
    </details>
  );
}
