import * as ts from 'typescript';
import { DocumentSnapshot } from './DocumentSnapshot';
import { ensureRealAstroFilePath, isAstroFilePath, isVirtualAstroFilePath, toRealAstroFilePath } from './utils';

const ignoredDirectories = [
  "node_modules/@types/react"
];
const ignoredDirectoriesExp = new RegExp("(" + ignoredDirectories.map(n => n + "$").join("|") + ")");

/**
 * This should only be accessed by TS Astro module resolution.
 */
export function createAstroSys(getSnapshot: (fileName: string) => DocumentSnapshot) {
  const AstroSys: ts.System = {
    ...ts.sys,
    fileExists(path: string) {
      let doesExist = ts.sys.fileExists(ensureRealAstroFilePath(path));
			console.log('doesExist', path);
      return doesExist;
    },
    directoryExists(path: string) {
      if(ignoredDirectoriesExp.test(path)) {
        return false;
      }
      return ts.sys.directoryExists(path);
    },
    readFile(path: string) {
			console.log('readFile', path);
      if (isAstroFilePath(path) || isVirtualAstroFilePath(path)) {
        console.log('readFile', path);
      }
      const snapshot = getSnapshot(path);
      let text = snapshot.getFullText();
			return text;
    },
    readDirectory(path, extensions, exclude, include, depth) {
      const extensionsWithAstro = (extensions ?? []).concat(...['.astro', '.svelte', '.vue']);
      const result = ts.sys.readDirectory(path, extensionsWithAstro, exclude, include, depth);
			result.map(name => {
				if(name.endsWith('.vue')) {
					return name + '.jsx';
				}
				return name;
			})
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
