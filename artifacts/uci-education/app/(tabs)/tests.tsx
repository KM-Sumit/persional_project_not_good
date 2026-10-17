import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { EmptyState, ErrorState, LoadingState, Page } from "@/components/learning";
import { useColors } from "@/hooks/useColors";
import {
  fetchCategories,
  fetchScheduledTests,
  fetchAllTests,
  verifyScheduledTestAccess,
} from "@/lib/examApi";
import type { ExamCategory, Exam, TestSummary } from "@/types/content";

function formatKolkataDisplay(dateString?: string | null): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " IST";
  } catch {
    return dateString;
  }
}

function getCountdownText(targetDate?: string | null): string {
  if (!targetDate) return "";
  const diffMs = new Date(targetDate).getTime() - Date.now();
  if (diffMs <= 0) return "Starting now";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Starts in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `Starts in ${hours}h ${mins}m`;
  return `Starts in ${mins}m ${secs}s`;
}

// ── Grouped Tests List Component ──────────────────────────────────────────────
interface GroupedTestsListProps {
  tests: TestSummary[];
  colors: ReturnType<typeof useColors>;
  onTestPress: (test: TestSummary) => void;
}

function TestCard({ test, colors, onPress }: { test: TestSummary; colors: ReturnType<typeof useColors>; onPress: () => void }) {
  const isScheduled = test.testType === "scheduled";
  const isPyq = test.testType === "pyq";
  const isLive = test.status === "live";
  const isUpcoming = test.status === "scheduled";
  const isCompleted = test.status === "completed";

  let statusBg = "#64748b20";
  let statusColor = "#64748b";
  let statusLabel = test.status?.toUpperCase() ?? "PRACTICE";

  if (isLive) { statusBg = "#ef444420"; statusColor = "#ef4444"; statusLabel = "🔴 LIVE NOW"; }
  else if (isUpcoming) { statusBg = "#3b82f620"; statusColor = "#2563eb"; statusLabel = getCountdownText(test.scheduledStartAt); }
  else if (isCompleted) { statusBg = "#10b98120"; statusColor = "#059669"; statusLabel = "COMPLETED"; }
  else if (test.status === "cancelled") { statusBg = "#94a3b825"; statusColor = "#64748b"; statusLabel = "CANCELLED"; }
  else if (isPyq) { statusBg = "#8b5cf620"; statusColor = "#7c3aed"; statusLabel = "OFFICIAL PYQ"; }

  const btnBg = isLive ? "#ef4444" : isUpcoming ? colors.secondary : colors.primary;
  const btnTextColor = isLive ? "#fff" : isUpcoming ? colors.foreground : colors.primaryForeground;
  const btnLabel = isLive
    ? (test.isPasswordProtected || test.requiresPassword ? "Unlock & Enter Live" : "Start Live Test")
    : isUpcoming ? "Opens at Scheduled Time"
    : isCompleted ? "Completed"
    : test.accessType === "paid" && !test.hasPurchased ? `Unlock ₹${test.price ?? 0}`
    : test.accessType === "password" && !test.attempted ? "Enter Password"
    : test.attempted ? "Retake Test"
    : "Start Test";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.testCard,
        { backgroundColor: colors.card, borderColor: isLive ? "#ef4444" : colors.border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.topBadgeRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
        {isPyq && test.year && (
          <View style={[styles.yearBadge, { backgroundColor: "#f59e0b18" }]}>
            <Text style={styles.yearBadgeText}>{test.year}{test.shift ? ` · ${test.shift}` : ""}</Text>
          </View>
        )}
        {test.accessType === "password" && (
          <View style={styles.lockBadge}>
            <Feather name="lock" size={11} color="#f59e0b" />
            <Text style={styles.lockBadgeText}>🔑 Password</Text>
          </View>
        )}
        {test.accessType === "paid" && !test.hasPurchased && (
          <View style={[styles.lockBadge, { backgroundColor: "#6366f115" }]}>
            <Feather name="credit-card" size={11} color="#4f46e5" />
            <Text style={[styles.lockBadgeText, { color: "#4f46e5" }]}>₹{test.price ?? 0}</Text>
          </View>
        )}
        {test.accessType === "paid" && test.hasPurchased && (
          <View style={[styles.lockBadge, { backgroundColor: "#10b98115" }]}>
            <Feather name="check-circle" size={11} color="#059669" />
            <Text style={[styles.lockBadgeText, { color: "#059669" }]}>Purchased</Text>
          </View>
        )}
        {(!test.accessType || test.accessType === "free") && (
          <View style={[styles.lockBadge, { backgroundColor: "#10b98115" }]}>
            <Text style={[styles.lockBadgeText, { color: "#059669" }]}>🆓 Free</Text>
          </View>
        )}
      </View>

      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{test.title}</Text>

      {isScheduled && test.scheduledStartAt && (
        <View style={[styles.scheduledBanner, { backgroundColor: colors.secondary }]}>
          <Feather name="calendar" size={13} color={colors.primary} />
          <Text style={[styles.scheduledBannerText, { color: colors.foreground }]}>
            {formatKolkataDisplay(test.scheduledStartAt)}
          </Text>
        </View>
      )}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Feather name="help-circle" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{test.questionCount} Questions</Text>
        </View>
        <View style={styles.metaItem}>
          <Feather name="clock" size={13} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{test.durationMinutes} Mins</Text>
        </View>
        {test.totalMarks ? (
          <View style={styles.metaItem}>
            <Feather name="award" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{test.totalMarks} Marks</Text>
          </View>
        ) : null}
        {Number(test.negativeMarking) > 0 ? (
          <View style={[styles.negBadge, { backgroundColor: "#ef444415" }]}>
            <Text style={styles.negBadgeText}>+{test.marksPerQuestion ?? 1} / -{test.negativeMarking} Neg</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <View style={styles.actionLeft}>
          {isPyq && (
            <View style={styles.verifiedRow}>
              <Feather name="check-circle" size={12} color="#10b981" />
              <Text style={styles.verifiedText}>Official Answer Key Verified</Text>
            </View>
          )}
        </View>
        <View style={[styles.actionBtn, { backgroundColor: btnBg }]}>
          <Text style={[styles.actionBtnText, { color: btnTextColor }]}>{btnLabel}</Text>
          <Feather name={isUpcoming ? "clock" : "arrow-right"} size={13} color={btnTextColor} />
        </View>
      </View>
    </Pressable>
  );
}

function GroupedTestsList({ tests, colors, onTestPress }: GroupedTestsListProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [collapsedExams, setCollapsedExams] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setCollapsedCategories({});
    setCollapsedExams({});
  }, [tests]);

  const grouped = useMemo(() => {
    const catMap = new Map<string, Map<number, { examName: string; tests: TestSummary[] }>>();
    for (const test of tests) {
      const catKey = test.categoryName ?? "Other";
      const examId = test.examId ?? -1;
      const examName = test.examName ?? "General";
      if (!catMap.has(catKey)) catMap.set(catKey, new Map());
      const examMap = catMap.get(catKey)!;
      if (!examMap.has(examId)) examMap.set(examId, { examName, tests: [] });
      examMap.get(examId)!.tests.push(test);
    }
    return Array.from(catMap.entries()).map(([catName, examMap]) => ({
      catName,
      exams: Array.from(examMap.entries()).map(([examId, data]) => ({ examId, ...data })),
    }));
  }, [tests]);

  return (
    <View>
      {grouped.map(({ catName, exams }) => {
        const isCatCollapsed = collapsedCategories[catName] ?? false;
        const totalTests = exams.reduce((s, e) => s + e.tests.length, 0);
        return (
          <View key={catName} style={{ marginBottom: 8 }}>
            {/* Category Header */}
            <Pressable
              onPress={() => setCollapsedCategories((p) => ({ ...p, [catName]: !p[catName] }))}
              style={({ pressed }) => [
                styles.groupCatHeader,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={[styles.groupCatIconWrap, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="folder" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupCatName, { color: colors.primary }]}>{catName}</Text>
                <Text style={[styles.groupCatMeta, { color: colors.mutedForeground }]}>
                  {exams.length} exam{exams.length !== 1 ? "s" : ""} · {totalTests} test{totalTests !== 1 ? "s" : ""}
                </Text>
              </View>
              <Feather name={isCatCollapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.mutedForeground} />
            </Pressable>

            {/* Exams */}
            {!isCatCollapsed && exams.map(({ examId, examName, tests: examTests }) => {
              const isExamCollapsed = collapsedExams[examId] ?? false;
              return (
                <View key={examId} style={styles.groupExamWrap}>
                  <Pressable
                    onPress={() => setCollapsedExams((p) => ({ ...p, [examId]: !p[examId] }))}
                    style={({ pressed }) => [
                      styles.groupExamHeader,
                      { backgroundColor: colors.secondary, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                    ]}
                  >
                    <View style={[styles.groupExamIconWrap, { backgroundColor: "#f59e0b22" }]}>
                      <Feather name="folder" size={14} color="#d97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.groupExamName, { color: colors.foreground }]}>{examName}</Text>
                      <Text style={[styles.groupExamMeta, { color: colors.mutedForeground }]}>
                        {examTests.length} test{examTests.length !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    <Feather name={isExamCollapsed ? "chevron-down" : "chevron-up"} size={14} color={colors.mutedForeground} />
                  </Pressable>

                  {!isExamCollapsed && (
                    <View style={styles.groupTestsWrap}>
                      {examTests.map((test) => (
                        <TestCard key={test.id} test={test} colors={colors} onPress={() => onTestPress(test)} />
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export default function TestsScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ categorySlug?: string; type?: string }>();

  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(params.categorySlug ?? "all");
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<string>(params.type ?? "all");
  const [search, setSearch] = useState("");
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password Unlock Modal State
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedLockedTest, setSelectedLockedTest] = useState<TestSummary | null>(null);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Sync route params
  useEffect(() => {
    if (params.categorySlug) setSelectedCategory(params.categorySlug);
    if (params.type) setSelectedType(params.type);
  }, [params.categorySlug, params.type]);

  // Load Categories
  useEffect(() => {
    fetchCategories()
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => {});
  }, []);

  // Load Tests
  async function loadTests() {
    setError(null);
    try {
      const allRes = await fetchAllTests({
        search: search.trim() || undefined,
        type: (selectedType === "all" || selectedType === "precision") ? undefined : selectedType,
      });
      setTests(allRes.tests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadTests();
  }, [search, selectedType]);

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.slug === selectedCategory || c.slug.startsWith(selectedCategory));
  }, [categories, selectedCategory]);

  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      // Category filter
      if (selectedCategory !== "all") {
        if (activeCategory && t.categoryName?.toLowerCase() !== activeCategory.name.toLowerCase()) {
          return false;
        }
      }
      // Sub-exam filter
      if (selectedExamId) {
        if (t.examId !== selectedExamId) return false;
      }
      // Precision / Class test filter
      if (selectedType === "precision") {
        if (!t.isPrecision && t.accessType !== "password") return false;
      }
      return true;
    });
  }, [tests, selectedCategory, activeCategory, selectedExamId, selectedType]);

  async function onRefresh() {
    setRefreshing(true);
    await loadTests();
  }

  function handleTestClick(test: TestSummary) {
    if (test.testType === "scheduled") {
      const now = Date.now();
      const startTime = test.scheduledStartAt ? new Date(test.scheduledStartAt).getTime() : 0;
      const endTime = test.scheduledEndAt ? new Date(test.scheduledEndAt).getTime() : Infinity;

      if (test.status === "cancelled") {
        alert("This scheduled test was cancelled by the administrator.");
        return;
      }

      if (now < startTime) {
        // Not started yet
        router.push({ pathname: "/test/[id]", params: { id: String(test.id) } });
        return;
      }

      if (now > endTime || test.status === "completed") {
        alert("This scheduled test has concluded.");
        return;
      }

      // Live scheduled test: if password protected, show password modal
      if (test.isPasswordProtected || test.requiresPassword) {
        setSelectedLockedTest(test);
        setEnteredPassword("");
        setPasswordError("");
        setPasswordModalVisible(true);
        return;
      }
    }

    // Password-protected tests (non-scheduled)
    if (test.accessType === "password" && !test.attempted) {
      setSelectedLockedTest(test);
      setEnteredPassword("");
      setPasswordError("");
      setPasswordModalVisible(true);
      return;
    }

    // Paid tests: block if not purchased
    if (test.accessType === "paid" && !test.hasPurchased) {
      alert(`This test requires payment of ₹${test.price ?? 0}. Please contact admin to purchase.`);
      return;
    }

    router.push({ pathname: "/test/[id]", params: { id: String(test.id) } });
  }

  async function handleUnlockAndStart() {
    if (!selectedLockedTest || !enteredPassword.trim()) {
      setPasswordError("Please enter the test access password.");
      return;
    }
    setVerifyingPassword(true);
    setPasswordError("");
    try {
      const res = await verifyScheduledTestAccess(selectedLockedTest.id, enteredPassword.trim());
      if (res.verified) {
        setPasswordModalVisible(false);
        router.push({
          pathname: "/test/[id]",
          params: { id: String(selectedLockedTest.id), pwd: enteredPassword.trim() },
        });
      } else {
        setPasswordError(res.message || "Invalid password.");
      }
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Invalid password. Please check and try again.");
    } finally {
      setVerifyingPassword(false);
    }
  }

  return (
    <Page>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: colors.primary }]}>EXAM PREPARATION & MOCK TESTS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Competitive Tests</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Official scheduled exams, authentic PYQs, and timed mock tests.
        </Text>
      </View>

      {/* Search Bar */}
      <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by exam, paper, subject, or year..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        <Pressable
          onPress={() => { setSelectedCategory("all"); setSelectedExamId(null); }}
          style={[
            styles.catTab,
            selectedCategory === "all"
              ? { backgroundColor: colors.foreground, borderColor: colors.foreground }
              : { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.catTabText,
              { color: selectedCategory === "all" ? colors.background : colors.mutedForeground },
            ]}
          >
            All Exams
          </Text>
        </Pressable>
        {categories.map((cat) => {
          const isSel = selectedCategory === cat.slug;
          return (
            <Pressable
              key={cat.id}
              onPress={() => { setSelectedCategory(cat.slug); setSelectedExamId(null); }}
              style={[
                styles.catTab,
                isSel
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.catTabText,
                  { color: isSel ? colors.primaryForeground : colors.foreground, fontWeight: isSel ? "800" : "600" },
                ]}
              >
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sub-Exams Pills (if category selected) */}
      {activeCategory && activeCategory.exams && activeCategory.exams.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.examScroll}
        >
          <Pressable
            onPress={() => setSelectedExamId(null)}
            style={[
              styles.examPill,
              selectedExamId === null
                ? { backgroundColor: colors.secondary, borderColor: colors.primary }
                : { backgroundColor: "transparent", borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.examPillText,
                { color: selectedExamId === null ? colors.primary : colors.mutedForeground },
              ]}
            >
              All {activeCategory.name}
            </Text>
          </Pressable>
          {activeCategory.exams.map((exam) => {
            const isSel = selectedExamId === exam.id;
            return (
              <Pressable
                key={exam.id}
                onPress={() => setSelectedExamId(exam.id)}
                style={[
                  styles.examPill,
                  isSel
                    ? { backgroundColor: colors.secondary, borderColor: colors.primary }
                    : { backgroundColor: "transparent", borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.examPillText,
                    { color: isSel ? colors.primary : colors.mutedForeground, fontWeight: isSel ? "700" : "500" },
                  ]}
                >
                  {exam.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Type Filter Tabs (Horizontal Scrollable Chips - Clean UI/UX) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeScrollContainer}
        style={styles.typeScrollView}
      >
        {[
          { key: "all", label: "All Tests", icon: "grid" },
          { key: "scheduled", label: "Live & Scheduled", icon: "clock" },
          { key: "pyq", label: "PYQ Papers", icon: "layers" },
          { key: "practice", label: "Mock & Practice", icon: "check-circle" },
          { key: "precision", label: "Precision Class", icon: "lock" },
        ].map((t) => {
          const isSel = selectedType === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setSelectedType(t.key)}
              style={({ pressed }) => [
                styles.typeChip,
                isSel
                  ? { backgroundColor: colors.foreground, borderColor: colors.foreground }
                  : { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather
                name={t.icon as any}
                size={13}
                color={isSel ? colors.background : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.typeChipText,
                  { color: isSel ? colors.background : colors.mutedForeground, fontWeight: isSel ? "700" : "600" },
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Test count summary */}
      {!loading && !error && filteredTests.length > 0 && (
        <View style={{ marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="list" size={12} color={colors.mutedForeground} />
          <Text style={{ fontSize: 11, fontWeight: "600", color: colors.mutedForeground }}>
            {filteredTests.length} test{filteredTests.length !== 1 ? "s" : ""} available
          </Text>
        </View>
      )}

      {/* Loading & Error States */}
      {loading ? <LoadingState label="Loading exam papers and scheduled tests…" /> : null}
      {error && !loading ? <ErrorState onRetry={loadTests} label={error} /> : null}
      {!loading && !error && filteredTests.length === 0 ? (
        <EmptyState
          title="No tests found"
          description="Try choosing a different exam category or clear search terms."
        />
      ) : null}

      {/* Tests List — Grouped by Category → Exam */}
      {!loading && !error && filteredTests.length > 0 && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          <GroupedTestsList
            tests={filteredTests}
            colors={colors}
            onTestPress={handleTestClick}
          />
        </ScrollView>
      )}

      {/* Password Verification Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: "#f59e0b20" }]}>
                <Feather name="lock" size={22} color="#f59e0b" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Access Password Required</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                This test is password-protected. Please enter the access password provided by your teacher or administrator to begin.
              </Text>
            </View>

            {selectedLockedTest && (
              <View style={[styles.testInfoBox, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.testInfoTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {selectedLockedTest.title}
                </Text>
                <Text style={[styles.testInfoMeta, { color: colors.mutedForeground }]}>
                  {selectedLockedTest.durationMinutes} mins · {selectedLockedTest.questionCount} questions
                  {selectedLockedTest.totalMarks ? ` · ${selectedLockedTest.totalMarks} marks` : ""}
                </Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Test Access Password</Text>
              <TextInput
                value={enteredPassword}
                onChangeText={setEnteredPassword}
                placeholder="Enter access password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoCapitalize="characters"
                style={[
                  styles.passwordInput,
                  { backgroundColor: colors.background, borderColor: passwordError ? "#ef4444" : colors.border, color: colors.foreground },
                ]}
              />
              {passwordError ? (
                <Text style={styles.passwordErrorText}>{passwordError}</Text>
              ) : (
                <Text style={[styles.passwordHelp, { color: colors.mutedForeground }]}>
                  Passwords are case-sensitive. Contact your exam administrator if you don't have it.
                </Text>
              )}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setPasswordModalVisible(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={verifyingPassword || !enteredPassword.trim()}
                onPress={handleUnlockAndStart}
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: verifyingPassword || !enteredPassword.trim() ? 0.6 : 1,
                  },
                ]}
              >
                {verifyingPassword ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>
                      Unlock & Start Test
                    </Text>
                    <Feather name="arrow-right" size={15} color={colors.primaryForeground} />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 14 },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },

  search: {
    height: 46,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13, paddingVertical: 0 },

  categoryScroll: { gap: 8, paddingBottom: 8 },
  catTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  catTabText: { fontSize: 12, fontWeight: "700" },

  examScroll: { gap: 6, paddingBottom: 10 },
  examPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  examPillText: { fontSize: 11, fontWeight: "600" },

  typeScrollView: {
    marginBottom: 12,
  },
  typeScrollContainer: {
    gap: 8,
    paddingRight: 16,
    paddingVertical: 2,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 12 },

  testCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  topBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  catBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  catBadgeText: { fontSize: 10, fontWeight: "700" },
  yearBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  yearBadgeText: { fontSize: 10, fontWeight: "700", color: "#d97706" },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f59e0b15",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    marginLeft: "auto",
  },
  lockBadgeText: { fontSize: 9, fontWeight: "700", color: "#b45309" },

  cardTitle: { fontSize: 15, fontWeight: "800", lineHeight: 21 },
  scheduledBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scheduledBannerText: { fontSize: 11, fontWeight: "600" },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 11, fontWeight: "600" },
  negBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  negBadgeText: { fontSize: 10, fontWeight: "700", color: "#dc2626" },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f025",
  },
  actionLeft: { flex: 1 },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  verifiedText: { fontSize: 10, fontWeight: "600", color: "#059669" },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 11, fontWeight: "800" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalHeader: { alignItems: "center", gap: 6 },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalSubtitle: { fontSize: 12, textAlign: "center", lineHeight: 17 },
  testInfoBox: {
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  testInfoTitle: { fontSize: 13, fontWeight: "700" },
  testInfoMeta: { fontSize: 11 },
  inputGroup: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: "700" },
  passwordInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 2,
  },
  passwordErrorText: { fontSize: 11, color: "#ef4444", fontWeight: "600" },
  passwordHelp: { fontSize: 10 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 13, fontWeight: "700" },
  modalConfirmBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  modalConfirmText: { fontSize: 13, fontWeight: "800" },
  // Grouped hierarchy styles
  groupCatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 6,
  },
  groupCatIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  groupCatName: { fontSize: 15, fontWeight: "800" },
  groupCatMeta: { fontSize: 11, fontWeight: "500", marginTop: 1 },

  groupExamWrap: { marginLeft: 12, marginBottom: 6 },
  groupExamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  groupExamIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  groupExamName: { fontSize: 13, fontWeight: "700" },
  groupExamMeta: { fontSize: 10, fontWeight: "500", marginTop: 1 },

  groupTestsWrap: { marginLeft: 12 },
});