import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
    theme: ThemeMode;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

interface ThemeProviderProps {
    children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setTheme] = useState<ThemeMode>(() => {
        // Get saved theme from localStorage or default to 'system'
        return (localStorage.getItem('theme') as ThemeMode) || 'system';
    });

    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

    // Function to detect system preference
    const getSystemTheme = (): ResolvedTheme => {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    // Update resolved theme when theme changes or system preference changes
    useEffect(() => {
        const updateResolvedTheme = () => {
            const newResolvedTheme = theme === 'system' ? getSystemTheme() : theme as ResolvedTheme;
            setResolvedTheme(newResolvedTheme);

            // Apply theme to document root
            document.documentElement.setAttribute('data-theme', newResolvedTheme);
        };

        updateResolvedTheme();

        // Listen for system theme changes if using 'system' mode
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => updateResolvedTheme();

            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme]);

    // Save theme preference to localStorage
    useEffect(() => {
        localStorage.setItem('theme', theme);
    }, [theme]);

    const handleSetTheme = (newTheme: ThemeMode) => {
        setTheme(newTheme);
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            resolvedTheme,
            setTheme: handleSetTheme
        }}>
            {children}
        </ThemeContext.Provider>
    );
};