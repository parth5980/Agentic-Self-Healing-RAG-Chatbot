import { Link } from "react-router-dom";
import { ArrowLeft, Layers, RefreshCcw, Link2, MessagesSquare } from "lucide-react";
import logo from "../assets/logo.png";
import EvaluationSection from "../components/about/EvaluationSection";

const FEATURES = [
  {
    icon: Layers,
    title: "Multi-source ingestion",
    description:
      "Feed it PDFs, web pages, or YouTube videos - PNX AI turns all of them into a searchable knowledge base for the conversation.",
  },
  {
    icon: RefreshCcw,
    title: "Self-healing retrieval",
    description:
      "Weak or off-target retrievals are detected and corrected before an answer is generated, not after.",
  },
  {
    icon: Link2,
    title: "Grounded, cited answers",
    description:
      "Every answer points back to the source it came from, so you can verify it instead of taking it on faith.",
  },
  {
    icon: MessagesSquare,
    title: "Per-conversation memory",
    description:
      "Sources are scoped to each chat, so different conversations don't bleed into each other's context.",
  },
];

/**
 * /about - a standalone page, deliberately self-contained (its own header
 * and back link) rather than assuming a shared authenticated layout wraps
 * it. If your router already renders Sidebar around every route, trim the
 * back-link block below and this will still slot in cleanly.
 */
export default function About() {
  return (
    <div className="h-[100dvh] overflow-y-auto bg-black text-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-track]:bg-transparent scroll-smooth">
      <div className="max-w-4xl mx-auto px-6 py-10 md:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors mb-10"
        >
          <ArrowLeft size={16} />
          Back to chat
        </Link>

        {/* Hero */}
        <div className="flex items-center gap-4 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <img
            src={logo}
            alt="PNX AI"
            className="w-14 h-14 rounded-2xl border border-white/10 shadow-lg"
          />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">PNX AI</h1>
            <p className="text-xs font-bold text-purple-400/80 uppercase tracking-[0.2em]">
              Agentic Intelligence
            </p>
          </div>
        </div>
        <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-2xl mb-16 animate-in fade-in slide-in-from-bottom-2 duration-500">
          PNX AI is a self-healing RAG assistant - it answers from documents, web pages, and
          videos you connect, checks its own retrieval before responding, and always grounds
          what it says in a source you can check.
        </p>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-6">
            How it works
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, description }, i) => (
              <div
                key={title}
                style={{ animationDelay: `${i * 75}ms` }}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/10 mb-4">
                  <Icon size={18} className="text-purple-400" />
                </span>
                <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Evaluation results - see EvaluationSection.jsx to update the numbers */}
        <EvaluationSection />

        <p className="text-center text-xs text-zinc-600 mt-16">
          © {new Date().getFullYear()} PNX AI. Built for research that has to be checkable.
        </p>
      </div>
    </div>
  );
}