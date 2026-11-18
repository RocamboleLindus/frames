import { useEffect, useRef, useState } from 'react'
import type { FolderRecord } from '@shared/types'
import { CarouselRow } from './components/CarouselRow'
import { EmptyState } from './components/EmptyState'
import { Hero } from './components/Hero'
import { ImageModal } from './components/ImageModal'
import { TopBar } from './components/TopBar'
import { errorMessage } from './lib/format'

interface Selection {
  folderPath: string
  imagePath: string
}

export default function App() {
  const [library, setLibrary] = useState<FolderRecord[]>([])
  const [booting, setBooting] = useState(true)
  const [shellMissing, setShellMissing] = useState(false)
  const [busyAction, setBusyAction] = useState<'add' | 'refresh' | 'remove' | 'update' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [version, setVersion] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [modal, setModal] = useState<Selection | null>(null)
  const busyRef = useRef(false)
  const addRef = useRef<() => void>(() => undefined)

  const imageCount = library.reduce((total, folder) => total + folder.images.length, 0)
  const featuredFolder = library.find((folder) => folder.images.length > 0)
  const featured = featuredFolder?.images[0]
  const activeFolder = modal ? library.find((folder) => folder.path === modal.folderPath) : undefined

  useEffect(() => {
    let cancelled = false
    if (!window.framesApp) {
      setShellMissing(true)
      setBooting(false)
      return
    }
    window.framesApp
      .getVersion()
      .then((value) => {
        if (!cancelled) setVersion(value)
      })
      .catch(() => undefined)
    window.framesApp
      .getLibrary()
      .then((rows) => {
        if (!cancelled) setLibrary(rows)
      })
      .catch((loadError) => {
        if (!cancelled) setError(errorMessage(loadError, 'Could not open the library.'))
      })
      .finally(() => {
        if (!cancelled) setBooting(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
        event.preventDefault()
        addRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!modal) {
      document.title = 'Frames'
      return
    }
    const folder = library.find((item) => item.path === modal.folderPath)
    const image = folder?.images.find((item) => item.path === modal.imagePath)
    document.title = image ? `${image.name} · Frames` : 'Frames'
    if (!folder || !image) setModal(null)
  }, [library, modal])

  async function run(action: 'add' | 'refresh' | 'remove', work: () => Promise<FolderRecord[]>): Promise<void> {
    if (busyRef.current) return
    busyRef.current = true
    setBusyAction(action)
    setError(null)
    try {
      setLibrary(await work())
    } catch (workError) {
      setError(errorMessage(workError, 'Something went wrong.'))
    } finally {
      busyRef.current = false
      setBusyAction(null)
    }
  }

  function addFolders(): void {
    void run('add', () => window.framesApp.addFolders())
  }

  async function updateApp(): Promise<void> {
    if (busyRef.current) return
    busyRef.current = true
    setBusyAction('update')
    setError(null)
    setNotice(null)
    try {
      const result = await window.framesApp.updateApp()
      if (result.state === 'dev') {
        setNotice('Updates install from the downloaded Frames app.')
      } else if (result.state === 'current') {
        setNotice(`Frames ${result.version} is the latest version.`)
      } else {
        setNotice(`Installing Frames ${result.latest ?? ''}. The app will restart.`)
      }
    } catch (updateError) {
      setError(errorMessage(updateError, 'The update could not be installed.'))
    } finally {
      busyRef.current = false
      setBusyAction(null)
    }
  }

  addRef.current = addFolders

  function openImage(folderPath: string, imagePath: string): void {
    setModal({ folderPath, imagePath })
  }

  if (booting || shellMissing) {
    return (
      <div className="boot">
        <p className="wordmark">FRAMES</p>
        {shellMissing && <p className="boot-note">Frames runs in its own window.</p>}
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar
        solid={scrolled || library.length === 0}
        folderCount={library.length}
        imageCount={imageCount}
        busy={busyAction !== null}
        adding={busyAction === 'add'}
        refreshing={busyAction === 'refresh'}
        updating={busyAction === 'update'}
        version={version}
        showLibraryActions={library.length > 0}
        onAdd={addFolders}
        onRefresh={() => void run('refresh', () => window.framesApp.refresh())}
        onUpdate={() => void updateApp()}
      />
      {notice && (
        <div className="notice-banner" role="status">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}
      {library.length === 0 ? (
        <EmptyState busy={busyAction !== null} onAdd={addFolders} />
      ) : (
        <main>
          {featuredFolder && featured ? (
            <Hero
              key={featured.path}
              folder={featuredFolder}
              image={featured}
              onView={() => openImage(featuredFolder.path, featured.path)}
              onExplorer={() => {
                void window.framesApp.showInFolder(featured.path).catch((explorerError) => {
                  setError(errorMessage(explorerError, 'Could not open Explorer.'))
                })
              }}
            />
          ) : (
            <section className="library-intro">
              <h1>No images yet</h1>
              <p>These folders have no supported images in them. Add a folder of pictures, or remove a row.</p>
            </section>
          )}
          <div className={featured ? 'rows overlap' : 'rows'}>
            {library.map((folder) => (
              <CarouselRow
                key={folder.path}
                folderName={folder.name}
                folderPath={folder.path}
                images={folder.images}
                note={
                  folder.error ??
                  (folder.images.length === 0
                    ? 'No images in this folder. Add a nested folder on its own if the pictures are inside it.'
                    : undefined)
                }
                onOpen={(imagePath) => openImage(folder.path, imagePath)}
                onRemove={() => void run('remove', () => window.framesApp.removeFolder(folder.path))}
              />
            ))}
          </div>
        </main>
      )}
      {activeFolder && modal && (
        <ImageModal
          folder={activeFolder}
          imagePath={modal.imagePath}
          onSelect={(imagePath) => setModal({ folderPath: activeFolder.path, imagePath })}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
