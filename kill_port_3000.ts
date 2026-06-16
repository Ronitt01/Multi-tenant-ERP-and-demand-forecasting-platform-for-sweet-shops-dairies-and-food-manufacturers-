import { execSync } from 'child_process';

console.log('Attempting to find and kill any process on port 3000...');

try {
  // Using standard Unix / Linux commands to kill process on port 3000
  console.log('Method 1: fuser');
  execSync('fuser -k 3000/tcp', { stdio: 'inherit' });
  console.log('Fuser executed successfully.');
} catch (e: any) {
  console.log('Fuser method warning or skipped:', e.message);
}

try {
  console.log('Method 2: heroku-like fork of lsof + kill');
  const stdout = execSync('lsof -t -i:3000', { encoding: 'utf8' }).trim();
  if (stdout) {
    const pids = stdout.split('\n');
    console.log(`Found PIDs on port 3000: ${pids.join(', ')}`);
    for (const pid of pids) {
      if (pid && Number(pid) !== process.pid) {
        console.log(`Killing PID ${pid}...`);
        execSync(`kill -9 ${pid}`);
      }
    }
  } else {
    console.log('No PIDs found via lsof.');
  }
} catch (e: any) {
  console.log('Lsof method warning or skipped:', e.message);
}

console.log('Done cleaning up port 3000.');
