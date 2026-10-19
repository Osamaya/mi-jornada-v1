import { useEffect, useState } from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { demoWeek, DEMO_WEEK } from '../../application/demo';
import { calculateWeek } from '../../domain/overtime/calculate';
import { deductions } from '../../domain/payroll/deductions';
import { useAppearance } from '../appearance';
import { AppearanceCard } from '../components/AppearanceCard';
import { HelpHint } from '../components/HelpHint';
import { Summary } from './Summary';

export function DemoWeek({ onClose }: { onClose: () => void }) {
  const appearance = useAppearance();
  const [state] = useState(demoWeek);
  const estimate = calculateWeek(state, DEMO_WEEK, DEMO_WEEK.endMs);
  const taxes = deductions(estimate.grossCents, state.payroll[0], state.payments[0]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (Capacitor.getPlatform() !== 'android') return;
    const listener = NativeApp.addListener('backButton', onClose);
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [onClose]);
  return (
    <div className="demo-shell">
      <header className="topbar demo-topbar">
        <span className="brand">
          <span className="brand-mark">MJ</span> Mi Jornada
        </span>
        <button className="secondary" onClick={onClose}>
          <ArrowLeft size={18} /> Mis registros
        </button>
      </header>
      <main className="main-content">
        <aside className="demo-banner" aria-label="Datos de demostración">
          <FlaskConical size={23} aria-hidden="true" />
          <div>
            <strong>Estás viendo una semana de ejemplo</strong>
            <p>Datos ficticios, de solo lectura. Tus registros personales se conservan.</p>
          </div>
        </aside>
        <AppearanceCard {...appearance} />
        <details className="card settings-section demo-assumptions">
          <summary>
            <span>Ver horario y supuestos del ejemplo</span>
          </summary>
          <div className="settings-section-body">
            <span className="eyebrow">DEL 12 AL 18 DE OCTUBRE DE 2026</span>
            <h2>Una semana completa, paso a paso</h2>
            <p>
              De lunes a viernes, de 8:00 a 17:30, con 30 minutos de comida sin pago cada día.
              Tarifa: <strong>$20 por hora.</strong>
            </p>
            <div className="demo-facts">
              <span>
                <strong>5</strong> jornadas
              </span>
              <span>
                <strong>45 h</strong> pagadas
              </span>
              <span>
                <strong>5 h</strong> extra
              </span>
            </div>
            <HelpHint title="¿Cómo llegamos a $950 antes de descuentos?">
              <p>
                40 horas normales × $20 = $800. Las 5 horas extra se pagan a $30: suman $150. Total:
                $950.
              </p>
              <p>
                En el desglose se muestran primero las 45 horas a $20 ($900) y después el recargo
                extra de $50. Es la misma cuenta: las horas extra no se cuentan dos veces.
              </p>
            </HelpHint>
          </div>
        </details>
        <Summary
          state={state}
          estimate={estimate}
          taxes={taxes}
          readOnly
          changeWeek={() => {}}
          update={async () => false}
          onSettings={onClose}
        />
        <button className="secondary demo-return" onClick={onClose}>
          <ArrowLeft size={18} /> Volver a mis registros
        </button>
      </main>
    </div>
  );
}
