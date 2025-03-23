// Handle messages from content scripts and the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "getSession") {
      // Get the Salesforce session cookie
      chrome.cookies.get(
        {
          url: "https://" + request.sfHost,
          name: "sid",
          storeId: sender.tab?.cookieStoreId,
        },
        (sessionCookie) => {
          if (!sessionCookie) {
            sendResponse({ success: false, error: "Session cookie not found" });
            return;
          }
          
          sendResponse({
            success: true,
            session: {
              key: sessionCookie.value,
              hostName: sessionCookie.domain,
            }
          });
        }
      );
      return true; // Required for async sendResponse
    }
  });