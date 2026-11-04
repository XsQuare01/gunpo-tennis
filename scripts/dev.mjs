import { spawn } from 'node:child_process';
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function launch(file, args) {
  const child = spawn(process.execPath, [file, ...args], {
    stdio: 'inherit',
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    windowsHide: true,
  });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code ?? 1); });
}
launch('node_modules/wrangler/bin/wrangler.js', ['dev', '--env', 'local', '--local', '--ip', '127.0.0.1', '--port', '8787']);
launch('node_modules/vite/bin/vite.js', ['--host', '127.0.0.1', '--port', '5173', '--strictPort']);
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
