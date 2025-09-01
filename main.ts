import { App, Editor, Plugin, PluginSettingTab, Setting, TAbstractFile } from 'obsidian';

interface TodayPluginSettings {
	dateFormat: string;
}

const DEFAULT_SETTINGS: TodayPluginSettings = {
	dateFormat: 'YYYY-MM-DD'
}

export default class TodayPlugin extends Plugin {
	settings: TodayPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register event listener for editor changes
		this.registerEvent(this.app.workspace.on('editor-change', this.handleEditorChange.bind(this)));

		// Register event listener for file rename (for title editing)
		this.registerEvent(this.app.vault.on('rename', this.handleFileRename.bind(this)));

		// Add command to insert today's date
		this.addCommand({
			id: 'insert-today-date',
			name: 'Insert Today\'s Date',
			editorCallback: (editor: Editor) => {
				const today = this.formatDate(new Date());
				editor.replaceSelection(today);
			}
		});

		// Add settings tab
		this.addSettingTab(new TodayPluginSettingTab(this.app, this));
	}

	private handleEditorChange(editor: Editor, _info: unknown) {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);

		// First, handle escaped patterns (remove the backslash)
		const escapePatterns = [
			{ regex: /\\(\{\{today\(\)\}\})/g, replacement: '$1' },
			{ regex: /\\(today\(\))/g, replacement: '$1' },
			{ regex: /\\(@today)\b/g, replacement: '$1' }
		];

		for (const pattern of escapePatterns) {
			if (pattern.regex.test(line)) {
				const newLine = line.replace(pattern.regex, pattern.replacement);
				editor.setLine(cursor.line, newLine);

				// Adjust cursor position (removing one backslash)
				const newCursorPos = Math.max(0, cursor.ch - 1);
				editor.setCursor(cursor.line, newCursorPos);
				return; // Exit early to avoid processing date replacement
			}
		}

		// Then handle normal date patterns (only if no escape patterns were found)
		const datePatterns = [
			{ regex: /\{\{today\(\)\}\}/g, replacement: this.formatDate(new Date()) },
			{ regex: /\btoday\(\)/g, replacement: this.formatDate(new Date()) },
			{ regex: /@today\b/g, replacement: this.formatDate(new Date()) }
		];

		for (const pattern of datePatterns) {
			const matches = [...line.matchAll(pattern.regex)];
			if (matches.length > 0) {
				// Check if any match is preceded by a backslash
				const validMatches = matches.filter(match => {
					const matchStart = match.index ?? 0;
					return matchStart === 0 || line[matchStart - 1] !== '\\';
				});

				if (validMatches.length === 0) continue;

				let newLine = line;
				let cursorAdjustment = 0;

				// Process valid matches from right to left to maintain correct positions
				for (let i = validMatches.length - 1; i >= 0; i--) {
					const match = validMatches[i];
					const matchStart = match.index ?? 0;
					const matchEnd = matchStart + match[0].length;

					newLine = newLine.substring(0, matchStart) +
						pattern.replacement +
						newLine.substring(matchEnd);

					// Calculate cursor adjustment for the match that contains the cursor
					if (matchStart <= cursor.ch && cursor.ch <= matchEnd) {
						// Cursor is within this match - position it at the end of the replacement
						cursorAdjustment = (matchStart + pattern.replacement.length) - cursor.ch;
					} else if (matchStart < cursor.ch) {
						// Match is before cursor - adjust for length difference
						cursorAdjustment += pattern.replacement.length - match[0].length;
					}
				}

				// Replace the entire line
				editor.setLine(cursor.line, newLine);

				// Move cursor to correct position after replacement
				const newCursorPos = Math.max(0, cursor.ch + cursorAdjustment);
				editor.setCursor(cursor.line, newCursorPos);

				break; // Only process the first matching pattern
			}
		}
	}

	private async handleFileRename(file: TAbstractFile, oldPath: string) {
		// Check if the new filename contains today patterns
		let newName = file.name;
		let hasReplacement = false;

		// First handle escaped patterns (remove backslash)
		const escapePatterns = [
			{ regex: /\\(\{\{today\(\)\}\})/, replacement: '$1' },
			{ regex: /\\(today\(\))/, replacement: '$1' },
			{ regex: /\\(@today)\b/, replacement: '$1' }
		];

		for (const pattern of escapePatterns) {
			if (pattern.regex.test(newName)) {
				newName = newName.replace(pattern.regex, pattern.replacement);
				hasReplacement = true;
				break;
			}
		}

		// If no escape patterns, check for normal date patterns
		if (!hasReplacement) {
			const datePatterns = [
				{ regex: /\{\{today\(\)\}\}/, replacement: this.formatDate(new Date()) },
				{ regex: /\btoday\(\)/, replacement: this.formatDate(new Date()) },
				{ regex: /@today\b/, replacement: this.formatDate(new Date()) }
			];

			for (const pattern of datePatterns) {
				// Check if pattern exists and is not escaped
				const match = newName.match(pattern.regex);
				if (match && match.index !== undefined) {
					const matchStart = match.index;
					const isEscaped = matchStart > 0 && newName[matchStart - 1] === '\\';

					if (!isEscaped) {
						newName = newName.replace(pattern.regex, pattern.replacement);
						hasReplacement = true;
						break;
					}
				}
			}
		}

		if (hasReplacement) {
			const newPath = file.path.replace(file.name, newName);
			try {
				await this.app.vault.rename(file, newPath);
			} catch (error) {
				console.error('Failed to rename file:', error);
			}
		}
	}

	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');

		switch (this.settings.dateFormat) {
			case 'MM-DD-YYYY':
				return `${month}-${day}-${year}`;
			case 'DD-MM-YYYY':
				return `${day}-${month}-${year}`;
			case 'MM/DD/YYYY':
				return `${month}/${day}/${year}`;
			case 'DD/MM/YYYY':
				return `${day}/${month}/${year}`;
			case 'YYYY-MM-DD':
			default:
				return `${year}-${month}-${day}`;
		}
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TodayPluginSettingTab extends PluginSettingTab {
	plugin: TodayPlugin;

	constructor(app: App, plugin: TodayPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Today Plugin Settings'});

		new Setting(containerEl)
			.setName('Date Format')
			.setDesc('Choose the format for the date when {{today()}} is replaced')
			.addDropdown(dropdown => dropdown
				.addOption('YYYY-MM-DD', 'YYYY-MM-DD (2023-09-01)')
				.addOption('MM-DD-YYYY', 'MM-DD-YYYY (09-01-2023)')
				.addOption('DD-MM-YYYY', 'DD-MM-YYYY (01-09-2023)')
				.addOption('MM/DD/YYYY', 'MM/DD/YYYY (09/01/2023)')
				.addOption('DD/MM/YYYY', 'DD/MM/YYYY (01/09/2023)')
				.setValue(this.plugin.settings.dateFormat)
				.onChange(async (value) => {
					this.plugin.settings.dateFormat = value;
					await this.plugin.saveSettings();
				}));
	}
}
