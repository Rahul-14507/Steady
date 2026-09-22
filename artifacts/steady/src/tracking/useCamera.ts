import { useEffect, useRef, useState } from "react";

export function useCamera(source?: "video", enabled = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;
    let stream: MediaStream | undefined;
    let active = true;
    if (source === "video") {
      video.src = "/dev/sample-tap.mp4";
      void video.play().catch(() => undefined);
      return () => {
        active = false;
      };
    }
    void navigator.mediaDevices?.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: false,
    }).then((nextStream) => {
      if (!active) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = nextStream;
      video.srcObject = nextStream;
      return video.play();
    }).catch(() => setError("camera_unavailable"));
    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [enabled, source]);

  return { videoRef, error };
}