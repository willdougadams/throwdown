import { Zap, Wind, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

interface StrategySidebarProps {
    isMobile: boolean;
    width?: string;
    paddingLeft?: string;
    borderLeft?: boolean;
}

export function StrategySidebar({
    isMobile,
    width = '280px',
    paddingLeft = '1.5rem',
    borderLeft = true
}: StrategySidebarProps) {
    const { t } = useTranslation();

    if (isMobile) return null;

    return (
        <div style={{
            width: width,
            borderLeft: borderLeft ? `1px solid ${theme.colors.border}` : 'none',
            paddingLeft: paddingLeft,
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            flexShrink: 0
        }}>
            <h3 style={{
                color: theme.colors.text.primary,
                fontSize: theme.fontSize.lg,
                fontWeight: theme.fontWeight.bold,
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                <Sparkles size={20} style={{ color: '#9c27b0' }} />
                {t('rps.game.strategies_label')}
            </h3>

            {(['fury', 'serenity', 'trickery'] as const).map(strategy => {
                const Icon = strategy === 'fury' ? Zap : strategy === 'serenity' ? Wind : Sparkles;
                return (
                    <div key={strategy} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9c27b0' }}>
                            <Icon size={18} fill={strategy === 'fury' ? 'currentColor' : 'none'} />
                            <span style={{ fontWeight: theme.fontWeight.bold, fontSize: theme.fontSize.sm }}>
                                {t(`rps.game.strategy_descriptions.${strategy}_title`)}
                            </span>
                        </div>
                        <p style={{
                            fontSize: '0.8rem',
                            color: theme.colors.text.secondary,
                            lineHeight: '1.4',
                            margin: 0,
                            textAlign: 'left'
                        }}>
                            {t(`rps.game.strategy_descriptions.${strategy}_desc`)}
                        </p>
                    </div>
                )
            })}
        </div>
    );
}
