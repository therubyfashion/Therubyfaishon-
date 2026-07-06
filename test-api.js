import fetch from 'node-fetch';

async function main() {
  const payload = {
    to: "mdsagaransari65670@gmail.com",
    subject: "Test from Local API Endpoint",
    html: "<p>This is a test of the /api/send-email endpoint locally.</p>",
    fromName: "The Ruby Fashion Test"
  };

  try {
    console.log("Calling local /api/send-email...");
    const res = await fetch("http://localhost:3000/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    console.log(`Status: ${res.status}`);
    const data = await res.text();
    console.log("Response body:");
    console.log(data);
  } catch (err) {
    console.error("Failed to connect to local server:", err.message);
  }
}

main();
