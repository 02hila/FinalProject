# TODO: Fix Login Error Handling for Incorrect Passwords

## Approved Plan
1. In server/routes/auth.js: Use the trimmed password for bcrypt.compare to handle passwords with trailing spaces.
2. In client/src/context/AuthContext.jsx: Add try-catch around res.json() to handle cases where the response might not be valid JSON.
3. In client/src/pages/Login.jsx: Trim the password before sending to the server.

## Implementation Steps
- [x] Update server/routes/auth.js to use trimmedPassword in bcrypt.compare
- [x] Update client/src/context/AuthContext.jsx to add try-catch around res.json()
- [ ] Update client/src/pages/Login.jsx to trim the password before passing to handleLogin
