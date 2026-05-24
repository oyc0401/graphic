export function getInitialImageLayout(
  screenWidth: number,
  screenHeight: number,
  imageWidth: number,
  imageHeight: number,
) {
  const fitPadding = 1.125;
  const xScale = screenWidth / (imageWidth * fitPadding);
  const yScale = screenHeight / (imageHeight * fitPadding);
  const scale = Math.min(xScale, yScale);

  return {
    x: (screenWidth - imageWidth * scale) / 2 / scale,
    y: (screenHeight - imageHeight * scale) / 2 / scale,
    width: imageWidth,
    height: imageHeight,
    scale,
  };
}
