# Steady

Steady is an offline-first, mobile-first PWA for guided movement check-ins. It stores only derived metrics and quality information on the device.

## Run

```bash
pnpm --filter @workspace/steady run dev
pnpm --filter @workspace/steady run typecheck
pnpm --filter @workspace/steady run build
```

The development assessment flow supports `?source=video` when `public/dev/sample-tap.mp4` is available. Demo data can be loaded from Settings.

## Machine Learning & Privacy

Tremor and bradykinesia detection runs on Google's open-source MediaPipe Hand/Face Landmarker models (21-point hand mesh, 478-point face mesh), executed fully on-device via TensorFlow Lite/WASM. MediaPipe's HandLandmarker and FaceLandmarker are themselves open-source, on-device ML models (Google's BlazePalm/BlazeFace + landmark regression networks, Apache 2.0 licensed).

Camera frames, images, and landmarks stay on-device and are not stored or transmitted. Steady does not diagnose any condition and is not a substitute for medical advice.