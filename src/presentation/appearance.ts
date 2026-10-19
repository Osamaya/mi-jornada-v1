import { useEffect, useState } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export const palettes = [
  { id: 'navy', name: 'Azul ejecutivo', color: '#24578a' },
  { id: 'forest', name: 'Verde bosque', color: '#236653' },
  { id: 'graphite', name: 'Grafito', color: '#4c566a' },
] as const;
export type Palette = (typeof palettes)[number]['id'];
const storageKey = 'mi-jornada-color';
function storedPalette(): Palette {
  try {
    const saved = localStorage.getItem(storageKey);
    return palettes.find((p) => p.id === saved)?.id ?? 'navy';
  } catch {
    return 'navy';
  }
}
export function useAppearance() {
  const [palette, setPalette] = useState(storedPalette);
  const [error, setError] = useState('');
  useEffect(() => {
    document.documentElement.dataset.palette = palette;
  }, [palette]);
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const theme = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      void SystemBars.setStyle({
        style: theme.matches ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
      });
    };
    sync();
    theme.addEventListener('change', sync);
    return () => theme.removeEventListener('change', sync);
  }, []);
  function choosePalette(next: Palette) {
    try {
      localStorage.setItem(storageKey, next);
      setPalette(next);
      setError('');
    } catch {
      setError('No se pudo guardar el color en este dispositivo.');
    }
  }
  return { palette, choosePalette, error };
}
