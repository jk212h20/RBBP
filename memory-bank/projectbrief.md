# Roatan Poker League - Project Brief

## Project Overview
A full-featured pub poker league management website for tracking tournaments, players, and standings across multiple venues in Roatan.

## Core Requirements

### User Management
- User registration and authentication (email/password)
- Multiple user roles: Admin, Venue Manager, Tournament Director, Player
- Player profiles with avatars and statistics

### Event Management
- Create and manage poker tournament events
- Player signup/registration for events
- Tournament director controls for running events
- Results entry and validation

### Scoring System
- Points-based ranking system
- Configurable points structure per season
- Knockout bonuses
- Season standings and leaderboards

### Venue Management
- Multiple venue support
- Venue-specific event scheduling
- Venue manager dashboards

### Social Features
- Player profiles and achievements
- Comments on events
- Achievement/badge system

### Season Management
- Season creation and configuration
- Playoff qualification tracking
- Finals bracket management

### Notifications
- Email notifications for events and results
- Event reminders
- Achievement notifications

## Technology Stack
- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS
- **Backend**: Node.js + Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + bcrypt
- **Email**: Nodemailer with SendGrid

## Target Users
1. **Players** - Poker enthusiasts in Roatan
2. **Venue Owners** - Pubs/bars hosting poker nights
3. **Tournament Directors** - People running individual events
4. **League Administrators** - Overall league management

## Success Criteria
- Easy event signup process
- Real-time leaderboard updates
- Mobile-responsive design
- Reliable email notifications
- Scalable for multiple venues and seasons
