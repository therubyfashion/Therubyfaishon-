import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from 'resend';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let currentResendApiKey = process.env.RESEND_API_KEY;
let resend = new Resend(currentResendApiKey);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/config", (req, res) => {
    const { resendApiKey } = req.body;
    if (resendApiKey) {
      currentResendApiKey = resendApiKey;
      resend = new Resend(currentResendApiKey);
      console.log("Resend API Key updated");
    }
    res.json({ status: "ok" });
  });

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html, from } = req.body;
    
    if (!to || !subject || !html) {
      console.error("Missing required fields for email:", { to, subject, hasHtml: !!html });
      return res.status(400).json({ error: "Missing required fields: to, subject, or html" });
    }

    if (!currentResendApiKey) {
      console.warn("RESEND_API_KEY is missing. Email will not be sent.");
      return res.status(200).json({ message: "Email simulation: API key missing" });
    }

    try {
      const emailPayload = {
        from: from || 'The Ruby <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      };

      const data = await resend.emails.send(emailPayload);
      
      if (data.error) {
        console.error("Resend API error details:", JSON.stringify(data.error, null, 2));
        return res.status(400).json({ 
          error: data.error.message || "Validation error", 
          name: data.error.name,
          details: data.error
        });
      }
      
      res.json(data);
    } catch (error: any) {
      console.error("Email execution error:", error);
      res.status(500).json({ error: error.message || "Failed to send email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
