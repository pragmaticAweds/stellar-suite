import * as vscode from 'vscode';
import { SorobanCliService } from '../services/sorobanCliService';
import { ContractInspector, ContractFunction } from '../services/contractInspector';
import { WorkspaceDetector } from '../utils/workspaceDetector';
import { SimulationPanel } from '../ui/simulationPanel';
import { SidebarViewProvider } from '../ui/sidebarView';
import { formatError } from '../utils/errorFormatter';

export async function runInvoke(context: vscode.ExtensionContext, sidebarProvider?: SidebarViewProvider, args?: any) {
    try {
        const config = vscode.workspace.getConfiguration('stellarSuite');
        const cliPath = config.get<string>('cliPath', 'stellar');
        const source = config.get<string>('source', 'dev');
        const network = config.get<string>('network', 'testnet') || 'testnet';
        const rpcUrl = config.get<string>('rpcUrl', 'https://soroban-testnet.stellar.org:443');
        const networkPassphrase = config.get<string>('networkPassphrase', 'Test SDF Network ; September 2015');

        const selectedContractId = args?.contractId || context.workspaceState.get<string>('selectedContractId');
        const lastContractId = context.workspaceState.get<string>('lastContractId');

        let contractId: string | undefined = selectedContractId;

        if (args?.contractId) {
            // if passed explicitly we use it directly
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
                prompt: 'Enter the contract ID (address) for LIVE INVOCATION',
                placeHolder: defaultContractId || 'e.g., C...',
                value: defaultContractId,
                validateInput: (value: string) => {
                    if (!value || value.trim().length === 0) return 'Contract ID is required';
                    if (!value.match(/^C[A-Z0-9]{55}$/)) return 'Invalid contract ID format';
                    return null;
                }
            });
        }

        if (!contractId) return;

        const passedFunctionName = args?.functionName;
        let functionName = passedFunctionName || '';
        let selectedFunction: ContractFunction | null = null;
        const inspector = new ContractInspector(cliPath, source, network, rpcUrl, networkPassphrase);

        if (!functionName) {
            const contractFunctions = await inspector.getContractFunctions(contractId);

            if (contractFunctions.length > 0) {
                const functionItems = contractFunctions.map(fn => ({
                    label: fn.name,
                    description: fn.description || '',
                    detail: fn.parameters.length > 0
                        ? `Parameters: ${fn.parameters.map(p => p.name).join(', ')}`
                        : 'No parameters'
                }));

                const selected = await vscode.window.showQuickPick(functionItems, {
                    placeHolder: 'Select a function to run'
                });

                if (!selected) return;
                selectedFunction = contractFunctions.find(f => f.name === selected.label) || null;
                functionName = selected.label;
            } else {
                const input = await vscode.window.showInputBox({
                    prompt: 'Enter the function name to call',
                    placeHolder: 'e.g., hello'
                });
                if (!input) return;
                functionName = input;
                selectedFunction = await inspector.getFunctionHelp(contractId, functionName);
            }
        } else {
            // Function name passed from UI
            selectedFunction = await inspector.getFunctionHelp(contractId, functionName);
        }

        let invokeArgs: any[] = [];
        if (selectedFunction && selectedFunction.parameters.length > 0) {
            const argsObj: any = {};
            for (const param of selectedFunction.parameters) {
                const paramValue = await vscode.window.showInputBox({
                    prompt: `Enter value for ${param.name}${param.type ? ` (${param.type})` : ''}`,
                    placeHolder: param.description || `Value for ${param.name}`,
                    validateInput: (val) => (param.required && !val ? `${param.name} is required` : null)
                });
                if (param.required && paramValue === undefined) return;
                if (paramValue !== undefined && paramValue.trim().length > 0) {
                    try { argsObj[param.name] = JSON.parse(paramValue); }
                    catch { argsObj[param.name] = paramValue; }
                }
            }
            invokeArgs = [argsObj];
        } else if (functionName) {
            const manualArgs = await vscode.window.showInputBox({
                prompt: `Enter arguments for "${functionName}" as JSON object`,
                placeHolder: 'e.g., {"name": "world"}',
                value: '{}'
            });
            if (manualArgs === undefined) return;
            try {
                const parsed = JSON.parse(manualArgs || '{}');
                invokeArgs = [parsed];
            } catch (e) {
                vscode.window.showErrorMessage('Invalid JSON arguments. Using empty arguments.');
                invokeArgs = [{}];
            }
        }

        const panel = SimulationPanel.createOrShow(context);
        panel.updateResults(
            { success: false, error: 'Running simulation...', type: 'invocation' },
            contractId,
            functionName,
            invokeArgs
        );

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Executing Live Soroban Invocation',
                cancellable: false
            },
            async (progress) => {
                progress.report({ message: 'Submitting transaction...' });

                const cliService = new SorobanCliService(cliPath, source, rpcUrl, networkPassphrase);
                const result = await cliService.simulateTransaction(contractId || '', functionName, invokeArgs, network, true);

                panel.updateResults(result, contractId || '', functionName, invokeArgs);

                if (result.success) {
                    vscode.window.showInformationMessage('Live invocation completed successfully!');
                } else {
                    vscode.window.showErrorMessage(`Live invocation failed: ${result.error}`);
                }
            }
        );
    } catch (error) {
        const formatted = formatError(error, 'Invocation');
        vscode.window.showErrorMessage(`${formatted.title}: ${formatted.message}`);
    }
}
