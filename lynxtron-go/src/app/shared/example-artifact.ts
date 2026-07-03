export const EXAMPLE_ARTIFACT_BASE_URL = 'https://lynxjs.org/next/lynx-examples';

export interface ExampleArtifactTemplateFile {
  name: string;
  file: string;
  webFile?: string;
}

export interface ExampleArtifactMetadata {
  name: string;
  files: string[];
  templateFiles: ExampleArtifactTemplateFile[];
  previewImage?: string;
  exampleGitBaseUrl?: string;
}

export type ExampleArtifactFetchErrorCode =
  | 'INVALID_INPUT'
  | 'METADATA_NOT_FOUND'
  | 'INVALID_METADATA'
  | 'NETWORK_ERROR'
  | 'DOWNLOAD_FAILED'
  | 'CACHE_WRITE_FAILED';

export interface ExampleArtifactFetchError {
  code: ExampleArtifactFetchErrorCode;
  message: string;
  detail?: string;
}

export interface ExampleArtifactDownloadTarget {
  relativePath: string;
  kind: 'metadata' | 'file' | 'template' | 'webFile' | 'previewImage';
}

export interface ExampleArtifactFetchSuccess {
  ok: true;
  exampleId: string;
  metadataUrl: string;
  cachePath: string;
  metadataPath: string;
  metadata: ExampleArtifactMetadata;
  downloadedFiles: Array<{ relativePath: string; localPath: string; kind: ExampleArtifactDownloadTarget['kind'] }>;
}

export interface ExampleArtifactFetchFailure {
  ok: false;
  error: ExampleArtifactFetchError;
}

export type ExampleArtifactFetchResult = ExampleArtifactFetchSuccess | ExampleArtifactFetchFailure;

export interface ExampleArtifactTreeNode {
  name: string;
  fullPath: string;
  isDirectory: boolean;
}

export interface ExampleArtifactWorkspaceView {
  rootPath: string;
  dirContents: Map<string, ExampleArtifactTreeNode[]>;
  expandedDirs: Set<string>;
  defaultFilePath: string | null;
}

export interface ExampleArtifactLoadingState {
  message: string;
  minVisibleMs: number;
}

export interface ExampleArtifactRunContext {
  cachePath: string;
  templateFile: string;
  title: string;
}

// Keep the overlay visible briefly so it does not flicker during fast transitions.
export const EXAMPLE_ARTIFACT_LOADING_MIN_VISIBLE_MS = 900;

function fail(code: ExampleArtifactFetchErrorCode, message: string, detail?: string): ExampleArtifactFetchFailure {
  return { ok: false, error: { code, message, detail } };
}

function pass(value: string): { ok: true; value: string } {
  return { ok: true, value };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeRelativePath(input: string): string | null {
  const trimmed = input.trim().replace(/\\/g, '/');
  if (!trimmed) return null;
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) return null;

  const withoutLeadingDots = trimmed.replace(/^\.\/+/, '').replace(/^\/+/, '');
  const parts = withoutLeadingDots.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some(part => part === '.' || part === '..')) return null;
  if (parts.some(part => part.includes('\0'))) return null;
  return parts.join('/');
}

function compareTreeNodes(a: ExampleArtifactTreeNode, b: ExampleArtifactTreeNode): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

export function joinExampleArtifactPath(basePath: string, relativePath: string): string {
  const base = basePath.replace(/\/+$/, '');
  const rel = relativePath.replace(/^\/+/, '');
  const separator = base.includes('\\') ? '\\' : '/';
  return rel ? `${base}${separator}${rel.replace(/\//g, separator)}` : base;
}

export function normalizeExampleArtifactInput(input: string): { ok: true; value: string } | { ok: false; error: ExampleArtifactFetchError } {
  if (!isNonEmptyString(input)) {
    return fail('INVALID_INPUT', 'Example id is required');
  }
  const normalized = normalizeRelativePath(input);
  if (!normalized) {
    return fail('INVALID_INPUT', `Invalid example id or relative path: ${input}`);
  }
  return pass(normalized);
}

export function normalizeExampleArtifactRelativePath(input: string): { ok: true; value: string } | { ok: false; error: ExampleArtifactFetchError } {
  if (!isNonEmptyString(input)) {
    return fail('INVALID_METADATA', 'Example metadata contains an empty path');
  }
  const normalized = normalizeRelativePath(input);
  if (!normalized) {
    return fail('INVALID_METADATA', `Example metadata contains an invalid relative path: ${input}`);
  }
  return pass(normalized);
}

function joinUrl(baseUrl: string, ...parts: string[]): string {
  const base = baseUrl.replace(/\/+$/, '');
  const path = parts
    .flatMap(part => part.split('/'))
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
  return `${base}/${path}`;
}

export function buildExampleArtifactMetadataUrl(exampleId: string, baseUrl = EXAMPLE_ARTIFACT_BASE_URL): string {
  return joinUrl(baseUrl, exampleId, 'example-metadata.json');
}

export function buildExampleArtifactFileUrl(exampleId: string, relativePath: string, baseUrl = EXAMPLE_ARTIFACT_BASE_URL): string {
  return joinUrl(baseUrl, exampleId, relativePath);
}

export function buildExampleArtifactLoadingState(relativePath: string): ExampleArtifactLoadingState {
  const normalized = relativePath.trim();
  return {
    message: normalized ? `Preparing workspace for ${normalized}...` : 'Preparing workspace...',
    minVisibleMs: EXAMPLE_ARTIFACT_LOADING_MIN_VISIBLE_MS,
  };
}

export function validateExampleArtifactMetadata(raw: unknown): { ok: true; metadata: ExampleArtifactMetadata } | { ok: false; error: ExampleArtifactFetchError } {
  if (!raw || typeof raw !== 'object') {
    return fail('INVALID_METADATA', 'example-metadata.json must contain a JSON object');
  }

  const record = raw as Record<string, unknown>;
  if (!isNonEmptyString(record.name)) {
    return fail('INVALID_METADATA', 'Metadata field "name" must be a non-empty string');
  }

  if (!Array.isArray(record.files) || record.files.length === 0) {
    return fail('INVALID_METADATA', 'Metadata field "files" must be a non-empty array');
  }

  if (!Array.isArray(record.templateFiles) || record.templateFiles.length === 0) {
    return fail('INVALID_METADATA', 'Metadata field "templateFiles" must be a non-empty array');
  }

  const files: string[] = [];
  for (const file of record.files) {
    if (!isNonEmptyString(file)) {
      return fail('INVALID_METADATA', 'Each files entry must be a non-empty string');
    }
    const normalized = normalizeExampleArtifactRelativePath(file);
    if (!normalized.ok) return normalized;
    files.push(normalized.value);
  }

  const templateFiles: ExampleArtifactTemplateFile[] = [];
  for (const item of record.templateFiles) {
    if (!item || typeof item !== 'object') {
      return fail('INVALID_METADATA', 'Each templateFiles entry must be an object');
    }
    const template = item as Record<string, unknown>;
    if (!isNonEmptyString(template.name)) {
      return fail('INVALID_METADATA', 'Each templateFiles entry must include a non-empty "name"');
    }
    if (!isNonEmptyString(template.file)) {
      return fail('INVALID_METADATA', `templateFiles[${template.name as string}].file must be a non-empty string`);
    }
    const filePath = normalizeExampleArtifactRelativePath(template.file);
    if (!filePath.ok) return filePath;
    const result: ExampleArtifactTemplateFile = {
      name: template.name.trim(),
      file: filePath.value,
    };
    if (template.webFile !== undefined && template.webFile !== null) {
      if (!isNonEmptyString(template.webFile)) {
        return fail('INVALID_METADATA', `templateFiles[${template.name as string}].webFile must be a non-empty string when present`);
      }
      const webFile = normalizeExampleArtifactRelativePath(template.webFile);
      if (!webFile.ok) return webFile;
      result.webFile = webFile.value;
    }
    templateFiles.push(result);
  }

  const metadata: ExampleArtifactMetadata = {
    name: record.name.trim(),
    files,
    templateFiles,
  };

  if (record.previewImage !== undefined && record.previewImage !== null) {
    if (!isNonEmptyString(record.previewImage)) {
      return fail('INVALID_METADATA', 'Metadata field "previewImage" must be a non-empty string when present');
    }
    const previewImage = normalizeExampleArtifactRelativePath(record.previewImage);
    if (!previewImage.ok) return previewImage;
    metadata.previewImage = previewImage.value;
  }

  if (record.exampleGitBaseUrl !== undefined && record.exampleGitBaseUrl !== null) {
    if (!isNonEmptyString(record.exampleGitBaseUrl)) {
      return fail('INVALID_METADATA', 'Metadata field "exampleGitBaseUrl" must be a non-empty string when present');
    }
    metadata.exampleGitBaseUrl = record.exampleGitBaseUrl.trim();
  }

  return { ok: true, metadata };
}

export function collectExampleArtifactDownloadTargets(metadata: ExampleArtifactMetadata): ExampleArtifactDownloadTarget[] {
  const ordered = new Map<string, ExampleArtifactDownloadTarget>();
  const add = (relativePath: string, kind: ExampleArtifactDownloadTarget['kind']) => {
    if (!ordered.has(relativePath)) {
      ordered.set(relativePath, { relativePath, kind });
    }
  };

  add('example-metadata.json', 'metadata');
  for (const file of metadata.files) {
    add(file, 'file');
  }
  for (const templateFile of metadata.templateFiles) {
    add(templateFile.file, 'template');
    if (templateFile.webFile) {
      add(templateFile.webFile, 'webFile');
    }
  }
  if (metadata.previewImage) {
    add(metadata.previewImage, 'previewImage');
  }

  return [...ordered.values()];
}

export function pickExampleArtifactDefaultFile(metadata: ExampleArtifactMetadata): string | null {
  return metadata.files.find(file => file === 'package.json') || metadata.files[0] || null;
}

export function pickExampleArtifactRunTemplate(metadata: ExampleArtifactMetadata): ExampleArtifactTemplateFile | null {
  return metadata.templateFiles[0] || null;
}

export function buildExampleArtifactRunContext(
  cachePath: string,
  metadata: ExampleArtifactMetadata,
): ExampleArtifactRunContext | null {
  const template = pickExampleArtifactRunTemplate(metadata);
  if (!template) return null;
  return {
    cachePath,
    templateFile: template.file,
    title: `${metadata.name} — ${template.name}`,
  };
}

export function buildExampleArtifactWorkspaceView(
  cachePath: string,
  metadata: ExampleArtifactMetadata,
): ExampleArtifactWorkspaceView {
  const dirNodes = new Map<string, Map<string, ExampleArtifactTreeNode>>();

  const ensureDirMap = (dirPath: string): Map<string, ExampleArtifactTreeNode> => {
    let map = dirNodes.get(dirPath);
    if (!map) {
      map = new Map();
      dirNodes.set(dirPath, map);
    }
    return map;
  };

  const addDir = (parentPath: string, name: string): string => {
    const fullPath = joinExampleArtifactPath(parentPath, name);
    const parentMap = ensureDirMap(parentPath);
    if (!parentMap.has(name)) {
      parentMap.set(name, { name, fullPath, isDirectory: true });
    }
    ensureDirMap(fullPath);
    return fullPath;
  };

  const addFile = (parentPath: string, name: string) => {
    const parentMap = ensureDirMap(parentPath);
    if (!parentMap.has(name)) {
      parentMap.set(name, { name, fullPath: joinExampleArtifactPath(parentPath, name), isDirectory: false });
    }
  };

  ensureDirMap(cachePath);

  for (const relativePath of metadata.files) {
    const parts = relativePath.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    let currentDir = cachePath;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = addDir(currentDir, parts[i]);
    }
    addFile(currentDir, parts[parts.length - 1]);
  }

  const dirContents = new Map<string, ExampleArtifactTreeNode[]>();
  for (const [dirPath, nodes] of dirNodes.entries()) {
    dirContents.set(dirPath, [...nodes.values()].sort(compareTreeNodes));
  }

  const defaultFile = pickExampleArtifactDefaultFile(metadata);
  const defaultFilePath = defaultFile ? joinExampleArtifactPath(cachePath, defaultFile) : null;

  const expandedDirs = new Set<string>([cachePath]);
  if (defaultFile) {
    const parts = defaultFile.split('/').filter(Boolean);
    let currentDir = cachePath;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = joinExampleArtifactPath(currentDir, parts[i]);
      expandedDirs.add(currentDir);
    }
  }

  return {
    rootPath: cachePath,
    dirContents,
    expandedDirs,
    defaultFilePath,
  };
}
