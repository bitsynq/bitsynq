import { Env } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface TransactionLogFilter {
  projectId: string;
  status?: string;
  txType?: string;
  address?: string; // from or to
  limit?: number;
  cursor?: string; // timestamp for pagination
}

export interface CreateLogParams {
  projectId: string;
  distributionId?: string;
  txHash?: string;
  txType: 'mint' | 'transfer' | 'batch_transfer';
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenSymbol?: string;
  status?: 'pending' | 'submitted' | 'confirmed' | 'failed';
  createdBy: string;
  inputs?: Array<{
    userId: string;
    walletAddress: string;
    amount: string;
  }>;
}

export class TransactionLogService {
  constructor(private env: Env) {}

  /**
   * Create a new transaction log entry
   */
  async createLog(params: CreateLogParams): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const statements: any[] = [];

    // 1. Insert main log
    statements.push(this.env.DB.prepare(`
      INSERT INTO transaction_logs (
        id, project_id, distribution_id, tx_hash, tx_type,
        from_address, to_address, amount, token_symbol,
        status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, params.projectId, params.distributionId || null, params.txHash || null, params.txType,
      params.fromAddress, params.toAddress, params.amount, params.tokenSymbol || 'BTS',
      params.status || 'pending', params.createdBy, now, now
    ));

    // 2. Insert inputs if any (for batch transfers)
    if (params.inputs && params.inputs.length > 0) {
      for (const input of params.inputs) {
        statements.push(this.env.DB.prepare(`
          INSERT INTO transaction_inputs (
            id, transaction_log_id, user_id, wallet_address, amount, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          uuidv4(), id, input.userId, input.walletAddress, input.amount, now
        ));
      }
    }

    // Execute batch
    await this.env.DB.batch(statements);

    return id;
  }

  /**
   * Update transaction status
   */
  async updateStatus(
    txHash: string, 
    status: string, 
    details?: { 
      blockNumber?: number; 
      gasUsed?: number; 
      gasPrice?: string; 
      errorMessage?: string; 
    }
  ): Promise<void> {
    const now = new Date().toISOString();
    let query = `
      UPDATE transaction_logs 
      SET status = ?, updated_at = ?
    `;
    const params: any[] = [status, now];

    if (details?.blockNumber) {
      query += `, block_number = ?`;
      params.push(details.blockNumber);
    }
    if (details?.gasUsed) {
      query += `, gas_used = ?`;
      params.push(details.gasUsed);
    }
    if (details?.gasPrice) {
      query += `, gas_price = ?`;
      params.push(details.gasPrice);
    }
    if (details?.errorMessage) {
      query += `, error_message = ?`;
      params.push(details.errorMessage);
    }
    if (status === 'confirmed') {
      query += `, confirmed_at = ?`;
      params.push(now);
    }

    query += ` WHERE tx_hash = ?`;
    params.push(txHash);

    await this.env.DB.prepare(query).bind(...params).run();
  }

  /**
   * Get transaction logs with filtering
   */
  async getLogs(filter: TransactionLogFilter) {
    const limit = Math.min(filter.limit || 20, 100);
    const conditions: string[] = ['tl.project_id = ?'];
    const params: any[] = [filter.projectId];

    if (filter.status) {
      conditions.push('tl.status = ?');
      params.push(filter.status);
    }

    if (filter.txType) {
      conditions.push('tl.tx_type = ?');
      params.push(filter.txType);
    }

    if (filter.address) {
      conditions.push('(tl.from_address = ? OR tl.to_address = ?)');
      params.push(filter.address.toLowerCase(), filter.address.toLowerCase());
    }

    if (filter.cursor) {
      conditions.push('tl.created_at < ?');
      params.push(filter.cursor);
    }

    const whereClause = conditions.join(' AND ');

    const query = `
      SELECT 
        tl.*,
        u_from.display_name as from_display_name,
        u_to.display_name as to_display_name,
        td.milestone_name
      FROM transaction_logs tl
      LEFT JOIN users u_from ON tl.from_address = u_from.wallet_address
      LEFT JOIN users u_to ON tl.to_address = u_to.wallet_address
      LEFT JOIN token_distributions td ON tl.distribution_id = td.id
      WHERE ${whereClause}
      ORDER BY tl.created_at DESC
      LIMIT ?
    `;
    params.push(limit);

    const { results } = await this.env.DB.prepare(query).bind(...params).all();

    // Calculate next cursor
    const nextCursor = results && results.length > 0 
      ? (results[results.length - 1] as any).created_at 
      : null;

    return {
      transactions: results || [],
      pagination: {
        limit,
        next_cursor: nextCursor,
        has_more: results && results.length === limit,
      }
    };
  }

  /**
   * Get detailed transaction info
   */
  async getLogDetail(id: string, projectId: string) {
    const batchResults = await this.env.DB.batch([
      // Main log
      this.env.DB.prepare(`
        SELECT tl.*, 
               u_from.display_name as from_display_name,
               u_to.display_name as to_display_name
        FROM transaction_logs tl
        LEFT JOIN users u_from ON tl.from_address = u_from.wallet_address
        LEFT JOIN users u_to ON tl.to_address = u_to.wallet_address
        WHERE tl.id = ? AND tl.project_id = ?
      `).bind(id, projectId),

      // Inputs
      this.env.DB.prepare(`
        SELECT ti.*, u.display_name as user_display_name
        FROM transaction_inputs ti
        INNER JOIN users u ON ti.user_id = u.id
        WHERE ti.transaction_log_id = ?
      `).bind(id),

      // Events
      this.env.DB.prepare(`
        SELECT * FROM transaction_events
        WHERE transaction_log_id = ?
        ORDER BY log_index
      `).bind(id)
    ]);

    const transaction = batchResults[0].results?.[0];
    if (!transaction) return null;

    return {
      ...transaction,
      inputs: batchResults[1].results || [],
      events: batchResults[2].results || []
    };
  }
}
