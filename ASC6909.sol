// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * bitsynq ERC-6909 multi-token contract
 *
 * Design:
 * - Each tokenId represents one project in bitsynq
 * - Tokens are minted only by the bitsynq Worker (minter)
 * - No premint, no supply cap
 */

interface IERC6909Receiver {
    function onERC6909Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external returns (bytes4);
}

contract Bitsynq6909 {

    // -------------------------------------------------------------
    // STORAGE
    // -------------------------------------------------------------

    // tokenId (projectId) => user => balance
    mapping(uint256 => mapping(address => uint256)) public balanceOf;

    // Cloudflare Worker wallet address
    address public minter;

    // Maximum number of recipients in a single batch mint
    uint256 public constant BATCH_LIMIT = 100;

    // -------------------------------------------------------------
    // EVENTS
    // -------------------------------------------------------------
    event TransferSingle(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 id,
        uint256 value
    );

    // -------------------------------------------------------------
    // MODIFIERS
    // -------------------------------------------------------------
    modifier onlyMinter() {
        require(msg.sender == minter, "bitsynq: not authorized");
        _;
    }

    // -------------------------------------------------------------
    // CONSTRUCTOR
    // -------------------------------------------------------------
    constructor(address _minter) {
        minter = _minter;
    }

    // -------------------------------------------------------------
    // MINT
    // Called by bitsynq Worker when a milestone is approved
    // -------------------------------------------------------------
    function mint(
        uint256 projectId,
        address to,
        uint256 amount
    ) external onlyMinter {
        balanceOf[projectId][to] += amount;
        emit TransferSingle(msg.sender, address(0), to, projectId, amount);
    }

    function batchMint(
        uint256 projectId,
        address[] calldata to,
        uint256[] calldata amounts
    ) external onlyMinter {
        require(to.length == amounts.length, "bitsynq: array length mismatch");
        require(to.length <= BATCH_LIMIT, "bitsynq: batch limit exceeded");
        for (uint256 i = 0; i < to.length; i++) {
            require(to[i] != address(0), "bitsynq: mint to zero address");
            balanceOf[projectId][to[i]] += amounts[i];
            emit TransferSingle(msg.sender, address(0), to[i], projectId, amounts[i]);
        }
    }
}
