import { useEffect, useState } from '@lynx-js/react';
import { Button, Dialog, NonIdealState, Spinner, Tag } from '../bp';
import './HistoryDialog.css';

interface GistCommit {
  version: string;
  committed_at: string;
  user?: { login: string } | null;
  change_status?: { total: number; additions: number; deletions: number };
}

async function fetchGistHistory(gistId: string): Promise<GistCommit[]> {
  const r = await fetch(`https://api.github.com/gists/${gistId}/commits`, {
    headers: { 'Accept': 'application/vnd.github+json' },
  });
  if (!r.ok) throw new Error(`Gist commits HTTP ${r.status}`);
  return await r.json() as GistCommit[];
}

export interface HistoryDialogProps {
  isOpen: boolean;
  gistId: string | null;
  onClose: () => void;
  onCheckout: (version: string) => void;
}

export function HistoryDialog(props: HistoryDialogProps) {
  const [commits, setCommits] = useState<GistCommit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!props.isOpen || !props.gistId) return;
    setLoading(true);
    setError(null);
    setCommits(null);
    fetchGistHistory(props.gistId)
      .then(setCommits)
      .catch(e => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));
  }, [props.isOpen, props.gistId]);

  const body = !props.gistId ? (
    <NonIdealState
      icon="inbox"
      title="No gist attached"
      description="Load a gist first to see its revision history."
    />
  ) : loading ? (
    <view className="History-Loading">
      <Spinner size={32} intent="primary" />
      <text className="History-LoadingText">Loading revisions…</text>
    </view>
  ) : error ? (
    <NonIdealState
      icon="error"
      title="Couldn't load history"
      description={error}
    />
  ) : commits && commits.length > 0 ? (
    <scroll-view className="History-List" scroll-orientation="vertical">
      {commits.map(c => (
        <view key={c.version} className="History-Item">
          <view className="History-ItemMain">
            <text className="History-Sha">{c.version.slice(0, 7)}</text>
            <text className="History-When">{c.committed_at.replace('T', ' ').slice(0, 19)}</text>
            {c.change_status ? (
              <view className="History-Delta">
                <Tag intent="success" minimal>+{c.change_status.additions}</Tag>
                <Tag intent="danger" minimal>-{c.change_status.deletions}</Tag>
              </view>
            ) : null}
          </view>
          <Button
            text="Checkout"
            small
            onClick={() => { props.onCheckout(c.version); props.onClose(); }}
          />
        </view>
      ))}
    </scroll-view>
  ) : (
    <NonIdealState title="No revisions" description="This gist has no history yet." />
  );

  return (
    <Dialog isOpen={props.isOpen} title="Gist History" onClose={props.onClose} width={640}>
      {body}
    </Dialog>
  );
}
