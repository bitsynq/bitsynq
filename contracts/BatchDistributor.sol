// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title BatchDistributor
 * @dev Contract to distribute ERC20 tokens to multiple recipients in a single transaction
 */
contract BatchDistributor {
    using SafeERC20 for IERC20;

    event Batched(address indexed sender, address indexed token, uint256 total);

    /**
     * @dev Distribute tokens to multiple recipients
     * @param token The ERC20 token to distribute
     * @param recipients Array of recipient addresses
     * @param values Array of token amounts to distribute
     */
    function disperseToken(IERC20 token, address[] calldata recipients, uint256[] calldata values) external {
        require(recipients.length == values.length, "Length mismatch");
        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++)
            total += values[i];

        // Transfer the total amount from sender to this contract
        token.safeTransferFrom(msg.sender, address(this), total);

        // Transfer to each recipient
        for (uint256 i = 0; i < recipients.length; i++)
            token.safeTransfer(recipients[i], values[i]);

        emit Batched(msg.sender, address(token), total);
    }
}
