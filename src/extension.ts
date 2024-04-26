// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let protocol: vscode.EventEmitter<string> =
		vscode.extensions.all.find(ext => ext.isActive && ext.exports && 'wordProtocol' in ext.exports)?.exports.wordProtocol
		?? new vscode.EventEmitter<string>;

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "interlinear" is now active!');

	InterlinearEditorProvider.register(context, protocol);

	protocol.event(console.log)

	return {
		wordProtocol: protocol
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}

export class InterlinearEditorProvider implements vscode.CustomTextEditorProvider {
	public static register(context: vscode.ExtensionContext, protocol: vscode.EventEmitter<string>): vscode.Disposable {
		const provider = new InterlinearEditorProvider(context, protocol);
		const providerRegistration = vscode.window.registerCustomEditorProvider(InterlinearEditorProvider.viewType, provider);
		return providerRegistration;
	}

	private static readonly viewType = 'interlinear.editor';

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly protocol: vscode.EventEmitter<string>
	) { }

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		try {
			const dataFile = await vscode.workspace.findFiles("data/oba.json");
			const data = JSON.parse((await vscode.workspace.fs.readFile(dataFile[0])).toString());

			const refFile = await vscode.workspace.findFiles("eng/oba.interlinear");
			const refData = JSON.parse((await vscode.workspace.fs.readFile(refFile[0])).toString());

			webviewPanel.webview.options = {
				enableScripts: true
			};

			const json = JSON.parse(document.getText());
			const words = json.words.map((word: any) => `<li>
				<div>
					${data.words.find((w: any) => w.id === word.id)?.text ?? ''}
				</div>
				<div>
					${refData.words.find((w: any) => w.id === word.id)?.gloss ?? ''}
				</div>
				<div>
					<input id="${word.id}" type="text" value="${word.gloss}">
				</div>
			</li>`).join('');
			webviewPanel.webview.html = `
				<h1>${json.book} ${json.chapter}:${json.verse}</h1>
				<ol>${words}</ol>
				<script>
					const vscode = acquireVsCodeApi();
					const list = document.querySelector('ol');
					list.addEventListener('focusin', e => {
						const id = e.target.id
						vscode.postMessage({ type: 'focus', id })
					})
					list.addEventListener('change', e => {
						const id = e.target.id
						const value = e.target.value
						vscode.postMessage({ type: 'gloss', id, value })
					});
				</script>`;


			webviewPanel.webview.onDidReceiveMessage(e => {
				switch (e.type) {
					case 'focus': {
						this.protocol.fire(e.id)
					}
					case 'gloss': {
						const json = JSON.parse(document.getText());
						const word = json.words.find((w: any) => w.id === e.id);
						if (word) {
							word.gloss = e.value;
						}
						const edit = new vscode.WorkspaceEdit();
						edit.replace(
							document.uri,
							new vscode.Range(0, 0, document.lineCount, 0),
							JSON.stringify(json, null, 2));
						return vscode.workspace.applyEdit(edit).then(() => 
							vscode.workspace.save(document.uri)
						);
					}
				}
			});
		} catch (error) {
			console.log(error);
		}
	}
}