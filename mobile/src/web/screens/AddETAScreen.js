import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, Card, ActivityIndicator, Divider, useTheme, Modal } from 'react-native-paper';
import WebCompatiblePicker from '../../web/components/WebCompatiblePicker';
import { AppContext } from '../../context/AppContext';
import { enhancedMessageAPI } from '../../services/enhancedMessageAPI';
import { areasAPI } from '../../services/areasAPI';
import { supabase } from '../../services/supabase';
// DateTimePicker not compatible with web - using TextInput instead
// import DateTimePicker from '@react-native-community/datetimepicker';
import { formatTimeSimple } from '../../utils/numberFormatting';

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
  const [singleTime, setSingleTime] = useState(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0); // Set to 12:00 PM
    return date;
  });
  const [startTime, setStartTime] = useState(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0); // Set to 12:00 PM
    return date;
  });
  const [endTime, setEndTime] = useState(() => {
    const date = new Date();
    date.setHours(13, 0, 0, 0); // Set to 1:00 PM (1 hour after start)
    return date;
  });
  const [pickerTarget, setPickerTarget] = useState(null); // 'single' | 'start' | 'end'
  
  // New state for copy and bulk operations
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedAreasToCopy, setSelectedAreasToCopy] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  
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

  // Copy ETA to multiple areas
  const handleCopyETA = () => {
    if (!selectedAreaId || !areaETAs[selectedAreaId]) {
      Alert.alert(t('error'), 'Please select an area with an existing ETA to copy');
      return;
    }
    setShowCopyModal(true);
  };

  const handleCopyToSelectedAreas = async () => {
    if (selectedAreasToCopy.length === 0) {
      Alert.alert(t('error'), 'Please select at least one area to copy to');
      return;
    }

    setSaving(true);
    try {
      const sourceETA = areaETAs[selectedAreaId];
      let successCount = 0;
      let errorCount = 0;

      for (const areaId of selectedAreasToCopy) {
        try {
          await enhancedMessageAPI.setAreaETA(areaId, sourceETA, userId);
          setAreaETAs(prev => ({ ...prev, [areaId]: sourceETA }));
          successCount++;
        } catch (error) {
          console.error(`Error copying ETA to area ${areaId}:`, error);
          errorCount++;
        }
      }

      Alert.alert(
        t('success'), 
        `ETA copied successfully!\n\n✅ Copied to: ${successCount} areas\n❌ Failed: ${errorCount} areas`
      );
      setShowCopyModal(false);
      setSelectedAreasToCopy([]);
    } catch (error) {
      console.error('Error copying ETA:', error);
      Alert.alert(t('error'), 'Failed to copy ETA to selected areas');
    } finally {
      setSaving(false);
    }
  };

  // Add 1 hour to all ETAs
  const handleAddHourToAllETAs = () => {
    setShowBulkModal(true);
  };

  const handleConfirmAddHour = async () => {
    setSaving(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const [areaId, etaString] of Object.entries(areaETAs)) {
        try {
          let newETA;
          
          // Parse and add 1 hour to the ETA
          if (etaString.includes('-')) {
            // Range format: "12:00-13:00"
            const [startStr, endStr] = etaString.split('-');
            const startTime = parseTimeString(startStr.trim());
            const endTime = parseTimeString(endStr.trim());
            
            const newStart = addHourToTime(startTime);
            const newEnd = addHourToTime(endTime);
            
            newETA = `${formatTimeFromDate(newStart)}-${formatTimeFromDate(newEnd)}`;
          } else {
            // Single time format: "12:00"
            const time = parseTimeString(etaString.trim());
            const newTime = addHourToTime(time);
            newETA = formatTimeFromDate(newTime);
          }

          await enhancedMessageAPI.setAreaETA(Number(areaId), newETA, userId);
          setAreaETAs(prev => ({ ...prev, [areaId]: newETA }));
          successCount++;
        } catch (error) {
          console.error(`Error updating ETA for area ${areaId}:`, error);
          errorCount++;
        }
      }

      Alert.alert(
        t('success'), 
        `ETAs updated successfully!\n\n✅ Updated: ${successCount} areas\n❌ Failed: ${errorCount} areas`
      );
      setShowBulkModal(false);
    } catch (error) {
      console.error('Error adding hour to ETAs:', error);
      Alert.alert(t('error'), 'Failed to add hour to ETAs');
    } finally {
      setSaving(false);
    }
  };

  // Helper functions for time manipulation
  const parseTimeString = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const addHourToTime = (date) => {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + 1);
    return newDate;
  };

  const formatTimeFromDate = (date) => {
    return formatTimeSimple(date);
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
              <WebCompatiblePicker
                selectedValue={selectedAreaId}
                onValueChange={(value) => {
                  const numeric = value != null ? Number(value) : null;
                  setSelectedAreaId(numeric);
                }}
                style={dynamicStyles.picker}
              >
                <WebCompatiblePicker.Item label={t('selectArea')} value={null} />
                {areas.map((area) => (
                  <WebCompatiblePicker.Item 
                    key={area.areaId} 
                    label={`${area.name_english}${areaETAs[area.areaId] ? ' (ETA: ' + areaETAs[area.areaId] + ')' : ''}`} 
                    value={area.areaId} 
                  />
                ))}
              </WebCompatiblePicker>
            </View>

            <Divider style={dynamicStyles.divider} />

            <Text style={dynamicStyles.sectionTitle}>{t('etaFormat')}</Text>
            <View style={dynamicStyles.etaFormatRow}>
              <Button
                mode={etaFormat === 'single' ? 'contained' : 'outlined'}
                onPress={() => setEtaFormat('single')}
                style={dynamicStyles.etaFormatButton}
              >
                {t('singleTime')}
              </Button>
              <Button
                mode={etaFormat === 'range' ? 'contained' : 'outlined'}
                onPress={() => setEtaFormat('range')}
                style={dynamicStyles.etaFormatButton}
              >
                {t('timeRange')}
              </Button>
            </View>

            {etaFormat === 'single' ? (
              <>
                <Text style={dynamicStyles.sectionTitle}>{t('time')}</Text>
                <TextInput
                  value={formatTime(singleTime)}
                  editable={false}
                  onPressIn={() => setPickerTarget('single')}
                  right={<TextInput.Icon icon="clock-outline" onPress={() => setPickerTarget('single')} />}
                  style={dynamicStyles.input}
                />
                <View style={dynamicStyles.buttonContainer}>
                  <Button onPress={() => setPickerTarget('single')} mode="outlined" style={dynamicStyles.button}>{t('pickTime')}</Button>
                  <Button onPress={() => setSingleTime(new Date())} mode="text" style={dynamicStyles.button}>{t('now')}</Button>
                </View>
              </>
            ) : (
              <>
                <Text style={dynamicStyles.sectionTitle}>{t('startTime')}</Text>
                <TextInput 
                  value={formatTime(startTime)} 
                  editable={false} 
                  onPressIn={() => setPickerTarget('start')}
                  right={<TextInput.Icon icon="clock-outline" onPress={() => setPickerTarget('start')} />}
                  style={dynamicStyles.input} 
                />
                <View style={dynamicStyles.buttonContainer}>
                  <Button onPress={() => setPickerTarget('start')} mode="outlined" style={dynamicStyles.button}>{t('pickTime')}</Button>
                  <Button onPress={() => setStartTime(new Date())} mode="text" style={dynamicStyles.button}>{t('now')}</Button>
                </View>

                <Text style={[dynamicStyles.sectionTitle, { marginTop: 8 }]}>{t('endTime')}</Text>
                <TextInput 
                  value={formatTime(endTime)} 
                  editable={false} 
                  onPressIn={() => setPickerTarget('end')}
                  right={<TextInput.Icon icon="clock-outline" onPress={() => setPickerTarget('end')} />}
                  style={dynamicStyles.input} 
                />
                <View style={dynamicStyles.buttonContainer}>
                  <Button onPress={() => setPickerTarget('end')} mode="outlined" style={dynamicStyles.button}>{t('pickTime')}</Button>
                  <Button onPress={() => setEndTime(new Date())} mode="text" style={dynamicStyles.button}>{t('now')}</Button>
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

            {/* Copy ETA Button */}
            {areaETAs[selectedAreaId] && (
              <View style={dynamicStyles.buttonContainer}>
                <Button 
                  mode="outlined" 
                  onPress={handleCopyETA}
                  style={[dynamicStyles.button, dynamicStyles.copyButton]}
                  icon="content-copy"
                  disabled={saving}
                >
                  {t('copyETA')}
                </Button>
              </View>
            )}

            {/* Bulk Operations */}
            {Object.keys(areaETAs).length > 0 && (
              <View style={dynamicStyles.buttonContainer}>
                <Button 
                  mode="outlined" 
                  onPress={handleAddHourToAllETAs}
                  style={[dynamicStyles.button, dynamicStyles.bulkButton]}
                  icon="clock-plus"
                  disabled={saving}
                >
                  {t('addHourToAll')}
                </Button>
              </View>
            )}

            <Button mode="text" onPress={() => navigation.goBack()} style={dynamicStyles.backButton}>{t('goBack')}</Button>
          </Card.Content>
        </Card>

        {/* Web-compatible time picker */}
        {pickerTarget && (
          <Modal
            visible={!!pickerTarget}
            onDismiss={() => setPickerTarget(null)}
            contentContainerStyle={{ backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 8 }}
          >
            <Text style={{ fontSize: 18, marginBottom: 16 }}>
              Select {pickerTarget === 'single' ? 'Time' : pickerTarget === 'start' ? 'Start Time' : 'End Time'}
            </Text>
            <TextInput
              mode="outlined"
              label="Time (HH:MM)"
              placeholder="12:00"
              value={
                pickerTarget === 'single'
                  ? `${singleTime.getHours().toString().padStart(2, '0')}:${singleTime.getMinutes().toString().padStart(2, '0')}`
                  : pickerTarget === 'start'
                  ? `${startTime.getHours().toString().padStart(2, '0')}:${startTime.getMinutes().toString().padStart(2, '0')}`
                  : `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`
              }
              onChangeText={(text) => {
                const [hours, minutes] = text.split(':');
                if (hours && minutes) {
                  const newTime = new Date();
                  newTime.setHours(parseInt(hours) || 0);
                  newTime.setMinutes(parseInt(minutes) || 0);
                  handleTimePicked({ type: 'set' }, newTime);
                }
              }}
              style={{ marginBottom: 16 }}
            />
            <Button mode="contained" onPress={() => setPickerTarget(null)}>
              Done
            </Button>
          </Modal>
        )}

        {/* Copy ETA Modal */}
        {showCopyModal && (
          <View style={dynamicStyles.modalOverlay}>
            <View style={dynamicStyles.modalContent}>
              <Text style={dynamicStyles.modalTitle}>{t('copyETAToOtherAreas')}</Text>
              <Text style={dynamicStyles.modalSubtitle}>
                Select areas to copy "{areaETAs[selectedAreaId]}" to:
              </Text>
              
              <View style={dynamicStyles.areaButtonsContainer}>
                {areas
                  .filter(area => area.areaId !== selectedAreaId)
                  .map(area => (
                    <Button
                      key={area.areaId}
                      mode={selectedAreasToCopy.includes(area.areaId) ? 'contained' : 'outlined'}
                      onPress={() => {
                        setSelectedAreasToCopy(prev => 
                          prev.includes(area.areaId)
                            ? prev.filter(id => id !== area.areaId)
                            : [...prev, area.areaId]
                        );
                      }}
                      style={[
                        dynamicStyles.areaButton,
                        selectedAreasToCopy.includes(area.areaId) && dynamicStyles.selectedAreaButton
                      ]}
                      labelStyle={dynamicStyles.areaButtonLabel}
                    >
                      {area.name_english}
                      {areaETAs[area.areaId] && ` (${areaETAs[area.areaId]})`}
                    </Button>
                  ))}
              </View>

              <View style={dynamicStyles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setShowCopyModal(false);
                    setSelectedAreasToCopy([]);
                  }}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleCopyToSelectedAreas}
                  loading={saving}
                  disabled={saving || selectedAreasToCopy.length === 0}
                  style={dynamicStyles.modalButton}
                >
                  Copy to {selectedAreasToCopy.length} Areas
                </Button>
              </View>
            </View>
          </View>
        )}

        {/* Bulk Add Hour Modal */}
        {showBulkModal && (
          <View style={dynamicStyles.modalOverlay}>
            <View style={dynamicStyles.modalContent}>
              <Text style={dynamicStyles.modalTitle}>{t('addHourToAllETAs')}</Text>
              <Text style={dynamicStyles.modalSubtitle}>
                This will add 1 hour to all existing ETAs. Are you sure?
              </Text>
              
              <View style={dynamicStyles.etaPreview}>
                <Text style={dynamicStyles.previewTitle}>Preview of changes:</Text>
                {Object.entries(areaETAs).map(([areaId, etaString]) => {
                  const area = areas.find(a => a.areaId === Number(areaId));
                  let newETA;
                  
                  if (etaString.includes('-')) {
                    const [startStr, endStr] = etaString.split('-');
                    const startTime = parseTimeString(startStr.trim());
                    const endTime = parseTimeString(endStr.trim());
                    const newStart = addHourToTime(startTime);
                    const newEnd = addHourToTime(endTime);
                    newETA = `${formatTimeFromDate(newStart)}-${formatTimeFromDate(newEnd)}`;
                  } else {
                    const time = parseTimeString(etaString.trim());
                    const newTime = addHourToTime(time);
                    newETA = formatTimeFromDate(newTime);
                  }
                  
                  return (
                    <Text key={areaId} style={dynamicStyles.previewItem}>
                      {area?.name_english}: {etaString} → {newETA}
                    </Text>
                  );
                })}
              </View>

              <View style={dynamicStyles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setShowBulkModal(false)}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleConfirmAddHour}
                  loading={saving}
                  disabled={saving}
                  style={[dynamicStyles.modalButton, dynamicStyles.confirmButton]}
                >
                  {t('confirmAddHour')}
                </Button>
              </View>
            </View>
          </View>
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
  copyButton: { borderColor: theme.colors.primary },
  bulkButton: { borderColor: theme.colors.secondary },
  backButton: { marginTop: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: theme.colors.onBackground },
  etaFormatRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  etaFormatButton: { flex: 1 },
  
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    margin: 20,
    borderRadius: 12,
    maxHeight: '85%',
    minWidth: '90%',
    flexDirection: 'column',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    padding: 16,
    paddingBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  areaButtonsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    maxHeight: 300,
  },
  areaButton: {
    marginBottom: 6,
    width: '31%',
    height: 48,
  },
  selectedAreaButton: {
    backgroundColor: theme.colors.primary,
  },
  areaButtonLabel: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  confirmButton: {
    backgroundColor: theme.colors.error,
  },
  etaPreview: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  previewItem: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
});

export default AddETAScreen; 