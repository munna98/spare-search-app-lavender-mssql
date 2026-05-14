import { ipcMain } from 'electron';
import {
  createCollection,
  getCollections,
  updateCollection,
  deleteCollection,
  setPosted,
} from '../database/collectionOperations.js';

export function registerCollectionHandlers() {
  ipcMain.handle('collections:getAll', async (event, filters) => {
    try {
      const collections = await getCollections(filters || {});
      return { success: true, collections };
    } catch (error) {
      return { success: false, message: error.message, collections: [] };
    }
  });

  ipcMain.handle('collections:create', async (event, data) => {
    try {
      const result = await createCollection(data);
      return {
        success: true,
        id: result.id,
        message: 'Collection recorded as pending',
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('collections:update', async (event, id, data) => {
    try {
      await updateCollection(id, data);
      return { success: true, message: 'Collection updated' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('collections:delete', async (event, id) => {
    try {
      await deleteCollection(id);
      return { success: true, message: 'Collection deleted' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('collections:setPosted', async (event, id) => {
    try {
      await setPosted(id);
      return { success: true, message: 'Marked as posted' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  });
}
