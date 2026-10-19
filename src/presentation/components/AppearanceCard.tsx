import { Check, Palette as PaletteIcon } from 'lucide-react';
import { palettes, type Palette } from '../appearance';

export function AppearanceCard({
  palette,
  choosePalette,
  error,
}: {
  palette: Palette;
  choosePalette: (value: Palette) => void;
  error: string;
}) {
  return (
    <details className="card settings-section appearance-card">
      <summary>
        <span>Elige tu color</span>
        <PaletteIcon size={20} />
      </summary>
      <div className="settings-section-body">
        <p className="muted">
          Un estilo que se sienta tuyo. Se adapta al modo claro u oscuro de tu teléfono.
        </p>
        <div className="palette-options" role="group" aria-label="Color de la aplicación">
          {palettes.map((option) => (
            <button
              key={option.id}
              className="palette-option"
              type="button"
              aria-pressed={palette === option.id}
              onClick={() => choosePalette(option.id)}
            >
              <span
                className="palette-swatch"
                style={{ background: option.color }}
                aria-hidden="true"
              >
                {palette === option.id && <Check size={18} />}
              </span>
              <span>{option.name}</span>
            </button>
          ))}
        </div>
        <small>
          El color se guarda en este dispositivo; tus horas y pagos conservan sus valores.
        </small>
        {error && (
          <p className="alert error" role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
