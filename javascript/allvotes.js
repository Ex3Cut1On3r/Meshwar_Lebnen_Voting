const API_BASE_URL = 'http://192.168.10.103:4040';
const VOTE_ENDPOINT = '';

export async function submitVote(candidateName) {
    const voteUrl = `${API_BASE_URL}${VOTE_ENDPOINT}`;

    if (!candidateName) {
        return { success: false, error: { message: 'Candidate name is required.' } };
    }

    try {
        const token = localStorage.getItem('authToken');
        if (!token) {
            return { success: false, error: { message: 'Authentication token not found.' } };
        }

        const response = await $fetch(voteUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: {
                name: candidateName
            }
        });

        if (response && (response.success === true || response.message || typeof response !== 'object' || response === null)) {
             const successMsg = response?.message || `Vote successfully recorded for ${candidateName}.`;
             return { success: true, message: successMsg };
        } else if (response === undefined || response === null) {
             return { success: true, message: `Vote status updated for ${candidateName}.` };
        }
         else {
             const failureMsg = response?.message || response?.error || 'Backend reported an issue with the vote submission.';
             return { success: false, error: { message: failureMsg } };
        }

    } catch (err) {
        const errorMessage = err.data?.message || err.data?.error || err.statusMessage || err.message || 'Failed to submit vote.';
        const statusCode = err.response?.status || err.statusCode || err.status;
        return { success: false, error: { message: errorMessage, statusCode: statusCode } };
    }
}