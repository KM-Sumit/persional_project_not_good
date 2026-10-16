import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/apiFetch";
import type { Banner } from "@/types/content";

const PRESET_POSTERS = [
  {
    name: "SSC 50% Off",
    title: "🔥 Flat 50% Off — SSC CGL Foundation Batch",
    subtitle: "Complete Video Lessons + Expert Faculty + Daily Practice Tests",
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1000&auto=format&fit=crop&q=80",
    ctaLabel: "Enroll Now",
    href: "/(tabs)/courses",
  },
  {
    name: "Mock Test",
    title: "🏆 All India Live Mock Test Series",
    subtitle: "Compete with 10,000+ aspirants · Real Exam Simulator & Instant Rank",
    imageUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1000&auto=format&fit=crop&q=80",
    ctaLabel: "Start Free Test",
    href: "/(tabs)/tests",
  },
  {
    name: "Study Notes",
    title: "📚 Free High-Yield Formula & Notes Booklets",
    subtitle: "Comprehensive revision notes for GK, Reasoning & Quant shortcuts",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1000&auto=format&fit=crop&q=80",
    ctaLabel: "View Notes",
    href: "/(tabs)/notes",
  },
  {
    name: "Railway Batch",
    title: "🚆 RRB NTPC & Group D 2026 Special Batch",
    subtitle: "Full syllabus coverage with previous 10 years solved question papers",
    imageUrl: "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=1000&auto=format&fit=crop&q=80",
    ctaLabel: "Join Batch",
    href: "/(tabs)/courses",
  },
];

const TARGET_DESTINATIONS = [
  { label: "Courses", value: "/(tabs)/courses", icon: "book-open" },
  { label: "Mock Tests", value: "/(tabs)/tests", icon: "check-square" },
  { label: "Study Notes", value: "/(tabs)/notes", icon: "file-text" },
];

export default function AdminBannersScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Form states
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Enroll Now");
  const [targetHref, setTargetHref] = useState("/(tabs)/courses");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchBanners = async () => {
    try {
      setLoadingList(true);
      const res = await apiFetch<{ banners: Banner[] }>("/api/admin/banners");
      setBanners(res.banners || []);
    } catch (err: any) {
      console.error("Error fetching banners:", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleApplyPreset = (preset: typeof PRESET_POSTERS[0]) => {
    setTitle(preset.title);
    setSubtitle(preset.subtitle);
    setImageUrl(preset.imageUrl);
    setCtaLabel(preset.ctaLabel);
    setTargetHref(preset.href);
    setError("");
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Banner Title / Offer Heading is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      await apiFetch("/api/admin/banners", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim(),
          imageUrl: imageUrl.trim(),
          ctaLabel: ctaLabel.trim() || "Explore",
          href: targetHref,
        }),
      });

      setSuccessMsg("Banner published successfully! 🎉");
      setTitle("");
      setSubtitle("");
      setImageUrl("");
      setCtaLabel("Enroll Now");

      // Invalidate react query cache for student home
      await queryClient.invalidateQueries({ queryKey: ["/api/student/home"] });
      await fetchBanners();
    } catch (err: any) {
      setError(err?.message || "Failed to create banner.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (bannerId: number) => {
    setDeletingId(bannerId);
    try {
      await apiFetch(`/api/admin/banners/${bannerId}`, {
        method: "DELETE",
      });
      // Remove from local state
      setBanners((prev) => prev.filter((b) => b.id !== bannerId));
      await queryClient.invalidateQueries({ queryKey: ["/api/student/home"] });
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not delete banner.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={16} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Admin Dashboard</Text>
        </Pressable>

        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: "#ec489920" }]}>
            <Feather name="image" size={26} color="#ec4899" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.kicker, { color: "#ec4899" }]}>COACHING SLIDER</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Offers & Posters</Text>
          </View>
        </View>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Slides पर सिर्फ poster image दिखेगी — कोई text नहीं। Image URL दो, student home screen पर clean poster auto-slide होगा।
        </Text>

        {/* 1-Click Poster Presets */}
        <View style={styles.presetSection}>
          <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
            ⚡ 1-Click Coaching Presets (क्विक सेलेक्ट)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
            {PRESET_POSTERS.map((preset, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleApplyPreset(preset)}
                style={[styles.presetChip, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="zap" size={13} color="#ec4899" />
                <Text style={[styles.presetText, { color: colors.foreground }]}>{preset.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Banner Form */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>नया Poster Slide जोड़ें</Text>
          <Text style={[styles.formHint, { color: colors.mutedForeground }]}>
            📌 Slide पर सिर्फ poster image दिखेगी — text overlay नहीं होगा।
          </Text>

          {/* Internal Label (admin only) */}
          <Text style={[styles.label, { color: colors.foreground }]}>Internal Label (Admin के लिए — Slide पर नहीं दिखेगा) *</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. SSC CGL Offer Poster Jan 2026"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>

          {/* Image URL — PRIMARY FIELD */}
          <Text style={[styles.label, { color: colors.foreground }]}>📸 Poster Image URL * (यही Slide पर दिखेगा)</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border }]}>
            <TextInput
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://images.unsplash.com/..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Live Photo Preview if URL exists */}
          {imageUrl ? (
            <View style={styles.imagePreviewWrap}>
              <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>Photo Preview:</Text>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="cover" />
            </View>
          ) : null}

          {/* CTA Button Label */}
          <Text style={[styles.label, { color: colors.foreground }]}>CTA Button Text</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border }]}>
            <TextInput
              value={ctaLabel}
              onChangeText={setCtaLabel}
              placeholder="e.g. Enroll Now, Claim Offer, Join Batch"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>

          {/* Target Action */}
          <Text style={[styles.label, { color: colors.foreground }]}>Where should this slide open?</Text>
          <View style={styles.targetRow}>
            {TARGET_DESTINATIONS.map((dest) => {
              const isSelected = targetHref === dest.value;
              return (
                <Pressable
                  key={dest.value}
                  onPress={() => setTargetHref(dest.value)}
                  style={[
                    styles.targetChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather
                    name={dest.icon as any}
                    size={14}
                    color={isSelected ? colors.primaryForeground : colors.foreground}
                  />
                  <Text
                    style={[
                      styles.targetChipText,
                      { color: isSelected ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {dest.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Error & Success Messages */}
          {error ? <Text style={[styles.msgError, { color: colors.destructive }]}>{error}</Text> : null}
          {successMsg ? <Text style={[styles.msgSuccess, { color: "#10b981" }]}>{successMsg}</Text> : null}

          {/* Submit Button */}
          <Pressable
            onPress={handleSubmit}
            disabled={submitting}
            style={[styles.submitBtn, { backgroundColor: "#ec4899", opacity: submitting ? 0.7 : 1 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="plus-circle" size={17} color="#fff" />
                <Text style={styles.submitBtnText}>Publish Poster Slide</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Active Banners List */}
        <View style={styles.listSection}>
          <Text style={[styles.sectionHeading, { color: colors.foreground }]}>
            🖼️ Live Banners ({banners.length})
          </Text>

          {loadingList ? (
            <ActivityIndicator style={{ marginTop: 15 }} color={colors.primary} />
          ) : banners.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No active banners yet. Add one above!
            </Text>
          ) : (
            banners.map((item) => (
              <View
                key={item.id}
                style={[styles.bannerItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.bannerItemThumb} resizeMode="cover" />
                ) : (
                  <View style={[styles.bannerItemThumb, { backgroundColor: "#6366f120", alignItems: "center", justifyContent: "center" }]}>
                    <Feather name="image" size={24} color="#6366f1" />
                  </View>
                )}

                <View style={{ flex: 1, paddingVertical: 2 }}>
                  <Text style={[styles.itemTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.itemSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.subtitle || "No subtitle"}
                  </Text>
                  <View style={styles.itemMetaRow}>
                    <View style={[styles.miniBadge, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.miniBadgeText, { color: colors.accentForeground }]}>
                        {item.ctaLabel}
                      </Text>
                    </View>
                    <Text style={[styles.itemHref, { color: colors.mutedForeground }]}>
                      {item.href || "/courses"}
                    </Text>
                  </View>
                </View>

                {/* Delete Button */}
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  style={[styles.deleteBtn, { backgroundColor: "#fee2e2" }]}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  )}
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingVertical: 22, paddingBottom: 50 },
  back: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 18 },
  backText: { fontSize: 13, fontWeight: "700" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  headerIcon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
  sub: { fontSize: 13, lineHeight: 18, marginBottom: 18 },
  presetSection: { marginBottom: 18 },
  sectionHeading: { fontSize: 13, fontWeight: "800", marginBottom: 10 },
  presetRow: { gap: 8, paddingVertical: 2 },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  presetText: { fontSize: 12, fontWeight: "700" },
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 24 },
  formTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  formHint: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  label: { fontSize: 11, fontWeight: "800", marginBottom: 6, marginTop: 10 },
  inputWrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 2 },
  input: { fontSize: 13, paddingVertical: 10 },
  imagePreviewWrap: { marginTop: 10 },
  previewLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  imagePreview: { width: "100%", height: 130, borderRadius: 12 },
  targetRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  targetChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  targetChipText: { fontSize: 12, fontWeight: "700" },
  msgError: { fontSize: 12, fontWeight: "700", marginTop: 10 },
  msgSuccess: { fontSize: 12, fontWeight: "700", marginTop: 10 },
  submitBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
  },
  submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  listSection: { marginTop: 6 },
  emptyText: { fontSize: 13, textAlign: "center", marginVertical: 16 },
  bannerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  bannerItemThumb: { width: 68, height: 50, borderRadius: 10 },
  itemTitle: { fontSize: 13, fontWeight: "700" },
  itemSub: { fontSize: 11, marginTop: 2 },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  miniBadgeText: { fontSize: 10, fontWeight: "700" },
  itemHref: { fontSize: 10 },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
