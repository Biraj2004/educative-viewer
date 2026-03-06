export interface SlideData {
    id: number;
    svgBackground: string;
    width: number;
    height: number;
}

export function cleanSvgString(svgString: string): string {
    let cleanedSvg = svgString
        .replace(/<\?xml.*?\?>/g, '')
        .replace(/<!DOCTYPE.*?>/g, '');

    // Fix relative URLs in SVG images
    cleanedSvg = cleanedSvg.replace(
        /(xlink:href=")(\/[^;"]+)/g,
        `$1https://edu.mycourses.workers.dev$2`
    );

    return cleanedSvg;
}

export function parseCanvasAnimation(apiData: any): SlideData[] {
    const slides: SlideData[] = [];

    if (apiData?.actualType === 'CanvasAnimation') {
        const components = apiData?.lazyLoadData?.components || [];
        for (const comp of components) {
            if (comp.type === 'CanvasAnimation') {
                const canvasObjects = comp.content?.canvasObjects || [];
                canvasObjects.forEach((canvasObj: any, index: number) => {
                    slides.push({
                        id: index,
                        svgBackground: canvasObj.svg_string || '',
                        width: canvasObj.width || apiData.width || 710,
                        height: canvasObj.height || apiData.height || 550,
                    });
                });
            }
        }
    }
    return slides;
}
