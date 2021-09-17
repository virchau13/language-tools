/* eslint-disable require-jsdoc */

import {
  getParsedCommandLine,
  createLanguageServiceFromCommandLine
} from '@astrojs/ts-tools';

import * as ts from 'typescript';
import { ensureRealAstroFilePath, findTsConfigPath } from './utils';
import { Document } from '../../core/documents';
import { SnapshotManager } from './SnapshotManager';
import { createDocumentSnapshot, DocumentSnapshot } from './DocumentSnapshot';

const services = new Map<string, Promise<LanguageServiceContainer>>();

export interface LanguageServiceContainer {
  readonly tsconfigPath: string;
  readonly snapshotManager: SnapshotManager;
  getService(): ts.LanguageService;
  updateDocument(documentOrFilePath: Document | string): ts.IScriptSnapshot;
  deleteDocument(filePath: string): void;
}

export interface LanguageServiceDocumentContext {
  getWorkspaceRoot(fileName: string): string;
  createDocument: (fileName: string, content: string) => Document;
}

export async function getLanguageService(path: string, workspaceUris: string[], docContext: LanguageServiceDocumentContext): Promise<LanguageServiceContainer> {
  const tsconfigPath = findTsConfigPath(path, workspaceUris);
  const workspaceRoot = docContext.getWorkspaceRoot(path);

  let service: LanguageServiceContainer;
  if (services.has(tsconfigPath)) {
    service = (await services.get(tsconfigPath)) as LanguageServiceContainer;
  } else {
    const newServicePromise = createLanguageService(tsconfigPath, workspaceRoot, docContext);
    services.set(tsconfigPath, newServicePromise);
    service = await newServicePromise;
  }

  return service;
}

export async function getLanguageServiceForDocument(document: Document, workspaceUris: string[], docContext: LanguageServiceDocumentContext): Promise<ts.LanguageService> {
  return getLanguageServiceForPath(document.getFilePath() || '', workspaceUris, docContext);
}

export async function getLanguageServiceForPath(path: string, workspaceUris: string[], docContext: LanguageServiceDocumentContext): Promise<ts.LanguageService> {
  return (await getLanguageService(path, workspaceUris, docContext)).getService();
}

async function createLanguageService(tsconfigPath: string, workspaceRoot: string, docContext: LanguageServiceDocumentContext): Promise<LanguageServiceContainer> {
  const project = getParsedCommandLine(tsconfigPath, workspaceRoot);

  const snapshotManager = new SnapshotManager(
    project.fileNames,
    {
      exclude: ['node_modules', 'dist'],
      include: ['src'],
    },
    workspaceRoot || process.cwd()
  );

  const tls = createLanguageServiceFromCommandLine(project, workspaceRoot, {
    getScriptFileNames() {
      return Array.from(new Set([
        ...snapshotManager.getFileNames(),
        ...snapshotManager.getProjectFileNames()
      ]));
    },
    getTextForFile(filePath: string) {
      const snapshot = getScriptSnapshot(filePath);
      return snapshot.getFullText();
    },
    getScriptSnapshot
  });

  return {
    tsconfigPath,
    snapshotManager,
    getService: tls.getService,
    updateDocument,
    deleteDocument,
  };

  function deleteDocument(filePath: string) {
    snapshotManager.delete(filePath);
  }

  function updateDocument(documentOrFilePath: Document | string) {
    const filePath = ensureRealAstroFilePath(typeof documentOrFilePath === 'string' ? documentOrFilePath : documentOrFilePath.getFilePath() || '');
    const document = typeof documentOrFilePath === 'string' ? undefined : documentOrFilePath;

    if (!filePath) {
      throw new Error(`Unable to find document`);
    }

    const previousSnapshot = snapshotManager.get(filePath);
    if (document && previousSnapshot?.version.toString() === `${document.version}`) {
      return previousSnapshot;
    }

    const currentText = document ? document.getText() : null;
    const snapshot = createDocumentSnapshot(filePath, currentText, docContext.createDocument);
    snapshotManager.set(filePath, snapshot);
    tls.onProjectUpdated();
    return snapshot;
  }

  function getScriptSnapshot(fileName: string): DocumentSnapshot {
    fileName = ensureRealAstroFilePath(fileName);

    let doc = snapshotManager.get(fileName);
    if (doc) {
      return doc;
    }

    doc = createDocumentSnapshot(fileName, null, docContext.createDocument);
    snapshotManager.set(fileName, doc);
    return doc;
  }
}