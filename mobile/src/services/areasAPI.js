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

  create: async (areaData) => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .insert(areaData)
        .select()
        .single();

      if (error) throw error;
      return { data: { area: data } };
    } catch (error) {
      console.error('Error creating area:', error);
      throw error;
    }
  },

  update: async (areaId, areaData) => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .update(areaData)
        .eq('areaId', areaId)
        .select()
        .single();

      if (error) throw error;
      return { data: { area: data } };
    } catch (error) {
      console.error('Error updating area:', error);
      throw error;
    }
  },

  delete: async (areaId) => {
    try {
      const { error } = await supabase
        .from('areas')
        .delete()
        .eq('areaId', areaId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting area:', error);
      throw error;
    }
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

  // Initialize default areas if table is empty
  initializeDefaultAreas: async () => {
    try {
      // Check if areas table is empty
      const { data: existingAreas, error: checkError } = await supabase
        .from('areas')
        .select('areaId')
        .limit(1);

      if (checkError) throw checkError;

      // If areas exist, don't initialize
      if (existingAreas && existingAreas.length > 0) {
        console.log('Areas table already has data, skipping initialization');
        return { data: { initialized: false } };
      }

      // Insert default areas
      const defaultAreas = [
        {
          areaId: 1,
          name_arabic: 'القدس',
          name_english: 'Jerusalem',
          name_hebrew: 'ירושלים',
          preferred_language_1: 'ar',
          preferred_language_2: 'en'
        },
        {
          areaId: 2,
          name_arabic: 'تل أبيب',
          name_english: 'Tel Aviv',
          name_hebrew: 'תל אביב',
          preferred_language_1: 'he',
          preferred_language_2: 'en'
        },
        {
          areaId: 3,
          name_arabic: 'حيفا',
          name_english: 'Haifa',
          name_hebrew: 'חיפה',
          preferred_language_1: 'he',
          preferred_language_2: 'ar'
        },
        {
          areaId: 4,
          name_arabic: 'بئر السبع',
          name_english: 'Beer Sheva',
          name_hebrew: 'באר שבע',
          preferred_language_1: 'he',
          preferred_language_2: 'ar'
        },
        {
          areaId: 5,
          name_arabic: 'الناصرة',
          name_english: 'Nazareth',
          name_hebrew: 'נצרת',
          preferred_language_1: 'ar',
          preferred_language_2: 'he'
        }
      ];

      const { data, error } = await supabase
        .from('areas')
        .insert(defaultAreas)
        .select();

      if (error) throw error;

      console.log(`Initialized ${data.length} default areas`);
      return { data: { initialized: true, areas: data } };
    } catch (error) {
      console.error('Error initializing default areas:', error);
      throw error;
    }
  }
}; 