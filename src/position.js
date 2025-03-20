import { paintState, applyKeyAction, setCursor } from "./main";
import { cancel, endDrawing, layer } from "./draw";
import { getLayerWorker } from "./worker/workerPool";
const MIN_SCALE = 0.1;
const MAX_SCALE = 20;

export let position = {
  x: 0,
  y: 0,
  width: 500,
  height: 500,
  scale: 1,
  resizeScreen() {
    paintState.updateBouncingRect();
    // 스크롤 범위 제한!
    let maxW =
      (paintState.bouncingRect.width / this.scale + this.width) / 2 - 2;
    let clampPositionX = Math.min(maxW, Math.max(-maxW, this.x));
    let maxH =
      (paintState.bouncingRect.height / this.scale + this.height) / 2 - 2;
    let clampPositionY = Math.min(maxH, Math.max(-maxH, this.y));

    this.x = clampPositionX;
    this.y = clampPositionY;

    //console.log("pos:", positionState.x, positionState.y);
    let canvas_css_w = this.width * this.scale;
    let canvas_css_h = this.height * this.scale;
    let cal_posX = this.x * this.scale;
    let cal_posY = this.y * this.scale;
    let css_left = (paintState.bouncingRect.width - canvas_css_w) / 2;
    let css_top = (paintState.bouncingRect.height - canvas_css_h) / 2;

    paintState.layer_area.style.left = css_left - cal_posX + "px";
    paintState.layer_area.style.top = css_top - cal_posY + "px";
    paintState.layer_area.style.width = canvas_css_w + "px";
    paintState.layer_area.style.height = canvas_css_h + "px";
  },
};

export function initPosition() {
  window.addEventListener("resize", function () {
    position.resizeScreen();
  });

  function setPinchEvent() {
    paintState.action = "PINCH";
  }
  function setPanEvent() {
    paintState.action = "PAN";
  }

  function setLastTool() {
    paintState.action = "BRUSH";
  }

  /**
   * 휠 스크롤 영역
   */
  (function () {
    window.addEventListener(
      "wheel",
      (event) => {
        // console.log("wheel", event);

        if (event.ctrlKey) {
          event.preventDefault();
          let new_mag;
          if (event.deltaY > 0) {
            new_mag = position.scale / 1.2;
          } else {
            new_mag = position.scale * 1.2;
          }
          const clamped_scale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, new_mag),
          );
          setMagification(
            clamped_scale,
            to_screen_coord(event.clientX, event.clientY),
          );
          setCursor();
        } else {
          if (event.shiftKey) {
            let delta = event.deltaY;
            position.x += delta / position.scale;
          } else {
            let delta = event.deltaY;
            position.y += delta / position.scale;
          }

          //console.log(positionState.x, positionState.y);
        }

        position.resizeScreen();
      },
      { passive: false },
    );
  })();

  /**
   * 핀지줌 영역
   */
  (function () {
    let pointerIndex = 0;

    let lastPinchDistance;
    let lastPinchCenterPos;
    let firstPointerTime = 0;
    let lastDoubleTouchTime = 0;

    const twoFingerTapInterval = 75; // 이중클릭 범위
    const doubleTapInterval = 250; // 더블클릭 범위

    function averageTouches() {
      if (pointers.size < 2) throw new Error("포인터가 2개 미만"); // 포인터가 2개 미만이면 평균 계산 불가

      // 1. pointerId를 오름차순 정렬하여 가장 낮은 두 개 선택
      const sortedPointers = [...pointers.values()].sort(
        (a, b) => a.index - b.index,
      );
      const firstPoint = sortedPointers[0];
      const secondPoint = sortedPointers[1];

      // 3. 두 포인터의 평균 좌표 계산
      return {
        x: (firstPoint.clientX + secondPoint.clientX) / 2,
        y: (firstPoint.clientY + secondPoint.clientY) / 2,
      };
    }

    document.addEventListener("gesturestart", (event) => {
      event.preventDefault();
    });

    let pointers = new Map(); // pointerId -> {x, y} 저장

    document.querySelector("#container").addEventListener(
      "pointerdown",
      (event) => {
        event.preventDefault();
        console.log("pointerdown - captured", event.pointerId);

        if (!pointers.has(event.pointerId)) {
          console.log("포인터 추가", event.pointerId);
          pointers.set(event.pointerId, {
            index: pointerIndex,
            clientX: event.clientX,
            clientY: event.clientY,
          });
          pointerIndex++;
        } else {
          alert("포인터 아이디가 이미 있는데 또 pointerdown? 버그임");
        }

        // 핀치 줌
        if (pointers.size === 1) {
          firstPointerTime = performance.now();
        }

        if (pointers.size === 2) {
          const elapsed = performance.now() - firstPointerTime;
          if (elapsed <= twoFingerTapInterval) {
            cancel();
            let now = performance.now();
            if (now - lastDoubleTouchTime <= doubleTapInterval) {
              alert(`더블터치! ${now - lastDoubleTouchTime}`);
              lastDoubleTouchTime = 0;
            } else {
              lastDoubleTouchTime = now;
            }
          }

          endDrawing();
          console.log("두 손가락 감지됨, 핀치 줌 시작");
          setPinchEvent();

          lastPinchCenterPos = averageTouches();
          const points = Array.from(pointers.values());
          lastPinchDistance = Math.hypot(
            points[0].clientX - points[1].clientX,
            points[0].clientY - points[1].clientY,
          );
        }
      },
      true,
    );

    window.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      Object.assign(pointers.get(event.pointerId), {
        clientX: event.clientX,
        clientY: event.clientY,
      });

      // 핀치 줌
      if (paintState.action !== "PINCH") return;
      if (pointers.size < 2) return; // 두 손가락이 없으면 무시

      const pinchCenterPos = averageTouches();
      const dx = lastPinchCenterPos.x - pinchCenterPos.x;
      const dy = lastPinchCenterPos.y - pinchCenterPos.y;
      position.x += dx / position.scale;
      position.y += dy / position.scale;
      lastPinchCenterPos = pinchCenterPos;

      const points = Array.from(pointers.values());
      const distance = Math.hypot(
        points[0].clientX - points[1].clientX,
        points[0].clientY - points[1].clientY,
      );

      const scaleFactor = distance / lastPinchDistance;
      let newScale = position.scale * scaleFactor;
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));

      setMagification(
        clampedScale,
        to_screen_coord(pinchCenterPos.x, pinchCenterPos.y),
      );
      lastPinchDistance = distance;

      position.resizeScreen();
    });

    window.addEventListener(
      "pointerup",
      (event) => {
        if (pointers.has(event.pointerId)) {
          pointers.delete(event.pointerId);
          console.log("포인터 제거!", event.pointerId);
        }

        // 핀치 줌
        if (paintState.action !== "PINCH") return;

        if (pointers.size == 0) {
          setLastTool();
        }
      },
      true,
    );

    window.addEventListener(
      "pointercancel",
      (event) => {
        if (pointers.has(event.pointerId)) {
          pointers.delete(event.pointerId);
          console.log("포인터 제거!", event.pointerId);
        }
      },
      true,
    );

    // document.querySelector("#container").addEventListener(
    //   "pointerdown",
    //   (event) => {
    //     event.preventDefault();
    //     console.log(event);
    //     console.log("pointerdown - captured");
    //     // 이때 0-> 2, 1->3 이렇게 1프레임 안에 두개의 손가락 터치 되는거 예외처리 해야함.

    //     if (pointers.length < 2) {
    //       pointers.push({
    //         pointerId: event.pointerId,
    //         pointerType: event.pointerType,
    //         clientX: event.clientX,
    //         clientY: event.clientY,
    //       });
    //     } else {
    //       return;
    //     }

    //     if (pointers.length === 1) {
    //       first_pointer_time = performance.now();
    //     }

    //     if (pointers.length === 2) {
    //       const elapsed = performance.now() - first_pointer_time;

    //       // 일정시간 이내에 그리면 지우기
    //       if (elapsed <= discard_quick_undo_period) {
    //         cancel();
    //       }

    //       resetImageTexture();

    //       console.log("두손가락이면 핀치줌 시작");
    //       setPinchEvent();

    //       lastPinchCenterPos = average_touches(event.touches);

    //       lastPinchDistance = Math.hypot(
    //         event.touches[0].clientX - event.touches[1].clientX,
    //         event.touches[0].clientY - event.touches[1].clientY,
    //       );
    //     }
    //   },
    //   true, // 캡쳐링 단계에서 실행
    // );

    // window.addEventListener("pointermove", (event) => {
    //   if (paintState.action != "PINCH") return;

    //   // 핀치 팬
    //   const pinchCenterPos = average_touches(event.touches);
    //   const dx = lastPinchCenterPos.x - pinchCenterPos.x;
    //   const dy = lastPinchCenterPos.y - pinchCenterPos.y;
    //   position.x += dx / position.scale; // 이게 new_scale이여야하는지 아징 못정함.
    //   position.y += dy / position.scale;

    //   lastPinchCenterPos = pinchCenterPos;

    //   // 핀지줌
    //   const distance = Math.hypot(
    //     event.touches[0].clientX - event.touches[1].clientX,
    //     event.touches[0].clientY - event.touches[1].clientY,
    //   );

    //   const scaleFactor = distance / lastPinchDistance;
    //   let new_scale = position.scale * scaleFactor;

    //   const clamped_scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, new_scale));

    //   setMagification(
    //     clamped_scale,
    //     to_screen_coord(pinchCenterPos.x, pinchCenterPos.y),
    //   );

    //   lastPinchDistance = distance;

    //   // 렌더링
    //   position.resizeScreen();
    // });

    // window.addEventListener("pointerup", (event) => {
    //   if (paintState.action != "PINCH") return;
    //   if (event.touches.length >= 2) return; // 세번째 손가락 뗀거임.
    //   // 손 뗐는데, 배열에 있는 녀석이면 배열에서 제거하기.
    //   if (arr.some((obj) => obj.pointerId === event.pointerId)) {
    //     arr = arr.filter((e) => e.pointerId !== event.pointerId);
    //   }

    //   // 핀치줌을 하다가 떼면 핀치줌 꺼지게 하기
    //   if (event.touches === undefined || event.touches.length < 2) {
    //     setLastTool();
    //   }
    // });
  })();

  /**
   * 마우스 팬 영역
   */
  (function () {
    let lastClientX;
    let lastClientY;

    document
      .querySelector("#container")
      .addEventListener("pointerdown", (e) => {
        if (paintState.action != "PAN") return;

        lastClientX = e.clientX;
        lastClientY = e.clientY;

        console.log("팬 시작!");
      });

    window.addEventListener("pointermove", (e) => {
      if (paintState.action != "PAN") return;
      if (!paintState.pointerdown) return;

      let dx = lastClientX - e.clientX;
      let dy = lastClientY - e.clientY;
      position.x += dx / position.scale;
      position.y += dy / position.scale;

      lastClientX = e.clientX;
      lastClientY = e.clientY;
      position.resizeScreen();
    });

    window.addEventListener("pointerup", (e) => {
      if (paintState.action != "PAN") return;
      applyKeyAction();
      setCursor();
    });
  })();

  /**
   * 줌 영역
   */
  (function () {
    let sx, sy;
    let ex, ey;
    let activeZoom = false;
    document
      .querySelector("#container")
      .addEventListener("pointerdown", (e) => {
        if (paintState.action != "ZOOM") return;
        if (activeZoom) return;
        sx = e.clientX;
        sy = e.clientY;
        ex = e.clientX;
        ey = e.clientY;
        activeZoom = true;
        let zoomArea = document.querySelector("#zoom-area");
        zoomArea.style.visibility = "visible";
        console.log("확대");
        zoomArea.style.left = `${sx}px`;
        zoomArea.style.top = `${sy}px`;
        zoomArea.style.width = `0px`;
        zoomArea.style.height = `0px`;
      });

    window.addEventListener("pointermove", (e) => {
      if (paintState.action != "ZOOM") return;
      if (!paintState.pointerdown) return;
      if (!activeZoom) return;
      ex = e.clientX;
      ey = e.clientY;
      let zoomArea = document.querySelector("#zoom-area");
      let startX = sx < ex ? sx : ex;
      let startY = sy < ey ? sy : ey;
      let zoomW = Math.abs(sx - ex);
      let zoomH = Math.abs(sy - ey);
      zoomArea.style.left = `${startX}px`;
      zoomArea.style.top = `${startY}px`;
      zoomArea.style.width = `${zoomW}px`;
      zoomArea.style.height = `${zoomH}px`;
    });

    window.addEventListener("pointerup", (e) => {
      if (paintState.action != "ZOOM") return;
      if (!activeZoom) return;

      let zoomArea = document.querySelector("#zoom-area");
      zoomArea.style.visibility = "hidden";
      let cx = (sx + ex) / 2;
      let cy = (sy + ey) / 2;

      let zoomW = Math.abs(sx - ex);
      let zoomH = Math.abs(sy - ey);

      // 그냥 클릭 시
      if (zoomW < 10 || zoomH < 10) {
        let new_mag = position.scale;
        if (e.button === 0) {
          new_mag = position.scale * 1.5;
        } else if (e.button === 2) {
          new_mag = position.scale / 1.5;
        }
        const clamped_scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, new_mag));
        setMagification(clamped_scale, to_screen_coord(e.clientX, e.clientY));
        setCursor();
      } else {
        let px = paintState.bouncingRect.width / zoomW;
        let py = paintState.bouncingRect.height / zoomH;
        let minScale = px < py ? px : py;

        let topMargin = 80;
        let centerX = paintState.bouncingRect.width / 2;
        let centerY = paintState.bouncingRect.height / 2;

        let dx = cx - centerX;
        let dy = cy - centerY - topMargin / minScale;
        position.x += dx / position.scale;
        position.y += dy / position.scale;

        let new_mag = position.scale * minScale;

        // if (e.button === 0) {
        //   new_mag = position.scale * minScale;
        // } else if (e.button === 2) {
        //   new_mag = position.scale / minScale;
        // }

        const clamped_scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, new_mag));

        setMagification(clamped_scale, to_screen_coord(centerX, centerY));
        setCursor();
      }

      position.resizeScreen();

      activeZoom = false;

      applyKeyAction();
      setCursor();
    });
  })();
}

// 이게...
// 캔버스 밖을 움직이면 pan이 되게 해야하는데, 이 로직들도 진짜 세세하게 다이어그램 그려야겠다.
// 처음 드로잉 중일 때 메뉴에서 시작했다가 끌고 내려오는 포인터.

function setMagification(new_scale, anchor_point) {
  let factor = 1 - position.scale / new_scale;

  let diff_x = anchor_point.x - position.x;
  let diff_y = anchor_point.y - position.y;
  position.x += diff_x * factor;
  position.y += diff_y * factor;

  console.log("배율:", new_scale);
  position.scale = new_scale;
}

// 캔버스 상의 좌표로 변환.
export function to_canvas_coord(x, y) {
  let p = to_screen_coord(x, y);
  let px = p.x + position.width / 2;
  let py = p.y + position.height / 2;
  return { x: px, y: py };
}

// 스크롤시의 좌표로 변환.
export function to_screen_coord(x, y) {
  let px =
    (x - paintState.bouncingRect.width / 2 - paintState.bouncingRect.x) /
      position.scale +
    position.x;
  let py =
    (y - paintState.bouncingRect.height / 2 - paintState.bouncingRect.y) /
      position.scale +
    position.y;
  return { x: px, y: py };
}

function changeSize() {
  let newWidth = 300;
  let newHeight = 300;
  const worker = getLayerWorker();
  worker.updateSize(newWidth, newHeight);
  let diffX = position.width - newWidth;
  let diffY = position.height - newHeight;
  position.x += diffX / 2;
  position.y += diffY / 2;

  position.width = newWidth;
  position.height = newHeight;

  position.resizeScreen();
}

window.changeSize = changeSize;
