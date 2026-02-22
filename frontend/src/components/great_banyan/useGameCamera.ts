import { useState, useCallback, useRef, useEffect } from 'react';

interface CameraState {
    x: number;
    y: number;
    scale: number;
}

interface UseGameCameraProps {
    minScale?: number;
    maxScale?: number;
    initialScale?: number;
    initialX?: number;
    initialY?: number;
}

export const useGameCamera = ({
    minScale = 0.1,
    maxScale = 5,
    initialScale = 1,
    initialX = 0,
    initialY = 0
}: UseGameCameraProps = {}) => {
    const [camera, setCamera] = useState<CameraState>({
        x: initialX,
        y: initialY,
        scale: initialScale
    });

    const isDragging = useRef(false);
    const lastMouse = useRef<{ x: number, y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current || !lastMouse.current) return;

        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;

        const container = containerRef.current;
        const h = container?.clientHeight || 0;

        setCamera(prev => {
            let newY = prev.y + dy;
            
            // Limit how far DOWN the tree can move (Panning UP)
            // Stop once the root hits the bottom 5% of the screen
            const maxY = h * 0.95;
            if (newY > maxY) newY = maxY;

            return {
                ...prev,
                x: prev.x + dx,
                y: newY
            };
        });

        lastMouse.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        lastMouse.current = null;
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomIntensity = 0.1;
            const direction = -Math.sign(e.deltaY);
            const factor = 1 + (zoomIntensity * direction);

            setCamera(prev => {
                let newScale = prev.scale * factor;
                if (newScale < minScale) newScale = minScale;
                if (newScale > maxScale) newScale = maxScale;

                const ratio = newScale / prev.scale;
                const newX = mouseX - (mouseX - prev.x) * ratio;
                let newY = mouseY - (mouseY - prev.y) * ratio;

                // Keep Sky Limit during zoom
                const h = container.clientHeight;
                const maxY = h * 0.95;
                if (newY > maxY) newY = maxY;

                return { x: newX, y: newY, scale: newScale };
            });
        };

        const onMouseMoveGlobal = (e: MouseEvent) => handleMouseMove(e);
        const onMouseUpGlobal = () => handleMouseUp();

        container.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('mousemove', onMouseMoveGlobal);
        window.addEventListener('mouseup', onMouseUpGlobal);

        return () => {
            container.removeEventListener('wheel', onWheel);
            window.removeEventListener('mousemove', onMouseMoveGlobal);
            window.removeEventListener('mouseup', onMouseUpGlobal);
        };
    }, [handleMouseMove, handleMouseUp, maxScale, minScale]);

    return {
        camera,
        setCamera,
        containerRef,
        handleMouseDown,
        isDragging: isDragging.current
    };
};
