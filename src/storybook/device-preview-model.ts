export const mobileViewport = { label: 'iPhone 15', width: 393, height: 852 } as const;

const previewInset = 24;
const minimumScale = .2;

export function deviceFitScale(containerWidth: number, containerHeight: number) {
  const widthScale = Math.max(minimumScale, (containerWidth - previewInset) / mobileViewport.width);
  const heightScale = Math.max(minimumScale, (containerHeight - previewInset) / mobileViewport.height);
  return Math.min(1, widthScale, heightScale);
}
