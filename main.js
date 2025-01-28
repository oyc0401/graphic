// 설정값

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Define the applyPixelFlow function (as defined above)
const EFFECT_RADIUS = 20; // Twisting effect radius
const MAGNIFY_STRENGTH = 0.5; // Strength: positive for forward, negative for reverse

function applyPixelFlow(canvas, ctx, points) {
    const width = canvas.width;
    const height = canvas.height;

    // Get original pixel data
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Buffer for new pixel data
    const newImageData = new Uint8ClampedArray(data);

    // Iterate through each pixel
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let totalOffsetX = 0;
            let totalOffsetY = 0;

            // Iterate through each consecutive pair of points (each line)
            for (let i = 0; i < points.length - 1; i++) {
                const start = points[i];
                const end = points[i + 1];
                const x0 = start.x;
                const y0 = start.y;
                const x1 = end.x;
                const y1 = end.y;

                const dx = x1 - x0;
                const dy = y1 - y0;
                const length = Math.sqrt(dx * dx + dy * dy);

                if (length === 0) continue; // Skip zero-length lines

                const unitX = dx / length;
                const unitY = dy / length;

                const px = x - x0;
                const py = y - y0;

                const t = (px * unitX + py * unitY) / length;
                const clampedT = Math.max(0, Math.min(1, t));

                const closestX = x0 + clampedT * unitX * length;
                const closestY = y0 + clampedT * unitY * length;

                const distX = x - closestX;
                const distY = y - closestY;
                const dist = Math.sqrt(distX * distX + distY * distY);

                if (dist < EFFECT_RADIUS) {
                    // Calculate effect factor based on distance
                    const effectFactor = (1 - dist / EFFECT_RADIUS) * -MAGNIFY_STRENGTH;

                    // Calculate offsets
                    const offsetX = effectFactor * unitX * EFFECT_RADIUS;
                    const offsetY = effectFactor * unitY * EFFECT_RADIUS;

                    // Accumulate the offsets
                    totalOffsetX += offsetX;
                    totalOffsetY += offsetY;
                }
            }

            // Calculate the magnitude of the total offset
            const magnitude = Math.sqrt(totalOffsetX * totalOffsetX + totalOffsetY * totalOffsetY);

            if (magnitude > 0) {
                // Determine the maximum allowed magnitude
                const maxMagnitude = MAGNIFY_STRENGTH * EFFECT_RADIUS;

                // If the total magnitude exceeds the maximum, scale it down
                let finalOffsetX = totalOffsetX;
                let finalOffsetY = totalOffsetY;

                if (magnitude > maxMagnitude) {
                    const scale = maxMagnitude / magnitude;
                    finalOffsetX *= scale;
                    finalOffsetY *= scale;
                }

                const newX = x + finalOffsetX;
                const newY = y + finalOffsetY;

                // Bilinear interpolation
                const floorX = Math.floor(newX);
                const floorY = Math.floor(newY);
                const ceilX = Math.ceil(newX);
                const ceilY = Math.ceil(newY);

                const tX = newX - floorX;
                const tY = newY - floorY;

                // Helper function to get pixel color with boundary checks
                const getColor = (xx, yy) => {
                    if (xx >= 0 && xx < width && yy >= 0 && yy < height) {
                        const idx = (yy * width + xx) * 4;
                        return [
                            data[idx],
                            data[idx + 1],
                            data[idx + 2],
                            data[idx + 3],
                        ];
                    }
                    return [0, 0, 0, 0]; // Transparent for out-of-bounds
                };

                const color00 = getColor(floorX, floorY);
                const color10 = getColor(ceilX, floorY);
                const color01 = getColor(floorX, ceilY);
                const color11 = getColor(ceilX, ceilY);

                // Bilinear interpolation function
                const interpolate = (c00, c10, c01, c11, tX, tY) => {
                    const r =
                        c00[0] * (1 - tX) * (1 - tY) +
                        c10[0] * tX * (1 - tY) +
                        c01[0] * (1 - tX) * tY +
                        c11[0] * tX * tY;
                    const g =
                        c00[1] * (1 - tX) * (1 - tY) +
                        c10[1] * tX * (1 - tY) +
                        c01[1] * (1 - tX) * tY +
                        c11[1] * tX * tY;
                    const b =
                        c00[2] * (1 - tX) * (1 - tY) +
                        c10[2] * tX * (1 - tY) +
                        c01[2] * (1 - tX) * tY +
                        c11[2] * tX * tY;
                    const a =
                        c00[3] * (1 - tX) * (1 - tY) +
                        c10[3] * tX * (1 - tY) +
                        c01[3] * (1 - tX) * tY +
                        c11[3] * tX * tY;

                    return [r, g, b, a];
                };

                const [r, g, b, a] = interpolate(
                    color00,
                    color10,
                    color01,
                    color11,
                    tX,
                    tY,
                );

                // Assign the new color to the new image data buffer
                const index = (y * width + x) * 4;
                newImageData[index] = r;
                newImageData[index + 1] = g;
                newImageData[index + 2] = b;
                newImageData[index + 3] = a;
            }
            // If magnitude is 0, retain the original pixel (already in newImageData)
        }
    }

    // Apply the modified image data back to the canvas
    ctx.putImageData(new ImageData(newImageData, width, height), 0, 0);
}








// 초기화
window.onload = async () => {
    try {
        const img = await loadImageFromURL("check.png"); // 프로젝트 폴더 내 image.jpg 경로
        //const img = await loadImageFromURL("musk.png"); // 프로젝트 폴더 내 image.jpg 경로
        drawImageToCanvas(img);

        applyPixelFlow(canvas, ctx, [
            { x: 50, y: 100 },
            { x: 100, y: 190 },
            { x: 200, y: 170 },
 
        ]);
        drawHelperLine(ctx,[
            { x: 50, y: 100 },
            { x: 100, y: 190 },
            { x: 200, y: 170 },
            
        ]);
    } catch (error) {
        console.error("이미지 로드 실패:", error);
    }
    //animate();
};

const helper_canvas = document.getElementById("helper-canvas");
const helper_ctx = canvas.getContext("2d");

function drawHelperLine(ctx, points) {
    if (!Array.isArray(points) || points.length < 2) {
        console.warn("At least two points are required to draw helper lines.");
        return;
    }

    const totalPoints = points.length;

    // Function to interpolate color from red to blue
    const getColor = (index) => {
        const ratio = index / (totalPoints - 1); // Ratio between 0 and 1
        const r = Math.round(255 * (1 - ratio)); // Red decreases
        const g = 0; // Green remains 0
        const b = Math.round(255 * ratio); // Blue increases
        return `rgb(${r},${g},${b})`;
    };

    // Draw lines between consecutive points
    for (let i = 0; i < totalPoints - 1; i++) {
        const start = points[i];
        const end = points[i + 1];

        ctx.beginPath(); // Start a new path
        ctx.moveTo(start.x, start.y); // Move to the start point
        ctx.lineTo(end.x, end.y); // Draw a line to the end point
        ctx.lineWidth = 1; // Set line width
        ctx.strokeStyle = "blue"; // Set line color to blue
        ctx.stroke(); // Render the line
    }

    // Draw circles at each point with colors transitioning from red to blue
    for (let i = 0; i < totalPoints; i++) {
        const point = points[i];
        const color = getColor(i); // Get the color based on point index

        ctx.fillStyle = color; // Set fill color
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, Math.PI * 2); // Draw a circle with radius 2
        ctx.fill();
    }
}

// 이미지 로드 함수
function loadImageFromURL(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}

function drawImageToCanvas(img) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    helper_canvas.width = canvas.width;
    helper_canvas.height = canvas.height;
    ctx.drawImage(img, 0, 0);
}
