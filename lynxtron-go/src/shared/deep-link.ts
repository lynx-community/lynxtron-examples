export const PUBLIC_DEEP_LINK_SCHEME = 'lynxtron';

export interface DeepLinkFileNavigation {
  filePath: string;
  line?: number; // 1-based
  column?: number; // 1-based
}

export type DeepLinkIntent =
  | { kind: 'home' }
  | { kind: 'showcase-open'; showcaseId: string; target?: 'ide'; navigation?: DeepLinkFileNavigation }
  | { kind: 'example-open'; examplePath: string; navigation?: DeepLinkFileNavigation }
  | { kind: 'bundle-url-open'; url: string; title?: string };

export interface DeepLinkParseError {
  code:
    | 'INVALID_URL'
    | 'UNSUPPORTED_SCHEME'
    | 'UNSUPPORTED_ROUTE'
    | 'MISSING_PARAM'
    | 'INVALID_PARAM';
  message: string;
  detail?: string;
}

export type DeepLinkParseResult =
  | { ok: true; intent: DeepLinkIntent }
  | { ok: false; error: DeepLinkParseError };

export type HostDeepLinkPayload =
  | { kind: 'intent'; intent: DeepLinkIntent; rawUrl: string; source: string }
  | { kind: 'error'; error: DeepLinkParseError; rawUrl: string; source: string };

function fail(error: DeepLinkParseError): DeepLinkParseResult {
  return { ok: false, error };
}

function normalizeExamplePath(value: string): string {
  const cleaned = value.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  return cleaned;
}

function parsePositiveIntegerParam(
  value: string | null,
  paramName: 'line' | 'column',
): { ok: true; value: number | null } | { ok: false; error: DeepLinkParseError } {
  if (value === null) {
    return { ok: true, value: null };
  }

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PARAM',
        message: `Deep link ${paramName} must be a positive integer`,
        detail: trimmed,
      },
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PARAM',
        message: `Deep link ${paramName} must be greater than or equal to 1`,
        detail: trimmed,
      },
    };
  }

  return { ok: true, value: parsed };
}

function normalizeRelativeFilePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const slashNormalized = trimmed.replace(/\\/g, '/');
  if (
    slashNormalized.includes('://')
    || slashNormalized.startsWith('/')
    || slashNormalized.startsWith('~/')
    || /^[A-Za-z]:\//.test(slashNormalized)
  ) {
    return null;
  }

  const segments = slashNormalized.split('/');
  const normalizedSegments: string[] = [];
  for (const segment of segments) {
    // No trimming: a filename with leading/trailing spaces is unusual but
    // legal — silently altering it would resolve to the wrong file.
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (!normalizedSegments.length) {
        return null;
      }
      normalizedSegments.pop();
      continue;
    }
    normalizedSegments.push(segment);
  }

  return normalizedSegments.join('/');
}

function parseOptionalFileNavigation(
  parsed: URL,
): { ok: true; navigation?: DeepLinkFileNavigation } | { ok: false; error: DeepLinkParseError } {
  const rawFile = parsed.searchParams.get('file');
  const rawLine = parsed.searchParams.get('line');
  const rawColumn = parsed.searchParams.get('column');

  if (rawFile === null) {
    if (rawLine !== null || rawColumn !== null) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PARAM',
          message: 'Deep link line and column require file to be set',
        },
      };
    }
    return { ok: true };
  }

  const filePath = normalizeRelativeFilePath(rawFile);
  if (!filePath) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PARAM',
        message: 'Deep link file must be a workspace-relative path',
        detail: rawFile.trim(),
      },
    };
  }

  if (rawColumn !== null && rawLine === null) {
    return {
      ok: false,
      error: {
        code: 'INVALID_PARAM',
        message: 'Deep link column requires line to be set',
      },
    };
  }

  const lineResult = parsePositiveIntegerParam(rawLine, 'line');
  if (!lineResult.ok) {
    return lineResult;
  }

  const columnResult = parsePositiveIntegerParam(rawColumn, 'column');
  if (!columnResult.ok) {
    return columnResult;
  }

  return {
    ok: true,
    navigation: {
      filePath,
      ...(lineResult.value !== null ? { line: lineResult.value } : {}),
      ...(columnResult.value !== null ? { column: columnResult.value } : {}),
    },
  };
}

export function parseDeepLinkUrl(rawUrl: string): DeepLinkParseResult {
  const urlText = rawUrl.trim();
  if (!urlText) {
    return fail({
      code: 'INVALID_URL',
      message: 'Deep link is empty',
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(urlText);
  } catch {
    return fail({
      code: 'INVALID_URL',
      message: 'Deep link is not a valid URL',
      detail: urlText,
    });
  }

  if (parsed.protocol.toLowerCase() !== `${PUBLIC_DEEP_LINK_SCHEME}:`) {
    return fail({
      code: 'UNSUPPORTED_SCHEME',
      message: `Unsupported deep link scheme: ${parsed.protocol}`,
      detail: `Expected ${PUBLIC_DEEP_LINK_SCHEME}://`,
    });
  }

  const host = parsed.hostname.toLowerCase();
  const routePath = parsed.pathname.replace(/\/+$/, '');

  if (host === 'home' && (routePath === '' || routePath === '/')) {
    return { ok: true, intent: { kind: 'home' } };
  }

  if (host === 'showcase' && routePath === '/open') {
    const showcaseId = parsed.searchParams.get('id')?.trim() || '';
    if (!showcaseId) {
      return fail({
        code: 'MISSING_PARAM',
        message: 'Missing showcase id in deep link',
        detail: 'Use lynxtron://showcase/open?id=<showcase-id>',
      });
    }
    const navigationResult = parseOptionalFileNavigation(parsed);
    if (!navigationResult.ok) {
      return fail(navigationResult.error);
    }
    const target = parsed.searchParams.get('target')?.trim();
    return {
      ok: true,
      intent: {
        kind: 'showcase-open',
        showcaseId,
        ...(target === 'ide' ? { target: 'ide' as const } : {}),
        ...(navigationResult.navigation ? { navigation: navigationResult.navigation } : {}),
      },
    };
  }

  if (host === 'example' && routePath === '/open') {
    const rawPath = parsed.searchParams.get('path')?.trim() || '';
    if (!rawPath) {
      return fail({
        code: 'MISSING_PARAM',
        message: 'Missing example path in deep link',
        detail: 'Use lynxtron://example/open?path=<example-relative-path>',
      });
    }
    if (rawPath.includes('://')) {
      return fail({
        code: 'INVALID_PARAM',
        message: 'Example path must be a relative path, not a full URL',
        detail: rawPath,
      });
    }
    const examplePath = normalizeExamplePath(rawPath);
    if (!examplePath) {
      return fail({
        code: 'INVALID_PARAM',
        message: 'Example path cannot be empty',
      });
    }
    const navigationResult = parseOptionalFileNavigation(parsed);
    if (!navigationResult.ok) {
      return fail(navigationResult.error);
    }
    return {
      ok: true,
      intent: {
        kind: 'example-open',
        examplePath,
        ...(navigationResult.navigation ? { navigation: navigationResult.navigation } : {}),
      },
    };
  }

  if (host === 'lynxview_page' && (routePath === '' || routePath === '/')) {
    const url = parsed.searchParams.get('bundle')?.trim() || '';
    if (!url) {
      return fail({
        code: 'MISSING_PARAM',
        message: 'Missing bundle URL in deep link',
        detail: 'Use lynxtron://lynxview_page?bundle=<bundle-url>',
      });
    }
    // http(s) ONLY. Deep links arrive from arbitrary external sources — a
    // file:// (or other-scheme) URL here would let a drive-by link load a
    // local bundle into a preview window.
    let bundleUrl: URL;
    try {
      bundleUrl = new URL(url);
    } catch {
      return fail({
        code: 'INVALID_PARAM',
        message: 'Bundle URL is not a valid URL',
        detail: url,
      });
    }
    if (bundleUrl.protocol !== 'http:' && bundleUrl.protocol !== 'https:') {
      return fail({
        code: 'INVALID_PARAM',
        message: 'Bundle URL must be http(s)',
        detail: url,
      });
    }
    const title = parsed.searchParams.get('title')?.trim() || undefined;
    return {
      ok: true,
      intent: {
        kind: 'bundle-url-open',
        url,
        ...(title ? { title } : {}),
      },
    };
  }

  return fail({
    code: 'UNSUPPORTED_ROUTE',
    message: 'Unsupported deep link route',
    detail: `${parsed.hostname}${parsed.pathname}`,
  });
}

/** Deep link that boots an instance straight into the legacy IDE with a
    showcase workspace — used to open Gallery's IDE action in a new window. */
export function buildShowcaseIdeDeepLink(showcaseId: string): string {
  return `${PUBLIC_DEEP_LINK_SCHEME}://showcase/open?id=${encodeURIComponent(showcaseId)}&target=ide`;
}

export function extractDeepLinkUrlFromArgv(argv: string[]): string | null {
  for (const arg of argv) {
    if (typeof arg !== 'string') continue;
    if (arg.toLowerCase().startsWith(`${PUBLIC_DEEP_LINK_SCHEME}://`)) {
      return arg;
    }
  }
  return null;
}
