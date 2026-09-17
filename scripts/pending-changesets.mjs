import { appendFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function hasPendingChangesets(directory = '.changeset') {
  // Match Changesets' Markdown entries, including empty changesets.
  return readdirSync(directory, { withFileTypes: true })
    .some(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  appendFileSync(process.env.GITHUB_OUTPUT, `has-changesets=${hasPendingChangesets()}\n`);
}
