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
  cancelAdminScheduledTest,
  createAdminScheduledTest,
  fetchAdminScheduledTests,
  fetchAdminScheduledTestStats,
  fetchCategories,
  publishAdminScheduledTest,
  regenerateAdminScheduledTestPassword,
} from "@/lib/examApi";
import type { Exam, ExamCategory, ScheduledTestAdmin, ScheduledTestStatsResponse } from "@/types/content";

function formatIST(isoDate?: string | null): string {
  if (!isoDate) return "N/A";
  try {
    const d = new Date(isoDate);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d) + " IST";
  } catch {
    return isoDate;
  }
}

export default function AdminScheduledTestsScreen() {
  const colors = useColors();
  const router = useRouter();

  const [tests, setTests] = useState<ScheduledTestAdmin[]>([]);
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [examId, setExamId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("1. Test will automatically end when duration expires.\n2. Negative marking applies for wrong answers.\n3. Do not switch tabs or refresh during the attempt.");
  
  // Date & Time in IST State (Separated for Mobile/Touch UX)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [startHour, setStartHour] = useState("08");
  const [startMinute, setStartMinute] = useState("00");
  const [startPeriod, setStartPeriod] = useState<"AM" | "PM">("PM");

  function getComputedScheduledDate(): Date | null {
    if (!startDate || !startHour) return null;
    let h = parseInt(startHour, 10);
    if (isNaN(h) || h < 1 || h > 12) return null;
    let m = parseInt(startMinute, 10);
    if (isNaN(m) || m < 0 || m > 59) m = 0;
    if (startPeriod === "PM" && h < 12) h += 12;
    if (startPeriod === "AM" && h === 12) h = 0;
    const hourStr = String(h).padStart(2, "0");
    const minStr = String(m).padStart(2, "0");
    const dateObj = new Date(`${startDate}T${hourStr}:${minStr}:00+05:30`);
    return isNaN(dateObj.getTime()) ? null : dateObj;
  }

  const [durationMinutes, setDurationMinutes] = useState("60");
  const [marksPerQuestion, setMarksPerQuestion] = useState("2.0");
  const [negativeMarking, setNegativeMarking] = useState("0.5");
  const [totalMarks, setTotalMarks] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal State for Generated Password
  const [generatedPasswordModal, setGeneratedPasswordModal] = useState<{
    visible: boolean;
    testTitle: string;
    password: string;
    copied: boolean;
  }>({
    visible: false,
    testTitle: "",
    password: "",
    copied: false,
  });

  // Modal State for Participant Stats
  const [statsModal, setStatsModal] = useState<{
    visible: boolean;
    loading: boolean;
    data: ScheduledTestStatsResponse | null;
  }>({
    visible: false,
    loading: false,
    data: null,
  });

  async function loadData() {
    try {
      const [testsRes, catRes] = await Promise.all([
        fetchAdminScheduledTests(),
        fetchCategories(),
      ]);
      setTests(testsRes.tests || []);
      setCategories(catRes.categories || []);
      if (!examId && catRes.categories?.[0]?.exams?.[0]) {
        setExamId(catRes.categories[0].exams[0].id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load tests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
  }

  async function handleCreateTest(publishImmediately: boolean) {
    setErrorMsg("");
    setSuccessMsg("");
    if (!title.trim()) {
      setErrorMsg("Please enter a test title.");
      return;
    }
    if (!examId) {
      setErrorMsg("Please select an exam.");
      return;
    }

    const scheduledDate = getComputedScheduledDate();
    if (!scheduledDate) {
      setErrorMsg("Please enter a valid Date (YYYY-MM-DD) and Time (Hour: 1-12, Minute: 0-59, AM/PM).");
      return;
    }

    if (publishImmediately && scheduledDate.getTime() < Date.now() - 60_000) {
      setErrorMsg("Cannot publish a test scheduled in the past. Choose a future start time.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createAdminScheduledTest({
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        examId,
        scheduledStartAt: scheduledDate.toISOString(),
        durationMinutes: parseInt(durationMinutes, 10) || 60,
        marksPerQuestion: parseFloat(marksPerQuestion) || 1.0,
        negativeMarking: parseFloat(negativeMarking) || 0.0,
        totalMarks: parseFloat(totalMarks) || 100,
        publish: publishImmediately,
      });

      setSuccessMsg(res.message);
      setTitle("");
      setDescription("");

      // Show the generated password modal
      if (res.accessPassword) {
        setGeneratedPasswordModal({
          visible: true,
          testTitle: res.title,
          password: res.accessPassword,
          copied: false,
        });
      }

      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create scheduled test.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish(id: number) {
    try {
      const res = await publishAdminScheduledTest(id);
      setSuccessMsg(res.message);
      if (res.accessPassword) {
        setGeneratedPasswordModal({
          visible: true,
          testTitle: "Published Test",
          password: res.accessPassword,
          copied: false,
        });
      }
      await loadData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to publish test.");
    }
  }

  async function handleCancel(id: number) {
    const doCancel = async () => {
      try {
        const res = await cancelAdminScheduledTest(id);
        setSuccessMsg(res.message);
        await loadData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to cancel test.");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to cancel this scheduled test? Students will no longer be able to attempt it.")) {
        void doCancel();
      }
    } else {
      Alert.alert("Cancel Scheduled Test?", "Students will no longer be able to attempt it.", [
        { text: "No", style: "cancel" },
        { text: "Yes, Cancel", style: "destructive", onPress: () => void doCancel() },
      ]);
    }
  }

  async function handleRegeneratePassword(id: number, testTitle: string) {
    const doRegenerate = async () => {
      try {
        const res = await regenerateAdminScheduledTestPassword(id);
        setGeneratedPasswordModal({
          visible: true,
          testTitle,
          password: res.accessPassword,
          copied: false,
        });
        setSuccessMsg("Password regenerated successfully.");
        await loadData();
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to regenerate password.");
      }
    };

    const confirmMsg = "Are you sure you want to regenerate the password? The old password will stop working immediately.";
    if (Platform.OS === "web") {
      if (window.confirm(confirmMsg)) void doRegenerate();
    } else {
      Alert.alert("Regenerate Password?", confirmMsg, [
        { text: "Cancel", style: "cancel" },
        { text: "Regenerate", style: "default", onPress: () => void doRegenerate() },
      ]);
    }
  }

  async function openStats(id: number) {
    setStatsModal({ visible: true, loading: true, data: null });
    try {
      const data = await fetchAdminScheduledTestStats(id);
      setStatsModal({ visible: true, loading: false, data });
    } catch (err) {
      setStatsModal({ visible: false, loading: false, data: null });
      setErrorMsg(err instanceof Error ? err.message : "Failed to load test stats.");
    }
  }

  function copyToClipboard(textToCopy: string) {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(textToCopy);
      setGeneratedPasswordModal((prev) => ({ ...prev, copied: true }));
      setTimeout(() => {
        setGeneratedPasswordModal((prev) => ({ ...prev, copied: false }));
      }, 3000);
    } else {
      Alert.alert("Access Password", textToCopy);
    }
  }

  // All flat exams for selector
  const allExams = categories.flatMap((c) =>
    (c.exams || []).map((e) => ({ ...e, categoryName: c.name }))
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={void onRefresh} tintColor={colors.primary} />}
    >
      {/* Top Header */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Feather name="arrow-left" size={16} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Admin Dashboard</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={styles.headerBadge}>
          <Feather name="calendar" size={13} color="#2563EB" />
          <Text style={styles.headerBadgeText}>SCHEDULED EXAMS ENGINE</Text>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Scheduled Tests</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Create password-protected scheduled live tests with strict timing rules (Asia/Kolkata).
        </Text>
      </View>

      {/* IST Timezone Notice */}
      <View style={[styles.noticeBox, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
        <Feather name="clock" size={16} color="#2563EB" />
        <View style={{ flex: 1 }}>
          <Text style={[styles.noticeTitle, { color: "#1E40AF" }]}>Indian Standard Time (IST) Authoritative Timing</Text>
          <Text style={[styles.noticeDesc, { color: "#3B82F6" }]}>
            All tests start and close based on server-side IST (Asia/Kolkata). Page refreshes, network drops, or student clock modifications cannot bypass deadlines.
          </Text>
        </View>
      </View>

      {/* Success / Error Alerts */}
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

      {/* ── CREATE SCHEDULED TEST FORM ── */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Feather name="plus-circle" size={18} color="#2563EB" />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Schedule a New Test</Text>
        </View>

        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Test Title *</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. All India SSC CGL Live Mock Test 2026 #1"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        />

        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Exam Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.examPickerScroll}>
          {allExams.map((ex) => {
            const isSelected = examId === ex.id;
            return (
              <Pressable
                key={ex.id}
                onPress={() => setExamId(ex.id)}
                style={[
                  styles.examChip,
                  {
                    backgroundColor: isSelected ? "#2563EB" : colors.background,
                    borderColor: isSelected ? "#2563EB" : colors.border,
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

        {/* Date, Time (AM/PM), Duration */}
        <View style={{ marginBottom: 12 }}>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>Scheduled Date (YYYY-MM-DD) *</Text>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-10-17"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          />
        </View>

        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Start Time (IST) *</Text>
            <View style={styles.timeRow}>
              <TextInput
                value={startHour}
                onChangeText={(val) => setStartHour(val.replace(/[^0-9]/g, "").slice(0, 2))}
                keyboardType="numeric"
                maxLength={2}
                placeholder="08"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.timeInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
              <Text style={[styles.timeColon, { color: colors.foreground }]}>:</Text>
              <TextInput
                value={startMinute}
                onChangeText={(val) => setStartMinute(val.replace(/[^0-9]/g, "").slice(0, 2))}
                keyboardType="numeric"
                maxLength={2}
                placeholder="00"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.timeInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              />
              <View style={[styles.amPmToggleGroup, { borderColor: colors.border }]}>
                <Pressable
                  onPress={() => setStartPeriod("AM")}
                  style={[styles.amPmBtn, { backgroundColor: startPeriod === "AM" ? "#2563EB" : colors.background }]}
                >
                  <Text style={[styles.amPmText, { color: startPeriod === "AM" ? "#FFFFFF" : colors.mutedForeground }]}>AM</Text>
                </Pressable>
                <Pressable
                  onPress={() => setStartPeriod("PM")}
                  style={[styles.amPmBtn, { backgroundColor: startPeriod === "PM" ? "#2563EB" : colors.background }]}
                >
                  <Text style={[styles.amPmText, { color: startPeriod === "PM" ? "#FFFFFF" : colors.mutedForeground }]}>PM</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={{ width: 110 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Duration (min) *</Text>
            <TextInput
              value={durationMinutes}
              onChangeText={setDurationMinutes}
              keyboardType="numeric"
              placeholder="60"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </View>
        </View>

        {/* Live IST Preview */}
        {(() => {
          const dt = getComputedScheduledDate();
          return dt ? (
            <View style={[styles.previewBanner, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
              <Feather name="clock" size={15} color="#2563EB" />
              <Text style={[styles.previewBannerText, { color: "#1E40AF" }]}>
                Live Preview: {formatIST(dt.toISOString())}
              </Text>
            </View>
          ) : (
            <Text style={[styles.fieldHint, { color: "#DC2626", marginTop: 4 }]}>Enter valid date and time (1-12)</Text>
          );
        })()}

        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Marks per Question</Text>
            <TextInput
              value={marksPerQuestion}
              onChangeText={setMarksPerQuestion}
              keyboardType="numeric"
              placeholder="2.0"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Negative Marking</Text>
            <TextInput
              value={negativeMarking}
              onChangeText={setNegativeMarking}
              keyboardType="numeric"
              placeholder="0.5"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Total Marks</Text>
            <TextInput
              value={totalMarks}
              onChangeText={setTotalMarks}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            />
          </View>
        </View>

        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Exam Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={2}
          placeholder="Brief description or syllabus coverage..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        />

        <Text style={[styles.inputLabel, { color: colors.foreground }]}>Student Instructions</Text>
        <TextInput
          value={instructions}
          onChangeText={setInstructions}
          multiline
          numberOfLines={3}
          placeholder="Instructions shown before starting..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
        />

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable
            disabled={submitting}
            onPress={() => void handleCreateTest(false)}
            style={[styles.draftBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
          >
            {submitting ? <ActivityIndicator size="small" /> : (
              <>
                <Feather name="file" size={14} color={colors.foreground} />
                <Text style={[styles.btnText, { color: colors.foreground }]}>Save as Draft</Text>
              </>
            )}
          </Pressable>

          <Pressable
            disabled={submitting}
            onPress={() => void handleCreateTest(true)}
            style={[styles.publishBtn, { backgroundColor: "#2563EB" }]}
          >
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Feather name="send" size={14} color="#FFFFFF" />
                <Text style={[styles.btnText, { color: "#FFFFFF" }]}>Schedule & Publish</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── SCHEDULED TESTS LIST ── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Existing Scheduled Tests ({tests.length})
        </Text>
        <Pressable onPress={() => void loadData()} style={styles.refreshIconBtn}>
          <Feather name="refresh-cw" size={14} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading scheduled tests...</Text>
        </View>
      ) : tests.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="calendar" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No scheduled tests created yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Use the form above to schedule your first competitive exam mock test.
          </Text>
        </View>
      ) : (
        tests.map((test) => {
          const liveStatus = test.liveStatus || "draft";
          const statusBadgeColor =
            liveStatus === "live"
              ? "#DC2626"
              : liveStatus === "scheduled"
              ? "#2563EB"
              : liveStatus === "completed"
              ? "#7C3AED"
              : liveStatus === "cancelled"
              ? "#64748B"
              : "#D97706";

          return (
            <View key={test.id} style={[styles.testItemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Top Row: Category tag and Status Pill */}
              <View style={styles.itemTopRow}>
                <View style={[styles.examTag, { backgroundColor: "#2563EB15" }]}>
                  <Text style={[styles.examTagText, { color: "#2563EB" }]}>
                    {test.examName || "Competitive Exam"}
                  </Text>
                </View>

                <View style={[styles.statusPill, { backgroundColor: statusBadgeColor + "18", borderColor: statusBadgeColor + "40" }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusBadgeColor }]} />
                  <Text style={[styles.statusPillText, { color: statusBadgeColor }]}>
                    {liveStatus.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Title */}
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>{test.title}</Text>

              {/* Timing details */}
              <View style={styles.timingGrid}>
                <View style={styles.timingItem}>
                  <Feather name="clock" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.timingLabel, { color: colors.mutedForeground }]}>Starts:</Text>
                  <Text style={[styles.timingValue, { color: colors.foreground }]}>{formatIST(test.scheduledStartAt)}</Text>
                </View>
                <View style={styles.timingItem}>
                  <Feather name="check-circle" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.timingLabel, { color: colors.mutedForeground }]}>Ends:</Text>
                  <Text style={[styles.timingValue, { color: colors.foreground }]}>{formatIST(test.scheduledEndAt)}</Text>
                </View>
                <View style={styles.timingItem}>
                  <Feather name="zap" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.timingLabel, { color: colors.mutedForeground }]}>Duration:</Text>
                  <Text style={[styles.timingValue, { color: colors.foreground }]}>{test.durationMinutes} mins</Text>
                </View>
                <View style={styles.timingItem}>
                  <Feather name="target" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.timingLabel, { color: colors.mutedForeground }]}>Marking:</Text>
                  <Text style={[styles.timingValue, { color: colors.foreground }]}>+{test.marksPerQuestion} / -{test.negativeMarking}</Text>
                </View>
              </View>

              {/* Participation Stats Bar */}
              <View style={[styles.statsBar, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.statMini}>
                  <Text style={[styles.statMiniVal, { color: "#2563EB" }]}>{test.participantCount || 0}</Text>
                  <Text style={[styles.statMiniLbl, { color: colors.mutedForeground }]}>Enrolled</Text>
                </View>
                <View style={styles.statMiniDivider} />
                <View style={styles.statMini}>
                  <Text style={[styles.statMiniVal, { color: "#16A34A" }]}>{test.completedCount || 0}</Text>
                  <Text style={[styles.statMiniLbl, { color: colors.mutedForeground }]}>Completed</Text>
                </View>
                <View style={styles.statMiniDivider} />
                <View style={styles.statMini}>
                  <Text style={[styles.statMiniVal, { color: "#D97706" }]}>{test.avgScore ?? "0"}</Text>
                  <Text style={[styles.statMiniLbl, { color: colors.mutedForeground }]}>Avg Score</Text>
                </View>
                <View style={styles.statMiniDivider} />
                <View style={styles.statMini}>
                  <Text style={[styles.statMiniVal, { color: "#7C3AED" }]}>{test.topScore ?? "0"}</Text>
                  <Text style={[styles.statMiniLbl, { color: colors.mutedForeground }]}>Top Score</Text>
                </View>
              </View>

              {/* Item Actions */}
              <View style={styles.itemActionRow}>
                <Pressable
                  onPress={() => void handleRegeneratePassword(test.id, test.title)}
                  style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                >
                  <Feather name="key" size={13} color="#D97706" />
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Regenerate Password</Text>
                </Pressable>

                <Pressable
                  onPress={() => void openStats(test.id)}
                  style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.background }]}
                >
                  <Feather name="bar-chart-2" size={13} color="#2563EB" />
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Stats</Text>
                </Pressable>

                {liveStatus === "draft" ? (
                  <Pressable
                    onPress={() => void handlePublish(test.id)}
                    style={[styles.actionBtn, { backgroundColor: "#16A34A15", borderColor: "#86EFAC" }]}
                  >
                    <Feather name="send" size={13} color="#16A34A" />
                    <Text style={[styles.actionBtnText, { color: "#16A34A" }]}>Publish</Text>
                  </Pressable>
                ) : null}

                {liveStatus !== "cancelled" && liveStatus !== "completed" ? (
                  <Pressable
                    onPress={() => void handleCancel(test.id)}
                    style={[styles.actionBtn, { backgroundColor: "#DC262610", borderColor: "#FCA5A5" }]}
                  >
                    <Feather name="slash" size={13} color="#DC2626" />
                    <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      )}

      {/* ── MODAL: GENERATED ACCESS PASSWORD ── */}
      <Modal visible={generatedPasswordModal.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalIconWrap}>
              <Feather name="lock" size={24} color="#2563EB" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Access Password Generated</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              {generatedPasswordModal.testTitle}
            </Text>

            <View style={[styles.passwordBox, { backgroundColor: colors.background, borderColor: "#2563EB40" }]}>
              <Text style={styles.passwordText}>{generatedPasswordModal.password}</Text>
            </View>

            <Pressable
              onPress={() => copyToClipboard(generatedPasswordModal.password)}
              style={[styles.copyBtn, { backgroundColor: generatedPasswordModal.copied ? "#16A34A" : "#2563EB" }]}
            >
              <Feather name={generatedPasswordModal.copied ? "check" : "copy"} size={16} color="#FFFFFF" />
              <Text style={styles.copyBtnText}>{generatedPasswordModal.copied ? "Copied to Clipboard!" : "Copy Password"}</Text>
            </Pressable>

            <Text style={[styles.passwordWarning, { color: colors.mutedForeground }]}>
              ⚠️ Share this password only with eligible registered students. The password is cryptographically verifier-hashed on the server and cannot be viewed in plaintext again.
            </Text>

            <Pressable
              onPress={() => setGeneratedPasswordModal((p) => ({ ...p, visible: false }))}
              style={[styles.closeModalBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.closeModalBtnText, { color: colors.foreground }]}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: PARTICIPANT STATS ── */}
      <Modal visible={statsModal.visible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.statsModalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.statsModalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Participation Statistics</Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                  {statsModal.data?.test.title || "Loading..."}
                </Text>
              </View>
              <Pressable onPress={() => setStatsModal({ visible: false, loading: false, data: null })}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            {statsModal.loading ? (
              <ActivityIndicator size="large" color="#2563EB" style={{ marginVertical: 30 }} />
            ) : statsModal.data ? (
              <ScrollView style={{ maxHeight: 400 }}>
                {/* Stats Summary */}
                <View style={styles.statsGrid}>
                  <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.statBoxVal, { color: "#2563EB" }]}>{statsModal.data.stats.totalStarted}</Text>
                    <Text style={[styles.statBoxLbl, { color: colors.mutedForeground }]}>Started</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.statBoxVal, { color: "#16A34A" }]}>{statsModal.data.stats.totalCompleted}</Text>
                    <Text style={[styles.statBoxLbl, { color: colors.mutedForeground }]}>Submitted</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.statBoxVal, { color: "#D97706" }]}>{statsModal.data.stats.avgScore}</Text>
                    <Text style={[styles.statBoxLbl, { color: colors.mutedForeground }]}>Avg Score</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.statBoxVal, { color: "#7C3AED" }]}>{statsModal.data.stats.topScore}</Text>
                    <Text style={[styles.statBoxLbl, { color: colors.mutedForeground }]}>Top Score</Text>
                  </View>
                </View>

                {/* Participant Table */}
                <Text style={[styles.tableTitle, { color: colors.foreground }]}>Participant Submissions</Text>
                {statsModal.data.participants.length === 0 ? (
                  <Text style={[styles.noParticipants, { color: colors.mutedForeground }]}>No students have attempted this test yet.</Text>
                ) : (
                  statsModal.data.participants.map((p, idx) => (
                    <View key={p.attemptId} style={[styles.participantRow, { borderColor: colors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pName, { color: colors.foreground }]}>{p.studentName}</Text>
                        <Text style={[styles.pMeta, { color: colors.mutedForeground }]}>{p.email} · {p.mobile}</Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.pScore, { color: p.submittedAt ? "#16A34A" : "#D97706" }]}>
                          {p.submittedAt ? `${p.score} pts (${p.percentage}%)` : "In Progress"}
                        </Text>
                        <Text style={[styles.pMeta, { color: colors.mutedForeground }]}>
                          {p.submittedAt ? formatIST(p.submittedAt) : "Live now"}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </ScrollView>
            ) : null}
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
    backgroundColor: "#2563EB15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563EB",
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
  noticeBox: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  noticeDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
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
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
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
  fieldHint: {
    fontSize: 10,
    marginTop: 3,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
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
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  draftBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  publishBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  refreshIconBtn: {
    padding: 6,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
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
  testItemCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  examTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  examTagText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  timingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  timingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginRight: 10,
  },
  timingLabel: {
    fontSize: 11,
  },
  timingValue: {
    fontSize: 11,
    fontWeight: "600",
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  statMini: {
    alignItems: "center",
  },
  statMiniVal: {
    fontSize: 14,
    fontWeight: "800",
  },
  statMiniLbl: {
    fontSize: 9,
    marginTop: 2,
  },
  statMiniDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#CBD5E1",
  },
  itemActionRow: {
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
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
  },
  modalIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2563EB15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  passwordBox: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  passwordText: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 4,
    color: "#2563EB",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  copyBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  passwordWarning: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    marginBottom: 16,
  },
  closeModalBtn: {
    width: "100%",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  closeModalBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statsModalContent: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  statsModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  statBoxVal: {
    fontSize: 16,
    fontWeight: "800",
  },
  statBoxLbl: {
    fontSize: 10,
    marginTop: 2,
  },
  tableTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  noParticipants: {
    fontSize: 12,
    paddingVertical: 16,
    textAlign: "center",
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  pName: {
    fontSize: 13,
    fontWeight: "600",
  },
  pMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  pScore: {
    fontSize: 13,
    fontWeight: "700",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeInput: {
    width: 48,
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
  },
  timeColon: {
    fontSize: 18,
    fontWeight: "800",
  },
  amPmToggleGroup: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    height: 42,
    marginLeft: 4,
  },
  amPmBtn: {
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  amPmText: {
    fontSize: 12,
    fontWeight: "800",
  },
  previewBanner: {
    marginTop: 8,
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewBannerText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
