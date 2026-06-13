import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import { SupabaseConfigProvider } from '@/lib/supabase-config-inject';
import './globals.css';

export const metadata: Metadata = {
  title: 'VPN 节点配置工具',
  description: '输入节点信息，自动生成协议链接，Base64 编码保存为订阅文件，并生成二维码',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        <SupabaseConfigProvider>
          {isDev && <Inspector />}
          {children}
        </SupabaseConfigProvider>
      </body>
    </html>
  );
}
