import { PixelStore } from "./PixelStore";

// 픽셀 데이터를 보관하고 나중에 꺼낼 수 있는 컨테이너
// 텍스처에서 읽은 픽셀을 저장해두고, 히스토리 undo/redo 시점에 꺼내 쓴다.

// 픽셀 데이터가 이미 있을 때는 fromPixelData로 바로 만든다.
const pixels = new Uint8Array(100 * 100 * 4); // RGBA
// ... gl.readPixels(...)로 채웠다고 치자.

const store = PixelStore.fromPixelData(pixels, 100, 100);

// 나중에 undo/redo 시점에 꺼낸다.
const data = store.getPixelData(); // Uint8Array
