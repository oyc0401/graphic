import { PixelStore } from "./PixelStore";

// 픽셀 데이터를 보관하고 나중에 꺼낼 수 있는 컨테이너
// 텍스처에서 읽은 픽셀을 저장해두고, 히스토리 undo/redo 시점에 꺼내 쓴다.
// 내부적으로 lz4 압축 상태로 저장된다.

const pixels = new Uint8Array(100 * 100 * 4); // RGBA
// ... gl.readPixels(...)로 채웠다고 치자.

const store = PixelStore.fromPixelData(pixels, 100, 100);

// 크기 정보 접근
store.width;  // 100
store.height; // 100

// 압축된 상태의 byte 크기
store.size; // number (압축 후 byte 수)

// 나중에 undo/redo 시점에 꺼낸다. (내부적으로 lz4 압축 해제 후 반환)
const data = store.getPixelData(); // Uint8Array
