# User Management API Testing Instructions

## Prerequisites
- Make sure the server is running on http://localhost:3000
- The application uses SQLite database, not MongoDB

## Test Commands

### Step #1: Create a new user
**Action:** Run the following cURL command:
```bash
curl -X POST http://localhost:3000/api/users -H 'Content-Type: application/json' -d '{"email": "testuser@example.com", "password": "securePassword123", "name": "Test User", "role": "user"}'
```

**For PowerShell users, use this format:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/users" -Method Post -ContentType "application/json" -Body '{"email": "testuser@example.com", "password": "securePassword123", "name": "Test User", "role": "user"}'
```

**Expected result:** You should see a response with the new user's details, including email, name, role, and the user ID. The response should have a success status of true and a status code of 201.

### Step #2: Check if the user was created in SQLite
**Action:** Since we're using SQLite, you can check the database file directly or look at the server logs to confirm user creation.

**Alternative - List all users (if endpoint exists):**
```bash
curl http://localhost:3000/api/users
```

**Expected result:** Server logs should show the user creation process, and you should see confirmation that the user was saved with an ID.

### Step #3: Get user details by ID
**Action:** Copy the user ID from the previous step's response and run the following cURL command (replace 'USER_ID' with the actual user ID):
```bash
curl http://localhost:3000/api/users/USER_ID
```

**For PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/users/USER_ID" -Method Get
```

**Expected result:** You should see a response with the user's details, including email, name, role, and other fields. The response should have a success status of true and a status code of 200.

### Step #4: Test validation - missing required fields
**Action:** Run the following cURL command to attempt creating a user with missing email and password fields:
```bash
curl -X POST http://localhost:3000/api/users -H 'Content-Type: application/json' -d '{"name": "No Email User", "role": "user"}'
```

**For PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/users" -Method Post -ContentType "application/json" -Body '{"name": "No Email User", "role": "user"}'
```

**Expected result:** You should see an error response indicating that email and password are required. The response should have a status code of 400.

### Step #5: Test non-existent user retrieval
**Action:** Run the following cURL command to attempt to retrieve a non-existent user:
```bash
curl http://localhost:3000/api/users/nonexistentid
```

**For PowerShell:**
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/users/nonexistentid" -Method Get
```

**Expected result:** You should see an error response indicating that the user was not found. The response should have a status code of 404.

## Notes
- All requests and responses will be logged in the server console for debugging
- The database uses SQLite, so MongoDB commands won't work
- Make sure to use the correct Content-Type header: "application/json"
- For PowerShell users, use Invoke-RestMethod instead of curl for better compatibility