import './preview.css';

// Account for Safari's expanding/collapsing toolbars without disabling pinch zoom.
export function installPreviewViewport(win, doc) {
  let viewport = doc.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = doc.createElement('meta'); viewport.name = 'viewport'; doc.head.appendChild(viewport);
  }
  viewport.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  const visual = win.visualViewport;
  let lastHeight = 0;
  const update = () => {
    if (visual && visual.scale !== 1) return;
    const height = visual?.height || win.innerHeight;
    if (Number.isFinite(height) && height > 0 && height !== lastHeight) {
      doc.documentElement.style.setProperty('--preview-height', `${height}px`);
      lastHeight = height;
    }
  };
  update();
  win.addEventListener('resize', update);
  win.addEventListener('orientationchange', update);
  win.addEventListener('pageshow', update);
  visual?.addEventListener('resize', update);
  return () => {
    win.removeEventListener('resize', update);
    win.removeEventListener('orientationchange', update);
    win.removeEventListener('pageshow', update);
    visual?.removeEventListener('resize', update);
  };
}
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const cleanup = installPreviewViewport(window, document);
  if (module.hot) module.hot.dispose(cleanup);
}
