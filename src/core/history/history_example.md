# 히스토리 응답 예시

core의 히스토리 응답은 app UI 도구 이름이나 세션 이름을 넘기지 않는다.

브러시, 지우개, 픽셀 유동화 세션 내부 작업처럼 app이 따로 복원할 외부 상태가 없는 히스토리는 카운트만 반환한다.

선택 영역은 core 도구가 아니다. 선택 영역은 별도의 `selection` 상태 payload로 표현한다.

```ts
interface HistoryResponse {
  undoCount: number;
  redoCount: number;
  selection?: {
    show: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    flipH?: boolean;
    flipV?: boolean;
  };
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

## 브러시

브러시 stroke undo:

```ts
{
  undoCount: 4,
  redoCount: 1,
}
```

브러시 stroke redo:

```ts
{
  undoCount: 5,
  redoCount: 0,
}
```

## 지우개

지우개 stroke undo:

```ts
{
  undoCount: 2,
  redoCount: 1,
}
```

지우개 stroke redo:

```ts
{
  undoCount: 3,
  redoCount: 0,
}
```

## 픽셀 유동화

픽셀 유동화 세션이 열린 상태에서 push undo:

```ts
{
  undoCount: 3,
  redoCount: 1,
}
```

픽셀 유동화 세션이 열린 상태에서 push redo:

```ts
{
  undoCount: 4,
  redoCount: 0,
}
```

픽셀 유동화 적용 작업 undo:

```ts
{
  undoCount: 6,
  redoCount: 1,
}
```

픽셀 유동화 적용 작업 redo:

```ts
{
  undoCount: 7,
  redoCount: 0,
}
```

## 선택 영역

선택 영역 생성 redo:

```ts
{
  selection: {
    show: true,
    x: 120,
    y: 80,
    width: 300,
    height: 200,
    flipH: false,
    flipV: false,
  },
  undoCount: 5,
  redoCount: 0,
}
```

선택 영역 생성 undo:

```ts
{
  selection: {
    show: false,
    x: 120,
    y: 80,
    width: 300,
    height: 200,
    flipH: false,
    flipV: false,
  },
  undoCount: 4,
  redoCount: 1,
}
```

외부 이미지 붙여넣기 redo:

```ts
{
  selection: {
    show: true,
    x: 120,
    y: 80,
    width: 300,
    height: 200,
    flipH: false,
    flipV: false,
  },
  undoCount: 5,
  redoCount: 0,
}
```

외부 이미지 붙여넣기 undo:

```ts
{
  selection: {
    show: false,
    x: 120,
    y: 80,
    width: 300,
    height: 200,
    flipH: false,
    flipV: false,
  },
  undoCount: 4,
  redoCount: 1,
}
```

선택 영역 이동/변형 undo:

```ts
{
  selection: {
    show: true,
    x: 120,
    y: 80,
    width: 300,
    height: 200,
    flipH: false,
    flipV: false,
  },
  undoCount: 7,
  redoCount: 1,
}
```

선택 영역 이동/변형 redo:

```ts
{
  selection: {
    show: true,
    x: 180,
    y: 120,
    width: 300,
    height: 200,
    flipH: false,
    flipV: false,
  },
  undoCount: 8,
  redoCount: 0,
}
```

선택 영역 commit redo:

```ts
{
  selection: {
    show: false,
    x: 180,
    y: 120,
    width: 300,
    height: 200,
    flipH: false,
    flipV: false,
  },
  undoCount: 9,
  redoCount: 0,
}
```

선택 영역 commit undo:

```ts
{
  selection: {
    show: true,
    x: 180,
    y: 120,
    width: 300,
    height: 200,
    flipH: false,
    flipV: false,
  },
  undoCount: 8,
  redoCount: 1,
}
```

## 이미지 크기 변경

이미지 크기 변경 undo:

```ts
{
  position: {
    x: 0,
    y: 0,
    width: 800,
    height: 600,
  },
  undoCount: 2,
  redoCount: 1,
}
```

이미지 크기 변경 redo:

```ts
{
  position: {
    x: 20,
    y: 10,
    width: 1024,
    height: 768,
  },
  undoCount: 3,
  redoCount: 0,
}
```

## 히스토리가 아닌 이미지 교체

`uploadImage()`와 `resetImage()`는 새 이미지를 열거나 작업 이미지를 초기화하는 흐름이다.
이 작업은 `resetHisory()`로 히스토리 스택을 비우므로 히스토리 응답 예시에 포함하지 않는다.

## app 매핑

app은 core 응답 데이터를 보고 UI 상태를 결정한다.

```ts
if (response.selection) {
  if (response.selection.show) {
    // app UI: 선택 영역 조작 상태
  } else {
    // app UI: 선택 도구 상태 또는 현재 브러시 상태 유지
  }
}

if (response.position) {
  // app UI: 화면 위치와 이미지 크기 복원
}
```
