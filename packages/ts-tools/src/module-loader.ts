import type { FileSystemOptions } from './filesystem';
import ts from 'typescript';
import { isVirtualAstroFilePath, ensureRealAstroFilePath, getExtensionFromScriptKind } from './utils';
import { createFileSystem } from './filesystem';

/**
 * Caches resolved modules.
 */
class ModuleResolutionCache {
  private cache = new Map<string, ts.ResolvedModule>();

  /**
   * Tries to get a cached module.
   */
  get(moduleName: string, containingFile: string): ts.ResolvedModule | undefined {
    return this.cache.get(this.getKey(moduleName, containingFile));
  }

  /**
   * Caches resolved module, if it is not undefined.
   */
  set(moduleName: string, containingFile: string, resolvedModule: ts.ResolvedModule | undefined) {
    if (!resolvedModule) {
      return;
    }
    this.cache.set(this.getKey(moduleName, containingFile), resolvedModule);
  }

  /**
   * Deletes module from cache. Call this if a file was deleted.
   * @param resolvedModuleName full path of the module
   */
  delete(resolvedModuleName: string): void {
    this.cache.forEach((val, key) => {
      if (val.resolvedFileName === resolvedModuleName) {
        this.cache.delete(key);
      }
    });
  }

  private getKey(moduleName: string, containingFile: string) {
    return containingFile + ':::' + ensureRealAstroFilePath(moduleName);
  }
}

/**
 * Creates a module loader specifically for `.astro` files.
 *
 * The typescript language service tries to look up other files that are referenced in the currently open astro file.
 * For `.ts`/`.js` files this works, for `.astro` files it does not by default.
 * Reason: The typescript language service does not know about the `.astro` file ending,
 * so it assumes it's a normal typescript file and searches for files like `../Component.astro.ts`, which is wrong.
 * In order to fix this, we need to wrap typescript's module resolution and reroute all `.astro.ts` file lookups to .astro.
 *
 * @param compilerOptions The typescript compiler options
 */
export function createModuleLoader(fsOptions: FileSystemOptions, compilerOptions: ts.CompilerOptions) {
  const astroSys = createFileSystem(fsOptions);
  const moduleCache = new ModuleResolutionCache();

  return {
    fileExists: astroSys.fileExists,
    readFile: astroSys.readFile,
    writeFile: astroSys.writeFile,
    readDirectory: astroSys.readDirectory,
    directoryExists: astroSys.directoryExists,
    getDirectories: astroSys.getDirectories,
    realpath: astroSys.realpath,
    deleteFromModuleCache: (path: string) => moduleCache.delete(path),
    resolveModuleNames,
  };

  function resolveModuleNames(moduleNames: string[], containingFile: string): Array<ts.ResolvedModule | undefined> {
    return moduleNames.map((moduleName) => {
      const cachedModule = moduleCache.get(moduleName, containingFile);
      if (cachedModule) {
        return cachedModule;
      }

      const resolvedModule = resolveModuleName(moduleName, containingFile);
      moduleCache.set(moduleName, containingFile, resolvedModule);
      return resolvedModule;
    });
  }

  function resolveModuleName(name: string, containingFile: string): ts.ResolvedModule | undefined {
    // Delegate to the TS resolver first.
    // If that does not bring up anything, try the Astro Module loader
    // which is able to deal with .astro files.
    const tsResolvedModule = ts.resolveModuleName(name, containingFile, compilerOptions, ts.sys).resolvedModule;
    if (tsResolvedModule && !isVirtualAstroFilePath(tsResolvedModule.resolvedFileName)) {
      return tsResolvedModule;
    }

    const astroResolvedModule = ts.resolveModuleName(name, containingFile, compilerOptions, astroSys).resolvedModule;
    if (!astroResolvedModule || !isVirtualAstroFilePath(astroResolvedModule.resolvedFileName)) {
      return astroResolvedModule;
    }

    const resolvedFileName = ensureRealAstroFilePath(astroResolvedModule.resolvedFileName);

    const resolvedastroModule: ts.ResolvedModuleFull = {
      extension: getExtensionFromScriptKind(ts.ScriptKind.TSX),
      resolvedFileName,
    };
    return resolvedastroModule;
  }
}
