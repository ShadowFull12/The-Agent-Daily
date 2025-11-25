# **App Name**: The Daily Agent

## Core Features:

- Story Scouting: AI-powered agent (Scout) searches for breaking stories from World, Tech, and Local categories using googleSearchRetrieval.
- Article Drafting: AI-powered agent (Journalist) drafts objective reports from the URLs found in the scouting stage.
- Newspaper Layout: AI-powered agent (Chief Editor) generates an HTML string for the newspaper layout, incorporating CSS Grid design rules. The agent uses a tool to decide which images to include, and embed those using <img> tags.
- PDF Generation: Renders HTML content to PDF using puppeteer-core and @sparticuz/chromium optimized for serverless environments and temporarily stores in local storage.
- PDF Uploading: Uploads the newspaper issue PDF from the temporary storage to Firebase Storage after admin approval via the dashboard.
- Admin Dashboard: Provides a real-time 'Mission Control' dashboard for monitoring AI agent workflows, triggering manual runs, and displaying system logs.
- Public Newsstand Gallery: Presents a clean gallery interface where users can view and download the latest daily PDF edition of the newspaper.
- User Authentication: Firebase Authentication secures the Admin Dashboard, ensuring only authorized users can access the real-time 'Mission Control'.
- Database: Firestore is used to save and update data related to drafts and generated PDFs.

## Style Guidelines:

- Primary color: Slate Blue (#7395AE) to convey professionalism and trust.
- Background color: Off-White (#F4F3EE) for a clean and readable experience.
- Accent color: Soft Gold (#D1B000) to highlight key elements and call to actions with elegance.
- Headline font: 'Playfair Display' (serif) for titles, providing a 'New York Times' header feel.
- Body font: 'PT Sans' (sans-serif) for body text, enhancing readability and ensuring clarity.
- Code font: 'Source Code Pro' for displaying code snippets in the log terminal.
- Three-column CSS Grid layout to mirror a traditional newspaper design.
- Use simple and clear icons to represent categories and actions in the admin dashboard.
- Subtle transitions for loading states and user interactions in the admin dashboard, providing a smooth experience.