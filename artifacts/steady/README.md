# Steady

Steady is an offline-first, mobile-first PWA for guided movement check-ins. It stores only derived metrics and quality information on the device.

## Run

```bash
pnpm --filter @workspace/steady run dev
pnpm --filter @workspace/steady run typecheck
pnpm --filter @workspace/steady run build
```

The development assessment flow supports `?source=video` when `public/dev/sample-tap.mp4` is available. Demo data can be loaded from Settings.

## Privacy

Camera frames, images, and landmarks stay on-device and are not stored. Steady does not diagnose any condition and is not a substitute for medical advice.