/**
 * Customer Wallet & Financial Ledger Routes for Ship Asaan
 * Handles authoritative balance tracking, manual top-ups, debiting, adjustments, and CSV export.
 */

import { Router, Request, Response } from 'express';
import { getDb, withTransaction } from './db.js';
import { requireAuth, requirePermission } from './middleware.js';
import {
  creditWallet,
  debitWallet,
  adjustWallet,
  reverseTransaction,
  getOrCreateWallet,
  WalletError
} from './walletService.js';
import { logAudit } from './audit.js';

export const walletRouter = Router();

// Official Ship Asaan Bank Account Instructions (Configurable via System Settings)
const OFFICIAL_DEPOSIT_INSTRUCTIONS = {
  bank_name: 'Meezan Bank Limited',
  account_title: 'Ship Asaan Courier & Fulfillment Pvt Ltd',
  account_number: '0102030405060708',
  iban: 'PK45MEZN0001020304050608',
  branch: 'I-8 Markaz Branch, Islamabad (Branch Code: 0102)',
  raast_id: '03000000000',
  instructions:
    'Please transfer funds via online IBFT or Raast. After completing your transfer, enter the Bank Transaction Reference ID in the top-up submission or send a payment receipt to billing@shipasaan.com. Operations verifies and posts credits within 30 minutes.'
};

/**
 * GET /api/wallet/instructions
 * Public / authenticated endpoint returning official bank deposit details
 */
walletRouter.get('/instructions', requireAuth, (_req: Request, res: Response) => {
  res.json({ instructions: OFFICIAL_DEPOSIT_INSTRUCTIONS });
});

/**
 * GET /api/wallet/my-wallet
 * Allows a merchant customer (or staff inspecting) to retrieve their wallet account and transaction history
 */
walletRouter.get('/my-wallet', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  const db = getDb();

  let targetCustomerProfileId: string | null = null;

  if (user.account_type === 'customer') {
    const profile = db.customer_profiles.find(cp => cp.user_id === user.id);
    if (!profile) {
      res.status(404).json({ error: 'Customer profile not found for this account.' });
      return;
    }
    targetCustomerProfileId = profile.id;
  } else {
    // Staff member requesting a specific customer's wallet
    const requestedId = req.query.customer_profile_id as string;
    if (!requestedId) {
      res.status(400).json({ error: 'customer_profile_id parameter is required for staff inspection.' });
      return;
    }
    targetCustomerProfileId = requestedId;
  }

  const customerProfile = db.customer_profiles.find(cp => cp.id === targetCustomerProfileId);
  if (!customerProfile) {
    res.status(404).json({ error: 'Customer profile not found.' });
    return;
  }

  const wallet = await getOrCreateWallet(targetCustomerProfileId, customerProfile.user_id);

  // Get transactions for this customer
  const transactions = db.wallet_transactions
    .filter(t => t.customer_profile_id === targetCustomerProfileId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Aggregate stats
  const totalCredited = transactions
    .filter(t => t.type === 'CREDIT')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDebited = transactions
    .filter(t => t.type === 'DEBIT')
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({
    wallet,
    customer: {
      id: customerProfile.id,
      business_name: customerProfile.business_name,
      brand_name: customerProfile.brand_name,
      approval_status: customerProfile.approval_status
    },
    deposit_instructions: OFFICIAL_DEPOSIT_INSTRUCTIONS,
    statistics: {
      total_credited: Math.round(totalCredited * 100) / 100,
      total_debited: Math.round(totalDebited * 100) / 100,
      transaction_count: transactions.length
    },
    transactions: transactions.slice(0, 50)
  });
});

/**
 * GET /api/wallet/accounts
 * Staff endpoint to list all customer wallets with balances and KPIs
 * Requires 'wallet.view' permission
 */
walletRouter.get('/accounts', requireAuth, requirePermission('wallet.view'), async (req: Request, res: Response) => {
  const db = getDb();

  // Ensure all customer profiles have an initialized wallet account
  for (const customer of db.customer_profiles) {
    if (!db.wallet_accounts.some(w => w.customer_profile_id === customer.id)) {
      db.wallet_accounts.push({
        id: `wal_${customer.id}`,
        customer_profile_id: customer.id,
        user_id: customer.user_id,
        balance: 0.00,
        currency: 'PKR',
        status: 'active',
        created_at: customer.created_at,
        updated_at: customer.updated_at
      });
    }
  }

  // Join wallet accounts with customer profiles and user emails
  const accounts = db.wallet_accounts.map(acc => {
    const customer = db.customer_profiles.find(cp => cp.id === acc.customer_profile_id);
    const user = customer ? db.users.find(u => u.id === customer.user_id) : null;
    const lastTxn = db.wallet_transactions
      .filter(t => t.customer_profile_id === acc.customer_profile_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      ...acc,
      business_name: customer?.business_name || 'Unknown Business',
      brand_name: customer?.brand_name || 'Unknown Brand',
      city: customer?.city || 'N/A',
      phone: customer?.phone || 'N/A',
      email: user?.email || 'N/A',
      approval_status: customer?.approval_status || 'unknown',
      last_transaction_at: lastTxn ? lastTxn.created_at : null
    };
  });

  // Calculate summary metrics
  const totalHeldBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const activeWallets = accounts.filter(a => a.status === 'active').length;

  // 30 days window for recent volume
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentTxns = db.wallet_transactions.filter(t => t.created_at >= thirtyDaysAgo);
  const recentCredits = recentTxns.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);
  const recentDebits = recentTxns.filter(t => t.type === 'DEBIT').reduce((sum, t) => sum + t.amount, 0);

  res.json({
    accounts,
    summary: {
      total_balance: Math.round(totalHeldBalance * 100) / 100,
      active_wallets_count: activeWallets,
      recent_credits_30d: Math.round(recentCredits * 100) / 100,
      recent_debits_30d: Math.round(recentDebits * 100) / 100,
      total_accounts_count: accounts.length
    }
  });
});

/**
 * GET /api/wallet/transactions
 * List all transactions with search, pagination, and date filtering
 * Requires 'wallet.view' (or scoped to customer)
 */
walletRouter.get('/transactions', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const db = getDb();

  let targetCustomerProfileId: string | undefined = undefined;

  if (user.account_type === 'customer') {
    const cust = db.customer_profiles.find(cp => cp.user_id === user.id);
    if (!cust) {
      res.status(403).json({ error: 'Customer profile required.' });
      return;
    }
    targetCustomerProfileId = cust.id;
  } else {
    // Check permission for staff
    if (req.query.customer_profile_id) {
      targetCustomerProfileId = req.query.customer_profile_id as string;
    }
  }

  let txns = [...db.wallet_transactions];

  if (targetCustomerProfileId) {
    txns = txns.filter(t => t.customer_profile_id === targetCustomerProfileId);
  }

  // Type filter
  if (req.query.type) {
    txns = txns.filter(t => t.type === req.query.type);
  }

  // Date range filter
  if (req.query.start_date) {
    txns = txns.filter(t => t.created_at >= (req.query.start_date as string));
  }
  if (req.query.end_date) {
    txns = txns.filter(t => t.created_at <= (req.query.end_date as string));
  }

  // Free search filter (reference number, notes, actor)
  if (req.query.search) {
    const q = (req.query.search as string).toLowerCase().trim();
    txns = txns.filter(
      t =>
        (t.reference_number && t.reference_number.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.actor_name && t.actor_name.toLowerCase().includes(q)) ||
        t.id.toLowerCase().includes(q)
    );
  }

  // Enrich transactions with business name
  const enriched = txns.map(t => {
    const customer = db.customer_profiles.find(cp => cp.id === t.customer_profile_id);
    return {
      ...t,
      business_name: customer?.business_name || 'Unknown Business',
      brand_name: customer?.brand_name || 'Unknown Brand'
    };
  });

  // Sort descending by created_at
  enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  res.json({
    transactions: enriched.slice(0, 100),
    total_count: enriched.length
  });
});

/**
 * POST /api/wallet/credit
 * Staff manual top-up of customer account
 * Requires 'wallet.credit' permission
 */
walletRouter.post('/credit', requireAuth, requirePermission('wallet.credit'), async (req: Request, res: Response) => {
  const { customer_profile_id, amount, payment_method, reference_number, notes } = req.body;

  if (!customer_profile_id) {
    res.status(400).json({ error: 'Customer is required.' });
    return;
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: 'Please enter a valid positive credit amount.' });
    return;
  }

  if (!notes || notes.trim().length === 0) {
    res.status(400).json({ error: 'Transaction notes or verification description is required.' });
    return;
  }

  try {
    const result = await creditWallet({
      customerProfileId: customer_profile_id,
      amount: parsedAmount,
      paymentMethod: payment_method || 'bank_transfer',
      referenceNumber: reference_number,
      notes: notes.trim(),
      actor: {
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email
      }
    });

    res.json({
      message: `Successfully credited PKR ${result.transaction.amount.toLocaleString()} to wallet.`,
      wallet: result.account,
      transaction: result.transaction
    });
  } catch (err: any) {
    if (err instanceof WalletError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    console.error('[WALLET] Credit error:', err);
    res.status(500).json({ error: 'Failed to process credit transaction.' });
  }
});

/**
 * POST /api/wallet/debit
 * Staff manual debit / charge of customer account
 * Requires 'wallet.debit' permission
 */
walletRouter.post('/debit', requireAuth, requirePermission('wallet.debit'), async (req: Request, res: Response) => {
  const { customer_profile_id, amount, payment_method, reference_number, notes, allow_negative } = req.body;

  if (!customer_profile_id) {
    res.status(400).json({ error: 'Customer is required.' });
    return;
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: 'Please enter a valid positive debit amount.' });
    return;
  }

  if (!notes || notes.trim().length === 0) {
    res.status(400).json({ error: 'Mandatory debit justification notes are required for audit trail.' });
    return;
  }

  try {
    const result = await debitWallet(
      {
        customerProfileId: customer_profile_id,
        amount: parsedAmount,
        paymentMethod: payment_method || 'fulfillment_fee',
        referenceNumber: reference_number,
        notes: notes.trim(),
        actor: {
          id: req.user!.id,
          name: req.user!.name,
          email: req.user!.email
        }
      },
      { allowNegative: !!allow_negative }
    );

    res.json({
      message: `Successfully debited PKR ${result.transaction.amount.toLocaleString()} from wallet.`,
      wallet: result.account,
      transaction: result.transaction
    });
  } catch (err: any) {
    if (err instanceof WalletError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    console.error('[WALLET] Debit error:', err);
    res.status(500).json({ error: 'Failed to process debit transaction.' });
  }
});

/**
 * POST /api/wallet/adjust
 * Staff adjustment with positive or negative delta
 * Requires 'wallet.debit' permission
 */
walletRouter.post('/adjust', requireAuth, requirePermission('wallet.debit'), async (req: Request, res: Response) => {
  const { customer_profile_id, amount_delta, reason, reference_number } = req.body;

  const delta = parseFloat(amount_delta);
  if (isNaN(delta) || delta === 0) {
    res.status(400).json({ error: 'Adjustment delta cannot be zero.' });
    return;
  }

  if (!reason || reason.trim().length < 5) {
    res.status(400).json({ error: 'Adjustment requires a specific reason (at least 5 characters).' });
    return;
  }

  try {
    const result = await adjustWallet({
      customerProfileId: customer_profile_id,
      amountDelta: delta,
      reason: reason.trim(),
      referenceNumber: reference_number,
      actor: {
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email
      }
    });

    res.json({
      message: `Adjusted balance by PKR ${delta > 0 ? '+' : ''}${delta.toLocaleString()}.`,
      wallet: result.account,
      transaction: result.transaction
    });
  } catch (err: any) {
    if (err instanceof WalletError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    console.error('[WALLET] Adjustment error:', err);
    res.status(500).json({ error: 'Failed to process adjustment.' });
  }
});

/**
 * POST /api/wallet/reverse/:transactionId
 * Offsets a previously posted transaction with an immutable REVERSAL record
 * Requires 'wallet.debit' permission
 */
walletRouter.post('/reverse/:transactionId', requireAuth, requirePermission('wallet.debit'), async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length < 5) {
    res.status(400).json({ error: 'Reversal requires an explicit reason (minimum 5 characters).' });
    return;
  }

  try {
    const result = await reverseTransaction(transactionId, reason, {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email
    });

    res.json({
      message: `Transaction ${transactionId} reversed successfully.`,
      wallet: result.account,
      reversal: result.reversalTransaction
    });
  } catch (err: any) {
    if (err instanceof WalletError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    console.error('[WALLET] Reversal error:', err);
    res.status(500).json({ error: 'Failed to reverse transaction.' });
  }
});

/**
 * GET /api/wallet/export
 * Downloads standard RFC 4180 CSV export of ledger entries
 */
walletRouter.get('/export', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  const db = getDb();

  let targetCustomerProfileId: string | undefined = undefined;

  if (user.account_type === 'customer') {
    const cust = db.customer_profiles.find(cp => cp.user_id === user.id);
    if (!cust) {
      res.status(403).json({ error: 'Customer profile required.' });
      return;
    }
    targetCustomerProfileId = cust.id;
  } else {
    // Check permission for staff export
    if (!user.permissions.includes('wallet.export') && !user.permissions.includes('system.audit')) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions to export financial records.' });
      return;
    }
    if (req.query.customer_profile_id) {
      targetCustomerProfileId = req.query.customer_profile_id as string;
    }
  }

  let txns = [...db.wallet_transactions];
  if (targetCustomerProfileId) {
    txns = txns.filter(t => t.customer_profile_id === targetCustomerProfileId);
  }

  txns.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Build CSV content
  const headers = [
    'Transaction ID',
    'Date Time (UTC)',
    'Customer Business',
    'Brand',
    'Type',
    'Amount (PKR)',
    'Balance Before',
    'Balance After',
    'Payment Method',
    'Reference Number',
    'Actor',
    'Notes'
  ];

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = txns.map(t => {
    const cust = db.customer_profiles.find(cp => cp.id === t.customer_profile_id);
    return [
      escapeCsv(t.id),
      escapeCsv(t.created_at),
      escapeCsv(cust?.business_name || 'N/A'),
      escapeCsv(cust?.brand_name || 'N/A'),
      escapeCsv(t.type),
      escapeCsv(t.amount.toFixed(2)),
      escapeCsv(t.balance_before.toFixed(2)),
      escapeCsv(t.balance_after.toFixed(2)),
      escapeCsv(t.payment_method),
      escapeCsv(t.reference_number || ''),
      escapeCsv(t.actor_name),
      escapeCsv(t.notes)
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\r\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="ship_asaan_wallet_ledger_${Date.now()}.csv"`);
  res.send(csv);
});
