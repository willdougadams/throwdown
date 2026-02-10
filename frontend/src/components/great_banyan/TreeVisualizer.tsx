import React, { useRef, useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { theme } from '../../theme';
import { BudAccount, findChildBudPda } from './utils';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface TreeVisualizerProps {
    rootBudAddress: PublicKey | null;
    buds: Map<string, BudAccount>;
    onBudSelect: (address: PublicKey) => void;
}

interface NodePosition {
    x: number;
    y: number;
    address: string;
    depth: number;
    isBloomed: boolean;
}

interface Link {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export const TreeVisualizer: React.FC<TreeVisualizerProps> = ({
    rootBudAddress,
    buds,
    onBudSelect
}) => {
    const [nodes, setNodes] = useState<NodePosition[]>([]);
    const [links, setLinks] = useState<Link[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!rootBudAddress) {
            setLoading(false);
            return;
        }

        // Compute Layout
        const computedNodes: NodePosition[] = [];
        const computedLinks: Link[] = [];

        // We traverse purely based on geometric derivation of children addresses
        // We assume the root is at (0, 0) (bottom center)
        // Y decreases (moves up visually) or increases? 
        // Let's say Y=0 is bottom. Y increases upwards.

        // Dimensions
        const levelHeight = 100;

        const traverse = (address: PublicKey, x: number, y: number, spread: number) => {
            const addrStr = address.toString();
            const bud = buds.get(addrStr);

            // Even if bud is not yet fetched, we might want to visualize it if parent said it exists?
            // But we only recurse if bloomed.

            if (bud) {
                computedNodes.push({
                    x,
                    y,
                    address: addrStr,
                    depth: bud.depth,
                    isBloomed: bud.isBloomed
                });

                if (bud.isBloomed) {
                    const [left] = findChildBudPda(address, 'left');
                    const [right] = findChildBudPda(address, 'right');

                    // Recurse
                    // Spread needs to decrease
                    const nextSpread = spread / 1.8;

                    const leftX = x - spread;
                    const rightX = x + spread;
                    const nextY = y + levelHeight;

                    computedLinks.push({ x1: x, y1: y, x2: leftX, y2: nextY });
                    computedLinks.push({ x1: x, y1: y, x2: rightX, y2: nextY });

                    traverse(left, leftX, nextY, nextSpread);
                    traverse(right, rightX, nextY, nextSpread);
                }
            }
        };

        traverse(rootBudAddress, 0, 50, 200);

        setNodes(computedNodes);
        setLinks(computedLinks);
        setLoading(false);

    }, [rootBudAddress, buds]);

    return (
        <div style={{
            width: '100%',
            height: '600px',
            backgroundColor: '#1a1a1a',
            borderRadius: '12px',
            overflow: 'hidden',
            border: `1px solid ${theme.colors.border}`,
            position: 'relative'
        }}>
            <TransformWrapper
                initialScale={1}
                initialPositionX={0}
                initialPositionY={-100} // Start slightly scrolled up?
                centerOnInit={true}
            >
                <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                    <div style={{
                        width: '2000px', // large virtual canvas
                        height: '2000px',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'end', // Align bottom
                        justifyContent: 'center'
                    }}>
                        {/* We offset our calculated system to center of this large canvas */}
                        <div style={{ position: 'absolute', bottom: '100px', left: '50%' }}>

                            {/* Links */}
                            <svg style={{ position: 'absolute', bottom: 0, left: -1000, width: 2000, height: 2000, overflow: 'visible', pointerEvents: 'none' }}>
                                {links.map((link, i) => (
                                    <line
                                        key={i}
                                        x1={link.x1} y1={-link.y1} // Invert Y for SVG relative to bottom? No, SVG coords are top-down.
                                        // Our Y is "height from bottom". 
                                        // In SVG inside this div:
                                        // if we use transform: scale(1, -1) it flips text.
                                        // Let's simplify:
                                        // div is at bottom of large container.
                                        // nodes have `bottom: y`.
                                        // SVG lines need to match.
                                        // x is relative to center.
                                        x2={link.x2} y2={-link.y2}
                                        stroke={theme.colors.border}
                                        strokeWidth="2"
                                    />
                                ))}
                            </svg>

                            {/* Nodes */}
                            {nodes.map(node => (
                                <div
                                    key={node.address}
                                    onClick={() => onBudSelect(new PublicKey(node.address))}
                                    style={{
                                        position: 'absolute',
                                        bottom: node.y,
                                        left: node.x,
                                        width: '40px',
                                        height: '40px',
                                        transform: 'translate(-50%, 50%)', // Center origin
                                        borderRadius: '50%',
                                        backgroundColor: node.isBloomed ? theme.colors.secondary.main : theme.colors.primary.main,
                                        border: '2px solid white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        zIndex: 10,
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                                        color: 'white',
                                        fontWeight: 'bold'
                                    }}
                                    title={node.address}
                                >
                                    {node.depth}
                                </div>
                            ))}

                            {/* Rendering links via divs might be easier than SVG alignment hell if we mix systems */}
                            {links.map((link, i) => {
                                // Calculate length and angle
                                const dx = link.x2 - link.x1;
                                const dy = link.y2 - link.y1;
                                const length = Math.sqrt(dx * dx + dy * dy);
                                const angle = Math.atan2(dy, dx) * 180 / Math.PI;

                                return (
                                    <div
                                        key={`link-${i}`}
                                        style={{
                                            position: 'absolute',
                                            bottom: link.y1,
                                            left: link.x1,
                                            width: length,
                                            height: '2px',
                                            backgroundColor: 'rgba(255,255,255,0.3)',
                                            transformOrigin: '0 50%',
                                            transform: `rotate(${-angle}deg)`, // Rotate needs negation because Y is UP in bottom CSS but DOWN in rotation math usually?
                                            // bottom: y1 means origin is (x1, y1).
                                            // +Y is UP. +X is RIGHT.
                                            // atan2(dy, dx) gives mathematical angle (CCW from X).
                                            // CSS rotate is CW. So -angle.
                                            zIndex: 0
                                        }}
                                    />
                                );
                            })}

                        </div>
                    </div>
                </TransformComponent>
            </TransformWrapper>

            {loading && (
                <div style={{ position: 'absolute', top: 20, left: 20, color: 'white' }}>
                    Loading Tree...
                </div>
            )}
        </div>
    );
}
