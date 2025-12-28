<template>
  <v-container class="py-8">
    <!-- Header -->
    <div class="d-flex align-center gap-2 mb-6">
      <v-btn icon size="small" variant="text" @click="$router.back()">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <h1 class="text-h4 font-weight-bold">發放 Token</h1>
    </div>

    <v-row>
      <v-col cols="12" lg="5">
        <v-card class="pa-6">
          <h3 class="text-h6 mb-4">設定發放參數</h3>

          <v-form @submit.prevent="handlePreview">
            <v-text-field
              v-model="milestoneName"
              label="里程碑名稱"
              placeholder="例如: Phase 1 Complete"
              class="mb-4"
            />

            <v-text-field
              v-model.number="totalTokens"
              label="發放 Token 數量"
              type="number"
              min="1"
              :rules="[v => v > 0 || '請輸入正整數']"
              class="mb-4"
            />

            <v-btn
              type="submit"
              color="secondary"
              variant="tonal"
              block
              :loading="previewing"
              :disabled="!totalTokens || totalTokens <= 0"
            >
              預覽分配
            </v-btn>
          </v-form>
        </v-card>

        <!-- Distribution History -->
        <v-card class="pa-6 mt-4">
          <h3 class="text-h6 mb-4">發放歷史</h3>
          <v-list v-if="distributions.length > 0" density="compact">
            <v-list-item
              v-for="dist in distributions"
              :key="dist.id"
              :title="dist.milestone_name || '未命名'"
              :subtitle="`${formatDate(dist.created_at)} · ${dist.total_tokens} tokens`"
            >
              <template #prepend>
                <v-avatar color="success" variant="tonal" size="32">
                  <v-icon size="small">mdi-check</v-icon>
                </v-avatar>
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="text-body-2 text-medium-emphasis text-center py-4">
            尚無發放記錄
          </p>
        </v-card>
      </v-col>

      <v-col cols="12" lg="7">
        <!-- Preview Results -->
        <v-card v-if="preview" class="pa-6">
          <h3 class="text-h6 mb-4">分配預覽</h3>

          <v-table class="mb-4">
            <thead>
              <tr>
                <th>成員</th>
                <th class="text-right">貢獻比例</th>
                <th class="text-right">分配比例</th>
                <th class="text-right">Token 數量</th>
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
                <td colspan="3" class="text-right font-weight-bold">總計</td>
                <td class="text-right font-weight-bold text-primary">
                  {{ preview.total_tokens }}
                </td>
              </tr>
            </tfoot>
          </v-table>

          <v-alert type="info" variant="tonal" class="mb-4">
            Token 會根據每位成員的累計貢獻比例自動計算分配。
          </v-alert>

          <v-btn
            color="primary"
            size="large"
            block
            :loading="distributing"
            @click="handleDistribute"
          >
            <v-icon class="mr-2">mdi-coin</v-icon>
            確認發放
          </v-btn>
        </v-card>

        <!-- Empty State -->
        <v-card v-else class="pa-6 text-center" variant="tonal">
          <v-icon icon="mdi-chart-donut" size="64" color="primary" class="mb-4" />
          <h3 class="text-h6 mb-2">輸入發放參數</h3>
          <p class="text-body-2 text-medium-emphasis">
            設定 Token 數量後點擊「預覽分配」查看分配結果
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

const route = useRoute()
const router = useRouter()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const projectId = computed(() => route.params.id as string)

const milestoneName = ref('')
const totalTokens = ref(1000)
const previewing = ref(false)
const distributing = ref(false)

const preview = ref<DistributionPreview | null>(null)
const distributions = ref<TokenDistribution[]>([])

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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
    showSnackbar(e.message || '預覽失敗', 'error')
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
    })
    showSnackbar('Token 發放成功！', 'success')
    router.push(`/projects/${projectId.value}`)
  } catch (e: any) {
    showSnackbar(e.message || '發放失敗', 'error')
  } finally {
    distributing.value = false
  }
}

onMounted(() => {
  loadDistributions()
})
</script>
