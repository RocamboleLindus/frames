import { useState } from 'react'
import { typeLabel, type FolderRecord, type ImageRecord } from '@shared/types'
import { formatBytes } from '../lib/format'

interface Props {
  folder: FolderRecord
  image: ImageRecord
  onView: () => void
  onExplorer: () => void
}

export function Hero({ folder, image, onView, onExplorer }: Props) {
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
        <p className="eyebrow">{folder.name}</p>
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
        </div>
      </div>
    </section>
  )
}
