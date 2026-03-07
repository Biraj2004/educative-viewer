import { EDU_BASE } from './constants';

/**
 * Prepares an SVG string for inline HTML rendering:
 *  1. Strips <?xml?> declaration and <!DOCTYPE> — invalid tokens in HTML documents.
 *  2. Rewrites relative image href paths to absolute URLs via EDU_BASE.
 */
export function prepareSvg(svgString: string): string {
    let svg = svgString
        .replace(/<\?xml[^?]*\?>/g, '')
        .replace(/<!DOCTYPE[^>]*>/g, '');
    svg = svg.replace(/((?:xlink:)?href=")(\/[^"]+)/g, `$1${EDU_BASE}$2`);
    return svg;
}
