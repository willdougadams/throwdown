import React from 'react';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { Shield, Coins, Rocket, Code2, Globe } from 'lucide-react';

interface SectionProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    color?: string;
}

const Section: React.FC<SectionProps> = ({ title, icon, children, color = theme.colors.primary.main }) => (
    <div style={{
        backgroundColor: theme.colors.card,
        borderRadius: '16px',
        padding: '2rem',
        border: `1px solid ${theme.colors.border}`,
        marginBottom: '2rem',
        transition: 'transform 0.2s, box-shadow 0.2s',
        position: 'relative',
        overflow: 'hidden'
    }}
        onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = `0 12px 30px ${color}15`;
            e.currentTarget.style.borderColor = `${color}40`;
        }}
        onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = theme.colors.border;
        }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '1.5rem'
        }}>
            <div style={{
                backgroundColor: `${color}20`,
                padding: '0.75rem',
                borderRadius: '12px',
                color: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {React.cloneElement(icon as React.ReactElement<any>, { 'aria-hidden': 'true' })}
            </div>
            <h2 style={{
                margin: 0,
                fontSize: '1.75rem',
                fontWeight: '700',
                color: theme.colors.text.primary,
                letterSpacing: '-0.01em'
            }}>
                {title}
            </h2>
        </div>
        <div style={{
            color: theme.colors.text.secondary,
            fontSize: '1.05rem',
            lineHeight: '1.7',
            fontWeight: '400'
        }}>
            {children}
        </div>
    </div>
);

const Feature = ({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) => (
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ color: color, paddingTop: '0.25rem' }}>
            <Icon size={20} aria-hidden="true" />
        </div>
        <div>
            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', color: theme.colors.text.primary }}>{title}</h3>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>{description}</p>
        </div>
    </div>
);

export default function AboutPage() {
    const { t } = useTranslation();
    return (
        <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            padding: '2rem 1rem'
        }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                <h1 style={{
                    fontSize: '3.5rem',
                    fontWeight: '800',
                    marginBottom: '1rem',
                    background: `linear-gradient(135deg, ${theme.colors.primary.main}, ${theme.colors.secondary.main})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.03em'
                }}>
                    {t('about.title')}
                </h1>
                <p style={{
                    fontSize: '1.25rem',
                    color: theme.colors.text.secondary,
                    maxWidth: '600px',
                    margin: '0 auto',
                    lineHeight: '1.6'
                }}>
                    {t('about.subtitle')}
                </p>
            </div>

            {/* Why Blockchain */}
            <Section title={t('about.sections.why_blockchain.title')} icon={<Globe size={28} />} color={theme.colors.primary.main}>
                <p style={{ marginBottom: '2rem' }}>
                    {t('about.sections.why_blockchain.content')}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <Feature
                        icon={Shield}
                        title={t('about.sections.why_blockchain.features.fairness.title')}
                        description={t('about.sections.why_blockchain.features.fairness.description')}
                        color={theme.colors.primary.main}
                    />
                    <Feature
                        icon={Coins}
                        title={t('about.sections.why_blockchain.features.tokens.title')}
                        description={t('about.sections.why_blockchain.features.tokens.description')}
                        color={theme.colors.primary.main}
                    />
                </div>
            </Section>

            {/* About the Developer */}
            <Section title={t('about.sections.developer.title')} icon={<Code2 size={28} />} color={theme.colors.secondary.main}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
                    <div style={{
                        flex: 1,
                        minWidth: '300px'
                    }}>
                        <p style={{ marginTop: 0 }}>
                            {t('about.sections.developer.intro')} <br />

                            {t('about.sections.developer.bio')}
                        </p>
                    </div>
                    <div style={{
                        backgroundColor: `${theme.colors.secondary.main}10`,
                        padding: '1.5rem',
                        borderRadius: '12px',
                        border: `1px solid ${theme.colors.secondary.main}30`,
                    }}>
                        <div style={{ fontSize: '0.85rem', color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>{t('about.sections.developer.skills_title')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontWeight: 'bold', color: theme.colors.text.primary }}>
                            {(t('about.sections.developer.skills_list', { returnObjects: true }) as string[]).map((skill, i) => (
                                <span key={i}>{skill}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </Section>

            {/* Roadmap */}
            <Section title={t('about.sections.roadmap.title')} icon={<Rocket size={28} />} color="#10b981">
                <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                    <div style={{
                        position: 'absolute',
                        left: '7px',
                        top: '10px',
                        bottom: '10px',
                        width: '2px',
                        backgroundColor: '#10b98130'
                    }} role="presentation" />

                    {(t('about.sections.roadmap.phases', { returnObjects: true }) as any[]).map((phase, i, arr) => (
                        <div key={i} style={{ marginBottom: i === arr.length - 1 ? 0 : '2rem', position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '-2rem',
                                top: '4px',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                backgroundColor: i === 0 ? '#10b981' : (i === 1 ? '#10b98180' : '#10b98130'),
                                border: '4px solid ' + theme.colors.card
                            }} />
                            <h3 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text.primary, fontSize: '1.1rem' }}>{phase.title}</h3>
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>{phase.description}</p>
                        </div>
                    ))}
                </div>
            </Section>

            {/* Footer Tagline */}
            <div style={{ textAlign: 'center', marginTop: '4rem', paddingBottom: '2rem' }}>
                <p style={{ color: theme.colors.text.secondary, fontStyle: 'italic', fontSize: '0.9rem' }}>
                    {t('about.footer')}
                </p>
            </div>
        </div>
    );
}
