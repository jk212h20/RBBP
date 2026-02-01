# Roatan Poker League - Progress

## 🎉 Current Status: PHASE 2 COMPLETE + TD FEATURES

### Live URLs
- **Frontend**: https://client-production-41b3.up.railway.app
- **Backend API**: https://rbbp-production.up.railway.app/api
- **GitHub**: https://github.com/jk212h20/RBBP

---

## ✅ What Works

### Authentication System
- [x] **Email/Password Login** - Fully working
- [x] **Email/Password Registration** - Fully working  
- [x] **Lightning Login (LNURL-auth)** - Fully working ⚡ (auto-shows QR)
- [x] **Profile Editing** - Users can update name/email (especially for Lightning users)
- [ ] **Google OAuth** - UI ready, awaiting Google credentials

### Backend (Express.js + PostgreSQL)
- [x] Server deployed to Railway
- [x] PostgreSQL database connected
- [x] Prisma ORM with full schema
- [x] JWT token authentication
- [x] Health check endpoint
- [x] CORS configured for client
- [x] **Venues API** - Full CRUD
- [x] **Seasons API** - Full CRUD with standings
- [x] **Events API** - Full CRUD with signups/results
- [x] **Profile Update API** - PUT /api/auth/profile

### Frontend (Next.js 16)
- [x] Client deployed to Railway
- [x] Homepage with upcoming events & top players
- [x] Login page with auto Lightning QR
- [x] Registration page
- [x] Dashboard (protected route)
- [x] **Events list page** - With season filtering
- [x] **Event detail page** - With signup/cancel
- [x] **Leaderboard page** - Season standings
- [x] **Profile page** - With edit functionality for name/email
- [x] **Tournament Director Panel** - Results entry UI on event page
- [x] Auth callback handler
- [x] Responsive design

### Tournament Director Features
- [x] TD Panel visible on event detail page (for TD/Admin/Venue Manager)
- [x] Event status controls (Scheduled → Registration Open → In Progress)
- [x] Attendance tracking (mark who showed up)
- [x] Position entry for each player
- [x] Knockout tracking
- [x] Save Draft (editable results)
- [x] Finalize Results (locks results, updates standings)

### Database Schema
All tables created:
- `users` - User accounts with multi-auth support
- `profiles` - User profiles/stats
- `venues` - Poker venues
- `seasons` - League seasons with points config
- `events` - Tournament events
- `event_signups` - Registrations
- `results` - Tournament results
- `standings` - Season standings (auto-calculated)
- `achievements` - Badges
- `user_achievements` - Earned badges
- `lightning_challenges` - LNURL-auth challenges
- `comments` - Event comments

---

## 🚧 What's Left to Build

### Authentication
- [ ] Google OAuth (needs CLIENT_ID & CLIENT_SECRET from Google Console)

### Admin Features
- [x] Admin dashboard for managing venues/seasons/events
- [x] User role management UI
- [x] Result entry interface (via TD Panel)

### User Features
- [x] User profile page with stats
- [x] Event history
- [ ] Achievement/badge display

### Nice to Have
- [ ] Email notifications
- [ ] Event comments
- [ ] Mobile app (React Native)

---

## API Endpoints Summary

### Auth (`/api/auth`)
- POST /register - Create account
- POST /login - Email/password login
- GET /me - Get current user
- PUT /profile - Update user profile (name, email)
- GET /lightning/challenge - Get LNURL QR
- GET /lightning/callback - Wallet callback
- GET /lightning/status/:k1 - Check auth status
- GET /google - Start Google OAuth
- GET /google/callback - Google callback

### Venues (`/api/venues`)
- GET / - List venues
- GET /:id - Get venue
- POST / - Create (Admin)
- PUT /:id - Update (Admin/Manager)
- DELETE /:id - Delete (Admin)

### Seasons (`/api/seasons`)
- GET / - List seasons
- GET /current - Active season
- GET /:id - Season details
- GET /:id/standings - Leaderboard
- POST / - Create (Admin)
- PUT /:id - Update (Admin)
- PUT /:id/activate - Set active
- POST /:id/recalculate - Recalc standings

### Events (`/api/events`)
- GET / - List events
- GET /upcoming - Upcoming events
- GET /my - User's events
- GET /:id - Event details
- POST / - Create (Admin/Director)
- PUT /:id - Update
- PUT /:id/status - Update status
- DELETE /:id - Delete (Admin)
- POST /:id/signup - Register
- DELETE /:id/signup - Cancel
- GET /:id/signups - Get players
- PUT /:id/checkin/:userId - Check in
- POST /:id/results - Enter results
- GET /:id/results - Get results

---

## Technical Notes

### Environment Variables (Railway - RBBP Server)
```
DATABASE_URL=<auto-set by Railway>
JWT_SECRET=<set>
JWT_REFRESH_SECRET=<set>
SESSION_SECRET=<set>
CORS_ORIGIN=https://client-production-41b3.up.railway.app
LIGHTNING_AUTH_URL=https://rbbp-production.up.railway.app/api/auth/lightning
```

### Environment Variables (Railway - Client)
```
NEXT_PUBLIC_API_URL=https://rbbp-production.up.railway.app/api
```

### Points Structure (Default)
```json
{
  "1": 100,
  "2": 80,
  "3": 65,
  "4": 55,
  "5": 45,
  "6": 40,
  "7": 35,
  "8": 30,
  "9": 25,
  "10": 20,
  "11-15": 15,
  "16-20": 10,
  "21+": 5,
  "knockout": 2,
  "participation": 5
}
```

---

## Recent Changes (Feb 1, 2026)

### Latest Updates
1. **Removed "Become Admin" button** from profile page (admin already exists)
2. **Removed "multi-provider authentication" text** from dashboard
3. **Added profile editing** - Users can now update their name and email
   - Especially useful for Lightning users who get auto-generated names
   - Backend: PUT /api/auth/profile endpoint
   - Frontend: Edit Profile button on profile page
4. **Tournament Director Results Entry UI**
   - TD Panel on event detail page (visible to TD/Admin/Venue Manager)
   - Event status controls (change between Scheduled/Registration Open/In Progress)
   - Attendance tracking with checkboxes
   - Position entry for each player who attended
   - Knockout counter (+/- buttons)
   - Save Draft button (saves results but keeps event editable)
   - Finalize Results button (locks results, marks event COMPLETED, updates standings)

### Phase 2 Implementation (Earlier)
1. Created Venues API with full CRUD
2. Created Seasons API with standings management
3. Created Events API with signups and results
4. Automatic points calculation from season config
5. Standings auto-recalculate on result entry
6. Events list page with season filtering
7. Event detail page with signup/cancel
8. Leaderboard page with season standings
9. Updated homepage with live data
10. Login page auto-shows Lightning QR
