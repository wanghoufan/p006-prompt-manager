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
        {/* P0-5 首屏主题预置（防 FOUC）：React hydrate 前按 localStorage 设置 + 系统偏好决定主题 class，
            page.tsx hydrate 后按 settings.theme 接管（值一致则幂等，无闪烁）。
            2026-10-11 扩展：主题 class 机制（light / theme-cinnabar / theme-phosphor / theme-blueprint，dark 无 class）；
            支持 ?theme=xxx URL 覆盖，便于预览与测试（不写回设置）。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('prompt-manager:settings')||'{}');var t=s.theme||'system';var q=new URLSearchParams(location.search).get('theme');if(q)t=q;if(t==='system'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}var ok={dark:1,light:1,cinnabar:1,phosphor:1,blueprint:1};if(!ok[t])t='dark';var d=document.documentElement;d.classList.remove('light','theme-cinnabar','theme-phosphor','theme-blueprint');if(t!=='dark'){d.classList.add(t==='light'?'light':'theme-'+t);}}catch(e){var d=document.documentElement;d.classList.remove('light','theme-cinnabar','theme-phosphor','theme-blueprint');}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}