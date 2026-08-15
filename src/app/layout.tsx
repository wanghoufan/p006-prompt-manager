import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "提示词管理工具",
  description: "本地提示词库：粘贴自动生成标签与标题，复制统计、打星评分、版本回滚、思维总结",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}