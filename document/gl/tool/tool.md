# 🛠️ Tool 시스템 구조 완전 정복 (히스토리 작업용 이해 문서)

이 문서는 브러시, 지우개, 유동화 도구(Liquify)의 공통 Tool 인터페이스 구조를 기반으로  
**히스토리 기능 개발자**가 구조를 정확하게 이해하고,  
**기능을 확장하거나 히스토리와 연결할 수 있도록** 하기 위한 설명입니다.

---

## 📌 전체 구조 한눈에 보기

```ts
Tool {
  enter()
  start(pointer)
  stroke(p1, p2)
  end()
  cancel()
  exit()
}
```

- 이 인터페이스는 **사용자의 입력 흐름에 따라 도구를 추상화**한 구조입니다.
- 각각의 도구(`BrushTool`, `EraserTool`, `LiquifyTool`)는 이 인터페이스를 구현하며, 내부적으로는 전용 매니저(Manager)를 호출합니다.
- **매니저가 실제 기능을 수행하고**, Tool 클래스는 그 **중간 추상화 계층** 역할을 합니다.

---

## 🧱 Tool 인터페이스 메서드 역할

| 메서드 | 설명 |
|--------|------|
| `enter()` | 도구가 선택될 때 실행됨 (선택 효과 or 초기화) |
| `start(pointer)` | 입력이 시작되었을 때 (ex. 마우스 다운) |
| `stroke(p1, p2)` | 사용자가 드래그하는 동안 반복적으로 호출됨 |
| `end()` | 입력이 끝났을 때 (ex. 마우스 업) |
| `cancel()` | 작업을 취소했을 때 (히스토리 복원 등) |
| `exit()` | 도구가 다른 도구로 전환될 때 (정리 작업 등) |

---

## 🖌️ BrushTool / EraserTool

이 두 도구는 **동일한 매니저(`drawManager`)**를 사용합니다.  
차이점은 `stroke()` 내에서 호출하는 함수만 다릅니다:

```ts
// 브러시 도구
this.drawManager.stroke(p1, p2);
this.drawManager.brush(); // 알파맵 기반으로 색상 적용

// 지우개 도구
this.drawManager.stroke(p1, p2);
this.drawManager.eraser(); // 알파맵 기반으로 지우기
```

- **stroke()**는 항상 알파맵을 업데이트하고,
- 이후 **brush() or eraser()**에서 해당 알파맵을 실제 이미지에 반영합니다.
- `drawManager`는 이미 `pathTex`, `brushShader`, `eraserShader` 등을 내부에 포함하고 있음.

---

## 🌊 LiquifyTool

LiquifyTool은 완전히 별도의 시스템으로 작동하며,  
**변위맵 기반의 유동화 편집 기능**을 수행합니다.

```ts
this.liquifyManager.push(p1, p2);   // 변위맵 업데이트
this.liquifyManager.render();       // 화면에 결과 반영
```

- 변위맵(`displacementTex`)에 사용자 입력을 누적하고,
- `render()`에서 그 결과를 레이어에 적용합니다.

---

## 🧩 installTools(canvas, gl)

```ts
await installBrushManager(canvas, gl);
await installLiquifyManager(canvas, gl);
```

- **초기화 단계에서 한 번만 호출**하여 각 도구의 매니저들을 등록해줍니다.
- 내부적으로 `Map<gl, manager>` 형태로 저장됨 (싱글톤 패턴)

---

## 🧠 히스토리 기능 연결 포인트

### 🔹 BrushTool / EraserTool

- `end()` 직전에 레이어 상태를 저장
- `cancel()`에서 `drawManager.cancel()`을 호출하면 이미지 복원됨

### 🔹 LiquifyTool

- `end()` → 변위맵을 `sourceDisplacementTex`에 저장 (`transfer()`)
- `cancel()` → 이전 변위맵 복원 후 `render()`

---

## ✅ 히스토리 구현자가 반드시 기억해야 할 흐름

```
[User Stroke Input]
  → tool.stroke()
      → 내부적으로 manager.stroke() + brush/eraser/render()
  → tool.end()
      → manager.end() → 히스토리 저장 포인트
  → tool.cancel()
      → manager.cancel() → 히스토리 복구
```

---

## ✨ 요약

- 이 코드는 다양한 편집 도구를 공통 인터페이스로 묶어 **도구 교체 및 처리 흐름을 통일**시킴
- 각각의 도구는 **stroke() → render() → end()** 사이클로 동작
- 히스토리는 각 도구의 **manager.end() / manager.cancel()** 호출 타이밍에서 상태를 저장/복구하면 됨
- 따라서, **히스토리 기능은 도구마다 따로 만들지 않고**, Tool 구조만 잘 이해하면 공통으로 처리 가능

🎉 이제 이 구조만 이해하면, 어떤 도구든 히스토리 저장/복구 기능을 완벽하게 연결할 수 있습니다!
