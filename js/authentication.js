/**
 * Authentication Module for Aéra Link WebGIS
 * Handles Supabase authentication, user sessions, and login/logout functionality
 */

// Supabase Configuration
const SUPABASE_URL = 'https://xravncpxynlzzewsqawh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyYXZuY3B4eW5senpld3NxYXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NDk5MTEsImV4cCI6MjA2ODQyNTkxMX0.2IE-dzQDVvq8b9u7C0oqy35FwVVMu96OGHBOYQEMSZw';
let supabase;
let currentUser = null;

// Initialize Supabase client
function initializeSupabase() {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client initialized successfully');
        
        // Update global variables
        updateGlobalAuthVars();
        
        // Show warning about missing user_id column
        console.warn(`
⚠️  IMPORTANT: Your layers table is missing the 'user_id' column.
This means layers won't be properly isolated per user.

To fix this, run this SQL in your Supabase SQL Editor:

ALTER TABLE layers ADD COLUMN user_id UUID REFERENCES auth.users(id);
ALTER TABLE layers ALTER COLUMN user_id SET NOT NULL;

-- Enable Row Level Security
ALTER TABLE layers ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view own layers" ON layers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own layers" ON layers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own layers" ON layers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own layers" ON layers FOR DELETE USING (auth.uid() = user_id);
        `);
        
        console.log('Make sure you have created the "layers" table in your Supabase database with the following SQL:');
        console.log(`
CREATE TABLE layers (
  id SERIAL PRIMARY KEY,
  layer_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  geojson_data JSONB NOT NULL,
  style JSONB,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS (Row Level Security) policies
ALTER TABLE layers ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own layers
CREATE POLICY "Users can view own layers" ON layers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own layers" ON layers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own layers" ON layers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own layers" ON layers FOR DELETE USING (auth.uid() = user_id);
        `);
        return true;
    } catch (error) {
        console.error('Error initializing Supabase:', error);
        return false;
    }
}

// Authentication Functions

// Check if user is logged in
async function checkAuthState() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Error checking auth state:', error);
            return null;
        }
        
        if (session && session.user) {
            currentUser = session.user;
            updateGlobalAuthVars();
            console.log('User is logged in:', currentUser.email);
            return session.user;
        }
        
        return null;
    } catch (error) {
        console.error('Error checking auth state:', error);
        return null;
    }
}

// Sign in user
async function signInUser(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            throw error;
        }

        if (data.user) {
            currentUser = data.user;
            updateGlobalAuthVars();
            console.log('User signed in successfully:', currentUser.email);
            return { success: true, user: data.user };
        }

        return { success: false, error: 'No user data received' };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

// Sign out user
async function signOutUser() {
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            throw error;
        }

        currentUser = null;
        updateGlobalAuthVars();
        console.log('User signed out successfully');
        showLoginPage();
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

// Show/Hide Login Page
function showLoginPage() {
    document.getElementById('loginContainer').style.display = 'flex';
    document.getElementById('webgisContainer').style.display = 'none';
}

function hideLoginPage() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('webgisContainer').style.display = 'flex';
}

// Setup login page event listeners
function setupLoginListeners() {
    const loginForm = document.getElementById('loginForm');
    const loginButton = document.getElementById('loginButton');
    const errorMessage = document.getElementById('errorMessage');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const passwordToggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('password');
    const passwordToggleIcon = document.getElementById('passwordToggleIcon');

    // Password visibility toggle functionality
    passwordToggle.addEventListener('click', function(e) {
        e.preventDefault();
        
        if (passwordInput.type === 'password') {
            // Show password
            passwordInput.type = 'text';
            passwordToggleIcon.classList.remove('fa-eye');
            passwordToggleIcon.classList.add('fa-eye-slash');
        } else {
            // Hide password
            passwordInput.type = 'password';
            passwordToggleIcon.classList.remove('fa-eye-slash');
            passwordToggleIcon.classList.add('fa-eye');
        }
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Validate inputs
        if (!email || !password) {
            showError('Please fill in all fields.');
            return;
        }

        // Show loading state
        setLoginLoading(true);
        hideError();

        // Attempt sign in
        const result = await signInUser(email, password);

        if (result.success) {
            // Success - redirect to WebGIS
            const user = result.user;
            
            // Initialize user interface with profile mapping
            if (typeof initializeUserInterface === 'function') {
                initializeUserInterface(user);
            }
            
            hideLoginPage();
            initializeWebGIS();
            
            // Refresh permanent layer symbology after authentication
            setTimeout(async () => {
                if (typeof window.refreshPermanentLayerSymbology === 'function') {
                    console.log('🔄 Refreshing permanent layer symbology after login...');
                    await window.refreshPermanentLayerSymbology();
                }
            }, 2000); // Wait a bit for layers to load first
            
            // Setup global escape handler after login
            if (typeof setupGlobalEscapeHandler === 'function') {
                setupGlobalEscapeHandler();
            }
        } else {
            // Show error
            setLoginLoading(false);
            showError(result.error || 'Sign in failed. Please try again.');
        }
    });

    // Handle forgot password link (placeholder)
    forgotPasswordLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await showAlert('Password reset functionality will be implemented soon. Please contact your administrator.', 'Feature Not Available');
    });

    // Helper functions for login UI
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }

    function setLoginLoading(loading) {
        const loginButton = document.getElementById('loginButton');
        
        if (loading) {
            loginButton.disabled = true;
            loginButton.innerHTML = '<div class="loading-spinner"></div>Signing in...';
        } else {
            loginButton.disabled = false;
            loginButton.innerHTML = 'Sign In to WebGIS';
        }
    }
}

// Setup logout functionality
function setupLogoutListener() {
    const logoutButton = document.getElementById('logoutButton');
    if (!logoutButton) {
        console.error('Logout button not found');
        return;
    }
    
    // Remove any existing listeners
    logoutButton.removeEventListener('click', handleLogout);
    
    async function handleLogout() {
        try {
            console.log('Logout button clicked');
            const confirmed = await showConfirm('Are you sure you want to logout?', 'Logout Confirmation');
            console.log('Logout confirmation result:', confirmed);
            
            if (confirmed) {
                console.log('User confirmed logout, signing out...');
                const result = await signOutUser();
                if (!result.success) {
                    console.error('Logout error:', result.error);
                    await showError('Error logging out: ' + result.error, 'Logout Error');
                } else {
                    console.log('Logout successful');
                }
            } else {
                console.log('User cancelled logout');
            }
        } catch (error) {
            console.error('Error in logout handler:', error);
            await showError('Unexpected error during logout: ' + error.message, 'Logout Error');
        }
    }
    
    // Add the event listener
    logoutButton.addEventListener('click', handleLogout);
    console.log('Logout listener setup complete');
}

// Make authentication functions globally available
window.initializeSupabase = initializeSupabase;
window.checkAuthState = checkAuthState;
window.signInUser = signInUser;
window.signOutUser = signOutUser;
window.showLoginPage = showLoginPage;
window.hideLoginPage = hideLoginPage;
window.setupLoginListeners = setupLoginListeners;
window.setupLogoutListener = setupLogoutListener;

// User profile mapping based on email addresses
function getUserProfileFromEmail(email) {
    const profileMappings = {
        'enage.isaac@akl.com.ph': { avatar: 'I', name: 'Isaac Enage' },
        'enage.isaac@ayalaland.com.ph': { avatar: 'I', name: 'Isaac Enage' },
        'santos.dom@ayalaland.com.ph': { avatar: 'D', name: 'Dom Santos' },
        'tabangay.rona@ayalaland.com.ph': { avatar: 'R', name: 'Rona Tabangay' },
        'taboso.charlotte@ayalaland.com.ph': { avatar: 'C', name: 'Charlotte' },
        'ortiz.marvin@akl.com.ph': { avatar: 'M', name: 'Marvin Ortiz' },
        'juarez.ang@ayalaland.com.ph': { avatar: 'A', name: 'Angelo Suarez' }
    };
    
    console.log('Getting profile for email:', email);
    const profile = profileMappings[email.toLowerCase()];
    if (profile) {
        console.log('Found profile mapping:', profile);
        return profile;
    }
    
    // Default fallback for unmapped emails
    const firstLetter = email.charAt(0).toUpperCase();
    const nameFromEmail = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    const fallbackProfile = {
        avatar: firstLetter,
        name: nameFromEmail
    };
    
    console.log('Using fallback profile:', fallbackProfile);
    return fallbackProfile;
}

// Make currentUser and supabase globally accessible
window.getCurrentUser = () => currentUser;
window.getSupabase = () => supabase;
window.getUserProfileFromEmail = getUserProfileFromEmail;

// Also set them as direct global variables for backward compatibility
window.currentUser = null;
window.supabase = null;

// Update global variables when authentication state changes
function updateGlobalAuthVars() {
    window.currentUser = currentUser;
    window.supabase = supabase;
}
