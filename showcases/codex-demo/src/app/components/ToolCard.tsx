import './ToolCard.css';

export interface ToolCardLocation {
  path: string;
  line?: number;
}

export interface ToolCardProps {
  title: string;
  status?: string;
  output?: string;
  locations?: ToolCardLocation[];
  icon?: string;
  formatLocation?: (location: ToolCardLocation) => string;
  onOpen?: () => void;
  onOpenLocation?: (location: ToolCardLocation) => void;
}

function compactPath(path: string): string {
  const pieces = path.split('/').filter(Boolean);
  if (pieces.length <= 2) return path;
  return `…/${pieces.slice(-2).join('/')}`;
}

function defaultLocationLabel(location: ToolCardLocation): string {
  const path = compactPath(location.path);
  return location.line ? `${path}:${location.line}` : path;
}

export function ToolCard({
  title,
  status = 'pending',
  output,
  locations = [],
  icon = '›_',
  formatLocation = defaultLocationLabel,
  onOpen,
  onOpenLocation,
}: ToolCardProps) {
  return (
    <view className={`tool-card ${onOpen ? 'tool-card--interactive' : ''}`} bindtap={onOpen}>
      <view className={`tool-icon tool-icon--${status}`}>
        <text className="tool-icon-text">{icon}</text>
      </view>
      <view className="tool-body">
        <view className="tool-heading">
          <text className="tool-title" text-maxline="1">{title}</text>
          <text className={`tool-status tool-status--${status}`}>{status.replace('_', ' ')}</text>
        </view>
        {locations.length > 0 ? (
          <view className="tool-locations">
            {locations.slice(0, 4).map((location, index) => (
              <view
                className="tool-location"
                key={`${location.path}:${location.line ?? index}`}
                bindtap={() => onOpenLocation?.(location)}
              >
                <text className="tool-location-icon">▧</text>
                <text className="tool-location-text" text-maxline="1">{formatLocation(location)}</text>
              </view>
            ))}
          </view>
        ) : null}
        {output ? (
          <text className="tool-output selectable-text" text-maxline="6" text-selection={true} flatten={false}>
            {output}
          </text>
        ) : null}
      </view>
    </view>
  );
}
