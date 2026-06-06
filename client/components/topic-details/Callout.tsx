import React from 'react';
import { AlertCircle, Info, CheckCircle2, MessageSquare } from 'lucide-react';

export interface CalloutProps {
  type?: string;
  emoji?: string;
  children: React.ReactNode;
}

export default function Callout({ type, emoji, children }: CalloutProps) {
  const typeLower = type?.toLowerCase() || 'message';

  let borderColor = "border-gray-500";
  let bgColor = "bg-gray-800/30";
  let iconColor = "text-gray-400";
  let Icon = MessageSquare;

  // Mapping Educative callout types to Tailwind colors
  if (typeLower === 'warning' || typeLower === 'caution' || typeLower === 'message') {
    // "Message" in Educative often acts as a warning/info hybrid. We'll use orange/brown as seen in the screenshot.
    borderColor = "border-orange-700/80";
    bgColor = "bg-[#2d1b11]"; // Dark orange/brown background
    iconColor = "text-orange-500";
    Icon = AlertCircle;
  } 
  
  if (typeLower === 'note' || typeLower === 'info') {
    borderColor = "border-blue-500";
    bgColor = "bg-[#181c2d]"; // Dark blue background
    iconColor = "text-blue-500";
    Icon = Info;
  } 
  
  if (typeLower === 'tip' || typeLower === 'success') {
    borderColor = "border-green-600";
    bgColor = "bg-[#102416]"; // Dark green background
    iconColor = "text-green-600";
    Icon = CheckCircle2;
  }

  return (
    <div className={`my-6 rounded-md border-l-[3px] p-4 flex gap-3 shadow-sm ${borderColor} ${bgColor}`}>
      <div className={`mt-0.5 shrink-0 ${iconColor}`}>
        {emoji && emoji !== "undefined" ? (
          <span className="text-lg">{emoji}</span>
        ) : (
          <Icon className="w-[18px] h-[18px]" />
        )}
      </div>
      <div className="callout-content text-gray-200 text-[15px] leading-[1.7] w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:mb-3 [&_strong]:text-gray-100">
        {children}
      </div>
    </div>
  );
}
