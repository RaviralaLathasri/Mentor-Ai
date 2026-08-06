import React, { useState, useEffect, useRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  User,
  Brain,
  HelpCircle,
  FileText,
  Mic,
  BarChart3,
  Bell,
  Sun,
  Menu,
  X,
  LogOut,
  Settings,
  ChevronDown,
  Timer
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/focus", label: "Focus Hub", icon: Timer },
  { to: "/resume", label: "Resume", icon: FileText },
  { to: "/audio-interview", label: "Interview", icon: Mic },
  { to: "/profile", label: "Profile", icon: User },
];

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Close drawer & dropdown on path change
  useEffect(() => {
    setDrawerOpen(false);
    setDropdownOpen(false);
  }, [location]);

  // Handle clicking outside the dropdown to close it
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const handleLogout = () => {
    logout();
    setDrawerOpen(false);
    setDropdownOpen(false);
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-100 backdrop-blur-md bg-opacity-95 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Mobile hamburger button */}
          <button
            type="button"
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-all"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 font-bold text-lg text-emerald-600 shrink-0">
            <span className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              M
            </span>
            <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
              Mentor AI
            </span>
          </NavLink>

          {/* Desktop Navigation Items (Hidden on mobile/tablet) */}
          {isAuthenticated && (
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1 scrollbar-none max-w-full" aria-label="Primary">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all shrink-0 ${
                        isActive
                          ? "bg-emerald-50 text-emerald-600 border-b-2 border-emerald-500 rounded-b-none"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          )}

          {/* Right Section utilities */}
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            {isAuthenticated ? (
              <>
                {/* Notification trigger */}
                <button
                  type="button"
                  className="p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-full transition-all relative"
                  aria-label="View notifications"
                >
                  <Bell className="w-4.5 h-4.5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                </button>

                {/* User Avatar with Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-1.5 p-1 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-all focus:outline-none cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-100 shadow-sm">
                      {user?.name ? user.name[0].toUpperCase() : "U"}
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-50 overflow-hidden"
                      >
                        <div className="px-4 py-2 border-b border-slate-50">
                          <p className="text-xs font-semibold text-slate-800 truncate">{user?.name}</p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email}</p>
                        </div>
                        
                        <NavLink
                          to="/profile"
                          className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <User className="w-4 h-4 text-slate-400" />
                          Profile
                        </NavLink>
                        
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors text-left"
                          onClick={() => {
                            setDropdownOpen(false);
                            // Dummy settings trigger or notification
                          }}
                        >
                          <Settings className="w-4 h-4 text-slate-400" />
                          Settings
                        </button>
                        
                        <div className="border-t border-slate-50 my-1"></div>
                        
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
                        >
                          <LogOut className="w-4 h-4 text-red-500" />
                          Logout
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <NavLink
                to="/login"
                className="py-1.5 px-4 border border-transparent text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs"
              >
                Sign In
              </NavLink>
            )}
          </div>

        </div>
      </div>

      {/* Mobile drawer implementation */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-xs lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Slide-in drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              className="fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-slate-100 shadow-2xl flex flex-col justify-between lg:hidden"
            >
              {/* Drawer header */}
              <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                <span className="font-bold text-emerald-600 flex items-center gap-2">
                  <span className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                    M
                  </span>
                  <span>Mentor Navigation</span>
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Links */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
                {isAuthenticated && navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                          isActive
                            ? "bg-emerald-50 text-emerald-600"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`
                      }
                      onClick={() => setDrawerOpen(false)}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              {/* Drawer Footer profile section */}
              <div className="p-4 border-t border-slate-50 bg-slate-50/50 space-y-3 shrink-0">
                {isAuthenticated ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm shadow-sm border border-emerald-100">
                        {user?.name ? user.name[0].toUpperCase() : "U"}
                      </div>
                      <div className="text-xs truncate max-w-[170px]">
                        <span className="font-bold block text-slate-800 truncate">{user?.name}</span>
                        <span className="text-slate-400 truncate">{user?.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full py-2 border border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <div className="text-center p-2">
                    <p className="text-xs text-slate-400 mb-2">Please sign in to proceed.</p>
                    <NavLink
                      to="/login"
                      className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-xs"
                      onClick={() => setDrawerOpen(false)}
                    >
                      Sign In
                    </NavLink>
                  </div>
                )}
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
