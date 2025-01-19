import SFConnection from "../lib/SFConnection.js";

const logAllowed = true;

function logger(text) {
  if (logAllowed) {
    console.log(text);
  }
}

// Function to copy flow metadata to clipboard
async function copyFlowMetaData(flowMetadata) {
  if (!flowMetadata) {
    console.log("No flow metadata provided.");
    return false; // Return false if no metadata is provided
  }

  try {
    // Convert the flowMetadata to a JSON string (pretty-print with indentation)
    const metadataString = JSON.stringify(flowMetadata, null, 2);

    // Use the Clipboard API to copy the stringified metadata to the clipboard
    await navigator.clipboard.writeText(metadataString);

    console.log("Flow metadata copied to clipboard.");
    return true; // Return true if the operation was successful
  } catch (error) {
    console.error("Failed to copy flow metadata to clipboard: ", error);
    return false; // Return false if there was an error
  }
}

// Function to download flow metadata
async function downloadFlowMetadata(flow) {
  if (!flow) {
    logger("No flow metadata provided for download.");
    return;
  }

  try {
    logger("Flow");
    logger(flow);

    if (flow) {
      // Extract flow name and version
      const flowName = flow.FullName;
      const flowVersion = flow.VersionNumber || "v1"; // Default version if not provided

      // Create the file name in the format "flowName_vVersion.txt"
      const fileName = `${flowName}_v${flowVersion}.txt`;

      // Create the content to be downloaded (you can choose what content to include from the metadata)
      const content = JSON.stringify(flow.Metadata, null, 2); // Pretty-printing the flow metadata as JSON

      // Create a Blob for the file content
      const blob = new Blob([content], { type: "text/plain" });

      // Create a download link for the file
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName; // Set the file name
      document.body.appendChild(link);
      link.click(); // Simulate click to download the file
      document.body.removeChild(link);

      logger(`Flow metadata downloaded as ${fileName}`);
    } else {
      logger("Failed to fetch flow metadata for download.");
    }
  } catch (error) {
    logger("Error downloading flow metadata: " + error);
  }
}

// Function to get the flowId from the active tab's URL
function getFlowIdFromTab(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const tab = tabs[0]; // The active tab
      const url = new URL(tab.url); // Parse the URL of the active tab
      const flowId =
        url.searchParams.get("flowId") || url.searchParams.get("flowDefId"); // Extract flowId or flowDefId
      callback(flowId);
    } else {
      callback(null);
    }
  });
}

// Function to fetch flow metadata from Salesforce
async function fetchFlow(con, flowId) {
  let flowVersionId = null;

  if (!flowId) {
    logger("Flow ID is not provided.");
    return null;
  }

  try {
    // Check if the provided ID is a FlowVersionId (starts with '301')
    if (flowId.startsWith("301")) {
      flowVersionId = flowId;
    } else {
      // Query to get the ActiveVersionId using the Tooling API
      const query = `/services/data/v62.0/tooling/query/?q=SELECT+ActiveVersionId+FROM+FlowDefinition+WHERE+Id='${flowId}'`;
      const result = await con.get(query);

      if (result.records && result.records.length > 0) {
        flowVersionId = result.records[0].ActiveVersionId;
      } else {
        logger(
          `No ActiveVersionId found for FlowDefinition with Id: ${flowId}`
        );
        return null;
      }
    }

    logger(`Flow Version ID: ${flowVersionId}`);

    // Query the flow metadata using the Tooling API
    const metadataQuery = `/services/data/v62.0/tooling/sobjects/Flow/${flowVersionId}`;
    logger(`Querying flow metadata: ${metadataQuery}`);
    const flow = await con.get(metadataQuery);

    logger("Flow Metadata Response: " + flow);
    logger("Metadata Field: " + flow.Metadata);
    if (flow.Metadata) {
      logger("Flow Label: " + flow.Metadata.label);
    }

    return flow; // Return the flow metadata object
  } catch (error) {
    logger("Error in fetchFlow:", error);
    return null;
  }
}

// Function to fetch flow metadata using the Metadata API
async function fetchFlowMetadata(con, flowApiName) {
  if (!flowApiName) {
    logger("Flow API name is not provided.");
    return null;
  }

  try {
    // Define the metadata retrieve request
    const retrieveRequest = {
      unpackaged: {
        types: [
          {
            members: [flowApiName], // Flow API Name (e.g., "My_Flow")
            name: "Flow", // Metadata type for Flow
          },
        ],
        version: "62.0", // Salesforce API version
      },
    };

    // Retrieve flow metadata
    const result = await con.metadata.retrieve(retrieveRequest);

    if (result.success) {
      logger("Flow metadata retrieved successfully.");
      return result; // Return the retrieved flow metadata
    } else {
      logger("Failed to retrieve flow metadata.");
      return null;
    }
  } catch (error) {
    logger("Error in fetchFlowMetadata:", error);
    return null;
  }
}

// Function to fetch the Flow API name from a Flow ID (301 or 300)
async function fetchFlowApiName(con, flowId) {
  if (!flowId) {
    logger("Flow ID is not provided.");
    return null;
  }

  try {
    let query;

    // Determine the query based on the ID prefix
    if (flowId.startsWith("301")) {
      // Query for a 301 ID (Flow Version ID)
      query = `/services/data/v62.0/tooling/query/?q=SELECT+Id,FullName,DefinitionId,Definition.ActiveVersionId+FROM+Flow+WHERE+Id='${flowId}'`;
    } else if (flowId.startsWith("300")) {
      // Query for a 300 ID (Flow Definition ID)
      query = `/services/data/v62.0/tooling/query/?q=SELECT+Id,FullName,DefinitionId,Definition.ActiveVersionId+FROM+Flow+WHERE+DefinitionId='${flowId}'+LIMIT+1`;
    } else {
      logger("Invalid Flow ID format. It should start with '301' or '300'.");
      return null;
    }

    // Execute the query
    logger(`Executing query: ${query}`);
    const result = await con.get(query);

    if (result.records && result.records.length > 0) {
      const flowRecord = result.records[0];
      const flowApiName = flowRecord.FullName; // Get the API name from the FullName field
      logger(`Flow API Name: ${flowApiName}`);
      return flowApiName;
    } else {
      logger(`No records found for Flow ID: ${flowId}`);
      return null;
    }
  } catch (error) {
    logger("Error in fetchFlowApiName:", error);
    return null;
  }
}

// Update status message in the UI and remove it after 3 seconds
function updateStatusDiv(response) {
  const statusDiv = document.getElementById("status");

  if (response) {
    statusDiv.innerHTML = "Copied to clipboard";
    statusDiv.style.color = "green"; // Change text color to green
  } else {
    statusDiv.innerHTML = "Failed to copy metadata to clipboard";
    statusDiv.style.color = "red"; // Change text color to red
  }

  // After 3 seconds, clear the status message
  setTimeout(() => {
    statusDiv.innerHTML = "";
    statusDiv.style.color = ""; // Reset color
  }, 3000);
}

function updateFlowNameDiv(flowNameDiv, flow) {
  logger("updateFlowNameDiv");

  // Display the flow name or any other info in the UI
  flowNameDiv.innerHTML =
    flow.MasterLabel && flow.VersionNumber
      ? flow.MasterLabel + " : " + "v" + flow.VersionNumber
      : "Flow not found";

  flowNameDiv.classList.toggle("loading");
  flowNameDiv.classList.toggle("success");
}

// Main initialization function
async function init() {
  const con = await new SFConnection().init();

  if (!con) {
    logger("Failed to initialize Salesforce connection.");
    return;
  }

  // Get the flowId from the active tab
  getFlowIdFromTab(async (flowId) => {
    logger("FlowId from active tab: " + flowId);

    if (!flowId) {
      logger("Flow ID not found.");
      return;
    }

    // Retrieve flow from Salesforce
    const flowApiName = await fetchFlowApiName(con, flowId);

    if (flowApiName) {
      logger("flowApiName");
      logger(flowApiName);

      // // Attach the download function to the button click
      // document.getElementById("retrieveBtn").addEventListener("click", () => {
      //   fetchFlowMetadata(con, flowApiName); // Call the download function on button click
      // });
    }

    // Fetch the flow metadata from Salesforce
    const flow = await fetchFlow(con, flowId);

    if (flow && flow.Metadata) {
      logger("flow");
      logger(flow);

      const flowNameDiv = document.getElementById("flowName");
      updateFlowNameDiv(flowNameDiv, flow);

      // Attach the download function to the button click
      document
        .getElementById("downloadJsonBtn")
        .addEventListener("click", () => {
          downloadFlowMetadata(flow); // Call the download function on button click
        });

      // Ensure the callback for copyBtn is asynchronous
      document
        .getElementById("copyJsonBtn")
        .addEventListener("click", async () => {
          const response = await copyFlowMetaData(flow.Metadata);
          logger("response");
          logger(response);
          updateStatusDiv(response); // Update success div based on copy result
        });
    } else {
      document.getElementById("flowName").innerHTML = "Failed to fetch Flow";
    }
  });
}

// Event listener for DOM content loaded
document.addEventListener("DOMContentLoaded", () => {
  init(); // Initialize and fetch data
});
