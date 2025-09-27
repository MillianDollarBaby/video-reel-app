const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(express.json());
app.use('/videos', express.static('videos'));
app.use('/uploads', express.static('uploads'));

// Database setup
const db = new sqlite3.Database('./database.sqlite');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // User preferences table
  db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    category TEXT,
    score INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, category)
  )`);
  
  // Video interactions table
  db.run(`CREATE TABLE IF NOT EXISTS video_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    video_path TEXT,
    category TEXT,
    interaction_type TEXT, -- 'like', 'dislike', 'scroll', 'hate'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
  
  // Viewed videos table to track what user has seen
  db.run(`CREATE TABLE IF NOT EXISTS viewed_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    video_path TEXT,
    category TEXT, -- NULL for algorithmic mode, category name for category mode
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, video_path, category)
  )`);
  
  // Migration: Add category column to viewed_videos if it doesn't exist
  db.run(`PRAGMA table_info(viewed_videos)`, [], (err, rows) => {
    if (!err) {
      db.all(`PRAGMA table_info(viewed_videos)`, [], (err, columns) => {
        if (!err && columns) {
          const hasCategoryColumn = columns.some(col => col.name === 'category');
          if (!hasCategoryColumn) {
            console.log('Migrating viewed_videos table to add category column...');
            // Drop and recreate table with new schema
            db.run(`DROP TABLE IF EXISTS viewed_videos_backup`);
            db.run(`CREATE TABLE viewed_videos_backup AS SELECT * FROM viewed_videos`);
            db.run(`DROP TABLE viewed_videos`);
            db.run(`CREATE TABLE viewed_videos (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER,
              video_path TEXT,
              category TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users (id),
              UNIQUE(user_id, video_path, category)
            )`);
            db.run(`INSERT INTO viewed_videos (user_id, video_path, category, created_at) 
                    SELECT user_id, video_path, NULL, created_at FROM viewed_videos_backup`);
            db.run(`DROP TABLE viewed_videos_backup`);
            console.log('Database migration completed successfully.');
          }
        }
      });
    }
  });
});

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.sendStatus(401);
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Helper function to scan video folders
const scanVideoFolders = () => {
  const videosPath = path.join(__dirname, 'videos');
  const categories = [];
  
  try {
    if (!fs.existsSync(videosPath)) {
      fs.ensureDirSync(videosPath);
    }
    
    const folders = fs.readdirSync(videosPath, { withFileTypes: true });
    
    folders.forEach(folder => {
      if (folder.isDirectory()) {
        const categoryPath = path.join(videosPath, folder.name);
        const videoFiles = fs.readdirSync(categoryPath).filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.mp4', '.avi', '.webm'].includes(ext);
        });
        
        if (videoFiles.length > 0) {
          categories.push({
            name: folder.name,
            videos: videoFiles.map(file => ({
              filename: file,
              path: `/videos/${folder.name}/${file}`
            }))
          });
        }
      }
    });
  } catch (error) {
    console.error('Error scanning video folders:', error);
  }
  
  return categories;
};

// Helper function to initialize user preferences for all categories
const initializeUserPreferences = (userId, callback) => {
  const categories = scanVideoFolders();
  const queries = categories.map(category => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO user_preferences (user_id, category, score) VALUES (?, ?, 1)',
        [userId, category.name],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  });
  
  Promise.all(queries)
    .then(() => callback(null))
    .catch(err => callback(err));
};

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run('INSERT INTO users (email, password) VALUES (?, ?)', 
      [email, hashedPassword], 
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ message: 'User already exists' });
          }
          return res.status(500).json({ message: 'Error creating user' });
        }
        
        const userId = this.lastID;
        
        // Initialize preferences for all categories
        initializeUserPreferences(userId, (prefErr) => {
          if (prefErr) {
            console.error('Error initializing preferences:', prefErr);
          }
        });
        
        const token = jwt.sign({ userId, email }, JWT_SECRET);
        res.json({ token, user: { id: userId, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Server error' });
      }
      
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
      
      // Initialize preferences for any new categories
      initializeUserPreferences(user.id, (prefErr) => {
        if (prefErr) {
          console.error('Error updating preferences:', prefErr);
        }
      });
      
      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
      res.json({ token, user: { id: user.id, email: user.email } });
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Video routes
app.get('/api/categories', (req, res) => {
  const categories = scanVideoFolders();
  res.json(categories);
});

app.get('/api/next-video', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const requestedCategory = req.query.category;
  
  // DEBUG: Log the request details
  console.log(`\n=== VIDEO REQUEST DEBUG ===`);
  console.log(`User ID: ${userId}`);
  console.log(`Requested Category: ${requestedCategory ? requestedCategory : 'ALGORITHMIC MODE'}`);
  console.log(`Query params:`, req.query);
  console.log(`URL: ${req.url}`);
  console.log(`===============================\n`);
  
  // Get user preferences and viewed videos
  db.all('SELECT * FROM user_preferences WHERE user_id = ?', [userId], (err, preferences) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching preferences' });
    }
    
    // Get viewed videos - separate tracking for category mode vs algorithmic mode
    const viewedQuery = requestedCategory 
      ? 'SELECT video_path FROM viewed_videos WHERE user_id = ? AND category = ?'
      : 'SELECT video_path FROM viewed_videos WHERE user_id = ? AND category IS NULL';
    
    const viewedParams = requestedCategory ? [userId, requestedCategory] : [userId];
    
    db.all(viewedQuery, viewedParams, (err, viewedVideos) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching viewed videos' });
      }
      
      const viewedPaths = viewedVideos.map(v => v.video_path);
      const categories = scanVideoFolders();
      
      if (categories.length === 0) {
        return res.status(404).json({ message: 'No videos available' });
      }
      
      // Filter categories based on request
      let filteredCategories = categories;
      console.log(`DEBUG: All categories found:`, categories.map(c => c.name));
      
      if (requestedCategory) {
        console.log(`DEBUG: Filtering for category: "${requestedCategory}"`);
        // If specific category requested, filter to just that category
        filteredCategories = categories.filter(category => category.name === requestedCategory);
        console.log(`DEBUG: Filtered categories:`, filteredCategories.map(c => c.name));
        
        if (filteredCategories.length === 0) {
          console.log(`DEBUG: Category "${requestedCategory}" not found!`);
          return res.status(404).json({ message: `Category '${requestedCategory}' not found` });
        }
      } else {
        console.log(`DEBUG: Using all categories (algorithmic mode)`);
      }
      
      // Filter out already viewed videos
      const availableCategories = filteredCategories.map(category => ({
        ...category,
        videos: category.videos.filter(video => !viewedPaths.includes(video.path))
      })).filter(category => category.videos.length > 0);
      
      console.log(`DEBUG: Available categories after filtering viewed:`, availableCategories.map(c => `${c.name}(${c.videos.length} videos)`));
      
      if (availableCategories.length === 0) {
        // User has seen all videos - reset their viewed history for a fresh experience
        db.run('DELETE FROM viewed_videos WHERE user_id = ?', [userId], (err) => {
          if (err) {
            console.error('Error resetting viewed videos:', err);
          }
        });
        
        return res.status(200).json({ 
          message: 'All videos watched! Starting fresh.',
          resetViewed: true 
        });
      }
      
      let selectedVideo, selectedCategoryName;
      
      if (requestedCategory) {
        // Category mode: Simple random selection from the specific category
        const categoryVideos = availableCategories[0]; // We already filtered to just this category
        
        // Simple shuffle for variety within the category
        const videos = [...categoryVideos.videos];
        for (let i = videos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [videos[i], videos[j]] = [videos[j], videos[i]];
        }
        
        selectedVideo = videos[0];
        selectedCategoryName = categoryVideos.name;
      } else {
        // Algorithmic mode: Use preference-based weighted selection
        availableCategories.forEach(category => {
          // Fisher-Yates shuffle for true randomization
          for (let i = category.videos.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [category.videos[i], category.videos[j]] = [category.videos[j], category.videos[i]];
          }
        });
        
        // Create weighted selection based on user preferences with better distribution
        const weightedVideos = [];
        
        availableCategories.forEach(category => {
          const pref = preferences.find(p => p.category === category.name);
          const baseWeight = pref ? Math.max(1, Math.round(pref.score)) : 1;
          
          // Add videos from this category based on weight, but distribute evenly
          category.videos.forEach((video, index) => {
            // Give each video in preferred categories higher chance, but not all at once
            const videoWeight = Math.max(1, Math.floor(baseWeight / Math.max(1, Math.floor(index / 3))));
            for (let i = 0; i < videoWeight; i++) {
              weightedVideos.push({ video, category: category.name });
            }
          });
        });
        
        // Final shuffle of weighted videos
        for (let i = weightedVideos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [weightedVideos[i], weightedVideos[j]] = [weightedVideos[j], weightedVideos[i]];
        }
        
        // Select from shuffled weighted list
        const selected = weightedVideos[Math.floor(Math.random() * weightedVideos.length)];
        selectedVideo = selected.video;
        selectedCategoryName = selected.category;
      }
      
      // Mark this video as viewed with mode tracking
      db.run(
        'INSERT OR IGNORE INTO viewed_videos (user_id, video_path, category) VALUES (?, ?, ?)',
        [userId, selectedVideo.path, requestedCategory],
        (err) => {
          if (err) {
            console.error('Error marking video as viewed:', err);
          }
        }
      );
      
      res.json({
        video: selectedVideo,
        category: selectedCategoryName
      });
    });
  });
});

app.post('/api/interact', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { videoPath, category, interactionType } = req.body;
  
  // Score changes based on interaction type
  const scoreChanges = {
    'like': 1,      // thumbs up
    'scroll': 0.5,  // scroll down (half thumbs up)
    'dislike': -1,  // X button
    'hate': -2      // swipe left
  };
  
  const scoreChange = scoreChanges[interactionType] || 0;
  
  // Record interaction
  db.run(
    'INSERT INTO video_interactions (user_id, video_path, category, interaction_type) VALUES (?, ?, ?, ?)',
    [userId, videoPath, category, interactionType],
    (err) => {
      if (err) {
        console.error('Error recording interaction:', err);
      }
    }
  );
  
  // Update user preferences
  if (scoreChange !== 0) {
    db.run(
      'UPDATE user_preferences SET score = MAX(1, score + ?) WHERE user_id = ? AND category = ?',
      [scoreChange, userId, category],
      (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error updating preferences' });
        }
        res.json({ message: 'Interaction recorded' });
      }
    );
  } else {
    res.json({ message: 'Interaction recorded' });
  }
});

app.get('/api/preferences', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  db.all('SELECT * FROM user_preferences WHERE user_id = ? ORDER BY score DESC', [userId], (err, preferences) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching preferences' });
    }
    res.json(preferences);
  });
});

// Create initial video folders if they don't exist
const createInitialFolders = () => {
  const videosPath = path.join(__dirname, 'videos');
  const initialCategories = ['Comedy', 'Dance', 'Food', 'Sports', 'Music'];
  
  fs.ensureDirSync(videosPath);
  
  initialCategories.forEach(category => {
    const categoryPath = path.join(videosPath, category);
    fs.ensureDirSync(categoryPath);
    
    // Create a README file in each folder
    const readmePath = path.join(categoryPath, 'README.txt');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, `Place your ${category} videos here.\nSupported formats: MP4, AVI, WebM`);
    }
  });
};

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.json({ 
    message: 'Video Reel API Server is running!',
    status: 'healthy',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Initialize folders on startup
createInitialFolders();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Video folders created at: ${path.join(__dirname, 'videos')}`);
});
