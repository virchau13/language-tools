export {
  createFileSystem
} from './filesystem';

export {
  isAstroFilePath,
  isVirtualAstroFilePath,
  isVirtualSvelteFilePath,
  isVirtualVueFilePath,
  isVirtualJsxFilePath,
  isVirtualFilePath,
  toVirtualAstroFilePath,
  ensureRealAstroFilePath,
  ensureRealFilePath,
} from './utils';

export {
  createLanguageService,
  createLanguageServiceFromCommandLine,
  getParsedCommandLine
} from './languageservice';