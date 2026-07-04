export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'scintilla-view': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        'editor-id'?: string;
        content?: string;
        'font-size'?: string;
        'theme-dark'?: string;
        suppressed?: string;
      };
    }
  }
}
