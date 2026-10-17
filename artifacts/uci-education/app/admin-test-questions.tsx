import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Page, Panel } from "@/components/learning";
import { useColors } from "@/hooks/useColors";
import { apiFetch } from "@/lib/examApi";

interface Question {
  id: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  marks: number;
  sortOrder: number;
}

const OPTS = ["A", "B", "C", "D"] as const;

export default function AdminTestQuestionsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { testId, testTitle } = useLocalSearchParams<{ testId: string; testTitle: string }>();
  const id = Number(testId);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Form fields
  const [qText, setQText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correct, setCorrect] = useState<"A" | "B" | "C" | "D">("A");
  const [explanation, setExplanation] = useState("");
  const [marks, setMarks] = useState("1");

  async function loadQuestions() {
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/tests/${id}/questions`);
      setQuestions(res.questions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load questions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadQuestions(); }, [id]);

  function resetForm() {
    setQText(""); setOptA(""); setOptB(""); setOptC(""); setOptD("");
    setCorrect("A"); setExplanation(""); setMarks("1");
  }

  async function handleSave() {
    if (!qText.trim()) { Alert.alert("Error", "Question text is required."); return; }
    if (!optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
      Alert.alert("Error", "All 4 options are required."); return;
    }
    setSaving(true);
    const correctIdx = correct === "A" ? 0 : correct === "B" ? 1 : correct === "C" ? 2 : 3;
    try {
      await apiFetch(`/api/admin/tests/${id}/questions`, {
        method: "POST",
        body: JSON.stringify({
          prompt: qText.trim(),
          options: [optA.trim(), optB.trim(), optC.trim(), optD.trim()],
          correctIndex: correctIdx,
          explanation: explanation.trim() || "",
          marks: parseFloat(marks) || 1,
        }),
      });
      resetForm();
      setShowModal(false);
      await loadQuestions();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save question.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(qId: number) {
    setDeletingId(qId);
    try {
      await apiFetch(`/api/admin/questions/${qId}`, { method: "DELETE" });
      await loadQuestions();
    } catch {
      Alert.alert("Error", "Failed to delete question.");
    } finally {
      setDeletingId(null);
    }
  }

  function getOptionValue(opt: string) {
    if (opt === "A") return optA;
    if (opt === "B") return optB;
    if (opt === "C") return optC;
    return optD;
  }
  function getOptionSetter(opt: string) {
    if (opt === "A") return setOptA;
    if (opt === "B") return setOptB;
    if (opt === "C") return setOptC;
    return setOptD;
  }

  return (
    <Page>
      {/* Back */}
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Feather name="arrow-left" size={16} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Manage Tests</Text>
      </Pressable>

      <Text style={[styles.kicker, { color: colors.primary }]}>QUESTIONS MANAGER</Text>
      <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
        {testTitle || `Test #${id}`}
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {questions.length} question{questions.length !== 1 ? "s" : ""} added
      </Text>

      <Pressable
        onPress={() => { resetForm(); setShowModal(true); }}
        style={[styles.addBtn, { backgroundColor: colors.primary }]}
      >
        <Feather name="plus" size={15} color={colors.primaryForeground} />
        <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add Question</Text>
      </Pressable>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />}
      {!loading && error && (
        <View style={[styles.errorBox, { backgroundColor: "#ef444415" }]}>
          <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text>
          <Pressable onPress={loadQuestions} style={{ marginTop: 8 }}>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && questions.length === 0 && (
        <View style={styles.emptyWrap}>
          <Feather name="help-circle" size={44} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Questions Yet</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Tap "Add Question" to add the first MCQ question.
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {questions.map((q, index) => (
          <Panel key={q.id} style={styles.qCard}>
            <View style={styles.qHeader}>
              <View style={[styles.qNumBadge, { backgroundColor: colors.primary + "22" }]}>
                <Text style={[styles.qNumText, { color: colors.primary }]}>Q{index + 1}</Text>
              </View>
              <Text style={[styles.qText, { color: colors.foreground }]}>{q.prompt}</Text>
              <Pressable
                onPress={() => handleDelete(q.id)}
                style={styles.deleteBtn}
                disabled={deletingId === q.id}
              >
                {deletingId === q.id
                  ? <ActivityIndicator size="small" color="#ef4444" />
                  : <Feather name="trash-2" size={15} color="#ef4444" />}
              </Pressable>
            </View>

            {/* Options */}
            <View style={styles.optsList}>
              {OPTS.map((opt, optIdx) => {
                const text = Array.isArray(q.options) ? q.options[optIdx] ?? "" : "";
                const isCorrect = q.correctIndex === optIdx;
                return (
                  <View
                    key={opt}
                    style={[
                      styles.optRow,
                      isCorrect && { backgroundColor: "#10b98110", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
                    ]}
                  >
                    <View style={[styles.optBadge, { backgroundColor: isCorrect ? "#10b981" : colors.secondary }]}>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: isCorrect ? "#fff" : colors.foreground }}>{opt}</Text>
                    </View>
                    <Text style={[styles.optText, { color: isCorrect ? "#059669" : colors.foreground, fontWeight: isCorrect ? "700" : "500" }]}>
                      {text}
                    </Text>
                    {isCorrect && <Feather name="check-circle" size={13} color="#059669" />}
                  </View>
                );
              })}
            </View>

            {q.explanation ? (
              <View style={[styles.expBox, { backgroundColor: "#f59e0b10" }]}>
                <Feather name="info" size={11} color="#d97706" />
                <Text style={{ fontSize: 11, color: "#d97706", flex: 1, lineHeight: 16 }}>{q.explanation}</Text>
              </View>
            ) : null}

            <Text style={[styles.marksBadge, { color: colors.mutedForeground }]}>
              +{q.marks} mark{q.marks !== 1 ? "s" : ""}
            </Text>
          </Panel>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── ADD QUESTION MODAL ─── */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add MCQ Question</Text>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Question *</Text>
              <TextInput
                value={qText}
                onChangeText={setQText}
                placeholder="Type the question here..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.multiline, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />

              {OPTS.map((opt) => (
                <View key={opt}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Option {opt} *</Text>
                  <TextInput
                    value={getOptionValue(opt)}
                    onChangeText={getOptionSetter(opt)}
                    placeholder={`Option ${opt}`}
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                  />
                </View>
              ))}

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Correct Answer *</Text>
              <View style={styles.correctRow}>
                {OPTS.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => setCorrect(opt)}
                    style={[
                      styles.correctChip,
                      correct === opt
                        ? { backgroundColor: "#10b981", borderColor: "#10b981" }
                        : { borderColor: colors.border, backgroundColor: colors.background },
                    ]}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "800", color: correct === opt ? "#fff" : colors.foreground }}>
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Explanation (optional)</Text>
              <TextInput
                value={explanation}
                onChangeText={setExplanation}
                placeholder="Why is this the correct answer?"
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={2}
                style={[styles.input, styles.multiline, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, height: 64 }]}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>Marks per Question</Text>
              <TextInput
                value={marks}
                onChangeText={setMarks}
                keyboardType="decimal-pad"
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, width: 80 }]}
              />

              <View style={styles.modalBtns}>
                <Pressable onPress={() => setShowModal(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
                >
                  {saving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
                  <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                    {saving ? "Saving..." : "Save Question"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 16 },
  backText: { fontSize: 13, fontWeight: "700" },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 12, marginBottom: 14 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12,
    alignSelf: "flex-start", marginBottom: 16,
  },
  addBtnText: { fontSize: 13, fontWeight: "700" },
  errorBox: { padding: 16, borderRadius: 12, marginTop: 16 },
  emptyWrap: { alignItems: "center", paddingVertical: 52, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptySub: { fontSize: 12, textAlign: "center", maxWidth: 260, lineHeight: 18 },
  qCard: { marginBottom: 12, padding: 14, gap: 10 },
  qHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  qNumBadge: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  qNumText: { fontSize: 11, fontWeight: "800" },
  qText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  deleteBtn: { padding: 5 },
  optsList: { gap: 6 },
  optRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  optBadge: { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  optText: { flex: 1, fontSize: 12, lineHeight: 17 },
  expBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 9, borderRadius: 8 },
  marksBadge: { fontSize: 10, fontWeight: "700", alignSelf: "flex-end" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center" },
  modalScroll: { padding: 16, paddingVertical: 40 },
  modalCard: { borderRadius: 20, borderWidth: 1, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 12 },
  label: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10, marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginBottom: 2 },
  multiline: { height: 80, textAlignVertical: "top" },
  correctRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  correctChip: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },
  saveBtn: { flex: 2, height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveBtnText: { fontSize: 13, fontWeight: "800" },
});
