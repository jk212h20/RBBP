/**
 * Voltage LND Node Integration Service
 * 
 * This service communicates with a Voltage-hosted LND node via REST API
 * to pay Lightning invoices for withdrawals.
 */

const VOLTAGE_REST_HOST = process.env.VOLTAGE_REST_HOST || '';
const VOLTAGE_MACAROON = process.env.VOLTAGE_MACAROON || '';

interface LndInfo {
  identity_pubkey: string;
  alias: string;
  num_active_channels: number;
  num_peers: number;
  block_height: number;
  synced_to_chain: boolean;
}

interface ChannelBalance {
  balance: string;
  pending_open_balance: string;
  local_balance?: { sat: string };
  remote_balance?: { sat: string };
}

interface PaymentResponse {
  payment_hash: string;
  payment_preimage: string;
  payment_route: {
    total_amt: string;
    total_fees: string;
  };
  payment_error?: string;
}

interface DecodedInvoice {
  destination: string;
  payment_hash: string;
  num_satoshis: string;
  timestamp: string;
  expiry: string;
  description: string;
  description_hash: string;
  fallback_addr: string;
  cltv_expiry: string;
}

/**
 * Check if Voltage is configured
 */
export function isVoltageConfigured(): boolean {
  return !!(VOLTAGE_REST_HOST && VOLTAGE_MACAROON);
}

/**
 * Make authenticated request to Voltage LND REST API
 */
async function lndRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: object
): Promise<T> {
  if (!isVoltageConfigured()) {
    throw new Error('Voltage LND not configured. Set VOLTAGE_REST_HOST and VOLTAGE_MACAROON.');
  }

  const url = `${VOLTAGE_REST_HOST}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Grpc-Metadata-macaroon': VOLTAGE_MACAROON,
    'Content-Type': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`[Voltage] ${method} ${endpoint}`);

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Voltage] Error: ${response.status} - ${errorText}`);
    throw new Error(`LND API error: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Get node info to verify connection
 */
export async function getNodeInfo(): Promise<LndInfo> {
  return lndRequest<LndInfo>('/v1/getinfo');
}

/**
 * Get channel balance (available for sending)
 */
export async function getChannelBalance(): Promise<{ balanceSats: number; pendingSats: number }> {
  const balance = await lndRequest<ChannelBalance>('/v1/balance/channels');
  
  return {
    balanceSats: parseInt(balance.local_balance?.sat || balance.balance || '0', 10),
    pendingSats: parseInt(balance.pending_open_balance || '0', 10),
  };
}

/**
 * Decode a BOLT11 invoice to get details
 */
export async function decodeInvoice(paymentRequest: string): Promise<DecodedInvoice> {
  return lndRequest<DecodedInvoice>(`/v1/payreq/${paymentRequest}`);
}

/**
 * Pay a BOLT11 invoice
 * 
 * @param paymentRequest - The BOLT11 invoice string
 * @param amountSats - Optional amount (for zero-amount invoices)
 * @returns Payment result with hash and preimage
 */
export async function payInvoice(
  paymentRequest: string,
  amountSats?: number
): Promise<{ success: boolean; paymentHash?: string; preimage?: string; error?: string }> {
  try {
    // First decode the invoice to verify amount
    const decoded = await decodeInvoice(paymentRequest);
    const invoiceAmountSats = parseInt(decoded.num_satoshis, 10);
    
    console.log(`[Voltage] Paying invoice: ${invoiceAmountSats} sats to ${decoded.destination.substring(0, 16)}...`);

    // If invoice has amount, verify it matches expected
    if (amountSats && invoiceAmountSats > 0 && invoiceAmountSats !== amountSats) {
      return {
        success: false,
        error: `Invoice amount (${invoiceAmountSats}) doesn't match expected (${amountSats})`,
      };
    }

    // Check we have enough balance
    const { balanceSats } = await getChannelBalance();
    const amountToPay = invoiceAmountSats || amountSats || 0;
    
    if (balanceSats < amountToPay) {
      return {
        success: false,
        error: `Insufficient balance. Have ${balanceSats} sats, need ${amountToPay} sats`,
      };
    }

    // Pay the invoice
    const paymentBody: { payment_request: string; amt?: string } = {
      payment_request: paymentRequest,
    };

    // For zero-amount invoices, specify the amount
    if (invoiceAmountSats === 0 && amountSats) {
      paymentBody.amt = amountSats.toString();
    }

    const result = await lndRequest<PaymentResponse>('/v1/channels/transactions', 'POST', paymentBody);

    if (result.payment_error) {
      console.error(`[Voltage] Payment failed: ${result.payment_error}`);
      return {
        success: false,
        error: result.payment_error,
      };
    }

    console.log(`[Voltage] Payment successful! Hash: ${result.payment_hash}`);
    
    return {
      success: true,
      paymentHash: result.payment_hash,
      preimage: result.payment_preimage,
    };
  } catch (error) {
    console.error('[Voltage] Payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown payment error',
    };
  }
}

/**
 * Verify the Voltage connection is working
 */
export async function verifyConnection(): Promise<{ connected: boolean; nodeAlias?: string; error?: string }> {
  if (!isVoltageConfigured()) {
    return { connected: false, error: 'Voltage not configured' };
  }

  try {
    const info = await getNodeInfo();
    return {
      connected: true,
      nodeAlias: info.alias,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
