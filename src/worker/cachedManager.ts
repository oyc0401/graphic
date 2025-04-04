// cachedManager.ts
// gl, key 두 개의 키로부터 싱글톤(캐싱)된 매니저를 얻는 함수

// 1) gl(WeakMap의 key가 될 만한 객체)
// 2) key(문자열)
// 3) creator() (리소스를 새로 만들 때 호출)

// 내부적으로:
// WeakMap<object, Map<string, any>>
//   -> object: gl
//   -> Map<string, any>: key별로 값 저장

const managerStore = new WeakMap<object, Map<string, unknown>>();

export function getManager<T>(
  gl: object,
  key: string,
  creator: () => T
): T {
  // gl에 해당하는 Map 가져오기
  let subMap = managerStore.get(gl);
  if (!subMap) {
    // 처음 보는 gl이면 새 Map 생성 후 등록
    subMap = new Map<string, unknown>();
    managerStore.set(gl, subMap);
  }

  // key에 해당하는 값이 없으면 새로 만들어 등록
  if (!subMap.has(key)) {
    const newValue = creator();
    subMap.set(key, newValue);
  }

  // 값 반환 (타입 보장을 위해 as T)
  return subMap.get(key) as T;
}