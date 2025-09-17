import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Card, ActivityIndicator, Divider, useTheme } from 'react-native-paper';
import { Picker } from '@react-native-picker/picker';
import { AppContext } from '../context/AppContext';
import { enhancedMessageAPI } from '../services/enhancedMessageAPI';
import { areasAPI } from '../services/areasAPI';
import { supabase } from '../services/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';

const AddETAScreen = ({ navigation, route }) => {
  const { userId, t } = useContext(AppContext);
  const paperTheme = useTheme();
  const dynamicStyles = createStyles(paperTheme);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState([]);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [eta, setEta] = useState('');
  const [areaETAs, setAreaETAs] = useState({});

  // New state for ETA format
  const [etaFormat, setEtaFormat] = useState('single'); // 'single' | 'range'
  const [singleTime, setSingleTime] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [pickerTarget, setPickerTarget] = useState(null); // 'single' | 'start' | 'end'
  
  useEffect(() => {
    loadAreasAndETAs();
  }, [userId]);
  
  const formatTime = (date) => {
    try {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  };
  
  const handleTimePicked = (event, selectedDate) => {
    if (!pickerTarget) return;
    if (event?.type === 'dismissed') {
      setPickerTarget(null);
      return;
    }
    const date = selectedDate || new Date();
    if (pickerTarget === 'single') setSingleTime(date);
    if (pickerTarget === 'start') setStartTime(date);
    if (pickerTarget === 'end') setEndTime(date);
    setPickerTarget(null);
  };

  const loadAreasAndETAs = async () => {
    setLoading(true);
    try {
      // Build the area list from the user's customers only
      const { data: customerAreas, error: custErr } = await supabase
        .from('customers')
        .select('areaId')
        .eq('user_id', userId);

      if (custErr) throw custErr;

      const areaIds = [...new Set((customerAreas || []).map(c => c.areaId).filter(id => id != null))];

      let userAreas = [];
      if (areaIds.length > 0) {
        const { data: areasRows, error: areasErr } = await supabase
          .from('areas')
          .select('*')
          .in('areaId', areaIds)
          .order('name_english', { ascending: true });
        if (areasErr) throw areasErr;
        userAreas = areasRows || [];
      }

      // Load ETAs for this user
      const etasResp = await enhancedMessageAPI.getUserAreaETAs(userId);
      const etas = (etasResp.data && etasResp.data.etas) ? etasResp.data.etas : [];

      // Create a map of areaid -> eta (area_etas uses areaid)
      const etaMap = {};
      etas.forEach(e => {
        if (e.areaid != null) {
          etaMap[e.areaid] = e.eta;
        }
      });

      setAreas(userAreas);
      setAreaETAs(etaMap);

      if (route.params?.areaId) {
        setSelectedAreaId(route.params.areaId);
        if (etaMap[route.params.areaId]) {
          setEta(etaMap[route.params.areaId]);
        }
      }
    } catch (error) {
      console.error('Error loading areas and ETAs:', error);
      Alert.alert(t('error'), t('failedToLoadAreas'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveETA = async () => {
    if (!selectedAreaId) {
      Alert.alert(t('error'), t('pleaseSelectArea'));
      return;
    }

    // Build ETA string based on format
    const etaString = etaFormat === 'single'
      ? formatTime(singleTime)
      : `${formatTime(startTime)}-${formatTime(endTime)}`;

    if (!etaString || etaString.includes('NaN')) {
      Alert.alert(t('error'), t('pleaseEnterETA'));
      return;
    }

    setSaving(true);
    try {
      await enhancedMessageAPI.setAreaETA(selectedAreaId, etaString, userId);
      setAreaETAs(prev => ({ ...prev, [selectedAreaId]: etaString }));
      Alert.alert(t('success'), t('etaSavedSuccessfully'));
      navigation.goBack();
    } catch (error) {
      console.error('Error saving ETA:', error);
      Alert.alert(t('error'), t('failedToSaveETA'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteETA = async () => {
    if (!selectedAreaId || !areaETAs[selectedAreaId]) {
      return;
    }

    setSaving(true);
    try {
      await enhancedMessageAPI.deleteAreaETA(selectedAreaId, userId);
      const newETAs = { ...areaETAs };
      delete newETAs[selectedAreaId];
      setAreaETAs(newETAs);
      setEta('');
      Alert.alert(t('success'), t('etaDeletedSuccessfully'));
    } catch (error) {
      console.error('Error deleting ETA:', error);
      Alert.alert(t('error'), t('failedToDeleteETA'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={dynamicStyles.loadingText}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.content}>
        <Text style={dynamicStyles.title}>{t('manageAreaETAs')}</Text>

        <Card style={dynamicStyles.card}>
          <Card.Content>
            <Text style={dynamicStyles.sectionTitle}>{t('selectArea')}</Text>
            <View style={dynamicStyles.pickerContainer}>
              <Picker
                selectedValue={selectedAreaId}
                onValueChange={(value) => {
                  const numeric = value != null ? Number(value) : null;
                  setSelectedAreaId(numeric);
                }}
                style={dynamicStyles.picker}
              >
                <Picker.Item label={t('selectArea')} value={null} />
                {areas.map((area) => (
                  <Picker.Item 
                    key={area.areaId} 
                    label={`${area.name_english}${areaETAs[area.areaId] ? ' (ETA: ' + areaETAs[area.areaId] + ')' : ''}`} 
                    value={area.areaId} 
                  />
                ))}
              </Picker>
            </View>

            <Divider style={dynamicStyles.divider} />

            <Text style={dynamicStyles.sectionTitle}>{t('etaFormat') || 'ETA Format'}</Text>
            <View style={dynamicStyles.etaFormatRow}>
              <Button
                mode={etaFormat === 'single' ? 'contained' : 'outlined'}
                onPress={() => setEtaFormat('single')}
                style={dynamicStyles.etaFormatButton}
              >
                {t('singleHour') || 'Single hour'}
              </Button>
              <Button
                mode={etaFormat === 'range' ? 'contained' : 'outlined'}
                onPress={() => setEtaFormat('range')}
                style={dynamicStyles.etaFormatButton}
              >
                {t('betweenTwoHours') || 'Between two hours'}
              </Button>
            </View>

            {etaFormat === 'single' ? (
              <>
                <Text style={dynamicStyles.sectionTitle}>{t('time') || 'Time'}</Text>
                <TextInput
                  value={formatTime(singleTime)}
                  editable={false}
                  onPressIn={() => setPickerTarget('single')}
                  right={<TextInput.Icon icon="clock-outline" onPress={() => setPickerTarget('single')} />}
                  style={dynamicStyles.input}
                />
                <View style={dynamicStyles.buttonContainer}>
                  <Button onPress={() => setPickerTarget('single')} mode="outlined" style={dynamicStyles.button}>{t('pickTime') || 'Pick time'}</Button>
                  <Button onPress={() => setSingleTime(new Date())} mode="text" style={dynamicStyles.button}>{t('now') || 'Now'}</Button>
                </View>
              </>
            ) : (
              <>
                <Text style={dynamicStyles.sectionTitle}>{t('startTime') || 'Start time'}</Text>
                <TextInput 
                  value={formatTime(startTime)} 
                  editable={false} 
                  onPressIn={() => setPickerTarget('start')}
                  right={<TextInput.Icon icon="clock-outline" onPress={() => setPickerTarget('start')} />}
                  style={dynamicStyles.input} 
                />
                <View style={dynamicStyles.buttonContainer}>
                  <Button onPress={() => setPickerTarget('start')} mode="outlined" style={dynamicStyles.button}>{t('pickTime') || 'Pick time'}</Button>
                  <Button onPress={() => setStartTime(new Date())} mode="text" style={dynamicStyles.button}>{t('now') || 'Now'}</Button>
                </View>

                <Text style={[dynamicStyles.sectionTitle, { marginTop: 8 }]}>{t('endTime') || 'End time'}</Text>
                <TextInput 
                  value={formatTime(endTime)} 
                  editable={false} 
                  onPressIn={() => setPickerTarget('end')}
                  right={<TextInput.Icon icon="clock-outline" onPress={() => setPickerTarget('end')} />}
                  style={dynamicStyles.input} 
                />
                <View style={dynamicStyles.buttonContainer}>
                  <Button onPress={() => setPickerTarget('end')} mode="outlined" style={dynamicStyles.button}>{t('pickTime') || 'Pick time'}</Button>
                  <Button onPress={() => setEndTime(new Date())} mode="text" style={dynamicStyles.button}>{t('now') || 'Now'}</Button>
                </View>
              </>
            )}

            <View style={dynamicStyles.buttonContainer}>
              <Button 
                mode="contained" 
                onPress={handleSaveETA}
                style={dynamicStyles.button}
                loading={saving}
                disabled={saving}
              >
                {t('saveETA')}
              </Button>
              {areaETAs[selectedAreaId] && (
                <Button 
                  mode="outlined" 
                  onPress={handleDeleteETA}
                  style={[dynamicStyles.button, dynamicStyles.deleteButton]}
                  loading={saving}
                  disabled={saving}
                >
                  {t('deleteETA')}
                </Button>
              )}
            </View>

            <Button mode="text" onPress={() => navigation.goBack()} style={dynamicStyles.backButton}>{t('goBack')}</Button>
          </Card.Content>
        </Card>

        {pickerTarget && (
          <DateTimePicker
            value={pickerTarget === 'single' ? singleTime : pickerTarget === 'start' ? startTime : endTime}
            mode="time"
            is24Hour
            display="default"
            onChange={handleTimePicked}
          />
        )}
      </View>
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12, color: theme.colors.onBackground },
  card: { marginBottom: 16 },
  pickerContainer: { borderWidth: 1, borderColor: theme.colors.outline, borderRadius: 8 },
  picker: { height: 44 },
  divider: { marginVertical: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: theme.colors.onBackground },
  input: { backgroundColor: theme.colors.surfaceVariant, marginBottom: 8 },
  buttonContainer: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: { flex: 1 },
  deleteButton: { borderColor: theme.colors.error },
  backButton: { marginTop: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: theme.colors.onBackground },
  etaFormatRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  etaFormatButton: { flex: 1 },
});

export default AddETAScreen; 