import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export default function MessageBubble({ role, content }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-purple-600 text-white px-4 py-2.5">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-2xl rounded-2xl rounded-tl-sm bg-zinc-900 border border-zinc-800 text-gray-100 px-4 py-3 prose prose-invert prose-sm max-w-none prose-pre:bg-black prose-pre:border prose-pre:border-zinc-800">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
