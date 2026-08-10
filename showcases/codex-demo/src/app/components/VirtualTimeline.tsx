/**
 * Compatibility alias for callers that still use the former component name.
 *
 * The implementation lives in ChatList so every conversation consumer goes
 * through BidirectionalList's stable ListSignalEvent boundary. Do not restore
 * native Lynx list event handling here.
 */
export { ChatList as VirtualTimeline } from './chat-list';
export type { ChatListHandle as VirtualTimelineHandle } from './chat-list';
