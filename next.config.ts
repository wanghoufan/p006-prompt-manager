import type { NextConfig } from "next";
import os from "os";
import type { NetworkInterfaceInfo } from "os";

// 收集本机所有局域网 IPv4 地址。
// 之前把 IP 写死成 192.168.31.197，DHCP 重新分配后变成 192.168.31.60，
// Windows 访问时 Next 会对 /_next/ 下的 dev 资源返回 403
// （HTML 能拿到 200，但脚本全被拦，表现为页面能开却空白 / 不同步）。
// 改成启动时动态取，今后再漂移只需重启 dev 服务，不必改配置。
function getLanIpv4Addresses(): string[] {
  const addresses = new Set<string>();
  const interfaces = os.networkInterfaces();

  for (const list of Object.values(interfaces)) {
    const infos: NetworkInterfaceInfo[] = list ?? [];
    for (const net of infos) {
      // Node 不同版本 family 可能是数字 4 或字符串 "IPv4"，统一转字符串比较
      const family = String(net.family);
      if ((family === "IPv4" || family === "4") && !net.internal) {
        addresses.add(net.address);
      }
    }
  }

  return [...addresses];
}

// GitHub Pages 静态镜像开关：仅 Actions 构建时注入 STATIC_EXPORT=1 + BASE_PATH；
// Docker / 本地开发不设该变量，仍走 standalone，行为保持不变。
const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePath = isStaticExport ? process.env.BASE_PATH ?? "" : "";

const nextConfig: NextConfig = {
  // Docker 使用 Next.js standalone 输出；GitHub Pages 试用版导出纯静态 out/。
  ...(isStaticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : { output: "standalone" as const }),
  ...(basePath ? { basePath } : {}),

  // 允许局域网内其他设备访问 dev 服务器与同步接口，
  // 否则 Next 会把非 localhost 来源的请求当作跨域拦截，导致另一台电脑无法同步。
  // 动态加入当前 LAN IP，.local 主机名作为兜底（需客户端支持 Bonjour）。
  allowedDevOrigins: [
    // 本机回环必须显式列出：getLanIpv4Addresses() 有意排除了 internal 接口，
    // 127.0.0.1 因此不在返回结果里。缺了这两项时用 http://127.0.0.1:PORT 打开，
    // HTML 依然返回 200，但 /_next/ 下的 dev 资源被判 403 —— 表现为页面能开、
    // React 不水合、按钮点了没反应，极易误判成前端 bug。
    "localhost",
    "127.0.0.1",
    ...getLanIpv4Addresses(),
    "zzymima0000deMacBook-Air.local",
  ],
};

export default nextConfig;
