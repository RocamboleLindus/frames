import { useEffect, useRef, useState } from 'react'
import { typeLabel, type FolderRecord, type ImageDetails, type ImageRecord } from '@shared/types'
import { Chevron, CloseIcon, FolderIcon } from './icons'
import { errorMessage, formatBytes, formatWhen } from '../lib/format'

interface Props {
  folder: FolderRecord
  imagePath: string
  onSelect: (imagePath: string) => void
  onClose: () => void
}

export function ImageModal({ folder, imagePath, onSelect, onClose }: Props) {
  const index = folder.images.findIndex((image) => image.path === imagePath)
  const image = index >= 0 ? folder.images[index] : null
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [details, setDetails] = useState<ImageDetails | null>(null)
  const [detailsFailed, setDetailsFailed] = useState(false)
  const [explorerError, setExplorerError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previous?.focus()
    }
  }, [])

  useEffect(() => {
    if (!image) return
    let cancelled = false
    setDetails(null)
    setDetailsFailed(false)
    setExplorerError(null)
    setReady(false)
    setBroken(false)
    window.framesApp
      .getDetails(image.path)
      .then((next) => {
        if (!cancelled) setDetails(next)
      })
      .catch(() => {
        if (!cancelled) setDetailsFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [image])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (index < 0 || folder.images.length < 2) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const delta = event.key === 'ArrowLeft' ? -1 : 1
      const next = folder.images[(index + delta + folder.images.length) % folder.images.length]
      onSelect(next.path)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [folder.images, index, onClose, onSelect])

  useEffect(() => {
    const selected = dialogRef.current?.querySelector<HTMLElement>('.filmstrip [aria-current="true"]')
    selected?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [imagePath])

  if (!image) return null

  const multiple = folder.images.length > 1
  const loadingDetails = details === null && !detailsFailed
  const exifRows = exifLines(details)

  async function openExplorer(): Promise<void> {
    setExplorerError(null)
    try {
      await window.framesApp.showInFolder(image!.path)
    } catch (error) {
      setExplorerError(errorMessage(error, 'Could not open Explorer.'))
    }
  }

  function step(delta: number): void {
    const next = folder.images[(index + delta + folder.images.length) % folder.images.length]
    onSelect(next.path)
  }

  function choose(path: string, scrollUp: boolean): void {
    onSelect(path)
    if (scrollUp) dialogRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
        <div className="modal-grid">
          <div className="modal-gallery">
            <div className="stage">
              {broken ? (
                <p className="stage-fallback">No preview for this file. You can still open it in Explorer.</p>
              ) : (
                <img
                  className={ready ? 'stage-img ready' : 'stage-img'}
                  src={image.fullUrl}
                  alt={image.name}
                  draggable={false}
                  onLoad={() => setReady(true)}
                  onError={() => setBroken(true)}
                />
              )}
              {multiple && (
                <>
                  <button type="button" className="stage-arrow left" aria-label="Previous image" onClick={() => step(-1)}>
                    <Chevron direction="left" />
                  </button>
                  <button type="button" className="stage-arrow right" aria-label="Next image" onClick={() => step(1)}>
                    <Chevron direction="right" />
                  </button>
                  <p className="stage-count">
                    {index + 1} / {folder.images.length}
                  </p>
                </>
              )}
            </div>
            {multiple && (
              <div className="filmstrip">
                {folder.images.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className={item.path === image.path ? 'selected' : ''}
                    aria-label={item.name}
                    aria-current={item.path === image.path}
                    onClick={() => choose(item.path, false)}
                  >
                    <Thumb image={item} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="modal-copy">
            <h2 id="image-title" className="modal-title" title={image.name}>
              {image.name}
            </h2>
            <p className="filepath" title={image.path}>
              {image.path}
            </p>
            <button type="button" className="explorer-btn" onClick={() => void openExplorer()}>
              <FolderIcon />
              Open in Explorer
            </button>
            {explorerError && <p className="inline-error">{explorerError}</p>}
            <section className="meta" aria-label="Metadata">
              <h3>Metadata</h3>
              <dl>
                <MetaRow label="Dimensions" value={dimensionLabel(details, loadingDetails, detailsFailed)} />
                <MetaRow label="File size" value={formatBytes(image.size)} />
                <MetaRow label="Type" value={typeLabel(image.ext)} />
                <MetaRow label="Created" value={formatWhen(image.createdAt)} />
                <MetaRow label="Modified" value={formatWhen(image.modifiedAt)} />
                {exifRows.map(([label, value]) => (
                  <MetaRow key={label} label={label} value={value} />
                ))}
              </dl>
              {detailsFailed && <p className="meta-note">Photo details could not be read.</p>}
              {details && exifRows.length === 0 && <p className="meta-note">No camera metadata in this file.</p>}
            </section>
          </div>
        </div>
        {multiple && (
          <section className="modal-more" aria-label={`More in ${folder.name}`}>
            <h3>More in {folder.name}</h3>
            <div className="more-scroller">
              {folder.images.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  className={item.path === image.path ? 'more-card selected' : 'more-card'}
                  onClick={() => choose(item.path, true)}
                >
                  <Thumb image={item} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Thumb({ image }: { image: ImageRecord }) {
  const [src, setSrc] = useState(image.thumbUrl)
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (src !== image.fullUrl) setSrc(image.fullUrl)
      }}
    />
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function dimensionLabel(details: ImageDetails | null, loading: boolean, failed: boolean): string {
  if (loading) return 'Reading…'
  if (failed || !details?.width || !details.height) return 'Unavailable'
  const megapixels = (details.width * details.height) / 1_000_000
  const base = `${details.width.toLocaleString()} × ${details.height.toLocaleString()}`
  return megapixels >= 0.1 ? `${base} · ${megapixels.toFixed(1)} MP` : base
}

function exifLines(details: ImageDetails | null): Array<[string, string]> {
  if (!details) return []
  const rows: Array<[string, string]> = []
  if (details.takenAt) rows.push(['Taken', formatWhen(details.takenAt, 'UTC')])
  if (details.camera) rows.push(['Camera', details.camera])
  if (details.lens) rows.push(['Lens', details.lens])
  if (details.exposure) rows.push(['Exposure', details.exposure])
  if (details.iso) rows.push(['ISO', details.iso])
  if (details.gps) rows.push(['GPS', details.gps])
  return rows
}
