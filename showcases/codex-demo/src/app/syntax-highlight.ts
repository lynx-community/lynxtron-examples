import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-yaml';

export interface SyntaxSegment {
  text: string;
  kind: string;
}

const PRISM_LANGUAGE_NAMES: Record<string, string> = {
  html: 'markup',
  shell: 'bash',
  xml: 'markup',
};

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  c: 'c', cc: 'cpp', cpp: 'cpp', cxx: 'cpp', h: 'cpp', hpp: 'cpp',
  css: 'css', go: 'go', html: 'html', java: 'java', js: 'javascript', json: 'json',
  jsx: 'jsx', md: 'markdown', mjs: 'javascript', py: 'python', rs: 'rust', sh: 'shell',
  swift: 'swift', toml: 'toml', ts: 'typescript', tsx: 'tsx', xml: 'xml', yaml: 'yaml', yml: 'yaml',
};

export function languageForPath(path: string): string {
  const file = path.split('/').pop() ?? path;
  const extension = file.includes('.') ? file.split('.').pop()?.toLowerCase() ?? '' : '';
  return LANGUAGE_BY_EXTENSION[extension] ?? 'text';
}

export function prismSyntaxLines(content: string, language: string): SyntaxSegment[][] {
  const grammarName = PRISM_LANGUAGE_NAMES[language] ?? language;
  const grammar = Prism.languages[grammarName];
  const stream: Prism.TokenStream = grammar ? Prism.tokenize(content, grammar) : content;
  const lines: SyntaxSegment[][] = [[]];

  const append = (text: string, kind: string) => {
    text.split('\n').forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (!part) return;
      const line = lines[lines.length - 1];
      const previous = line[line.length - 1];
      if (previous?.kind === kind) previous.text += part;
      else line.push({ text: part, kind });
    });
  };

  const flatten = (tokenStream: Prism.TokenStream, inheritedKind = 'plain') => {
    if (typeof tokenStream === 'string') {
      append(tokenStream, inheritedKind);
      return;
    }
    if (Array.isArray(tokenStream)) {
      tokenStream.forEach((token) => flatten(token, inheritedKind));
      return;
    }
    flatten(tokenStream.content, tokenStream.type || inheritedKind);
  };

  flatten(stream);
  return lines.map((line) => line.length ? line : [{ text: ' ', kind: 'plain' }]);
}

interface DiffSyntaxSourceLine {
  kind: 'context' | 'addition' | 'deletion' | 'hunk' | 'meta';
  text: string;
}

export function prismDiffLines(lines: DiffSyntaxSourceLine[], language: string): SyntaxSegment[][] {
  const oldSource: string[] = [];
  const newSource: string[] = [];
  const oldIndexes = new Map<number, number>();
  const newIndexes = new Map<number, number>();

  lines.forEach((line, index) => {
    if (line.kind === 'hunk' || line.kind === 'meta') return;
    if (line.kind !== 'addition') {
      oldIndexes.set(index, oldSource.length);
      oldSource.push(line.text);
    }
    if (line.kind !== 'deletion') {
      newIndexes.set(index, newSource.length);
      newSource.push(line.text);
    }
  });

  const oldHighlighted = prismSyntaxLines(oldSource.join('\n'), language);
  const newHighlighted = prismSyntaxLines(newSource.join('\n'), language);
  return lines.map((line, index) => {
    if (line.kind === 'hunk' || line.kind === 'meta') return [{ text: line.text || ' ', kind: 'plain' }];
    const highlighted = line.kind === 'deletion'
      ? oldHighlighted[oldIndexes.get(index) ?? 0]
      : newHighlighted[newIndexes.get(index) ?? 0];
    return highlighted ?? [{ text: line.text || ' ', kind: 'plain' }];
  });
}
