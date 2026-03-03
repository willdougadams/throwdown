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
            padding: '0.25rem 0.5rem',
            backgroundColor: themeConfig.colors.card,
            borderRadius: '8px',
            border: `1px solid ${themeConfig.colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
        }}>
            <div style={{ color: themeConfig.colors.text.secondary, display: 'flex', alignItems: 'center' }}>
                {theme === 'light' && <Sun size={16} />}
                {theme === 'dark' && <Moon size={16} />}
                {theme === 'system' && <Monitor size={16} />}
            </div>
            <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeMode)}
                style={{
                    flex: 1,
                    padding: '0.4rem',
                    fontSize: '0.85rem',
                    backgroundColor: 'transparent',
                    color: themeConfig.colors.text.primary,
                    border: 'none',
                    outline: 'none',
                    cursor: 'pointer',
                    fontWeight: '500'
                }}
            >
                {themes.map((themeOption) => (
                    <option
                        key={themeOption.value}
                        value={themeOption.value}
                        style={{ backgroundColor: themeConfig.colors.card, color: themeConfig.colors.text.primary }}
                    >
                        {themeOption.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default ThemeSelector;