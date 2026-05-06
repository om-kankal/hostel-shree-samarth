import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting Shree Samarth PG Management System...\n');

const backend = spawn('node', ['start-backend.js'], {
  cwd: __dirname,
  stdio: 'inherit',
});

backend.on('error', (err) => {
  console.error('Failed to start backend:', err);
  process.exit(1);
});

backend.on('close', (code) => {
  console.log(`Backend exited with code ${code}`);
});

setTimeout(() => {
  console.log('Starting frontend server...\n');

  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit',
  });

  frontend.on('error', (err) => {
    console.error('Failed to start frontend:', err);
    process.exit(1);
  });

  frontend.on('close', (code) => {
    console.log(`Frontend exited with code ${code}`);
  });
}, 2000);

process.on('SIGINT', () => {
  console.log('\nShutting down servers gracefully...');
  backend.kill('SIGTERM');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down servers gracefully...');
  backend.kill('SIGTERM');
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});
