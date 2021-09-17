import astroDiag from '../dist/index.js';
import t from 'tap';

console.log(astroDiag);

const {
  addFile,
  addWorkspaceDefinitions,
  createRunner,
  getAllDiagnostics
} = astroDiag;

const root = new URL('../../../', import.meta.url);
const runner = createRunner(root.pathname);
addWorkspaceDefinitions(runner);
console.log("FILES", Array.from(runner.files.keys()));
debugger;
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