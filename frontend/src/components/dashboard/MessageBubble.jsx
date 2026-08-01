import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

export default function MessageBubble({ role, content }) {
  if (role === "user") {
    return (
      <div className="flex justify-end w-full min-w-0 animate-in slide-in-from-right-4 fade-in duration-300">
        <div className="max-w-[85%] md:max-w-2xl min-w-0 break-words rounded-3xl rounded-tr-sm bg-gradient-to-br from-purple-600 to-indigo-600 text-white px-5 py-3.5 shadow-md shadow-purple-900/20 font-medium text-[15px] leading-relaxed">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start w-full min-w-0 animate-in slide-in-from-left-4 fade-in duration-300">
      <div className="max-w-[95%] md:max-w-3xl min-w-0 rounded-3xl rounded-tl-sm bg-zinc-900/80 backdrop-blur-md border border-white/5 text-zinc-200 px-3 md:px-7 py-3 shadow-sm text-[15px]">
        <div
          className="prose prose-invert prose-sm md:prose-base max-w-none min-w-0 break-words
            prose-p:my-3 prose-p:leading-relaxed
            prose-headings:font-semibold prose-headings:mt-5 prose-headings:mb-2 prose-headings:text-white
            prose-ul:my-3 prose-ol:my-3 prose-li:my-1
            prose-strong:text-white prose-strong:font-semibold
            prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
            prose-blockquote:border-purple-500 prose-blockquote:text-zinc-400
            prose-code:text-purple-300 prose-code:bg-black/40 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-code:break-all
            prose-pre:bg-black prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:overflow-x-auto prose-pre:max-w-full
            prose-table:text-sm prose-th:text-zinc-300 prose-hr:border-white/10">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
