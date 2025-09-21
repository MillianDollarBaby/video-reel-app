 import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './VideoFeed.css';

// Import the CRT frame image
import crtFrame from './frame.png';

const VideoFeed = ({ user, onLogout }) => {
  const [currentVideo, setCurrentVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [videoSize, setVideoSize] = useState({ width: '70%', height: '60%' });
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null); // null = algorithmic mode
  const [categoryFeeds, setCategoryFeeds] = useState({}); // Separate video queues for each category
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0); // Track position in category feed
  
  // Advanced video control states
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay compliance
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPSupported, setIsPiPSupported] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  const minSwipeDistance = 50;

  useEffect(() => {
    loadCategories();
    loadNextVideo();
  }, []);

  useEffect(() => {
    loadNextVideo();
  }, [selectedCategory]);

  // Check for PiP support on mount
  useEffect(() => {
    if (document.pictureInPictureEnabled) {
      setIsPiPSupported(true);
    }
  }, []);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [currentVideo]);

  // Fullscreen event listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // PiP event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPiP = () => setIsPiPActive(true);
    const handleLeavePiP = () => setIsPiPActive(false);

    video.addEventListener('enterpictureinpicture', handleEnterPiP);
    video.addEventListener('leavepictureinpicture', handleLeavePiP);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPiP);
      video.removeEventListener('leavepictureinpicture', handleLeavePiP);
    };
  }, [currentVideo]);

  const getAuthHeaders = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });

  const loadCategories = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/categories', getAuthHeaders());
      setCategories(response.data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Load category feed (all videos from that category)
  const loadCategoryFeed = async (categoryName) => {
    try {
      // Get all videos from this category
      const response = await axios.get(`http://localhost:3001/api/categories`, getAuthHeaders());
      const category = response.data.find(cat => cat.name === categoryName);
      
      if (category && category.videos.length > 0) {
        // Shuffle the videos for variety
        const shuffledVideos = [...category.videos];
        for (let i = shuffledVideos.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledVideos[i], shuffledVideos[j]] = [shuffledVideos[j], shuffledVideos[i]];
        }
        
        // Store the feed for this category
        setCategoryFeeds(prev => ({
          ...prev,
          [categoryName]: shuffledVideos
        }));
        
        // Start from the first video
        setCurrentCategoryIndex(0);
        setCurrentVideo({
          video: shuffledVideos[0],
          category: categoryName
        });
        
        // Reset video to beginning
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
          }
        }, 100);
      }
    } catch (error) {
      console.error('Error loading category feed:', error);
    }
  };

  const loadNextVideo = async () => {
    setLoading(true);
    setError('');
    
    try {
      if (selectedCategory) {
        // Category mode: Use sequential playback from category feed
        const feed = categoryFeeds[selectedCategory];
        
        if (!feed || feed.length === 0) {
          // First time loading this category - load the full feed
          await loadCategoryFeed(selectedCategory);
        } else {
          // Move to next video in the category feed
          let nextIndex = currentCategoryIndex + 1;
          
          // If we've reached the end, loop back to the beginning
          if (nextIndex >= feed.length) {
            nextIndex = 0;
          }
          
          setCurrentCategoryIndex(nextIndex);
          setCurrentVideo({
            video: feed[nextIndex],
            category: selectedCategory
          });
          
          // Reset video to beginning
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.currentTime = 0;
            }
          }, 100);
        }
      } else {
        // Algorithmic mode: Use server API
        const response = await axios.get('http://localhost:3001/api/next-video', getAuthHeaders());
        
        if (response.data.resetViewed) {
          setError('🎉 Amazing! You\'ve watched everything! Starting fresh...');
          setTimeout(() => {
            loadNextVideo();
          }, 2000);
          return;
        }
        
        setCurrentVideo(response.data);
        
        // Reset video to beginning
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
          }
        }, 100);
      }
    } catch (error) {
      setError('Failed to load video');
      console.error('Error loading video:', error);
    }
    
    setLoading(false);
  };

  const handleInteraction = async (interactionType) => {
    if (!currentVideo) return;

    try {
      await axios.post('http://localhost:3001/api/interact', {
        videoPath: currentVideo.video.path,
        category: currentVideo.category,
        interactionType
      }, getAuthHeaders());

      // Load next video after interaction
      setTimeout(() => {
        loadNextVideo();
      }, 300);
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  };

  const handleScroll = (e) => {
    // If user scrolls down significantly, treat it as mild interest
    if (e.deltaY > 0) {
      handleInteraction('scroll');
    }
  };

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left = hate (-2 points)
      handleInteraction('hate');
    } else if (isRightSwipe) {
      // Swipe right = like (+1 point)
      handleInteraction('like');
    }
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      const aspectRatio = videoWidth / videoHeight;
      
      // CRT frame container - responsive sizing
      const containerWidth = Math.min(window.innerWidth * 0.9, 600);
      const containerHeight = Math.min(window.innerHeight * 0.7, 500);
      
      // Maintain aspect ratio within container
      let width, height;
      const containerAspectRatio = containerWidth / containerHeight;
      
      if (aspectRatio > containerAspectRatio) {
        // Video is wider - fit to container width
        width = containerWidth;
        height = containerWidth / aspectRatio;
      } else {
        // Video is taller - fit to container height
        height = containerHeight;
        width = containerHeight * aspectRatio;
      }
      
      setVideoSize({ width: `${width}px`, height: `${height}px` });
    }
  };

  // Advanced video control handlers
  const handleSeek = (e) => {
    if (!videoRef.current || !duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressBarWidth = rect.width;
    const newTime = (clickX / progressBarWidth) * duration;
    
    videoRef.current.currentTime = newTime;
  };

  const handleVolumeChange = (e) => {
    if (!videoRef.current) return;
    
    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    if (!videoRef.current) return;
    
    const newMutedState = !videoRef.current.muted;
    videoRef.current.muted = newMutedState;
    setIsMuted(newMutedState);
  };

  const handleFullscreenToggle = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  };

  const handlePiPToggle = async () => {
    if (!videoRef.current) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error('PiP error:', error);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleControlsToggle = () => {
    setShowControls(!showControls);
  };

  if (loading && !currentVideo) {
    return (
      <div className="video-feed">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading videos...</p>
        </div>
      </div>
    );
  }

  if (error && !currentVideo) {
    return (
      <div className="video-feed">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={loadNextVideo} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-feed">
      <header className="app-header">
        <h1>AI Made</h1>
        <div className="header-actions">
          <Link to="/preferences" className="preferences-link">
            Preferences
          </Link>
          <button onClick={onLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      {currentVideo && (
        <div 
          ref={containerRef}
          className="video-container"
          onWheel={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          <div 
            className="crt-video-wrapper"
            style={{
              width: videoSize.width,
              height: videoSize.height,
              '--crt-frame-image': `url(${crtFrame})`
            }}
          >
            <video
              ref={videoRef}
              src={`http://localhost:3001${currentVideo.video.path}`}
              className="video-player"
              onClick={handleVideoClick}
              onLoadedMetadata={handleVideoLoad}
              loop
              autoPlay
              muted={isMuted}
              playsInline
            />
          </div>
          
          {/* Advanced Video Controls - Now beneath the video */}
          <div className={`video-controls-beneath ${showControls ? 'visible' : ''}`}>
            {/* Progress Bar */}
            <div className="progress-container">
              <div className="progress-bar" onClick={handleSeek}>
                <div 
                  className="progress-filled"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                ></div>
              </div>
              <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            {/* Control Buttons Row */}
            <div className="video-controls-row">
              {/* Volume Control */}
              <div className="volume-control">
                <button 
                  className="control-btn volume-btn"
                  onClick={handleMuteToggle}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? '🔇' : volume > 0.5 ? '🔊' : volume > 0 ? '🔉' : '🔈'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                />
              </div>
              
              {/* Spacer */}
              <div className="controls-spacer"></div>
              
              {/* Action Buttons */}
              <div className="action-controls">
                {isPiPSupported && (
                  <button 
                    className="control-btn pip-btn"
                    onClick={handlePiPToggle}
                    title={isPiPActive ? 'Exit Picture-in-Picture' : 'Picture-in-Picture'}
                  >
                    {isPiPActive ? '📺' : '🖼️'}
                  </button>
                )}
                
                <button 
                  className="control-btn fullscreen-btn"
                  onClick={handleFullscreenToggle}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? '🗗' : '🗖'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Split interaction buttons - X on left, thumbs up on right */}
          <div className="dislike-button-container">
            <button 
              className="interaction-btn dislike-btn"
              onClick={() => handleInteraction('dislike')}
              title="Don't like (-1 point)"
            >
              ✕
            </button>
          </div>
          
          <div className="like-button-container">
            <button 
              className="interaction-btn like-btn"
              onClick={() => handleInteraction('like')}
              title="Like (+1 point)"
            >
              👍
            </button>
          </div>
          
          <div className="swipe-instructions">
            <div className="swipe-hint swipe-left">← Swipe left: Really don't like (-2)</div>
            <div className="swipe-hint swipe-right">Swipe right: Like (+1) →</div>
            <div className="scroll-hint">Scroll down: Mild interest (+0.5)</div>
          </div>
        </div>
      )}

      {loading && currentVideo && (
        <div className="loading-overlay">
          <div className="loading-spinner small"></div>
        </div>
      )}

      {/* Remote Control Interface */}
      <div className="remote-control">
        <div className="remote-title">
          {selectedCategory ? `Category: ${selectedCategory}` : 'AI Algorithm Mode'}
        </div>
        
        <div className="remote-buttons">
          {/* Green Play Button for Algorithmic Mode */}
          <button 
            className={`remote-btn play-btn ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
            title="Return to AI Algorithm"
          >
            ▶️
          </button>
          
          {/* Category Buttons */}
          {categories.map((category) => (
            <button
              key={category.name}
              className={`remote-btn category-btn ${selectedCategory === category.name ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.name)}
              title={`Watch ${category.name} videos`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoFeed;
