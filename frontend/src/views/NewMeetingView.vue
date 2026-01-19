<template>
  <v-container class="py-8">
    <!-- Header -->
    <div class="d-flex align-center gap-2 mb-6">
      <v-btn icon size="small" variant="text" @click="$router.back()">
        <v-icon>mdi-arrow-left</v-icon>
      </v-btn>
      <h1 class="text-h4 font-weight-bold">{{ $t('meeting.title') }}</h1>
    </div>

    <v-row>
      <v-col cols="12" lg="7">
        <v-card class="pa-6">
          <div class="d-flex justify-space-between align-center mb-4">
            <h3 class="text-h6">{{ $t('meeting.subtitle') }}</h3>
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

          <p class="text-body-2 text-medium-emphasis mb-4">
            {{ $t('meeting.desc') }}
          </p>

          <v-form @submit.prevent="handleParse">
            <v-text-field
              v-model="title"
              :label="$t('meeting.fields.title')"
              :placeholder="$t('meeting.fields.titlePlaceholder')"
              class="mb-4"
            />

            <v-textarea
              v-model="transcript"
              :label="$t('meeting.fields.transcript')"
              :placeholder="$t('meeting.fields.transcriptPlaceholder')"
              rows="12"
              :rules="[v => !!v || $t('meeting.fields.validate')]"
              class="mb-4"
            />

            <div class="d-flex gap-2">
              <v-btn
                type="submit"
                color="primary"
                size="large"
                :loading="parsing"
                :disabled="!transcript.trim()"
                class="flex-grow-1"
              >
                {{ $t('meeting.parseButton') }} (Regex)
              </v-btn>

              <v-btn
                v-if="aiStatus.supported"
                color="secondary"
                size="large"
                prepend-icon="mdi-creation"
                :loading="analyzingAi"
                :disabled="!transcript.trim() || !meetingId"
                @click="handleAiAnalyze"
                class="flex-grow-1"
              >
                AI Analyze
              </v-btn>
            </div>
            
            <div v-if="aiStatus.supported && !meetingId" class="text-caption text-medium-emphasis mt-2 text-center">
              * Please upload/parse first to create meeting record, then use AI analysis.
            </div>
          </v-form>
        </v-card>
      </v-col>

      <v-col cols="12" lg="5">
        <!-- Parsed Results -->
        <v-card v-if="parsedData || aiResult" class="pa-6">
          <div class="d-flex justify-space-between align-center mb-4">
            <h3 class="text-h6">{{ $t('meeting.results.title') }}</h3>
            <div class="d-flex align-center gap-2">
              <v-chip v-if="aiResult" color="purple" size="small" variant="tonal">
                AI Powered
              </v-chip>
              <v-chip v-else size="small" :color="confidenceColor" variant="tonal">
                {{ $t('meeting.results.confidence', { score: parsedData?.parse_confidence || 0 }) }}
              </v-chip>
            </div>
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
                <th class="text-right">{{ $t('meeting.table.originalRatio') }}</th>
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

        <!-- Tips -->
        <v-card v-else class="pa-6" variant="tonal">
          <h3 class="text-h6 mb-4">
            <v-icon class="mr-2">mdi-lightbulb-outline</v-icon>
            {{ $t('meeting.tips.title') }}
          </h3>
          <ul class="text-body-2 text-medium-emphasis pl-4">
            <li class="mb-2">{{ $t('meeting.tips.step1') }}</li>
            <li class="mb-2">{{ $t('meeting.tips.step2') }}</li>
            <li class="mb-2">{{ $t('meeting.tips.step3') }}</li>
            <li>{{ $t('meeting.tips.step4') }}</li>
          </ul>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, type Project, type ParsedMeetingData, type ParsedParticipant } from '@/services/api'
import { llmService, type AIAnalysisResult } from '@/services/llm'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const projectId = computed(() => route.params.id as string)

const title = ref('')
const transcript = ref('')
const parsing = ref(false)
const analyzingAi = ref(false)
const submitting = ref(false)

const project = ref<Project | null>(null)
const meetingId = ref<string | null>(null)
const parsedData = ref<ParsedMeetingData | null>(null)
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
    showSnackbar(e.message || t('profile.errorLoad'), 'error')
    router.back()
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

// 1. Backend Regex Parsing
async function handleParse() {
  if (!transcript.value.trim()) return

  parsing.value = true
  aiResult.value = null // Reset AI result
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
      reasoning: ''
    }))

    showSnackbar(t('meeting.successParse'), 'success')
  } catch (e: any) {
    showSnackbar(e.message || t('meeting.errorParse'), 'error')
  } finally {
    parsing.value = false
  }
}

// 2. Frontend Chrome AI Analysis
async function handleAiAnalyze() {
  if (!transcript.value.trim()) return

  analyzingAi.value = true
  try {
    const result = await llmService.analyzeMeeting(transcript.value)
    aiResult.value = result
    
    // Merge AI results with existing participant data or replace it
    // We try to match names from AI with existing names to preserve matched_user_id
    
    // Temporarily map existing matches
    const existingMatches = new Map<string, string | null>();
    editableParticipants.value.forEach(p => {
      existingMatches.set(p.name.toLowerCase(), p.matched_user_id);
    });

    // Create new list from AI results
    const newParticipants = result.participants.map(p => {
      // Try to find existing match
      const lowerName = p.name.toLowerCase();
      let matchedId = existingMatches.get(lowerName) || null;
      
      // If not exact match, try partial
      if (!matchedId) {
        for (const [name, id] of existingMatches) {
          if (name.includes(lowerName) || lowerName.includes(name)) {
            matchedId = id;
            break;
          }
        }
      }
      
      // If still no match, try to match with project members (fallback)
      if (!matchedId && project.value?.members) {
         const member = project.value.members.find(m => 
           m.display_name.toLowerCase().includes(lowerName) || 
           lowerName.includes(m.display_name.toLowerCase())
         );
         if (member) matchedId = member.id;
      }

      return {
        name: p.name,
        matched_user_id: matchedId,
        ratio: p.suggested_ratio,
        originalRatio: p.suggested_ratio,
        included: true,
        reasoning: p.reasoning
      };
    });
    
    editableParticipants.value = newParticipants;
    
    showSnackbar('AI Analysis Complete', 'success')

  } catch (e: any) {
    console.error(e)
    showSnackbar('AI Analysis Failed: ' + e.message, 'error')
  } finally {
    analyzingAi.value = false
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
      description: p.reasoning ? `AI Reason: ${p.reasoning}` : `From meeting: ${title.value || 'Untitled'}`,
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
  loadProject()
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
