declare module 'react-native-web' {
  import type { ComponentType, ReactNode } from 'react';

  type DataSet = Record<string, string | number | boolean | undefined>;
  type NativeStyle = Record<string, string | number | undefined>;
  export const Pressable: ComponentType<{
    accessibilityRole?: string;
    children?: ReactNode;
    dataSet?: DataSet;
    disabled?: boolean;
    style?: NativeStyle | ((state: { pressed: boolean }) => NativeStyle);
  }>;
  export const Text: ComponentType<{ children?: ReactNode; dataSet?: DataSet; style?: NativeStyle }>;
}
