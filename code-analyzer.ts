#!/usr/bin/env tsx

/**
 * SwipeBrick 코드 분석기
 *
 * 실행법:
 *   npx tsx code-analyzer.ts              # 기본 분석
 *   npx tsx code-analyzer.ts --verbose    # 상세 분석 (파일별 정보 포함)
 *   npx tsx code-analyzer.ts -v           # 상세 분석 (단축형)
 *   npx tsx code-analyzer.ts --json       # JSON 파일로 결과 저장
 *   npx tsx code-analyzer.ts --help       # 도움말
 *
 * 기능:
 *   - src 폴더 내 모든 .ts, .tsx, .js, .jsx 파일 분석
 *   - 폴더별/파일별 줄 수, 글자 수, 파일 크기 계산
 *   - 동적 폴더 감지 (새 폴더/파일 자동 인식)
 *   - 확장자 추가 가능한 확장성 설계
 */
import * as fs from "fs";
import * as path from "path";

interface FileStats {
  path: string;
  lines: number;
  characters: number;
  size: number; // bytes
}

interface FolderStats {
  name: string;
  files: FileStats[];
  totalLines: number;
  totalCharacters: number;
  totalSize: number;
  fileCount: number;
}

interface AnalysisResult {
  folders: FolderStats[];
  grandTotal: {
    lines: number;
    characters: number;
    size: number;
    files: number;
  };
}

class CodeAnalyzer {
  private readonly srcPath: string;
  private readonly excludeDirs = ["node_modules", "dist", "build", ".git"];
  private readonly extensions: string[];

  constructor(srcPath: string = "./src", extensions: string[] = [".ts", ".tsx", ".js", ".jsx", ".frag"]) {
    this.srcPath = path.resolve(srcPath);
    this.extensions = extensions;
  }

  public analyze(): AnalysisResult {
    console.log(`🔍 Analyzing code in: ${this.srcPath}`);
    console.log(`📁 Target extensions: ${this.extensions.join(", ")}\n`);

    const folders = this.scanDirectory(this.srcPath);
    const grandTotal = this.calculateGrandTotal(folders);

    return { folders, grandTotal };
  }

  private scanDirectory(dirPath: string, relativePath: string = ""): FolderStats[] {
    const results: FolderStats[] = [];

    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      const files: FileStats[] = [];

      // 현재 폴더의 파일들 처리
      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isFile() && this.isTargetFile(item.name)) {
          const fileStats = this.analyzeFile(itemPath, path.join(relativePath, item.name));
          if (fileStats) {
            files.push(fileStats);
          }
        }
      }

      // 현재 폴더가 파일을 가지고 있으면 결과에 추가
      if (files.length > 0) {
        const folderName = relativePath || "root";
        const folderStats: FolderStats = {
          name: folderName,
          files: files.sort((a, b) => a.path.localeCompare(b.path)),
          totalLines: files.reduce((sum, f) => sum + f.lines, 0),
          totalCharacters: files.reduce((sum, f) => sum + f.characters, 0),
          totalSize: files.reduce((sum, f) => sum + f.size, 0),
          fileCount: files.length,
        };
        results.push(folderStats);
      }

      // 하위 폴더들 재귀 처리
      for (const item of items) {
        if (item.isDirectory() && !item.name.startsWith(".")) {
          const subDirPath = path.join(dirPath, item.name);
          const subRelativePath = path.join(relativePath, item.name);
          const subResults = this.scanDirectory(subDirPath, subRelativePath);
          results.push(...subResults);
        }
      }
    } catch (error) {
      console.error(`❌ Error reading directory ${dirPath}:`, error);
    }

    return results;
  }

  private isTargetFile(filename: string): boolean {
    return this.extensions.some((ext) => filename.endsWith(ext));
  }

  private analyzeFile(filePath: string, relativePath: string): FileStats | null {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stats = fs.statSync(filePath);

      const lines = content.split("\n").length;
      const characters = content.length;

      return {
        path: relativePath,
        lines,
        characters,
        size: stats.size,
      };
    } catch (error) {
      console.error(`❌ Error reading file ${filePath}:`, error);
      return null;
    }
  }

  private calculateGrandTotal(folders: FolderStats[]) {
    return {
      lines: folders.reduce((sum, folder) => sum + folder.totalLines, 0),
      characters: folders.reduce((sum, folder) => sum + folder.totalCharacters, 0),
      size: folders.reduce((sum, folder) => sum + folder.totalSize, 0),
      files: folders.reduce((sum, folder) => sum + folder.fileCount, 0),
    };
  }

  public printResults(result: AnalysisResult): void {
    console.log("📊 Code Analysis Results");
    console.log("=".repeat(80));

    // 폴더별 상세 결과
    for (const folder of result.folders) {
      console.log(`\n📁 ${folder.name}`);
      console.log(
        `   Files: ${
          folder.fileCount
        } | Lines: ${folder.totalLines.toLocaleString()} | Characters: ${folder.totalCharacters.toLocaleString()} | Size: ${this.formatBytes(
          folder.totalSize,
        )}`,
      );

      // 파일별 상세 (옵션)
      if (process.argv.includes("--verbose") || process.argv.includes("-v")) {
        for (const file of folder.files) {
          console.log(
            `   └── ${file.path.split("/").pop()}: ${file.lines} lines, ${file.characters.toLocaleString()} chars`,
          );
        }
      }
    }

    // 총합
    console.log("\n" + "=".repeat(80));
    console.log("🎯 GRAND TOTAL");
    console.log(`📄 Files: ${result.grandTotal.files}`);
    console.log(`📝 Lines: ${result.grandTotal.lines.toLocaleString()}`);
    console.log(`🔤 Characters: ${result.grandTotal.characters.toLocaleString()}`);
    console.log(`💾 Size: ${this.formatBytes(result.grandTotal.size)}`);
    console.log("=".repeat(80));

    // 폴더별 요약 (크기 순)
    console.log("\n📈 Folder Summary (by lines)");
    const sortedFolders = [...result.folders].sort((a, b) => b.totalLines - a.totalLines);
    for (const folder of sortedFolders) {
      const percentage = ((folder.totalLines / result.grandTotal.lines) * 100).toFixed(1);
      console.log(`${folder.name.padEnd(20)} ${folder.totalLines.toString().padStart(6)} lines (${percentage}%)`);
    }

    // 폴더 구조 출력
    console.log("\n🗂️  Project Structure");
    console.log("=".repeat(80));
    console.log(this.generateFolderStructure());
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  private generateFolderStructure(): string {
    const result: string[] = [];

    const buildTree = (dirPath: string, prefix: string = ""): void => {
      try {
        const items = fs
          .readdirSync(dirPath)
          .filter((item) => !item.startsWith(".") && !this.excludeDirs.includes(item))
          .sort((a, b) => {
            const aPath = path.join(dirPath, a);
            const bPath = path.join(dirPath, b);
            const aIsDir = fs.statSync(aPath).isDirectory();
            const bIsDir = fs.statSync(bPath).isDirectory();

            if (aIsDir === bIsDir) {
              return a.localeCompare(b);
            }
            return aIsDir ? -1 : 1;
          });

        items.forEach((item, index) => {
          const itemPath = path.join(dirPath, item);
          const isLast = index === items.length - 1;
          const isDirectory = fs.statSync(itemPath).isDirectory();

          const connector = isLast ? "└── " : "├── ";
          const extension = prefix + connector + item;

          result.push(extension);

          if (isDirectory) {
            const newPrefix = prefix + (isLast ? "    " : "│   ");
            buildTree(itemPath, newPrefix);
          }
        });
      } catch (error) {
        // 디렉토리 읽기 실패 시 무시
      }
    };

    result.push("src/");
    buildTree("./src", "");

    return result.join("\n");
  }
}

// CLI 실행
function main() {
  const args = process.argv.slice(2);

  // 도움말
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
📊 Code Analyzer - SwipeBrick Project

Usage:
  tsx code-analyzer.ts [options]

Options:
  -v, --verbose     Show detailed file-by-file breakdown
  -h, --help        Show this help message

Examples:
  tsx code-analyzer.ts              # Basic analysis
  tsx code-analyzer.ts --verbose    # Detailed analysis
  tsx code-analyzer.ts -v           # Detailed analysis (short)
`);
    return;
  }

  // 분석 실행
  const analyzer = new CodeAnalyzer();
  const result = analyzer.analyze();
  analyzer.printResults(result);

  // JSON 출력 옵션
  if (args.includes("--json")) {
    const jsonOutput = JSON.stringify(result, null, 2);
    fs.writeFileSync("code-analysis.json", jsonOutput);
    console.log("\n💾 Results saved to code-analysis.json");
  }
}

// 스크립트로 직접 실행될 때만 main 함수 호출
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { CodeAnalyzer, type AnalysisResult, type FileStats, type FolderStats };
