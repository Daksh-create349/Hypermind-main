
import React, { useEffect, useRef, useState } from 'react';

export const CustomCursor = () => {
    // 1. Refs for direct DOM manipulation (high performance)
    const cursorDotRef = useRef<HTMLDivElement>(null);
    const cursorRingRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>();

    // 2. State for hover effects
    const [isHovering, setIsHovering] = useState(false);
    const [isActive, setIsActive] = useState(false); // For click state

    // Mouse position refs
    const mousePos = useRef({ x: 0, y: 0 });
    const ringPos = useRef({ x: 0, y: 0 }); // Trailing position

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            mousePos.current = { x: e.clientX, y: e.clientY };

            // Move dot immediately
            if (cursorDotRef.current) {
                cursorDotRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
            }
        };

        const onMouseDown = () => setIsActive(true);
        const onMouseUp = () => setIsActive(false);

        // Add listeners
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);

        // Hover detection using event delegation (more robust than adding listeners to every element)
        const onMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if target is interactive
            if (
                target.tagName === 'BUTTON' ||
                target.tagName === 'A' ||
                target.tagName === 'INPUT' ||
                target.closest('button') ||
                target.closest('a') ||
                target.classList.contains('clickable') ||
                window.getComputedStyle(target).cursor === 'pointer'
            ) {
                setIsHovering(true);
            } else {
                setIsHovering(false);
            }
        };

        window.addEventListener('mouseover', onMouseOver);

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('mouseover', onMouseOver);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    // 3. Animation Loop for the trailing ring
    useEffect(() => {
        const animateRing = () => {
            // Linear interpolation for smooth trailing
            // 0.15 = easing factor (lower is slower/smoother)
            ringPos.current.x += (mousePos.current.x - ringPos.current.x) * 0.15;
            ringPos.current.y += (mousePos.current.y - ringPos.current.y) * 0.15;

            if (cursorRingRef.current) {
                cursorRingRef.current.style.transform = `translate(${ringPos.current.x}px, ${ringPos.current.y}px)`;
            }

            requestRef.current = requestAnimationFrame(animateRing);
        };

        requestRef.current = requestAnimationFrame(animateRing);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return (
        <>
            {/* Global style to hide default cursor */}
            <style>
                {`
                    body, a, button, inputElement, [role="button"] {
                        cursor: none !important;
                    }
                    /* Ensure cursor sits above everything but doesn't block clicks */
                    .custom-cursor {
                        pointer-events: none;
                        z-index: 9999;
                        position: fixed;
                        top: 0;
                        left: 0;
                    }
                `}
            </style>

            {/* Trailing Ring */}
            <div
                ref={cursorRingRef}
                className={`custom-cursor rounded-full border border-white/80 transition-all duration-200 ease-out will-change-transform
                    ${isHovering ? 'w-12 h-12 -ml-6 -mt-6 border-white bg-white/10 backdrop-blur-[1px]' : 'w-8 h-8 -ml-4 -mt-4 border-white/50 bg-transparent'}
                    ${isActive ? 'scale-75' : 'scale-100'}
                `}
            />

            {/* Center Dot */}
            <div
                ref={cursorDotRef}
                className={`custom-cursor rounded-full bg-white transition-all duration-100 ease-out will-change-transform
                    ${isHovering ? 'w-0 h-0 opacity-0' : 'w-2 h-2 -ml-1 -mt-1'}
                `}
            />
        </>
    );
};
