<!-- pages/index.vue (Manual Fetch + setInterval Version) -->
<template>
  <div class="results-page-wrapper">
    <h1>🗳️ Election Results</h1>

    <!-- 1. Initial Loading State (Only show if loading AND we have no data yet) -->
    <div v-if="isLoading && voteData.length === 0" class="status loading-state">
      <div class="loading-spinner"></div>
      Loading initial vote data from spreadsheet...
    </div>

    <!-- 2. Error State (Show if an error occurred on the *last* fetch attempt) -->
    <div v-else-if="fetchError" class="status error-state">
       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16">
          <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
       </svg>
       <span>Error loading vote data: {{ fetchError.message }}</span>
       <!-- You might want to log the full error object to the console instead of displaying it -->
       <button @click="fetchData(true)" :disabled="isLoading || isRefreshing" class="retry-button">
          <span v-if="isLoading || isRefreshing"><div class="loading-spinner small inline"></div> Retrying...</span>
          <span v-else>Retry Now</span>
       </button>
       <!-- Display previous data if available despite error -->
       <div v-if="voteData.length > 0" class="error-stale-data-notice">
            Displaying last known data. Attempting to refresh periodically.
       </div>
    </div>

    <!-- 3. Success State - Displaying Data (Show if we have data, even if refreshing in background) -->
    <div v-else-if="voteData.length > 0" class="results-container">
      <!-- List 1 -->
      <div class="results-column card">
        <h2 class="list-title">لائحة ٢٠٤٠</h2>
        <ul>
          <li v-for="item in list1Votes" :key="item.name">
            <span class="candidate-name">{{ item.name }}</span>
            <span class="vote-count">{{ item.votes }}</span>
          </li>
        </ul>
      </div>
      <!-- List 2 -->
      <div class="results-column card">
        <h2 class="list-title">قرطبا بتستاهل</h2>
         <ul>
          <li v-for="item in list2Votes" :key="item.name">
            <span class="candidate-name">{{ item.name }}</span>
            <span class="vote-count">{{ item.votes }}</span>
          </li>
        </ul>
      </div>
    </div>

     <!-- 4. Success State - But No Data Found (Show after initial load if no data AND no error) -->
     <div v-else-if="!isLoading && !fetchError && voteData.length === 0" class="status">
        Successfully connected, but no votes were found in the spreadsheet. Data will refresh periodically.
     </div>

     <!-- 5. Fallback for unexpected states (shouldn't normally be reached) -->
     <div v-else class="status">
       Waiting for data...
     </div>


    <!-- Controls Area -->
    <div class="controls">
       <!-- Manual Refresh Button -->
       <button @click="fetchData(true)" :disabled="isLoading || isRefreshing" title="Fetch vote data again">
        <span v-if="isLoading || isRefreshing">
            <div class="loading-spinner small inline"></div> Refreshing...
        </span>
        <span v-else>Refresh Now</span>
      </button>
       <p v-if="lastUpdated !== 'Never'" class="status-indicator">
            <!-- Subtle indicator for background activity -->
            <span v-if="isRefreshing" class="pulsing-dot" title="Refreshing data in background..."></span>
            <span v-else-if="fetchError" class="error-dot" title="Last refresh attempt failed"></span>
            Last updated: {{ lastUpdated }} (Refreshes every {{ REFRESH_INTERVAL_SECONDS }}s)
       </p>
        <p v-else-if="isLoading" class="status-indicator">
            Loading initial data...
        </p>
        <p v-else-if="fetchError" class="status-indicator error-text">
            Initial load failed. Check error above.
       </p>
    </div>

    <div class="copyright">
       © {{ new Date().getFullYear() }} Election Results Viewer
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// --- Interfaces ---
interface VoteInfo { name: string; votes: number; list: string; }
interface ApiResponse { votes: VoteInfo[]; } // Assuming API structure

// --- Constants ---
const REFRESH_INTERVAL_MS = 3000; // Refresh every 30 seconds
const REFRESH_INTERVAL_SECONDS = REFRESH_INTERVAL_MS / 1000;
const API_ENDPOINT = '/api/votes'; // Your API endpoint

// --- State Refs ---
const voteData = ref<VoteInfo[]>([]);
const isLoading = ref<boolean>(true);       // True during initial load OR manual retry when no data exists
const isRefreshing = ref<boolean>(false);    // True during background interval refreshes
const fetchError = ref<Error | null>(null); // Stores the last fetch error object
const lastUpdated = ref<string>('Never');
const intervalId = ref<ReturnType<typeof setInterval> | null>(null); // To store the interval timer ID

// --- Fetch Logic ---
async function fetchData(isManualRetry = false) {
    // Determine loading state: use isLoading for initial/manual when empty, otherwise isRefreshing
    if (voteData.value.length === 0 || isManualRetry) {
        isLoading.value = true;
        isRefreshing.value = false; // Ensure only one state is true
    } else {
        isRefreshing.value = true;
        isLoading.value = false; // Ensure only one state is true
    }
    // Clear previous error *before* trying again
    // Keep fetchError set if showing stale data due to previous error,
    // only clear it *before* a new attempt.
    // We clear it here so the error message disappears while retrying.
    // fetchError.value = null; // Decide if you want the error to disappear during retry or only upon success

    console.log(`Fetching data... (Manual: ${isManualRetry}, Initial/Empty: ${voteData.value.length === 0})`);

    try {
        const response = await fetch(API_ENDPOINT);

        if (!response.ok) {
            // Throw an error with status info to be caught below
            const errorData = await response.text(); // Try to get some text context
            throw new Error(`HTTP error ${response.status} (${response.statusText}): ${errorData.slice(0, 100)}`);
        }

        const data: ApiResponse = await response.json();

        // Basic validation (optional but recommended)
        if (!data || !Array.isArray(data.votes)) {
            throw new Error("Invalid API response structure received.");
        }

        // Success! Update data and state
        voteData.value = data.votes;
        lastUpdated.value = new Date().toLocaleTimeString();
        fetchError.value = null; // Clear error on successful fetch
        console.log(`Data fetched successfully at: ${lastUpdated.value}`);

    } catch (error) {
        console.error("Error fetching vote data:", error);
        // Keep the old data, but set the error state
        fetchError.value = error instanceof Error ? error : new Error(String(error));
        // Don't update lastUpdated on error
    } finally {
        // Always clear loading states after fetch attempt completes
        isLoading.value = false;
        isRefreshing.value = false;
    }
}

// --- Computed Properties for Display ---
// These remain the same, depending on the reactive `voteData` ref
const sortedVotes = computed<VoteInfo[]>(() =>
    [...voteData.value].sort((a, b) => b.votes - a.votes) // Descending order
);

const list1Votes = computed<VoteInfo[]>(() =>
    sortedVotes.value.filter(v => v.list === 'لائحة ٢٠٤٠')
);

const list2Votes = computed<VoteInfo[]>(() =>
    sortedVotes.value.filter(v => v.list === 'قرطبا بتستاهل')
);


// --- Lifecycle Hooks ---
onMounted(() => {
    console.log("Component mounted. Starting initial data fetch and setting up polling.");
    fetchData(); // Perform initial fetch

    // Start polling
    intervalId.value = setInterval(() => {
        // Don't start a new fetch if one (initial or refresh) is already in progress
        if (!isLoading.value && !isRefreshing.value) {
            fetchData();
        } else {
            console.log("Skipping scheduled refresh as a fetch is already in progress.");
        }
    }, REFRESH_INTERVAL_MS);
});

onUnmounted(() => {
    console.log("Component unmounting. Clearing polling interval.");
    // Clear the interval when the component is destroyed
    if (intervalId.value) {
        clearInterval(intervalId.value);
    }
});

</script>

<style>/* Keep your existing global styles */:root { --primary-bg-color: #1a233a; --card-bg-color: #2a3b52; --text-color-light: #e0e0e0; --text-color-lighter: #f5f5f5; --text-color-muted: #9DA3B4; --accent-color: #FF3B30; --accent-hover: #E02E24; --success-color: #34C759; --error-color: #FF453A; --error-bg: rgba(255, 69, 58, 0.1); --table-border-color: #3a4a63; --disabled-bg-color: #3a4a63; --disabled-text-color: #7e8a9e; } html, body, #__nuxt { min-height: 100%; margin: 0; padding: 0; background: linear-gradient(135deg, #1A1E2E 0%, #1D2135 100%); color: var(--text-color-light); font-family: 'Cairo', 'Tajawal', 'SF Pro Display', 'Inter', system-ui, sans-serif; font-size: 16px; } * { box-sizing: border-box; }</style>
<style scoped>
/* Keep all your existing scoped styles */
.results-page-wrapper { max-width: 1200px; margin: 0 auto; padding: 30px 20px 50px 20px; }
h1 { color: var(--text-color-lighter); margin-bottom: 35px; text-align: center; font-size: 2rem; font-weight: 700; }
.results-container { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 30px; }
.results-column.card { background-color: var(--card-bg-color); border-radius: 10px; padding: 20px 25px; border: 1px solid var(--table-border-color); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2); }
.list-title { color: var(--text-color-lighter); font-size: 1.5rem; font-weight: 600; margin-top: 0; margin-bottom: 20px; text-align: center; border-bottom: 1px solid var(--table-border-color); padding-bottom: 10px; }
ul { list-style: none; padding: 0; margin: 0; }
li { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--table-border-color); font-size: 1rem; }
li:last-child { border-bottom: none; }
.candidate-name { color: var(--text-color-light); font-weight: 500; flex-grow: 1; margin-right: 15px; }
.vote-count { color: var(--success-color); font-weight: 700; font-size: 1.1rem; background-color: rgba(52, 199, 89, 0.1); padding: 3px 8px; border-radius: 5px; min-width: 40px; text-align: center; flex-shrink: 0; }
.no-data-message { text-align: center; color: var(--text-color-muted); padding: 20px 0; font-style: italic; }
.status { padding: 25px; margin: 20px auto; background-color: var(--card-bg-color); border: 1px solid var(--table-border-color); border-radius: 8px; text-align: center; max-width: 600px; color: var(--text-color-muted); font-size: 1.1rem; }
.status.loading-state { display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--text-color-light); }
.status.error-state { background-color: var(--error-bg); border-color: rgba(255, 69, 58, 0.4); color: var(--error-color); text-align: left; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.status.error-state > span:first-child { /* Target the error message span */ display: flex; align-items: center; gap: 8px; font-weight: 500; }
.status.error-state svg { flex-shrink: 0; width: 18px; height: 18px; margin-right: 5px; }
.status.error-state .retry-button { padding: 8px 16px; font-size: 0.95rem; cursor: pointer; background-color: var(--accent-color); border: none; color: white; border-radius: 6px; transition: background-color 0.2s ease, opacity 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 15px; align-self: center; }
.status.error-state .retry-button:disabled { background-color: var(--disabled-bg-color); color: var(--disabled-text-color); cursor: not-allowed; opacity: 0.7; }
.status.error-state .retry-button:hover:not(:disabled) { background-color: var(--accent-hover); }
.error-stale-data-notice {
    font-size: 0.9em;
    color: var(--text-color-muted);
    margin-top: 15px;
    padding-top: 10px;
    border-top: 1px dashed rgba(255, 69, 58, 0.3);
    width: 100%;
    text-align: center;
}
.controls { text-align: center; margin-top: 35px; display: flex; flex-direction: column; flex-wrap: wrap; justify-content: center; align-items: center; gap: 12px; }
.controls button { padding: 10px 20px; font-size: 1rem; cursor: pointer; background-color: var(--accent-color); border: none; color: white; border-radius: 6px; transition: background-color 0.2s ease, opacity 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; }
.controls button:disabled { background-color: var(--disabled-bg-color); color: var(--disabled-text-color); cursor: not-allowed; opacity: 0.7; }
.controls button:hover:not(:disabled) { background-color: var(--accent-hover); }
.controls p { margin: 0; font-size: 0.9em; color: var(--text-color-muted); }
.status-indicator { display: inline-flex; align-items: center; gap: 8px; }
.status-indicator.error-text { color: var(--error-color); font-weight: 500; }
.pulsing-dot, .error-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; /* Adjust spacing */ }
.pulsing-dot { background-color: var(--success-color); animation: pulse 1.5s infinite ease-in-out; }
.error-dot { background-color: var(--error-color); } /* Solid red dot for error */
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
.loading-spinner { display: inline-block; width: 24px; height: 24px; border: 3px solid rgba(255, 255, 255, 0.3); border-radius: 50%; border-top-color: var(--text-color-lighter); animation: spin 0.8s linear infinite; }
.loading-spinner.small { width: 16px; height: 16px; border-width: 2px; }
.loading-spinner.inline { vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
.copyright { margin-top: 40px; padding-top: 20px; font-size: 0.8rem; color: var(--text-color-muted); text-align: center; opacity: 0.6; border-top: 1px solid var(--table-border-color); }
</style>