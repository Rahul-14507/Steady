let lock: WakeLockSentinel | null = null;

export async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    lock = await navigator.wakeLock.request("screen");
  } catch {
    lock = null;
  }
}

export async function releaseWakeLock() {
  await lock?.release();
  lock = null;
}