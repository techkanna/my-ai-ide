'use client';

import { useEditorStore } from '@/store/editorStore';
import { useRef, useEffect } from 'react';

export function TabBar() {
  const { tabs, activeTabId, switchTab, closeTab } = useEditorStore();
  const tabBarRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && tabBarRef.current) {
      const tabBar = tabBarRef.current;
      const activeTab = activeTabRef.current;
      const tabBarRect = tabBar.getBoundingClientRect();
      const activeTabRect = activeTab.getBoundingClientRect();

      // Check if active tab is out of view
      if (activeTabRect.left < tabBarRect.left) {
        tabBar.scrollTo({
          left: tabBar.scrollLeft + (activeTabRect.left - tabBarRect.left) - 20,
          behavior: 'smooth',
        });
      } else if (activeTabRect.right > tabBarRect.right) {
        tabBar.scrollTo({
          left: tabBar.scrollLeft + (activeTabRect.right - tabBarRect.right) + 20,
          behavior: 'smooth',
        });
      }
    }
  }, [activeTabId]);

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    closeTab(tabId);
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center border-b border-gray-300 bg-gray-50 overflow-x-auto" ref={tabBarRef} style={{ scrollbarWidth: 'thin' }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const fileName = getFileName(tab.path);
        
        return (
          <div
            key={tab.id}
            ref={isActive ? activeTabRef : null}
            onClick={() => switchTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 border-r border-gray-300 cursor-pointer
              transition-colors min-w-[150px] max-w-[250px] group
              ${isActive 
                ? 'bg-white border-b-2 border-b-blue-500 text-blue-600' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }
            `}
            title={tab.path}
          >
            <span className="flex-1 truncate text-sm font-medium">
              {fileName}
              {tab.unsaved && (
                <span className="ml-1 text-orange-500">●</span>
              )}
            </span>
            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className={`
                opacity-0 group-hover:opacity-100 transition-opacity
                p-1 rounded hover:bg-gray-300
                ${isActive ? 'opacity-100' : ''}
              `}
              title="Close tab"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

