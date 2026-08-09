export const hasHeaderBackButton = (
  segments: readonly string[],
  backTo?: string | string[],
) => {
  const explicitTarget = Array.isArray(backTo) ? backTo[0] : backTo;
  return Boolean(explicitTarget) || segments.length > 2;
};

export const getHeaderBackTarget = (
  segments: readonly string[],
  backTo?: string | string[],
) => {
  const explicitTarget = Array.isArray(backTo) ? backTo[0] : backTo;

  if (explicitTarget) return explicitTarget;
  if (segments.includes('you')) return '/you';
  if (segments.includes('resources')) return '/resources';
  if (segments.includes('bible')) return '/bible';

  return '/';
};
