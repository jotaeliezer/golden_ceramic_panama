const MAX_EDGE = 1600;
const MAX_DATA_URL_LENGTH = 3_500_000;

function fittedSize(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement): string {
  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.5) {
    quality = Math.round((quality - 0.08) * 100) / 100;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error("Could not compress the photo.");
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error("That photo is still too large. Try another one.");
  }
  return dataUrl;
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
  const size = fittedSize(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the photo.");
  context.drawImage(source, 0, 0, size.width, size.height);
  return canvas;
}

/** Resize to at most 1600px on the long edge and encode as JPEG. */
export async function compressImageToJpegDataUrl(file: Blob): Promise<string> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot resize photos.");
  }
  const bitmap = await createImageBitmap(file);
  try {
    return canvasToJpegDataUrl(drawToCanvas(bitmap, bitmap.width, bitmap.height));
  } finally {
    bitmap.close();
  }
}

/** Grab the current camera frame, then resize and encode it as JPEG. */
export function compressVideoFrameToJpegDataUrl(video: HTMLVideoElement): string {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error("Camera is not ready yet.");
  }
  return canvasToJpegDataUrl(drawToCanvas(video, video.videoWidth, video.videoHeight));
}
