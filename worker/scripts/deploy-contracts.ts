import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import solc from 'solc';

const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
// Use the secret key from env
const PRIVATE_KEY = process.env.ETH_PRIVATE_KEY;

if (!PRIVATE_KEY) {
	console.error('Please set ETH_PRIVATE_KEY env var');
	process.exit(1);
}

const CONTRACTS_DIR = path.resolve(__dirname, '../../contracts');
const TOKEN_SOURCE = fs.readFileSync(path.join(CONTRACTS_DIR, 'BitsynqToken_Flat.sol'), 'utf8');
const BATCH_SOURCE = fs.readFileSync(path.join(CONTRACTS_DIR, 'BatchDistributor_Flat.sol'), 'utf8');

function compileContracts() {
	console.log('Compiling contracts...');

	const input = {
		language: 'Solidity',
		sources: {
			'BitsynqToken_Flat.sol': { content: TOKEN_SOURCE },
			'BatchDistributor_Flat.sol': { content: BATCH_SOURCE }
		},
		settings: {
			outputSelection: {
				'*': {
					'*': ['abi', 'evm.bytecode']
				}
			}
		}
	};

	const output = JSON.parse(solc.compile(JSON.stringify(input)));

	if (output.errors) {
		// Filter warnings
		const errors = output.errors.filter((e: any) => e.severity === 'error');
		if (errors.length > 0) {
			errors.forEach((err: any) => console.error(err.formattedMessage));
			throw new Error('Compilation failed');
		}
	}

	return {
		BitsynqToken: output.contracts['BitsynqToken_Flat.sol']['BitsynqToken'],
		BatchDistributor: output.contracts['BatchDistributor_Flat.sol']['BatchDistributor']
	};
}

async function main() {
	const contracts = compileContracts();

	const provider = new ethers.JsonRpcProvider(RPC_URL);
	const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);

	console.log(`\nDeploying from: ${wallet.address}`);
	const balance = await provider.getBalance(wallet.address);
	console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

	if (balance === BigInt(0)) {
		console.error('❌ Wallet has no ETH. Please faucet some Sepolia ETH.');
		process.exit(1);
	}

	// Deploy Token
	console.log('\nDeploying BitsynqToken...');
	const TokenFactory = new ethers.ContractFactory(
		contracts.BitsynqToken.abi,
		contracts.BitsynqToken.evm.bytecode.object,
		wallet
	);
	const token = await TokenFactory.deploy();
	await token.waitForDeployment();
	const tokenAddress = await token.getAddress();
	console.log(`✅ BitsynqToken deployed to: ${tokenAddress}`);

	// Deploy BatchDistributor
	console.log('\nDeploying BatchDistributor...');
	const BatchFactory = new ethers.ContractFactory(
		contracts.BatchDistributor.abi,
		contracts.BatchDistributor.evm.bytecode.object,
		wallet
	);
	const batch = await BatchFactory.deploy();
	await batch.waitForDeployment();
	const batchAddress = await batch.getAddress();
	console.log(`✅ BatchDistributor deployed to: ${batchAddress}`);

	console.log('\nRun the following commands to update secrets:');
	console.log(`npx wrangler secret put ETH_TOKEN_CONTRACT <<< "${tokenAddress}"`);
	console.log(`npx wrangler secret put ETH_BATCH_DISTRIBUTOR <<< "${batchAddress}"`);
}

main().catch(console.error);
