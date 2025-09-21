# VideoReel App

A Tinder-Instagram Reels hybrid video app with algorithmic content recommendation based on user interactions.

## Features

- 🎥 **Video Feed**: Swipe through videos like Tinder, scroll like Instagram Reels
- 🤖 **Smart Algorithm**: Learns your preferences based on interactions
- 👤 **User Authentication**: Simple email/password registration and login
- 📊 **Preference Tracking**: View your category preferences and scores
- 📱 **Mobile-First Design**: Responsive design that works on all devices
- 📁 **Dynamic Categories**: Categories automatically created based on folder names

## How the Algorithm Works

The app uses a simple but effective scoring system:

- **👍 Like (Thumbs Up)**: +1 point to category
- **📱 Scroll Down**: +0.5 points (mild interest)
- **✕ Dislike (X Button)**: -1 point
- **👈 Swipe Left**: -2 points (really don't like)

Videos are served using weighted random selection based on your category scores. Higher scores = more likely to see videos from that category.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. **Install backend dependencies:**
   ```bash
   cd video-reel-app
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd client
   npm install
   ```

### Adding Videos

1. Navigate to the `video-reel-app/videos/` directory
2. Create folders with category names (e.g., `Comedy`, `Dance`, `Food`, `Sports`, `Music`)
3. Drop your video files into these folders
4. Supported formats: **MP4**, **AVI**, **WebM**

Example folder structure:
```
video-reel-app/
├── videos/
│   ├── Comedy/
│   │   ├── funny-video1.mp4
│   │   └── funny-video2.mp4
│   ├── Dance/
│   │   ├── dance-video1.mp4
│   │   └── dance-video2.webm
│   ├── Food/
│   │   └── cooking-video1.avi
│   └── Music/
│       ├── music-video1.mp4
│       └── music-video2.mp4
```

### Running the Application

1. **Start the backend server:**
   ```bash
   npm run server
   ```
   The backend will run on `http://localhost:5000`

2. **Start the frontend (in a new terminal):**
   ```bash
   npm run client
   ```
   The frontend will run on `http://localhost:3000`

3. **Or run both together:**
   ```bash
   npm run dev
   ```

### Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Watch Videos**: Videos will be served based on available content
3. **Interact**: 
   - Click thumbs up 👍 to like
   - Click X ✕ to dislike
   - Scroll down 📱 for mild interest
   - Swipe left 👈 if you really don't like
   - Click video to pause/play
4. **View Preferences**: Check your preference scores in the Preferences page

## Project Structure

```
video-reel-app/
├── server.js                 # Express backend server
├── database.sqlite          # SQLite database (auto-created)
├── package.json             # Backend dependencies
├── .env                     # Environment variables
├── videos/                  # Video storage directory
│   ├── Comedy/             # Example category folder
│   ├── Dance/              # Example category folder
│   ├── Food/               # Example category folder
│   ├── Sports/             # Example category folder
│   └── Music/              # Example category folder
└── client/                 # React frontend
    ├── src/
    │   ├── components/
    │   │   ├── Login.js
    │   │   ├── Register.js
    │   │   ├── VideoFeed.js
    │   │   ├── Preferences.js
    │   │   └── *.css
    │   ├── App.js
    │   └── index.js
    └── package.json        # Frontend dependencies
```

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - Login user

### Videos & Preferences
- `GET /api/categories` - Get all video categories
- `GET /api/next-video` - Get next video based on algorithm
- `POST /api/interact` - Record user interaction with video
- `GET /api/preferences` - Get user's category preferences

## Database Schema

### Users
- `id`: Primary key
- `email`: User email (unique)
- `password`: Hashed password
- `created_at`: Account creation timestamp

### User Preferences
- `id`: Primary key
- `user_id`: Foreign key to users
- `category`: Video category name
- `score`: Preference score (starts at 1)

### Video Interactions
- `id`: Primary key
- `user_id`: Foreign key to users
- `video_path`: Path to video file
- `category`: Video category
- `interaction_type`: Type of interaction (like, dislike, scroll, hate)
- `created_at`: Interaction timestamp

## Customization

### Adding New Categories
Simply create new folders in the `videos/` directory. The app will automatically detect them and initialize user preferences.

### Changing Algorithm Weights
Edit the `scoreChanges` object in `server.js`:
```javascript
const scoreChanges = {
  'like': 1,      // thumbs up
  'scroll': 0.5,  // scroll down
  'dislike': -1,  // X button
  'hate': -2      // swipe left
};
```

### Environment Variables
Edit `.env` file:
- `PORT`: Server port (default: 5000)
- `JWT_SECRET`: JWT secret key for authentication
- `NODE_ENV`: Environment (development/production)

## Future Enhancements

- Cloud video storage integration
- Video upload functionality
- Social features (following, sharing)
- Advanced analytics dashboard
- Content moderation tools
- Push notifications
- Offline video caching

## Tech Stack

**Backend:**
- Node.js & Express
- SQLite database
- JWT authentication
- Multer for file handling
- bcryptjs for password hashing

**Frontend:**
- React
- React Router for navigation
- Axios for API calls
- CSS3 with modern features
- Responsive design

## License

MIT License - feel free to use this project for learning and development purposes.
