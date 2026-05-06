import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const candidates = process.platform === 'win32'
  ? [
      { command: 'py', args: ['server/app.py'] },
      { command: 'python', args: ['server/app.py'] },
      { command: 'python3', args: ['server/app.py'] },
    ]
  : [
      { command: 'python3', args: ['server/app.py'] },
      { command: 'python', args: ['server/app.py'] },
    ];

function startBackend(index = 0) {
  const candidate = candidates[index];
  if (!candidate) {
    console.error('Failed to start backend. Install Python and make sure it is available as py, python, or python3.');
    process.exit(1);
  }

  const child = spawn(candidate.command, candidate.args, {
    cwd: __dirname,
    env: {
      ...process.env,
      FLASK_ENV: 'development',
      FLASK_DEBUG: '1',
    },
    stdio: 'inherit',
  });

  child.on('error', () => {
    startBackend(index + 1);
  });

  child.on('exit', (code, signal) => {
    if ((code === 9009 || code === 1) && index < candidates.length - 1) {
      startBackend(index + 1);
      return;
    }

    if (signal) {
      process.exit(0);
    }
    process.exit(code ?? 0);
  });
}

console.log(`Starting backend from ${join(__dirname, 'server', 'app.py')}`);
startBackend();
