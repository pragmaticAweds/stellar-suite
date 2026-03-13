import * as vscode from 'vscode';
import { execAsync } from '../services/sorobanCliService';
import { WorkspaceDetector } from '../utils/workspaceDetector';
import { formatError } from '../utils/errorFormatter';

export async function contractInfo(context: vscode.ExtensionContext, args?: any) {
    try {
        const config = vscode.workspace.getConfiguration('stellarSuite');
        const cliPath = config.get<string>('cliPath', 'stellar');
        const source = config.get<string>('source', 'dev');
        const network = config.get<string>('network', 'testnet') || 'testnet';

        const selectedContractId = args?.contractId || context.workspaceState.get<string>('selectedContractId');
        const lastContractId = context.workspaceState.get<string>('lastContractId');

        let contractId: string | undefined = selectedContractId;

        if (args?.contractId) {
            //use directly
        } else if (selectedContractId) {
            await context.workspaceState.update('selectedContractId', undefined);
        } else {
            let defaultContractId = lastContractId || '';
            try {
                if (!defaultContractId) {
                    const detectedId = await WorkspaceDetector.findContractId();
                    if (detectedId) {
                        defaultContractId = detectedId;
                    }
                }
            } catch (error) { }

            contractId = await vscode.window.showInputBox({
                prompt: 'Enter the contract ID to inspect',
                placeHolder: defaultContractId || 'e.g., C...',
                value: defaultContractId
            });
        }

        if (!contractId) return;

        const rpcUrl = config.get<string>('rpcUrl', 'https://soroban-testnet.stellar.org:443');
        const networkPassphrase = config.get<string>('networkPassphrase', 'Test SDF Network ; September 2015');

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Fetching Contract Metadata...',
                cancellable: false
            },
            async (progress) => {
                const { stdout } = await execAsync(`${cliPath} contract info interface --id ${contractId} --rpc-url ${rpcUrl} --network-passphrase "${networkPassphrase}" --output json-formatted`);

                const panel = vscode.window.createWebviewPanel(
                    'contractInfo',
                    `Contract Info: ${contractId.substring(0, 8)}...`,
                    vscode.ViewColumn.Two,
                    { enableScripts: true }
                );

                panel.webview.html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            :root {
                                --brand-bg: hsl(222, 47%, 6%);
                                --brand-primary: hsl(228, 76%, 60%);
                                --brand-secondary: hsl(217.2, 32.6%, 17.5%);
                                --brand-foreground: hsl(210, 40%, 96%);
                                --brand-border: hsl(217.2, 32.6%, 17.5%);
                            }
                            body { 
                                font-family: var(--vscode-font-family); 
                                padding: 24px; 
                                line-height: 1.6; 
                                color: var(--vscode-foreground); 
                                background: var(--vscode-editor-background); 
                            }
                            .container {
                                background: var(--vscode-sideBar-background);
                                border: 1px solid var(--vscode-panel-border);
                                border-radius: 12px;
                                padding: 24px;
                                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                            }
                            h2 { 
                                color: var(--brand-primary); 
                                font-size: 16px;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                border-bottom: 1px solid var(--vscode-panel-border); 
                                padding-bottom: 12px;
                                margin-top: 0;
                                margin-bottom: 20px;
                            }
                            pre { 
                                background: var(--brand-bg); 
                                color: var(--brand-primary);
                                padding: 20px; 
                                border-radius: 8px; 
                                overflow: auto; 
                                border: 1px solid var(--brand-border);
                                font-family: 'JetBrains Mono', var(--vscode-editor-font-family);
                                font-size: 12px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h2>Metadata for ${contractId}</h2>
                            <pre>${stdout}</pre>
                        </div>
                    </body>
                    </html>
                `;
            }
        );
    } catch (error) {
        const formatted = formatError(error, 'Contract Info');
        vscode.window.showErrorMessage(`${formatted.title}: ${formatted.message}`);
    }
}
