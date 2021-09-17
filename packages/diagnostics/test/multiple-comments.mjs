import astroDiag from '../dist/index.js';
import t from 'tap';

const {
  addFile,
  createRunner,
  getAllDiagnostics
} = astroDiag;

const root = new URL('../../../', import.meta.url);
console.time('createRunner');
const runner = createRunner(root.pathname);
console.timeEnd('createRunner');

console.time('addFile');
addFile(runner, new URL('./main.astro', root).pathname, `
<html>
  <body class="is-preload">
    <!-- Wrapper -->
    <div id="wrapper">
      <!-- Main -->
      <div id="main"></div>
    </div>
  </body>
</html>
`);
console.timeEnd('addFile');

console.time('getAllDiagnostics');
const [[,diagnostics]] = await getAllDiagnostics(runner);
console.timeEnd('getAllDiagnostics');
t.equal(diagnostics.length, 0, 'No errors found');