import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { useRouter, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { API_ENDPOINTS } from "../src/config/api"; 

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
           email: email, // Using "username" per OAuth2 spec often but our schema says LoginRequest
           password: password
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Success
        console.log("Login successful:", data);
          // Store the token for location uploading & other API calls
          await AsyncStorage.setItem("auth_token", data.access_token);
          router.replace("/(tabs)/home");
      } else {
        Alert.alert("Login Failed", data.detail || "Invalid credentials");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </Pressable>

      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Sign in to continue your adventure</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="hiker@example.com"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <Pressable 
        style={({ pressed }) => [
          styles.button, 
          pressed && { opacity: 0.9 }
        ]}
        onPress={handleSignIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Sign In</Text>
        )}
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account? </Text>
        <Pressable onPress={() => router.push("/register")}>
          <Text style={styles.linkText}>Sign Up</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
    padding: 24,
    paddingTop: 60,
  },
  backButton: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#9ca3af",
    marginBottom: 48,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: "#d1d5db",
    marginBottom: 8,
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#1f2937",
    borderRadius: 12,
    padding: 16,
    color: "white",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#374151",
  },
  button: {
    backgroundColor: "#10b981",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  linkText: {
    color: "#10b981",
    fontSize: 14,
    fontWeight: "bold",
  },
});