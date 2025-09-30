import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import AppPreview from '../../components/AppPreview';

const AppPreviewScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      <AppPreview />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default AppPreviewScreen;
