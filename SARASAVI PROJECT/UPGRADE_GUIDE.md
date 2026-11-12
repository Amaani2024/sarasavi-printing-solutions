# Sarasavi Offset Printers — upgraded website (local demonstration)

## What changed
The **original homepage, approved common navigation and footer (© 2025)** are preserved. New pages and a small customer-tools section were added without changing the six main menu links.

- `quote.html`: collects printing specifications; accepts optional PDF/PNG/JPG artwork (up to 4 MB); saves the enquiry in local SQLite, outside the web-served directory; issues a private reference and six-digit PIN. Email notification is **only** sent if SMTP is configured.
- `tracking.html`: checks a request using both reference and PIN. Staff can manually change its status using the admin page. It is **not** integrated with production equipment or external orders.
- `admin.html`: local staff dashboard to review saved quote requests and update order status. Disabled until a long admin password is set.
- `faq.html`: common customer questions, with factual noncommittal answers.
- `project.html`: gallery category filters and click-to-zoom images using the existing project photos.
- `site-config.js`: optional WhatsApp contact button once a **verified** number is provided. Not shown by default.
- Existing `assistant.js`: local rule-based FAQ answers; AI responses optional with an OpenAI API key on the Python server.
- All pages: a consistent quote / tracking / FAQs strip above the existing footer.

## Run the website on Windows 11
1. Extract this ZIP and open the **inner `SARASAVI PROJECT` folder** in VS Code.
2. Open **Terminal > New Terminal**. Run `python server.py` (or `py server.py`).
3. Open `http://localhost:8000`.
4. Check Home, About, Services, Products, Projects, Contact, Quote, Tracking and FAQ.
5. To exit, press **Ctrl+C** in the VS Code terminal.

## Test a complete order
1. Open `http://localhost:8000/quote.html` and submit a small test request without artwork.
2. Save the displayed reference and PIN. They are **not** emailed automatically.
3. Open `tracking.html` and enter both. The expected initial status is **Received**.
4. Stop the server with Ctrl+C. In PowerShell, set a private staff password: `$env:SARASAVI_ADMIN_PASSWORD='a-unique-long-admin-password'`. Start `python server.py` again.
5. Open `admin.html`, enter that password, load the requests and change a status.
6. Refresh tracking to verify the new status.

**Important:** The admin password should be unique and at least 12 characters. The sample command above is only a placeholder. The dashboard password remains only in memory while the page is open; do not share it.

## Where information is saved
- Requests: `sarasavi_private_data/inquiries.sqlite3`
- Uploaded files: `sarasavi_private_data/artwork/`

These are outside the website folder being served. Back up this directory separately: replacing ZIP website files does not automatically move saved enquiries.

## Email and AI configuration
The site works locally without paid services. Direct email delivery is optional; set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `INQUIRY_TO` before starting the server. Without SMTP, requests are **saved locally only**. A public static website host cannot run these Python endpoints.

Set `OPENAI_API_KEY` on the server to try AI replies; otherwise the chatbot provides predefined FAQ answers. Do **not** expose any API key in client-side code or upload a real `.env` to GitHub.

## WhatsApp, contact and map
In `site-config.js`, set the verified business number (digits, international format). A floating WhatsApp button will appear. Leave it empty if unconfirmed. Verify the phone, email, physical address and hours displayed elsewhere before launch.

## Production warning
**This is a local working prototype, not a public-commerce system.** It intentionally binds to localhost. Before putting it on the internet, a developer should migrate the Python application to a production HTTPS host, add proper staff authentication, anti-bot/rate limiting, CSRF protections, upload malware scanning, logging, backups, privacy notices, data retention rules and email reliability checks. Do not expose the built-in `admin.html` or `server.py` to the public as-is. The order statuses are updated manually, not linked to a printer, ERP or delivery partner. No online payments are offered.

## Browser / mobile checklist
- Set browser zoom to 100%, press Ctrl+Shift+R on each page.
- Check the shared nav and footer on Home, About, Services, Products, Projects, Contact.
- Test narrow viewport in Chrome DevTools (F12 > device toolbar).
- Check menu toggle, gallery filter, image zoom, keyboard Escape, quote form validation, tracking and chatbot.
- Test a large or invalid file to confirm it is refused.
- Test direct email delivery only after SMTP is configured.
