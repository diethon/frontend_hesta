import { Component, Suspense, type ReactNode } from 'react';

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Shows the procedural model while the .glb loads, and keeps it if the file is missing or broken. */
export function WithTwinModel({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return <ModelBoundary fallback={fallback}><Suspense fallback={fallback}>{children}</Suspense></ModelBoundary>;
}
