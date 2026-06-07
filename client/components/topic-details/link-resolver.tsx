import React from "react";
import { DOMNode, Element, domToReact, HTMLReactParserOptions } from "html-react-parser";
import InternalLink from "./InternalLink";

export function replaceEducativeLink(domNode: Element, options: HTMLReactParserOptions) {
  if (domNode.name !== "a") return undefined;

  const href = domNode.attribs.href || "";
  
  if (href.startsWith("#")) {
    return (
      <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline">
        {domToReact(domNode.children as DOMNode[], options)}
      </a>
    );
  }

  let isEducativeInternalLink = false;
  let isEducativeExternalRedirect = false;
  let relativePath = "";

  try {
    if (href.startsWith("http://") || href.startsWith("https://")) {
      const urlObj = new URL(href);
      const isEduDomain = urlObj.hostname.includes("educative.io");
      const isCurrentDomain = typeof window !== "undefined" && urlObj.hostname === window.location.hostname;

      if (isEduDomain || isCurrentDomain) {
        relativePath = urlObj.pathname + urlObj.search + urlObj.hash;
      }
    } else if (href.startsWith("/")) {
      relativePath = href;
    }

    if (relativePath && relativePath.startsWith("/") && !relativePath.startsWith("/api/")) {
      if (
        relativePath.startsWith("/courses/") ||
        relativePath.startsWith("/lesson/") ||
        relativePath.startsWith("/pal/") ||
        relativePath.startsWith("/module/page/") ||
        relativePath.startsWith("/module/lesson/") ||
        relativePath.startsWith("/interview-prep/") ||
        relativePath.startsWith("/path/") ||
        relativePath.startsWith("/answers/") ||
        relativePath.startsWith("/blog/") ||
        relativePath.startsWith("/newsletter/") ||
        /^\/\d+\/\d+(?:\/\d+)?/.test(relativePath)
      ) {
        isEducativeInternalLink = true;
      } else if (
        relativePath.startsWith("/assessments/") ||
        relativePath.startsWith("/catalog/")
      ) {
        isEducativeExternalRedirect = true;
      }
    }
  } catch (e) {
    // ignore
  }

  if (isEducativeInternalLink) {
    return (
      <InternalLink href={relativePath}>
        {domToReact(domNode.children as DOMNode[], options)}
      </InternalLink>
    );
  } else if (isEducativeExternalRedirect) {
    const targetHref = `https://www.educative.io${relativePath}`;
    return (
      <a href={targetHref} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
        {domToReact(domNode.children as DOMNode[], options)}
      </a>
    );
  } else {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
        {domToReact(domNode.children as DOMNode[], options)}
      </a>
    );
  }
}

export function interceptInlineStyles(domNode: Element) {
  if (domNode.name === "div" && domNode.attribs && domNode.attribs.style) {
    const styleStr = domNode.attribs.style;
    const bgMatch = styleStr.match(/(?:^|;)\s*background-color:\s*([^;]+)(?:;|$)/i);
    if (bgMatch) {
      const colorStr = bgMatch[1].trim();
      let isLight = false;
      
      const rgbMatch = colorStr.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (luminance > 0.8) isLight = true;
      } else {
        const hexMatch = colorStr.match(/#([0-9a-f]{3}|[0-9a-f]{6})/i);
        if (hexMatch) {
          let hex = hexMatch[1];
          if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          if (luminance > 0.8) isLight = true;
        }
      }

      if (isLight) {
        domNode.attribs.style = styleStr.replace(/(?:^|;)\s*background-color:\s*[^;]+(;|$)/i, ';');
        domNode.attribs.style += ` --inline-bg: ${colorStr};`;
        domNode.attribs.class = ((domNode.attribs.class || '') + ' bg-[var(--inline-bg)] dark:!bg-white/5').trim();
      }
    }
  }
}
