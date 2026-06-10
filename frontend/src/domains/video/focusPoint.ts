export type FocusPoint = {
  x: number;
  y: number;
};

export type Box = {
  width: number;
  height: number;
};

export function focusPointFromContainClick(
  box: Box,
  image: Box,
  click: FocusPoint
): FocusPoint | null {
  if (box.width <= 0 || box.height <= 0 || image.width <= 0 || image.height <= 0) {
    return null;
  }

  const boxRatio = box.width / box.height;
  const imageRatio = image.width / image.height;
  const rendered =
    boxRatio > imageRatio
      ? {
          width: box.height * imageRatio,
          height: box.height,
          left: (box.width - box.height * imageRatio) / 2,
          top: 0
        }
      : {
          width: box.width,
          height: box.width / imageRatio,
          left: 0,
          top: (box.height - box.width / imageRatio) / 2
        };

  const localX = click.x - rendered.left;
  const localY = click.y - rendered.top;
  if (localX < 0 || localX > rendered.width || localY < 0 || localY > rendered.height) {
    return null;
  }

  return {
    x: clampFocusCoordinate(Math.round((localX / rendered.width) * 127)),
    y: clampFocusCoordinate(Math.round((localY / rendered.height) * 127))
  };
}

function clampFocusCoordinate(value: number) {
  return Math.max(0, Math.min(127, value));
}
