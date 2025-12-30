/**
 * Ethereum Service
 * Handles wallet creation, token transfers, and blockchain interactions
 * Configured for Sepolia testnet
 */

import { ethers } from 'ethers';

// Standard ERC-20 ABI for transfer functions
const ERC20_ABI = [
	'function name() view returns (string)',
	'function symbol() view returns (string)',
	'function decimals() view returns (uint8)',
	'function totalSupply() view returns (uint256)',
	'function balanceOf(address owner) view returns (uint256)',
	'function transfer(address to, uint256 amount) returns (bool)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)',
	'function transferFrom(address from, address to, uint256 amount) returns (bool)',
	'event Transfer(address indexed from, address indexed to, uint256 value)',
];

export interface WalletInfo {
	address: string;
	privateKey: string;
}

export interface TransferResult {
	success: boolean;
	txHash?: string;
	error?: string;
}

export interface BatchTransferItem {
	to: string;
	amount: bigint;
}

export interface BatchTransferResult {
	success: boolean;
	txHashes: string[];
	errors: string[];
}

/**
 * Generate a new random Ethereum wallet
 */
export function generateWallet(): WalletInfo {
	const wallet = ethers.Wallet.createRandom();
	return {
		address: wallet.address,
		privateKey: wallet.privateKey,
	};
}

/**
 * Get the admin wallet from private key
 */
export function getAdminWallet(privateKey: string, rpcUrl: string): ethers.Wallet {
	const provider = new ethers.JsonRpcProvider(rpcUrl);
	return new ethers.Wallet(privateKey, provider);
}

/**
 * Get provider instance
 */
export function getProvider(rpcUrl: string): ethers.JsonRpcProvider {
	return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Get ERC-20 contract instance
 */
export function getTokenContract(
	contractAddress: string,
	signerOrProvider: ethers.Wallet | ethers.JsonRpcProvider
): ethers.Contract {
	return new ethers.Contract(contractAddress, ERC20_ABI, signerOrProvider);
}

/**
 * Get token balance for an address
 */
export async function getTokenBalance(
	contractAddress: string,
	walletAddress: string,
	rpcUrl: string
): Promise<bigint> {
	const provider = getProvider(rpcUrl);
	const contract = getTokenContract(contractAddress, provider);
	return await contract.balanceOf(walletAddress);
}

/**
 * Get token info (name, symbol, decimals)
 */
export async function getTokenInfo(
	contractAddress: string,
	rpcUrl: string
): Promise<{ name: string; symbol: string; decimals: number }> {
	const provider = getProvider(rpcUrl);
	const contract = getTokenContract(contractAddress, provider);

	const [name, symbol, decimals] = await Promise.all([
		contract.name(),
		contract.symbol(),
		contract.decimals(),
	]);

	return { name, symbol, decimals: Number(decimals) };
}

/**
 * Transfer ERC-20 tokens
 */
export async function transferTokens(
	contractAddress: string,
	privateKey: string,
	rpcUrl: string,
	to: string,
	amount: bigint
): Promise<TransferResult> {
	try {
		const wallet = getAdminWallet(privateKey, rpcUrl);
		const contract = getTokenContract(contractAddress, wallet);

		const tx = await contract.transfer(to, amount);
		const receipt = await tx.wait();

		return {
			success: true,
			txHash: receipt.hash,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Batch transfer tokens to multiple recipients
 * Note: This sends individual transactions (not a batch contract call)
 * For production, consider using a batch transfer contract
 */
export async function batchTransferTokens(
	contractAddress: string,
	privateKey: string,
	rpcUrl: string,
	transfers: BatchTransferItem[]
): Promise<BatchTransferResult> {
	const wallet = getAdminWallet(privateKey, rpcUrl);
	const contract = getTokenContract(contractAddress, wallet);

	const txHashes: string[] = [];
	const errors: string[] = [];

	for (const transfer of transfers) {
		try {
			const tx = await contract.transfer(transfer.to, transfer.amount);
			const receipt = await tx.wait();
			txHashes.push(receipt.hash);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			errors.push(`Failed to transfer to ${transfer.to}: ${errorMsg}`);
		}
	}

	return {
		success: errors.length === 0,
		txHashes,
		errors,
	};
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
	txHash: string,
	rpcUrl: string
): Promise<{ confirmed: boolean; blockNumber?: number; status?: number }> {
	const provider = getProvider(rpcUrl);
	const receipt = await provider.getTransactionReceipt(txHash);

	if (!receipt) {
		return { confirmed: false };
	}

	return {
		confirmed: true,
		blockNumber: receipt.blockNumber,
		status: receipt.status ?? undefined,
	};
}

/**
 * Get ETH balance for gas
 */
export async function getEthBalance(
	address: string,
	rpcUrl: string
): Promise<string> {
	const provider = getProvider(rpcUrl);
	const balance = await provider.getBalance(address);
	return ethers.formatEther(balance);
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: bigint, decimals: number): string {
	return ethers.formatUnits(amount, decimals);
}

/**
 * Parse token amount to bigint
 */
export function parseTokenAmount(amount: string | number, decimals: number): bigint {
	return ethers.parseUnits(amount.toString(), decimals);
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
	return ethers.isAddress(address);
}
