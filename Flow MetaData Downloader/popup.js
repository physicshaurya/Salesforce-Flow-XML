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
  describeFlowBtn: document.getElementById("describeFlowBtn"),
  runAnalysisBtn: document.getElementById("runAnalysisBtn"),
  statusContainer: document.getElementById("statusContainer"),
  status: document.getElementById("status"),
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

  elements.flowName.textContent =
    flow.MasterLabel || flow.FullName || "Unknown";
  elements.flowVersion.textContent = flow.VersionNumber || "-";

  // Enable buttons
  elements.describeFlowBtn.disabled = false; // Enabled describe button
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
      throw new Error(
        "Failed to connect to Salesforce. Please make sure you're logged in to your Salesforce org."
      );
    }

    // Initialize Flow service
    const flowService = new FlowService(connection);

    // Get flow ID from URL
    const flowId = await flowService.getFlowIdFromCurrentTab();

    if (!flowId) {
      throw new Error(
        "No Flow ID found in the current tab. Please navigate to a Salesforce Flow."
      );
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
        const success = await flowService.copyMetadataToClipboard(
          currentFlow.Metadata
        );
        if (success) {
          showStatus("Flow metadata copied to clipboard.");
        } else {
          showStatus("Failed to copy metadata to clipboard.", false);
        }
      } catch (error) {
        showStatus(`Error: ${error.message}`, false);
      }
    });

    elements.describeFlowBtn.addEventListener("click", async () => {
      try {
        const success = flowService.describeThisFlow(currentFlow.Metadata);

        showStatus(
          success
            ? "Prompt copied to describe this flow, paste it in any LLM"
            : "Failed to copy describe the flow prompt, try again later.",
          success
        );
      } catch (error) {
        showStatus(`Error: ${error.message}`, false);
        console.error("Error describing flow:", error);
      }
    });

    elements.runAnalysisBtn.addEventListener("click", () => {
      try {
        const severityClassMap = {
          High: "high-severity",
          Medium: "medium-severity",
          Low: "low-severity",
        };

        const issues = [];

        const dmlElementsInsideLoops = flowService.findDMLElementsInsideLoops(
          currentFlow.Metadata
        );

        console.log("DML", [...dmlElementsInsideLoops.dmlElements]);

        if (
          dmlElementsInsideLoops &&
          Array.isArray(dmlElementsInsideLoops.dmlElements) &&
          dmlElementsInsideLoops.dmlElements.length > 0
        ) {
          issues.push({
            issue: "DML Inside Loop",
            severity: "High",
            description: "Flow contains DML operations inside loops.",
            elements: [...dmlElementsInsideLoops.dmlElements],
          });
        }

        const soqlInsideLoops = flowService.findSOQLInsideLoops(
          currentFlow.Metadata
        );
        console.log("soql", [...soqlInsideLoops.recordLookups]);

        if (
          soqlInsideLoops &&
          Array.isArray(soqlInsideLoops.recordLookups) &&
          soqlInsideLoops.recordLookups.length > 0
        ) {
          issues.push({
            issue: "SOQL Inside Loop",
            severity: "High",
            description: "Flow contains SOQL queries inside loops.",
            elements: [...soqlInsideLoops.recordLookups], // spread into a new array for immutability
          });
        }

        const unusedVariables = flowService.findUnusedVariables(
          currentFlow.Metadata
        );
        if (unusedVariables.length) {
          issues.push({
            issue: "Unused Variables",
            severity: "Low",
            description: "Flow has unused variables that can be removed.",
            elements: unusedVariables,
          });
        }

        const hardcodedIds = flowService.findHardcodedIds(currentFlow.Metadata);
        if (hardcodedIds.length) {
          issues.push({
            issue: "Hardcoded IDs",
            severity: "Medium",
            description: "Flow contains hardcoded Salesforce record IDs.",
            elements: hardcodedIds,
          });
        }

        const analysisResults = document.getElementById("analysisResults");
        analysisResults.innerHTML = "";

        issues.forEach((issue) => {
          const row = document.createElement("tr");
          row.classList.add(severityClassMap[issue.severity]);
          const elementsList = issue.elements
            .map((el) => el.name || el)
            .join(", ");
          // row.innerHTML = `<td>${issue.issue}</td><td>${issue.severity}</td><td>${issue.description}</td><td>${elementsList}</td>`;
          row.innerHTML = `<td>${issue.issue}</td><td>${issue.description}</td><td>${elementsList}</td>`;
          analysisResults.appendChild(row);
        });

        document.getElementById("analysisContainer").classList.toggle("hidden");

        if (issues.length) {
          document.getElementById("analysisTable").classList.remove("hidden");
        } else {
          document.getElementById("no-issues").classList.remove("hidden");
        }
      } catch (error) {
        console.error("Error running analysis:", error);
      }
    });
  } catch (error) {
    showError(error.message);
    console.error("Error initialising the flow :", error);
  }
}

// Initialize the popup when the DOM is loaded
document.addEventListener("DOMContentLoaded", initializePopup);
