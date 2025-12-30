// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BitsynqToken
 * @dev Simple ERC-20 token for Bitsynq contribution tracking
 *
 * Deploy this contract on Sepolia testnet:
 * 1. Go to https://remix.ethereum.org
 * 2. Create a new file and paste this code
 * 3. Compile with Solidity 0.8.20+
 * 4. Deploy to Sepolia (connect MetaMask with Sepolia ETH)
 * 5. Copy the deployed contract address
 * 6. Set it via: wrangler secret put ETH_TOKEN_CONTRACT
 */
contract BitsynqToken is ERC20, Ownable {
    uint8 private constant _decimals = 18;

    /**
     * @dev Constructor that mints initial supply to deployer
     * Initial supply: 1,000,000,000 tokens (1 billion)
     */
    constructor() ERC20("Bitsynq Token", "BSYQ") Ownable(msg.sender) {
        // Mint 1 billion tokens to the deployer
        _mint(msg.sender, 1_000_000_000 * 10 ** _decimals);
    }

    /**
     * @dev Returns the number of decimals
     */
    function decimals() public pure override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint additional tokens (only owner)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint (without decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount * 10 ** _decimals);
    }

    /**
     * @dev Burn tokens from caller's balance
     * @param amount Amount of tokens to burn (without decimals)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount * 10 ** _decimals);
    }
}
