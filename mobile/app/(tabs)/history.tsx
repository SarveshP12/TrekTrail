import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function History() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>History</Text>
      <Text style={styles.subtitle}>Your past treks will appear here</Text>   
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1a', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, color: 'white', fontWeight: 'bold', marginBottom: 10 },
  subtitle: { color: '#888', fontSize: 16 }
});
