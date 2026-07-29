import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

export default function MessageBubble({ role, content }) {
  if (role === "user") {
    return (
      <div className="flex justify-end w-full animate-in slide-in-from-right-4 fade-in duration-300">
        <div className="max-w-[85%] md:max-w-2xl rounded-3xl rounded-tr-sm bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-5 py-3.5 shadow-md shadow-purple-900/20 font-medium text-[15px] leading-relaxed">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start w-full animate-in slide-in-from-left-4 fade-in duration-300">
      <div className="max-w-[95%] md:max-w-3xl rounded-3xl rounded-tl-sm bg-zinc-900/80 backdrop-blur-md border border-white/5 text-zinc-200 px-5 md:px-7 py-5 shadow-sm text-[15px]">
        <ReactMarkdown
          rehypePlugins={[rehypeHighlight]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
