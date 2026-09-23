/**
 * Authoritative Wallet & Financial Ledger Service for Ship Asaan
 * Concurrency-safe balance mutations, immutable transaction journaling, and audit compliance.
 */

import { withTransaction, getDb, WalletAccountRow, WalletTransactionRow, DatabaseSchema } from './db.js';
import { generateId } from './security.js';
import { logAudit } from './audit.js';

export interface WalletTransactionInput {
  customerProfileId: string;
  amount: number;
  paymentMethod: WalletTransactionRow['payment_method'];
  referenceNumber?: string;
  notes: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
}

export interface WalletAdjustmentInput {
  customerProfileId: string;
  amountDelta: number; // Positive = credit, Negative = debit
  reason: string;
  referenceNumber?: string;
  actor: {
    id: string;
    name: string;
    email: string;
  };
}

export class WalletError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'WalletError';
  }
}

/**
 * Normalizes monetary amounts to 2 decimal places to prevent floating point inaccuracies
 */
export function roundToTwoDecimals(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Finds or idempotently initializes a customer's primary wallet account
 */
export async function getOrCreateWallet(
  customerProfileId: string,
  userId?: string,
  existingDb?: DatabaseSchema
): Promise<WalletAccountRow> {
  const runner = async (db: DatabaseSchema): Promise<WalletAccountRow> => {
    let account = db.wallet_accounts.find(w => w.customer_profile_id === customerProfileId);
    if (!account) {
      // Find user_id if not supplied
      let resolvedUserId = userId;
      if (!resolvedUserId) {
        const cust = db.customer_profiles.find(cp => cp.id === customerProfileId);
        if (cust) resolvedUserId = cust.user_id;
        else resolvedUserId = 'usr_unknown';
      }

      account = {
        id: generateId('wal'),
        customer_profile_id: customerProfileId,
        user_id: resolvedUserId,
        balance: 0.00,
        currency: 'PKR',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.wallet_accounts.push(account);
    }
    return account;
  };

  if (existingDb) {
    return runner(existingDb);
  }
  return withTransaction(runner);
}

/**
 * Credits a customer wallet account with positive funds
 */
export async function creditWallet(
  input: WalletTransactionInput
): Promise<{ account: WalletAccountRow; transaction: WalletTransactionRow }> {
  const amount = roundToTwoDecimals(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new WalletError('INVALID_AMOUNT', 'Credit amount must be a positive number greater than zero.');
  }

  if (!input.notes || input.notes.trim().length === 0) {
    throw new WalletError('MISSING_NOTES', 'Transaction notes or deposit description is required.');
  }

  return withTransaction(async (db) => {
    const customer = db.customer_profiles.find(cp => cp.id === input.customerProfileId);
    if (!customer) {
      throw new WalletError('CUSTOMER_NOT_FOUND', `Customer profile '${input.customerProfileId}' not found.`);
    }

    let account = db.wallet_accounts.find(w => w.customer_profile_id === input.customerProfileId);
    if (!account) {
      account = {
        id: generateId('wal'),
        customer_profile_id: input.customerProfileId,
        user_id: customer.user_id,
        balance: 0.00,
        currency: 'PKR',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.wallet_accounts.push(account);
    }

    if (account.status === 'frozen' || account.status === 'suspended') {
      throw new WalletError('ACCOUNT_LOCKED', `Wallet account is ${account.status}. Credits cannot be posted.`);
    }

    const balanceBefore = account.balance;
    const balanceAfter = roundToTwoDecimals(balanceBefore + amount);
    const now = new Date().toISOString();

    account.balance = balanceAfter;
    account.updated_at = now;

    const transaction: WalletTransactionRow = {
      id: generateId('txn'),
      wallet_id: account.id,
      customer_profile_id: input.customerProfileId,
      type: 'CREDIT',
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      payment_method: input.paymentMethod || 'bank_transfer',
      reference_number: input.referenceNumber?.trim() || undefined,
      notes: input.notes.trim(),
      actor_id: input.actor.id,
      actor_name: input.actor.name,
      created_at: now
    };

    db.wallet_transactions.push(transaction);

    await logAudit({
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      action: 'wallet.credit',
      entityType: 'wallet_account',
      entityId: account.id,
      metadata: {
        customer_profile_id: input.customerProfileId,
        business_name: customer.business_name,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_number: input.referenceNumber,
        payment_method: input.paymentMethod,
        transaction_id: transaction.id
      }
    }, db);

    return { account, transaction };
  });
}

/**
 * Debits a customer wallet account
 */
export async function debitWallet(
  input: WalletTransactionInput,
  options: { allowNegative?: boolean } = {}
): Promise<{ account: WalletAccountRow; transaction: WalletTransactionRow }> {
  const amount = roundToTwoDecimals(input.amount);
  if (isNaN(amount) || amount <= 0) {
    throw new WalletError('INVALID_AMOUNT', 'Debit amount must be a positive number greater than zero.');
  }

  if (!input.notes || input.notes.trim().length === 0) {
    throw new WalletError('MISSING_NOTES', 'Debit reason and audit notes are mandatory.');
  }

  return withTransaction(async (db) => {
    const customer = db.customer_profiles.find(cp => cp.id === input.customerProfileId);
    if (!customer) {
      throw new WalletError('CUSTOMER_NOT_FOUND', `Customer profile '${input.customerProfileId}' not found.`);
    }

    let account = db.wallet_accounts.find(w => w.customer_profile_id === input.customerProfileId);
    if (!account) {
      account = {
        id: generateId('wal'),
        customer_profile_id: input.customerProfileId,
        user_id: customer.user_id,
        balance: 0.00,
        currency: 'PKR',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.wallet_accounts.push(account);
    }

    if (account.status === 'frozen' || account.status === 'suspended') {
      throw new WalletError('ACCOUNT_LOCKED', `Wallet account is ${account.status}. Debits cannot be posted.`);
    }

    const balanceBefore = account.balance;
    const balanceAfter = roundToTwoDecimals(balanceBefore - amount);

    if (balanceAfter < 0 && !options.allowNegative) {
      throw new WalletError(
        'INSUFFICIENT_FUNDS',
        `Insufficient funds. Current balance is PKR ${balanceBefore.toLocaleString()}, requested debit is PKR ${amount.toLocaleString()}.`
      );
    }

    const now = new Date().toISOString();
    account.balance = balanceAfter;
    account.updated_at = now;

    const transaction: WalletTransactionRow = {
      id: generateId('txn'),
      wallet_id: account.id,
      customer_profile_id: input.customerProfileId,
      type: 'DEBIT',
      amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      payment_method: input.paymentMethod || 'fulfillment_fee',
      reference_number: input.referenceNumber?.trim() || undefined,
      notes: input.notes.trim(),
      actor_id: input.actor.id,
      actor_name: input.actor.name,
      created_at: now
    };

    db.wallet_transactions.push(transaction);

    await logAudit({
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      action: 'wallet.debit',
      entityType: 'wallet_account',
      entityId: account.id,
      metadata: {
        customer_profile_id: input.customerProfileId,
        business_name: customer.business_name,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_number: input.referenceNumber,
        payment_method: input.paymentMethod,
        transaction_id: transaction.id
      }
    }, db);

    return { account, transaction };
  });
}

/**
 * Performs an authorized financial adjustment (can be positive or negative) with mandatory reasoning
 */
export async function adjustWallet(
  input: WalletAdjustmentInput
): Promise<{ account: WalletAccountRow; transaction: WalletTransactionRow }> {
  const delta = roundToTwoDecimals(input.amountDelta);
  if (isNaN(delta) || delta === 0) {
    throw new WalletError('INVALID_AMOUNT', 'Adjustment delta cannot be zero.');
  }

  if (!input.reason || input.reason.trim().length < 5) {
    throw new WalletError('MISSING_REASON', 'Adjustment requires a detailed explanation (minimum 5 characters).');
  }

  return withTransaction(async (db) => {
    const customer = db.customer_profiles.find(cp => cp.id === input.customerProfileId);
    if (!customer) {
      throw new WalletError('CUSTOMER_NOT_FOUND', `Customer profile '${input.customerProfileId}' not found.`);
    }

    let account = db.wallet_accounts.find(w => w.customer_profile_id === input.customerProfileId);
    if (!account) {
      account = {
        id: generateId('wal'),
        customer_profile_id: input.customerProfileId,
        user_id: customer.user_id,
        balance: 0.00,
        currency: 'PKR',
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      db.wallet_accounts.push(account);
    }

    const balanceBefore = account.balance;
    const balanceAfter = roundToTwoDecimals(balanceBefore + delta);
    const now = new Date().toISOString();

    account.balance = balanceAfter;
    account.updated_at = now;

    const transaction: WalletTransactionRow = {
      id: generateId('txn'),
      wallet_id: account.id,
      customer_profile_id: input.customerProfileId,
      type: 'ADJUSTMENT',
      amount: Math.abs(delta),
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      payment_method: 'adjustment',
      reference_number: input.referenceNumber?.trim() || undefined,
      notes: `[ADJUSTMENT ${delta > 0 ? '+' : ''}${delta}] ${input.reason.trim()}`,
      actor_id: input.actor.id,
      actor_name: input.actor.name,
      created_at: now
    };

    db.wallet_transactions.push(transaction);

    await logAudit({
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      action: 'wallet.adjust',
      entityType: 'wallet_account',
      entityId: account.id,
      metadata: {
        customer_profile_id: input.customerProfileId,
        business_name: customer.business_name,
        delta,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reason: input.reason,
        transaction_id: transaction.id
      }
    }, db);

    return { account, transaction };
  });
}

/**
 * Reverses a previous transaction cleanly by generating an offsetting REVERSAL entry
 */
export async function reverseTransaction(
  transactionId: string,
  reason: string,
  actor: { id: string; name: string; email: string }
): Promise<{ account: WalletAccountRow; reversalTransaction: WalletTransactionRow }> {
  if (!reason || reason.trim().length < 5) {
    throw new WalletError('MISSING_REASON', 'A specific reversal reason is required.');
  }

  return withTransaction(async (db) => {
    const originalTxn = db.wallet_transactions.find(t => t.id === transactionId);
    if (!originalTxn) {
      throw new WalletError('TRANSACTION_NOT_FOUND', `Transaction '${transactionId}' does not exist.`);
    }

    if (originalTxn.type === 'REVERSAL') {
      throw new WalletError('INVALID_OPERATION', 'Cannot reverse a transaction that is already a reversal.');
    }

    // Check if this transaction has already been reversed
    const alreadyReversed = db.wallet_transactions.some(
      t => t.type === 'REVERSAL' && t.reference_number === originalTxn.id
    );
    if (alreadyReversed) {
      throw new WalletError('ALREADY_REVERSED', `Transaction '${transactionId}' has already been reversed.`);
    }

    const account = db.wallet_accounts.find(w => w.id === originalTxn.wallet_id);
    if (!account) {
      throw new WalletError('WALLET_NOT_FOUND', 'Linked wallet account not found.');
    }

    const balanceBefore = account.balance;
    let balanceAfter: number;

    // If original was CREDIT, reversal subtracts (debits)
    // If original was DEBIT, reversal adds back (credits)
    if (originalTxn.type === 'CREDIT') {
      balanceAfter = roundToTwoDecimals(balanceBefore - originalTxn.amount);
    } else if (originalTxn.type === 'DEBIT') {
      balanceAfter = roundToTwoDecimals(balanceBefore + originalTxn.amount);
    } else {
      // For ADJUSTMENT: reverse based on whether it increased or decreased balance
      const delta = originalTxn.balance_after - originalTxn.balance_before;
      balanceAfter = roundToTwoDecimals(balanceBefore - delta);
    }

    const now = new Date().toISOString();
    account.balance = balanceAfter;
    account.updated_at = now;

    const reversalTransaction: WalletTransactionRow = {
      id: generateId('txn'),
      wallet_id: account.id,
      customer_profile_id: originalTxn.customer_profile_id,
      type: 'REVERSAL',
      amount: originalTxn.amount,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      payment_method: 'adjustment',
      reference_number: originalTxn.id, // Direct linkage to reversed txn
      notes: `[REVERSAL of ${originalTxn.id}] ${reason.trim()}`,
      actor_id: actor.id,
      actor_name: actor.name,
      created_at: now
    };

    db.wallet_transactions.push(reversalTransaction);

    await logAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'wallet.reversal',
      entityType: 'wallet_account',
      entityId: account.id,
      metadata: {
        reversed_transaction_id: originalTxn.id,
        amount: originalTxn.amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reason,
        reversal_id: reversalTransaction.id
      }
    }, db);

    return { account, reversalTransaction };
  });
}
