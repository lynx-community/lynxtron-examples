// Shared IPC message types between Renderer <-> Main <-> Extension Host

// Renderer -> Main -> Extension Host
export interface TextChangedMsg {
  type: 'textChanged';
  uri: string;        // absolute file path
  text: string;
  version: number;    // monotonically increasing per file
  languageId: string; // 'typescript' | 'tsx' | 'javascript' | 'jsx' | 'css' | 'scss' | 'less'
}

// Extension Host -> Main -> Renderer
export interface DiagnosticsMsg {
  type: 'diagnostics';
  uri: string;
  markers: DiagnosticMarker[];
}

export interface DiagnosticMarker {
  startLine: number;   // 0-based
  startChar: number;   // 0-based, UTF-16 char index (matches TS compiler output)
  endLine: number;
  endChar: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source: string;      // 'typescript' | 'css' | 'scss' | 'less'
  code?: number | string;
}

export type HostInMessage = TextChangedMsg;
export type HostOutMessage = DiagnosticsMsg;
