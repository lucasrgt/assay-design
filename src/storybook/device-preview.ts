import React from 'react';
import { deviceFitScale, mobileViewport } from './device-preview-model.js';

type DevicePreviewProps = Omit<React.IframeHTMLAttributes<HTMLIFrameElement>, 'style'> & {
  fitHeight?: number | string;
  inspectionKey?: string;
};

export function DevicePreviewFrame({ fitHeight = '100%', inspectionKey, ...frameProps }: DevicePreviewProps) {
  const host = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  React.useLayoutEffect(() => {
    const target = host.current;
    if (!target || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => setScale(deviceFitScale(target.clientWidth, target.clientHeight));
    const observer = new ResizeObserver(update);
    observer.observe(target);
    update();
    return () => observer.disconnect();
  }, []);
  return React.createElement('div', { ref: host, className: 'assay-scrollbar', style: { display: 'flex', flex: '1 1 auto', alignItems: 'flex-start', justifyContent: 'center', width: '100%', height: fitHeight, minWidth: 0, minHeight: 0, padding: 12, overflow: 'auto', boxSizing: 'border-box', background: 'var(--ad-canvas)' } },
    React.createElement('div', { style: { position: 'relative', flex: '0 0 auto', width: mobileViewport.width * scale, height: mobileViewport.height * scale } },
      React.createElement('iframe', { ...frameProps, 'data-inspection-key': inspectionKey, scrolling: frameProps.scrolling ?? 'auto', style: { position: 'absolute', inset: 0, display: 'block', width: mobileViewport.width, height: mobileViewport.height, border: '1px solid var(--ad-line)', background: 'var(--ad-panel)', transform: `scale(${scale})`, transformOrigin: 'top left' } }),
    ),
  );
}
