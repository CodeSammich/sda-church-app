import { BibleAudioSeekController } from '@/services/BibleAudioSeekController';

describe('Bible audio seek coordination', () => {
  function setup() {
    const player = {
      currentStatus: { currentTime: 30, duration: 200, isLoaded: true, playing: false },
      seekTo: jest.fn(async (_seconds: number) => {}),
      play: jest.fn(),
      pause: jest.fn(),
      replace: jest.fn(),
    };
    const onPosition = jest.fn();
    const onError = jest.fn();
    const controller = new BibleAudioSeekController(player, onPosition, onError);
    return { player, onPosition, onError, controller };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each([false, true])('confirms a seek without changing playback intent (playing=%s)', async playing => {
    const { player, controller, onPosition } = setup();
    player.currentStatus.playing = playing;
    const completion = controller.seek(90_000, 200_000);
    expect(controller.pendingPositionMillis).toBe(90_000);
    player.currentStatus.currentTime = 90;
    await completion;
    expect(onPosition).toHaveBeenLastCalledWith(90_000);
    expect(controller.isSeeking).toBe(false);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
    expect(player.play).not.toHaveBeenCalled();
    expect(player.pause).not.toHaveBeenCalled();
    expect(player.replace).not.toHaveBeenCalled();
  });

  it('waits through buffering without reissuing the seek or exposing a zero reset', async () => {
    const { player, controller, onPosition } = setup();
    player.currentStatus.isLoaded = false;
    player.currentStatus.currentTime = 0;
    const completion = controller.seek(90_000, 200_000);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(onPosition.mock.calls).toEqual([[90_000]]);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
    player.currentStatus = { ...player.currentStatus, isLoaded: true, currentTime: 90 };
    await jest.advanceTimersByTimeAsync(50);
    await completion;
    expect(controller.isSeeking).toBe(false);
    expect(onPosition).toHaveBeenLastCalledWith(90_000);
  });

  it('does not confirm an end target just because the requested time is near the end', async () => {
    const { player, controller, onPosition } = setup();
    const completion = controller.seek(200_000, 200_000);
    await jest.advanceTimersByTimeAsync(500);
    expect(controller.isSeeking).toBe(true);
    expect(onPosition.mock.calls).toEqual([[200_000]]);
    player.currentStatus.currentTime = 200;
    await jest.advanceTimersByTimeAsync(50);
    await completion;
    expect(controller.isSeeking).toBe(false);
  });

  it('lets a newer target supersede an older pending completion', async () => {
    const { player, controller, onPosition } = setup();
    let resolveOld!: () => void;
    player.seekTo.mockImplementationOnce(() => new Promise<void>(resolve => { resolveOld = resolve; }));
    const old = controller.seek(41_000, 200_000);
    const latest = controller.seek(90_000, 200_000);
    player.currentStatus.currentTime = 90;
    await latest;
    const calls = onPosition.mock.calls.length;
    resolveOld();
    await old;
    expect(onPosition).toHaveBeenCalledTimes(calls);
    expect(onPosition).toHaveBeenLastCalledWith(90_000);
    expect(player.seekTo.mock.calls).toEqual([[41], [90]]);
  });

  it('accumulates rapid skip taps from the pending position', async () => {
    const { player, controller } = setup();
    const first = controller.seek(60_000, 200_000);
    const second = controller.seek(controller.pendingPositionMillis! + 30_000, 200_000);
    player.currentStatus.currentTime = 90;
    await Promise.all([first, second]);
    expect(player.seekTo.mock.calls).toEqual([[60], [90]]);
  });

  it('clears a timed-out optimistic position without retrying', async () => {
    const { player, controller, onPosition } = setup();
    const completion = controller.seek(90_000, 200_000);
    await jest.advanceTimersByTimeAsync(5_000);
    await completion;
    expect(controller.isSeeking).toBe(false);
    expect(onPosition).toHaveBeenLastCalledWith(30_000);
    expect(player.seekTo).toHaveBeenCalledTimes(1);
  });

  it('invalidates polling on a source change or unmount', async () => {
    const { controller, onPosition } = setup();
    const completion = controller.seek(90_000, 200_000);
    await jest.advanceTimersByTimeAsync(50);
    controller.cancel();
    onPosition.mockClear();
    await jest.advanceTimersByTimeAsync(50);
    await completion;
    expect(onPosition).not.toHaveBeenCalled();
    expect(controller.pendingPositionMillis).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('reports a failed seek and restores actual position', async () => {
    const { player, controller, onPosition, onError } = setup();
    const error = new Error('seek failed');
    player.seekTo.mockRejectedValueOnce(error);
    await controller.seek(90_000, 200_000);
    expect(controller.isSeeking).toBe(false);
    expect(onPosition).toHaveBeenLastCalledWith(30_000);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it('ignores errors from a cancelled source and allows new seeks', async () => {
    const { player, controller, onError } = setup();
    let rejectOld!: (error: Error) => void;
    player.seekTo.mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectOld = reject; }));
    const old = controller.seek(90_000, 200_000);
    controller.cancel();
    const latest = controller.seek(10_000, 200_000);
    player.currentStatus.currentTime = 10;
    await latest;
    rejectOld(new Error('old source released'));
    await old;
    expect(onError).not.toHaveBeenCalled();
    expect(controller.isSeeking).toBe(false);
  });

  it('ignores invalid input and clamps valid targets to the chapter', async () => {
    const { player, controller } = setup();
    await controller.seek(NaN, 200_000);
    await controller.seek(10_000, 0);
    await controller.seek(10_000, Infinity);
    expect(player.seekTo).not.toHaveBeenCalled();
    player.currentStatus.currentTime = 0;
    await controller.seek(-10_000, 200_000);
    player.currentStatus.currentTime = 200;
    await controller.seek(300_000, 200_000);
    expect(player.seekTo.mock.calls).toEqual([[0], [200]]);
  });
});
