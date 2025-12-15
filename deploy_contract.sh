#!/bin/bash

# Make sure to set these environment variables
# export PRIVATE_KEY=...
# export RPC_URL=...
# The minter address should be the address of the Cloudflare Worker's wallet, which is derived from the PRIVATE_KEY
# You can get the address by running `cast wallet address --private-key $PRIVATE_KEY`
export MINTER_ADDRESS=$(cast wallet address --private-key $PRIVATE_KEY)

forge create --rpc-url $RPC_URL --private-key $PRIVATE_KEY ASC6909.sol:Bitsynq6909 --constructor-args "$MINTER_ADDRESS"
