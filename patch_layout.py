import os

path = 'src/components/Layout.tsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Add Menu, X imports
content = content.replace("  Bell\n} from 'lucide-react';", "  Bell,\n  Menu,\n  X\n} from 'lucide-react';")

# 2. Add state
content = content.replace("const [collapsed, setCollapsed] = useState(false);", "const [collapsed, setCollapsed] = useState(false);\n  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);")

# 3. Update aside
old_aside = """      <aside
        className={clsx(
          'relative flex flex-col transition-all duration-300 ease-in-out z-20 flex-shrink-0',
          'bg-navy-900 border-r border-navy-800',
          collapsed ? 'w-[72px]' : 'w-64'
        )}"""
new_aside = """      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-navy-900/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'absolute md:relative flex flex-col transition-all duration-300 ease-in-out z-40 h-full flex-shrink-0',
          'bg-navy-900 border-r border-navy-800',
          collapsed ? 'w-[72px] hidden md:flex' : 'w-64',
          !mobileMenuOpen && 'max-md:-translate-x-full'
        )}"""
content = content.replace(old_aside, new_aside)

# 4. Close mobile menu on nav click
content = content.replace("title={collapsed ? item.label : undefined}", "title={collapsed ? item.label : undefined}\n              onClick={() => setMobileMenuOpen(false)}")

# 5. Add hamburger to header
old_header = """        {/* Topbar */}
        <header className='h-14 flex-shrink-0 flex items-center justify-between px-6 bg-white border-b border-navy-100'>
          {/* Search */}
          <div className='relative flex-1 max-w-md group'>"""
new_header = """        {/* Topbar */}
        <header className='h-14 flex-shrink-0 flex items-center justify-between px-4 md:px-6 bg-white border-b border-navy-100 gap-3'>
          <button 
            className="md:hidden p-2 -ml-2 text-navy-500 hover:bg-navy-50 rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          
          {/* Search */}
          <div className='relative flex-1 max-w-md group'>"""
content = content.replace(old_header, new_header)

with open(path, 'w') as f:
    f.write(content)
print("done")
