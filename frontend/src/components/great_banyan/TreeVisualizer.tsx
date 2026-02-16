import React, { useRef, useEffect, useState, useMemo } from 'react';
import { PublicKey } from '@solana/web3.js';
import { BudAccount, findChildBudPda } from './utils';
import { SkyLayer, OceanLayer, SandLayer } from './BeachBackground';
import { useGameCamera } from './useGameCamera';
import './TreeVisualizer.css';

interface TreeVisualizerProps {
    rootBudAddress: PublicKey | null;
    buds: Map<string, BudAccount>;
    onBudSelect: (address: PublicKey) => void;
}

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface NodePosition {
    x: number;
    y: number;
}

interface TreeNodeData {
    address: string;
    depth: number;
    isBloomed: boolean;
    isFruit: boolean;
    isTrunk: boolean;
    // For visual calculation
    restX: number;
    restY: number;
    // Tree structure
    left?: TreeNodeData;
    right?: TreeNodeData;
    // Derived for rendering
    angle: number;  // Angle relative to parent (radians)
    length: number; // Distance from parent
    windInfluence: number; // calculated bottom-up
}

// ------------------------------------------------------------------
// Recursive Component for Tree Segments
// ------------------------------------------------------------------

const RecursiveBranch: React.FC<{
    node: TreeNodeData;
    onSelect: (addr: PublicKey) => void;
    time: number;
    currentWind: number; // Sum of sines
}> = ({ node, onSelect, time, currentWind }) => {

    // Wind Effect Calculation
    // Use the pre-calculated windInfluence (0.0 to 1.0+)
    const influence = node.windInfluence;

    let windRotation = 0;
    if (influence > 0.01 && !node.isTrunk) {
        // Direct Drive from Global Wind
        // We assume 'currentWind' is a force multiplier (-1.0 to 1.0 approx)
        // We scale this by importance/stiffness (influence)
        // Tune this scalar (0.1 radian max deflection per segment?)
        const windForce = currentWind * influence * 0.1;

        // Apply
        windRotation = windForce;
    }

    const rotation = (node.angle * (180 / Math.PI)) + (windRotation * (180 / Math.PI)); // Convert to degrees

    // SVG Line styles
    const strokeWidth = Math.max(2, 20 - (node.depth * 2));
    const woodColor = '#8B5A2B';

    return (
        <div
            className="tree-branch-segment"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transformOrigin: '0 0',
                transform: `rotate(${rotation}deg)`,
                pointerEvents: 'none',
            }}
        >
            {/* 1. Draw the actual branch (Visual) */}
            <div
                style={{
                    position: 'absolute',
                    top: -strokeWidth / 2,
                    left: 0,
                    width: node.length,
                    height: strokeWidth,
                    backgroundColor: woodColor,
                    borderRadius: strokeWidth,
                    pointerEvents: 'auto',
                }}
            />

            {/* 2. Draw the Node */}
            <div
                className={`tree-node ${node.isFruit ? 'node-fruit' : node.isBloomed ? 'node-bloomed' : 'node-leaf'}`}
                style={{
                    position: 'absolute',
                    left: node.length,
                    top: 0,
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    zIndex: 10 + node.depth,
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(new PublicKey(node.address));
                }}
                title={`Depth: ${node.depth}\nInfluence: ${node.windInfluence.toFixed(3)}\n${node.address}`}
            />

            {/* 3. Render Children */}
            <div style={{
                position: 'absolute',
                left: node.length,
                top: 0,
            }}>
                {node.left && <RecursiveBranch node={node.left} onSelect={onSelect} time={time} currentWind={currentWind} />}
                {node.right && <RecursiveBranch node={node.right} onSelect={onSelect} time={time} currentWind={currentWind} />}
            </div>
        </div>
    );
};


// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
    rootBudAddress,
    buds,
    onBudSelect
}) => {
    const [treeRoot, setTreeRoot] = useState<TreeNodeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [time, setTime] = useState(0);

    // Camera setup
    const { camera, setCamera, containerRef, handleMouseDown } = useGameCamera({
        initialScale: 0.8,
        initialX: 0,
        initialY: 0,
        minScale: 0.1,
        maxScale: 5,
        worldBounds: { minX: -2500, maxX: 2500, maxY: 100 }
    });

    // Animation Loop for Wind
    useEffect(() => {
        let animationFrameId: number;
        const animate = (now: number) => {
            setTime(now);
            animationFrameId = requestAnimationFrame(animate);
        };
        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    // Handle Resize & Initial Center
    useEffect(() => {
        if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            setContainerSize({ width: clientWidth, height: clientHeight });
            if (camera.x === 0 && camera.y === 0) {
                setCamera(prev => ({
                    ...prev,
                    x: clientWidth / 2,
                    y: clientHeight - 100
                }));
            }
        }
    }, [containerRef, setCamera]);

    // Build the Tree Structure
    useEffect(() => {
        if (!rootBudAddress) {
            setLoading(false);
            return;
        }

        // 1. Calculate Absolute Positions (Same as original layout logic)
        const levels: PublicKey[][] = [];
        const nodePositions = new Map<string, NodePosition>();
        const queue: { address: PublicKey, depth: number }[] = [{ address: rootBudAddress, depth: 0 }];
        const levelHeight = 120;
        const SPACING = 80;

        // BFS for Levels
        // We also need to track how many nodes in each level are "solved" (bloomed)
        // to determine if a level should be a "trunk".
        const levelStats: { total: number, solved: number }[] = [];

        // Note: queue items contain { address, depth }
        // We need to initialize levelStats[depth] before using it
        // The queue initially has the root at depth 0.
        levelStats[0] = { total: 0, solved: 0 };

        while (queue.length > 0) {
            const { address, depth } = queue.shift()!;

            if (!levels[depth]) levels[depth] = [];
            levels[depth].push(address);

            // Ensure stats exist for this level (BFS ensures we reach depth in order, but safe to check)
            if (!levelStats[depth]) levelStats[depth] = { total: 0, solved: 0 };

            levelStats[depth].total++;

            // Check if this node is solved (bloomed)
            const bud = buds.get(address.toString());
            if (bud && bud.isBloomed) {
                levelStats[depth].solved++;

                const [left] = findChildBudPda(address, 'left');
                const [right] = findChildBudPda(address, 'right');

                // Prepare next level stats if not exist
                if (!levelStats[depth + 1]) levelStats[depth + 1] = { total: 0, solved: 0 };

                queue.push({ address: left, depth: depth + 1 });
                queue.push({ address: right, depth: depth + 1 });
            }
        }

        // Assign Absolute Positions (Center justified)
        // Apply "Trunk" logic:
        // A level is a "trunk" if:
        // 1. It is fully solved (all nodes bloomed).
        // 2. The *next* level (depth + 1) is at least 75% solved.
        levels.forEach((levelNodes, depth) => {
            const stats = levelStats[depth];
            const nextStats = levelStats[depth + 1];

            let isTrunk = false;
            // Condition: current level fully solved
            if (stats && stats.solved === stats.total && stats.total > 0) {
                // Condition: next level >= 75% solved
                // If there is no next level (top of tree), it's not a trunk (it's the canopy)
                if (nextStats && nextStats.total > 0) {
                    const nextRatio = nextStats.solved / nextStats.total;
                    if (nextRatio >= 0.75) {
                        isTrunk = true;
                    }
                }
            }

            // Trunk layers get tight spacing (clumping)
            // Normal layers get standard spacing
            const spacing = isTrunk ? 20 : SPACING;

            const count = levelNodes.length;
            const levelWidth = (count - 1) * spacing;
            const startX = -levelWidth / 2;
            const y = depth * levelHeight;

            levelNodes.forEach((nodeAddr, index) => {
                const x = startX + (index * spacing);
                // Store isTrunk info in the position map (or a separate map) 
                // Hack: We can just use a separate Set for trunk depths since all nodes at depth X share status
                nodePositions.set(nodeAddr.toString(), { x, y });
            });
        });

        // Helper: Identify trunk depths
        const trunkDepths = new Set<number>();
        levels.forEach((_, depth) => {
            const stats = levelStats[depth];
            const nextStats = levelStats[depth + 1];
            if (stats && stats.solved === stats.total && stats.total > 0 &&
                nextStats && nextStats.total > 0 && (nextStats.solved / nextStats.total) >= 0.75) {
                trunkDepths.add(depth);
            }
        });

        // 2. Build Recursive Tree Data with Relative Transforms
        const buildNodeData = (address: PublicKey): TreeNodeData | undefined => {
            const addrStr = address.toString();
            const pos = nodePositions.get(addrStr);
            if (!pos) return undefined;

            const bud = buds.get(addrStr);
            let leftNode: TreeNodeData | undefined;
            let rightNode: TreeNodeData | undefined;

            if (bud && bud.isBloomed) {
                const [leftAddr] = findChildBudPda(address, 'left');
                const [rightAddr] = findChildBudPda(address, 'right');
                leftNode = buildNodeData(leftAddr);
                rightNode = buildNodeData(rightAddr);
            }

            const currentDepth = pos.y / levelHeight;

            return {
                address: addrStr,
                depth: currentDepth,
                isBloomed: bud?.isBloomed ?? false,
                isFruit: bud?.isFruit ?? false,
                isTrunk: trunkDepths.has(currentDepth), // New property
                restX: pos.x,
                restY: pos.y,
                left: leftNode,
                right: rightNode,

                angle: 0,
                length: 0,
                windInfluence: 0 // Will calculate later
            };
        };

        // Helper to populate angles/lengths (Top-Down)
        const populateGeometry = (
            node: TreeNodeData,
            parentX: number,
            parentY: number,
            parentGlobalAngle: number
        ): TreeNodeData => {
            const myX = node.restX;
            const myY = node.restY;

            // Vector from Parent to Me
            // Screen Coords: Parent(parentX, -parentY) -> Me(myX, -myY)
            const dx = myX - parentX;
            const dy = (-myY) - (-parentY);

            const length = Math.sqrt(dx * dx + dy * dy);
            const globalAngle = Math.atan2(dy, dx);

            // Relative Angle
            const angle = globalAngle - parentGlobalAngle;

            const newNode: TreeNodeData = {
                ...node,
                angle,
                length
            };

            if (node.left) newNode.left = populateGeometry(node.left, myX, myY, globalAngle);
            if (node.right) newNode.right = populateGeometry(node.right, myX, myY, globalAngle);

            return newNode;
        }

        // Calculate Wind Influence (Bottom-Up)
        const calculateWindInfluence = (node: TreeNodeData): number => {
            // Base case: Leaf (no children)
            if (!node.left && !node.right) {
                node.windInfluence = 1.0;
                return 1.0;
            }

            let totalChildForce = 0;
            if (node.left) totalChildForce += calculateWindInfluence(node.left);
            if (node.right) totalChildForce += calculateWindInfluence(node.right);

            // Decay
            // User requested 66% reduction per level -> 0.34 retention.
            let myInfluence = totalChildForce * 0.34;

            // Cutoff
            if (myInfluence < 0.01) myInfluence = 0;

            node.windInfluence = myInfluence;
            return myInfluence;
        }

        // Build Raw Tree
        const rawRoot = buildNodeData(rootBudAddress);

        if (rawRoot) {
            // Orientation Fix:
            // Root is at (0,0). 
            // We want the coordinate system to start neutral (Right).
            // Parent angle = 0.
            const processedRoot = populateGeometry(rawRoot, 0, 0, 0);

            // Calculate physics
            calculateWindInfluence(processedRoot);

            setTreeRoot(processedRoot);
        }

        setLoading(false);

    }, [rootBudAddress, buds]);

    // Parallax
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;
    const sandX = (camera.x - centerX) * 0.1;

    const handleRecenter = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            setCamera({
                x: clientWidth / 2,
                y: clientHeight - 100,
                scale: 0.8
            });
        }
    };

    const t = time / 1000;
    const w1 = Math.sin((t / 13) * 2 * Math.PI) * 0.2;
    const w2 = Math.sin((t / 8) * 2 * Math.PI) * 0.1;
    const w3 = Math.sin((t / 5) * 2 * Math.PI) * 0.1;
    const w4 = Math.sin((t / 3) * 2 * Math.PI) * 0.1;

    // Total wind force (-1.0 to 1.0 range approx)
    const currentWind = w1 + w2 + w3 + w4;

    return (
        <div
            ref={containerRef}
            className="tree-visualizer-container"
            onMouseDown={handleMouseDown}
            style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', cursor: 'grab' }}
        >
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, transform: `translate3d(${(camera.x - centerX) * 0.01}px, ${(camera.y - centerY) * 0.01}px, 0)` }}>
                <SkyLayer />
            </div>
            <div style={{ position: 'absolute', inset: 0, zIndex: 1, transform: `translate3d(${(camera.x - centerX) * 0.05}px, ${(camera.y - centerY) * 0.05}px, 0)` }}>
                <OceanLayer />
            </div>
            <div style={{ position: 'absolute', bottom: 0, left: '-10%', width: '120%', height: '180px', zIndex: 1, transform: `translate3d(${sandX}px, 0, 0)`, pointerEvents: 'none' }}>
                <SandLayer />
            </div>

            <div
                className="tree-world-viewport"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 2,
                    transformOrigin: '0 0',
                    transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`
                }}
            >
                {/* 
                    TREE ROOT 
                    We position the Root Node at (0,0) of this world space.
                    Since we use recursive transforms, everything flows from here.
                */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 0, height: 0
                }}>
                    {treeRoot && (
                        <>
                            {/* Render Root Node Visual */}
                            <div
                                className={`tree-node ${treeRoot.isFruit ? 'node-fruit' : treeRoot.isBloomed ? 'node-bloomed' : 'node-leaf'}`}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    // transform handled by CSS class .tree-node
                                    zIndex: 10,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onBudSelect(new PublicKey(treeRoot.address));
                                }}
                                title={`Depth: 0\n${treeRoot.address}`}
                            />

                            {/* Render Children (Branches) */}
                            {/* Initial orientation is 0 (Right). Children have relative angles calculated against 0. */}
                            <div style={{
                                position: 'absolute',
                                top: 0, left: 0,
                                // transform: 'rotate(0deg)' // Default
                            }}>
                                {treeRoot.left && <RecursiveBranch node={treeRoot.left} onSelect={onBudSelect} time={time} currentWind={currentWind} />}
                                {treeRoot.right && <RecursiveBranch node={treeRoot.right} onSelect={onBudSelect} time={time} currentWind={currentWind} />}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', pointerEvents: 'none', zIndex: 10 }}>
                <span>Pan: Drag • Zoom: Scroll</span>
                <button
                    onClick={handleRecenter}
                    style={{ pointerEvents: 'auto', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', backdropFilter: 'blur(4px)' }}
                    className="hover:bg-white/30 transition-colors"
                >
                    Recenter
                </button>
            </div>

            {loading && <div className="tree-loading-overlay">Growing Tree...</div>}
        </div>
    );
}
