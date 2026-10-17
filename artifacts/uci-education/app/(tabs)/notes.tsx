import React, { useState, useCallback } from "react";
import {
  ActivityIndicator, Linking, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";
import { useAuth } from "@/store/auth";

// ─── API base helper ───────────────────────────────────────────────────────────
const API = process.env.EXPO_PUBLIC_DOMAIN ?? "http://localhost:5000";
async function apiFetch(path: string, token: string) {
  const r = await fetch(`${API}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────────
type Section = { id: number; name: string; icon: string; description: string; examCount: number };
type Exam    = { id: number; name: string; icon: string; description: string; subjectCount: number; noteCount: number };
type Subject = { id: number; name: string; description: string; noteCount: number };
type NoteItem = { id: number; title: string; description: string; pdfUrl: string; subjectName: string | null; tags: string };

// ─── Custom hook: generic fetch ────────────────────────────────────────────────
function useApi<T>(path: string | null, token: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!path) return;
    setLoading(true); setError(null);
    try {
      const d = await apiFetch(path, token);
      setData(d);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally { setLoading(false); }
  }, [path, token]);

  React.useEffect(() => { fetch_(); }, [fetch_]);
  return { data, loading, error, refetch: fetch_ };
}

// ─── Shared UI pieces ──────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const colors = useColors();
  return (
    <View style={[sb.bar, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name="search" size={15} color={colors.mutedForeground} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        style={[sb.input, { color: colors.foreground }]} returnKeyType="search" />
      {value.length > 0 && <Pressable onPress={() => onChange("")} hitSlop={8}><Feather name="x" size={14} color={colors.mutedForeground} /></Pressable>}
    </View>
  );
}
const sb = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  input: { flex: 1, fontSize: 13, paddingVertical: 0 },
});

function Breadcrumb({ crumbs, onPress }: { crumbs: string[]; onPress: (idx: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ paddingHorizontal: 0 }}>
      {crumbs.map((c, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => onPress(i)}>
            <Text style={[bc.crumb, { color: i === crumbs.length - 1 ? "#0f172a" : "#D97706" }]}>{c}</Text>
          </Pressable>
          {i < crumbs.length - 1 && <Feather name="chevron-right" size={14} color="#94a3b8" style={{ marginHorizontal: 2 }} />}
        </View>
      ))}
    </ScrollView>
  );
}
const bc = StyleSheet.create({ crumb: { fontSize: 12, fontWeight: "700" } });

function Empty({ msg }: { msg: string }) {
  return <View style={{ alignItems: "center", paddingVertical: 40 }}><Feather name="inbox" size={40} color="#cbd5e1" /><Text style={{ color: "#94a3b8", marginTop: 10, fontSize: 13 }}>{msg}</Text></View>;
}
function ErrView({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return <View style={{ alignItems: "center", paddingVertical: 30 }}><Text style={{ color: "#ef4444", marginBottom: 10 }}>{msg}</Text><Pressable onPress={onRetry} style={{ backgroundColor: "#ef4444", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 }}><Text style={{ color: "#fff", fontWeight: "700" }}>Retry</Text></Pressable></View>;
}
function Spin() { return <ActivityIndicator size="large" color="#D97706" style={{ marginTop: 40 }} />; }

// ─── Card ──────────────────────────────────────────────────────────────────────
function Card({ icon, title, sub, badge, onPress }: { icon: string; title: string; sub: string; badge?: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [cs.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}>
      <View style={cs.iconBox}><Text style={{ fontSize: 24 }}>{icon}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[cs.title, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
        <Text style={[cs.sub, { color: colors.mutedForeground }]} numberOfLines={1}>{sub}</Text>
      </View>
      {badge ? <View style={cs.badge}><Text style={cs.badgeTxt}>{badge}</Text></View> : null}
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}
const cs = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10 },
  iconBox: { width: 46, height: 46, borderRadius: 14, backgroundColor: "#FFF4EA", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14, fontWeight: "700" },
  sub: { fontSize: 11, marginTop: 2 },
  badge: { backgroundColor: "#D97706", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
});

// ─── Note Card ─────────────────────────────────────────────────────────────────
function NoteCard({ note, onOpen }: { note: NoteItem; onOpen: () => void }) {
  const colors = useColors();
  return (
    <View style={[nc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={nc.iconBox}><Feather name="file-text" size={22} color="#2563EB" /></View>
      <View style={{ flex: 1 }}>
        <Text style={[nc.title, { color: colors.foreground }]} numberOfLines={2}>{note.title}</Text>
        {note.subjectName ? <Text style={[nc.sub, { color: colors.mutedForeground }]}>{note.subjectName}</Text> : null}
        {note.description ? <Text style={[nc.desc, { color: colors.mutedForeground }]} numberOfLines={2}>{note.description}</Text> : null}
      </View>
      <View style={{ gap: 6 }}>
        {note.pdfUrl ? (
          <Pressable onPress={onOpen} style={nc.btn}>
            <Feather name="eye" size={13} color="#fff" />
            <Text style={nc.btnTxt}>View</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
const nc = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 10 },
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  sub: { fontSize: 10, fontWeight: "700", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
  desc: { fontSize: 11, marginTop: 4, lineHeight: 16 },
  btn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  btnTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
});

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
type Level = "sections" | "exams" | "subjects" | "notes";

export default function NotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth() as any;
  const tok = token ?? "";

  const [level, setLevel] = useState<Level>("sections");
  const [section, setSection] = useState<Section | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [search, setSearch] = useState("");

  // API paths
  const sectionsPath = "/notes/sections";
  const examsPath = section ? `/notes/sections/${section.id}/exams` : null;
  const subjectsPath = exam ? `/notes/exams/${exam.id}/subjects` : null;
  const notesPath = exam ? `/notes/exams/${exam.id}/notes${subject ? `?subjectId=${subject.id}` : ""}` : null;

  const sectionsQ = useApi<{ sections: Section[] }>(level === "sections" ? sectionsPath : null, tok);
  const examsQ    = useApi<{ exams: Exam[] }>(level === "exams" ? examsPath : null, tok);
  const subjectsQ = useApi<{ subjects: Subject[] }>(level === "subjects" ? subjectsPath : null, tok);
  const notesQ    = useApi<{ notes: NoteItem[] }>(level === "notes" ? notesPath : null, tok);

  const crumbs = ["Notes", ...(section ? [section.name] : []), ...(exam ? [exam.name] : []), ...(subject ? [subject.name] : [])];

  const handleCrumb = (idx: number) => {
    if (idx === 0) { setLevel("sections"); setSection(null); setExam(null); setSubject(null); }
    else if (idx === 1) { setLevel("exams"); setExam(null); setSubject(null); }
    else if (idx === 2) { setLevel("subjects"); setSubject(null); }
  };

  const openPdf = (url: string) => {
    if (url) Linking.openURL(url);
  };

  const q = (arr: any[], key: string) =>
    search.trim() ? arr.filter(x => x[key]?.toLowerCase().includes(search.toLowerCase())) : arr;

  const paddingTop = Platform.OS === "web" ? 60 : insets.top + 8;
  const paddingBottom = Platform.OS === "web" ? 120 : Math.max(110, insets.bottom + 100);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop, paddingBottom }}
    >
      {/* Header */}
      <Text style={[st.kicker, { color: "#D97706" }]}>STUDY MATERIAL</Text>
      <Text style={[st.title, { color: colors.foreground }]}>Notes</Text>
      <Text style={[st.subtitle, { color: colors.mutedForeground }]}>Exam-wise PDF notes & study material</Text>

      {/* Breadcrumb */}
      {level !== "sections" && <Breadcrumb crumbs={crumbs} onPress={handleCrumb} />}

      {/* Search */}
      <SearchBar value={search} onChange={setSearch} placeholder={
        level === "sections" ? "Exam section dhundein..." :
        level === "exams" ? "Exam dhundein..." :
        level === "subjects" ? "Subject dhundein..." :
        "Notes dhundein..."
      } />

      {/* ── SECTIONS ── */}
      {level === "sections" && (
        <>
          {sectionsQ.loading && <Spin />}
          {sectionsQ.error && <ErrView msg={sectionsQ.error} onRetry={sectionsQ.refetch} />}
          {!sectionsQ.loading && !sectionsQ.error && (
            <>
              {q(sectionsQ.data?.sections ?? [], "name").length === 0
                ? <Empty msg="Koi section nahi mila" />
                : q(sectionsQ.data?.sections ?? [], "name").map(s => (
                    <Card key={s.id} icon={s.icon || "📚"} title={s.name}
                      sub={s.description || `${s.examCount} exams available`}
                      badge={s.examCount > 0 ? String(s.examCount) : undefined}
                      onPress={() => { setSection(s); setLevel("exams"); setSearch(""); }}
                    />
                  ))}
            </>
          )}
        </>
      )}

      {/* ── EXAMS ── */}
      {level === "exams" && (
        <>
          {examsQ.loading && <Spin />}
          {examsQ.error && <ErrView msg={examsQ.error} onRetry={examsQ.refetch} />}
          {!examsQ.loading && !examsQ.error && (
            <>
              {q(examsQ.data?.exams ?? [], "name").length === 0
                ? <Empty msg="Is section mein koi exam nahi" />
                : q(examsQ.data?.exams ?? [], "name").map(e => (
                    <Card key={e.id} icon={e.icon || "📝"} title={e.name}
                      sub={e.description || `${e.noteCount} notes`}
                      badge={e.noteCount > 0 ? `${e.noteCount} notes` : undefined}
                      onPress={() => {
                        setExam(e);
                        // If no subjects, go directly to notes
                        if (e.subjectCount === 0) { setLevel("notes"); setSearch(""); }
                        else { setLevel("subjects"); setSearch(""); }
                      }}
                    />
                  ))}
            </>
          )}
        </>
      )}

      {/* ── SUBJECTS ── */}
      {level === "subjects" && (
        <>
          {subjectsQ.loading && <Spin />}
          {subjectsQ.error && <ErrView msg={subjectsQ.error} onRetry={subjectsQ.refetch} />}
          {!subjectsQ.loading && !subjectsQ.error && (
            <>
              {/* All Notes option */}
              <Card icon="📄" title="All Notes" sub="Is exam ke saare notes"
                onPress={() => { setSubject(null); setLevel("notes"); setSearch(""); }}
              />
              {q(subjectsQ.data?.subjects ?? [], "name").length === 0
                ? <Empty msg="Koi subject nahi mila" />
                : q(subjectsQ.data?.subjects ?? [], "name").map(s => (
                    <Card key={s.id} icon="📖" title={s.name}
                      sub={s.description || `${s.noteCount} notes`}
                      badge={s.noteCount > 0 ? String(s.noteCount) : undefined}
                      onPress={() => { setSubject(s); setLevel("notes"); setSearch(""); }}
                    />
                  ))}
            </>
          )}
        </>
      )}

      {/* ── NOTES LIST ── */}
      {level === "notes" && (
        <>
          {notesQ.loading && <Spin />}
          {notesQ.error && <ErrView msg={notesQ.error} onRetry={notesQ.refetch} />}
          {!notesQ.loading && !notesQ.error && (
            <>
              {q(notesQ.data?.notes ?? [], "title").length === 0
                ? <Empty msg="Is section mein koi note publish nahi hua" />
                : q(notesQ.data?.notes ?? [], "title").map(n => (
                    <NoteCard key={n.id} note={n} onOpen={() => openPdf(n.pdfUrl)} />
                  ))}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 5 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, marginBottom: 18 },
});