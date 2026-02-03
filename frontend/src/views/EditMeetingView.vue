<template>
  <v-container class="py-8">
    <!-- Header -->
    <div class="d-flex align-center gap-2 mb-6">
      <v-btn icon size="small" variant="text" @click="$router.back()">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <h1 class="text-h4 font-weight-bold">{{ $t('meeting.editTitle') || 'Process Meeting' }}</h1>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" size="64" />
    </div>

    <v-row v-else-if="meeting">
      <v-col cols="12" lg="7">
        <v-card class="pa-6">
          <div class="d-flex justify-space-between align-center mb-4">
            <h3 class="text-h6">{{ meeting.title || 'Untitled Meeting' }}</h3>
            <!-- AI Support Status -->
            <v-chip
              v-if="aiStatus.checked"
              :color="aiStatus.supported ? 'success' : 'grey'"
              size="small"
              variant="outlined"
            >
              <v-icon start size="small">{{ aiStatus.supported ? 'mdi-robot' : 'mdi-robot-off' }}</v-icon>
              {{ aiStatus.supported ? 'Chrome AI Ready' : 'AI Not Supported' }}
            </v-chip>
          </div>

          <v-alert
            v-if="aiStatus.checked && !aiStatus.supported"
            type="info"
            variant="tonal"
            density="compact"
            class="mb-4 text-caption"
          >
            {{ aiStatus.message }}
          </v-alert>

          <v-textarea
            v-model="transcript"
            label="Transcript"
            rows="12"
            readonly
            variant="outlined"
            class="mb-4"
          />

          <v-btn
            v-if="aiStatus.supported"
            color="secondary"
            size="large"
            prepend-icon="mdi-creation"
            :loading="analyzingAi"
            :disabled="!transcript.trim()"
            @click="handleAiAnalyze"
            block
          >
            Re-Analyze with AI
          </v-btn>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <!-- Parsed Results -->
        <v-card v-if="editableParticipants.length > 0" class="pa-6">
          <div class="d-flex justify-space-between align-center mb-4">
            <h3 class="text-h6">{{ $t('meeting.results.title') }}</h3>
            <v-chip v-if="aiResult" color="purple" size="small" variant="tonal">
              AI Powered
            </v-chip>
          </div>

          <!-- AI Summary & Sentiment -->
          <div v-if="aiResult" class="mb-4 pa-3 bg-grey-lighten-4 rounded">
            <div class="text-subtitle-2 mb-1">AI Summary</div>
            <p class="text-body-2 mb-2">{{ aiResult.summary }}</p>
            <div class="d-flex align-center">
              <span class="text-caption mr-2">Sentiment:</span>
              <v-progress-linear
                :model-value="aiResult.sentiment_score * 100"
                color="success"
                height="8"
                rounded
                style="width: 100px"
              ></v-progress-linear>
              <span class="text-caption ml-2">{{ (aiResult.sentiment_score * 100).toFixed(0) }}%</span>
            </div>
          </div>

          <v-alert
            v-if="unmatchedParticipants.length > 0"
            type="warning"
            variant="tonal"
            class="mb-4"
          >
            {{ $t('meeting.results.unmatched', { count: unmatchedParticipants.length }) }}
          </v-alert>

          <v-table density="compact" class="mb-4">
            <thead>
              <tr>
                <th style="width: 50px">{{ $t('meeting.table.enable') }}</th>
                <th>{{ $t('meeting.table.participant') }}</th>
                <th>{{ $t('meeting.table.matchedMember') }}</th>
                <th class="text-right">{{ $t('meeting.table.allocRatio') }}</th>
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
                <td>
                  <div>{{ p.name }}</div>
                  <div v-if="p.reasoning" class="text-caption text-medium-emphasis text-truncate" style="max-width: 120px">
                    {{ p.reasoning }}
                  </div>
                </td>
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
            <span class="text-body-2">{{ $t('meeting.totalRatio') }}:</span>
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
            {{ $t('meeting.submitButton') }}
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Project, type ParsedMeetingData, type Meeting } from '@/services/api'
import { llmService, type AIAnalysisResult } from '@/services/llm'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const projectId = computed(() => route.params.id as string)
const meetingId = computed(() => route.params.meetingId as string)

const loading = ref(true)
const analyzingAi = ref(false)
const submitting = ref(false)

const project = ref<Project | null>(null)
const meeting = ref<(Meeting & { raw_transcript: string; parsed_data: ParsedMeetingData }) | null>(null)
const transcript = ref('')
const aiResult = ref<AIAnalysisResult | null>(null)

// AI Status
const aiStatus = ref({ checked: false, supported: false, message: '' })

const editableParticipants = ref<Array<{
  name: string
  matched_user_id: string | null
  ratio: number
  included: boolean
  originalRatio: number
  reasoning?: string
}>>([])

const memberOptions = computed(() => {
  if (!project.value?.members) return []
  return [
    { text: t('meeting.table.selectPlaceholder'), value: null },
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

  // Fix rounding errors
  const newTotal = active.reduce((sum, p) => sum + p.ratio, 0)
  const diff = 100 - newTotal
  if (Math.abs(diff) > 0.001) {
    active[0].ratio = parseFloat((active[0].ratio + diff).toFixed(1))
  }
}

async function loadData() {
  loading.value = true
  try {
    // Load project and meeting in parallel
    const [proj, meet] = await Promise.all([
      api.projects.get(projectId.value),
      api.meetings.get(projectId.value, meetingId.value)
    ])

    project.value = proj
    meeting.value = meet
    transcript.value = meet.raw_transcript || ''

    // Convert parsed data to editable format
    if (meet.parsed_data?.participants) {
      editableParticipants.value = meet.parsed_data.participants.map(p => ({
        name: p.name,
        matched_user_id: p.matched_user_id || null,
        ratio: p.suggested_ratio,
        originalRatio: p.suggested_ratio,
        included: true,
        reasoning: ''
      }))
    }
  } catch (e: any) {
    showSnackbar(e.message || 'Failed to load meeting', 'error')
    router.back()
  } finally {
    loading.value = false
  }
}

async function checkAiSupport() {
  const result = await llmService.checkSupport()
  aiStatus.value = {
    checked: true,
    supported: result.supported,
    message: result.message
  }
}

async function handleAiAnalyze() {
  if (!transcript.value.trim()) return

  analyzingAi.value = true
  try {
    const result = await llmService.analyzeMeeting(transcript.value)
    aiResult.value = result

    // Merge AI results with existing matches
    const existingMatches = new Map<string, string | null>()
    editableParticipants.value.forEach(p => {
      existingMatches.set(p.name.toLowerCase(), p.matched_user_id)
    })

    const newParticipants = result.participants.map(p => {
      const lowerName = p.name.toLowerCase()
      let matchedId = existingMatches.get(lowerName) || null

      // Try partial match
      if (!matchedId) {
        for (const [name, id] of existingMatches) {
          if (name.includes(lowerName) || lowerName.includes(name)) {
            matchedId = id
            break
          }
        }
      }

      // Try project members
      if (!matchedId && project.value?.members) {
        const member = project.value.members.find(m =>
          m.display_name.toLowerCase().includes(lowerName) ||
          lowerName.includes(m.display_name.toLowerCase())
        )
        if (member) matchedId = member.id
      }

      return {
        name: p.name,
        matched_user_id: matchedId,
        ratio: p.suggested_ratio,
        originalRatio: p.suggested_ratio,
        included: true,
        reasoning: p.reasoning
      }
    })

    editableParticipants.value = newParticipants
    showSnackbar('AI Analysis Complete', 'success')
  } catch (e: any) {
    showSnackbar('AI Analysis Failed: ' + e.message, 'error')
  } finally {
    analyzingAi.value = false
  }
}

async function handleSubmit() {
  if (!canSubmit.value) return

  submitting.value = true
  try {
    const scale = 100 / totalRatio.value
    const contributions = activeParticipants.value.map(p => ({
      user_id: p.matched_user_id!,
      ratio: parseFloat((p.ratio * scale).toFixed(2)),
      description: p.reasoning ? `AI Reason: ${p.reasoning}` : `From meeting: ${meeting.value?.title || 'Untitled'}`,
    }))

    await api.meetings.process(projectId.value, meetingId.value, contributions)
    showSnackbar(t('meeting.successSubmit'), 'success')
    router.push(`/projects/${projectId.value}`)
  } catch (e: any) {
    showSnackbar(e.message || t('meeting.errorSubmit'), 'error')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadData()
  checkAiSupport()
})
</script>

<style scoped>
.ratio-input {
  max-width: 80px;
}
.gap-2 {
  gap: 8px;
}
</style>
