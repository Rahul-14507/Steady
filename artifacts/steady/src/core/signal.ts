export const mean = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const std = (values: number[]) => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

export const mad = (values: number[]) => {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
};

export function movingAverage(values: number[], windowSize = 3) {
  const half = Math.floor(windowSize / 2);
  return values.map((_, index) => {
    let total = 0;
    let count = 0;
    for (let cursor = Math.max(0, index - half); cursor <= Math.min(values.length - 1, index + half); cursor += 1) {
      total += values[cursor];
      count += 1;
    }
    return total / count;
  });
}

/** Local maxima with a prominence and time-spacing guard. */
export function findPeaks(values: number[], times: number[], minProminence: number, minDistanceSec: number) {
  const candidates: number[] = [];
  for (let index = 1; index < values.length - 1; index += 1) {
    if (values[index] <= values[index - 1] || values[index] < values[index + 1]) continue;
    let leftMin = values[index];
    for (let cursor = index - 1; cursor >= 0 && values[cursor] <= values[index]; cursor -= 1) leftMin = Math.min(leftMin, values[cursor]);
    let rightMin = values[index];
    for (let cursor = index + 1; cursor < values.length && values[cursor] <= values[index]; cursor += 1) rightMin = Math.min(rightMin, values[cursor]);
    if (values[index] - Math.max(leftMin, rightMin) >= minProminence) candidates.push(index);
  }

  const peaks: number[] = [];
  for (const index of candidates) {
    const previous = peaks.at(-1);
    if (previous === undefined || times[index] - times[previous] >= minDistanceSec) peaks.push(index);
    else if (values[index] > values[previous]) peaks[peaks.length - 1] = index;
  }
  return peaks;
}