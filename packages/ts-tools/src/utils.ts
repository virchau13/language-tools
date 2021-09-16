import { Extension, ScriptKind } from 'typescript';

export function getExtensionFromScriptKind(kind: ScriptKind | undefined): Extension {
  switch (kind) {
    case ScriptKind.JSX:
      return Extension.Jsx;
    case ScriptKind.TS:
      return Extension.Ts;
    case ScriptKind.TSX:
      return Extension.Tsx;
    case ScriptKind.JSON:
      return Extension.Json;
    case ScriptKind.JS:
    default:
      return Extension.Js;
  }
}

type FrameworkExt = 'astro' | 'vue' | 'jsx' | 'tsx' | 'svelte';
type FrameworkVirtualExt = 'ts' | 'tsx';

const VirtualExtension: Record<FrameworkVirtualExt, FrameworkVirtualExt> = {
  ts: 'ts',
  tsx: 'tsx'
};

export function isVirtualFrameworkFilePath(ext: FrameworkExt, virtualExt: FrameworkVirtualExt, filePath: string) {
  return filePath.endsWith('.' + ext + '.' + virtualExt);
}

export function isAstroFilePath(filePath: string) {
  return filePath.endsWith('.astro');
}

export function isVirtualAstroFilePath(filePath: string) {
  return isVirtualFrameworkFilePath('astro', VirtualExtension.tsx, filePath);
}

export function isVirtualVueFilePath(filePath: string) {
  return isVirtualFrameworkFilePath('vue', VirtualExtension.ts, filePath);
}

export function isVirtualJsxFilePath(filePath: string) {
  return isVirtualFrameworkFilePath('jsx', VirtualExtension.ts, filePath) || isVirtualFrameworkFilePath('tsx', VirtualExtension.ts, filePath);
}

export function isVirtualSvelteFilePath(filePath: string) {
  return isVirtualFrameworkFilePath('svelte', VirtualExtension.ts, filePath);
}

export function isVirtualFilePath(filePath: string) {
  return isVirtualAstroFilePath(filePath) || isVirtualVueFilePath(filePath) || isVirtualSvelteFilePath(filePath) || isVirtualJsxFilePath(filePath);
}

export function toVirtualAstroFilePath(filePath: string) {
  if (isVirtualAstroFilePath(filePath)) {
    return filePath;
  } else if(isAstroFilePath(filePath)) {
    return `${filePath}.tsx`;
  } else {
    return filePath;
  }
}

export function toRealAstroFilePath(filePath: string) {
  return filePath.slice(0, -'.tsx'.length);
}

export function ensureRealAstroFilePath(filePath: string) {
  return isVirtualAstroFilePath(filePath) ? toRealAstroFilePath(filePath) : filePath;
}

export function ensureRealFilePath(filePath: string) {
  if(isVirtualFilePath(filePath)) {
    let extLen = filePath.endsWith('.tsx') ? 4 : 3;
    return filePath.slice(0, filePath.length - extLen);
  } else {
    return filePath;
  }
}