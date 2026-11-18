import { useState } from 'react'
import { typeLabel, type ImageRecord } from '@shared/types'
import { formatBytes } from '../lib/format'

interface Props {
  folderName: string
  image: ImageRecord
  busy: boolean
  choosing: boolean
  onView: () => void
  onExplorer: () => void
  onChoose: () => void
}

export function Hero({ folderName, image, busy, choosing, onView, onExplorer, onChoose }: Props) {
  const [src, setSrc] = useState(image.heroUrl)
  const [loaded, setLoaded] = useState(false)

  return (
    <section className="hero" aria-label="Featured image">
      <img
        className={loaded ? 'hero-img loaded' : 'hero-img'}
        src={src}
        alt=""
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (src !== image.fullUrl) setSrc(image.fullUrl)
        }}
      />
      <div className="hero-shade" />
      <div className="hero-copy">
        <p className="eyebrow">{folderName}</p>
        <h1 className="hero-title">{image.name}</h1>
        <p className="hero-meta">
          {typeLabel(image.ext)} · {formatBytes(image.size)}
        </p>
        <div className="hero-actions">
          <button type="button" className="btn-light" onClick={onView}>
            View
          </button>
          <button type="button" className="btn-ghost" onClick={onExplorer}>
            Open in Explorer
          </button>
          <button type="button" className="btn-ghost" onClick={onChoose} disabled={busy}>
            {choosing ? 'Choosing…' : 'Choose banner'}
          </button>
        </div>
      </div>
    </section>
  )
}
