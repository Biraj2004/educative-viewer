"use client";
import { useState } from 'react';
import { SlideData } from '@/utils/diagram-parser';
import { SvgRenderer } from './SvgRenderer';

interface Props {
    slides: SlideData[];
}

export function CanvasAnimationViewer({ slides }: Props) {
    const [currentSlide, setCurrentSlide] = useState(0);

    if (!slides || slides.length === 0) return <div className="p-8 text-center text-gray-500">No slides to display.</div>;


    const handleNext = () => {
        if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1);
    };

    const handlePrev = () => {
        if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
            {/* Navigation Controls */}
            <div className="flex items-center justify-between w-full mb-6 px-4">
                <button
                    onClick={handlePrev}
                    disabled={currentSlide === 0}
                    className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                >
                    Previous
                </button>
                <span className="text-lg font-bold text-gray-700 dark:text-gray-300">
                    Slide {currentSlide + 1} of {slides.length}
                </span>
                <button
                    onClick={handleNext}
                    disabled={currentSlide === slides.length - 1}
                    className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                >
                    Next
                </button>
            </div>

            {/* All slides pre-rendered, only active one visible */}
            {slides.map((s, i) => (
                <div
                    key={s.id}
                    className="relative bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden flex justify-center items-center"
                    style={{
                        width: s.width,
                        height: s.height,
                        display: i === currentSlide ? 'flex' : 'none',
                    }}
                >
                    {s.svgBackground && (
                        <div className="absolute inset-0 z-0">
                            <SvgRenderer svgString={s.svgBackground} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
