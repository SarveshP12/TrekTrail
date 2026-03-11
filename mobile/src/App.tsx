import React from "react";
import { SafeAreaView, StyleSheet, Text, View, StatusBar } from "react-native";

const App = (): React.JSX.Element => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Text style={styles.title}>TrekTrack AI</Text>
        <Text style={styles.subtitle}>AI-Enhanced Trek Tracking</Text>
        <Text style={styles.status}>Phase 1 Setup Complete</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#e94560",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#16213e",
    marginBottom: 24,
  },
  status: {
    fontSize: 14,
    color: "#0f3460",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
});

export default App;
