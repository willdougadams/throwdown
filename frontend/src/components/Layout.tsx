import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { theme } from '../theme';
import { Menu, X } from 'lucide-react';

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
                setIsSidebarOpen(false); // Close sidebar when switching to desktop
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar */}
            <Sidebar
                isOpen={isMobile ? isSidebarOpen : true}
                onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
                isMobile={isMobile}
            />

            {/* Mobile overlay */}
            {isMobile && isSidebarOpen && (
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
                marginLeft: isMobile ? 0 : '240px',
                minHeight: '100vh',
                backgroundColor: theme.colors.sidebar,
                width: '100%'
            }}>
                {/* Mobile menu button */}
                {isMobile && (
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
                <div style={{ padding: '1rem', paddingTop: isMobile ? '4rem' : '1rem' }}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Layout;