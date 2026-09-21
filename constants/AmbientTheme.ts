// Ambient illuminance is reported in lux. Keep a small gap between the dark
// and light thresholds so sensor noise does not make the theme flicker.
export const AMBIENT_DARK_LUX = 5;
export const AMBIENT_LIGHT_LUX = 25;

export const resolveAmbientIsDark = (illuminance: number, previous: boolean) => {
  if (!Number.isFinite(illuminance)) return previous;
  if (previous) return illuminance < AMBIENT_LIGHT_LUX;
  return illuminance <= AMBIENT_DARK_LUX;
};
