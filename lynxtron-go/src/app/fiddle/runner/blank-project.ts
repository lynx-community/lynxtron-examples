/** Renderer overlay applied to the complete built-in starter for New Fiddle → Blank. */
export const BLANK_PROJECT_FILES: Record<string, string> = {
  'src/app/App.tsx': `import './App.css';

export function App() {
  return <view className="app" />;
}
`,
  'src/app/App.css': `.app {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #20232d;
}
`,
};
