import SFConnection from "./sf-connection.js";
import FlowService from "./flow-service.js";

// UI Elements
const elements = {
  flowDownloadSection: document.getElementById("flowDownloadSection"),
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
  fixNomenclatureBtn: document.getElementById("fixNomenclatureBtn"),
  statusContainer: document.getElementById("statusContainer"),
  status: document.getElementById("status"),
  searchFlowSection: document.getElementById("searchFlowSection"),
  flowSearchInput: document.getElementById("flowSearchInput"),
  flowSearchResults: document.getElementById("flowSearchResults"),
  analysisContainer: document.getElementById("analysisContainer"),
  analysisTable: document.getElementById("analysisTable"),
  analysisResults: document.getElementById("analysisResults"),
  noIssues: document.getElementById("no-issues"),
  flowSearchHeader: document.querySelector("#searchFlowSection > h3"),
};

let currentFlow = null;
let debounceTimeout = null;
let flowService = null;

function showError(message) {
  elements.loader.classList.add("hidden");
  elements.flowNameContainer.classList.add("hidden");
  elements.errorContainer.classList.remove("hidden");
  elements.errorMessage.textContent = message;
}

function showFlowInfo(flow) {
  elements.loader.classList.add("hidden");
  elements.errorContainer.classList.add("hidden");
  elements.flowNameContainer.classList.remove("hidden");

  elements.flowName.textContent =
    flow.MasterLabel || flow.FullName || "Unknown";
  elements.flowVersion.textContent = flow.VersionNumber || "-";

  elements.describeFlowBtn.disabled = false;
  elements.downloadBtn.disabled = false;
  elements.copyBtn.disabled = false;
  elements.runAnalysisBtn.disabled = false;
  elements.fixNomenclatureBtn.disabled = false;
}

function showStatus(message, isSuccess = true) {
  elements.statusContainer.classList.remove("hidden");
  elements.status.classList.toggle("success", isSuccess);
  elements.status.classList.toggle("error", !isSuccess);
  elements.status.textContent = message;

  setTimeout(() => {
    elements.statusContainer.classList.add("hidden");
  }, 3000);
}

async function handleFlowSelection(flowVersionId) {
  try {
    currentFlow = await flowService.fetchFlow(flowVersionId);
    if (!currentFlow || !currentFlow.Metadata)
      throw new Error("Failed to load metadata.");
    showFlowInfo(currentFlow);
  } catch (e) {
    showError(e.message);
  }
}

async function openFlow(flowVersionId, openType = "_blank") {
  if (!flowVersionId) {
    console.error("Flow Version ID is required to open the flow.");
    return;
  }

  // Extract base URL from current window/tab
  const baseUrl = await flowService.baseUrl();

  // Construct the full Flow Builder URL
  const flowUrl = `${baseUrl}/builder_platform_interaction/flowBuilder.app?flowId=${flowVersionId}`;

  // Open in a new tab or same based on open type
  if (openType === "_self") {
    // Use chrome.tabs API to update the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.update(tabs[0].id, { url: flowUrl });
      }
    });
  } else {
    window.open(flowUrl, openType);
  }
}

async function loadFlowVersions(flowId, flowName) {
  try {
    const versions = await flowService.fetchFlowVersions(flowId);
    elements.flowSearchResults.innerHTML = "";

    versions.forEach((version) => {
      const versionDiv = document.createElement("div");
      versionDiv.classList.add("flow-search-result");

      // Create a clickable element using a span instead of a button
      const versionText = document.createElement("span");
      versionText.classList.add("flow-version-text");
      versionText.textContent = `${flowName} (v${version.VersionNumber})`;

      // Add active version if the particular version is active
      if (version.Status === "Active")
        versionText.textContent += ` - ${version.Status}`;

      // Add the click event listener to the span element
      versionText.addEventListener("click", () => openFlow(version.Id));

      versionDiv.appendChild(versionText);
      elements.flowSearchResults.appendChild(versionDiv);
    });
  } catch (error) {
    showError("Failed to load flow versions.");
    console.error(error);
  }
}

async function searchFlows(query) {
  try {
    const flowsNameIdMap = await flowService.fetchAllFlowDefinitions();

    if (!flowsNameIdMap || flowsNameIdMap.size === 0) {
      elements.flowSearchResults.innerHTML = "<p>No flows found.</p>";
      return;
    }

    const filteredEntries = [...flowsNameIdMap.entries()].filter(
      ([name]) => !query || name.toLowerCase().includes(query.toLowerCase())
    );

    elements.flowSearchHeader.textContent = `Search Flows (${filteredEntries.length})`;

    if (filteredEntries.length === 0) {
      elements.flowSearchResults.innerHTML = "<p>No matching flows found.</p>";
      return;
    }

    elements.flowSearchResults.innerHTML = "";

    filteredEntries.forEach(([flowName, flowId]) => {
      const flowDiv = document.createElement("div");
      flowDiv.classList.add("flow-search-result");

      // Create a clickable span instead of a button
      const flowText = document.createElement("span");
      flowText.classList.add("flow-name-text");
      flowText.textContent = `${flowName}`;

      // Add the click event listener to the span element
      flowText.addEventListener("click", () =>
        loadFlowVersions(flowId, flowName)
      );

      flowDiv.appendChild(flowText);
      elements.flowSearchResults.appendChild(flowDiv);
    });
  } catch (error) {
    showError("Error searching flows.");
    console.error(error);
  }
}

function fixNomenclature(originalMetadata) {
  const renamedElements = [];
  // Created a deep copy for manipulation
  let metadata = JSON.parse(JSON.stringify(originalMetadata));

  // Helper function to check if a name needs to be fixed
  const needsFix = (name, prefix) => {
    if (!name) return false;
    return !name.toLowerCase().startsWith(prefix.toLowerCase());
  };

  // Helper function to convert to snake case
  const toSnakeCase = (string) => {
    return string
      .replace(/([a-z])([A-Z])/g, "$1 $2") // separate camelCase words
      .replace(/[\W_]+/g, " ") // replace non-word characters and underscores with space
      .trim() // remove leading/trailing spaces
      .split(/\s+/) // split on one or more spaces
      .map((word) => word.toUpperCase()) // convert to uppercase
      .join("_"); // join with underscores
  };

  // Helper function to update references in the metadata
  function updateReferences(renamedElements, metadata) {
    function deepReplace(obj) {
      if (typeof obj === "string") {
        let result = obj;
        renamedElements.forEach(({ oldName, newName }) => {
          // Only replace exact matches of oldName
          if (result === oldName) {
            result = newName;
          }
        });
        return result;
      } else if (Array.isArray(obj)) {
        return obj.map(deepReplace);
      } else if (obj !== null && typeof obj === "object") {
        const newObj = {};
        for (const key in obj) {
          newObj[key] = deepReplace(obj[key]); // only update value, not key
        }
        return newObj;
      }
      return obj; // return numbers, booleans, null as is
    }
  
    // Mutate the metadata directly
    const result = deepReplace(metadata);
    Object.assign(metadata, result);
  }
  

  // Process formulas (Adding formula_)
  if (metadata.formulas) {
    metadata.formulas.forEach((item) => {
      if (item.name && needsFix(item.name, "formula_")) {
        const newName = `formula_${item.name}`;
        renamedElements.push({
          oldName: item.name,
          newName: newName,
          type: "Formula",
        });
        item.name = newName;
      }
    });
  }

  // Process variables (Adding var_)
  if (metadata.variables) {
    metadata.variables.forEach((variable) => {
      if (variable.name && needsFix(variable.name, "var_")) {
        const newName = `var_${variable.name}`;
        renamedElements.push({
          oldName: variable.name,
          newName: newName,
          type: "Variable",
        });
        variable.name = newName;
      }
    });
  }

  // Process constants (Snake Case + Adding CONST_)
  if (metadata.constants) {
    metadata.constants.forEach((constant) => {
      if (constant.name) {
        let pushFlag = false;
        const oldName = constant.name;
        let newName = toSnakeCase(oldName);

        if (oldName !== newName) {
          constant.name = newName;
          pushFlag = true;
        }
        if (constant.name && needsFix(constant.name, "CONST_")) {
          pushFlag = true;
          newName = `CONST_${constant.name}`;
          constant.name = newName;
        }

        if(pushFlag){
          renamedElements.push({
            oldName: oldName,
            newName: newName,
            type: "Constant",
          });
        }
      }
    });
  }

  // Process record lookups
  updateReferences(renamedElements, metadata);

  if (metadata.recordLookups) {
    metadata.recordLookups.forEach((lookup) => {
      if (lookup.label && needsFix(lookup.label, "get_")) {
        const newName = `get_${lookup.label}`;
        renamedElements.push({
          oldName: lookup.label,
          newName: newName,
          type: "Record Lookup",
        });
        lookup.label = newName;
      }
    });
  }

  return { renamedElements, updatedMetadata: metadata };
}

function setupActionListeners() {
  elements.downloadBtn.addEventListener("click", async () => {
    try {
      const success = await flowService.downloadMetadata(currentFlow);
      showStatus(
        success ? "Metadata downloaded." : "Download failed.",
        success
      );
    } catch (e) {
      showStatus(`Error: ${e.message}`, false);
    }
  });

  elements.copyBtn.addEventListener("click", async () => {
    try {
      const success = await flowService.copyMetadataToClipboard(
        currentFlow.Metadata
      );
      showStatus(success ? "Copied to clipboard." : "Copy failed.", success);
    } catch (e) {
      showStatus(`Error: ${e.message}`, false);
    }
  });

  elements.describeFlowBtn.addEventListener("click", () => {
    try {
      const success = flowService.describeThisFlow(currentFlow.Metadata);
      showStatus(
        success ? "Prompt copied to clipboard." : "Copy failed.",
        success
      );
    } catch (e) {
      showStatus(`Error: ${e.message}`, false);
    }
  });

  elements.runAnalysisBtn.addEventListener("click", () => {
    try {
      const issues = runFlowAnalysis(currentFlow.Metadata);
      displayFlowAnalysis(issues);
    } catch (e) {
      console.error("Analysis error:", e);
    }
  });

  elements.fixNomenclatureBtn.addEventListener("click", async () => {
    try {
      const { renamedElements, updatedMetadata } = fixNomenclature(
        currentFlow.Metadata
      );

      if (renamedElements.length > 0) {
        // Check if the current version is active
        const isActive = currentFlow.Status === "Active";

        if (isActive) {
          showStatus(
            `The current version of flow is active kindly create a new version to fix the nomenclature`,
            false
          );
        } else {
          const deployedFlowId = await flowService.deployFlow(
            currentFlow,
            updatedMetadata,
            isActive
          );
          showStatus(
            `Fixed nomenclature for ${renamedElements.length} elements:\n${renamedElements.map(e => `${e.oldName} → ${e.newName} (${e.type})`).join('\n')}`,
            true
          );
          // Opening the fixed flow after 3 seconds
          setTimeout(async () => {
            await openFlow(deployedFlowId, "_self");
          }, 3000);
        }
      } else {
        showStatus("No elements needed nomenclature fixes.", true);
      }
    } catch (e) {
      showStatus(`Error fixing nomenclature: ${e.message}`, false);
    }
  });
}

function runFlowAnalysis(metadata) {
  const issues = [];

  const dmlIssues = flowService.findDMLElementsInsideLoops(metadata);
  if (dmlIssues?.dmlElements?.length) {
    issues.push({
      issue: "DML Inside Loop",
      severity: "High",
      description: "DML operations inside loops detected.",
      elements: dmlIssues.dmlElements,
    });
  }

  const soqlIssues = flowService.findSOQLInsideLoops(metadata);
  if (soqlIssues?.recordLookups?.length) {
    issues.push({
      issue: "SOQL Inside Loop",
      severity: "High",
      description: "SOQL queries inside loops detected.",
      elements: soqlIssues.recordLookups,
    });
  }

  const hardcodedIds = flowService.findHardcodedIds(metadata);
  if (hardcodedIds.length) {
    issues.push({
      issue: "Hardcoded IDs",
      severity: "Medium",
      description: "Hardcoded record IDs detected.",
      elements: hardcodedIds,
    });
  }

  const unusedItems = Object.values(
    flowService.findUnusedItems(metadata)
  ).flat();
  if (unusedItems.length) {
    issues.push({
      issue: "Unused Resources",
      severity: "Low",
      description: "Unused variables/templates found.",
      elements: unusedItems,
    });
  }

  return issues;
}

function displayFlowAnalysis(issues) {
  elements.analysisContainer.classList.remove("hidden");
  elements.analysisResults.innerHTML = "";
  elements.analysisTable.classList.add("hidden");
  elements.noIssues.classList.add("hidden");

  if (issues.length === 0) {
    elements.noIssues.classList.remove("hidden");
    return;
  }

  elements.analysisTable.classList.remove("hidden");

  issues.forEach((issue) => {
    const row = document.createElement("tr");
    row.classList.add(issue.severity.toLowerCase() + "-severity");

    const elementsList = issue.elements.map((e) => e.name || e).join(", ");
    row.innerHTML = `<td>${issue.issue}</td><td>${issue.description}</td><td>${elementsList}</td>`;
    elements.analysisResults.appendChild(row);
  });
}

async function initializePopup() {
  try {
    const connection = await new SFConnection().init();
    if (!connection) throw new Error("Failed to connect to Salesforce.");
    flowService = new FlowService(connection);

    const flowVersionId = await flowService.getFlowIdFromCurrentTab();
    if (!flowVersionId) {
      elements.searchFlowSection.style.display = "block";
      elements.flowDownloadSection.style.display = "none";
      searchFlows(elements.flowSearchInput.value.trim());
      elements.flowSearchInput.addEventListener("input", () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(
          () => searchFlows(elements.flowSearchInput.value.trim()),
          500
        );
      });
      return;
    }

    await handleFlowSelection(flowVersionId);
    setupActionListeners();
  } catch (error) {
    showError(error.message);
  }
}

document.addEventListener("DOMContentLoaded", initializePopup);
