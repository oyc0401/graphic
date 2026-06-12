type ImageContext = {
  imageUrl?: string;
};

let lastImageContext: ImageContext = {};

document.addEventListener(
  "contextmenu",
  (event) => {
    const image = findImage(event.target);
    lastImageContext = image ? { imageUrl: getBestImageUrl(image) } : {};
  },
  true,
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GET_PAINTON_CONTEXT_IMAGE_URL") {
    return;
  }

  sendResponse(lastImageContext);
});

function findImage(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return undefined;
  }

  return target.closest("img");
}

function getBestImageUrl(image: HTMLImageElement) {
  const candidates = [
    image.currentSrc,
    image.src,
    getLargestSrcsetUrl(image.srcset),
    image.dataset.src,
    image.dataset.original,
    image.dataset.lazySrc,
    image.dataset.url,
    image.dataset.image,
    image.closest("a")?.href,
  ];

  return candidates.map(resolveUrl).find(isUsableImageUrl);
}

function getLargestSrcsetUrl(srcset: string) {
  if (!srcset) {
    return undefined;
  }

  return srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean)
    .at(-1);
}

function resolveUrl(url: string | undefined) {
  if (!url) {
    return undefined;
  }

  try {
    return new URL(url, window.location.href).toString();
  } catch {
    return undefined;
  }
}

function isUsableImageUrl(url: string | undefined) {
  return Boolean(url && !url.startsWith("data:") && !url.startsWith("blob:"));
}
