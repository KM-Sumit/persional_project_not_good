import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { Page, Panel, SectionTitle, EmptyState, LoadingState, ErrorState } from "@/components/learning";
import { useColors } from "@/hooks/useColors";
import {
  fetchAdminTests,
  createAdminTest,
  publishAdminTest,
  unpublishAdminTest,
  deleteAdminTest,
  setAdminTestPassword,
  fetchAdminCategories,
  createAdminCategory,
  createAdminExam,
} from "@/lib/examApi";

type AccessTab = "all" | "free" | "password" | "paid";

interface AdminTest {
  id: number;
  title: string;
  subject: string;
  topic: string;
  questionCount: number;
  durationMinutes: number;
  difficulty: string;
  published: boolean;
  examId: number | null;
  examName: string | null;
  categoryName: string | null;
  testType: string;
  status: string;
  accessType: string;
  isPrecision: boolean;
  price: number;
  bundleName: string;
  hasPassword: boolean;
  marksPerQuestion: number;
  negativeMarking: number;
  totalMarks: number;
  completedCount: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  exams: { id: number; name: string; slug: string }[] | null;
}

export default function AdminTestsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AccessTab>("all");
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Test Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<"free" | "password" | "paid">("free");
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [newMarks, setNewMarks] = useState("100");
  const [newMarksPerQ, setNewMarksPerQ] = useState("1");
  const [newNegative, setNewNegative] = useState("0");
  const [newDifficulty, setNewDifficulty] = useState("Medium");
  const [newPrice, setNewPrice] = useState("");
  const [newBundleName, setNewBundleName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Category/Exam Modal
  const [showCatModal, setShowCatModal] = useState(false);
  const [catMode, setCatMode] = useState<"category" | "exam">("category");
  const [catName, setCatName] = useState("");
  const [catParentId, setCatParentId] = useState<number | null>(null);
  const [catCreating, setCatCreating] = useState(false);

  async function loadData() {
    setError(null);
    try {
      const [testsRes, catsRes] = await Promise.all([
        fetchAdminTests(activeTab === "all" ? undefined : activeTab),
        fetchAdminCategories(),
      ]);
      setTests(testsRes.tests ?? []);
      setCategories(catsRes.categories ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [activeTab]);

  async function handleCreate() {
    if (!newTitle.trim()) { Alert.alert("Error", "Title is required."); return; }
    if (!selectedExamId) { Alert.alert("Error", "Select an exam category."); return; }
    setCreating(true);
    try {
      const res = await createAdminTest({
        title: newTitle.trim(),
        subject: newSubject.trim() || "General",
        topic: newTopic.trim() || "General",
        examId: selectedExamId,
        durationMinutes: parseInt(newDuration) || 30,
        marksPerQuestion: parseFloat(newMarksPerQ) || 1,
        negativeMarking: parseFloat(newNegative) || 0,
        totalMarks: parseFloat(newMarks) || 100,
        difficulty: newDifficulty,
        accessType: createType,
        isPrecision: createType === "password",
        price: createType === "paid" ? parseFloat(newPrice) || 0 : 0,
        bundleName: createType === "paid" ? newBundleName.trim() : "",
        accessPassword: createType === "password" ? newPassword.trim() : undefined,
        publish: true,
      });
      setCreateResult(res.message);
      if (res.accessPassword) setGeneratedPassword(res.accessPassword);
      setNewTitle(""); setNewSubject(""); setNewTopic(""); setNewPrice(""); setNewBundleName(""); setNewPassword("");
      await loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to create test.");
    } finally {
      setCreating(false);
    }
  }

  async function handleTogglePublish(test: AdminTest) {
    try {
      if (test.published) {
        await unpublishAdminTest(test.id);
      } else {
        await publishAdminTest(test.id);
      }
      await loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed.");
    }
  }

  async function handleDelete(test: AdminTest) {
    if (Platform.OS === "web") {
      if (!confirm(`Delete "${test.title}"? This cannot be undone.`)) return;
    } else {
      // On mobile, use Alert
      return new Promise<void>((resolve) => {
        Alert.alert("Delete Test", `Delete "${test.title}"?`, [
          { text: "Cancel", style: "cancel", onPress: () => resolve() },
          { text: "Delete", style: "destructive", onPress: async () => {
            try { await deleteAdminTest(test.id); await loadData(); } catch (err) { Alert.alert("Error", "Failed to delete."); }
            resolve();
          }},
        ]);
      });
    }
    try { await deleteAdminTest(test.id); await loadData(); } catch (err) { Alert.alert("Error", "Failed to delete."); }
  }

  async function handleCreateCatOrExam() {
    if (!catName.trim()) return;
    setCatCreating(true);
    try {
      if (catMode === "category") {
        await createAdminCategory(catName.trim());
      } else {
        if (!catParentId) { Alert.alert("Error", "Select parent category."); setCatCreating(false); return; }
        await createAdminExam(catName.trim(), catParentId);
      }
      setCatName("");
      setShowCatModal(false);
      await loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed.");
    } finally {
      setCatCreating(false);
    }
  }

  function getAccessBadge(accessType: string) {
    switch (accessType) {
      case "free": return { label: "🆓 FREE", bg: "#10b98120", color: "#059669" };
      case "password": return { label: "🔑 PASSWORD", bg: "#f59e0b20", color: "#d97706" };
      case "paid": return { label: "💳 PAID", bg: "#6366f120", color: "#4f46e5" };
      default: return { label: "FREE", bg: "#10b98120", color: "#059669" };
    }
  }

  const tabs: { key: AccessTab; label: string; icon: string }[] = [
    { key: "all", label: "All Tests", icon: "grid" },
    { key: "free", label: "Free", icon: "unlock" },
    { key: "password", label: "Password", icon: "lock" },
    { key: "paid", label: "Paid", icon: "credit-card" },
  ];

  return (
    <Page>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Feather name="arrow-left" size={16} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Admin</Text>
      </Pressable>

      <Text style={[styles.kicker, { color: colors.primary }]}>TEST MANAGEMENT</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Manage Tests</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Create and manage Free, Password-protected, and Paid tests.
      </Text>

      {/* Action Buttons */}
      <View style={styles.btnRow}>
        <Pressable
          onPress={() => { setShowCreateModal(true); setCreateResult(null); setGeneratedPassword(null); }}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={15} color={colors.primaryForeground} />
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Create Test</Text>
        </Pressable>
        <Pressable
          onPress={() => { setShowCatModal(true); setCatMode("category"); setCatName(""); }}
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
        >
          <Feather name="folder-plus" size={15} color={colors.foreground} />
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Add Category</Text>
        </Pressable>
        <Pressable
          onPress={() => { setShowCatModal(true); setCatMode("exam"); setCatName(""); }}
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
        >
          <Feather name="plus-circle" size={15} color={colors.foreground} />
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Add Exam</Text>
        </Pressable>
      </View>

      {/* Access Type Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {tabs.map((t) => {
          const isSel = activeTab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setActiveTab(t.key)} style={[styles.tab, isSel && { backgroundColor: colors.foreground }]}>
              <Feather name={t.icon as any} size={12} color={isSel ? colors.background : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: isSel ? colors.background : colors.mutedForeground }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tests List */}
      {loading ? <LoadingState label="Loading tests..." /> : null}
      {error && !loading ? <ErrorState onRetry={loadData} label={error} /> : null}
      {!loading && !error && tests.length === 0 ? <EmptyState title="No tests found" description="Create your first test using the button above." /> : null}

      {!loading && !error && tests.map((test) => {
        const badge = getAccessBadge(test.accessType);
        return (
          <Panel key={test.id} style={styles.testCard}>
            <View style={styles.cardTop}>
              <View style={[styles.accessBadge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.accessBadgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
              {test.published ? (
                <View style={[styles.pubBadge, { backgroundColor: "#10b98120" }]}>
                  <Text style={{ fontSize: 9, fontWeight: "800", color: "#059669" }}>PUBLISHED</Text>
                </View>
              ) : (
                <View style={[styles.pubBadge, { backgroundColor: "#64748b20" }]}>
                  <Text style={{ fontSize: 9, fontWeight: "800", color: "#64748b" }}>DRAFT</Text>
                </View>
              )}
              {test.accessType === "paid" && test.price > 0 && (
                <View style={[styles.priceBadge, { backgroundColor: "#6366f115" }]}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#4f46e5" }}>₹{test.price}</Text>
                </View>
              )}
            </View>

            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{test.title}</Text>
            <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
              {test.examName || "No exam"} · {test.categoryName || "No category"}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
              {test.questionCount} Q · {test.durationMinutes} min · {test.difficulty} · {test.completedCount} completed
            </Text>

            <View style={styles.cardActions}>
              <Pressable onPress={() => handleTogglePublish(test)} style={[styles.actionChip, { borderColor: colors.border }]}>
                <Feather name={test.published ? "eye-off" : "eye"} size={12} color={colors.foreground} />
                <Text style={[styles.actionChipText, { color: colors.foreground }]}>{test.published ? "Unpublish" : "Publish"}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: "/admin-test-questions", params: { testId: String(test.id), testTitle: test.title } })}
                style={[styles.actionChip, { borderColor: colors.border }]}
              >
                <Feather name="list" size={12} color={colors.foreground} />
                <Text style={[styles.actionChipText, { color: colors.foreground }]}>Questions</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(test)} style={[styles.actionChip, { borderColor: "#ef4444" }]}>
                <Feather name="trash-2" size={12} color="#ef4444" />
                <Text style={[styles.actionChipText, { color: "#ef4444" }]}>Delete</Text>
              </Pressable>
            </View>
          </Panel>
        );
      })}

      {/* ─── CREATE TEST MODAL ─── */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalScroll}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Create New Test</Text>

              {/* Access Type Selector */}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Test Type</Text>
              <View style={styles.typeRow}>
                {(["free", "password", "paid"] as const).map((t) => {
                  const isSel = createType === t;
                  const label = t === "free" ? "🆓 Free" : t === "password" ? "🔑 Password" : "💳 Paid";
                  return (
                    <Pressable key={t} onPress={() => setCreateType(t)} style={[styles.typeChip, isSel && { backgroundColor: colors.primary, borderColor: colors.primary }, !isSel && { borderColor: colors.border }]}>
                      <Text style={[styles.typeChipText, { color: isSel ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Common Fields */}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title *</Text>
              <TextInput value={newTitle} onChangeText={setNewTitle} placeholder="Test title" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Subject</Text>
                  <TextInput value={newSubject} onChangeText={setNewSubject} placeholder="e.g. GK" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Topic</Text>
                  <TextInput value={newTopic} onChangeText={setNewTopic} placeholder="e.g. Polity" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                </View>
              </View>

              {/* Exam Selection */}
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Select Exam *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {categories.map((cat) => (
                  <View key={cat.id} style={{ marginRight: 8 }}>
                    <Text style={[styles.catLabel, { color: colors.foreground }]}>{cat.name}</Text>
                    <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
                      {(cat.exams || []).map((ex) => (
                        <Pressable key={ex.id} onPress={() => setSelectedExamId(ex.id)} style={[styles.examChip, selectedExamId === ex.id ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }]}>
                          <Text style={{ fontSize: 11, color: selectedExamId === ex.id ? colors.primaryForeground : colors.foreground }}>{ex.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Duration (min)</Text>
                  <TextInput value={newDuration} onChangeText={setNewDuration} keyboardType="numeric" style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Total Marks</Text>
                  <TextInput value={newMarks} onChangeText={setNewMarks} keyboardType="numeric" style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                </View>
              </View>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>+Marks/Q</Text>
                  <TextInput value={newMarksPerQ} onChangeText={setNewMarksPerQ} keyboardType="numeric" style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>−Negative</Text>
                  <TextInput value={newNegative} onChangeText={setNewNegative} keyboardType="numeric" style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Difficulty</Text>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {["Easy", "Medium", "Hard"].map((d) => (
                      <Pressable key={d} onPress={() => setNewDifficulty(d)} style={[styles.diffChip, newDifficulty === d ? { backgroundColor: colors.primary } : { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
                        <Text style={{ fontSize: 10, color: newDifficulty === d ? colors.primaryForeground : colors.foreground }}>{d}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* Password specific */}
              {createType === "password" && (
                <View>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Access Password (leave empty to auto-generate)</Text>
                  <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="Optional custom password" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                </View>
              )}

              {/* Paid specific */}
              {createType === "paid" && (
                <View>
                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Price (₹) *</Text>
                      <TextInput value={newPrice} onChangeText={setNewPrice} keyboardType="numeric" placeholder="e.g. 99" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Bundle Name</Text>
                      <TextInput value={newBundleName} onChangeText={setNewBundleName} placeholder="e.g. MP Police Pack" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />
                    </View>
                  </View>
                </View>
              )}

              {/* Result Messages */}
              {createResult && (
                <View style={[styles.resultBox, { backgroundColor: "#10b98115" }]}>
                  <Feather name="check-circle" size={14} color="#059669" />
                  <Text style={{ fontSize: 12, color: "#059669", flex: 1 }}>{createResult}</Text>
                </View>
              )}
              {generatedPassword && (
                <View style={[styles.resultBox, { backgroundColor: "#f59e0b15" }]}>
                  <Feather name="key" size={14} color="#d97706" />
                  <Text style={{ fontSize: 12, color: "#d97706", fontWeight: "800", flex: 1 }}>Password: {generatedPassword}</Text>
                </View>
              )}

              {/* Buttons */}
              <View style={[styles.row2, { marginTop: 10 }]}>
                <Pressable onPress={() => setShowCreateModal(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleCreate} disabled={creating} style={[styles.createBtn, { backgroundColor: colors.primary }]}>
                  {creating ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
                  <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>
                    {creating ? "Creating..." : "Create & Publish"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── CATEGORY/EXAM MODAL ─── */}
      <Modal visible={showCatModal} transparent animationType="fade" onRequestClose={() => setShowCatModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: 500 }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {catMode === "category" ? "Create Exam Category" : "Create Sub-Exam"}
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Name *</Text>
            <TextInput value={catName} onChangeText={setCatName} placeholder={catMode === "category" ? "e.g. MP Exams" : "e.g. MP Police"} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} />

            {catMode === "exam" && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Parent Category *</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {categories.map((c) => (
                    <Pressable key={c.id} onPress={() => setCatParentId(c.id)} style={[styles.examChip, catParentId === c.id ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border }]}>
                      <Text style={{ fontSize: 11, color: catParentId === c.id ? colors.primaryForeground : colors.foreground }}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Existing categories list */}
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Existing Categories & Exams</Text>
            <ScrollView style={{ maxHeight: 150 }}>
              {categories.map((c) => (
                <View key={c.id} style={{ marginBottom: 8 }}>
                  <Text style={[styles.catLabel, { color: colors.foreground, fontWeight: "800" }]}>📁 {c.name}</Text>
                  {(c.exams || []).map((ex) => (
                    <Text key={ex.id} style={[styles.catLabel, { color: colors.mutedForeground, marginLeft: 16 }]}>└ {ex.name}</Text>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View style={[styles.row2, { marginTop: 14 }]}>
              <Pressable onPress={() => setShowCatModal(false)} style={[styles.cancelBtn, { borderColor: colors.border }]}>
                <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCreateCatOrExam} disabled={catCreating} style={[styles.createBtn, { backgroundColor: colors.primary }]}>
                {catCreating ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
                <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 16 },
  backText: { fontSize: 13, fontWeight: "700" },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 16 },
  btnRow: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  primaryBtnText: { fontSize: 12, fontWeight: "700" },
  secondaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  secondaryBtnText: { fontSize: 11, fontWeight: "600" },
  tabBar: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 3, marginBottom: 16, gap: 3 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 8, borderRadius: 11 },
  tabText: { fontSize: 11, fontWeight: "700" },
  testCard: { marginBottom: 10, padding: 14 },
  cardTop: { flexDirection: "row", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  accessBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  accessBadgeText: { fontSize: 9, fontWeight: "800" },
  pubBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  cardMeta: { fontSize: 11, marginBottom: 2 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  actionChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  actionChipText: { fontSize: 11, fontWeight: "600" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" },
  modalScroll: { padding: 16, paddingVertical: 40 },
  modalCard: { borderRadius: 20, borderWidth: 1, padding: 20, marginHorizontal: 8 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 16 },
  fieldLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, marginBottom: 10 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  typeChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  typeChipText: { fontSize: 12, fontWeight: "700" },
  row2: { flexDirection: "row", gap: 8 },
  catLabel: { fontSize: 11, marginBottom: 4 },
  examChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  diffChip: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  resultBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, marginTop: 10, marginBottom: 12 },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },
  createBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  createBtnText: { fontSize: 13, fontWeight: "700" },
});
