import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  GitFork,
  Bell,
  Sun,
  Menu,
  X,
  LogOut
} from "lucide-react";
import useStudentId from "../hooks/useStudentId";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/weakness", label: "Weakness", icon: Brain },
  { to: "/explain", label: "Explain Mistake", icon: HelpCircle },
  { to: "/resume", label: "Resume", icon: FileText },
  { to: "/audio-interview", label: "Interview", icon: Mic },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/career-roadmap", label: "Roadmap", icon: GitFork },
];

export default function Navbar() {
  const [studentId, setStudentId] = useStudentId();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on path change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

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
    setStudentId(null);
    setDrawerOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-brand-border/80 backdrop-blur-md bg-opacity-95 transition-saas">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Mobile hamburger button */}
          <button
            type="button"
            className="lg:hidden p-2 -ml-2 text-brand-textSecondary hover:text-brand-textPrimary rounded-lg hover:bg-brand-hoverBg transition-saas"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 font-heading font-bold text-lg text-brand-primary shrink-0">
            <span className="h-8 w-8 rounded-lg bg-brand-primaryLight text-brand-primary flex items-center justify-center font-bold">
              M
            </span>
            <span className="bg-gradient-to-r from-brand-primary to-brand-primaryHover bg-clip-text text-transparent">
              Mentor AI
            </span>
          </NavLink>

          {/* Desktop Navigation Items (Hidden on mobile/tablet) */}
          <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1 scrollbar-none max-w-full" aria-label="Primary">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-saas shrink-0 ${
                      isActive
                        ? "bg-brand-primaryLight text-brand-primary border-b-2 border-brand-primary rounded-b-none"
                        : "text-brand-textSecondary hover:bg-brand-hoverBg hover:text-brand-textPrimary"
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right Section utilities */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Notification trigger */}
            <button
              type="button"
              className="p-2 text-brand-textSecondary hover:bg-brand-hoverBg hover:text-brand-textPrimary rounded-full transition-saas relative"
              aria-label="View notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {studentId && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-danger rounded-full ring-2 ring-white"></span>
              )}
            </button>

            {/* Theme Toggle (Future Support) */}
            <button
              type="button"
              className="p-2 text-brand-textSecondary hover:bg-brand-hoverBg hover:text-brand-textPrimary rounded-full transition-saas"
              aria-label="Toggle theme"
            >
              <Sun className="w-4.5 h-4.5" />
            </button>

            {/* Profile Avatar / Indicator (Desktop only) */}
            <div className="hidden sm:flex items-center gap-2 border-l border-brand-border pl-3">
              {studentId ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-secondary text-white flex items-center justify-center font-bold text-xs shadow-sm">
                    S{studentId}
                  </div>
                  <span className="hidden md:inline text-xs font-semibold text-brand-textSecondary">
                    Active Session
                  </span>
                </div>
              ) : (
                <NavLink to="/profile" className="flex items-center gap-1.5 text-xs text-brand-textSecondary hover:text-brand-textPrimary">
                  <div className="w-8 h-8 rounded-full bg-brand-bgSection text-brand-textSecondary flex items-center justify-center font-medium shadow-inner">
                    ?
                  </div>
                </NavLink>
              )}
            </div>
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
              className="fixed inset-0 z-50 bg-brand-textPrimary/40 backdrop-blur-xs lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Slide-in drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              className="fixed top-0 bottom-0 left-0 z-50 w-72 max-w-[85vw] bg-white border-r border-brand-border shadow-2xl flex flex-col justify-between lg:hidden"
            >
              {/* Drawer header */}
              <div className="p-4 border-b border-brand-border flex items-center justify-between">
                <span className="font-heading font-bold text-brand-primary flex items-center gap-2">
                  <span className="h-7 w-7 rounded-lg bg-brand-primaryLight text-brand-primary flex items-center justify-center font-bold text-sm">
                    M
                  </span>
                  <span>Mentor Navigation</span>
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 text-brand-textSecondary hover:text-brand-textPrimary hover:bg-brand-hoverBg rounded-lg transition-saas"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Links */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-saas ${
                          isActive
                            ? "bg-brand-primaryLight text-brand-primary"
                            : "text-brand-textSecondary hover:bg-brand-hoverBg hover:text-brand-textPrimary"
                        }`
                      }
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              {/* Drawer Footer profile section */}
              <div className="p-4 border-t border-brand-border bg-slate-50/50 space-y-3 shrink-0">
                {studentId ? (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-secondary text-white flex items-center justify-center font-bold text-sm shadow-sm">
                        S{studentId}
                      </div>
                      <div className="text-xs">
                        <span className="font-bold block text-brand-textPrimary">Student ID: {studentId}</span>
                        <span className="text-brand-textSecondary">Active learning session</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full btn-secondary py-2 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Clear Session</span>
                    </button>
                  </>
                ) : (
                  <div className="text-center p-2">
                    <p className="text-xs text-brand-textSecondary mb-2">No student context loaded.</p>
                    <NavLink
                      to="/profile"
                      className="btn-primary w-full py-2 text-xs"
                      onClick={() => setDrawerOpen(false)}
                    >
                      Load / Create Profile
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
