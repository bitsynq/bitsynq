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
            {{ project.description || '無描述' }}
          </p>
        </div>
        <div class="d-flex gap-2">
          <v-btn
            color="secondary"
            variant="tonal"
            prepend-icon="mdi-upload"
            :to="`/projects/${project.id}/meetings/new`"
          >
            上傳會議
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-coin"
            :to="`/projects/${project.id}/distribute`"
          >
            發放 Token
          </v-btn>
        </div>
      </div>

      <!-- Tabs -->
      <v-tabs v-model="activeTab" color="primary" class="mb-6">
        <v-tab value="overview">總覽</v-tab>
        <v-tab value="contributions">貢獻記錄</v-tab>
        <v-tab value="meetings">會議</v-tab>
        <v-tab value="members">成員</v-tab>
      </v-tabs>

      <v-window v-model="activeTab">
        <!-- Overview Tab -->
        <v-window-item value="overview">
          <v-row>
            <!-- Contribution Summary -->
            <v-col cols="12" lg="8">
              <v-card class="pa-6">
                <h3 class="text-h6 mb-4">貢獻分佈</h3>
                <div v-if="contributionSummary.length === 0" class="text-center py-8">
                  <v-icon icon="mdi-chart-pie" size="48" color="grey" class="mb-2" />
                  <p class="text-body-2 text-medium-emphasis">尚無貢獻記錄</p>
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
                    <p class="text-body-2 text-medium-emphasis">成員數</p>
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
                    <p class="text-body-2 text-medium-emphasis">總貢獻</p>
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
                    <p class="text-body-2 text-medium-emphasis">Token 符號</p>
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
                  {{ item.source_type === 'meeting' ? '會議' : '手動' }}
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
                :title="meeting.title || '未命名會議'"
                :subtitle="`${formatDate(meeting.created_at)} · ${meeting.status === 'processed' ? '已處理' : '待處理'}`"
              >
                <template #prepend>
                  <v-avatar color="secondary" variant="tonal">
                    <v-icon>mdi-calendar</v-icon>
                  </v-avatar>
                </template>
                <template #append>
                  <v-chip
                    :color="meeting.status === 'processed' ? 'success' : 'warning'"
                    size="small"
                  >
                    {{ meeting.status === 'processed' ? '已處理' : '待處理' }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-12">
              <v-icon icon="mdi-video-off" size="48" color="grey" class="mb-2" />
              <p class="text-body-2 text-medium-emphasis">尚無會議記錄</p>
            </div>
          </v-card>
        </v-window-item>

        <!-- Members Tab -->
        <v-window-item value="members">
          <v-card>
            <v-card-title class="d-flex align-center">
              <span>成員列表</span>
              <v-spacer />
              <v-btn
                v-if="project.current_user_role === 'admin'"
                size="small"
                color="primary"
                prepend-icon="mdi-account-plus"
                @click="showAddMemberDialog = true"
              >
                新增成員
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
                      {{ member.role === 'admin' ? '管理員' : '成員' }}
                    </v-chip>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-card>
        </v-window-item>
      </v-window>
    </template>

    <!-- Add Member Dialog -->
    <v-dialog v-model="showAddMemberDialog" max-width="400">
      <v-card class="pa-4">
        <v-card-title>新增成員</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newMemberEmail"
            label="成員 Email"
            type="email"
            :rules="[v => /.+@.+\..+/.test(v) || 'Email 格式不正確']"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showAddMemberDialog = false">取消</v-btn>
          <v-btn color="primary" :loading="addingMember" @click="handleAddMember">
            新增
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, inject, computed } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Project, type Contribution, type Meeting } from '@/services/api'

const route = useRoute()
const showSnackbar = inject<(msg: string, color?: string) => void>('showSnackbar')!

const projectId = computed(() => route.params.id as string)
const project = ref<Project | null>(null)
const contributions = ref<Contribution[]>([])
const meetings = ref<Meeting[]>([])
const contributionSummary = ref<any[]>([])
const grandTotal = ref(0)

const loading = ref(true)
const loadingContributions = ref(false)
const activeTab = ref('overview')

const showAddMemberDialog = ref(false)
const newMemberEmail = ref('')
const addingMember = ref(false)

const contributionHeaders = [
  { title: '成員', key: 'user_display_name' },
  { title: '比例', key: 'ratio' },
  { title: '來源', key: 'source_type' },
  { title: '描述', key: 'description' },
  { title: '日期', key: 'created_at' },
]

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

async function loadProject() {
  loading.value = true
  try {
    project.value = await api.projects.get(projectId.value)
    await Promise.all([
      loadContributions(),
      loadMeetings(),
      loadSummary(),
    ])
  } catch (e: any) {
    showSnackbar(e.message || '載入專案失敗', 'error')
  } finally {
    loading.value = false
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
    showSnackbar('成員新增成功！', 'success')
    showAddMemberDialog.value = false
    newMemberEmail.value = ''
    await loadProject()
  } catch (e: any) {
    showSnackbar(e.message || '新增成員失敗', 'error')
  } finally {
    addingMember.value = false
  }
}

onMounted(() => {
  loadProject()
})
</script>
