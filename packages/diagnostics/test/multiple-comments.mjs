import astroDiag from '../dist/index.js';
import t from 'tap';

console.log(astroDiag);

const {
  addFile,
  createRunner,
  getAllDiagnostics
} = astroDiag;

const runner = createRunner('/project');
addFile(runner, '/project/file.astro', `
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

const diagMap = await getAllDiagnostics(runner);

console.log(diagMap);

/*
const { AstroCheck } = als;

let checker = new AstroCheck();

checker.upsertDocument({
  uri: 'file://fake/file.astro',
  text: `
<html>
  <body class="is-preload">
    <!-- Wrapper -->
    <div id="wrapper">
      <!-- Main -->
      <div id="main"></div>
    </div>
  </body>
</html>
`});

let [{diagnostics}] = await checker.getDiagnostics();
t.equal(diagnostics.length, 0, 'No errors found');
*/