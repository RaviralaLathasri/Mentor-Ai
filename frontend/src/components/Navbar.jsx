import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          🧠 Mentor AI
        </Link>

        <div className="nav-menu">
          <Link to="/profile" className={`nav-link ${isActive('/profile')}`}>
            Profile
          </Link>
          <Link to="/dashboard" className={`nav-link ${isActive('/dashboard')}`}>
            Dashboard
          </Link>
          <Link to="/chat" className={`nav-link ${isActive('/chat')}`}>
            Chat
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;