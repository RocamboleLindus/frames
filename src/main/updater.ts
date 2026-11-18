import { app } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import type { UpdateOutcome } from '../shared/types'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

let pending: Promise<UpdateOutcome> | null = null

function updateError(error: unknown): Error {
  const message = error instanceof Error ? error.message : 'The update could not be installed.'
  const lower = message.toLowerCase()
  if (lower.includes('404') || lower.includes('no published versions') || lower.includes('releases')) {
    return new Error('No Frames release was found on GitHub.')
  }
  return new Error(message)
}

function runUpdate(): Promise<UpdateOutcome> {
  const version = app.getVersion()
  if (!app.isPackaged) return Promise.resolve({ state: 'dev', version })

  return new Promise((resolve, reject) => {
    let settled = false
    const timeout = setTimeout(() => done(new Error('The update timed out.')), 600000)

    const done = (error?: Error, outcome?: UpdateOutcome): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      autoUpdater.removeListener('error', onError)
      autoUpdater.removeListener('update-not-available', onNone)
      autoUpdater.removeListener('update-available', onAvailable)
      if (error) reject(error)
      else if (outcome) resolve(outcome)
    }

    const onError = (error: Error): void => done(updateError(error))
    const onNone = (): void => done(undefined, { state: 'current', version })
    const onAvailable = (info: UpdateInfo): void => {
      autoUpdater.removeListener('update-not-available', onNone)
      autoUpdater
        .downloadUpdate()
        .then(() => {
          if (settled) return
          done(undefined, { state: 'installing', version, latest: info.version })
          autoUpdater.quitAndInstall(true, true)
        })
        .catch((error: unknown) => done(updateError(error)))
    }

    autoUpdater.on('error', onError)
    autoUpdater.on('update-not-available', onNone)
    autoUpdater.on('update-available', onAvailable)
    autoUpdater.checkForUpdates().catch((error: unknown) => done(updateError(error)))
  })
}

export function installUpdate(): Promise<UpdateOutcome> {
  if (!pending) {
    pending = runUpdate().finally(() => {
      pending = null
    })
  }
  return pending
}
