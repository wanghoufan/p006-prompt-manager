import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许局域网内其他设备访问 dev 服务器与同步接口，
  // 否则 Next 会把非 localhost 来源的请求当作跨域拦截，导致另一台电脑无法同步。
  // 优先用 .local 主机名（不随 DHCP 变化）；同时保留当前 IP 作为兼容。
  allowedDevOrigins: ["192.168.31.197", "zzymima0000deMacBook-Air.local"],
};

export default nextConfig;
