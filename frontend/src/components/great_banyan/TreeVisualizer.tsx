import React, { useEffect, useState } from 'react';

import { PublicKey } from '@solana/web3.js';
import { BudData } from '../../services/gameClient';
import { findChildBudPda } from './utils';

import { BeachBackground } from './BeachBackground';
import { useGameCamera } from './useGameCamera';
import './TreeVisualizer.css';

interface TreeVisualizerProps {
    rootBudAddress: PublicKey | null;
    buds: Map<string, BudData>;
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
    const influence = node.windInfluence;

    let windRotation = 0;
    if (influence > 0.01 && !node.isTrunk) {
        const windForce = currentWind * influence * 0.1;
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
    const { camera, setCamera, containerRef } = useGameCamera({
        initialScale: 0.8,
        initialX: 0,
        initialY: 0,
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

    // Handle Resize
    useEffect(() => {
        if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            setContainerSize({ width: clientWidth, height: clientHeight });
        }
    }, [containerRef]);

    // Build the Tree Structure
    useEffect(() => {
        if (!rootBudAddress) {
            setLoading(false);
            return;
        }

        // 1. Calculate Absolute Positions
        const levels: PublicKey[][] = [];
        const nodePositions = new Map<string, NodePosition>();
        const queue: { address: PublicKey, depth: number }[] = [{ address: rootBudAddress, depth: 0 }];
        const levelHeight = 120;
        const SPACING = 80;

        const levelStats: { total: number, solved: number }[] = [];
        levelStats[0] = { total: 0, solved: 0 };

        while (queue.length > 0) {
            const { address, depth } = queue.shift()!;

            if (!levels[depth]) levels[depth] = [];
            levels[depth].push(address);

            if (!levelStats[depth]) levelStats[depth] = { total: 0, solved: 0 };
            levelStats[depth].total++;

            const bud = buds.get(address.toString());
            if (bud && bud.isBloomed) {
                levelStats[depth].solved++;
                const [left] = findChildBudPda(address, 'left');
                const [right] = findChildBudPda(address, 'right');
                if (!levelStats[depth + 1]) levelStats[depth + 1] = { total: 0, solved: 0 };
                queue.push({ address: left, depth: depth + 1 });
                queue.push({ address: right, depth: depth + 1 });
            }
        }

        levels.forEach((levelNodes, depth) => {
            const stats = levelStats[depth];
            const nextStats = levelStats[depth + 1];
            let isTrunk = false;
            if (stats && stats.solved === stats.total && stats.total > 0) {
                if (nextStats && nextStats.total > 0) {
                    const nextRatio = nextStats.solved / nextStats.total;
                    if (nextRatio >= 0.75) {
                        isTrunk = true;
                    }
                }
            }

            const spacing = isTrunk ? 20 : SPACING;
            const count = levelNodes.length;
            const levelWidth = (count - 1) * spacing;
            const startX = -levelWidth / 2;
            const y = depth * levelHeight;

            levelNodes.forEach((nodeAddr, index) => {
                const x = startX + (index * spacing);
                nodePositions.set(nodeAddr.toString(), { x, y });
            });
        });

        const trunkDepths = new Set<number>();
        levels.forEach((_, depth) => {
            const stats = levelStats[depth];
            const nextStats = levelStats[depth + 1];
            if (stats && stats.solved === stats.total && stats.total > 0 &&
                nextStats && nextStats.total > 0 && (nextStats.solved / nextStats.total) >= 0.75) {
                trunkDepths.add(depth);
            }
        });

        // 2. Build Recursive Tree Data
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
                isTrunk: trunkDepths.has(currentDepth),
                restX: pos.x,
                restY: pos.y,
                left: leftNode,
                right: rightNode,
                angle: 0,
                length: 0,
                windInfluence: 0
            };
        };

        const populateGeometry = (
            node: TreeNodeData,
            parentX: number,
            parentY: number,
            parentGlobalAngle: number
        ): TreeNodeData => {
            const myX = node.restX;
            const myY = node.restY;
            const dx = myX - parentX;
            const dy = (-myY) - (-parentY);
            const length = Math.sqrt(dx * dx + dy * dy);
            const globalAngle = Math.atan2(dy, dx);
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

        const calculateWindInfluence = (node: TreeNodeData): number => {
            if (!node.left && !node.right) {
                node.windInfluence = 1.0;
                return 1.0;
            }

            let totalChildForce = 0;
            if (node.left) totalChildForce += calculateWindInfluence(node.left);
            if (node.right) totalChildForce += calculateWindInfluence(node.right);

            let myInfluence = totalChildForce * 0.34;
            if (myInfluence < 0.01) myInfluence = 0;

            node.windInfluence = myInfluence;
            return myInfluence;
        }

        const rawRoot = buildNodeData(rootBudAddress);

        if (rawRoot) {
            const processedRoot = populateGeometry(rawRoot, 0, 0, 0);
            calculateWindInfluence(processedRoot);
            setTreeRoot(processedRoot);

            // 3. Auto-size View
            if (nodePositions.size > 0 && containerSize.width > 0) {
                let minX = 0, maxX = 0, minY = 0, maxY = 0;
                nodePositions.forEach((pos) => {
                    if (pos.x < minX) minX = pos.x;
                    if (pos.x > maxX) maxX = pos.x;
                    if (pos.y < minY) minY = pos.y;
                    if (pos.y > maxY) maxY = pos.y;
                });

                const padding = 60;
                const treeWidth = maxX - minX + padding * 2;
                const treeHeight = maxY - minY + padding * 2;

                // Constraints:
                // Tree fits in top 85% (Sky + Ocean).
                // Root anchored at 92.5% (center of 15% sand).
                const rootYFloor = containerSize.height * 0.925;
                const skyOceanHeight = containerSize.height * 0.85;
                const availableHeight = skyOceanHeight - 40; // top padding

                const scaleX = containerSize.width / treeWidth;
                const scaleY = availableHeight / treeHeight;
                const newScale = Math.min(scaleX, scaleY, 1.0);

                const worldCenterX = (minX + maxX) / 2;

                setCamera({
                    x: containerSize.width / 2 - (worldCenterX * newScale),
                    y: rootYFloor,
                    scale: newScale
                });
            }
        }

        setLoading(false);

    }, [rootBudAddress, buds, containerSize, setCamera]);

    const t = time / 1000;
    const w1 = Math.sin((t / 13) * 2 * Math.PI) * 0.2;
    const w2 = Math.sin((t / 8) * 2 * Math.PI) * 0.1;
    const w3 = Math.sin((t / 5) * 2 * Math.PI) * 0.1;
    const w4 = Math.sin((t / 3) * 2 * Math.PI) * 0.1;

    const currentWind = w1 + w2 + w3 + w4;

    return (
        <div
            ref={containerRef}
            className="tree-visualizer-container"
        >
            <BeachBackground />

            <div
                className="tree-world-viewport"
                style={{
                    transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
                    transformOrigin: '0 0'
                }}
            >
                <div style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
                    {treeRoot && (
                        <>
                            <div
                                className={`tree-node ${treeRoot.isFruit ? 'node-fruit' : treeRoot.isBloomed ? 'node-bloomed' : 'node-leaf'}`}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    zIndex: 10,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onBudSelect(new PublicKey(treeRoot.address));
                                }}
                                title={`Depth: 0\n${treeRoot.address}`}
                            />

                            <div style={{ position: 'absolute', top: 0, left: 0 }}>
                                {treeRoot.left && <RecursiveBranch node={treeRoot.left} onSelect={onBudSelect} time={time} currentWind={currentWind} />}
                                {treeRoot.right && <RecursiveBranch node={treeRoot.right} onSelect={onBudSelect} time={time} currentWind={currentWind} />}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {loading && <div className="tree-loading-overlay">Growing Tree...</div>}
        </div>
    );
}
