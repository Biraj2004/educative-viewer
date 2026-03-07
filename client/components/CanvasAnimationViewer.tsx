"use client";
import { useState, useEffect } from 'react';
import { prepareSvg } from '@/utils/svg-helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SlideData {
    id: number;
    svgBackground: string;
    width: number;
    height: number;
}

export interface CanvasAnimationData {
    actualType?: string;
    width?: number;
    height?: number;
    lazyLoadData?: {
        components?: Array<{
            type: string;
            content?: {
                canvasObjects?: Array<{
                    svg_string?: string;
                    width?: number;
                    height?: number;
                }>;
            };
        }>;
    };
}

// ─── Parsing ──────────────────────────────────────────────────────────────────
function parseCanvasAnimation(apiData: CanvasAnimationData): SlideData[] {
    const slides: SlideData[] = [];
    if (apiData?.actualType === 'CanvasAnimation') {
        const components = apiData?.lazyLoadData?.components || [];
        for (const comp of components) {
            if (comp.type === 'CanvasAnimation') {
                const canvasObjects = comp.content?.canvasObjects || [];
                canvasObjects.forEach((canvasObj, index) => {
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SvgRenderer({ svgString }: { svgString: string }) {
    return (
        <div
            dangerouslySetInnerHTML={{ __html: prepareSvg(svgString) }}
            style={{ lineHeight: 0, fontSize: 0, display: 'block' }}
        />
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CanvasAnimationViewer({ data }: { data: CanvasAnimationData }) {
    const slides = parseCanvasAnimation(data);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        if (!isFullscreen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isFullscreen]);

    if (!slides || slides.length === 0)
        return <div className="p-8 text-center text-gray-500">No slides to display.</div>;

    return (
        <div className={isFullscreen ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/80' : 'max-w-4xl mx-auto px-6 py-2'}>
            <div className={`bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex flex-col ${isFullscreen ? 'w-full h-full rounded-none' : ''}`}>
                {/* Slide area — all slides pre-rendered so images load immediately */}
                <div style={{ position: 'relative', lineHeight: 0 }}>
                    <style>{`
                        .canvas-slide svg { display: block; }
                    `}</style>
                    {slides.map((slide, idx) => (
                        <div
                            key={idx}
                            className="canvas-slide"
                            style={{ visibility: idx === currentSlide ? 'visible' : 'hidden', height: idx === currentSlide ? 'auto' : 0, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}
                        >
                            {slide.svgBackground && <SvgRenderer svgString={slide.svgBackground} />}
                        </div>
                    ))}
                </div>

                {/* Bottom toolbar */}
                <div className="flex items-center px-4 py-3 border-t border-gray-200 shrink-0">
                    {/* Left: fullscreen + reset */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsFullscreen(f => !f)}
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                            className="text-gray-500 hover:text-gray-800 transition-colors"
                        >
                            {isFullscreen ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4a1 1 0 01-1 1H3m18 0h-4a1 1 0 01-1-1V3m0 18v-4a1 1 0 011-1h4M3 16h4a1 1 0 011 1v4" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M16 4h4v4M4 16v4h4M20 16v4h-4" />
                                </svg>
                            )}
                        </button>
                        <button
                            onClick={() => setCurrentSlide(0)}
                            title="Reset to first slide"
                            className="text-gray-500 hover:text-gray-800 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4.93 14A8 8 0 1 0 6.34 7.34" />
                            </svg>
                        </button>
                    </div>

                    {/* Center: slide counter */}
                    <div className="flex-1 text-center text-sm font-medium text-gray-600">
                        <span className="font-bold text-gray-900">{currentSlide + 1}</span>
                        <span className="mx-1 text-gray-400">/</span>
                        <span>{slides.length}</span>
                    </div>

                    {/* Right: prev + next */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentSlide(s => Math.max(s - 1, 0))}
                            disabled={currentSlide === 0}
                            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setCurrentSlide(s => Math.min(s + 1, slides.length - 1))}
                            disabled={currentSlide === slides.length - 1}
                            className="w-8 h-8 flex items-center justify-center rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

