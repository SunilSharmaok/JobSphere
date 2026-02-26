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
    updateProfile,
    verifyPasswordResetCode,
    confirmPasswordReset
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

// ===== UPDATED ROLE SELECTION FUNCTION =====
window.selectRole = async function(role) {
    currentRole = role;
    localStorage.setItem('jobsphere_role', role);
    
    // Hide role screen and show main site
    document.getElementById('role-screen').style.display = 'none';
    document.getElementById('main-site').style.display = 'block';
    
    // Apply UI changes for the new role
    applyRoleUI(role);
    
    // Re-initialize AOS
    AOS.init({ duration: 1000, once: true, offset: 50 });
    
    // Reload jobs to show/hide apply buttons correctly
    await loadJobsFromFirestore();
    
    // Load media gallery
    loadMediaGallery();
    
    // Initialize counters
    initCounters();
    
    // Update user interface if user is logged in
    const user = auth.currentUser;
    if (user) {
        // Update user's role in Firestore
        try {
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                role: role,
                lastLogin: serverTimestamp()
            }, { merge: true });
            
            // Update UI with user info
            updateUIForUser(user);
            
        } catch (error) {
            console.error('Error updating user role:', error);
        }
    }
    
    // Show notification about role switch
    showNotification(`Switched to ${role === 'company' ? 'Company' : 'Job Seeker'} mode`, 'success');
}

function showMainSite() {
    document.getElementById('role-screen').style.display = 'none';
    document.getElementById('main-site').style.display = 'block';
    applyRoleUI(currentRole);
    AOS.init({ duration: 1000, once: true, offset: 50 });
    loadJobsFromFirestore();
    loadMediaGallery();
    initCounters();
}

// ===== UPDATED APPLY ROLE UI FUNCTION =====
function applyRoleUI(role) {
    const postJobBtn = document.getElementById('navbar-post-job-btn');
    const navPostJob = document.getElementById('nav-post-job');
    const applyBtns = document.querySelectorAll('.apply-btn');
    const loginBtn = document.querySelector('.login-btn');
    const authButtons = document.querySelector('.auth-buttons');

    if (role === 'company') {
        // Show company-specific elements
        if (postJobBtn) postJobBtn.style.display = 'inline-flex';
        if (navPostJob) navPostJob.style.display = 'inline-block';
        
        // Hide apply buttons
        applyBtns.forEach(btn => btn.style.display = 'none');
        
        // Update any company-specific UI
        document.querySelectorAll('.job-card .btn-gradient').forEach(btn => {
            if (btn.classList.contains('apply-btn')) {
                btn.style.display = 'none';
            }
        });
        
        // Update Post Job button visibility in auth buttons
        const postJobAuthBtn = document.querySelector('.auth-buttons .btn-gradient');
        if (postJobAuthBtn && postJobAuthBtn.innerText.includes('Post Job')) {
            postJobAuthBtn.style.display = 'inline-flex';
        }
        
    } else {
        // Hide company-specific elements
        if (postJobBtn) postJobBtn.style.display = 'none';
        if (navPostJob) navPostJob.style.display = 'none';
        
        // Show apply buttons for job seekers
        applyBtns.forEach(btn => btn.style.display = 'inline-flex');
        
        // Update any job seeker-specific UI
        document.querySelectorAll('.job-card .btn-gradient').forEach(btn => {
            if (btn.classList.contains('apply-btn')) {
                btn.style.display = 'inline-flex';
            }
        });
        
        // Hide Post Job button in auth buttons for job seekers
        const postJobAuthBtn = document.querySelector('.auth-buttons .btn-gradient');
        if (postJobAuthBtn && postJobAuthBtn.innerText.includes('Post Job')) {
            postJobAuthBtn.style.display = 'none';
        }
    }
    
    // Update auth buttons based on user state
    const user = auth.currentUser;
    if (user) {
        updateUIForUser(user);
    } else {
        // Update login button text or visibility if needed
        if (loginBtn) {
            loginBtn.innerText = 'Sign In';
        }
    }
}

// ===== UPDATED SWITCH ROLE FUNCTION =====
window.switchRole = function() {
    // Sign out if user is logged in
    if (auth.currentUser) {
        // Ask for confirmation
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
        // No user logged in, just switch role
        localStorage.removeItem('jobsphere_role');
        currentRole = null;
        document.getElementById('main-site').style.display = 'none';
        document.getElementById('role-screen').style.display = 'flex';
        showNotification('Please select your role', 'info');
    }
}

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const userRef = doc(db, "users", user.uid);
            const userSnap = await getDoc(userRef);
            
            // Get current role from localStorage or existing user data
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
                
                // Update currentRole if we have a stored role
                if (roleFromStorage) {
                    currentRole = roleFromStorage;
                }
            } else {
                // Update last login and possibly role
                const userData = userSnap.data();
                
                // If there's a role in storage and it's different from the stored role, update it
                if (roleFromStorage && roleFromStorage !== userData.role) {
                    await setDoc(userRef, {
                        role: roleFromStorage,
                        lastLogin: serverTimestamp()
                    }, { merge: true });
                    currentRole = roleFromStorage;
                } else {
                    // Just update last login
                    await setDoc(userRef, {
                        lastLogin: serverTimestamp()
                    }, { merge: true });
                    
                    // Set currentRole from user data if not set
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
        
        // Apply role UI after user is loaded
        if (currentRole) {
            applyRoleUI(currentRole);
        }
        
        // Reload jobs to update buttons
        loadJobsFromFirestore();
        
    } else {
        updateUIForUser(null);
        // Don't reset currentRole here as it might be needed for role screen
    }
});

// Google Sign In
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
        
        // Get role from localStorage or currentRole
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
            
            // Update role if needed
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
        
        // Apply role UI after successful sign in
        if (currentRole) {
            applyRoleUI(currentRole);
        }
        
        // Reload jobs to show correct buttons
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

// Email/Password Sign In
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
        
        // Apply role UI after sign in
        if (currentRole) {
            applyRoleUI(currentRole);
        }
        
        // Reload jobs to show correct buttons
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

// Email/Password Sign Up
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

        // Get role from localStorage or currentRole
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
        
        // Apply role UI after sign up
        if (currentRole) {
            applyRoleUI(currentRole);
        }
        
        // Reload jobs to show correct buttons
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

// Forgot Password
window.showForgotPassword = function() {
    closeModal('authModal');
    openModal('forgotPasswordModal');
}

window.handleForgotPassword = async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgotEmail').value.trim();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    // Validate email
    if (!email || !email.includes('@') || !email.includes('.')) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }

    btn.innerText = 'Sending...';
    btn.disabled = true;

    try {
        console.log('Attempting to send password reset email to:', email);
        
        // Configure action code settings
        const actionCodeSettings = {
            url: window.location.origin, // Redirect back to your site after reset
            handleCodeInApp: false
        };
        
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
        
        console.log('Password reset email sent successfully to:', email);
        
        // Show success message with clear instructions
        showNotification(
            '✅ Password reset email sent! Please check:\n\n' +
            '1. Your inbox\n' +
            '2. Spam/Junk folder\n' +
            '3. Promotions tab (Gmail)\n\n' +
            'Email from: noreply@jobsphere-ab925.firebaseapp.com', 
            'success'
        );
        
        // Close modal after 3 seconds
        setTimeout(() => {
            closeModal('forgotPasswordModal');
            e.target.reset();
            
            // Show additional info
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
                // Offer to switch to sign up
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

// Toggle between Sign In and Sign Up forms
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

// Sign Out
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

// Update UI based on user state
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
        const dropdownItems = currentRole === 'company'
            ? `<a href="#" onclick="openModal('postJobModal')"><i class="ph ph-briefcase" style="margin-right:8px;"></i>Post a Job</a>
               <a href="#" onclick="openModal('uploadModal')"><i class="ph ph-image" style="margin-right:8px;"></i>Upload Media</a>`
            : `<a href="#" onclick="openModal('uploadModal')"><i class="ph ph-image" style="margin-right:8px;"></i>Upload Media</a>`;

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

// Scroll effect for navbar
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

// Modal functions
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        if (modalId === 'authModal') {
            toggleAuthMode('signin');
            document.getElementById('signinForm')?.reset();
            document.getElementById('signupForm')?.reset();
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

// Job search filter
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

// Open apply modal
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

// Handle job application
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

// Post Job
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

// Load Jobs from Firestore
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
            
            // Check if apply button should be shown based on role
            const showApplyButton = currentRole !== 'company';
            
            const applyBtn = showApplyButton
                ? `<button class="btn btn-gradient apply-btn" onclick="openApplyModal('${job.title.replace(/'/g, "\\'")}')">Apply Now</button>`
                : '';

            container.innerHTML += `
                <div class="job-card" data-title="${job.title}">
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
                        ${applyBtn}
                    </div>
                </div>
            `;
        });

    } catch (error) {
        console.error('Error loading jobs:', error);
        container.innerHTML = getSampleJobsHTML();
    }
}

// Sample jobs HTML (fallback)
function getSampleJobsHTML() {
    const showApplyButton = currentRole !== 'company';
    const applyButtonHTML = showApplyButton 
        ? '<button class="btn btn-gradient apply-btn" onclick="openApplyModal(\'Senior Product Designer\')">Apply Now</button>'
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
                ${applyButtonHTML}
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
                ${applyButtonHTML.replace('Senior Product Designer', 'Frontend Developer')}
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
                ${applyButtonHTML.replace('Senior Product Designer', 'Marketing Manager')}
            </div>
        </div>
    `;
}

// Media Upload (placeholder)
window.handleMediaUpload = async function(e) {
    e.preventDefault();
    const user = auth.currentUser;

    if (!user) {
        showNotification('Please sign in to upload', 'info');
        openModal('authModal');
        return;
    }

    showNotification('Media upload coming soon via Cloudinary!', 'info');
}

// Load Media Gallery
async function loadMediaGallery() {
    const gallery = document.getElementById('media-gallery');
    if (!gallery) return;

    try {
        const q = query(collection(db, "media"), orderBy("uploadedAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            gallery.innerHTML = '<p style="color:var(--gray);text-align:center;grid-column:1/-1;">No media uploaded yet.</p>';
            return;
        }

        gallery.innerHTML = '';
        snapshot.forEach(docSnap => {
            const media = docSnap.data();
            if (media.type === 'image') {
                gallery.innerHTML += `
                    <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                        <img src="${media.url}" alt="${media.caption || ''}" style="width:100%;height:200px;object-fit:cover;display:block;">
                        <div style="padding:12px;">
                            <p style="font-size:0.9rem;color:var(--dark);margin-bottom:4px;">${media.caption || ''}</p>
                            <small style="color:var(--gray);">by ${media.uploaderName}</small>
                        </div>
                    </div>`;
            } else if (media.type === 'video') {
                gallery.innerHTML += `
                    <div style="border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
                        <video controls style="width:100%;height:200px;object-fit:cover;display:block;background:#000;">
                            <source src="${media.url}">
                        </video>
                        <div style="padding:12px;">
                            <p style="font-size:0.9rem;color:var(--dark);margin-bottom:4px;">${media.caption || ''}</p>
                            <small style="color:var(--gray);">by ${media.uploaderName}</small>
                        </div>
                    </div>`;
            }
        });

    } catch (error) {
        console.error('Error loading media:', error);
    }
}

// Notification System
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

// Counter Animation
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

// Add CSS for auth toggle buttons and spinner
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
`;
document.head.appendChild(style);

// Debug function for password reset
window.debugPasswordReset = async function() {
    const email = prompt("Enter email to test password reset:", "test@example.com");
    if (!email) return;
    
    console.log("🔍 Testing password reset for:", email);
    
    try {
        const actionCodeSettings = {
            url: window.location.origin,
            handleCodeInApp: false
        };
        
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
        
        console.log("✅ Email sent successfully to:", email);
        console.log("📧 From: noreply@jobsphere-ab925.firebaseapp.com");
        console.log("📋 Check these folders:");
        console.log("   - Inbox");
        console.log("   - Spam/Junk");
        console.log("   - Promotions (Gmail)");
        console.log("   - Social (Gmail)");
        
        alert(`✅ Reset email sent to ${email}!\n\nPlease check:\n1. Inbox\n2. Spam folder\n3. Promotions tab (Gmail)\n\nEmail from: noreply@jobsphere-ab925.firebaseapp.com`);
        
    } catch (error) {
        console.error("❌ Error sending email:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        alert(`❌ Error: ${error.message}\n\nCheck console for details.`);
    }
}