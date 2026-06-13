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
   * Fetch all versions of a flow definition from Salesforce
   * @param {string} flowDefinitionId - The ID of the flow definition (starts with '300')
   * @returns {Promise<Array<Object>>} - Array of flow versions sorted by version number (descending)
   */
  async fetchFlowVersions(flowDefinitionId) {
    try {
      if (!flowDefinitionId || !flowDefinitionId.startsWith("300")) {
        throw new Error(
          "A valid Flow Definition ID (starts with '300') is required."
        );
      }

      const apiVersion = this.#connection.getApiVersion();
      const query = `
      /services/data/${apiVersion}/tooling/query/?q=
      SELECT+Id,+VersionNumber,+Status+
      FROM+Flow+
      WHERE+DefinitionId='${flowDefinitionId}'
      ORDER+BY+VersionNumber+DESC
    `.replace(/\s+/g, "");

      const result = await this.#connection.get(query);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          `No versions found for Flow Definition: ${flowDefinitionId}`
        );
      }

      return result.records; // Each record includes Id, VersionNumber, Status
    } catch (error) {
      console.error("Error fetching flow versions:", error);
      throw error;
    }
  }

  /**
   * Fetch all flow definitions from Salesforce
   * @returns {Promise<Map<string, string>>} - A map of flow names (key) and flow IDs (value)
   */
  async fetchAllFlowDefinitions() {
    try {
      const apiVersion = this.#connection.getApiVersion();

      // Query to get all Flow Definitions (which have Flow ID starting with '300')
      const query = `/services/data/${apiVersion}/tooling/query/?q=SELECT Id, DeveloperName FROM FlowDefinition`;
      const result = await this.#connection.get(query);

      // Create a map of flow name (DeveloperName) and flow ID
      const flowMap = new Map();
      if (result.records && result.records.length > 0) {
        result.records.forEach((flowDefinition) => {
          const flowId = flowDefinition.Id;
          const flowName = flowDefinition.DeveloperName;
          flowMap.set(flowName, flowId);
        });
      }

      return flowMap;
    } catch (error) {
      console.error("Error fetching flow definitions:", error);
      throw error;
    }
  }

  /**
   * Get Flow Version ID (301) from Flow Definition ID (300) and version number
   * @param {string} flowDefinitionId - Flow Definition ID (starts with '300')
   * @param {number} versionNumber - Version number of the flow
   * @returns {Promise<string>} - Flow Version ID (starts with '301')
   */
  async getFlowVersionId(flowDefinitionId, versionNumber) {
    try {
      if (!flowDefinitionId || !flowDefinitionId.startsWith("300")) {
        throw new Error(
          "A valid Flow Definition ID (starts with '300') is required."
        );
      }

      if (!versionNumber || versionNumber < 1) {
        throw new Error("A valid version number is required.");
      }

      const apiVersion = this.#connection.getApiVersion();
      const query = `
        /services/data/${apiVersion}/tooling/query/?q=
        SELECT+Id+
        FROM+Flow+
        WHERE+DefinitionId='${flowDefinitionId}'+AND+VersionNumber=${versionNumber}
      `.replace(/\s+/g, "");

      const result = await this.#connection.get(query);

      if (!result.records || result.records.length === 0) {
        throw new Error(
          `No flow version found for Definition ID ${flowDefinitionId} and version ${versionNumber}`
        );
      }

      return result.records[0].Id;
    } catch (error) {
      console.error("Error getting flow version ID:", error);
      throw error;
    }
  }

  /**
   * Get the latest Flow Version ID by created date
   * @param {string} flowDefinitionId - Flow Definition ID (starts with '300')
   * @returns {Promise<string>} - Latest Flow Version ID
   */
  async getLatestFlowVersionId(flowDefinitionId) {
    const apiVersion = this.#connection.getApiVersion();
    const query = `
      /services/data/${apiVersion}/tooling/query/?q=
      SELECT+Id+
      FROM+Flow+
      WHERE+DefinitionId='${flowDefinitionId}'
      ORDER+BY+CreatedDate+DESC
      LIMIT+1
    `.replace(/\s+/g, "");

    const result = await this.#connection.get(query);
    return result.records[0].Id;
  }

  async baseUrl() {
    return this.#connection.getBaseUrl();
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

  /**
   * Deploy flow metadata to Salesforce
   * @param {Object} flow - Flow object with metadata
   * @param {Object} updatedMetadata - Updated Metadata of the flow 
   * @param {boolean} createNewVersion - Whether to create a new version
   * @returns {Promise<Object>} - The deployed flow version id
   */
  async deployFlow(flow,updatedMetadata, createNewVersion = false) {
    try {
      if (!flow || !updatedMetadata) {
        throw new Error("Invalid data to deploy flow");
      }

      const apiVersion = this.#connection.getApiVersion();
      const endpoint = `/services/data/${apiVersion}/tooling/sobjects/Flow/${flow.Id}`;

        await this.#connection.patch(endpoint, {
          Metadata: updatedMetadata,
        });
        return await this.getFlowVersionId(flow.DefinitionId, flow.VersionNumber);
    } catch (error) {
      console.error("Error deploying flow:", error);
      throw error;
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
    return { dmlElements }; // Returning only DML elements
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
    return { recordLookups }; // Returning only record lookups as SOQL elements
  }

  /**
   * Finds unused named elements in a Salesforce Flow JSON.
   *
   * @param {Object} flowJson - The JSON representation of the Salesforce Flow.
   * @param {Array} [flowJson.variables=[]] - Array of defined variables in the flow.
   * @param {Array} [flowJson.textTemplates=[]] - Array of defined text templates in the flow.
   * @returns {Object} - A dictionary of unused elements grouped by type (e.g., { unusedVariables: [...], unusedTextTemplates: [...] }).
   */
  findUnusedItems(flowJson) {
    // Define resource keys you want to check for unused references
    const resourceKeys = [
      "variables",
      "textTemplates",
      "formulas",
      "constants",
      "choices",
      "dynamicChoiceSets",
      // 'screens',
      // 'loops',
      // 'assignments',
      // 'decisions',
      // 'recordCreates',
      // 'recordUpdates',
      // 'recordLookups',
      // 'subflows',
      // 'apexPluginCalls',
      // 'customErrors'
    ];

    const unusedItems = {};

    // Extract only the relevant items from the flowJson
    const resources = {};
    resourceKeys.forEach((key) => {
      resources[key] = flowJson[key] || [];
    });

    // Clone the flow JSON and remove the tracked resource keys
    const filteredJson = { ...flowJson };
    resourceKeys.forEach((key) => {
      delete filteredJson[key];
    });

    // Convert remaining flow JSON to string
    const flowJsonString = JSON.stringify(filteredJson);

    // Find unused items for each resource type
    Object.entries(resources).forEach(([key, items]) => {
      const unused = items
        .map((item) => item.name)
        .filter((name) => !flowJsonString.includes(name));

      // Store with descriptive keys like "unusedVariables", "unusedTextTemplates"
      const label = `unused${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      unusedItems[label] = unused;
    });

    return unusedItems;
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
