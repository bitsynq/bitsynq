<template>
  <v-container class="py-8">
    <!-- Loading State -->
    <div v-if="loading" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" size="64" />
    </div>

    <template v-else-if="project">
      <!-- Header -->
      <div class="d-flex flex-wrap justify-space-between align-center mb-6 gap-4">
        <div>
          <div class="d-flex align-center gap-2 mb-1">
            <v-btn icon size="small" variant="text" @click="$router.push('/dashboard')">
              <v-icon>mdi-arrow-left</v-icon>
            </v-btn>
            <h1 class="text-h4 font-weight-bold">{{ project.name }}</h1>
          </div>
          <p class="text-body-2 text-medium-emphasis ml-10">
            {{ project.description || $t('project.overview.noDescription') }}
          </p>
        </div>
        <div class="d-flex gap-2">
          <v-btn
            color="secondary"
            variant="tonal"
            prepend-icon="mdi-upload"
            :to="`/projects/${project.id}/meetings/new`"
          >
            {{ $t('project.uploadMeeting') }}
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-coin"
            :to="`/projects/${project.id}/distribute`"
          >
            {{ $t('project.distributeToken') }}
          </v-btn>
        </div>
      </div>

      <!-- Tabs -->
      <v-tabs v-model="activeTab" color="primary" class="mb-6">
        <v-tab value="overview">{{ $t('project.tabs.overview') }}</v-tab>
        <v-tab value="contributions">{{ $t('project.tabs.contributions') }}</v-tab>
        <v-tab value="meetings">{{ $t('project.tabs.meetings') }}</v-tab>
        <v-tab value="members">{{ $t('project.tabs.members') }}</v-tab>
        <v-tab value="distributions">{{ $t('project.tabs.distributions') }}</v-tab>
      </v-tabs>

      <v-window v-model="activeTab">
        <!-- Overview Tab -->
        <v-window-item value="overview">
          <v-row>
            <!-- Contribution Summary -->
            <v-col cols="12" lg="8">
              <v-card class="pa-6">
                <h3 class="text-h6 mb-4">{{ $t('project.overview.contributionDist') }}</h3>
                <div v-if="contributionSummary.length === 0" class="text-center py-8">
                  <v-icon icon="mdi-chart-pie" size="48" color="grey" class="mb-2" />
                  <p class="text-body-2 text-medium-emphasis">{{ $t('project.overview.noContributions') }}</p>
                </div>
                <div v-else>
                  <div
                    v-for="item in contributionSummary"
                    :key="item.user_id"
                    class="mb-4"
                  >
                    <div class="d-flex justify-space-between mb-1">
                      <span class="text-body-2">{{ item.display_name }}</span>
                      <span class="text-body-2 font-weight-medium">
                        {{ item.percentage }}%
                      </span>
                    </div>
                    <v-progress-linear
                      :model-value="parseFloat(item.percentage)"
                      color="primary"
                      height="8"
                      rounded
                    />
                  </div>
                </div>
              </v-card>
            </v-col>

            <!-- Stats -->
            <v-col cols="12" lg="4">
              <v-card class="pa-6 mb-4">
                <div class="d-flex align-center gap-3">
                  <v-avatar color="primary" variant="tonal" size="48">
                    <v-icon>mdi-account-group</v-icon>
                  </v-avatar>
                  <div>
                    <p class="text-body-2 text-medium-emphasis">{{ $t('project.overview.memberCount') }}</p>
                    <p class="text-h5 font-weight-bold">{{ project.members?.length || 0 }}</p>
                  </div>
                </div>
              </v-card>

              <v-card class="pa-6 mb-4">
                <div class="d-flex align-center gap-3">
                  <v-avatar color="secondary" variant="tonal" size="48">
                    <v-icon>mdi-chart-timeline</v-icon>
                  </v-avatar>
                  <div>
                    <p class="text-body-2 text-medium-emphasis">{{ $t('project.overview.totalContribution') }}</p>
                    <p class="text-h5 font-weight-bold">{{ grandTotal.toFixed(1) }}</p>
                  </div>
                </div>
              </v-card>

              <v-card class="pa-6">
                <div class="d-flex align-center gap-3">
                  <v-avatar color="accent" variant="tonal" size="48">
                    <v-icon>mdi-coin</v-icon>
                  </v-avatar>
                  <div>
                    <p class="text-body-2 text-medium-emphasis">{{ $t('project.overview.tokenSymbol') }}</p>
                    <p class="text-h5 font-weight-bold">
                      {{ project.token_symbol || '-' }}
                    </p>
                  </div>
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-window-item>

        <!-- Contributions Tab -->
        <v-window-item value="contributions">
          <v-card>
            <v-data-table
              :headers="contributionHeaders"
              :items="contributions"
              :loading="loadingContributions"
              items-per-page="20"
            >
              <template #item.ratio="{ item }">
                <v-chip size="small" color="primary" variant="tonal">
                  {{ item.ratio.toFixed(1) }}%
                </v-chip>
              </template>
              <template #item.source_type="{ item }">
                <v-chip size="small" variant="outlined">
                  {{ item.source_type === 'meeting' ? $t('project.contributions.source.meeting') : $t('project.contributions.source.manual') }}
                </v-chip>
              </template>
              <template #item.created_at="{ item }">
                {{ formatDate(item.created_at) }}
              </template>
            </v-data-table>
          </v-card>
        </v-window-item>

        <!-- Meetings Tab -->
        <v-window-item value="meetings">
          <v-card>
            <v-list v-if="meetings.length > 0">
              <v-list-item
                v-for="meeting in meetings"
                :key="meeting.id"
                :title="meeting.title || $t('project.meetings.untitled')"
                :subtitle="`${formatDate(meeting.created_at)} · ${meeting.status === 'processed' ? $t('project.meetings.processed') : $t('project.meetings.pending')}`"
              >
                <template #prepend>
                  <v-avatar color="secondary" variant="tonal">
                    <v-icon>mdi-calendar</v-icon>
                  </v-avatar>
                </template>
                <template #append>
                  <div class="d-flex align-center gap-2">
                    <v-chip
                      :color="meeting.status === 'processed' ? 'success' : 'warning'"
                      size="small"
                      class="mr-2"
                    >
                      {{ meeting.status === 'processed' ? $t('project.meetings.processed') : $t('project.meetings.pending') }}
                    </v-chip>

                    <v-btn
                      v-if="meeting.status !== 'processed' && (project.current_user_role === 'admin' || meeting.created_by === authStore.currentUser?.id)"
                      icon
                      size="small"
                      variant="text"
                      color="error"
                      @click="confirmDeleteMeeting(meeting)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-12">
              <v-icon icon="mdi-video-off" size="48" color="grey" class="mb-2" />
              <p class="text-body-2 text-medium-emphasis">{{ $t('project.meetings.noMeetings') }}</p>
            </div>
          </v-card>
        </v-window-item>

        <!-- Delete Meeting Confirmation Dialog -->
        <v-dialog v-model="showDeleteMeetingDialog" max-width="400">
          <v-card>
            <v-card-title>{{ $t('project.meetings.deleteTitle') }}</v-card-title>
            <v-card-text>
              {{ T('project.meetings.deleteConfirm', { title: meetingToDelete?.title || $t('project.meetings.untitled') }) }}
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="showDeleteMeetingDialog = false">{{ $t('common.cancel') }}</v-btn>
              <v-btn
                color="error"
                :loading="deletingMeeting"
                @click="handleDeleteMeeting"
              >
                {{ $t('common.delete') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Members Tab -->
        <v-window-item value="members">
          <v-card>
            <v-card-title class="d-flex align-center">
              <span>{{ $t('project.members.title') }}</span>
              <v-spacer />
              <v-btn
                v-if="project.current_user_role === 'admin'"
                size="small"
                color="primary"
                prepend-icon="mdi-account-plus"
                @click="showAddMemberDialog = true"
              >
                {{ $t('project.members.add') }}
              </v-btn>
            </v-card-title>
            <v-list>
              <v-list-item
                v-for="member in project.members"
                :key="member.id"
                :title="member.display_name"
                :subtitle="member.email"
              >
                <template #prepend>
                  <v-avatar color="primary" variant="tonal">
                    {{ member.display_name.charAt(0).toUpperCase() }}
                  </v-avatar>
                </template>
                <template #append>
                  <div class="d-flex align-center gap-2">
                    <v-chip size="small" variant="outlined">
                      {{ member.balance }} tokens
                    </v-chip>
                    <v-chip
                      size="small"
                      :color="member.role === 'admin' ? 'primary' : 'default'"
                    >
                      {{ member.role === 'admin' ? $t('project.members.admin') : $t('project.members.member') }}
                    </v-chip>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-card>
        </v-window-item>


        <!-- Distributions Tab -->
        <v-window-item value="distributions">
          <v-card>
            <v-list v-if="distributions.length > 0">
              <v-list-item
                v-for="dist in distributions"
                :key="dist.id"
                :title="dist.milestone_name || $t('project.distributions.untitled')"
                :subtitle="`${formatDate(dist.created_at)} · ${$t('project.distributions.by', { name: dist.created_by_name || 'Admin' })}`"
                :href="dist.tx_hash ? `https://sepolia.etherscan.io/tx/${dist.tx_hash}` : undefined"
                :target="dist.tx_hash ? '_blank' : undefined"
              >
                <template #prepend>
                  <v-avatar color="secondary" variant="tonal">
                    <v-icon>mdi-gift</v-icon>
                  </v-avatar>
                </template>
                <template #append>
                  <div class="d-flex align-center gap-2">
                    <v-chip color="primary" variant="flat" class="mr-2">
                      {{ dist.total_tokens }} Tokens
                    </v-chip>

                    <v-tooltip location="top" v-if="dist.tx_hash">
                      <template #activator="{ props }">
                        <v-btn icon size="small" variant="text" color="primary" v-bind="props">
                          <v-icon>mdi-link-variant</v-icon>
                        </v-btn>
                      </template>
                      <span>View on Etherscan (Sepolia)</span>
                    </v-tooltip>

                    <v-chip v-if="dist.on_chain && !dist.tx_hash" size="small" color="error" variant="outlined">
                      {{ $t('project.distributions.onChainFailed') }}
                    </v-chip>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-12">
              <v-icon icon="mdi-gift-off" size="48" color="grey" class="mb-2" />
              <p class="text-body-2 text-medium-emphasis">{{ $t('project.distributions.noDistributions') }}</p>
            </div>
          </v-card>
        </v-window-item>
      </v-window>
    </template>

    <!-- Add Member Dialog -->
    <v-dialog v-model="showAddMemberDialog" max-width="400">
      <v-card class="pa-4">
        <v-card-title>{{ $t('project.members.add') }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newMemberEmail"
            :label="$t('project.members.emailLabel')"
            type="email"
            :rules="[v => /.+@.+\..+/.test(v) || t('auth.rules.email')]"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddMemberDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="addingMember" @click="handleAddMember">
            {{ $t('common.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api, type Project, type Contribution, type Meeting, type TokenDistribution } from '@/services/api'
import { useI18n } from 'vue-i18n'

const { t: T } = useI18n() // Use T to avoid conflict with t variable if any, or just consistent T() for template
const t = T // Alias for script usage
const route = useRoute()
const authStore = useAuthStore()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const projectId = computed(() => route.params.id as string)
const project = ref<Project | null>(null)
const contributions = ref<Contribution[]>([])
const meetings = ref<Meeting[]>([])
const distributions = ref<TokenDistribution[]>([])
const contributionSummary = ref<any[]>([])
const grandTotal = ref(0)

const loading = ref(true)
const loadingContributions = ref(false)
const activeTab = ref('overview')

const showAddMemberDialog = ref(false)
const newMemberEmail = ref('')
const addingMember = ref(false)

const showDeleteMeetingDialog = ref(false)
const meetingToDelete = ref<Meeting | null>(null)
const deletingMeeting = ref(false)

const contributionHeaders = computed(() => [
  { title: t('project.contributions.columns.member'), key: 'user_display_name' },
  { title: t('project.contributions.columns.ratio'), key: 'ratio' },
  { title: t('project.contributions.columns.source'), key: 'source_type' },
  { title: t('project.contributions.columns.description'), key: 'description' },
  { title: t('project.contributions.columns.date'), key: 'created_at' },
])

function formatDate(dateStr: string): string {
  // Use user browser locale or force based on i18n.locale if needed
  // For now simple date format
  return new Date(dateStr).toLocaleDateString()
}

async function loadProject() {
  loading.value = true
  try {
    project.value = await api.projects.get(projectId.value)
    await Promise.all([
      loadContributions(),
      loadMeetings(),
      loadDistributions(),
      loadSummary(),
    ])
  } catch (e: any) {
    showSnackbar(e.message || '載入專案失敗', 'error')
  } finally {
    loading.value = false
  }
}

async function loadDistributions() {
  try {
    distributions.value = await api.tokens.distributions(projectId.value)
  } catch (e) {
    console.error('Failed to load distributions:', e)
  }
}

async function loadContributions() {
  loadingContributions.value = true
  try {
    const result = await api.contributions.list(projectId.value)
    contributions.value = result.contributions
  } finally {
    loadingContributions.value = false
  }
}

async function loadMeetings() {
  try {
    meetings.value = await api.meetings.list(projectId.value)
  } catch (e) {
    console.error('Failed to load meetings:', e)
  }
}

async function loadSummary() {
  try {
    const result = await api.contributions.summary(projectId.value)
    contributionSummary.value = result.summary
    grandTotal.value = result.grand_total
  } catch (e) {
    console.error('Failed to load summary:', e)
  }
}

async function handleAddMember() {
  if (!newMemberEmail.value) return

  addingMember.value = true
  try {
    await api.projects.addMember(projectId.value, { email: newMemberEmail.value })
    showSnackbar(t('project.members.added'), 'success')
    showAddMemberDialog.value = false
    newMemberEmail.value = ''
    await loadProject()
  } catch (e: any) {
    showSnackbar(e.message || t('project.members.errorAdd'), 'error')
  } finally {
    addingMember.value = false
  }
}

function confirmDeleteMeeting(meeting: Meeting) {
  meetingToDelete.value = meeting
  showDeleteMeetingDialog.value = true
}

async function handleDeleteMeeting() {
  if (!meetingToDelete.value) return

  deletingMeeting.value = true
  try {
    await api.meetings.delete(projectId.value, meetingToDelete.value.id)
    showSnackbar(t('project.meetings.deleted'), 'success')
    showDeleteMeetingDialog.value = false
    await loadMeetings()
  } catch (e: any) {
    showSnackbar(e.message || t('project.meetings.errorDelete'), 'error')
  } finally {
    deletingMeeting.value = false
    meetingToDelete.value = null
  }
}

onMounted(() => {
  loadProject()
})
</script>
