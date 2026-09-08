type SeekStatus = { currentTime: number; duration: number; isLoaded?: boolean };
type SeekPlayer = {
  readonly currentStatus: SeekStatus;
  seekTo(seconds: number): Promise<void>;
};

const CONFIRMATION_TIMEOUT_MS = 5_000;
const POSITION_TOLERANCE_MS = 1_000;

export class BibleAudioSeekController {
  private generation = 0;
  private pending: number | null = null;

  constructor(
    private readonly player: SeekPlayer,
    private readonly onPosition: (millis: number) => void,
    private readonly onError: (error: unknown) => void,
  ) {}

  get pendingPositionMillis() {
    return this.pending;
  }

  get isSeeking() {
    return this.pending !== null;
  }

  // A source change/unmount invalidates every outstanding completion.
  cancel() {
    this.generation += 1;
    this.pending = null;
  }

  async seek(positionMillis: number, durationMillis: number): Promise<void> {
    if (!Number.isFinite(positionMillis) || !Number.isFinite(durationMillis) || durationMillis <= 0) return;
    const target = Math.max(0, Math.min(durationMillis, positionMillis));
    const generation = ++this.generation;
    this.pending = target;
    this.onPosition(target);

    try {
      // Native commands are dispatched in order. A newer user target can be
      // submitted immediately; an older completion must not publish UI state.
      await this.player.seekTo(target / 1000);
      const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;
      while (generation === this.generation) {
        const status = this.player.currentStatus;
        const position = status.currentTime * 1000;
        const confirmed = status.isLoaded && status.duration > 0 &&
          Math.abs(position - target) < POSITION_TOLERANCE_MS;
        if (confirmed || Date.now() >= deadline) {
          this.pending = null;
          // Explicitly publish even while paused, when periodic events stop.
          // On timeout, show the actual position instead of a fictional target.
          if (Number.isFinite(position)) this.onPosition(position);
          return;
        }
        // Poll status only. Buffering never causes another seek/play/replace.
        await new Promise<void>(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.pending = null;
      try {
        const position = this.player.currentStatus.currentTime * 1000;
        if (Number.isFinite(position)) this.onPosition(position);
      } catch {
        // The native player may have been released.
      }
      this.onError(error);
    }
  }
}
