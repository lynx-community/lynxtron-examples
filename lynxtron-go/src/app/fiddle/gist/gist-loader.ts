import { DEFAULT_EDITORS } from '../types';
import type { FiddleSnapshot, FiddleFile, EditorId } from '../state/FiddleState';
import { languageForId } from '../state/FiddleState';

const GIST_RE = /(?:gist\.github\.com\/(?:[^/]+\/)?)?([0-9a-f]{20,})/i;
const PROJECT_PATH_MANIFEST = '.lynxtron-go-project.json';

export function parseGistId(input: string): string | null {
  const m = input.trim().match(GIST_RE);
  return m ? m[1] : null;
}

export interface PublishResult {
  id: string;
  htmlUrl: string;
}

/**
 * Publish (or update) a gist using a Personal Access Token.
 * If `existingGistId` is set, updates that gist via PATCH; otherwise creates a new one via POST.
 */
export async function publishGistFiddle(
  token: string,
  values: Record<string, string>,
  description: string,
  existingGistId: string | null,
): Promise<PublishResult> {
  const files: Record<string, { content: string }> = {};
  const paths: Record<string, string> = {};
  let pathIndex = 0;
  for (const [name, content] of Object.entries(values)) {
    // GitHub rejects empty gist files — skip them.
    if (!content || content.length === 0) continue;
    let storageName = name;
    if (name.includes('/')) {
      const basename = name.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '-') || 'file';
      storageName = `lynxtron-${String(pathIndex++).padStart(3, '0')}-${basename}`;
      paths[storageName] = name;
    }
    files[storageName] = { content };
  }
  if (Object.keys(files).length === 0) {
    throw new Error('Cannot publish an empty fiddle (all files are empty).');
  }
  if (Object.keys(paths).length > 0) {
    files[PROJECT_PATH_MANIFEST] = {
      content: `${JSON.stringify({ version: 1, paths }, null, 2)}\n`,
    };
  }

  const url = existingGistId
    ? `https://api.github.com/gists/${existingGistId}`
    : 'https://api.github.com/gists';
  const method = existingGistId ? 'PATCH' : 'POST';
  const body: any = { files, description };
  if (!existingGistId) body.public = true;

  const r = await fetch(url, {
    method,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`Gist ${method} failed (${r.status}): ${t.slice(0, 200)}`);
  }
  const gist = await r.json() as { id: string; html_url: string };
  return { id: gist.id, htmlUrl: gist.html_url };
}

interface GistApiFile {
  filename: string;
  content: string;
  language?: string;
  size: number;
  truncated: boolean;
  raw_url?: string;
}

interface GistApiResponse {
  id: string;
  description: string;
  files: Record<string, GistApiFile>;
}

async function fetchGistJson(gistId: string, sha?: string): Promise<GistApiResponse> {
  const url = sha
    ? `https://api.github.com/gists/${gistId}/${sha}`
    : `https://api.github.com/gists/${gistId}`;
  const r = await fetch(url, {
    headers: { 'Accept': 'application/vnd.github+json' },
  });
  if (!r.ok) throw new Error(`Gist ${gistId}${sha ? '@' + sha.slice(0, 7) : ''} HTTP ${r.status}`);
  return await r.json() as GistApiResponse;
}

async function resolveFileContent(f: GistApiFile): Promise<string> {
  if (!f.truncated) return f.content;
  if (!f.raw_url) return f.content;
  const r = await fetch(f.raw_url);
  if (!r.ok) throw new Error(`Gist raw fetch ${r.status}`);
  return await r.text();
}

/**
 * Fetch a public GitHub gist by id and shape it into a FiddleSnapshot.
 * Files whose name matches one of DEFAULT_EDITORS get placed in the fixed slot;
 * everything else is appended as an extra editor id (so users don't lose data).
 *
 * Optionally pass a revision `sha` to load an older version of the gist.
 */
export async function loadGistFiddle(gistId: string, sha?: string): Promise<FiddleSnapshot> {
  const gist = await fetchGistJson(gistId, sha);
  const logicalFiles: Record<string, GistApiFile> = {};
  let pathMap: Record<string, string> = {};
  const manifestFile = gist.files[PROJECT_PATH_MANIFEST];
  if (manifestFile) {
    try {
      const parsed = JSON.parse(await resolveFileContent(manifestFile));
      if (parsed?.version === 1 && parsed.paths && typeof parsed.paths === 'object') {
        pathMap = parsed.paths;
      }
    } catch (_) { /* invalid metadata falls back to literal gist filenames */ }
  }
  for (const [storageName, file] of Object.entries(gist.files)) {
    if (storageName === PROJECT_PATH_MANIFEST) continue;
    const logicalName = typeof pathMap[storageName] === 'string' ? pathMap[storageName] : storageName;
    logicalFiles[logicalName] = file;
  }
  const files = new Map<EditorId, FiddleFile>();
  const seen = new Set<string>();
  const isCompleteProject = Object.keys(logicalFiles).some(name => name.startsWith('src/'));

  if (!isCompleteProject) {
    for (const id of Object.values(DEFAULT_EDITORS)) {
      const gf = logicalFiles[id];
      const content = gf ? await resolveFileContent(gf) : '';
      files.set(id, {
        id,
        savedContent: content,
        currentText: content,
        language: languageForId(id),
        isDirty: false,
        // Legacy gists keep the five familiar editor slots for migration.
        visible: content.length > 0,
      });
      if (gf) seen.add(id);
    }
  }
  for (const [name, gf] of Object.entries(logicalFiles)) {
    if (seen.has(name)) continue;
    const content = await resolveFileContent(gf);
    files.set(name, {
      id: name,
      savedContent: content,
      currentText: content,
      language: languageForId(name),
      isDirty: false,
      visible: content.length > 0,
    });
  }

  const shortSha = sha ? '@' + sha.slice(0, 7) : '';
  return {
    source: { kind: 'gist', gistId: gist.id },
    files,
    activeEditorId: files.has('main.js') ? 'main.js' : Array.from(files.keys())[0] ?? null,
    title: (gist.description || `Gist ${gist.id.slice(0, 8)}`) + shortSha,
  };
}
