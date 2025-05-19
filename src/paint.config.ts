export enum Resolution {
  _2K = 2048, // 4.2MP
  _4K = 4096, // 16.7MP
  _6K = 6144, // 37.7MP
  _8K = 8192, // 67.1MP
}
// HD (720p):     1280 x 720       ≈ 0.9MP
// FHD (1080p):   1920 x 1080      ≈ 2.1MP
// QHD (1440p):   2560 x 1440      ≈ 3.7MP
// 4K UHD:        3840 x 2160      ≈ 8.3MP
// 6K:            6144 x 3160      ≈ 19.4MP
// 8K UHD:        7680 x 4320      ≈ 33.2MP
// 8K DCI:        8192 x 4320      ≈ 35.4MP
export const paintConfig = {
  maxSize: Resolution._4K,
};
