/**
 * Salesforce Connection handling class
 * Manages authentication and API requests to Salesforce
 */
export default class SFConnection {
    #sid = null;
    #hostName = null;
    #host = null;
    #apiVersion = "v58.0"; // Standardized API version
  
    /**
     * Initialize the connection with the current tab's Salesforce instance
     * @returns {Promise<SFConnection|null>} - The initialized connection or null if failed
     */
    async init() {
      try {
        // Get the current active tab
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        
        if (!tab || !tab.url) {
          throw new Error("No active tab found");
        }
  
        // Extract the Salesforce domain from the tab URL
        const url = new URL(tab.url);
        
        // Handle different Salesforce domain patterns
        if (url.hostname.includes(".lightning.force.com")) {
          this.#hostName = url.hostname.replace(".lightning.force.com", ".my.salesforce.com");
        } else if (url.hostname.includes(".salesforce.com")) {
          this.#hostName = url.hostname;
        } else {
          throw new Error("Not a Salesforce domain");
        }
        
        this.#host = `https://${this.#hostName}`;
        
        // Get the session information
        const response = await this.#getSessionInfo();
        
        if (!response.success) {
          throw new Error(response.error || "Failed to get session information");
        }
        
        this.#sid = response.session.key;
        return this;
      } catch (error) {
        console.error("SFConnection initialization error:", error);
        return null;
      }
    }
  
    /**
     * Get the Salesforce session information from the background script
     * @returns {Promise<Object>} - Session information
     */
    async #getSessionInfo() {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { message: "getSession", sfHost: this.#hostName },
          (response) => {
            resolve(response || { success: false, error: "No response from background" });
          }
        );
      });
    }
  
    /**
     * Make a GET request to Salesforce API
     * @param {string} endpoint - API endpoint
     * @returns {Promise<Object>} - API response
     */
    async get(endpoint) {
      return this.#sendRequest(endpoint, "GET");
    }
  
    /**
     * Make a POST request to Salesforce API
     * @param {string} endpoint - API endpoint
     * @param {Object} body - Request body
     * @returns {Promise<Object>} - API response
     */
    async post(endpoint, body = {}) {
      return this.#sendRequest(endpoint, "POST", body);
    }
  
    /**
     * Send a request to Salesforce API
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method (GET, POST, etc.)
     * @param {Object} body - Request body for POST/PATCH requests
     * @returns {Promise<Object>} - API response
     */
    async #sendRequest(endpoint, method, body = null) {
      try {
        // Ensure endpoint starts with /
        const formattedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        const url = `${this.#host}${formattedEndpoint}`;
  
        const headers = {
          Authorization: `Bearer ${this.#sid}`,
          "Content-Type": "application/json",
        };
  
        const options = {
          method,
          headers,
        };
  
        if (body && (method === "POST" || method === "PATCH")) {
          options.body = JSON.stringify(body);
        }
  
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}: ${await response.text()}`);
        }
  
        // For PATCH requests or responses with no content
        if (method === "PATCH" || response.status === 204) {
          return { success: true };
        }
        
        return await response.json();
      } catch (error) {
        console.error(`Error in ${method} request:`, error);
        throw error;
      }
    }
  
    /**
     * Get the API version being used
     * @returns {string} - API version
     */
    getApiVersion() {
      return this.#apiVersion;
    }
  }