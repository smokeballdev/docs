import axios from 'axios';

/**
 * JIRA API client for querying tickets
 */
export class JiraClient {
  constructor(config) {
    // Ensure URL has protocol
    let url = config.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    this.baseUrl = url;
    this.username = config.username;
    this.apiToken = config.apiToken;
    
    // Use basic auth for API v2/v3
    this.auth = {
      username: config.username,
      password: config.apiToken
    };
  }

  /**
   * Get authentication headers (supports both basic auth and bearer token)
   * @returns {Object} Headers object
   */
  getAuthHeaders() {
    // For JIRA Cloud, we can use basic auth with email + API token
    // This is handled by axios auth option, but we can also use Bearer token
    return {
      'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`
    };
  }

  /**
   * Query JIRA for tickets matching the criteria
   * @param {number} monthsBack - Number of months to look back
   * @param {string} fixVersion - Fix version to filter by (optional)
   * @returns {Promise<Array>} Array of ticket objects
   */
  async getApiTickets(monthsBack = 2, fixVersion = null) {
    const jql = this.buildJQL(monthsBack, fixVersion);
    let url = `${this.baseUrl}/rest/api/3/search/jql`;
    console.log('JQL:', jql);
    console.log('URL:', url);

    try {
      const response = await axios.get(url, {
        auth: this.auth,
        params: {
          jql: jql,
          fields: 'summary,description,status,labels,comment,updated,resolutiondate',
          maxResults: 1000,
          expand: 'renderedFields'
        }
      });

      return response.data.issues.map(issue => this.transformTicket(issue));
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const responseData = error.response.data;
        
        console.error('JIRA API Error Details:');
        console.error(`Status: ${status} ${statusText}`);
        console.error('Response:', JSON.stringify(responseData, null, 2));

        throw new Error(`JIRA API error: ${status} - ${statusText}. ${responseData?.errorMessages?.join(', ') || responseData?.message || ''}`);
      }
      throw new Error(`Failed to query JIRA: ${error.message}`);
    }
  }

  /**
   * Build JQL query for API tickets
   * @param {number} monthsBack - Number of months to look back
   * @param {string} fixVersion - Fix version to filter by (optional)
   * @returns {string} JQL query string
   */
  buildJQL(monthsBack, fixVersion = null) {
    const statuses = ['"Dev Live Testing"', '"Staging QA"', '"Live QA"', '"Done"'];
    let jql = `project = "Integrations" AND labels = "API" AND status IN (${statuses.join(', ')})`;
    
    // Add fixVersion filter if provided
    if (fixVersion) {
      jql += ` AND fixVersion = "${fixVersion}"`;
    }
    
    // Add date filter using the monthsBack parameter
    jql += ` AND statusCategoryChangedDate >= startOfMonth(-${monthsBack}) ORDER BY created DESC`;
    
    return jql;
  }

  /**
   * Transform JIRA issue to a simplified ticket object
   * @param {Object} issue - JIRA issue object
   * @returns {Object} Transformed ticket
   */
  transformTicket(issue) {
    const fields = issue.fields;
    const comments = fields.comment?.comments || [];
    
    // Handle both v2 and v3 API response formats
    const description = typeof fields.description === 'string' 
      ? fields.description 
      : (fields.description?.content || []).map(item => item.text || '').join(' ') || '';
    
    return {
      key: issue.key,
      title: fields.summary || '',
      description: description,
      status: fields.status?.name || '',
      labels: fields.labels || [],
      comments: comments.map(c => {
        const commentBody = typeof c.body === 'string' 
          ? c.body 
          : (c.body?.content || []).map(item => item.text || '').join(' ') || '';
        return {
          author: c.author?.displayName || c.author?.name || '',
          body: commentBody,
          created: c.created || ''
        };
      }),
      updated: fields.updated || '',
      resolved: fields.resolved || fields.resolutiondate || ''
    };
  }

  /**
   * Test JIRA connection
   * @returns {Promise<boolean>} True if connection is successful
   */
  async testConnection() {
    try {
      await axios.get(`${this.baseUrl}/rest/api/3/myself`, {
        auth: this.auth
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
