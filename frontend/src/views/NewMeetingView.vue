<template>
  <v-container class="py-8">
    <!-- Header -->
    <div class="d-flex align-center gap-2 mb-6">
      <v-btn icon size="small" variant="text" @click="$router.back()">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <h1 class="text-h4 font-weight-bold">上傳會議紀錄</h1>
    </div>

    <v-row>
      <v-col cols="12" lg="7">
        <v-card class="pa-6">
          <h3 class="text-h6 mb-4">貼上 Zoom 會議摘要</h3>
          <p class="text-body-2 text-medium-emphasis mb-4">
            將 Zoom AI 生成的會議摘要（Meeting Summary）貼上，系統會自動解析參與者和貢獻。
          </p>

          <v-form @submit.prevent="handleParse">
            <v-text-field
              v-model="title"
              label="會議標題"
              placeholder="選填，系統會嘗試從摘要中解析"
              class="mb-4"
            />

            <v-textarea
              v-model="transcript"
              label="會議摘要內容"
              placeholder="Meeting summary

Quick recap
...

Next steps
和融: Complete the token sender design...
胡舜元: Get Mohammad's contact info...

Summary
..."
              rows="12"
              :rules="[v => !!v || '請輸入會議內容']"
              class="mb-4"
            />

            <v-btn
              type="submit"
              color="primary"
              size="large"
              :loading="parsing"
              :disabled="!transcript.trim()"
            >
              解析會議
            </v-btn>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <!-- Parsed Results -->
        <v-card v-if="parsedData" class="pa-6">
          <div class="d-flex justify-space-between align-center mb-4">
            <h3 class="text-h6">解析結果</h3>
            <v-chip size="small" :color="confidenceColor" variant="tonal">
              信心度: {{ parsedData.parse_confidence }}%
            </v-chip>
          </div>

          <v-alert
            v-if="unmatchedParticipants.length > 0"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            有 {{ unmatchedParticipants.length }} 位參與者未匹配到專案成員，請手動指定。
          </v-alert>

          <v-table density="compact" class="mb-4">
            <thead>
              <tr>
                <th style="width: 50px">啟用</th>
                <th>參與者</th>
                <th>對應成員</th>
                <th class="text-right">原始比例</th>
                <th class="text-right">分配比例</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(p, idx) in editableParticipants"
                :key="idx"
                :class="{ 'text-medium-emphasis bg-grey-lighten-4': !p.included }"
              >
                <td>
                  <v-checkbox-btn
                    v-model="p.included"
                    density="compact"
                    @update:model-value="toggleParticipant(idx)"
                  />
                </td>
                <td>{{ p.name }}</td>
                <td>
                  <v-select
                    v-model="p.matched_user_id"
                    :items="memberOptions"
                    item-title="text"
                    item-value="value"
                    density="compact"
                    variant="plain"
                    hide-details
                    :disabled="!p.included"
                  />
                </td>
                <td class="text-right text-caption">
                  {{ p.originalRatio }}%
                </td>
                <td class="text-right">
                  <v-text-field
                    v-model.number="p.ratio"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    density="compact"
                    variant="plain"
                    hide-details
                    class="ratio-input"
                    suffix="%"
                    :disabled="!p.included"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>

          <div class="d-flex justify-space-between align-center mb-4">
            <span class="text-body-2">總計比例:</span>
            <v-chip :color="totalRatio === 100 ? 'success' : 'warning'">
              {{ totalRatio.toFixed(1) }}%
            </v-chip>
          </div>

          <v-btn
            color="primary"
            block
            size="large"
            :loading="submitting"
            :disabled="!canSubmit"
            @click="handleSubmit"
          >
            確認並建立貢獻記錄
          </v-btn>
        </v-card>

        <!-- Tips -->
        <v-card v-else class="pa-6" variant="tonal">
          <h3 class="text-h6 mb-4">
            <v-icon class="mr-2">mdi-lightbulb-outline</v-icon>
            提示
          </h3>
          <ul class="text-body-2 text-medium-emphasis pl-4">
            <li class="mb-2">系統會從 "Next steps" 區段提取參與者和任務</li>
            <li class="mb-2">每個任務會根據關鍵字計算權重</li>
            <li class="mb-2">可以手動調整比例，確保總計為 100%</li>
            <li>未匹配的參與者需手動選擇對應的專案成員</li>
          </ul>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Project, type ParsedMeetingData } from '@/services/api'

const route = useRoute()
const router = useRouter()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const projectId = computed(() => route.params.id as string)

const title = ref('')
const transcript = ref('')
const parsing = ref(false)
const submitting = ref(false)

const project = ref<Project | null>(null)
const meetingId = ref<string | null>(null)
const parsedData = ref<ParsedMeetingData | null>(null)
const editableParticipants = ref<Array<{
  name: string
  matched_user_id: string | null
  ratio: number
  included: boolean
  originalRatio: number
}>>([])

const memberOptions = computed(() => {
  if (!project.value?.members) return []
  return [
    { text: '-- 請選擇 --', value: null },
    ...project.value.members.map(m => ({
      text: m.display_name,
      value: m.id,
    })),
  ]
})

const unmatchedParticipants = computed(() =>
  editableParticipants.value.filter(p => p.included && !p.matched_user_id)
)

const activeParticipants = computed(() =>
  editableParticipants.value.filter(p => p.included)
)

const totalRatio = computed(() =>
  activeParticipants.value.reduce((sum, p) => sum + (p.ratio || 0), 0)
)

const canSubmit = computed(() =>
  activeParticipants.value.length > 0 &&
  activeParticipants.value.every(p => p.matched_user_id) &&
  Math.abs(totalRatio.value - 100) < 1
)

function toggleParticipant(index: number) {
  const p = editableParticipants.value[index]
  // p.included is already updated by v-model
  if (!p.included) {
    p.ratio = 0
  } else {
    p.ratio = p.originalRatio
  }
  normalizeRatios()
}

function normalizeRatios() {
  const active = activeParticipants.value
  if (active.length === 0) return

  const currentTotal = active.reduce((sum, p) => sum + p.originalRatio, 0)
  if (currentTotal === 0) return

  const scale = 100 / currentTotal

  active.forEach(p => {
    p.ratio = parseFloat((p.originalRatio * scale).toFixed(1))
  })

  // Fix rounding errors to ensure exactly 100%
  const newTotal = active.reduce((sum, p) => sum + p.ratio, 0)
  const diff = 100 - newTotal
  if (Math.abs(diff) > 0.001) {
    active[0].ratio = parseFloat((active[0].ratio + diff).toFixed(1))
  }
}

const confidenceColor = computed(() => {
  if (!parsedData.value) return 'grey'
  const c = parsedData.value.parse_confidence
  if (c >= 70) return 'success'
  if (c >= 40) return 'warning'
  return 'error'
})

async function loadProject() {
  try {
    project.value = await api.projects.get(projectId.value)
  } catch (e: any) {
    showSnackbar(e.message || '載入專案失敗', 'error')
    router.back()
  }
}

async function handleParse() {
  if (!transcript.value.trim()) return

  parsing.value = true
  try {
    const response = await api.meetings.create(projectId.value, {
      title: title.value || undefined,
      raw_transcript: transcript.value,
    })

    meetingId.value = response.id
    parsedData.value = response.parsed_data!

    // Convert to editable format
    editableParticipants.value = parsedData.value.participants.map(p => ({
      name: p.name,
      matched_user_id: p.matched_user_id || null,
      ratio: p.suggested_ratio,
      originalRatio: p.suggested_ratio,
      included: true,
    }))

    showSnackbar('解析完成！', 'success')
  } catch (e: any) {
    showSnackbar(e.message || '解析失敗', 'error')
  } finally {
    parsing.value = false
  }
}

async function handleSubmit() {
  if (!meetingId.value || !canSubmit.value) return

  submitting.value = true
  try {
    // Normalize ratios to exactly 100%
    const scale = 100 / totalRatio.value
    const contributions = activeParticipants.value.map(p => ({
      user_id: p.matched_user_id!,
      ratio: parseFloat((p.ratio * scale).toFixed(2)),
      description: `From meeting: ${title.value || 'Untitled'}`,
    }))

    await api.meetings.process(projectId.value, meetingId.value, contributions)
    showSnackbar('貢獻記錄建立成功！', 'success')
    router.push(`/projects/${projectId.value}`)
  } catch (e: any) {
    showSnackbar(e.message || '提交失敗', 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadProject()
})
</script>

<style scoped>
.ratio-input {
  max-width: 80px;
}
</style>
