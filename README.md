# Steady

A modern web application built with React, TypeScript, Vite, and Tailwind CSS.

---

## Machine Learning & Architecture

Tremor and bradykinesia detection runs on Google's open-source MediaPipe Hand/Face Landmarker models (21-point hand mesh, 478-point face mesh), executed fully on-device via TensorFlow Lite/WASM. MediaPipe's HandLandmarker and FaceLandmarker are themselves open-source, on-device ML models (Google's BlazePalm/BlazeFace + landmark regression networks, Apache 2.0 licensed).

All computer vision processing is performed locally on-device. No video frames, images, or raw spatial landmarks are ever uploaded to remote servers.

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
