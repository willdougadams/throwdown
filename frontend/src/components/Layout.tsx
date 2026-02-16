import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { theme } from '../theme';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
    forceMobileLayout?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, forceMobileLayout = false }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobileState, setIsMobileState] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobileState(window.innerWidth < 768);
            if (window.innerWidth >= 768 && !forceMobileLayout) {
                setIsSidebarOpen(false); // Close sidebar when switching to desktop
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [forceMobileLayout]);

    const isLayoutMobile = isMobileState || forceMobileLayout;

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <Sidebar
                // If forced mobile layout, respect sidebar open state. 
                // Otherwise if generic desktop, sidebar is always open (true).
                // Actually Sidebar handles its own 'isOpen' prop logic? 
                // Let's see Sidebar: isOpen, isMobile.
                // Sidebar uses 'isMobile' to decide if it renders as fixed overlay or just fixed column.
                // If we pass isMobile={true} to Sidebar, it acts as overlay.
                isOpen={isLayoutMobile ? isSidebarOpen : true}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                isMobile={isLayoutMobile}
            />

            {/* Mobile overlay */}
            {isLayoutMobile && isSidebarOpen && (
                <div
                    onClick={() => setIsSidebarOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 999
                    }}
                />
            )}

            {/* Main Content */}
            <div style={{
                flex: 1,
                marginLeft: isLayoutMobile ? 0 : '240px',
                minHeight: '100vh',
                backgroundColor: theme.colors.sidebar,
                width: '100%',
                maxWidth: '100vw', // Ensure it doesn't exceed viewport
                overflowX: 'hidden' // Prevent horizontal scroll
            }}>
                {/* Mobile menu button */}
                {isLayoutMobile && (
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        style={{
                            position: 'fixed',
                            top: '1rem',
                            left: '1rem',
                            zIndex: 998,
                            padding: '0.5rem',
                            backgroundColor: theme.colors.primary.main,
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                )}

                {/* Page Content */}
                <div style={{ padding: '1rem', paddingTop: isLayoutMobile ? '4rem' : '1rem' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Layout;