function getInitialImageUrl(search: string): string | null {
  const imageUrl = new URLSearchParams(search).get("img");
  if (!imageUrl) return null;

  const trimmed = imageUrl.trim();
  if (!trimmed) {
    console.error("Initial image URL is empty.");
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      console.error("Initial image URL must use http or https.", trimmed);
      return null;
    }
    return url.href;
  } catch {
    console.error("Initial image URL is invalid.", trimmed);
    return null;
  }
}

export async function loadInitialImageFromQuery(
  search = window.location.search,
): Promise<ImageBitmap | null> {
  const imageUrl = getInitialImageUrl(search);
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(
        "Initial image request failed.",
        response.status,
        response.statusText,
        imageUrl,
      );
      return null;
    }

    const contentType = response.headers.get("Content-Type");
    if (!contentType?.startsWith("image/")) {
      console.error("Initial image response is not an image.", contentType);
      return null;
    }

    const blob = await response.blob();
    return await createImageBitmap(blob, {
      imageOrientation: "flipY",
      premultiplyAlpha: "premultiply",
    });
  } catch (error) {
    // Initial images are optional. Missing or invalid files should not block app startup.
    console.error("Initial image loading failed.", error);
    return null;
  }
}
