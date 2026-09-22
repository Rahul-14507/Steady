import { FaceLandmarker, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export interface Landmarkers {
  hand: HandLandmarker;
  face: FaceLandmarker;
}

let cached: Promise<Landmarkers> | null = null;

export function getLandmarkers() {
  if (cached) return cached;
  cached = (async () => {
    const vision = await FilesetResolver.forVisionTasks("/wasm");
    const create = async (delegate: "GPU" | "CPU") => {
      const hand = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/hand_landmarker.task", delegate },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      const face = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });
      return { hand, face };
    };
    try {
      return await create("GPU");
    } catch {
      return create("CPU");
    }
  })();
  return cached;
}