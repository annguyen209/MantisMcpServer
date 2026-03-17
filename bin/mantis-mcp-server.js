#!/usr/bin/env node

try {
  const { startServer } = await import('../dist/server.bundle.js');
  await startServer();
} catch (error) {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('Unable to start mantis-mcp-server because the bundled runtime was not found. Run "npm run build" first.');
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
}
