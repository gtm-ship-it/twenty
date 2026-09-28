const POSITION_STEP = 1024;

// Posición para soltar una tarjeta en `targetIndex` de una columna ya ordenada
// (sin contar la tarjeta que se mueve): el punto medio entre sus vecinas.
export const computeInsertPosition = (
  orderedPositions: number[],
  targetIndex: number,
): number => {
  if (orderedPositions.length === 0) {
    return POSITION_STEP;
  }

  const index = Math.max(0, Math.min(targetIndex, orderedPositions.length));

  if (index === 0) {
    return orderedPositions[0] - POSITION_STEP;
  }

  if (index === orderedPositions.length) {
    return orderedPositions[orderedPositions.length - 1] + POSITION_STEP;
  }

  return (orderedPositions[index - 1] + orderedPositions[index]) / 2;
};
