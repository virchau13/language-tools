import { startServer } from '@astrojs/language-server';

export function run() {
  console.log("HERE I GO!");

  startServer();
}