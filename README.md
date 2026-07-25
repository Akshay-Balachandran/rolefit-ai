# RoleFit AI - ATS-Aligned Resume Builder

RoleFit AI is a full-stack web application designed for job seekers who interview exceptionally well but struggle with writing resumes or prompting AIs. The application takes your work profile and a target Job Description (JD), then uses Gemini AI to tailor an ATS-friendly, single-column plain text resume—without fabricating experiences. It also provides a deterministic ATS keyword matching checker to count matching competencies and point out missing keywords.

---

## Tech Stack
*   **Frontend**: React (Vite, Plain JavaScript, Vanilla CSS)
*   **Backend**: Node.js, Express (ES Modules)
*   **Database**: MongoDB Atlas (Mongoose)
*   **AI Engine**: Google Gemini API via `@google/generative-ai`
*   **Authentication**: JWT (`jsonwebtoken`) & password hashing (`bcryptjs`)

---

## Directory Structure
```
rolefit-ai/
  ├── backend/               # Express API proxy server
  │    ├── middleware/       # Auth validation middleware
  │    ├── models/           # Mongoose schemas (User, Resume)
  │    ├── routes/           # Routing layers (auth, resume, ats, profile)
  │    ├── .env.example      # Environment template
  │    ├── server.js         # API server entrypoint
  │    └── package.json
  │
  └── frontend/              # Vite + React app
       ├── src/
       │    ├── App.jsx      # Core React logic & UI states
       │    ├── main.jsx     # Vite React mount point
       │    └── index.css    # Premium styling & print-layout css
       ├── index.html        # Fonts & base layout
       ├── vite.config.js    # Proxy configuration (forces /api -> backend)
       └── package.json
```

---

## Prerequisites & Setup

### 1. Clone & Set Up Workspace
Set your workspace to `C:\Users\v-akshayba\projects\rolefit-ai` for clean coding context.

### 2. Configure Environment Variables
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create a `.env` file from the example:
   ```bash
   copy .env.example .env
   ```
3. Open the `.env` file and configure the values:
   *   `PORT=5000`
   *   `MONGODB_URI` (See Atlas setup instructions below)
   *   `GEMINI_API_KEY` (See Gemini key instructions below)
   *   `GEMINI_MODEL=gemini-1.5-flash`
   *   `JWT_SECRET` (Enter any random secure string)

---

### 3. Database: MongoDB Atlas Setup
To set up a free MongoDB Atlas database:
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and sign up for a free account.
2. Create a new project, then click **Create a Deployment** and select the **M0 (Free)** shared cluster option.
3. Choose your cloud provider and region, then click **Create Cluster**.
4. In **Database Access**, create a database user (note down the username and password).
5. **CRITICAL STEP: Network Access**:
   *   Go to **Network Access** in the left sidebar.
   *   Click **Add IP Address**.
   *   Select **Allow Access from Anywhere** (adds `0.0.0.0/0` to allow local development servers to connect) and click **Confirm**.
6. In **Database Deployments**, click **Connect**.
7. Choose **Drivers** under "Connect to your application".
8. Copy the connection string and replace `<username>` and `<password>` with your created database credentials. Paste this connection string as the `MONGODB_URI` value in `backend/.env`.

---

### 4. AI Engine: Get a Free Gemini API Key
To obtain a Gemini API key:
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Log in with your Google account.
3. Click the **Get API key** button on the top-left or main dashboard.
4. Click **Create API Key**. You can choose to associate it with an existing Google Cloud project or generate it in a new project.
5. Copy the generated API key and paste it as the `GEMINI_API_KEY` in `backend/.env`.

---

## Installation & Running

### Run the Backend (API Server)
1. Navigate to `backend/` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server (runs on `http://localhost:5000`):
   ```bash
   npm start
   ```

### Run the Frontend (Vite UI Dev Server)
1. Open a new terminal and navigate to the `frontend/` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server (runs on `http://localhost:5173`):
   ```bash
   npm run dev
   ```

Open your browser to `http://localhost:5173`. Any call to `/api/*` will automatically be proxied securely to the backend on port `5000` (which keeps your `GEMINI_API_KEY` hidden from client-side network inspectors).

---

## Features Walkthrough
1. **Authentication**: Register or log in to manage your resume saves. Duplicate email protection is enforced, and session tokens persist in the browser for 7 days.
2. **Text Extraction**: Click the file upload box to select a PDF, Word, or TXT file. The backend will extract the raw text and place it in the "Your Profile" field automatically.
3. **Tailored Generation**: Paste a Target Job Description and hit **Generate Tailored Resume**. The backend feeds the profile and JD into Gemini to produce an aligned, single-column plain text resume with detailed adaptation notes.
4. **Interactive Editor**: You can manually rewrite, format, or tweak the resulting resume text directly in the central editor.
5. **ATS Alignment Audit**: Hit **Check ATS Readiness** to deterministic-scan the Job Description, extract the top 25 keywords, check which ones are matched or missing inside your edited text, and calculate your compatibility score.
6. **PDF/Print Engine**: Click **Export to PDF**. The app uses dedicated `@media print` rules to strip away all UI boxes, forms, buttons, and navigation elements, showing *only* the tailored resume text in clean professional typography.
