import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    setDoc,
    doc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAD3xg3SZLQyv-Rf3rb4vw6-HVsZuZRD3E",
    authDomain: "jobsphere-ab925.firebaseapp.com",
    projectId: "jobsphere-ab925",
    storageBucket: "jobsphere-ab925.firebasestorage.app",
    messagingSenderId: "757724057808",
    appId: "1:757724057808:web:d46c8fbb78409abfef4ed5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

// Cloudinary Configuration
const CLOUDINARY_CONFIG = {
    cloudName: 'dsv4npqz3',
    uploadPreset: 'jobsphere_media',
    maxImageSize: 10485760,
    maxVideoSize: 52428800
};

let currentRole = null;

// Check for saved role on page load
const savedRole = localStorage.getItem('jobsphere_role');
if (savedRole) {
    currentRole = savedRole;
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('role-screen').style.display = 'none';
        document.getElementById('main-site').style.display = 'block';
        applyRoleUI(currentRole);
        AOS.init({ duration: 1000, once: true, offset: 50 });
        loadJobsFromFirestore();
        loadMediaGallery();
        initCounters();
    });
}

// ===== ROLE SELECTION FUNCTION =====
window.selectRole = async function(role) {
    currentRole = role;
    localStorage.setItem('jobsphere_role', role);
    
    document.getElementById('role-screen').style.display = 'none';
    document.getElementById('main-site').style.display = 'block';
    
    applyRoleUI(role);
    AOS.init({ duration: 1000, once: true, offset: 50 });
    await loadJobsFromFirestore();
    loadMediaGallery();
    initCounters();
    
    const user = auth.currentUser;
    if (user) {
        try {
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                role: role,
                lastLogin: serverTimestamp()
            }, { merge: true });
            updateUIForUser(user);
        } catch (error) {
            console.error('Error updating user role:', error);
        }
    }
    
    showNotification(`Switched to ${role === 'company' ? 'Company' : 'Job Seeker'} mode`, 'success');
}

// ===== APPLY ROLE UI FUNCTION =====
function applyRoleUI(role) {
    const postJobBtn = document.getElementById('navbar-post-job-btn');
    const navPostJob = document.getElementById('nav-post-job');
    const applyBtns = document.querySelectorAll('.apply-btn');
    const loginBtn = document.querySelector('.login-btn');
    const authButtons = document.querySelector('.auth-buttons');

    if (role === 'company') {
        if (postJobBtn) postJobBtn.style.display = 'inline-flex';
        if (navPostJob) navPostJob.style.display = 'inline-block';
        applyBtns.forEach(btn => btn.style.display = 'none');
        
        document.querySelectorAll('.job-card .btn-gradient').forEach(btn => {
            if (btn.classList.contains('apply-btn')) {
                btn.style.display = 'none';
            }
        });
        
        const postJobAuthBtn = document.querySelector('.auth-buttons .btn-gradient');
        if (postJobAuthBtn && postJobAuthBtn.innerText.includes('Post Job')) {
            postJobAuthBtn.style.display = 'inline-flex';
        }
    } else {
        if (postJobBtn) postJobBtn.style.display = 'none';
        if (navPostJob) navPostJob.style.display = 'none';
        applyBtns.forEach(btn => btn.style.display = 'inline-flex');
        
        document.querySelectorAll('.job-card .btn-gradient').forEach(btn => {
            if (btn.classList.contains('apply-btn')) {
                btn.style.display = 'inline-flex';
            }
        });
        
        const postJobAuthBtn = document.querySelector('.auth-buttons .btn-gradient');
        if (postJobAuthBtn && postJobAuthBtn.innerText.includes('Post Job')) {
            postJobAuthBtn.style.display = 'none';
        }
    }
    
    const user = auth.currentUser;
    if (user) {
        updateUIForUser(user);
    } else {
        if (loginBtn) {
            loginBtn.innerText = 'Sign In';
        }
    }
}

// ===== SWITCH ROLE FUNCTION =====
window.switchRole = function() {
    if (auth.currentUser) {
        if (confirm('Switching role will sign you out. Continue?')) {
            signOut(auth).then(() => {
                localStorage.removeItem('jobsphere_role');
                currentRole = null;
                document.getElementById('main-site').style.display = 'none';
                document.getElementById('role-screen').style.display = 'flex';
                showNotification('Signed out. Please select your new role.', 'info');
            }).catch(error => {
                console.error('Error signing out:', error);
                showNotification('Error signing out. Please try again.', 'error');
            });
        }
    } else {
        localStorage.removeItem('jobsphere_role');
        currentRole = null;
        document.getElementById('main-site').style.display = 'none';
        document.getElementById('role-screen').style.display = 'flex';
        showNotification('Please select your role', 'info');
    }
}

// ===== AUTH STATE OBSERVER =====
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            const roleFromStorage = localStorage.getItem('jobsphere_role');
            
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    name: user.displayName || user.email?.split('@')[0] || 'User',
                    email: user.email,
                    photo: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || 'User')}&background=6366f1&color=fff&size=128`,
                    role: roleFromStorage || currentRole || 'user',
                    createdAt: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    authProvider: user.providerData[0]?.providerId || 'unknown'
                });
                
                if (roleFromStorage) {
                    currentRole = roleFromStorage;
                }
            } else {
                const userData = userSnap.data();
                
                if (roleFromStorage && roleFromStorage !== userData.role) {
                    await setDoc(userRef, {
                        role: roleFromStorage,
                        lastLogin: serverTimestamp()
                    }, { merge: true });
                    currentRole = roleFromStorage;
                } else {
                    await setDoc(userRef, {
                        lastLogin: serverTimestamp()
                    }, { merge: true });
                    
                    if (!currentRole && userData.role) {
                        currentRole = userData.role;
                        localStorage.setItem('jobsphere_role', currentRole);
                    }
                }
            }
        } catch (error) {
            console.error('Error updating user document:', error);
        }
        
        updateUIForUser(user);
        
        if (currentRole) {
            applyRoleUI(currentRole);
        }
        
        loadJobsFromFirestore();
    } else {
        updateUIForUser(null);
    }
});

// ===== GOOGLE SIGN IN =====
window.googleSignIn = async function() {
    try {
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        const btn = document.querySelector('.google-btn');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Connecting...';
        btn.disabled = true;
        
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        const selectedRole = currentRole || localStorage.getItem('jobsphere_role') || 'user';
        
        if (!userSnap.exists()) {
            await setDoc(userRef, {
                uid: user.uid,
                name: user.displayName || user.email?.split('@')[0] || 'User',
                email: user.email,
                photo: user.photoURL,
                role: selectedRole,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp(),
                authProvider: 'google'
            });
            
            showNotification('Account created successfully! Welcome to JobSphere!', 'success');
        } else {
            await setDoc(userRef, {
                lastLogin: serverTimestamp()
            }, { merge: true });
            
            const savedRole = localStorage.getItem('jobsphere_role');
            if (savedRole && savedRole !== userSnap.data().role) {
                await setDoc(userRef, {
                    role: savedRole
                }, { merge: true });
                currentRole = savedRole;
            }
            
            showNotification(`Welcome back, ${user.displayName || 'User'}!`, 'success');
        }

        closeModal('authModal');
        
        if (currentRole) {
            applyRoleUI(currentRole);
        }
        
        loadJobsFromFirestore();
    } catch (error) {
        console.error('Google sign-in error:', error);
        
        switch (error.code) {
            case 'auth/unauthorized-domain':
                showNotification(`Please add "${window.location.hostname}" to Firebase authorized domains`, 'error');
                break;
            case 'auth/popup-closed-by-user':
                showNotification('Sign-in cancelled', 'info');
                break;
            case 'auth/popup-blocked':
                showNotification('Pop-up was blocked. Please allow pop-ups for this site.', 'error');
                break;
            case 'auth/cancelled-popup-request':
                break;
            case 'auth/account-exists-with-different-credential':
                showNotification('An account already exists with the same email address but different sign-in credentials. Please sign in with email/password.', 'error');
                break;
            default:
                showNotification(error.message, 'error');
        }
    } finally {
        const btn = document.querySelector('.google-btn');
        if (btn) {
            btn.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
            `;
            btn.disabled = false;
        }
    }
}

// ===== EMAIL/PASSWORD SIGN IN =====
window.handleSignIn = async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('signinEmail').value;
    const password = document.getElementById('signinPassword').value;
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    btn.innerText = 'Signing In...';
    btn.disabled = true;

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            await setDoc(userRef, {
                lastLogin: serverTimestamp()
            }, { merge: true });
            
            const savedRole = localStorage.getItem('jobsphere_role');
            if (savedRole && savedRole !== userSnap.data().role) {
                await setDoc(userRef, {
                    role: savedRole
                }, { merge: true });
                currentRole = savedRole;
            }
        }

        showNotification('Signed in successfully!', 'success');
        closeModal('authModal');
        e.target.reset();
        
        if (currentRole) {
            applyRoleUI(currentRole);
        }
        
        loadJobsFromFirestore();
    } catch (error) {
        console.error('Sign-in error:', error);
        let message = 'Failed to sign in. ';
        switch (error.code) {
            case 'auth/invalid-credential':
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                message = 'Invalid email or password.';
                break;
            case 'auth/user-disabled':
                message = 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many failed attempts. Try again later.';
                break;
            default:
                message = error.message;
        }
        showNotification(message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ===== EMAIL/PASSWORD SIGN UP =====
window.handleSignUp = async function(e) {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    btn.innerText = 'Creating Account...';
    btn.disabled = true;

    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;

        await updateProfile(user, {
            displayName: name
        });

        const selectedRole = currentRole || localStorage.getItem('jobsphere_role') || 'user';

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=128`,
            role: selectedRole,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            authProvider: 'email'
        });

        showNotification('Account created successfully!', 'success');
        closeModal('authModal');
        e.target.reset();
        
        if (currentRole) {
            applyRoleUI(currentRole);
        }
        
        loadJobsFromFirestore();
    } catch (error) {
        console.error('Sign-up error:', error);
        let message = 'Failed to create account. ';
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'Email already in use. Please sign in instead.';
                toggleAuthMode('signin');
                document.getElementById('signinEmail').value = email;
                break;
            case 'auth/invalid-email':
                message = 'Invalid email address.';
                break;
            case 'auth/weak-password':
                message = 'Password is too weak.';
                break;
            default:
                message = error.message;
        }
        showNotification(message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ===== FORGOT PASSWORD =====
window.showForgotPassword = function() {
    closeModal('authModal');
    openModal('forgotPasswordModal');
}

window.handleForgotPassword = async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgotEmail').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    if (!email || !email.includes('@') || !email.includes('.')) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    btn.innerText = 'Sending...';
    btn.disabled = true;

    try {
        const actionCodeSettings = {
            url: window.location.origin,
            handleCodeInApp: false
        };
        
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
        
        showNotification(
            '✅ Password reset email sent! Please check:\n\n' +
            '1. Your inbox\n' +
            '2. Spam/Junk folder\n' +
            '3. Promotions tab (Gmail)\n\n' +
            'Email from: noreply@jobsphere-ab925.firebaseapp.com', 
            'success'
        );
        
        setTimeout(() => {
            closeModal('forgotPasswordModal');
            e.target.reset();
            
            showNotification(
                '📧 Email sent to ' + email + '. Check spam if not in inbox.', 
                'info'
            );
        }, 3000);
    } catch (error) {
        console.error('Password reset error details:', error);
        
        let message = '';
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No account found with this email. Please sign up first.';
                setTimeout(() => {
                    if (confirm('No account found. Would you like to sign up instead?')) {
                        closeModal('forgotPasswordModal');
                        openModal('authModal');
                        toggleAuthMode('signup');
                        document.getElementById('signupEmail').value = email;
                    }
                }, 1000);
                break;
            case 'auth/invalid-email':
                message = 'Please enter a valid email address.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many requests. Please try again in a few minutes.';
                break;
            case 'auth/unauthorized-continue-uri':
                message = 'Configuration error. Please contact support.';
                break;
            default:
                message = `Error: ${error.message}`;
        }
        showNotification(message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ===== TOGGLE AUTH MODE =====
window.toggleAuthMode = function(mode) {
    const signinForm = document.getElementById('signinForm');
    const signupForm = document.getElementById('signupForm');
    const signinToggle = document.getElementById('signinToggle');
    const signupToggle = document.getElementById('signupToggle');
    const modalTitle = document.getElementById('authModalTitle');

    if (mode === 'signin') {
        signinForm.style.display = 'block';
        signupForm.style.display = 'none';
        signinToggle.classList.add('active');
        signupToggle.classList.remove('active');
        modalTitle.innerText = 'Sign In';
    } else {
        signinForm.style.display = 'none';
        signupForm.style.display = 'block';
        signinToggle.classList.remove('active');
        signupToggle.classList.add('active');
        modalTitle.innerText = 'Create Account';
    }
}

// ===== SIGN OUT =====
window.googleSignOut = async function() {
    try {
        await signOut(auth);
        localStorage.removeItem('jobsphere_role');
        currentRole = null;
        document.getElementById('main-site').style.display = 'none';
        document.getElementById('role-screen').style.display = 'flex';
        showNotification('Signed out successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// ===== UPDATE UI BASED ON USER STATE =====
function updateUIForUser(user) {
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;

    if (user) {
        const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || 'User')}&background=6366f1&color=fff&size=128`;
        const displayName = user.displayName || user.email?.split('@')[0] || 'User';
        const email = user.email || '';
        const roleBadge = currentRole === 'company'
            ? `<span class="role-badge company">Company</span>`
            : `<span class="role-badge user">Job Seeker</span>`;
        
        let dropdownItems = '';
        
        if (currentRole === 'company') {
            dropdownItems = `
                <a href="#" onclick="openModal('postJobModal')"><i class="ph ph-briefcase" style="margin-right:8px;"></i>Post a Job</a>
                <a href="#" onclick="openModal('uploadModal')"><i class="ph ph-image" style="margin-right:8px;"></i>Upload Media</a>
            `;
        } else {
            dropdownItems = `
                <a href="#" onclick="openProfileModal()"><i class="ph ph-user" style="margin-right:8px;"></i>My Profile</a>
                <a href="#" onclick="openModal('savedJobsModal'); loadSavedJobs()"><i class="ph ph-bookmark-simple" style="margin-right:8px;"></i>Saved Jobs</a>
                <a href="#" onclick="openModal('applicationsModal'); loadApplications()"><i class="ph ph-file-text" style="margin-right:8px;"></i>My Applications</a>
                <a href="#" onclick="openModal('jobAlertsModal')"><i class="ph ph-bell" style="margin-right:8px;"></i>Job Alerts</a>
                <a href="#" onclick="openModal('skillAssessmentModal')"><i class="ph ph-certificate" style="margin-right:8px;"></i>Skill Assessments</a>
                <a href="#" onclick="openModal('uploadModal')"><i class="ph ph-image" style="margin-right:8px;"></i>Upload Media</a>
            `;
        }

        authButtons.innerHTML = `
            <button class="switch-role-btn" onclick="switchRole()">
                <i class="ph ph-arrows-left-right"></i>
                <span>Switch Role</span>
            </button>
            <div class="user-menu">
                ${roleBadge}
                <img src="${photoURL}" alt="${displayName}" class="user-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&size=128'">
                <div class="user-dropdown">
                    <div class="user-info">
                        <img src="${photoURL}" alt="${displayName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&size=128'">
                        <strong>${displayName}</strong>
                        <small>${email}</small>
                    </div>
                    <div class="dropdown-divider"></div>
                    ${dropdownItems}
                    <div class="dropdown-divider"></div>
                    <a href="#" onclick="googleSignOut()"><i class="ph ph-sign-out" style="margin-right:8px;"></i>Sign Out</a>
                </div>
            </div>
            ${currentRole === 'company' ? `<button class="btn btn-gradient" onclick="openModal('postJobModal')">Post Job</button>` : ''}
        `;
    } else {
        authButtons.innerHTML = `
            <button class="switch-role-btn" onclick="switchRole()">
                <i class="ph ph-arrows-left-right"></i>
                <span>Switch Role</span>
            </button>
            <button class="btn btn-outline login-btn" onclick="openModal('authModal')">Sign In</button>
            ${currentRole === 'company' ? `<button class="btn btn-gradient" onclick="openModal('postJobModal')">Post Job</button>` : ''}
        `;
    }
}

// ===== SCROLL EFFECT FOR NAVBAR =====
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    if (window.scrollY > 50) {
        navbar.style.padding = '12px 0';
        navbar.style.backdropFilter = 'blur(25px)';
        navbar.style.background = 'rgba(255, 255, 255, 0.96)';
        navbar.style.boxShadow = '0 5px 30px rgba(0, 0, 0, 0.08)';
    } else {
        navbar.style.padding = '18px 0';
        navbar.style.background = 'rgba(255, 255, 255, 0.92)';
        navbar.style.boxShadow = 'none';
    }
});

// ===== MODAL FUNCTIONS =====
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        if (modalId === 'authModal') {
            toggleAuthMode('signin');
            document.getElementById('signinForm')?.reset();
            document.getElementById('signupForm')?.reset();
        } else if (modalId === 'profileModal') {
            openProfileModal();
        }
    }
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal-wrap')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// ===== JOB SEARCH FILTER =====
window.filterJobs = function() {
    const input = document.getElementById('jobSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.job-card');
    cards.forEach(card => {
        const title = card.getAttribute('data-title')?.toLowerCase() || '';
        const text = card.innerText.toLowerCase();
        card.style.display = (title.includes(input) || text.includes(input)) ? "grid" : "none";
    });
    document.getElementById('jobs').scrollIntoView({ behavior: 'smooth' });
}

// ===== OPEN APPLY MODAL =====
window.openApplyModal = function(title) {
    if (currentRole === 'company') {
        showNotification('Companies cannot apply for jobs', 'info');
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        showNotification('Please sign in to apply for jobs', 'info');
        openModal('authModal');
        return;
    }

    const modalTitle = document.getElementById('modalTitle');
    const nameInput = document.getElementById('applicantName');
    const emailInput = document.getElementById('applicantEmail');
    
    if (modalTitle) modalTitle.innerText = "Apply for: " + title;
    if (nameInput) nameInput.value = user.displayName || '';
    if (emailInput) emailInput.value = user.email || '';
    
    window._currentJobTitle = title;
    openModal('applyModal');
}

// ===== HANDLE JOB APPLICATION =====
window.handleApply = async function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const original = btn.innerText;
    const user = auth.currentUser;

    btn.innerText = "Submitting...";
    btn.disabled = true;

    try {
        await addDoc(collection(db, "applications"), {
            jobTitle: window._currentJobTitle || "Unknown",
            applicantName: document.getElementById('applicantName').value,
            applicantEmail: document.getElementById('applicantEmail').value,
            coverLetter: e.target.querySelector('textarea').value,
            userId: user ? user.uid : null,
            status: 'Applied',
            appliedAt: serverTimestamp()
        });

        btn.innerHTML = '<i class="ph ph-check-circle"></i> Application Sent!';
        btn.style.background = 'var(--success)';

        setTimeout(() => {
            closeModal('applyModal');
            e.target.reset();
            btn.innerHTML = original;
            btn.style.background = '';
            btn.disabled = false;
            showNotification('Application submitted successfully!', 'success');
        }, 1500);
    } catch (error) {
        console.error('Application error:', error);
        showNotification('Failed to submit. Try again.', 'error');
        btn.innerText = original;
        btn.disabled = false;
    }
}

// ===== POST JOB =====
window.handleJobPost = async function(e) {
    e.preventDefault();
    const user = auth.currentUser;

    if (!user) {
        showNotification('Please sign in to post a job', 'info');
        closeModal('postJobModal');
        openModal('authModal');
        return;
    }

    if (currentRole !== 'company') {
        showNotification('Only companies can post jobs', 'error');
        return;
    }

    const inputs = e.target.querySelectorAll('input, textarea');
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = 'Posting...';
    btn.disabled = true;

    try {
        await addDoc(collection(db, "jobs"), {
            title: inputs[0].value,
            company: inputs[1].value,
            location: inputs[2].value,
            salary: inputs[3].value,
            description: inputs[4].value,
            postedBy: user.uid,
            postedByName: user.displayName,
            postedAt: serverTimestamp()
        });

        showNotification('Job posted successfully!', 'success');
        closeModal('postJobModal');
        e.target.reset();
        loadJobsFromFirestore();
    } catch (error) {
        console.error('Job post error:', error);
        showNotification('Failed to post job. Try again.', 'error');
    } finally {
        btn.innerText = 'Post Job Now';
        btn.disabled = false;
    }
}

// ===== LOAD JOBS FROM FIRESTORE =====
async function loadJobsFromFirestore() {
    const container = document.getElementById('job-list-container');
    if (!container) return;

    try {
        const q = query(collection(db, "jobs"), orderBy("postedAt", "desc"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            container.innerHTML = getSampleJobsHTML();
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(docSnap => {
            const job = docSnap.data();
            const jobId = docSnap.id;
            
            const showApplyButton = currentRole !== 'company';
            
            const applyBtn = showApplyButton
                ? `<button class="btn btn-gradient apply-btn" onclick="openApplyModal('${job.title.replace(/'/g, "\\'")}')">Apply Now</button>`
                : '';

            const saveBtn = showApplyButton && auth.currentUser
                ? `<button class="btn btn-outline save-btn" onclick="saveJob('${jobId}', '${job.title.replace(/'/g, "\\'")}')" style="margin-right: 10px;"><i class="ph ph-bookmark-simple"></i> Save</button>`
                : '';

            container.innerHTML += `
                <div class="job-card" data-title="${job.title}" data-job-id="${jobId}">
                    <div class="company-logo">
                        <i class="ph-fill ph-buildings"></i>
                    </div>
                    <div class="job-main">
                        <h3>${job.title}</h3>
                        <div class="job-tags">
                            <span><i class="ph-fill ph-map-pin"></i> ${job.location}</span>
                            <span><i class="ph-fill ph-buildings"></i> ${job.company}</span>
                        </div>
                        <p style="color: var(--gray); margin-top: 10px; font-size: 0.95rem;">${job.description.substring(0, 120)}...</p>
                    </div>
                    <div class="job-right">
                        <span class="salary-range">${job.salary}</span>
                        <div style="display: flex; gap: 10px;">
                            ${saveBtn}
                            ${applyBtn}
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error('Error loading jobs:', error);
        container.innerHTML = getSampleJobsHTML();
    }
}

// ===== SAMPLE JOBS HTML =====
function getSampleJobsHTML() {
    const showApplyButton = currentRole !== 'company';
    const applyButtonHTML = showApplyButton 
        ? '<button class="btn btn-gradient apply-btn" onclick="openApplyModal(\'Senior Product Designer\')">Apply Now</button>'
        : '';
    const saveButtonHTML = showApplyButton && auth.currentUser
        ? '<button class="btn btn-outline save-btn" onclick="saveJob(\'sample1\', \'Senior Product Designer\')"><i class="ph ph-bookmark-simple"></i> Save</button>'
        : '';
    
    return `
        <div class="job-card" data-title="Product Designer">
            <div class="company-logo" style="color: var(--accent);">
                <i class="ph-fill ph-dribbble-logo"></i>
            </div>
            <div class="job-main">
                <h3>Senior Product Designer</h3>
                <div class="job-tags">
                    <span><i class="ph-fill ph-map-pin"></i> Remote</span>
                    <span><i class="ph-fill ph-clock"></i> Full Time</span>
                    <span><i class="ph-fill ph-calendar"></i> 2 days ago</span>
                </div>
                <p style="color: var(--gray); margin-top: 10px; font-size: 0.95rem;">Join our design team to shape the future of digital experiences for millions of users worldwide.</p>
            </div>
            <div class="job-right">
                <span class="salary-range">$120k - $140k</span>
                <div style="display: flex; gap: 10px;">
                    ${saveButtonHTML}
                    ${applyButtonHTML}
                </div>
            </div>
        </div>

        <div class="job-card" data-title="Frontend Developer">
            <div class="company-logo" style="color: #3b82f6;">
                <i class="ph-fill ph-behance-logo"></i>
            </div>
            <div class="job-main">
                <h3>Frontend Developer (React)</h3>
                <div class="job-tags">
                    <span><i class="ph-fill ph-map-pin"></i> New York, USA</span>
                    <span><i class="ph-fill ph-clock"></i> Contract</span>
                    <span><i class="ph-fill ph-calendar"></i> 5 hours ago</span>
                </div>
                <p style="color: var(--gray); margin-top: 10px; font-size: 0.95rem;">Build cutting-edge web applications with modern React, TypeScript, and Next.js stack.</p>
            </div>
            <div class="job-right">
                <span class="salary-range">$90k - $110k</span>
                <div style="display: flex; gap: 10px;">
                    ${saveButtonHTML.replace('Senior Product Designer', 'Frontend Developer')}
                    ${applyButtonHTML.replace('Senior Product Designer', 'Frontend Developer')}
                </div>
            </div>
        </div>

        <div class="job-card" data-title="Marketing Manager">
            <div class="company-logo" style="color: var(--success);">
                <i class="ph-fill ph-spotify-logo"></i>
            </div>
            <div class="job-main">
                <h3>Marketing Growth Manager</h3>
                <div class="job-tags">
                    <span><i class="ph-fill ph-map-pin"></i> London, UK</span>
                    <span><i class="ph-fill ph-clock"></i> Full Time</span>
                    <span><i class="ph-fill ph-calendar"></i> 1 week ago</span>
                </div>
                <p style="color: var(--gray); margin-top: 10px; font-size: 0.95rem;">Drive user acquisition and retention through innovative marketing strategies.</p>
            </div>
            <div class="job-right">
                <span class="salary-range">$70k - $95k</span>
                <div style="display: flex; gap: 10px;">
                    ${saveButtonHTML.replace('Senior Product Designer', 'Marketing Manager')}
                    ${applyButtonHTML.replace('Senior Product Designer', 'Marketing Manager')}
                </div>
            </div>
        </div>
    `;
}

// ===== PROFILE MANAGEMENT =====

window.openProfileModal = function() {
    const user = auth.currentUser;
    if (!user) {
        showNotification('Please sign in to create your profile', 'info');
        openModal('authModal');
        return;
    }

    if (currentRole === 'company') {
        showNotification('Company accounts cannot create job seeker profiles', 'info');
        return;
    }

    loadUserProfile();
    openModal('profileModal');
}

async function loadUserProfile() {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const userRef = doc(db, "userProfiles", user.uid);
        const userSnap = await getDoc(userRef);

        // Clear existing dynamic fields
        document.getElementById('workExperienceContainer').innerHTML = '';
        document.getElementById('educationContainer').innerHTML = '';
        document.getElementById('languagesContainer').innerHTML = '';
        document.getElementById('certificationsContainer').innerHTML = '';

        if (userSnap.exists()) {
            const data = userSnap.data();
            
            document.getElementById('fullName').value = data.fullName || '';
            document.getElementById('phoneNumber').value = data.phoneNumber || '';
            document.getElementById('profileEmail').value = user.email || '';
            document.getElementById('location').value = data.location || '';
            document.getElementById('dob').value = data.dob || '';
            document.getElementById('summary').value = data.summary || '';
            document.getElementById('skills').value = data.skills ? data.skills.join(', ') : '';
            document.getElementById('linkedin').value = data.linkedin || '';
            document.getElementById('github').value = data.github || '';
            document.getElementById('portfolio').value = data.portfolio || '';
            document.getElementById('desiredTitle').value = data.desiredTitle || '';
            document.getElementById('employmentType').value = data.employmentType || '';
            document.getElementById('expectedSalary').value = data.expectedSalary || '';

            if (data.workExperience && data.workExperience.length > 0) {
                data.workExperience.forEach(exp => addWorkExperience(exp));
            } else {
                addWorkExperience();
            }

            if (data.education && data.education.length > 0) {
                data.education.forEach(edu => addEducation(edu));
            } else {
                addEducation();
            }

            if (data.languages && data.languages.length > 0) {
                data.languages.forEach(lang => addLanguage(lang));
            } else {
                addLanguage();
            }

            if (data.certifications && data.certifications.length > 0) {
                data.certifications.forEach(cert => addCertification(cert));
            }

            if (data.photoURL) {
                document.getElementById('profilePhotoPreview').src = data.photoURL;
            }

            if (data.resumeURL) {
                document.getElementById('resumeInfo').style.display = 'block';
                document.getElementById('resumeName').textContent = data.resumeName || 'Resume uploaded';
            }

            calculateProfileStrength(data);
        } else {
            addWorkExperience();
            addEducation();
            addLanguage();
            calculateProfileStrength({});
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Error loading profile', 'error');
    }
}

function calculateProfileStrength(data = {}) {
    let strength = 0;
    const totalFields = 12;
    let completed = 0;

    const fields = [
        data.fullName, data.phoneNumber, data.location, data.summary,
        data.skills, data.workExperience, data.education, data.languages,
        data.desiredTitle, data.employmentType, data.expectedSalary, data.resumeURL
    ];

    fields.forEach(field => {
        if (field && (Array.isArray(field) ? field.length > 0 : true)) {
            completed++;
        }
    });

    strength = Math.round((completed / totalFields) * 100);
    
    const strengthElement = document.getElementById('profileStrength');
    const progressElement = document.getElementById('profileProgress');
    
    if (strengthElement) strengthElement.textContent = strength + '%';
    if (progressElement) progressElement.style.width = strength + '%';

    const tips = document.getElementById('profileTips');
    if (tips) {
        if (strength < 100) {
            tips.innerHTML = getProfileTips(data);
        } else {
            tips.innerHTML = '<span>✨ Perfect profile! You\'re ready to apply!</span>';
        }
    }
}

function getProfileTips(data) {
    const tips = [];
    if (!data.fullName) tips.push('📝 Add your full name');
    if (!data.phoneNumber) tips.push('📱 Add your phone number');
    if (!data.location) tips.push('📍 Add your location');
    if (!data.summary) tips.push('✍️ Write a professional summary');
    if (!data.skills || data.skills.length === 0) tips.push('💡 Add your skills');
    if (!data.workExperience || data.workExperience.length === 0) tips.push('💼 Add work experience');
    if (!data.education || data.education.length === 0) tips.push('🎓 Add your education');
    if (!data.languages || data.languages.length === 0) tips.push('🗣️ Add languages');
    if (!data.desiredTitle) tips.push('🎯 Add desired job title');
    if (!data.employmentType) tips.push('⚡ Select employment type');
    if (!data.expectedSalary) tips.push('💰 Add expected salary');
    if (!data.resumeURL) tips.push('📄 Upload your resume');

    return tips.map(tip => `<span>${tip}</span>`).join(' ');
}

window.previewProfilePhoto = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profilePhotoPreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

window.addWorkExperience = function(data = null) {
    const container = document.getElementById('workExperienceContainer');
    const id = 'work_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const html = `
        <div id="${id}" class="dynamic-field" style="background: white; padding: 20px; border-radius: var(--radius-md); margin-bottom: 15px; position: relative;">
            <button type="button" onclick="removeField('${id}')" class="remove-field" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--gray); cursor: pointer; font-size: 1.2rem;">&times;</button>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <input type="text" placeholder="Job Title" value="${data?.title || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="Company" value="${data?.company || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="Location" value="${data?.location || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="Start Date" value="${data?.startDate || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="End Date" value="${data?.endDate || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <textarea placeholder="Description" rows="2" style="grid-column: 1/-1; padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">${data?.description || ''}</textarea>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

window.addEducation = function(data = null) {
    const container = document.getElementById('educationContainer');
    const id = 'edu_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const html = `
        <div id="${id}" class="dynamic-field" style="background: white; padding: 20px; border-radius: var(--radius-md); margin-bottom: 15px; position: relative;">
            <button type="button" onclick="removeField('${id}')" class="remove-field" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--gray); cursor: pointer; font-size: 1.2rem;">&times;</button>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <input type="text" placeholder="Degree" value="${data?.degree || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="Institution" value="${data?.institution || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="Field of Study" value="${data?.field || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="Graduation Year" value="${data?.year || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

window.addLanguage = function(data = null) {
    const container = document.getElementById('languagesContainer');
    const id = 'lang_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const html = `
        <div id="${id}" style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
            <input type="text" placeholder="Language" value="${data?.language || ''}" style="flex: 2; padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
            <select style="flex: 1; padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <option value="basic" ${data?.proficiency === 'basic' ? 'selected' : ''}>Basic</option>
                <option value="conversational" ${data?.proficiency === 'conversational' ? 'selected' : ''}>Conversational</option>
                <option value="professional" ${data?.proficiency === 'professional' ? 'selected' : ''}>Professional</option>
                <option value="native" ${data?.proficiency === 'native' ? 'selected' : ''}>Native</option>
            </select>
            <button type="button" onclick="removeField('${id}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1.2rem;">&times;</button>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

window.addCertification = function(data = null) {
    const container = document.getElementById('certificationsContainer');
    const id = 'cert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const html = `
        <div id="${id}" class="dynamic-field" style="background: white; padding: 20px; border-radius: var(--radius-md); margin-bottom: 15px; position: relative;">
            <button type="button" onclick="removeField('${id}')" class="remove-field" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: var(--gray); cursor: pointer; font-size: 1.2rem;">&times;</button>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <input type="text" placeholder="Certification Name" value="${data?.name || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="Issuing Organization" value="${data?.issuer || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="Issue Date" value="${data?.issueDate || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
                <input type="text" placeholder="Expiration Date" value="${data?.expiryDate || ''}" style="padding: 12px; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px;">
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

window.removeField = function(id) {
    document.getElementById(id)?.remove();
}

window.handleProfileSave = async function(e) {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
        showNotification('Please sign in to save your profile', 'info');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...';
    btn.disabled = true;

    try {
        const workExperience = [];
        document.querySelectorAll('#workExperienceContainer > div').forEach(div => {
            const inputs = div.querySelectorAll('input, textarea');
            if (inputs[0]?.value) {
                workExperience.push({
                    title: inputs[0]?.value || '',
                    company: inputs[1]?.value || '',
                    location: inputs[2]?.value || '',
                    startDate: inputs[3]?.value || '',
                    endDate: inputs[4]?.value || '',
                    description: inputs[5]?.value || ''
                });
            }
        });

        const education = [];
        document.querySelectorAll('#educationContainer > div').forEach(div => {
            const inputs = div.querySelectorAll('input');
            if (inputs[0]?.value) {
                education.push({
                    degree: inputs[0]?.value || '',
                    institution: inputs[1]?.value || '',
                    field: inputs[2]?.value || '',
                    year: inputs[3]?.value || ''
                });
            }
        });

        const languages = [];
        document.querySelectorAll('#languagesContainer > div').forEach(div => {
            const inputs = div.querySelectorAll('input, select');
            if (inputs[0]?.value) {
                languages.push({
                    language: inputs[0]?.value || '',
                    proficiency: inputs[1]?.value || ''
                });
            }
        });

        const certifications = [];
        document.querySelectorAll('#certificationsContainer > div').forEach(div => {
            const inputs = div.querySelectorAll('input');
            if (inputs[0]?.value) {
                certifications.push({
                    name: inputs[0]?.value || '',
                    issuer: inputs[1]?.value || '',
                    issueDate: inputs[2]?.value || '',
                    expiryDate: inputs[3]?.value || ''
                });
            }
        });

        const skillsInput = document.getElementById('skills').value;
        const skills = skillsInput.split(',').map(s => s.trim()).filter(s => s);

        const profileData = {
            fullName: document.getElementById('fullName').value,
            phoneNumber: document.getElementById('phoneNumber').value,
            location: document.getElementById('location').value,
            dob: document.getElementById('dob').value,
            summary: document.getElementById('summary').value,
            workExperience: workExperience,
            education: education,
            skills: skills,
            languages: languages,
            certifications: certifications,
            linkedin: document.getElementById('linkedin').value,
            github: document.getElementById('github').value,
            portfolio: document.getElementById('portfolio').value,
            desiredTitle: document.getElementById('desiredTitle').value,
            employmentType: document.getElementById('employmentType').value,
            expectedSalary: document.getElementById('expectedSalary').value,
            updatedAt: serverTimestamp()
        };

        const photoFile = document.getElementById('profilePhoto').files[0];
        if (photoFile) {
            profileData.photoURL = document.getElementById('profilePhotoPreview').src;
        }

        const resumeFile = document.getElementById('resumeFile').files[0];
        if (resumeFile) {
            profileData.resumeName = resumeFile.name;
            profileData.resumeURL = URL.createObjectURL(resumeFile);
        }

        await setDoc(doc(db, "userProfiles", user.uid), profileData, { merge: true });

        btn.innerHTML = '<i class="ph ph-check-circle"></i> Saved!';
        btn.style.background = 'var(--success)';

        setTimeout(() => {
            closeModal('profileModal');
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.disabled = false;
            showNotification('Profile saved successfully!', 'success');
        }, 1500);
    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Failed to save profile. Please try again.', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ===== JOB ALERTS =====

window.handleJobAlert = async function(e) {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
        showNotification('Please sign in to create job alerts', 'info');
        return;
    }

    const inputs = e.target.querySelectorAll('input, select');
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Creating...';
    btn.disabled = true;

    try {
        await addDoc(collection(db, "jobAlerts"), {
            name: inputs[0].value,
            keywords: inputs[1].value,
            location: inputs[2].value,
            frequency: inputs[3].value,
            userId: user.uid,
            userEmail: user.email,
            createdAt: serverTimestamp(),
            active: true
        });

        btn.innerHTML = '<i class="ph ph-check-circle"></i> Created!';
        btn.style.background = 'var(--success)';

        setTimeout(() => {
            closeModal('jobAlertsModal');
            e.target.reset();
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.disabled = false;
            showNotification('Job alert created successfully!', 'success');
        }, 1500);
    } catch (error) {
        console.error('Error creating job alert:', error);
        showNotification('Failed to create job alert', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ===== SAVE JOB FUNCTION =====

window.saveJob = async function(jobId, jobTitle) {
    const user = auth.currentUser;
    if (!user) {
        showNotification('Please sign in to save jobs', 'info');
        openModal('authModal');
        return;
    }

    try {
        const savedJobRef = doc(db, "savedJobs", `${user.uid}_${jobId}`);
        await setDoc(savedJobRef, {
            userId: user.uid,
            jobId: jobId,
            jobTitle: jobTitle,
            savedAt: serverTimestamp()
        });

        showNotification('Job saved successfully!', 'success');
    } catch (error) {
        console.error('Error saving job:', error);
        showNotification('Failed to save job', 'error');
    }
}

// ===== LOAD SAVED JOBS =====

window.loadSavedJobs = async function() {
    const user = auth.currentUser;
    if (!user) return;

    const container = document.getElementById('savedJobsList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 2rem;"></i><p>Loading saved jobs...</p></div>';

    try {
        const q = query(collection(db, "savedJobs"), where("userId", "==", user.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="ph ph-bookmark-simple" style="font-size: 3rem; color: var(--gray); margin-bottom: 20px;"></i>
                    <h4 style="margin-bottom: 10px;">No saved jobs yet</h4>
                    <p style="color: var(--gray); margin-bottom: 20px;">Start browsing and save jobs you're interested in</p>
                    <button class="btn btn-gradient" onclick="closeModal('savedJobsModal'); document.getElementById('jobs').scrollIntoView({behavior: 'smooth'});">
                        Browse Jobs
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(docSnap => {
            const saved = docSnap.data();
            container.innerHTML += `
                <div style="background: var(--light-gray); padding: 20px; border-radius: var(--radius-md); margin-bottom: 15px;">
                    <h4 style="margin-bottom: 10px;">${saved.jobTitle}</h4>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-gradient" onclick="applyForSavedJob('${saved.jobId}')" style="padding: 8px 16px;">Apply Now</button>
                        <button class="btn btn-outline" onclick="removeSavedJob('${docSnap.id}')" style="padding: 8px 16px;">Remove</button>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error('Error loading saved jobs:', error);
        container.innerHTML = '<p style="color: var(--error); text-align: center;">Error loading saved jobs</p>';
    }
}

// ===== LOAD APPLICATIONS =====

window.loadApplications = async function() {
    const user = auth.currentUser;
    if (!user) return;

    const container = document.getElementById('applicationsList');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 2rem;"></i><p>Loading applications...</p></div>';

    try {
        const q = query(collection(db, "applications"), where("userId", "==", user.uid), orderBy("appliedAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="ph ph-file-text" style="font-size: 3rem; color: var(--gray); margin-bottom: 20px;"></i>
                    <h4 style="margin-bottom: 10px;">No applications yet</h4>
                    <p style="color: var(--gray);">Start applying to jobs and track them here</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        snapshot.forEach(docSnap => {
            const app = docSnap.data();
            const status = app.status || 'Applied';
            const statusColor = status === 'Applied' ? '#3b82f6' : status === 'Reviewed' ? '#f59e0b' : status === 'Interview' ? '#10b981' : '#6b7280';
            
            container.innerHTML += `
                <div style="background: var(--light-gray); padding: 20px; border-radius: var(--radius-md); margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                        <h4>${app.jobTitle}</h4>
                        <span style="background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem;">${status}</span>
                    </div>
                    <p style="color: var(--gray); font-size: 0.9rem;">Applied: ${formatTimeAgo(app.appliedAt)}</p>
                </div>
            `;
        });
    } catch (error) {
        console.error('Error loading applications:', error);
        container.innerHTML = '<p style="color: var(--error); text-align: center;">Error loading applications</p>';
    }
}

// ===== MEDIA UPLOAD WITH CLOUDINARY =====
window.handleMediaUpload = async function(e) {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
        showNotification('Please sign in to upload media', 'info');
        openModal('authModal');
        return;
    }

    const fileInput = document.getElementById('mediaFile');
    const caption = document.getElementById('mediaCaption').value;
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select a file to upload', 'error');
        return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
        showNotification('Please select an image or video file', 'error');
        return;
    }

    if (isImage && file.size > CLOUDINARY_CONFIG.maxImageSize) {
        showNotification('Image must be less than 10MB', 'error');
        return;
    }
    if (isVideo && file.size > CLOUDINARY_CONFIG.maxVideoSize) {
        showNotification('Video must be less than 50MB', 'error');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Uploading...';
    btn.disabled = true;

    const progressDiv = document.createElement('div');
    progressDiv.className = 'upload-progress';
    progressDiv.innerHTML = '<div class="progress-bar" style="width:0%"></div>';
    e.target.appendChild(progressDiv);

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('folder', 'jobsphere_media');
        formData.append('tags', `user_${user.uid},jobsphere,${isImage ? 'image' : 'video'}`);
        
        const resourceType = isVideo ? 'video' : 'image';
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/${resourceType}/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const data = await response.json();

        let duration = null;
        if (isVideo && data.duration) {
            duration = data.duration;
        }

        await addDoc(collection(db, "media"), {
            url: data.secure_url,
            publicId: data.public_id,
            type: resourceType,
            caption: caption || '',
            uploadedBy: user.uid,
            uploaderName: user.displayName || user.email?.split('@')[0] || 'User',
            uploaderPhoto: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email || 'User')}&background=6366f1&color=fff&size=32`,
            fileSize: data.bytes,
            format: data.format,
            width: data.width || null,
            height: data.height || null,
            duration: duration,
            originalFilename: file.name,
            uploadedAt: serverTimestamp()
        });

        btn.innerHTML = '<i class="ph ph-check-circle"></i> Uploaded!';
        btn.style.background = 'var(--success)';
        
        progressDiv.remove();
        
        setTimeout(() => {
            closeModal('uploadModal');
            fileInput.value = '';
            document.getElementById('mediaCaption').value = '';
            btn.innerHTML = originalText;
            btn.style.background = '';
            btn.disabled = false;
            loadMediaGallery();
            showNotification('Media uploaded successfully!', 'success');
        }, 1500);
    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Upload failed. Please try again.', 'error');
        btn.innerHTML = originalText;
        btn.disabled = false;
        progressDiv.remove();
    }
}

// ===== DOWNLOAD MEDIA FUNCTION =====
window.downloadMedia = async function(url, filename, isVideo = false) {
    try {
        showNotification('Starting download...', 'info');
        
        const downloadUrl = url.includes('cloudinary.com') 
            ? url.replace('/upload/', '/upload/fl_attachment/')
            : url;
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename || 'jobsphere-media';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Download started!', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Download failed', 'error');
    }
}

// ===== LOAD MEDIA GALLERY =====
async function loadMediaGallery() {
    const gallery = document.getElementById('media-gallery');
    if (!gallery) return;

    try {
        const q = query(collection(db, "media"), orderBy("uploadedAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            gallery.innerHTML = getEmptyGalleryHTML();
            return;
        }

        gallery.innerHTML = '';
        snapshot.forEach(docSnap => {
            const media = docSnap.data();
            const mediaId = docSnap.id;
            
            if (media.type === 'image') {
                gallery.innerHTML += createImageCard(media, mediaId);
            } else if (media.type === 'video') {
                gallery.innerHTML += createVideoCard(media, mediaId);
            }
        });

        if (auth.currentUser) {
            addUploadButtonToGallery();
        }
    } catch (error) {
        console.error('Error loading media:', error);
        gallery.innerHTML = '<p style="color:var(--gray);text-align:center;grid-column:1/-1;">Error loading media. Please refresh.</p>';
    }
}

// ===== CREATE IMAGE CARD =====
function createImageCard(media, id) {
    const user = auth.currentUser;
    const canDelete = user && (user.uid === media.uploadedBy || currentRole === 'company');
    const filename = media.originalFilename || `image-${id}.${media.format || 'jpg'}`;
    
    return `
        <div class="media-card" data-media-id="${id}" data-aos="fade-up">
            <div class="media-preview" onclick="openMediaModal('${media.url}', 'image', '${media.caption?.replace(/'/g, "\\'") || ''}', '${media.uploaderName}')">
                <img src="${media.url}" alt="${media.caption || 'Uploaded image'}" loading="lazy">
                ${media.width && media.height ? `<span class="media-dimensions">${media.width}×${media.height}</span>` : ''}
            </div>
            <div class="media-info">
                <div class="media-caption">${media.caption || '📷 Photo'}</div>
                <div class="media-meta">
                    <img src="${media.uploaderPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(media.uploaderName)}&background=6366f1&color=fff&size=32`}" 
                         class="media-avatar" 
                         alt="${media.uploaderName}"
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(media.uploaderName)}&background=6366f1&color=fff&size=32'">
                    <span class="media-uploader">${media.uploaderName}</span>
                    <span class="media-time">${formatTimeAgo(media.uploadedAt)}</span>
                </div>
                <div class="media-actions">
                    <button onclick="downloadMedia('${media.url}', '${filename}', false)" 
                            class="media-action-btn download-btn" title="Download">
                        <i class="ph ph-download-simple"></i>
                    </button>
                    ${canDelete ? `
                        <button onclick="deleteMedia('${id}', '${media.publicId}', '${media.type}')" 
                                class="media-action-btn delete-btn" title="Delete">
                            <i class="ph ph-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// ===== CREATE VIDEO CARD =====
function createVideoCard(media, id) {
    const user = auth.currentUser;
    const canDelete = user && (user.uid === media.uploadedBy || currentRole === 'company');
    const filename = media.originalFilename || `video-${id}.${media.format || 'mp4'}`;
    
    return `
        <div class="media-card" data-media-id="${id}" data-aos="fade-up">
            <div class="media-preview video-preview" onclick="openMediaModal('${media.url}', 'video', '${media.caption?.replace(/'/g, "\\'") || ''}', '${media.uploaderName}')">
                <video preload="metadata">
                    <source src="${media.url}#t=0.1" type="video/${media.format || 'mp4'}">
                </video>
                <div class="video-play-btn">
                    <i class="ph-fill ph-play-circle"></i>
                </div>
                ${media.duration ? `<span class="video-duration">${formatDuration(media.duration)}</span>` : ''}
            </div>
            <div class="media-info">
                <div class="media-caption">${media.caption || '🎥 Video'}</div>
                <div class="media-meta">
                    <img src="${media.uploaderPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(media.uploaderName)}&background=6366f1&color=fff&size=32`}" 
                         class="media-avatar" 
                         alt="${media.uploaderName}"
                         onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(media.uploaderName)}&background=6366f1&color=fff&size=32'">
                    <span class="media-uploader">${media.uploaderName}</span>
                    <span class="media-time">${formatTimeAgo(media.uploadedAt)}</span>
                </div>
                <div class="media-actions">
                    <button onclick="downloadMedia('${media.url}', '${filename}', true)" 
                            class="media-action-btn download-btn" title="Download">
                        <i class="ph ph-download-simple"></i>
                    </button>
                    ${canDelete ? `
                        <button onclick="deleteMedia('${id}', '${media.publicId}', '${media.type}')" 
                                class="media-action-btn delete-btn" title="Delete">
                            <i class="ph ph-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

// ===== ADD UPLOAD BUTTON TO GALLERY =====
function addUploadButtonToGallery() {
    const gallery = document.getElementById('media-gallery');
    if (!gallery) return;
    
    const uploadCard = document.createElement('div');
    uploadCard.className = 'media-card upload-card';
    uploadCard.setAttribute('data-aos', 'fade-up');
    uploadCard.innerHTML = `
        <div class="upload-placeholder" onclick="openModal('uploadModal')">
            <i class="ph ph-upload-simple"></i>
            <h4>Upload Media</h4>
            <p>Share photos or videos with the community</p>
            <small>Images: 10MB max | Videos: 50MB max</small>
        </div>
    `;
    
    gallery.insertBefore(uploadCard, gallery.firstChild);
}

// ===== OPEN MEDIA MODAL =====
window.openMediaModal = function(url, type, caption, uploader) {
    const modal = document.createElement('div');
    modal.className = 'modal-wrap media-view-modal';
    modal.style.display = 'flex';
    modal.onclick = function(e) {
        if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
        <div class="media-view-box">
            <button class="media-view-close" onclick="this.closest('.modal-wrap').remove()">
                <i class="ph ph-x"></i>
            </button>
            ${type === 'image' 
                ? `<img src="${url}" alt="${caption}" class="media-view-image">`
                : `<video src="${url}" controls autoplay class="media-view-video"></video>`
            }
            <div class="media-view-info">
                <p>${caption || 'No caption'}</p>
                <small>Uploaded by ${uploader}</small>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// ===== DELETE MEDIA =====
window.deleteMedia = async function(mediaId, publicId, resourceType) {
    if (!confirm('Are you sure you want to delete this media?')) return;
    
    try {
        await setDoc(doc(db, "media", mediaId), {
            deleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: auth.currentUser?.uid
        }, { merge: true });
        
        const mediaCard = document.querySelector(`[data-media-id="${mediaId}"]`);
        if (mediaCard) {
            mediaCard.style.opacity = '0';
            mediaCard.style.transform = 'scale(0.8)';
            setTimeout(() => {
                mediaCard.remove();
                showNotification('Media deleted successfully', 'success');
                
                if (document.querySelectorAll('.media-card:not(.upload-card)').length === 0) {
                    loadMediaGallery();
                }
            }, 300);
        }
    } catch (error) {
        console.error('Delete error:', error);
        showNotification('Failed to delete media', 'error');
    }
}

// ===== HELPER FUNCTIONS =====
function formatTimeAgo(timestamp) {
    if (!timestamp || !timestamp.toDate) return 'recently';
    
    const date = timestamp.toDate();
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

function formatDuration(seconds) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getEmptyGalleryHTML() {
    if (auth.currentUser) {
        return `
            <div class="empty-gallery" style="grid-column:1/-1; text-align:center; padding:60px 20px;">
                <i class="ph ph-image" style="font-size:4rem; color:var(--gray); margin-bottom:20px;"></i>
                <h3 style="margin-bottom:10px; color:var(--dark);">No Media Yet</h3>
                <p style="color:var(--gray); margin-bottom:20px;">Be the first to share a photo or video!</p>
                <button class="btn btn-gradient" onclick="openModal('uploadModal')">
                    <i class="ph ph-upload-simple"></i>
                    Upload Media
                </button>
            </div>
        `;
    }
    return '<p style="color:var(--gray);text-align:center;grid-column:1/-1;">No media uploaded yet. <a href="#" onclick="openModal(\'authModal\')" style="color:var(--primary);">Sign in</a> to upload.</p>';
}

// ===== NOTIFICATION SYSTEM =====
function showNotification(message, type = 'success') {
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    const notification = document.createElement('div');
    notification.style.cssText = `
        position:fixed;top:100px;right:30px;background:${colors[type]};color:white;
        padding:15px 25px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.15);
        z-index:9999;font-weight:500;display:flex;align-items:center;gap:10px;
        animation:slideIn 0.3s ease;
        white-space: pre-line;
        max-width: 350px;
    `;
    const icon = document.createElement('i');
    icon.className = `ph ph-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : type === 'info' ? 'info' : 'warning'}`;
    notification.appendChild(icon);
    notification.appendChild(document.createTextNode(message));
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// ===== COUNTER ANIMATION =====
function initCounters() {
    const counters = document.querySelectorAll('.stat-item h3');
    counters.forEach(counter => {
        const target = parseInt(counter.innerText);
        if (isNaN(target)) return;
        const increment = target / 50;
        let current = 0;
        const updateCounter = () => {
            if (current < target) {
                current += increment;
                counter.innerText = Math.ceil(current) + '+';
                setTimeout(updateCounter, 30);
            } else {
                counter.innerText = target + '+';
            }
        };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    updateCounter();
                    observer.unobserve(entry.target);
                }
            });
        });
        observer.observe(counter.parentElement);
    });
}

// ===== ADD CSS STYLES =====
const style = document.createElement('style');
style.textContent = `
    .auth-toggle.active {
        background: white !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        color: var(--primary) !important;
    }
    .role-badge {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-right: 10px;
    }
    .role-badge.company {
        background: rgba(236, 72, 153, 0.1);
        color: var(--accent);
    }
    .role-badge.user {
        background: rgba(99, 102, 241, 0.1);
        color: var(--primary);
    }
    .switch-role-btn {
        background: transparent;
        border: 1px solid var(--primary);
        color: var(--primary);
        padding: 8px 16px;
        border-radius: 50px;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .switch-role-btn:hover {
        background: rgba(99, 102, 241, 0.1);
        transform: translateY(-2px);
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .ph-spin {
        animation: spin 1s linear infinite;
        display: inline-block;
    }
    .google-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
    .google-btn:disabled:hover {
        transform: none;
        border-color: #e2e8f0 !important;
        background: white !important;
    }
    .dynamic-field {
        background: white;
        padding: 20px;
        border-radius: var(--radius-md);
        margin-bottom: 15px;
        position: relative;
        border: 1px solid rgba(0,0,0,0.05);
    }
    .dynamic-field .remove-field {
        position: absolute;
        top: 10px;
        right: 10px;
        background: none;
        border: none;
        color: var(--gray);
        cursor: pointer;
        font-size: 1.2rem;
        transition: color 0.3s ease;
    }
    .dynamic-field .remove-field:hover {
        color: #ef4444;
    }
`;
document.head.appendChild(style);