import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Box, RotateCcw } from 'lucide-react'

export default class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('HESTA demo scene:', error, info.componentStack) }
  render() {
    if (this.state.failed) return <div className="scene-fallback" role="alert"><Box size={36} /><h2>Chưa thể khởi tạo không gian 3D</h2><p>Hãy bật tăng tốc đồ họa trong trình duyệt rồi tải lại demo.</p><button type="button" onClick={() => window.location.reload()}><RotateCcw size={16} />Tải lại demo</button></div>
    return this.props.children
  }
}
