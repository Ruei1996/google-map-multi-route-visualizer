import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/maps/ThemeProvider';

export const metadata: Metadata = {
  title: 'RouteCalc — 多路線距離計算與可視化',
  description:
    'Google Maps 多路線距離計算系統：輸入出發點與多個目標地點，即時計算距離與時間並在地圖上同步可視化路線。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <head />
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
