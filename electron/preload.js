import { contextBridge } from 'electron'

/** Renderer-safe surface; extend later (e.g. ipcRenderer.invoke wrappers). */
contextBridge.exposeInMainWorld('electronAPI', {})
