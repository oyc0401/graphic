# WebGL Module Development

WebGL 저수준 모듈은 `README.ts`를 먼저 쓴다.

TDD 흉내 내지 말고 계약을 먼저 고정한다.

## README.ts

`README.ts`는 사용 예제가 아니라 원본 계약이다.

여기에는 caller가 알아야 하는 것만 쓴다.

- 어떤 texture를 넘기는지
- 어떤 texture를 읽는지
- 어떤 texture를 수정하는지
- 어떤 rect를 반환하는지
- 반환한 rect를 caller가 어디에 쓰는지
- 언제 preview고 언제 apply인지
- 끝나고 caller가 뭘 정리해야 하는지

내부 shader 구조, private state, 최적화 방식은 쓰지 않는다.

## 구현 순서

1. `README.ts`에 외부 호출 흐름을 코드로 쓴다.
2. texture 소유권을 주석으로 적는다.
3. public method의 side effect를 적는다.
4. 그 계약에 맞춰 모듈을 구현한다.
5. `example.html`은 모듈 계약만 확인하는 최소 기능으로 둔다.

구현이 더러워지면 `README.ts`를 원본으로 보고 다시 쓴다.

## 테스트

WebGL 모듈에 구현을 따라가는 테스트를 억지로 만들지 않는다.

테스트하기 좋은 순수 계산만 테스트한다.

- rect 계산
- clamp
- 좌표 변환
- union

texture 결과, GL state, shader 내부 구조를 단위 테스트로 고정하지 않는다.

## 금지

- 앱 state를 모듈 안으로 끌고 오지 않는다.
- 다른 tool/module을 import하지 않는다.
- caller가 소유한 texture unit enum에 의존하지 않는다.
- public API를 README.ts 없이 먼저 만들지 않는다.
- README.ts보다 구현을 더 믿지 않는다.

## 좋은 모듈

좋은 모듈은 알아서 다 하지 않는다.

입력 texture를 읽고, 자기 책임 texture를 수정하고, caller가 쓸 rect를 돌려준다.

history, app render, tool state는 caller 책임이다.
