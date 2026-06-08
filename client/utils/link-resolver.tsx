import React from "react";
import { DOMNode, Element, domToReact, HTMLReactParserOptions } from "html-react-parser";
import InternalLink from "@/components/topic-details/InternalLink";

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
      if (relativePath.startsWith("/edpresso/")) {
        relativePath = "/answers/" + relativePath.substring("/edpresso/".length);
      }
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
