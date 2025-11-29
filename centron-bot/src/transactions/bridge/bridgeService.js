/**
 * Create a bridge transaction using ChangeNOW API
 */
export async function createChangeNowBridge(fromCurrency, toCurrency, amount, userSuiAddress) {
    // CRITICAL: Validate userSuiAddress is provided
    if (!userSuiAddress) {
        console.error('❌ userSuiAddress is required but was undefined/null');
        throw new Error('User SUI address is required for bridge transaction');
    }

    const CHANGENOW_API_KEY = process.env.CHANGENOW_API_KEY;

    if (!CHANGENOW_API_KEY) {
        console.error('❌ ChangeNOW API key is missing!');
        throw new Error('ChangeNOW API key not configured');
    }

    // Map your currency codes to ChangeNOW ticker symbols
    const currencyMap = {
        'SOL': 'sol',
        'ETH': 'eth',
        'BTC': 'btc',
        'SUI': 'sui'
    };

    const fromTicker = currencyMap[fromCurrency];
    const toTicker = currencyMap[toCurrency];

    if (!fromTicker || !toTicker) {
        console.error('❌ Unsupported currency mapping:', { fromCurrency, toCurrency });
        throw new Error(`Unsupported currency: ${fromCurrency} or ${toCurrency}`);
    }

    // Validate amount
    if (!amount || amount <= 0) {
        console.error('❌ Invalid amount:', amount);
        throw new Error('Amount must be greater than 0');
    }

    // Create the exchange transaction
    const createPayload = {
        fromCurrency: fromTicker,
        toCurrency: toTicker,
        fromNetwork: fromTicker,
        toNetwork: toTicker,
        fromAmount: amount.toString(),
        address: userSuiAddress,
        flow: 'standard',
        type: 'direct'
    };

    try {
        const createResponse = await fetch(
            'https://api.changenow.io/v2/exchange',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-changenow-api-key': CHANGENOW_API_KEY
                },
                body: JSON.stringify(createPayload)
            }
        );

        // Check response before parsing
        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('❌ ChangeNOW API Error:');
            console.error('Status:', createResponse.status);
            console.error('Response Body:', errorText);
            
            let errorMessage = `ChangeNOW API error (${createResponse.status})`;
            try {
                const errorJson = JSON.parse(errorText);
                // 👇 Better error message extraction
                errorMessage = errorJson.message || errorJson.error || `${errorMessage}: ${errorText.slice(0, 100)}`;
                console.error('Parsed Error:', errorJson);
            } catch (e) {
                console.error('Could not parse error as JSON');
                errorMessage = `${errorMessage}: ${errorText.slice(0, 100)}`; // 👈 Include raw error text
            }
            
            throw new Error(errorMessage);
        }

        const transaction = await createResponse.json();

        // Validate response structure
        if (!transaction.payinAddress) {
            console.error('❌ Missing payinAddress in response');
            console.error('Full transaction object:', transaction);
            throw new Error(transaction.message || 'Failed to create transaction - no payin address');
        }

        const result = {
            id: transaction.id,
            payinAddress: transaction.payinAddress,
            status: transaction.status || 'new',
            amountTo: transaction.toAmount,
            fromAmount: transaction.fromAmount || amount,
            fromCurrency: transaction.fromCurrency || fromCurrency,
            toCurrency: transaction.toCurrency || toCurrency,
            fromNetwork: transaction.fromNetwork,
            toNetwork: transaction.toNetwork
        };

        return result;

    } catch (error) {
        console.error('❌ ERROR in createChangeNowBridge:');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('=== Bridge Transaction Failed ===\n');
        throw error;
    }
}

/**
 * Get the status of a bridge transaction
 */
export async function getBridgeTransactionStatus(transactionId) {
    
    const CHANGENOW_API_KEY = process.env.CHANGENOW_API_KEY;

    if (!CHANGENOW_API_KEY) {
        throw new Error('ChangeNOW API key not configured');
    }

    try {
        const response = await fetch(
            `https://api.changenow.io/v2/exchange/by-id?id=${transactionId}`,
            {
                method: 'GET',
                headers: {
                    'x-changenow-api-key': CHANGENOW_API_KEY
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Status check failed:', errorText);
            throw new Error(`Failed to get transaction status: ${response.status}`);
        }

        const status = await response.json();

        return status;

    } catch (error) {
        console.error('❌ Error checking transaction status:', error);
        throw error;
    }
}