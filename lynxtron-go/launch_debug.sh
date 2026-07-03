#!/bin/bash
# Redirect output to both console and a log file we can read
exec > >(tee -a "/Users/bytedance/Projects/External/icecreamx10/showcases2/lynxtron-go/debug_terminal.log") 2>&1

echo "Launching Lynxtron Debug Session..."
cd "/Users/bytedance/Projects/External/icecreamx10/showcases2/lynxtron-go"
export NODE_ENV=development

echo "Command: /Users/bytedance/Projects/External/icecreamx10/showcases2/lynxtron-go/node_modules/.bin/lynxtron /Users/bytedance/Projects/External/icecreamx10/showcases2/lynxtron-go/dist/desktop --inspect=9222"
"/Users/bytedance/Projects/External/icecreamx10/showcases2/lynxtron-go/node_modules/.bin/lynxtron" "/Users/bytedance/Projects/External/icecreamx10/showcases2/lynxtron-go/dist/desktop" --inspect=9222

EXIT_CODE=$?
echo "Lynxtron exited with code $EXIT_CODE"
echo "Check debug_terminal.log for details."
read -p "Press enter to close this window..."
