// ════════════════════════════════════════════
//  JobSphere — script.js
//  Works on both user.html and company.html
// ════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth, signInWithPopup, GoogleAuthProvider,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    sendPasswordResetEmail, signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore, collection, addDoc, getDocs, getDoc,
    setDoc, doc, query, where, orderBy, serverTimestamp,
    onSnapshot, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── Firebase Config ──────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyAD3xg3SZLQyv-Rf3rb4vw6-HVsZuZRD3E",
    authDomain: "jobsphere-ab925.firebaseapp.com",
    projectId: "jobsphere-ab925",
    storageBucket: "jobsphere-ab925.firebasestorage.app",
    messagingSenderId: "757724057808",
    appId: "1:757724057808:web:d46c8fbb78409abfef4ed5"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const provider = new GoogleAuthProvider();

// Cloudinary
const CLOUDINARY = { cloudName: 'dsv4npqz3', uploadPreset: 'jobsphere_media' };

// Current page
const PAGE = document.body.getAttribute('data-page'); // 'user' or 'company'
const PROTECTED_MODAL_ACTIONS = {
    applyModal: 'apply for jobs',
    postJobModal: 'post jobs',
    uploadModal: 'upload media'
};

// Track active chat listener so we can unsubscribe
let activeChatUnsub = null;

function requireAuthenticatedUser(action = 'continue') {
    const user = auth.currentUser;
    if (user) return user;

    showNotification(`Please sign in to ${action}.`, 'info');
    if (typeof window.openModal === 'function') {
        window.openModal('authModal');
    }
    return null;
}

async function requireOwnedJob(jobId, userId) {
    const jobSnap = await getDoc(doc(db, 'jobs', jobId));
    if (!jobSnap.exists()) {
        showNotification('This job is no longer available.', 'error');
        return null;
    }

    const job = jobSnap.data();
    if (job.postedBy !== userId) {
        showNotification('You can only manage jobs posted from your account.', 'error');
        return null;
    }

    return job;
}

async function requireOwnedApplication(appId, userId) {
    const appSnap = await getDoc(doc(db, 'applications', appId));
    if (!appSnap.exists()) {
        showNotification('This application could not be found.', 'error');
        return null;
    }

    const application = appSnap.data();
    if (application.companyUid !== userId) {
        showNotification('You can only review applications for your own jobs.', 'error');
        return null;
    }

    return application;
}

// ════════════════════════════════════════════
//  AUTH STATE
// ════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Ensure user doc exists
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                name: user.displayName || user.email.split('@')[0],
                email: user.email,
                photo: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||'User')}&background=6366f1&color=fff`,
                role: PAGE === 'company' ? 'company' : 'user',
                createdAt: serverTimestamp()
            });
        }
        updateNavForUser(user);
        if (PAGE === 'user') {
            loadJobsFromFirestore();
            loadUserApplications(user.uid);
            loadMediaGallery();
        } else if (PAGE === 'company') {
            loadCompanyJobs(user.uid);
            loadCompanyApplications(user.uid);
            loadMediaGallery();
        }
    } else {
        updateNavForUser(null);
        if (PAGE === 'user') loadJobsFromFirestore();
        loadMediaGallery();
    }
});

// ════════════════════════════════════════════
//  INIT AOS ON LOAD
// ════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 1000, once: true, offset: 50 });
    initCounters();
});

// ════════════════════════════════════════════
//  NAVBAR
// ════════════════════════════════════════════
function updateNavForUser(user) {
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;

    if (user) {
        const photo = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||'User')}&background=6366f1&color=fff`;
        const name  = user.displayName || user.email.split('@')[0];
        const badge = PAGE === 'company'
            ? `<span style="padding:4px 12px;background:rgba(167,139,250,0.15);color:#7c3aed;border-radius:20px;font-size:0.75rem;font-weight:700;">Company</span>`
            : `<span style="padding:4px 12px;background:rgba(99,102,241,0.15);color:#6366f1;border-radius:20px;font-size:0.75rem;font-weight:700;">Job Seeker</span>`;

        const extraBtn = PAGE === 'company'
            ? `<button class="btn btn-gradient" onclick="openPostJobModal()"><i class="ph ph-plus"></i> Post Job</button>`
            : '';

        authButtons.innerHTML = `
            <button class="switch-role-btn" onclick="switchRole()">
                <i class="ph ph-arrows-left-right"></i> Switch Role
            </button>
            ${badge}
            <div class="user-menu">
                <img src="${photo}" alt="${name}" class="user-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff'">
                <div class="user-dropdown">
                    <div class="user-info">
                        <img src="${photo}" alt="${name}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff'">
                        <strong>${name}</strong>
                        <small>${user.email}</small>
                    </div>
                    <div class="dropdown-divider"></div>
                    ${PAGE === 'user' ? `<a href="#" onclick="openModal('uploadModal')"><i class="ph ph-image" style="margin-right:8px;"></i>Upload Media</a>` : ''}
                    ${PAGE === 'company' ? `<a href="#" onclick="openPostJobModal()"><i class="ph ph-briefcase" style="margin-right:8px;"></i>Post a Job</a><a href="#" onclick="openModal('uploadModal')"><i class="ph ph-image" style="margin-right:8px;"></i>Upload Media</a>` : ''}
                    <div class="dropdown-divider"></div>
                    <a href="#" onclick="googleSignOut()"><i class="ph ph-sign-out" style="margin-right:8px;"></i>Sign Out</a>
                </div>
            </div>
            ${extraBtn}
        `;
    } else {
        const postBtn = PAGE === 'company'
            ? `<button class="btn btn-gradient" onclick="openPostJobModal()"><i class="ph ph-plus"></i> Post Job</button>`
            : '';
        authButtons.innerHTML = `
            <button class="switch-role-btn" onclick="switchRole()">
                <i class="ph ph-arrows-left-right"></i> Switch Role
            </button>
            <button class="btn btn-outline login-btn" onclick="openModal('authModal')">Sign In</button>
            ${postBtn}
        `;
    }
}

// ════════════════════════════════════════════
//  ROLE / NAVIGATION
// ════════════════════════════════════════════
window.switchRole = function() {
    localStorage.removeItem('jobsphere_role');
    window.location.href = 'index.html';
};

// ════════════════════════════════════════════
//  AUTH — Google
// ════════════════════════════════════════════
window.googleSignIn = async function() {
    try {
        provider.setCustomParameters({ prompt: 'select_account' });
        const btn = document.querySelector('.google-btn');
        if (btn) { btn.innerHTML = '<i class="ph ph-spinner"></i> Connecting...'; btn.disabled = true; }

        const result = await signInWithPopup(auth, provider);
        const user   = result.user;

        const userRef = doc(db, "users", user.uid);
        const snap    = await getDoc(userRef);
        if (!snap.exists()) {
            await setDoc(userRef, {
                uid: user.uid, name: user.displayName,
                email: user.email, photo: user.photoURL,
                role: PAGE === 'company' ? 'company' : 'user',
                createdAt: serverTimestamp()
            });
            showNotification('Welcome to JobSphere!', 'success');
        } else {
            showNotification(`Welcome back, ${user.displayName}!`, 'success');
        }
        closeModal('authModal');
    } catch (err) {
        if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
            showNotification(err.message, 'error');
        }
    } finally {
        const btn = document.querySelector('.google-btn');
        if (btn) {
            btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Continue with Google`;
            btn.disabled = false;
        }
    }
};

// ── Email Sign In ──
window.handleSignIn = async function(e) {
    e.preventDefault();
    const email = document.getElementById('signinEmail').value;
    const pass  = document.getElementById('signinPassword').value;
    const btn   = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Signing In...'; btn.disabled = true;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        showNotification('Signed in successfully!', 'success');
        closeModal('authModal');
    } catch (err) {
        showNotification(err.code === 'auth/invalid-credential' ? 'Invalid email or password.' : err.message, 'error');
    } finally { btn.textContent = 'Sign In'; btn.disabled = false; }
};

// ── Email Sign Up ──
window.handleSignUp = async function(e) {
    e.preventDefault();
    const name  = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const pass  = document.getElementById('signupPassword').value;
    const btn   = e.target.querySelector('button[type="submit"]');
    if (pass.length < 6) { showNotification('Password must be at least 6 characters', 'error'); return; }
    btn.textContent = 'Creating...'; btn.disabled = true;
    try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(result.user, { displayName: name });
        await setDoc(doc(db, "users", result.user.uid), {
            uid: result.user.uid, name, email,
            photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`,
            role: PAGE === 'company' ? 'company' : 'user',
            createdAt: serverTimestamp()
        });
        showNotification('Account created! Welcome!', 'success');
        closeModal('authModal');
    } catch (err) {
        showNotification(err.code === 'auth/email-already-in-use' ? 'Email already in use.' : err.message, 'error');
    } finally { btn.textContent = 'Create Account'; btn.disabled = false; }
};

// ── Forgot Password ──
window.showForgotPassword = function() { closeModal('authModal'); openModal('forgotPasswordModal'); };
window.handleForgotPassword = async function(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const btn   = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Sending...'; btn.disabled = true;
    try {
        await sendPasswordResetEmail(auth, email);
        showNotification('Reset email sent! Check your inbox.', 'success');
        closeModal('forgotPasswordModal');
    } catch (err) {
        showNotification(err.message, 'error');
    } finally { btn.textContent = 'Send Reset Link'; btn.disabled = false; }
};

// ── Toggle Auth Mode ──
window.toggleAuthMode = function(mode) {
    document.getElementById('signinForm').style.display  = mode === 'signin' ? 'block' : 'none';
    document.getElementById('signupForm').style.display  = mode === 'signup' ? 'block' : 'none';
    document.getElementById('signinToggle').classList.toggle('active', mode === 'signin');
    document.getElementById('signupToggle').classList.toggle('active', mode === 'signup');
    document.getElementById('authModalTitle').textContent = mode === 'signin' ? 'Sign In' : 'Create Account';
};

// ── Sign Out ──
window.googleSignOut = async function() {
    await signOut(auth);
    localStorage.removeItem('jobsphere_role');
    window.location.href = 'index.html';
};

// ════════════════════════════════════════════
//  JOBS — LOAD (user.html)
// ════════════════════════════════════════════
async function loadJobsFromFirestore() {
    const container = document.getElementById('job-list-container');
    if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray);"><i class="ph ph-spinner" style="font-size:2rem;"></i><p style="margin-top:10px;">Loading jobs...</p></div>`;
    try {
        const snap = await getDocs(query(collection(db, "jobs"), orderBy("postedAt", "desc")));
        if (snap.empty) { container.innerHTML = getSampleJobsHTML(); return; }
        container.innerHTML = '';
        snap.forEach(d => {
            const job = d.data();
            container.innerHTML += buildJobCard(d.id, job);
        });
    } catch (e) {
        container.innerHTML = getSampleJobsHTML();
    }
}

function buildJobCard(id, job) {
    return `
        <div class="job-card" data-title="${job.title}" data-job-id="${id}">
            <div class="company-logo"><i class="ph-fill ph-buildings"></i></div>
            <div class="job-main">
                <h3>${job.title}</h3>
                <div class="job-tags">
                    <span><i class="ph-fill ph-map-pin"></i> ${job.location}</span>
                    <span><i class="ph-fill ph-buildings"></i> ${job.company}</span>
                </div>
                <p style="color:var(--gray);margin-top:10px;font-size:0.95rem;">${(job.description||'').substring(0,120)}...</p>
            </div>
            <div class="job-right">
                <span class="salary-range">${job.salary}</span>
                <button class="btn btn-gradient apply-btn" onclick="openApplyModal('${id}','${job.title.replace(/'/g,"\\'")}','${(job.postedBy||'')}')">Apply Now</button>
            </div>
        </div>`;
}

function getSampleJobsHTML() {
    return `
        <div class="job-card" data-title="Product Designer">
            <div class="company-logo" style="color:var(--accent);"><i class="ph-fill ph-dribbble-logo"></i></div>
            <div class="job-main"><h3>Senior Product Designer</h3><div class="job-tags"><span><i class="ph-fill ph-map-pin"></i> Remote</span><span><i class="ph-fill ph-clock"></i> Full Time</span></div><p style="color:var(--gray);margin-top:10px;font-size:0.95rem;">Join our design team to shape the future of digital experiences for millions of users worldwide.</p></div>
            <div class="job-right"><span class="salary-range">$120k - $140k</span><button class="btn btn-gradient apply-btn" onclick="openApplyModal('sample1','Senior Product Designer','')">Apply Now</button></div>
        </div>
        <div class="job-card" data-title="Frontend Developer">
            <div class="company-logo" style="color:#3b82f6;"><i class="ph-fill ph-code"></i></div>
            <div class="job-main"><h3>Frontend Developer (React)</h3><div class="job-tags"><span><i class="ph-fill ph-map-pin"></i> New York, USA</span><span><i class="ph-fill ph-clock"></i> Contract</span></div><p style="color:var(--gray);margin-top:10px;font-size:0.95rem;">Build cutting-edge web applications with modern React, TypeScript, and Next.js stack.</p></div>
            <div class="job-right"><span class="salary-range">$90k - $110k</span><button class="btn btn-gradient apply-btn" onclick="openApplyModal('sample2','Frontend Developer','')">Apply Now</button></div>
        </div>`;
}

// ════════════════════════════════════════════
//  APPLY FOR JOB (user.html)
// ════════════════════════════════════════════
window.openApplyModal = function(jobId, title, companyUid) {
    const user = requireAuthenticatedUser('apply for jobs');
    if (!user) return;

    document.getElementById('modalTitle').textContent = `Apply for: ${title}`;
    document.getElementById('applicantName').value  = user.displayName || '';
    document.getElementById('applicantEmail').value = user.email || '';
    window._applyJobId     = jobId;
    window._applyJobTitle  = title;
    window._applyCompanyUid = companyUid;
    openModal('applyModal');
};

window.handleApply = async function(e) {
    e.preventDefault();
    const user = requireAuthenticatedUser('apply for jobs');
    if (!user) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Submitting...'; btn.disabled = true;

    try {
        await addDoc(collection(db, "applications"), {
            jobId:          window._applyJobId || 'unknown',
            jobTitle:       window._applyJobTitle || 'Unknown',
            companyUid:     window._applyCompanyUid || '',
            applicantUid:   user.uid,
            applicantName:  document.getElementById('applicantName').value,
            applicantEmail: document.getElementById('applicantEmail').value,
            applicantPhoto: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName||'User')}&background=6366f1&color=fff`,
            coverLetter:    document.getElementById('coverLetter')?.value || '',
            status:         'pending',   // pending | accepted | rejected
            appliedAt:      serverTimestamp()
        });
        btn.innerHTML = '<i class="ph ph-check-circle"></i> Sent!';
        btn.style.background = 'var(--success)';
        setTimeout(() => {
            closeModal('applyModal');
            e.target.reset();
            btn.textContent = 'Submit Application';
            btn.style.background = ''; btn.disabled = false;
            showNotification('Application submitted!', 'success');
            loadUserApplications(user.uid);
        }, 1200);
    } catch (err) {
        showNotification('Failed to submit. Try again.', 'error');
        btn.textContent = 'Submit Application'; btn.disabled = false;
    }
};

// ════════════════════════════════════════════
//  USER — MY APPLICATIONS (real-time)
// ════════════════════════════════════════════
function loadUserApplications(uid) {
    const container = document.getElementById('user-applications-list');
    if (!container) return;

    const q = query(collection(db, "applications"), where("applicantUid","==", uid));
    onSnapshot(q, (snap) => {
        if (snap.empty) {
            container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--gray);"><i class="ph ph-file-text" style="font-size:4rem;margin-bottom:20px;display:block;opacity:0.4;"></i><p>You haven't applied to any jobs yet.</p></div>`;
            return;
        }
        const sortedApps = snap.docs.sort((a,b) => (b.data().appliedAt?.toMillis?.() || 0) - (a.data().appliedAt?.toMillis?.() || 0));
        container.innerHTML = '';
        sortedApps.forEach(d => {
            const app = d.data();
            const appId = d.id;
            const statusBadge = getStatusBadge(app.status);
            const chatBtn = app.status === 'accepted'
                ? `<button class="chat-open-btn" onclick="openChat('${appId}','${app.jobTitle.replace(/'/g,"\\'")}','${app.companyUid}','company')">
                       <i class="ph ph-chat-circle-dots"></i> Chat with Company
                   </button>`
                : '';
            container.innerHTML += `
                <div class="application-card">
                    <div class="job-icon"><i class="ph-fill ph-buildings"></i></div>
                    <div class="app-info">
                        <h4>${app.jobTitle}</h4>
                        <p>Applied ${formatTimeAgo(app.appliedAt)}</p>
                        ${app.coverLetter ? `<p style="margin-top:6px;font-size:0.82rem;color:var(--gray);">"${app.coverLetter.substring(0,80)}..."</p>` : ''}
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;">
                        ${statusBadge}
                        ${chatBtn}
                    </div>
                </div>`;
        });
    });
}

// ════════════════════════════════════════════
//  COMPANY — POST JOB
// ════════════════════════════════════════════
window.openPostJobModal = function() {
    const user = requireAuthenticatedUser('post jobs');
    if (!user) return;

    openModal('postJobModal');
};

window.handleJobPost = async function(e) {
    e.preventDefault();
    const user = requireAuthenticatedUser('post jobs');
    if (!user) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Posting...'; btn.disabled = true;

    try {
        await addDoc(collection(db, "jobs"), {
            title:       document.getElementById('jobTitle').value,
            company:     document.getElementById('jobCompany').value,
            location:    document.getElementById('jobLocation').value,
            salary:      document.getElementById('jobSalary').value,
            description: document.getElementById('jobDescription').value,
            postedBy:    user.uid,
            postedByName: user.displayName || user.email,
            postedAt:    serverTimestamp()
        });
        closeModal('postJobModal');
        e.target.reset();
        showNotification('Job posted successfully!', 'success');
        loadCompanyJobs(user.uid);
    } catch (err) {
        showNotification('Failed to post job.', 'error');
    } finally { btn.textContent = 'Post Job Now'; btn.disabled = false; }
};

// ════════════════════════════════════════════
//  COMPANY — MY POSTED JOBS (real-time)
// ════════════════════════════════════════════
function loadCompanyJobs(uid) {
    const container = document.getElementById('company-jobs-container');
    if (!container) return;

    const q = query(collection(db, "jobs"), where("postedBy","==",uid));
    onSnapshot(q, (snap) => {
        if (snap.empty) {
            container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--gray);"><i class="ph ph-briefcase" style="font-size:4rem;margin-bottom:20px;display:block;opacity:0.4;"></i><h3 style="color:var(--dark);margin-bottom:10px;">No Jobs Posted Yet</h3><button class="btn btn-gradient" onclick="openPostJobModal()">Post Your First Job</button></div>`;
            return;
        }
        const sortedJobs = snap.docs.sort((a,b) => (b.data().postedAt?.toMillis?.() || 0) - (a.data().postedAt?.toMillis?.() || 0));
        container.innerHTML = '';
        sortedJobs.forEach(d => {
            const job = d.data();
            container.innerHTML += `
                <div class="posted-job-card">
                    <div class="job-icon"><i class="ph-fill ph-briefcase"></i></div>
                    <div class="pj-info">
                        <h4>${job.title}</h4>
                        <p><i class="ph ph-map-pin"></i> ${job.location} &nbsp;·&nbsp; <i class="ph ph-currency-dollar"></i> ${job.salary}</p>
                        <p style="margin-top:4px;font-size:0.8rem;color:var(--gray);">Posted ${formatTimeAgo(job.postedAt)}</p>
                    </div>
                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                        <span class="applicant-count" id="count-${d.id}"><i class="ph ph-users"></i> Loading...</span>
                        <button onclick="deleteJob('${d.id}')" style="padding:8px 14px;border-radius:20px;border:none;background:rgba(239,68,68,0.1);color:#dc2626;font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">
                            <i class="ph ph-trash"></i> Delete
                        </button>
                    </div>
                </div>`;
            countApplications(d.id);
        });
    });
}

async function countApplications(jobId) {
    const el = document.getElementById(`count-${jobId}`);
    if (!el) return;
    const snap = await getDocs(query(collection(db, "applications"), where("jobId","==",jobId)));
    el.innerHTML = `<i class="ph ph-users"></i> ${snap.size} Applicant${snap.size !== 1 ? 's' : ''}`;
}

window.deleteJob = async function(jobId) {
    const user = requireAuthenticatedUser('delete jobs');
    if (!user) return;

    try {
        const job = await requireOwnedJob(jobId, user.uid);
        if (!job) return;
        if (!confirm(`Delete "${job.title}"? This cannot be undone.`)) return;

        await deleteDoc(doc(db, "jobs", jobId));
        showNotification('Job deleted.', 'success');
    } catch (e) { showNotification('Failed to delete.', 'error'); }
};

// ════════════════════════════════════════════
//  COMPANY — APPLICATIONS RECEIVED (real-time)
// ════════════════════════════════════════════
function loadCompanyApplications(uid) {
    const container = document.getElementById('company-applications-container');
    if (!container) return;

    const q = query(collection(db, "applications"), where("companyUid","==",uid));
    onSnapshot(q, (snap) => {
        if (snap.empty) {
            container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--gray);"><i class="ph ph-file-text" style="font-size:4rem;margin-bottom:20px;display:block;opacity:0.4;"></i><p>No applications yet. Post a job to receive applications.</p></div>`;
            return;
        }
        const sortedCompanyApps = snap.docs.sort((a,b) => (b.data().appliedAt?.toMillis?.() || 0) - (a.data().appliedAt?.toMillis?.() || 0));
        container.innerHTML = '';
        sortedCompanyApps.forEach(d => {
            const app = d.data();
            const appId = d.id;
            const statusBadge = getStatusBadge(app.status);

            const actionBtns = app.status === 'pending'
                ? `<button class="btn-accept" onclick="updateApplicationStatus('${appId}','accepted','${app.applicantUid}')"><i class="ph ph-check"></i> Accept</button>
                   <button class="btn-reject" onclick="updateApplicationStatus('${appId}','rejected','${app.applicantUid}')"><i class="ph ph-x"></i> Reject</button>`
                : '';

            const chatBtn = app.status === 'accepted'
                ? `<button class="chat-open-btn" onclick="openChat('${appId}','${app.jobTitle.replace(/'/g,"\\'")}','${app.applicantUid}','user')">
                       <i class="ph ph-chat-circle-dots"></i> Chat with Applicant
                   </button>`
                : '';

            container.innerHTML += `
                <div class="app-card">
                    <div class="app-card-top">
                        <img class="app-avatar" src="${app.applicantPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.applicantName)}&background=6366f1&color=fff`}" alt="${app.applicantName}" onerror="this.src='https://ui-avatars.com/api/?name=User&background=6366f1&color=fff'">
                        <div class="app-info">
                            <h4>${app.applicantName}</h4>
                            <p>${app.applicantEmail} &nbsp;·&nbsp; Applied for <strong>${app.jobTitle}</strong> &nbsp;·&nbsp; ${formatTimeAgo(app.appliedAt)}</p>
                        </div>
                        <div class="app-actions">
                            ${statusBadge}
                            ${actionBtns}
                            ${chatBtn}
                        </div>
                    </div>
                    ${app.coverLetter ? `<div class="cover-letter-text"><strong>Cover Letter:</strong> ${app.coverLetter}</div>` : ''}
                </div>`;
        });
    });
}

// ── Accept / Reject ──
window.updateApplicationStatus = async function(appId, status, applicantUid) {
    try {
        const user = requireAuthenticatedUser('review applications');
        if (!user) return;

        const application = await requireOwnedApplication(appId, user.uid);
        if (!application) return;

        await updateDoc(doc(db, "applications", appId), {
            status,
            reviewedAt: serverTimestamp()
        });
        const msg = status === 'accepted'
            ? '✅ Application accepted! Chat is now unlocked.'
            : '❌ Application rejected.';
        showNotification(msg, status === 'accepted' ? 'success' : 'info');
    } catch (e) { showNotification('Failed to update status.', 'error'); }
};

// ════════════════════════════════════════════
//  REAL-TIME CHAT
//  chatId = applicationId (same for both sides)
//  otherUid = uid of person you're chatting with
//  otherRole = 'company' or 'user' (who you're talking to)
// ════════════════════════════════════════════
window.openChat = function(chatId, jobTitle, otherUid, otherRole) {
    const user = requireAuthenticatedUser('chat');
    if (!user) return;

    // Remove existing chat if open
    closeChat();

    // Get other person's info
    getDoc(doc(db, "users", otherUid)).then(snap => {
        const other = snap.exists() ? snap.data() : { name: 'Unknown', photo: '' };
        renderChatBox(chatId, jobTitle, other, user);
        subscribeToChatMessages(chatId, user.uid);
    });
};

function renderChatBox(chatId, jobTitle, other, me) {
    const container = document.getElementById('chat-container');
    const photo = other.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(other.name||'?')}&background=6366f1&color=fff`;

    container.innerHTML = `
        <div class="chat-modal-overlay" id="chat-overlay">
            <div class="chat-box">
                <div class="chat-header">
                    <img src="${photo}" alt="${other.name}" onerror="this.src='https://ui-avatars.com/api/?name=User&background=6366f1&color=fff'">
                    <div>
                        <h4>${other.name || 'User'}</h4>
                        <small>Re: ${jobTitle}</small>
                    </div>
                    <button class="close-chat" onclick="closeChat()"><i class="ph ph-x"></i></button>
                </div>
                <div class="chat-messages" id="chat-messages">
                    <div style="text-align:center;color:#94a3b8;font-size:0.85rem;padding:20px 0;">
                        <i class="ph ph-chat-circle-dots" style="font-size:2rem;display:block;margin-bottom:8px;"></i>
                        Start the conversation!
                    </div>
                </div>
                <div class="chat-input-row">
                    <input type="text" id="chat-input" placeholder="Type a message..." onkeydown="if(event.key==='Enter') sendMessage('${chatId}')">
                    <button class="chat-send-btn" onclick="sendMessage('${chatId}')"><i class="ph ph-paper-plane-tilt"></i></button>
                </div>
            </div>
        </div>`;

    // Store chatId for later
    window._activeChatId = chatId;
    window._activeChatMyUid = me.uid;
}

function subscribeToChatMessages(chatId, myUid) {
    if (activeChatUnsub) activeChatUnsub();
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("sentAt", "asc"));
    activeChatUnsub = onSnapshot(q, (snap) => {
        const container = document.getElementById('chat-messages');
        if (!container) return;
        container.innerHTML = '';
        if (snap.empty) {
            container.innerHTML = `<div style="text-align:center;color:#94a3b8;font-size:0.85rem;padding:20px 0;"><i class="ph ph-chat-circle-dots" style="font-size:2rem;display:block;margin-bottom:8px;"></i>Start the conversation!</div>`;
            return;
        }
        snap.forEach(d => {
            const msg = d.data();
            const isMine = msg.senderUid === myUid;
            const time = msg.sentAt ? formatTimeAgo(msg.sentAt) : 'just now';
            container.innerHTML += `
                <div class="chat-msg ${isMine ? 'sent' : 'received'}">
                    <div>${msg.text}</div>
                    <div class="msg-time">${time}</div>
                </div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

window.sendMessage = async function(chatId) {
    const user  = requireAuthenticatedUser('send messages');
    const input = document.getElementById('chat-input');
    if (!user || !input || !input.value.trim()) return;

    const text = input.value.trim();
    input.value = '';
    try {
        await addDoc(collection(db, "chats", chatId, "messages"), {
            text,
            senderUid:  user.uid,
            senderName: user.displayName || user.email,
            sentAt:     serverTimestamp()
        });
        // Update chat metadata
        await setDoc(doc(db, "chats", chatId), {
            lastMessage: text,
            lastMessageAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (e) {
        showNotification('Failed to send message.', 'error');
    }
};

window.closeChat = function() {
    if (activeChatUnsub) { activeChatUnsub(); activeChatUnsub = null; }
    const container = document.getElementById('chat-container');
    if (container) container.innerHTML = '';
};

// ════════════════════════════════════════════
//  MEDIA GALLERY
// ════════════════════════════════════════════
async function loadMediaGallery() {
    const container = document.getElementById('media-gallery');
    if (!container) return;
    try {
        const snap = await getDocs(query(collection(db, "media"), orderBy("uploadedAt","desc")));
        if (snap.empty) {
            container.innerHTML = `<p style="color:var(--gray);text-align:center;grid-column:1/-1;">No media uploaded yet.</p>`;
            return;
        }
        container.innerHTML = '';
        snap.forEach(d => {
            const m = d.data();
            if (m.deleted) return;
            container.innerHTML += `
                <div class="media-card" data-media-id="${d.id}" style="border-radius:16px;overflow:hidden;background:white;box-shadow:0 4px 20px rgba(0,0,0,0.08);cursor:pointer;" onclick="viewMedia('${m.url}','${m.type}','${m.caption||''}','${m.uploaderName||'Unknown'}')">
                    ${m.type === 'image'
                        ? `<img src="${m.url}" style="width:100%;height:200px;object-fit:cover;" alt="${m.caption||''}">`
                        : `<video src="${m.url}" style="width:100%;height:200px;object-fit:cover;" muted></video>`}
                    <div style="padding:14px;">
                        <p style="font-weight:600;font-size:0.9rem;margin-bottom:4px;">${m.caption||'No caption'}</p>
                        <small style="color:var(--gray);">By ${m.uploaderName||'Unknown'}</small>
                    </div>
                </div>`;
        });
    } catch (e) { console.error('Media load error:', e); }
}

window.handleMediaUpload = async function(e) {
    e.preventDefault();
    const user = requireAuthenticatedUser('upload media');
    if (!user) return;

    const file    = document.getElementById('mediaFile').files[0];
    const caption = document.getElementById('mediaCaption').value;
    if (!file) return;

    const btn = e.target.querySelector('button[type="submit"]');
    btn.textContent = 'Uploading...'; btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY.uploadPreset);

        const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/auto/upload`, { method: 'POST', body: formData });
        const data = await res.json();

        await addDoc(collection(db, "media"), {
            url:          data.secure_url,
            type:         file.type.startsWith('video') ? 'video' : 'image',
            caption,
            uploadedBy:   user.uid,
            uploaderName: user.displayName || user.email,
            uploaderPhoto: user.photoURL || '',
            uploadedAt:   serverTimestamp()
        });

        closeModal('uploadModal');
        e.target.reset();
        showNotification('Media uploaded!', 'success');
        loadMediaGallery();
    } catch (err) {
        showNotification('Upload failed: ' + err.message, 'error');
    } finally { btn.textContent = 'Upload'; btn.disabled = false; }
};

window.viewMedia = function(url, type, caption, uploader) {
    const modal = document.createElement('div');
    modal.className = 'modal-wrap';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div style="background:white;border-radius:20px;padding:30px;max-width:700px;width:100%;position:relative;">
            <button onclick="this.closest('.modal-wrap').remove()" style="position:absolute;top:16px;right:16px;background:none;border:none;font-size:1.8rem;cursor:pointer;color:var(--gray);">&times;</button>
            ${type === 'image' ? `<img src="${url}" style="width:100%;border-radius:12px;max-height:500px;object-fit:contain;">` : `<video src="${url}" controls style="width:100%;border-radius:12px;"></video>`}
            <p style="margin-top:14px;font-weight:600;">${caption||'No caption'}</p>
            <small style="color:var(--gray);">Uploaded by ${uploader}</small>
        </div>`;
    document.body.appendChild(modal);
    modal.onclick = (ev) => { if (ev.target === modal) modal.remove(); };
};

// ════════════════════════════════════════════
//  MODALS
// ════════════════════════════════════════════
window.openModal = function(id) {
    const protectedAction = PROTECTED_MODAL_ACTIONS[id];
    if (protectedAction && !auth.currentUser) {
        requireAuthenticatedUser(protectedAction);
        return;
    }

    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (id === 'authModal') {
        toggleAuthMode('signin');
        document.getElementById('signinForm')?.reset();
        document.getElementById('signupForm')?.reset();
    }
};

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.style.display = 'none'; document.body.style.overflow = 'auto'; }
};

window.onclick = function(e) {
    if (e.target.classList.contains('modal-wrap')) {
        e.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

// ════════════════════════════════════════════
//  SEARCH JOBS
// ════════════════════════════════════════════
window.filterJobs = function() {
    const val = document.getElementById('jobSearch')?.value.toLowerCase() || '';
    document.querySelectorAll('.job-card').forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(val) ? 'grid' : 'none';
    });
    document.getElementById('jobs')?.scrollIntoView({ behavior: 'smooth' });
};

// ════════════════════════════════════════════
//  NAVBAR SCROLL
// ════════════════════════════════════════════
window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    if (window.scrollY > 50) {
        nav.style.padding = '12px 0'; nav.style.backdropFilter = 'blur(25px)';
        nav.style.background = 'rgba(255,255,255,0.96)'; nav.style.boxShadow = '0 5px 30px rgba(0,0,0,0.08)';
    } else {
        nav.style.padding = '18px 0'; nav.style.background = 'rgba(255,255,255,0.92)'; nav.style.boxShadow = 'none';
    }
});

// ════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════
function getStatusBadge(status) {
    const map = {
        pending:  `<span class="status-badge pending"><i class="ph ph-clock"></i> Pending</span>`,
        accepted: `<span class="status-badge accepted"><i class="ph ph-check-circle"></i> Accepted</span>`,
        rejected: `<span class="status-badge rejected"><i class="ph ph-x-circle"></i> Rejected</span>`
    };
    return map[status] || map['pending'];
}

function formatTimeAgo(timestamp) {
    if (!timestamp?.toDate) return 'recently';
    const seconds = Math.floor((new Date() - timestamp.toDate()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds/3600)}h ago`;
    return `${Math.floor(seconds/86400)}d ago`;
}

function initCounters() {
    document.querySelectorAll('.stat-item h3').forEach(el => {
        const target = parseInt(el.innerText);
        if (isNaN(target)) return;
        const step = target / 50;
        let current = 0;
        const tick = () => {
            if (current < target) { current += step; el.innerText = Math.ceil(current) + '+'; setTimeout(tick, 30); }
            else el.innerText = target + '+';
        };
        new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { tick(); } }).observe(el.parentElement);
    });
}

function showNotification(message, type = 'success') {
    const colors = { success:'#10b981', error:'#ef4444', info:'#3b82f6', warning:'#f59e0b' };
    const n = document.createElement('div');
    n.style.cssText = `position:fixed;top:100px;right:30px;background:${colors[type]};color:white;padding:15px 25px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.15);z-index:99999;font-weight:500;display:flex;align-items:center;gap:10px;max-width:360px;font-family:inherit;`;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => { n.style.opacity='0'; n.style.transition='opacity 0.3s'; setTimeout(() => n.remove(), 300); }, 4000);
}

// ── Dynamic styles injected ──
const style = document.createElement('style');
style.textContent = `
    .auth-toggle.active { background: white !important; box-shadow: 0 2px 8px rgba(0,0,0,0.1); color: var(--primary) !important; }
    .switch-role-btn { background:transparent;border:1px solid var(--primary);color:var(--primary);padding:8px 16px;border-radius:50px;font-size:0.85rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:all 0.3s;font-family:inherit; }
    .switch-role-btn:hover { background:rgba(99,102,241,0.1); }
    .application-card { background:white;border-radius:16px;padding:20px 24px;border:1px solid #e2e8f0;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap; }
    .application-card .job-icon { width:50px;height:50px;background:linear-gradient(135deg,#e0e7ff,#c7d2fe);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--primary);font-size:1.4rem;flex-shrink:0; }
    .application-card .app-info { flex:1; }
    .application-card .app-info h4 { font-size:1rem;margin-bottom:4px; }
    .application-card .app-info p { color:var(--gray);font-size:0.85rem; }
`;
document.head.appendChild(style);