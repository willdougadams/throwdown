import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';

const ConstructionBanner: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div style={{
            background: `linear-gradient(90deg, ${theme.colors.primary.main}15, ${theme.colors.secondary.main}15)`,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '2rem',
            backdropFilter: 'blur(8px)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Subtle animated background pulse */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(90deg, transparent, ${theme.colors.primary.main}10, transparent)`,
                animation: 'shimmer 3s infinite',
                zIndex: 0
            }} />

            <style>
                {`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}
            </style>

            <div style={{
                backgroundColor: `${theme.colors.secondary.main}20`,
                padding: '0.5rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.secondary.main,
                zIndex: 1
            }}>
                <AlertTriangle size={20} />
            </div>

            <div style={{ zIndex: 1 }}>
                <div style={{
                    color: theme.colors.text.primary,
                    fontWeight: '700',
                    fontSize: '0.95rem',
                    marginBottom: '0.25rem'
                }}>
                    {t('landing.banner.title')}
                </div>
                <div style={{
                    color: theme.colors.text.secondary,
                    fontSize: '0.85rem',
                    lineHeight: '1.4'
                }}>
                    {t('landing.banner.message')}
                </div>
            </div>
        </div>
    );
};

export default ConstructionBanner;
