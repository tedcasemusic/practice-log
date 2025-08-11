import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import "./ui/theme.css";
import { supabase } from "./lib/supabase";

type CategoryKey = "scales" | "review" | "new" | "technique";
const CATS: { key: CategoryKey; label: string }[] = [
  { key: "scales", label: "Scales" },
  { key: "review", label: "Review Rep" },
  { key: "new", label: "New Rep" },
  { key: "technique", label: "Technique" },
];

type PlanState = {
  items: Record<CategoryKey, { minutes: number; note: string }>;
};
type SessionRow = {
  id?: number;
  date: string;
  category: CategoryKey;
  minutes: number;
};

/* ---------- utils ---------- */
// Formats a Date to YYYY-MM-DD in *local* time
function localISO(d: Date) {
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, "0"),
    day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// Returns last N dates (YYYY-MM-DD) in local time
function lastNDates(n: number) {
  const out: string[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(localISO(d));
  }
  return out;
}
// Parse "YYYY-MM-DD" as *local* date (avoid UTC shift)
function parseLocalDate(s: string) {
  const [yy, mm, dd] = s.split("-").map((t) => parseInt(t, 10));
  return new Date(yy, (mm || 1) - 1, dd || 1);
}
function fmtMMSS(sec: number) {
  const m = Math.floor(sec / 60),
    s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ---------- Auth ---------- */
function AuthGate({ onReady }: { onReady: (userId: string) => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id;
      if (uid) onReady(uid);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.id) onReady(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [onReady]);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      alert(error.message);
      setStatus("idle");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="app">
      <div className="card" style={{ maxWidth: 520, margin: "80px auto" }}>
        <h1>Practice Log</h1>
        <p className="note">
          Sign in with a magic link to load and save your data.
        </p>
        <form
          onSubmit={sendLink}
          className="row"
          style={{ alignItems: "stretch" }}
        >
          <input
            className="input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn" type="submit" disabled={status !== "idle"}>
            {status === "sending" ? "Sending..." : "Email me a link"}
          </button>
        </form>
        {status === "sent" && (
          <div className="pill small" style={{ marginTop: 10 }}>
            Check your email and click the link.
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- UI bits ---------- */
function ProgressRing({
  value,
  goal,
  categoryMinutes,
}: {
  value: number;
  goal: number;
  categoryMinutes: Record<CategoryKey, number>;
}) {
  const size = 160,
    stroke = 14,
    r = (size - stroke) / 2,
    C = 2 * Math.PI * r;

  // Calculate the total minutes for all categories
  const totalMinutes = Object.values(categoryMinutes).reduce(
    (sum, mins) => sum + mins,
    0
  );

  // Only show arcs if we have practice data
  const hasPracticeData = totalMinutes > 0;

  // Category colors
  const categoryColors: Record<CategoryKey, string> = {
    scales: "#00b2ff",
    review: "#8ad0ff",
    new: "#63a6c2",
    technique: "#3d6a7a",
  };

  // Calculate arc lengths for each category
  const categoryArcs = CATS.map((cat) => {
    const minutes = categoryMinutes[cat.key];
    if (minutes <= 0) return null;

    const arcLength = (minutes / Math.max(goal, 1)) * C;
    return {
      category: cat.key,
      minutes,
      arcLength,
      color: categoryColors[cat.key],
    };
  }).filter(Boolean);

  // Calculate starting angles for each arc
  let currentAngle = -90; // Start from top
  const positionedArcs = categoryArcs
    .map((arc) => {
      if (!arc) return null;
      const startAngle = currentAngle;
      const endAngle = startAngle + (arc.arcLength / C) * 360;
      currentAngle = endAngle;

      return {
        ...arc,
        startAngle,
        endAngle,
      };
    })
    .filter(Boolean);

  return (
    <svg className="ring" viewBox="0 0 160 160">
      {/* Background circle */}
      <circle
        cx="80"
        cy="80"
        r={r}
        stroke="#d8e0e8"
        strokeWidth={stroke}
        fill="none"
      />

      {/* Category-specific arcs */}
      {hasPracticeData &&
        positionedArcs.map((arc, index) => {
          if (!arc) return null;

          // Convert angles to radians and calculate SVG arc parameters
          const startRad = (arc.startAngle * Math.PI) / 180;
          const endRad = (arc.endAngle * Math.PI) / 180;

          // Calculate start and end points
          const x1 = 80 + r * Math.cos(startRad);
          const y1 = 80 + r * Math.sin(startRad);
          const x2 = 80 + r * Math.cos(endRad);
          const y2 = 80 + r * Math.sin(endRad);

          // Determine if we need to draw a large arc (more than 180 degrees)
          const largeArcFlag =
            Math.abs(arc.endAngle - arc.startAngle) > 180 ? 1 : 0;

          // Create the path for the arc
          const pathData = [
            `M ${x1} ${y1}`,
            `A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          ].join(" ");

          return (
            <path
              key={`${arc.category}-${index}`}
              d={pathData}
              stroke={arc.color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="butt"
            />
          );
        })}

      {/* Text overlay */}
      <text
        x="50%"
        y="46%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="24"
        fontWeight="800"
      >
        {Math.round(value)} min
      </text>
      <text
        x="50%"
        y="60%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="12"
        opacity="0.7"
      >
        Goal {goal}
      </text>
    </svg>
  );
}

function Today({
  goal,
  plan,
  onSaveToday,
  sessions,
  updateEntry,
  ensureDailyEntries,
}: {
  goal: number;
  plan: PlanState;
  onSaveToday: (
    rows: { date: string; category: CategoryKey; minutes: number }[]
  ) => Promise<void>;
  sessions: SessionRow[];
  updateEntry: (
    id: number,
    patch: Partial<Pick<SessionRow, "category" | "minutes">>
  ) => Promise<void>;
  ensureDailyEntries: (date: string) => Promise<void>;
}) {
  const [secs, setSecs] = useState<Record<CategoryKey, number>>({
    scales: 0,
    review: 0,
    new: 0,
    technique: 0,
  });

  // Initialize timer values and ensure daily entries exist
  // Use a ref to prevent multiple calls to ensureDailyEntries
  const hasInitializedToday = React.useRef(false);

  useEffect(() => {
    const todayISO = localISO(new Date());

    // Ensure we have entries for all categories today (only once)
    if (!hasInitializedToday.current) {
      console.log(
        `🔄 Today component: Initializing daily entries for ${todayISO}`
      );
      hasInitializedToday.current = true;
      ensureDailyEntries(todayISO);
    } else {
      console.log(`🚫 Today component: Already initialized for ${todayISO}`);
    }

    const todaySessions = sessions.filter((s) => s.date === todayISO);

    const initialSecs = Object.fromEntries(
      CATS.map((c) => [c.key, 0])
    ) as Record<CategoryKey, number>;
    todaySessions.forEach((s) => {
      initialSecs[s.category] = s.minutes * 60;
    });

    setSecs(initialSecs);
  }, [ensureDailyEntries, sessions]); // Include dependencies properly
  const [running, setRunning] = useState<Record<CategoryKey, boolean>>(
    Object.fromEntries(CATS.map((c) => [c.key, false])) as Record<
      CategoryKey,
      boolean
    >
  );

  // State for managing slide-out animation
  const [isSlidingOut, setIsSlidingOut] = useState(false);

  // State for tracking paused timers (separate from running)
  const [paused, setPaused] = useState<Record<CategoryKey, boolean>>(
    Object.fromEntries(CATS.map((c) => [c.key, false])) as Record<
      CategoryKey,
      boolean
    >
  );

  // State for editing timer values
  const [editingTimer, setEditingTimer] = useState<CategoryKey | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // Ref to measure text width for dynamic input sizing
  const textMeasureRef = useRef<HTMLSpanElement>(null);

  // Function to calculate optimal input width
  const getInputWidth = useCallback(() => {
    if (textMeasureRef.current) {
      const textWidth = textMeasureRef.current.offsetWidth;
      return `${textWidth + 16}px`; // Add 16px for padding and border
    }
    return "80px"; // Fallback width
  }, []);

  const totalMin = Math.round(
    Object.values(secs).reduce((a, b) => a + b, 0) / 60
  );
  const dailyTarget = useMemo(() => {
    const t = {} as Record<CategoryKey, number>;
    for (const c of CATS) t[c.key] = plan.items[c.key]?.minutes || 0;
    return t;
  }, [plan]);

  // Auto-save function that updates existing entries (they should always exist now)
  async function autoSave(category: CategoryKey, minutes: number) {
    if (minutes === 0) return; // Don't save 0 minutes

    const todayISO = localISO(new Date());

    // Check if we already have an entry for today in this category
    const existingEntry = sessions.find(
      (s) => s.date === todayISO && s.category === category
    );

    if (existingEntry && existingEntry.id) {
      // Update existing entry
      await updateEntry(existingEntry.id, { minutes });
    } else {
      // This shouldn't happen anymore since we ensure entries exist
      console.warn(
        "No entry found for category:",
        category,
        "on date:",
        todayISO
      );
    }
  }

  // Debounced auto-save to prevent multiple rapid saves
  const debouncedAutoSave = useMemo(() => {
    const timeouts: Record<CategoryKey, NodeJS.Timeout> = {} as Record<
      CategoryKey,
      NodeJS.Timeout
    >;

    return (category: CategoryKey, minutes: number) => {
      if (timeouts[category]) {
        clearTimeout(timeouts[category]);
      }

      timeouts[category] = setTimeout(() => {
        autoSave(category, minutes);
      }, 1000); // Wait 1 second before saving
    };
  }, []);

  useEffect(() => {
    const id = setInterval(
      () =>
        setSecs((s) => {
          const n = { ...s };
          (Object.keys(n) as CategoryKey[]).forEach((k) => {
            if (running[k]) {
              n[k]++;
              // Auto-save every 60 seconds while timer is running (less frequent)
              if (n[k] % 60 === 0) {
                debouncedAutoSave(k, Math.round(n[k] / 60));
              }
            }
          });
          return n;
        }),
      1000
    );
    return () => clearInterval(id);
  }, [running, debouncedAutoSave]);

  async function saveToday() {
    const todayISO = localISO(new Date()); // ✅ local date string
    const rows = CATS.map((c) => ({
      date: todayISO,
      category: c.key,
      minutes: Math.round(secs[c.key] / 60),
    })).filter((r) => r.minutes > 0);
    if (!rows.length) {
      alert("Nothing to save.");
      return;
    }
    await onSaveToday(rows);
    // Don't reset timers - let them persist
    setRunning(
      Object.fromEntries(CATS.map((c) => [c.key, false])) as Record<
        CategoryKey,
        boolean
      >
    );
  }

  return (
    <>
      <div className="card center">
        <div className="swipe-container">
          {/* Progress Ring - slides left when timer starts */}
          <div
            className={`swipe-content ${
              (Object.values(running).some((r) => r) ||
                Object.values(paused).some((p) => p)) &&
              !isSlidingOut
                ? "slide-left"
                : ""
            }`}
          >
            <ProgressRing
              value={totalMin}
              goal={goal}
              categoryMinutes={{
                scales: Math.round(secs.scales / 60),
                review: Math.round(secs.review / 60),
                new: Math.round(secs.new / 60),
                technique: Math.round(secs.technique / 60),
              }}
            />
          </div>

          {/* Practice Session Card - slides in from right when timer starts */}
          <div
            className={`swipe-content practice-session ${
              Object.values(running).some((r) => r) ||
              Object.values(paused).some((p) => p)
                ? isSlidingOut
                  ? "slide-out-right"
                  : "slide-in"
                : ""
            }`}
          >
            {(() => {
              const activeCategory = CATS.find(
                (cat) => running[cat.key] || paused[cat.key]
              );
              if (activeCategory) {
                const activeSecs = secs[activeCategory.key];
                const activeMins = Math.round(activeSecs / 60);
                const activeSecsRemaining = activeSecs % 60;
                const isCurrentlyRunning = running[activeCategory.key];

                return (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                      height: "100%",
                      padding: "0 20px 20px 20px",
                      position: "relative",
                    }}
                  >
                    {/* Main content area with left and right sides */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flex: 1,
                        marginTop: "20px",
                      }}
                    >
                      {/* Left side - Category title, timer and pause button */}
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          paddingLeft: "0", // Remove padding to align with Progress Ring
                        }}
                      >
                        {/* Category title above timer */}
                        <div
                          className="caps"
                          style={{
                            fontSize: "1.4rem",
                            fontWeight: 800,
                            color: "var(--blue)",
                            lineHeight: "1.2",
                            marginBottom: "15px",
                          }}
                        >
                          {activeCategory.label}
                        </div>

                        {/* Timer display */}
                        <div
                          className="practice-session-main"
                          style={{ lineHeight: "1", marginBottom: "20px" }}
                        >
                          {/* Hidden span to measure text width */}
                          <span
                            ref={textMeasureRef}
                            style={{
                              position: "absolute",
                              visibility: "hidden",
                              whiteSpace: "nowrap",
                              fontSize: "inherit",
                              fontFamily: "inherit",
                              fontWeight: "inherit",
                            }}
                          >
                            {String(activeMins).padStart(2, "0")}:
                            {String(activeSecsRemaining).padStart(2, "0")}
                          </span>

                          {editingTimer === activeCategory.key ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => {
                                // Parse the input and update the timer
                                const [mins, secs] = editingValue
                                  .split(":")
                                  .map((s) => parseInt(s) || 0);
                                const totalSecs = mins * 60 + secs;
                                if (totalSecs >= 0) {
                                  setSecs((prev) => ({
                                    ...prev,
                                    [activeCategory.key]: totalSecs,
                                  }));
                                  // Auto-save the new value
                                  autoSave(
                                    activeCategory.key,
                                    Math.round(totalSecs / 60)
                                  );
                                }
                                setEditingTimer(null);
                                setEditingValue("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.currentTarget.blur();
                                } else if (e.key === "Escape") {
                                  setEditingTimer(null);
                                  setEditingValue("");
                                }
                              }}
                              style={{
                                fontSize: "inherit",
                                fontFamily: "inherit",
                                fontWeight: "inherit",
                                color: "inherit",
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid rgba(0, 178, 255, 0.2)",
                                borderRadius: "2px",
                                outline: "none",
                                width: getInputWidth(),
                                textAlign: "center",
                                padding: "2px 4px",
                                margin: "0",
                                boxSizing: "border-box",
                                lineHeight: "inherit",
                              }}
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTimer(activeCategory.key);
                                setEditingValue(
                                  `${String(activeMins).padStart(
                                    2,
                                    "0"
                                  )}:${String(activeSecsRemaining).padStart(
                                    2,
                                    "0"
                                  )}`
                                );
                              }}
                              style={{
                                cursor: "pointer",
                                transition: "all 0.2s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                  "rgba(0, 178, 255, 0.05)";
                                e.currentTarget.style.borderRadius = "2px";
                                e.currentTarget.style.padding = "0px 1px";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  "transparent";
                                e.currentTarget.style.borderRadius = "0";
                                e.currentTarget.style.padding = "0";
                              }}
                              title="Click to edit timer"
                            >
                              {String(activeMins).padStart(2, "0")}:
                              {String(activeSecsRemaining).padStart(2, "0")}
                            </span>
                          )}
                        </div>

                        {/* Pause/Play Button */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (running[activeCategory.key]) {
                                // Pause the timer
                                setRunning((r) => ({
                                  ...r,
                                  [activeCategory.key]: false,
                                }));
                                setPaused((p) => ({
                                  ...p,
                                  [activeCategory.key]: true,
                                }));
                              } else if (paused[activeCategory.key]) {
                                // Resume the timer
                                setPaused((p) => ({
                                  ...p,
                                  [activeCategory.key]: false,
                                }));
                                setRunning((r) => ({
                                  ...r,
                                  [activeCategory.key]: true,
                                }));
                              }
                            }}
                            style={{
                              width: "48px",
                              height: "48px",
                              borderRadius: "50%",
                              border: "2px solid var(--blue)",
                              background: "white",
                              color: "var(--blue)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.2rem",
                              transition: "all 0.2s ease",
                              boxShadow: "0 2px 8px rgba(0, 178, 255, 0.2)",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--blue)";
                              e.currentTarget.style.color = "white";
                              e.currentTarget.style.transform = "scale(1.05)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "white";
                              e.currentTarget.style.color = "var(--blue)";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                            title={
                              isCurrentlyRunning
                                ? "Pause Timer"
                                : "Resume Timer"
                            }
                          >
                            {isCurrentlyRunning ? (
                              "⏸"
                            ) : (
                              <span style={{ marginLeft: "2px" }}>▶</span>
                            )}
                          </button>
                        </div>

                        {/* Back to Progress Ring Button */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            marginTop: "8px",
                            marginBottom: "20px",
                          }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Stop this timer completely and return to Progress Ring
                              setIsSlidingOut(true);
                              setTimeout(() => {
                                setRunning((r) => ({
                                  ...r,
                                  [activeCategory.key]: false,
                                }));
                                setPaused((p) => ({
                                  ...p,
                                  [activeCategory.key]: false,
                                }));
                                setIsSlidingOut(false);
                              }, 300);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--blue)",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "1.8rem",
                              fontWeight: "900",
                              transition: "all 0.2s ease",
                              padding: "8px",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color =
                                "rgba(0, 178, 255, 0.8)";
                              e.currentTarget.style.transform = "scale(1.1)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = "var(--blue)";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                            title="Stop Timer & Return to Progress Ring"
                          >
                            ⟵
                          </button>
                        </div>
                      </div>

                      {/* Right side - Notes */}
                      <div
                        style={{
                          flex: 1,
                          maxWidth: "50%",
                          paddingLeft: "20px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "1.3rem",
                            fontWeight: 600,
                            color: "var(--deep)",
                            lineHeight: "1.7",
                            textAlign: "left",
                          }}
                        >
                          {plan.items[activeCategory.key]?.note ||
                            "No notes for this category"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>

      <div className="category-grid">
        {CATS.map((c) => {
          const mins = Math.round(secs[c.key] / 60),
            target = dailyTarget[c.key] || 0,
            pct =
              target === 0
                ? 0
                : Math.min(100, Math.round((mins / target) * 100));
          const isRun = running[c.key];
          return (
            <div
              key={c.key}
              className={
                "card " + (running[c.key] || paused[c.key] ? "running" : "")
              }
              onClick={() => {
                if (running[c.key] || paused[c.key]) {
                  // Stop this timer completely (whether running or paused)
                  setIsSlidingOut(true);
                  setTimeout(() => {
                    setRunning((r) => ({ ...r, [c.key]: false }));
                    setPaused((p) => ({ ...p, [c.key]: false }));
                    setIsSlidingOut(false);
                  }, 300);
                } else {
                  // Start this timer and stop all others
                  setRunning((r) => {
                    const newState = Object.fromEntries(
                      CATS.map((cat) => [cat.key, cat.key === c.key])
                    ) as Record<CategoryKey, boolean>;
                    return newState;
                  });
                  // Clear any paused state when starting a new timer
                  setPaused(
                    (p) =>
                      Object.fromEntries(
                        CATS.map((cat) => [cat.key, false])
                      ) as Record<CategoryKey, boolean>
                  );
                }
              }}
              style={{ cursor: "pointer" }}
            >
              <div style={{ marginBottom: "12px" }}>
                <div
                  className="caps"
                  style={{ fontWeight: 800, fontSize: "1.1rem" }}
                >
                  {c.label}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div className={`bar ${c.key}`} style={{ flex: 1 }}>
                  <span style={{ width: pct + "%" }}></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PlanPage({
  goal,
  setGoal,
  plan,
  setPlan,
  onSavePlan,
}: {
  goal: number;
  setGoal: (n: number) => void;
  plan: PlanState;
  setPlan: (p: PlanState) => void;
  onSavePlan: (next: { goal: number; plan: PlanState }) => Promise<void>;
}) {
  const allocatedDaily = useMemo(
    () => CATS.reduce((s, c) => s + (plan.items[c.key]?.minutes || 0), 0),
    [plan]
  );
  const remaining = goal - allocatedDaily;

  function update(
    cat: CategoryKey,
    field: "minutes" | "note",
    value: number | string
  ) {
    setPlan({
      items: {
        ...plan.items,
        [cat]: { ...plan.items[cat], [field]: value as any },
      },
    });
  }
  async function handleSave() {
    await onSavePlan({ goal, plan });
  }

  return (
    <div className="card">
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <h3 className="caps">Weekly Plan</h3>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <label className="small">Daily Goal</label>
          <input
            className="input"
            style={{ width: 110 }}
            type="number"
            min={10}
            step={5}
            value={goal}
            onChange={(e) =>
              setGoal(Math.max(10, parseInt(e.target.value || "0", 10)))
            }
          />
          <div className="pill small">
            Allocated{" "}
            <strong style={{ margin: "0 4px" }}>{allocatedDaily}</strong> ·{" "}
            {remaining >= 0
              ? `Remaining ${remaining}m`
              : `Over by ${Math.abs(remaining)}m`}
          </div>
        </div>
      </div>
      {CATS.map((c) => (
        <div className="row" key={c.key}>
          <div style={{ flex: 1 }}>
            <div className="caps small" style={{ marginBottom: 6 }}>
              {c.label}
            </div>
            <div className="plan-input-row">
              <input
                className="input"
                type="number"
                min={0}
                step={5}
                value={plan.items[c.key].minutes}
                onChange={(e) =>
                  update(c.key, "minutes", parseInt(e.target.value || "0", 10))
                }
                placeholder="Daily target minutes"
              />
              <input
                className="input"
                type="text"
                value={plan.items[c.key].note}
                onChange={(e) => update(c.key, "note", e.target.value)}
                placeholder="Brief note"
              />
            </div>
          </div>
        </div>
      ))}
      <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
        <button className="btn" onClick={handleSave}>
          Save Plan
        </button>
      </div>
    </div>
  );
}

function History({ sessions, goal }: { sessions: SessionRow[]; goal: number }) {
  const [range, setRange] = useState<"week" | "month" | "quarter" | "year">(
    "week"
  );
  const daysCount =
    range === "week"
      ? 7
      : range === "month"
      ? 30
      : range === "quarter"
      ? 90
      : 365;
  const days = useMemo(() => lastNDates(daysCount).reverse(), [range]);

  const perDay = useMemo(() => {
    return days.map((d) => {
      const rows = sessions.filter((s) => s.date === d);
      const total = rows.reduce((a, s) => a + s.minutes, 0);
      const split: Record<CategoryKey, number> = Object.fromEntries(
        CATS.map((c) => [c.key, 0])
      ) as Record<CategoryKey, number>;
      rows.forEach((r) => (split[r.category] += r.minutes));
      return { date: d, total, split };
    });
  }, [sessions, days]);

  const sumTotal = perDay.reduce((a, d) => a + d.total, 0);
  const metDays = perDay.filter(
    (d) => d.total >= Math.round(goal * 0.8)
  ).length;
  const consistencyDisplay = `${metDays}/${daysCount}`;
  const pct = Math.min(
    100,
    Math.round((sumTotal / Math.max(goal * daysCount, 1)) * 100)
  );

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 className="caps">History</h3>
        <div className="tabs">
          {(["week", "month", "quarter", "year"] as const).map((r) => (
            <button
              key={r}
              className={"tab small " + (range === r ? "active" : "")}
              onClick={() => setRange(r)}
            >
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div style={{ flex: 1, marginRight: 12 }}>
          <div className="bar">
            <span style={{ width: pct + "%" }}></span>
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Progress vs target for selected range
          </div>
        </div>
        <div className="grid2" style={{ minWidth: 280 }}>
          <div>
            <div className="muted">Total minutes</div>
            <div style={{ fontWeight: 800, fontSize: "1.8rem" }}>
              {sumTotal}
            </div>
          </div>
          <div>
            <div className="muted">Consistency (days)</div>
            <div style={{ fontWeight: 800, fontSize: "1.8rem" }}>
              {consistencyDisplay}
            </div>
          </div>
        </div>
      </div>

      <div className="legend">
        {CATS.map((c) => (
          <div className={"key " + c.key} key={c.key}>
            <span className="box"></span>
            <span className="small">{c.label}</span>
          </div>
        ))}
      </div>
      <div className="hr"></div>

      <div className="strip" title="Scroll horizontally">
        {perDay.map((d) => {
          const maxH = 120;
          const h = Math.max(
            2,
            Math.round(maxH * Math.min(1, d.total / Math.max(goal, 1)))
          );
          const total = Math.max(1, d.total);
          const segs: { cls: string; h: number }[] = [];
          CATS.forEach((c) => {
            const k = c.key;
            const frac = d.split[k] / total;
            const segH = Math.round(h * frac);
            if (segH > 0) segs.push({ cls: k, h: segH });
          });
          const ld = parseLocalDate(d.date);
          const weekdayShort = ld.toLocaleDateString(undefined, {
            weekday: "short",
          });
          return (
            <div key={d.date} className="col" title={d.total + " min"}>
              <div className="vstack">
                {segs.map((s, i) => (
                  <div
                    key={i}
                    className={"seg " + s.cls}
                    style={{ height: s.h + "px" }}
                  ></div>
                ))}
              </div>
              <div className="small" style={{ opacity: 0.8 }}>
                {weekdayShort[0]}
              </div>
              <div className="small" style={{ fontWeight: 700 }}>
                {ld.getDate()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionLog({
  sessions,
  clearDay,
  updateEntry,
  clearEntry,
  ensureAllDaysHaveEntries,
}: {
  sessions: SessionRow[];
  clearDay: (date: string) => Promise<void>;
  updateEntry: (
    id: number,
    patch: Partial<Pick<SessionRow, "category" | "minutes">>
  ) => Promise<void>;
  clearEntry: (id: number) => Promise<void>;
  ensureAllDaysHaveEntries: () => Promise<void>;
}) {
  const days = lastNDates(14);

  // Ensure all days have entries for all categories when component mounts
  // Use a ref to prevent multiple calls
  const hasInitialized = React.useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      console.log(`🔄 SessionLog component: Initializing all days entries`);
      hasInitialized.current = true;
      ensureAllDaysHaveEntries();
    } else {
      console.log(`🚫 SessionLog component: Already initialized`);
    }
  }, [ensureAllDaysHaveEntries]);

  const grouped = useMemo(() => {
    const map = new Map<string, SessionRow[]>();
    sessions.forEach((s) => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    });
    return map;
  }, [sessions]);

  return (
    <div className="card">
      <h3 className="caps">Session Log</h3>
      {days.map((date) => {
        const rows = grouped.get(date) || [];
        const ld = parseLocalDate(date);
        return (
          <div key={date} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                margin: "6px 0",
              }}
            >
              <div style={{ fontWeight: 800 }}>
                {ld.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <button className="btn secondary" onClick={() => clearDay(date)}>
                Clear Day
              </button>
            </div>
            {rows.length === 0 ? (
              <div className="small muted">No entries</div>
            ) : null}
            {rows
              .sort((a, b) => {
                const aIndex = CATS.findIndex((cat) => cat.key === a.category);
                const bIndex = CATS.findIndex((cat) => cat.key === b.category);
                return aIndex - bIndex;
              })
              .map((r) => (
                <div
                  key={r.id}
                  className="row"
                  style={{ alignItems: "center" }}
                >
                  <select
                    className="select"
                    style={{ maxWidth: 180 }}
                    value={r.category}
                    onChange={(e) =>
                      r.id &&
                      updateEntry(r.id, {
                        category: e.target.value as CategoryKey,
                      })
                    }
                  >
                    {CATS.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    style={{ maxWidth: 120 }}
                    type="number"
                    min={0}
                    step={1}
                    value={r.minutes}
                    onChange={(e) =>
                      r.id &&
                      updateEntry(r.id, {
                        minutes: Math.max(
                          0,
                          parseInt(e.target.value || "0", 10)
                        ),
                      })
                    }
                  />
                  {r.id ? (
                    <button
                      className="btn secondary"
                      onClick={() => clearEntry(r.id!)}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              ))}
            <div className="hr"></div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<"today" | "plan" | "history" | "log">(
    "today"
  );

  // Live state
  const [goal, setGoal] = useState(180);
  const [plan, setPlan] = useState<PlanState>({
    items: {
      scales: { minutes: 45, note: "Tone & Intonation" },
      review: { minutes: 45, note: "Dvorak mvmt II" },
      new: { minutes: 45, note: "Shostakovich Prelude" },
      technique: { minutes: 45, note: "Shifts & vibrato" },
    },
  });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Load remote data on sign-in
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        // PLAN
        const { data: planRow } = await supabase
          .from("plan")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (!planRow) {
          await supabase.from("plan").insert({
            user_id: userId,
            daily_goal: 180,
            scales_minutes: 45,
            scales_note: "Tone & Intonation",
            review_minutes: 45,
            review_note: "Dvorak mvmt II",
            new_minutes: 45,
            new_note: "Shostakovich Prelude",
            technique_minutes: 45,
            technique_note: "Shifts & vibrato",
          });
          const { data: seeded } = await supabase
            .from("plan")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          if (seeded) applyPlan(seeded);
        } else {
          applyPlan(planRow);
        }
        // SESSIONS
        const start = localISO(
          new Date(new Date().setDate(new Date().getDate() - 365))
        );
        const { data: sessRows } = await supabase
          .from("sessions")
          .select("id, session_date, category, minutes")
          .eq("user_id", userId)
          .gte("session_date", start)
          .order("session_date", { ascending: true });
        setSessions(
          (sessRows || []).map((r) => ({
            id: r.id,
            date: r.session_date as string,
            category: r.category as CategoryKey,
            minutes: r.minutes,
          }))
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  function applyPlan(row: any) {
    setGoal(row.daily_goal ?? 180);
    setPlan({
      items: {
        scales: {
          minutes: row.scales_minutes ?? 45,
          note: row.scales_note ?? "",
        },
        review: {
          minutes: row.review_minutes ?? 45,
          note: row.review_note ?? "",
        },
        new: { minutes: row.new_minutes ?? 45, note: row.new_note ?? "" },
        technique: {
          minutes: row.technique_minutes ?? 45,
          note: row.technique_note ?? "",
        },
      },
    });
  }

  async function savePlan({
    goal: nextGoal,
    plan: nextPlan,
  }: {
    goal: number;
    plan: PlanState;
  }) {
    await supabase.from("plan").upsert({
      user_id: userId!,
      daily_goal: nextGoal,
      scales_minutes: nextPlan.items.scales.minutes,
      scales_note: nextPlan.items.scales.note,
      review_minutes: nextPlan.items.review.minutes,
      review_note: nextPlan.items.review.note,
      new_minutes: nextPlan.items.new.minutes,
      new_note: nextPlan.items.new.note,
      technique_minutes: nextPlan.items.technique.minutes,
      technique_note: nextPlan.items.technique.note,
      updated_at: new Date().toISOString(),
    });
  }

  async function saveToday(
    rows: { date: string; category: CategoryKey; minutes: number }[]
  ) {
    const payload = rows.map((r) => ({
      user_id: userId!,
      session_date: r.date,
      category: r.category,
      minutes: r.minutes,
    }));
    const { data } = await supabase.from("sessions").insert(payload).select();
    const mapped =
      (data || []).map((r: any) => ({
        id: r.id,
        date: r.session_date as string,
        category: r.category as CategoryKey,
        minutes: r.minutes,
      })) || [];
    setSessions((prev) => [...prev, ...mapped]);
  }

  // Function to ensure daily entries exist for all categories
  // This function is now more robust and prevents duplicate creation
  const ensureDailyEntries = React.useCallback(
    async (date: string) => {
      // Prevent concurrent calls
      if (isCreatingEntries.current) {
        console.log(
          `🚫 ensureDailyEntries: Skipping ${date} - already creating entries`
        );
        return;
      }

      const categories: CategoryKey[] = CATS.map((c) => c.key);

      // Check what we already have in local state first
      const existingInState = categories.filter((category) =>
        sessions.some((s) => s.date === date && s.category === category)
      );

      // Only create entries for categories that don't exist in state
      const missingCategories = categories.filter(
        (category) => !existingInState.includes(category)
      );

      // Early return if no categories are missing
      if (missingCategories.length === 0) {
        console.log(
          `✅ ensureDailyEntries: ${date} - all categories already exist in state`
        );
        return; // All entries already exist
      }

      // Set flag to prevent concurrent calls
      isCreatingEntries.current = true;

      try {
        // Double-check with database to prevent duplicates
        const { data: existingInDB } = await supabase
          .from("sessions")
          .select("category")
          .eq("user_id", userId!)
          .eq("session_date", date);

        const existingCategoriesInDB = (existingInDB || []).map(
          (r: any) => r.category
        );
        const trulyMissingCategories = missingCategories.filter(
          (category) => !existingCategoriesInDB.includes(category)
        );

        // Early return if no categories are truly missing
        if (trulyMissingCategories.length === 0) {
          console.log(
            `✅ ensureDailyEntries: ${date} - all categories already exist in database`
          );
          return; // All entries already exist in database
        }

        // Create missing entries in a single batch
        const entriesToCreate = trulyMissingCategories.map((category) => ({
          user_id: userId!,
          session_date: date,
          category: category,
          minutes: 0,
        }));

        console.log(
          `🔄 ensureDailyEntries: Creating ${trulyMissingCategories.length} entries for ${date}:`,
          trulyMissingCategories
        );

        const { data, error } = await supabase
          .from("sessions")
          .insert(entriesToCreate)
          .select();

        if (error) {
          console.error("Error creating daily entries:", error);
          return;
        }

        if (data && data.length > 0) {
          const newEntries = data.map((r: any) => ({
            id: r.id,
            date: r.session_date as string,
            category: r.category as CategoryKey,
            minutes: r.minutes,
          }));

          console.log(
            `✅ ensureDailyEntries: Successfully created ${newEntries.length} entries for ${date}`
          );
          setSessions((prev) => [...prev, ...newEntries]);
        }
      } finally {
        // Always reset the flag
        isCreatingEntries.current = false;
      }
    },
    [userId] // Remove sessions from dependency array to prevent infinite loops
  );

  // Function to ensure all days in the Session Log have entries for all categories
  const ensureAllDaysHaveEntries = useCallback(async () => {
    // Prevent concurrent calls
    if (isCreatingEntries.current) {
      return;
    }

    const days = lastNDates(14);

    // Check which days already have all categories
    const daysNeedingEntries = days.filter((date) => {
      const dayEntries = sessions.filter((s) => s.date === date);
      return dayEntries.length < 4; // Less than 4 categories
    });

    // Early return if no days need entries
    if (daysNeedingEntries.length === 0) {
      return;
    }

    // Only process days that need entries
    for (const date of daysNeedingEntries) {
      await ensureDailyEntries(date);
    }
  }, [ensureDailyEntries]); // Remove sessions dependency to prevent infinite loops

  // Add a cleanup function to prevent multiple calls
  const hasRunRef = React.useRef(false);
  const ensureAllDaysHaveEntriesOnce = useCallback(async () => {
    // Use a ref to prevent multiple calls
    if (hasRunRef.current) {
      console.log(`🚫 ensureAllDaysHaveEntriesOnce: Skipping - already run`);
      return;
    }
    console.log(`🔄 ensureAllDaysHaveEntriesOnce: Running`);
    hasRunRef.current = true;
    await ensureAllDaysHaveEntries();
  }, [ensureAllDaysHaveEntries]);

  // Add a cleanup function for daily entries to prevent multiple calls
  const hasRunDailyRef = React.useRef(false);
  const ensureDailyEntriesOnce = useCallback(
    async (date: string) => {
      // Use a ref to prevent multiple calls for the same date
      if (hasRunDailyRef.current) {
        console.log(
          `🚫 ensureDailyEntriesOnce: Skipping ${date} - already run`
        );
        return;
      }
      console.log(`🔄 ensureDailyEntriesOnce: Running for ${date}`);
      hasRunDailyRef.current = true;
      await ensureDailyEntries(date);
    },
    [ensureDailyEntries]
  );

  // Add a flag to prevent concurrent calls to ensureDailyEntries
  const isCreatingEntries = React.useRef(false);

  // Function to clear all entries for a specific day
  async function clearDay(date: string) {
    const dayEntries = sessions.filter((s) => s.date === date);

    for (const entry of dayEntries) {
      if (entry.id) {
        await updateEntry(entry.id, { minutes: 0 });
      }
    }
  }

  // Function to clear a specific entry (set minutes to 0)
  async function clearEntry(id: number) {
    await updateEntry(id, { minutes: 0 });
  }

  async function updateEntry(
    id: number,
    patch: Partial<Pick<SessionRow, "category" | "minutes">>
  ) {
    await supabase.from("sessions").update(patch).eq("id", id);
    setSessions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  if (!userId) return <AuthGate onReady={setUserId} />;

  return (
    <div className="app">
      <div className="topbar">
        <h1>Practice Log</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="pill small">
            Goal <strong style={{ marginLeft: 6 }}>{goal}</strong> min
          </div>
          <button
            className="tab"
            onClick={async () => {
              await supabase.auth.signOut();
              setUserId(null);
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="tabs">
        {(["today", "plan", "history", "log"] as const).map((t) => (
          <button
            key={t}
            className={"tab" + (view === t ? " active" : "")}
            onClick={() => setView(t)}
          >
            {t === "log" ? "Session Log" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card center">
          <div className="small">Loading…</div>
        </div>
      ) : view === "today" ? (
        <Today
          goal={goal}
          plan={plan}
          onSaveToday={saveToday}
          sessions={sessions}
          updateEntry={updateEntry}
          ensureDailyEntries={ensureDailyEntriesOnce}
        />
      ) : view === "plan" ? (
        <PlanPage
          goal={goal}
          setGoal={setGoal}
          plan={plan}
          setPlan={setPlan}
          onSavePlan={savePlan}
        />
      ) : view === "history" ? (
        <History sessions={sessions} goal={goal} />
      ) : (
        <SessionLog
          sessions={sessions}
          clearDay={clearDay}
          updateEntry={updateEntry}
          clearEntry={clearEntry}
          ensureAllDaysHaveEntries={ensureAllDaysHaveEntriesOnce}
        />
      )}
    </div>
  );
}
