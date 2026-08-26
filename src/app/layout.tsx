import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "提示词管理工具",
  description: "本地提示词库：粘贴自动生成标签与标题，复制统计、打星评分、版本回滚、思维总结",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {/* P0-5 首屏主题预置（防 FOUC）：React hydrate 前按 localStorage 设置 + 系统偏好决定亮/暗，
            page.tsx hydrate 后按 settings.theme 接管（值一致则幂等，无闪烁） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('prompt-manager:settings')||'{}');var t=s.theme||'system';var light=t==='light'||(t==='system'&&window.matchMedia('(prefers-color-scheme: light)').matches);document.documentElement.classList.toggle('light',light);}catch(e){document.documentElement.classList.remove('light');}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}