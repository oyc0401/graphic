import { paintState, pressedKeys,setKeyEvents } from "./main";
import { cancel, endDrawing } from "./draw";
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

  function setPinchEvent(){
    paintState.action = "PINCH";
  }
  function setPanEvent(){
    paintState.action = "PAN";
  }

  function setLastTool(){
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
    let lastPinchDistance;
    let lastPinchCenterPos;
    let first_pointer_time = 0;
    let discard_quick_undo_period = 150;

    function average_touches(points) {
      const average = { x: 0, y: 0 };
      for (const pointer of points) {
        average.x += pointer.clientX;
        average.y += pointer.clientY;
      }
      average.x /= points.length;
      average.y /= points.length;
      return average;
    }

    document.addEventListener("gesturestart", function (event) {
      event.preventDefault();
    });

    document.querySelector("#container").addEventListener(
      "touchstart",
      (event) => {
        console.log("$canvas_area.touchstart - captured");
        // 이때 0-> 2, 1->3 이렇게 1프레임 안에 두개의 손가락 터치 되는거 예외처리 해야함.
        if (event.touches.length > 2) {
          // 세번째 손가락은 무시
          return;
        }
        if (event.touches.length === 1) {
          first_pointer_time = performance.now();
        }

        if (event.touches.length == 2) {
          const elapsed = performance.now() - first_pointer_time;

          // 일정시간 이내에 그리면 지우기
          if (elapsed <= discard_quick_undo_period) {
            //alert('!');
            cancel();
          }

          endDrawing();

          console.log("두손가락이면 핀치줌 시작");
          setPinchEvent();


          lastPinchCenterPos = average_touches(event.touches);

          lastPinchDistance = Math.hypot(
            event.touches[0].clientX - event.touches[1].clientX,
            event.touches[0].clientY - event.touches[1].clientY,
          );
        }
      },
      true, // 캡쳐링 단계에서 실행
    );

    window.addEventListener("touchmove", (event) => {
      if (paintState.action != "PINCH") return;

      // 핀치 팬
      const pinchCenterPos = average_touches(event.touches);
      const dx = lastPinchCenterPos.x - pinchCenterPos.x;
      const dy = lastPinchCenterPos.y - pinchCenterPos.y;
      position.x += dx / position.scale; // 이게 new_scale이여야하는지 아징 못정함.
      position.y += dy / position.scale;

      lastPinchCenterPos = pinchCenterPos;

      // 핀지줌
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );

      const scaleFactor = distance / lastPinchDistance;
      let new_scale = position.scale * scaleFactor;

      const clamped_scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, new_scale));

      setMagification(
        clamped_scale,
        to_screen_coord(pinchCenterPos.x, pinchCenterPos.y),
      );

      lastPinchDistance = distance;

      // 렌더링
      position.resizeScreen();
    });

    window.addEventListener("touchend", (event) => {
      console.log("touchend");
      if (paintState.action != "PINCH") return;
      if (event.touches.length >= 2) {
        // 세번째 손가락 뗀거임.
        return;
      }

      // // 핀치줌을 하다가 떼면 핀치줌 꺼지게 하기
      if (event.touches === undefined || event.touches.length < 2) {
        setLastTool();
      }
    });
  })();

  document
    .querySelector("#container")
    .addEventListener("pointerdown", (event) => {
      if (paintState.action == "PINCH") return;
      if (event.target === event.currentTarget) {
        console.log("부모의 빈 부분이 클릭됨");
        setPanEvent();
      }
    });

  /**
   * 마우스 팬 영역
   */
  (function () {
    let lastClientX;
    let lastClientY;
    let panmoveStart = false; // 이건 팬도구 마우스가 클릭 되었는지 여부
    window.addEventListener("pointerdown", (e) => {
      if (paintState.action != "PAN") return;
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      panmoveStart = true;
    });

    window.addEventListener("pointermove", (e) => {
      if (paintState.action != "PAN") return;
      if (!panmoveStart) return;

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
      if (!panmoveStart) return;
      panmoveStart = false;
      // 여기서 키보드 팬이 눌려있으면 팬 그대로 가도록 해야함
      if(!pressedKeys['Space']){
         setLastTool();
      }

      setKeyEvents();
     
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
