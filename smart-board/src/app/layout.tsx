import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智能看板",
  description: "全屏测试任务看板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
