import liquifyPush from "./liquifyPush.frag?raw";
const _xorKey = 73;

export function getShaderSource(): string {
  return liquifyPush;
  // return String.fromCharCode(
  //   ..._shaderData.map((c, i) => c ^ (_xorKey + (i % 5)))
  // );
}
