# Pixel Liquify LUT

painton.app의 픽셀 유동화 push 도구는 브러시가 지나간 경로를 매 프레임 직접 적분하지 않고, 미리 계산한 lookup texture를 사용합니다.

## 문제

픽셀 유동화는 변위맵을 수정해 이미지를 변형합니다.

```text
source image + displacement map -> warped image
```

단순한 구현은 브러시 중심이 선분을 따라 이동하는 과정을 작은 step으로 나누고, 각 step이 주변 픽셀에 주는 힘을 모두 누적합니다.

```text
value(P) = sum K(distance(P, C_i) / radius)
```

이 방식은 코너 뭉침 문제를 줄일 수 있지만, 브러시 반경이 커질수록 비용이 커집니다. 한 step에서 영향을 받는 픽셀 수는 대략 `pi * radius^2`이고, 선분 길이에 비례해 step 수가 늘어납니다.

```text
cost = O(length * radius^2)
```

큰 사진에서 얼굴 윤곽이나 몸 라인을 보정하려면 브러시 반경이 수백~수천 픽셀까지 커질 수 있습니다. 이 경우 드래그 중 모든 step을 직접 계산하는 방식은 브라우저에서 감당하기 어렵습니다.

## 핵심 아이디어

GPU fragment shader는 각 픽셀이 독립적으로 실행됩니다. 드래그 중 셰이더 안에서 긴 루프를 돌리는 대신, 적분 결과를 lookup texture로 바꿉니다.

긴 선분 중앙부를 보면, 픽셀이 받는 누적값은 선분 방향 위치가 아니라 선분 중심축까지의 수직 거리 하나로 결정됩니다.

```text
X = perpendicularDistance / radius
```

이때 최종 단면 `S(X)`는 순간 브러시 커널 `K(r)`를 선분 방향으로 적분한 값입니다.

```text
S(X) = integral K(sqrt(X^2 + u^2)) du
```

즉, 런타임에 적분하지 않고 `S` 또는 그 primitive를 미리 계산해 텍스처로 올릴 수 있습니다.

## 끝점을 정확히 처리하기

실제 stroke segment는 무한히 길지 않습니다. 선분 양 끝에서 잘려나가는 부피까지 처리해야 합니다.

그래서 1D profile만 쓰지 않고, 다음 2D primitive를 만듭니다.

```text
P(U, X) = integral(0..U) K(sqrt(X^2 + u^2)) du
```

- `X`: 선분 중심선까지의 정규화된 수직 거리
- `U`: 선분 방향의 정규화된 거리

이 값을 `R32F` 2D texture로 업로드합니다.

## 셰이더에서의 계산

픽셀에서 선분까지의 위치를 구합니다.

```glsl
vec2 segment = end - start;
float len = length(segment);
vec2 dir = segment / len;

vec2 local = pixel - start;
float along = dot(local, dir);
float perpendicular = abs(cross(local, dir));
float X = perpendicular / radius;
```

선분의 시작/끝을 픽셀 기준 signed coordinate로 바꿉니다.

```glsl
float z0 = -along / radius;
float z1 = (len - along) / radius;
```

signed primitive 차이를 사용하면 몸통과 양 끝 cap을 같은 식으로 처리할 수 있습니다.

```glsl
float primitiveSigned(float z, float X) {
  float signValue = z < 0.0 ? -1.0 : 1.0;
  float U = clamp(abs(z), 0.0, 1.0);
  return signValue * texture(u_primitive, vec2(U, X)).r;
}

float power = primitiveSigned(z1, X) - primitiveSigned(z0, X);
```

긴 선분 중앙에서는 `z0 <= -1`, `z1 >= 1`이므로 다음과 같습니다.

```text
power = P(1, X) - (-P(1, X)) = 2P(1, X)
```

이 값이 최종 단면입니다.

## 목표 단면에서 커널 구하기

사용자가 보는 것은 순간 커널 `K`가 아니라 stroke가 지나간 뒤의 최종 단면 `S`입니다. 그래서 painton.app은 목표 단면을 먼저 정하고, 이를 만드는 `K`를 역으로 풉니다.

현재 목표 단면은 `easeInOutSine(1 - X)`입니다.

```ts
function easeInOutSine(x: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return -(Math.cos(Math.PI * x) - 1) / 2;
}
```

적분 행렬 `A`를 만들면 forward 관계는 다음과 같습니다.

```text
S = A K
```

여기서 목표 `S_target`이 주어졌을 때, 정규화된 least squares 문제를 풀어 `K`를 구합니다.

```text
min ||A K - S_target||^2 + lambda ||D K||^2
```

normal equation:

```text
(A^T A + lambda D^T D + epsilon I) K = A^T S_target
```

현재 구현은 부분 피벗 Gaussian elimination으로 이 선형 시스템을 풀고, 구한 `K`로 2D primitive texture를 생성합니다.

## 현재 파라미터

```ts
const KERNEL_SIZE = 256;
const PRIMITIVE_U_SIZE = 512;
const PRIMITIVE_X_SIZE = 512;

const SOLVE_SIZE = 256;
const SOLVE_U_SAMPLES = 768;
const SOLVE_SMOOTHNESS = 0.0002;
const SOLVE_CENTER_WEIGHT = 0;
const SOLVE_DIAGONAL_EPSILON = 1e-8;
```

## 비용 구조

```text
A 생성:             O(N * Q)
K solve:            O(N^3)
2D LUT 생성:        O(Nu * Nx)
드래그 중 셰이더:   O(1), lookup 몇 번
```

중요한 점은 드래그 중 픽셀당 비용입니다. 커널과 primitive texture를 만든 뒤에는 브러시 반경이 커져도 셰이더가 수행하는 일은 선분 투영, lookup, 변위맵 샘플링으로 제한됩니다.

## 구현 위치

- lookup 생성: `src/core/webgl2/gl/tool/liquify/liquifyModule/displacementModule/liquifyLookup.ts`
- push shader: `src/core/webgl2/gl/tool/liquify/liquifyModule/displacementModule/push.frag`
- displacement texture upload: `src/core/webgl2/gl/tool/liquify/liquifyModule/displacementModule/index.ts`
