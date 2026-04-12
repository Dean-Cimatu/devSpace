// user authentication and storage
class AuthHelper {
    constructor() {
        this.users = this.loadUsers();
        this.currentUser = this.loadCurrentUser();
    }

    loadUsers() {
        const users = localStorage.getItem('colosseumUsers');
        return users ? JSON.parse(users) : [];
    }

    saveUsers() {
        const json = JSON.stringify(this.users);
        localStorage.setItem('colosseumUsers', json);
        // Also mirror to users.json key for compatibility with other codepaths
        localStorage.setItem('users.json', json);
    }

    loadCurrentUser() {
        const user = localStorage.getItem('currentUser');
        return user ? JSON.parse(user) : null;
    }

    saveCurrentUser(user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUser = user;
    }

    clearCurrentUser() {
        localStorage.removeItem('currentUser');
        this.currentUser = null;
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validatePassword(password) {
        return password.length >= 6;
    }

    isUsernameAvailable(username) {
        return !this.users.some(user => user.username.toLowerCase() === username.toLowerCase());
    }

    isEmailAvailable(email) {
        return !this.users.some(user => user.email.toLowerCase() === email.toLowerCase());
    }

    // Creates new user account with validation
    register(userData) {
        const { username, email, password, dateOfBirth } = userData;
        if (!username || username.trim().length < 3) {
            return { success: false, message: 'Username must be at least 3 characters long.' };
        }

        if (!this.isUsernameAvailable(username)) {
            return { success: false, message: 'Username is already taken.' };
        }

        if (!email || !this.validateEmail(email)) {
            return { success: false, message: 'Please enter a valid email address.' };
        }

        if (!this.isEmailAvailable(email)) {
            return { success: false, message: 'Email is already registered.' };
        }

        if (!password || !this.validatePassword(password)) {
            return { success: false, message: 'Password must be at least 6 characters long.' };
        }

        // Age validation: require DOB and ensure at least 13 years old
        if (!dateOfBirth) {
            return { success: false, message: 'Date of birth is required.' };
        }
        const dobDate = new Date(dateOfBirth);
        if (isNaN(dobDate.getTime())) {
            return { success: false, message: 'Please enter a valid date of birth.' };
        }
        const today = new Date();
        // Prevent future dates
        if (dobDate > today) {
            return { success: false, message: 'Date of birth cannot be in the future.' };
        }
        // Calculate age threshold
        const threshold = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
        if (dobDate > threshold) {
            return { success: false, message: 'You must be at least 13 years old to register.' };
        }
        // Sanity check: prevent unrealistic ages (e.g., over 120 years old)
        const maxAge = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
        if (dobDate < maxAge) {
            return { success: false, message: 'Please enter a valid date of birth.' };
        }

        const newUser = {
            id: Date.now(),
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password: password,
            dateOfBirth: dateOfBirth || null,
            registeredAt: new Date().toISOString(),
            lastLogin: null,
            gamesPlayed: 0,
            highScore: 0
        };

        this.users.push(newUser);
        this.saveUsers();

        return { 
            success: true, 
            message: 'Registration successful! You can now log in.',
            user: { ...newUser, password: undefined }
        };
    }

    // Authenticates user and starts session
    login(username, password) {
        if (!username || !password) {
            return { success: false, message: 'Please enter both username and password.' };
        }

        const user = this.users.find(u => 
            (u.username.toLowerCase() === username.toLowerCase() || 
             u.email.toLowerCase() === username.toLowerCase()) &&
            u.password === password
        );

        if (!user) {
            return { success: false, message: 'Invalid username/email or password.' };
        }

        user.lastLogin = new Date().toISOString();
        this.saveUsers();
        this.saveCurrentUser({ ...user, password: undefined });

        return { 
            success: true, 
            message: 'Login successful!',
            user: { ...user, password: undefined }
        };
    }

    logout() {
        this.clearCurrentUser();
        return { success: true, message: 'Logged out successfully.' };
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    // Updates player stats after game ends
    updateUserStats(gamesPlayed = 0, score = 0) {
        if (!this.currentUser) return false;

        const userIndex = this.users.findIndex(u => u.id === this.currentUser.id);
        if (userIndex !== -1) {
            this.users[userIndex].gamesPlayed += gamesPlayed;
            if (score > this.users[userIndex].highScore) {
                this.users[userIndex].highScore = score;
            }
            this.saveUsers();
            
            this.currentUser = { ...this.users[userIndex], password: undefined };
            this.saveCurrentUser(this.currentUser);
            return true;
        }
        return false;
    }

    getLeaderboard() {
        return this.users
            .map(user => ({
                username: user.username,
                highScore: user.highScore,
                gamesPlayed: user.gamesPlayed,
                registeredAt: user.registeredAt
            }))
            .sort((a, b) => b.highScore - a.highScore)
            .slice(0, 10);
    }
}

const auth = new AuthHelper();
// Expose to browser global so module scripts (e.g., game.js) can call window.auth
if (typeof window !== 'undefined') {
    window.auth = auth;
}
// Support CommonJS export for testing or bundlers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthHelper;
}