/**
 * Theme system with t-shirt sizes and consistent design tokens
 * Use these variables in your components instead of hardcoded values
 */

export const theme = {
  // Spacing (t-shirt sizes)
  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '1rem',       // 16px
    lg: '1.5rem',     // 24px
    xl: '2rem',       // 32px
    '2xl': '3rem',    // 48px
    '3xl': '4rem',    // 64px
  },

  // Font sizes (t-shirt sizes)
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    md: '1rem',       // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
    '4xl': '2.25rem', // 36px
  },

  // Font weights
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Border radius (t-shirt sizes)
  borderRadius: {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    full: '9999px',   // Fully rounded
  },

  // Shadows
  shadow: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },

  // Z-index layers
  zIndex: {
    base: 0,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },

  // Transitions
  transition: {
    fast: '150ms ease',
    base: '200ms ease',
    slow: '300ms ease',
    slower: '500ms ease',
  },

  // Breakpoints (for media queries)
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Colors (CSS variables - theme-aware)
  colors: {
    // These reference CSS variables defined in your global styles
    // They automatically switch between light/dark themes
    background: 'var(--color-background)',
    surface: 'var(--color-surface)',
    tertiary: 'var(--bg-tertiary)',
    card: 'var(--bg-card)',
    sidebar: 'var(--bg-sidebar)',
    border: 'var(--color-border)',
    borderSecondary: 'var(--border-secondary)',
    text: {
      primary: 'var(--color-text-primary)',
      secondary: 'var(--color-text-secondary)',
      disabled: 'var(--color-text-disabled)',
    },
    primary: {
      main: 'var(--color-primary)',
      hover: 'var(--color-primary-hover)',
      active: 'var(--color-primary-active)',
    },
    secondary: {
      main: 'var(--color-secondary)',
      hover: 'var(--color-secondary-hover)',
    },
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    info: 'var(--color-info)',
  },
} as const;

// Example usage in components:
// style={{ padding: theme.spacing.md }}
// style={{ fontSize: theme.fontSize.lg }}
// style={{ borderRadius: theme.borderRadius.md }}
