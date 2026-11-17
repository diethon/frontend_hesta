import type { LucideIcon } from 'lucide-react'

export function IconButton({ icon: Icon, label, active = false, onClick, disabled = false }: {
  icon: LucideIcon; label: string; active?: boolean; onClick: () => void; disabled?: boolean
}) {
  return <button type="button" className={`icon-button${active ? ' active' : ''}`} title={label} aria-label={label} aria-pressed={active} onClick={onClick} disabled={disabled}>
    <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
  </button>
}

export function Toggle({ on, label, disabled = false, onChange }: {
  on: boolean; label: string; disabled?: boolean; onChange: () => void
}) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`toggle${on ? ' on' : ''}`} onClick={onChange}><span /></button>
}
