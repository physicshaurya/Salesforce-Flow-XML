# Salesforce Flow MetaData Downloader
Work with salesforce flows like a pro.

# User Guide: Salesforce Flow MetaData Downloader Chrome Extension

## Overview

The Salesforce Flow MetaData Downloader is a Chrome extension that allows you to easily download or copy the metadata of Salesforce flows directly from the Salesforce Lightning interface. This tool is perfect for developers and administrators who need to work with flow definitions outside of Salesforce.

## Installation to use (101)
1. Navigate to the link : https://chrome.google.com/u/1/webstore/devconsole/e0fa2c4a-f04b-4645-92b2-c18e322cea91/bdonpnepbmgmhgciooglhfdnoepfnpkp
2. Click on Add to Chrome button.
3. Navigate to any flow.
4. Click on the extention.
5. Check if the flow name and version appearing is correct and dowload or copy the JSON.

## Installation to modify (201)

1. Download the Flow MetaData Downloader zip file.
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" using the toggle in the top-right corner
4. Click "Load unpacked" and select the extension folder
5. The extension icon should now appear in your Chrome toolbar

## LINK : https://chrome.google.com/u/1/webstore/devconsole/e0fa2c4a-f04b-4645-92b2-c18e322cea91/bdonpnepbmgmhgciooglhfdnoepfnpkp/edit

### Accessing Flow Metadata

1. Log into your Salesforce org
2. Navigate to a Flow in the Flow Builder or Flow List view
   - The URL should contain either a `flowId` or `flowDefId` parameter
3. Click the extension icon in your Chrome toolbar
4. The extension will automatically detect and load the flow metadata

### Extension Interface

When you open the extension popup, you'll see:
- The flow name and version at the top
- "Download JSON" button to save the flow metadata as a text file
- "Copy JSON" button to copy the flow metadata to your clipboard
- "Copy XML" button (currently not functional)

### Downloading Flow Metadata

1. Navigate to the flow you want to download
2. Click the extension icon
3. Click the "Download JSON" button
4. A text file will be downloaded with the naming convention `[FlowName]_v[Version].txt`

### Copying Flow Metadata

1. Navigate to the flow you want to copy
2. Click the extension icon
3. Click the "Copy JSON" button
4. The metadata will be copied to your clipboard in JSON format
5. A green confirmation message will appear briefly

## Troubleshooting

If you encounter issues:

- **"Flow not found" message**: Ensure you're on a valid Salesforce Flow page with a flowId in the URL
- **Loading message doesn't change**: The extension may not have proper access to your Salesforce org
- **Download fails**: Check if your browser has the necessary permissions to download files
- **Copy function doesn't work**: The extension may not have clipboard access permissions

## Technical Details

- The extension uses the Salesforce Tooling API to retrieve flow metadata
- It requires the "sid" cookie from your Salesforce session for authentication
- Flow metadata is retrieved in JSON format from the Salesforce API
- The extension works with Flow IDs that start with either "300" (Flow Definition) or "301" (Flow Version)

## Permissions Required

The extension requires permissions to:
- Access tabs
- Read cookies for Salesforce domains
- Execute scripts
- Download files
- Access storage
- Access Salesforce-related domains
