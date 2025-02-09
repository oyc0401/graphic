class Liquify{
  constructor(canvas,ctx){
    // 원본 이미지 데이터 가져오기
    this.originalImageData = ctx.getImageData(0, 0, width, height);
    this.originalData = originalImageData.data;

    // 변위 맵 초기화
    this.displaceX = new Float32Array(width * height);
    this.displaceY = new Float32Array(width * height);
  }
}

function makeLiquify(canvas,ctx){
  
}