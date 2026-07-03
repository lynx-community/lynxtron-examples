const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const distPath = path.join(projectRoot, 'dist', 'desktop');
const debugPort = 9222;

console.log(`Preparing to launch Lynxtron from: ${distPath}`);

// Create a temporary shell script to launch the app in a new Terminal window
const scriptPath = path.join(projectRoot, 'launch_debug.sh');
// lynxtron binary is in the local package's node_modules/.bin
const lynxCmd = path.resolve(projectRoot, 'node_modules', '.bin', 'lynxtron');

// Content of the shell script
// We use 'exec' to replace the shell process with lynxtron, retaining the PID/TTY
const scriptContent = `#!/bin/bash
# Redirect output to both console and a log file we can read
exec > >(tee -a "${path.join(projectRoot, 'debug_terminal.log')}") 2>&1

echo "Launching Lynxtron Debug Session..."
cd "${projectRoot}"
export NODE_ENV=development

echo "Command: ${lynxCmd} ${distPath} --inspect=${debugPort}"
"${lynxCmd}" "${distPath}" --inspect=${debugPort}

EXIT_CODE=$?
echo "Lynxtron exited with code $EXIT_CODE"
echo "Check debug_terminal.log for details."
read -p "Press enter to close this window..."
`;

fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

console.log(`Created launcher script at: ${scriptPath}`);
console.log('Opening new Terminal window...');

// Use 'open' to launch the script in Terminal.app
// This guarantees a fresh TTY and independent process lifecycle.
const child = spawn('open', ['-a', 'Terminal', scriptPath], {
  detached: true,
  stdio: 'ignore'
});

child.unref();

console.log(`
============================================================
  Lynxtron debug session started in a NEW TERMINAL WINDOW.
  
  1. Please verify the app window appears.
  2. Connect debugger to localhost:${debugPort}.
  
  If the app crashes, check the output in the new Terminal.
============================================================
`);
