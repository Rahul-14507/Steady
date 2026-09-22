export function startFrameLoop(
  video: HTMLVideoElement,
  onFrame: (mediaTimeSec: number, nowMs: number) => void,
) {
  let stopped = false;
  const tick = (now: number, metadata?: { mediaTime?: number }) => {
    if (stopped) return;
    const mediaTime = metadata?.mediaTime ?? video.currentTime;
    onFrame(mediaTime, now);
    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback((nextNow, nextMetadata) => tick(nextNow, nextMetadata));
    } else {
      requestAnimationFrame((nextNow) => tick(nextNow));
    }
  };
  tick(performance.now());
  return () => {
    stopped = true;
  };
}