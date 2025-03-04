function draw() {
  draw_ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (points.length == 1) return;
  if (points.length == 2) {
      draw0(points[0], points[1]);
      console.log("직선");
      return;
  }
  for (let i = 0; i < points.length - 1; i++) {
      if (i == 0) {
          draw1(points[i], points[i + 1], points[i + 2]);
          // console.log(i, i + 1, i + 2);
      } else if (i == points.length - 2) {
          draw3(points[i - 1], points[i], points[i + 1]);

          // console.log(i - 1, i, i + 1);
      } else {
          draw2(points[i - 1], points[i], points[i + 1], points[i + 2]);
          // console.log(i - 1, i, i + 1, i + 2);
      }
  }
  draw_ctx.stroke(); // 그리기
}

function draw0(p0, p1) {
  draw_ctx.beginPath();
  draw_ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
  draw_ctx.lineTo(p1.x, p1.y);
}
//draw1(points[0], points[1], points[2]);
function draw1(p0, p1, p2) {
  let a0 = computeControlPoint(p0, p1, p2);
  draw_ctx.beginPath();
  draw_ctx.moveTo(p0.x, p0.y); // 시작점으로 이동
  draw_ctx.quadraticCurveTo(a0.x, a0.y, p1.x, p1.y);
}

//draw2(points[0], points[1], points[2], points[3]);
function draw2(p0, p1, p2, p3) {
  let a0 = computeControlPoint(p2, p1, p0);
  let a1 = computeControlPoint(p1, p2, p3);
  draw_ctx.bezierCurveTo(a0.x, a0.y, a1.x, a1.y, p2.x, p2.y);
}

//draw3(points[1], points[2], points[3]);
function draw3(p0, p1, p2) {
  let a0 = computeControlPoint(p2, p1, p0);
  draw_ctx.quadraticCurveTo(a0.x, a0.y, p2.x, p2.y);
}
