import {
	CompletionItem,
	CompletionList,
	Position,
	TextEdit,
	CompletionItemKind,
	FoldingRange,
	Hover,
	SymbolInformation,
} from 'vscode-languageserver';
import { doComplete as getEmmetCompletions } from '@vscode/emmet-helper';
import { getLanguageService } from 'vscode-html-languageservice';
import type { Plugin } from '../interfaces';
import { ConfigManager } from '../../core/config/ConfigManager';
import { AstroDocument } from '../../core/documents/AstroDocument';
import { isInComponentStartTag, isInsideExpression, isInsideFrontmatter } from '../../core/documents/utils';
import { LSHTMLConfig } from '../../core/config/interfaces';
import { isPossibleComponent } from '../../utils';
import { astroAttributes, astroDirectives, classListAttribute } from './features/astro-attributes';
import { removeDataAttrCompletion } from './utils';

export class HTMLPlugin implements Plugin {
	__name = 'html';

	private lang = getLanguageService({
		customDataProviders: [astroAttributes, classListAttribute],
	});
	private attributeOnlyLang = getLanguageService({
		customDataProviders: [astroAttributes],
		useDefaultDataProvider: false,
	});
	private componentLang = getLanguageService({
		customDataProviders: [astroAttributes, astroDirectives],
		useDefaultDataProvider: false,
	});
	private styleScriptTemplate = new Set(['style']);
	private configManager: ConfigManager;

	constructor(configManager: ConfigManager) {
		this.configManager = configManager;
	}

	doHover(document: AstroDocument, position: Position): Hover | null {
		if (!this.featureEnabled('hover')) {
			return null;
		}

		const html = document.html;
		if (!html) {
			return null;
		}

		const node = html.findNodeAt(document.offsetAt(position));
		if (!node) {
			return null;
		}

		// If the node we're hovering on is a component, instead only provide astro-specific hover info
		if (isPossibleComponent(node)) {
			return this.componentLang.doHover(document, position, html);
		}

		return this.lang.doHover(document, position, html);
	}

	/**
	 * Get HTML completions
	 */
	getCompletions(document: AstroDocument, position: Position): CompletionList | null {
		if (!this.featureEnabled('completions')) {
			return null;
		}

		const html = document.html;
		const offset = document.offsetAt(position);

		if (
			!html ||
			isInsideFrontmatter(document.getText(), offset) ||
			isInsideExpression(document.getText(), html.findNodeAt(offset).start, offset)
		) {
			return null;
		}

		// Get Emmet completions
		let emmetResults: CompletionList = {
			isIncomplete: true,
			items: [],
		};

		this.lang.setCompletionParticipants([
			{
				onHtmlContent: () =>
					(emmetResults =
						getEmmetCompletions(document, position, 'html', this.configManager.getEmmetConfig()) || emmetResults),
			},
		]);

		// If we're in a component starting tag, we do not want HTML language completions
		// as HTML attributes are not valid for components
		const results = isInComponentStartTag(html, document.offsetAt(position))
			? removeDataAttrCompletion(this.attributeOnlyLang.doComplete(document, position, html).items)
			: this.lang.doComplete(document, position, html).items;

		return CompletionList.create(
			[...results, ...this.getLangCompletions(results), ...emmetResults.items],
			// Emmet completions change on every keystroke, so they are never complete
			emmetResults.items.length > 0
		);
	}

	getFoldingRanges(document: AstroDocument): FoldingRange[] | null {
		const html = document.html;

		if (!html) {
			return null;
		}

		return this.lang.getFoldingRanges(document);
	}

	doTagComplete(document: AstroDocument, position: Position): string | null {
		if (!this.featureEnabled('tagComplete')) {
			return null;
		}

		const html = document.html;
		const offset = document.offsetAt(position);

		if (
			!html ||
			isInsideFrontmatter(document.getText(), offset) ||
			isInsideExpression(document.getText(), html.findNodeAt(offset).start, offset)
		) {
			return null;
		}

		return this.lang.doTagComplete(document, position, html);
	}

	getDocumentSymbols(document: AstroDocument): SymbolInformation[] {
		if (!this.featureEnabled('documentSymbols')) {
			return [];
		}

		const html = document.html;
		if (!html) {
			return [];
		}

		return this.lang.findDocumentSymbols(document, html);
	}

	/**
	 * Get lang completions for style tags (ex: `<style lang="scss">`)
	 */
	private getLangCompletions(completions: CompletionItem[]): CompletionItem[] {
		const styleScriptTemplateCompletions = completions.filter(
			(completion) => completion.kind === CompletionItemKind.Property && this.styleScriptTemplate.has(completion.label)
		);
		const langCompletions: CompletionItem[] = [];
		addLangCompletion('style', ['scss', 'sass', 'less', 'styl', 'stylus']);
		return langCompletions;

		/** Add language completions */
		function addLangCompletion(tag: string, languages: string[]) {
			const existingCompletion = styleScriptTemplateCompletions.find((completion) => completion.label === tag);
			if (!existingCompletion) {
				return;
			}

			languages.forEach((lang) =>
				langCompletions.push({
					...existingCompletion,
					label: `${tag} (lang="${lang}")`,
					insertText: existingCompletion.insertText && `${existingCompletion.insertText} lang="${lang}"`,
					textEdit:
						existingCompletion.textEdit && TextEdit.is(existingCompletion.textEdit)
							? {
									range: existingCompletion.textEdit.range,
									newText: `${existingCompletion.textEdit.newText} lang="${lang}"`,
							  }
							: undefined,
				})
			);
		}
	}

	private featureEnabled(feature: keyof LSHTMLConfig) {
		return this.configManager.enabled('html.enabled') && this.configManager.enabled(`html.${feature}.enabled`);
	}
}
