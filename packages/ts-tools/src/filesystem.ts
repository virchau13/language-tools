import * as ts from 'typescript';
import {
  ensureRealAstroFilePath,
  isAstroFilePath,
  isVirtualAstroFilePath,
  toRealAstroFilePath
} from './utils';

export interface FileSystemOptions {
  getTextForFile(fileName: string): string;
}

/**
 * This should only be accessed by TS Astro module resolution.
 */
export function createFileSystem({ getTextForFile }: FileSystemOptions) {
  const AstroSys: ts.System = {
    ...ts.sys,
    fileExists(path: string) {
      let doesExist = ts.sys.fileExists(ensureRealAstroFilePath(path));
      return doesExist;
    },
    readFile(path: string) {
      if (isAstroFilePath(path) || isVirtualAstroFilePath(path)) {
        console.log('readFile', path);
      }
      return getTextForFile(path);
    },
    readDirectory(path, extensions, exclude, include, depth) {
      const extensionsWithAstro = (extensions ?? []).concat(...['.astro', '.svelte', '.vue']);
      const result = ts.sys.readDirectory(path, extensionsWithAstro, exclude, include, depth);
      return result;
    },
  };

  if (ts.sys.realpath) {
    const realpath = ts.sys.realpath;
    AstroSys.realpath = function (path) {
      if (isVirtualAstroFilePath(path)) {
        return realpath(toRealAstroFilePath(path)) + '.ts';
      }
      return realpath(path);
    };
  }

  return AstroSys;
}
