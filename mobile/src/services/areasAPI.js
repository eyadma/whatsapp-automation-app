import { supabase } from './supabase';

export const areasAPI = {
  getAll: async () => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('name_english', { ascending: true });

      if (error) throw error;
      return { data: { areas: data || [] } };
    } catch (error) {
      console.error('Error fetching areas:', error);
      return { data: { areas: [] } };
    }
  },

  getById: async (areaId) => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .eq('areaId', areaId)
        .single();

      if (error) {
        // If area not found, return null instead of throwing
        if (error.code === 'PGRST116') {
          console.warn(`Area with ID ${areaId} not found`);
          return { data: { area: null } };
        }
        throw error;
      }
      
      return { data: { area: data } };
    } catch (error) {
      console.error('Error fetching area by ID:', error);
      return { data: { area: null } };
    }
  },

  // NOTE: Areas table is read-only for normal users
  // Only admins can create/update/delete areas
  // These functions are kept for admin use only
  
  create: async (areaData) => {
    console.warn('⚠️ Areas table is read-only for normal users. Only admins can create areas.');
    throw new Error('Areas table is read-only for normal users. Contact admin to add areas.');
  },

  update: async (areaId, areaData) => {
    console.warn('⚠️ Areas table is read-only for normal users. Only admins can update areas.');
    throw new Error('Areas table is read-only for normal users. Contact admin to modify areas.');
  },

  delete: async (areaId) => {
    console.warn('⚠️ Areas table is read-only for normal users. Only admins can delete areas.');
    throw new Error('Areas table is read-only for normal users. Contact admin to delete areas.');
  },

  getByPreferredLanguage: async (language) => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .or(`preferred_language_1.eq.${language},preferred_language_2.eq.${language}`)
        .order('name_english', { ascending: true });

      if (error) throw error;
      return { data: { areas: data || [] } };
    } catch (error) {
      console.error('Error fetching areas by language:', error);
      return { data: { areas: [] } };
    }
  },

  search: async (searchTerm, language = 'en') => {
    try {
      let query = supabase
        .from('areas')
        .select('*');

      // Search in appropriate language field
      switch (language) {
        case 'ar':
          query = query.ilike('name_arabic', `%${searchTerm}%`);
          break;
        case 'he':
          query = query.ilike('name_hebrew', `%${searchTerm}%`);
          break;
        default:
          query = query.ilike('name_english', `%${searchTerm}%`);
      }

      const { data, error } = await query.order('name_english', { ascending: true });

      if (error) throw error;
      return { data: { areas: data || [] } };
    } catch (error) {
      console.error('Error searching areas:', error);
      return { data: { areas: [] } };
    }
  },

  getAreaName: (area, language = 'en') => {
    if (!area) return 'Unknown Area';
    
    switch (language) {
      case 'ar':
        return area.name_arabic || area.name_english || 'منطقة غير معروفة';
      case 'he':
        return area.name_hebrew || area.name_english || 'אזור לא ידוע';
      default:
        return area.name_english || area.name_arabic || area.name_hebrew || 'Unknown Area';
    }
  },

  getAreaNames: (areas, language = 'en') => {
    return areas.map(area => areasAPI.getAreaName(area, language));
  },

  // Initialize default areas if table is empty - DISABLED FOR SECURITY
  initializeDefaultAreas: async () => {
    console.warn('⚠️ initializeDefaultAreas is DISABLED - areas table is read-only for normal users');
    console.warn('⚠️ Only admins can modify areas. Contact admin to add areas.');
    throw new Error('Areas table is read-only for normal users. Contact admin to add areas.');
  }
}; 