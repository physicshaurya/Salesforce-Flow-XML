/**
 * Service for handling Salesforce Flow operations
 */
export default class FlowService {
    #connection;
    
    /**
     * Initialize with Salesforce connection
     * @param {SFConnection} connection - Salesforce connection instance
     */
    constructor(connection) {
      this.#connection = connection;
    }
    
    /**
     * Extract Flow ID from the current tab URL
     * @returns {Promise<string|null>} - Flow ID or null if not found
     */
    async getFlowIdFromCurrentTab() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.url) {
          throw new Error("No active tab found");
        }
        
        const url = new URL(tab.url);
        
        // Try to get flowId or flowDefId from URL params
        const flowId = url.searchParams.get("flowId") || url.searchParams.get("flowDefId");
        
        if (!flowId) {
          throw new Error("No Flow ID found in URL");
        }
        
        return flowId;
      } catch (error) {
        console.error("Error getting Flow ID:", error);
        return null;
      }
    }
    
    /**
     * Fetch flow metadata from Salesforce
     * @param {string} flowId - Flow ID to fetch
     * @returns {Promise<Object|null>} - Flow metadata or null if not found
     */
    async fetchFlow(flowId) {
      try {
        if (!flowId) {
          throw new Error("Flow ID is required");
        }
        
        let flowVersionId = flowId;
        const apiVersion = this.#connection.getApiVersion();
        
        // If this is a Flow Definition ID (300), get the active version ID (301)
        if (flowId.startsWith("300")) {
          const query = `/services/data/${apiVersion}/tooling/query/?q=SELECT+ActiveVersionId+FROM+FlowDefinition+WHERE+Id='${flowId}'`;
          const result = await this.#connection.get(query);
          
          if (!result.records || result.records.length === 0) {
            throw new Error(`No active version found for Flow Definition: ${flowId}`);
          }
          
          flowVersionId = result.records[0].ActiveVersionId;
        }
        
        // Fetch the flow metadata
        const endpoint = `/services/data/${apiVersion}/tooling/sobjects/Flow/${flowVersionId}`;
        const flow = await this.#connection.get(endpoint);
        
        return flow;
      } catch (error) {
        console.error("Error fetching flow:", error);
        throw error;
      }
    }
    
    /**
     * Copy flow metadata to clipboard
     * @param {Object} flowMetadata - Flow metadata to copy
     * @returns {Promise<boolean>} - Success status
     */
    async copyMetadataToClipboard(flowMetadata) {
      try {
        if (!flowMetadata) {
          throw new Error("No flow metadata provided");
        }
        
        // Format the metadata with pretty-print
        const metadataString = JSON.stringify(flowMetadata, null, 2);
        
        // Copy to clipboard
        await navigator.clipboard.writeText(metadataString);
        
        return true;
      } catch (error) {
        console.error("Error copying to clipboard:", error);
        return false;
      }
    }
    
    /**
     * Download flow metadata as a file
     * @param {Object} flow - Flow object with metadata
     * @returns {Promise<boolean>} - Success status
     */
    async downloadMetadata(flow) {
      try {
        if (!flow || !flow.Metadata) {
          throw new Error("Invalid flow data");
        }
        
        // Extract flow information
        const flowName = flow.FullName || flow.DeveloperName || "unknown-flow";
        const flowVersion = flow.VersionNumber || "1";
        const fileName = `${flowName}_v${flowVersion}.json`;
        
        // Create content
        const content = JSON.stringify(flow.Metadata, null, 2);
        
        // Create and download file
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        link.click();
        
        // Clean up
        URL.revokeObjectURL(url);
        
        return true;
      } catch (error) {
        console.error("Error downloading metadata:", error);
        return false;
      }
    }
  }