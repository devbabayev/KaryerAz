import React from 'react';
import { Home, Briefcase, FileText, Map, User } from 'lucide-react';
import './BottomNav.css';

const BottomNav = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs' },
    { id: 'cv', icon: FileText, label: 'CV' },
    { id: 'roadmap', icon: Map, label: 'Roadmap' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  return (
    <nav className="bottom-nav">
      <div className="nav-items-container">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isCV = tab.id === 'cv';
          
          return (
            <button
              key={tab.id}
              className={`nav-item ${isActive ? 'active' : ''} ${isCV ? 'cv-button' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <div className="icon-wrapper">
                <Icon size={isCV ? 28 : 24} strokeWidth={isCV ? 2.5 : 2} />
              </div>
              {!isCV && <span className="nav-label">{tab.label}</span>}
              {isActive && !isCV && <div className="active-dot" />}
            </button>
          )
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
