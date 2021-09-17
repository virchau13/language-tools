import ts, { ScriptKind } from 'typescript';
import {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  Range
} from 'vscode-languageserver';
import { toVirtualAstroFilePath } from '@astrojs/ts-tools';
import { convertRange, mapSeverity } from '../utils';

export {
    ScriptKind
};

type BoundaryTuple = [number, number];

interface BoundaryParseResults {
    script: BoundaryTuple[];
    markdown: BoundaryTuple[];
}

interface ParserError {
  message: string;
  range: Range;
  code: number;
}

interface TSDoc {
  parserError: ParserError | null;
  scriptKind: ts.ScriptKind;
  getFullText(): string;
}

export async function getDiagnostics(
  filePath: string,
  lang: ts.LanguageService,
  tsDoc: TSDoc
): Promise<Diagnostic[]> {
  const isTypescript = tsDoc.scriptKind === ts.ScriptKind.TSX;

    // Document preprocessing failed, show parser error instead
    if (tsDoc.parserError) {
        return [
            {
                range: tsDoc.parserError.range,
                severity: DiagnosticSeverity.Error,
                source: isTypescript ? 'ts' : 'js',
                message: tsDoc.parserError.message,
                code: tsDoc.parserError.code
            }
        ];
    }

    const tsFilePath = toVirtualAstroFilePath(filePath);

    const {
        script: scriptBoundaries,
        markdown: markdownBoundaries
    } = getTagBoundaries(lang, tsFilePath);

    const syntaxDiagnostics = lang.getSyntacticDiagnostics(tsFilePath);
    const suggestionDiagnostics = lang.getSuggestionDiagnostics(tsFilePath);
    const semanticDiagnostics = lang.getSemanticDiagnostics(tsFilePath).filter(d => {
        return (
            isNoWithinScript(scriptBoundaries, d)
        );
    });

    const diagnostics: ts.Diagnostic[] = [
        ...syntaxDiagnostics,
        ...suggestionDiagnostics,
        ...semanticDiagnostics
    ];

    const sourceFile = lang.getProgram()?.getSourceFile(filePath);

    const isNoFalsePositiveInst = isNoFalsePositive();
    return diagnostics
        .map<Diagnostic>((diagnostic) => {
            const text = tsDoc.getFullText();
            return {
                range: convertRange(text, diagnostic),
                severity: mapSeverity(diagnostic.category),
                source: isTypescript ? 'ts' : 'js',
                message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
                code: diagnostic.code,
                tags: getDiagnosticTag(diagnostic)
            }
        })
        .filter(diag => {
            return (
                hasNoNegativeLines(diag) &&
                isNoFalsePositiveInst(diag) &&
                isNoJSXImplicitRuntimeWarning(diag) &&
                isNoJSXMustHaveOneParent(diag) &&
                isNoCantUseJSX(diag) &&
                isNoCantEndWithTS(diag) &&
                isNoSpreadExpected(diag) &&
                isNoCantResolveJSONModule(diag) &&
                isNoMarkdownBlockQuoteWithinMarkdown(sourceFile, markdownBoundaries, diag)
            );
        });
}


function getTagBoundaries(lang: ts.LanguageService, tsFilePath: string): BoundaryParseResults {
    const program = lang.getProgram();
    const sourceFile = program?.getSourceFile(tsFilePath);

    const boundaries: BoundaryParseResults = {
        script: [],
        markdown: []
    };

    if(!sourceFile) {
        return boundaries;
    }

    function findScript(parent: ts.Node) {
        ts.forEachChild(parent, node => {
            if(ts.isJsxElement(node)) {
                let tagName = node.openingElement.tagName.getText();

                switch(tagName) {
                    case 'script': {
                        ts.getLineAndCharacterOfPosition(sourceFile!, node.getStart());
                        boundaries.script.push([node.getStart(), node.getEnd()]);
                        break;
                    }
                    case 'Markdown': {
                        boundaries.markdown.push([node.getStart(), node.getEnd()]);
                        break;
                    }
                }
            }
            findScript(node);
        });
    }

    findScript(sourceFile);
    return boundaries;
}

function getDiagnosticTag(diagnostic: ts.Diagnostic): DiagnosticTag[] {
  const tags: DiagnosticTag[] = [];
  if (diagnostic.reportsUnnecessary) {
      tags.push(DiagnosticTag.Unnecessary);
  }
  if (diagnostic.reportsDeprecated) {
      tags.push(DiagnosticTag.Deprecated);
  }
  return tags;
}

/**
 * In some rare cases mapping of diagnostics does not work and produces negative lines.
 * We filter out these diagnostics with negative lines because else the LSP
 * apparently has a hickup and does not show any diagnostics at all.
 */
function hasNoNegativeLines(diagnostic: Diagnostic): boolean {
    return diagnostic.range.start.line >= 0 && diagnostic.range.end.line >= 0;
}



function isNoFalsePositive() {
    return (diagnostic: Diagnostic) => {
        return (
            isNoJsxCannotHaveMultipleAttrsError(diagnostic)
        );
    };
}

/**
 * Jsx cannot have multiple attributes with same name,
 * but that's allowed for svelte
 */
function isNoJsxCannotHaveMultipleAttrsError(diagnostic: Diagnostic) {
    return diagnostic.code !== 17001;
}

function isNoJSXImplicitRuntimeWarning(diagnostic: Diagnostic) {
    return diagnostic.code !== 7016 && diagnostic.code !== 2792;
}

function isNoJSXMustHaveOneParent(diagnostic: Diagnostic) {
    return diagnostic.code !== 2657;
}

function isNoCantUseJSX(diagnostic: Diagnostic) {
    return diagnostic.code !== 17004 && diagnostic.code !== 6142;
}

function isNoCantEndWithTS(diagnostic: Diagnostic) {
    return diagnostic.code !== 2691;
}

function isNoSpreadExpected(diagnostic: Diagnostic) {
    return diagnostic.code !== 1005;
}

function isWithinBoundaries(boundaries: BoundaryTuple[], start: number): boolean {
    for(let [bstart, bend] of boundaries) {
        if(start > bstart && start < bend) {
            return true;
        }
    }
    return false;
}

function diagnosticIsWithinBoundaries(sourceFile: ts.SourceFile | undefined, boundaries: BoundaryTuple[], diagnostic: Diagnostic | ts.Diagnostic) {
    if('start' in diagnostic) {
        if(diagnostic.start == null) return false;
        return isWithinBoundaries(boundaries, diagnostic.start);
    }

    if(!sourceFile) return false;

    let startRange = (diagnostic as Diagnostic).range.start;
    let pos = ts.getPositionOfLineAndCharacter(sourceFile, startRange.line, startRange.character);
    return isWithinBoundaries(boundaries, pos);
}

function isNoWithinScript(boundaries: BoundaryTuple[], diagnostic: ts.Diagnostic) {
    return !diagnosticIsWithinBoundaries(undefined, boundaries, diagnostic);
}

/**
 * This allows us to have JSON module imports.
 */
function isNoCantResolveJSONModule(diagnostic: Diagnostic) {
    return diagnostic.code !== 2732;
}

/**
 * This is for using > within a markdown component like:
 * <Markdown>
 *   > Blockquote here.
 * </Markdown>
 */
function isNoMarkdownBlockQuoteWithinMarkdown(sourceFile: ts.SourceFile | undefined, boundaries: BoundaryTuple[], diagnostic: Diagnostic | ts.Diagnostic) {
    if(diagnostic.code !== 1382) {
        return true;
    }

    return !diagnosticIsWithinBoundaries(sourceFile, boundaries, diagnostic);
}