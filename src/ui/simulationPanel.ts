import * as vscode from 'vscode';
import { SimulationResult } from '../services/sorobanCliService';

export class SimulationPanel {
    private static currentPanel: SimulationPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        this._update();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(context: vscode.ExtensionContext): SimulationPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SimulationPanel.currentPanel) {
            SimulationPanel.currentPanel._panel.reveal(column);
            return SimulationPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'simulationPanel',
            'Soroban Simulation Result',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        SimulationPanel.currentPanel = new SimulationPanel(panel, context);
        return SimulationPanel.currentPanel;
    }

    public updateResults(result: SimulationResult, contractId: string, functionName: string, args: any[]): void {
        const typeLabel = result.type === 'invocation' ? 'Invocation' : 'Simulation';
        this._panel.title = `Soroban ${typeLabel} Result`;
        this._panel.webview.html = this._getHtmlForResults(result, contractId, functionName, args);
    }

    public dispose() {
        SimulationPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForLoading();
    }

    private _getHtmlForLoading(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simulation Result</title>
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
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
        }
        .loading {
            text-align: center;
            padding: 60px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }
        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid var(--brand-secondary);
            border-top: 3px solid var(--brand-primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loading">
        <div class="spinner"></div>
        <p style="font-weight: 600; color: var(--brand-primary);">Processing Soroban Transaction...</p>
    </div>
</body>
</html>`;
    }

    private _getHtmlForResults(result: SimulationResult, contractId: string, functionName: string, args: any[]): string {
        const escapeHtml = (text: string): string => {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const formatValue = (value: any): string => {
            if (value === null || value === undefined) {
                return '<em>null</em>';
            }
            if (typeof value === 'object') {
                return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
            }
            return escapeHtml(String(value));
        };

        let statusClass = result.success ? 'success' : 'error';
        let statusIcon = result.success ? '[OK]' : '[FAIL]';
        let statusText = result.success ? 'Success' : 'Failed';

        const typeLabel = result.type === 'invocation' ? 'Invocation' : 'Simulation';

        if (!result.success && result.error === 'Running simulation...') {
            statusClass = 'pending';
            statusIcon = '[...]';
            statusText = result.type === 'invocation' ? 'Invoking...' : 'Simulating...';
        }

        const resourceUsageHtml = result.resourceUsage
            ? `
            <div class="section">
                <h3>Resource Usage</h3>
                <table>
                    ${result.resourceUsage.cpuInstructions ? `<tr><td>CPU Instructions:</td><td>${result.resourceUsage.cpuInstructions.toLocaleString()}</td></tr>` : ''}
                    ${result.resourceUsage.memoryBytes ? `<tr><td>Memory:</td><td>${(result.resourceUsage.memoryBytes / 1024).toFixed(2)} KB</td></tr>` : ''}
                    ${result.resourceUsage.minResourceFee ? `<tr><td>Min Resource Fee:</td><td>${Number(result.resourceUsage.minResourceFee).toLocaleString()} stroops</td></tr>` : ''}
                </table>
            </div>
            `
            : '';

        const explorerBaseUrl = result.network === 'mainnet'
            ? 'https://stellar.expert/explorer/public/tx/'
            : result.network === 'futurenet'
                ? 'https://stellar.expert/explorer/futurenet/tx/'
                : 'https://stellar.expert/explorer/testnet/tx/';

        const transactionHtml = result.transactionHash
            ? `
            <div class="section">
                <h3>Blockchain Transaction</h3>
                <table>
                    <tr>
                        <td>Transaction ID:</td>
                        <td>
                            <code style="word-break: break-all;">${escapeHtml(result.transactionHash)}</code>
                            <div style="margin-top: 8px;">
                                <a href="${explorerBaseUrl}${result.transactionHash}" target="_blank" class="btn-link">View on Stellar Expert ↗</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
            `
            : '';

        const eventsHtml = result.events && result.events.length > 0
            ? `
            <div class="section">
                <h3>Emitted Events</h3>
                ${result.events.map((e, i) => `
                    <div class="event-item" style="margin-bottom: 8px; padding: 12px; background: var(--vscode-textCodeBlock-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px;">
                        <div style="font-weight: 600; margin-bottom: 4px; color: var(--vscode-textLink-foreground);">Event #${i + 1}</div>
                        <pre style="margin: 0; padding: 0; background: transparent; border: none; overflow-x: auto;">${escapeHtml(typeof e === 'string' ? e : JSON.stringify(e, null, 2))}</pre>
                    </div>
                `).join('')}
            </div>
            `
            : '';

        const authHtml = result.auth && result.auth.length > 0
            ? `
            <div class="section">
                <h3>Authorization Requirements</h3>
                ${result.auth.map((a, i) => `
                    <div class="auth-item" style="margin-bottom: 8px; padding: 12px; background: var(--vscode-textCodeBlock-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px;">
                        <div style="font-weight: 600; margin-bottom: 4px; color: var(--vscode-textLink-foreground);">Auth #${i + 1}</div>
                        <pre style="margin: 0; padding: 0; background: transparent; border: none; overflow-x: auto;">${escapeHtml(JSON.stringify(a, null, 2))}</pre>
                    </div>
                `).join('')}
            </div>
            `
            : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${typeLabel} Result</title>
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
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            line-height: 1.6;
        }
        .status {
            padding: 16px 20px;
            border-radius: 8px;
            margin-bottom: 24px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 12px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .status.success {
            background-color: rgba(34, 197, 94, 0.2);
            color: #22c55e;
            border: 1px solid rgba(34, 197, 94, 0.3);
        }
        .status.error {
            background-color: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            border: 1px solid rgba(239, 68, 68, 0.3);
        }
        .status.pending {
            background-color: var(--brand-bg);
            color: var(--brand-primary);
            border: 1px solid var(--brand-border);
        }
        .section {
            margin-bottom: 32px;
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 12px;
            padding: 20px;
        }
        .section h3 {
            margin-top: 0;
            margin-bottom: 16px;
            color: var(--brand-primary);
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        table td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 13px;
        }
        table tr:last-child td {
            border-bottom: none;
        }
        table td:first-child {
            font-weight: 700;
            width: 200px;
            color: var(--vscode-descriptionForeground);
        }
        pre {
            background-color: var(--brand-bg);
            color: var(--brand-primary);
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 8px 0;
            border: 1px solid var(--brand-border);
            font-family: 'JetBrains Mono', var(--vscode-editor-font-family);
            font-size: 12px;
        }
        .error-message {
            background-color: rgba(239, 68, 68, 0.1);
            color: #ef4444;
            padding: 16px;
            border-radius: 8px;
            border-left: 4px solid #ef4444;
            font-family: 'JetBrains Mono', var(--vscode-editor-font-family);
        }
        .result-value {
            background-color: var(--brand-bg);
            padding: 16px;
            border-radius: 8px;
            border: 1px solid var(--brand-border);
        }
        .btn-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background-color: var(--brand-primary);
            color: white !important;
            text-decoration: none;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            transition: all 0.2s;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .btn-link:hover {
            opacity: 0.9;
            transform: translateY(-1px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
        }
    </style>
</head>
<body>
    <div class="status ${statusClass}">
        ${statusIcon} ${statusText}
    </div>

    <div class="section">
        <h3>Transaction Details</h3>
        <table>
            <tr><td>Contract ID:</td><td><code>${escapeHtml(contractId)}</code></td></tr>
            <tr><td>Function:</td><td><code>${escapeHtml(functionName)}</code></td></tr>
            <tr><td>Arguments:</td><td><pre>${escapeHtml(JSON.stringify(args, null, 2))}</pre></td></tr>
        </table>
    </div>

    ${result.success
        ? `
        <div class="section">
            <h3>Return Value</h3>
            <div class="result-value">
                ${formatValue(result.result)}
            </div>
        </div>
        ${transactionHtml}
        ${resourceUsageHtml}
        ${eventsHtml}
        ${authHtml}
        `
        : `
        <div class="section">
            <h3>Error</h3>
            <div class="error-message">
                ${escapeHtml(result.error || 'Unknown error occurred')}
            </div>
        </div>
        `
    }
</body>
</html>`;
    }
}
