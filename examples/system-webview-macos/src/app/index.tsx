import { root } from '@lynx-js/react';

const page = `<!doctype html>
<html lang="en"><meta charset="utf-8"><title>System WebView</title>
<style>
  body { font: 18px system-ui; margin: 24px; color: #20242a; }
  button { font: inherit; padding: 6px 14px; }
</style>
<h1>Inside WKWebView</h1>
<p>This page is rendered by the copy of WebKit installed on your Mac.</p>
<button onclick="this.textContent = 'Count: ' + (++count)">Count: 0</button>
<script>let count = 0;</script>
</html>`;

root.render(
  <view style={{ height: '100%', padding: '16px', backgroundColor: '#f4f5f7' }}>
    <text style={{ color: '#20242a', fontSize: '20px', marginBottom: '12px' }}>Lynx desktop window</text>
    <system-webview html={page} style={{ width: '100%', height: '280px' }} />
  </view>,
);
