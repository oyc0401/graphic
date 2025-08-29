// 문자열 키로만 관리하는 캐시 매니저
// 1) key(문자열)
// 2) creator() (리소스를 새로 만들 때 호출)

const managerStore = new Map<string, unknown>();

export function getManager<T>(gl, key: string, creator: () => T): T {
  // key에 해당하는 값이 없으면 새로 만들어 등록
  if (!managerStore.has(key)) {
    const newValue = creator();
    managerStore.set(key, newValue);
  }

  // 값 반환 (타입 보장을 위해 as T)
  return managerStore.get(key) as T;
}
