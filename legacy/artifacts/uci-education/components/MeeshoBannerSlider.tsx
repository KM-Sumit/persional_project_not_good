import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import type { Banner } from "@/types/content";

interface MeeshoBannerSliderProps {
  banners: Banner[];
  onBannerPress?: (banner: Banner) => void;
}

export function MeeshoBannerSlider({ banners, onBannerPress }: MeeshoBannerSliderProps) {
  const colors = useColors();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  // Responsive sizing — full width, tall banner
  const containerWidth = Math.min(windowWidth - 0, 700);
  const bannerHeight = Math.round(Math.min(containerWidth * 0.62, 280));

  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  const validBanners = banners && banners.length > 0 ? banners : [];

  // Auto-slide every 3.8s
  useEffect(() => {
    if (validBanners.length <= 1 || isInteracting) return;
    const interval = setInterval(() => {
      const nextIndex = (activeIndexRef.current + 1) % validBanners.length;
      scrollRef.current?.scrollTo({ x: nextIndex * containerWidth, animated: true });
      setActiveIndex(nextIndex);
    }, 3800);
    return () => clearInterval(interval);
  }, [validBanners.length, containerWidth, isInteracting]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / containerWidth);
    if (newIndex >= 0 && newIndex < validBanners.length && newIndex !== activeIndex) {
      setActiveIndex(newIndex);
    }
  };

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * containerWidth, animated: true });
    setActiveIndex(index);
  };

  const handlePress = (banner: Banner) => {
    if (onBannerPress) { onBannerPress(banner); return; }
    const target = banner.href || "/(tabs)/courses";
    router.navigate(target as any);
  };

  // ── EMPTY STATE: fallback gradient poster ──
  if (validBanners.length === 0) {
    return (
      <View style={[styles.wrapper, { width: containerWidth, alignSelf: "center" }]}>
        <LinearGradient
          colors={["#4f46e5", "#7c3aed", "#ec4899"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bannerCard, { width: containerWidth, height: bannerHeight }]}
        >
          <View style={styles.glowRing} />
          <View style={styles.fallbackContent}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🎯 UCI COACHING</Text>
            </View>
            <Text style={styles.fallbackTitle}>A stronger start to your exam prep</Text>
            <Text style={styles.fallbackSubtitle}>
              Pick a lesson, revise notes, or take a live test.
            </Text>
            <Pressable
              onPress={() => router.navigate("/(tabs)/courses")}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Explore Courses</Text>
              <Feather name="arrow-right" size={13} color="#0f172a" />
            </Pressable>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { width: containerWidth, alignSelf: "center" }]}>
      {/* Horizontal Carousel */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setIsInteracting(true)}
        onScrollEndDrag={() => setTimeout(() => setIsInteracting(false), 2000)}
        style={{ width: containerWidth, height: bannerHeight, borderRadius: 18 }}
      >
        {validBanners.map((banner, index) => {
          const hasImage = !!banner.imageUrl;

          // Gradient colors for no-image fallback
          const gradientColors: [string, string, string] =
            index % 3 === 0
              ? ["#4f46e5", "#7c3aed", "#ec4899"]
              : index % 3 === 1
              ? ["#059669", "#0d9488", "#2563eb"]
              : ["#d97706", "#ea580c", "#e11d48"];

          return (
            <Pressable
              key={`${banner.id}-${index}`}
              onPress={() => handlePress(banner)}
              style={[styles.bannerCard, { width: containerWidth, height: bannerHeight }]}
              accessibilityRole="button"
            >
              {/* ── IMAGE-ONLY POSTER (no text overlay) ── */}
              {hasImage ? (
                <Image
                  source={{ uri: banner.imageUrl! }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
                  resizeMode="cover"
                />
              ) : (
                /* ── GRADIENT POSTER WITH TEXT (no image fallback) ── */
                <>
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.glowRing} />
                  {/* Badge top-left */}
                  <View style={styles.topRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {banner.title.includes("Test") || banner.title.includes("Mock")
                          ? "🏆 LIVE MOCK TEST"
                          : banner.title.includes("Notes") || banner.title.includes("PDF")
                          ? "📚 STUDY MATERIAL"
                          : "📢 NEW BATCH"}
                      </Text>
                    </View>
                    <View style={styles.counterPill}>
                      <Text style={styles.counterText}>{index + 1}/{validBanners.length}</Text>
                    </View>
                  </View>
                  {/* Content */}
                  <View style={styles.contentWrap}>
                    <Text style={styles.title} numberOfLines={2}>{banner.title}</Text>
                    {banner.subtitle ? (
                      <Text style={styles.subtitle} numberOfLines={2}>{banner.subtitle}</Text>
                    ) : null}
                    <View style={styles.ctaButton}>
                      <Text style={styles.ctaText}>{banner.ctaLabel || "View Details"}</Text>
                      <Feather name="arrow-right" size={13} color="#0f172a" />
                    </View>
                  </View>
                </>
              )}

              {/* Slide counter pill for image banners (top-right, subtle) */}
              {hasImage && validBanners.length > 1 ? (
                <View style={styles.imageCounter}>
                  <Text style={styles.imageCounterText}>{index + 1} / {validBanners.length}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Dot Pagination */}
      {validBanners.length > 1 ? (
        <View style={styles.paginationRow}>
          {validBanners.map((_, i) => (
            <Pressable
              key={`dot-${i}`}
              onPress={() => scrollToIndex(i)}
              hitSlop={8}
              style={[
                styles.dot,
                i === activeIndex
                  ? [styles.activeDot, { backgroundColor: colors.primary }]
                  : [styles.inactiveDot, { backgroundColor: colors.border }],
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
    marginTop: 4,
    marginHorizontal: -16, // bleed to screen edges
  },
  bannerCard: {
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "space-between",
    position: "relative",
    backgroundColor: "#0f172a",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
  },
  glowRing: {
    position: "absolute",
    right: -40,
    top: -40,
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
  },
  // Image-only counter pill (top-right corner)
  imageCounter: {
    position: "absolute",
    top: 10,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  imageCounterText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  // Gradient banner layout
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    zIndex: 2,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  counterPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  counterText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
  },
  contentWrap: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    zIndex: 2,
  },
  title: {
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
    fontWeight: "500",
  },
  ctaButton: {
    marginTop: 10,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
  },
  // Empty / no-banner fallback
  fallbackContent: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    paddingBottom: 16,
    zIndex: 2,
  },
  fallbackTitle: {
    color: "#ffffff",
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 8,
  },
  fallbackSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
    fontWeight: "500",
  },
  // Pagination dots
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 22,
  },
  inactiveDot: {
    width: 6,
    opacity: 0.6,
  },
});
