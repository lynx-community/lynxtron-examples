const WEB_BUNDLE_URL = './main.web.bundle';

function mountLynxView(): void {
  if (typeof document === 'undefined') return;

  const container = document.getElementById('app');
  if (!container) {
    throw new Error('Missing #app container for pc-mouse-cursor web host');
  }

  const lynxView = document.createElement('lynx-view');
  lynxView.setAttribute('url', WEB_BUNDLE_URL);
  lynxView.setAttribute('thread-strategy', 'all-on-ui');

  container.replaceChildren(lynxView);
}

function bootstrapWebHost(): void {
  if (typeof document !== 'undefined') {
    document.title = 'PC Mouse Cursor';
  }

  mountLynxView();

  console.log('[pc-mouse-cursor] web host ready');
}

bootstrapWebHost();
