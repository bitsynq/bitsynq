import { Hono } from 'hono'
import { ethers } from 'ethers'

const app = new Hono()

const authMiddleware = async (c, next) => {
  const apiKey = c.req.header('Authorization')
  if (apiKey !== c.env.API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
}

app.use('*', authMiddleware)

const CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_minter",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "projectId",
        "type": "uint256"
      },
      {
        "internalType": "address[]",
        "name": "to",
        "type": "address[]"
      },
      {
        "internalType": "uint256[]",
        "name": "amounts",
        "type": "uint256[]"
      }
    ],
    "name": "batchMint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "balanceOf",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "projectId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "minter",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
]

app.post('/project', async (c) => {
  try {
    const { name } = await c.req.json()
    const { meta } = await c.env.DB.prepare('INSERT INTO projects (name) VALUES (?)')
      .bind(name)
      .run()
    return c.json({ id: meta.last_row_id })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/project/:projectId/contribution', async (c) => {
  try {
    const { projectId } = c.req.param()
    const { userId, ratio, desc } = await c.req.json()
    await c.env.DB.prepare(
      'INSERT INTO contributions (projectId, userId, ratio, desc) VALUES (?, ?, ?, ?)'
    )
      .bind(projectId, userId, ratio, desc)
      .run()
    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

app.post('/project/:projectId/milestone', async (c) => {
  try {
    const { projectId } = c.req.param()
    const { token_per_milestone } = await c.req.json()

    const { results } = await c.env.DB.prepare(
      'SELECT userId, ratio FROM contributions WHERE projectId = ?'
    )
      .bind(projectId)
            .all()

    const recipients = results.map((r) => r.userId)
    const amounts = results.map((r) =>
      (BigInt(token_per_milestone) * BigInt(r.ratio)) / 1000n
    )

    const provider = new ethers.JsonRpcProvider(c.env.RPC_URL)
    const wallet = new ethers.Wallet(c.env.PRIVATE_KEY, provider)
    const contract = new ethers.Contract(c.env.CONTRACT_ADDRESS, CONTRACT_ABI, wallet)

    await contract.batchMint(projectId, recipients, amounts)

    await c.env.DB.prepare(
      'INSERT INTO milestones (projectId, totalTokens) VALUES (?, ?)'
    )
      .bind(projectId, token_per_milestone)
      .run()

    return c.json({ success: true })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

export default app
