import { readFileSync, writeFileSync } from "fs";
import path from "path";

function merge(files: string[], outFile: string) {
  const rootDir = __dirname; // merge.ts가 있는 폴더
  const contents = files
    .map((relativePath) => {
      const fullPath = path.resolve(rootDir, relativePath); // ./src/a.ts 같은 상대경로 → 절대경로
      return readFileSync(fullPath, "utf-8");
    })
    .join("\n\n");

  writeFileSync(path.resolve(rootDir, outFile), contents, "utf-8");
}

// 예시
const list = [
  "src/draw.ts",
  "src/elements.ts",
  "src/file.ts",
  "src/interaction.ts",
  "src/main.ts",
  "src/position.ts",
  "src/selection.ts",
  "src/view.ts",
];
merge(list, "out.ts");
