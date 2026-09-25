import { ShieldCheck, Target, Crosshair, Search, ShieldAlert } from "lucide-react";

// Tailwind's JIT scanner needs literal class strings to find them, so accent
// colors are looked up from this map rather than built with a template
// literal like `bg-${accent}-500/10` - that pattern silently produces
// classes that never make it into the production CSS build.
const ACCENT_CLASSES = {
  purple: { chip: "bg-purple-500/10 text-purple-400", bar: "from-purple-500 to-purple-400" },
  indigo: { chip: "bg-indigo-500/10 text-indigo-400", bar: "from-indigo-500 to-indigo-400" },
  violet: { chip: "bg-violet-500/10 text-violet-400", bar: "from-violet-500 to-violet-400" },
  fuchsia: { chip: "bg-fuchsia-500/10 text-fuchsia-400", bar: "from-fuchsia-500 to-fuchsia-400" },
  rose: { chip: "bg-rose-500/10 text-rose-400", bar: "from-rose-500 to-rose-400" },
};

// Source: latest evaluation run (15 test queries), from the metrics table.
// Update this array when a new run produces fresh numbers - the headline
// average, every bar, and every pass count all derive from it automatically.
//
// Pass Rate (not Overall Avg) drives the progress bar for every card so the
// visual language stays consistent - "higher bar = better" - even for
// Hallucination, where the raw average is inverted (lower = better). That
// avg is still shown as supporting text, just labeled clearly.
const METRICS = [
  {
    key: "faithfulness",
    label: "Faithfulness",
    description: "How closely each answer sticks to what the retrieved sources actually say.",
    avg: 0.917,
    passRate: 86.7,
    passed: 13,
    total: 15,
    icon: ShieldCheck,
    accent: "purple",
  },
  {
    key: "answer-relevancy",
    label: "Answer Relevancy",
    description: "How directly the answer addresses the question that was asked.",
    avg: 0.91,
    passRate: 93.3,
    passed: 14,
    total: 15,
    icon: Target,
    accent: "indigo",
  },
  {
    key: "contextual-precision",
    label: "Contextual Precision",
    description: "How much of what was retrieved was actually useful for answering.",
    avg: 0.75,
    passRate: 73.3,
    passed: 11,
    total: 15,
    icon: Crosshair,
    accent: "violet",
  },
  {
    key: "contextual-recall",
    label: "Contextual Recall",
    description: "How much of the necessary information was successfully retrieved.",
    avg: 0.767,
    passRate: 73.3,
    passed: 11,
    total: 15,
    icon: Search,
    accent: "fuchsia",
  },
  {
    key: "hallucination",
    label: "Hallucination",
    description: "How often the assistant states something not backed by its sources.",
    avg: 0.067,
    passRate: 93.3,
    passed: 14,
    total: 15,
    icon: ShieldAlert,
    accent: "rose",
    lowerIsBetter: true,
  },
];

const overallPassRate = (METRICS.reduce((sum, m) => sum + m.passRate, 0) / METRICS.length).toFixed(0);

export default function EvaluationSection() {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-2">
        Evaluation results
      </h2>

      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          {overallPassRate}%
        </span>
        <span className="text-zinc-400 text-sm">average pass rate across every metric below</span>
      </div>
      <p className="text-xs text-zinc-600 mb-8">Latest run · 15 evaluation queries</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {METRICS.map((m, i) => {
          const Icon = m.icon;
          const accent = ACCENT_CLASSES[m.accent];
          return (
            <div
              key={m.key}
              style={{ animationDelay: `${i * 75}ms` }}
              className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              <div className="flex items-start justify-between mb-4">
                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${accent.chip}`}>
                  <Icon size={16} />
                </span>
                <span className="text-2xl font-bold text-white tabular-nums">{m.passRate}%</span>
              </div>

              <h3 className="text-sm font-semibold text-white mb-1">{m.label}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-4">{m.description}</p>

              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${accent.bar}`}
                  style={{ width: `${m.passRate}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-600 font-medium">
                {m.passed}/{m.total} test cases passed · avg {m.avg.toFixed(3)}
                {m.lowerIsBetter ? " (lower is better)" : ""}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}