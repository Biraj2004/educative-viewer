import React from 'react';
import { DOMNode, Element, attributesToProps, domToReact, HTMLReactParserOptions } from 'html-react-parser';

export function interceptLightBackgrounds(domNode: Element, options: HTMLReactParserOptions) {
  if (domNode.attribs && domNode.attribs.style) {
    const styleStr = domNode.attribs.style;
    const bgMatch = styleStr.match(/(?:^|;)\s*background(?:-color)?:\s*([^;]+)(?:;|$)/i);
    if (bgMatch) {
      const colorStr = bgMatch[1].trim();
      let isLight = false;
      
      const rgbMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/i);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (luminance > 0.8) isLight = true;
      } else {
        const hexMatch = colorStr.match(/#([0-9a-f]{6}|[0-9a-f]{3})/i);
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
        let newStyleStr = styleStr.replace(/(?:^|;)\s*background(?:-color)?:\s*[^;]+(;|$)/i, ';');
        newStyleStr = newStyleStr.replace(/^;\s*/, '').trim();
        const newAttribs = { ...domNode.attribs, style: newStyleStr };
        const props = attributesToProps(newAttribs);
        
        props.className = ((props.className || '') + ' bg-[var(--inline-bg)] dark:!bg-white/5').trim();
        if (!props.style) props.style = {};
        props.style['--inline-bg'] = colorStr;

        return React.createElement(
          domNode.name,
          props,
          domToReact(domNode.children as DOMNode[], options)
        );
      }
    }
  }
  return undefined;
}

export function interceptKeyword(domNode: Element, options: HTMLReactParserOptions) {
  if (domNode.name === 'keyword') {
    const wordNode = domNode.children.find((c): c is Element => c instanceof Element && c.name === 'word');
    const meaningNode = domNode.children.find((c): c is Element => c instanceof Element && c.name === 'meaning');

    if (wordNode && meaningNode) {
      return (
        <span className="relative inline-block group cursor-help" tabIndex={0}>
          <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-200 font-medium px-0.5 rounded border-b border-yellow-400 dark:border-yellow-700">
            {domToReact(wordNode.children as DOMNode[], options)}
          </span>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-10 hidden group-hover:block group-focus-within:block text-xs leading-relaxed pointer-events-none">
            <span className="relative block bg-gray-900 dark:bg-gray-800 text-white rounded p-2 w-max max-w-xs break-words shadow-xl">
              {domToReact(meaningNode.children as DOMNode[], options)}
              <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800"></span>
            </span>
          </span>
        </span>
      );
    }
  }
  return undefined;
}
