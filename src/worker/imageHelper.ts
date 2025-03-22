export function bresenham_line(x1, y1, x2, y2, callback) {
  // Bresenham's line algorithm
  x1 = ~~x1;
  x2 = ~~x2;
  y1 = ~~y1;
  y2 = ~~y2;

  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    callback(x1, y1);

    if (x1 === x2 && y1 === y2) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x1 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y1 += sy;
    }
  }
}

export function bresenham_dense_line(x1, y1, x2, y2, callback) {
  // Bresenham's line algorithm with a callback between going horizontal and vertical
  x1 = ~~x1;
  x2 = ~~x2;
  y1 = ~~y1;
  y2 = ~~y2;

  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    callback(x1, y1);

    if (x1 === x2 && y1 === y2) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x1 += sx;
    }
    callback(x1, y1);
    if (e2 < dx) {
      err += dx;
      y1 += sy;
    }
  }
}


export function cut_out_background(
  view_canvas: OffscreenCanvas,
  view_ctx: OffscreenCanvasRenderingContext2D,
  main_canvas: OffscreenCanvas,
  main_ctx: OffscreenCanvasRenderingContext2D,
  x,
  y,
  width,
  height,
) {
  const temp_canvas = new OffscreenCanvas(width, height);
  let temp_ctx = temp_canvas.getContext("2d");
  temp_ctx.drawImage(view_canvas, 0, 0);

  view_ctx.save();
  view_ctx.globalCompositeOperation = "source-in";
  view_ctx.drawImage(main_canvas, x, y, width, height, 0, 0, width, height);
  view_ctx.restore();

  main_ctx.save();
  main_ctx.globalCompositeOperation = "destination-out";
  main_ctx.drawImage(temp_canvas, x, y);
  main_ctx.restore();

  return;
}