import React, { useState, useEffect, useRef } from 'react';

// --- Resume rendering for the formatted preview & PDF export ---
// The generator now returns clean plain text (no markdown symbols). This renderer
// detects the name (first line), section headings (known names), and "- " bullets,
// and defensively strips any stray markdown (**, `) so none ever show. It stays
// backward-compatible with older resumes that used #, ##, and * markdown.
const RESUME_SECTIONS = new Set([
  'SUMMARY', 'PROFESSIONAL SUMMARY', 'OBJECTIVE', 'PROFILE',
  'EXPERIENCE', 'PROFESSIONAL EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT HISTORY',
  'EDUCATION', 'SKILLS', 'TECHNICAL SKILLS', 'CORE SKILLS', 'KEY SKILLS',
  'CERTIFICATIONS', 'CERTIFICATION', 'PROJECTS', 'KEY PROJECTS', 'LANGUAGES',
  'ACHIEVEMENTS', 'AWARDS', 'INTERESTS', 'VOLUNTEER EXPERIENCE', 'PUBLICATIONS',
]);

const cleanInline = (str) => str.replace(/\*\*/g, '').replace(/`/g, '');

const renderInline = (text, keyPrefix) => {
  const parts = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0, match, i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(cleanInline(text.slice(last, match.index)));
    parts.push(<strong key={`${keyPrefix}-b${i++}`}>{cleanInline(match[1])}</strong>);
    last = regex.lastIndex;
  }
  if (last < text.length) parts.push(cleanInline(text.slice(last)));
  return parts;
};

const renderResume = (raw) => {
  const lines = (raw || '').split('\n');
  const blocks = [];
  let bullets = null;
  let nameDone = false;
  const flush = () => {
    if (bullets) { blocks.push(<ul key={`ul-${blocks.length}`}>{bullets}</ul>); bullets = null; }
  };
  lines.forEach((line, idx) => {
    const t = line.trim();
    if (t === '') { flush(); return; }
    // Bullets: "- ", "• " or legacy "* "
    if (/^[-•*]\s+/.test(t)) {
      if (!bullets) bullets = [];
      bullets.push(<li key={`li-${idx}`}>{renderInline(t.replace(/^[-•*]\s+/, ''), `li-${idx}`)}</li>);
      return;
    }
    const noHash = t.replace(/^#{1,6}\s*/, '');            // strip legacy leading #
    const upper = noHash.replace(/\*\*/g, '').trim().toUpperCase();
    // First non-empty line = the candidate's name
    if (!nameDone) {
      flush(); nameDone = true;
      blocks.push(<h1 key={`h1-${idx}`}>{renderInline(noHash, `h1-${idx}`)}</h1>);
      return;
    }
    // Section heading: a known heading name, or legacy markdown # / ##
    if (t.startsWith('## ') || t.startsWith('# ') || RESUME_SECTIONS.has(upper)) {
      flush();
      blocks.push(<h2 key={`h2-${idx}`}>{renderInline(noHash, `h2-${idx}`)}</h2>);
      return;
    }
    flush();
    blocks.push(<p key={`p-${idx}`}>{renderInline(noHash, `p-${idx}`)}</p>);
  });
  flush();
  return blocks;
};

// Learning-recommendation links for a missing skill (honest platform searches — no fabricated courses)
const courseLink = (platform, skill) => {
  const q = encodeURIComponent(skill);
  if (platform === 'coursera') return `https://www.coursera.org/search?query=${q}`;
  if (platform === 'udemy') return `https://www.udemy.com/courses/search/?q=${q}`;
  return `https://www.google.com/search?q=learn+${q}`;
};

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getManualSkillsAdded = (currentText, missingSkills = [], profileText = '', initialText = '') => {
  if (!currentText || !missingSkills || !missingSkills.length) return [];
  const added = [];
  const profileLower = (profileText || '').toLowerCase();
  const initialLower = (initialText || '').toLowerCase();

  for (const skill of missingSkills) {
    const cleanSkill = skill.toLowerCase().trim();
    if (!cleanSkill || cleanSkill.length <= 2) continue;
    // Common broad terms that should not trigger manual insertion warnings
    if (['ai', 'saas', 'b2b', 'testing', 'software', 'management', 'development', 'analysis'].includes(cleanSkill)) continue;

    // If the skill was already present in candidate's raw profileText OR in the initial generated resumeText, skip it!
    const regex = new RegExp(`\\b${escapeRegExp(skill)}\\b`, 'i');
    if (profileLower && regex.test(profileLower)) continue;
    if (initialLower && regex.test(initialLower)) continue;

    // Only flag if the candidate manually typed a missing skill gap into currentText that wasn't in initial generated text!
    if (regex.test(currentText)) {
      added.push(skill);
    }
  }
  return added;
};

const getProgressStatusMessage = (progress) => {
  if (progress < 20) return "🔍 Analyzing profile and job description...";
  if (progress < 45) return "🔑 Extracting priority keywords...";
  if (progress < 75) return "✍️ Aligning skills and experience with Gemini...";
  if (progress < 90) return "✨ Polishing and formatting sections...";
  if (progress < 100) return "⏳ Finalizing your tailored resume...";
  return "🎉 Done!";
};


// ── RoleFit AI Logo — High-Fidelity Target Segmented Compass & Curved Arrow ──
// Exactly matches the reference image: segmented gear ring with notches,
// person silhouette on the left, and a sweeping cyan arrow piercing top-right.
const RoleFitLogo = ({ size = 38 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 44 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    <defs>
      {/* Metallic blue-teal ring gradient */}
      <linearGradient id="ringGrad" x1="6" y1="6" x2="38" y2="38" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0D3560" />
        <stop offset="35%" stopColor="#0B4B7B" />
        <stop offset="70%" stopColor="#1592B8" />
        <stop offset="100%" stopColor="#00F5D4" />
      </linearGradient>

      {/* Radiant cyan/teal arrow gradient */}
      <linearGradient id="arrowGrad" x1="12" y1="34" x2="33" y2="9" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0B4A7C" />
        <stop offset="30%" stopColor="#0077CC" />
        <stop offset="70%" stopColor="#00D4FF" />
        <stop offset="100%" stopColor="#00FFCC" />
      </linearGradient>

      {/* Person silhouette gradient */}
      <linearGradient id="silhouetteGrad" x1="12" y1="12" x2="22" y2="30" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#1E5D8C" />
        <stop offset="100%" stopColor="#0A2C4D" />
      </linearGradient>

      {/* Arrow/Highlight glow */}
      <filter id="cyanGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Soft drop shadow for 3D depth */}
      <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" floodColor="#000000" floodOpacity="0.6" />
      </filter>
    </defs>

    {/* Group with drop shadow for 3D effect */}
    <g filter="url(#logoShadow)">
      {/* ── Secondary diagonal support bar (compass line, bottom-right) ── */}
      <line
        x1="22" y1="22"
        x2="31" y2="31"
        stroke="url(#ringGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.8"
      />

      {/* ── Outer segmented target/gear ring ── */}
      <circle
        cx="22"
        cy="22"
        r="13"
        stroke="url(#ringGrad)"
        strokeWidth="2.5"
        fill="none"
      />

      {/* Outer notches/tabs (8 notches at regular angles) */}
      <g stroke="url(#ringGrad)" strokeWidth="2.2" strokeLinecap="round">
        {/* Top/Bottom/Left/Right notches */}
        <line x1="22" y1="6.5" x2="22" y2="9" />
        <line x1="22" y1="35" x2="22" y2="37.5" />
        <line x1="6.5" y1="22" x2="9" y2="22" />
        <line x1="35" y1="22" x2="37.5" y2="22" />
        
        {/* Diagonal notches */}
        <line x1="11" y1="11" x2="12.8" y2="12.8" />
        <line x1="31.2" y1="31.2" x2="33" y2="33" />
        <line x1="11" y1="33" x2="12.8" y2="31.2" />
        {/* Top-right notch is intentionally pierced by the arrow */}
      </g>

      {/* ── Person Silhouette (Left) ── */}
      {/* Head */}
      <circle cx="17.5" cy="16.5" r="4.2" fill="url(#silhouetteGrad)" />
      {/* Shoulders */}
      <path
        d="M10 30 C10 24.5 13.5 22 17.5 22 C21 22 23.5 24 24.2 28.5"
        stroke="url(#silhouetteGrad)"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* ── Sweeping cyan/teal arrow piercing the ring (Right) ── */}
      {/* Curved shaft */}
      <path
        d="M13.5 32.5 C16.5 29 23 23 31.5 13.5"
        stroke="url(#arrowGrad)"
        strokeWidth="3.2"
        strokeLinecap="round"
        filter="url(#cyanGlow)"
      />
      {/* Arrowhead */}
      <polygon
        points="32.5,12 25.5,14 29,19"
        fill="url(#arrowGrad)"
        filter="url(#cyanGlow)"
      />
    </g>
  </svg>
);


function App() {
  // Authentication state
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  
  // Auth Form State
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');

  // App Core State
  const [activeView, setActiveView] = useState('generator'); // 'generator' | 'results'
  const [profileText, setProfileText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jdUrl, setJdUrl] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [initialGeneratedText, setInitialGeneratedText] = useState('');
  const [tailoringNotes, setTailoringNotes] = useState([]);
  const [atsResult, setAtsResult] = useState({
    score: null,
    matched: [],
    missing: [],
    verdict: ''
  });
  
  // Saved resumes state
  const [savedResumes, setSavedResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [saveTitle, setSaveTitle] = useState('');
  const resumeRef = useRef(null);

  // Status/Loading States
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExtractingJdUrl, setIsExtractingJdUrl] = useState(false);
  const [isAtsChecking, setIsAtsChecking] = useState(false);
  const [isPreCheckingAts, setIsPreCheckingAts] = useState(false);
  const [preCheckResult, setPreCheckResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  
  // Feedback States
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Clear messages after a delay
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Load Saved Resumes list on login
  useEffect(() => {
    if (token) {
      fetchResumes();
    }
  }, [token]);

  // Helper for authenticated API headers
  const getAuthHeaders = (extraHeaders = {}) => {
    return {
      'Authorization': `Bearer ${token}`,
      ...extraHeaders
    };
  };

  // Centralized API response handler for 401s
  const handleApiResponse = async (response) => {
    if (response.status === 401) {
      // Clear credentials
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken('');
      setUser(null);
      setSavedResumes([]);
      setError('Your session has expired. Please log in again.');
      throw new Error('Unauthorized');
    }
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed. Please try again.');
    }
    return data;
  };

  // Auth Operations
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const url = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    const payload = isLoginMode 
      ? { email: authEmail, password: authPassword }
      : { name: authName, email: authEmail, password: authPassword };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }

      if (isLoginMode) {
        // Store in state & localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        
        // Reset fields
        setAuthName('');
        setAuthEmail('');
        setAuthPassword('');
        setSuccess(`Welcome back, ${data.user.name}!`);
      } else {
        // Registration mode: redirect to login form instead of automatic login
        setIsLoginMode(true);
        setAuthName('');
        setAuthPassword('');
        setSuccess('Registration successful! Please sign in with your credentials.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during authentication.');
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    setError('');
    setSuccess('');
    const idToken = response.credential;
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google authentication failed.');
      }
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setSuccess(`Welcome, ${data.user.name}!`);
    } catch (err) {
      setError(err.message || 'An error occurred during Google sign in.');
    }
  };

  useEffect(() => {
    if (token) return;
    
    let interval;
    const initGoogle = () => {
      if (window.google) {
        clearInterval(interval);
        console.log('Google Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '1084282747127-dummyclientid.apps.googleusercontent.com',
          callback: handleGoogleCredentialResponse,
        });

        const btnEl = document.getElementById('google-signin-btn');
        if (btnEl) {
          btnEl.innerHTML = '';
          window.google.accounts.id.renderButton(btnEl, {
            theme: 'filled_black',
            size: 'large',
            text: 'signin_with',
            width: 360,
            shape: 'rectangular',
          });
        }
      }
    };

    interval = setInterval(initGoogle, 300);
    initGoogle();

    return () => clearInterval(interval);
  }, [token, isLoginMode]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setSavedResumes([]);
    setProfileText('');
    setJobDescription('');
    setResumeText('');
    setTailoringNotes([]);
    setAtsResult({ score: null, matched: [], missing: [], verdict: '' });
    setActiveView('generator');
    setSuccess('Logged out successfully.');
  };

  const handleGoHome = () => {
    setActiveView('generator');
    setSelectedResumeId(null);
    setProfileText('');
    setJobDescription('');
    setResumeText('');
    setTailoringNotes([]);
    setAtsResult({ score: null, matched: [], missing: [], verdict: '' });
    setSaveTitle('');
    setError('');
    setSuccess('');
  };

  // Fetch all saved resumes for the user
  const fetchResumes = async () => {
    setIsListLoading(true);
    try {
      const response = await fetch('/api/resume', {
        headers: getAuthHeaders()
      });
      const data = await handleApiResponse(response);
      setSavedResumes(data);
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setError('Could not load your saved resumes.');
      }
    } finally {
      setIsListLoading(false);
    }
  };

  // Load a single resume
  const handleLoadResume = async (id) => {
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/resume/${id}`, {
        headers: getAuthHeaders()
      });
      const data = await handleApiResponse(response);
      
      setProfileText(data.profile || '');
      setJobDescription(data.jobDescription || '');
      setResumeText(data.resumeText || '');
      setSelectedResumeId(data._id);
      
      // Preset ATS score preview from saved data
      setAtsResult({
        score: data.atsScore,
        matched: [],
        missing: [],
        verdict: `Saved Score: ${data.atsScore}%. Click "Check ATS Readiness" below to run a keyword assessment.`
      });
      setTailoringNotes([]);
      setActiveView('results');
      setSuccess(`Loaded resume: "${data.title}"`);
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setError('Failed to load the selected resume.');
      }
    }
  };

  // Delete a saved resume
  const handleDeleteResume = async (id, title, e) => {
    e.stopPropagation(); // Prevent loading the resume when clicking the delete button
    
    const confirmDelete = window.confirm(`Are you sure you want to delete the saved resume "${title}"?`);
    if (!confirmDelete) return;

    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/resume/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      await handleApiResponse(response);

      setSuccess(`Resume "${title}" deleted successfully.`);
      
      // If the deleted resume is currently loaded, reset the workspace
      if (selectedResumeId === id) {
        handleGoHome();
      }
      
      // Refresh list
      fetchResumes();
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setError('Failed to delete the selected resume.');
      }
    }
  };

  // File Text Extraction Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setIsExtracting(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/profile/extract', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });
      const data = await handleApiResponse(response);
      
      setProfileText(data.text);
      setSuccess('Successfully extracted text from document!');
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setError(err.message || 'Failed to extract text from the file.');
      }
    } finally {
      setIsExtracting(false);
      // Reset input value so same file can be uploaded again
      e.target.value = '';
    }
  };

  // Extract Job Description from a URL link
  const handleExtractJdFromUrl = async () => {
    if (!jdUrl.trim()) {
      setError('Please enter a job posting URL (e.g. LinkedIn, Indeed, Naukri, or company career page).');
      return;
    }

    setError('');
    setSuccess('');
    setIsExtractingJdUrl(true);

    try {
      const response = await fetch('/api/profile/extract-url', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ url: jdUrl.trim() }),
      });
      const data = await handleApiResponse(response);

      setJobDescription(data.text);
      setSuccess('Job description extracted successfully from link!');
      if (preCheckResult) setPreCheckResult(null);
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setError(err.message || 'Failed to extract job description from URL.');
      }
    } finally {
      setIsExtractingJdUrl(false);
    }
  };

  // Resume Tailoring Call (with strict role eligibility guard)
  const handleGenerateResume = async () => {
    if (!profileText || !jobDescription) return;

    setError('');
    setSuccess('');

    // Step 1: Automatic Role Alignment Eligibility Guard
    if (!preCheckResult) {
      setIsPreCheckingAts(true);
      try {
        const atsRes = await fetch('/api/ats/check', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ resumeText: profileText, jobDescription })
        });
        const atsData = await handleApiResponse(atsRes);
        const mSkills = atsData.missingSkills || [];
        const mGeneric = atsData.missingGeneric || (atsData.missing || []).filter((k) => !mSkills.includes(k));
        const checkObj = {
          score: atsData.score,
          matched: atsData.matched || [],
          missing: atsData.missing || [],
          missingSkills: mSkills,
          missingGeneric: mGeneric,
          verdict: atsData.verdict
        };

        setAtsResult(checkObj);

        // If candidate alignment is low (< 45%), strictly block generation and display unsuitability warning!
        if (atsData.score < 45) {
          setPreCheckResult(checkObj);
          setIsPreCheckingAts(false);
          return; // Strictly blocks resume generation!
        }
      } catch (err) {
        console.warn('Pre-check alignment bypass due to network error:', err);
      } finally {
        setIsPreCheckingAts(false);
      }
    } else if (preCheckResult && preCheckResult.score < 45) {
      // If preCheckResult already shows low alignment, block generation!
      return;
    }

    // Step 2: Proceed with Gemini AI Resume Tailoring
    setIsGenerating(true);
    setGenerationProgress(0);
    setResumeText('');
    setTailoringNotes([]);
    setActiveView('results');

    let progressVal = 0;
    const progressInterval = setInterval(() => {
      progressVal = Math.min(
        98,
        progressVal + (progressVal < 30 ? 4 : progressVal < 70 ? 2 : 1)
      );
      setGenerationProgress(progressVal);
    }, 120);

    try {
      const response = await fetch('/api/resume/generate', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          profile: profileText,
          jobDescription: jobDescription
        })
      });
      const data = await handleApiResponse(response);

      clearInterval(progressInterval);
      setGenerationProgress(100);
      await new Promise(resolve => setTimeout(resolve, 350));

      setResumeText(data.resumeText);
      setInitialGeneratedText(data.resumeText);
      setTailoringNotes(data.tailoringNotes || []);
      setSuccess('Resume tailored successfully!');

      // Automatically re-verify ATS keyword alignment against the newly tailored resume text
      try {
        const atsRes = await fetch('/api/ats/check', {
          method: 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ resumeText: data.resumeText, jobDescription })
        });
        const atsData = await handleApiResponse(atsRes);
        const mSkills = atsData.missingSkills || [];
        const mGeneric = atsData.missingGeneric || (atsData.missing || []).filter((k) => !mSkills.includes(k));
        setAtsResult({
          score: atsData.score,
          matched: atsData.matched || [],
          missing: atsData.missing || [],
          missingSkills: mSkills,
          missingGeneric: mGeneric,
          verdict: atsData.verdict
        });
      } catch (atsErr) {
        console.warn('Auto ATS re-verification error:', atsErr);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setGenerationProgress(0);
      if (err.message !== 'Unauthorized') {
        setError(err.message || 'An error occurred during resume tailoring.');
      }
      setActiveView('generator');
    } finally {
      setIsGenerating(false);
    }
  };

  // Deterministic Keyword ATS Checker Call
  const handleAtsCheck = async () => {
    if (!resumeText || !jobDescription) return;

    setError('');
    setIsAtsChecking(true);

    try {
      const response = await fetch('/api/ats/check', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          resumeText: resumeText,
          jobDescription: jobDescription
        })
      });
      const data = await handleApiResponse(response);

      const mSkills = data.missingSkills || [];
      const mGeneric = data.missingGeneric || (data.missing || []).filter((k) => !mSkills.includes(k));
      setAtsResult({
        score: data.score,
        matched: data.matched,
        missing: data.missing,
        missingSkills: mSkills,
        missingGeneric: mGeneric,
        verdict: data.verdict
      });
      setSuccess('ATS analysis complete!');
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setError(err.message || 'Failed to check ATS keywords.');
      }
    } finally {
      setIsAtsChecking(false);
    }
  };

  // Pre-Check ATS & Role Fit on raw profile + JD before generating
  const handlePreCheckAts = async () => {
    if (!profileText.trim() || !jobDescription.trim()) return;

    setError('');
    setIsPreCheckingAts(true);

    try {
      const response = await fetch('/api/ats/check', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          resumeText: profileText,
          jobDescription: jobDescription
        })
      });
      const data = await handleApiResponse(response);

      const mSkills = data.missingSkills || [];
      const mGeneric = data.missingGeneric || (data.missing || []).filter((k) => !mSkills.includes(k));
      const resObj = {
        score: data.score,
        matched: data.matched || [],
        missing: data.missing || [],
        missingSkills: mSkills,
        missingGeneric: mGeneric,
        verdict: data.verdict
      };
      setPreCheckResult(resObj);
      setAtsResult(resObj);
      setSuccess('Pre-check complete! Review your role alignment below.');
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setError(err.message || 'Failed to pre-check role alignment.');
      }
    } finally {
      setIsPreCheckingAts(false);
    }
  };

  // Save Resume handler
  const handleSaveResume = async () => {
    if (!resumeText) return;

    const forbidden = getManualSkillsAdded(resumeText, atsResult.missingSkills);
    if (forbidden.length > 0) {
      setError(`Cannot save resume. Please remove the manually added skill gaps: ${forbidden.join(', ')}`);
      return;
    }

    const finalTitle = saveTitle.trim() || 'Tailored Resume';
    
    setError('');
    setIsSaving(true);

    try {
      // If the user hasn't run an ATS check yet, run it now so the saved score is real (not 0)
      let scoreToSave = atsResult.score;
      if (scoreToSave === null && jobDescription) {
        try {
          const atsRes = await fetch('/api/ats/check', {
            method: 'POST',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ resumeText, jobDescription })
          });
          const atsData = await handleApiResponse(atsRes);
          scoreToSave = atsData.score;
          setAtsResult({
            score: atsData.score,
            matched: atsData.matched,
            missing: atsData.missing,
            missingSkills: atsData.missingSkills || [],
            missingGeneric: atsData.missingGeneric || [],
            verdict: atsData.verdict
          });
        } catch (atsErr) {
          if (atsErr.message === 'Unauthorized') throw atsErr;
          scoreToSave = 0;
        }
      }

      const response = await fetch('/api/resume', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: finalTitle,
          profile: profileText,
          jobDescription: jobDescription,
          resumeText: resumeText,
          atsScore: scoreToSave !== null ? scoreToSave : 0
        })
      });
      const data = await handleApiResponse(response);

      setSelectedResumeId(data._id);
      setSuccess(`Resume "${finalTitle}" saved successfully!`);
      setSaveTitle('');
      fetchResumes(); // refresh sidebar list
    } catch (err) {
      if (err.message !== 'Unauthorized') {
        setError(err.message || 'Failed to save resume.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Insert a generic (safe) keyword into the resume at the cursor position and update ATS score live
  const insertKeyword = (word) => {
    const el = resumeRef.current;
    const text = resumeText;
    let pos = text.length;
    if (el && typeof el.selectionStart === 'number') {
      pos = el.selectionStart;
    }
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const sep = before && !/\s$/.test(before) ? ' ' : '';
    const insertion = sep + word;
    const updatedText = before + insertion + after;
    setResumeText(updatedText);
    setSuccess(`Added "${word}" to your resume — reposition it as needed.`);

    // Live update ATS dashboard chips and score
    if (atsResult.missingGeneric.includes(word)) {
      const newMissingGeneric = atsResult.missingGeneric.filter(w => w !== word);
      const newMatched = [...atsResult.matched, word];
      const total = newMatched.length + newMissingGeneric.length + atsResult.missingSkills.length;
      const newScore = total > 0 ? Math.round((newMatched.length / total) * 100) : atsResult.score;
      setAtsResult(prev => ({
        ...prev,
        score: newScore,
        matched: newMatched,
        missingGeneric: newMissingGeneric,
      }));
    }

    setTimeout(() => {
      if (el) {
        el.focus();
        const c = (before + insertion).length;
        el.setSelectionRange(c, c);
      }
    }, 50);
  };

  // Export to PDF (Triggers print media stylesheets)
  const handleExportPdf = () => {
    if (!resumeText) return;
    setError('');
    setSuccess('Opening your print dialog — choose "Save as PDF" as the destination to export.');
    setTimeout(() => window.print(), 150);
  };

  // Helper score range color class
  const getScoreColorClass = (score) => {
    if (score === null) return '';
    if (score < 50) return 'low';
    if (score < 80) return 'medium';
    return '';
  };

  // RENDER AUTH PAGE IF NOT LOGGED IN
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <RoleFitLogo size={52} />
            </div>
            <h1 className="auth-title">RoleFit <span>AI</span></h1>
            <p className="auth-subtitle">
              {isLoginMode 
                ? 'Sign in to access your tailored resumes' 
                : 'Create an account to start tailoring resumes'}
            </p>
          </div>

          {error && (
            <div className="error-banner">
              <span>⚠️</span> {error}
            </div>
          )}
          {success && (
            <div className="success-banner">
              {success}
            </div>
          )}

          <form onSubmit={handleAuthSubmit}>
            {!isLoginMode && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="John Doe"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  required={!isLoginMode}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-control"
                placeholder="name@domain.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              {isLoginMode ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider" style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            <span style={{ padding: '0 0.75rem' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          </div>

          <div 
            className="google-btn-wrapper"
            onClick={() => {
              if (window.google?.accounts?.id) {
                window.google.accounts.id.prompt();
              }
            }}
          >
            <button type="button" className="btn-google-custom">
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0, pointerEvents: 'none' }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span style={{ pointerEvents: 'none' }}>Sign in with Google</span>
            </button>
            <div id="google-signin-btn" className="google-signin-overlay"></div>
          </div>

          <p className="auth-toggle-text">
            {isLoginMode ? "Don't have an account yet?" : "Already have an account?"}
            <button 
              type="button" 
              className="auth-link" 
              onClick={() => {
                setIsLoginMode(!isLoginMode);
                setError('');
                setSuccess('');
              }}
            >
              {isLoginMode ? 'Register' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // RENDER APP MAIN PAGE IF LOGGED IN
  return (
    <>
      {/* Printable Area - Hidden on Screen, visible only in @media print */}
      <div className="printable-resume">
        <div className="printable-resume-content">{renderResume(resumeText)}</div>
      </div>

      {/* Screen Interface Wrapper */}
      <div className="app-container no-print">
        <header className="app-header">
          <div className="logo-container" onClick={handleGoHome} title="Return to Home / New Resume">
            <RoleFitLogo size={36} />
            <div className="logo-text">RoleFit <span>AI</span></div>
          </div>

          <div className="user-nav">
            <div className="user-info">
              <span className="user-info-label">Logged in as: </span>
              <span className="user-name">{user?.name}</span>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary header-logout-btn">
              Log Out
            </button>
          </div>
        </header>

        {error && (
          <div className="error-banner" style={{ margin: '1.25rem 2rem 0' }}>
            <span>⚠️</span> {error}
          </div>
        )}
        {success && (
          <div className="success-banner" style={{ margin: '1.25rem 2rem 0' }}>
            ✅ {success}
          </div>
        )}

        <main className="main-layout">
          {/* LEFT SIDEBAR: SAVED RESUMES */}
          <aside className="sidebar">
            <div className="card">
              <h2 className="card-title">
                My Saved Resumes
                {isListLoading && <span style={{ fontSize: '0.78rem', color: 'var(--mint)', fontWeight: 500 }}>Loading…</span>}
              </h2>

              <div className="resume-list">
                {savedResumes.length === 0 ? (
                  <div className="empty-state">
                    {isListLoading ? 'Retrieving records…' : 'No resumes saved yet.\nGenerate one to get started!'}
                  </div>
                ) : (
                  savedResumes.map((resume) => (
                    <button
                      key={resume._id}
                      onClick={() => handleLoadResume(resume._id)}
                      className={`resume-item ${selectedResumeId === resume._id ? 'active' : ''}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <div className="resume-item-title" style={{ flex: 1, textAlign: 'left', margin: 0 }}>{resume.title}</div>
                        <span 
                          className="resume-item-delete"
                          onClick={(e) => handleDeleteResume(resume._id, resume.title, e)}
                          title="Delete saved resume"
                        >
                          🗑️
                        </span>
                      </div>
                      <div className="resume-item-meta">
                        <span>
                          {new Date(resume.updatedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className={`score-badge ${getScoreColorClass(resume.atsScore)}`}>
                          ATS: {resume.atsScore}%
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* RIGHT WORKSPACE */}
          <section className="workspace">

            {/* ═══════════════════════════════════════
                GENERATOR VIEW
                ═══════════════════════════════════════ */}
            {activeView === 'generator' ? (
              <>
                {/* File Upload */}
                <div className="card">
                  <h3 className="card-title" style={{ fontSize: '0.95rem', marginBottom: '0.65rem' }}>
                    Upload an existing resume — optional
                  </h3>
                  <div className={`file-upload-wrapper ${isExtracting ? 'uploading' : ''}`}>
                    <input
                      type="file"
                      className="file-upload-input"
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileUpload}
                      disabled={isExtracting}
                    />
                    <div className="file-upload-text">
                      {isExtracting ? (
                        <strong>Extracting text from your file… Please wait.</strong>
                      ) : (
                        <>Drag and drop or <strong>click to upload</strong> (.pdf, .docx, .txt · max 5 MB)</>
                      )}
                    </div>
                  </div>
                </div>

                {/* Two-column Editors */}
                <div className="two-col-editor">
                  {/* Profile */}
                  <div className="card">
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                      Your Profile / Experience
                    </label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                      Work history, skills, achievements, and education.
                    </p>
                    <textarea
                      className="form-control"
                      style={{ minHeight: '300px' }}
                      placeholder="Paste your existing resume raw text, or describe your work experience (company, role, responsibilities), key skills, and credentials…"
                      value={profileText}
                      onChange={(e) => {
                        setProfileText(e.target.value);
                        if (preCheckResult) setPreCheckResult(null);
                      }}
                    />
                  </div>

                  {/* Job Description */}
                  <div className="card">
                    <label className="form-label" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                      Target Job Description
                    </label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                      Paste a job posting URL to extract automatically, or paste the text directly below.
                    </p>

                    {/* URL Extraction Bar */}
                    <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.75rem' }}>
                      <input
                        type="url"
                        className="form-control"
                        style={{ flex: 1, fontSize: '0.82rem', padding: '0.45rem 0.7rem' }}
                        placeholder="🔗 Paste job URL (LinkedIn, Indeed, Naukri, Lever, Workday...)"
                        value={jdUrl}
                        onChange={(e) => setJdUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleExtractJdFromUrl();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ whiteSpace: 'nowrap', padding: '0.45rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        onClick={handleExtractJdFromUrl}
                        disabled={isExtractingJdUrl || !jdUrl.trim()}
                      >
                        {isExtractingJdUrl ? '⚡ Extracting…' : '⚡ Extract Link'}
                      </button>
                    </div>

                    <textarea
                      className="form-control"
                      style={{ minHeight: '260px' }}
                      placeholder="Paste the complete responsibilities, qualifications, and requirements from the job description here (or extract automatically via URL above)…"
                      value={jobDescription}
                      onChange={(e) => {
                        setJobDescription(e.target.value);
                        if (preCheckResult) setPreCheckResult(null);
                      }}
                    />
                  </div>
                </div>

                {/* Role Unsuitability Warning Card (Displayed automatically if candidate has low alignment) */}
                {preCheckResult && preCheckResult.score < 45 && (
                  <div className="card pre-check-card" style={{ marginTop: '1.25rem', borderLeft: '4px solid #EF4444' }}>
                    <div className="card-title" style={{ color: '#EF4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span>⚠️ Role Unsuitability Warning</span>
                      <span className="score-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontSize: '0.85rem', padding: '0.25rem 0.65rem' }}>
                        {preCheckResult.score}% Alignment Match
                      </span>
                    </div>

                    <p style={{ fontSize: '0.88rem', lineHeight: '1.6', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                      {preCheckResult.verdict}
                    </p>

                    <div className="kw-grid" style={{ marginBottom: '1rem' }}>
                      <div className="keyword-chips-section">
                        <div className="keyword-category-title" style={{ color: 'var(--mint)' }}>Matched Existing Skills ({preCheckResult.matched.length})</div>
                        <div className="chips-container">
                          {preCheckResult.matched.length === 0 ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None matched yet</span> : preCheckResult.matched.map(skill => <span key={skill} className="kw-chip matched">{skill}</span>)}
                        </div>
                      </div>

                      <div className="keyword-chips-section">
                        <div className="keyword-category-title" style={{ color: '#EF4444' }}>Missing Critical Skills ({preCheckResult.missingSkills.length})</div>
                        <div className="chips-container">
                          {preCheckResult.missingSkills.length === 0 ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No major skill gaps</span> : preCheckResult.missingSkills.map(skill => <span key={skill} className="kw-chip skill">{skill}</span>)}
                        </div>
                      </div>
                    </div>

                    <div className="role-mismatch-advice" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px dashed rgba(239, 68, 68, 0.3)', padding: '0.85rem 1rem', borderRadius: '8px', fontSize: '0.82rem', color: '#FCA5A5', marginBottom: '1rem' }}>
                      💡 <strong>Recommendation:</strong> Your current profile has significant skill gaps for this target position. We gracefully recommend targeting roles closer to your primary domain or acquiring the missing skills above before applying.
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        onClick={() => setPreCheckResult(null)}
                        className="btn btn-secondary"
                        style={{ width: '100%', maxWidth: '380px', fontSize: '0.88rem', padding: '0.7rem 1.25rem' }}
                      >
                        ✏️ Modify Profile or Target Job Description
                      </button>
                    </div>
                  </div>
                )}

                {/* Single Primary Action Button */}
                <div className="generate-btn-wrap" style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
                  <button
                    onClick={handleGenerateResume}
                    disabled={isPreCheckingAts || isGenerating || !profileText.trim() || !jobDescription.trim() || (preCheckResult && preCheckResult.score < 45)}
                    className="btn btn-primary"
                    style={{ minWidth: '280px', padding: '0.95rem 1.75rem', fontSize: '1.02rem', opacity: (preCheckResult && preCheckResult.score < 45) ? 0.5 : 1 }}
                  >
                    {isPreCheckingAts
                      ? '🔍 Verifying Role Eligibility…'
                      : isGenerating
                      ? 'Tailoring with Gemini AI…'
                      : (preCheckResult && preCheckResult.score < 45)
                      ? '⛔ Unsuited for Role — Modify Inputs Above'
                      : '✦ Generate Tailored Resume'}
                  </button>
                </div>
              </>

            ) : (
              /* ═══════════════════════════════════════
                 RESULTS VIEW
                 ═══════════════════════════════════════ */
              <>
                {/* Back Row */}
                <div className="back-btn-row">
                  <button
                    onClick={() => setActiveView('generator')}
                    disabled={isGenerating}
                    className="btn btn-secondary"
                  >
                    ← Edit Inputs
                  </button>
                  {!isGenerating && resumeText && (
                    <span className="view-label">✦ Your tailored resume is ready</span>
                  )}
                </div>

                {/* ── LOADING STATE ── */}
                {isGenerating ? (
                  <div className="card" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '3.5rem 2rem', gap: '2rem',
                    minHeight: '420px'
                  }}>
                    <style>{`
                      @keyframes spin-slow {
                        0%   { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                      @keyframes pulse-slow {
                        0%, 100% { opacity: 0.6; }
                        50%       { opacity: 1; }
                      }
                    `}</style>

                    {/* Circular Progress */}
                    <div style={{ position: 'relative', width: '140px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', background: 'rgba(0,212,168,0.07)', filter: 'blur(16px)', zIndex: 0 }}></div>
                      <svg width="130" height="130" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)', zIndex: 1 }}>
                        <circle cx="60" cy="60" r="50" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                        <circle cx="60" cy="60" r="54" fill="transparent" stroke="var(--navy-light)" strokeWidth="1.5" strokeDasharray="5, 15"
                          style={{ animation: 'spin-slow 8s linear infinite', transformOrigin: 'center' }} />
                        <circle cx="60" cy="60" r="50" fill="transparent" stroke="var(--mint)" strokeWidth="8"
                          strokeDasharray="314" strokeDashoffset={314 - (314 * generationProgress) / 100}
                          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.3s ease-out' }} />
                      </svg>
                      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
                        <span style={{ fontFamily: 'var(--font-title)', fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                          {generationProgress}%
                        </span>
                        <span style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--mint)', fontWeight: 600 }}>
                          Progress
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', textAlign: 'center' }}>
                      <h4 style={{ fontFamily: 'var(--font-title)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', animation: 'pulse-slow 2s infinite ease-in-out' }}>
                        {getProgressStatusMessage(generationProgress)}
                      </h4>
                      <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', maxWidth: '340px' }}>
                        Aligning your work history with the target job requirements via Gemini AI.
                      </p>
                    </div>

                    {/* Skeleton Shimmer */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: 0.12, pointerEvents: 'none', marginTop: '0.5rem' }}>
                      <div style={{ height: '14px', background: 'var(--text-secondary)', borderRadius: '4px', width: '22%' }}></div>
                      <div style={{ height: '56px', background: 'var(--text-secondary)', borderRadius: '6px' }}></div>
                      <div style={{ height: '14px', background: 'var(--text-secondary)', borderRadius: '4px', width: '14%' }}></div>
                      <div style={{ height: '110px', background: 'var(--text-secondary)', borderRadius: '6px' }}></div>
                    </div>
                  </div>

                ) : resumeText && (
                  /* ── TWO-COLUMN RESULTS WORKSPACE ── */
                  <div className="results-workspace">

                    {/* ── LEFT COLUMN: Editor + Actions + ATS ── */}
                    <div className="results-left">

                      {/* Editable Resume */}
                      <div className="card output-card">
                        <div className="card-title">
                          <span>Tailored Resume</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                            Proofread &amp; edit below
                          </span>
                        </div>

                        <textarea
                          ref={resumeRef}
                          className="form-control resume-textarea"
                          value={resumeText}
                          onChange={(e) => setResumeText(e.target.value)}
                          placeholder="Your tailored resume text will appear here. Edit it directly."
                        />

                        {getManualSkillsAdded(resumeText, atsResult.missingSkills, profileText, initialGeneratedText).length > 0 && (
                          <div className="error-banner" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                            <span>⚠️</span>
                            <div>
                              <strong>Skill Gap Warning:</strong> You have manually typed a skill gap into your resume:{' '}
                              <strong>{getManualSkillsAdded(resumeText, atsResult.missingSkills, profileText, initialGeneratedText).join(', ')}</strong>.
                              Take a course to acquire this skill rather than typing it into your resume.
                            </div>
                          </div>
                        )}

                        {/* Save Title */}
                        <div className="save-row">
                          <label className="save-row-label" htmlFor="resume-title">
                            Resume title — labels this in "My Saved Resumes" (optional)
                          </label>
                          <input
                            id="resume-title"
                            type="text"
                            className="form-control"
                            placeholder="e.g. Data Analyst — Acme Corp"
                            value={saveTitle}
                            onChange={(e) => setSaveTitle(e.target.value)}
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="editor-actions">
                          <button
                            onClick={handleAtsCheck}
                            disabled={isAtsChecking}
                            className="btn btn-secondary"
                            title="Re-evaluate ATS keyword alignment after manual text edits"
                          >
                            {isAtsChecking ? 'Analyzing…' : '🔄 Re-analyze ATS Score'}
                          </button>
                          <button
                            onClick={handleSaveResume}
                            disabled={isSaving}
                            className="btn btn-secondary"
                          >
                            {isSaving ? 'Saving…' : '💾 Save Resume'}
                          </button>
                          <button
                            onClick={handleExportPdf}
                            className="btn btn-primary"
                          >
                            📄 Export PDF
                          </button>
                        </div>
                      </div>

                      {/* ATS Dashboard */}
                      {atsResult.score !== null && (
                        <div className="ats-dashboard">
                          <div className="ats-summary">
                            <div className={`ats-score-circle ${getScoreColorClass(atsResult.score)}`}>
                              {atsResult.score}%
                            </div>
                            <div className="ats-verdict-box">
                              <div className="ats-verdict-title" style={{ color: atsResult.score >= 75 ? 'var(--mint)' : atsResult.score >= 45 ? '#F59E0B' : '#EF4444' }}>
                                {atsResult.score < 45 ? '⚠️ Role Unsuitability Warning' : 'ATS Keyword Optimization'}
                              </div>
                              <div className="ats-verdict-desc">{atsResult.verdict}</div>
                            </div>
                          </div>

                          {/* Legend */}
                          <div className="kw-legend">
                            <span><span className="dot dot-matched"></span> Matched</span>
                            <span><span className="dot dot-generic"></span> Safe to add — click to insert</span>
                            <span><span className="dot dot-skill"></span> Skill gap — hover for courses</span>
                          </div>

                          <div className="kw-grid">
                            {/* Matched */}
                            <div className="keyword-chips-section">
                              <div className="keyword-category-title">Matched ({atsResult.matched.length})</div>
                              <div className="chips-container">
                                {atsResult.matched.length === 0 ? (
                                  <span className="kw-empty">None matched yet</span>
                                ) : atsResult.matched.map((kw, i) => (
                                  <span key={i} className="chip chip-matched">{kw}</span>
                                ))}
                              </div>
                            </div>

                            {/* Generic — click to add */}
                            <div className="keyword-chips-section">
                              <div className="keyword-category-title">
                                Safe to add ({(atsResult.missingGeneric || []).length})
                              </div>
                              <div className="chips-container">
                                {(atsResult.missingGeneric || []).length === 0 ? (
                                  <span className="kw-empty">None</span>
                                ) : (atsResult.missingGeneric || []).map((kw, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    className="chip chip-generic chip-add"
                                    title={`Click to add "${kw}" at cursor position`}
                                    onClick={() => insertKeyword(kw)}
                                  >
                                    {kw}<span className="chip-plus">+</span>
                                  </button>
                                ))}
                              </div>
                              <div className="kw-hint">
                                💡 Click inside the editor to place your cursor first, then click a word to insert it there.
                              </div>
                            </div>

                            {/* Skill Gap — hover for courses */}
                            <div className="keyword-chips-section">
                              <div className="keyword-category-title">
                                Skill gaps — learn these ({(atsResult.missingSkills || []).length})
                              </div>
                              <div className="chips-container">
                                {(atsResult.missingSkills || []).length === 0 ? (
                                  <span className="kw-empty">No skill gaps 🎉</span>
                                ) : (atsResult.missingSkills || []).map((kw, i) => (
                                  <span key={i} className="skill-chip-wrap">
                                    <span className="chip chip-skill" title="A real skill — hover for courses">{kw}</span>
                                    <span className="skill-tooltip">
                                      <span className="skill-tooltip-title">Learn "{kw}"</span>
                                      <a href={courseLink('coursera', kw)} target="_blank" rel="noreferrer">Coursera</a>
                                      <a href={courseLink('udemy', kw)} target="_blank" rel="noreferrer">Udemy</a>
                                      <a href={courseLink('web', kw)} target="_blank" rel="noreferrer">Web search</a>
                                    </span>
                                  </span>
                                ))}
                              </div>
                              <div className="kw-hint">🔒 Real skills — can't be added, only earned. Hover for course suggestions.</div>
                            </div>
                          </div>

                          {atsResult.score < 80 && ((atsResult.missingGeneric || []).length > 0 || (atsResult.missingSkills || []).length > 0) && (
                            <div className="ats-tips">
                              <div className="ats-tips-title">How to raise your score</div>
                              <ol>
                                <li>Place your cursor in the editor, then click the amber terms to insert relevant ones.</li>
                                <li>For pink skills, take a suggested course, then add the skill and re-check.</li>
                                <li>Paste the full job description — a one-line JD yields very few keywords.</li>
                              </ol>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ── RIGHT COLUMN: Sticky Preview + Tailoring Notes ── */}
                    <div className="results-right">

                      {/* Formatted Preview Panel */}
                      <div className="preview-panel">
                        <div className="preview-panel-label">
                          <span>◈</span> Live PDF Preview
                        </div>
                        <div className="resume-preview">{renderResume(resumeText)}</div>
                      </div>

                      {/* Tailoring Notes */}
                      {tailoringNotes.length > 0 && (
                        <div className="card">
                          <div className="notes-title">Tailoring Adjustments (Gemini Focus)</div>
                          <ul className="notes-list">
                            {tailoringNotes.map((note, index) => (
                              <li key={index}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

export default App;