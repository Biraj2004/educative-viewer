"use client";

import { useMemo } from "react";

export interface SlateHtmlData {
  comp_id: string;
  html: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeadingNode {
  type: "h2";
  text: string;
}

interface ParagraphNode {
  type: "p";
  text: string;
}

interface ListNode {
  type: "ul";
  items: string[];
}

type ContentNode = HeadingNode | ParagraphNode | ListNode;

// ─── HTML Parsing Utilities ───────────────────────────────────────────────────

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function extractText(html: string): string {
  return decodeEntities(stripTags(html)).trim();
}

function parseListItems(ulInner: string): string[] {
  const items: string[] = [];
  const liRegex = /<li(?:[^>]*)>([\s\S]*?)<\/li>/g;
  let match: RegExpExecArray | null;
  while ((match = liRegex.exec(ulInner)) !== null) {
    const text = extractText(match[1]);
    if (text) items.push(text);
  }
  return items;
}

function parseHtml(html: string): ContentNode[] {
  const nodes: ContentNode[] = [];
  // Matches top-level h2, p, ul tags (backreference ensures correct closing tag)
  const tagRegex = /<(h2|p|ul)(?:[^>]*)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1] as "h2" | "p" | "ul";
    const inner = match[2];
    if (tag === "ul") {
      const items = parseListItems(inner);
      if (items.length) nodes.push({ type: "ul", items });
    } else {
      const text = extractText(inner);
      if (text) nodes.push({ type: tag, text });
    }
  }
  return nodes;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ text }: { text: string }) {
  return (
    <h2 className="text-[22px] font-bold text-gray-900 mt-10 mb-3 leading-snug">
      {text}
    </h2>
  );
}

function BodyParagraph({ text }: { text: string }) {
  return (
    <p className="text-[15px] text-gray-600 leading-[1.8] mb-4">{text}</p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-6 mb-5 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="text-[15px] text-gray-600 leading-[1.8]">
          {item}
        </li>
      ))}
    </ul>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SlateHTML({ data }: { data: SlateHtmlData }) {
  const nodes = useMemo(() => parseHtml(data.html), [data.html]);

  return (
    <div className="min-h-screen bg-white">
      {/* Content area */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <article>
          {nodes.map((node, i) => {
            switch (node.type) {
              case "h2":
                return <SectionHeading key={i} text={node.text} />;
              case "p":
                return <BodyParagraph key={i} text={node.text} />;
              case "ul":
                return <BulletList key={i} items={node.items} />;
              default:
                return null;
            }
          })}
        </article>
      </main>
    </div>
  );
}
