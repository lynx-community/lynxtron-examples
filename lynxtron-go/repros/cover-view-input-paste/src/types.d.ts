export {};

declare module '@lynx-js/types' {
  interface IntrinsicElements {
    'cover-view': import('@lynx-js/types').StandardProps;
  }

  interface InputProps {
    value?: string;
  }
}
