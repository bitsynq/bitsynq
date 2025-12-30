<template>
  <v-container class="py-8">
    <!-- Header -->
    <div class="d-flex align-center gap-2 mb-6">
      <v-btn icon size="small" variant="text" @click="$router.back()">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <h1 class="text-h4 font-weight-bold">{{ $t('distribute.title') }}</h1>
    </div>

    <v-row>
      <v-col cols="12" lg="5">
        <v-card class="pa-6">
          <h3 class="text-h6 mb-4">{{ $t('distribute.configTitle') }}</h3>

          <v-form @submit.prevent="handlePreview">
            <v-text-field
              v-model="milestoneName"
              :label="$t('distribute.milestoneName')"
              :placeholder="$t('distribute.milestonePlaceholder')"
              class="mb-4"
            />

            <v-text-field
              v-model.number="totalTokens"
              :label="$t('distribute.totalTokens')"
              type="number"
              min="1"
              :rules="[v => v > 0 || $t('distribute.validate.positiveInteger')]"
              class="mb-4"
            />

            <v-checkbox
              v-model="onChain"
              :label="$t('distribute.onChain')"
              color="primary"
              hide-details
              class="mb-2"
            />

            <v-alert
              v-if="onChain"
              type="info"
              variant="tonal"
              border="start"
              class="mb-4 text-caption"
            >
              {{ $t('distribute.onChainAlert') }}
            </v-alert>

            <v-btn
              type="submit"
              color="secondary"
              variant="tonal"
              block
              :loading="previewing"
              :disabled="!totalTokens || totalTokens <= 0"
            >
              {{ $t('distribute.previewButton') }}
            </v-btn>
          </v-form>
        </v-card>

        <!-- Distribution History -->
        <v-card class="pa-6 mt-4">
          <h3 class="text-h6 mb-4">{{ $t('distribute.historyTitle') }}</h3>
          <v-list v-if="distributions.length > 0" density="compact">
            <v-list-item
              v-for="dist in distributions"
              :key="dist.id"
              :title="dist.milestone_name || $t('project.distributions.untitled')"
              :subtitle="`${formatDate(dist.created_at)} · ${dist.total_tokens} tokens`"
              :href="dist.tx_hash ? `https://sepolia.etherscan.io/tx/${dist.tx_hash}` : undefined"
              :target="dist.tx_hash ? '_blank' : undefined"
            >
              <template #prepend>
                <div class="mr-4">
                  <v-avatar color="success" variant="tonal" size="32" v-if="dist.status === 'confirmed'">
                    <v-icon size="small">mdi-check</v-icon>
                  </v-avatar>
                  <v-avatar color="warning" variant="tonal" size="32" v-else>
                    <v-icon size="small">mdi-clock</v-icon>
                  </v-avatar>
                </div>
              </template>

              <template #append>
                <v-tooltip location="top" v-if="dist.tx_hash">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" color="primary" size="small">mdi-link-variant</v-icon>
                  </template>
                  <span>View on Etherscan (Sepolia)</span>
                </v-tooltip>
                <v-chip v-else-if="dist.on_chain" size="x-small" color="error" variant="outlined">Failed</v-chip>
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="text-body-2 text-medium-emphasis text-center py-4">
            {{ $t('project.distributions.noDistributions') }}
          </p>
        </v-card>
      </v-col>

      <v-col cols="12" lg="7">
        <!-- Preview Results -->
        <v-card v-if="preview" class="pa-6">
          <h3 class="text-h6 mb-4">{{ $t('distribute.previewTitle') }}</h3>

          <v-table class="mb-4">
            <thead>
              <tr>
                <th>{{ $t('distribute.columns.member') }}</th>
                <th class="text-right">{{ $t('distribute.columns.contribRatio') }}</th>
                <th class="text-right">{{ $t('distribute.columns.distRatio') }}</th>
                <th class="text-right">{{ $t('distribute.columns.amount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in preview.distribution" :key="item.user_id">
                <td>
                  <div class="d-flex align-center gap-2">
                    <v-avatar color="primary" variant="tonal" size="32">
                      {{ item.display_name.charAt(0) }}
                    </v-avatar>
                    {{ item.display_name }}
                  </div>
                </td>
                <td class="text-right">{{ item.total_ratio.toFixed(1) }}</td>
                <td class="text-right">{{ item.percentage.toFixed(2) }}%</td>
                <td class="text-right font-weight-bold">{{ item.token_amount }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="text-right font-weight-bold">{{ $t('distribute.total') }}</td>
                <td class="text-right font-weight-bold text-primary">
                  {{ preview.total_tokens }}
                </td>
              </tr>
            </tfoot>
          </v-table>

          <v-alert type="info" variant="tonal" class="mb-4">
            {{ $t('distribute.autoCalcAlert') }}
          </v-alert>

          <v-btn
            color="primary"
            size="large"
            block
            :loading="distributing"
            @click="handleDistribute"
          >
            <v-icon class="mr-2">mdi-coin</v-icon>
            {{ $t('distribute.confirmButton') }}
          </v-btn>
        </v-card>

        <!-- Empty State -->
        <v-card v-else class="pa-6 text-center" variant="tonal">
          <v-icon icon="mdi-chart-donut" size="64" color="primary" class="mb-4" />
          <h3 class="text-h6 mb-2">{{ $t('distribute.emptyState.title') }}</h3>
          <p class="text-body-2 text-medium-emphasis">
            {{ $t('distribute.emptyState.desc') }}
          </p>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type DistributionPreview, type TokenDistribution } from '@/services/api'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const projectId = computed(() => route.params.id as string)

const milestoneName = ref('')
const totalTokens = ref(1000)
const onChain = ref(false)
const previewing = ref(false)
const distributing = ref(false)

const preview = ref<DistributionPreview | null>(null)
const distributions = ref<TokenDistribution[]>([])

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

async function loadDistributions() {
  try {
    distributions.value = await api.tokens.distributions(projectId.value)
  } catch (e) {
    console.error('Failed to load distributions:', e)
  }
}

async function handlePreview() {
  if (!totalTokens.value || totalTokens.value <= 0) return

  previewing.value = true
  try {
    preview.value = await api.tokens.preview(projectId.value, {
      milestone_name: milestoneName.value || undefined,
      total_tokens: totalTokens.value,
    })
  } catch (e: any) {
    showSnackbar(e.message || t('distribute.errorPreview'), 'error')
  } finally {
    previewing.value = false
  }
}

async function handleDistribute() {
  if (!preview.value) return

  distributing.value = true
  try {
    await api.tokens.distribute(projectId.value, {
      milestone_name: milestoneName.value || undefined,
      total_tokens: totalTokens.value,
      on_chain: onChain.value,
    })
    showSnackbar(t('distribute.success'), 'success')
    router.push(`/projects/${projectId.value}`)
  } catch (e: any) {
    showSnackbar(e.message || t('distribute.errorDistribute'), 'error')
  } finally {
    distributing.value = false
  }
}

onMounted(() => {
  loadDistributions()
})
</script>
