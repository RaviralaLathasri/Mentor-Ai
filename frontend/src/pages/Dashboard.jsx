import { useState, useEffect } from 'react';
import { profileAPI } from '../services/api';
import Alert from '../components/Alert';
import LoadingSpinner from '../components/LoadingSpinner';
import './Dashboard.css';

const Dashboard = () => {
  const [profile, setProfile] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const studentId = localStorage.getItem('studentId');
    if (!studentId) {
      setAlert({
        type: 'error',
        message: 'Please create your profile first.'
      });
      setLoading(false);
      return;
    }

    try {
      const profileData = await profileAPI.getProfile(studentId);
      setProfile(profileData);
      
      // Fetch recommendations
      try {
        const recommendationsData = await profileAPI.getRecommendations(studentId);
        setRecommendations(recommendationsData.recommendations || []);
      } catch (err) {
        console.error('Error loading recommendations:', err);
        // Recommendations are optional, don't fail if they're not available
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setAlert({
        type: 'error',
        message: 'Failed to load profile. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatSkills = (skills) => {
    if (!Array.isArray(skills) || skills.length === 0) {
      return 'No skills specified';
    }
    return skills.join(', ');
  };

  const formatInterests = (interests) => {
    if (!Array.isArray(interests) || interests.length === 0) {
      return 'No interests specified';
    }
    return interests.join(', ');
  };

  const getConfidenceLabel = (level) => {
    if (level >= 0.8) return 'Expert';
    if (level >= 0.6) return 'Advanced';
    if (level >= 0.4) return 'Intermediate';
    if (level >= 0.2) return 'Beginner';
    return 'Novice';
  };

  const getConfidenceColor = (level) => {
    if (level >= 0.8) return '#28a745';
    if (level >= 0.6) return '#17a2b8';
    if (level >= 0.4) return '#ffc107';
    if (level >= 0.2) return '#fd7e14';
    return '#dc3545';
  };

  const getPriorityColor = (priority) => {
    if (priority === 'high') return '#dc3545';
    if (priority === 'medium') return '#fd7e14';
    return '#17a2b8';
  };

  const getPriorityIcon = (priority) => {
    if (priority === 'high') return '🔴';
    if (priority === 'medium') return '🟡';
    return '🟢';
  };

  const getRecommendationIcon = (type) => {
    if (type === 'focus_concept') return '📚';
    if (type === 'confidence_boost') return '💪';
    if (type === 'difficulty_adjustment') return '⚙️';
    return '💡';
  };

  if (loading) {
    return <LoadingSpinner message="Loading your dashboard..." />;
  }

  if (!profile) {
    return (
      <div className="dashboard-page">
        <div className="container">
          <Alert
            type={alert?.type}
            message={alert?.message}
          />
          <div className="card">
            <div className="card-header">
              <h1 className="card-title">Dashboard</h1>
            </div>
            <p>Please create your profile first to view the dashboard.</p>
            <a href="/profile" className="btn btn-primary">Create Profile</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="container">
        <div className="dashboard-header">
          <h1>Welcome back, {profile.name}!</h1>
          <p>Here's your learning profile overview</p>
        </div>

        <Alert
          type={alert?.type}
          message={alert?.message}
          onClose={() => setAlert(null)}
        />

        <div className="dashboard-grid">
          <div className="card profile-card">
            <div className="card-header">
              <h2 className="card-title">📊 Profile Summary</h2>
            </div>
            <div className="profile-info">
              <div className="info-item">
                <strong>Name:</strong> {profile.name}
              </div>
              <div className="info-item">
                <strong>Email:</strong> {profile.email}
              </div>
              <div className="info-item">
                <strong>Member since:</strong> {new Date(profile.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="card skills-card">
            <div className="card-header">
              <h2 className="card-title">🛠️ Skills</h2>
            </div>
            <p className="skills-text">{formatSkills(profile.skills)}</p>
          </div>

          <div className="card interests-card">
            <div className="card-header">
              <h2 className="card-title">🎯 Interests</h2>
            </div>
            <p className="interests-text">{formatInterests(profile.interests)}</p>
          </div>

          <div className="card goals-card">
            <div className="card-header">
              <h2 className="card-title">🎯 Learning Goals</h2>
            </div>
            <p className="goals-text">
              {profile.goals || 'No goals specified yet.'}
            </p>
          </div>

          <div className="card confidence-card">
            <div className="card-header">
              <h2 className="card-title">📈 Confidence Level</h2>
            </div>
            <div className="confidence-display">
              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${(profile.confidence_level || 0) * 100}%`,
                    backgroundColor: getConfidenceColor(profile.confidence_level || 0)
                  }}
                ></div>
              </div>
              <div className="confidence-label">
                <span className="confidence-value">
                  {Math.round((profile.confidence_level || 0) * 100)}%
                </span>
                <span className="confidence-text">
                  {getConfidenceLabel(profile.confidence_level || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="card actions-card">
            <div className="card-header">
              <h2 className="card-title">🚀 Quick Actions</h2>
            </div>
            <div className="action-buttons">
              <a href="/profile" className="btn btn-primary">Update Profile</a>
              <a href="/chat" className="btn btn-success">Start Learning</a>
            </div>
          </div>
        </div>

        {recommendations && recommendations.length > 0 && (
          <div className="recommendations-section">
            <div className="section-header">
              <h2>💭 Learning Recommendations</h2>
              <p>Personalized suggestions to improve your learning</p>
            </div>
            
            <div className="recommendations-grid">
              {recommendations.map((rec, index) => (
                <div key={index} className="recommendation-card">
                  <div className="recommendation-header">
                    <span className="recommendation-icon">
                      {getRecommendationIcon(rec.type)}
                    </span>
                    <span className={`priority-badge priority-${rec.priority}`}>
                      {getPriorityIcon(rec.priority)} {rec.priority.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="recommendation-content">
                    {rec.concept && (
                      <div className="recommendation-concept">
                        <strong>Focus:</strong> {rec.concept}
                      </div>
                    )}
                    
                    {rec.suggestion && (
                      <div className="recommendation-suggestion">
                        <strong>Action:</strong> {rec.suggestion.replace('_', ' ').toUpperCase()}
                      </div>
                    )}
                    
                    <div className="recommendation-reason">
                      {rec.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;