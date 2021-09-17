import type { RunnerFileMap } from './types';
import type { TypeScriptDiagnosticsContainer } from './typescript/index';
import type { Diagnostic } from 'vscode-languageserver';
import type { PathsOutput } from 'fdir';
import {
  getDiagnosticsFromContainer as getTypeScriptDiagnosticsFromContainer,
  createContainer as createTypeScriptContainer
} from './typescript/index';
import {fdir} from 'fdir';
import * as fs from 'fs';

interface Runner {
  files: RunnerFileMap;
  tsContainer: TypeScriptDiagnosticsContainer;
  workspaceRoot: string;
}

export function createRunner(workspaceRoot: string): Runner {
  const files: RunnerFileMap = new Map();
  const tsContainer = createTypeScriptContainer(workspaceRoot, files);

  return {
    files,
    tsContainer,
    workspaceRoot
  };
}

export function addWorkspaceDefinitions(runner: Runner) {
  const files = new fdir()
  .withBasePath()
  .filter((path, isDirectory) => isDirectory || path.endsWith('package.json'))
  .crawl(runner.workspaceRoot)
  .sync() as PathsOutput;

  for(let file of files) {
    addFile(runner, file, fs.readFileSync(file, 'utf-8'));
  }
}

export function addFile(runner: Runner, fileName: string, source: string): void {
  runner.files.set(fileName, {
    fileName,
    source
  });
}

export async function getAllDiagnostics(runner: Runner): Promise<Map<string, Diagnostic[]>> {
  const diagMap = new Map<string, Diagnostic[]>();

  console.time('diagnostics');
  for(const [fileName] of runner.files) {
    const diagnostics = await getTypeScriptDiagnosticsFromContainer(runner.tsContainer, fileName);
    diagMap.set(fileName, diagnostics);
  }
  console.timeEnd('diagnostics');

  return diagMap;
}