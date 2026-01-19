<template>
  <v-card variant="flat">
    <!-- Filters -->
    <div class="d-flex gap-2 mb-4">
      <v-select
        v-model="statusFilter"
        :items="['pending', 'confirmed', 'failed']"
        label="Status"
        density="compact"
        hide-details
        clearable
        style="max-width: 150px"
        @update:model-value="fetchTransactions(true)"
      />
      <v-btn icon variant="text" @click="fetchTransactions(true)">
        <v-icon>mdi-refresh</v-icon>
      </v-btn>
    </div>

    <!-- Table -->
    <v-table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>From / To</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tx in transactions" :key="tx.id">
          <td class="text-caption">
            {{ formatDate(tx.created_at) }}
          </td>
          <td>
            <v-chip size="small" label class="text-capitalize">{{ tx.tx_type.replace('_', ' ') }}</v-chip>
          </td>
          <td>
            <div class="d-flex flex-column text-caption">
              <span>From: {{ formatAddress(tx.from_address, tx.from_display_name) }}</span>
              <span>To: {{ formatAddress(tx.to_address, tx.to_display_name) }}</span>
            </div>
          </td>
          <td class="font-weight-bold">
            {{ formatAmount(tx.amount) }} {{ tx.token_symbol }}
          </td>
          <td>
            <v-chip
              size="small"
              :color="getStatusColor(tx.status)"
            >
              {{ tx.status }}
            </v-chip>
            <div v-if="tx.error_message" class="text-caption text-error mt-1 text-truncate" style="max-width: 150px">
              {{ tx.error_message }}
            </div>
          </td>
          <td>
            <div class="d-flex gap-1">
              <v-btn
                v-if="tx.tx_hash"
                icon
                size="small"
                variant="text"
                :href="`https://sepolia.etherscan.io/tx/${tx.tx_hash}`"
                target="_blank"
                title="View on Etherscan"
              >
                <v-icon>mdi-open-in-new</v-icon>
              </v-btn>
              
              <v-btn
                v-if="tx.status === 'failed'"
                icon
                size="small"
                variant="text"
                color="warning"
                :loading="retrying === tx.id"
                @click="retryTransaction(tx.id)"
                title="Retry"
              >
                <v-icon>mdi-reload</v-icon>
              </v-btn>
            </div>
          </td>
        </tr>
        <tr v-if="transactions.length === 0 && !loading">
          <td colspan="6" class="text-center text-medium-emphasis py-4">
            No transactions found
          </td>
        </tr>
      </tbody>
    </v-table>

    <!-- Pagination -->
    <div v-if="hasMore" class="d-flex justify-center mt-4">
      <v-btn
        variant="text"
        :loading="loading"
        @click="loadMore"
      >
        Load More
      </v-btn>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { api, type TransactionLog } from '@/services/api'
import { format } from 'date-fns'

const props = defineProps<{
  projectId: string
}>()

const transactions = ref<TransactionLog[]>([])
const loading = ref(false)
const statusFilter = ref<string | null>(null)
const nextCursor = ref<string | undefined>(undefined)
const hasMore = ref(false)
const retrying = ref<string | null>(null)

function formatDate(dateStr: string) {
  return format(new Date(dateStr), 'MMM d, HH:mm')
}

function formatAddress(addr: string, name?: string) {
  if (name) return name
  return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4)
}

function formatAmount(amount: string) {
  // Simple format, can be improved for large numbers
  return parseFloat(amount).toLocaleString()
}

function getStatusColor(status: string) {
  switch (status) {
    case 'confirmed': return 'success'
    case 'pending': return 'info'
    case 'failed': return 'error'
    default: return 'grey'
  }
}

async function fetchTransactions(reset = false) {
  loading.value = true
  if (reset) {
    transactions.value = []
    nextCursor.value = undefined
  }

  try {
    const res = await api.transactions.list(props.projectId, {
      status: statusFilter.value || undefined,
      cursor: nextCursor.value,
      limit: 20
    })

    if (reset) {
      transactions.value = res.transactions
    } else {
      transactions.value.push(...res.transactions)
    }

    nextCursor.value = res.pagination.next_cursor
    hasMore.value = res.pagination.has_more
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (!loading.value && hasMore.value) {
    await fetchTransactions()
  }
}

async function retryTransaction(txId: string) {
  retrying.value = txId
  try {
    await api.transactions.retry(props.projectId, txId)
    // Refresh list
    await fetchTransactions(true)
  } catch (e) {
    console.error(e)
  } finally {
    retrying.value = null
  }
}

onMounted(() => {
  fetchTransactions(true)
})

watch(() => props.projectId, () => {
  fetchTransactions(true)
})
</script>
