import * as vscode from 'vscode';
import { SorobanCliService } from '../services/sorobanCliService';
import { RpcService } from '../services/rpcService';
import { ContractInspector, ContractFunction } from '../services/contractInspector';
import { WorkspaceDetector } from '../utils/workspaceDetector';
import { SimulationPanel } from '../ui/simulationPanel';
import { SidebarViewProvider } from '../ui/sidebarView';
import { parseFunctionArgs } from '../utils/jsonParser';
import { formatError } from '../utils/errorFormatter';

export async function simulateTransaction(context: vscode.ExtensionContext, sidebarProvider?: SidebarViewProvider, args?: any) {
    try {
        const config = vscode.workspace.getConfiguration('stellarSuite');
        const useLocalCli = config.get<boolean>('useLocalCli', true);
        const cliPath = config.get<string>('cliPath', 'stellar');
        const source = config.get<string>('source', 'dev');
        const network = config.get<string>('network', 'testnet') || 'testnet';
        const rpcUrl = config.get<string>('rpcUrl', 'https://soroban-testnet.stellar.org:443');
        const networkPassphrase = config.get<string>('networkPassphrase', 'Test SDF Network ; September 2015');
        
        const selectedContractId = args?.contractId || context.workspaceState.get<string>('selectedContractId');
        const lastContractId = context.workspaceState.get<string>('lastContractId');

        let contractId: string | undefined = selectedContractId;
        const passedFunctionName = args?.functionName;

        if (args?.contractId) {
            // Use directly
        } else if (selectedContractId) {
            // Clear it so manual command palette invocation doesn't use it
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
            } catch (error) {
            }

            contractId = await vscode.window.showInputBox({
                prompt: 'Enter the contract ID (address)',
                placeHolder: defaultContractId || 'e.g., C...',
                value: defaultContractId,
                validateInput: (value: string) => {
                    if (!value || value.trim().length === 0) {
                        return 'Contract ID is required';
                    }
                    if (!value.match(/^C[A-Z0-9]{55}$/)) {
                        return 'Invalid contract ID format (should start with C and be 56 characters)';
                    }
                    return null;
                }
            });
        }

        if (!contractId) {
            return;
        }

        let contractFunctions: ContractFunction[] = [];
        let selectedFunction: ContractFunction | null = null;
        let functionName = passedFunctionName || '';

        if (!functionName) {
            if (useLocalCli) {
                const inspector = new ContractInspector(cliPath, source, network, rpcUrl, networkPassphrase);
                try {
                    contractFunctions = await inspector.getContractFunctions(contractId);
                } catch (error) {
                }
            }

            if (contractFunctions.length > 0) {
                const functionItems = contractFunctions.map(fn => ({
                    label: fn.name,
                    description: fn.description || '',
                    detail: fn.parameters.length > 0 
                        ? `Parameters: ${fn.parameters.map(p => p.name).join(', ')}`
                        : 'No parameters'
                }));

                const selected = await vscode.window.showQuickPick(functionItems, {
                    placeHolder: 'Select a function to invoke'
                });

                if (!selected) {
                    return;
                }

                selectedFunction = contractFunctions.find(f => f.name === selected.label) || null;
                functionName = selected.label;
            } else {
                const input = await vscode.window.showInputBox({
                    prompt: 'Enter the function name to call',
                    placeHolder: 'e.g., hello',
                    validateInput: (value: string) => {
                        if (!value || value.trim().length === 0) {
                            return 'Function name is required';
                        }
                        return null;
                    }
                });

                if (!input) {
                    return;
                }

                functionName = input;

                if (useLocalCli) {
                    const inspector = new ContractInspector(cliPath, source, network, rpcUrl, networkPassphrase);
                    selectedFunction = await inspector.getFunctionHelp(contractId, functionName);
                }
            }
        } else if (useLocalCli) {
            const inspector = new ContractInspector(cliPath, source, network, rpcUrl, networkPassphrase);
            selectedFunction = await inspector.getFunctionHelp(contractId, functionName);
        }

        let txArgs: any[] = [];
        
        if (selectedFunction && selectedFunction.parameters.length > 0) {
            const argsObj: any = {};
            
            for (const param of selectedFunction.parameters) {
                const paramValue = await vscode.window.showInputBox({
                    prompt: `Enter value for parameter: ${param.name}${param.type ? ` (${param.type})` : ''}${param.required ? '' : ' (optional)'}`,
                    placeHolder: param.description || `Value for ${param.name}`,
                    ignoreFocusOut: !param.required,
                    validateInput: (value: string) => {
                        if (param.required && (!value || value.trim().length === 0)) {
                            return `${param.name} is required`;
                        }
                        return null;
                    }
                });

                if (param.required && paramValue === undefined) {
                    return;
                }

                if (paramValue !== undefined && paramValue.trim().length > 0) {
                    try {
                        argsObj[param.name] = JSON.parse(paramValue);
                    } catch {
                        argsObj[param.name] = paramValue;
                    }
                }
            }

            txArgs = [argsObj];
        } else {
            // We have a function name but no metadata (or no parameters found)
            // Prompt for JSON arguments as a fallback
            const argsInput = await vscode.window.showInputBox({
                prompt: `Enter arguments for "${functionName}" as JSON object (e.g., {"name": "value"})`,
                placeHolder: 'e.g., {"name": "world"}',
                value: '{}'
            });

            if (argsInput === undefined) {
                return;
            }

            try {
                const parsed = JSON.parse(argsInput || '{}');
                if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null) {
                    txArgs = [parsed];
                } else {
                    vscode.window.showErrorMessage('Arguments must be a JSON object');
                    return;
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}. Using empty arguments.`);
                txArgs = [{}];
            }
        }


        const panel = SimulationPanel.createOrShow(context);
        panel.updateResults(
            { success: false, error: 'Running simulation...', type: 'simulation' },
            contractId,
            functionName,
            txArgs
        );

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Simulating Soroban Transaction',
                cancellable: false
            },
            async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
                progress.report({ increment: 0, message: 'Initializing...' });

                let result;

                if (useLocalCli) {
                    progress.report({ increment: 30, message: 'Using Stellar CLI...' });
                    
                    let actualCliPath = cliPath;
                    let cliService = new SorobanCliService(actualCliPath, source, rpcUrl, networkPassphrase);
                    
                    let cliAvailable = await cliService.isAvailable();
                    
                    if (!cliAvailable && cliPath === 'stellar') {
                        progress.report({ increment: 35, message: 'Auto-detecting Stellar CLI...' });
                        const foundPath = await SorobanCliService.findCliPath();
                        if (foundPath) {
                            actualCliPath = foundPath;
                            cliService = new SorobanCliService(actualCliPath, source, rpcUrl, networkPassphrase);
                            cliAvailable = await cliService.isAvailable();
                        }
                    }
                    
                    if (!cliAvailable) {
                        const foundPath = await SorobanCliService.findCliPath();
                        const suggestion = foundPath 
                            ? `\n\nFound Stellar CLI at: ${foundPath}\nUpdate your stellarSuite.cliPath setting to: "${foundPath}"`
                            : '\n\nCommon locations:\n- ~/.cargo/bin/stellar\n- /usr/local/bin/stellar\n\nOr install Stellar CLI: https://developers.stellar.org/docs/tools/cli';
                        
                        result = {
                            success: false,
                            error: `Stellar CLI not found at "${cliPath}".${suggestion}`
                        };
                    } else {
                        progress.report({ increment: 40, message: 'Building transaction XDR...' });
                        try {
                            const txXdr = await cliService.buildTransaction(contractId, functionName, txArgs, network);
                            
                            progress.report({ increment: 60, message: 'Fetching rich simulation data from RPC...' });
                            const rpcService = new RpcService(rpcUrl);
                            const rpcResult = await rpcService.simulateTransactionFromXdr(txXdr);
                            
                            progress.report({ increment: 80, message: 'Executing local simulation for return value...' });
                            const cliResult = await cliService.simulateTransaction(contractId, functionName, txArgs, network);
                            
                            if (cliResult.success) {
                                // Combine the rich RPC data (Events, Auth, minResourceFee) with the beautifully formatted CLI return value
                                result = {
                                    ...rpcResult,
                                    success: true,
                                    result: cliResult.result
                                };
                            } else {
                                // If CLI execution failed, return the CLI error
                                result = cliResult;
                            }
                        } catch (e: any) {
                            result = {
                                success: false,
                                error: e.message || String(e)
                            };
                        }
                        
                        if (sidebarProvider) {
                            const argsStr = txArgs.length > 0 ? JSON.stringify(txArgs) : '';
                            sidebarProvider.addCliHistoryEntry('stellar contract invoke', ['--id', contractId, '--source', source, '--network', network, '--', functionName, argsStr].filter(Boolean));
                        }
                    }
                } else {
                    result = {
                        success: false,
                        error: 'Simulation without Stellar CLI is not supported. Please enable useLocalCli in settings.'
                    };
                }

                progress.report({ increment: 100, message: 'Complete' });

                panel.updateResults(result, contractId, functionName, txArgs);

                if (sidebarProvider) {
                    sidebarProvider.showSimulationResult(contractId, result);
                }

                if (result.success) {
                    vscode.window.showInformationMessage('Simulation completed successfully');
                } else {
                    vscode.window.showErrorMessage(`Simulation failed: ${result.error}`);
                }
            }
        );
    } catch (error) {
        const formatted = formatError(error, 'Simulation');
        vscode.window.showErrorMessage(`${formatted.title}: ${formatted.message}`);
    }
}
