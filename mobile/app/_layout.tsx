import { Stack } from "expo-router";
import { TrekRecorderProvider } from "../src/context/TrekRecorderContext";

export default function RootLayout() {
  return (
    <TrekRecorderProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="signin" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="trek" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </TrekRecorderProvider>
  );
}
