// electron/handlers/files.js
import { ipcMain, dialog } from 'electron';

export function registerFileHandlers(mainWindow) {
  // Open file dialog
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });

    if (canceled) {
      return { success: false };
    }

    return { success: true, filePath: filePaths[0] };
  });
}