import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import {
  addAdminTestQuestion,
  bulkImportAdminQuestions,
  createAdminPyqPaper,
  deleteAdminPyqPaper,
  deleteAdminQuestion,
  fetchAdminPyqPapers,
  fetchAdminTestQuestions,
  fetchCategories,
  publishAdminPyqPaper,
  unpublishAdminPyqPaper,
} from "@/lib/examApi";
import type { ExamCategory, PyqPaperAdmin, TestQuestion } from "@/types/content";

export default function AdminPyqScreen() {
  const colors = useColors();
  const router = useRouter();

  const [papers, setPapers] = useState<PyqPaperAdmin[]>([]);
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Paper Form State
  const [showCreatePaper, setShowCreatePaper] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newExamId, setNewExamId] = useState<number | null>(null);
  const [newYear, setNewYear] = useState(String(new Date().getFullYear()));
  const [newShift, setNewShift] = useState("Shift 1");
  const [newLanguage, setNewLanguage] = useState("Hindi");
  const [newSourceInfo, setNewSourceInfo] = useState("");
  const [newInstructions, setNewInstructions] = useState("Official Previous Year Question Paper. Marking: +2 / -0.5.");
  const [newDuration, setNewDuration] = useState("60");
  const [newMarksPerQ, setNewMarksPerQ] = useState("2.0");
  const [newNegMarking, setNewNegMarking] = useState("0.5");
  const [newTotalMarks, setNewTotalMarks] = useState("200");
  const [newIsVerified, setNewIsVerified] = useState(true);
  const [submittingPaper, setSubmittingPaper] = useState(false);

  // Question Management State
  const [questionsModal, setQuestionsModal] = useState<{
    visible: boolean;
    paperId: number | null;
    paperTitle: string;
    questions: TestQuestion[];
    loading: boolean;
  }>({
    visible: false,
    paperId: null,
    paperTitle: "",
    questions: [],
    loading: false,
  });

  // Single Question Form State
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [qPrompt, setQPrompt] = useState("");
  const [qOptA, setQOptA] = useState("");
  const [qOptB, setQOptB] = useState("");
  const [qOptC, setQOptC] = useState("");
  const [qOptD, setQOptD] = useState("");
  const [qCorrectIndex, setQCorrectIndex] = useState(0);
  const [qExplanation, setQExplanation] = useState("");
  const [qMarks, setQMarks] = useState("2.0");
  const [qNegativeMarks, setQNegativeMarks] = useState("0.5");
  const [submittingQuestion, setSubmittingQuestion] = useState(false);

  // Bulk Import State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkJsonText, setBulkJsonText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const allExams = categories.flatMap((c) =>
    (c.exams || []).map((e) => ({ ...e, categoryName: c.name }))
  );

  async function loadData() {
    try {
      const [catRes, papersRes] = await Promise.all([
        fetchCategories(),
        fetchAdminPyqPapers({
          examId: selectedExamId ?? undefined,
          year: selectedYear ?? undefined,
          search: search.trim() || undefined,
        }),
      ]);
      setCategories(catRes.categories || []);
      setPapers(papersRes.papers || []);
      if (!newExamId && catRes.categories?.[0]?.exams?.[0]) {
        setNewExamId(catRes.categories[0].exams[0].id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load PYQ data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [selectedExamId, selectedYear]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
  }

  async function handleCreatePaper(published: boolean) {
    setErrorMsg("");
    setSuccessMsg("");
    if (!newTitle.trim()) {
      setErrorMsg("Please enter paper title.");
      return;
    }
    if (!newExamId) {
      setErrorMsg("Please select an exam.");
      return;
    }

    setSubmittingPaper(true);
    try {
      const res = await createAdminPyqPaper({
        title: newTitle.trim(),
        examId: newExamId,
        year: parseInt(newYear, 10) || new Date().getFullYear(),
        shift: newShift.trim(),
        language: newLanguage.trim(),
        sourceInfo: newSourceInfo.trim(),
        instructions: newInstructions.trim(),
        durationMinutes: parseInt(newDuration, 10) || 60,
        marksPerQuestion: parseFloat(newMarksPerQ) || 2.0,
        negativeMarking: parseFloat(newNegMarking) || 0.5,
        totalMarks: parseFloat(newTotalMarks) || 200,
        isVerifiedPyq: newIsVerified,
        published,
      });

      setSuccessMsg(res.message);
      setShowCreatePaper(false);
      setNewTitle("");
      setNewSourceInfo("");
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create paper.");
    } finally {
      setSubmittingPaper(false);
    }
  }

  async function handleTogglePublish(paper: PyqPaperAdmin) {
    try {
      if (paper.published) {
        await unpublishAdminPyqPaper(paper.id);
        setSuccessMsg("Paper unpublished.");
      } else {
        await publishAdminPyqPaper(paper.id);
        setSuccessMsg("Paper published.");
      }
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update publish state.");
    }
  }

  async function handleDeletePaper(id: number) {
    const doDelete = async () => {
      try {
        await deleteAdminPyqPaper(id);
        setSuccessMsg("Paper deleted.");
        await loadData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to delete paper.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to delete this PYQ paper and all its questions?")) {
        void doDelete();
      }
    } else {
      Alert.alert("Delete PYQ Paper?", "This will delete the paper and all associated questions.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void doDelete() },
      ]);
    }
  }

  async function openQuestionManager(paper: PyqPaperAdmin) {
    setQuestionsModal({
      visible: true,
      paperId: paper.id,
      paperTitle: paper.title,
      questions: [],
      loading: true,
    });
    try {
      const res = await fetchAdminTestQuestions(paper.id);
      setQuestionsModal((prev) => ({
        ...prev,
        questions: res.questions || [],
        loading: false,
      }));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load questions.");
      setQuestionsModal((prev) => ({ ...prev, loading: false }));
    }
  }

  async function handleAddSingleQuestion() {
    if (!questionsModal.paperId) return;
    if (!qPrompt.trim() || !qOptA.trim() || !qOptB.trim() || !qOptC.trim() || !qOptD.trim()) {
      setErrorMsg("Please fill in question prompt and all 4 options.");
      return;
    }

    setSubmittingQuestion(true);
    try {
      await addAdminTestQuestion(questionsModal.paperId, {
        prompt: qPrompt.trim(),
        options: [qOptA.trim(), qOptB.trim(), qOptC.trim(), qOptD.trim()],
        correctIndex: qCorrectIndex,
        explanation: qExplanation.trim(),
        marks: parseFloat(qMarks) || 2.0,
        negativeMarks: parseFloat(qNegativeMarks) || 0.5,
      });

      // Clear form
      setQPrompt("");
      setQOptA("");
      setQOptB("");
      setQOptC("");
      setQOptD("");
      setQExplanation("");
      setShowAddQuestion(false);
      setSuccessMsg("Question added successfully.");

      // Refresh modal questions
      const res = await fetchAdminTestQuestions(questionsModal.paperId);
      setQuestionsModal((prev) => ({ ...prev, questions: res.questions || [] }));
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add question.");
    } finally {
      setSubmittingQuestion(false);
    }
  }

  async function handleDeleteQuestion(qId: number) {
    try {
      await deleteAdminQuestion(qId);
      if (questionsModal.paperId) {
        const res = await fetchAdminTestQuestions(questionsModal.paperId);
        setQuestionsModal((prev) => ({ ...prev, questions: res.questions || [] }));
      }
      setSuccessMsg("Question deleted.");
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to delete question.");
    }
  }

  async function handleBulkImport() {
    if (!questionsModal.paperId) return;
    if (!bulkJsonText.trim()) {
      setErrorMsg("Please paste JSON questions array.");
      return;
    }

    let parsedQuestions: any[];
    try {
      parsedQuestions = JSON.parse(bulkJsonText.trim());
      if (!Array.isArray(parsedQuestions)) throw new Error("Root must be an array of questions.");
    } catch {
      setErrorMsg("Invalid JSON format. Please ensure it is a valid JSON array.");
      return;
    }

    setBulkImporting(true);
    try {
      const res = await bulkImportAdminQuestions(questionsModal.paperId, parsedQuestions);
      setSuccessMsg(res.message);
      setShowBulkModal(false);
      setBulkJsonText("");

      // Refresh modal questions
      const qRes = await fetchAdminTestQuestions(questionsModal.paperId);
      setQuestionsModal((prev) => ({ ...prev, questions: qRes.questions || [] }));
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Bulk import failed.");
    } finally {
      setBulkImporting(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={void onRefresh} tintColor={colors.primary} />}
    >
      {/* Back button */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Feather name="arrow-left" size={16} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Admin Dashboard</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Feather name="book-open" size={13} color="#10B981" />
          <Text style={styles.headerBadgeText}>PREVIOUS YEAR PAPERS</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>PYQ Management</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Manage authentic previous year papers, shifts, questions, marks & negative marking.
        </Text>
      </View>

      {/* Success / Error alerts */}
      {successMsg ? (
        <View style={[styles.alertBox, { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" }]}>
          <Feather name="check-circle" size={16} color="#16A34A" />
          <Text style={[styles.alertText, { color: "#166534" }]}>{successMsg}</Text>
          <Pressable onPress={() => setSuccessMsg("")}><Feather name="x" size={14} color="#166534" /></Pressable>
        </View>
      ) : null}

      {errorMsg ? (
        <View style={[styles.alertBox, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
          <Feather name="alert-triangle" size={16} color="#DC2626" />
          <Text style={[styles.alertText, { color: "#991B1B" }]}>{errorMsg}</Text>
          <Pressable onPress={() => setErrorMsg("")}><Feather name="x" size={14} color="#991B1B" /></Pressable>
        </View>
      ) : null}

      {/* Top Action Bar */}
      <View style={styles.topActionRow}>
        <Pressable
          onPress={() => setShowCreatePaper(!showCreatePaper)}
          style={[styles.primaryBtn, { backgroundColor: "#10B981" }]}
        >
          <Feather name={showCreatePaper ? "minus" : "plus"} size={16} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>{showCreatePaper ? "Close Form" : "Add PYQ Paper"}</Text>
        </Pressable>
      </View>

      {/* ── CREATE PYQ PAPER COLLAPSIBLE FORM ── */}
      {showCreatePaper && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Add New Previous Year Paper</Text>

          <Text style={[styles.inputLabel, { color: colors.foreground }]}>Paper Title *</Text>
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="e.g. SSC CGL Tier 1 Official Paper 2023 (14 July Shift 1)"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          />

          <Text style={[styles.inputLabel, { color: colors.foreground }]}>Target Exam *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.examPickerScroll}>
            {allExams.map((ex) => {
              const isSelected = newExamId === ex.id;
              return (
                <Pressable
                  key={ex.id}
                  onPress={() => setNewExamId(ex.id)}
                  style={[
                    styles.examChip,
                    {
                      backgroundColor: isSelected ? "#10B981" : colors.background,
                      borderColor: isSelected ? "#10B981" : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.examChipText, { color: isSelected ? "#FFFFFF" : colors.foreground }]}>
                    {ex.name} ({ex.categoryName})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Exam Year *</Text>
              <TextInput
                value={newYear}
                onChangeText={setNewYear}
                keyboardType="numeric"
                placeholder="2023"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Shift</Text>
              <TextInput
                value={newShift}
                onChangeText={setNewShift}
                placeholder="Shift 1 / Morning"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Language</Text>
              <TextInput
                value={newLanguage}
                onChangeText={setNewLanguage}
                placeholder="Hindi / Bilingual"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Duration (min)</Text>
              <TextInput
                value={newDuration}
                onChangeText={setNewDuration}
                keyboardType="numeric"
                placeholder="60"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Marks per Q</Text>
              <TextInput
                value={newMarksPerQ}
                onChangeText={setNewMarksPerQ}
                keyboardType="numeric"
                placeholder="2.0"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Negative Mark</Text>
              <TextInput
                value={newNegMarking}
                onChangeText={setNewNegMarking}
                keyboardType="numeric"
                placeholder="0.5"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
          </View>

          <Text style={[styles.inputLabel, { color: colors.foreground }]}>Source & Authority Info</Text>
          <TextInput
            value={newSourceInfo}
            onChangeText={setNewSourceInfo}
            placeholder="Official Staff Selection Commission (SSC) Exam Held on 14 July 2023"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          />

          {/* Verified PYQ Checkbox */}
          <Pressable
            onPress={() => setNewIsVerified(!newIsVerified)}
            style={styles.checkboxRow}
          >
            <View style={[styles.checkbox, { borderColor: "#10B981", backgroundColor: newIsVerified ? "#10B981" : "transparent" }]}>
              {newIsVerified && <Feather name="check" size={13} color="#FFFFFF" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>Mark as Verified Authentic PYQ</Text>
          </Pressable>

          <View style={styles.formActionRow}>
            <Pressable
              disabled={submittingPaper}
              onPress={() => void handleCreatePaper(false)}
              style={[styles.draftBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
            >
              <Text style={[styles.btnText, { color: colors.foreground }]}>Save as Draft</Text>
            </Pressable>
            <Pressable
              disabled={submittingPaper}
              onPress={() => void handleCreatePaper(true)}
              style={[styles.publishBtn, { backgroundColor: "#10B981" }]}
            >
              {submittingPaper ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={[styles.btnText, { color: "#FFFFFF" }]}>Publish Paper</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* ── FILTERS & SEARCH ── */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          <Pressable
            onPress={() => setSelectedExamId(null)}
            style={[styles.filterChip, { backgroundColor: selectedExamId === null ? colors.foreground : colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.filterChipText, { color: selectedExamId === null ? colors.background : colors.foreground }]}>All Exams</Text>
          </Pressable>
          {allExams.map((ex) => {
            const isSel = selectedExamId === ex.id;
            return (
              <Pressable
                key={ex.id}
                onPress={() => setSelectedExamId(ex.id)}
                style={[styles.filterChip, { backgroundColor: isSel ? colors.foreground : colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.filterChipText, { color: isSel ? colors.background : colors.foreground }]}>{ex.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── PAPERS LIST ── */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        PYQ Papers ({papers.length})
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#10B981" style={{ marginVertical: 40 }} />
      ) : papers.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="book-open" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No PYQ papers found</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Click &quot;Add PYQ Paper&quot; above to add verified previous year exam question papers.
          </Text>
        </View>
      ) : (
        papers.map((p) => (
          <View key={p.id} style={[styles.paperCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.paperTopRow}>
              <View style={styles.tagsRow}>
                <View style={[styles.examBadge, { backgroundColor: "#10B98118" }]}>
                  <Text style={[styles.examBadgeText, { color: "#10B981" }]}>{p.examName || "PYQ"}</Text>
                </View>
                {p.isVerifiedPyq && (
                  <View style={[styles.verifiedBadge, { backgroundColor: "#2563EB18" }]}>
                    <Feather name="check-circle" size={10} color="#2563EB" />
                    <Text style={[styles.verifiedText, { color: "#2563EB" }]}>Verified PYQ</Text>
                  </View>
                )}
                {p.year ? (
                  <View style={[styles.yearBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.yearText, { color: colors.mutedForeground }]}>{p.year}</Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.statusTag, { backgroundColor: p.published ? "#DCFCE7" : "#F1F5F9" }]}>
                <Text style={[styles.statusTagText, { color: p.published ? "#166534" : "#64748B" }]}>
                  {p.published ? "PUBLISHED" : "DRAFT"}
                </Text>
              </View>
            </View>

            <Text style={[styles.paperTitle, { color: colors.foreground }]}>{p.title}</Text>
            {p.sourceInfo ? (
              <Text style={[styles.paperSource, { color: colors.mutedForeground }]}>{p.sourceInfo}</Text>
            ) : null}

            <View style={styles.paperMetaRow}>
              <Text style={[styles.paperMeta, { color: colors.mutedForeground }]}>
                {p.questionCount} Questions · {p.durationMinutes} min · +{p.marksPerQuestion} / -{p.negativeMarking}
              </Text>
            </View>

            {/* Paper Actions */}
            <View style={styles.paperActionRow}>
              <Pressable
                onPress={() => void openQuestionManager(p)}
                style={[styles.actionBtn, { backgroundColor: "#10B98115", borderColor: "#86EFAC" }]}
              >
                <Feather name="list" size={13} color="#10B981" />
                <Text style={[styles.actionBtnText, { color: "#10B981" }]}>
                  Manage Questions ({p.questionCount})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleTogglePublish(p)}
                style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
              >
                <Feather name={p.published ? "eye-off" : "eye"} size={13} color={colors.foreground} />
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>
                  {p.published ? "Unpublish" : "Publish"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void handleDeletePaper(p.id)}
                style={[styles.actionBtn, { borderColor: "#FCA5A5", backgroundColor: "#FEE2E2" }]}
              >
                <Feather name="trash-2" size={13} color="#DC2626" />
                <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {/* ── MODAL: QUESTION MANAGER ── */}
      <Modal visible={questionsModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalLarge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Question Manager</Text>
                <Text numberOfLines={1} style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                  {questionsModal.paperTitle}
                </Text>
              </View>
              <Pressable onPress={() => setQuestionsModal((p) => ({ ...p, visible: false }))}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Sub-actions in modal */}
            <View style={styles.modalActionButtons}>
              <Pressable
                onPress={() => setShowAddQuestion(!showAddQuestion)}
                style={[styles.modalBtn, { backgroundColor: "#10B981" }]}
              >
                <Feather name={showAddQuestion ? "minus" : "plus"} size={14} color="#FFFFFF" />
                <Text style={styles.modalBtnText}>{showAddQuestion ? "Cancel" : "Add Question"}</Text>
              </Pressable>

              <Pressable
                onPress={() => setShowBulkModal(true)}
                style={[styles.modalBtn, { backgroundColor: "#2563EB" }]}
              >
                <Feather name="upload-cloud" size={14} color="#FFFFFF" />
                <Text style={styles.modalBtnText}>Bulk Import (JSON)</Text>
              </Pressable>
            </View>

            {/* Add Question Form inline */}
            {showAddQuestion && (
              <ScrollView style={[styles.addQForm, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.formSubhead, { color: colors.foreground }]}>Add New Question</Text>
                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Question Prompt *</Text>
                <TextInput
                  value={qPrompt}
                  onChangeText={setQPrompt}
                  multiline
                  placeholder="Enter full question text..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                />

                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Option A *</Text>
                <TextInput value={qOptA} onChangeText={setQOptA} placeholder="Option A" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />

                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Option B *</Text>
                <TextInput value={qOptB} onChangeText={setQOptB} placeholder="Option B" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />

                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Option C *</Text>
                <TextInput value={qOptC} onChangeText={setQOptC} placeholder="Option C" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />

                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Option D *</Text>
                <TextInput value={qOptD} onChangeText={setQOptD} placeholder="Option D" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />

                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Correct Option *</Text>
                <View style={styles.optionSelectRow}>
                  {["A (0)", "B (1)", "C (2)", "D (3)"].map((lbl, idx) => (
                    <Pressable
                      key={lbl}
                      onPress={() => setQCorrectIndex(idx)}
                      style={[styles.optChoice, { backgroundColor: qCorrectIndex === idx ? "#10B981" : colors.card, borderColor: colors.border }]}
                    >
                      <Text style={[styles.optChoiceText, { color: qCorrectIndex === idx ? "#FFFFFF" : colors.foreground }]}>{lbl}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.inputLabel, { color: colors.foreground }]}>Explanation / Solution</Text>
                <TextInput
                  value={qExplanation}
                  onChangeText={setQExplanation}
                  multiline
                  placeholder="Explain why the option is correct..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                />

                <Pressable
                  disabled={submittingQuestion}
                  onPress={() => void handleAddSingleQuestion()}
                  style={[styles.submitQBtn, { backgroundColor: "#10B981" }]}
                >
                  {submittingQuestion ? <ActivityIndicator color="#fff" size="small" /> : (
                    <Text style={styles.primaryBtnText}>Save Question</Text>
                  )}
                </Pressable>
              </ScrollView>
            )}

            {/* Questions List */}
            {questionsModal.loading ? (
              <ActivityIndicator size="large" color="#10B981" style={{ marginVertical: 30 }} />
            ) : questionsModal.questions.length === 0 ? (
              <Text style={[styles.noQText, { color: colors.mutedForeground }]}>No questions added to this paper yet.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }}>
                {questionsModal.questions.map((q, idx) => (
                  <View key={q.id} style={[styles.qItem, { borderColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.qIndex, { color: "#10B981" }]}>Q{idx + 1}</Text>
                      <Text style={[styles.qPrompt, { color: colors.foreground }]}>{q.prompt}</Text>
                      <Text style={[styles.qAnswer, { color: "#16A34A" }]}>
                        Correct: Option {String.fromCharCode(65 + (q.correctIndex ?? 0))} ({q.options[q.correctIndex ?? 0]})
                      </Text>
                    </View>
                    <Pressable onPress={() => void handleDeleteQuestion(q.id)} style={styles.delQBtn}>
                      <Feather name="trash-2" size={15} color="#DC2626" />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL: BULK JSON IMPORT ── */}
      <Modal visible={showBulkModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalLarge, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Bulk Import Questions (JSON)</Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>Paste array of question objects</Text>
              </View>
              <Pressable onPress={() => setShowBulkModal(false)}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            <Text style={[styles.fieldHint, { color: colors.mutedForeground, marginBottom: 8 }]}>
              Example format: [{`{"prompt": "Capital of India?", "options": ["Mumbai", "New Delhi", "Kolkata", "Chennai"], "correctIndex": 1, "explanation": "New Delhi is capital"}`}]
            </Text>

            <TextInput
              value={bulkJsonText}
              onChangeText={setBulkJsonText}
              multiline
              numberOfLines={10}
              placeholder='[ { "prompt": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0 } ]'
              placeholderTextColor={colors.mutedForeground}
              style={[styles.bulkInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />

            <View style={styles.formActionRow}>
              <Pressable onPress={() => setShowBulkModal(false)} style={[styles.draftBtn, { borderColor: colors.border }]}>
                <Text style={[styles.btnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={bulkImporting}
                onPress={() => void handleBulkImport()}
                style={[styles.publishBtn, { backgroundColor: "#2563EB" }]}
              >
                {bulkImporting ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={[styles.btnText, { color: "#FFFFFF" }]}>Import Questions</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 60,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    marginBottom: 16,
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10B98115",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  alertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  topActionRow: {
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  primaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 56,
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
  },
  examPickerScroll: {
    marginBottom: 6,
  },
  examChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  examChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  formActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  draftBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  publishBtn: {
    flex: 1.2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 10,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  filterSection: {
    marginBottom: 16,
  },
  filterScroll: {
    flexDirection: "row",
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  paperCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  paperTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  examBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  examBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: "700",
  },
  yearBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  yearText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statusTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 9,
    fontWeight: "800",
  },
  paperTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  paperSource: {
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 6,
  },
  paperMetaRow: {
    marginBottom: 12,
  },
  paperMeta: {
    fontSize: 12,
  },
  paperActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalLarge: {
    width: "100%",
    maxWidth: 550,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  modalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  addQForm: {
    maxHeight: 260,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  formSubhead: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  optionSelectRow: {
    flexDirection: "row",
    gap: 6,
    marginVertical: 6,
  },
  optChoice: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  optChoiceText: {
    fontSize: 11,
    fontWeight: "700",
  },
  submitQBtn: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 16,
  },
  noQText: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 20,
  },
  qItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  qIndex: {
    fontSize: 11,
    fontWeight: "800",
  },
  qPrompt: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  qAnswer: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
  delQBtn: {
    padding: 6,
  },
  fieldHint: {
    fontSize: 11,
    lineHeight: 15,
  },
  bulkInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 12,
    minHeight: 160,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
