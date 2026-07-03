#!/usr/bin/env node

import { fetch } from './commands/fetch.js';
import { build } from './commands/build.js';
import { run } from './commands/run.js';
import { list } from './commands/list.js';
import { log } from './utils/ndjson.js';
import * as path from 'path';
import * as os from 'os';

const DEFAULT_WORKSPACE = path.join(os.homedir(), '.lynxtron-go');

const [, , command, ...args] = process.argv;

async function main() {
  const workspaceRoot = process.env.LYNXTRON_WORKSPACE ?? DEFAULT_WORKSPACE;

  switch (command) {
    case 'fetch': {
      const url = args[0];
      if (!url) {
        log('Usage: lynxtron-showcases fetch <url>');
        process.exit(1);
      }
      await fetch(url, workspaceRoot);
      break;
    }

    case 'build': {
      const watch = args.includes('--watch');
      const positional = args.filter((a) => !a.startsWith('--'));
      const name = positional[0];
      if (!name) {
        log('Usage: lynxtron-showcases build [--watch] <name>');
        process.exit(1);
      }
      await build(name, { watch, workspaceRoot });
      break;
    }

    case 'run': {
      const name = args[0];
      if (!name) {
        log('Usage: lynxtron-showcases run <name>');
        process.exit(1);
      }
      await run(name, workspaceRoot);
      break;
    }

    case 'list': {
      await list(workspaceRoot);
      break;
    }

    default:
      log(`Unknown command: ${command}`);
      log('Available commands: fetch, build, run, list');
      process.exit(1);
  }
}

main().catch((err) => {
  log(`Fatal: ${err.message}`);
  process.exit(1);
});
