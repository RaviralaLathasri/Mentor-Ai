import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/chat", label: "Mentor Chat" },
  { to: "/profile", label: "Profile" },
  { to: "/weakness", label: "Weakness" },
  { to: "/explain", label: "Explain Mistake" },
  { to: "/resume", label: "Resume Mentor" },
  { to: "/analytics", label: "Analytics" },
  { to: "/career-roadmap", label: "Career Roadmap" },
];

export default function Navbar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <NavLink to="/" className="brand">
          Mentor AI
        </NavLink>
        <nav className="nav-links" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
