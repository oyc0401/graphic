const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp"]);

export function getInitialImageName(search: string): string | null {
  const imageName = new URLSearchParams(search).get("image");
  if (!imageName) return null;

  const trimmed = imageName.trim();
  if (!trimmed) return null;
  if (trimmed.includes("..")) return null;
  if (trimmed.includes("/") || trimmed.includes("\\")) return null;

  const extension = trimmed.split(".").pop()?.toLowerCase();
  if (!extension || !IMAGE_EXTENSIONS.has(extension)) return null;

  return trimmed;
}

export async function loadInitialImageFromQuery(
  search = window.location.search,
): Promise<ImageBitmap | null> {
  const imageName = getInitialImageName(search);
  if (!imageName) return null;

  try {
    const response = await fetch(`/${encodeURIComponent(imageName)}`);
    if (!response.ok) return null;

    const contentType = response.headers.get("Content-Type");
    if (!contentType?.startsWith("image/")) return null;

    const blob = await response.blob();
    return await createImageBitmap(blob, {
      imageOrientation: "flipY",
      premultiplyAlpha: "premultiply",
    });
  } catch {
    // Initial images are optional. Missing or invalid files should not block app startup.
    return null;
  }
}
