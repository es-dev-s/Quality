import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  ShieldCheck, 
  Users, 
  Search, 
  MoreHorizontal,
  Mail,
  Fingerprint,
  Calendar,
  Lock,
  X,
  Check,
  Slash,
  GripVertical,
  Eye,
  EyeOff,
  Layout,
  Trash2,
  Settings,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Edit2
} from 'lucide-react';
import { useAudit } from '../contexts/AuditContext';
import { cn } from '../lib/utils';
import { AppUser } from '../types';

export default function UserManagement() {
  const { users, updateUser, deleteUser, menuConfig, updateMenuConfig } = useAudit();
  const [tab, setTab] = useState<'users' | 'roles' | 'create' | 'menu'>('users');
  const [search, setSearch] = useState('');
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

  // Menu Editing / Re-naming / deleting / creating states
  const [editLabel, setEditLabel] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMenuId, setNewMenuId] = useState('');
  const [newMenuLabel, setNewMenuLabel] = useState('');
  const [newMenuIcon, setNewMenuIcon] = useState('Layout');

  // Reordering & visibility helpers for navigation configuration
  const sortedMenus = [...menuConfig].sort((a, b) => a.order - b.order);
  const currentSelectedMenuId = selectedMenuId || (sortedMenus.length > 0 ? sortedMenus[0].id : null);
  const currentSelectedMenu = sortedMenus.find(m => m.id === currentSelectedMenuId) || null;
  const currentSelectedIndex = currentSelectedMenuId ? sortedMenus.findIndex(m => m.id === currentSelectedMenuId) : -1;

  useEffect(() => {
    if (currentSelectedMenu) {
      setEditLabel(currentSelectedMenu.label);
      setEditIcon(currentSelectedMenu.icon);
    }
  }, [currentSelectedMenuId]);

  const handleMoveUp = (menuId: string) => {
    const list = [...menuConfig].sort((a, b) => a.order - b.order);
    const idx = list.findIndex(m => m.id === menuId);
    if (idx > 0) {
      const temp = list[idx];
      list[idx] = list[idx - 1];
      list[idx - 1] = temp;
      
      const updated = list.map((item, i) => ({
        ...item,
        order: i + 1
      }));
      updateMenuConfig(updated);
      setSelectedMenuId(menuId);
    }
  };

  const handleMoveDown = (menuId: string) => {
    const list = [...menuConfig].sort((a, b) => a.order - b.order);
    const idx = list.findIndex(m => m.id === menuId);
    if (idx !== -1 && idx < list.length - 1) {
      const temp = list[idx];
      list[idx] = list[idx + 1];
      list[idx + 1] = temp;
      
      const updated = list.map((item, i) => ({
        ...item,
        order: i + 1
      }));
      updateMenuConfig(updated);
      setSelectedMenuId(menuId);
    }
  };

  const handleToggleVisible = (menuId: string) => {
    const updated = menuConfig.map(m => m.id === menuId ? { ...m, visible: !m.visible } : m);
    updateMenuConfig(updated);
  };

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const handleSaveMenuDetails = () => {
    if (!currentSelectedMenu) return;
    if (!editLabel.trim()) {
      setMenuError("Menu name cannot be empty.");
      return;
    }
    setMenuError(null);
    const updated = menuConfig.map(m => m.id === currentSelectedMenu.id ? {
      ...m,
      label: editLabel.trim(),
      icon: editIcon
    } : m);
    updateMenuConfig(updated);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2500);
  };

  const handleDeleteSelectedMenu = () => {
    if (!currentSelectedMenu) return;
    if (confirm(`Are you sure you want to delete the "${currentSelectedMenu.label}" menu option? This will permanently remove it from the sidebar navigation.`)) {
      const updated = menuConfig.filter(m => m.id !== currentSelectedMenu.id);
      updateMenuConfig(updated);
      setSelectedMenuId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleCreateMenu = () => {
    setMenuError(null);
    if (!newMenuId.trim() || !newMenuLabel.trim()) {
      setMenuError("ID and Label are required.");
      return;
    }
    const cleanId = newMenuId.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!cleanId) {
      setMenuError("ID cannot contain spaces or special characters.");
      return;
    }
    if (menuConfig.some(m => m.id === cleanId)) {
      setMenuError(`A menu with ID "${cleanId}" already exists.`);
      return;
    }
    const newMenu = {
      id: cleanId,
      label: newMenuLabel.trim(),
      icon: newMenuIcon,
      visible: true,
      order: menuConfig.length
    };
    updateMenuConfig([...menuConfig, newMenu]);
    setSelectedMenuId(cleanId);
    setNewMenuId('');
    setNewMenuLabel('');
    setNewMenuIcon('Layout');
    setShowCreateForm(false);
  };

  const [roles, setRoles] = useState([
    { id: 'admin', role: 'Admin', audit: true, anal: true, reprt: true, admin: true },
    { id: 'qm', role: 'Quality Manager', audit: true, anal: true, reprt: true, admin: false },
    { id: 'qs', role: 'Quality Supervisor', audit: true, anal: true, reprt: true, admin: false },
    { id: 'qa', role: 'Quality Agent', audit: false, anal: false, reprt: false, admin: false },
  ]);

  const togglePermission = (roleId: string, key: 'audit' | 'anal' | 'reprt' | 'admin') => {
    setRoles(prev => prev.map(r => r.id === roleId ? { ...r, [key]: !r[key] } : r));
  };

  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'Quality Agent' as AppUser['role'],
    password: ''
  });

  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  const handleCreateUser = () => {
    if (!newUser.name || !newUser.email) return;
    
    const user: AppUser = {
      uid: `USR-${Date.now()}`,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: 'active',
      pwdHash: newUser.password, // In a real app this would be hashed
      viewAll: newUser.role === 'Admin' || newUser.role === 'Quality Manager',
      canCreate: newUser.role !== 'Quality Agent',
      canEdit: newUser.role !== 'Quality Agent',
      canDelete: newUser.role === 'Admin',
      allowedMenus: ['dashboard', 'form', 'history', 'analytics', 'import', 'templates', 'users'],
      createdAt: new Date().toLocaleDateString(),
      lastLogin: 'Never'
    };

    updateUser(user);
    setTab('users');
    setNewUser({ name: '', email: '', role: 'Quality Agent', password: '' });
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUserStatus = (uid: string) => {
    const user = users.find(u => u.uid === uid);
    if (user) {
      updateUser({
        ...user,
        status: user.status === 'active' ? 'suspended' : 'active'
      });
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Access Control</h1>
        <p className="text-gray-500 text-sm mt-1">Manage team members, roles, and administrative permissions.</p>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('users')} className={cn("px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", tab==='users' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
          <Users className="w-3.5 h-3.5" /> All Users
        </button>
        <button onClick={() => setTab('roles')} className={cn("px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", tab==='roles' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
          <ShieldCheck className="w-3.5 h-3.5" /> Roles & Permissions
        </button>
        <button onClick={() => setTab('create')} className={cn("px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", tab==='create' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
          <UserPlus className="w-3.5 h-3.5" /> Create User
        </button>
        <button onClick={() => setTab('menu')} className={cn("px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2", tab==='menu' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
          <Layout className="w-3.5 h-3.5" /> Menu Customization
        </button>
      </div>

      {tab === 'users' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm relative">
            <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Filter by name or email..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-xl text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">User ID</th>
                    <th className="px-4 py-4">Role</th>
                    <th className="px-4 py-4 text-center">Status</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-gray-50/50 group transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                              {u.name.split(' ').map(n=>n[0]).join('')}
                           </div>
                           <div>
                              <p className="font-bold text-gray-900">{u.name}</p>
                              <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1"><Mail className="w-2.5 h-2.5" /> {u.email}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-[10px] text-gray-400 font-bold">
                        {u.uid}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                          u.role === 'Admin' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          u.role === 'Quality Manager' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                          "bg-blue-50 text-blue-600 border-blue-100"
                        )}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                           <div className={cn("w-1.5 h-1.5 rounded-full", u.status === 'active' ? "bg-green-500" : "bg-red-400")} />
                           <span className="text-xs font-semibold capitalize text-gray-600">{u.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-400 font-medium">{u.createdAt}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => toggleUserStatus(u.uid)}
                            className={cn(
                              "p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100",
                              u.status === 'active' ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"
                            )}
                            title={u.status === 'active' ? "Suspend User" : "Activate User"}
                          >
                            <Slash className="w-4 h-4" />
                          </button>
                          <div className="relative group/menu">
                            <button 
                              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all opacity-0 group-hover:opacity-100 bg-white shadow-sm border border-gray-100"
                              title="User Options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 hidden group-hover/menu:block animate-in fade-in slide-in-from-top-1 duration-200">
                               <button 
                                onClick={() => setEditingUser(u)}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                               >
                                 <ShieldCheck className="w-3.5 h-3.5" /> Manage Access
                               </button>
                               <button 
                                onClick={() => {
                                  const newPass = prompt(`Enter new password for ${u.name}`);
                                  if (newPass) updateUser({ ...u, pwdHash: newPass });
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                               >
                                 <Settings className="w-3.5 h-3.5" /> Reset Password
                               </button>
                               <div className="h-px bg-gray-50 my-1" />
                               <button 
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete ${u.name}?`)) deleteUser(u.uid);
                                }}
                                className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                               >
                                 <Trash2 className="w-3.5 h-3.5" /> Delete User
                               </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'roles' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
           <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/30">
              <h3 className="font-bold text-gray-900 text-sm">Role Access Matrix</h3>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-sm text-left border-collapse">
               <thead className="bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4">Role Name</th>
                    <th className="px-4 py-4 text-center">Audit Form</th>
                    <th className="px-4 py-4 text-center">Analytics</th>
                    <th className="px-4 py-4 text-center">Reports</th>
                    <th className="px-4 py-4 text-center">Admin Access</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                  {roles.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-gray-900">{r.role}</td>
                      <td className="px-4 py-4 text-center">
                         <button onClick={() => togglePermission(r.id, 'audit')} className={cn("p-2 rounded-lg transition-all mx-auto block", r.audit ? "text-green-600 bg-green-50" : "text-gray-300 bg-gray-50")}>
                           {r.audit ? <Check className="w-4 h-4" /> : <Slash className="w-4 h-4" />}
                         </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                         <button onClick={() => togglePermission(r.id, 'anal')} className={cn("p-2 rounded-lg transition-all mx-auto block", r.anal ? "text-green-600 bg-green-50" : "text-gray-300 bg-gray-50")}>
                           {r.anal ? <Check className="w-4 h-4" /> : <Slash className="w-4 h-4" />}
                         </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                         <button onClick={() => togglePermission(r.id, 'reprt')} className={cn("p-2 rounded-lg transition-all mx-auto block", r.reprt ? "text-green-600 bg-green-50" : "text-gray-300 bg-gray-50")}>
                           {r.reprt ? <Check className="w-4 h-4" /> : <Slash className="w-4 h-4" />}
                         </button>
                      </td>
                      <td className="px-4 py-4 text-center">
                         <button onClick={() => togglePermission(r.id, 'admin')} className={cn("p-2 rounded-lg transition-all mx-auto block", r.admin ? "text-blue-600 bg-blue-50" : "text-gray-300 bg-gray-50")}>
                           {r.admin ? <ShieldCheck className="w-4 h-4" /> : <Slash className="w-4 h-4" />}
                         </button>
                      </td>
                    </tr>
                  ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {tab === 'create' && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm max-w-2xl mx-auto overflow-hidden">
          <div className="p-8 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 text-center">Create Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Full Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition-all" 
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Email Address</label>
                <input 
                  type="email" 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition-all" 
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Assign Role</label>
                <select 
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition-all appearance-none"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as AppUser['role']})}
                >
                  <option value="Quality Agent">Quality Agent</option>
                  <option value="Quality Supervisor">Quality Supervisor</option>
                  <option value="Quality Manager">Quality Manager</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Temporary Password</label>
                <div className="relative">
                   <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                   <input 
                    type="password" 
                    placeholder="••••••••" 
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:bg-white focus:border-blue-500 transition-all" 
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                   />
                </div>
              </div>
            </div>
            <button 
              onClick={handleCreateUser}
              className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-blue-100 mt-4 hover:bg-blue-700 transition-all disabled:opacity-50"
              disabled={!newUser.name || !newUser.email}
            >
              Initialize User Access
            </button>
          </div>
        </div>
      )}
      {tab === 'menu' && (
        <div className="space-y-6 animate-in fade-in duration-200">
           <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex items-start gap-4">
              <div className="bg-white p-2 rounded-xl text-blue-600 shadow-sm">
                <Layout className="w-5 h-5" />
              </div>
              <div className="flex-1">
                 <p className="font-bold text-blue-900 leading-tight">System Navigation & Menu Customizer</p>
                 <p className="text-xs text-blue-700 mt-0.5">Click any navigation card to establish active cursor selection. Use the Control Panel on the right to easily rename the menu, change its visual icon, resequence order, or delete unnecessary options.</p>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left/Middle Column - Interactive Menu List & Add Menu */}
              <div className="lg:col-span-2 space-y-4">
                 <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 font-sans">
                       <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">System Navigation Menus</h3>
                       <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">({sortedMenus.length} items)</span>
                    </div>
                    <div className="space-y-3">
                      {sortedMenus.map((menu, index) => {
                        const isSelected = menu.id === currentSelectedMenuId;
                        return (
                          <div 
                            key={menu.id} 
                            onClick={() => setSelectedMenuId(menu.id)}
                            className={cn(
                              "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer text-left group relative", 
                              isSelected 
                                ? "border-blue-500 bg-blue-50/20 shadow-sm " 
                                : "border-gray-100 bg-white hover:bg-gray-50/50 hover:border-gray-200"
                            )}
                          >
                            <div className={cn(
                              "transition-colors",
                              isSelected ? "text-blue-500" : "text-gray-300 group-hover:text-gray-500"
                            )}>
                               <GripVertical className="w-5 h-5" />
                            </div>

                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-sm",
                               menu.visible 
                                 ? (isSelected ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600") 
                                 : "bg-gray-100 text-gray-400"
                            )}>
                               <Layout className="w-5 h-5" />
                            </div>

                            <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2">
                                 <p className={cn("font-bold text-sm truncate", menu.visible ? "text-gray-900" : "text-gray-400 line-through")}>
                                   {menu.label}
                                 </p>
                                 {isSelected && (
                                   <span className="px-1.5 py-0.5 bg-blue-600 text-white font-black text-[8px] uppercase tracking-wider rounded-md">
                                     Selected
                                   </span>
                                 )}
                               </div>
                               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">ID: {menu.id} • Icon: {menu.icon || 'default'}</p>
                            </div>
                            
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              <div className="flex bg-gray-100 rounded-lg p-0.5">
                                <button 
                                  disabled={index === 0}
                                  onClick={() => handleMoveUp(menu.id)}
                                  className="p-1 hover:bg-white rounded text-gray-500 hover:text-blue-600 disabled:opacity-30 transition-all"
                                  title="Move Up"
                                >
                                   <ChevronUp className="w-4 h-4" />
                                </button>
                                <button 
                                  disabled={index === sortedMenus.length - 1}
                                  onClick={() => handleMoveDown(menu.id)}
                                  className="p-1 hover:bg-white rounded text-gray-500 hover:text-blue-600 disabled:opacity-30 transition-all"
                                  title="Move Down"
                                >
                                   <ChevronDown className="w-4 h-4" />
                                </button>
                              </div>

                              <button 
                                onClick={() => handleToggleVisible(menu.id)}
                                className={cn(
                                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border",
                                  menu.visible 
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100" 
                                    : "bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200"
                                )}
                                title={menu.visible ? "Hide Menu" : "Show Menu"}
                              >
                                 {menu.visible ? (
                                   <><Eye className="w-3.5 h-3.5" /> Visible</>
                                 ) : (
                                   <><EyeOff className="w-3.5 h-3.5" /> Hidden</>
                                 )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                 </div>

                 {/* Collapsible Form: Add New Dynamic Menu Option */}
                 <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                       <Plus className="w-4 h-4 text-blue-600" />
                       <h3 className="text-sm font-bold text-gray-900">Create Custom Menu Option</h3>
                     </div>
                     <button 
                       onClick={() => setShowCreateForm(!showCreateForm)}
                       className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-[10px] uppercase font-black tracking-wider text-gray-600 rounded-lg transition-colors border border-gray-200 shadow-sm"
                     >
                       {showCreateForm ? 'Hide Creator' : 'Open Creator'}
                     </button>
                   </div>
                   
                   {showCreateForm && (
                     <div className="space-y-4 pt-3 border-t border-gray-100 animate-in fade-in slide-in-from-top-2 duration-250">
                       {menuError && (
                         <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-semibold">
                           {menuError}
                         </div>
                       )}

                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <div className="space-y-1">
                           <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Unique ID</label>
                           <input 
                             type="text" 
                             className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500 transition-all font-medium font-mono" 
                             placeholder="e.g. dynamic-support"
                             value={newMenuId}
                             onChange={e => setNewMenuId(e.target.value)}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Name/Label</label>
                           <input 
                             type="text" 
                             className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500 transition-all font-medium" 
                             placeholder="e.g. Help Center"
                             value={newMenuLabel}
                             onChange={e => setNewMenuLabel(e.target.value)}
                           />
                         </div>
                         <div className="space-y-1">
                           <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block pl-1">Lucide Icon</label>
                           <select 
                             className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500 transition-all font-medium appearance-none"
                             value={newMenuIcon}
                             onChange={e => setNewMenuIcon(e.target.value)}
                           >
                             <option value="LayoutDashboard">Overview (LayoutDashboard)</option>
                             <option value="FileText">Audit Form (FileText)</option>
                             <option value="History">Audit History (History)</option>
                             <option value="BarChart3">Analytics (BarChart3)</option>
                             <option value="Settings2">Quality Config (Settings2)</option>
                             <option value="UserCircle">Auditor Management (UserCircle)</option>
                             <option value="RefreshCcw">Data Sync (RefreshCcw)</option>
                             <option value="Settings">Gear (Settings)</option>
                             <option value="Layout">Default Grid (Layout)</option>
                           </select>
                         </div>
                       </div>
                       
                       <div className="flex items-center justify-between gap-4 pt-1 flex-wrap">
                         <p className="text-[10px] text-gray-400 italic">ID must be unique. The menu is added instantly to menu configurations.</p>
                         <button 
                           onClick={handleCreateMenu}
                           className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                         >
                           Add Menu Option
                         </button>
                       </div>
                     </div>
                   )}
                 </div>
              </div>

              {/* Right Column - Cursor Selection Control Center */}
              <div className="lg:col-span-1">
                 <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6 sticky top-6">
                    <div className="border-b border-gray-100 pb-3">
                       <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Active Selection Controls</span>
                       <h3 className="text-base font-bold text-gray-900 mt-1">Cursor Control Panel</h3>
                    </div>

                    {currentSelectedMenu ? (
                      <div className="space-y-6">
                         <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-3">
                           <div className="w-12 h-12 bg-blue-500 text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-100">
                             <Layout className="w-6 h-6" />
                           </div>
                           <div className="min-w-0 flex-1">
                             <p className="font-bold text-sm text-gray-900 truncate">{currentSelectedMenu.label}</p>
                             <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{currentSelectedMenu.id}</span>
                             <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                               <span className={cn(
                                 "text-[8px] font-bold uppercase py-0.5 px-1.5 rounded-md",
                                 currentSelectedMenu.visible ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                               )}>
                                 {currentSelectedMenu.visible ? "Visible" : "Hidden"}
                               </span>
                               <span className="text-[9px] text-gray-500 font-bold">Slot #{currentSelectedIndex + 1}</span>
                             </div>
                           </div>
                         </div>

                         {/* Rename / Edit details block */}
                         <div className="space-y-4 pt-4 border-t border-gray-100">
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Rename & Style Details</p>
                           
                           {menuError && !showCreateForm && (
                             <div className="p-2.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-[10px] font-semibold leading-normal">
                               {menuError}
                             </div>
                           )}

                           <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Rename Label</label>
                             <input 
                               type="text" 
                               className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500 transition-all font-medium"
                               placeholder="Rename menu option..."
                               value={editLabel}
                               onChange={e => setEditLabel(e.target.value)}
                             />
                           </div>

                           <div className="space-y-1">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Lucide Icon</label>
                             <select 
                               className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500 transition-all font-semibold appearance-none"
                               value={editIcon}
                               onChange={e => setEditIcon(e.target.value)}
                             >
                               <option value="LayoutDashboard">Overview (LayoutDashboard)</option>
                               <option value="FileText">Audit Form (FileText)</option>
                               <option value="History">Audit History (History)</option>
                               <option value="BarChart3">Analytics (BarChart3)</option>
                               <option value="Settings2">Quality Config (Settings2)</option>
                               <option value="UserCircle">Auditor Management (UserCircle)</option>
                               <option value="RefreshCcw">Data Sync (RefreshCcw)</option>
                               <option value="Settings">Gear (Settings)</option>
                               <option value="Layout">Default Grid (Layout)</option>
                             </select>
                           </div>

                           <div className="flex gap-2 pt-1">
                             <button
                               onClick={handleSaveMenuDetails}
                               className={cn(
                                 "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                                 saveSuccess 
                                   ? "bg-green-600 text-white shadow-md shadow-green-100" 
                                   : "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100"
                               )}
                             >
                               {saveSuccess ? (
                                 <>✔ Updated</>
                               ) : (
                                 <><Edit2 className="w-3.5 h-3.5" /> Save Changes</>
                               )}
                             </button>

                             <button
                               onClick={handleDeleteSelectedMenu}
                               title="Delete this Menu"
                               className="px-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl transition-all flex items-center justify-center"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </div>
                         </div>

                         <div className="space-y-3 pt-3 border-t border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Shifting Actions</p>
                            
                            <div className="grid grid-cols-2 gap-3">
                               <button
                                 disabled={currentSelectedIndex <= 0}
                                 onClick={() => handleMoveUp(currentSelectedMenu.id)}
                                 className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-blue-300 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-100 transition-all text-gray-700 font-bold group"
                                 title="Move selected menu item up"
                               >
                                  <ArrowUp className="w-4 h-4 mb-1 text-blue-500 group-hover:-translate-y-0.5 transition-transform" />
                                  <span className="text-[10px]">Move Up</span>
                               </button>
                               <button
                                 disabled={currentSelectedIndex === -1 || currentSelectedIndex === sortedMenus.length - 1}
                                 onClick={() => handleMoveDown(currentSelectedMenu.id)}
                                 className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-blue-300 disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-gray-100 transition-all text-gray-700 font-bold group"
                                 title="Move selected menu item down"
                               >
                                  <ArrowDown className="w-4 h-4 mb-1 text-blue-500 group-hover:translate-y-0.5 transition-transform" />
                                  <span className="text-[10px]">Move Down</span>
                               </button>
                            </div>

                            <button
                              onClick={() => handleToggleVisible(currentSelectedMenu.id)}
                              className={cn(
                                "w-full py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 mt-2",
                                currentSelectedMenu.visible
                                  ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                                  : "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100"
                              )}
                            >
                               {currentSelectedMenu.visible ? (
                                 <>
                                   <EyeOff className="w-4 h-4" />
                                   Hide from Sidebar
                                 </>
                               ) : (
                                 <>
                                   <Eye className="w-4 h-4" />
                                   Reveal in Sidebar
                                 </>
                               )}
                            </button>
                         </div>

                         <div className="space-y-2 pt-2 border-t border-gray-100">
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Live Structure View</p>
                           <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1.5 font-sans">
                             {sortedMenus.map((m, idx) => (
                               <div 
                                 key={m.id} 
                                 onClick={() => setSelectedMenuId(m.id)}
                                 className={cn(
                                   "flex items-center justify-between px-2 py-1 rounded text-[10px] font-medium transition-all cursor-pointer",
                                   m.id === currentSelectedMenuId 
                                     ? "bg-blue-600 text-white font-bold" 
                                     : "text-gray-500 hover:text-gray-800 hover:bg-gray-200/50"
                                 )}
                               >
                                 <span className="truncate">{m.label}</span>
                                 <span className={cn("font-mono text-[9px]", m.id === currentSelectedMenuId ? "text-blue-100" : "text-gray-400")}>
                                   #{idx + 1}
                                 </span>
                               </div>
                             ))}
                           </div>
                         </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-8">Select a navigation item on the left to activate controls.</p>
                    )}
                 </div>
              </div>
           </div>
           
           <div className="bg-gray-100 p-6 rounded-3xl space-y-2">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Developer Note</p>
              <p className="text-xs text-gray-400 font-medium italic">
                Wait for the sidebar to refresh automatically after saving changes. Some primary views such as 'Admin/User Settings' are recommended to stay visible for management.
              </p>
           </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:p-8">
           <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                 <div>
                    <h3 className="font-bold text-gray-900 leading-tight text-lg">Manage Access: {editingUser.name}</h3>
                    <p className="text-xs text-gray-500 font-medium">Define granular menu visibility and write permissions.</p>
                 </div>
                 <button 
                  onClick={() => setEditingUser(null)}
                  className="p-2 hover:bg-gray-200 rounded-xl transition-all text-gray-400 hover:text-gray-600"
                 >
                    <X className="w-5 h-5" />
                 </button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                       <Layout className="w-3.5 h-3.5" /> Menu Visibility Control
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                       {menuConfig.map(menu => (
                         <button 
                          key={menu.id}
                          onClick={() => {
                            const isAllowed = editingUser.allowedMenus?.includes(menu.id);
                            const newMenus = isAllowed 
                              ? editingUser.allowedMenus.filter(id => id !== menu.id)
                              : [...(editingUser.allowedMenus || []), menu.id];
                            setEditingUser({ ...editingUser, allowedMenus: newMenus });
                          }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all group",
                            editingUser.allowedMenus?.includes(menu.id)
                              ? "bg-blue-50 border-blue-100 text-blue-700 shadow-sm"
                              : "bg-gray-50 border-gray-100 text-gray-400 opacity-60"
                          )}
                         >
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                              editingUser.allowedMenus?.includes(menu.id) ? "bg-white shadow-sm" : "bg-gray-100"
                            )}>
                               <Layout className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-bold">{menu.label}</span>
                            <div className="ml-auto opacity-0 group-hover:opacity-100">
                               {editingUser.allowedMenus?.includes(menu.id) ? <Check className="w-3 h-3" /> : <Slash className="w-3 h-3" />}
                            </div>
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                       <ShieldCheck className="w-3.5 h-3.5" /> Functional Permissions
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4">
                          <p className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">Global Data Filters</p>
                          <div className="space-y-3">
                             <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">See All Audit History</span>
                                <button 
                                  onClick={() => setEditingUser({...editingUser, viewAll: !editingUser.viewAll})}
                                  className={cn("w-10 h-5 rounded-full transition-all relative", editingUser.viewAll ? "bg-emerald-500" : "bg-gray-300")}
                                >
                                   <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white transition-all shadow-sm", editingUser.viewAll ? "left-6" : "left-1")} />
                                </button>
                             </div>
                             <p className="text-[10px] text-gray-400 italic">If off, user only sees their own audits or assigned team audits.</p>
                          </div>
                       </div>

                       <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4">
                          <p className="text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">CRUD Operations</p>
                          <div className="space-y-3">
                             <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">Create Records</span>
                                <button 
                                  onClick={() => setEditingUser({...editingUser, canCreate: !editingUser.canCreate})}
                                  className={cn("w-8 h-4 rounded-full transition-all relative", editingUser.canCreate ? "bg-blue-500" : "bg-gray-300")}
                                >
                                   <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", editingUser.canCreate ? "left-4.5" : "left-0.5")} />
                                </button>
                             </div>
                             <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">Edit Records</span>
                                <button 
                                  onClick={() => setEditingUser({...editingUser, canEdit: !editingUser.canEdit})}
                                  className={cn("w-8 h-4 rounded-full transition-all relative", editingUser.canEdit ? "bg-blue-500" : "bg-gray-300")}
                                >
                                   <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", editingUser.canEdit ? "left-4.5" : "left-0.5")} />
                                </button>
                             </div>
                             <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">Delete Records</span>
                                <button 
                                  onClick={() => setEditingUser({...editingUser, canDelete: !editingUser.canDelete})}
                                  className={cn("w-8 h-4 rounded-full transition-all relative", editingUser.canDelete ? "bg-red-500" : "bg-gray-300")}
                                >
                                   <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", editingUser.canDelete ? "left-4.5" : "left-0.5")} />
                                </button>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                 <p className="text-[10px] text-gray-400 font-bold uppercase">Security overrides active</p>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setEditingUser(null)}
                      className="px-6 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 transition-all"
                    >
                       Cancel
                    </button>
                    <button 
                      onClick={() => {
                        if (editingUser) updateUser(editingUser);
                        setEditingUser(null);
                      }}
                      className="px-8 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                    >
                       Apply Permissions
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}