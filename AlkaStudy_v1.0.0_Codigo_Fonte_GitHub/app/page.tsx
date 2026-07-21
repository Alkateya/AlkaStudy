"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
};
type Pace = "casual" | "regular" | "intensivo" | "maratonista";
type Profile = { name: string; goal: string; pace?: Pace; dailyGoal?: number };
type Store = {
  profile: Profile | null;
  decks: Deck[];
  xp: number;
  streak: number;
  lastStudy?: string;
  daily?: Record<string, number>;
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

const initial: Store = { profile: null, decks: [], xp: 0, streak: 0 };
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
    decks: (value.decks || []).map((deck) => ({
      ...deck,
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

export default function Home() {
  const [store, setStore] = useState<Store>(initial);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(false);
  const [active, setActive] = useState("Início");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Deck | null>(null);
  const [reviewDeck, setReviewDeck] = useState<Deck | null>(null);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [answer, setAnswer] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".apkg")) {
      toast(
        "APKG será disponibilizado no instalador desktop; aqui use TXT ou CSV.",
      );
      return;
    }
    try {
      const deck = parseText(await file.text(), file.name);
      save({ ...store, decks: [...store.decks, deck] });
      setActive("Baralhos");
      toast(`${deck.name}: ${deck.cards.length} cartas importadas.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não foi possível importar.");
    }
    if (fileRef.current) fileRef.current.value = "";
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
            onCreate={() =>
              setEditing({
                id: uid(),
                name: "",
                description: "",
                createdAt: Date.now(),
                cards: [],
              })
            }
          />
        )}
        {active === "Troféus" && <TrophyRoom store={store} />}
        {active === "Plano de estudos" && (
          <Simple
            title="Plano de estudos"
            icon="▦"
            text="Seu plano usa as revisões programadas de cada baralho. Ao responder, o AlkaStudy agenda automaticamente a próxima revisão."
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
}: {
  store: Store;
  due: number;
  onReview: () => void;
}) {
  const p = progress(store);
  const rank = p.unlocked
    ? TROPHIES[p.unlocked - 1][0]
    : "Aprendiz em ascensão";
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
        <div className="right-grid">
          <article className="panel streak">
            <span className="bubble">🔥</span>
            <div>
              <strong>{store.streak} dias</strong>
              <small>Sequência atual</small>
            </div>
          </article>
          <article className="panel xp">
            <span className="bubble">✦</span>
            <div>
              <strong>{store.xp} XP</strong>
              <small>{p.answered} questões respondidas</small>
            </div>
          </article>
        </div>
      </section>
    </>
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
  fileRef,
  onFile,
  onEdit,
  onRemove,
  onReview,
  onCreate,
}: any) {
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
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            className="secondary"
            onClick={() => fileRef.current?.click()}
          >
            Importar TXT/CSV/APKG
          </button>
          <button className="primary" onClick={onCreate}>
            + Novo baralho
          </button>
        </div>
      </header>
      {decks.length ? (
        <div className="deck-grid">
          {decks.map((d: Deck) => (
            <article className="deck-card" key={d.id}>
              <span className="deck-symbol">▱</span>
              <h3>{d.name}</h3>
              <p>{d.description || "Sem descrição"}</p>
              <strong>{d.cards.length} cartas</strong>
              <div>
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
        <Simple
          title="Nenhum baralho ainda"
          icon="▱"
          text="Importe um TXT ou CSV no formato pergunta ; resposta, ou crie suas cartas manualmente."
        />
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
      </div>
    </section>
  );
}
function Settings({
  profile,
  onSave,
  onReset,
}: {
  profile: Profile;
  onSave: (p: Profile) => void;
  onReset: () => void;
}) {
  const [p, setP] = useState<Profile>({
    ...profile,
    pace: profile.pace || "regular",
    dailyGoal: profile.dailyGoal || 30,
  });
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
