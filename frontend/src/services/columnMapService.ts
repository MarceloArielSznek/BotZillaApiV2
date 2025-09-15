import { api } from '../config/api';

export interface ColumnMapping {
  id: number;
  field_name: string;
  column_index: number;
  type: 'field' | 'crew_member';
  header_name?: string;
}

export interface SheetColumnMap {
  sheet_name: string;
  columns: ColumnMapping[];
}

export interface GroupedColumnMaps {
  [sheetName: string]: ColumnMapping[];
}

export interface UpdateColumnMappingData {
  field_name?: string;
  type?: 'field' | 'crew_member';
  header_name?: string;
}

const columnMapService = {
  // GET /api/column-map - Obtener todos los column maps agrupados por sheet
  getAllColumnMaps: async (): Promise<GroupedColumnMaps> => {
    try {
      const response = await api.get('/column-map');
      
      // Manejo defensivo de la respuesta
      if (!response || !response.data) {
        console.warn('Empty response from column maps API');
        return {};
      }
      
      // La respuesta puede tener diferentes estructuras
      if (response.data.data) {
        return response.data.data;
      }
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      // Si la respuesta es directamente el objeto agrupado
      if (typeof response.data === 'object' && !Array.isArray(response.data)) {
        return response.data;
      }
      
      console.warn('Unexpected column maps response structure:', response.data);
      return {};
    } catch (error: any) {
      console.error('Error fetching column maps:', error.response?.data || error.message);
      // En lugar de hacer throw, devolver objeto vacío
      return {};
    }
  },

  // GET /api/column-map/:sheetName - Obtener column map para una sheet específica
  getColumnMapBySheet: async (sheetName: string): Promise<SheetColumnMap> => {
    try {
      const response = await api.get(`/column-map/${encodeURIComponent(sheetName)}`);
      return {
        sheet_name: response.data.sheet_name,
        columns: response.data.columns || []
      };
    } catch (error: any) {
      console.error(`Error fetching column map for sheet ${sheetName}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // PUT /api/column-map/:id - Actualizar un mapping específico
  updateColumnMapping: async (id: number, data: UpdateColumnMappingData): Promise<ColumnMapping> => {
    try {
      const response = await api.put(`/column-map/${id}`, data);
      return response.data.data;
    } catch (error: any) {
      console.error(`Error updating column mapping ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // DELETE /api/column-map/:sheetName - Eliminar todos los mappings de una sheet
  deleteColumnMapBySheet: async (sheetName: string): Promise<{ deletedCount: number }> => {
    try {
      const response = await api.delete(`/column-map/${encodeURIComponent(sheetName)}`);
      return { deletedCount: response.data.deletedCount };
    } catch (error: any) {
      console.error(`Error deleting column mappings for sheet ${sheetName}:`, error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/automations/column-map/sync - Sincronizar column map desde headers
  syncColumnMap: async (sheetName: string, headerRow: string[], dryRun: boolean = false): Promise<any> => {
    try {
      const response = await api.post(`/automations/column-map/sync?dryRun=${dryRun}`, {
        sheet_name: sheetName,
        header_row: headerRow
      });
      return response.data;
    } catch (error: any) {
      console.error(`Error syncing column map for sheet ${sheetName}:`, error.response?.data || error.message);
      throw error;
    }
  }
};

export default columnMapService;
