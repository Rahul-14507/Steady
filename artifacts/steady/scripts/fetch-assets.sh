#!/usr/bin/env bash
set -euo pipefail

mkdir -p public/models public/wasm
curl -L --fail --retry 3 -o public/models/hand_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
curl -L --fail --retry 3 -o public/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/float16/1/face_landmarker.task
cp -r node_modules/@mediapipe/tasks-vision/wasm/* public/wasm/