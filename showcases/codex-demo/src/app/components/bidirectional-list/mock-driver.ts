import type {
  BidirectionalListDriver,
  ListAlignment,
  ListCellMeasurement,
  ListViewportMeasurement,
} from './types';

export interface MockListItem {
  key: string;
  height: number;
}

export class MockBidirectionalListDriver implements BidirectionalListDriver {
  private items: MockListItem[];
  private scrollTop = 0;
  private viewportHeight: number;
  private layoutRevision = 0;

  constructor(input: { items?: readonly MockListItem[]; viewportHeight: number; scrollTop?: number }) {
    this.items = [...(input.items ?? [])];
    this.viewportHeight = input.viewportHeight;
    this.scrollTop = input.scrollTop ?? 0;
    this.clampScroll();
  }

  setItems(items: readonly MockListItem[]): void {
    this.items = [...items];
    this.layoutRevision += 1;
    this.clampScroll();
  }

  setViewportHeight(height: number): void {
    this.viewportHeight = Math.max(0, height);
    this.layoutRevision += 1;
    this.clampScroll();
  }

  setScrollTop(scrollTop: number): void {
    this.scrollTop = scrollTop;
    this.clampScroll();
  }

  getScrollTop(): number {
    return this.scrollTop;
  }

  getLayoutRevision(): number {
    return this.layoutRevision;
  }

  async getViewport(): Promise<ListViewportMeasurement> {
    return { start: 0, end: this.viewportHeight };
  }

  async getVisibleCells(): Promise<readonly ListCellMeasurement[]> {
    const result: ListCellMeasurement[] = [];
    let documentTop = 0;
    for (let index = 0; index < this.items.length; index += 1) {
      const item = this.items[index]!;
      const top = documentTop - this.scrollTop;
      const bottom = top + item.height;
      if (bottom >= 0 && top <= this.viewportHeight) result.push({ key: item.key, index, top, bottom });
      documentTop += item.height;
    }
    return result;
  }

  async getScrollInfo() {
    const viewport = await this.getViewport();
    const scrollHeight = this.items.reduce((sum, item) => sum + item.height, 0);
    const listHeight = Math.max(0, viewport.end - viewport.start);
    return {
      scrollTop: this.scrollTop,
      scrollHeight,
      listHeight,
      maxScroll: Math.max(0, scrollHeight - listHeight),
    };
  }

  async scrollTo(input: {
    key: string;
    align: ListAlignment;
    offset?: number;
    smooth?: boolean;
  }): Promise<void> {
    const index = this.items.findIndex((item) => item.key === input.key);
    if (index < 0) throw new Error(`Unknown mock item key: ${input.key}`);
    const itemTop = this.items.slice(0, index).reduce((sum, item) => sum + item.height, 0);
    const itemHeight = this.items[index]!.height;
    const alignedTop = input.align === 'start'
      ? 0
      : input.align === 'center'
        ? (this.viewportHeight - itemHeight) / 2
        : this.viewportHeight - itemHeight;
    this.scrollTop = itemTop - alignedTop - (input.offset ?? 0);
    this.clampScroll();
  }

  async waitForLayout(_transactionId: number): Promise<void> {}

  private contentHeight(): number {
    return this.items.reduce((sum, item) => sum + item.height, 0);
  }

  private clampScroll(): void {
    this.scrollTop = Math.max(0, Math.min(this.scrollTop, Math.max(0, this.contentHeight() - this.viewportHeight)));
  }
}
