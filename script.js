// ===== Firebase Imports =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged
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

// ===== Firebase Config =====
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

// ===== Role Management =====
// Role is stored in localStorage for quick access and in Firestore permanently
let currentRole = null;

// Called when user clicks "I'm a Job Seeker" or "I'm a Company"
window.selectRole = function(role) {
    currentRole = role;
    localStorage.setItem('jobsphere_role', role);
    showMainSite();
}

function showMainSite() {
    document.getElementById('role-screen').style.display = 'none';
    document.getElementById('main-site').style.display = 'block';
    applyRoleUI(currentRole);
    AOS.init({ duration: 1000, once: true, offset: 50 });
    loadJobsFromFirestore();
    loadMediaGallery();
}

// Apply role-based UI changes
function applyRoleUI(role) {
    const postJobBtn = document.getElementById('navbar-post-job-btn');
    const navPostJob = document.getElementById('nav-post-job');
    const applyBtns = document.querySelectorAll('.apply-btn');

    if (role === 'company') {
        // Company sees Post Job button, no Apply buttons
        if (postJobBtn) postJobBtn.style.display = 'inline-flex';
        if (navPostJob) navPostJob.style.display = 'inline-block';
        applyBtns.forEach(btn => btn.style.display = 'none');
    } else {
        // User sees Apply buttons, no Post Job
        if (postJobBtn) postJobBtn.style.display = 'none';
        if (navPostJob) navPostJob.style.display = 'none';
        applyBtns.forEach(btn => btn.style.display = 'inline-flex');
    }
}

// ===== On Page Load =====
// If role already chosen before, skip role screen
// if (currentRole) {
//     showMainSite();
// }

// ===== Auth State =====
onAuthStateChanged(auth, (user) => {
    if (currentRole) updateUIForUser(user);
});

// ===== Google Sign In =====
window.googleSignIn = async function() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Save user to Firestore with their role (use setDoc so we don't duplicate)
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: user.displayName,
            email: user.email,
            photo: user.photoURL,
            role: currentRole,
            updatedAt: serverTimestamp()
        }, { merge: true });

        showNotification(`Welcome ${user.displayName || 'back'}!`, 'success');
        updateUIForUser(user);
        closeModal('loginModal');

    } catch (error) {
        console.error('Sign-in error:', error);
        if (error.code === 'auth/unauthorized-domain') {
            showNotification(`Please add "${window.location.hostname}" to Firebase authorized domains`, 'error');
        } else {
            showNotification(error.message, 'error');
        }
    }
}

// ===== Sign Out =====
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

// ===== Switch Role (go back to role screen without signing out) =====
window.switchRole = function() {
    localStorage.removeItem('jobsphere_role');
    currentRole = null;
    document.getElementById('main-site').style.display = 'none';
    document.getElementById('role-screen').style.display = 'flex';
}

// ===== Update Navbar UI =====
function updateUIForUser(user) {
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;

    if (user) {
        const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366f1&color=fff&size=128`;
        const displayName = user.displayName || 'User';
        const email = user.email || '';
        const roleBadge = currentRole === 'company'
            ? `<span class="role-badge company">Company</span>`
            : `<span class="role-badge user">Job Seeker</span>`;

        // Company gets Upload Media + Post Job in dropdown
        // User gets Upload Media only
        const dropdownItems = currentRole === 'company'
            ? `<a href="#" onclick="openModal('postJobModal')"><i class="ph ph-briefcase" style="margin-right:8px;"></i>Post a Job</a>
               <a href="#" onclick="openModal('uploadModal')"><i class="ph ph-image" style="margin-right:8px;"></i>Upload Media</a>`
            : `<a href="#" onclick="openModal('uploadModal')"><i class="ph ph-image" style="margin-right:8px;"></i>Upload Media</a>`;

        authButtons.innerHTML = `
            <div class="user-menu">
                ${roleBadge}
                <img src="${photoURL}" alt="${displayName}" class="user-avatar">
                <div class="user-dropdown">
                    <div class="user-info">
                        <img src="${photoURL}" alt="${displayName}">
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
            <button class="btn btn-outline login-btn" onclick="openModal('loginModal')">Sign In</button>
            ${currentRole === 'company' ? `<button class="btn btn-gradient" onclick="openModal('postJobModal')">Post Job</button>` : ''}
        `;
    }
}

// ===== Navbar Scroll =====
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

// ===== Modal Functions =====
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

window.onclick = function(event) {
    if (event.target.classList.contains('modal-wrap')) {
        event.target.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// ===== Job Search Filter =====
window.filterJobs = function() {
    const input = document.getElementById('jobSearch').value.toLowerCase();
    const cards = document.querySelectorAll('.job-card');
    cards.forEach(card => {
        const title = card.getAttribute('data-title').toLowerCase();
        const text = card.innerText.toLowerCase();
        card.style.display = (title.includes(input) || text.includes(input)) ? "grid" : "none";
    });
    document.getElementById('jobs').scrollIntoView({ behavior: 'smooth' });
}

// ===== Apply for Job (users only) =====
window.openApplyModal = function(title) {
    if (currentRole === 'company') {
        showNotification('Companies cannot apply for jobs', 'info');
        return;
    }

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
    if (nameInput) nameInput.value = user.displayName || '';
    if (emailInput) emailInput.value = user.email || '';
    window._currentJobTitle = title;
    openModal('applyModal');
}

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

// ===== Post Job (companies only) =====
window.handleJobPost = async function(e) {
    e.preventDefault();
    const user = auth.currentUser;

    if (!user) {
        showNotification('Please sign in to post a job', 'info');
        closeModal('postJobModal');
        openModal('loginModal');
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

// ===== Load Jobs from Firestore =====
async function loadJobsFromFirestore() {
    const container = document.getElementById('job-list-container');
    if (!container) return;

    try {
        const q = query(collection(db, "jobs"), orderBy("postedAt", "desc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        container.innerHTML = '';
        snapshot.forEach(docSnap => {
            const job = docSnap.data();
            // Show Apply button only for users
            const applyBtn = currentRole === 'company'
                ? ''
                : `<button class="btn btn-gradient apply-btn" onclick="openApplyModal('${job.title}')">Apply Now</button>`;

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
    }
}

// ===== Media Upload (Cloudinary — add credentials when ready) =====
window.handleMediaUpload = async function(e) {
    e.preventDefault();
    const user = auth.currentUser;

    if (!user) {
        showNotification('Please sign in to upload', 'info');
        return;
    }

    showNotification('Media upload coming soon via Cloudinary!', 'info');
    // TODO: Add Cloudinary credentials here when ready
}

// ===== Load Media Gallery =====
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

// ===== Notification System =====
function showNotification(message, type = 'success') {
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    const notification = document.createElement('div');
    notification.style.cssText = `
        position:fixed;top:100px;right:30px;background:${colors[type]};color:white;
        padding:15px 25px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.15);
        z-index:9999;font-weight:500;display:flex;align-items:center;gap:10px;
        animation:slideIn 0.3s ease;
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
    }, 3000);
}

// ===== Counter Animation =====
// Runs after main site is shown
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

// Init counters after main site shows
if (currentRole) initCounters();