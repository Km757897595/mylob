'use client';

import 'antd/dist/reset.css';

import { ConfigProvider, ThemeProvider } from '@lobehub/ui';
import { App } from 'antd';
import * as motion from 'motion/react-m';
import Link from 'next/link';
import { memo, type PropsWithChildren, useEffect, useState } from 'react';

import AntdStaticMethods from '@/components/AntdStaticMethods';
import { useIsDark } from '@/hooks/useIsDark';
import Image from '@/libs/next/Image';

interface AuthThemeLiteProps extends PropsWithChildren {
  globalCDN?: boolean;
}

const AuthThemeLite = memo<AuthThemeLiteProps>(({ children, globalCDN }) => {
  const [mounted, setMounted] = useState(false);
  const isDark = useIsDark();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Avoid hydration mismatch: on server and first client render, appearance is
  // undefined so ThemeProvider falls back to defaultAppearance ('light').
  // After mount, the controlled value kicks in with the real theme from next-themes.
  const currentAppearance = isDark ? 'dark' : 'light';

  return (
    <ThemeProvider
      appearance={mounted ? currentAppearance : undefined}
      className={'auth-layout'}
      defaultAppearance={'light'}
      style={{ height: '100%' }}
      theme={{
        cssVar: { key: 'lobe-vars' },
      }}
    >
      <App style={{ height: '100%' }}>
        <AntdStaticMethods />
        <ConfigProvider
          motion={motion}
          config={{
            aAs: Link,
            imgAs: Image,
            imgUnoptimized: true,
            proxy: globalCDN ? 'unpkg' : undefined,
          }}
        >
          {children}
        </ConfigProvider>
      </App>
    </ThemeProvider>
  );
});

AuthThemeLite.displayName = 'AuthThemeLite';

export default AuthThemeLite;
