import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLudoServer } from './app.js';
import { getLanNetworkInfo } from './networking/lan.js';

export * from './app.js';
export * from './networking/lan.js';
export * from './rooms/roomManager.js';
export * from './storage/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidateStaticDirs = [
  path.resolve(__dirname, '../../web/dist'),
  path.resolve(process.cwd(), 'apps/web/dist'),
];
const staticDir = candidateStaticDirs.find((dir) => existsSync(dir));

const isMainModule =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  const port = Number(process.env.PORT || 3001);
  const server = createLudoServer({ port, staticDir });

  server.httpServer.listen(port, '0.0.0.0', () => {
    const lan = getLanNetworkInfo(port);
    console.log('\n======================================================');
    console.log('   LUDO ARENA - Local Companion Service Running');
    console.log('======================================================');
    console.log(`   Host Browser:  http://localhost:${port}`);
    if (lan.primaryIp) {
      console.log(`   LAN Address:   http://${lan.primaryIp}:${port}`);
    }
    if (lan.addresses.length > 1) {
      console.log('   All LAN IPs:');
      for (const addr of lan.addresses) {
        console.log(`     - ${addr.name}: ${addr.url}`);
      }
    }
    console.log(`   Web Static:    ${staticDir ? 'Serving built UI' : 'Dev mode (run Vite on :5173)'}`);
    console.log('======================================================\n');
  });

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
