const OPEN_IMAGE_MENU_ID = "open-image-with-painton";
const PAINTON_URL = "https://painton.app";

type ImageSourceResponse = {
  imageUrl?: string;
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: OPEN_IMAGE_MENU_ID,
    title: "PaintOn으로 열기",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== OPEN_IMAGE_MENU_ID) {
    return;
  }

  const fallbackUrl = getUsableImageUrl(info.srcUrl) ?? getUsableImageUrl(info.linkUrl);

  if (!tab?.id) {
    openPaintOnWithImageUrl(fallbackUrl);
    return;
  }

  chrome.tabs.sendMessage<ImageSourceResponse>(
    tab.id,
    { type: "GET_PAINTON_CONTEXT_IMAGE_URL" },
    (response) => {
      if (chrome.runtime.lastError) {
        openPaintOnWithImageUrl(fallbackUrl);
        return;
      }

      const imageUrl = getUsableImageUrl(response?.imageUrl) ?? fallbackUrl;
      openPaintOnWithImageUrl(imageUrl);
    },
  );
});

function openPaintOnWithImageUrl(imageUrl: string | undefined) {
  if (!imageUrl) {
    return;
  }

  const url = new URL(PAINTON_URL);
  url.searchParams.set("image", imageUrl);

  chrome.tabs.create({ url: url.toString() });
}

function getUsableImageUrl(url: string | undefined) {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) {
    return undefined;
  }

  return url;
}
