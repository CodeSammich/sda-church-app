/**
 * When each shape of the church symbol is drawn in the launch animation
 * (components/LaunchSplash.tsx, #538), as fractions of the whole drawing.
 *
 * A pen traces each shape's outline from its lowest point up both sides, then
 * the shape fills white and the pen line goes. The open Bible and the cross
 * come first; then the flame's lines, each reaching higher than the last, so
 * the drawing ends at the flame's tip; then the ®. Once everything is filled,
 * what shows is the official symbol and nothing else.
 *
 * The functions run on the UI thread as Reanimated worklets, and in plain
 * Node for previews, so this file imports nothing.
 */

export interface DrawingWindow {
  /** When the pen starts and finishes the shape's outline. */
  penStart: number;
  penEnd: number;
  /** When the shape fills in, and the pen line fades. */
  fillStart: number;
  fillEnd: number;
}

interface DrawnShape {
  role: 'bible' | 'flame' | 'mark';
  top: number;
  repeatsEdge?: boolean;
}

const BIBLE_PEN_END = 0.34;
const FLAME_START = 0.24;
// Each flame line starts this much after the one before.
const FLAME_STAGGER = 0.08;
const FLAME_PEN = 0.26;
// A shape starts filling a little before its outline is finished.
const FILL_LEAD = 0.06;
const FILL = 0.16;
const MARK_START = 0.84;
// A path that repeats another's edges appears at once when that one has
// filled, so the two don't overlap as a lighter area while fading in.
const SNAP = 0.001;

export const getDrawingWindows = (shapes: readonly DrawnShape[]): DrawingWindow[] => {
  // Lowest-reaching first, so each line rises past the one before.
  const flames = shapes
    .filter((shape) => shape.role === 'flame')
    .sort((a, b) => b.top - a.top);
  return shapes.map((shape) => {
    if (shape.role === 'mark') {
      return { penStart: MARK_START, penEnd: MARK_START, fillStart: MARK_START, fillEnd: 1 };
    }
    const penStart =
      shape.role === 'bible' ? 0 : FLAME_START + flames.indexOf(shape) * FLAME_STAGGER;
    const penEnd = shape.role === 'bible' ? BIBLE_PEN_END : penStart + FLAME_PEN;
    const fillEnd = Math.min(1, penEnd - FILL_LEAD + FILL);
    return {
      penStart,
      penEnd,
      fillStart: shape.repeatsEdge ? fillEnd - SNAP : penEnd - FILL_LEAD,
      fillEnd,
    };
  });
};

const clamp = (value: number) => {
  'worklet';
  return Math.min(1, Math.max(0, value));
};

// Slow to start and to finish, like a hand.
const easeInOut = (value: number) => {
  'worklet';
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
};

/** How much of the outline the pen has drawn at `progress`, from 0 to 1. */
export const getPenAmount = (progress: number, window: DrawingWindow) => {
  'worklet';
  if (window.penEnd <= window.penStart) return progress >= window.penStart ? 1 : 0;
  return easeInOut(clamp((progress - window.penStart) / (window.penEnd - window.penStart)));
};

/** How filled in the shape is at `progress`, from 0 to 1. */
export const getFillAmount = (progress: number, window: DrawingWindow) => {
  'worklet';
  return clamp((progress - window.fillStart) / (window.fillEnd - window.fillStart));
};
