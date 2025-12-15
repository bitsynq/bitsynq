#!/bin/bash

set -e

echo "Starting deployment..."

# 1. Deploy the smart contract
echo "Deploying contract..."
./deploy_contract.sh

# 2. Set up the database
echo "Setting up database..."
./setup_database.sh

# 3. Deploy the Cloudflare Worker
echo "Deploying worker..."
npm install
npm run deploy

echo "Deployment complete!"
