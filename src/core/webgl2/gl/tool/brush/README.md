# Brush Stroke Modules

저수준 모듈임. 알아서 다 안해줌.

## 뭐함

- `splineModule`: 부드러운 브러시 선 그림.
- `distModule`: 큰 브러시 선 그림.
- `pencilModule`: 픽셀 펜슬 선 그림.

셋 다 alpha map에만 그림

## 기본 사용

```ts
const stroke = createSpline(gl, {
  alphaMapTexture,
  width,
  height,
});

stroke.setAlpha(1);
stroke.setDiameter(20);

const r1 = stroke.start({ x: 10, y: 10 });
const r2 = stroke.move({ x: 40, y: 24 });
const r3 = stroke.move({ x: 72, y: 24 });
const strokeRect = stroke.end();
```

`start`, `move`가 준 rect는 preview용임.

`end`가 준 rect는 이번 stroke 전체임.

## 꼭 해야함

caller가 이거 해야함.

1. preview rect로 화면 갱신함.
2. `strokeRect`로 source에 반영함.
3. `strokeRect`로 history 만듦.
4. 끝나면 alpha map 지움.

4번 안하면 다음 stroke에서 망가짐.
겹쳐 그릴 때 이전 alpha가 또 합성됨.

## alpha map 지우기

```ts
function clearAlphaMap(rect) {
  gl.activeTexture(gl.TEXTURE0 + 3);
  gl.bindTexture(gl.TEXTURE_2D, alphaMapTexture);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    gl.RED,
    gl.UNSIGNED_BYTE,
    new Uint8Array(rect.width * rect.height),
  );
}
```

## cancel

cancel API 없음.

취소할 때는 이렇게 함.

```ts
restoreFromSource();

const rect = stroke.end();
if (rect) clearAlphaMap(rect);
```

history 만들면 안됨.

## texture unit

모듈 내부 alpha map unit은 `3`임.

앱 합성 shader도 같은 unit 봐야함.

모듈은 앱의 `TEXTURE_UNIT` 모름.
