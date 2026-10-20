import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/apiFetch";
import * as DocumentPicker from "expo-document-picker";

const SUBJECTS = ["General Knowledge", "Mathematics", "Reasoning", "English", "History", "Geography", "Science", "Economics", "Polity"];
const DIFFICULTIES = ["Easy", "Medium", "Hard"];
const QUESTION_COUNTS = [5, 10, 15, 20];
const DURATIONS = [10, 15, 20, 30, 45, 60];

export default function AdminGenerateTestScreen() {
  const colors = useColors();
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("General Knowledge");
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [pdfFile, setPdfFile] = useState<any>(null);
  const [uploadMode, setUploadMode] = useState<"topic" | "pdf">("topic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ testId: number; title: string; questionCount: number } | null>(null);

  async function pickPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setPdfFile(result.assets[0]);
      setError("");
    } catch (err: any) {
      setError("Failed to pick PDF: " + err.message);
    }
  }

  async function generate() {
    if (uploadMode === "topic" && !topic.trim()) {
      setError("Please enter a topic to generate the test.");
      return;
    }
    if (uploadMode === "pdf" && !pdfFile) {
      setError("Please select a PDF file to generate questions.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess(null);
    try {
      const body: any = {
        subject,
        difficulty,
        questionCount,
        durationMinutes,
      };
      if (uploadMode === "topic") {
        body.topic = topic.trim();
      } else {
        body.pdfFile = pdfFile;
      }
      const result = await apiFetch<{ testId: number; title: string; questionCount: number }>("/api/admin/generate-test", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSuccess(result);
    } catch (err: any) {
      setError(err?.message ?? "Test generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.successBox}>
          <View style={[styles.successIcon, { backgroundColor: "#22c55e20" }]}>
            <Feather name="check-circle" size={42} color="#22c55e" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Test Generated! 🎉</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            "{success.title}" has been created with {success.questionCount} questions and published for students.
          </Text>
          <Pressable onPress={() => { setSuccess(null); setTopic(""); }} style={[styles.btn, { backgroundColor: colors.primary, marginBottom: 10 }]}>
            <Feather name="zap" size={15} color={colors.primaryForeground} />
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Generate Another</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={[styles.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
            <Feather name="arrow-left" size={15} color={colors.foreground} />
            <Text style={[styles.btnText, { color: colors.foreground }]}>Back to Dashboard</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={16} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Admin Home</Text>
        </Pressable>

        <View style={[styles.headerIcon, { backgroundColor: "#f59e0b20" }]}>
          <Feather name="zap" size={26} color="#f59e0b" />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Generate Test</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {uploadMode === "topic" ? "Enter a topic — GPT will automatically create multiple choice questions." : "Upload a PDF — AI will extract content and generate questions automatically."}
        </Text>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => setUploadMode("topic")}
            style={[styles.modeBtn, uploadMode === "topic" && { backgroundColor: colors.primary }]}
          >
            <Feather name="type" size={16} color={uploadMode === "topic" ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.modeBtnText, { color: uploadMode === "topic" ? "#fff" : colors.mutedForeground }]}>Topic</Text>
          </Pressable>
          <Pressable
            onPress={() => setUploadMode("pdf")}
            style={[styles.modeBtn, uploadMode === "pdf" && { backgroundColor: colors.primary }]}
          >
            <Feather name="file-text" size={16} color={uploadMode === "pdf" ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.modeBtnText, { color: uploadMode === "pdf" ? "#fff" : colors.mutedForeground }]}>PDF Upload</Text>
          </Pressable>
        </View>

        {/* PDF Upload Section */}
        {uploadMode === "pdf" && (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Upload Question Paper PDF *</Text>
            <Pressable onPress={pickPdf} style={[styles.pdfUploadBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="upload-cloud" size={20} color={colors.primary} />
              <Text style={[styles.pdfUploadText, { color: colors.foreground }]}>
                {pdfFile ? pdfFile.name : "Tap to select PDF file"}
              </Text>
            </Pressable>
            {pdfFile && (
              <Pressable onPress={() => setPdfFile(null)} style={styles.removePdfBtn}>
                <Feather name="x-circle" size={14} color="#ef4444" />
                <Text style={styles.removePdfText}>Remove PDF</Text>
              </Pressable>
            )}
          </>
        )}

        {/* Topic Section */}
        {uploadMode === "topic" && (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Topic *</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="book-open" size={15} color={colors.mutedForeground} />
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="e.g. Indian Constitution, Photosynthesis, Rivers of India"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground }]}
                autoCapitalize="words"
              />
            </View>
          </>
        )}
        <Text style={[styles.label, { color: colors.foreground }]}>Topic *</Text>
        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="book-open" size={15} color={colors.mutedForeground} />
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. Indian Constitution, Photosynthesis, Rivers of India"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground }]}
            autoCapitalize="words"
          />
        </View>

        {/* Subject */}
        <Text style={[styles.label, { color: colors.foreground }]}>Subject</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SUBJECTS.map((s) => (
            <Pressable key={s} onPress={() => setSubject(s)} style={[styles.chip, { backgroundColor: subject === s ? colors.primary : colors.card, borderColor: subject === s ? colors.primary : colors.border }]}>
              <Text style={[styles.chipText, { color: subject === s ? colors.primaryForeground : colors.foreground }]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Difficulty */}
        <Text style={[styles.label, { color: colors.foreground }]}>Difficulty</Text>
        <View style={styles.row}>
          {DIFFICULTIES.map((d) => (
            <Pressable key={d} onPress={() => setDifficulty(d)} style={[styles.optBtn, { flex: 1, backgroundColor: difficulty === d ? colors.primary : colors.card, borderColor: difficulty === d ? colors.primary : colors.border }]}>
              <Text style={[styles.optText, { color: difficulty === d ? colors.primaryForeground : colors.foreground }]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        {/* Question Count */}
        <Text style={[styles.label, { color: colors.foreground }]}>Questions</Text>
        <View style={styles.row}>
          {QUESTION_COUNTS.map((q) => (
            <Pressable key={q} onPress={() => setQuestionCount(q)} style={[styles.optBtn, { flex: 1, backgroundColor: questionCount === q ? colors.primary : colors.card, borderColor: questionCount === q ? colors.primary : colors.border }]}>
              <Text style={[styles.optText, { color: questionCount === q ? colors.primaryForeground : colors.foreground }]}>{q}</Text>
            </Pressable>
          ))}
        </View>

        {/* Duration */}
        <Text style={[styles.label, { color: colors.foreground }]}>Duration (minutes)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {DURATIONS.map((d) => (
            <Pressable key={d} onPress={() => setDurationMinutes(d)} style={[styles.chip, { backgroundColor: durationMinutes === d ? colors.primary : colors.card, borderColor: durationMinutes === d ? colors.primary : colors.border }]}>
              <Text style={[styles.chipText, { color: durationMinutes === d ? colors.primaryForeground : colors.foreground }]}>{d} min</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text> : null}

        <Pressable onPress={() => void generate()} disabled={busy} style={[styles.generateBtn, { backgroundColor: "#f59e0b", opacity: busy ? 0.65 : 1 }]}>
          {busy ? (
            <>
              <Feather name="loader" size={17} color="#fff" />
              <Text style={styles.generateBtnText}>Generating with GPT…</Text>
            </>
          ) : (
            <>
              <Feather name="zap" size={17} color="#fff" />
              <Text style={styles.generateBtnText}>Generate Test</Text>
            </>
          )}
        </Pressable>

        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          ⚡ Powered by OpenAI GPT-4o-mini · Test will be published immediately for students
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 40 },
  back: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 20 },
  backText: { fontSize: 13, fontWeight: "700" },
  headerIcon: { width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, marginBottom: 6 },
  sub: { fontSize: 13, lineHeight: 19, marginBottom: 24 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  inputWrap: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 10 },
  input: { flex: 1, fontSize: 13 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "600" },
  modeToggle: { flexDirection: "row", gap: 8, marginBottom: 20 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  modeBtnText: { fontSize: 12, fontWeight: "700" },
  pdfUploadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20, borderRadius: 14, borderWidth: 2, borderStyle: "dashed", marginBottom: 8 },
  pdfUploadText: { fontSize: 13, fontWeight: "600" },
  removePdfBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8 },
  removePdfText: { fontSize: 12, color: "#ef4444", fontWeight: "600" },
  row: { flexDirection: "row", gap: 8 },
  optBtn: { paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  optText: { fontSize: 12, fontWeight: "700" },
  errorText: { fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 12 },
  generateBtn: { height: 52, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 },
  generateBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  hint: { fontSize: 11, textAlign: "center", marginTop: 14, lineHeight: 17 },
  successBox: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 },
  successIcon: { width: 80, height: 80, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: "800", marginBottom: 12, textAlign: "center" },
  successSub: { fontSize: 14, lineHeight: 21, textAlign: "center", marginBottom: 30 },
  btn: { width: "100%", height: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnText: { fontSize: 13, fontWeight: "700" },
});
