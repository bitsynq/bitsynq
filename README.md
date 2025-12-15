# bitsynq

bitsynq is a decentralized platform for project contributions and milestone-based rewards. This repository contains the core components of the bitsynq system, including the smart contract, database schema, and a simple frontend for interacting with the platform.

## Architecture

The bitsynq platform consists of the following components:

-   **Solidity Smart Contract (`ASC6909.sol`):** An ERC-6909 compatible multi-token contract for minting and managing project-specific tokens.
-   **Cloudflare Worker:** A serverless backend that connects the frontend to the database and the smart contract, handling API requests for project creation, contribution recording, and token minting.
-   **D1 Database:** A serverless SQLite database provided by Cloudflare for storing project and user data.
-   **Frontend (`index.html`):** A simple web interface for interacting with the platform's features.

## Deployment

To deploy the bitsynq platform, follow these steps:

1.  **Deploy the Smart Contract:** Use the `deploy_contract.sh` script to deploy the `ASC6909.sol` contract to an Ethereum-compatible network.
2.  **Set Up the Database:** Run the `setup_database.sh` script to initialize the D1 database using the `schema.sql` file.
3.  **Deploy the Cloudflare Worker:** Use the `deploy_worker.sh` script to deploy the backend worker to Cloudflare.
4.  **Configure the Frontend:** Update the `index.html` file with the deployed worker URL.

For detailed instructions, refer to the individual deployment scripts.

## Prerequisites

Before deploying the bitsynq platform, you need to have the following installed:

-   **Node.js and npm:** Required for managing the Cloudflare Worker dependencies and running the deployment scripts.
-   **Foundry:** Required for deploying the smart contract. You can install Foundry by running `curl -L https://foundry.paradigm.xyz | bash`.

## Environment Variables

Before deploying the Cloudflare Worker, you need to set up the following secrets using the `wrangler` CLI:

-   `PRIVATE_KEY`: The private key of the wallet that will be used to mint tokens.
-   `RPC_URL`: The URL of the Ethereum-compatible RPC endpoint.
-   `CONTRACT_ADDRESS`: The address of the deployed `Bitsynq6909` smart contract.
-   `API_KEY`: A secret key to authenticate API requests.

You can set these secrets using the following commands:

```bash
wrangler secret put PRIVATE_KEY
wrangler secret put RPC_URL
wrangler secret put CONTRACT_ADDRESS
wrangler secret put API_KEY
```

Note that `PRIVATE_KEY` and `RPC_URL` are also needed as local environment variables for the `deploy_contract.sh` script.

## D1 Database Setup

Before running the `setup_database.sh` script, you need to create a D1 database using the `wrangler` CLI:

```bash
wrangler d1 create bitsynq
```

This command will create a new D1 database and output the `database_id` that you need to add to your `wrangler.toml` file.
