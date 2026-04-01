import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function Profile() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Pressable 
        style={styles.logoutButton}
        onPress={() => router.replace('/signin')}
      >
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1a', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, color: 'white', fontWeight: 'bold', marginBottom: 30 },
  logoutButton: { backgroundColor: '#ef4444', padding: 15, borderRadius: 10, width: 200, alignItems: 'center' },
  logoutText: { color: 'white', fontWeight: 'bold' }
});
