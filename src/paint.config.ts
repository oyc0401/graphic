export enum Resolution {
  _2K = 2048, // 4.2MP
  _4K = 4096, // 16.7MP
  _6K = 6144, // 37.7MP
  _8K = 8192, // 67.1MP
}

export enum Platform {
  PC = "pc",
  iOS = "ios",
  Android = "android",
}

// HD (720p):     1280 x 720       ≈ 0.9MP
// FHD (1080p):   1920 x 1080      ≈ 2.1MP
// QHD (1440p):   2560 x 1440      ≈ 3.7MP
// 4K UHD:        3840 x 2160      ≈ 8.3MP
// 6K:            6144 x 3160      ≈ 19.4MP
// 8K UHD:        7680 x 4320      ≈ 33.2MP
// 8K DCI:        8192 x 4320      ≈ 35.4MP

interface PlatformConfig {
  maxSize: Resolution;
  undoByteMultiplier: number; // 기본 4096*4096*4에 곱할 배수
  maxHistoryItems: number;
  description: string;
}

const platformConfigs: Record<Platform, PlatformConfig> = {
  [Platform.PC]: {
    maxSize: Resolution._6K,
    undoByteMultiplier: 30, // 높은 메모리 사용 가능
    maxHistoryItems: 50,
    description: "High-performance desktop configuration",
  },
  [Platform.iOS]: {
    maxSize: Resolution._4K,
    undoByteMultiplier: 15, // 중간 메모리 사용
    maxHistoryItems: 30,
    description: "iOS optimized configuration",
  },
  [Platform.Android]: {
    maxSize: Resolution._4K,
    undoByteMultiplier: 15,
    maxHistoryItems: 30,
    description: "Android optimized configuration",
  },
};

// 플랫폼 자동 감지
function detectPlatform(): Platform {
  if (typeof window === "undefined") return Platform.PC;

  const userAgent = navigator.userAgent;

  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return Platform.iOS;
  }

  if (/Android/.test(userAgent)) {
    return Platform.Android;
  }

  return Platform.PC;
}

// 현재 플랫폼 설정
const currentPlatform = detectPlatform();
const currentConfig = platformConfigs[currentPlatform];

export const paintConfig = {
  platform: currentPlatform,
  maxSize: currentConfig.maxSize,
  maxHistoryItems: currentConfig.maxHistoryItems,
  description: currentConfig.description,
};

export function getUndoByte(): number {
  return 4096 * 4096 * 4 * currentConfig.undoByteMultiplier;
}

export function getPlatformConfig(platform?: Platform): PlatformConfig {
  return platformConfigs[platform || currentPlatform];
}

export function setPlatform(platform: Platform): void {
  const config = platformConfigs[platform];
  paintConfig.platform = platform;
  paintConfig.maxSize = config.maxSize;
  paintConfig.maxHistoryItems = config.maxHistoryItems;
  paintConfig.description = config.description;
}

// GPU 정보 가져오기
function getGPUInfo(): { maxTextureSize: number; renderer: string; vendor: string } | null {
  if (typeof window === "undefined") return null;

  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');

    if (!gl) return null;

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    // GPU 정보 (보안 제한으로 인해 제한적)
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    let renderer = 'Unknown';
    let vendor = 'Unknown';

    if (debugInfo) {
      renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown';
      vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown';
    }

    return { maxTextureSize, renderer, vendor };
  } catch (error) {
    console.warn('GPU 정보를 가져올 수 없습니다:', error);
    return null;
  }
}

// 기기 정보 및 설정 출력 (한 번만)
function logDeviceInfo(): void {
  const userAgent =
    typeof window !== "undefined" ? navigator.userAgent : "Server";
  const undoBytes = getUndoByte();
  const undoMB = (undoBytes / (1024 * 1024)).toFixed(2);
  const gpuInfo = getGPUInfo();

  console.group("🎨 Paint App Configuration");
  console.log("📱 Platform:", paintConfig.platform.toUpperCase());
  console.log("🖥️ User Agent:", userAgent);
  console.log(
    "📏 Max Canvas Size:",
    `${paintConfig.maxSize}x${paintConfig.maxSize}px`,
  );
  console.log("📝 Max History Items:", paintConfig.maxHistoryItems);
  console.log("💾 Undo Memory Limit:", `${undoMB} MB`);
  console.log("📋 Description:", paintConfig.description);

  if (gpuInfo) {
    console.group("🎮 GPU Information");
    console.log("🖼️ Max Texture Size:", `${gpuInfo.maxTextureSize}x${gpuInfo.maxTextureSize}px`);
    console.log("🔧 GPU Vendor:", gpuInfo.vendor);
    console.log("💻 GPU Renderer:", gpuInfo.renderer);
    console.groupEnd();
  }

  console.groupEnd();
}

// 앱 시작 시 한 번만 출력
if (typeof window !== "undefined") {
  logDeviceInfo();
}
