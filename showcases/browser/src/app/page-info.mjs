// This code runs INSIDE the CEF website through webview.eval, not in Lynx MTS/BTS.
// Use the documented WebView message bridge, not internal cefQuery protocols.
// Never mutate the visited site's hash/history just to report metadata.
export const PAGE_INFO_SCRIPT = `
  window.postMessage(JSON.stringify({
    type: 'page_info',
    page_title: document.title || window.location.href,
    page_url: window.location.href
  }));
`;
