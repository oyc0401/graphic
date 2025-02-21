/**
   * x가 0 이상 1 이하일 때,
   * I(x)= ∫₀¹ √((1-F(t))² - x²) dt 를 계산합니다.
   **/
// F(x) = easeinoutCirc(x) 일 때
export async function getIntegralEaseInOut(){
    const response1 = await fetch("/data.bin");
    const arrayBuffer1 = await response1.arrayBuffer();
    let list = new Float32Array(arrayBuffer1);
    return list;
}


// F(x)를 뒤집어놓은 함수의 적분0~x까지 가져옴
export async function getIntegralEaseInOutMirror(){
    const response2 = await fetch("/integralEase.bin");
    const arrayBuffer2 = await response2.arrayBuffer();
    let list = new Float32Array(arrayBuffer2);
    return list;
}