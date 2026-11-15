// Client-only experiment for the function-loader call sites in Navigator.
// This is scoped to the profiling build; Next and the offline build are untouched.
import { createElement, lazy, Suspense } from 'react';

export default function dynamic(loader, options = {}) {
  if (typeof loader !== 'function' || Object.keys(options).some(key => !['ssr', 'loading'].includes(key))) {
    throw new Error('Profile shim only supports function loaders and ssr/loading options');
  }
  const Component = lazy(async () => {
    const loaded = await loader();
    return { default: loaded.default ?? loaded };
  });
  return function ProfileDynamic(props) {
    const fallback = options.loading
      ? createElement(options.loading, { error: null, isLoading: true, pastDelay: true, timedOut: false })
      : null;
    return createElement(Suspense, { fallback }, createElement(Component, props));
  };
}
