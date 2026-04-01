import { Stack } from "expo-router";
import { TrekRecorderProvider } from "../src/context/TrekRecorderContext";

import { ThemeProvider } from "../src/theme/ThemeContext";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <TrekRecorderProvider>
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
