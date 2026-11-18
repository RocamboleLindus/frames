interface Props {
  solid: boolean
  folderCount: number
  imageCount: number
  busy: boolean
  adding: boolean
  refreshing: boolean
  updating: boolean
  version: string
  showLibraryActions: boolean
  onAdd: () => void
  onRefresh: () => void
  onUpdate: () => void
}

export function TopBar({
  solid,
  folderCount,
  imageCount,
  busy,
  adding,
  refreshing,
  updating,
  version,
  showLibraryActions,
  onAdd,
  onRefresh,
  onUpdate
}: Props) {
  const folderLabel = folderCount === 1 ? '1 folder' : `${folderCount.toLocaleString()} folders`
  const imageLabel = imageCount === 1 ? '1 image' : `${imageCount.toLocaleString()} images`

  return (
    <header className={solid ? 'topbar solid' : 'topbar'}>
      <button type="button" className="wordmark" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        FRAMES
      </button>
      {showLibraryActions && (
        <p className="nav-meta">
          {folderLabel} · {imageLabel}
        </p>
      )}
      <div className="nav-actions">
        {version && <span className="nav-version">v{version}</span>}
        {showLibraryActions && (
          <button type="button" className="btn-quiet" onClick={onRefresh} disabled={busy}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
        <button type="button" className="btn-quiet" onClick={onUpdate} disabled={busy}>
          {updating ? 'Updating…' : 'Update'}
        </button>
        <button type="button" className="btn-red" onClick={onAdd} disabled={busy}>
          {adding ? 'Working…' : 'Add folder'}
        </button>
      </div>
    </header>
  )
}
