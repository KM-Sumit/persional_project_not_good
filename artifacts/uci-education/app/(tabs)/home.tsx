import React, { useRef, useState, useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useGetStudentHome, useGetAdminDashboard, useGetAdminResults } from "@workspace/api-client-react";
import { BrandHeader, EmptyState, ErrorState, LoadingState, Page, Panel, SectionTitle } from "@/components/learning";
import { MeeshoBannerSlider } from "@/components/MeeshoBannerSlider";
import { useAuth } from "@/store/auth";
import { useColors } from "@/hooks/useColors";
import type { Course, HomeData, Note, TestSummary, AdminStats, AdminResult } from "@/types/content";

// ─────────────────────────────────────────────────────────────────────────────
// CARD COMPONENTS — polished, not template-looking
// ─────────────────────────────────────────────────────────────────────────────

function CourseCard({ course, onPress }: { course: Course; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.courseCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.courseCover, { backgroundColor: colors.accent }]}>
        {course.thumbnailUrl ? (
          <Image source={{ uri: course.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <Text style={styles.courseCoverEmoji}>📚</Text>
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={[styles.examTag, { backgroundColor: colors.primary + "18" }]}>
          <Text style={[styles.examTagText, { color: colors.primary }]}>{course.exam}</Text>
        </View>
        <Text numberOfLines={2} style={[styles.cardTitle, { color: colors.foreground }]}>{course.title}</Text>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
          {course.instructor} · {course.lessonCount} lessons
        </Text>
      </View>
      <View style={[styles.arrowCircle, { backgroundColor: colors.secondary }]}>
        <Feather name="arrow-right" size={14} color={colors.foreground} />
      </View>
    </Pressable>
  );
}

function NoteCard({ note, onPress }: { note: Note; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.noteCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.noteIcon, { backgroundColor: "#2563EB18" }]}>
        <Feather name="file-text" size={20} color="#2563EB" />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.foreground }]}>{note.title}</Text>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>{note.subject} · {note.exam}</Text>
      </View>
      {note.pdfUrl ? (
        <View style={[styles.pdfBadge, { backgroundColor: "#ef444418" }]}>
          <Text style={styles.pdfBadgeText}>PDF</Text>
        </View>
      ) : null}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function TestCard({ test, onPress }: { test: TestSummary; onPress: () => void }) {
  const colors = useColors();
  const diffColor = test.difficulty === "hard" ? "#ef4444" : test.difficulty === "medium" ? "#f59e0b" : "#10b981";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.testCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.testIcon, { backgroundColor: "#DC262618" }]}>
        <Feather name="check-square" size={20} color="#DC2626" />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.foreground }]}>{test.title}</Text>
        <Text style={[styles.cardMeta, { color: colors.mutedForeground }]}>
          {test.questionCount} Q · {test.durationMinutes} min
        </Text>
      </View>
      <View style={[styles.diffBadge, { backgroundColor: diffColor + "20" }]}>
        <Text style={[styles.diffText, { color: diffColor }]}>{test.difficulty ?? "easy"}</Text>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK BUTTON — compact icon-only tile design
// ─────────────────────────────────────────────────────────────────────────────

function QuickTile({
  label, desc, icon, bg, iconBg, iconColor, onPress,
}: {
  label: string; desc: string; icon: any; bg: string; iconBg: string; iconColor: string; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.quickTile, { backgroundColor: bg, opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={[styles.quickTileIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickTileLabel}>{label}</Text>
        <Text style={styles.quickTileDesc} numberOfLines={2}>{desc}</Text>
      </View>
      <Feather name="chevron-right" size={16} color="#94a3b8" />
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER — clean, with count badge
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title, count, accent }: { title: string; count?: number; accent: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionAccent, { backgroundColor: accent }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {count !== undefined ? (
        <View style={[styles.countBadge, { backgroundColor: accent + "22" }]}>
          <Text style={[styles.countText, { color: accent }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CARDS
// ─────────────────────────────────────────────────────────────────────────────

function AdminCard({ label, icon, color, onPress }: { label: string; icon: any; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.adminCard, { backgroundColor: color + "12", borderColor: color + "28" }]}>
      <View style={[styles.adminCardIcon, { backgroundColor: color + "22" }]}>
        <Feather name={icon} size={22} color={color} />
      </View>
      <Text style={[styles.adminCardLabel, { color: "#1e293b" }]}>{label}</Text>
    </Pressable>
  );
}

function StatBubble({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statBubble, { borderColor: color + "30", backgroundColor: color + "08" }]}>
      <Text style={[styles.statBubbleVal, { color }]}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const insets = useSafeAreaInsets();

  const scrollViewRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const scrollTo = (key: string) => {
    const y = sectionY.current[key];
    if (y !== undefined) scrollViewRef.current?.scrollTo({ y: y - 12, animated: true });
  };

  // ── Queries ──
  // @ts-ignore
  const dashQ = useGetAdminDashboard({ query: { enabled: isAdmin, staleTime: 0 } });
  // @ts-ignore
  const resQ = useGetAdminResults({ query: { enabled: isAdmin, staleTime: 0 } });
  const stats = dashQ.data as unknown as AdminStats | undefined;
  const results = (resQ.data as unknown as { results?: AdminResult[] } | undefined)?.results ?? [];

  // @ts-ignore
  const homeQ = useGetStudentHome({ query: { enabled: !isAdmin } });
  const home = homeQ.data as unknown as HomeData | undefined;

  const courses = home?.popularCourses ?? [];
  const notes = home?.latestNotes ?? [];
  const tests = home?.upcomingTests ?? [];

  const filteredCourses = useMemo(() => {
    if (!search.trim()) return courses;
    const q = search.toLowerCase();
    return courses.filter(
      (c) => c.title.toLowerCase().includes(q) || c.exam.toLowerCase().includes(q) || c.instructor.toLowerCase().includes(q)
    );
  }, [search, courses]);

  const openCourse = (id: number) => router.push({ pathname: "/course/[id]", params: { id: String(id) } });
  const openNote = (id: number) => router.push({ pathname: "/note/[id]", params: { id: String(id) } });
  const openTest = (id: number) => router.push({ pathname: "/test/[id]", params: { id: String(id) } });

  // ── ADMIN VIEW ──
  if (isAdmin) {
    return (
      <Page>
        <BrandHeader onNotification={() => {}} />
        <View style={styles.adminBadge}>
          <Feather name="shield" size={11} color="#6366f1" />
          <Text style={styles.adminBadgeText}>ADMIN DASHBOARD</Text>
        </View>
        <View style={styles.adminGrid}>
          <AdminCard label="Scheduled Tests" icon="clock" color="#ef4444" onPress={() => router.push("/admin-scheduled-tests")} />
          <AdminCard label="PYQ Papers" icon="layers" color="#10b981" onPress={() => router.push("/admin-pyq")} />
          <AdminCard label="Banners" icon="image" color="#ec4899" onPress={() => router.push("/admin-banners")} />
          <AdminCard label="Add Course" icon="book-open" color="#6366f1" onPress={() => router.push("/admin-add-course")} />
          <AdminCard label="Add Note" icon="file-text" color="#06b6d4" onPress={() => router.push("/admin-add-note")} />
          <AdminCard label="Generate Test" icon="zap" color="#f59e0b" onPress={() => router.push("/admin-generate-test")} />
        </View>

        {dashQ.isLoading ? <LoadingState label="Loading stats…" /> : null}
        {stats ? (
          <View style={styles.statRow}>
            <StatBubble label="Students" value={stats.students} color="#6366f1" />
            <StatBubble label="Courses" value={stats.courses} color="#10b981" />
            <StatBubble label="Notes" value={stats.notes} color="#f59e0b" />
            <StatBubble label="Tests" value={stats.tests} color="#ef4444" />
            <StatBubble label="Results" value={stats.attempts} color="#8b5cf6" />
          </View>
        ) : null}

        <SectionTitle title="Recent Results" action="Full Board" onAction={() => router.push("/admin")} />
        {resQ.isLoading ? <LoadingState label="Loading…" /> : null}
        {!resQ.isLoading && results.length === 0 ? (
          <EmptyState title="No submissions yet" description="Student results will appear here." />
        ) : null}
        {results.slice(0, 8).map((r, i) => (
          <Panel key={`${r.email}-${i}`} style={styles.resultRow}>
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={[styles.avatarTxt, { color: colors.accentForeground }]}>
                {(r.studentName ?? "?")[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.resName, { color: colors.foreground }]}>{r.studentName}</Text>
              <Text style={[styles.resMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                {r.testTitle} · {r.score}/{r.totalQuestions}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.resPct, { color: colors.primary }]}>{r.percentage}%</Text>
              <Text style={[styles.resMeta, { color: colors.mutedForeground }]}>{r.accuracy}% acc</Text>
            </View>
          </Panel>
        ))}
      </Page>
    );
  }

  // ── STUDENT VIEW ──
  const isSearching = search.trim().length > 0;

  return (
    <ScrollView
      ref={scrollViewRef}
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: Platform.OS === "web" ? 60 : insets.top + 8,
          paddingBottom: Platform.OS === "web" ? 120 : Math.max(110, insets.bottom + 100),
        },
      ]}
    >
      {/* ── NAVBAR ── */}
      <BrandHeader onSearch={() => {}} onNotification={() => {}} onProfile={() => router.navigate("/(tabs)/profile")} notifCount={3} />

      {/* ── SEARCH BAR ── */}
      <View style={[styles.searchBar, {
        backgroundColor: colors.card,
        borderColor: searchFocused ? colors.primary : colors.border,
        shadowColor: searchFocused ? colors.primary : "#000",
      }]}>
        <Feather name="search" size={16} color={searchFocused ? colors.primary : colors.mutedForeground} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Courses, subjects, exams dhundein..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* ── POSTER SLIDER (hidden while searching) ── */}
      {!isSearching ? (
        <>
          {homeQ.isLoading ? <LoadingState label="Loading…" /> : null}
          {homeQ.isError ? <ErrorState onRetry={() => void homeQ.refetch()} label="Load fail." /> : null}
          {!homeQ.isLoading && !homeQ.isError ? (
            <MeeshoBannerSlider banners={home?.banners ?? []} />
          ) : null}
        </>
      ) : null}

      {/* ── STATS ROW (hidden while searching) ── */}
      {!isSearching ? (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: "#FFF0E0" }]}>
              <Feather name="users" size={15} color="#D97706" />
            </View>
            <Text style={styles.statVal}>50K+</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: "#E8F4FF" }]}>
              <Feather name="play-circle" size={15} color="#2563EB" />
            </View>
            <Text style={styles.statVal}>500+</Text>
            <Text style={styles.statLabel}>Video Lectures</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: "#E8FFF5" }]}>
              <Feather name="video" size={15} color="#16A34A" />
            </View>
            <Text style={styles.statVal}>Live</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: "#F5F0FF" }]}>
              <Feather name="award" size={15} color="#7C3AED" />
            </View>
            <Text style={styles.statVal}>Expert</Text>
            <Text style={styles.statLabel}>Faculty</Text>
          </View>
        </View>
      ) : null}

      {/* ── QUICK ACCESS (2-col grid, hidden while searching) ── */}
      {!isSearching ? (
        <View style={{ marginBottom: 4 }}>
          <SectionHeader title="Quick Access" count={undefined} accent="#D97706" />
          <View style={styles.quickGrid}>
            <QuickTile label="Live Tests" desc="Scheduled official exams & ranks" icon="clock" bg="#FFF1F2" iconBg="#FECDD3" iconColor="#DC2626"
              onPress={() => router.push({ pathname: "/(tabs)/tests", params: { type: "scheduled" } })} />
            <QuickTile label="PYQ Papers" desc="Previous year papers with solutions" icon="layers" bg="#EDFDF4" iconBg="#BBF7D0" iconColor="#16A34A"
              onPress={() => router.push({ pathname: "/(tabs)/tests", params: { type: "pyq" } })} />
            <QuickTile label="Courses" desc="Learn from recorded lectures" icon="book-open" bg="#FFF4EA" iconBg="#FFE0C2" iconColor="#D97706"
              onPress={() => scrollTo("courses")} />
            <QuickTile label="Live Class" desc="Join live interactive classes" icon="video" bg="#EDFDF4" iconBg="#BBF7D0" iconColor="#16A34A"
              onPress={() => router.navigate("/(tabs)/courses")} />
            <QuickTile label="Study Notes" desc="Download PDF notes & summaries" icon="file-text" bg="#F3F0FF" iconBg="#DDD6FE" iconColor="#7C3AED"
              onPress={() => router.navigate("/(tabs)/notes")} />
            <QuickTile label="My Progress" desc="Track test scores & accuracy" icon="trending-up" bg="#F0FFF4" iconBg="#BBF7D0" iconColor="#059669"
              onPress={() => router.navigate("/(tabs)/profile")} />
          </View>
        </View>
      ) : null}

      {/* ── COMPETITIVE EXAMS CATEGORIES (hidden while searching) ── */}
      {!isSearching ? (
        <View style={{ marginBottom: 12 }}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: "#6366f1" }]} />
            <Text style={styles.sectionTitle}>Target Competitive Exams</Text>
            <Pressable onPress={() => router.push("/(tabs)/tests")} style={{ marginLeft: "auto" }}>
              <Text style={[styles.seeAll, { color: "#6366f1" }]}>All Tests →</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {[
              { id: "ssc-exams", name: "SSC Exams", tag: "CGL · CHSL · MTS · GD", icon: "award", color: "#6366f1", bg: "#EEF2FF" },
              { id: "railway-exams", name: "Railway Exams", tag: "NTPC · Group D · ALP", icon: "zap", color: "#059669", bg: "#ECFDF5" },
              { id: "mppsc-exams", name: "MPPSC", tag: "State Service · Forest · Prelims", icon: "shield", color: "#D97706", bg: "#FFFBEB" },
              { id: "mp-police-exams", name: "MP Police", tag: "Constable · Sub Inspector", icon: "compass", color: "#DC2626", bg: "#FEF2F2" },
            ].map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => router.push({ pathname: "/(tabs)/tests", params: { categorySlug: cat.id } })}
                style={({ pressed }) => [
                  styles.categoryCard,
                  { backgroundColor: cat.bg, borderColor: cat.color + "30", opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <View style={[styles.categoryIconWrap, { backgroundColor: cat.color + "20" }]}>
                  <Feather name={cat.icon as any} size={22} color={cat.color} />
                </View>
                <Text style={[styles.categoryName, { color: colors.foreground }]}>{cat.name}</Text>
                <Text style={styles.categoryTag} numberOfLines={1}>{cat.tag}</Text>
                <View style={[styles.categoryExplorePill, { backgroundColor: cat.color }]}>
                  <Text style={styles.categoryExploreText}>Explore PYQ & Tests</Text>
                  <Feather name="arrow-right" size={12} color="#fff" />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── COURSES SECTION ── */}
      <View onLayout={(e) => { sectionY.current["courses"] = e.nativeEvent.layout.y; }}>
        <SectionHeader
          title={isSearching ? `"${search}" ke results` : "Courses"}
          count={filteredCourses.length}
          accent="#D97706"
        />
        {homeQ.isLoading ? <LoadingState label="Courses load ho rahe hain…" /> : null}
        {filteredCourses.length > 0
          ? filteredCourses.map((c) => (
              <CourseCard key={c.id} course={c} onPress={() => openCourse(c.id)} />
            ))
          : !homeQ.isLoading
          ? <EmptyState
              title={isSearching ? "Koi course nahi mila" : "Abhi koi course nahi"}
              description={isSearching ? `"${search}" se koi match nahi.` : "Courses jald hi add honge."}
            />
          : null}
      </View>

      {/* ── CONTINUE LEARNING (hidden while searching) ── */}
      {!isSearching && courses.length > 0 ? (
        <View style={{ marginBottom: 8 }}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: "#D97706" }]} />
            <Text style={styles.sectionTitle}>Continue Learning</Text>
            <Pressable onPress={() => scrollTo("courses")} style={{ marginLeft: "auto" }}>
              <Text style={styles.seeAll}>See All →</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
            {courses.slice(0, 5).map((c, i) => (
              <Pressable key={c.id} onPress={() => openCourse(c.id)}
                style={({ pressed }) => [styles.continueCard, { opacity: pressed ? 0.9 : 1 }]}>
                <View style={styles.continueCover}>
                  {c.thumbnailUrl
                    ? <Image source={{ uri: c.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    : <View style={[StyleSheet.absoluteFill, { backgroundColor: i % 2 === 0 ? "#1e293b" : "#0f2027", justifyContent: "center", alignItems: "center" }]}>
                        <Text style={{ fontSize: 32 }}>📚</Text>
                      </View>}
                  <View style={styles.durationBadge}><Text style={styles.durationText}>{c.lessonCount > 0 ? `${c.lessonCount * 12}:00` : "18:20"}</Text></View>
                  <View style={styles.playCircle}><Feather name="play" size={18} color="#fff" /></View>
                </View>
                <View style={styles.continueMeta}>
                  <View style={[styles.examTag2, { backgroundColor: "#D97706" + "18" }]}>
                    <Text style={[styles.examTagTxt2, { color: "#D97706" }]}>{c.exam}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.continueTitle}>{c.title}</Text>
                  <Text style={styles.continueSub}>{c.instructor} · Lecture {i + 1}</Text>
                  <View style={styles.progressRow}>
                    <View style={[styles.progressTrackSm, { backgroundColor: "#e2e8f0" }]}>
                      <View style={[styles.progressFillSm, { width: `${Math.max(10, (i + 1) * 15)}%`, backgroundColor: "#D97706" }]} />
                    </View>
                    <Text style={styles.progressPct}>{Math.max(10, (i + 1) * 15)}%</Text>
                  </View>
                  <View style={styles.continueFooter}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="clock" size={11} color="#64748b" />
                      <Text style={styles.timeLeft}>{12 - i} min left</Text>
                    </View>
                    <Pressable onPress={() => openCourse(c.id)} style={styles.continueBtn}>
                      <Text style={styles.continueBtnTxt}>Continue</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* ── NOTES SECTION (hidden while searching) ── */}
      {!isSearching ? (
        <View onLayout={(e) => { sectionY.current["notes"] = e.nativeEvent.layout.y; }}>
          <SectionHeader title="Notes" count={notes.length} accent="#2563EB" />
          {notes.length > 0
            ? notes.map((n) => <NoteCard key={n.id} note={n} onPress={() => openNote(n.id)} />)
            : !homeQ.isLoading
            ? <EmptyState title="Notes abhi nahi hain" description="Study notes jald add honge." />
            : null}
        </View>
      ) : null}

      {/* ── TESTS SECTION (hidden while searching) ── */}
      {!isSearching ? (
        <View onLayout={(e) => { sectionY.current["tests"] = e.nativeEvent.layout.y; }}>
          <SectionHeader title="Tests" count={tests.length} accent="#DC2626" />
          {tests.length > 0
            ? tests.map((t) => <TestCard key={t.id} test={t} onPress={() => openTest(t.id)} />)
            : !homeQ.isLoading
            ? <EmptyState title="Koi test nahi" description="Practice tests jald available honge." />
            : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: { paddingHorizontal: 16 },

  // Search
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 11,
    marginBottom: 18,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  // Quick tiles — 2-column horizontal rows with desc + arrow
  quickGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24,
  },
  quickTile: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  quickTileIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  quickTileLabel: { fontSize: 13, fontWeight: "700", color: "#0f172a", marginBottom: 2 },
  quickTileDesc: { fontSize: 10, color: "#64748b", lineHeight: 13 },

  // Section header
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 8, marginBottom: 14,
  },
  sectionAccent: { width: 4, height: 20, borderRadius: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", flex: 1 },
  seeAll: { fontSize: 13, fontWeight: "700", color: "#D97706" },
  countBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  countText: { fontSize: 11, fontWeight: "800" },

  // Stats row
  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18, marginBottom: 20,
    paddingVertical: 14, paddingHorizontal: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, height: 36, backgroundColor: "#e2e8f0" },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statVal: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  statLabel: { fontSize: 9, color: "#64748b", textAlign: "center", fontWeight: "500" },

  // Course card
  courseCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 20, borderWidth: 1,
    padding: 12, marginBottom: 10,
  },
  courseCover: {
    width: 68, height: 68, borderRadius: 16,
    justifyContent: "center", alignItems: "center", overflow: "hidden",
  },
  courseCoverEmoji: { fontSize: 28 },
  examTag: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  examTagText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  cardTitle: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  cardMeta: { fontSize: 11, marginTop: 2 },
  arrowCircle: { width: 30, height: 30, borderRadius: 15, justifyContent: "center", alignItems: "center" },

  // Note card
  noteCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 8,
  },
  noteIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  pdfBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  pdfBadgeText: { fontSize: 9, fontWeight: "800", color: "#ef4444" },

  // Test card
  testCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1, padding: 13, marginBottom: 8,
  },
  testIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  diffBadge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  diffText: { fontSize: 10, fontWeight: "700", textTransform: "capitalize" },

  // Admin
  adminBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginBottom: 16, alignSelf: "flex-start",
    backgroundColor: "#6366f115", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  adminBadgeText: { fontSize: 10, fontWeight: "800", color: "#6366f1", letterSpacing: 1 },
  adminGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  adminCard: {
    width: "48%", borderRadius: 18, borderWidth: 1,
    paddingVertical: 18, alignItems: "center", gap: 10,
  },
  adminCardIcon: { width: 48, height: 48, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  adminCardLabel: { fontSize: 12, fontWeight: "700" },
  statRow: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  statBubble: {
    flex: 1, minWidth: 60, borderRadius: 14, borderWidth: 1,
    paddingVertical: 12, alignItems: "center", gap: 2,
  },
  statBubbleVal: { fontSize: 22, fontWeight: "800" },
  statLbl: { fontSize: 10, color: "#64748b", textAlign: "center" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 11, marginBottom: 7 },
  avatar: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 14, fontWeight: "800" },
  resName: { fontSize: 12, fontWeight: "700" },
  resMeta: { fontSize: 10, marginTop: 2 },
  resPct: { fontSize: 16, fontWeight: "800" },

  // Continue Learning
  continueCard: {
    width: 200,
    borderRadius: 18,
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  continueCover: {
    width: "100%", height: 112,
    backgroundColor: "#1e293b",
    position: "relative",
    justifyContent: "center", alignItems: "center",
  },
  durationBadge: {
    position: "absolute", bottom: 8, right: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  durationText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  playCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.6)",
  },
  continueMeta: { padding: 10, gap: 4 },
  examTag2: { alignSelf: "flex-start", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  examTagTxt2: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  continueTitle: { fontSize: 13, fontWeight: "700", color: "#0f172a", lineHeight: 17 },
  continueSub: { fontSize: 10, color: "#64748b" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  progressTrackSm: { flex: 1, height: 5, borderRadius: 4, overflow: "hidden" },
  progressFillSm: { height: 5, borderRadius: 4 },
  progressPct: { fontSize: 10, fontWeight: "700", color: "#D97706", minWidth: 28, textAlign: "right" },
  continueFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  timeLeft: { fontSize: 10, color: "#64748b" },
  continueBtn: {
    backgroundColor: "#D97706", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  continueBtnTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  categoryCard: {
    width: 220,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "800",
  },
  categoryTag: {
    fontSize: 11,
    color: "#64748b",
  },
  categoryExplorePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingVertical: 7,
    marginTop: 4,
  },
  categoryExploreText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
});
