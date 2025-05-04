<template>
  <div class="wrapper elections-page">
    <div class="notification-container">
      <transition name="fade">
        <div v-if="voteNotificationMessage" class="vote-notification-wrapper">
          <VotedUpdated :message="voteNotificationMessage" />
        </div>
      </transition>

      <transition name="fade">
        <div v-if="logisticsNotificationMessage" class="logistics-notification-wrapper">
          <LogisticsUpdate :message="logisticsNotificationMessage" />
        </div>
      </transition>
      <transition name="fade">
        <div v-if="warningNotificationMessage" class="warning-notification-wrapper">
          <WarningPopup :message="warningNotificationMessage" />
        </div>
      </transition>
      <transition name="fade">
        <div v-if="disconnectNotificationMessage" class="disconnect-notification-wrapper">
          <DisconnectPopup :message="disconnectNotificationMessage" />
        </div>
      </transition>
    </div>

    <div class="top-bar">
      <button @click="handleLogout" class="logout-btn">
        Logout ({{ currentUser || '...' }})
      </button>
      <button @click="toggleLiveConnection" :disabled="connecting || recordsLoading" class="live-btn" :class="{ 'live-active': isLive }">
        <span v-if="connecting" class="loading-spinner small"></span>
        {{ isLive ? 'Stop Live Updates' : 'Go Live' }}
      </button>
    </div>

    <nav class="main-nav">
      <NuxtLink to="/elections" exact-active-class="router-link-active">Election Management</NuxtLink>
      <NuxtLink to="/stats" exact-active-class="router-link-active">Voting Statistics</NuxtLink>
      <NuxtLink to="/results" exact-active-class="router-link-active">detailed Statistics</NuxtLink>

    </nav>

    <h1 style="margin-top: 20px;">Election Management</h1>

    <transition name="fade">
      <div v-if="successMessage" class="message success-message">
        <span>{{ successMessage }}</span>
      </div>
    </transition>
    <transition name="fade">
      <div v-if="errorMessage" class="message error-message">
        <span>{{ errorMessage }}</span>
      </div>
    </transition>

    <div class="filter-container">
      <form @submit.prevent.stop>
        <div class="form-group">
          <label for="filterName">الاسم (Name):</label>
          <input type="text" id="filterName" v-model="filterName" placeholder="Filter by name..." :disabled="recordsLoading">
        </div>
        <div class="form-group">
          <label for="filterFather">اسم الأب (Father):</label>
          <input type="text" id="filterFather" v-model="filterFather" placeholder="Filter by father's name..." :disabled="recordsLoading">
        </div>
        <div class="form-group">
          <label for="filterFamily">العائلة (Family):</label>
          <input type="text" id="filterFamily" v-model="filterFamily" placeholder="Filter by family name..." :disabled="recordsLoading">
        </div>
        <div class="form-group">
          <label for="filterRegister">السجل (Register):</label>
          <input type="text" id="filterRegister" v-model="filterRegister" placeholder="Filter by register..." :disabled="recordsLoading">
        </div>
        <button type="button" @click="applyBackendFilters" :disabled="recordsLoading || applyingFilters" class="filter-apply-btn">
          <span v-if="applyingFilters" class="loading-spinner small"></span> 
          Apply Filters
        </button>
        <button type="button" @click="clearFilters" :disabled="recordsLoading || !filtersActive" class="filter-clear-btn">
          Clear Filters
        </button>
      </form>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Action</th> 
            <th>السجل</th>
            <th>العائلة</th>
            <th>الاسم</th>
            <th>اسم الأب</th>
            <th>اسم الأم</th>
            <th>تاريخ الولادة</th>
            <th>الجنس</th>
            <th>انتخب</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="recordsLoading">
            <td colspan="9" class="status-cell">  Adjusted colspan 
              <span class="loading-spinner"></span> Loading page {{ currentPage }} 
            </td>
          </tr>
          <tr v-else-if="!recordsLoading && electionRecords.length === 0">
             <td colspan="9" class="status-cell">No records found matching the criteria.</td>  
          </tr>
           <tr v-else v-for="(record, index) in electionRecords" :key="record.id" :class="{ 'record-updated': record.updated }">
            <td>
                <button
                    @click="handleRevokeVote(record.id, index)" 
                    :disabled="!record.voted || isRevoking[record.id]"
                    v-if="record.voted"  Only show button if voted 
                    class="revoke-btn"
                    title="Revoke this vote"
                >
                    <span v-if="isRevoking[record.id]" class="loading-spinner small"></span>
                    Revoke Vote
                </button>
            </td>
            <td>{{ record.register ?? 'N/A' }}</td>
            <td>{{ record.family ?? 'N/A' }}</td>
            <td>{{ record.name ?? 'N/A' }}</td>
            <td>{{ record.father ?? 'N/A' }}</td>
            <td>{{ record.mother ?? 'N/A' }}</td>
            <td>{{ record.dob ?? 'N/A' }}</td>
            <td>{{ record.sex ?? 'N/A' }}</td>
            <td>{{ record.voted ? 'نعم' : 'لا' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination" v-if="!recordsLoading && !filtersActive && totalPages > 1">
      <button @click="goToPage(currentPage - 1)" :disabled="currentPage === 1 || recordsLoading">Previous</button>
      <span>Page {{ currentPage }} of {{ totalPages }}</span>
      <button @click="goToPage(currentPage + 1)" :disabled="currentPage === totalPages || recordsLoading">Next</button>
    </div>
     <div class="pagination-info" v-else-if="!recordsLoading && !filtersActive && totalRecords > 0 && totalPages <= 1">
        <span>Total Records: {{ totalRecords }}</span>
    </div>
     <div class="pagination-info" v-else-if="!recordsLoading && !filtersActive && totalRecords === 0">
         <span>No records in the system.</span> 
    </div>
     <div class="pagination-info" v-else-if="!recordsLoading && filtersActive">
        <span>Displaying filtered results. Found: {{ electionRecords.length }}</span>  
    </div>

    <p class="copyright">© {{ new Date().getFullYear() }} Kartaba 2040 All rights reserved.</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from '#app';
import { checkSession } from '~/javascript/home.js';
// Import Service files
import { fetchInitialDataAndCount, fetchRecordsPage } from '~/javascript/electionservice.js';
// V V V --- ENSURE FILENAME MATCHES YOUR FILE --- V V V
import { fetchFilteredRecords } from '~/javascript/backendsort.js'; // Standardized name
// V V V --- ENSURE FILENAME MATCHES YOUR FILE --- V V V
import { revokeVote } from '~/javascript/revokefile.js'; // Standardized name
import { createWebSocketConnection } from '~/javascript/socket.js';

// Import ALL popup components
import VotedUpdated from '~/components/voteupdate.vue';
import LogisticsUpdate from '~/components/logisticsmove.vue';
import WarningPopup from '~/components/warning.vue';
import DisconnectPopup from '~/components/disconnectwarning.vue';

// --- Basic console logging function (uncomment below line to enable logs) ---
// const log = (msg, ...args) => console.log(`[ElectionsDebug] ${msg}`, args.length > 0 ? args : '');

const router = useRouter();
const currentUser = ref(null);
const electionRecords = ref([]);
const audioPlayer = ref(null);

// --- Filter State ---
const filterName = ref('');
const filterFather = ref('');
const filterFamily = ref('');
const filterRegister = ref('');

// Loading States
const recordsLoading = ref(true); // Overall page/data loading
const applyingFilters = ref(false); // Specific spinner state for filter button
const isRevoking = ref({}); // State for individual revoke button loading { recordId: boolean }

// Messages State
const errorMessage = ref(null);
const successMessage = ref(null);
let messageTimeout = null;

// Pagination State
const currentPage = ref(1);
const totalPages = ref(1);
const itemsPerPage = ref(25);
const totalRecords = ref(0);

// Filter Active State
const filtersActive = ref(false); // Controls if filters are applied (hides pagination)

// WebSocket State
const isLive = ref(false);
const connecting = ref(false);
const socketInstance = ref(null);
const recordUpdateTimers = ref({}); // For highlighting updated rows

// Notification State (Popups)
const voteNotificationMessage = ref(null);
let voteNotificationTimeout = null;
const logisticsNotificationMessage = ref(null);
let logisticsNotificationTimeout = null;
const warningNotificationMessage = ref(null);
let warningNotificationTimeout = null;
const disconnectNotificationMessage = ref(null);
let disconnectNotificationTimeout = null;

// --- Computed property ---
const isAnyFilterApplied = computed(() => {
  return filterName.value.trim() !== '' ||
         filterFather.value.trim() !== '' ||
         filterFamily.value.trim() !== '' ||
         filterRegister.value.trim() !== '';
});

// --- Helper Functions ---

function showMessage(type, message, duration = 4000) {
  if (messageTimeout) clearTimeout(messageTimeout);
  errorMessage.value = type === 'error' ? message : null;
  successMessage.value = (type === 'success' || type === 'info' || type === 'warning') ? message : null;
  messageTimeout = setTimeout(() => {
      successMessage.value = null;
      errorMessage.value = null;
  }, duration);
}

function processAndDisplayRecords(records, count, page) {
  // log('processAndDisplayRecords called with count:', count, 'page:', page);
  electionRecords.value = records.map(r => ({ ...r, voted: r.voted ?? false, updated: false }));
  // Only update pagination totals if filters are NOT active
  if (!filtersActive.value) {
      totalRecords.value = count;
      totalPages.value = Math.ceil(count / itemsPerPage.value) || 1;
  } else {
      // For filtered results, we don't have a total count, so ensure pagination remains hidden
      // totalPages.value = 1; // Not strictly needed as controls are hidden
  }
  currentPage.value = page;

  if (currentPage.value > totalPages.value && totalPages.value > 0 && !filtersActive.value) {
    currentPage.value = totalPages.value;
  } else if (totalPages.value === 0 && currentPage.value !== 1 && !filtersActive.value) {
    currentPage.value = 1;
  }

  if (count === 0 && filtersActive.value) {
    showMessage('info', 'No records found matching the filter criteria.');
  }
}

// --- Data Fetching Functions ---

async function loadInitialData() {
  // Loads initial unfiltered view (page 1) and total count
  // log("[loadInitialData] STARTING."); // Uncomment for debug
  recordsLoading.value = true;
  errorMessage.value = null; successMessage.value = null;
  filterName.value = ''; filterFather.value = ''; filterFamily.value = ''; filterRegister.value = '';
  filtersActive.value = false; // Reset filter state
  currentPage.value = 1; totalPages.value = 1; totalRecords.value = 0;
  electionRecords.value = [];

  try {
    // log("[loadInitialData] Fetching count..."); // Uncomment for debug
    const countResult = await fetchInitialDataAndCount();
    // log("[loadInitialData] Count Result:", countResult); // Uncomment for debug
    if (!countResult.success || typeof countResult.count !== 'number') {
      throw new Error(countResult.error?.message || 'Failed to fetch count.');
    }
    totalRecords.value = countResult.count;
    totalPages.value = Math.ceil(totalRecords.value / itemsPerPage.value) || 1;

    if (totalRecords.value > 0) {
      // log("[loadInitialData] Fetching page 1..."); // Uncomment for debug
      const pageResult = await fetchRecordsPage(1);
      // log("[loadInitialData] Page 1 Result:", pageResult); // Uncomment for debug
      if (!pageResult.success || !Array.isArray(pageResult.records)) {
        throw new Error(pageResult.error?.message || 'Failed to fetch page 1.');
      }
      processAndDisplayRecords(pageResult.records, totalRecords.value, 1); // Use TOTAL count here
    } else {
      showMessage('info', 'No records found in the system.', 5000);
    }
  } catch (error) {
    // log("[loadInitialData] ERROR:", error); // Uncomment for debug
    showMessage('error', `Failed to load initial data: ${error.message}`);
    electionRecords.value = []; totalRecords.value = 0; totalPages.value = 1; currentPage.value = 1;
  } finally {
    // log("[loadInitialData] FINALLY. Setting loading=false."); // Uncomment for debug
    recordsLoading.value = false;
  }
}


async function loadFilteredPage() { // No pagination for filters version
  // log(`[loadFilteredPage - No Pagination] Called.`); // Uncomment for debug
  if (!recordsLoading.value) recordsLoading.value = true; // Set loading if not already
  errorMessage.value = null;
  applyingFilters.value = true; // Show spinner

  const trimmedName = filterName.value.trim();
  const trimmedFather = filterFather.value.trim();
  const trimmedFamily = filterFamily.value.trim();
  const trimmedRegister = filterRegister.value.trim();
  let registerValue = null;
  if (trimmedRegister !== '') {
    const parsedInt = parseInt(trimmedRegister, 10);
    if (!isNaN(parsedInt)) { registerValue = parsedInt; }
  }
  const filters = {
    name: trimmedName === '' ? null : trimmedName,
    father: trimmedFather === '' ? null : trimmedFather,
    family: trimmedFamily === '' ? null : trimmedFamily,
    register: registerValue
  };
  // log(`[loadFilteredPage - No Pagination] Applying filters:`, filters); // Uncomment for debug

  try {
    // log(`[loadFilteredPage - No Pagination] Attempting fetchFilteredRecords...`); // Uncomment for debug
    const result = await fetchFilteredRecords(filters); // Use service expecting array response
    // log(`[loadFilteredPage - No Pagination] fetchFilteredRecords result:`, result); // Uncomment for debug

    if (result.success && Array.isArray(result.records)) {
      // log(`[loadFilteredPage - No Pagination] Success. Updating table.`); // Uncomment for debug
      // Update table, DO NOT update totalRecords/totalPages
      processAndDisplayRecords(result.records, result.records.length, 1); // Pass length as 'count' for this view context
      if (result.records.length === 0) {
        showMessage('info', 'No records found matching the filter criteria.');
      }
    } else {
      // log(`[loadFilteredPage - No Pagination] fetchFilteredRecords failed.`); // Uncomment for debug
      throw new Error(result.error?.message || `Failed to load filtered data.`);
    }
  } catch (err) {
    // log(`[loadFilteredPage - No Pagination] CRITICAL ERROR:`, err); // Uncomment for debug
    showMessage('error', `Failed to load filtered data: ${err.message}`);
    electionRecords.value = []; // Clear table on error
  } finally {
    // log(`[loadFilteredPage - No Pagination] FINALLY.`); // Uncomment for debug
    recordsLoading.value = false;      // Unlock UI
    applyingFilters.value = false;   // Hide spinner
  }
}


async function goToPage(page) {
  // This function ONLY handles pagination for UNFILTERED data
  // log(`[goToPage(${page})] Called. Filters active: ${filtersActive.value}`); // Uncomment for debug
  if (filtersActive.value) return; // Do nothing if filters are active
  if (page < 1 || page > totalPages.value || page === currentPage.value || recordsLoading.value) return;

  recordsLoading.value = true;
  errorMessage.value = null;

  try {
    // log(`[goToPage(${page})] Calling fetchRecordsPage directly.`); // Uncomment for debug
    const pageResult = await fetchRecordsPage(page);
    // log(`[goToPage(${page})] fetchRecordsPage Result:`, pageResult); // Uncomment for debug
    if (pageResult.success && Array.isArray(pageResult.records)) {
      processAndDisplayRecords(pageResult.records, totalRecords.value, page); // Use existing totalRecords
    } else {
      throw new Error(pageResult.error?.message || `Failed to load page ${page}.`);
    }
  } catch (error) {
    // log(`[goToPage(${page})] ERROR loading page:`, error); // Uncomment for debug
    showMessage('error', `Failed to load page ${page}: ${error.message}`);
  } finally {
    // log(`[goToPage(${page})] FINALLY (unfiltered). Setting loading=false.`); // Uncomment for debug
    recordsLoading.value = false;
  }
}

// --- Action Handlers ---

async function applyBackendFilters() {
  // log("applyBackendFilters called."); // Uncomment for debug
  if (recordsLoading.value || applyingFilters.value) return; // Prevent multiple clicks
  if (!isAnyFilterApplied.value) {
    showMessage('info', 'Please enter at least one filter value.');
    return;
  }
  filtersActive.value = true; // Activate filter mode (hides pagination)
  await loadFilteredPage(); // Load filtered results
}

async function clearFilters() {
  // log("clearFilters called."); // Uncomment for debug
  if (recordsLoading.value) return;
  if (!filtersActive.value && !isAnyFilterApplied.value) return;

  showMessage('info', 'Clearing filters and reloading all records...');
  await loadInitialData(); // Resets everything
}

function handleLogout() {
  // log("handleLogout called."); // Uncomment for debug
  disconnectWebSocket();
  localStorage.removeItem('authToken');
  router.push('/');
}

// --- Revoke Vote Handler ---
async function handleRevokeVote(recordId, index) { // Pass index for potential direct update
    // log(`handleRevokeVote called for ID: ${recordId}, Index: ${index}`); // Uncomment for debug
    if (isRevoking.value[recordId]) { return; } // Prevent double-clicks

    isRevoking.value[recordId] = true; // Set loading state
    errorMessage.value = null;

    try {
        const result = await revokeVote(recordId); // Call API

        if (result.success) {
            // log(`Revoke successful for ID: ${recordId}. Updating local data.`); // Uncomment for debug
            // Update local data directly using index if valid
             if (index >= 0 && index < electionRecords.value.length && electionRecords.value[index].id === recordId) {
                // More efficient direct update:
                electionRecords.value[index] = { ...electionRecords.value[index], voted: false };
             } else {
                 // Fallback if index is bad: find by ID (less efficient)
                 const foundIndex = electionRecords.value.findIndex(r => r.id === recordId);
                 if (foundIndex > -1) {
                     electionRecords.value[foundIndex] = { ...electionRecords.value[foundIndex], voted: false };
                 } else {
                      // log(`Record ID ${recordId} not found locally after successful revoke.`); // Uncomment for debug
                      showMessage('warning', 'Vote revoked, local record not found.'); // Inform user
                 }
             }
            showMessage('success', 'Vote revoked successfully.');
        } else {
            // log(`Revoke failed for ID: ${recordId}:`, result.error?.message); // Uncomment for debug
            showMessage('error', result.error?.message || 'Failed to revoke vote.');
        }
    } catch (error) {
        // log(`Unexpected error during revoke for ID: ${recordId}:`, error); // Uncomment for debug
        showMessage('error', `An unexpected error occurred: ${error.message}`);
    } finally {
        // log(`Removing loading state for ID: ${recordId}`); // Uncomment for debug
        delete isRevoking.value[recordId]; // Clean up loading state
    }
}


// --- WebSocket Functions ---
function handleWebSocketMessage(event) {
  // log("handleWebSocketMessage received:", event.data); // Uncomment for debug
  try {
    const data = JSON.parse(event.data);
    const updateType = data.update_type;
    const recordId = data.voter_id;
    const wsMessage = data.message;
    if (!updateType) return;

    const displayIndex = (recordId !== undefined && recordId !== null)
      ? electionRecords.value.findIndex(r => r.id === recordId) : -1;

    // Handle 'vote' update (could be vote OR revoke from another user)
    if (updateType === 'vote') {
      const newStatus = data.status; // Expect true for vote, false for revoke
      if (typeof newStatus !== 'boolean' || recordId === undefined || recordId === null) return;

      if (displayIndex > -1) {
        const updatedRecord = { ...electionRecords.value[displayIndex], voted: newStatus, updated: true };
        updateRecordInDisplayList(displayIndex, updatedRecord, recordId);
      }
      // Optional: Add notifications based on status
      if (newStatus === true) { // Voted
        if(voteNotificationTimeout) clearTimeout(voteNotificationTimeout);
        voteNotificationMessage.value = wsMessage || `Vote recorded for ID: ${recordId}`;
        voteNotificationTimeout = setTimeout(() => { voteNotificationMessage.value = null; }, 5000);
        if (audioPlayer.value && audioPlayer.value.readyState >= 2) {
          audioPlayer.value.currentTime = 0;
          audioPlayer.value.play().catch(error => console.warn("Audio playback failed:", error));
        }
      } else { // Revoked by someone else
         showMessage('info', `Vote for ID ${recordId} was revoked.`);
      }
    }
    // Handle other update types... (Logistics, Warnings)
    else if (updateType === 'logistics') {
        if(logisticsNotificationTimeout) clearTimeout(logisticsNotificationTimeout);
        logisticsNotificationMessage.value = wsMessage || `Logistics update: ${recordId || ''}`;
        logisticsNotificationTimeout = setTimeout(() => { logisticsNotificationMessage.value = null; }, 5000);
    }
    else if (updateType === 'warning') {
        if(warningNotificationTimeout) clearTimeout(warningNotificationTimeout);
        warningNotificationMessage.value = wsMessage || 'Warning Received';
        warningNotificationTimeout = setTimeout(() => { warningNotificationMessage.value = null; }, 5000);
    }
    else if (updateType === 'warning_severe') {
        if(disconnectNotificationTimeout) clearTimeout(disconnectNotificationTimeout);
        disconnectNotificationMessage.value = wsMessage || 'Severe Warning / Connection Issue';
        disconnectNotificationTimeout = setTimeout(() => { disconnectNotificationMessage.value = null; }, 7000);
    }

  } catch (err) {
    // log('Error processing WebSocket message:', err, event.data); // Uncomment for debug
    showMessage('error', 'Error processing live update.');
  }
}

function updateRecordInDisplayList(index, updatedRecord, recordId) {
  // log(`updateRecordInDisplayList called for index ${index}, ID ${recordId}`); // Uncomment for debug
  if (index < 0 || index >= electionRecords.value.length) return;
  // Use splice to ensure reactivity
  electionRecords.value.splice(index, 1, updatedRecord);

  // Highlight timer logic
  if (recordUpdateTimers.value[recordId]) clearTimeout(recordUpdateTimers.value[recordId]);
  recordUpdateTimers.value[recordId] = setTimeout(() => {
    const currentIndex = electionRecords.value.findIndex(r => r.id === recordId); // Find again in case order changed
    if (currentIndex > -1 && electionRecords.value[currentIndex].updated) {
      electionRecords.value[currentIndex].updated = false; // Directly mutate should be fine here, or splice again if needed
      // If direct mutation doesn't work:
      // const recordToClear = { ...electionRecords.value[currentIndex], updated: false };
      // electionRecords.value.splice(currentIndex, 1, recordToClear);
    }
    delete recordUpdateTimers.value[recordId];
  }, 1500);
}

function startWebSocketConnection() {
  // log("startWebSocketConnection called."); // Uncomment for debug
  if (isLive.value || connecting.value) return;
  connecting.value = true; errorMessage.value = null; successMessage.value = null;
  const socket = createWebSocketConnection();
  if (!socket) {
    showMessage('error', 'WebSocket failed to initialize.'); connecting.value = false; return;
  }
  socketInstance.value = socket;
  socket.onopen = () => { isLive.value = true; connecting.value = false; showMessage('success', 'Live updates enabled.'); };
  socket.onmessage = handleWebSocketMessage;
  socket.onerror = (error) => { console.error('WebSocket error:', error); showMessage('error', 'Live connection error.'); disconnectWebSocket(); };
  socket.onclose = (event) => {
    // log(`WebSocket closed: ${event.code}`); // Uncomment for debug
    if (isLive.value && event.code !== 1000) { showMessage('warning', `Live connection closed unexpectedly (${event.code}).`, 6000); }
    else if (connecting.value) { showMessage('error', `Failed live connection (${event.code}).`, 6000); }
    disconnectWebSocket(); // Full cleanup
  };
}

function disconnectWebSocket() {
  if (!socketInstance.value && !isLive.value && !connecting.value) return;
  // log("disconnectWebSocket called."); // Uncomment for debug
  isLive.value = false; connecting.value = false;
  if (socketInstance.value) {
    socketInstance.value.onopen = null; socketInstance.value.onmessage = null;
    socketInstance.value.onerror = null; socketInstance.value.onclose = null;
    if (socketInstance.value.readyState < 2) { // OPEN or CONNECTING
      try { socketInstance.value.close(1000, "Client disconnect"); } catch (e) {}
    }
    socketInstance.value = null;
  }
  Object.keys(recordUpdateTimers.value).forEach(id => clearTimeout(recordUpdateTimers.value[id]));
  recordUpdateTimers.value = {};
  if (voteNotificationTimeout) clearTimeout(voteNotificationTimeout); voteNotificationMessage.value = null;
  if (logisticsNotificationTimeout) clearTimeout(logisticsNotificationTimeout); logisticsNotificationMessage.value = null;
  if (warningNotificationTimeout) clearTimeout(warningNotificationTimeout); warningNotificationMessage.value = null;
  if (disconnectNotificationTimeout) clearTimeout(disconnectNotificationTimeout); disconnectNotificationMessage.value = null;
  electionRecords.value.forEach(r => { if (r.updated) r.updated = false; }); // Remove highlights
}

function toggleLiveConnection() {
  if (isLive.value) { disconnectWebSocket(); showMessage('info', 'Live updates stopped.'); }
  else { startWebSocketConnection(); }
}

// --- Lifecycle Hooks ---
onMounted(async () => {
  // log("onMounted: Component is mounting."); // Uncomment for debug
  recordsLoading.value = true;
  try {
    const sessionUser = await checkSession();
    if (!sessionUser) { router.push('/'); return; }
    currentUser.value = sessionUser.username || sessionUser.email || 'User';

    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      try { audioPlayer.value = new Audio('/votes.mp3'); audioPlayer.value.preload = 'auto'; }
      catch(e) { console.error("Failed audio init:", e); audioPlayer.value = null; }
    }
    await loadInitialData(); // Load initial data after setup
  } catch (mountError) {
    console.error("Critical mount error:", mountError);
    showMessage('error', "Critical error initializing page: " + mountError.message);
    recordsLoading.value = false; // Ensure UI unlocks
  }
});

onUnmounted(() => {
  // log("onUnmounted: Component is unmounting."); // Uncomment for debug
  disconnectWebSocket();
  if (messageTimeout) clearTimeout(messageTimeout);
  if (audioPlayer.value) {
    audioPlayer.value.pause(); audioPlayer.value.removeAttribute('src');
    audioPlayer.value.load(); audioPlayer.value = null;
  }
});

</script>

<style scoped>
/* Position ALL notifications */
.notification-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1050;
  display: flex;
  flex-direction: column; /* Stack notifications vertically */
  gap: 10px; /* Space between notifications */
  align-items: flex-end; /* Align to the right */
}

/* Individual notification wrappers */
.vote-notification-wrapper,
.logistics-notification-wrapper,
.warning-notification-wrapper,
.disconnect-notification-wrapper {
  min-width: 300px;
  max-width: 400px;
}

/* General Page Styles */
.wrapper.elections-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px 20px 60px 20px;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  color: #333;
  background-color: #f8f9fa;
}

h1 {
  color: var(--text-color-lighter, #212529);
  margin-bottom: 30px;
  text-align: center;
  margin-top: 20px;
  font-size: 2rem;
  font-weight: 600;
}

/* Top Bar */
.top-bar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  position: relative;
  height: 40px;
}

.logout-btn {
  padding: 8px 12px;
  background-color: var(--error-bg, #dc3545);
  color: var(--error-text, #fff);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s ease, filter 0.2s ease;
  order: 2;
}
.logout-btn:hover {
  filter: brightness(0.9);
  background-color: #c82333;
}

.live-btn {
  padding: 8px 15px;
  background-color: var(--accent-color, #007bff);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s ease, opacity 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  order: 1;
  font-size: 14px;
  font-weight: 500;
  height: 36px;
  box-sizing: border-box;
}
.live-btn:hover:not(:disabled) {
  background-color: var(--accent-hover, #0056b3);
}
.live-btn:disabled {
  background-color: var(--text-color-muted, #6c757d);
  opacity: 0.65;
  cursor: not-allowed;
}
.live-btn.live-active {
  background-color: var(--error-bg, #dc3545);
}
.live-btn.live-active:hover:not(:disabled) {
  background-color: #c82333;
  filter: brightness(1);
}

/* Main Navigation */
.main-nav {
  display: flex;
  gap: 25px;
  margin-bottom: 30px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--table-border-color, #dee2e6);
  justify-content: center;
}
.main-nav a {
  text-decoration: none;
  color: var(--accent-color, #007bff);
  padding: 8px 0;
  font-weight: 500;
  transition: color 0.2s ease, border-color 0.2s ease;
  border-bottom: 3px solid transparent;
}
.main-nav a:hover {
  color: var(--accent-hover, #0056b3);
}
.main-nav a.router-link-active {
  font-weight: 700;
  color: var(--accent-hover, #0056b3);
  border-bottom-color: var(--accent-color, #007bff);
}

/* Filter Container */
.filter-container {
  margin-bottom: 30px;
  padding: 25px;
  background-color: var(--card-bg-color, #ffffff);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  border: 1px solid #e9ecef;
}
.filter-container form {
  display: flex;
  flex-wrap: wrap;
  gap: 15px 20px;
  align-items: flex-end;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-grow: 1;
  flex-basis: 180px;
  min-width: 150px;
}
.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color-muted, #6c757d);
  margin-bottom: 2px;
}

.form-group input[type="text"] {
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid var(--input-border-color, #ced4da);
  background-color: var(--input-bg-color, #fff);
  font-size: 14px;
  color: var(--text-color-light, #495057);
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  height: 42px;
  width: 100%;
  box-sizing: border-box;
}

.form-group input[type="text"]:focus {
  border-color: var(--input-focus-border, #80bdff);
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.form-group input[type="text"]:disabled {
    background-color: var(--input-bg-color-disabled, #e9ecef) !important;
    color: var(--text-color-muted, #6c757d) !important;
    border-color: var(--input-border-color, #ced4da) !important;
    cursor: not-allowed !important;
    opacity: 0.7 !important;
}

/* Filter Buttons */
.filter-apply-btn,
.filter-clear-btn {
  padding: 0 20px;
  border: none;
  color: #fff;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s ease, opacity 0.2s ease, border-color 0.2s ease;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  font-size: 15px;
  flex-shrink: 0;
  margin-top: 8px;
  box-sizing: border-box;
}

.filter-apply-btn {
   background-color: var(--accent-color, #28a745);
   border: 1px solid transparent;
}
.filter-apply-btn:hover:not(:disabled) {
   background-color: var(--accent-hover, #218838);
   border-color: var(--accent-hover, #218838);
}

.filter-clear-btn {
   background-color: var(--text-color-muted, #6c757d);
   border: 1px solid var(--text-color-muted, #6c757d);
}
.filter-clear-btn:hover:not(:disabled) {
   background-color: #5a6268;
   border-color: #5a6268;
}

.filter-apply-btn:disabled,
.filter-clear-btn:disabled {
    background-color: #adb5bd !important;
    border-color: #adb5bd !important;
    color: #f8f9fa !important;
    opacity: 0.65 !important;
    cursor: not-allowed !important;
}


/* Table Styles */
.table-container {
  max-height: 70vh;
  overflow: auto;
  border: 1px solid var(--table-border-color, #dee2e6);
  border-radius: 8px;
  background-color: var(--primary-bg-color, #fff);
  margin-top: 25px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
}
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}
th, td {
  border: 1px solid var(--table-border-color, #dee2e6);
  padding: 10px 12px;
  font-size: 14px;
  vertical-align: middle;
  white-space: nowrap;
  text-align: left;
  color: var(--text-color-light, #495057);
}
thead th {
  background-color: var(--table-header-bg, #f8f9fa);
  color: var(--text-color-lighter, #212529);
  position: sticky;
  top: 0;
  z-index: 10;
  font-weight: 600;
  border-bottom-width: 2px;
}
tbody tr:nth-child(even) {
  background-color: var(--table-even-row-bg, #f8f9fa);
}
tbody tr:hover {
  background-color: var(--table-hover-row-bg, #e9ecef);
}

/* Status Cell */
td.status-cell {
  text-align: center;
  padding: 30px 15px;
  color: var(--text-color-muted, #6c757d);
  font-style: italic;
  white-space: normal;
}
td.status-cell .loading-spinner {
  border-top-color: var(--accent-color, #007bff);
  border-left-color: var(--accent-color, #007bff);
  border-right-color: var(--accent-color, #007bff);
}
/* Row Highlighting */
.record-updated td {
  background-color: rgba(255, 193, 7, 0.3) !important;
  transition: background-color 0.5s ease-out;
}
tbody tr.record-updated:hover td {
   background-color: rgba(255, 193, 7, 0.4) !important;
}

/* Styles for the Revoke Button Column */
td:first-child, th:first-child { /* Target first column */
    text-align: center; /* Center button/indicator */
    width: 120px; /* Optional: Set a fixed width */
    min-width: 100px;
}

/* Styles for the Revoke Button */
.revoke-btn {
  padding: 4px 8px; /* Smaller padding */
  font-size: 12px; /* Smaller font */
  background-color: #ffc107; /* Bootstrap warning yellow */
  color: #333; /* Dark text for yellow bg */
  border: 1px solid #ffc107;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
  line-height: 1.5; /* Adjust line height */
  display: inline-flex; /* Align spinner */
  align-items: center;
  gap: 5px;
  vertical-align: middle; /* Align with text in other cells */
}

.revoke-btn:hover:not(:disabled) {
  background-color: #e0a800; /* Darker yellow */
  border-color: #d39e00;
}

.revoke-btn:disabled {
  background-color: #e9ecef; /* Light grey when disabled */
  border-color: #ced4da;
  color: #6c757d; /* Muted text */
  opacity: 0.65;
  cursor: not-allowed;
}

/* Style for the placeholder when not voted */
.not-voted-indicator {
    display: inline-block;
    text-align: center; /* Center the dash */
    color: #adb5bd; /* Light grey color */
    font-weight: bold;
    font-size: 14px; /* Match table font size */
    line-height: 1.5;
    padding: 4px 8px; /* Match button padding for alignment */
    vertical-align: middle;
}


/* Pagination Styles */
.pagination {
  text-align: center;
  margin-top: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
}
.pagination-info {
  text-align: center;
  margin-top: 30px;
  color: var(--text-color-muted, #6c757d);
  font-size: 14px;
  font-weight: 500;
}
.pagination span {
  padding: 8px 15px;
  color: var(--text-color-muted, #6c757d);
  font-size: 14px;
  font-weight: 500;
  line-height: 40px;
}
.pagination button {
  padding: 0 20px;
  height: 40px;
  border: 1px solid var(--accent-color, #007bff);
  background-color: var(--accent-color, #007bff);
  color: #fff;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
.pagination button:hover:not(:disabled) {
  background-color: var(--accent-hover, #0056b3);
  border-color: var(--accent-hover, #0056b3);
}
.pagination button:disabled {
  background-color: var(--text-color-muted, #6c757d) !important;
  border-color: var(--text-color-muted, #6c757d) !important;
  opacity: 0.65 !important;
  cursor: not-allowed !important;
}


/* Loading Spinner */
.loading-spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(108, 117, 125, 0.3);
  border-radius: 50%;
  border-top-color: var(--text-color-lighter, #007bff);
  animation: spin 0.8s linear infinite;
  vertical-align: middle;
  box-sizing: border-box;
}
.loading-spinner.small {
  width: 14px;
  height: 14px;
  border-width: 2px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Message Boxes */
.message {
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  opacity: 1;
  transition: opacity 0.5s ease;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 500;
}
.success-message {
  background-color: var(--success-bg-light, #d4edda);
  color: var(--success-text-dark, #155724);
  border-color: var(--success-border, #c3e6cb);
}
.error-message {
  background-color: var(--error-bg-light, #f8d7da);
  color: var(--error-text-dark, #721c24);
  border-color: var(--error-border, #f5c6cb);
}
.message span {
  flex-grow: 1;
  padding-left: 10px;
}

/* Fade Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Copyright Footer */
.copyright {
  margin-top: 40px;
  font-size: 12px;
  color: var(--text-color-muted, #6c757d);
  text-align: center;
}
</style>