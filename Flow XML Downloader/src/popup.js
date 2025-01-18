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
  if (!flowId) {
    logger("Flow ID is not provided.");
    return null;
  }

  try {
    // Make the API request to fetch flow metadata
    const flow = await con.get(
      `/services/data/v57.0/tooling/sobjects/Flow/${flowId}`
    );
    logger(flow); // Log the full response to inspect it
    logger(flow.Metadata); // Log metadata field
    logger(flow.Metadata.label); // Log the label for additional context
    return flow; // Return the flow metadata object
  } catch (error) {
    logger("Error fetching flow metadata: " + error);
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

    // Fetch the flow metadata from Salesforce
    const flow = await fetchFlow(con, flowId);

    if (flow && flow.Metadata) {
      logger("flow");
      logger(flow);
      // Display the flow name or any other info in the UI
      document.getElementById("flowName").innerHTML =
        flow.MasterLabel || "Flow not found";

      // Attach the download function to the button click
      document.getElementById("downloadBtn").addEventListener("click", () => {
        downloadFlowMetadata(flow); // Call the download function on button click
      });

      // Ensure the callback for copyBtn is asynchronous
      document.getElementById("copyBtn").addEventListener("click", async () => {
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
