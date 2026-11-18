import { contextBridge, ipcRenderer } from 'electron'
import type { FramesApi } from '../shared/types'

const api: FramesApi = {
  getLibrary: () => ipcRenderer.invoke('library:get'),
  addFolders: () => ipcRenderer.invoke('library:add'),
  removeFolder: (folderPath) => ipcRenderer.invoke('library:remove', folderPath),
  refresh: () => ipcRenderer.invoke('library:refresh'),
  chooseBanner: () => ipcRenderer.invoke('library:banner'),
  getDetails: (filePath) => ipcRenderer.invoke('image:details', filePath),
  showInFolder: (filePath) => ipcRenderer.invoke('image:show', filePath),
  getVersion: () => ipcRenderer.invoke('app:version'),
  updateApp: () => ipcRenderer.invoke('app:update')
}

contextBridge.exposeInMainWorld('framesApp', api)
