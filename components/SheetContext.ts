import { createContext } from 'react';

/**
 * What a popup's scrolling content needs from the sheet around it (#867):
 * the sheet's colour, for the scroll hints' fades (#521); whether to let
 * Android's sheet take the scroll first, so a sheet at half height expands
 * before its content scrolls, as on iOS; and where to report the content's
 * height, which sizes the sheet.
 *
 * Outside a sheet (a centred dialog, or the web), the fades use the canvas
 * and nothing is reported.
 */
export type SheetContextValue = Readonly<{
  surfaceColor?: string;
  nestedScrollEnabled?: boolean;
  reportScroll?: (viewport: number, content: number) => void;
}>;

export const SheetContext = createContext<SheetContextValue>({});
