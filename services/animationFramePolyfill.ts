/**
 * Expo Router's SDK 58 canary stack schedules an animation frame while the
 * static web renderer is running in Node. Node does not provide the browser
 * animation APIs, so supply the smallest timer-backed equivalent only when
 * they are missing. Native and browser runtimes keep their real APIs.
 */
const runtime = globalThis as typeof globalThis & {
  cancelAnimationFrame?: (handle: number) => void;
  requestAnimationFrame?: (callback: (timestamp: number) => void) => number;
};

if (typeof runtime.requestAnimationFrame !== 'function') {
  let nextHandle = 1;
  const pendingFrames = new Map<number, ReturnType<typeof setTimeout>>();

  runtime.requestAnimationFrame = (callback) => {
    const handle = nextHandle++;
    pendingFrames.set(
      handle,
      setTimeout(() => {
        pendingFrames.delete(handle);
        callback(Date.now());
      }, 0),
    );
    return handle;
  };

  runtime.cancelAnimationFrame = (handle) => {
    const frameHandle = handle as number;
    const timeout = pendingFrames.get(frameHandle);
    if (timeout !== undefined) {
      clearTimeout(timeout);
      pendingFrames.delete(frameHandle);
    }
  };
}
