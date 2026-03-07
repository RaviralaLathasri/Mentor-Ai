import { useState, useEffect } from 'react';
import { profileAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import './Profile.css';

const Profile = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    skills: '',
    interests: '',
    goals: '',
    confidence_level: 5
  });

  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const savedStudentId = localStorage.getItem('studentId');
    if (savedStudentId) {
      setLoading(true);
      try {
        const profile = await profileAPI.getProfile(savedStudentId);
        setFormData({
          name: profile.name || '',
          email: profile.email || '',
          skills: Array.isArray(profile.skills) ? profile.skills.join(', ') : '',
          interests: Array.isArray(profile.interests) ? profile.interests.join(', ') : '',
          goals: profile.goals || '',
          confidence_level: profile.confidence_level || 5
        });
        setStudentId(savedStudentId);
        setIsEditing(true);
      } catch (error) {
        console.error('Error loading profile:', error);
        // Profile doesn't exist yet, that's okay
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSliderChange = (e) => {
    setFormData(prev => ({
      ...prev,
      confidence_level: parseInt(e.target.value)
    }));
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Convert comma-separated strings to arrays
      const processedData = {
        ...formData,
        skills: formData.skills.split(',').map(s => s.trim()).filter(s => s),
        interests: formData.interests.split(',').map(i => i.trim()).filter(i => i),
        confidence_level: formData.confidence_level / 10 // Convert 1-10 to 0.1-1.0
      };

      let result;
      if (isEditing && studentId) {
        result = await profileAPI.updateProfile(studentId, processedData);
        showAlert('success', 'Profile updated successfully!');
      } else {
        result = await profileAPI.createProfile(processedData);
        localStorage.setItem('studentId', result.id);
        setStudentId(result.id);
        setIsEditing(true);
        showAlert('success', 'Profile created successfully!');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      showAlert('error', error.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !isEditing) {
    return <LoadingSpinner message="Loading profile..." />;
  }

  return (
    <div className="profile-page">
      <div className="container">
        <div className="card">
          <div className="card-header">
            <h1 className="card-title">
              {isEditing ? 'Update Your Profile' : 'Create Your Profile'}
            </h1>
            <p>Help us personalize your learning experience</p>
          </div>

          <Alert
            type={alert?.type}
            message={alert?.message}
            onClose={() => setAlert(null)}
          />

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Full Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your full name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter your email"
                  disabled={isEditing}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="skills">Skills (comma-separated)</label>
                <input
                  type="text"
                  id="skills"
                  name="skills"
                  value={formData.skills}
                  onChange={handleInputChange}
                  placeholder="e.g., Python, JavaScript, Data Analysis"
                />
              </div>

              <div className="form-group">
                <label htmlFor="interests">Interests (comma-separated)</label>
                <input
                  type="text"
                  id="interests"
                  name="interests"
                  value={formData.interests}
                  onChange={handleInputChange}
                  placeholder="e.g., Machine Learning, Web Development"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="goals">Learning Goals</label>
              <textarea
                id="goals"
                name="goals"
                value={formData.goals}
                onChange={handleInputChange}
                rows="3"
                placeholder="What do you want to achieve with this learning platform?"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confidence">
                Confidence Level: {formData.confidence_level}/10
              </label>
              <input
                type="range"
                id="confidence"
                name="confidence_level"
                min="1"
                max="10"
                value={formData.confidence_level}
                onChange={handleSliderChange}
                className="confidence-slider"
              />
              <div className="slider-labels">
                <span>Beginner</span>
                <span>Expert</span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner spinner-small"></div>
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Profile' : 'Create Profile'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;