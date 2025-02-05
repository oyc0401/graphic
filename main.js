// main.js
(() => {
  window.addEventListener("load", () => {
    const canvas = document.getElementById("canvas");
    // 캔버스 크기를 원하는 대로 지정합니다.
    canvas.width = 800;
    canvas.height = 600;

    // OffscreenCanvas로 전환 (transferControlToOffscreen)
    const offscreen = canvas.transferControlToOffscreen();

    // 웹워커 생성
    const worker = new Worker("worker.js");

    // 웹워커 초기화 메시지 전송 (OffscreenCanvas와 이미지 URL 전달)
    worker.postMessage(
      {
        type: "init",
        canvas: offscreen,
        imageUrl: "check_r.png" // 실제 사용하실 이미지 경로로 수정하세요.
      },
      [offscreen]
    );

    // 캔버스 내 좌표를 얻기 위한 헬퍼 함수 (캔버스의 위치에 따라 보정)
    const getCanvasCoordinates = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: Math.floor(event.clientX - rect.left),
        y: Math.floor(event.clientY - rect.top)
      };
    };

    // pointer 이벤트를 웹워커로 전달합니다.
    document.addEventListener("pointerdown", (event) => {
      const pos = getCanvasCoordinates(event);
      worker.postMessage({ type: "pointerdown", x: pos.x, y: pos.y });
    });

    document.addEventListener("pointermove", (event) => {
      const pos = getCanvasCoordinates(event);
      worker.postMessage({ type: "pointermove", x: pos.x, y: pos.y });
    });

    document.addEventListener("pointerup", (event) => {
      const pos = getCanvasCoordinates(event);
      worker.postMessage({ type: "pointerup", x: pos.x, y: pos.y });
    });
  });
})();
