import type { PtzVector } from "../../types/api";

export type PadPoint = {
  x: number;
  y: number;
};

export type PadBox = {
  width: number;
  height: number;
};

const PTZ_VECTOR_LIMIT = 30;

export function ptzVectorFromPadPoint(box: PadBox, point: PadPoint): PtzVector {
  const size = Math.min(box.width, box.height);
  if (size <= 0) {
    return { x: 0, y: 0 };
  }

  const radius = size / 2;
  const center = { x: box.width / 2, y: box.height / 2 };
  const raw = {
    x: point.x - center.x,
    y: center.y - point.y
  };
  const distance = Math.hypot(raw.x, raw.y);
  const scale = distance > radius ? radius / distance : 1;

  return {
    x: roundVector((raw.x * scale * PTZ_VECTOR_LIMIT) / radius),
    y: roundVector((raw.y * scale * PTZ_VECTOR_LIMIT) / radius)
  };
}

export function vectorPadPosition(vector: PtzVector): PadPoint {
  return {
    x: 50 + (clampVector(vector.x) / PTZ_VECTOR_LIMIT) * 50,
    y: 50 - (clampVector(vector.y) / PTZ_VECTOR_LIMIT) * 50
  };
}

export function isCenteredVector(vector: PtzVector): boolean {
  return Math.abs(vector.x) < 0.5 && Math.abs(vector.y) < 0.5 && Math.abs(vector.z ?? 0) < 0.5;
}

function clampVector(value: number): number {
  return Math.min(PTZ_VECTOR_LIMIT, Math.max(-PTZ_VECTOR_LIMIT, value));
}

function roundVector(value: number): number {
  return Math.round(clampVector(value) * 10) / 10;
}
