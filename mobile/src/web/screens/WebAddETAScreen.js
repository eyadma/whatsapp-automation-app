import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { AppContext } from '../../context/AppContext';

// Import web-compatible components
import WebCompatibleButton from '../components/WebCompatibleButton';
import WebCompatibleTextInput from '../components/WebCompatibleTextInput';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatiblePicker from '../components/WebCompatiblePicker';

const WebAddETAScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [areas, setAreas] = useState([]);
  const [userETAs, setUserETAs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState(null);
  const [etaTime, setEtaTime] = useState('12:00');
  const [rangeEndTime, setRangeEndTime] = useState('13:00');
  const [etaFormat, setEtaFormat] = useState('range');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAreas(),
        loadUserETAs(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('areas')
        .select('*')
        .order('name_english');

      if (error) {
        console.error('Error loading areas:', error);
        return;
      }

      setAreas(data || []);
    } catch (error) {
      console.error('Error loading areas:', error);
    }
  };

  const loadUserETAs = async () => {
    try {
      const { data, error } = await supabase
        .from('user_etas')
        .select(`
          *,
          areas (
            area_id,
            name_english,
            name_arabic,
            name_hebrew
          )
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Error loading user ETAs:', error);
        return;
      }

      setUserETAs(data || []);
    } catch (error) {
      console.error('Error loading user ETAs:', error);
    }
  };

  const handleSaveETA = async () => {
    if (!selectedArea) {
      Alert.alert('Error', 'Please select an area');
      return;
    }

    if (!etaTime) {
      Alert.alert('Error', 'Please enter ETA time');
      return;
    }

    if (etaFormat === 'range' && !rangeEndTime) {
      Alert.alert('Error', 'Please enter end time for range');
      return;
    }

    try {
      const etaData = {
        user_id: userId,
        area_id: selectedArea.area_id,
        eta_time: etaTime,
        eta_format: etaFormat,
        range_end_time: etaFormat === 'range' ? rangeEndTime : null,
      };

      const { error } = await supabase
        .from('user_etas')
        .upsert(etaData);

      if (error) {
        console.error('Error saving ETA:', error);
        Alert.alert('Error', 'Failed to save ETA');
        return;
      }

      Alert.alert('Success', 'ETA saved successfully');
      loadUserETAs();
      
      // Reset form
      setSelectedArea(null);
      setEtaTime('12:00');
      setRangeEndTime('13:00');
      setEtaFormat('range');
    } catch (error) {
      console.error('Error saving ETA:', error);
      Alert.alert('Error', 'Failed to save ETA');
    }
  };

  const handleDeleteETA = async (eta) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ETA for ${getLocalizedAreaName(eta.areas)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('user_etas')
                .delete()
                .eq('id', eta.id);

              if (error) {
                console.error('Error deleting ETA:', error);
                Alert.alert('Error', 'Failed to delete ETA');
                return;
              }

              Alert.alert('Success', 'ETA deleted successfully');
              loadUserETAs();
            } catch (error) {
              console.error('Error deleting ETA:', error);
              Alert.alert('Error', 'Failed to delete ETA');
            }
          },
        },
      ]
    );
  };

  const getLocalizedAreaName = (area) => {
    if (!area) return 'Unknown Area';
    
    switch (language) {
      case 'ar':
        return area.name_arabic || area.name_english;
      case 'he':
        return area.name_hebrew || area.name_english;
      default:
        return area.name_english;
    }
  };

  const formatTime = (time) => {
    if (!time) return '';
    return time;
  };

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          Manage Area ETAs
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Set estimated arrival times for different areas
        </WebCompatibleParagraph>
      </View>

      {/* Add New ETA */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Add New ETA
          </WebCompatibleTitle>
          
          <WebCompatiblePicker
            selectedValue={selectedArea?.area_id}
            onValueChange={(value) => {
              const area = areas.find(a => a.area_id === value);
              setSelectedArea(area);
            }}
            style={dynamicStyles.picker}
          >
            <WebCompatiblePicker.Item label="Select area..." value={null} />
            {areas.map(area => (
              <WebCompatiblePicker.Item
                key={area.area_id}
                label={getLocalizedAreaName(area)}
                value={area.area_id}
              />
            ))}
          </WebCompatiblePicker>

          <WebCompatiblePicker
            selectedValue={etaFormat}
            onValueChange={setEtaFormat}
            style={dynamicStyles.picker}
          >
            <WebCompatiblePicker.Item label="Single Time" value="single" />
            <WebCompatiblePicker.Item label="Time Range" value="range" />
          </WebCompatiblePicker>

          <WebCompatibleTextInput
            label="Start Time"
            value={etaTime}
            onChangeText={setEtaTime}
            placeholder="12:00"
            style={dynamicStyles.input}
          />

          {etaFormat === 'range' && (
            <WebCompatibleTextInput
              label="End Time"
              value={rangeEndTime}
              onChangeText={setRangeEndTime}
              placeholder="13:00"
              style={dynamicStyles.input}
            />
          )}

          <WebCompatibleButton
            mode="contained"
            onPress={handleSaveETA}
            style={dynamicStyles.saveButton}
          >
            Save ETA
          </WebCompatibleButton>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Current ETAs */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Your Area ETAs ({userETAs.length})
          </WebCompatibleTitle>
          
          {userETAs.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <WebCompatibleParagraph style={dynamicStyles.emptyText}>
                No ETAs set yet. Add your first ETA above.
              </WebCompatibleParagraph>
            </View>
          ) : (
            <View style={dynamicStyles.etaList}>
              {userETAs.map(eta => (
                <View key={eta.id} style={dynamicStyles.etaItem}>
                  <View style={dynamicStyles.etaInfo}>
                    <Text style={dynamicStyles.etaArea}>
                      {getLocalizedAreaName(eta.areas)}
                    </Text>
                    <Text style={dynamicStyles.etaTime}>
                      {eta.eta_format === 'range' 
                        ? `${formatTime(eta.eta_time)} - ${formatTime(eta.range_end_time)}`
                        : formatTime(eta.eta_time)
                      }
                    </Text>
                    <Text style={dynamicStyles.etaFormat}>
                      {eta.eta_format === 'range' ? 'Time Range' : 'Single Time'}
                    </Text>
                  </View>
                  <View style={dynamicStyles.etaActions}>
                    <WebCompatibleButton
                      mode="outlined"
                      onPress={() => handleDeleteETA(eta)}
                      style={dynamicStyles.deleteButton}
                    >
                      Delete
                    </WebCompatibleButton>
                  </View>
                </View>
              ))}
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Instructions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Instructions
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Select an area from the dropdown list
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Choose between single time or time range format
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • Enter the time in HH:MM format (24-hour)
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • For time ranges, enter both start and end times
          </WebCompatibleParagraph>
          <WebCompatibleParagraph style={dynamicStyles.instructionText}>
            • ETAs will be used in message templates for customers
          </WebCompatibleParagraph>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>
    </ScrollView>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  header: {
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  picker: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 16,
    minWidth: 120,
  },
  emptyContainer: {
    textAlign: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  etaList: {
    gap: 16,
  },
  etaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  etaInfo: {
    flex: 1,
  },
  etaArea: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  etaTime: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 4,
  },
  etaFormat: {
    fontSize: 14,
    color: '#999999',
  },
  etaActions: {
    marginLeft: 16,
  },
  deleteButton: {
    borderColor: '#F44336',
    minWidth: 80,
  },
  instructionText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
});

export default WebAddETAScreen;
