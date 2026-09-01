/**
 * Coordinates asynchronous "open project" operations.
 *
 * Resolving a showcase can outlive a later Blank/Gist/folder selection.  The
 * editor must follow user intent, not completion order, so only the latest
 * request is allowed to install a snapshot.
 */
export interface LatestOpenRequestGate {
  begin: () => number;
  isCurrent: (requestId: number) => boolean;
}
export function createLatestOpenRequestGate(): LatestOpenRequestGate {
  let currentRequestId = 0;
  return {
    begin: () => ++currentRequestId,
    isCurrent: requestId => requestId === currentRequestId,
  };
}
