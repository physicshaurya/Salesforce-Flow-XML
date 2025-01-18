console.log("contest.js");

const logAllowed = true;

function logger(text) {
  if (logAllowed) {
    console.log(text);
  }
}

logger("contentscript.js");
