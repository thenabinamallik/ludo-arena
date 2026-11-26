import os from 'node:os';
import QRCode from 'qrcode';
import type { LanNetworkInfo } from '@ludo-arena/shared-types';

const VIRTUAL_ADAPTER_PATTERN =
  /(vethernet|virtual|vmware|vbox|hyper-v|wsl|docker|loopback|tailscale|zerotier|hamachi|tun|tap)/i;

function scoreLanAddress(name: string, address: string): number {
  let score = 0;
  if (!VIRTUAL_ADAPTER_PATTERN.test(name)) score += 100;
  if (/^(wi-fi|wifi|wlan|ethernet|eth|en0|en1)/i.test(name)) score += 50;
  if (address.startsWith('192.168.')) score += 30;
  else if (address.startsWith('10.')) score += 20;
  else if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(address)) score += 10;
  return score;
}

export function getLanNetworkInfo(port: number): LanNetworkInfo {
  const interfaces = os.networkInterfaces();
  const candidates: Array<{ name: string; address: string; score: number }> = [];

  for (const [name, list] of Object.entries(interfaces)) {
    if (!list) continue;
    for (const iface of list) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      if (iface.address.startsWith('169.254.')) continue;
      candidates.push({
        name,
        address: iface.address,
        score: scoreLanAddress(name, iface.address),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const addresses = candidates.map((c) => ({
    name: c.name,
    address: c.address,
    url: `http://${c.address}:${port}`,
  }));

  return {
    port,
    hostname: os.hostname(),
    primaryIp: addresses[0]?.address ?? null,
    addresses,
    companionReady: true,
  };
}

export async function generateJoinQrDataUrl(joinUrl: string): Promise<string> {
  return QRCode.toDataURL(joinUrl, {
    width: 320,
    margin: 2,
    color: {
      dark: '#0F172A',
      light: '#FFFFFF',
    },
  });
}
