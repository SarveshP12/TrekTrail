import { Stack } from "expo-router";
import { TrekRecorderProvider } from "../src/context/TrekRecorderContext";
import { API_URL } from "../src/config/api";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemeProvider } from "../src/theme/ThemeContext";

export default function RootLayout() {
  const [token, setToken] = useState("");

  useEffect(() => {
    // Attempt to load auth token
    AsyncStorage.getItem("auth_token").then((t) => {
      if (t) setToken(t);
    });
  }, []);

  return (
    <ThemeProvider>
      <TrekRecorderProvider apiBaseUrl={API_URL} token={token}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
          <Stack.Screen name="signin" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="trek" options={{ headerShown: false, gestureEnabled: false }} />
        </Stack>
      </TrekRecorderProvider>
    </ThemeProvider>
  );
}
