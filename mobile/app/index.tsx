import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ImageBackground,
  Dimensions,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
} from "react-native-reanimated";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function LandingPage() {
  const router = useRouter();

  // Animation shared values
  const logoOpacity = useSharedValue(0);
  const logoTranslateX = useSharedValue(-30);
  const menuOpacity = useSharedValue(0);
  const ctaOpacity = useSharedValue(0);
  const ctaTranslateY = useSharedValue(40);

  useEffect(() => {
    // Staggered entrance animations
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 800 }));
    logoTranslateX.value = withDelay(
      300,
      withSpring(0, { damping: 14, stiffness: 100 })
    );
    menuOpacity.value = withDelay(500, withTiming(1, { duration: 600 }));
    ctaOpacity.value = withDelay(800, withTiming(1, { duration: 900 }));
    ctaTranslateY.value = withDelay(
      800,
      withSpring(0, { damping: 12, stiffness: 90 })
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateX: logoTranslateX.value }],
  }));

  const menuAnimatedStyle = useAnimatedStyle(() => ({
    opacity: menuOpacity.value,
  }));

  const ctaAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ctaOpacity.value,
    transform: [{ translateY: ctaTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent />

      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1551632811-561732d1e306?q=80&w=1470&auto=format&fit=crop" }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Top gradient for logo readability */}
        <LinearGradient
          colors={["rgba(0,0,0,0.65)", "rgba(0,0,0,0.15)", "transparent"]}
          style={styles.topGradient}
        />

        {/* Bottom gradient for CTA readability */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.85)"]}
          style={styles.bottomGradient}
        />

        {/* --- Header --- */}
        <Animated.View style={[styles.header, logoAnimatedStyle]}>
          <View style={styles.logoRow}>
            <View style={styles.logoIconContainer}>
               <MaterialCommunityIcons name="image-filter-hdr" size={38} color="white" />
            </View>
            <View style={styles.logoTextContainer}>
              <Text style={styles.logoTextTop}>SUMMIT</Text>
              <Text style={styles.logoTextBottom}>TRAILS</Text>
            </View>
          </View>
        </Animated.View>

        {/* --- Menu --- */}
        <Animated.View style={[styles.menuButton, menuAnimatedStyle]}>
          <Pressable
            hitSlop={12}
            style={({ pressed }) => [
              styles.menuPressable,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="menu" size={32} color="white" />
          </Pressable>
        </Animated.View>

        {/* --- Bottom CTA --- */}
        <Animated.View style={[styles.bottomContent, ctaAnimatedStyle]}>
          <Pressable
            onPress={() => router.push("/register")}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
          >
            <Text style={styles.ctaText}>Get Started</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/signin")}
            style={({ pressed }) => [
              styles.signInRow,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.signInText}>Already have an account? </Text>
            <Text style={styles.signInLink}>Sign In</Text>
          </Pressable>
        </Animated.View>

      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0f1a",
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 1,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 250,
    zIndex: 1,
  },
  header: {
    position: "absolute",
    top: Platform.OS === "ios" ? 58 : 44,
    left: 22,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoIconContainer: {
    justifyContent: "center",
    alignItems: "center",
    marginRight: -2,
  },
  logoTextContainer: {
    flexDirection: "column",
    justifyContent: "center",
  },
  logoTextTop: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    lineHeight: 18,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  logoTextBottom: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    lineHeight: 18,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  menuButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 38,
    right: 22,
    zIndex: 10,
  },
  menuPressable: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === "ios" ? 54 : 36,
    zIndex: 10,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.9)",
    paddingVertical: 17,
    borderRadius: 50,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
    marginBottom: 22,
  },
  ctaText: {
    color: "white",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  signInRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signInText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
  },
  signInLink: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
