import { useEffect, useRef, useState, useCallback } from "react";

export function useCamera(source?: "video", enabled = true) {
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    setVideoEl(node);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let active = true;

    if (source === "video") {
      if (videoEl) {
        videoEl.src = "/dev/sample-tap.mp4";
        void videoEl.play().then(() => {
          if (active) setReady(true);
        }).catch(() => undefined);
      }
      return () => {
        active = false;
        setReady(false);
      };
    }

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError("camera_unavailable");
          return;
        }

        let stream = streamRef.current;
        if (!stream || !stream.active) {
          const constraints: MediaStreamConstraints = {
            video: {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          streamRef.current = stream;
        }

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          return;
        }

        if (videoEl) {
          if (videoEl.srcObject !== stream) {
            videoEl.srcObject = stream;
          }
          videoEl.setAttribute("playsinline", "true");
          videoEl.setAttribute("webkit-playsinline", "true");
          videoEl.muted = true;

          try {
            await videoEl.play();
          } catch { /* autoPlay may wait for user gesture or load */ }

          if (active) {
            setReady(true);
            setError(null);
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err?.name === "NotAllowedError" ? "permission_denied" : "camera_unavailable");
        }
      }
    };

    void startCamera();

    return () => {
      active = false;
    };
  }, [enabled, source, videoEl]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { videoRef, videoEl, error, ready };
}