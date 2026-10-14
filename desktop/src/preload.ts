import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopAPI } from './api';

const api: DesktopAPI = {
  generate: (fields, model) => ipcRenderer.invoke('pixelkey:generate', fields, model),
  login: model => ipcRenderer.invoke('pixelkey:login', model),
  paste: () => ipcRenderer.invoke('pixelkey:paste'),
  copy: () => ipcRenderer.invoke('pixelkey:copy'),
  clear: () => ipcRenderer.invoke('pixelkey:clear'),
  touch: () => ipcRenderer.send('pixelkey:touch'),
  onClear: listener => {
    const handler = () => listener();
    ipcRenderer.on('pixelkey:cleared', handler);
    return () => ipcRenderer.removeListener('pixelkey:cleared', handler);
  },
};
contextBridge.exposeInMainWorld('pixelkey', api);
