# 도구 추가 비용 줄이기

색 선택 도구를 추가하면서 수정한 파일 수가 많았다. 단순히 "새 도구 하나"를 넣는 작업이었는데도 상태, 포인터 이벤트, 커서, 리사이즈 핸들, 단축키, 앱바, 번역, 렌더러 API까지 여러 곳을 건드렸다. 이 문서는 왜 이런 일이 생겼는지와, 앞으로 도구 추가 비용을 줄이기 위한 개선 방향을 정리한다.

## 현재 문제

도구 하나를 추가할 때 여러 관심사가 흩어져 있다.

- 도구 구현: `src/app/tools`
- 도구 등록: `toolRegistry`
- 도구 id 타입: `paintState`
- 도구 전환: `draw.ts`
- 포인터 이벤트 우선순위: `pointerEvents.ts`
- 커서 표시: `ui/view.ts`
- 리사이즈 핸들 노출 여부: `resizeTool.ts`
- 버튼 UI: `AppBarDesktop.tsx`, `AppbarMobile.tsx`
- 단축키: `keyboardEvent.ts`
- 번역: `languagePack.ts`
- 렌더러 기능: `RendererInterface`, `paintController`, `paintService`

파일이 많은 것 자체보다 더 큰 문제는, 각 파일이 같은 질문에 따로 답하고 있다는 점이다.

예를 들어 색 선택 도구는 다음 정책을 가진다.

- 캔버스 리사이즈 핸들을 쓰지 않는다.
- 커서는 crosshair 계열이다.
- 버튼으로 켜면 한 번 색을 찍고 원래 도구로 돌아간다.
- C 키를 누르는 동안에도 임시로 켤 수 있다.
- 코어 렌더러의 브러시 도구는 아니다.
- 색 선택 전에 선택 영역이 있으면 적용해야 한다.

그런데 이 정책이 한 곳에 있지 않고 여러 파일의 조건문으로 퍼졌다. 그래서 한 조건을 고치면 다른 표시 조건을 또 찾아야 했다.

## 목표

도구 추가 시 기본적으로 수정해야 하는 파일을 다음 수준으로 줄이는 것이 목표다.

1. 도구 구현 파일
2. 도구 정의 파일
3. 필요하면 번역 파일
4. 필요하면 렌더러 API 파일

UI 배치, 커서, 이벤트 우선순위, 리사이즈 가능 여부, 단축키 같은 것은 "도구 정의"에서 읽어 자동으로 동작해야 한다.

## 개선 방향

### 1. 도구 정의를 단일 소스로 만든다

현재 `toolRegistry`는 도구 객체 등록에 가깝다. 여기에 도구 정책을 더 명확히 담아야 한다.

예시:

```ts
export const toolDefinitions = {
  brush: {
    id: "brush",
    labelKey: "brush",
    icon: BrushIcon,
    kind: "core",
    coreTool: "brush",
    placement: "main",
    shortcut: "KeyB",
    cursorClass: "brush",
    allowCanvasResizeHandle: true,
    tool: new BrushTool(),
  },
  colorPicker: {
    id: "colorPicker",
    labelKey: "color_picker",
    icon: Pipette,
    kind: "transient",
    placement: "mini",
    shortcut: "KeyC",
    cursorClass: "colorPicker",
    allowCanvasResizeHandle: false,
    appliesSelectionOnEnter: true,
    restoreSelectedToolOnPointerUp: true,
    tool: new ColorPickerTool(),
  },
};
```

이렇게 하면 새 도구 추가 시 "어디에 버튼을 넣을지", "단축키가 뭔지", "커서가 뭔지", "리사이즈 핸들을 허용하는지"가 한 곳에 들어간다.

### 2. UI는 도구 정의를 렌더링한다

현재 앱바는 각 버튼 컴포넌트를 직접 나열한다. 도구가 늘면 데스크톱과 모바일 파일을 모두 고쳐야 한다.

대신 도구 정의의 `placement`를 기준으로 버튼을 렌더링한다.

```ts
const miniTools = getToolsByPlacement("mini");

return (
  <div className="mini-buttons">
    {miniTools.map((tool) => (
      <ToolButton key={tool.id} tool={tool} />
    ))}
  </div>
);
```

데스크톱과 모바일은 레이아웃만 다르고 버튼의 선택 상태, aria-label, icon color, onClick 규칙은 공통 `ToolButton`으로 빼는 것이 좋다.

그러면 새 도구를 추가할 때 `AppBarDesktop.tsx`, `AppbarMobile.tsx`를 직접 수정하지 않아도 된다.

### 3. 도구 전환 정책을 공통화한다

현재 `draw.ts`의 `toolManager`는 도구별 함수가 늘어나는 구조다.

```ts
setBrushTool()
setEraserTool()
setLiquifyTool()
setSelectTool()
setZoomTool()
setColorPickerTool()
```

도구가 추가될수록 여기에도 함수가 계속 생긴다. 대신 `activateTool(toolId)` 하나로 모으는 방향이 좋다.

```ts
function activateTool(toolId: ToolId) {
  const definition = getToolDefinition(toolId);

  if (paintState.pointerdown) return;
  if (definition.appliesSelectionOnEnter) applySelection();
  if (definition.kind === "core") setCoreTool(definition.coreTool);
  if (definition.kind === "viewport") paintState.setInputMode(definition.inputMode);
  if (definition.kind === "transient") paintState.setInputMode(definition.inputMode);

  updateSelectedToolIfNeeded(definition);
  syncCoreState();
}
```

개별 도구의 특수 처리는 메타데이터나 hook으로 제한한다.

```ts
onBeforeEnter?: () => boolean;
onAfterExit?: () => void;
```

단, hook을 남발하면 다시 분산되므로 기본 정책으로 해결하지 못하는 경우에만 사용한다.

### 4. 임시 도구를 명시적인 개념으로 만든다

돋보기의 Z 키, 색 선택의 C 키처럼 "누르는 동안만 활성화되는 도구"가 있다. 또 버튼으로 들어갔다가 포인터 up 후 돌아오는 도구도 있다.

이런 도구는 `selectedToolId`와 섞지 않는 것이 좋다.

```ts
type InputMode =
  | { kind: "normal" }
  | { kind: "pan" }
  | { kind: "zoom"; source: "button" | "keyboard" }
  | { kind: "colorPicker"; source: "button" | "keyboard" }
  | { kind: "pinch" };
```

현재처럼 문자열 union으로 유지하더라도, 최소한 `source`와 복귀 정책은 공통화해야 한다.

```ts
temporaryActivation: {
  inputMode: "COLOR_PICKER",
  keyboardSource: "KeyC",
  restoreOnKeyUp: true,
  restoreOnPointerUp: true,
}
```

### 5. 이벤트 우선순위를 도구 정책에서 읽는다

지금은 `pointerEvents.ts`가 PAN, resizeTool, active tool 순서로 직접 분기한다. 도구가 많아지면 예외가 늘어난다.

도구 정의에 입력 정책을 둔다.

```ts
inputPolicy: {
  allowCanvasResizeHandle: false,
  capturePointerOutsideCanvas: false,
  sampleOnDrag: true,
}
```

그리고 이벤트 시스템은 현재 active tool의 정책만 읽는다.

```ts
const tool = getActiveToolDefinition();

if (tool.inputPolicy.allowCanvasResizeHandle && resizeTool.canStart(e)) {
  ...
}

tool.instance[phase]?.(e);
```

UI 표시도 같은 정책을 사용해야 한다. "보이는데 동작하지 않음" 또는 "동작하는데 보이지 않음" 같은 버그를 줄일 수 있다.

### 6. 단축키도 도구 정의에서 만든다

현재 단축키는 `keyboardEvent.ts`에 하드코딩되어 있다.

```ts
if (event.code === "KeyB") toolManager.setBrushTool();
if (event.code === "KeyE") toolManager.setEraserTool();
```

도구 정의에 단축키를 넣으면 새 도구 추가 시 키보드 파일을 수정하지 않아도 된다.

```ts
shortcut: {
  code: "KeyC",
  mode: "hold",
}
```

`mode: "select"`는 누르면 도구 선택, `mode: "hold"`는 누르는 동안 임시 활성화로 처리한다.

### 7. 번역과 아이콘은 도구 정의가 참조만 한다

번역 파일 자체는 언어별 텍스트 때문에 수정이 필요할 수 있다. 하지만 UI 컴포넌트가 직접 `getLetter("color_picker")`를 알 필요는 없다.

도구 정의에 `labelKey`를 두고 공통 버튼이 처리한다.

```ts
<button aria-label={getLetter(tool.labelKey)}>
  <tool.Icon />
</button>
```

이렇게 하면 UI 파일은 새 도구의 번역 키를 몰라도 된다.

## 단계적 리팩터링 계획

### 1단계: 도구 정의 확장

현재 `toolMetadata`를 `toolDefinitions`로 확장한다. 아직 UI 자동 렌더링까지 가지 않고, 먼저 기존 조건문이 참조하는 값을 메타데이터로 옮긴다.

- `labelKey`
- `placement`
- `shortcut`
- `cursorClass`
- `allowCanvasResizeHandle`
- `kind`
- `coreTool`
- `inputMode`

### 2단계: 공통 ToolButton 만들기

데스크톱/모바일에서 중복되는 버튼 선택 상태, aria-label, icon 색상 로직을 공통 컴포넌트로 뺀다.

이 단계가 끝나면 새 도구 버튼 추가 때문에 앱바 파일을 직접 수정하는 일이 줄어든다.

### 3단계: 앱바를 도구 정의 기반으로 렌더링

`placement: "main" | "mini" | "mobileTools"` 같은 값을 기준으로 도구 버튼 목록을 만든다.

데스크톱과 모바일은 배치만 담당하고, 어떤 도구가 들어가는지는 정의 파일이 담당한다.

### 4단계: `toolManager.activateTool(toolId)` 도입

개별 `setBrushTool`, `setEraserTool` 함수는 일단 남기더라도 내부에서 `activateTool()`을 호출하게 만든다.

기존 호출부를 한 번에 다 바꾸지 않고 점진적으로 옮긴다.

### 5단계: 임시 도구 처리 공통화

`COLOR_PICKER`, `ZOOM`, `PAN` 같은 임시 모드를 공통 구조로 정리한다.

- 버튼으로 켠 임시 도구
- 키를 누르는 동안 켠 임시 도구
- 포인터 up 후 복귀
- 키 up 후 복귀

이 정책을 도구 정의에서 읽게 만들면 색 선택 도구 내부의 복귀 코드도 줄일 수 있다.

### 6단계: 상태 조합 테스트 추가

도구 정의가 생기면 UI 테스트보다 낮은 레벨에서 정책 테스트를 만들 수 있다.

예:

```ts
expect(getToolDefinition("colorPicker").allowCanvasResizeHandle).toBe(false);
expect(getActiveTool({ inputMode: "COLOR_PICKER" })).toBe("colorPicker");
expect(restoreAfterTemporaryTool({ selectedToolId: "brush" })).toBe("brush");
```

이 테스트는 도구가 늘어날수록 효과가 커진다.

## 기대 효과

개선 후 새 도구 추가 작업은 대략 이렇게 줄어든다.

현재:

- 도구 파일 추가
- `paintState` 타입 수정
- `toolRegistry` 수정
- `draw.ts` 수정
- `pointerEvents.ts` 수정 가능
- `resizeTool.ts` 수정 가능
- `view.ts` 수정 가능
- 데스크톱 앱바 수정
- 모바일 앱바 수정
- 키보드 이벤트 수정
- 번역 수정

개선 후:

- 도구 파일 추가
- `toolDefinitions`에 정의 추가
- 번역 추가
- 렌더러 API가 필요한 경우만 코어 수정

분기가 없어지는 것은 아니다. 좋은 UX를 만들면 분기는 반드시 생긴다. 하지만 분기가 여러 파일의 조건문으로 흩어지는 대신, 도구 정의라는 한 곳에 모이면 수정 비용과 버그 가능성이 크게 줄어든다.
