"""Where each verse starts, from the aligner's times and the recording's pauses (#561).

The aligner sometimes ends a verse a syllable early or late, or starts the next verse at the
end of the one before, in the pause between them. The pauses, found as ffmpeg's silencedetect
finds them (20 ms frames under -35 dB for at least 0.2 s), show where speech really resumes.
"""
import numpy as np

SR, HOP = 16000, 320
FS = HOP / SR


def find_pauses(pcm):
    """Each pause in 16 kHz mono samples, as (start, end) in seconds."""
    frames = len(pcm) // HOP
    rms = np.sqrt(np.mean(pcm[:frames * HOP].reshape(frames, HOP) ** 2, axis=1) + 1e-12)
    quiet = 20 * np.log10(rms) < -35
    pauses, run = [], 0
    for f in range(frames + 1):
        if f < frames and quiet[f]:
            run += 1
        else:
            if run >= 10:
                pauses.append(((f - run) * FS, f * FS))
            run = 0
    return pauses


def snap_starts(aligned, ends, pauses):
    """Each verse's start, from the aligner's starts and ends, and the starts moved.

    - A start already where speech resumes after a pause (within 0.15 s) stays.
    - A start in a pause, or less than 0.3 s before one, moves to where speech resumes after
      it, up to 3 s later: the aligner put it at the end of the verse before.
    - Otherwise a start more than 0.5 s from the end of a pause moves to the nearest pause end
      within 1.5 s, but not to before the verse before it ends.
    A start never moves past the next verse's.
    """
    starts = list(aligned)
    moved = []
    known = [i for i, t in enumerate(aligned) if t is not None]
    for k, i in enumerate(known):
        t = aligned[i]
        floor = max(ends[known[k - 1]] - 0.3, starts[known[k - 1]] + 0.1) if k else 0
        nxt = aligned[known[k + 1]] if k + 1 < len(known) else float('inf')
        if any(0 <= t - end <= 0.15 for _, end in pauses):
            continue
        pause = next(((a, b) for a, b in pauses if a - 0.3 <= t < b), None)
        if pause and pause[1] - t <= 3 and pause[1] < nxt:
            starts[i] = round(pause[1], 2)
        else:
            near = [b for _, b in pauses if floor <= b < nxt and abs(b - t) <= 1.5]
            if near:
                end = min(near, key=lambda b: abs(b - t))
                if abs(end - t) > 0.5:
                    starts[i] = round(end, 2)
        if starts[i] != t:
            moved.append([i + 1, t, starts[i]])
    return starts, moved
