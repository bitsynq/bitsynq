// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

contract BatchDistributor {
    event Batched(address indexed sender, address indexed token, uint256 total);

    function disperseToken(IERC20 token, address[] calldata recipients, uint256[] calldata values) external {
        require(recipients.length == values.length, "Length mismatch");
        uint256 total = 0;
        for (uint256 i = 0; i < recipients.length; i++)
            total += values[i];

        // Transfer tokens from sender to this contract
        // Requires sender to have approved this contract
        require(token.transferFrom(msg.sender, address(this), total), "TransferFrom failed");

        // Transfer to recipients
        for (uint256 i = 0; i < recipients.length; i++)
             require(token.transfer(recipients[i], values[i]), "Transfer failed");

        emit Batched(msg.sender, address(token), total);
    }
}
