import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** Rendert Markdown mit LaTeX-Formeln ($…$ und $$…$$). Kein rohes HTML. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={`prose-abi ${className ?? ""}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
