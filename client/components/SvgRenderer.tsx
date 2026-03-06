import { cleanSvgString } from '@/utils/diagram-parser';

export function SvgRenderer({ svgString }: { svgString: string }) {
    const cleanedSvg = cleanSvgString(svgString);

    return (
        <div
            dangerouslySetInnerHTML={{ __html: cleanedSvg }}
            style={{ display: 'inline-block', width: '100%', height: '100%' }}
        />
    );
}
