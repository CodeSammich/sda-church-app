// Freeze the coordinate frame for a drag. Later locationX values can be relative
// to a different/moving native target; pageX stays in the root coordinate space.
export class BibleAudioScrubGesture {
  private frame: { left: number; width: number; durationMillis: number } | null = null;

  begin(pageX: number, locationX: number, width: number, durationMillis: number) {
    if (![pageX, locationX, width, durationMillis].every(Number.isFinite) || width <= 0 || durationMillis <= 0) {
      this.cancel();
      return null;
    }
    this.frame = { left: pageX - locationX, width, durationMillis };
    return this.move(pageX);
  }

  move(pageX: number) {
    if (!this.frame || !Number.isFinite(pageX)) return null;
    const { left, width, durationMillis } = this.frame;
    return Math.max(0, Math.min(1, (pageX - left) / width)) * durationMillis;
  }

  release(pageX: number) {
    const position = this.move(pageX);
    this.cancel();
    return position;
  }

  cancel() {
    this.frame = null;
  }
}
