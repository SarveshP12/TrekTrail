import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './ui/Button';

export function TrekControls({ isRecording, onPause, onResume, onStop }: any) {
  return (
    <View style={styles.container}>
      {isRecording ? (
        <>
          <Button title="Pause" variant="secondary" onPress={onPause} style={{flex: 1, marginRight: 8}} />
          <Button title="Stop" onPress={onStop} style={{flex: 1}} />
        </>
      ) : (
        <Button title="Resume" onPress={onResume} style={{width: '100%'}} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: '#1a1f2e', borderRadius: 16 },
});
