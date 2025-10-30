import React from 'react';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { theme as themeConfig } from '../theme';
import { Sun, Moon, Monitor } from 'lucide-react';

const ThemeSelector: React.FC = () => {
    const { theme, setTheme } = useTheme();

    const themes: { value: ThemeMode; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
        { value: 'light', label: 'Light', Icon: Sun },
        { value: 'dark', label: 'Dark', Icon: Moon },
        { value: 'system', label: 'System', Icon: Monitor }
    ];

    return (
        <div style={{
            padding: '0.5rem',
            backgroundColor: themeConfig.colors.card,
            borderRadius: '6px',
            border: `1px solid ${themeConfig.colors.border}`
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '0.4rem'
            }}>
                {themes.map((themeOption) => {
                    const { Icon } = themeOption;
                    return (
                        <button
                            key={themeOption.value}
                            onClick={() => setTheme(themeOption.value)}
                            title={themeOption.label}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '0.5rem 0.25rem',
                                fontSize: '0.7rem',
                                backgroundColor: theme === themeOption.value
                                    ? themeConfig.colors.primary.main
                                    : themeConfig.colors.surface,
                                color: theme === themeOption.value
                                    ? 'white'
                                    : themeConfig.colors.text.primary,
                                border: `1px solid ${theme === themeOption.value
                                    ? themeConfig.colors.primary.main
                                    : themeConfig.colors.border}`,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                margin: 0
                            }}
                            onMouseEnter={(e) => {
                                if (theme !== themeOption.value) {
                                    e.currentTarget.style.backgroundColor = themeConfig.colors.tertiary;
                                    e.currentTarget.style.borderColor = themeConfig.colors.primary.main;
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (theme !== themeOption.value) {
                                    e.currentTarget.style.backgroundColor = themeConfig.colors.surface;
                                    e.currentTarget.style.borderColor = themeConfig.colors.border;
                                }
                            }}
                        >
                            <Icon size={14} />
                            <span style={{ fontSize: '0.65rem', fontWeight: '500', marginTop: '0.2rem' }}>
                                {themeOption.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ThemeSelector;