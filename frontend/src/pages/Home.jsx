import { Link } from 'react-router-dom';
import './Home.css';

const Home = () => {
  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              🧠 Welcome to Mentor AI
            </h1>
            <p className="hero-subtitle">
              Your personalized AI-powered learning companion. Get adaptive guidance,
              track your progress, and achieve your learning goals with intelligent mentorship.
            </p>
            <div className="hero-actions">
              <Link to="/profile" className="btn btn-primary btn-large">
                Get Started
              </Link>
              <Link to="/dashboard" className="btn btn-secondary btn-large">
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="features-section">
        <div className="container">
          <h2 className="section-title">Why Choose Mentor AI?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Personalized Learning</h3>
              <p>
                AI adapts to your learning style, pace, and goals to provide
                tailored guidance and recommendations.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Progress Tracking</h3>
              <p>
                Monitor your learning journey with detailed analytics,
                skill assessments, and achievement milestones.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">💬</div>
              <h3>24/7 AI Mentor</h3>
              <p>
                Get instant help with questions, explanations, and guidance
                whenever you need it, day or night.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h3>Adaptive Difficulty</h3>
              <p>
                Content and challenges automatically adjust based on your
                performance and confidence levels.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Start Your Learning Journey?</h2>
            <p>Create your profile and begin with personalized AI mentorship today.</p>
            <Link to="/profile" className="btn btn-primary btn-large">
              Create Your Profile
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;