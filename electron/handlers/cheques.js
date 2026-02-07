import { ipcMain } from 'electron';
import {
    createCheque,
    getCheques,
    updateCheque,
    deleteCheque,
    getChequeById,
    getPendingChequeAlerts
} from '../database/chequeOperations.js';

export function registerChequeHandlers() {
    // Get all cheques with optional filtering
    ipcMain.handle('cheques:getAll', async (event, filters) => {
        try {
            const cheques = await getCheques(filters);
            return { success: true, cheques };
        } catch (error) {
            return { success: false, message: error.message, cheques: [] };
        }
    });

    // Get single cheque by ID
    ipcMain.handle('cheques:getById', async (event, chequeId) => {
        try {
            const cheque = await getChequeById(chequeId);
            return { success: true, cheque };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Create new cheque
    ipcMain.handle('cheques:create', async (event, chequeData) => {
        try {
            const result = await createCheque(chequeData);
            return { success: true, chequeId: result.id, message: 'Cheque created successfully' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Update existing cheque
    ipcMain.handle('cheques:update', async (event, chequeId, chequeData) => {
        try {
            await updateCheque(chequeId, chequeData);
            return { success: true, message: 'Cheque updated successfully' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Delete cheque
    ipcMain.handle('cheques:delete', async (event, chequeId) => {
        try {
            await deleteCheque(chequeId);
            return { success: true, message: 'Cheque deleted successfully' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    // Get pending cheque alerts
    ipcMain.handle('cheques:getPendingAlerts', async () => {
        try {
            const alerts = await getPendingChequeAlerts();
            return { success: true, alerts };
        } catch (error) {
            return { success: false, message: error.message, alerts: [] };
        }
    });
}
