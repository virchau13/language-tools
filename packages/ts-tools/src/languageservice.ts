import type { FileSystemOptions } from './filesystem';
import * as ts from 'typescript';
import { basename } from 'path';
import { createModuleLoader } from './module-loader';

export type ScriptSnapshot = ts.IScriptSnapshot & {
  version: number;
}

export interface LanguageServiceHost extends FileSystemOptions {
  getScriptFileNames(): Array<string>;
  getScriptSnapshot(fileName: string): ScriptSnapshot;
}

export interface LanguageServiceContainer {
  getService(): ts.LanguageService;
  onProjectUpdated(): void;
}

export function getParsedCommandLine(tsconfigPath: string, workspaceRoot: string) {
  const parseConfigHost: ts.ParseConfigHost = {
    ...ts.sys,
    readDirectory: (path, extensions, exclude, include, depth) => {
      return ts.sys.readDirectory(path, [...extensions, '.vue', '.svelte', '.astro', '.js', '.jsx'], exclude, include, depth);
    },
  };

  let configJson = (tsconfigPath && ts.readConfigFile(tsconfigPath, ts.sys.readFile).config) || getDefaultJsConfig();
  if (!configJson.extends) {
    configJson = Object.assign(
      {
        exclude: getDefaultExclude(),
      },
      configJson
    );
  }

  // Delete include so that astro files don't get excluded.
  delete configJson.include;

  const existingCompilerOptions: ts.CompilerOptions = {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext
  };

  const project = ts.parseJsonConfigFileContent(configJson, parseConfigHost, workspaceRoot, existingCompilerOptions, basename(tsconfigPath), undefined, [
    { extension: '.vue', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred },
    { extension: '.svelte', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred },
    { extension: '.astro', isMixedContent: true, scriptKind: ts.ScriptKind.Deferred },
  ]);

  return project;
}

export function createLanguageService(tsconfigPath: string, workspaceRoot: string, serviceHost: LanguageServiceHost): LanguageServiceContainer {
  const project = getParsedCommandLine(tsconfigPath, workspaceRoot);
  return createLanguageServiceFromCommandLine(project, workspaceRoot, serviceHost);
}

export function createLanguageServiceFromCommandLine(project: ts.ParsedCommandLine, workspaceRoot: string, serviceHost: LanguageServiceHost): LanguageServiceContainer {
  let projectVersion = 0;

  const moduleLoader = createModuleLoader({
    getTextForFile: serviceHost.getTextForFile
  }, {});

  const host: ts.LanguageServiceHost = {
    getNewLine: () => ts.sys.newLine,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
    readFile: moduleLoader.readFile,
    writeFile: moduleLoader.writeFile,
    fileExists: moduleLoader.fileExists,
    directoryExists: moduleLoader.directoryExists,
    getDirectories: moduleLoader.getDirectories,
    readDirectory: moduleLoader.readDirectory,
    realpath: moduleLoader.realpath,

    getCompilationSettings: () => project.options,
    getCurrentDirectory: () => workspaceRoot,
    getDefaultLibFileName: () => ts.getDefaultLibFilePath(project.options),

    getProjectVersion: () => projectVersion.toString(),
    getScriptFileNames: () => serviceHost.getScriptFileNames(),
    getScriptSnapshot: serviceHost.getScriptSnapshot,
    getScriptVersion: (fileName: string) => {
      let snapshotVersion = serviceHost.getScriptSnapshot(fileName).version.toString();
      return snapshotVersion;
    },
  };

  const languageService: ts.LanguageService = ts.createLanguageService(host);
  const languageServiceProxy = new Proxy(languageService, {
    get(target, prop) {
      return Reflect.get(target, prop);
    },
  });

  return {
    getService: () => languageServiceProxy,
    onProjectUpdated
  };

  function onProjectUpdated() {
    projectVersion++;
  }
}

/**
 * This should only be used when there's no jsconfig/tsconfig at all
 */
function getDefaultJsConfig(): {
  compilerOptions: ts.CompilerOptions;
  include: string[];
} {
  let compilerOptions = {
    maxNodeModuleJsDepth: 2,
    allowSyntheticDefaultImports: true,
    allowJs: true
  };
  return {
    compilerOptions,
    include: ['src'],
  };
}

function getDefaultExclude() {
  return ['dist', 'node_modules'];
}
