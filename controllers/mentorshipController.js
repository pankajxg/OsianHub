const Mentorship = require('../models/Mentorship');

// Get all mentorship videos (for users)
const getMentorshipVideos = async (req, res) => {
  try {
    const videos = await Mentorship.find({})
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      videos: videos.map(video => ({
        _id: video._id,
        title: video.title,
        description: video.description,
        url: video.url,
        thumbnail: video.thumbnail,
        duration: video.duration,
        views: video.views,
        createdAt: video.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching mentorship videos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mentorship videos'
    });
  }
};

// Get all mentorship videos for admin management
const getMentorshipVideosAdmin = async (req, res) => {
  try {
    const videos = await Mentorship.find({})
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      videos
    });
  } catch (error) {
    console.error('Error fetching mentorship videos for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mentorship videos'
    });
  }
};

// Create a new mentorship video (admin only)
const createMentorshipVideo = async (req, res) => {
  try {
    const { title, description, url, thumbnail, duration } = req.body;

    if (!title || !description || !url) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and URL are required'
      });
    }

    const newVideo = new Mentorship({
      title,
      description,
      url,
      thumbnail,
      duration,
      createdBy: req.user.id
    });

    await newVideo.save();

    res.status(201).json({
      success: true,
      message: 'Mentorship video created successfully',
      video: newVideo
    });
  } catch (error) {
    console.error('Error creating mentorship video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create mentorship video'
    });
  }
};

// Update a mentorship video (admin only)
const updateMentorshipVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, url, thumbnail, duration } = req.body;

    const updatedVideo = await Mentorship.findByIdAndUpdate(
      id,
      {
        title,
        description,
        url,
        thumbnail,
        duration,
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!updatedVideo) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship video not found'
      });
    }

    res.json({
      success: true,
      message: 'Mentorship video updated successfully',
      video: updatedVideo
    });
  } catch (error) {
    console.error('Error updating mentorship video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update mentorship video'
    });
  }
};

// Delete a mentorship video (admin only)
const deleteMentorshipVideo = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedVideo = await Mentorship.findByIdAndDelete(id);

    if (!deletedVideo) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship video not found'
      });
    }

    res.json({
      success: true,
      message: 'Mentorship video deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting mentorship video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete mentorship video'
    });
  }
};

// Increment view count for a video
const incrementVideoViews = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedVideo = await Mentorship.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!updatedVideo) {
      return res.status(404).json({
        success: false,
        message: 'Mentorship video not found'
      });
    }

    res.json({
      success: true,
      views: updatedVideo.views
    });
  } catch (error) {
    console.error('Error incrementing video views:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to increment video views'
    });
  }
};

module.exports = {
  getMentorshipVideos,
  getMentorshipVideosAdmin,
  createMentorshipVideo,
  updateMentorshipVideo,
  deleteMentorshipVideo,
  incrementVideoViews
};
