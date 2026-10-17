import React, { useEffect, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { EmptyState, LoadingState, Page, Panel, ProgressBar } from "@/components/learning";
import { useColors } from "@/hooks/useColors";
import {
  fetchTestDetails,
  startScheduledOrPyqTest,
  submitExamAnswers,
  verifyScheduledTestAccess,
} from "@/lib/examApi";
import type { TestSummary, TestAttemptSession } from "@/types/content";

function formatTimer(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = Math.max(0, seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
}

function formatKolkataTime(dateString?: string | null): string {
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

export default function TestSessionScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; pwd?: string }>();
  const testId = Number(params.id);

  // Pre-test states
  const [testMeta, setTestMeta] = useState<TestSummary | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState("");
  const [passwordInput, setPasswordInput] = useState(params.pwd ?? "");
  const [passwordError, setPasswordError] = useState("");
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [upcomingCountdown, setUpcomingCountdown] = useState<number | null>(null);

  // Active Session states
  const [session, setSession] = useState<TestAttemptSession | null>(null);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [marked, setMarked] = useState<number[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [startingTest, setStartingTest] = useState(false);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const submittingRef = useRef(false);

  // Load test details first
  useEffect(() => {
    if (!Number.isInteger(testId) || testId < 1) {
      setMetaError("Invalid test ID.");
      setMetaLoading(false);
      return;
    }

    setMetaLoading(true);
    fetchTestDetails(testId)
      .then((data) => {
        setTestMeta(data.test);
        // If password was already supplied in params and test is live or practice, auto-start!
        if (params.pwd && (data.test.status === "live" || data.test.testType !== "scheduled")) {
          void initiateStart(data.test, params.pwd);
        } else if (!data.test.isPasswordProtected && (data.test.status === "live" || data.test.testType !== "scheduled")) {
          // If no password needed and test is live, start automatically!
          void initiateStart(data.test);
        }
      })
      .catch((err) => {
        setMetaError(err instanceof Error ? err.message : "Failed to load test details.");
      })
      .finally(() => setMetaLoading(false));
  }, [testId]);

  // Countdown timer for scheduled upcoming test
  useEffect(() => {
    if (!testMeta || testMeta.testType !== "scheduled" || testMeta.status !== "scheduled" || !testMeta.scheduledStartAt) {
      setUpcomingCountdown(null);
      return;
    }

    const checkStartTime = () => {
      const diffMs = new Date(testMeta.scheduledStartAt!).getTime() - Date.now();
      const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
      setUpcomingCountdown(diffSecs);

      // If scheduled time has arrived, switch status to live!
      if (diffSecs <= 0) {
        setTestMeta((prev) => (prev ? { ...prev, status: "live" } : prev));
      }
    };

    checkStartTime();
    const interval = setInterval(checkStartTime, 1000);
    return () => clearInterval(interval);
  }, [testMeta]);

  // Active Test Timer
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((new Date(session.deadline).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        void handleAutoSubmit();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [session, answers]);

  // Start Test action
  async function initiateStart(meta: TestSummary, pwd?: string) {
    if (startingTest || session) return;
    setStartingTest(true);
    setPasswordError("");

    try {
      const result = await startScheduledOrPyqTest(meta.id, pwd ?? passwordInput.trim());
      setSession(result);
      const remaining = Math.max(0, Math.ceil((new Date(result.deadline).getTime() - Date.now()) / 1000));
      setSecondsLeft(remaining);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to start test. Please verify the password.");
    } finally {
      setStartingTest(false);
    }
  }

  // Auto-submit when time expires
  async function handleAutoSubmit() {
    if (!session || submittingRef.current) return;
    submittingRef.current = true;
    try {
      const payload: Record<string, number | null> = {};
      for (const q of session.questions) {
        payload[String(q.id)] = answers[q.id] ?? null;
      }
      const res = await submitExamAnswers(session.attemptId, payload);
      router.replace({ pathname: "/result/[id]", params: { id: String(res.attemptId ?? res.id) } });
    } catch {
      // Retry once after 2 seconds
      setTimeout(() => {
        if (session) {
          const payload: Record<string, number | null> = {};
          for (const q of session.questions) {
            payload[String(q.id)] = answers[q.id] ?? null;
          }
          void submitExamAnswers(session.attemptId, payload).then((res) => {
            router.replace({ pathname: "/result/[id]", params: { id: String(res.attemptId ?? res.id) } });
          });
        }
      }, 2000);
    }
  }

  // Manual submit action
  async function handleManualSubmit() {
    if (!session || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitModalVisible(false);

    try {
      const payload: Record<string, number | null> = {};
      for (const q of session.questions) {
        payload[String(q.id)] = answers[q.id] ?? null;
      }
      const res = await submitExamAnswers(session.attemptId, payload);
      router.replace({ pathname: "/result/[id]", params: { id: String(res.attemptId ?? res.id) } });
    } catch (err) {
      submittingRef.current = false;
      Alert.alert("Submission error", err instanceof Error ? err.message : "Could not submit answers. Please try again.");
    }
  }

  function handleConfirmExit() {
    if (!session) {
      router.back();
      return;
    }
    const message = "Your test is in progress. If you leave now, the timer will keep running. Are you sure you want to exit?";
    if (Platform.OS === "web") {
      if (globalThis.confirm(message)) router.back();
    } else {
      Alert.alert("Exit Test?", message, [
        { text: "Keep Working", style: "cancel" },
        { text: "Exit", style: "destructive", onPress: () => router.back() },
      ]);
    }
  }

  // ─── RENDERING PRE-TEST SCREEN ───
  if (metaLoading) {
    return (
      <Page>
        <LoadingState label="Loading exam configuration…" />
      </Page>
    );
  }

  if (metaError && !session) {
    return (
      <Page>
        <View style={styles.errorCard}>
          <Feather name="alert-octagon" size={40} color="#ef4444" />
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>Unable to Open Test</Text>
          <Text style={[styles.errorDesc, { color: colors.mutedForeground }]}>{metaError}</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.backBtnText, { color: colors.foreground }]}>Back to Tests</Text>
          </Pressable>
        </View>
      </Page>
    );
  }

  // If session is NOT started yet, show Test Information / Waiting / Password screen
  if (!session && testMeta) {
    const isScheduled = testMeta.testType === "scheduled";
    const isUpcoming = testMeta.status === "scheduled";
    const isLive = testMeta.status === "live";
    const isCompleted = testMeta.status === "completed";
    const isCancelled = testMeta.status === "cancelled";

    return (
      <Page>
        {/* Header */}
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Feather name="arrow-left" size={16} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground }]}>Back to Tests</Text>
        </Pressable>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.preTestScroll}>
          {/* Status Banner */}
          {isCancelled ? (
            <View style={[styles.statusBox, { backgroundColor: "#94a3b825", borderColor: "#94a3b8" }]}>
              <Feather name="x-circle" size={20} color="#64748b" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBoxTitle, { color: "#64748b" }]}>Test Cancelled</Text>
                <Text style={styles.statusBoxSub}>This test was cancelled by the administrator.</Text>
              </View>
            </View>
          ) : isCompleted ? (
            <View style={[styles.statusBox, { backgroundColor: "#10b98120", borderColor: "#10b981" }]}>
              <Feather name="check-circle" size={20} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBoxTitle, { color: "#059669" }]}>Test Concluded</Text>
                <Text style={styles.statusBoxSub}>This scheduled test has ended.</Text>
              </View>
            </View>
          ) : isUpcoming ? (
            <View style={[styles.statusBox, { backgroundColor: "#3b82f618", borderColor: "#3b82f6" }]}>
              <Feather name="clock" size={24} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBoxTitle, { color: "#2563eb" }]}>Scheduled Test Locked</Text>
                <Text style={[styles.statusBoxTimer, { color: colors.foreground }]}>
                  {upcomingCountdown !== null ? `Opens in ${formatTimer(upcomingCountdown)}` : "Opening soon"}
                </Text>
                <Text style={styles.statusBoxSub}>
                  Starts at: {formatKolkataTime(testMeta.scheduledStartAt)}
                </Text>
              </View>
            </View>
          ) : isLive ? (
            <View style={[styles.statusBox, { backgroundColor: "#ef444418", borderColor: "#ef4444" }]}>
              <View style={styles.livePulseDot} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusBoxTitle, { color: "#ef4444" }]}>🔴 LIVE NOW</Text>
                <Text style={styles.statusBoxSub}>
                  Official test window is currently active until {formatKolkataTime(testMeta.scheduledEndAt)}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Test Title & Tags */}
          <View style={styles.titleSection}>
            <View style={styles.tagRow}>
              {testMeta.categoryName && (
                <View style={[styles.categoryBadge, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[styles.categoryBadgeText, { color: colors.primary }]}>
                    {testMeta.examName || testMeta.categoryName}
                  </Text>
                </View>
              )}
              {testMeta.year && (
                <View style={[styles.categoryBadge, { backgroundColor: "#f59e0b18" }]}>
                  <Text style={[styles.categoryBadgeText, { color: "#d97706" }]}>
                    {testMeta.year}{testMeta.shift ? ` · ${testMeta.shift}` : ""}
                  </Text>
                </View>
              )}
              {testMeta.isVerifiedPyq && (
                <View style={[styles.categoryBadge, { backgroundColor: "#10b98118" }]}>
                  <Text style={[styles.categoryBadgeText, { color: "#059669" }]}>Verified PYQ</Text>
                </View>
              )}
            </View>

            <Text style={[styles.testHeading, { color: colors.foreground }]}>{testMeta.title}</Text>
            {testMeta.description ? (
              <Text style={[styles.testDesc, { color: colors.mutedForeground }]}>{testMeta.description}</Text>
            ) : null}
          </View>

          {/* Exam Specs Grid */}
          <View style={[styles.specsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.specItem}>
              <Feather name="help-circle" size={18} color={colors.primary} />
              <Text style={[styles.specVal, { color: colors.foreground }]}>{testMeta.questionCount}</Text>
              <Text style={[styles.specLbl, { color: colors.mutedForeground }]}>Questions</Text>
            </View>
            <View style={[styles.specDivider, { backgroundColor: colors.border }]} />
            <View style={styles.specItem}>
              <Feather name="clock" size={18} color={colors.primary} />
              <Text style={[styles.specVal, { color: colors.foreground }]}>{testMeta.durationMinutes}</Text>
              <Text style={[styles.specLbl, { color: colors.mutedForeground }]}>Minutes</Text>
            </View>
            <View style={[styles.specDivider, { backgroundColor: colors.border }]} />
            <View style={styles.specItem}>
              <Feather name="award" size={18} color={colors.primary} />
              <Text style={[styles.specVal, { color: colors.foreground }]}>{testMeta.totalMarks || testMeta.questionCount}</Text>
              <Text style={[styles.specLbl, { color: colors.mutedForeground }]}>Total Marks</Text>
            </View>
          </View>

          {/* Marking Scheme */}
          <View style={[styles.markingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardSubTitle, { color: colors.foreground }]}>Marking Scheme</Text>
            <View style={styles.markingRow}>
              <View style={styles.markingPill}>
                <Feather name="check" size={14} color="#10b981" />
                <Text style={styles.markingCorrect}>+{testMeta.marksPerQuestion ?? 1} for correct</Text>
              </View>
              <View style={styles.markingPill}>
                <Feather name="x" size={14} color="#ef4444" />
                <Text style={styles.markingWrong}>
                  -{testMeta.negativeMarking ?? 0} for wrong
                </Text>
              </View>
              <View style={styles.markingPill}>
                <Feather name="minus" size={14} color="#64748b" />
                <Text style={styles.markingUnattempted}>0 for unattempted</Text>
              </View>
            </View>
          </View>

          {/* Instructions */}
          <View style={[styles.instructionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardSubTitle, { color: colors.foreground }]}>Important Exam Instructions</Text>
            <Text style={[styles.instructionText, { color: colors.mutedForeground }]}>
              {testMeta.instructions ||
                "1. The authoritative exam timer is synchronized with the server.\n2. Once started, the timer cannot be paused.\n3. Leaving or refreshing the page will not pause your remaining time.\n4. When time expires, your responses will be submitted automatically.\n5. Ensure an active internet connection throughout the test."}
            </Text>
          </View>

          {/* Password Entry Section (if password-protected) */}
          {testMeta.isPasswordProtected && !isCompleted && !isCancelled && (
            <View style={[styles.passwordSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.passwordHeader}>
                <Feather name="lock" size={16} color="#f59e0b" />
                <Text style={[styles.passwordHeading, { color: colors.foreground }]}>
                  Test Access Password Required
                </Text>
              </View>
              <Text style={[styles.passwordHelp, { color: colors.mutedForeground }]}>
                Enter the access password provided by your exam invigilator or administrator.
              </Text>
              <TextInput
                value={passwordInput}
                onChangeText={(t) => { setPasswordInput(t); setPasswordError(""); }}
                placeholder="Enter access password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                autoCapitalize="characters"
                style={[
                  styles.passwordInputField,
                  {
                    backgroundColor: colors.background,
                    borderColor: passwordError ? "#ef4444" : colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
              {passwordError ? <Text style={styles.passwordErrorMsg}>{passwordError}</Text> : null}
            </View>
          )}

          {/* Action Button */}
          <View style={styles.bottomAction}>
            {isCancelled ? (
              <Pressable onPress={() => router.back()} style={[styles.actionLargeBtn, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.actionLargeBtnText, { color: colors.foreground }]}>Back to Tests</Text>
              </Pressable>
            ) : isCompleted ? (
              <Pressable onPress={() => router.back()} style={[styles.actionLargeBtn, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.actionLargeBtnText, { color: colors.foreground }]}>Test Ended · View Other Tests</Text>
              </Pressable>
            ) : isUpcoming ? (
              <View
                style={[
                  styles.actionLargeBtn,
                  { backgroundColor: colors.secondary, opacity: 0.8 },
                ]}
              >
                <Feather name="clock" size={18} color={colors.foreground} />
                <Text style={[styles.actionLargeBtnText, { color: colors.foreground }]}>
                  Locked Until Scheduled Start Time
                </Text>
              </View>
            ) : (
              <Pressable
                disabled={startingTest || (testMeta.isPasswordProtected && !passwordInput.trim())}
                onPress={() => initiateStart(testMeta)}
                style={[
                  styles.actionLargeBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: startingTest || (testMeta.isPasswordProtected && !passwordInput.trim()) ? 0.6 : 1,
                  },
                ]}
              >
                {startingTest ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <>
                    <Text style={[styles.actionLargeBtnText, { color: colors.primaryForeground }]}>
                      {testMeta.isPasswordProtected ? "Unlock & Start Test" : "Start Test Now"}
                    </Text>
                    <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
                  </>
                )}
              </Pressable>
            )}
          </View>
        </ScrollView>
      </Page>
    );
  }

  // ─── RENDERING ACTIVE TEST SESSION ───
  const question = session?.questions[questionIndex];
  const questionCount = session?.questions.length ?? 0;
  const answeredCount = Object.values(answers).filter((val) => val !== null && val !== undefined).length;
  const unansweredCount = questionCount - answeredCount;
  const markedCount = marked.length;

  return (
    <Page>
      {/* Top Navbar */}
      <View style={styles.topbar}>
        <Pressable onPress={handleConfirmExit} style={[styles.exitBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="x" size={18} color={colors.foreground} />
        </Pressable>

        <View style={{ flex: 1, paddingHorizontal: 4 }}>
          <Text numberOfLines={1} style={[styles.topTitle, { color: colors.foreground }]}>
            {session?.test.title ?? "Exam Session"}
          </Text>
          <View style={styles.topMetaRow}>
            <Text style={[styles.topMeta, { color: colors.mutedForeground }]}>
              {answeredCount}/{questionCount} answered
            </Text>
            {testMeta?.negativeMarking !== undefined && (
              <Text style={[styles.topMarksRule, { color: "#dc2626" }]}>
                +{testMeta.marksPerQuestion ?? 1} / -{testMeta.negativeMarking}
              </Text>
            )}
          </View>
        </View>

        {/* Server Synced Countdown Timer */}
        <View
          style={[
            styles.timerBadge,
            { backgroundColor: secondsLeft < 120 ? "#ef4444" : colors.foreground },
          ]}
        >
          <Feather name="clock" size={13} color={colors.primaryForeground} />
          <Text style={[styles.timerBadgeText, { color: colors.primaryForeground }]}>
            {formatTimer(secondsLeft)}
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <ProgressBar value={questionCount ? ((questionIndex + 1) / questionCount) * 100 : 0} />

      {question && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.questionScroll}>
          {/* Question Header */}
          <View style={styles.questionTop}>
            <Text style={[styles.questionCountText, { color: colors.primary }]}>
              QUESTION {questionIndex + 1}{" "}
              <Text style={{ color: colors.mutedForeground }}>/ {questionCount}</Text>
            </Text>

            <View style={{ flexDirection: "row", gap: 8 }}>
              {answers[question.id] !== null && answers[question.id] !== undefined && (
                <Pressable
                  onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: null }))}
                  style={[styles.clearBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.clearBtnText, { color: colors.mutedForeground }]}>Clear</Text>
                </Pressable>
              )}

              <Pressable
                onPress={() =>
                  setMarked((prev) =>
                    prev.includes(question.id) ? prev.filter((id) => id !== question.id) : [...prev, question.id],
                  )
                }
                style={[
                  styles.markBtn,
                  {
                    backgroundColor: marked.includes(question.id) ? "#f59e0b20" : colors.card,
                    borderColor: marked.includes(question.id) ? "#f59e0b" : colors.border,
                  },
                ]}
              >
                <Feather
                  name="bookmark"
                  size={13}
                  color={marked.includes(question.id) ? "#d97706" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.markBtnText,
                    { color: marked.includes(question.id) ? "#d97706" : colors.mutedForeground },
                  ]}
                >
                  {marked.includes(question.id) ? "Marked" : "Review later"}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Question Text */}
          <Text style={[styles.promptText, { color: colors.foreground }]}>{question.prompt}</Text>

          {/* Options */}
          <View style={styles.optionsWrap}>
            {question.options.map((option, index) => {
              const selected = answers[question.id] === index;
              const letter = String.fromCharCode(65 + index);
              return (
                <Pressable
                  key={`${question.id}-${index}`}
                  onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: index }))}
                  style={[
                    styles.optionItem,
                    {
                      backgroundColor: selected ? colors.accent : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.optionLetterWrap,
                      { backgroundColor: selected ? colors.primary : colors.secondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionLetterText,
                        { color: selected ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {letter}
                    </Text>
                  </View>
                  <Text style={[styles.optionContentText, { color: colors.foreground }]}>{option}</Text>
                  {selected && <Feather name="check-circle" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>

          {/* Navigation Controls */}
          <View style={styles.navControls}>
            <Pressable
              disabled={questionIndex === 0}
              onPress={() => setQuestionIndex((v) => Math.max(0, v - 1))}
              style={[
                styles.navBtn,
                { borderColor: colors.border, opacity: questionIndex === 0 ? 0.4 : 1 },
              ]}
            >
              <Feather name="arrow-left" size={15} color={colors.foreground} />
              <Text style={[styles.navBtnLabel, { color: colors.foreground }]}>Previous</Text>
            </Pressable>

            {questionIndex < questionCount - 1 ? (
              <Pressable
                onPress={() => setQuestionIndex((v) => Math.min(questionCount - 1, v + 1))}
                style={[styles.navBtn, styles.nextBtn, { backgroundColor: colors.foreground }]}
              >
                <Text style={[styles.navBtnLabel, { color: colors.background }]}>Next Question</Text>
                <Feather name="arrow-right" size={15} color={colors.background} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setSubmitModalVisible(true)}
                style={[styles.navBtn, styles.nextBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.navBtnLabel, { color: colors.primaryForeground }]}>Submit Test</Text>
                <Feather name="check" size={15} color={colors.primaryForeground} />
              </Pressable>
            )}
          </View>

          {/* Question Jump Palette */}
          <View style={styles.jumpSection}>
            <View style={styles.jumpHeader}>
              <Text style={[styles.jumpTitle, { color: colors.mutedForeground }]}>QUESTION PALETTE</Text>
              <Pressable onPress={() => setSubmitModalVisible(true)} style={styles.submitFastLink}>
                <Text style={[styles.submitFastText, { color: colors.primary }]}>Review & Submit →</Text>
              </Pressable>
            </View>

            <View style={styles.jumpGrid}>
              {session.questions.map((item, idx) => {
                const isCurrent = idx === questionIndex;
                const isAnswered = answers[item.id] !== null && answers[item.id] !== undefined;
                const isMarked = marked.includes(item.id);

                let bg = colors.card;
                let border = colors.border;
                let textCol = colors.mutedForeground;

                if (isCurrent) {
                  border = colors.primary;
                  bg = colors.foreground;
                  textCol = colors.background;
                } else if (isMarked) {
                  bg = "#f59e0b25";
                  border = "#f59e0b";
                  textCol = "#d97706";
                } else if (isAnswered) {
                  bg = colors.accent;
                  border = colors.accent;
                  textCol = colors.accentForeground;
                }

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => setQuestionIndex(idx)}
                    style={[styles.jumpTile, { backgroundColor: bg, borderColor: border }]}
                  >
                    <Text style={[styles.jumpTileText, { color: textCol }]}>{idx + 1}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      )}

      {/* Submit Confirmation Modal */}
      <Modal
        visible={submitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSubmitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="check-square" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Submit Test?</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                Please review your progress before final submission.
              </Text>
            </View>

            <View style={styles.summaryStatsRow}>
              <View style={[styles.summaryStatItem, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.summaryStatVal, { color: "#10b981" }]}>{answeredCount}</Text>
                <Text style={[styles.summaryStatLbl, { color: colors.mutedForeground }]}>Answered</Text>
              </View>
              <View style={[styles.summaryStatItem, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.summaryStatVal, { color: "#ef4444" }]}>{unansweredCount}</Text>
                <Text style={[styles.summaryStatLbl, { color: colors.mutedForeground }]}>Unanswered</Text>
              </View>
              <View style={[styles.summaryStatItem, { backgroundColor: colors.secondary }]}>
                <Text style={[styles.summaryStatVal, { color: "#d97706" }]}>{markedCount}</Text>
                <Text style={[styles.summaryStatLbl, { color: colors.mutedForeground }]}>Marked</Text>
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <Pressable
                onPress={() => setSubmitModalVisible(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.foreground }]}>Keep Working</Text>
              </Pressable>

              <Pressable
                onPress={handleManualSubmit}
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>
                  Confirm Submit
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Page>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 },
  backText: { fontSize: 13, fontWeight: "700" },
  errorCard: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 12 },
  errorTitle: { fontSize: 20, fontWeight: "800" },
  errorDesc: { fontSize: 13, textAlign: "center", lineHeight: 18, maxWidth: 300 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginTop: 10 },
  backBtnText: { fontSize: 13, fontWeight: "700" },

  // Pre-test
  preTestScroll: { paddingBottom: 40, gap: 14 },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  livePulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#ef4444",
  },
  statusBoxTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  statusBoxTimer: { fontSize: 18, fontWeight: "800", marginVertical: 2 },
  statusBoxSub: { fontSize: 11, color: "#64748b" },

  titleSection: { gap: 6 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  categoryBadgeText: { fontSize: 10, fontWeight: "700" },
  testHeading: { fontSize: 24, fontWeight: "800", lineHeight: 30 },
  testDesc: { fontSize: 13, lineHeight: 19 },

  specsCard: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  specItem: { flex: 1, alignItems: "center", gap: 3 },
  specVal: { fontSize: 18, fontWeight: "800" },
  specLbl: { fontSize: 10, fontWeight: "600" },
  specDivider: { width: 1, height: 32 },

  markingCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  cardSubTitle: { fontSize: 13, fontWeight: "800" },
  markingRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  markingPill: { flexDirection: "row", alignItems: "center", gap: 5 },
  markingCorrect: { fontSize: 12, color: "#10b981", fontWeight: "700" },
  markingWrong: { fontSize: 12, color: "#ef4444", fontWeight: "700" },
  markingUnattempted: { fontSize: 12, color: "#64748b", fontWeight: "600" },

  instructionsCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  instructionText: { fontSize: 12, lineHeight: 18 },

  passwordSection: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  passwordHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  passwordHeading: { fontSize: 13, fontWeight: "800" },
  passwordHelp: { fontSize: 11, lineHeight: 15 },
  passwordInputField: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 2,
  },
  passwordErrorMsg: { fontSize: 11, color: "#ef4444", fontWeight: "600" },

  bottomAction: { marginTop: 6 },
  actionLargeBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionLargeBtnText: { fontSize: 15, fontWeight: "800" },

  // Active Session
  topbar: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  exitBtn: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  topTitle: { fontSize: 13, fontWeight: "800" },
  topMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  topMeta: { fontSize: 11 },
  topMarksRule: { fontSize: 10, fontWeight: "700" },
  timerBadge: {
    minWidth: 72,
    height: 34,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
  },
  timerBadgeText: { fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },

  questionScroll: { paddingBottom: 40, paddingTop: 10 },
  questionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  questionCountText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.7 },
  clearBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  clearBtnText: { fontSize: 10, fontWeight: "700" },
  markBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  markBtnText: { fontSize: 10, fontWeight: "700" },

  promptText: { fontSize: 19, lineHeight: 26, fontWeight: "800", letterSpacing: -0.3, marginBottom: 18 },
  optionsWrap: { gap: 10, marginBottom: 20 },
  optionItem: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 12,
  },
  optionLetterWrap: { width: 30, height: 30, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  optionLetterText: { fontSize: 12, fontWeight: "800" },
  optionContentText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "600" },

  navControls: { flexDirection: "row", gap: 10, marginBottom: 24 },
  navBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 100,
  },
  nextBtn: { borderWidth: 0, flex: 1 },
  navBtnLabel: { fontSize: 12, fontWeight: "800" },

  jumpSection: { gap: 10 },
  jumpHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  jumpTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  submitFastLink: { paddingVertical: 4 },
  submitFastText: { fontSize: 11, fontWeight: "800" },
  jumpGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  jumpTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  jumpTileText: { fontSize: 11, fontWeight: "800" },

  // Submit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: { width: "100%", maxWidth: 380, borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  modalHeader: { alignItems: "center", gap: 6 },
  modalIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalSubtitle: { fontSize: 12, textAlign: "center", lineHeight: 17 },
  summaryStatsRow: { flexDirection: "row", gap: 8 },
  summaryStatItem: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12, gap: 2 },
  summaryStatVal: { fontSize: 18, fontWeight: "800" },
  summaryStatLbl: { fontSize: 10, fontWeight: "600" },
  modalActionRow: { flexDirection: "row", gap: 10 },
  modalCancelBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  modalCancelText: { fontSize: 13, fontWeight: "700" },
  modalConfirmBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  modalConfirmText: { fontSize: 13, fontWeight: "800" },
});