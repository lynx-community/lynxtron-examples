import type { ReviewSnapshot } from '../../../shared/agent';
import { Button } from '../ui';
import './ChangeSummaryCard.css';

export interface ChangeSummaryCardProps {
  review: ReviewSnapshot;
  formatPath: (path: string) => string;
  onReview: () => void;
  onOpenFile?: (path: string) => void;
}

/** Aggregated file mutations for one task turn. */
export function ChangeSummaryCard({ review, formatPath, onReview, onOpenFile }: ChangeSummaryCardProps) {
  if (review.files.length === 0) return null;
  return (
    <view className="change-card">
      <view className="change-card-header">
        <view className="change-card-icon"><text className="change-card-icon-text">＋</text></view>
        <view className="change-card-title-wrap">
          <text className="change-card-title">Edited {review.files.length} {review.files.length === 1 ? 'file' : 'files'}</text>
          <view className="change-card-totals">
            <text className="change-card-add">+{review.additions}</text>
            <text className="change-card-delete">−{review.deletions}</text>
          </view>
        </view>
        <view className="change-card-actions">
          <Button className="change-card-undo" variant="ghost" disabled><text className="change-card-undo-text">Undo</text><text className="change-card-undo-icon">↶</text></Button>
          <Button className="change-card-review" border borderColor="#dfe1e5" onTap={onReview}><text className="change-card-review-text">Review</text></Button>
        </view>
      </view>
      <view className="change-card-files">
        {review.files.slice(0, 3).map((file) => (
          <Button
            className="change-card-file"
            variant="ghost"
            key={file.path}
            style={{ borderBottomColor: '#f0f1f3' }}
            onTap={() => onOpenFile ? onOpenFile(file.path) : onReview()}
          >
            <text className="change-card-file-path" text-maxline="1">{formatPath(file.path)}</text>
            <view className="change-card-file-totals">
              <text className="change-card-file-add">+{file.additions}</text>
              <text className="change-card-file-delete">−{file.deletions}</text>
            </view>
          </Button>
        ))}
        {review.files.length > 3 ? (
          <Button className="change-card-more" variant="ghost" onTap={onReview}><text className="change-card-more-text">{review.files.length - 3} more changed files</text></Button>
        ) : null}
      </view>
    </view>
  );
}
