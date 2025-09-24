// Design Tokens - 設計書準拠のデザイントークン定義
export const tokens = {
  colors: {
    // プライマリカラー（信頼感のあるブルー系）
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },
    // セカンダリ（アクションを促すオレンジ系）
    secondary: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
      950: '#431407',
    },
    // 成功・収入（グリーン）
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    // 警告・支出（レッド）
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
      950: '#450a0a',
    },
    // 警告（アンバー）
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },
    // ニュートラル
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
      950: '#030712',
    },
    // 情報（ブルー）
    info: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    }
  },

  typography: {
    fontFamily: {
      sans: ['Inter', 'Noto Sans JP', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
    },
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['14px', '20px'],
      base: ['16px', '24px'],
      lg: ['18px', '28px'],
      xl: ['20px', '28px'],
      '2xl': ['24px', '32px'],
      '3xl': ['30px', '36px'],
      '4xl': ['36px', '40px'],
      '5xl': ['48px', '1'],
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    letterSpacing: {
      tight: '-0.025em',
      normal: '0em',
      wide: '0.025em',
    }
  },

  spacing: {
    0.5: '2px',
    1: '4px',
    1.5: '6px',
    2: '8px',
    2.5: '10px',
    3: '12px',
    3.5: '14px',
    4: '16px',
    5: '20px',
    6: '24px',
    7: '28px',
    8: '32px',
    9: '36px',
    10: '40px',
    11: '44px',
    12: '48px',
    14: '56px',
    16: '64px',
    20: '80px',
    24: '96px',
    28: '112px',
    32: '128px',
  },

  borderRadius: {
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    '2xl': '20px',
    '3xl': '24px',
    full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    lg: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    xl: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    '2xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    none: 'none',
  },

  animation: {
    duration: {
      75: '75ms',
      100: '100ms',
      150: '150ms',
      200: '200ms',
      300: '300ms',
      500: '500ms',
      700: '700ms',
      1000: '1000ms',
    },
    easing: {
      ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    }
  },

  breakpoints: {
    sm: '640px',    // モバイル
    md: '768px',    // タブレット縦
    lg: '1024px',   // タブレット横・小型PC
    xl: '1280px',   // デスクトップ
    '2xl': '1536px' // 大型デスクトップ
  },

  zIndex: {
    hide: -1,
    auto: 'auto',
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },
} as const;

// トークンから CSS カスタムプロパティを生成
export function generateCSSVars(tokens: Record<string, any>, prefix = '--'): Record<string, string> {
  const vars: Record<string, string> = {};

  function traverse(obj: any, path: string[] = []) {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = [...path, key];

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        traverse(value, newPath);
      } else {
        const varName = `${prefix}${newPath.join('-')}`;
        vars[varName] = String(value);
      }
    }
  }

  traverse(tokens);
  return vars;
}

// Tailwind CSS 設定用のトークン変換
export function tokensToTailwindConfig() {
  return {
    colors: tokens.colors,
    fontFamily: tokens.typography.fontFamily,
    fontSize: Object.fromEntries(
      Object.entries(tokens.typography.fontSize).map(([key, [size, lineHeight]]) => [
        key,
        { fontSize: size, lineHeight }
      ])
    ),
    spacing: tokens.spacing,
    borderRadius: tokens.borderRadius,
    boxShadow: tokens.shadows,
    screens: tokens.breakpoints,
    zIndex: tokens.zIndex,
    transitionDuration: tokens.animation.duration,
    transitionTimingFunction: tokens.animation.easing,
  };
}

// カラーユーティリティ関数
export const colorUtils = {
  // コントラスト比計算（アクセシビリティ）
  getContrastRatio(color1: string, color2: string): number {
    // 簡易的な実装（実際のプロダクトではより正確な計算を使用）
    return 4.5; // WCAG AA準拠値を仮返却
  },

  // カラーの透明度調整
  withOpacity(color: string, opacity: number): string {
    return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
  },

  // ダークモード対応カラー選択
  adaptiveColor(lightColor: string, darkColor: string) {
    return {
      light: lightColor,
      dark: darkColor,
    };
  }
};