export {};

// The scintilla-view native element (registered by lynxtron-scintilla-editor)
// and the runtime-accepted <input value> prop, made visible to the
// @lynx-js/react JSX namespace (which sources IntrinsicElements from
// @lynx-js/types).
declare module '@lynx-js/types' {
  interface IntrinsicElements {
    'scintilla-view': import('@lynx-js/types').StandardProps & {
      'editor-id'?: string;
      content?: string;
      'font-size'?: string;
      'theme-dark'?: string;
      suppressed?: string;
    };
  }

  interface InputProps {
    /** Accepted by the runtime <input> even though upstream types omit it. */
    value?: string;
    /** Fired by the runtime <input>; missing from upstream types. */
    bindkeyboardheightchange?: (e: any) => void;
  }
}

// Kept for tooling that still type-checks with the classic global JSX
// namespace (e.g. editors opening files under a different tsconfig).
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
