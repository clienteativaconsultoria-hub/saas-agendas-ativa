import os
import re

files = [
    'src/pages/Config.tsx',
    'src/pages/MobileView.tsx',
    'src/pages/Consultants.tsx',
    'src/pages/Home.tsx',
    'src/pages/Dashboard.tsx',
    'src/pages/Import.tsx',
    'src/pages/Reports.tsx',
    'src/pages/Schedule.tsx'
]

replacements = [
    ("text-emerald-400", "text-navy-400"),
    ("text-emerald-600", "text-navy-900"),
    ("text-amber-500", "text-navy-400"),
    ("text-amber-600", "text-navy-900"),
    ("text-purple-600", "text-primary-600"),
    ("text-red-500", "text-primary-500"), # asterisks for required fields
    ("bg-emerald-50", "bg-navy-50"),
    ("bg-emerald-600", "bg-navy-900"),
    ("hover:bg-emerald-600", "hover:bg-navy-900"),
    ("text-emerald-700", "text-navy-900"),
    ("hover:text-amber-600 hover:bg-amber-50", "hover:text-navy-900 hover:bg-navy-50"),
    ("hover:text-red-600 hover:bg-red-50", "hover:text-navy-900 hover:bg-navy-50"),
    ("text-red-600", "text-navy-900"),
    ("bg-purple-50", "bg-primary-50"),
    ("hover:bg-purple-100", "hover:bg-primary-100"),
    ("hover:text-purple-700", "hover:text-primary-700"),
    ("bg-amber-50", "bg-navy-50"),
]

for file_path in files:
    if not os.path.exists(file_path): continue
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Do not replace required asterisk colors if we want to keep them red, 
    # but the user said "principalmente icones". Let's replace all except the asterisks for required fields.
    # Actually user says "padronize as cores em /consultants...". The asterisks in red might be fine, but if we change to primary it's also okay.
    
    for old, new in replacements:
        content = content.replace(old, new)
        
    with open(file_path, 'w') as f:
        f.write(content)
print("done")
