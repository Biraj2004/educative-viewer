"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import { generateAIContent, AVAILABLE_MODELS } from "@/utils/aiClient";

interface Message {
  role: "user" | "model";
  content: string;
}

interface CourseChatbotProps {
  topicTitle: string;
  topicContext: string;
  rightOffsetPx?: number;
}

function RobotIcon() {
  return (
    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.792 0-5.484-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  );
}

export default function CourseChatbot({ topicTitle, topicContext, rightOffsetPx = 24 }: CourseChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const chatbotRef = useRef<HTMLDivElement>(null);
  const floatingStyle = {
    right: `${rightOffsetPx}px`,
    "--chatbot-bottom": "1.5rem",
    "--chatbot-mobile-bottom": "5.75rem",
    "--chatbot-window-bottom": "6rem",
    "--chatbot-mobile-window-bottom": "9.75rem",
  } as CSSProperties & Record<string, string>;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatbotRef.current && !chatbotRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const greetingMessage = useMemo<Message>(
    () => ({ role: "model", content: `Hi! I'm your AI assistant for this topic (**${topicTitle}**). Ask me anything about it!` }),
    [topicTitle]
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [greetingMessage, messages, loading]);

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage: Message = { role: "user", content: inputValue.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue("");
    setLoading(true);

    try {
      const history = newMessages.map(m => ({ role: m.role, content: m.content }));
      
      const systemPrompt = `You are a helpful AI tutor assisting a student with a specific course topic.
You should answer their questions accurately, clearly, and concisely, using the context provided.
Do not hallucinate outside information if it directly contradicts the topic.
If the context does not contain the answer, you can use your general knowledge but clearly state that it's beyond the current topic's scope.

CURRENT TOPIC TITLE: ${topicTitle}

<TOPIC_CONTEXT>
${topicContext}
</TOPIC_CONTEXT>`;

      const selectedModelObj = AVAILABLE_MODELS.find(m => m.id === selectedModel);
      const response = await generateAIContent({
        systemPrompt: systemPrompt,
        userPrompt: userMessage.content,
        history: history,
        model: selectedModel,
        provider: selectedModelObj?.provider ?? "gemini",
        temperature: 0.2,
      });

      setMessages([...newMessages, { role: "model", content: response }]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to generate response.";
      setMessages([
        ...newMessages,
        { role: "model", content: `**Error:** ${message}` }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderedMessages = useMemo(() => [greetingMessage, ...messages].map((msg, i) => (
    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          msg.role === "user"
            ? "bg-indigo-600 text-white rounded-br-none"
            : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-gray-800 prose-pre:text-gray-100"
        }`}
      >
        {msg.role === "user" ? (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        ) : (
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        )}
      </div>
    </div>
  )), [greetingMessage, messages]);

  return (
    <div ref={chatbotRef}>
      {/* Floating Action Button */}
      <div className="course-chatbot-fab fixed z-50" style={floatingStyle}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 ring-1 ring-white/20 transition-transform hover:scale-105 hover:bg-indigo-700 active:scale-95 dark:ring-indigo-300/10 sm:h-14 sm:w-14 cursor-pointer"
          aria-label="Toggle AI Chat"
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <ChatIcon />
          )}
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div
          className="course-chatbot-window fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-slate-950/20 dark:border-gray-800 dark:bg-gray-900"
          style={floatingStyle}
        >
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-lg">
                <RobotIcon />
              </div>
              <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                Topic AI Assistant
              </span>
            </div>
            <button
              onClick={() => {
                setMessages([]);
                setInputValue("");
              }}
              title="Reset Chat"
              className="text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium cursor-pointer transition-colors px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
            >
              Reset
            </button>
          </div>

          {/* Model Selection */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1.5 text-xs text-gray-700 dark:text-gray-200 outline-none focus:border-indigo-500 transition-colors"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Chat Messages */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 text-sm relative scroll-smooth">
            {/* Rendered messages to prevent input lag */}
            {renderedMessages}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="flex items-center gap-2 relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this topic..."
                disabled={loading}
                className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full pl-4 pr-10 py-2.5 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || loading}
                className="absolute right-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-1.5 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
