import { SUPPORTED_LABELS } from '@shared/types'

interface Props {
  busy: boolean
  onAdd: () => void
}

export function EmptyState({ busy, onAdd }: Props) {
  return (
    <section className="empty">
      <h1>Your pictures, in rows.</h1>
      <p className="empty-copy">
        Add a folder and it becomes a carousel. Each image in that folder shows up as its own title.
        Pictures inside subfolders stay where they are until you add those folders too.
      </p>
      <button type="button" className="btn-red large" onClick={onAdd} disabled={busy}>
        {busy ? 'Working…' : 'Add folder'}
      </button>
      <p className="empty-formats">{SUPPORTED_LABELS.join(' · ')} · Ctrl+O to add a folder</p>
    </section>
  )
}
