import os

files = [
    "src/pages/Projects.tsx",
    "src/pages/Import.tsx",
    "src/pages/Reports.tsx",
    "src/pages/Schedule.tsx"
]

def apply(f):
    if not os.path.exists(f): return
    with open(f, 'r') as file: content = file.read()
    
    # Projects
    content = content.replace("className='px-6 py-4'", "className='table-header'")
    content = content.replace("className='px-6 py-4 text-right'", "className='table-header text-right'")
    content = content.replace("className='px-6 py-4 whitespace-nowrap'", "className='table-cell'")
    
    # Import/Reports
    content = content.replace("className=\"px-4 py-3 text-xs font-bold text-navy-500 uppercase tracking-wider\"", "className=\"table-header\"")
    content = content.replace("className=\"px-4 py-3 text-xs font-bold text-navy-500 uppercase tracking-wider w-[35%]\"", "className=\"table-header w-[35%]\"")
    content = content.replace("className=\"px-4 py-3 text-xs font-bold text-navy-500 uppercase tracking-wider text-center\"", "className=\"table-header text-center\"")
    content = content.replace("className=\"px-4 py-3 whitespace-nowrap text-sm text-navy-700\"", "className=\"table-cell\"")
    content = content.replace("className=\"px-4 py-3 text-sm text-navy-700\"", "className=\"table-cell\"")

    # Schedule
    content = content.replace("className='p-3 border-b border-navy-200'", "className='table-header'")
    content = content.replace("className='p-3 border-b border-navy-200 w-1/2'", "className='table-header w-1/2'")
    content = content.replace("className='p-3 text-sm text-navy-700'", "className='table-cell'")

    # Extra buttons in Projects/Reports
    content = content.replace("className='bg-white text-navy-700 px-4 py-2 rounded-lg border border-navy-200 hover:bg-navy-50 transition-colors shadow-sm font-semibold flex items-center gap-2'", "className='btn-secondary'")
    content = content.replace("className='bg-navy-900 text-white px-5 py-2 rounded-lg hover:bg-navy-800 transition-colors shadow-sm font-semibold flex items-center gap-2'", "className='btn-primary'")
    content = content.replace("className='bg-primary-600 text-white px-5 py-2 rounded-lg hover:bg-primary-700 transition-colors shadow-sm font-semibold flex items-center gap-2'", "className='btn-primary'")
    
    with open(f, 'w') as file: file.write(content)

for file in files: apply(file)
print("Standardized tables.")
