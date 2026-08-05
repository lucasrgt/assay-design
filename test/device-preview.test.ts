import { describe, expect, it } from 'vitest';
import { deviceFitScale, mobileViewport } from '../src/storybook/device-preview-model.js';

describe('mobile device preview', () => {
  it('preserves the canonical mobile viewport', () => {
    expect(mobileViewport).toEqual({ label: 'iPhone 15', width: 393, height: 852 });
  });

  it('fits the complete device inside the available panel', () => {
    expect(deviceFitScale(1200, 700)).toBeCloseTo(676 / 852);
    expect(deviceFitScale(300, 1200)).toBeCloseTo(276 / 393);
  });

  it('does not upscale or collapse below the inspection floor', () => {
    expect(deviceFitScale(1000, 1000)).toBe(1);
    expect(deviceFitScale(0, 0)).toBe(.2);
  });
});
