import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Home() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Dashboard</Text>
      
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>Lifetime Treks: 0</Text>
        <Text style={styles.statsText}>Total Distance: 0 km</Text>
      </View>

      <Pressable 
        style={styles.startButton}
        onPress={() => router.push('/trek')}
      >
        <Text style={styles.startButtonText}>Start Trek</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 40,
  },
  statsContainer: {
    backgroundColor: '#1a1f2e',
    padding: 24,
    borderRadius: 16,
    width: '100%',
    marginBottom: 40,
  },
  statsText: {
    color: '#ccc',
    fontSize: 18,
    marginBottom: 8,
  },
  startButton: {
    backgroundColor: '#10b981',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
