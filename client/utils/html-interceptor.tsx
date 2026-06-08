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
