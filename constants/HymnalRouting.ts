export type RoutableHymn = {
  number: number | string;
};

/**
 * A routed hymn number is an exact selection, not a fuzzy list-scroll hint.
 * Falling back to the ordinary filter keeps malformed or stale URLs usable.
 */
export const getRoutedHymns = <Hymn extends RoutableHymn>(
  hymns: Hymn[],
  hymnNum: string | undefined,
  matchesHighlight: (hymn: Hymn) => boolean,
) => {
  if (hymnNum) {
    const selectedHymn = hymns.find(
      (hymn) => hymn.number.toString() === hymnNum,
    );
    if (selectedHymn) return [selectedHymn];
  }

  return hymns.filter(matchesHighlight);
};
