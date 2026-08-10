declare module 'markdown-it' {
  interface MarkdownItOptions {
    html?: boolean;
    linkify?: boolean;
    typographer?: boolean;
    breaks?: boolean;
  }

  export default class MarkdownIt {
    constructor(options?: MarkdownItOptions);
    parse(source: string, env: Record<string, unknown>): unknown[];
  }
}
