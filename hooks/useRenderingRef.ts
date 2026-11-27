import { useReducer, useRef } from 'react';

/**
 * A ref whose changes re-render the component that owns it. It's for a value
 * that callbacks and timers set through a ref, and that the screen also shows:
 * the Bible screen's audio source controller sets whether the listener is
 * listening, and the player's line for no connection depends on it (#801).
 * Set it from callbacks and effects, never while rendering.
 */
export function useRenderingRef<T>(initial: T): { current: T } {
  const [, rerender] = useReducer((renders: number) => renders + 1, 0);
  const ref = useRef<{ current: T } | null>(null);
  if (!ref.current) {
    let value = initial;
    ref.current = {
      get current() {
        return value;
      },
      set current(next: T) {
        if (Object.is(next, value)) return;
        value = next;
        rerender();
      },
    };
  }
  return ref.current;
}
