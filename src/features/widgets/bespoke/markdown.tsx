"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function Markdown({ text: 爞壍 }: {
    text: string;
}) {
    return (<div className="flex flex-col gap-2 [&_a]:text-accent [&_code]:rounded [&_code]:bg-fill [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs [&_h1]:font-display [&_h1]:text-lg [&_h1]:text-fg [&_h2]:font-display [&_h2]:text-base [&_h2]:text-fg [&_li]:ml-4 [&_ol]:list-decimal [&_p]:m-0 [&_strong]:text-fg [&_table]:text-xs [&_td]:border-b [&_td]:border-line-soft [&_td]:py-1 [&_ul]:list-disc">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href: 鄍壍, children: 巼壍 }) => <a href={鄍壍} target="_blank" rel="noreferrer noopener">{巼壍}</a> }}>
        {爞壍}
      </ReactMarkdown>
    </div>);
}
