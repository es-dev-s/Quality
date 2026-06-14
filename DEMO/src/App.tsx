import { useState } from 'react';
import { 
  BarChart3, 
  FileText, 
  History, 
  LayoutDashboard, 
  MoreHorizontal, 
  Settings, 
  Users, 
  Upload,
  ClipboardList,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AuditProvider, useAudit } from './contexts/AuditContext';
import { cn } from './lib/utils';

import Dashboard from './components/Dashboard';
import AuditForm from './components/AuditForm';
import ScoreOutput from './components/ScoreOutput';
import HistoryView from './components/HistoryView';

import { AuditRecord } from './types';

import Analytics from './components/Analytics';
import Report from './components/Report';
import Import from './components/Import';
import AuditTemplates from './components/AuditTemplates';
import UserManagement from './components/UserManagement';
import InteractionConfigView from './components/InteractionConfigView';

const NavItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  className,
  ...props
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  className?: string,
  key?: string
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium w-full group",
      active 
        ? "bg-blue-600 text-white shadow-lg shadow-blue-200/50" 
        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
      className
    )}
  >
    <Icon className={cn("w-4.5 h-4.5", active ? "text-white" : "text-gray-400 group-hover:text-gray-600")} />
    <span>{label}</span>
    {active && (
      <motion.div 
        layoutId="active-nav"
        className="ml-auto"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <ChevronRight className="w-4 h-4 opacity-70" />
      </motion.div>
    )}
  </button>
);

function AppContent() {
  const { auditHistory, addAudit, updateAudit, menuConfig, currentUser } = useAudit();
  const [activeTab, setActiveSection] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentAuditResult, setCurrentAuditResult] = useState<AuditRecord | null>(null);
  const [isViewingScore, setIsViewingScore] = useState(false);

  const handleScoreCalculated = (record: AuditRecord) => {
    setCurrentAuditResult(record);
    setIsViewingScore(true);
  };

  const handleSaveAudit = () => {
    if (currentAuditResult) {
      const exists = auditHistory.find(a => a.id === currentAuditResult.id);
      if (exists) {
        updateAudit(currentAuditResult);
      } else {
        addAudit(currentAuditResult);
      }
      setCurrentAuditResult(null);
      setIsViewingScore(false);
      setActiveSection('history');
    }
  };

  const handleEditAudit = (record: AuditRecord) => {
    setCurrentAuditResult(record);
    setIsViewingScore(false);
    setActiveSection('form'); // Changed from 'audit' to 'form' to match menuConfig id
  };

  const handleViewAudit = (record: AuditRecord) => {
    setCurrentAuditResult(record);
    setIsViewingScore(true);
    setActiveSection('form'); // Changed from 'audit' to 'form' to match menuConfig id
  };

  const iconMap: Record<string, any> = {
    LayoutDashboard,
    FileText: ClipboardList,
    History,
    BarChart3,
    Settings2: Settings,
    UserCircle: Users,
    RefreshCcw: Upload,
    Settings,
    Layout: LayoutDashboard
  };

  const componentMap: Record<string, any> = {
    dashboard: Dashboard,
    form: () => isViewingScore && currentAuditResult ? (
      <ScoreOutput 
        data={currentAuditResult} 
        onBack={() => {
          setIsViewingScore(false);
        }} 
        onSave={handleSaveAudit}
      />
    ) : (
      <AuditForm onScoreCalculated={handleScoreCalculated} initialData={currentAuditResult} />
    ),
    history: () => <HistoryView onEdit={handleEditAudit} onView={handleViewAudit} />,
    analytics: Analytics,
    import: Import,
    templates: AuditTemplates,
    users: UserManagement,
    'interaction-config': InteractionConfigView,
  };

  const activeMenu = menuConfig.find(m => m.id === activeTab) || menuConfig[0];
  const ActiveComponent = componentMap[activeMenu.id] || Dashboard;

  const visibleMenus = [...menuConfig]
    .filter(m => m.visible && (!currentUser || currentUser.allowedMenus?.includes(m.id)))
    .sort((a, b) => a.order - b.order);

  return (
    <div className="flex min-h-screen bg-gray-50/50 font-sans text-gray-900 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className={cn(
        "hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0 transition-all duration-300 z-30 shadow-sm",
      )}>
        <div className="p-6 border-b border-gray-100 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200/50">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-gray-900 leading-tight">AuditPro</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Quality Tool</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto py-4 custom-scrollbar">
          {visibleMenus.map((section) => (
            <NavItem
              key={section.id}
              icon={iconMap[section.icon] || MoreHorizontal}
              label={section.label}
              active={activeTab === section.id}
              onClick={() => setActiveSection(section.id)}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 p-2 rounded-xl">
             <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shadow-inner uppercase">
               {currentUser?.name.substring(0, 2) || 'AD'}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-xs font-semibold text-gray-900 truncate">{currentUser?.name || 'Admin User'}</p>
               <p className="text-[10px] text-gray-500 truncate">{currentUser?.email || 'admin@qa.local'}</p>
             </div>
             <button 
               onClick={() => setActiveSection('users')}
               className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm"
               title="Account settings"
             >
               <Settings className="w-3.5 h-3.5" />
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h1 className="font-bold text-gray-900">AuditPro</h1>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Dynamic Section Shell */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
              />
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden flex flex-col"
              >
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-gray-900">AuditPro</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-400">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <nav className="p-4 space-y-1 overflow-y-auto flex-1">
                  {visibleMenus.map((section) => (
                    <NavItem
                      key={section.id}
                      icon={iconMap[section.icon] || MoreHorizontal}
                      label={section.label}
                      active={activeTab === section.id}
                      onClick={() => {
                        setActiveSection(section.id);
                        setIsMobileMenuOpen(false);
                      }}
                    />
                  ))}
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuditProvider>
      <AppContent />
    </AuditProvider>
  );
}
