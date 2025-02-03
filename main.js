// main.js
// 메인 스레드는 DOM과 사용자 이벤트만 처리하고,
// OffscreenCanvas를 생성하여 웹워커에 전달합니다.

(() => {
  // 페이지 로드 후 실행
  window.addEventListener("load", () => {
    const canvas = document.getElementById("canvas");

    // 캔버스를 화면 전체 혹은 이미지 크기에 맞게 설정 (여기서는 임시값)
    canvas.width = 800;
    canvas.height = 600;

    // OffscreenCanvas로 전환 (transferControlToOffscreen)
    const offscreen = canvas.transferControlToOffscreen();

    // 웹워커 생성
    const worker = new Worker("worker.js");

      console.log("!!")
    // 웹워커에 초기화 메시지 전송: OffscreenCanvas와 이미지 URL 전달
    worker.postMessage(
      {
        type: "init",
        canvas: offscreen,
        imageUrl: "check_r.png" // 실제 이미지 경로로 수정하세요.
      },
      [offscreen]
    );
    // 마우스(혹은 포인터) 이벤트 핸들러:
    // 이벤트 좌표는 브라우저 뷰포트 기준이므로, 캔버스의 위치에 따라 보정이 필요할 수 있습니다.
    const getCanvasCoordinates = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    };

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
