import { FaceLandmarker, FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

export interface Landmarkers {
  hand: HandLandmarker;
  face: FaceLandmarker;
}

let cached: Promise<Landmarkers> | null = null;

export function getLandmarkers() {
  if (cached) return cached;
  cached = (async () => {
    let vision: any;
    try {
      vision = await FilesetResolver.forVisionTasks("/wasm");
    } catch {
      vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
    }

    const create = async (delegate: "GPU" | "CPU", useCdn = false) => {
      const handPath = useCdn
        ? "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
        : "/models/hand_landmarker.task";
      const facePath = useCdn
        ? "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        : "/models/face_landmarker.task";

      const face = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: facePath, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      });

      const hand = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: handPath, delegate },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      return { hand, face };
    };

    try {
      return await create("GPU", false);
    } catch {
      try {
        return await create("CPU", false);
      } catch {
        return await create("CPU", true);
      }
    }
  })().catch((err) => {
    cached = null; // allow retry
    throw err;
  });

  return cached;
}