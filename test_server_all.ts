import { exec } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

console.log('--- Diagnostic Tool: Starting server test ---');

// Terminate any active process running on port 3000 to avoid EADDRINUSE
try {
  const files = fs.readdirSync('/proc');
  for (const file of files) {
    const pid = Number(file);
    if (!isNaN(pid) && pid !== process.pid && pid !== process.ppid) {
      const cmdlinePath = path.join('/proc', file, 'cmdline');
      if (fs.existsSync(cmdlinePath)) {
        const cmdline = fs.readFileSync(cmdlinePath, 'utf8').replace(/\0/g, ' ').trim();
        if (cmdline.includes('node') || cmdline.includes('tsx') || cmdline.includes('vite') || cmdline.includes('server')) {
          console.log(`Killing active server PID: ${pid} (${cmdline})`);
          try { process.kill(pid, 9); } catch (_) {}
        }
      }
    }
  }
} catch (e) {}

setTimeout(() => {
  console.log('Spawning dev server with "npx tsx server.ts"...');
  const server = exec('npx tsx server.ts');

  server.stdout?.on('data', (d) => console.log('[SERVER STDOUT]', d.trim()));
  server.stderr?.on('data', (d) => console.error('[SERVER STDERR]', d.trim()));

  const queryEndpoint = (method: string, pathUrl: string, bodyObj?: any) => {
    return new Promise<void>((resolve) => {
      console.log(`\n--- Requesting [${method}] ${pathUrl} ---`);
      const payload = bodyObj ? JSON.stringify(bodyObj) : '';
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: pathUrl,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload ? Buffer.byteLength(payload) : 0
        }
      }, (res) => {
        console.log(`RESPONSE STATUS: ${res.statusCode}`);
        console.log(`RESPONSE HEADERS:`, res.headers);
        let resBody = '';
        res.on('data', (chunk) => resBody += chunk);
        res.on('end', () => {
          console.log(`RESPONSE BODY: "${resBody}"`);
          resolve();
        });
      });

      req.on('error', (err) => {
        console.error(`REQUEST FAILED: ${err.message}`);
        resolve();
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  };

  // Wait 4 seconds for Vite and Express to fully bind
  setTimeout(async () => {
    await queryEndpoint('GET', '/api/auth/sham-password');
    await queryEndpoint('POST', '/api/auth/login', {
      shopId: 'sham-sweets',
      password: 'ShamSweetsSecure2026!',
      role: 'Owner'
    });
    await queryEndpoint('POST', '/api/auth/login', {
      shopId: 'wrong-shop',
      password: 'wrong',
      role: 'Owner'
    });

    console.log('\nStopping server and clean exit...');
    server.kill();
    process.exit(0);
  }, 4000);
}, 1000);
