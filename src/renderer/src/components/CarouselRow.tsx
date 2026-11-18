import { useEffect, useState } from 'react'
import type { ImageRecord } from '@shared/types'

interface CardProps {
  image: ImageRecord
  onOpen: () => void
}

function Card({ image, onOpen }: CardProps) {
  const [src, setSrc] = useState(image.thumbUrl)
  const [loaded, setLoaded] = useState(false)
  const [trackedUrl, setTrackedUrl] = useState(image.thumbUrl)
  if (trackedUrl !== image.thumbUrl) {
    setTrackedUrl(image.thumbUrl)
    setSrc(image.thumbUrl)
    setLoaded(false)
  }

  return (
    <button type="button" className="card" title={image.name} aria-label={image.name} onClick={onOpen}>
      <img
        src={src}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className={loaded ? 'loaded' : ''}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (src !== image.fullUrl) {
            setLoaded(false)
            setSrc(image.fullUrl)
          }
        }}
      />
      <span className="card-name">{image.name}</span>
    </button>
  )
}

interface Props {
  folderName: string
  folderPath: string
  images: ImageRecord[]
  note?: string
  onOpen: (imagePath: string) => void
  onRemove: () => void
}

export function CarouselRow({ folderName, folderPath, images, note, onOpen, onRemove }: Props) {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!node) return
    const update = (): void => {
      setCanLeft(node.scrollLeft > 8)
      setCanRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 8)
    }
    update()
    node.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => {
      node.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [node, images.length])

  function scrollByPage(direction: number): void {
    if (!node) return
    node.scrollBy({ left: direction * Math.max(node.clientWidth * 0.85, 240), behavior: 'smooth' })
  }

  return (
    <section className="row" aria-label={folderName}>
      <div className="row-head">
        <div className="row-heading">
          <h2 title={folderPath}>{folderName}</h2>
          <span className="row-count">{images.length === 1 ? '1 image' : `${images.length.toLocaleString()} images`}</span>
        </div>
        <button
          type="button"
          className={confirming ? 'row-remove confirming' : 'row-remove'}
          title="Removes this row from Frames. The files stay where they are."
          onMouseLeave={() => setConfirming(false)}
          onBlur={() => setConfirming(false)}
          onClick={() => {
            if (!confirming) {
              setConfirming(true)
              return
            }
            onRemove()
          }}
        >
          {confirming ? 'Remove row?' : 'Remove'}
        </button>
      </div>
      {note ? (
        <p className="row-note">{note}</p>
      ) : (
        <div className="row-body">
          <button type="button" className="row-arrow left" aria-label={`Scroll ${folderName} left`} disabled={!canLeft} onClick={() => scrollByPage(-1)}>
            <Chevron direction="left" />
          </button>
          <div className="row-scroller" ref={setNode}>
            {images.map((image) => (
              <Card key={image.path} image={image} onOpen={() => onOpen(image.path)} />
            ))}
          </div>
          <button type="button" className="row-arrow right" aria-label={`Scroll ${folderName} right`} disabled={!canRight} onClick={() => scrollByPage(1)}>
            <Chevron direction="right" />
          </button>
        </div>
      )}
    </section>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className={direction === 'left' ? 'chevron left' : 'chevron'} width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
