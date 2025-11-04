# 🎮 XP Gamification System

A comprehensive experience point (XP) system that rewards visitors for exploring and interacting with your portfolio website.

## 📋 Overview

The XP system tracks user interactions and rewards them with points for various actions. Users level up as they earn XP, with smooth animations and a persistent progress tracker.

## ✨ Features

### Core Functionality
- **Persistent XP Tracking**: Uses localStorage to maintain user progress across sessions
- **Level System**: Exponential leveling (100, 200, 400, 800... XP per level)
- **Cooldown System**: Prevents XP farming with per-action cooldowns
- **Backend Logging**: Optional analytics tracking via PostgreSQL
- **Floating Widget**: Collapsible UI showing level, progress, and recent activity

### XP Sources (40+ Events)

#### Section Visits (10-100 XP)
- `visited_home` - 10 XP (1min cooldpwn)
- `visited_about` - 50 XP (1hr cooldown)
- `visited_skills` - 50 XP (1hr cooldown)
- `visited_projects` - 100 XP (1hr cooldown)
- `visited_contact` - 50 XP (1hr cooldown)

#### Scrolling Engagement (15-50 XP)
- `scroll_depth_25` - 15 XP (30min cooldown)
- `scroll_depth_50` - 25 XP (30min cooldown)
- `scroll_depth_75` - 35 XP (30min cooldown)
- `scroll_depth_100` - 50 XP (30min cooldown)

#### Time on Site (20-100 XP)
- `time_on_site_1min` - 20 XP (once per session)
- `time_on_site_3min` - 40 XP (once per session)
- `time_on_site_5min` - 60 XP (once per session)
- `time_on_site_10min` - 100 XP (once per session)

#### Interactions (5-40 XP)
- `clicked_project_card` - 30 XP (5min cooldown)
- `clicked_github_link` - 40 XP (10min cooldown)
- `clicked_linkedin` - 40 XP (10min cooldown)
- `clicked_external_link` - 25 XP (5min cooldown)
- `hovered_skill_badge` - 5 XP (1min cooldown, requires 1s hover)

#### Contact Form (10-200 XP)
- `opened_contact_form` - 20 XP (1hr cooldown)
- `filled_contact_field` - 10 XP (2min cooldown)
- `submitted_contact_form` - 200 XP (24hr cooldown)

#### Theme & UI (10-15 XP)
- `toggled_theme` - 15 XP (5min cooldown)
- `opened_mobile_menu` - 10 XP (5min cooldown)

#### Achievements (50-150 XP)
- `visited_all_sections` - 150 XP (once)
- `return_visitor` - 50 XP (12hr cooldown)
- `night_owl` - 75 XP (10pm-6am, 24hr cooldown)
- `early_bird` - 75 XP (5am-8am, 24hr cooldown)
- `speed_reader` - 100 XP (visit all sections < 2min)

#### Easter Eggs (150-500 XP)
- `konami_code` - 500 XP (↑↑↓↓←→←→BA)
- `found_secret_message` - 250 XP
- `triple_click_logo` - 150 XP (triple-click on name/logo)

#### Content Engagement (20-40 XP)
- `read_about_section` - 40 XP (1hr cooldown)
- `read_project_description` - 35 XP (5min cooldown)
- `viewed_code_window` - 25 XP (1hr cooldown)
- `watched_animation_complete` - 30 XP (30min cooldown)

## 🏗️ Architecture

### Frontend Components

#### `js/xpSystem.js`
Core XP management system:
- XP tracking and level calculation
- Cooldown management
- localStorage persistence
- Event logging
- Backend API integration (optional)

#### `js/xpWidget.js`
Visual UI component:
- Floating widget with level display
- Animated progress bar
- Recent activity log
- Level-up celebrations with particles
- Collapsible interface

#### `js/xpTracker.js`
Automatic event tracking:
- Intersection Observer for section tracking
- Scroll depth detection
- Time-on-site monitoring
- Click and hover listeners
- Easter egg detection
- Special condition checking (time of day, etc.)

#### `css/xpWidget.css`
Polished UI styling:
- Glassmorphic design
- Smooth animations
- Responsive layout
- Dark/light theme support
- Level-up overlay effects

### Backend Components

#### `routes/xp.js`
Express API endpoints:
- `POST /api/xp` - Log XP events
- `GET /api/xp/summary` - Get daily summary
- `GET /api/xp/leaderboard` - Optional leaderboard

#### `database/schema.sql`
PostgreSQL schema:
- `xp_events` table for event logging
- `xp_daily_summary` view for analytics
- Indexes for performance

## 🚀 Installation & Setup

### 1. Database Migration
Run the database migration to create XP tables:
```bash
npm run db:migrate
```

### 2. Restart Server
The XP routes are automatically registered:
```bash
npm start
```

### 3. Test the System
Visit your site and start exploring! The XP widget should appear in the bottom-right corner.

## 🎯 Usage

### User Experience
1. **Initial Visit**: Users earn 10 XP immediately
2. **Exploration**: Navigate through sections to earn XP
3. **Engagement**: Interact with elements (hover, click, scroll)
4. **Level Up**: Reach thresholds to level up with celebration animations
5. **Return Visits**: Earn bonus XP for coming back

### For Developers

#### Manual XP Award
```javascript
import xpSystem from './js/xpSystem.js';

// Award custom XP
xpSystem.addXP('custom_event_name', 50);

// Get current level
const level = xpSystem.getLevel();

// Get XP progress
const progress = xpSystem.getLevelProgress();
```

#### Add New XP Event
1. Add to `xpConfig` in `xpSystem.js`:
```javascript
my_custom_event: { xp: 100, cooldown: 300000 } // 5min cooldown
```

2. Trigger in `xpTracker.js` or your code:
```javascript
xpSystem.addXP('my_custom_event', null);
```

## 📊 Analytics

### View XP Data
Access the backend API to see XP analytics:

```bash
# Today's summary
curl http://localhost:3000/api/xp/summary

# Leaderboard (top 10, this week)
curl http://localhost:3000/api/xp/leaderboard?timeframe=week&limit=10
```

### Database Queries
```sql
-- Total XP earned today
SELECT SUM(xp) FROM xp_events WHERE created_at >= CURRENT_DATE;

-- Most popular events
SELECT event, COUNT(*), SUM(xp)
FROM xp_events
GROUP BY event
ORDER BY COUNT(*) DESC;

-- Daily XP trends
SELECT * FROM xp_daily_summary ORDER BY date DESC LIMIT 30;
```

## 🎨 Customization

### Level Titles
Edit titles in `xpSystem.js`:
```javascript
getLevelTitle(level) {
  const titles = [
    'Visitor', 'Explorer', 'Enthusiast', 'Master', ...
  ];
  return titles[level] || titles[titles.length - 1];
}
```

### XP Amounts
Adjust values in `xpConfig` object:
```javascript
visited_projects: { xp: 100, cooldown: 3600000 }
//                      ^^^- Change this value
```

### Cooldown Times
Modify cooldowns (in milliseconds):
```javascript
// 1 minute = 60000
// 5 minutes = 300000
// 1 hour = 3600000
// 1 day = 86400000
```

### Widget Position
Edit `css/xpWidget.css`:
```css
.xp-widget {
  bottom: 20px;  /* Distance from bottom */
  right: 20px;   /* Distance from right */
}
```

## 🛡️ Anti-Farming Measures

The system includes multiple safeguards:
- **Per-event cooldowns**: Prevents spamming actions
- **Session-based tracking**: Some events only trigger once per session
- **Maximum XP limits**: Backend validates XP amounts (max 500 per event)
- **Realistic thresholds**: Hover events require actual engagement time

## 📱 Responsive Design

The XP widget adapts to all screen sizes:
- **Desktop**: Full-size widget with all features
- **Tablet**: Slightly smaller, maintains all functionality
- **Mobile**: Compact design, positioned to avoid nav conflicts

## 🌙 Theme Support

Automatically adapts to light/dark theme:
- Uses CSS variables from your existing theme
- Smooth transitions on theme toggle
- Maintains readability in both modes

## 🐛 Debugging

Enable debug mode in console:
```javascript
// View current XP data
console.log(xpSystem.getData());

// View cooldown status
console.log(xpSystem.cooldowns);

// Reset XP (testing only)
xpSystem.resetXP();
```

## 🚧 Future Enhancements

Potential additions:
- User accounts with persistent global progress
- Multiplayer leaderboard with real names
- Daily challenges and streak bonuses
- Badges and achievements system
- XP rewards/unlocks (themes, Easter eggs)
- Social sharing of levels
- Weekly/monthly XP contests

## 📝 License

Part of the portfolio website project. Feel free to adapt for your own use!

## 🙋 Support

If XP isn't tracking:
1. Check browser console for errors
2. Verify localStorage is enabled
3. Ensure all script modules are loading
4. Check database connection (backend logging is optional)

---

**Built with**: Vanilla JS, Express.js, PostgreSQL
**Dependencies**: None! Pure ES6 modules
**Browser Support**: Modern browsers with ES6 module support
