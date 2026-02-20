// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Firestore
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ✅ NEW: Import Firebase Storage
import {
    getStorage,
    ref,
    uploadBytesResumable,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
const db = getFirestore(app);

// ✅ NEW: Initialize Storage
const storage = getStorage(app);

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

// Google Sign In
window.googleSignIn = async function() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        await addDoc(collection(db, "users"), {
            uid: user.uid,
            name: user.displayName,
            email: user.email,
            photo: user.photoURL,
            createdAt: serverTimestamp()
        });

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

// Sign Out
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

// Update UI based on auth state
function updateUIForUser(user) {
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;

    if (user) {
        const photoURL = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=6366f1&color=fff&size=128`;
        const displayName = user.displayName || 'User';
        const email = user.email || '';
        
        authButtons.innerHTML = `
            <div class="user-menu">
                <img src="${photoURL}" alt="${displayName}" class="user-avatar">
                <div class="user-dropdown">
                    <div class="user-info">
                        <img src="${photoURL}" alt="${displayName}">
                        <strong>${displayName}</strong>
                        <small>${email}</small>
                    </div>
                    <div class="dropdown-divider"></div>
                    <a href="#" onclick="openModal('uploadModal')">Upload Media</a>
                    <a href="#" onclick="googleSignOut()">Sign Out</a>
                </div>
            </div>
            <button class="btn btn-gradient" onclick="openModal('postJobModal')">Post Job</button>
        `;
    } else {
        authButtons.innerHTML = `
            <button class="btn btn-outline login-btn" onclick="openModal('loginModal')">Sign In</button>
            <button class="btn btn-gradient" onclick="openModal('postJobModal')">Post Job</button>
        `;
    }
}

// ✅ NEW: Upload photo or video to Firebase Storage
window.handleMediaUpload = async function(e) {
    e.preventDefault();
    const user = auth.currentUser;

    if (!user) {
        showNotification('Please sign in to upload files', 'info');
        return;
    }

    const fileInput = document.getElementById('mediaFile');
    const caption = document.getElementById('mediaCaption').value;
    const file = fileInput.files[0];

    if (!file) {
        showNotification('Please select a file', 'warning');
        return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
        showNotification('Only images and videos are allowed', 'error');
        return;
    }

    // Max 10MB for images, 50MB for videos
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
        showNotification(`File too large. Max: ${isVideo ? '50MB' : '10MB'}`, 'error');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const progressBar = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('uploadProgressFill');
    const progressText = document.getElementById('uploadProgressText');

    btn.disabled = true;
    btn.innerText = 'Uploading...';
    if (progressBar) progressBar.style.display = 'block';

    try {
        // Save to: media/userId/timestamp_filename
        const filePath = `media/${user.uid}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                // Show upload progress
                const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (progressFill) progressFill.style.width = percent + '%';
                if (progressText) progressText.innerText = percent + '%';
            },
            (error) => {
                console.error('Upload error:', error);
                showNotification('Upload failed. Try again.', 'error');
                btn.disabled = false;
                btn.innerText = 'Upload';
                if (progressBar) progressBar.style.display = 'none';
            },
            async () => {
                // Get the public URL of the uploaded file
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                // Save file metadata to Firestore
                await addDoc(collection(db, "media"), {
                    url: downloadURL,
                    type: isVideo ? 'video' : 'image',
                    caption: caption,
                    fileName: file.name,
                    uploadedBy: user.uid,
                    uploaderName: user.displayName,
                    uploaderPhoto: user.photoURL,
                    uploadedAt: serverTimestamp()
                });

                showNotification('Upload successful!', 'success');
                closeModal('uploadModal');
                e.target.reset();
                if (progressBar) progressBar.style.display = 'none';
                if (progressFill) progressFill.style.width = '0%';
                btn.disabled = false;
                btn.innerText = 'Upload';
                loadMediaGallery();
            }
        );

    } catch (error) {
        console.error('Upload error:', error);
        showNotification('Upload failed. Try again.', 'error');
        btn.disabled = false;
        btn.innerText = 'Upload';
        if (progressBar) progressBar.style.display = 'none';
    }
}

// ✅ NEW: Load and display uploaded media in the gallery
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
        snapshot.forEach(doc => {
            const media = doc.data();
            if (media.type === 'image') {
                gallery.innerHTML += `
                    <div class="media-card" style="border-radius:16px;overflow:hidden;box-shadow:var(--shadow-md);">
                        <img src="${media.url}" alt="${media.caption || ''}" 
                             style="width:100%;height:200px;object-fit:cover;display:block;">
                        <div style="padding:12px;">
                            <p style="font-size:0.9rem;color:var(--dark);margin-bottom:4px;">${media.caption || ''}</p>
                            <small style="color:var(--gray);">by ${media.uploaderName}</small>
                        </div>
                    </div>
                `;
            } else if (media.type === 'video') {
                gallery.innerHTML += `
                    <div class="media-card" style="border-radius:16px;overflow:hidden;box-shadow:var(--shadow-md);">
                        <video controls style="width:100%;height:200px;object-fit:cover;display:block;background:#000;">
                            <source src="${media.url}">
                        </video>
                        <div style="padding:12px;">
                            <p style="font-size:0.9rem;color:var(--dark);margin-bottom:4px;">${media.caption || ''}</p>
                            <small style="color:var(--gray);">by ${media.uploaderName}</small>
                        </div>
                    </div>
                `;
            }
        });

    } catch (error) {
        console.error('Error loading media:', error);
    }
}

loadMediaGallery();

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
        card.style.display = (title.includes(input) || text.includes(input)) ? "grid" : "none";
    });
    document.getElementById('jobs').scrollIntoView({ behavior: 'smooth' });
}

// Job application
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
        showNotification('Failed to submit application. Try again.', 'error');
        btn.innerText = original;
        btn.disabled = false;
    }
}

window.handleJobPost = async function(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
        showNotification('Please sign in to post a job', 'info');
        closeModal('postJobModal');
        openModal('loginModal');
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

async function loadJobsFromFirestore() {
    const jobsContainer = document.getElementById('job-list-container');
    if (!jobsContainer) return;

    try {
        const q = query(collection(db, "jobs"), orderBy("postedAt", "desc"));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        jobsContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const job = doc.data();
            jobsContainer.innerHTML += `
                <div class="job-card" data-title="${job.title}">
                    <div class="job-header">
                        <div class="company-logo"><i class="ph-fill ph-buildings"></i></div>
                        <div>
                            <h4>${job.title}</h4>
                            <p>${job.company}</p>
                        </div>
                    </div>
                    <div class="job-tags">
                        <span class="tag">${job.location}</span>
                        <span class="tag">${job.salary}</span>
                    </div>
                    <p style="color:var(--gray);font-size:0.9rem;margin:10px 0;">${job.description.substring(0, 100)}...</p>
                    <button class="btn btn-outline" onclick="openApplyModal('${job.title}')">Apply Now</button>
                </div>
            `;
        });
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
}

loadJobsFromFirestore();

// Notification system
function showNotification(message, type = 'success') {
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    const notification = document.createElement('div');
    notification.style.cssText = `
        position:fixed;top:100px;right:30px;background:${colors[type]};color:white;
        padding:15px 25px;border-radius:12px;box-shadow:var(--shadow-xl);z-index:3000;
        animation:slideIn 0.3s ease;font-weight:500;display:flex;align-items:center;gap:10px;
    `;
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