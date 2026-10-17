import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/apiFetch";

const EXAMS = ["SSC", "UPSC", "IBPS", "RRB", "Police", "State PSC", "Other"];

// ─── Video Lesson entry ───────────────────────────────────────────────────────
interface VideoLesson {
  id: string;
  title: string;
  youtubeUrl: string;
}

// ─── Inline Note entry ────────────────────────────────────────────────────────
interface CourseNote {
  id: string;
  title: string;
  content: string;
  pdfUrl: string;
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

// Convert Google Drive share link → direct viewable image
function convertGDrive(url: string): string {
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (m1?.[1]) return `https://drive.google.com/uc?export=view&id=${m1[1]}`;
  const m2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (m2?.[1]) return `https://drive.google.com/uc?export=view&id=${m2[1]}`;
  return url;
}

export default function AdminAddCourseScreen() {
  const colors = useColors();
  const router = useRouter();

  // Basic info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructor, setInstructor] = useState("");
  const [exam, setExam] = useState("SSC");
  const [category, setCategory] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");

  // Videos
  const [videos, setVideos] = useState<VideoLesson[]>([]);

  // Notes
  const [notes, setNotes] = useState<CourseNote[]>([]);

  // Active tab
  const [tab, setTab] = useState<"info" | "videos" | "notes">("info");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sendNotif, setSendNotif] = useState(true);

  // ── VIDEO HELPERS ──
  function addVideo() {
    setVideos((prev) => [...prev, { id: generateId(), title: "", youtubeUrl: "" }]);
  }
  function updateVideo(id: string, field: keyof VideoLesson, value: string) {
    setVideos((prev) => prev.map((v) => v.id === id ? { ...v, [field]: value } : v));
  }
  function removeVideo(id: string) {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }

  // ── NOTE HELPERS ──
  function addNote() {
    setNotes((prev) => [...prev, { id: generateId(), title: "", content: "", pdfUrl: "" }]);
  }
  function updateNote(id: string, field: keyof CourseNote, value: string) {
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, [field]: value } : n));
  }
  function removeNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  // ── SUBMIT ──
  async function submit() {
    if (!title.trim()) { setError("Course title zaroori hai."); return; }
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          instructor: instructor.trim() || "UCI Faculty",
          exam,
          category: category.trim() || exam,
          thumbnailUrl: convertGDrive(thumbnailUrl.trim()),
          lessons: videos.map((v, i) => ({
            title: v.title.trim() || `Lesson ${i + 1}`,
            kind: "video",
            resourceUrl: v.youtubeUrl.trim(),
            sortOrder: i + 1,
          })),
        }),
      });
      // Send notification if toggled
      if (sendNotif && title.trim()) {
        try {
          await apiFetch("/api/admin/notify-all", {
            method: "POST",
            body: JSON.stringify({
              title: "🎉 New Course Available!",
              body: `"${title.trim()}" ab available hai. Abhi check karo!`,
            }),
          });
        } catch {} // notification failure should not block course publish
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message ?? "Course add karne mein problem hui.");
    } finally {
      setBusy(false);
    }
  }

  // ── SUCCESS SCREEN ──
  if (success) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.successBox}>
          <View style={[styles.successIconWrap, { backgroundColor: "#6366f118" }]}>
            <Feather name="check-circle" size={44} color="#6366f1" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Course Publish Ho Gaya! 🎉</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            "{title}" ab students ko dikh raha hai.
          </Text>
          <View style={[styles.notifRow, { backgroundColor: "#8b5cf610", borderColor: "#8b5cf640" }]}>
            <Feather name="bell" size={15} color="#8b5cf6" />
            <Text style={{ flex: 1, fontSize: 12, color: colors.foreground }}>Notification {sendNotif ? "bhej di gayi ✅" : "nahi bheji"}</Text>
          </View>
          <Pressable
            onPress={() => { setSuccess(false); setTitle(""); setDescription(""); setInstructor(""); setThumbnailUrl(""); setVideos([]); setNotes([]); setTab("info"); setSendNotif(true); }}
            style={[styles.btn, { backgroundColor: "#6366f1", marginBottom: 10 }]}
          >
            <Feather name="plus" size={15} color="#fff" />
            <Text style={[styles.btnText, { color: "#fff" }]}>Naya Course Add Karo</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={[styles.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
            <Feather name="arrow-left" size={15} color={colors.foreground} />
            <Text style={[styles.btnText, { color: colors.foreground }]}>Dashboard par Wapis</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const tabs: { key: "info" | "videos" | "notes"; label: string; icon: any; count?: number }[] = [
    { key: "info", label: "Basic Info", icon: "info" },
    { key: "videos", label: "Videos", icon: "play-circle", count: videos.length },
    { key: "notes", label: "Notes", icon: "file-text", count: notes.length },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── TOP BAR ── */}
      <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={[styles.topIconWrap, { backgroundColor: "#6366f118" }]}>
          <Feather name="book-open" size={18} color="#6366f1" />
        </View>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Add Course</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="bell" size={13} color={sendNotif ? "#8b5cf6" : colors.mutedForeground} />
          <Switch
            value={sendNotif}
            onValueChange={setSendNotif}
            trackColor={{ true: "#8b5cf6" }}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        </View>
        <Pressable
          onPress={() => void submit()}
          disabled={busy}
          style={[styles.publishBtn, { backgroundColor: "#6366f1", opacity: busy ? 0.6 : 1 }]}
        >
          <Text style={styles.publishBtnText}>{busy ? "Saving…" : "Publish"}</Text>
        </Pressable>
      </View>

      {/* ── TABS ── */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tabItem, tab === t.key && { borderBottomColor: "#6366f1", borderBottomWidth: 2.5 }]}
          >
            <Feather name={t.icon} size={14} color={tab === t.key ? "#6366f1" : colors.mutedForeground} />
            <Text style={[styles.tabLabel, { color: tab === t.key ? "#6366f1" : colors.mutedForeground }]}>
              {t.label}
            </Text>
            {t.count !== undefined && t.count > 0 ? (
              <View style={[styles.tabBadge, { backgroundColor: "#6366f1" }]}>
                <Text style={styles.tabBadgeTxt}>{t.count}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ════════════════ INFO TAB ════════════════ */}
        {tab === "info" ? (
          <>
            {/* Poster preview */}
            <View style={styles.posterWrap}>
              {thumbnailUrl ? (
                <Image source={{ uri: thumbnailUrl }} style={styles.posterImg} resizeMode="cover" />
              ) : (
                <View style={[styles.posterPlaceholder, { backgroundColor: colors.secondary }]}>
                  <Feather name="image" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.posterHint, { color: colors.mutedForeground }]}>
                    Course poster URL neeche daalo
                  </Text>
                </View>
              )}
            </View>

            <Field label="Poster / Thumbnail URL" value={thumbnailUrl} onChangeText={setThumbnailUrl}
              placeholder="https://... ya Google Drive share link" icon="image" colors={colors} keyboardType="url" />
            <Text style={{ fontSize: 11, color: colors.mutedForeground, marginTop: -6, marginBottom: 6, marginLeft: 2 }}>
              💡 Google Drive link bhi kaam karega — auto-convert hoga
            </Text>

            <Field label="Course Title *" value={title} onChangeText={setTitle}
              placeholder="e.g. Complete SSC GK Preparation" icon="book" colors={colors} />

            <Field label="Description" value={description} onChangeText={setDescription}
              placeholder="Course ke baare mein likhein..." icon="align-left" colors={colors} multiline />

            <Field label="Instructor Name" value={instructor} onChangeText={setInstructor}
              placeholder="UCI Faculty" icon="user" colors={colors} />

            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Exam Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {EXAMS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setExam(e)}
                  style={[styles.chip, {
                    backgroundColor: exam === e ? "#6366f1" : colors.card,
                    borderColor: exam === e ? "#6366f1" : colors.border,
                  }]}
                >
                  <Text style={[styles.chipText, { color: exam === e ? "#fff" : colors.foreground }]}>{e}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Field label="Category" value={category} onChangeText={setCategory}
              placeholder={exam} icon="tag" colors={colors} />
          </>
        ) : null}

        {/* ════════════════ VIDEOS TAB ════════════════ */}
        {tab === "videos" ? (
          <>
            <View style={styles.tabIntro}>
              <Feather name="youtube" size={20} color="#DC2626" />
              <Text style={[styles.tabIntroText, { color: colors.mutedForeground }]}>
                YouTube video links add karo. Students yahan se seedha dekh paayenge.
              </Text>
            </View>

            {videos.map((v, i) => (
              <View key={v.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.itemNum, { backgroundColor: "#DC262618" }]}>
                    <Text style={styles.itemNumText}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.itemTitle, { color: colors.foreground }]}>Lesson {i + 1}</Text>
                  <Pressable onPress={() => removeVideo(v.id)} hitSlop={8}>
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  </Pressable>
                </View>
                <MiniField
                  placeholder="Video ka title (e.g. Indian History - Part 1)"
                  value={v.title}
                  onChangeText={(t) => updateVideo(v.id, "title", t)}
                  icon="type"
                  colors={colors}
                />
                <MiniField
                  placeholder="YouTube URL (https://youtube.com/watch?v=...)"
                  value={v.youtubeUrl}
                  onChangeText={(t) => updateVideo(v.id, "youtubeUrl", t)}
                  icon="youtube"
                  colors={colors}
                  keyboardType="url"
                />
              </View>
            ))}

            <Pressable
              onPress={addVideo}
              style={[styles.addItemBtn, { borderColor: "#DC262640", backgroundColor: "#DC262608" }]}
            >
              <Feather name="plus-circle" size={18} color="#DC2626" />
              <Text style={[styles.addItemText, { color: "#DC2626" }]}>Video Lesson Add Karo</Text>
            </Pressable>
          </>
        ) : null}

        {/* ════════════════ NOTES TAB ════════════════ */}
        {tab === "notes" ? (
          <>
            <View style={styles.tabIntro}>
              <Feather name="file-text" size={20} color="#2563EB" />
              <Text style={[styles.tabIntroText, { color: colors.mutedForeground }]}>
                Is course ke notes add karo — PDF link ya text content ke saath.
              </Text>
            </View>

            {notes.map((n, i) => (
              <View key={n.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.itemHeader}>
                  <View style={[styles.itemNum, { backgroundColor: "#2563EB18" }]}>
                    <Text style={[styles.itemNumText, { color: "#2563EB" }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.itemTitle, { color: colors.foreground }]}>Note {i + 1}</Text>
                  <Pressable onPress={() => removeNote(n.id)} hitSlop={8}>
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  </Pressable>
                </View>
                <MiniField
                  placeholder="Note ka title (e.g. Modern History Summary)"
                  value={n.title}
                  onChangeText={(t) => updateNote(n.id, "title", t)}
                  icon="type"
                  colors={colors}
                />
                <MiniField
                  placeholder="PDF URL (optional)"
                  value={n.pdfUrl}
                  onChangeText={(t) => updateNote(n.id, "pdfUrl", t)}
                  icon="link"
                  colors={colors}
                  keyboardType="url"
                />
                <MiniField
                  placeholder="Note content (optional text)"
                  value={n.content}
                  onChangeText={(t) => updateNote(n.id, "content", t)}
                  icon="edit-3"
                  colors={colors}
                  multiline
                />
              </View>
            ))}

            <Pressable
              onPress={addNote}
              style={[styles.addItemBtn, { borderColor: "#2563EB40", backgroundColor: "#2563EB08" }]}
            >
              <Feather name="plus-circle" size={18} color="#2563EB" />
              <Text style={[styles.addItemText, { color: "#2563EB" }]}>Note Add Karo</Text>
            </Pressable>
          </>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={14} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Bottom Publish Button */}
        <Pressable
          onPress={() => void submit()}
          disabled={busy}
          style={[styles.submitBtn, { backgroundColor: "#6366f1", opacity: busy ? 0.6 : 1 }]}
        >
          <Feather name={busy ? "loader" : "upload-cloud"} size={18} color="#fff" />
          <Text style={styles.submitBtnText}>{busy ? "Publish ho raha hai…" : "Course Publish Karo"}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Reusable field ───────────────────────────────────────────────────────────

function Field({ label, value, onChangeText, placeholder, icon, colors, multiline, keyboardType }: any) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={[
        styles.fieldWrap,
        { backgroundColor: colors.card, borderColor: colors.border },
        multiline && { minHeight: 90, alignItems: "flex-start", paddingTop: 12 },
      ]}>
        <Feather name={icon} size={15} color={colors.mutedForeground} style={{ marginTop: multiline ? 2 : 0 }} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.fieldInput, { color: colors.foreground }]}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === "url" ? "none" : "sentences"}
        />
      </View>
    </View>
  );
}

function MiniField({ placeholder, value, onChangeText, icon, colors, keyboardType, multiline }: any) {
  return (
    <View style={[
      styles.miniField,
      { backgroundColor: colors.background, borderColor: colors.border },
      multiline && { minHeight: 70, alignItems: "flex-start", paddingTop: 10 },
    ]}>
      <Feather name={icon} size={13} color={colors.mutedForeground} style={{ marginTop: multiline ? 2 : 0 }} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[styles.miniInput, { color: colors.foreground }]}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === "url" ? "none" : "sentences"}
        multiline={multiline}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  topIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  topTitle: { flex: 1, fontSize: 16, fontWeight: "800" },
  publishBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  publishBtnText: { fontSize: 13, fontWeight: "800", color: "#fff" },

  // Tab bar
  tabBar: {
    flexDirection: "row", borderBottomWidth: 1,
    paddingHorizontal: 16, gap: 0,
  },
  tabItem: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 12, borderBottomWidth: 2.5, borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 12, fontWeight: "700" },
  tabBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  tabBadgeTxt: { fontSize: 9, color: "#fff", fontWeight: "800" },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 60 },

  // Poster
  posterWrap: { marginBottom: 16, borderRadius: 18, overflow: "hidden" },
  posterImg: { width: "100%", height: 180, borderRadius: 18 },
  posterPlaceholder: {
    height: 140, borderRadius: 18,
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  posterHint: { fontSize: 12 },

  // Fields
  fieldLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, marginBottom: 7, marginTop: 14 },
  fieldWrap: {
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 13,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  fieldInput: { flex: 1, fontSize: 13, paddingVertical: 13 },

  // Chips
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "600" },

  // Tab intro
  tabIntro: {
    flexDirection: "row", gap: 10, alignItems: "flex-start",
    backgroundColor: "#f8fafc", borderRadius: 14,
    padding: 14, marginBottom: 18,
  },
  tabIntroText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // Video/Note item cards
  itemCard: {
    borderRadius: 16, borderWidth: 1,
    padding: 14, marginBottom: 12, gap: 10,
  },
  itemHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemNum: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  itemNumText: { fontSize: 12, fontWeight: "800", color: "#DC2626" },
  itemTitle: { flex: 1, fontSize: 13, fontWeight: "700" },
  miniField: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 11,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  miniInput: { flex: 1, fontSize: 12, paddingVertical: 10 },

  // Add button
  addItemBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed",
    paddingVertical: 14, marginBottom: 16,
  },
  addItemText: { fontSize: 13, fontWeight: "700" },

  // Error
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fef2f2", borderRadius: 12,
    padding: 12, marginTop: 8,
  },
  errorText: { fontSize: 12, color: "#ef4444", flex: 1 },

  // Submit
  submitBtn: {
    height: 54, borderRadius: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10, marginTop: 20,
  },
  submitBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },

  // Success
  successBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  successIconWrap: { width: 88, height: 88, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 22 },
  successTitle: { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  successSub: { fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 32 },
  btn: { width: "100%", height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 14, fontWeight: "700" },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 20, width: "100%" },
});
