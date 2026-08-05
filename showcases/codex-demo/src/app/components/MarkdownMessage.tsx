import { useMemo } from '@lynx-js/react';
import MarkdownIt from 'markdown-it';
import { prismSyntaxLines } from '../syntax-highlight';
import './MarkdownMessage.css';

interface MarkdownToken {
  type: string;
  tag?: string;
  nesting?: number;
  content?: string;
  info?: string;
  markup?: string;
  attrs?: [string, string][] | null;
  children?: MarkdownToken[] | null;
}

interface InlineSegment {
  text: string;
  strong: boolean;
  emphasis: boolean;
  strike: boolean;
  code: boolean;
  href?: string;
}

type MarkdownBlock =
  | { kind: 'paragraph'; inline: MarkdownToken[] }
  | { kind: 'heading'; level: number; inline: MarkdownToken[] }
  | { kind: 'code'; content: string; language: string }
  | { kind: 'quote'; blocks: MarkdownBlock[] }
  | { kind: 'list'; ordered: boolean; start: number; items: MarkdownBlock[][] }
  | { kind: 'table'; header: MarkdownToken[][]; rows: MarkdownToken[][][] }
  | { kind: 'rule' };

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
  breaks: false,
});

function matchingClose(tokens: MarkdownToken[], openIndex: number): number {
  const open = tokens[openIndex];
  let depth = 0;
  for (let index = openIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === open.type) depth += 1;
    if (token.tag === open.tag && token.nesting === -1) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return tokens.length - 1;
}

function inlineAfter(tokens: MarkdownToken[], index: number): MarkdownToken[] {
  const inline = tokens[index + 1];
  return inline?.type === 'inline' ? inline.children ?? [] : [];
}

function parseTable(tokens: MarkdownToken[], start: number, end: number): MarkdownBlock {
  const header: MarkdownToken[][] = [];
  const rows: MarkdownToken[][][] = [];
  let currentRow: MarkdownToken[][] | null = null;
  let headerRow = false;
  for (let index = start + 1; index < end; index += 1) {
    const token = tokens[index];
    if (token.type === 'thead_open') headerRow = true;
    if (token.type === 'thead_close') headerRow = false;
    if (token.type === 'tr_open') currentRow = [];
    if ((token.type === 'th_open' || token.type === 'td_open') && currentRow) {
      currentRow.push(inlineAfter(tokens, index));
    }
    if (token.type === 'tr_close' && currentRow) {
      if (headerRow) header.push(...currentRow);
      else rows.push(currentRow);
      currentRow = null;
    }
  }
  return { kind: 'table', header, rows };
}

function parseBlocks(tokens: MarkdownToken[], start = 0, end = tokens.length): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let index = start;
  while (index < end) {
    const token = tokens[index];
    if (token.type === 'paragraph_open') {
      blocks.push({ kind: 'paragraph', inline: inlineAfter(tokens, index) });
      index = matchingClose(tokens, index) + 1;
      continue;
    }
    if (token.type === 'heading_open') {
      blocks.push({
        kind: 'heading',
        level: Math.max(1, Math.min(6, Number(token.tag?.slice(1)) || 1)),
        inline: inlineAfter(tokens, index),
      });
      index = matchingClose(tokens, index) + 1;
      continue;
    }
    if (token.type === 'fence' || token.type === 'code_block') {
      blocks.push({ kind: 'code', content: token.content ?? '', language: token.info?.trim().split(/\s+/)[0] ?? 'text' });
      index += 1;
      continue;
    }
    if (token.type === 'blockquote_open') {
      const close = matchingClose(tokens, index);
      blocks.push({ kind: 'quote', blocks: parseBlocks(tokens, index + 1, close) });
      index = close + 1;
      continue;
    }
    if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
      const close = matchingClose(tokens, index);
      const items: MarkdownBlock[][] = [];
      let cursor = index + 1;
      while (cursor < close) {
        if (tokens[cursor].type === 'list_item_open') {
          const itemClose = matchingClose(tokens, cursor);
          items.push(parseBlocks(tokens, cursor + 1, itemClose));
          cursor = itemClose + 1;
        } else cursor += 1;
      }
      const startAttr = token.attrs?.find(([name]) => name === 'start')?.[1];
      blocks.push({
        kind: 'list',
        ordered: token.type === 'ordered_list_open',
        start: Number(startAttr) || 1,
        items,
      });
      index = close + 1;
      continue;
    }
    if (token.type === 'table_open') {
      const close = matchingClose(tokens, index);
      blocks.push(parseTable(tokens, index, close));
      index = close + 1;
      continue;
    }
    if (token.type === 'hr') {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }
    if (token.type === 'html_block' && token.content) {
      blocks.push({ kind: 'paragraph', inline: [{ type: 'text', content: token.content }] });
    }
    index += 1;
  }
  return blocks;
}

function inlineSegments(tokens: MarkdownToken[]): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let strong = 0;
  let emphasis = 0;
  let strike = 0;
  let href: string | undefined;
  const append = (text: string, code = false, overrideHref = href) => {
    if (!text) return;
    const next: InlineSegment = {
      text,
      strong: strong > 0,
      emphasis: emphasis > 0,
      strike: strike > 0,
      code,
      href: overrideHref,
    };
    const previous = segments[segments.length - 1];
    if (previous
      && previous.strong === next.strong
      && previous.emphasis === next.emphasis
      && previous.strike === next.strike
      && previous.code === next.code
      && previous.href === next.href) previous.text += text;
    else segments.push(next);
  };

  for (const token of tokens) {
    if (token.type === 'text') append(token.content ?? '');
    else if (token.type === 'code_inline') append(token.content ?? '', true);
    else if (token.type === 'softbreak' || token.type === 'hardbreak') append('\n');
    else if (token.type === 'strong_open') strong += 1;
    else if (token.type === 'strong_close') strong = Math.max(0, strong - 1);
    else if (token.type === 'em_open') emphasis += 1;
    else if (token.type === 'em_close') emphasis = Math.max(0, emphasis - 1);
    else if (token.type === 's_open') strike += 1;
    else if (token.type === 's_close') strike = Math.max(0, strike - 1);
    else if (token.type === 'link_open') href = token.attrs?.find(([name]) => name === 'href')?.[1];
    else if (token.type === 'link_close') href = undefined;
    else if (token.type === 'image') append(token.content || 'image', false, token.attrs?.find(([name]) => name === 'src')?.[1]);
    else if (token.content) append(token.content);
  }
  return segments;
}

function InlineText({ tokens, className = '', onOpenLink }: {
  tokens: MarkdownToken[];
  className?: string;
  onOpenLink?: (href: string) => void;
}) {
  const segments = inlineSegments(tokens);
  return (
    <text className={`markdown-inline selectable-text ${className}`} text-selection={true} flatten={false}>
      {segments.map((segment, index) => {
        const segmentClasses = [
          segment.strong ? 'markdown-inline--strong' : '',
          segment.emphasis ? 'markdown-inline--emphasis' : '',
          segment.strike ? 'markdown-inline--strike' : '',
          segment.code ? 'markdown-inline--code' : '',
          segment.href ? 'markdown-inline--link' : '',
        ].filter(Boolean).join(' ');
        return (
          <text
            key={`${index}:${segment.text}`}
            className={segmentClasses}
            bindtap={segment.href && onOpenLink ? () => onOpenLink(segment.href as string) : undefined}
          >
            {segment.text}
          </text>
        );
      })}
    </text>
  );
}

function MarkdownCodeBlock({ content, language }: { content: string; language: string }) {
  const lines = useMemo(() => prismSyntaxLines(content.replace(/\n$/, ''), language || 'text').slice(0, 1_000), [content, language]);
  return (
    <view className="markdown-code-block">
      {language && language !== 'text' ? <text className="markdown-code-language">{language}</text> : null}
      <scroll-view scroll-x className="markdown-code-scroll">
        <view className="markdown-code-lines">
          {lines.map((line, lineIndex) => (
            <text key={lineIndex} className="markdown-code-line selectable-text" text-selection={true} flatten={false}>
              {line.map((segment, segmentIndex) => (
                <text key={`${segmentIndex}:${segment.kind}`} className={`code-token code-token--${segment.kind}`}>{segment.text}</text>
              ))}
            </text>
          ))}
        </view>
      </scroll-view>
      {lines.length >= 1_000 ? <text className="markdown-code-truncated">Code block truncated after 1,000 lines.</text> : null}
    </view>
  );
}

function MarkdownBlocks({ blocks, onOpenLink }: { blocks: MarkdownBlock[]; onOpenLink?: (href: string) => void }) {
  return (
    <view className="markdown-blocks">
      {blocks.map((block, index) => {
        if (block.kind === 'paragraph') return <InlineText key={index} tokens={block.inline} className="markdown-paragraph" onOpenLink={onOpenLink} />;
        if (block.kind === 'heading') return <InlineText key={index} tokens={block.inline} className={`markdown-heading markdown-heading--${block.level}`} onOpenLink={onOpenLink} />;
        if (block.kind === 'code') return <MarkdownCodeBlock key={index} content={block.content} language={block.language} />;
        if (block.kind === 'rule') return <view key={index} className="markdown-rule" />;
        if (block.kind === 'quote') {
          return <view key={index} className="markdown-quote"><MarkdownBlocks blocks={block.blocks} onOpenLink={onOpenLink} /></view>;
        }
        if (block.kind === 'list') {
          return (
            <view key={index} className="markdown-list">
              {block.items.map((item, itemIndex) => (
                <view key={itemIndex} className="markdown-list-item">
                  <text className="markdown-list-marker">{block.ordered ? `${block.start + itemIndex}.` : '•'}</text>
                  <view className="markdown-list-content"><MarkdownBlocks blocks={item} onOpenLink={onOpenLink} /></view>
                </view>
              ))}
            </view>
          );
        }
        return (
          <scroll-view key={index} scroll-x className="markdown-table-scroll">
            <view className="markdown-table">
              {block.header.length > 0 ? (
                <view className="markdown-table-row markdown-table-row--header">
                  {block.header.map((cell, cellIndex) => <view key={cellIndex} className="markdown-table-cell"><InlineText tokens={cell} onOpenLink={onOpenLink} /></view>)}
                </view>
              ) : null}
              {block.rows.map((row, rowIndex) => (
                <view key={rowIndex} className="markdown-table-row">
                  {row.map((cell, cellIndex) => <view key={cellIndex} className="markdown-table-cell"><InlineText tokens={cell} onOpenLink={onOpenLink} /></view>)}
                </view>
              ))}
            </view>
          </scroll-view>
        );
      })}
    </view>
  );
}

export function MarkdownMessage({ source, onOpenLink }: { source: string; onOpenLink?: (href: string) => void }) {
  const blocks = useMemo(() => parseBlocks(markdown.parse(source, {}) as MarkdownToken[]), [source]);
  return <MarkdownBlocks blocks={blocks} onOpenLink={onOpenLink} />;
}
