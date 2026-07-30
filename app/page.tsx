"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { unzipSync } from "fflate";
import initSqlJs from "sql.js";

type Rating = "again" | "hard" | "good" | "easy";
type ReviewLog = {
  rating: Rating;
  reviewedAt: number;
  scheduledFor: number;
  intervalMinutes: number;
};
type Card = {
  id: string;
  question: string;
  answer: string;
  due: number;
  interval: number;
  reviews: number;
  lastReviewedAt?: number;
  lastRating?: Rating;
  history?: ReviewLog[];
};
type Deck = {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  cards: Card[];
  folderId?: string | null;
  priority?: number;
  contest?: string;
};
type DeckFolder = {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
};
type DashboardStat =
  | "streak"
  | "xp"
  | "answered"
  | "due"
  | "decks"
  | "cards"
  | "today";
type Pace = "casual" | "regular" | "intensivo" | "maratonista";
type Profile = {
  name: string;
  goal: string;
  pace?: Pace;
  dailyGoal?: number;
  educations?: string[];
  specializations?: string[];
  currentIncome?: number;
};
type ContestStatus = "aberto" | "previsto" | "realizado";
type ContestSubject = {
  id: string;
  name: string;
  weight?: number;
  progress: number;
};
type Education =
  | "medio"
  | "superior-qualquer"
  | "superior-ti"
  | "superior-pos-ti"
  | "outra";
type Contest = {
  id: string;
  name: string;
  status: ContestStatus;
  registrationOpen: boolean;
  registered: boolean;
  noticeOpen: boolean;
  examDate: string;
  city: string;
  salary?: number;
  education: Education;
  educationOther?: string;
  compatible?: boolean;
  priority: number;
  color: string;
  logo?: string;
  noticeName?: string;
  noticeData?: string;
  deckIds: string[];
  noticeValidity?: string;
  score?: number;
  placement?: number;
  result: "" | "aprovado-vagas" | "cadastro-reserva" | "eliminado";
  subjects?: ContestSubject[];
  report?: string;
  vacancies?: number;
  sourceUpdatedAt?: number;
  createdAt: number;
};
type Store = {
  schemaVersion?: number;
  profile: Profile | null;
  decks: Deck[];
  contests: Contest[];
  xp: number;
  streak: number;
  lastStudy?: string;
  daily?: Record<string, number>;
  folders?: DeckFolder[];
  dashboardStats?: DashboardStat[];
  studyPanelContestIds?: string[];
};

const PACES: Record<Pace, { label: string; goal: number }> = {
  casual: { label: "Casual", goal: 10 },
  regular: { label: "Regular", goal: 30 },
  intensivo: { label: "Intensivo", goal: 50 },
  maratonista: { label: "Maratonista", goal: 100 },
};
const TROPHIES = [
  [
    "Semente do Saber",
    "#CD7F32",
    "A germinação da disciplina e o rompimento da inércia inicial.",
  ],
  [
    "Constância de Ferro",
    "#A19D94",
    "O esforço deliberado transformado em rotina inabalável.",
  ],
  [
    "Chama Intelectual",
    "#FFBF00",
    "A paixão pelo aprendizado e o raciocínio em movimento.",
  ],
  [
    "Prata Analítica",
    "#C0C0C0",
    "Precisão técnica para reconhecer cada detalhe e distrator.",
  ],
  [
    "Ouro Acadêmico",
    "#FFD700",
    "A metade da coleção e o domínio dos fundamentos.",
  ],
  [
    "Esmeralda Cognitiva",
    "#50C878",
    "Resistência mental para sustentar longas jornadas.",
  ],
  [
    "Safira da Estratégia",
    "#0F52BA",
    "Metacognição, serenidade e gestão da atenção.",
  ],
  [
    "Rubi da Persistência",
    "#E0115F",
    "O triunfo sobre o cansaço e a alta complexidade.",
  ],
  [
    "Diamante do Saber",
    "#B9F2FF",
    "Conhecimento límpido, afiado e quase inquebrável.",
  ],
  ["Coroa Mestra", "#E5E4E2", "Maestria completa no ecossistema de questões."],
] as const;

const initial: Store = {
  schemaVersion: 3,
  profile: null,
  decks: [],
  contests: [],
  xp: 0,
  streak: 0,
  folders: [],
  dashboardStats: ["streak", "xp", "answered", "due"],
  studyPanelContestIds: [],
};
const DATA_KEY = "alkastudy-data-v1";
const LEGACY_DATA_KEY = "focodeck-data-v1";
const THEME_KEY = "alkastudy-theme";
const LEGACY_THEME_KEY = "focodeck-theme";
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const today = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function normalizeStore(value: Store): Store {
  return {
    ...initial,
    ...value,
    folders: Array.isArray(value.folders) ? value.folders : [],
    dashboardStats:
      Array.isArray(value.dashboardStats) && value.dashboardStats.length
        ? value.dashboardStats
        : initial.dashboardStats,
    studyPanelContestIds: Array.isArray(value.studyPanelContestIds)
      ? value.studyPanelContestIds
      : [],
    schemaVersion: 4,
    contests: (value.contests || []).map((contest) => ({
      ...contest,
      priority: contest.priority ?? 3,
      color: contest.color ?? "#6d4aff",
      deckIds: contest.deckIds ?? [],
      registrationOpen: contest.registrationOpen ?? false,
      registered: contest.registered ?? false,
      noticeOpen: contest.noticeOpen ?? false,
      status: contest.status ?? "previsto",
      result: contest.result ?? "",
      subjects: Array.isArray(contest.subjects)
        ? contest.subjects.map((subject) => ({
            ...subject,
            id: subject.id || uid(),
            name: subject.name || "Matéria",
            progress: Math.max(0, Math.min(100, subject.progress || 0)),
          }))
        : [],
      createdAt: contest.createdAt ?? Date.now(),
    })),
    decks: (value.decks || []).map((deck) => ({
      ...deck,
      folderId: deck.folderId || null,
      priority: Number.isFinite(deck.priority) ? deck.priority : 3,
      contest: deck.contest || "",
      cards: (deck.cards || []).map((card) => ({
        ...card,
        due: Number.isFinite(card.due) ? card.due : Date.now(),
        interval: Number.isFinite(card.interval) ? card.interval : 0,
        reviews: Number.isFinite(card.reviews) ? card.reviews : 0,
        history: Array.isArray(card.history) ? card.history : [],
      })),
    })),
  };
}

const EDUCATION_LABELS: Record<Education, string> = {
  medio: "Ensino médio",
  "superior-qualquer": "Superior em qualquer área",
  "superior-ti": "Superior em TI",
  "superior-pos-ti": "Superior em qualquer área + pós em TI",
  outra: "Outra formação",
};
const daysUntil = (date?: string) =>
  !date
    ? null
    : Math.ceil(
        (new Date(`${date}T12:00:00`).getTime() - Date.now()) / DAY,
      );
const actualStatus = (contest: Contest): ContestStatus => {
  const days = daysUntil(contest.examDate);
  return days !== null && days < 0 ? "realizado" : contest.status;
};
const emptyContest = (): Contest => ({
  id: uid(),
  name: "",
  status: "previsto",
  registrationOpen: false,
  registered: false,
  noticeOpen: false,
  examDate: "",
  city: "",
  education: "medio",
  priority: 3,
  color: "#6d4aff",
  deckIds: [],
  result: "",
  subjects: [],
  createdAt: Date.now(),
});
const fileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
function isCompatible(profile: Profile, contest: Contest) {
  const education = (profile.educations || []).join(" ").toLowerCase();
  const specialization = (profile.specializations || [])
    .join(" ")
    .toLowerCase();
  if (contest.education === "medio") return education.length > 0;
  if (contest.education === "superior-qualquer")
    return /superior|bacharel|tecnólogo|tecnologo|licenciatura/.test(education);
  if (contest.education === "superior-ti")
    return /ti|tecnologia|software|computação|computacao|sistemas/.test(
      education,
    );
  if (contest.education === "superior-pos-ti")
    return (
      /superior|bacharel|tecnólogo|tecnologo|licenciatura/.test(education) &&
      /ti|tecnologia|software|computação|computacao|sistemas/.test(
        specialization,
      )
    );
  return contest.compatible;
}

function RichText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    if (typeof window === "undefined") return "";
    const formatted = text
      .replace(/\*\*(.+?)\*\*/gs, "<strong>$1</strong>")
      .replace(/__(.+?)__/gs, "<strong>$1</strong>")
      .replace(/==(.+?)==/gs, "<mark>$1</mark>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\r?\n/g, "<br>");
    const doc = new DOMParser().parseFromString(
      `<div>${formatted}</div>`,
      "text/html",
    );
    const root = doc.body.firstElementChild;
    const allowed = new Set([
      "B",
      "STRONG",
      "BR",
      "EM",
      "I",
      "U",
      "MARK",
      "CODE",
    ]);
    root?.querySelectorAll("*").forEach((node) => {
      if (!allowed.has(node.tagName))
        node.replaceWith(...Array.from(node.childNodes));
      else
        Array.from(node.attributes).forEach((attr) =>
          node.removeAttribute(attr.name),
        );
    });
    return root?.innerHTML || "";
  }, [text]);
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

function parseText(text: string, fallback: string): Deck {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
  const cards: Card[] = [];
  for (const line of lines) {
    let parts = line.includes("\t")
      ? line.split("\t")
      : line.includes(";")
        ? line.split(";")
        : line.split("|");
    if (parts.length < 2) continue;
    const question = parts.shift()!.trim();
    const answer = parts
      .join(line.includes("\t") ? "\t" : line.includes(";") ? ";" : "|")
      .trim();
    if (question && answer && !/^pergunta$/i.test(question))
      cards.push({
        id: uid(),
        question,
        answer,
        due: Date.now(),
        interval: 0,
        reviews: 0,
      });
  }
  if (!cards.length)
    throw new Error(
      "Nenhuma pergunta e resposta foi reconhecida. Use: pergunta ; resposta",
    );
  return {
    id: uid(),
    name: fallback.replace(/\.(txt|csv)$/i, ""),
    description: "Baralho importado",
    createdAt: Date.now(),
    cards,
  };
}

const cleanAnkiText = (value: string) =>
  value
    .replace(/\x1f/g, " · ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
async function parseApkg(file: File): Promise<Deck[]> {
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const collection =
    files["collection.anki21"] ||
    files["collection.anki2"] ||
    files["collection.anki21b"];
  if (!collection)
    throw new Error("O APKG não contém uma coleção Anki compatível.");
  const SQL = await initSqlJs({ locateFile: () => "./vendor/sql-wasm.wasm" });
  const db = new SQL.Database(collection);
  const names = new Map<number, string>();
  try {
    const raw = db.exec("SELECT decks FROM col LIMIT 1")[0]?.values?.[0]?.[0];
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw) as Record<string, { name?: string }>;
      Object.entries(parsed).forEach(([id, deck]) =>
        names.set(Number(id), deck.name || `Baralho ${id}`),
      );
    }
  } catch {}
  const rows = db.exec(
    "SELECT c.did, n.flds FROM cards c JOIN notes n ON n.id = c.nid ORDER BY c.did, c.id",
  )[0];
  if (!rows?.values?.length)
    throw new Error("Nenhum cartão foi encontrado no APKG.");
  const grouped = new Map<number, Card[]>();
  rows.values.forEach(([deckId, fields]) => {
    const id = Number(deckId);
    const parts = String(fields).split("\x1f").map(cleanAnkiText);
    if (parts.length < 2 || !parts[0] || !parts[1]) return;
    grouped.set(id, [
      ...(grouped.get(id) || []),
      {
        id: uid(),
        question: parts[0],
        answer: parts.slice(1).join("\n"),
        due: Date.now(),
        interval: 0,
        reviews: 0,
      },
    ]);
  });
  db.close();
  return [...grouped.entries()].map(([id, cards]) => ({
    id: uid(),
    name: names.get(id) || file.name.replace(/\.apkg$/i, ""),
    description: `Importado de ${file.name}`,
    createdAt: Date.now(),
    cards,
  }));
}

export default function Home() {
  const [store, setStore] = useState<Store>(initial);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState("Início");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Deck | null>(null);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);
  const [reviewDeck, setReviewDeck] = useState<Deck | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [answer, setAnswer] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved =
        localStorage.getItem(DATA_KEY) ?? localStorage.getItem(LEGACY_DATA_KEY);
      if (saved) {
        setStore(normalizeStore(JSON.parse(saved)));
        localStorage.setItem(DATA_KEY, saved);
      }
    } catch {}
    const theme =
      localStorage.getItem(THEME_KEY) ?? localStorage.getItem(LEGACY_THEME_KEY);
    setDark(
      theme === "dark" ||
        (!theme && matchMedia("(prefers-color-scheme: dark)").matches),
    );
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(DATA_KEY, JSON.stringify(store));
  }, [store, ready]);
  const save = (next: Store) => {
    setStore(next);
    localStorage.setItem(DATA_KEY, JSON.stringify(next));
  };
  const toast = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice(""), 3500);
  };
  const due = useMemo(
    () =>
      store.decks
        .flatMap((d) =>
          d.cards.map((c) => ({ ...c, deckId: d.id, deckName: d.name })),
        )
        .filter((c) => c.due <= Date.now()),
    [store.decks],
  );

  const importFile = async (file?: File, folderId: string | null = null) => {
    if (!file) return;
    try {
      const imported = file.name.toLowerCase().endsWith(".apkg")
        ? await parseApkg(file)
        : [parseText(await file.text(), file.name)];
      const decks = imported.map((deck) => ({ ...deck, folderId }));
      save({ ...store, decks: [...store.decks, ...decks] });
      setActive("Baralhos");
      toast(
        `${decks.length} baralho(s) e ${decks.reduce((sum, deck) => sum + deck.cards.length, 0)} cartas importados.`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível importar.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };
  const exportBackup = () => {
    const content = JSON.stringify(
      {
        format: "alkastudy-backup",
        version: 3,
        exportedAt: Date.now(),
        data: store,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `AlkaStudy-backup-${today()}.alkastudy`;
    link.click();
    URL.revokeObjectURL(url);
    toast("Backup exportado com sucesso.");
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const data = parsed?.format === "alkastudy-backup" ? parsed.data : parsed;
      if (!data || !Array.isArray(data.decks))
        throw new Error("Arquivo de backup inválido.");
      save(normalizeStore(data));
      toast("Backup restaurado e migrado para a versão atual.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha ao restaurar backup.");
    }
    if (backupRef.current) backupRef.current.value = "";
  };

  const removeDeck = (id: string) => {
    if (confirm("Excluir este baralho e todas as cartas?"))
      save({ ...store, decks: store.decks.filter((d) => d.id !== id) });
  };
  const startReview = (deck?: Deck) => {
    const now = Date.now();
    const source =
      deck || store.decks.find((d) => d.cards.some((c) => c.due <= now));
    if (!source)
      return toast(
        store.decks.length
          ? "Nenhuma revisão está vencida agora."
          : "Importe ou crie um baralho primeiro.",
      );
    const dueCards = source.cards
      .filter((c) => c.due <= now)
      .sort((a, b) => a.due - b.due);
    if (!dueCards.length)
      return toast("Este baralho não possui revisões vencidas agora.");
    setReviewDeck({ ...source, cards: dueCards });
    setReviewIndex(0);
    setAnswer(false);
  };
  const rate = (quality: Rating) => {
    if (!reviewDeck) return;
    const current = reviewDeck.cards[reviewIndex];
    const now = Date.now();
    const previousDays = Math.max(0, current.interval || 0);
    const intervalMinutes =
      quality === "again"
        ? 10
        : quality === "hard"
          ? 24 * 60
          : quality === "good"
            ? Math.max(2, previousDays * 2 || 2) * 24 * 60
            : Math.max(4, previousDays * 3 || 4) * 24 * 60;
    const nextDue = now + intervalMinutes * MINUTE;
    const log: ReviewLog = {
      rating: quality,
      reviewedAt: now,
      scheduledFor: nextDue,
      intervalMinutes,
    };
    const updated = store.decks.map((d) =>
      d.id !== reviewDeck.id
        ? d
        : {
            ...d,
            cards: d.cards.map((c) =>
              c.id !== current.id
                ? c
                : {
                    ...c,
                    reviews: c.reviews + 1,
                    interval: intervalMinutes / (24 * 60),
                    due: nextDue,
                    lastReviewedAt: now,
                    lastRating: quality,
                    history: [...(c.history || []), log].slice(-100),
                  },
            ),
          },
    );
    const nextIndex = reviewIndex + 1;
    const last = store.lastStudy;
    const yesterday = today(new Date(now - DAY));
    const streak =
      last === today()
        ? store.streak
        : last === yesterday
          ? store.streak + 1
          : 1;
    save({
      ...store,
      decks: updated,
      xp: store.xp + 10,
      streak,
      lastStudy: today(),
      daily: { ...store.daily, [today()]: (store.daily?.[today()] || 0) + 1 },
    });
    if (nextIndex >= reviewDeck.cards.length) {
      setReviewDeck(null);
      toast("Sessão concluída. +10 XP por resposta!");
    } else {
      const savedCurrent = updated
        .find((d) => d.id === reviewDeck.id)!
        .cards.find((c) => c.id === current.id)!;
      setReviewDeck({
        ...reviewDeck,
        cards: reviewDeck.cards.map((c) =>
          c.id === current.id ? savedCurrent : c,
        ),
      });
      setReviewIndex(nextIndex);
      setAnswer(false);
    }
  };

  if (!ready) return null;
  if (!store.profile)
    return (
      <Onboarding
        dark={dark}
        onTheme={() => setDark(!dark)}
        onSave={(profile) => save({ ...store, profile })}
      />
    );
  if (reviewDeck) {
    const card = reviewDeck.cards[reviewIndex];
    return (
      <main className={dark ? "app dark" : "app"}>
        <section className="review-screen">
          <header className="review-head">
            <button className="ghost" onClick={() => setReviewDeck(null)}>
              ← Sair
            </button>
            <div>
              <strong>{reviewDeck.name}</strong>
              <small>
                {" "}
                {reviewIndex + 1} de {reviewDeck.cards.length}
              </small>
            </div>
            <button className="theme-toggle" onClick={() => setDark(!dark)}>
              {dark ? "☀" : "☾"}
            </button>
          </header>
          <div className="review-progress">
            <span
              style={{
                width: `${((reviewIndex + 1) / reviewDeck.cards.length) * 100}%`,
              }}
            />
          </div>
          <article className="flashcard">
            <span className="eyebrow">PERGUNTA</span>
            <RichText className="rich-question" text={card.question} />
            {answer && (
              <div className="answer">
                <span className="eyebrow">RESPOSTA</span>
                <RichText className="rich-answer" text={card.answer} />
              </div>
            )}
          </article>
          {!answer ? (
            <button className="primary big" onClick={() => setAnswer(true)}>
              Mostrar resposta
            </button>
          ) : (
            <div className="ratings">
              <button onClick={() => rate("again")}>
                De novo<small>10 min</small>
              </button>
              <button onClick={() => rate("hard")}>
                Difícil<small>1 dia</small>
              </button>
              <button onClick={() => rate("good")}>
                Bom<small>2+ dias</small>
              </button>
              <button onClick={() => rate("easy")}>
                Fácil<small>4+ dias</small>
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  const toggleTheme = () => {
    const n = !dark;
    setDark(n);
    localStorage.setItem(THEME_KEY, n ? "dark" : "light");
  };
  return (
    <main className={dark ? "app dark" : "app"}>
      <aside className="sidebar">
        <Brand />
        <nav>
          {[
            ["⌂", "Início"],
            ["▱", "Baralhos"],
            ["◎", "Concursos"],
            ["▦", "Calendário"],
            ["♜", "Troféus"],
            ["□", "Plano de estudos"],
            ["▥", "Estatísticas"],
            ["⚙", "Configurações"],
          ].map(([i, l]) => (
            <button
              key={l}
              className={active === l ? "active" : ""}
              onClick={() => setActive(l)}
            >
              <span className="icon">{i}</span>
              {l}
            </button>
          ))}
        </nav>
        <div className="offline">
          <span>✓</span>
          <div>
            <strong>Funciona offline</strong>
            <small>Dados salvos neste dispositivo</small>
          </div>
        </div>
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <h1>
              Olá, <span>{store.profile.name}</span>
            </h1>
            <button className="goal">◎ {store.profile.goal}</button>
          </div>
          <div className="top-actions">
            <button className="theme-toggle" onClick={toggleTheme}>
              {dark ? "☀" : "☾"}
            </button>
            <button className="points">☆ {store.xp}</button>
            <button className="avatar">
              {store.profile.name[0]?.toUpperCase()}
            </button>
          </div>
        </header>
        {active === "Início" && (
          <Dashboard
            store={store}
            due={due.length}
            onReview={() => startReview()}
            onContest={setEditingContest}
            onStatsChange={(dashboardStats) =>
              save({ ...store, dashboardStats })
            }
          />
        )}
        {active === "Baralhos" && (
          <Decks
            decks={store.decks}
            fileRef={fileRef}
            onFile={importFile}
            onEdit={setEditing}
            onRemove={removeDeck}
            onReview={startReview}
            folders={store.folders || []}
            onOrganize={(decks: Deck[], folders: DeckFolder[]) =>
              save({ ...store, decks, folders })
            }
            onCreate={(folderId: string | null = null) =>
              setEditing({
                id: uid(),
                name: "",
                description: "",
                createdAt: Date.now(),
                cards: [],
                folderId,
                priority: 3,
                contest: "",
              })
            }
          />
        )}
        {active === "Troféus" && <TrophyRoom store={store} />}
        {active === "Concursos" && (
          <Contests
            contests={store.contests}
            decks={store.decks}
            onCreate={() => setEditingContest(emptyContest())}
            onEdit={setEditingContest}
            onRemove={(id) => {
              if (confirm("Excluir este concurso/exame?"))
                save({
                  ...store,
                  contests: store.contests.filter((contest) => contest.id !== id),
                });
            }}
          />
        )}
        {active === "Calendário" && (
          <ContestCalendar
            contests={store.contests}
            onEdit={setEditingContest}
          />
        )}
        {active === "Plano de estudos" && (
          <StudyPlan
            contests={store.contests}
            decks={store.decks}
            panelIds={store.studyPanelContestIds || []}
            onPanelChange={(studyPanelContestIds) =>
              save({ ...store, studyPanelContestIds })
            }
            onEdit={setEditingContest}
            onCreate={() => setEditingContest(emptyContest())}
          />
        )}
        {active === "Estatísticas" && <Stats store={store} />}
        {active === "Configurações" && (
          <Settings
            profile={store.profile}
            onSave={(profile) => {
              save({ ...store, profile });
              toast("Perfil atualizado.");
            }}
            onReset={() => {
              if (confirm("Apagar todos os dados do AlkaStudy?")) {
                localStorage.removeItem(DATA_KEY);
                localStorage.removeItem(LEGACY_DATA_KEY);
                setStore(initial);
              }
            }}
            backupRef={backupRef}
            onExport={exportBackup}
            onImport={importBackup}
          />
        )}
      </section>
      {notice && <div className="toast">✓ {notice}</div>}
      {editing && (
        <DeckEditor
          deck={editing}
          onClose={() => setEditing(null)}
          onSave={(deck) => {
            save({
              ...store,
              decks: store.decks.some((d) => d.id === deck.id)
                ? store.decks.map((d) => (d.id === deck.id ? deck : d))
                : [...store.decks, deck],
            });
            setEditing(null);
            toast("Baralho salvo.");
          }}
        />
      )}
      {editingContest && (
        <ContestEditor
          contest={editingContest}
          profile={store.profile}
          decks={store.decks}
          onClose={() => setEditingContest(null)}
          onSave={(contest) => {
            save({
              ...store,
              contests: store.contests.some((item) => item.id === contest.id)
                ? store.contests.map((item) =>
                    item.id === contest.id ? contest : item,
                  )
                : [...store.contests, contest],
            });
            setEditingContest(null);
            toast("Concurso/exame salvo.");
          }}
        />
      )}
    </main>
  );
}

function Brand({ full = false }: { full?: boolean }) {
  if (full) {
    return (
      <div
        className="brand-full"
        aria-label="AlkaStudy — Ferramenta de Estudos Inteligente"
      >
        <img
          className="logo-light"
          src="./brand/alkastudy-logo-light.png"
          alt="AlkaStudy — Ferramenta de Estudos Inteligente"
        />
        <img
          className="logo-dark"
          src="./brand/alkastudy-logo-dark.png"
          alt="AlkaStudy — Ferramenta de Estudos Inteligente"
        />
      </div>
    );
  }
  return (
    <div className="brand">
      <img src="./brand/alkastudy-symbol.png" alt="" />
      <strong>AlkaStudy</strong>
    </div>
  );
}

function Onboarding({
  dark,
  onTheme,
  onSave,
}: {
  dark: boolean;
  onTheme: () => void;
  onSave: (p: Profile) => void;
}) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [pace, setPace] = useState<Pace>("regular");
  return (
    <main className={dark ? "welcome dark" : "welcome"}>
      <button className="theme-toggle welcome-theme" onClick={onTheme}>
        {dark ? "☀" : "☾"}
      </button>
      <section className="signup">
        <Brand full />
        <span className="eyebrow">PRIMEIRO ACESSO</span>
        <h1>Prepare seu espaço de estudos</h1>
        <p>Seu perfil e seus baralhos ficarão salvos somente nesta máquina.</p>
        <label>
          Como devemos chamar você?
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Seu nome"
          />
        </label>
        <label>
          Qual é seu objetivo?
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Ex.: Polícia Federal, ENEM..."
          />
        </label>
        <label>
          Qual é o seu ritmo diário?
          <select
            value={pace}
            onChange={(e) => setPace(e.target.value as Pace)}
          >
            {Object.entries(PACES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label} — {v.goal} questões/dia
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={!name.trim() || !goal.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              goal: goal.trim(),
              pace,
              dailyGoal: PACES[pace].goal,
            })
          }
        >
          Criar meu perfil
        </button>
      </section>
    </main>
  );
}

function progress(store: Store) {
  const answered = Math.floor(store.xp / 10),
    level = Math.min(100, Math.floor(answered / 50) + 1),
    inLevel = answered % 50,
    unlocked = Math.min(10, Math.floor(answered / 500)),
    goal =
      store.profile?.dailyGoal || PACES[store.profile?.pace || "regular"].goal,
    todayDone = store.daily?.[today()] || 0;
  return { answered, level, inLevel, unlocked, goal, todayDone };
}
function Dashboard({
  store,
  due,
  onReview,
  onStatsChange,
  onContest,
}: {
  store: Store;
  due: number;
  onReview: () => void;
  onStatsChange: (stats: DashboardStat[]) => void;
  onContest: (contest: Contest) => void;
}) {
  const p = progress(store);
  const [choosingStats, setChoosingStats] = useState(false);
  const rank = p.unlocked
    ? TROPHIES[p.unlocked - 1][0]
    : "Aprendiz em ascensão";
  const cards = store.decks.reduce((total, deck) => total + deck.cards.length, 0);
  const selectedStats = store.dashboardStats || initial.dashboardStats!;
  const statOptions: Record<
    DashboardStat,
    { icon: string; value: string | number; label: string }
  > = {
    streak: { icon: "🔥", value: store.streak, label: "dias de sequência" },
    xp: { icon: "✦", value: `${store.xp} XP`, label: "experiência acumulada" },
    answered: {
      icon: "✓",
      value: p.answered,
      label: "questões respondidas",
    },
    due: { icon: "◷", value: due, label: "revisões pendentes" },
    decks: { icon: "▱", value: store.decks.length, label: "baralhos" },
    cards: { icon: "▤", value: cards, label: "cartas cadastradas" },
    today: { icon: "◎", value: p.todayDone, label: "questões hoje" },
  };
  const toggleStat = (stat: DashboardStat) => {
    const next = selectedStats.includes(stat)
      ? selectedStats.filter((item) => item !== stat)
      : [...selectedStats, stat];
    if (next.length) onStatsChange(next);
  };
  return (
    <>
      <section className="status-strip">
        <article>
          <small>NÍVEL ATUAL</small>
          <strong>{p.level}</strong>
          <div className="level-bar">
            <i style={{ width: `${p.level === 100 ? 100 : p.inLevel * 2}%` }} />
          </div>
          <span>
            {p.level === 100
              ? "Nível máximo alcançado"
              : `${50 - p.inLevel} questões para o nível ${p.level + 1}`}
          </span>
        </article>
        <article>
          <small>RANK ATUAL</small>
          <strong>{rank}</strong>
          <span>{p.unlocked}/10 troféus conquistados</span>
        </article>
        <article>
          <small>META DE HOJE</small>
          <strong>
            {p.todayDone}/{p.goal}
          </strong>
          <div className="level-bar daily">
            <i
              style={{
                width: `${Math.min(100, (p.todayDone / p.goal) * 100)}%`,
              }}
            />
          </div>
          <span>{Math.max(0, p.goal - p.todayDone)} questões restantes</span>
        </article>
      </section>
      <section className="hero">
        <div>
          <span className="eyebrow light">SEU PRÓXIMO PASSO</span>
          <h2>
            Pronta para
            <br />
            avançar?
          </h2>
          <p>
            <strong>▱ &nbsp;{due} revisões pendentes</strong>
          </p>
          <p>◷ &nbsp;{store.decks.length} baralhos na biblioteca</p>
          <button className="primary" onClick={onReview}>
            Começar revisão <b>›</b>
          </button>
        </div>
        <div className="hero-brand">
          <img
            src="./brand/alkastudy-symbol.png"
            alt="Mascote AlkaStudy estudando"
          />
        </div>
      </section>
      <ContestMiniCalendar contests={store.contests} onEdit={onContest} />
      <section className="dashboard-grid">
        <article className="panel plan">
          <h3>▦ Seus baralhos</h3>
          {store.decks.length ? (
            store.decks.slice(0, 4).map((d, i) => (
              <div className="subject" key={d.id}>
                <b className={["purple", "blue", "orange"][i % 3]}>▱</b>
                <div>
                  <strong>{d.name}</strong>
                  <small>{d.description || "Sem descrição"}</small>
                  <div className="bar">
                    <i
                      style={{
                        width: `${Math.min(100, (d.cards.reduce((n, c) => n + c.reviews, 0) / Math.max(1, d.cards.length)) * 20)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="subject-meta">
                  <em>{d.cards.length}</em>
                  <small>cartas</small>
                </div>
              </div>
            ))
          ) : (
            <p className="muted">Importe seu primeiro baralho em “Baralhos”.</p>
          )}
        </article>
        <div className="right-grid compact-stats">
          <button
            className="stats-config"
            onClick={() => setChoosingStats(!choosingStats)}
            aria-expanded={choosingStats}
          >
            ⚙ Escolher estatísticas
          </button>
          {choosingStats && (
            <div className="stats-picker">
              {(Object.keys(statOptions) as DashboardStat[]).map((stat) => (
                <label key={stat}>
                  <input
                    type="checkbox"
                    checked={selectedStats.includes(stat)}
                    onChange={() => toggleStat(stat)}
                  />
                  {statOptions[stat].label}
                </label>
              ))}
            </div>
          )}
          <div className="stats-mini-grid">
            {selectedStats.map((stat) => {
              const item = statOptions[stat];
              if (!item) return null;
              return (
                <article className="panel mini-stat" key={stat}>
                  <span className="bubble">{item.icon}</span>
                  <div>
                    <strong>{item.value}</strong>
                    <small>{item.label}</small>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

function ContestLogo({ contest }: { contest: Contest }) {
  return contest.logo ? (
    <img className="contest-logo" src={contest.logo} alt="" />
  ) : (
    <span className="contest-logo placeholder">
      {contest.name[0]?.toUpperCase() || "◎"}
    </span>
  );
}

function ContestMiniCalendar({
  contests,
  onEdit,
}: {
  contests: Contest[];
  onEdit: (contest: Contest) => void;
}) {
  const upcoming = contests
    .filter((contest) => (daysUntil(contest.examDate) ?? 0) >= 0)
    .sort(
      (a, b) =>
        (daysUntil(a.examDate) ?? 99999) -
        (daysUntil(b.examDate) ?? 99999),
    )
    .slice(0, 4);
  return (
    <section className="contest-mini">
      <header>
        <div>
          <span className="eyebrow">PRÓXIMAS PROVAS</span>
          <h3>Calendário de prioridades</h3>
        </div>
        <small>Ordenado pela data da prova</small>
      </header>
      {upcoming.length ? (
        <div className="contest-mini-grid">
          {upcoming.map((contest) => {
            const days = daysUntil(contest.examDate);
            return (
              <button
                className="contest-mini-card"
                key={contest.id}
                onClick={() => onEdit(contest)}
              >
                <ContestLogo contest={contest} />
                <div>
                  <strong>{contest.name}</strong>
                  <small>
                    {contest.examDate
                      ? new Date(`${contest.examDate}T12:00:00`).toLocaleDateString(
                          "pt-BR",
                        )
                      : "Data a definir"}
                  </small>
                  <b>
                    {days === null
                      ? "Prova prevista"
                      : days === 0
                        ? "A prova é hoje"
                        : `Faltam ${days} dias`}
                  </b>
                </div>
                <span>{contest.registered ? "INSCRITO" : "A INSCREVER"}</span>
                <em>
                  {contest.education === "outra"
                    ? contest.educationOther
                    : EDUCATION_LABELS[contest.education]}
                </em>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="muted">
          Cadastre um concurso ou exame para acompanhar sua próxima prova.
        </p>
      )}
    </section>
  );
}

function Contests({
  contests,
  decks,
  onCreate,
  onEdit,
  onRemove,
}: {
  contests: Contest[];
  decks: Deck[];
  onCreate: () => void;
  onEdit: (contest: Contest) => void;
  onRemove: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"todos" | ContestStatus>("todos");
  const visible = [...contests]
    .filter((contest) => filter === "todos" || actualStatus(contest) === filter)
    .sort((a, b) => {
      const statusOrder = { aberto: 0, previsto: 1, realizado: 2 };
      return (
        statusOrder[actualStatus(a)] - statusOrder[actualStatus(b)] ||
        (daysUntil(a.examDate) ?? 99999) - (daysUntil(b.examDate) ?? 99999)
      );
    });
  return (
    <section>
      <header className="section-head">
        <div>
          <span className="eyebrow">PLANEJAMENTO DE PROVAS</span>
          <h2>Concursos e exames</h2>
          <p>Cadastre alvos, editais, prioridades e resultados anteriores.</p>
        </div>
        <button className="primary" onClick={onCreate}>
          + Novo concurso
        </button>
      </header>
      <div className="contest-filters">
        {(["todos", "aberto", "previsto", "realizado"] as const).map((item) => (
          <button
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item === "todos"
              ? "Todos"
              : item === "aberto"
                ? "Abertos"
                : item === "previsto"
                  ? "Previstos"
                  : "Realizados"}
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="contest-list">
          {visible.map((contest) => {
            const related = decks.filter((deck) =>
              contest.deckIds.includes(deck.id),
            );
            const days = daysUntil(contest.examDate);
            return (
              <article
                key={contest.id}
                className="contest-card"
                style={{ borderLeftColor: contest.color }}
              >
                <ContestLogo contest={contest} />
                <div className="contest-info">
                  <span className={`contest-status ${actualStatus(contest)}`}>
                    {actualStatus(contest)}
                  </span>
                  <h3>{contest.name}</h3>
                  <p>
                    {contest.examDate
                      ? new Date(`${contest.examDate}T12:00:00`).toLocaleDateString(
                          "pt-BR",
                        )
                      : "Data a definir"}{" "}
                    · {contest.city || "Local a definir"}
                  </p>
                  <small>
                    {contest.registered ? "Inscrito" : "A inscrever"} ·{" "}
                    {related.length} baralho(s) relacionado(s)
                    {days !== null && days >= 0 ? ` · faltam ${days} dias` : ""}
                  </small>
                </div>
                <div className="contest-actions">
                  <button onClick={() => onEdit(contest)}>Editar</button>
                  <button
                    className="danger"
                    onClick={() => onRemove(contest.id)}
                  >
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Simple
          title="Nenhum concurso nesta situação"
          icon="◎"
          text="Cadastre um concurso ou exame para começar o planejamento."
        />
      )}
    </section>
  );
}

function ContestCalendar({
  contests,
  onEdit,
}: {
  contests: Contest[];
  onEdit: (contest: Contest) => void;
}) {
  const [filter, setFilter] = useState<ContestStatus>("aberto");
  const groups = contests
    .filter((contest) => actualStatus(contest) === filter)
    .sort(
      (a, b) =>
        new Date(a.examDate || "2999-12-31").getTime() -
        new Date(b.examDate || "2999-12-31").getTime(),
    )
    .reduce<Record<string, Contest[]>>((acc, contest) => {
      const month = contest.examDate
        ? new Date(`${contest.examDate}T12:00:00`).toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })
        : "Data a definir";
      (acc[month] ||= []).push(contest);
      return acc;
    }, {});
  return (
    <section>
      <header className="section-head">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h2>Calendário de concursos</h2>
        </div>
      </header>
      <div className="contest-filters">
        {(["aberto", "previsto", "realizado"] as ContestStatus[]).map((item) => (
          <button
            key={item}
            className={filter === item ? "active" : ""}
            onClick={() => setFilter(item)}
          >
            {item === "aberto"
              ? "Em aberto"
              : item === "previsto"
                ? "Previstos"
                : "Realizados"}
          </button>
        ))}
      </div>
      {Object.entries(groups).map(([month, items]) => (
        <div className="calendar-group" key={month}>
          <h3>{month}</h3>
          {items.map((contest) => (
            <button
              className="calendar-event"
              style={{ borderLeftColor: contest.color }}
              onClick={() => onEdit(contest)}
              key={contest.id}
            >
              <b>{contest.examDate ? contest.examDate.slice(8, 10) : "—"}</b>
              <ContestLogo contest={contest} />
              <span>
                <strong>{contest.name}</strong>
                <small>
                  {contest.city || "Local a definir"} ·{" "}
                  {contest.registered ? "Inscrito" : "A inscrever"}
                </small>
              </span>
            </button>
          ))}
        </div>
      ))}
      {!Object.keys(groups).length && (
        <Simple
          title="Sem eventos"
          icon="▦"
          text="Não há concursos nesta situação."
        />
      )}
    </section>
  );
}

const normalizeSubjectName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(nocoes|de|da|do|das|dos|e)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function contestSimilarity(a: Contest, b: Contest) {
  const left = new Set(
    (a.subjects || []).map((subject) => normalizeSubjectName(subject.name)),
  );
  const right = new Set(
    (b.subjects || []).map((subject) => normalizeSubjectName(subject.name)),
  );
  if (!left.size || !right.size) return 0;
  const common = [...left].filter((subject) => right.has(subject)).length;
  return Math.round((common / new Set([...left, ...right]).size) * 100);
}

function subjectStatus(progress: number) {
  if (progress >= 100) return "Concluída";
  if (progress >= 60) return "Avançada";
  if (progress > 0) return "Em estudo";
  return "Não iniciada";
}

function StudyPlan({
  contests,
  decks,
  panelIds,
  onPanelChange,
  onEdit,
  onCreate,
}: {
  contests: Contest[];
  decks: Deck[];
  panelIds: string[];
  onPanelChange: (ids: string[]) => void;
  onEdit: (contest: Contest) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState<"todos" | "aberto" | "previsto">("todos");
  const [view, setView] = useState<"painel" | "relatorio">("painel");
  const available = [...contests]
    .filter((contest) => actualStatus(contest) !== "realizado")
    .filter(
      (contest) => filter === "todos" || actualStatus(contest) === filter,
    )
    .sort(
      (a, b) =>
        (daysUntil(a.examDate) ?? 99999) - (daysUntil(b.examDate) ?? 99999) ||
        b.priority - a.priority,
    );
  const selected = available.filter((contest) => panelIds.includes(contest.id));
  const panel = selected.length ? selected : available;
  const allSubjects = [
    ...new Map(
      panel
        .flatMap((contest) => contest.subjects || [])
        .filter((subject) => subject.name.trim())
        .map((subject) => [normalizeSubjectName(subject.name), subject.name]),
    ).values(),
  ];
  const progressFor = (contest: Contest) => {
    const subjects = contest.subjects || [];
    if (!subjects.length) return 0;
    const totalWeight = subjects.reduce(
      (sum, subject) => sum + (subject.weight || 1),
      0,
    );
    return Math.round(
      subjects.reduce(
        (sum, subject) =>
          sum + subject.progress * (subject.weight || 1),
        0,
      ) / totalWeight,
    );
  };
  const compatibility = panel.map((contest) => {
    const comparisons = contests
      .filter((item) => item.id !== contest.id)
      .map((item) => ({
        contest: item,
        score: contestSimilarity(contest, item),
      }))
      .sort((a, b) => b.score - a.score);
    return {
      contest,
      most: comparisons[0],
      least: [...comparisons].reverse().find((item) => item.score > 0) ||
        comparisons.at(-1),
    };
  });

  return (
    <section className="study-plan-page">
      <header className="section-head">
        <div>
          <span className="eyebrow">INTELIGÊNCIA DE PREPARAÇÃO</span>
          <h2>Painel de concursos abertos e previstos</h2>
          <p>
            Compare programas, acompanhe cada matéria e descubra quais provas
            aproveitam melhor o que você já estuda.
          </p>
        </div>
        <button className="primary" onClick={onCreate}>
          + Cadastrar concurso
        </button>
      </header>

      <div className="plan-toolbar panel">
        <div className="contest-filters">
          {(["todos", "aberto", "previsto"] as const).map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item === "todos"
                ? "Abertos e previstos"
                : item === "aberto"
                  ? "Abertos"
                  : "Previstos"}
            </button>
          ))}
        </div>
        <div className="plan-view-toggle">
          <button
            className={view === "painel" ? "active" : ""}
            onClick={() => setView("painel")}
          >
            ▦ Tabela comparativa
          </button>
          <button
            className={view === "relatorio" ? "active" : ""}
            onClick={() => setView("relatorio")}
          >
            ▥ Relatório
          </button>
        </div>
        <div className="panel-selector">
          <strong>Meu painel</strong>
          <small>Selecione os concursos que deseja comparar:</small>
          <div>
            {available.map((contest) => (
              <label key={contest.id}>
                <input
                  type="checkbox"
                  checked={panelIds.includes(contest.id)}
                  onChange={(event) =>
                    onPanelChange(
                      event.target.checked
                        ? [...new Set([...panelIds, contest.id])]
                        : panelIds.filter((id) => id !== contest.id),
                    )
                  }
                />
                <span style={{ borderColor: contest.color }}>
                  {contest.name}
                </span>
              </label>
            ))}
          </div>
          {!panelIds.length && (
            <small>
              Nenhum filtro aplicado: mostrando todos em ordem temporal.
            </small>
          )}
        </div>
      </div>

      {!panel.length ? (
        <Simple
          title="Monte seu painel"
          icon="▦"
          text="Cadastre concursos abertos ou previstos e informe as matérias para iniciar a comparação."
        />
      ) : view === "painel" ? (
        <div className="contest-matrix-wrap panel">
          <table className="contest-matrix">
            <thead>
              <tr>
                <th>Matéria</th>
                {panel.map((contest) => (
                  <th
                    key={contest.id}
                    style={{ borderTopColor: contest.color }}
                  >
                    <button onClick={() => onEdit(contest)}>
                      {contest.name}
                    </button>
                    <small>
                      {actualStatus(contest) === "aberto" ? "ABERTO" : "PREVISTO"}
                      {contest.examDate
                        ? ` · ${new Date(`${contest.examDate}T12:00:00`).toLocaleDateString("pt-BR")}`
                        : " · DATA A DEFINIR"}
                    </small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allSubjects.map((name) => (
                <tr key={normalizeSubjectName(name)}>
                  <th>{name}</th>
                  {panel.map((contest) => {
                    const subject = (contest.subjects || []).find(
                      (item) =>
                        normalizeSubjectName(item.name) ===
                        normalizeSubjectName(name),
                    );
                    return (
                      <td key={contest.id}>
                        {subject ? (
                          <button
                            className={`subject-progress p${Math.floor(subject.progress / 25)}`}
                            title="Editar matéria"
                            onClick={() => onEdit(contest)}
                          >
                            <strong>
                              {subject.weight
                                ? `${subject.name} · ${subject.weight} pts`
                                : subject.name}
                            </strong>
                            <span>
                              <i style={{ width: `${subject.progress}%` }} />
                            </span>
                            <small>
                              {subjectStatus(subject.progress)} ·{" "}
                              {subject.progress}%
                            </small>
                          </button>
                        ) : (
                          <span className="not-required">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="matrix-summary">
                <th>Progresso geral</th>
                {panel.map((contest) => (
                  <td key={contest.id}>
                    <strong>{progressFor(contest)}%</strong>
                  </td>
                ))}
              </tr>
              <tr className="matrix-summary">
                <th>Situação</th>
                {panel.map((contest) => (
                  <td key={contest.id}>
                    {contest.report || (contest.noticeOpen
                      ? "Edital publicado"
                      : contest.registrationOpen
                        ? "Inscrições abertas"
                        : "Acompanhando atualização")}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="compatibility-grid">
          {compatibility.map(({ contest, most, least }) => {
            const relatedDecks = decks.filter(
              (deck) =>
                contest.deckIds.includes(deck.id) ||
                normalizeSubjectName(deck.contest || "") ===
                  normalizeSubjectName(contest.name),
            );
            return (
              <article
                className="panel contest-report"
                key={contest.id}
                style={{ borderTopColor: contest.color }}
              >
                <header>
                  <ContestLogo contest={contest} />
                  <div>
                    <span className={`contest-status ${actualStatus(contest)}`}>
                      {actualStatus(contest)}
                    </span>
                    <h3>{contest.name}</h3>
                    <small>
                      {contest.vacancies
                        ? `${contest.vacancies} vagas · `
                        : ""}
                      {contest.city || "Local a definir"}
                    </small>
                  </div>
                  <button onClick={() => onEdit(contest)}>Editar</button>
                </header>
                <div className="report-progress">
                  <strong>{progressFor(contest)}%</strong>
                  <span>
                    <i style={{ width: `${progressFor(contest)}%` }} />
                  </span>
                  <small>progresso ponderado do programa</small>
                </div>
                <dl>
                  <div>
                    <dt>Mais compatível</dt>
                    <dd>
                      {most
                        ? `${most.contest.name} (${most.score}% das matérias)`
                        : "Cadastre outro programa para comparar"}
                    </dd>
                  </div>
                  <div>
                    <dt>Menos compatível</dt>
                    <dd>
                      {least
                        ? `${least.contest.name} (${least.score}% das matérias)`
                        : "Sem comparação disponível"}
                    </dd>
                  </div>
                  <div>
                    <dt>Baralhos relacionados</dt>
                    <dd>{relatedDecks.length}</dd>
                  </div>
                  <div>
                    <dt>Última atualização</dt>
                    <dd>
                      {contest.sourceUpdatedAt
                        ? new Date(contest.sourceUpdatedAt).toLocaleDateString(
                            "pt-BR",
                          )
                        : "Não informada"}
                    </dd>
                  </div>
                </dl>
                <p>{contest.report || "Nenhuma observação cadastrada."}</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ContestEditor({
  contest,
  profile,
  decks,
  onClose,
  onSave,
}: {
  contest: Contest;
  profile: Profile;
  decks: Deck[];
  onClose: () => void;
  onSave: (contest: Contest) => void;
}) {
  const [draft, setDraft] = useState<Contest>(
    JSON.parse(JSON.stringify(contest)),
  );
  const automaticCompatibility = isCompatible(profile, draft);
  return (
    <div className="modal-back">
      <section className="modal contest-modal">
        <header>
          <h2>{contest.name ? "Editar concurso/exame" : "Novo concurso/exame"}</h2>
          <button onClick={onClose}>×</button>
        </header>
        <div className="form-grid">
          <label className="span-2">
            Nome
            <input
              required
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
          </label>
          <label>
            Status
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  status: event.target.value as ContestStatus,
                })
              }
            >
              <option value="aberto">Aberto</option>
              <option value="previsto">Previsto</option>
              <option value="realizado">Realizado/anterior</option>
            </select>
          </label>
          <label>
            Data da prova
            <input
              type="date"
              value={draft.examDate}
              onChange={(event) =>
                setDraft({ ...draft, examDate: event.target.value })
              }
            />
          </label>
          <label>
            Cidade da prova
            <input
              value={draft.city}
              onChange={(event) =>
                setDraft({ ...draft, city: event.target.value })
              }
            />
          </label>
          <label>
            Remuneração bruta (R$)
            <input
              type="number"
              min="0"
              value={draft.salary || ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  salary: Number(event.target.value) || undefined,
                })
              }
            />
          </label>
          <label>
            Prioridade
            <select
              value={draft.priority}
              onChange={(event) =>
                setDraft({ ...draft, priority: Number(event.target.value) })
              }
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option value={value} key={value}>
                  P{value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cor
            <input
              type="color"
              value={draft.color}
              onChange={(event) =>
                setDraft({ ...draft, color: event.target.value })
              }
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.registrationOpen}
              onChange={(event) =>
                setDraft({ ...draft, registrationOpen: event.target.checked })
              }
            />{" "}
            Inscrições abertas
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.registered}
              onChange={(event) =>
                setDraft({ ...draft, registered: event.target.checked })
              }
            />{" "}
            Já estou inscrito
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.noticeOpen}
              onChange={(event) =>
                setDraft({ ...draft, noticeOpen: event.target.checked })
              }
            />{" "}
            Edital aberto/publicado
          </label>
          <label>
            Logo/imagem
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file)
                  setDraft({ ...draft, logo: await fileAsDataUrl(file) });
              }}
            />
          </label>
          <label>
            Edital (PDF)
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file)
                  setDraft({
                    ...draft,
                    noticeName: file.name,
                    noticeData: await fileAsDataUrl(file),
                  });
              }}
            />
            <small>{draft.noticeName}</small>
          </label>
          <label className="span-2">
            Escolaridade
            <select
              value={draft.education}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  education: event.target.value as Education,
                })
              }
            >
              {Object.entries(EDUCATION_LABELS).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {draft.education === "outra" && (
            <label className="span-2">
              Descreva a exigência
              <input
                value={draft.educationOther || ""}
                onChange={(event) =>
                  setDraft({ ...draft, educationOther: event.target.value })
                }
              />
            </label>
          )}
          <div
            className={`compatibility span-2 ${automaticCompatibility ? "yes" : "no"}`}
          >
            <strong>
              {automaticCompatibility
                ? "✓ Formação compatível"
                : "! Compatibilidade não confirmada"}
            </strong>
            <small>
              Resultado automático com base no perfil. Para “Outra formação”,
              escolha manualmente:
            </small>
            <select
              value={String(draft.compatible ?? "")}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  compatible:
                    event.target.value === ""
                      ? undefined
                      : event.target.value === "true",
                })
              }
            >
              <option value="">Automático</option>
              <option value="true">Sim, compatível</option>
              <option value="false">Não compatível</option>
            </select>
          </div>
          <fieldset className="span-2">
            <legend>Baralhos relacionados</legend>
            {decks.length ? (
              decks.map((deck) => (
                <label className="check" key={deck.id}>
                  <input
                    type="checkbox"
                    checked={draft.deckIds.includes(deck.id)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        deckIds: event.target.checked
                          ? [...draft.deckIds, deck.id]
                          : draft.deckIds.filter((id) => id !== deck.id),
                      })
                    }
                  />
                  {deck.name}
                </label>
              ))
            ) : (
              <small>Nenhum baralho cadastrado.</small>
            )}
          </fieldset>
          <fieldset className="span-2 subject-editor">
            <legend>Matérias previstas e status de estudo</legend>
            <p>
              Cadastre o programa previsto. Peso/pontos é opcional e o progresso
              pode ser atualizado a qualquer momento.
            </p>
            {(draft.subjects || []).map((subject, index) => (
              <div className="subject-editor-row" key={subject.id}>
                <input
                  aria-label={`Nome da matéria ${index + 1}`}
                  placeholder="Ex.: Português"
                  value={subject.name}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      subjects: (draft.subjects || []).map((item) =>
                        item.id === subject.id
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
                <input
                  aria-label={`Peso da matéria ${index + 1}`}
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="Peso"
                  value={subject.weight ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      subjects: (draft.subjects || []).map((item) =>
                        item.id === subject.id
                          ? {
                              ...item,
                              weight: event.target.value
                                ? Number(event.target.value)
                                : undefined,
                            }
                          : item,
                      ),
                    })
                  }
                />
                <label>
                  <span>{subject.progress}%</span>
                  <input
                    aria-label={`Progresso da matéria ${index + 1}`}
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={subject.progress}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        subjects: (draft.subjects || []).map((item) =>
                          item.id === subject.id
                            ? { ...item, progress: Number(event.target.value) }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="danger"
                  aria-label={`Excluir ${subject.name || "matéria"}`}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      subjects: (draft.subjects || []).filter(
                        (item) => item.id !== subject.id,
                      ),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="secondary add-subject"
              onClick={() =>
                setDraft({
                  ...draft,
                  subjects: [
                    ...(draft.subjects || []),
                    { id: uid(), name: "", progress: 0 },
                  ],
                })
              }
            >
              + Adicionar matéria
            </button>
          </fieldset>
          <label>
            Número de vagas
            <input
              type="number"
              min="0"
              value={draft.vacancies ?? ""}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  vacancies: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </label>
          <label>
            Informações atualizadas em
            <input
              type="date"
              value={
                draft.sourceUpdatedAt
                  ? today(new Date(draft.sourceUpdatedAt))
                  : ""
              }
              onChange={(event) =>
                setDraft({
                  ...draft,
                  sourceUpdatedAt: event.target.value
                    ? new Date(`${event.target.value}T12:00:00`).getTime()
                    : undefined,
                })
              }
            />
          </label>
          <label className="span-2">
            Relatório / observações
            <textarea
              rows={4}
              placeholder="Banca, situação do edital, previsão, pontos de atenção..."
              value={draft.report || ""}
              onChange={(event) =>
                setDraft({ ...draft, report: event.target.value })
              }
            />
          </label>
          {draft.status === "realizado" && (
            <>
              <label>
                Validade do edital
                <input
                  type="date"
                  value={draft.noticeValidity || ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      noticeValidity: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Nota da prova
                <input
                  type="number"
                  step="0.01"
                  value={draft.score ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, score: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                Colocação
                <input
                  type="number"
                  min="1"
                  value={draft.placement ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      placement: Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Resultado
                <select
                  value={draft.result}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      result: event.target.value as Contest["result"],
                    })
                  }
                >
                  <option value="">Não informado</option>
                  <option value="aprovado-vagas">Aprovado nas vagas</option>
                  <option value="cadastro-reserva">Cadastro reserva</option>
                  <option value="eliminado">Eliminado</option>
                </select>
              </label>
            </>
          )}
        </div>
        <footer>
          <button className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="primary"
            disabled={!draft.name.trim()}
            onClick={() =>
              onSave({
                ...draft,
                compatible:
                  draft.education === "outra"
                    ? draft.compatible
                    : automaticCompatibility,
              })
            }
          >
            Salvar concurso
          </button>
        </footer>
      </section>
    </div>
  );
}

function TrophyRoom({ store }: { store: Store }) {
  const p = progress(store);
  return (
    <section>
      <div className="section-head">
        <div>
          <span className="eyebrow">SALA DE CONQUISTAS</span>
          <h2>Minha coleção</h2>
          <p>
            {p.unlocked} de 10 troféus desbloqueados · Rank:{" "}
            <strong>
              {p.unlocked
                ? TROPHIES[p.unlocked - 1][0]
                : "Aprendiz em ascensão"}
            </strong>
          </p>
        </div>
      </div>
      <div className="trophy-grid">
        {TROPHIES.map((t, i) => {
          const unlocked = p.answered >= (i + 1) * 500;
          const remaining = Math.max(0, (i + 1) * 500 - p.answered);
          return (
            <article
              key={t[0]}
              className={unlocked ? "trophy unlocked" : "trophy locked"}
              style={{ "--trophy": t[1] } as React.CSSProperties}
            >
              <div className="trophy-icon">♛</div>
              <small>
                NÍVEL {(i + 1) * 10} · {(i + 1) * 500} QUESTÕES
              </small>
              <h3>{t[0]}</h3>
              <p>{t[2]}</p>
              <strong>
                {unlocked
                  ? "✓ CONQUISTADO"
                  : `${remaining} questões para desbloquear`}
              </strong>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Decks({
  decks,
  folders,
  fileRef,
  onFile,
  onEdit,
  onRemove,
  onReview,
  onCreate,
  onOrganize,
}: any) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [sort, setSort] = useState("priority");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [draggedDeck, setDraggedDeck] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(
    undefined,
  );
  const [folderEditor, setFolderEditor] = useState<{
    mode: "create" | "rename";
    id?: string;
    name: string;
    parentId: string | null;
  } | null>(null);
  const draggedDeckRef = useRef<string | null>(null);

  const children = (parentId: string | null) =>
    (folders as DeckFolder[]).filter((folder) => folder.parentId === parentId);
  const descendantIds = (parentId: string): string[] =>
    children(parentId).flatMap((folder) => [
      folder.id,
      ...descendantIds(folder.id),
    ]);
  const visibleFolderIds = folderId
    ? [folderId, ...descendantIds(folderId)]
    : [];
  const visibleDecks = [...(decks as Deck[])]
    .filter((deck) =>
      folderId ? visibleFolderIds.includes(deck.folderId || "") : !deck.folderId,
    )
    .sort((a, b) => {
      if (sort === "alphabetical")
        return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "contest")
        return (a.contest || "Sem concurso").localeCompare(
          b.contest || "Sem concurso",
          "pt-BR",
        );
      if (sort === "created") return b.createdAt - a.createdAt;
      return (a.priority || 3) - (b.priority || 3) ||
        a.name.localeCompare(b.name, "pt-BR");
    });
  const currentFolder = (folders as DeckFolder[]).find(
    (folder) => folder.id === folderId,
  );

  const addFolder = () =>
    setFolderEditor({
      mode: "create",
      name: "",
      parentId: folderId,
    });
  const renameFolder = (folder: DeckFolder) => {
    setFolderEditor({
      mode: "rename",
      id: folder.id,
      name: folder.name,
      parentId: folder.parentId,
    });
  };
  const saveFolder = (event: React.FormEvent) => {
    event.preventDefault();
    if (!folderEditor) return;
    const name = folderEditor.name.trim();
    if (!name) return;
    const duplicate = (folders as DeckFolder[]).some(
      (folder) =>
        folder.id !== folderEditor.id &&
        folder.parentId === folderEditor.parentId &&
        folder.name.localeCompare(name, "pt-BR", { sensitivity: "base" }) === 0,
    );
    if (duplicate) return;
    const nextFolders =
      folderEditor.mode === "create"
        ? [
            ...(folders as DeckFolder[]),
            {
              id: uid(),
              name,
              parentId: folderEditor.parentId,
              createdAt: Date.now(),
            },
          ]
        : (folders as DeckFolder[]).map((folder) =>
            folder.id === folderEditor.id ? { ...folder, name } : folder,
          );
    onOrganize(decks, nextFolders);
    setFolderEditor(null);
  };
  const removeFolder = (folder: DeckFolder) => {
    const removedIds = [folder.id, ...descendantIds(folder.id)];
    if (
      !confirm(
        `Excluir a pasta “${folder.name}” e suas subpastas? Os baralhos serão movidos para a raiz.`,
      )
    )
      return;
    onOrganize(
      decks.map((deck: Deck) =>
        removedIds.includes(deck.folderId || "")
          ? { ...deck, folderId: null }
          : deck,
      ),
      folders.filter((item: DeckFolder) => !removedIds.includes(item.id)),
    );
    if (removedIds.includes(folderId || "")) setFolderId(null);
  };
  const moveDeck = (deckId: string, targetFolderId: string | null) => {
    onOrganize(
      decks.map((deck: Deck) =>
        deck.id === deckId ? { ...deck, folderId: targetFolderId } : deck,
      ),
      folders,
    );
    draggedDeckRef.current = null;
    setDraggedDeck(null);
    setDropTarget(undefined);
  };
  const beginDeckDrag = (
    event: React.DragEvent<HTMLElement>,
    deckId: string,
  ) => {
    draggedDeckRef.current = deckId;
    setDraggedDeck(deckId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/alkastudy-deck", deckId);
    event.dataTransfer.setData("text/plain", deckId);
  };
  const finishDeckDrop = (
    event: React.DragEvent<HTMLElement>,
    targetFolderId: string | null,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const deckId =
      event.dataTransfer.getData("text/alkastudy-deck") ||
      event.dataTransfer.getData("text/plain") ||
      draggedDeckRef.current ||
      draggedDeck;
    if (deckId && (decks as Deck[]).some((deck) => deck.id === deckId)) {
      moveDeck(deckId, targetFolderId);
    }
    setDropTarget(undefined);
  };
  const updateDeckOrganization = (
    deckId: string,
    values: Partial<Deck>,
  ) => {
    onOrganize(
      decks.map((deck: Deck) =>
        deck.id === deckId ? { ...deck, ...values } : deck,
      ),
      folders,
    );
  };
  const renderFolderTree = (parentId: string | null, depth = 0): React.ReactNode =>
    children(parentId).map((folder) => (
      <div key={folder.id}>
        <div
          className={`folder-row folder-row-manage ${folderId === folder.id ? "active" : ""} ${dropTarget === folder.id ? "drop-target" : ""}`}
          style={{ paddingLeft: 12 + depth * 18 }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDropTarget(folder.id);
          }}
          onDragLeave={() =>
            setDropTarget((value) => (value === folder.id ? undefined : value))
          }
          onDrop={(event) => finishDeckDrop(event, folder.id)}
        >
          <button onClick={() => setFolderId(folder.id)}>
            <span>▸ 📁</span>
            <strong>{folder.name}</strong>
          </button>
          <small>
            {
              (decks as Deck[]).filter(
                (deck) =>
                  deck.folderId === folder.id ||
                  descendantIds(folder.id).includes(deck.folderId || ""),
              ).length
            }
          </small>
          <span className="folder-actions">
            <button title="Renomear pasta" onClick={() => renameFolder(folder)}>
              ✎
            </button>
            <button title="Excluir pasta" onClick={() => removeFolder(folder)}>
              ×
            </button>
          </span>
        </div>
        {renderFolderTree(folder.id, depth + 1)}
      </div>
    ));

  return (
    <section className="library">
      <header className="section-head">
        <div>
          <span className="eyebrow">BIBLIOTECA LOCAL</span>
          <h2>Meus baralhos</h2>
          <p>Importe, revise, edite e organize suas cartas.</p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.apkg"
            hidden
            onChange={(e) => onFile(e.target.files?.[0], folderId)}
          />
          <button
            className="secondary"
            onClick={() => fileRef.current?.click()}
          >
            Importar TXT/CSV/APKG
          </button>
          <button className="primary" onClick={() => onCreate(folderId)}>
            + Novo baralho
          </button>
        </div>
      </header>
      <div className="library-layout">
        <aside className="folder-panel">
          <div className="folder-title">
            <strong>Pastas</strong>
            <button onClick={addFolder}>＋</button>
          </div>
          <button
            className={`folder-row ${folderId === null ? "active" : ""} ${dropTarget === null ? "drop-target" : ""}`}
            onClick={() => setFolderId(null)}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTarget(null);
            }}
            onDragLeave={() =>
              setDropTarget((value) => (value === null ? undefined : value))
            }
            onDrop={(event) => finishDeckDrop(event, null)}
          >
            <span>⌂</span><strong>Raiz</strong>
            <small>{decks.filter((deck: Deck) => !deck.folderId).length}</small>
          </button>
          {renderFolderTree(null)}
        </aside>
        <div className="deck-browser">
          <div className="deck-toolbar">
            <div>
              <strong>{currentFolder?.name || "Baralhos na raiz"}</strong>
              <small>{visibleDecks.length} baralho(s)</small>
            </div>
            <div>
              <button className="secondary" onClick={addFolder}>
                + {folderId ? "Subpasta" : "Pasta"}
              </button>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                aria-label="Ordenar baralhos"
              >
                <option value="priority">Prioridade</option>
                <option value="alphabetical">Ordem alfabética</option>
                <option value="contest">Concurso/exame</option>
                <option value="created">Mais recentes</option>
              </select>
              <button
                className="view-toggle"
                onClick={() => setView(view === "grid" ? "list" : "grid")}
                title="Alternar visualização"
              >
                {view === "grid" ? "☷" : "▦"}
              </button>
            </div>
          </div>
          {visibleDecks.length ? (
            <div className={`deck-grid ${view === "list" ? "deck-list" : ""}`}>
          {visibleDecks.map((d: Deck) => (
            <article
              className="deck-card"
              key={d.id}
            >
              <span
                className="deck-symbol deck-drag-handle"
                draggable
                title="Arraste para mover este baralho"
                aria-label={`Arrastar ${d.name}`}
                onDragStart={(event) => beginDeckDrag(event, d.id)}
                onDragEnd={() => {
                  draggedDeckRef.current = null;
                  setDraggedDeck(null);
                  setDropTarget(undefined);
                }}
              >
                ⋮⋮
              </span>
              <div className="deck-main">
                <h3>{d.name}</h3>
                <p>{d.description || "Sem descrição"}</p>
                <div className="deck-tags">
                  <span>P{d.priority || 3}</span>
                  {d.contest && <span>{d.contest}</span>}
                  <strong>{d.cards.length} cartas</strong>
                </div>
              </div>
              <div className="deck-organize">
                <label>
                  Prioridade
                  <select
                    value={d.priority || 3}
                    onChange={(event) =>
                      updateDeckOrganization(d.id, {
                        priority: Number(event.target.value),
                      })
                    }
                  >
                    <option value="1">1 — Máxima</option>
                    <option value="2">2 — Alta</option>
                    <option value="3">3 — Normal</option>
                    <option value="4">4 — Baixa</option>
                    <option value="5">5 — Arquivado</option>
                  </select>
                </label>
                <label>
                  Concurso/exame
                  <input
                    value={d.contest || ""}
                    placeholder="Ex.: DATAPREV"
                    onChange={(event) =>
                      updateDeckOrganization(d.id, {
                        contest: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="span-2">
                  Mover para
                  <select
                    value={d.folderId || ""}
                    onChange={(event) =>
                      moveDeck(d.id, event.target.value || null)
                    }
                  >
                    <option value="">Raiz</option>
                    {(folders as DeckFolder[]).map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="deck-actions">
                <button onClick={() => onReview(d)}>Estudar</button>
                <button onClick={() => onEdit(d)}>Editar</button>
                <button className="danger" onClick={() => onRemove(d.id)}>
                  Excluir
                </button>
              </div>
            </article>
          ))}
            </div>
          ) : (
            <div
              className={`folder-empty ${dropTarget === folderId ? "drop-target" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDropTarget(folderId);
              }}
              onDragLeave={() => setDropTarget(undefined)}
              onDrop={(event) => finishDeckDrop(event, folderId)}
            >
              <span>▱</span>
              <strong>Nenhum baralho nesta pasta</strong>
              <small>Importe um arquivo ou arraste um baralho para cá.</small>
            </div>
          )}
        </div>
      </div>
      {folderEditor && (
        <div
          className="modal-back"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setFolderEditor(null);
          }}
        >
          <form className="modal folder-modal" onSubmit={saveFolder}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">ORGANIZAÇÃO</span>
                <h2>
                  {folderEditor.mode === "create"
                    ? "Nova pasta"
                    : "Renomear pasta"}
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setFolderEditor(null)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <label>
              Nome
              <input
                autoFocus
                value={folderEditor.name}
                maxLength={80}
                placeholder="Ex.: Banco de Dados"
                onChange={(event) =>
                  setFolderEditor({ ...folderEditor, name: event.target.value })
                }
              />
            </label>
            {folderEditor.mode === "create" && (
              <label>
                Criar dentro de
                <select
                  value={folderEditor.parentId || ""}
                  onChange={(event) =>
                    setFolderEditor({
                      ...folderEditor,
                      parentId: event.target.value || null,
                    })
                  }
                >
                  <option value="">Raiz</option>
                  {(folders as DeckFolder[]).map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(folders as DeckFolder[]).some(
              (folder) =>
                folder.id !== folderEditor.id &&
                folder.parentId === folderEditor.parentId &&
                folder.name.localeCompare(folderEditor.name.trim(), "pt-BR", {
                  sensitivity: "base",
                }) === 0,
            ) && (
              <p className="form-error">Já existe uma pasta com esse nome.</p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setFolderEditor(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="primary"
                disabled={!folderEditor.name.trim()}
              >
                {folderEditor.mode === "create" ? "Criar pasta" : "Salvar nome"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function DeckEditor({
  deck,
  onClose,
  onSave,
}: {
  deck: Deck;
  onClose: () => void;
  onSave: (d: Deck) => void;
}) {
  const [d, setD] = useState<Deck>(JSON.parse(JSON.stringify(deck)));
  const add = () =>
    setD({
      ...d,
      cards: [
        ...d.cards,
        {
          id: uid(),
          question: "",
          answer: "",
          due: Date.now(),
          interval: 0,
          reviews: 0,
        },
      ],
    });
  return (
    <div className="modal-back">
      <section className="modal">
        <header>
          <h2>{deck.name ? "Editar baralho" : "Novo baralho"}</h2>
          <button onClick={onClose}>×</button>
        </header>
        <label>
          Nome
          <input
            value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </label>
        <label>
          Descrição
          <input
            value={d.description}
            onChange={(e) => setD({ ...d, description: e.target.value })}
          />
        </label>
        <div className="card-editor-head">
          <h3>Cartas ({d.cards.length})</h3>
          <button className="secondary" onClick={add}>
            + Adicionar carta
          </button>
        </div>
        <div className="card-list">
          {d.cards.map((c, i) => (
            <div className="card-row" key={c.id}>
              <b>{i + 1}</b>
              <textarea
                placeholder="Pergunta"
                value={c.question}
                onChange={(e) =>
                  setD({
                    ...d,
                    cards: d.cards.map((x) =>
                      x.id === c.id ? { ...x, question: e.target.value } : x,
                    ),
                  })
                }
              />
              <textarea
                placeholder="Resposta"
                value={c.answer}
                onChange={(e) =>
                  setD({
                    ...d,
                    cards: d.cards.map((x) =>
                      x.id === c.id ? { ...x, answer: e.target.value } : x,
                    ),
                  })
                }
              />
              <button
                className="danger"
                onClick={() =>
                  setD({ ...d, cards: d.cards.filter((x) => x.id !== c.id) })
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <footer>
          <button className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="primary"
            disabled={
              !d.name.trim() ||
              d.cards.some((c) => !c.question.trim() || !c.answer.trim())
            }
            onClick={() => onSave(d)}
          >
            Salvar baralho
          </button>
        </footer>
      </section>
    </div>
  );
}

function Stats({ store }: { store: Store }) {
  const cards = store.decks.reduce((n, d) => n + d.cards.length, 0);
  const reviews = store.decks.reduce(
    (n, d) => n + d.cards.reduce((a, c) => a + c.reviews, 0),
    0,
  );
  const previous = store.contests.filter(
    (contest) => actualStatus(contest) === "realizado",
  );
  const approved = previous.filter(
    (contest) => contest.result === "aprovado-vagas",
  ).length;
  const reserve = previous.filter(
    (contest) => contest.result === "cadastro-reserva",
  ).length;
  const eliminated = previous.filter(
    (contest) => contest.result === "eliminado",
  ).length;
  const best = previous
    .filter((contest) => contest.placement)
    .sort((a, b) => a.placement! - b.placement!)[0];
  return (
    <section>
      <div className="section-head">
        <div>
          <span className="eyebrow">EVOLUÇÃO</span>
          <h2>Estatísticas</h2>
        </div>
      </div>
      <div className="stat-grid">
        <article>
          <span>✦</span>
          <strong>{store.xp}</strong>
          <small>XP acumulado</small>
        </article>
        <article>
          <span>🔥</span>
          <strong>{store.streak}</strong>
          <small>dias de sequência</small>
        </article>
        <article>
          <span>▱</span>
          <strong>{cards}</strong>
          <small>cartas cadastradas</small>
        </article>
        <article>
          <span>✓</span>
          <strong>{reviews}</strong>
          <small>respostas avaliadas</small>
        </article>
        <article>
          <span>🏆</span>
          <strong>{approved}</strong>
          <small>aprovações nas vagas</small>
        </article>
        <article>
          <span>◷</span>
          <strong>{reserve}</strong>
          <small>cadastros reserva</small>
        </article>
        <article>
          <span>×</span>
          <strong>{eliminated}</strong>
          <small>eliminações</small>
        </article>
        <article>
          <span>↗</span>
          <strong>{best ? `${best.placement}º` : "—"}</strong>
          <small>
            {best ? `melhor colocação · ${best.name}` : "melhor colocação"}
          </small>
        </article>
      </div>
    </section>
  );
}
function Settings({
  profile,
  onSave,
  onReset,
  backupRef,
  onExport,
  onImport,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  onReset: () => void;
  backupRef: React.RefObject<HTMLInputElement | null>;
  onExport: () => void;
  onImport: (file?: File) => void;
}) {
  const [p, setP] = useState<Profile>({
    ...profile,
    pace: profile.pace || "regular",
    dailyGoal: profile.dailyGoal || 30,
  });
  const [education, setEducation] = useState("");
  const [specialization, setSpecialization] = useState("");
  return (
    <section className="settings">
      <div className="section-head">
        <div>
          <span className="eyebrow">PREFERÊNCIAS LOCAIS</span>
          <h2>Configurações</h2>
        </div>
      </div>
      <article className="panel form">
        <label>
          Nome
          <input
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
          />
        </label>
        <label>
          Renda atual (R$)
          <input
            type="number"
            min="0"
            value={p.currentIncome || ""}
            onChange={(event) =>
              setP({
                ...p,
                currentIncome: Number(event.target.value) || undefined,
              })
            }
          />
        </label>
        <div className="multi-field">
          <strong>Formações</strong>
          <div>
            <input
              value={education}
              onChange={(event) => setEducation(event.target.value)}
              placeholder="Ex.: Bacharelado em Ciência Política"
            />
            <button
              className="secondary"
              onClick={() => {
                if (!education.trim()) return;
                setP({
                  ...p,
                  educations: [...(p.educations || []), education.trim()],
                });
                setEducation("");
              }}
            >
              Adicionar
            </button>
          </div>
          <div className="tag-list">
            {p.educations?.map((item, index) => (
              <button
                key={`${item}-${index}`}
                onClick={() =>
                  setP({
                    ...p,
                    educations: p.educations?.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                {item} ×
              </button>
            ))}
          </div>
        </div>
        <div className="multi-field">
          <strong>Especializações</strong>
          <div>
            <input
              value={specialization}
              onChange={(event) => setSpecialization(event.target.value)}
              placeholder="Ex.: Pós-graduação em TI"
            />
            <button
              className="secondary"
              onClick={() => {
                if (!specialization.trim()) return;
                setP({
                  ...p,
                  specializations: [
                    ...(p.specializations || []),
                    specialization.trim(),
                  ],
                });
                setSpecialization("");
              }}
            >
              Adicionar
            </button>
          </div>
          <div className="tag-list">
            {p.specializations?.map((item, index) => (
              <button
                key={`${item}-${index}`}
                onClick={() =>
                  setP({
                    ...p,
                    specializations: p.specializations?.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                {item} ×
              </button>
            ))}
          </div>
        </div>
        <label>
          Objetivo principal
          <input
            value={p.goal}
            onChange={(e) => setP({ ...p, goal: e.target.value })}
          />
        </label>
        <label>
          Ritmo diário
          <select
            value={p.pace}
            onChange={(e) => {
              const pace = e.target.value as Pace;
              setP({ ...p, pace, dailyGoal: PACES[pace].goal });
            }}
          >
            {Object.entries(PACES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label} — {v.goal} questões/dia ({v.goal * 10} XP)
              </option>
            ))}
          </select>
        </label>
        <label>
          Meta diária personalizada
          <input
            type="number"
            min="1"
            max="500"
            value={p.dailyGoal}
            onChange={(e) =>
              setP({
                ...p,
                dailyGoal: Math.max(1, Number(e.target.value) || 1),
              })
            }
          />
        </label>
        <button className="primary" onClick={() => onSave(p)}>
          Salvar alterações
        </button>
        <hr />
        <section className="backup-box">
          <h3>Backup e restauração</h3>
          <p>
            O arquivo inclui perfil, concursos, resultados, baralhos, pastas e
            histórico. Backups antigos são migrados automaticamente.
          </p>
          <input
            ref={backupRef}
            type="file"
            accept=".alkastudy,.json"
            hidden
            onChange={(event) => onImport(event.target.files?.[0])}
          />
          <div>
            <button className="secondary" onClick={onExport}>
              Exportar backup
            </button>
            <button
              className="secondary"
              onClick={() => backupRef.current?.click()}
            >
              Restaurar backup
            </button>
          </div>
        </section>
        <hr />
        <button className="danger-zone" onClick={onReset}>
          Apagar todos os dados locais
        </button>
      </article>
    </section>
  );
}
function Simple({
  title,
  icon,
  text,
}: {
  title: string;
  icon: string;
  text: string;
}) {
  return (
    <section className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}
