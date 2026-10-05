# Steady

A modern web application built with React, TypeScript, Vite, and Tailwind CSS.

---

## Machine Learning & Models

Tremor and bradykinesia detection runs on Google's open-source MediaPipe Hand/Face Landmarker models, executed fully on-device via TensorFlow Lite and WebAssembly (WASM). MediaPipe's HandLandmarker and FaceLandmarker are open-source, client-side ML models (Google's BlazePalm/BlazeFace + landmark regression networks, Apache 2.0 licensed).

### ML Vision Models Overview

| Model | Model Asset File | Architecture & Mesh Output | License | Application in Steady |
|---|---|---|---|---|
| **MediaPipe Hand Landmarker** | `public/models/hand_landmarker.task` | **BlazePalm** detector + 21-point 3D hand mesh landmark regression network | Apache 2.0 | Finger tapping kinetics, opening amplitude, tap frequency, amplitude decay (sequence effect), and hand tremor tracking |
| **MediaPipe Face Landmarker** | `public/models/face_landmarker.task` | **BlazeFace** detector + 478-point 3D face mesh + 52 facial blendshapes | Apache 2.0 | Facial mobility check, smile excursion percentage, hypomimia detection, and spontaneous blink rate tracking |

### On-Device Execution & Privacy
- **TensorFlow Lite / WASM Execution**: Model inference runs entirely in the local browser process via `@mediapipe/tasks-vision` WebAssembly runtime with GPU acceleration (falling back gracefully to CPU).
- **100% On-Device Privacy**: No camera frames, images, video streams, or spatial landmark coordinates are ever uploaded or transmitted to any server.

---

## Prerequisites

Before running the project, ensure you have the following installed on your system:

- **Node.js**: v18.0.0 or later ([Download Node.js](https://nodejs.org/))
- **pnpm**: v9.0.0 or later (or `npx pnpm`)
  ```bash
  npm install -g pnpm
  ```

---

## Getting Started (First-Time Setup)

### 1. Clone the repository
```bash
git clone https://github.com/Rahul-14507/Steady.git
cd Steady
```

### 2. Install dependencies
```bash
pnpm install
```

### 3. Download required assets
Fetch the required local runtime assets and vision models by running:
```bash
pnpm run download-assets
```

---

## Running Locally

To start the development server with live reload:

```bash
pnpm --filter @workspace/steady run dev
```

*Alternatively, you can run directly from the application folder:*
```bash
cd artifacts/steady
pnpm run dev
# or: npm run dev
```

Open your browser and navigate to:
👉 **`http://localhost:5173/`**

---

## Available Scripts

From the repository root, you can run:

| Command | Description |
|---|---|
| `pnpm run download-assets` | Downloads required local assets and wasm files |
| `pnpm --filter @workspace/steady run dev` | Starts the local Vite development server |
| `pnpm --filter @workspace/steady run build` | Builds the production bundle |
| `pnpm --filter @workspace/steady run test` | Runs the test suite via Vitest |
| `pnpm run typecheck` | Runs TypeScript type checking across packages |

---

## Project Structure

```
├── artifacts/
│   ├── steady/          # Main web application (React, Vite, TypeScript)
│   └── api-server/      # Optional companion API server
├── lib/                 # Shared libraries and configurations
├── scripts/             # Build and utility scripts
├── pnpm-workspace.yaml  # Monorepo workspace configuration
└── package.json         # Root workspace scripts and dependencies
```
