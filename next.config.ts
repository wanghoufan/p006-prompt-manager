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

const nextConfig: NextConfig = {
  // Docker 使用 Next.js standalone 输出，产物只包含生产运行所需的文件。
  // 旧的 /api/sync 与 SSE 路由仍会保留在该产物内，直到云端迁移验收完成。
  output: "standalone",

  // 允许局域网内其他设备访问 dev 服务器与同步接口，
  // 否则 Next 会把非 localhost 来源的请求当作跨域拦截，导致另一台电脑无法同步。
  // 动态加入当前 LAN IP，.local 主机名作为兜底（需客户端支持 Bonjour）。
  allowedDevOrigins: [
    ...getLanIpv4Addresses(),
    "zzymima0000deMacBook-Air.local",
  ],
};

export default nextConfig;
