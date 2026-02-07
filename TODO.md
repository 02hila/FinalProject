# Delete User Feature Implementation

## Tasks
- [x] Add imports for models in server/routes/users.js
- [x] Add DELETE /api/users/:id endpoint in server/routes/users.js
- [x] Implement cascading deletes for all related data:
  - [x] PendingAd (agentId)
  - [x] Ad/Quote (agentId)
  - [x] QRScan (agentId)
  - [x] Payment (agentId)
  - [x] PriceProposal (agentId)
  - [x] AgentRating (agentId)
  - [x] Remove agent from Campaign.assignedAgents
- [x] Add proper authorization (user themselves or admin)
- [x] Add confirmation modal to AgentProfile.jsx
- [x] Update deleteAccount function to call API and handle logout
- [x] Test the deletion process
