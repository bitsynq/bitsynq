/**
 * Unit tests for Ethereum service
 */

import { describe, it, expect } from 'vitest';
import {
	generateWallet,
	isValidAddress,
	parseTokenAmount,
	formatTokenAmount,
} from './ethereum';

describe('ethereum service', () => {
	describe('generateWallet', () => {
		it('should generate a valid wallet with address and private key', () => {
			const wallet = generateWallet();

			expect(wallet).toHaveProperty('address');
			expect(wallet).toHaveProperty('privateKey');
			expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
			expect(wallet.privateKey).toMatch(/^0x[a-fA-F0-9]{64}$/);
		});

		it('should generate unique wallets each time', () => {
			const wallet1 = generateWallet();
			const wallet2 = generateWallet();

			expect(wallet1.address).not.toBe(wallet2.address);
			expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
		});
	});

	describe('isValidAddress', () => {
		it('should return true for valid Ethereum addresses', () => {
			// Generate a fresh wallet to get a valid address
			const wallet = generateWallet();
			expect(isValidAddress(wallet.address)).toBe(true);
			// Lowercase addresses are also valid
			expect(isValidAddress('0x0000000000000000000000000000000000000000')).toBe(true);
		});

		it('should return false for invalid addresses', () => {
			expect(isValidAddress('')).toBe(false);
			expect(isValidAddress('not-an-address')).toBe(false);
			expect(isValidAddress('0x123')).toBe(false);
			expect(isValidAddress('742d35Cc6634C0532925a3b844Bc9e7595f8E6D5')).toBe(false);
		});
	});

	describe('parseTokenAmount', () => {
		it('should parse string amounts with 18 decimals', () => {
			const amount = parseTokenAmount('1', 18);
			expect(amount).toBe(BigInt('1000000000000000000'));
		});

		it('should parse decimal amounts', () => {
			const amount = parseTokenAmount('0.5', 18);
			expect(amount).toBe(BigInt('500000000000000000'));
		});

		it('should handle different decimal places', () => {
			const amount = parseTokenAmount('100', 6);
			expect(amount).toBe(BigInt('100000000'));
		});
	});

	describe('formatTokenAmount', () => {
		it('should format bigint to human readable string', () => {
			const formatted = formatTokenAmount(BigInt('1000000000000000000'), 18);
			expect(formatted).toBe('1.0');
		});

		it('should format with correct decimals', () => {
			const formatted = formatTokenAmount(BigInt('500000000000000000'), 18);
			expect(formatted).toBe('0.5');
		});

		it('should handle different decimal places', () => {
			const formatted = formatTokenAmount(BigInt('100000000'), 6);
			expect(formatted).toBe('100.0');
		});
	});
});
