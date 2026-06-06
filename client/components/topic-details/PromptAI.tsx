"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import parse from "html-react-parser";
import { generateAIContent, AVAILABLE_MODELS } from "@/utils/aiClient";

export interface PromptAIData {
  comp_id: string;
  selectedAIModel?: string;
  systemPrompt?: string;
  temperature?: number;
  turnLimit?: number;
  version?: number | string;
  introTextStatement?: string;
  introPrompt?: string;
}

interface Message {
  role: "user" | "model";
  content: string;
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function RobotIcon() {
  return (
    <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L15 22l-4-9-9-4 20-7z" />
    </svg>
  );
}

export default function PromptAI({ data }: { data: PromptAIData }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Remove turn limits entirely as per user request to treat it like a chatbot
  const attemptsRemaining = "Unlimited";
  const canChat = true;

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSend() {
    if (!inputValue.trim() || loading || !canChat) return;
    
    const userMessage: Message = { role: "user", content: inputValue.trim() };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInputValue("");
    setLoading(true);
    setError(null);

    try {
      // Send only previous messages as history to API
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      
      const selectedModelObj = AVAILABLE_MODELS.find(m => m.id === selectedModel);
      const response = await generateAIContent({
        systemPrompt: data.systemPrompt,
        userPrompt: userMessage.content,
        history: history,
        model: selectedModel,
        provider: selectedModelObj?.provider ?? "gemini",
        temperature: data.temperature ?? 0.2,
      });

      setMessages([...updatedMessages, { role: "model", content: response }]);
    } catch (err: any) {
      setError(err.message || "Failed to generate AI response.");
      // Rollback user message so they can try again if they want
      setMessages(messages);
      setInputValue(userMessage.content); 
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setInputValue("");
    setError(null);
  }

  const renderedMessages = useMemo(() => messages.map((msg, idx) => (
    <div
      key={idx}
      className={`max-w-[85%] rounded-lg px-4 py-3 text-sm ${
        msg.role === "user"
          ? "bg-blue-500 text-white self-end rounded-br-none"
          : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 self-start rounded-bl-none"
      }`}
    >
      <div className="whitespace-pre-wrap leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-gray-800 prose-pre:text-gray-100">
        {msg.role === "model" ? (
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        ) : (
          msg.content
        )}
      </div>
    </div>
  )), [messages]);

  return (
    <div className="max-w-4xl mx-auto my-8 flex flex-col gap-6">
      {/* Top Banner */}
      <div className="flex items-start gap-3 bg-green-50 dark:bg-green-950/30 p-4 rounded-lg border-l-4 border-green-500">
        <div className="mt-0.5">
          <CheckIcon />
        </div>
        <p className="text-sm text-green-800 dark:text-green-200">
          Do you want to know more about any of the above tools and their setting up from our AI? Feel free to ask any questions in the following widget.
        </p>
      </div>

      {/* Main Chat Interface */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <RobotIcon />
              <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                AI Powered
              </span>
            </div>
            
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 text-xs text-gray-700 dark:text-gray-200 outline-none focus:border-blue-500"
            >
              {AVAILABLE_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1 font-medium">
              <CheckIcon /> Saved
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              {attemptsRemaining} Attempts
            </span>
            <button
              onClick={handleReset}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Chat History */}
        <div ref={scrollContainerRef} className="h-80 overflow-y-auto p-4 flex flex-col gap-4 relative scroll-smooth">
          {(data.introTextStatement || data.introPrompt) && (
            <div className="flex flex-col gap-4 pb-2 text-gray-800 dark:text-gray-200">
              {data.introTextStatement && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-relaxed">
                  {parse(data.introTextStatement)}
                </div>
              )}
              {data.introPrompt && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-[15px] leading-relaxed [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1">
                  {parse(data.introPrompt)}
                </div>
              )}
            </div>
          )}

          {messages.length === 0 && !data.introTextStatement && !data.introPrompt ? (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm italic">
              Start a conversation...
            </div>
          ) : (
            // Rendered messages to prevent input lag
            renderedMessages
          )}
          {loading && (
            <div className="bg-gray-100 dark:bg-gray-800 text-gray-500 self-start rounded-lg rounded-bl-none px-4 py-3 text-sm flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              Thinking...
            </div>
          )}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 self-center rounded-lg px-4 py-2 text-sm text-center">
              {error}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Write a response"
              disabled={!canChat || loading}
              className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 py-1"
            />
            <button
              onClick={handleSend}
              disabled={!canChat || loading || !inputValue.trim()}
              className="p-2 text-gray-400 hover:text-blue-500 disabled:opacity-50 disabled:hover:text-gray-400 transition-colors"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
