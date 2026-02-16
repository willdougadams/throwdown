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
    worldBounds?: {
        minX: number; // Left edge of world
        maxX: number; // Right edge
        maxY: number; // Bottom depth
        minY?: number; // Top (optional)
    }
}

export const useGameCamera = ({
    minScale = 0.1,
    maxScale = 5,
    initialScale = 1,
    initialX = 0,
    initialY = 0,
    worldBounds
}: UseGameCameraProps = {}) => {
    const [camera, setCamera] = useState<CameraState>({
        x: initialX,
        y: initialY,
        scale: initialScale
    });

    const isDragging = useRef(false);
    const lastMouse = useRef<{ x: number, y: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Constraint logic
    const constrain = useCallback((cam: CameraState, containerW: number, containerH: number): CameraState => {
        if (!worldBounds) return cam;

        let { x, y, scale } = cam;

        // X Bounds:
        // We see world from X_left to X_right.
        // X_left = (0 - CamX) / Scale
        // X_right = (Width - CamX) / Scale

        // Constraint: X_left >= minX  ->  -CamX >= minX * Scale  ->  CamX <= -minX * Scale
        // Constraint: X_right <= maxX ->  Width - CamX <= maxX * Scale -> CamX >= Width - maxX * Scale

        const minCamX = containerW - (worldBounds.maxX * scale);
        const maxCamX = -(worldBounds.minX * scale);

        // Y Bounds:
        // Y_bottom = (Height - CamY) / Scale
        // Constraint: Y_bottom <= maxY -> Height - CamY <= maxY * Scale -> CamY >= Height - maxY * Scale

        const minCamY = containerH - (worldBounds.maxY * scale);

        // We assume Infinite Up (minY not constrained)

        if (x < minCamX) x = minCamX;
        if (x > maxCamX) x = maxCamX;
        if (y < minCamY) y = minCamY;

        return { x, y, scale };
    }, [worldBounds]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging.current || !lastMouse.current) return;

        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;

        const container = containerRef.current;
        const w = container?.clientWidth || 0;
        const h = container?.clientHeight || 0;

        setCamera(prev => constrain({
            ...prev,
            x: prev.x + dx,
            y: prev.y + dy
        }, w, h));

        lastMouse.current = { x: e.clientX, y: e.clientY };
    }, [constrain]);

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
        lastMouse.current = null;
    }, []);

    // Wheel/Zoom Logic attached via ref
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const scaleFactor = 0.001 * -e.deltaY;
            const zoomIntensity = 0.1;
            const direction = -Math.sign(e.deltaY);
            const factor = 1 + (zoomIntensity * direction);

            setCamera(prev => {
                let newScale = prev.scale * factor;
                if (newScale < minScale) newScale = minScale;
                if (newScale > maxScale) newScale = maxScale;

                const ratio = newScale / prev.scale;
                const newX = mouseX - (mouseX - prev.x) * ratio;
                const newY = mouseY - (mouseY - prev.y) * ratio;

                return constrain({ x: newX, y: newY, scale: newScale }, container.clientWidth, container.clientHeight);
            });
        };

        const onMouseMoveGlobal = (e: MouseEvent) => {
            handleMouseMove(e);
        }

        const onMouseUpGlobal = () => {
            handleMouseUp();
        }

        container.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('mousemove', onMouseMoveGlobal);
        window.addEventListener('mouseup', onMouseUpGlobal);

        return () => {
            container.removeEventListener('wheel', onWheel);
            window.removeEventListener('mousemove', onMouseMoveGlobal);
            window.removeEventListener('mouseup', onMouseUpGlobal);
        };
    }, [handleMouseMove, handleMouseUp, maxScale, minScale, constrain]);

    return {
        camera,
        setCamera,
        containerRef,
        handleMouseDown,
        isDragging: isDragging.current
    };
};
