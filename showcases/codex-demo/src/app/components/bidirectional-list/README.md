# BidirectionalList v1 contract

`BidirectionalList` is a renderer-level sequence primitive. It owns local item ordering,
anchor-preserving mutations and edge geometry.

It deliberately does **not** own remote pagination, cursors, loading/error state, chat
semantics, or a second local buffering/window layer. The caller supplies exactly the items
that should exist in the list; every supplied item is mounted.

## v1 boundaries

- `prepend`, `append`, `update`, `replace`, and `reset` are serialized FIFO transactions.
- `replace(..., { position: 'preserve' })` lets a data-driven bounded window evict rows while
  retaining a surviving viewport anchor.
- Insertions use either `preserve` or explicit `follow-insert` positioning.
- `bounces` directly controls the native list boundary effect and defaults to `true`.
- `reached` is geometric: the supplied sequence boundary is visible inside the viewport.
  Empty space counts, so empty and underfilled lists are reached at both edges.
- Reached callbacks are notifications. The external data model decides whether to fetch and
  supply another batch.
- Every reached episode reports both `origin` (`user`, `content`, or `initial`) and a concrete
  `reason`, so gesture-driven edges are distinguishable from insert/layout work.
- `user-repeated-edge` reports a new user gesture that began at an exact edge and continued
  toward the same edge. It is emitted at most once per gesture and carries no continuous phase.

## Required acceptance tests

1. Variable-height prepend and append preserve the selected anchor within 1px.
2. Follow-insert aligns the first or last inserted key at start, center, or end.
3. Repeated insertions never hide or discard previously supplied items.
4. Empty and underfilled content report both edges reached without a scroll event.
5. One edge episode emits once until geometry leaves and re-enters the edge.
6. Mutations execute FIFO; obsolete callbacks cannot advance a newer transaction.
7. Layout timeout and missing anchors always settle back to idle.
8. Deterministic mock tests contain no wall-clock sleeps.

## Adapter status

`LynxListDriver` translates `getVisibleCells`, `scrollToPosition`, and layout-complete
notifications into the headless driver contract. `BidirectionalList.tsx` owns the Lynx
rendering adapter, public controller, and edge episodes.
