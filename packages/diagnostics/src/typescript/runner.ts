import { isVirtualAstroFilePath, LanguageServiceContainer } from '@astrojs/ts-tools';
import type { RunnerFileMap } from '../types';
import {
  astro2tsx,
  createLanguageService,
  ensureRealAstroFilePath,
  toVirtualAstroFilePath,
  isAstroFilePath
} from '@astrojs/ts-tools';
import { pathToFileURL } from 'url';
import { getDiagnostics } from './diagnostics';
import { ScriptKind } from 'typescript';

export interface TypeScriptDiagnosticsContainer {
  als: LanguageServiceContainer,
  getTextForFile(fileName: string): string;
}

function createSnapshot(source: string) {
  return {
    version: 1,
    getText(_start: number, _end: number) {
      return source;
    },
    getLength() {
      return source.length;
    },
    getChangeRange() {
      return undefined;
    }
  }
}

export function createContainer(workspaceRoot: string, files: RunnerFileMap): TypeScriptDiagnosticsContainer {
  const tsxCache = new Map<string, string>();

  function getTextForFile(origFileName: string): string {
    let fileName = origFileName;
    if(isVirtualAstroFilePath(fileName)) {
      fileName = ensureRealAstroFilePath(fileName);
    }
    if(!files.has(fileName)) {
      console.log('couldnt find', fileName);
      return '';
    }
    if(isVirtualAstroFilePath(origFileName)) {
      if(tsxCache.has(fileName)) {
        return tsxCache.get(fileName)!;
      }
      let source = files.get(fileName)!.source;
      let tsx = astro2tsx(source).code;
      tsxCache.set(fileName, tsx);
      return tsx;
    }
    let source = files.get(fileName)!.source;
    return source;
  }

  let tsConfigPath = new URL('./tsconfig.json', pathToFileURL(workspaceRoot)).pathname;

  const als = createLanguageService(tsConfigPath, workspaceRoot, {
    getScriptFileNames() {
      const astroFileNames = Array.from(files.keys());
      const astroTsxFileNames = astroFileNames.map(fileName => toVirtualAstroFilePath(fileName));
      return astroTsxFileNames;
    },
    getTextForFile,
    getScriptSnapshot(fileName: string) {
      let source = getTextForFile(fileName);
      let snapshot = createSnapshot(source);
      return snapshot;
    }
  });

  return {
    als,
    getTextForFile
  };
}

export async function getDiagnosticsFromContainer(container: TypeScriptDiagnosticsContainer, filePath: string) {
  const lang = container.als.getService();
  const diagnostics = await getDiagnostics(filePath, lang, {
    parserError: null,
    scriptKind: ScriptKind.TSX,
    getFullText() {
      return container.getTextForFile(filePath);
    }
  });
  return diagnostics;
}

