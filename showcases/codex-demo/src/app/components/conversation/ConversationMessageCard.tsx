import { useState } from '@lynx-js/react';
import type { TimelineEntry } from '../../../shared/agent';
import { Button } from '../ui';
import { MarkdownMessage } from './MarkdownMessage';
import { ToolCard } from './ToolCard';
import { looksLikeFilePath } from './conversation-items';
import './ConversationMessageCard.css';

export interface ConversationMessageCardProps {
  item: TimelineEntry;
  onOpenFile: (path: string, line?: number) => void;
  onOpenTool: () => void;
  onOpenLink: (href: string) => void;
}

export function ConversationMessageCard({ item, onOpenFile, onOpenTool, onOpenLink }: ConversationMessageCardProps) {
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  if (item.kind === 'user') {
    return (
      <view className="message-row message-row--user">
        <view className="user-bubble"><text className="user-text selectable-text" text-selection={true} flatten={false}>{item.text}</text></view>
      </view>
    );
  }
  if (item.kind === 'reasoning') {
    return (
      <view className="reasoning-card">
        <Button className="reasoning-header" variant="ghost" selected={reasoningExpanded} onTap={() => setReasoningExpanded((expanded) => !expanded)}>
          <view className="reasoning-dot" />
          <text className="reasoning-label">Worked</text>
          <text className={`reasoning-chevron ${reasoningExpanded ? 'reasoning-chevron--expanded' : ''}`}>›</text>
        </Button>
        {reasoningExpanded ? <text className="reasoning-text selectable-text" text-selection={true} flatten={false}>{item.text}</text> : null}
      </view>
    );
  }
  if (item.kind === 'tool' && item.tool) {
    const locations = (item.tool.locations ?? []).flatMap((location) => location.path
      ? [{ path: location.path, line: location.line }]
      : []);
    const primaryLocation = locations.find((location) => location.line || looksLikeFilePath(location.path));
    const titlePath = item.tool.title.trim();
    const inferredTitlePath = !titlePath.includes(' ') && looksLikeFilePath(titlePath)
      ? titlePath
      : undefined;
    const openToolPreview = primaryLocation
      ? () => onOpenFile(primaryLocation.path, primaryLocation.line)
      : inferredTitlePath
        ? () => onOpenFile(inferredTitlePath)
        : onOpenTool;
    const failed = ['error', 'failed', 'failure', 'cancelled'].includes((item.tool.status ?? '').toLowerCase());
    if (!failed) {
      return (
        <view className="conversation-tool-activity">
          <view className="conversation-tool-activity-icon" />
          <text className="conversation-tool-activity-text" text-maxline="1">Working on {item.tool.title}</text>
        </view>
      );
    }
    return (
      <ToolCard
        title={item.tool.title}
        status={item.tool.status}
        output={item.tool.text}
        locations={locations}
        onOpen={openToolPreview}
        onOpenLocation={(location) => onOpenFile(location.path, location.line)}
      />
    );
  }
  if (item.kind === 'plan') {
    return (
      <view className="plan-card">
        <text className="plan-label">PLAN</text>
        {(item.plan ?? []).map((entry, index) => (
          <view className="plan-row" key={`${index}-${entry.content}`}>
            <view className={`plan-marker plan-marker--${entry.status ?? 'pending'}`} />
            <text className="plan-text selectable-text" text-selection={true} flatten={false}>{entry.content}</text>
          </view>
        ))}
      </view>
    );
  }
  if (item.kind === 'error') {
    return <view className="error-card"><text className="error-text selectable-text" text-selection={true} flatten={false}>{item.text}</text></view>;
  }
  return (
    <view className="assistant-message">
      <view className="assistant-mark"><text className="assistant-mark-text">A</text></view>
      <MarkdownMessage source={item.text ?? ''} onOpenLink={onOpenLink} />
    </view>
  );
}
