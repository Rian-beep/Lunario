// Client-only adapter for this app's function-loader next/dynamic call sites.
import { Component, createElement, lazy, Suspense } from 'react';

class ViewBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return createElement('section', { role: 'alert', className: 'panel' },
      createElement('p', null, 'This view could not load. Reload the page to try again.'),
      createElement('button', { type: 'button', onClick: () => window.location.reload() }, 'Reload page'));
    return this.props.children;
  }
}

export default function dynamic(loader, options = {}) {
  if (typeof loader !== 'function' || Object.keys(options).some(key => !['ssr', 'loading'].includes(key))) {
    throw new Error('Hosted dynamic supports function loaders and ssr/loading options only');
  }
  const Loaded = lazy(async () => {
    const loaded = await loader();
    return { default: loaded.default ?? loaded };
  });
  return function HostedDynamic(props) {
    const fallback = options.loading
      ? createElement(options.loading, { error: null, isLoading: true, pastDelay: true, timedOut: false })
      : null;
    // A reload deliberately renews React's cached rejected lazy identity and the
    // browser module graph. Resetting only an error boundary would not retry it.
    return createElement(ViewBoundary, null,
      createElement(Suspense, { fallback }, createElement(Loaded, props)));
  };
}
