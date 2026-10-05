export function startFrameLoop(
  video: HTMLVideoElement,
  onFrame: (mediaTimeSec: number, nowMs: number) => void,
) {
  let stopped = false;
  let animId: number;

  const tick = (now: number, metadata?: { mediaTime?: number }) => {
    if (stopped) return;
    const mediaTime = metadata?.mediaTime ?? video.currentTime ?? (now / 1000);
    onFrame(mediaTime, now);

    if ("requestVideoFrameCallback" in video && video.readyState >= 2 && !video.paused) {
      try {
        video.requestVideoFrameCallback((nextNow, nextMetadata) => tick(nextNow, nextMetadata));
      } catch {
        animId = requestAnimationFrame((nextNow) => tick(nextNow));
      }
    } else {
      animId = requestAnimationFrame((nextNow) => tick(nextNow));
    }
  };

  animId = requestAnimationFrame((nextNow) => tick(nextNow));

  return () => {
    stopped = true;
    cancelAnimationFrame(animId);
  };
}