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

const SLIDE_TYPES = [
  { label: "Offer / Poster", value: "offer", icon: "tag", color: "#ec4899" },
  { label: "Live Class", value: "live", icon: "video", color: "#ef4444" },
  { label: "Mock Test", value: "test", icon: "check-square", color: "#6366f1" },
  { label: "Notes", value: "notes", icon: "file-text", color: "#10b981" },
];

const TARGET_DESTINATIONS = [
  { label: "Courses", value: "/(tabs)/courses", icon: "book-open" },
  { label: "Mock Tests", value: "/(tabs)/tests", icon: "check-square" },
  { label: "Study Notes", value: "/(tabs)/notes", icon: "file-text" },
  { label: "Live Class", value: "/(tabs)/home", icon: "video" },
];

// Convert Google Drive share link to direct image URL
function convertGDriveUrl(url: string): string {
  const match = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match?.[1]) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  const match2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (match2?.[1]) return `https://drive.google.com/uc?export=view&id=${match2[1]}`;
  return url;
}

export default function AdminBannersScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [banners, setBanners] = useState<Banner[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Form states
  const [slideType, setSlideType] = useState("offer");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Enroll Now");
  const [targetHref, setTargetHref] = useState("/(tabs)/courses");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const resolvedImageUrl = convertGDriveUrl(imageUrl.trim());

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

  // Auto-set destination based on slide type
  const handleSlideTypeChange = (type: string) => {
    setSlideType(type);
    if (type === "live") setTargetHref("/(tabs)/home");
    else if (type === "test") setTargetHref("/(tabs)/tests");
    else if (type === "notes") setTargetHref("/(tabs)/notes");
    else setTargetHref("/(tabs)/courses");
  };

  const handleSubmit = async () => {
    if (!imageUrl.trim()) {
      setError("Poster image URL ya Google Drive link zaroori hai.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccessMsg("");

    // Use slide type as the title for admin tracking
    const selectedType = SLIDE_TYPES.find((t) => t.value === slideType);
    const autoTitle = `${selectedType?.label ?? "Slide"} — ${new Date().toLocaleDateString("en-IN")}`;

    try {
      await apiFetch("/api/admin/banners", {
        method: "POST",
        body: JSON.stringify({
          title: autoTitle,
          subtitle: "",
          imageUrl: resolvedImageUrl,
          ctaLabel: ctaLabel.trim() || "Explore",
          href: targetHref,
        }),
      });

      setSuccessMsg("Poster slide publish ho gaya! 🎉");
      setImageUrl("");
      setCtaLabel("Enroll Now");
      setSlideType("offer");

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
            <Text style={[styles.kicker, { color: "#ec4899" }]}>HOME SLIDER</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Offers & Posters</Text>
          </View>
        </View>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Slides पर सिर्फ poster image दिखेगी। Image URL या Google Drive share link डालो।
        </Text>

        {/* Banner Form */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>नया Poster Slide जोड़ें</Text>

          {/* Slide Type Selector */}
          <Text style={[styles.label, { color: colors.foreground }]}>Slide Type</Text>
          <View style={styles.typeRow}>
            {SLIDE_TYPES.map((t) => {
              const isSelected = slideType === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => handleSlideTypeChange(t.value)}
                  style={[
                    styles.typeChip,
                    {
                      backgroundColor: isSelected ? t.color + "20" : colors.background,
                      borderColor: isSelected ? t.color : colors.border,
                    },
                  ]}
                >
                  <Feather name={t.icon as any} size={14} color={isSelected ? t.color : colors.mutedForeground} />
                  <Text style={[styles.typeChipText, { color: isSelected ? t.color : colors.mutedForeground }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Image URL — PRIMARY FIELD */}
          <Text style={[styles.label, { color: colors.foreground }]}>
            📸 Poster Image URL * (Slide पर यही दिखेगा)
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            💡 Google Drive link भी paste कर सकते हो — auto-convert होगा
          </Text>
          <View style={[styles.inputWrap, { borderColor: colors.border }]}>
            <TextInput
              value={imageUrl}
              onChangeText={setImageUrl}
              placeholder="https://... या Google Drive share link"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Live Photo Preview if URL exists */}
          {resolvedImageUrl ? (
            <View style={styles.imagePreviewWrap}>
              <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>Preview:</Text>
              <Image source={{ uri: resolvedImageUrl }} style={styles.imagePreview} resizeMode="cover" />
            </View>
          ) : null}

          {/* CTA Button Label */}
          <Text style={[styles.label, { color: colors.foreground }]}>CTA Button Text</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border }]}>
            <TextInput
              value={ctaLabel}
              onChangeText={setCtaLabel}
              placeholder="e.g. Enroll Now, Join Live Class, Claim Offer"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>

          {/* Target Action */}
          <Text style={[styles.label, { color: colors.foreground }]}>Slide click पर कहाँ जाए?</Text>
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
  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 24 },
  formTitle: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  label: { fontSize: 11, fontWeight: "800", marginBottom: 6, marginTop: 10 },
  hint: { fontSize: 11, marginBottom: 6, marginTop: -4 },
  inputWrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 2 },
  input: { fontSize: 13, paddingVertical: 10 },
  imagePreviewWrap: { marginTop: 10 },
  previewLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  imagePreview: { width: "100%", height: 130, borderRadius: 12 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  typeChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
  },
  typeChipText: { fontSize: 12, fontWeight: "700" },
  targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  targetChip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1,
  },
  targetChipText: { fontSize: 12, fontWeight: "700" },
  msgError: { fontSize: 12, fontWeight: "700", marginTop: 10 },
  msgSuccess: { fontSize: 12, fontWeight: "700", marginTop: 10 },
  submitBtn: {
    height: 48, borderRadius: 14, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18,
  },
  submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  listSection: { marginTop: 6 },
  sectionHeading: { fontSize: 13, fontWeight: "800", marginBottom: 10 },
  emptyText: { fontSize: 13, textAlign: "center", marginVertical: 16 },
  bannerItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 10, marginBottom: 10,
  },
  bannerItemThumb: { width: 68, height: 50, borderRadius: 10 },
  itemTitle: { fontSize: 13, fontWeight: "700" },
  itemMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  miniBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  miniBadgeText: { fontSize: 10, fontWeight: "700" },
  itemHref: { fontSize: 10 },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
