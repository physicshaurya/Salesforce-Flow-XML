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
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab || !tab.url) {
        throw new Error("No active tab found");
      }

      const url = new URL(tab.url);

      // Try to get flowId or flowDefId from URL params
      const flowId =
        url.searchParams.get("flowId") || url.searchParams.get("flowDefId");

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
          throw new Error(
            `No active version found for Flow Definition: ${flowId}`
          );
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

  /**
   * Open ChatGPT with Flow Metadata analysis prompt
   * @param {Object} flowMetadata - Flow metadata to analyze
   * @returns {boolean} - Success status
   */
  async describeThisFlow(flowMetadata) {
    try {
      if (!flowMetadata) {
        throw new Error("No flow metadata provided");
      }

      // Extract non-null properties from flow metadata (assuming extractNonNullProperties is defined)
      const cleanedData = extractNonNullProperties(flowMetadata);
      console.log(cleanedData);

      // Format metadata in readable JSON
      const metadataString = JSON.stringify(cleanedData, null, 2);

      // Define the query for ChatGPT (descriptive prompt for ChatGPT)
      const query = `${metadataString}
  
      You are an expert in Salesforce automation, specializing in analyzing Salesforce Flow JSON structures. Given this JSON representation of a Salesforce Flow, analyze its structure and provide a clear, concise description of the business logic it implements.
  
      Your response should include:
      - The purpose of the flow (e.g., automating approvals, updating records, sending notifications).
      - A high-level summary of its key steps (e.g., trigger conditions, decision points, record updates, email alerts).
      - The specific objects and fields involved in the flow.
      - Any conditional logic or loops present.
      - The expected outcome when the flow executes.
  
      Format your response in simple, non-technical language so that a business stakeholder can understand it. Use bullet points for clarity if needed.`;

      // console.log("Query : " + query);

      // Copy the formatted flow metadata to the clipboard
      const copySuccess = await copyToClipboard(query);

      if (copySuccess) {
        console.log("Flow metadata copied to clipboard successfully!");
      } else {
        console.error("Failed to copy flow metadata to clipboard.");
      }

      return true;
    } catch (error) {
      console.error("Error describing the flow:", error);
      return false;
    }
  }

  // Helper function to dml and soql element finding function after this.
  findElementsInsideLoops(flowJson) {
    if (!flowJson) {
      return { recordLookups: [], dmlElements: [] };
    }

    const loops = flowJson.loops || [];

    // Collect all elements by type
    const elementGroups = {
      recordLookup: flowJson.recordLookups || [],
      recordUpdate: flowJson.recordUpdates || [],
      recordCreate: flowJson.recordCreates || [],
      recordDelete: flowJson.recordDeletes || [],
      decision: flowJson.decisions || [],
      assignment: flowJson.assignments || [],
      subflow: flowJson.subflows || [],
      collectionProcessor: flowJson.collectionProcessors || [],
      screen: flowJson.screens || [],
      actionCall: flowJson.actionCalls || [],
      apexPluginCall: flowJson.apexPluginCalls || [],
    };

    // Flatten all elements into a single array, keeping their type
    const allElements = [];
    for (const [type, elements] of Object.entries(elementGroups)) {
      elements.forEach((element) => {
        allElements.push({
          ...element,
          type,
        });
      });
    }

    const recordLookupsInsideLoops = [];
    const dmlElementsInsideLoops = [];
    const loopElementsMap = {};

    // Loop through each loop in the flow
    loops.forEach((loop) => {
      const loopName = loop.name;
      const elementsInsideLoop = [];

      let currentTarget = loop.nextValueConnector?.targetReference;

      // Traverse the loop and collect elements
      while (currentTarget) {
        const currentElement = allElements.find(
          (e) => e.name === currentTarget
        );
        if (!currentElement) break;

        elementsInsideLoop.push({
          apiName: currentElement.apiName || currentElement.name, // Use apiName if available
          type: currentElement.type,
        });

        // If it's a SOQL operation, capture it
        if (currentElement.type === "recordLookup") {
          recordLookupsInsideLoops.push(
            currentElement.apiName || currentElement.name // Use apiName if available
          );
        }

        // If it's a DML operation, capture it
        if (
          ["recordCreate", "recordUpdate", "recordDelete"].includes(
            currentElement.type
          )
        ) {
          dmlElementsInsideLoops.push(
            currentElement.apiName || currentElement.name
          ); // Use apiName if available
        }

        // Move to the next connector
        currentTarget = currentElement.connector?.targetReference || null;
      }

      // Store elements inside the loop in the map
      loopElementsMap[loopName] = elementsInsideLoop;
    });

    // Return both sets of results together
    return {
      recordLookups: recordLookupsInsideLoops,
      dmlElements: dmlElementsInsideLoops,
    };
  }

  /**
   * Finds all record creation, deletion, and update elements that are inside loops in a Salesforce Flow JSON.
   *
   * @param {Object} flowJson - The JSON representation of the Salesforce Flow.
   * @param {Array} flowJson.loops - Array of loop elements in the flow.
   * @param {Array} [flowJson.recordCreates=[]] - Array of record creation elements.
   * @param {Array} [flowJson.recordDeletes=[]] - Array of record deletion elements.
   * @param {Array} [flowJson.recordUpdates=[]] - Array of record update elements.
   * @returns {Object} - An object containing arrays of recordCreates, recordDeletes, and recordUpdates that are inside loops.
   *                     Each element in the array includes its name and label.
   */
  findDMLElementsInsideLoops(flowJson) {
    const { dmlElements } = this.findElementsInsideLoops(flowJson);
    return {dmlElements}; // Returning only DML elements
  }

  /**
   * Finds Apex Plugin Calls that might contain SOQL queries inside loops in a Salesforce Flow JSON.
   *
   * @param {Object} flowJson - The JSON representation of the Salesforce Flow.
   * @param {Array} flowJson.loops - Array of loop elements in the flow.
   * @param {Array} [flowJson.apexPluginCalls=[]] - Array of Apex plugin call elements.
   * @returns {Object} - An object containing an array of Apex plugin calls that are inside loops.
   *                     Each element in the array includes its name and label.
   */
  findSOQLInsideLoops(flowJson) {
    const { recordLookups } = this.findElementsInsideLoops(flowJson);
    return {recordLookups}; // Returning only record lookups as SOQL elements
  }

  /**
   * Finds unused variables in a Salesforce Flow JSON.
   *
   * @param {Object} flowJson - The JSON representation of the Salesforce Flow.
   * @param {Array} [flowJson.variables=[]] - Array of defined variables in the flow.
   * @param {Array} [flowJson.assignments=[]] - Array of assignment elements in the flow.
   * @param {Array} [flowJson.recordCreates=[]] - Array of record creation elements.
   * @param {Array} [flowJson.recordUpdates=[]] - Array of record update elements.
   * @param {Array} [flowJson.recordLookups=[]] - Array of record lookup elements.
   * @param {Array} [flowJson.decisions=[]] - Array of decision elements.
   * @returns {Array} - An array of unused variable names.
   */
  findUnusedVariables(flowJson) {
    // Extract all defined variable names
    const variableNames = new Set(
      flowJson.variables.map((variable) => variable.name)
    );

    // Clone the flow JSON and remove the 'variables' key
    const filteredJson = { ...flowJson };
    delete filteredJson.variables;

    // Convert the filtered JSON to a string
    const flowJsonString = JSON.stringify(filteredJson);

    // Find variables that are defined but not referenced anywhere else in the JSON
    return [...variableNames].filter(
      (varName) => !flowJsonString.includes(varName)
    );
  }

  /**
   * Finds hardcoded Salesforce IDs in a Salesforce Flow JSON.
   *
   * @param {Object} flowJson - The JSON representation of the Salesforce Flow.
   * @param {Array} [flowJson.assignments=[]] - Array of assignment elements in the flow.
   * @param {Array} [flowJson.recordCreates=[]] - Array of record creation elements.
   * @param {Array} [flowJson.recordUpdates=[]] - Array of record update elements.
   * @param {Array} [flowJson.recordLookups=[]] - Array of record lookup elements.
   * @param {Array} [flowJson.decisions=[]] - Array of decision elements.
   * @param {Array} [flowJson.constants=[]] - Array of constant values used in the flow.
   * @returns {Array} - An array of objects with element names and the hardcoded IDs found.
   */
  findHardcodedIds(flowJson) {
    // Regular expression to match Salesforce 15/18-character IDs
    const salesforceIdPattern = /\b[0-9a-zA-Z]{15,18}\b/;

    // Function to check for hardcoded IDs in a given key
    function checkForIds(elements, key = "stringValue") {
      return elements.flatMap((element) => {
        const items = element.filters || element.assignmentItems || [];
        return items
          .filter(
            (item) =>
              item.value?.[key] && salesforceIdPattern.test(item.value[key])
          )
          .map((item) => ({
            name: element.name,
            label: element.label,
            hardcodedId: item.value[key],
          }));
      });
    }

    // Collect elements with hardcoded IDs
    return [
      ...checkForIds(flowJson.recordLookups || []), // Now detects IDs in filters[].value.stringValue
      ...checkForIds(flowJson.assignments || []),
      ...checkForIds(flowJson.recordCreates || [], "inputReference"),
      ...checkForIds(flowJson.recordUpdates || [], "inputReference"),
      ...checkForIds(flowJson.decisions || [], "conditionLogic"),
      ...checkForIds(flowJson.constants || [], "value"),
    ];
  }
}

// Utility Functions below this
function extractNonNullProperties(obj) {
  if (Array.isArray(obj)) {
    return obj
      .map(extractNonNullProperties)
      .filter((item) => item !== null && Object.keys(item).length > 0);
  } else if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const cleanedValue = extractNonNullProperties(value);
      if (
        cleanedValue !== null &&
        (typeof cleanedValue !== "object" ||
          Object.keys(cleanedValue).length > 0)
      ) {
        acc[key] = cleanedValue;
      }
      return acc;
    }, {});
  }
  return obj !== null ? obj : null;
}

async function copyToClipboard(text) {
  try {
    if (!text) {
      throw new Error("No text provided to copy");
    }

    // Copy to clipboard
    await navigator.clipboard.writeText(text);

    return true;
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    return false;
  }
}
