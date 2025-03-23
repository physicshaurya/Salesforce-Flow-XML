import SFConnection from "./sf-connection.js";
import FlowService from "./flow-service.js";

// UI Elements
const elements = {
  loader: document.getElementById("loader"),
  flowNameContainer: document.getElementById("flowNameContainer"),
  flowName: document.getElementById("flowName"),
  flowVersion: document.getElementById("flowVersion"),
  errorContainer: document.getElementById("errorContainer"),
  errorMessage: document.getElementById("errorMessage"),
  downloadBtn: document.getElementById("downloadJsonBtn"),
  copyBtn: document.getElementById("copyJsonBtn"),
  statusContainer: document.getElementById("statusContainer"),
  status: document.getElementById("status")
};

// State
let currentFlow = null;

/**
 * Show an error message in the UI
 * @param {string} message - Error message to display
 */
function showError(message) {
  elements.loader.classList.add("hidden");
  elements.flowNameContainer.classList.add("hidden");
  elements.errorContainer.classList.remove("hidden");
  elements.errorMessage.textContent = message;
}

/**
 * Show flow information in the UI
 * @param {Object} flow - Flow object with metadata
 */
function showFlowInfo(flow) {
  elements.loader.classList.add("hidden");
  elements.errorContainer.classList.add("hidden");
  elements.flowNameContainer.classList.remove("hidden");
  
  elements.flowName.textContent = flow.MasterLabel || flow.FullName || "Unknown";
  elements.flowVersion.textContent = flow.VersionNumber || "-";
  
  // Enable buttons
  elements.downloadBtn.disabled = false;
  elements.copyBtn.disabled = false;
}

/**
 * Show status message
 * @param {string} message - Status message
 * @param {boolean} isSuccess - Whether it's a success message
 */
function showStatus(message, isSuccess = true) {
  elements.statusContainer.classList.remove("hidden");
  elements.statusContainer.classList.toggle("success", isSuccess);
  elements.statusContainer.classList.toggle("error", !isSuccess);
  
  elements.status.textContent = message;
  elements.status.classList.toggle("success", isSuccess);
  elements.status.classList.toggle("error", !isSuccess);
  
  // Clear status after 3 seconds
  setTimeout(() => {
    elements.statusContainer.classList.add("hidden");
  }, 3000);
}

/**
 * Initialize the popup
 */
async function initializePopup() {
  try {
    // Initialize Salesforce connection
    const connection = await new SFConnection().init();
    
    if (!connection) {
      throw new Error("Failed to connect to Salesforce. Please make sure you're logged in to your Salesforce org.");
    }
    
    // Initialize Flow service
    const flowService = new FlowService(connection);
    
    // Get flow ID from URL
    const flowId = await flowService.getFlowIdFromCurrentTab();
    
    if (!flowId) {
      throw new Error("No Flow ID found in the current tab. Please navigate to a Salesforce Flow.");
    }
    
    // Fetch flow data
    currentFlow = await flowService.fetchFlow(flowId);
    
    if (!currentFlow || !currentFlow.Metadata) {
      throw new Error("Failed to load flow metadata. Please try again.");
    }
    
    // Update UI with flow information
    showFlowInfo(currentFlow);
    
    // Set up event listeners for buttons
    elements.downloadBtn.addEventListener("click", async () => {
      try {
        const success = await flowService.downloadMetadata(currentFlow);
        if (success) {
          showStatus("Flow metadata downloaded successfully.");
        } else {
          showStatus("Failed to download flow metadata.", false);
        }
      } catch (error) {
        showStatus(`Error: ${error.message}`, false);
      }
    });
    
    elements.copyBtn.addEventListener("click", async () => {
      try {
        const success = await flowService.copyMetadataToClipboard(currentFlow.Metadata);
        if (success) {
          showStatus("Flow metadata copied to clipboard.");
        } else {
          showStatus("Failed to copy metadata to clipboard.", false);
        }
      } catch (error) {
        showStatus(`Error: ${error.message}`, false);
      }
    });
  } catch (error) {
    showError(error.message);
    console.error("Initialization error:", error);
  }
}

// Initialize the popup when the DOM is loaded
document.addEventListener("DOMContentLoaded", initializePopup);