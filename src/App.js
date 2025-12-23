import React, { useState } from 'react';
import './App.css';
import Home from './components/Home';
import About from './components/About';
import Help from './components/Help';
import Dataset from './components/Dataset';
import XIcon from './icons/X.svg';
import FairBiteIcon from './icons/FairBiteIcon.svg';
import HomeIcon from './icons/Home.svg';
import InfoIcon from './icons/Info.svg';
import HelpIcon from './icons/Help_circle.svg';
import DatabaseIcon from './icons/Database.svg';

function App() {
  const [tabs, setTabs] = useState([
    { id: 'home', type: 'home', label: 'Home', isClosable: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('home');

  const openTab = (type, data = null) => {
    // Check for singleton tabs
    if (type === 'about' || type === 'help') {
      const existingTab = tabs.find(t => t.type === type);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        return;
      }
      const newTab = {
        id: type,
        type: type,
        label: type === 'about' ? 'About FairBite' : 'How to Use',
        isClosable: true
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    } else if (type === 'dataset') {
      // For dataset, we allow multiple, but let's check basic dupes or allow enumeration
      // The prompt says: "if it opens for the same the name of the duplicates dataset tabs will take enumerations e.g name (1), name (2)"
      // We initially name it 'Loading Dataset...' or similar, then update it.
      // But let's start with a base name.npm
      const baseLabel = 'Dataset_Loading...'; // Will be updated by component

      const newTabId = `dataset-${Date.now()}`;
      const newTab = {
        id: newTabId,
        type: 'dataset',
        label: baseLabel,
        isClosable: true,
        data: data // The path or name passed from Home
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTabId);
    }
  };

  const closeTab = (e, tabId) => {
    e.stopPropagation(); // Prevent clicking the tab itself
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);

    setTabs(newTabs);

    // If we closed the active tab, switch to the one before it, or Home
    if (activeTabId === tabId) {
      const newActive = newTabs[tabIndex - 1] || newTabs[0];
      setActiveTabId(newActive.id);
    }
  };

  const updateTabLabel = (tabId, newName) => {
    // Handle enumeration logic here if needed, or just set it.
    // Simple check for duplicates to add (1), (2) etc.
    let finalName = newName;
    const sameNameCount = tabs.filter(t => t.id !== tabId && t.label.startsWith(newName)).length;
    if (sameNameCount > 0) {
      finalName = `${newName} (${sameNameCount})`;
    }

    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, label: finalName } : t
    ));
  };

  const getTabIcon = (type) => {
    switch (type) {
      case 'home': return HomeIcon;
      case 'about': return InfoIcon;
      case 'help': return HelpIcon;
      case 'dataset': return DatabaseIcon;
      default: return null;
    }
  };

  const renderContent = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return null;

    switch (activeTab.type) {
      case 'home':
        return <Home openTab={openTab} />;
      case 'about':
        return <About />;
      case 'help':
        return <Help />;
      case 'dataset':
        return <Dataset
          datasetId={activeTab.id}
          initialPath={activeTab.data}
          onUpdateName={(name) => updateTabLabel(activeTab.id, name)}
        />;
      default:
        return <div>Unknown Tab</div>;
    }
  };

  return (
    <div className="App">
      <div className="title-bar">
        <img src={FairBiteIcon} alt="Logo" className="app-logo" />
        <span>FairBite</span>
      </div>
      <div className="tabs-header">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
            title={tab.label} // tooltip for long names
          >
            <img
              src={getTabIcon(tab.type)}
              alt=""
              className="tab-icon"
            />
            <span className="tab-label">
              {tab.label.length > 20 ? tab.label.substring(0, 17) + '...' : tab.label}
            </span>
            {tab.isClosable && (
              <img
                src={XIcon}
                alt="Close"
                className="close-icon"
                onClick={(e) => closeTab(e, tab.id)}
              />
            )}
          </div>
        ))}
      </div>
      <div className="content-area">
        {renderContent()}
      </div>
    </div>
  );
}

export default App;
