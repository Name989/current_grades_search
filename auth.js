const axios = require('axios');

// Function to obtain access token using OAuth 2.0
async function getAccessToken() {
    const tokenUrl = 'https://api.schools.nyc/doe/prd/v1/oauth/oauth2/token';
    const clientId = '2899a042c83c3080acd1bd68141464b2';
    const clientSecret ='30221c084929ef989ffdc6f4c96f3cd3';
    const username = 'service.SolvCon';
    const password = 'sW&40kZ*';
    const scope = 'course_section';

    const requestBody = new URLSearchParams();
    requestBody.append('grant_type', 'password');
    requestBody.append('client_id', clientId);
    requestBody.append('client_secret', clientSecret);
    requestBody.append('username', username);
    requestBody.append('password', password);
    requestBody.append('scope', scope);

    try {
        const response = await axios.post(tokenUrl, requestBody, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw error;
    }
}
module.exports = { getAccessToken };
