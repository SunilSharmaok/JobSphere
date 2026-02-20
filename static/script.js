// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAD3xg3SZLQyv-Rf3rb4vw6-HVsZuZRD3E",
    authDomain: "jobsphere-ab925.firebaseapp.com",
    projectId: "jobsphere-ab925",
    storageBucket: "jobsphere-ab925.firebasestorage.app",
    messagingSenderId: "757724057808",
    appId: "1:757724057808:web:d46c8fbb78409abfef4ed5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Initialize AOS
AOS.init({
    duration: 1000,
    once: true,
    offset: 50
});

// Navbar scroll effect
let navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
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

// Check authentication state on page load
onAuthStateChanged(auth, (user) => {
    updateUIForUser(user);
});

// Google Sign In function
window.googleSignIn = async function() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        showNotification(`Welcome ${user.displayName || 'back'}!`, 'success');
        updateUIForUser(user);
        closeModal('loginModal');
        closeModal('signupModal');
    } catch (error) {
        console.error('Sign-in error:', error);
        
        if (error.code === 'auth/unauthorized-domain') {
            showNotification(`Please add "${window.location.hostname}" to Firebase authorized domains`, 'error');
        } else {
            showNotification(error.message, 'error');
        }
    }
}

// Sign Out function
window.googleSignOut = async function() {
    try {
        await signOut(auth);
        showNotification('Signed out successfully', 'success');
        updateUIForUser(null);
    } catch (error) {
        console.error('Sign-out error:', error);
        showNotification(error.message, 'error');
    }
}

// Update UI based on authentication state
function updateUIForUser(user) {
    const authButtons = document.querySelector('.auth-buttons');
    
    if (!authButtons) return;

    if (user) {
        // User is signed in - show avatar with name on hover
        const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366f1&color=fff&size=128`;
        const displayName = user.displayName || 'User';
        const email = user.email || '';
        
        authButtons.innerHTML = `
            <div class="user-menu">
                <img src="${photoURL}" 
                     alt="${displayName}" 
                     class="user-avatar">
                <div class="user-dropdown">
                    <div class="user-info">
                        <img src="${photoURL}" alt="${displayName}">
                        <strong>${displayName}</strong>
                        <small>${email}</small>
                    </div>
                    <div class="dropdown-divider"></div>
                    <a href="#" onclick="googleSignOut()">Sign Out</a>
                </div>
            </div>
            <button class="btn btn-gradient" onclick="openModal('postJobModal')">Post Job</button>
        `;
    } else {
        // User is signed out - show sign in button only
        authButtons.innerHTML = `
            <button class="btn btn-outline login-btn" onclick="openModal('loginModal')">Sign In</button>
            <button class="btn btn-gradient" onclick="openModal('postJobModal')">Post Job</button>
        `;
    }
}

// Modal functions
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Close modal when clicking outside
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
        const title = card.getAttribute('data-title').toLowerCase();
        const text = card.innerText.toLowerCase();
        
        if(title.includes(input) || text.includes(input)) {
            card.style.display = "grid";
        } else {
            card.style.display = "none";
        }
    });

    document.getElementById('jobs').scrollIntoView({ behavior: 'smooth' });
}

// Job application handler
window.openApplyModal = function(title) {
    const user = auth.currentUser;
    
    if (!user) {
        showNotification('Please sign in to apply for jobs', 'info');
        openModal('loginModal');
        return;
    }
    
    const modalTitle = document.getElementById('modalTitle');
    const nameInput = document.getElementById('applicantName');
    const emailInput = document.getElementById('applicantEmail');
    
    if (modalTitle) modalTitle.innerText = "Apply for: " + title;
    
    // Pre-fill user data if available
    if (user) {
        if (nameInput) nameInput.value = user.displayName || '';
        if (emailInput) emailInput.value = user.email || '';
    }
    
    openModal('applyModal');
}

window.handleApply = function(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const original = btn.innerText;
    
    btn.innerText = "Submitting...";
    btn.disabled = true;
    
    setTimeout(() => {
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
    }, 2000);
}

// Job post handler
window.handleJobPost = function(e) {
    e.preventDefault();
    const user = auth.currentUser;
    
    if (!user) {
        showNotification('Please sign in to post a job', 'info');
        closeModal('postJobModal');
        openModal('loginModal');
        return;
    }
    
    showNotification('Job posted successfully!', 'success');
    closeModal('postJobModal');
    e.target.reset();
}

// Notification system
function showNotification(message, type = 'success') {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 30px;
        background: ${colors[type]};
        color: white;
        padding: 15px 25px;
        border-radius: 12px;
        box-shadow: var(--shadow-xl);
        z-index: 3000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    // Add icon based on type
    const icon = document.createElement('i');
    icon.className = `ph ph-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : type === 'info' ? 'info' : 'warning'}`;
    notification.appendChild(icon);
    notification.appendChild(document.createTextNode(message));
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Counter animation
const counters = document.querySelectorAll('.stat-item h3');
counters.forEach(counter => {
    const target = parseInt(counter.innerText);
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